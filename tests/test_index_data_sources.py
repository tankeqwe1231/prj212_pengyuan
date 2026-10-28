from datetime import date
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).parent))
from index_data_test_utils import load_module  # noqa: E402

SOURCES = load_module('index_data_sources')
FIELDS = {'date': '报价日期', 'name': '品名', 'value': '价格', 'type': '商品'}
VIEW_ROWS = [
    {'数据库': 'TFFY_CF', '品种': '红枣', '指标列表': '行情_商品价格指标列表',
     '数据表': '行情_商品报价表', 'datasource_id': 178},
    {'数据库': 'TFFY_ZN', '品种': '贵金属', '指标列表': '行情_商品价格指标列表',
     '数据表': '行情_商品报价表', 'datasource_id': 204},
]


def registry():
    return SOURCES.build_index_source_registry(VIEW_ROWS)


class RegistryTest(unittest.TestCase):

    def test_same_table_names_in_different_databases_do_not_collide(self):
        result = registry()
        self.assertEqual(2, len(result['sources']))
        self.assertEqual(
            178, result['sources'][('TFFY_CF', '行情_商品价格指标列表')]['datasource_id'])
        self.assertEqual(
            '贵金属', result['by_data'][('TFFY_ZN', '行情_商品报价表')]['variety'])

    def test_unsafe_identifiers_are_skipped(self):
        result = SOURCES.build_index_source_registry([
            {'数据库': 'TFFY_CF]; DROP', '指标列表': 'a', '数据表': 'b'},
        ])
        self.assertEqual({}, dict(result['sources']))

    def test_parse_index_key_validates_against_registry(self):
        parsed = SOURCES.parse_index_key(
            'TFFY_ZN|行情_商品价格指标列表|行情_商品报价表|12', registry())
        self.assertEqual(12, parsed['table_id'])
        self.assertEqual('TFFY_ZN', parsed['source']['database'])
        for bad_key in [
                'TFFY_XX|行情_商品价格指标列表|行情_商品报价表|1',
                'TFFY_ZN|行情_商品价格指标列表|其他表|1',
                'TFFY_ZN|行情_商品价格指标列表|行情_商品报价表|x',
                'bad-key', None]:
            with self.assertRaises(ValueError):
                SOURCES.parse_index_key(bad_key, registry())

    def test_group_index_keys_groups_by_source_and_dedupes(self):
        groups = SOURCES.group_index_keys([
            'TFFY_CF|行情_商品价格指标列表|行情_商品报价表|1',
            'TFFY_ZN|行情_商品价格指标列表|行情_商品报价表|2',
            'TFFY_CF|行情_商品价格指标列表|行情_商品报价表|3',
            'TFFY_CF|行情_商品价格指标列表|行情_商品报价表|1',
        ], registry())
        self.assertEqual([[1, 3], [2]], [g['table_ids'] for g in groups])

    def test_full_table_name_rejects_injection(self):
        self.assertEqual(
            '[TFFY_CF].[dbo].[行情_商品报价表]',
            SOURCES.full_table_name('TFFY_CF', '行情_商品报价表'))
        with self.assertRaises(ValueError):
            SOURCES.full_table_name('TFFY_CF', 'x];DROP TABLE y;--')

    def test_resolve_index_fields_requires_all_fields(self):
        with self.assertRaises(ValueError):
            SOURCES.resolve_index_fields({'dateField': '报价日期'})


