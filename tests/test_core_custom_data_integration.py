import ast
from datetime import datetime, timedelta
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, Mock, patch

from flask import Response
import pandas as pd
import sqlalchemy as sqla
from sqlalchemy.dialects import mssql, postgresql


VIEWS_PATH = Path(__file__).parents[1] / 'superset' / 'views'
MODULE_PATH = VIEWS_PATH / 'core_custom.py'
ANALYZE_SPEC = importlib.util.spec_from_file_location(
    'utils_analyze', VIEWS_PATH / 'utils_analyze.py')
ANALYZE = importlib.util.module_from_spec(ANALYZE_SPEC)
ANALYZE_SPEC.loader.exec_module(ANALYZE)


def load_public_api(database):
    # Load only the relevant methods, without initializing Superset or its services.
    tree = ast.parse(MODULE_PATH.read_text(encoding='utf-8'))
    public_api = next(
        node for node in tree.body
        if isinstance(node, ast.ClassDef) and node.name == 'PublicApi')
    methods = [
        node for node in public_api.body
        if isinstance(node, ast.FunctionDef)
        and node.name in ('apis', '_data_integration')]
    for method in methods:
        method.decorator_list = []
    isolated_module = ast.Module(body=methods, type_ignores=[])
    ast.fix_missing_locations(isolated_module)
    session = Mock()
    session.query.return_value.filter_by.return_value.first.return_value = database
    namespace = {
        'config': {'INDEX_MANAGE': {'paramsDbName': 'fengyun'},
                   'API_TOKEN': 'isolated-test-token'},
        'db': SimpleNamespace(session=session),
        'models': SimpleNamespace(Database=object()),
        'datetime': datetime,
        'timedelta': timedelta,
        'json': json,
        'json_success': lambda payload: Response(
            payload, mimetype='application/json'),
        'json_error_response': lambda message, status=500: Response(
            json.dumps({'error': message}), status=status,
            mimetype='application/json'),
        'logging': Mock(),
        'pd': pd,
        'sqla': sqla,
        'request': Mock(),
        'requests': Mock(),
        'summarize_series': ANALYZE.summarize_series,
        'traceback': Mock(),
    }
    exec(compile(isolated_module, str(MODULE_PATH), 'exec'), namespace)
    api = type('PublicApi', (), {
        method.name: namespace[method.name] for method in methods})()
    return api, namespace


