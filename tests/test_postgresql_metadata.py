"""PostgreSQL metadata database checks.

The tests are intentionally opt-in through the normal PG_* environment
variables (or SUPERSET_SQLALCHEMY_DATABASE_URI).  They never require a
database for the unit-test suite and use temporary tables for write-path
checks so the imported metadata is not modified.
"""

import os
from urllib.parse import quote_plus
import unittest

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


def _metadata_uri():
    uri = os.environ.get("SUPERSET_SQLALCHEMY_DATABASE_URI")
    if uri:
        return uri
    password = os.environ.get("PG_PASSWORD")
    if password is None:
        return None
    user = quote_plus(os.environ.get("PG_USER", "postgres"))
    password = quote_plus(password)
    host = os.environ.get("PG_HOST", "localhost")
    port = os.environ.get("PG_PORT", "5432")
    database = os.environ.get("PG_DATABASE", "superset")
    return f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{database}"


class PostgreSQLMetadataTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        uri = _metadata_uri()
        if not uri:
            raise unittest.SkipTest(
                "Set SUPERSET_SQLALCHEMY_DATABASE_URI or PG_* to run PostgreSQL checks"
            )
        try:
            cls.engine = sa.create_engine(uri, future=True)
            with cls.engine.connect() as connection:
                cls.identity = connection.execute(
                    sa.text(
                        "SELECT version(), current_database(), current_user, "
                        "current_schema()"
                    )
                ).one()
        except Exception as exc:  # pragma: no cover - depends on local service
            raise unittest.SkipTest(f"PostgreSQL is unavailable: {exc}") from exc
        if cls.engine.dialect.name != "postgresql":
            raise unittest.SkipTest(
                f"metadata URI resolved to {cls.engine.dialect.name}, not PostgreSQL"
            )

    @classmethod
    def tearDownClass(cls):
        if hasattr(cls, "engine"):
            cls.engine.dispose()

    def test_connection_identity(self):
        version, database, user, schema = self.identity
        self.assertIn("PostgreSQL", version)
        self.assertEqual(os.environ.get("PG_DATABASE", "superset"), database)
        self.assertTrue(user)
        self.assertEqual(os.environ.get("PG_SCHEMA", "public"), schema)

    def test_metadata_timestamps_are_without_time_zone(self):
        with self.engine.connect() as connection:
            timezone_columns = connection.execute(
                sa.text(
                    "SELECT table_schema, table_name, column_name "
                    "FROM information_schema.columns "
                    "WHERE table_schema NOT IN ('pg_catalog', 'information_schema') "
                    "AND data_type = 'timestamp with time zone' "
                    "ORDER BY table_schema, table_name, ordinal_position"
                )
            ).all()
        self.assertEqual([], timezone_columns)

    def test_user_expire_date_is_a_naive_datetime(self):
        from superset.sec_models_core import UserCustom

        session = sa.orm.sessionmaker(bind=self.engine)()
        try:
            expire_date = session.query(UserCustom.expire_date).filter(
                UserCustom.expire_date.isnot(None)
            ).first()
        finally:
            session.close()
        self.assertIsNotNone(expire_date)
        self.assertIsNone(expire_date[0].tzinfo)

    def test_orm_metadata_compiles_for_postgresql(self):
        # Importing the legacy models also verifies that the application can
        # initialize with the same PostgreSQL URI used by the test engine.
        from superset.models.core import Database, Report, WarnIndex
        from superset.sec_models_core import UserCustom

        report_sql = str(
            sa.select(Report).where(Report.categoryid == sa.bindparam("categoryid"))
            .compile(dialect=postgresql.dialect())
        )
        self.assertIn('reports.categoryid', report_sql)
        self.assertNotIn("LONGTEXT", report_sql.upper())
        self.assertEqual("TEXT", str(Report.description.type).upper())
        self.assertEqual("TEXT", str(Report.description_ai.type).upper())
        self.assertIn("FLOAT", str(WarnIndex.warn_value.type).upper())
        self.assertFalse(Report.report_public_date.type.timezone)
        self.assertFalse(UserCustom.expire_date.type.timezone)
        self.assertTrue(Database.password.type)

    def test_key_model_queries(self):
        from superset.models.core import Database, Report, WarnIndex

        session = sa.orm.sessionmaker(bind=self.engine)()
        try:
            self.assertGreaterEqual(session.query(Database).count(), 0)
            self.assertGreaterEqual(session.query(Report).count(), 0)
            self.assertGreaterEqual(session.query(WarnIndex).count(), 0)
            session.query(Report).limit(1).all()
            session.query(WarnIndex).limit(1).all()
        finally:
            session.close()

    def test_report_three_year_filter(self):
        query = sa.text(
            "SELECT count(*) FROM reports "
            "WHERE report_public_date >= CURRENT_DATE - INTERVAL '3 years'"
        )
        with self.engine.connect() as connection:
            count = connection.execute(query).scalar_one()
        self.assertGreaterEqual(count, 0)

    def test_warning_and_home_report_queries(self):
        warning_query = sa.text(
            "SELECT warn_index, warn_condition, warn_value, index_max_date, "
            "send_time, dashboard_id, slice_id FROM warn_index "
            "WHERE username = :username AND LOCALTIMESTAMP <= expire_time "
            "AND send_time IS NOT NULL"
        )
        home_report_query = sa.text(
            "(SELECT id, report_title, variety, report_public_date, "
            "report_file_suffix FROM reports WHERE report_file_suffix = 'pdf' "
            "ORDER BY report_public_date DESC, id DESC LIMIT 5) UNION ALL "
            "(SELECT id, report_title, variety, report_public_date, "
            "report_file_suffix FROM reports WHERE report_file_suffix = 'mp4' "
            "ORDER BY report_public_date DESC, id DESC LIMIT 5)"
        )
        with self.engine.connect() as connection:
            warnings = connection.execute(
                warning_query, {"username": "__postgresql_test_user__"}
            ).all()
            reports = connection.execute(home_report_query).all()
        self.assertIsInstance(warnings, list)
        self.assertLessEqual(len(reports), 10)

    def test_returning_ids_and_transaction_rollback(self):
        # Temporary tables make this a real PostgreSQL RETURNING/rollback
        # check without inserting into task_report or ppt_templates.
        with self.engine.connect() as connection:
            transaction = connection.begin()
            try:
                connection.execute(
                    sa.text(
                        "CREATE TEMP TABLE _superset_returning_test ("
                        "id bigint GENERATED BY DEFAULT AS IDENTITY, "
                        "name text)"
                    )
                )
                task_id = connection.execute(
                    sa.text(
                        "INSERT INTO _superset_returning_test (name) "
                        "VALUES (:name) RETURNING id"
                    ),
                    {"name": "task"},
                ).scalar_one()
                template_id = connection.execute(
                    sa.text(
                        "INSERT INTO _superset_returning_test (name) "
                        "VALUES (:name) RETURNING id"
                    ),
                    {"name": "template"},
                ).scalar_one()
                self.assertIsInstance(task_id, int)
                self.assertIsInstance(template_id, int)
                transaction.rollback()
            except Exception:
                transaction.rollback()
                raise

            with self.assertRaises(sa.exc.ProgrammingError):
                connection.execute(sa.text("SELECT 1 FROM _superset_returning_test"))

    def test_key_sequences_are_not_behind_table_ids(self):
        sequence_columns = {
            "ab_user": "id",
            "dbs": "id",
            "reports": "id",
            "warn_index": "id",
            "task_report": "taskid",
            "ppt_templates": "template_id",
        }
        with self.engine.connect() as connection:
            for table, column in sequence_columns.items():
                sequence_name = connection.execute(
                    sa.text("SELECT pg_get_serial_sequence(:table_name, :column_name)"),
                    {"table_name": table, "column_name": column},
                ).scalar_one_or_none()
                if not sequence_name:
                    continue
                max_id = connection.execute(
                    sa.text(f'SELECT COALESCE(MAX("{column}"), 0) FROM "{table}"')
                ).scalar_one()
                sequence_value = connection.execute(
                    sa.text("SELECT last_value FROM " + sequence_name)
                ).scalar_one()
                self.assertGreaterEqual(
                    sequence_value,
                    max_id,
                    f"{sequence_name} is behind {table}.{column}",
                )


if __name__ == "__main__":
    unittest.main()
