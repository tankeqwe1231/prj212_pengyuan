import json
from pathlib import Path
from types import SimpleNamespace
import sys
import unittest

sys.path.insert(0, str(Path(__file__).parent))
from index_data_test_utils import load_module  # noqa: E402

CHART = load_module('index_chart_params')


class PrimaryDatasourceTest(unittest.TestCase):

    def test_picks_datasource_with_most_indexes_and_drops_others(self):
        datasource_id, kept = CHART.pick_primary_datasource([
            ('a', {'datasource_id': 1}),
            ('b', {'datasource_id': 2}),
            ('c', {'datasource_id': 2}),
        ])
        self.assertEqual(2, datasource_id)
        self.assertEqual(['b', 'c'], [name for name, _ in kept])

    def test_tie_uses_first_datasource(self):
        datasource_id, kept = CHART.pick_primary_datasource([
            ('a', {'datasource_id': 3}),
            ('b', {'datasource_id': 1}),
        ])
        self.assertEqual(3, datasource_id)
        self.assertEqual(['a'], [name for name, _ in kept])

    def test_requires_datasource(self):
        with self.assertRaises(ValueError):
            CHART.pick_primary_datasource([('a', {'datasource_id': None})])


class ChartParamsTest(unittest.TestCase):

    def test_templates_by_chart_type(self):
        self.assertEqual(
            'echarts_combine', CHART.build_saved_chart_params('line')['viz_type'])
        self.assertEqual(
            'echarts_stat_line_2',
            CHART.build_saved_chart_params('season')['viz_type'])
        self.assertEqual(
            'pivot_table', CHART.build_saved_chart_params('pivot')['viz_type'])
        with self.assertRaises(ValueError):
            CHART.build_saved_chart_params('unknown')

    def test_color_scheme_whitelist_and_template_isolation(self):
        params = CHART.build_saved_chart_params('season', 'zbColors')
        self.assertEqual('zbColors', params['color_scheme'])
        params['filters'][0]['val'].append('x')
        self.assertEqual(
            'bnbColors', CHART.build_saved_chart_params('line', 'evil')['color_scheme'])
        self.assertEqual(
            [], CHART.build_saved_chart_params('line')['filters'][0]['val'])

    def test_series_options(self):
        params = CHART.apply_series_options(
            CHART.build_saved_chart_params('line'), 'line', [
                ('a', {'chartType': 'bar', 'yAxisIndex': 1}),
                ('b', {'chartType': 'line', 'stacked': True}),
                ('c', {'chartType': 'area'}),
            ])
        self.assertEqual(['a', 'b', 'c'], params['filters'][0]['val'])
        self.assertEqual('指标名', params['filters'][0]['col'])
        self.assertEqual('a', params['columns_value_represent_by_histogram'])
        self.assertEqual('b|c', params['columns_value_represent_by_area'])
        self.assertEqual('a', params['columns_value_display_on_the_right_Y_axis'])

    def test_pivot_order_and_personalization(self):
        self.assertEqual(['b', 'a', 'c'], CHART.order_pivot_indicator_names(
            ['a', 'b', 'c'], ['b', 'x', 'a']))
        params = CHART.apply_pivot_personalization(
            {}, 1, {'a': '红枣'}, {'红枣': '#fff'})
        self.assertTrue(params['pivot_show_variety_labels'])
        self.assertEqual({'a': '红枣'}, json.loads(params['pivot_variety_map']))

    def test_apply_saved_chart_to_slice(self):
        slc = SimpleNamespace()
        datasource = SimpleNamespace(id=204, name='视图_行情_ZN子库指标数据')
        params = CHART.build_saved_chart_params('pivot')
        CHART.apply_saved_chart_to_slice(slc, params, datasource, '图1')
        self.assertEqual(204, slc.datasource_id)
        self.assertEqual('pivot_table', slc.viz_type)
        self.assertEqual('204__table', json.loads(slc.params)['datasource'])


if __name__ == '__main__':
    unittest.main()