class PublicApiDataIntegrationTest(unittest.TestCase):

    def setUp(self):
        # All SQL executes against a disposable, in-memory test database.
        self.engine = sqla.create_engine('sqlite://')
        self.addCleanup(self.engine.dispose)
        metadata = sqla.MetaData()
        self.index_map = sqla.Table(
            'index_map', metadata,
            sqla.Column('指标名称', sqla.String),
            sqla.Column('数据表', sqla.String))
        self.tables = {}
        for name in ('daily_data', 'other_data'):
            self.tables[name] = sqla.Table(
                name, metadata,
                sqla.Column('指标名', sqla.String),
                sqla.Column('指标日期', sqla.DateTime),
                sqla.Column('指标值', sqla.Float))
        metadata.create_all(self.engine)
        with self.engine.begin() as connection:
            connection.execute(sqla.text(
                'CREATE VIEW "视图_行情_全站指标列表" AS '
                'SELECT "指标名称", "数据表" FROM index_map'))
            connection.execute(self.index_map.insert(), [
                {'指标名称': '指标A', '数据表': 'daily_data'},
                {'指标名称': '指标A', '数据表': 'daily_data'},
                {'指标名称': '指标B', '数据表': 'daily_data'},
                {'指标名称': '指标C', '数据表': 'main.other_data'},
            ])
            connection.execute(self.tables['daily_data'].insert(), [
                {'指标名': '指标A', '指标日期': datetime(2026, 8, 31, 23, 59),
                 '指标值': 100},
                {'指标名': '指标A', '指标日期': datetime(2026, 9, 1),
                 '指标值': 10},
                {'指标名': '指标A', '指标日期': datetime(2026, 9, 2, 23, 59, 59),
                 '指标值': 20},
                {'指标名': '指标A', '指标日期': datetime(2026, 9, 3),
                 '指标值': 200},
                {'指标名': '指标B', '指标日期': datetime(2026, 9, 1),
                 '指标值': 30},
                {'指标名': '未选择指标', '指标日期': datetime(2026, 9, 1),
                 '指标值': 300},
            ])
            connection.execute(self.tables['other_data'].insert(), [
                {'指标名': '指标C', '指标日期': datetime(2026, 9, 1),
                 '指标值': 40},
            ])
        self.database = Mock()
        self.database.get_sqla_engine.return_value = self.engine
        self.api, self.namespace = load_public_api(self.database)
        self.queries = []
        self.connections = []
        sqla.event.listen(self.engine, 'before_cursor_execute',
                          self.record_query)

    def record_query(self, connection, cursor, statement, parameters,
                     context, executemany):
        self.queries.append((statement, parameters))
        self.connections.append(connection)

    def integrate(self, **overrides):
        data = {
            'symbols': ['指标A', '指标B', '指标C', '指标A'],
            'begin': '2026-09-01',
            'end': '2026-09-02',
            'data_type': 'original',
        }
        data.update(overrides)
        return self.api._data_integration(data)

    def test_batches_by_table_reuses_connection_and_renames_columns(self):
        response = self.integrate()

        self.assertEqual(200, response.status_code)
        rows = response.get_json()['data']
        self.assertEqual(4, len(rows))
        self.assertEqual([10, 20, 30, 40], sorted(
            row['指标值'] for row in rows))
        self.assertTrue(all(set(row) == {
            '指标名称', '指标时间', '指标值'} for row in rows))
        self.assertEqual(3, len(self.queries))
        self.assertTrue(all(connection is self.connections[0]
                            for connection in self.connections))
        self.assertTrue(self.connections[0].closed)
        self.database.get_sqla_engine.assert_called_once()
        self.namespace['db'].session.query.return_value.filter_by.assert_called_once_with(
            database_name='fengyun')
        self.namespace['requests'].post.assert_not_called()

    def test_integration_keeps_existing_summary_calculation(self):
        response = self.integrate(data_type='integration')

        self.assertEqual(200, response.status_code)
        rows = {row['指标名称']: row for row in response.get_json()['data']}
        self.assertEqual({'指标A', '指标B', '指标C'}, set(rows))
        self.assertEqual(20, rows['指标A']['最新值'])
        self.assertEqual('2026-09-02', rows['指标A']['最新日期'])
        self.assertEqual(10, rows['指标A']['较上期增减'])
        self.assertEqual(10, rows['指标A']['历史最低'])
        self.assertNotIn('上期日期', rows['指标B'])

    def test_empty_symbols_do_not_query_database(self):
        response = self.integrate(symbols=[])

        self.assertEqual({'data': []}, response.get_json())
        self.namespace['db'].session.query.assert_not_called()
        self.assertEqual([], self.queries)

    def test_unknown_symbols_return_empty_data(self):
        response = self.integrate(symbols=['不存在的指标'])

        self.assertEqual({'data': []}, response.get_json())
        self.assertEqual(1, len(self.queries))

    def test_date_range_without_rows_returns_empty_data_in_both_modes(self):
        for data_type in ('original', 'integration'):
            with self.subTest(data_type=data_type):
                response = self.integrate(
                    begin='1990-01-01', end='1990-01-02', data_type=data_type)
                self.assertEqual({'data': []}, response.get_json())

    def test_invalid_symbols_are_rejected_before_querying(self):
        for symbols in (None, '指标A', [None], [''], [1]):
            with self.subTest(symbols=symbols):
                response = self.integrate(symbols=symbols)
                self.assertEqual(400, response.status_code)
        self.assertEqual([], self.queries)

    def test_invalid_payload_is_rejected_before_querying(self):
        for data in (None, [], 'invalid'):
            with self.subTest(data=data):
                response = self.api._data_integration(data)
                self.assertEqual(400, response.status_code)
        self.namespace['db'].session.query.assert_not_called()

    def test_invalid_date_range_is_rejected_before_querying(self):
        for dates in (
                {'begin': 'invalid'}, {'end': 'invalid'},
                {'begin': '2026-09-03', 'end': '2026-09-01'}):
            with self.subTest(dates=dates):
                response = self.integrate(**dates)
                self.assertEqual(400, response.status_code)
        self.namespace['db'].session.query.assert_not_called()

    def test_default_range_includes_today_and_excludes_pre_2000_rows(self):
        today = datetime.now().replace(hour=0, minute=0, second=0,
                                       microsecond=0)
        with self.engine.begin() as connection:
            connection.execute(self.tables['daily_data'].insert(), [
                {'指标名': '指标A', '指标日期': datetime(1999, 12, 31),
                 '指标值': 1},
                {'指标名': '指标A', '指标日期': today + timedelta(hours=23),
                 '指标值': 2},
                {'指标名': '指标A', '指标日期': today + timedelta(days=1),
                 '指标值': 3},
            ])

        response = self.integrate(symbols=['指标A'], begin=None, end=None)

        values = [row['指标值'] for row in response.get_json()['data']]
        self.assertIn(2, values)
        self.assertNotIn(1, values)
        self.assertNotIn(3, values)

    def test_symbols_containing_sql_are_bound_as_values(self):
        symbol = "price'); DROP TABLE index_map;--"
        with self.engine.begin() as connection:
            connection.execute(self.index_map.insert(), [
                {'指标名称': symbol, '数据表': 'daily_data'},
            ])
            connection.execute(self.tables['daily_data'].insert(), [
                {'指标名': symbol, '指标日期': datetime(2026, 9, 1),
                 '指标值': 50},
            ])
        self.queries.clear()

        response = self.integrate(symbols=[symbol])

        self.assertEqual(200, response.status_code)
        self.assertEqual(symbol, response.get_json()['data'][0]['指标名称'])
        self.assertEqual(2, len(self.queries))
        for statement, parameters in self.queries:
            self.assertNotIn(symbol, statement)
            self.assertIn(symbol, parameters)

    def test_table_names_with_spaces_and_escaped_quotes(self):
        name = 'daily "data"'
        metadata = sqla.MetaData()
        table = sqla.Table(
            name, metadata,
            sqla.Column('指标名', sqla.String),
            sqla.Column('指标日期', sqla.DateTime),
            sqla.Column('指标值', sqla.Float))
        table.create(self.engine)
        with self.engine.begin() as connection:
            connection.execute(self.index_map.insert(), [
                {'指标名称': 'quoted', '数据表': '"main"."daily ""data"""'},
            ])
            connection.execute(table.insert(), [
                {'指标名': 'quoted', '指标日期': datetime(2026, 9, 1),
                 '指标值': 60},
            ])

        response = self.integrate(symbols=['quoted'])

        self.assertEqual(200, response.status_code)
        self.assertEqual(60, response.get_json()['data'][0]['指标值'])

    def test_qualified_table_names_use_the_connection_dialect(self):
        cases = (
            (postgresql.dialect(), 'public.daily_data',
             '"public"."daily_data"'),
            (postgresql.dialect(), '"public"."daily.data"',
             '"public"."daily.data"'),
            (mssql.dialect(), 'market.dbo.daily_data',
             '[market].[dbo].[daily_data]'),
            (mssql.dialect(), '[market].[dbo].[daily.data]',
             '[market].[dbo].[daily.data]'),
        )
        for dialect, table_name, quoted_name in cases:
            with self.subTest(dialect=dialect.name, table_name=table_name):
                engine = MagicMock(dialect=dialect)
                self.database.get_sqla_engine.return_value = engine
                frames = [
                    pd.DataFrame([{'指标名称': '指标A', '数据表': table_name}]),
                    pd.DataFrame([{
                        '指标名': '指标A', '指标日期': datetime(2026, 9, 1),
                        '指标值': 10}]),
                ]
                with patch.object(pd, 'read_sql', side_effect=frames) as read_sql:
                    response = self.integrate(symbols=['指标A'])

                self.assertEqual(200, response.status_code)
                query, _ = read_sql.call_args.args
                params = read_sql.call_args.kwargs['params']
                compiled = query.params(**params).compile(
                    dialect=dialect,
                    compile_kwargs={'render_postcompile': True})
                self.assertIn(f'FROM {quoted_name}', str(compiled))
                self.assertNotIn('指标A', str(compiled))
                self.assertIn('指标A', compiled.params.values())

    def test_query_failure_closes_connection_and_hides_error_details(self):
        with self.engine.begin() as connection:
            connection.execute(self.index_map.insert(), [
                {'指标名称': 'missing', '数据表': 'missing_data'},
            ])

        response = self.integrate(symbols=['missing'])

        self.assertEqual(500, response.status_code)
        self.assertTrue(self.connections[-1].closed)
        self.assertNotIn('missing_data', response.get_data(as_text=True))
        self.assertNotIn('SELECT', response.get_data(as_text=True))

    def test_missing_database_returns_controlled_error(self):
        query = self.namespace['db'].session.query.return_value
        query.filter_by.return_value.first.return_value = None

        response = self.integrate()

        self.assertEqual(500, response.status_code)
        self.assertIn('error', response.get_json())
        self.assertEqual([], self.queries)

    def test_api_token_is_required_before_database_access(self):
        for token in (None, 'wrong-test-token'):
            with self.subTest(token=token):
                self.namespace['request'].get_json.return_value = {
                    'action': 'data_integration', 'token': token,
                    'data': {'symbols': ['指标A']},
                }
                response = self.api.apis()
                self.assertEqual('非法请求', response.get_json()['error'])
        self.namespace['db'].session.query.assert_not_called()


if __name__ == '__main__':
    unittest.main()
