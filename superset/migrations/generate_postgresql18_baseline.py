"""Generate the PostgreSQL 18 metadata schema baseline from the deployed DB.

The generator reads schema only. It excludes application data, Superset sample
tables, ``_copy`` backup tables, the Alembic version table, and ownership or
privilege metadata. The generated migration is intended for a new empty
PostgreSQL metadata database; it must not be applied to an existing database
that contains application data.
"""

from pathlib import Path
import ast
import os
import shutil
import subprocess
from urllib.parse import quote_plus

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine.url import make_url

REVISION = '20260905_postgresql18'
TARGET = Path(__file__).parent / 'versions' / (REVISION + '_baseline.py')
SAMPLE_TABLES = {
    'bart_lines',
    'birth_france_by_region',
    'birth_names',
    'energy_usage',
    'flights',
    'long_lat',
    'multiformat_time_series',
    'paris_iris_mapping',
    'random_time_series',
    'sf_population_polygons',
}


def is_excluded_table(table):
    normalized = table.lower()
    return normalized == 'alembic_version' or normalized in SAMPLE_TABLES or '_copy' in normalized


def get_database_uri():
    uri = os.environ.get('SUPERSET_BASELINE_DATABASE_URI')
    if uri:
        return uri

    config_path = Path(__file__).parents[1] / 'config.py'
    tree = ast.parse(config_path.read_text(encoding='utf-8'), str(config_path))
    values = {}
    names = {
        'META_DB_USER', 'META_DB_PASSWORD', 'META_DB_HOST',
        'META_DB_PORT', 'META_DB_NAME',
    }
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id in names:
                    values[target.id] = ast.literal_eval(node.value)
    if set(values) != names:
        raise RuntimeError(
            'Set SUPERSET_BASELINE_DATABASE_URI or define all META_DB_* values'
        )
    return 'postgresql+psycopg2://{}:{}@{}:{}/{}'.format(
        quote_plus(values['META_DB_USER']),
        quote_plus(values['META_DB_PASSWORD']),
        values['META_DB_HOST'], values['META_DB_PORT'], values['META_DB_NAME'])


def quote_identifier(identifier):
    return '"{}"'.format(identifier.replace('"', '""'))


def get_pg_dump(url, excluded_relations):
    pg_dump = shutil.which('pg_dump')
    if not pg_dump:
        raise RuntimeError('pg_dump was not found on PATH')

    command = [
        pg_dump,
        '--schema-only',
        '--no-owner',
        '--no-privileges',
        '--no-comments',
        '--schema=public',
        '--host', url.host,
        '--port', str(url.port or 5432),
        '--username', url.username,
        '--dbname', url.database,
    ]
    for relation in excluded_relations:
        command.extend(['--exclude-table', 'public.' + relation])

    environment = os.environ.copy()
    if url.password is not None:
        environment['PGPASSWORD'] = url.password
    result = subprocess.run(
        command,
        check=True,
        capture_output=True,
        text=True,
        env=environment,
    )
    # psql meta-commands are not understood by a SQLAlchemy DBAPI connection.
    dump = '\n'.join(
        line for line in result.stdout.splitlines()
        if not line.startswith('\\')
    )
    # The public schema exists in a new PostgreSQL database. Keeping this
    # statement would make a fresh baseline fail with "already exists".
    dump = dump.replace('CREATE SCHEMA public;', '')
    return dump.strip() + '\n'


uri = get_database_uri()
source_url = make_url(uri)
engine = create_engine(uri, future=True)
try:
    with engine.connect() as connection:
        inspector = inspect(connection)
        all_tables = inspector.get_table_names(schema='public')
        tables = sorted(
            table for table in all_tables
            if not is_excluded_table(table)
        )
        views = sorted(inspector.get_view_names(schema='public'))
        owned_sequences = connection.execute(text("""
            select sequence_class.relname, table_class.relname
            from pg_class sequence_class
            join pg_namespace sequence_schema
              on sequence_schema.oid = sequence_class.relnamespace
            join pg_depend dependency
              on dependency.objid = sequence_class.oid
             and dependency.deptype = 'a'
            join pg_class table_class
              on table_class.oid = dependency.refobjid
            join pg_namespace table_schema
              on table_schema.oid = table_class.relnamespace
            where sequence_schema.nspname = 'public'
              and table_schema.nspname = 'public'
              and sequence_class.relkind = 'S'
        """)).fetchall()
        procedures = connection.execute(text("""
            select p.proname, pg_get_function_identity_arguments(p.oid)
            from pg_proc p
            join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public'
              and p.prokind = 'p'
            order by p.proname, pg_get_function_identity_arguments(p.oid)
        """)).fetchall()
finally:
    engine.dispose()

excluded_tables = sorted(table for table in all_tables if is_excluded_table(table))
excluded_sequences = sorted(
    sequence for sequence, table in owned_sequences
    if is_excluded_table(table)
)
schema_sql = get_pg_dump(source_url, [
    'alembic_version',
    *excluded_tables,
    *excluded_sequences,
])

content = '''"""PostgreSQL 18 metadata schema baseline captured from the deployed DB.

Revision ID: {revision}
Revises: None
Create Date: 2026-09-05

This migration contains schema only. It excludes sample and ``_copy`` backup
tables, application data, Alembic runtime state, ownership/privilege metadata,
and runtime sequence values. It is for a new empty PostgreSQL metadata
database and must not be applied to the existing deployed database.
"""

from alembic import op


revision = {revision_literal}
down_revision = None


SCHEMA_SQL = {schema_sql}
TABLE_NAMES = {table_names}
VIEW_NAMES = {view_names}
PROCEDURES = {procedures}


def upgrade():
    op.get_bind().exec_driver_sql(SCHEMA_SQL)


def downgrade():
    bind = op.get_bind()
    for name, arguments in reversed(PROCEDURES):
        bind.exec_driver_sql(
            'DROP PROCEDURE IF EXISTS public.{{}}({{}})'.format(
                quote_identifier(name), arguments))
    for name in reversed(VIEW_NAMES):
        bind.exec_driver_sql(
            'DROP VIEW IF EXISTS public.{{}} CASCADE'.format(quote_identifier(name)))
    for name in reversed(TABLE_NAMES):
        bind.exec_driver_sql(
            'DROP TABLE IF EXISTS public.{{}} CASCADE'.format(quote_identifier(name)))


def quote_identifier(identifier):
    return '"{{}}"'.format(identifier.replace('"', '""'))
'''.format(
    revision=REVISION,
    revision_literal=repr(REVISION),
    schema_sql=repr(schema_sql),
    table_names=repr(tables),
    view_names=repr(views),
    procedures=repr(
        [(name, arguments) for name, arguments in procedures]),
)

TARGET.write_text(content, encoding='utf-8')
print('generated {} tables, {} views, {} procedures at {}'.format(
    len(tables), len(views), len(procedures), TARGET))
