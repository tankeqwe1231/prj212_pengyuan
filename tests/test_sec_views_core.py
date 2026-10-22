from datetime import datetime
import importlib.util
from pathlib import Path
import sys
import unittest

from flask_appbuilder.fields import QuerySelectMultipleField
from flask_appbuilder.forms import GeneralModelConverter
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.sqla.models import Role
from werkzeug.datastructures import MultiDict
from wtforms import Form


MODULE_PATH = Path(__file__).parents[1] / 'superset' / 'sec_views_core.py'
FAB_BS5_PATH = Path(__file__).parents[1] / 'superset' / 'fab_bs5.py'
FAB_BS5_SPEC = importlib.util.spec_from_file_location(
    'superset.fab_bs5',
    FAB_BS5_PATH,
)
FAB_BS5 = importlib.util.module_from_spec(FAB_BS5_SPEC)
sys.modules['superset.fab_bs5'] = FAB_BS5
FAB_BS5_SPEC.loader.exec_module(FAB_BS5)
SPEC = importlib.util.spec_from_file_location('sec_views_core', MODULE_PATH)
SEC_VIEWS_CORE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SEC_VIEWS_CORE)


class RoleCustomModelViewTest(unittest.TestCase):

    def test_view_keeps_existing_role_permissions(self):
        self.assertEqual(
            'RoleModelView',
            SEC_VIEWS_CORE.RoleCustomModelView.class_permission_name,
        )

    def test_edit_form_includes_user_relationship(self):
        view = SEC_VIEWS_CORE.RoleCustomModelView
        datamodel = SQLAInterface(Role)
        form = GeneralModelConverter(datamodel).create_form(
            view.label_columns,
            view.edit_columns,
        )

        self.assertEqual(['name', 'permissions', 'user'], view.edit_columns)
        self.assertTrue(datamodel.is_relation_many_to_many('user'))
        self.assertIs(
            QuerySelectMultipleField,
            form.__dict__['user'].field_class,
        )


class UserCustomModelViewTest(unittest.TestCase):

    def get_expire_date_form(self, extra_fields):
        return type(
            'ExpireDateForm',
            (Form,),
            {'expire_date': extra_fields['expire_date']},
        )

    def test_expire_date_accepts_date_picker_value(self):
        form_class = self.get_expire_date_form(
            SEC_VIEWS_CORE.UserCustomModelView.edit_form_extra_fields,
        )
        form = form_class(MultiDict({'expire_date': '2026-08-08'}))

        self.assertTrue(form.validate())
        self.assertEqual(datetime(2026, 8, 8), form.expire_date.data)
        self.assertIsInstance(
            form.expire_date.widget,
            FAB_BS5.BS5DatePickerWidget,
        )

    def test_add_expire_date_uses_date_only_widget(self):
        form_class = self.get_expire_date_form(
            SEC_VIEWS_CORE.UserCustomModelView.add_form_extra_fields,
        )
        form = form_class()
        form.expire_date.data = datetime(2026, 8, 8, 13, 14, 15)

        markup = str(form.expire_date())

        self.assertIsInstance(
            form.expire_date.widget,
            FAB_BS5.BS5DatePickerWidget,
        )
        self.assertIn('class="input-group date appbuilder_date"', markup)
        self.assertIn('data-format="yyyy-MM-dd"', markup)
        self.assertNotIn('appbuilder_datetime', markup)
        self.assertNotIn('13:14:15', markup)

    def test_expire_date_preserves_full_datetime_value(self):
        form_class = self.get_expire_date_form(
            SEC_VIEWS_CORE.UserCustomModelView.edit_form_extra_fields,
        )
        form = form_class(MultiDict({
            'expire_date': '2026-08-08 13:14:15',
        }))

        self.assertTrue(form.validate())
        self.assertEqual(
            datetime(2026, 8, 8, 13, 14, 15),
            form.expire_date.data,
        )

    def test_expire_date_remains_optional(self):
        form_class = self.get_expire_date_form(
            SEC_VIEWS_CORE.UserCustomModelView.edit_form_extra_fields,
        )
        form = form_class(MultiDict({'expire_date': ''}))

        self.assertTrue(form.validate())
        self.assertIsNone(form.expire_date.data)

    def test_add_form_keeps_password_fields_and_expire_date(self):
        self.assertEqual(
            {'password', 'conf_password', 'expire_date'},
            set(SEC_VIEWS_CORE.UserCustomModelView.add_form_extra_fields),
        )


if __name__ == '__main__':
    unittest.main()
