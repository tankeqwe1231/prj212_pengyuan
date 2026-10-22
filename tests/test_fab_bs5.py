from datetime import date, datetime
import importlib.util
from pathlib import Path
import unittest

from wtforms import DateField, DateTimeField, Form, SelectField


MODULE_PATH = Path(__file__).parents[1] / 'superset' / 'fab_bs5.py'
SPEC = importlib.util.spec_from_file_location('fab_bs5', MODULE_PATH)
FAB_BS5 = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(FAB_BS5)


class FabBootstrap5WidgetTest(unittest.TestCase):

    def test_date_widget_renders_bootstrap_five_and_backend_format(self):
        form_class = type(
            'DateForm',
            (Form,),
            {
                'date_value': DateField(
                    widget=FAB_BS5.BS5DatePickerWidget(),
                ),
                'datetime_value': DateTimeField(
                    widget=FAB_BS5.BS5DateTimePickerWidget(),
                ),
            },
        )
        form = form_class()
        form.date_value.data = date(2026, 8, 6)
        form.datetime_value.data = datetime(2026, 8, 6, 13, 14, 15)

        date_markup = str(form.date_value())
        datetime_markup = str(form.datetime_value())
        self.assertIn('value="2026-08-06"', date_markup)
        self.assertIn('data-format="yyyy-MM-dd"', date_markup)
        self.assertIn('btn-outline-secondary', date_markup)
        self.assertIn('value="2026-08-06 13:14:15"', datetime_markup)
        self.assertIn(
            'data-format="yyyy-MM-dd HH:mm:ss"',
            datetime_markup,
        )

    def test_select2_widget_uses_bootstrap_five_form_markup(self):
        form_class = type(
            'SelectForm',
            (Form,),
            {
                'value': SelectField(
                    choices=[('one', 'One')],
                    widget=FAB_BS5.BS5Select2Widget(),
                ),
            },
        )
        markup = str(form_class().value())
        self.assertIn('my_select2 form-select', markup)
        self.assertIn('data-placeholder=', markup)

    def test_file_widget_outputs_one_file_input_and_delete_marker(self):
        field = type(
            'FileField',
            (),
            {
                'id': 'attachment',
                'name': 'attachment',
                'data': 'stored.txt',
            },
        )()
        markup = str(FAB_BS5.BS5FileUploadFieldWidget()(field))
        self.assertEqual(1, markup.count('type="file"'))
        self.assertIn('name="_attachment-delete"', markup)
        self.assertIn('input-group-text', markup)

    def test_image_widget_uses_configured_field_manager(self):
        manager = type(
            'ImageManager',
            (),
            {'get_url': lambda self, value: '/uploads/' + value},
        )()
        field = type(
            'ImageField',
            (),
            {
                'id': 'image',
                'name': 'image',
                'data': 'stored.png',
                'imagemanager': manager,
            },
        )()
        markup = str(FAB_BS5.BS5ImageUploadFieldWidget()(field))
        self.assertIn('src="/uploads/stored.png"', markup)


if __name__ == '__main__':
    unittest.main()