class SqlBuilderTest(unittest.TestCase):

    def test_latest_values_sql_uses_configured_fields(self):
        source = registry()['sources'][('TFFY_CF', '行情_商品价格指标列表')]
        sql, params = SOURCES.build_latest_values_sql(source, ['甲', '乙'], FIELDS)
        self.assertIn('FROM [TFFY_CF].[dbo].[行情_商品报价表]', sql)
        self.assertIn('[品名] IN (%s, %s)', sql)
        self.assertIn('ORDER BY [报价日期] DESC', sql)
        self.assertEqual(['甲', '乙'], params)

    def test_history_sql_keeps_first_source_for_duplicate_names(self):
        sources = registry()['sources']
        cf = sources[('TFFY_CF', '行情_商品价格指标列表')]
        zn = sources[('TFFY_ZN', '行情_商品价格指标列表')]
        sql, params, names = SOURCES.build_index_history_sql(
            [(cf, ['甲', '乙']), (zn, ['乙', '丙'])], FIELDS)
        self.assertEqual(['甲', '乙', '丙'], names)
        self.assertEqual(['甲', '乙', '丙', '甲', '乙', '丙'], params)
        self.assertIn('来源 = 1 AND 指标名 = %s THEN 指标值 END) AS [c2]', sql)
        self.assertIn('[TFFY_ZN].[dbo].[行情_商品报价表]', sql)

    def test_history_cache_key_ignores_name_order(self):
        source = registry()['sources'][('TFFY_CF', '行情_商品价格指标列表')]
        self.assertEqual(
            SOURCES.build_history_cache_key([(source, ['a', 'b'])]),
            SOURCES.build_history_cache_key([(source, ['b', 'a'])]))

    def test_is_safe_select_sql(self):
        self.assertTrue(SOURCES.is_safe_select_sql('SELECT a FROM b'))
        self.assertFalse(SOURCES.is_safe_select_sql('DELETE FROM b'))
        self.assertFalse(SOURCES.is_safe_select_sql('SELECT 1; DROP TABLE b'))
        self.assertFalse(SOURCES.is_safe_select_sql('SELECT * INTO x FROM b'))

    def test_infer_index_frequency(self):
        self.assertEqual('日度', SOURCES.infer_index_frequency(
            [date(2026, 1, 2), date(2026, 1, 5), date(2026, 1, 6)]))
        self.assertEqual('月度', SOURCES.infer_index_frequency(
            ['2026-01-31', '2026-02-28', '2026-03-31']))
        self.assertEqual('未知', SOURCES.infer_index_frequency([date(2026, 1, 1)]))


class TreeTest(unittest.TestCase):

    def test_tree_places_invalid_nodes_under_uncategorized(self):
        categories = [
            {'node_id': 1, 'node_name': '目录', 'parent_id': 0, 'node_order': 1},
            {'node_id': 2, 'node_name': '红枣', 'parent_id': 1, 'node_order': 2},
            {'node_id': 3, 'node_name': '贵金属', 'parent_id': 1, 'node_order': 1},
        ]
        records = SOURCES.normalize_index_records([
            {'table_ID': 1, '指标名称': '现货价', '数据库': 'TFFY_CF',
             '指标列表': '行情_商品价格指标列表', 'node_id': 2, 'node_order': 1},
            {'table_ID': 2, '指标名称': '库存', '数据库': 'TFFY_CF',
             '指标列表': '行情_商品价格指标列表', 'node_id': 99},
            {'table_ID': 3, '指标名称': '  ', '数据库': 'TFFY_CF',
             '指标列表': '行情_商品价格指标列表', 'node_id': 2},
            {'table_ID': 4, '指标名称': '未登记', '数据库': 'TFFY_XX',
             '指标列表': '行情_商品价格指标列表', 'node_id': 2},
        ], registry())
        self.assertEqual(2, len(records))
        self.assertEqual(178, records[0]['datasource_id'])

        tree = SOURCES.build_category_tree(categories, records)
        self.assertEqual('node_1', tree['key'])
        self.assertEqual(['贵金属', '红枣', '未分类'],
                         [child['name'] for child in tree['children']])
        self.assertEqual('现货价', tree['children'][1]['children'][0]['name'])
        self.assertEqual('库存', tree['children'][2]['children'][0]['name'])

        paths = {item['node_id']: item['nodes_path']
                 for item in SOURCES.build_category_paths(categories)}
        self.assertEqual('目录|红枣', paths[2])

    def test_validate_category_move(self):
        parents = {1: 0, 2: 1, 3: 2}
        self.assertTrue(SOURCES.validate_category_move(3, 1, parents))
        for node_id, target in [(1, 2), (2, 2), (2, 3), (2, 9)]:
            with self.assertRaises(ValueError):
                SOURCES.validate_category_move(node_id, target, parents)


class QueryResultCacheTest(unittest.TestCase):

    def test_cache_expires_after_ttl(self):
        now = [0]
        cache = SOURCES.QueryResultCache(10, 2, time_fn=lambda: now[0])
        calls = []

        def compute():
            calls.append(1)
            return len(calls)

        self.assertEqual((1, False), cache.get_or_compute('k', compute))
        self.assertEqual((1, True), cache.get_or_compute('k', compute))
        now[0] = 11
        self.assertEqual((2, False), cache.get_or_compute('k', compute))


if __name__ == '__main__':
    unittest.main()
