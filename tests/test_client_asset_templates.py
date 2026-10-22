from pathlib import Path
import unittest


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
DEPRECATED_TEMPLATES = (
    Path('index_废弃.html'),
    Path('superset/baselayout_for_client - 副本_废弃.html'),
    Path('superset/no_data_废弃.html'),
    Path('superset/paper-theme_废弃.html'),
    Path('superset/partials/_explore_title_废弃.html'),
    Path('superset/theme_废弃.html'),
)


class ClientAssetTemplateTest(unittest.TestCase):

    def read_template(self, relative_path):
        return (
            REPOSITORY_ROOT
            / 'superset'
            / 'templates'
            / relative_path
        ).read_text(encoding='utf-8')

    def test_fab_layouts_expose_one_global_csrf_token(self):
        for relative_path in (
            Path('appbuilder/baselayout.html'),
            Path('superset/baselayout_for_client.html'),
            Path('appbuilder/baselayout_for_login.html'),
        ):
            with self.subTest(template=str(relative_path)):
                template = self.read_template(relative_path)
                self.assertEqual(1, template.count('id="csrf_token"'))
                self.assertIn('name="csrf_token"', template)
                self.assertIn("csrf_token() if csrf_token else ''", template)

    def test_fab_runtime_uses_only_bootstrap_five_assets(self):
        template = self.read_template(Path('appbuilder/init.html'))
        self.assertIn("js_manifest('fabBs5.css')", template)
        self.assertIn("js_manifest('fabBs5.js')", template)
        for legacy_asset in (
            'bootstrap.min.css',
            'bootstrap.min.js',
            'bootstrap-datepicker3.min.css',
            'select2-bootstrap.min.css',
        ):
            self.assertNotIn(legacy_asset, template)

    def test_markup_theme_entry_uses_bootstrap_five_styles(self):
        asset_root = REPOSITORY_ROOT / 'superset' / 'assets'
        theme_entry = (
            asset_root / 'javascripts' / 'theme.js'
        ).read_text(encoding='utf-8')

        self.assertIn("stylesheets/react-theme.scss", theme_entry)
        for legacy_import in (
            'stylesheets/less/index.less',
            'stylesheets/superset-fab.less',
            'stylesheets/custom-fab.css',
        ):
            self.assertNotIn(legacy_import, theme_entry)

        for legacy_path in (
            Path('stylesheets/custom-fab.css'),
            Path('stylesheets/superset-fab.less'),
            Path('stylesheets/less/cosmo'),
        ):
            with self.subTest(path=str(legacy_path)):
                self.assertFalse((asset_root / legacy_path).exists())

    def test_fab_client_template_loads_custom_entry_styles(self):
        template = self.read_template(Path('superset/base_for_client.html'))

        custom_js = "js_manifest('custom.js')"
        self.assertIn(custom_js, template)

    def test_slice_list_for_client_uses_modern_list_marker(self):
        template = self.read_template(
            Path('appbuilder/general/model/list_for_client.html'))
        self.assertIn('slice-list-client', template)

        widget = self.read_template(
            Path('superset/fab_overrides/list_for_client.html'))
        self.assertIn('slice-list-client-table', widget)
        self.assertIn('is-sortable', widget)
        self.assertIn('col-{{ value }}', widget)

        styles = (
            REPOSITORY_ROOT
            / 'superset'
            / 'assets'
            / 'stylesheets'
            / 'fab-bs5.scss'
        ).read_text(encoding='utf-8')
        self.assertIn('.slice-list-client', styles)
        self.assertIn('#4a5cab', styles)
        self.assertIn('#a19f9d', styles)
        self.assertIn('.slice-viz-pill', styles)
        self.assertIn('.slice-modified-abs', styles)
        self.assertIn('#list-filter-selector .dropdown-menu', styles)
        self.assertIn('#5b6fc0', styles)
        self.assertIn('#filter_form.fab-list-search', styles)

    def test_active_templates_do_not_use_bootstrap_three_markup(self):
        template_root = REPOSITORY_ROOT / 'superset' / 'templates'
        content = '\n'.join(
            template.read_text(encoding='utf-8')
            for template in template_root.rglob('*.html')
            if not template.name.endswith('_废弃.html')
        )
        for legacy_markup in (
            'data-toggle=',
            'data-target=',
            'data-dismiss=',
            'btn-default',
            'input-group-addon',
            'pull-right',
        ):
            self.assertNotIn(legacy_markup, content)

    def test_unused_templates_are_marked_as_deprecated(self):
        template_root = REPOSITORY_ROOT / 'superset' / 'templates'
        for relative_path in DEPRECATED_TEMPLATES:
            with self.subTest(template=str(relative_path)):
                self.assertTrue((template_root / relative_path).is_file())

        active_templates = '\n'.join(
            template.read_text(encoding='utf-8')
            for template in template_root.rglob('*.html')
            if not template.name.endswith('_废弃.html')
        )
        for relative_path in DEPRECATED_TEMPLATES:
            with self.subTest(reference=str(relative_path)):
                self.assertNotIn(relative_path.as_posix(), active_templates)


if __name__ == '__main__':
    unittest.main()
