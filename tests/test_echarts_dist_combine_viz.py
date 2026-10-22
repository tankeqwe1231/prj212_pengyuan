import ast
from datetime import date, datetime
from pathlib import Path
import unittest

import pandas as pd


MODULE_PATH = Path(__file__).parents[1] / 'superset' / 'viz.py'


def load_normalizer():
    tree = ast.parse(MODULE_PATH.read_text(encoding='utf-8'))
    viz_class = next(
        node for node in tree.body
        if isinstance(node, ast.ClassDef)
        and node.name == 'EchartsDistCombineChartViz'
    )
    isolated_module = ast.Module(body=[viz_class], type_ignores=[])
    ast.fix_missing_locations(isolated_module)
    namespace = {
        'pd': pd,
        'string_types': (str,),
        'BaseViz': object,
    }
    exec(compile(isolated_module, str(MODULE_PATH), 'exec'), namespace)
    return namespace['EchartsDistCombineChartViz']._normalize_granularity_column


class EchartsDistCombineGranularityTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.normalize = load_normalizer()

    def test_normalizes_string_values(self):
        series = pd.Series(['2026-09-01', None])

        result = type(self).normalize(series)

        self.assertEqual(['20260901', None], result.tolist())

    def test_normalizes_sql_server_date_values(self):
        series = pd.Series([date(2026, 9, 1), date(2026, 9, 2)])

        result = type(self).normalize(series)

        self.assertEqual(['20260901', '20260902'], result.tolist())

    def test_normalizes_datetime_values(self):
        series = pd.Series([datetime(2026, 9, 1, 12, 30)])

        result = type(self).normalize(series)

        self.assertEqual(['20260901'], result.tolist())

    def test_handles_mixed_values_without_string_accessor(self):
        series = pd.Series([date(2026, 9, 1), '2026-09-02', 0, None])

        result = type(self).normalize(series)

        self.assertEqual(['20260901', '20260902', 0, None], result.tolist())


if __name__ == '__main__':
    unittest.main()
