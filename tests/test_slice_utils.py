import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest


MODULE_PATH = (
    Path(__file__).parents[1] / 'superset' / 'views' / 'slice_utils.py'
)
SPEC = importlib.util.spec_from_file_location('slice_utils', MODULE_PATH)
SLICE_UTILS = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SLICE_UTILS)


class SliceDatasourceAccessTest(unittest.TestCase):

    def test_filter_accessible_datasources_uses_security_manager(self):
        allowed = SimpleNamespace(id=1)
        denied = SimpleNamespace(id=2)
        security_manager = SimpleNamespace(
            datasource_access=lambda datasource: datasource is allowed,
        )

        result = SLICE_UTILS.filter_accessible_datasources(
            [allowed, denied], security_manager)

        self.assertEqual([allowed], result)

    def test_filter_accessible_datasources_preserves_all_allowed_sources(self):
        datasources = [SimpleNamespace(id=1), SimpleNamespace(id=2)]
        security_manager = SimpleNamespace(
            datasource_access=lambda datasource: True,
        )

        result = SLICE_UTILS.filter_accessible_datasources(
            datasources, security_manager)

        self.assertEqual(datasources, result)

    def test_filter_accessible_datasources_loads_user_permissions_once(self):
        user = object()
        database_allowed = SimpleNamespace(
            id=1, database=SimpleNamespace(perm='database-1'),
            schema_perm='schema-1', perm='source-1')
        schema_allowed = SimpleNamespace(
            id=2, database=SimpleNamespace(perm='database-2'),
            schema_perm='schema-2', perm='source-2')
        datasource_allowed = SimpleNamespace(
            id=3, database=SimpleNamespace(perm='database-3'),
            schema_perm='schema-3', perm='source-3')
        denied = SimpleNamespace(
            id=4, database=SimpleNamespace(perm='database-4'),
            schema_perm='schema-4', perm='source-4')
        calls = []

        def get_user_permissions(request_user):
            calls.append(request_user)
            return {
                ('database_access', 'database-1'),
                ('schema_access', 'schema-2'),
                ('datasource_access', 'source-3'),
            }

        security_manager = SimpleNamespace(
            get_user_permissions=get_user_permissions,
            datasource_access=lambda datasource: self.fail(
                'bulk filtering must not perform per-datasource checks'),
        )

        result = SLICE_UTILS.filter_accessible_datasources(
            [database_allowed, schema_allowed, datasource_allowed, denied],
            security_manager,
            user=user,
        )

        self.assertEqual(
            [database_allowed, schema_allowed, datasource_allowed], result)
        self.assertEqual([user], calls)

    def test_global_datasource_permission_preserves_all_sources(self):
        user = object()
        datasources = [SimpleNamespace(id=1), SimpleNamespace(id=2)]
        security_manager = SimpleNamespace(
            get_user_permissions=lambda request_user: {
                ('all_datasource_access', 'all_datasource_access'),
            },
        )

        result = SLICE_UTILS.filter_accessible_datasources(
            datasources, security_manager, user=user)

        self.assertEqual(datasources, result)

    def test_form_data_datasource_takes_precedence(self):
        result = SLICE_UTILS.resolve_datasource_info(
            None, None, {'datasource': '297__table'}, {'table': object()},
        )

        self.assertEqual((297, 'table'), result)

    def test_url_datasource_is_supported_for_legacy_routes(self):
        result = SLICE_UTILS.resolve_datasource_info(
            '12', 'druid', {}, {'druid': object()},
        )

        self.assertEqual((12, 'druid'), result)

    def test_invalid_datasource_values_are_rejected(self):
        invalid_values = (
            (None, None, {}),
            ('request_access', 'table', {}),
            ('1', 'unknown', {}),
            (None, None, {'datasource': 'missing-separator'}),
            (None, None, {'datasource': '0__table'}),
        )

        for datasource_id, datasource_type, form_data in invalid_values:
            with self.subTest(
                    datasource_id=datasource_id,
                    datasource_type=datasource_type,
                    form_data=form_data):
                with self.assertRaises(ValueError):
                    SLICE_UTILS.resolve_datasource_info(
                        datasource_id, datasource_type, form_data,
                        {'table': object()},
                    )


class SliceOwnerFilterTest(unittest.TestCase):

    def test_current_user_owner_filter_uses_slice_owners_relationship(self):
        owner = object()
        condition = object()

        class OwnersRelationship:
            def contains(self, value):
                self.value = value
                return condition

        class Query:
            def filter(self, value):
                self.value = value
                return self

        owners = OwnersRelationship()
        query = Query()
        datamodel = SimpleNamespace(
            obj=SimpleNamespace(owners=owners),
        )
        owner_filter = SLICE_UTILS.CurrentUserSliceOwnerFilter(
            'owners', datamodel,
        )

        result = owner_filter.apply(query, lambda: owner)

        self.assertIs(query, result)
        self.assertIs(owner, owners.value)
        self.assertIs(condition, query.value)

    def test_slice_add_view_configures_current_user_owner_filter(self):
        core_source = (
            Path(__file__).parents[1] / 'superset' / 'views' / 'core.py'
        ).read_text(encoding='utf-8')

        self.assertIn(
            "['owners', CurrentUserSliceOwnerFilter, lambda: g.user]",
            core_source,
        )


class VizTypePillFormatTest(unittest.TestCase):

    def test_format_viz_type_pill_renders_colored_span(self):
        html = str(SLICE_UTILS.format_viz_type_pill('line'))
        self.assertIn('slice-viz-pill', html)
        self.assertIn('line', html)
        self.assertIn('background-color:', html)

    def test_format_viz_type_pill_escapes_html(self):
        html = str(SLICE_UTILS.format_viz_type_pill('<script>'))
        self.assertNotIn('<script>', html)
        self.assertIn('&lt;script&gt;', html)

    def test_format_viz_type_pill_empty(self):
        self.assertEqual('', SLICE_UTILS.format_viz_type_pill(None))
        self.assertEqual('', SLICE_UTILS.format_viz_type_pill(''))


if __name__ == '__main__':
    unittest.main()
