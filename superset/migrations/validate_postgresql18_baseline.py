"""Validate the PostgreSQL 18 baseline in a newly created test database."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import os

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine.url import make_url

TEST_DATABASE = 'superset_postgresql18_baseline_test'
BASELINE = Path(__file__).parent / 'versions' / '20260905_postgresql18_baseline.py'


def get_database_uri():
    uri = os.environ.get('SUPERSET_BASELINE_DATABASE_URI')
    if not uri:
        raise RuntimeError('Set SUPERSET_BASELINE_DATABASE_URI for validation')
    return uri


source_url = make_url(get_database_uri())
admin_url = source_url.set(database='postgres')
test_url = source_url.set(database=TEST_DATABASE)
admin_engine = create_engine(admin_url, isolation_level='AUTOCOMMIT', future=True)
test_engine = create_engine(test_url, future=True)
created = False

try:
    with admin_engine.connect() as connection:
        exists = connection.execute(
            text('select 1 from pg_database where datname = :name'),
            {'name': TEST_DATABASE},
        ).scalar()
        if exists:
            raise RuntimeError(
                'Refusing to use pre-existing database {}'.format(TEST_DATABASE))
        connection.exec_driver_sql(
            'CREATE DATABASE {}'.format('"{}"'.format(TEST_DATABASE)))
        created = True

    spec = spec_from_file_location('postgresql18_baseline', BASELINE)
    baseline = module_from_spec(spec)
    spec.loader.exec_module(baseline)

    with test_engine.connect() as connection:
        baseline.op = Operations(MigrationContext.configure(connection))
        baseline.upgrade()
        connection.commit()

    inspector = inspect(test_engine)
    actual_tables = sorted(inspector.get_table_names(schema='public'))
    expected_tables = sorted(baseline.TABLE_NAMES)
    if actual_tables != expected_tables:
        raise AssertionError(
            'table list mismatch: {} != {}'.format(actual_tables, expected_tables))
    actual_views = sorted(inspector.get_view_names(schema='public'))
    if actual_views != sorted(baseline.VIEW_NAMES):
        raise AssertionError('view list mismatch')

    with test_engine.connect() as connection:
        timezone_columns = connection.execute(text("""
            select table_schema, table_name, column_name
            from information_schema.columns
            where table_schema = 'public'
              and data_type = 'timestamp with time zone'
        """)).fetchall()
        if timezone_columns:
            raise AssertionError(
                'baseline created timestamptz columns: {}'.format(timezone_columns))

        baseline.op = Operations(MigrationContext.configure(connection))
        baseline.downgrade()
        connection.commit()

    inspector = inspect(test_engine)
    if inspector.get_table_names(schema='public') or inspector.get_view_names(schema='public'):
        raise AssertionError('downgrade left database objects behind')
    print('validated PostgreSQL baseline in {}'.format(TEST_DATABASE))
finally:
    test_engine.dispose()
    if created:
        with admin_engine.connect() as connection:
            connection.exec_driver_sql(
                'DROP DATABASE {}'.format('"{}"'.format(TEST_DATABASE)))
    admin_engine.dispose()
