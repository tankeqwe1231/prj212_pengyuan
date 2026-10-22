import ast
import json
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import Mock

import sqlalchemy as sqla


MODULE_PATH = Path(__file__).parents[1] / 'superset' / 'views' / 'core_custom.py'


def load_sync_reports():
    tree = ast.parse(MODULE_PATH.read_text(encoding='utf-8'))
    public_api = next(
        node
        for node in tree.body
        if isinstance(node, ast.ClassDef) and node.name == 'PublicApi'
    )
    sync_reports = next(
        node
        for node in public_api.body
        if isinstance(node, ast.FunctionDef) and node.name == '_sync_reports'
    )
    isolated_module = ast.Module(body=[sync_reports], type_ignores=[])
    ast.fix_missing_locations(isolated_module)

    pandas = Mock()
    frame = Mock(empty=False)
    frame.to_dict.return_value = [{'id': 2}]
    pandas.read_sql.return_value = frame
    namespace = {
        'db': SimpleNamespace(engine=object()),
        'json': json,
        'json_success': lambda payload: payload,
        'pd': pandas,
        'sqla': sqla,
        'traceback': Mock(),
    }
    exec(compile(isolated_module, str(MODULE_PATH), 'exec'), namespace)
    return namespace['_sync_reports'], pandas


class PublicApiSyncReportsTest(unittest.TestCase):

    def test_uses_named_sqlalchemy_parameter_for_last_id(self):
        sync_reports, pandas = load_sync_reports()

        sync_reports(object(), 1)

        query = pandas.read_sql.call_args.args[0]
        self.assertIsInstance(query, sqla.sql.elements.TextClause)
        self.assertIn(':last_id', str(query))
        self.assertEqual(
            {'last_id': 1},
            pandas.read_sql.call_args.kwargs['params'],
        )


if __name__ == '__main__':
    unittest.main()
