import ast
from pathlib import Path
import sys
import unittest
from unittest.mock import MagicMock

sys.path.insert(0, str(Path(__file__).parent))
from index_data_test_utils import FakeConnection, FakeResult, load_module  # noqa: E402

SOURCES = load_module('index_data_sources')
ACTIONS = load_module('index_data_actions')
FIELDS = {'date': '报价日期', 'name': '品名', 'value': '价格', 'type': '商品'}
REGISTRY = SOURCES.build_index_source_registry([
    {'数据库': 'TFFY_CF', '品种': '红枣', '指标列表': '行情_商品价格指标列表_红枣',
     '数据表': '行情_商品报价表_红枣', 'datasource_id': 178},
    {'数据库': 'TFFY_ZN', '品种': '贵金属', '指标列表': '行情_商品价格指标列表_贵金属',
     '数据表': '行情_商品报价表_贵金属', 'datasource_id': 204},
])
CF = REGISTRY['sources'][('TFFY_CF', '行情_商品价格指标列表_红枣')]
ZN = REGISTRY['sources'][('TFFY_ZN', '行情_商品价格指标列表_贵金属')]


class CategoryActionTest(unittest.TestCase):

    def test_create_category_moves_selected_metrics(self):
        def responder(sql, params):
            if sql.startswith('SELECT node_id,parent_id'):
                return FakeResult([(1, 0)])
            if 'COUNT(1)' in sql:
                return FakeResult(scalar=0)
            if 'MAX(node_order)' in sql:
                return FakeResult(scalar=3)
            if sql.startswith('INSERT INTO index_categorys'):
                return FakeResult([(42,)])
            if sql.startswith('UPDATE target'):
                return FakeResult(rowcount=len(params) // 3)
        connection = FakeConnection(responder)
        groups = SOURCES.group_index_keys([
            'TFFY_CF|行情_商品价格指标列表_红枣|行情_商品报价表_红枣|7',
            'TFFY_CF|行情_商品价格指标列表_红枣|行情_商品报价表_红枣|8',
        ], REGISTRY)

        result = ACTIONS.create_category(connection, ' 新分类 ', 1, groups)

        self.assertEqual(42, result['node_id'])
        self.assertEqual(4, result['node_order'])
        self.assertEqual('新分类', result['node_name'])
        update_sql, update_params = connection.statements[-1]
        self.assertIn('[TFFY_CF].[dbo].[行情_商品价格指标列表_红枣]', update_sql)
        self.assertEqual([42, 1, 7, 42, 2, 8], update_params)

    def test_create_category_rejects_duplicate_name(self):
        def responder(sql, params):
            if sql.startswith('SELECT node_id,parent_id'):
                return FakeResult([(1, 0)])
            if 'COUNT(1)' in sql:
                return FakeResult(scalar=1)
        with self.assertRaises(ValueError):
            ACTIONS.create_category(FakeConnection(responder), '重复', 1)

    def test_move_category_reorders_siblings(self):
        rows = [(1, 0, 1), (2, 1, 1), (3, 1, 2), (4, 1, 3)]

        def responder(sql, params):
            if sql.startswith('SELECT node_id,parent_id,node_order'):
                return FakeResult(rows)
            if sql.startswith('UPDATE target'):
                return FakeResult(rowcount=len(params) // 3)
        connection = FakeConnection(responder)

        result = ACTIONS.move_category_node(connection, 4, 1, 1)

        self.assertEqual(1, result['node_order'])
        self.assertEqual([1, 1, 4, 1, 2, 2, 1, 3, 3], connection.statements[-1][1])

    def test_move_index_node_reorders_within_same_category(self):
        def responder(sql, params):
            if 'sp_getapplock' in sql:
                return FakeResult(scalar=0)
            if sql.startswith('SELECT node_id,parent_id FROM index_categorys'):
                return FakeResult([(5, 1)])
            if sql.startswith('SELECT table_ID,node_id FROM'):
                return FakeResult([(9, 5)])
            if sql.startswith('SELECT table_ID,node_id,node_order'):
                return FakeResult([(7, 5, 1), (8, 5, 2), (9, 5, 3)])
            if sql.startswith('UPDATE target'):
                return FakeResult(rowcount=len(params) // 3)
        connection = FakeConnection(responder)
        groups = SOURCES.group_index_keys(
            ['TFFY_CF|行情_商品价格指标列表_红枣|行情_商品报价表_红枣|9'], REGISTRY)

        result = ACTIONS.move_index_nodes(connection, groups, 5, 1)

        self.assertEqual(
            {'TFFY_CF|行情_商品价格指标列表_红枣|行情_商品报价表_红枣|9': 1},
            result['node_orders'])
        self.assertEqual([5, 1, 9, 5, 2, 7, 5, 3, 8], connection.statements[-1][1])

    def test_move_index_rejects_root_target(self):
        def responder(sql, params):
            if 'sp_getapplock' in sql:
                return FakeResult(scalar=0)
            if sql.startswith('SELECT node_id,parent_id FROM index_categorys'):
                return FakeResult([(1, 0)])
        groups = SOURCES.group_index_keys(
            ['TFFY_CF|行情_商品价格指标列表_红枣|行情_商品报价表_红枣|9'], REGISTRY)
        with self.assertRaises(ValueError):
            ACTIONS.move_index_nodes(FakeConnection(responder), groups, 1)

    def test_delete_category_rejects_category_with_metrics(self):
        def responder(sql, params):
            if sql.startswith('SELECT node_id,parent_id'):
                return FakeResult([(5, 1)])
            if 'index_categorys WHERE parent_id' in sql:
                return FakeResult(scalar=0)
            if 'TFFY_ZN' in sql:
                return FakeResult(scalar=2)
            return FakeResult(scalar=0)
        connection = FakeConnection(responder)
        with self.assertRaises(ValueError):
            ACTIONS.delete_category(connection, 5, REGISTRY)
        self.assertFalse(any(
            sql.startswith('DELETE') for sql, _ in connection.statements))


class CategoryUpdateTest(unittest.TestCase):

    def connection(self, duplicate=False, update_count=1):
        rows = [(1, 0, 1), (2, 1, 1), (3, 1, 2), (4, 2, 1), (5, 3, 1)]

        def responder(sql, params):
            if sql.startswith('SELECT node_id,parent_id,node_order'):
                return FakeResult(rows)
            if sql.startswith('SELECT node_id,parent_id FROM'):
                return FakeResult([row[:2] for row in rows if row[0] == params[0]])
            if 'COUNT(1)' in sql:
                return FakeResult(scalar=int(duplicate))
            if sql.startswith('UPDATE target'):
                return FakeResult(rowcount=len(params) // 3)
            if sql.startswith('UPDATE index_categorys SET node_name'):
                return FakeResult(rowcount=update_count)
        return FakeConnection(responder)

    def test_name_only_keeps_sibling_order(self):
        connection = self.connection()
        result = ACTIONS.update_category(connection, 2, ' 新名称 ', 1)
        self.assertEqual({'node_id': 2, 'node_name': '新名称', 'parent_id': 1}, result)
        writes = [(sql, params) for sql, params in connection.statements if sql.startswith('UPDATE')]
        self.assertEqual(1, len(writes))
        self.assertEqual(['新名称', 2], writes[0][1])

    def test_moves_and_renames_using_the_target_parent_for_duplicate_check(self):
        connection = self.connection()
        result = ACTIONS.update_category(connection, 2, '修改后', 3)
        self.assertEqual(3, result['parent_id'])
        self.assertEqual(2, result['node_order'])
        self.assertEqual('修改后', result['node_name'])
        duplicate_params = next(params for sql, params in connection.statements if 'COUNT(1)' in sql)
        self.assertEqual([3, '修改后', 2], duplicate_params)
        writes = [(sql, params) for sql, params in connection.statements if sql.startswith('UPDATE')]
        self.assertEqual([1, 1, 3, 3, 1, 5, 3, 2, 2], writes[0][1])
        self.assertEqual(['修改后', 2], writes[1][1])
        # 子节点仍指向原节点，不随父节点修改而被拆散。
        self.assertNotIn(4, writes[0][1][2::3])

    def test_can_move_a_nested_category_to_the_root(self):
        result = ACTIONS.update_category(self.connection(), 4, '子节点', 1)
        self.assertEqual(1, result['parent_id'])
        self.assertEqual(3, result['node_order'])

    def test_rejects_invalid_targets_and_names_before_writing(self):
        for node_id, parent_id, name in [
                (1, 2, '根目录'), (99, 1, '不存在'), (2, 2, '自身'),
                (2, 4, '后代'), (2, 99, '无效父节点'), (2, 0, '无效父节点'),
                (2, 1, '  '), (2, 1, '名' * 101)]:
            with self.subTest(node_id=node_id, parent_id=parent_id, name=name):
                connection = self.connection()
                with self.assertRaises(ValueError):
                    ACTIONS.update_category(connection, node_id, name, parent_id)
                self.assertFalse(any(sql.startswith('UPDATE') for sql, _ in connection.statements))

    def test_rejects_duplicate_under_destination_without_writing(self):
        connection = self.connection(duplicate=True)
        with self.assertRaisesRegex(ValueError, '同名节点'):
            ACTIONS.update_category(connection, 2, '重复名称', 3)
        self.assertFalse(any(sql.startswith('UPDATE') for sql, _ in connection.statements))

    def test_view_propagates_failure_to_the_same_transaction_after_move(self):
        # 隔离加载视图方法，避免导入 superset 或连接真实数据库。
        path = Path(__file__).parents[1] / 'superset' / 'views' / 'core_custom.py'
        tree = ast.parse(path.read_text(encoding='utf-8'))
        view = next(node for node in tree.body
                    if isinstance(node, ast.ClassDef) and node.name == 'IndexDataManage')
        method = next(node for node in view.body
                      if isinstance(node, ast.FunctionDef) and node.name == '_update_category')
        module = ast.Module(body=[method], type_ignores=[])
        ast.fix_missing_locations(module)
        namespace = {'update_category': ACTIONS.update_category}
        exec(compile(module, str(path), 'exec'), namespace)
        for update_count in (1, 0):
            with self.subTest(update_count=update_count):
                connection = self.connection(update_count=update_count)
                engine = MagicMock()
                transaction = engine.begin.return_value
                transaction.__enter__.return_value = connection
                transaction.__exit__.return_value = False
                instance = MagicMock()
                instance._center_engine.return_value = (None, engine)
                payload = {'node_id': 2, 'node_name': '新名称', 'parent_node_id': 3}
                if update_count:
                    namespace['_update_category'](instance, payload)
                    transaction.__exit__.assert_called_once_with(None, None, None)
                else:
                    with self.assertRaisesRegex(ValueError, '节点已变更'):
                        namespace['_update_category'](instance, payload)
                    self.assertIs(ValueError, transaction.__exit__.call_args[0][0])
                engine.begin.assert_called_once_with()
                self.assertTrue(any(sql.startswith('UPDATE target') for sql, _ in connection.statements))


class FormulaActionTest(unittest.TestCase):

    SQL = (
        "SELECT a.报价日期 as 日期, (a.价格+b.价格)/2 as 价格 "
        "FROM [TFFY_CF].dbo.[行情_商品报价表_红枣] as a "
        "join [TFFY_ZN].dbo.[行情_商品报价表_贵金属] as b on a.报价日期=b.报价日期 "
        "WHERE a.品名='红枣现货' and b.品名='黄金''期货'"
    )

    def test_refresh_uses_parameters_and_escapes_percent(self):
        connection = FakeConnection(lambda sql, params: None)
        refreshed = ACTIONS.refresh_calculated_index_data(
            connection, CF, "SELECT a.报价日期 as 日期, a.价格 as 价格 FROM t a "
            "WHERE a.品名 LIKE '%枣'", "名'称", '红枣', FIELDS)
        self.assertTrue(refreshed)
        delete_sql, delete_params = connection.statements[0]
        insert_sql, insert_params = connection.statements[1]
        self.assertIn('DELETE FROM [TFFY_CF].[dbo].[行情_商品报价表_红枣]', delete_sql)
        self.assertEqual(["名'称"], delete_params)
        self.assertIn('([商品],[品名],[报价日期],[价格])', insert_sql)
        self.assertIn("LIKE '%%枣'", insert_sql)
        self.assertEqual(['红枣', "名'称"], insert_params)

    def test_refresh_skips_unsafe_sql(self):
        connection = FakeConnection(lambda sql, params: None)
        self.assertFalse(ACTIONS.refresh_calculated_index_data(
            connection, CF, 'DELETE FROM x', 'n', 'v', FIELDS))
        self.assertEqual([], connection.statements)

    def test_normalize_formula_config(self):
        config = ACTIONS.normalize_formula_config({
            'formula': '(a + b) / 2',
            'childIndex': {'b': {'key': 'k2', '指标名称': 'B', 'extra': 1},
                           'a': {'key': 'k1', '指标名称': 'A'}},
        })
        self.assertEqual('(a+b)/2', config['formula'])
        self.assertEqual(['a', 'b'], list(config['childIndex']))
        self.assertNotIn('extra', config['childIndex']['b'])
        with self.assertRaises(ValueError):
            ACTIONS.normalize_formula_config({
                'formula': 'a;drop', 'childIndex': {'a': {'key': 'k'}}})

    def test_recover_formula_config_across_databases(self):
        lookups = []

        def lookup(source, name):
            lookups.append((source['database'], name))
            return [11] if source is CF else [22]

        config = ACTIONS.recover_formula_config(self.SQL, REGISTRY, lookup, FIELDS)

        self.assertEqual('(a+b)/2', config['formula'])
        self.assertEqual(
            'TFFY_CF|行情_商品价格指标列表_红枣|行情_商品报价表_红枣|11',
            config['childIndex']['a']['key'])
        self.assertEqual(
            'TFFY_ZN|行情_商品价格指标列表_贵金属|行情_商品报价表_贵金属|22',
            config['childIndex']['b']['key'])
        self.assertIn(('TFFY_ZN', "黄金'期货"), lookups)

    def test_recovery_result_is_read_only_for_unparsable_sql(self):
        result = ACTIONS.build_formula_recovery_result(
            '计算指标', {}, 'SELECT x FROM y', REGISTRY, lambda s, n: [], FIELDS)
        self.assertTrue(result['is_formula_read_only'])
        self.assertIsNone(result['formula_config'])

    def test_calculation_definition_display_formula(self):
        definition = ACTIONS.build_calculation_definition({}, self.SQL, FIELDS)
        self.assertEqual('parsed', definition['parserStatus'])
        self.assertEqual("(红枣现货 + 黄金'期货) / 2", definition['displayFormula'])
        self.assertTrue(definition['isSafeSql'])


if __name__ == '__main__':
    unittest.main()
