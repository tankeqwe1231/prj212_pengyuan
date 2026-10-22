from flask_appbuilder.security.views import RoleModelView, UserDBModelView
from flask_babel import lazy_gettext
from wtforms import DateTimeField, validators

from superset.fab_bs5 import BS5DatePickerWidget


def expire_date_field():
    return DateTimeField(
        '到期时间',
        format=['%Y-%m-%d %H:%M:%S', '%Y-%m-%d'],
        validators=[validators.Optional()],
        # The database column remains a DateTime for compatibility, while the
        # user-facing control only needs to select a calendar date.
        widget=BS5DatePickerWidget(),
    )


class RoleCustomModelView(RoleModelView):
    class_permission_name = 'RoleModelView'

    edit_columns = ['name', 'permissions', 'user']

    label_columns = dict(RoleModelView.label_columns, user=lazy_gettext('User'))


class UserCustomModelView(UserDBModelView):
    show_fieldsets = [
        (lazy_gettext('User info'),
         {'fields': ['username', 'active', 'roles', 'login_count', 'dept', 'person_contact',
                     'mobile_phone', 'expire_date']}),
        (lazy_gettext('Personal Info'),
         {'fields': ['first_name', 'last_name', 'email'], 'expanded': True}),
        (lazy_gettext('Audit Info'),
         {'fields': ['last_login', 'fail_login_count', 'created_on',
                     'created_by', 'changed_on', 'changed_by'], 'expanded': False}),
    ]

    add_columns = ['first_name', 'last_name', 'username', 'active', 'email', 'roles', 'password', 'conf_password',
                   'expire_date', 'dept', 'person_contact', 'mobile_phone']
    edit_columns = ['first_name', 'last_name', 'username', 'active', 'email', 'roles',
                    'expire_date', 'dept', 'person_contact', 'mobile_phone']
    list_columns = ['first_name', 'last_name', 'username', 'active', 'roles', 'dept', 'expire_date']

    add_form_extra_fields = dict(
        UserDBModelView.add_form_extra_fields,
        expire_date=expire_date_field(),
    )
    edit_form_extra_fields = {
        'expire_date': expire_date_field(),
    }

    label_columns = {'get_full_name': lazy_gettext('Full Name'),
                     'first_name': lazy_gettext('First Name'),
                     'last_name': lazy_gettext('Last Name'),
                     'username': lazy_gettext('User Name'),
                     'password': lazy_gettext('Password'),
                     'active': lazy_gettext('Is Active?'),
                     'email': lazy_gettext('EMail'),
                     'roles': lazy_gettext('Role'),
                     'last_login': lazy_gettext('Last login'),
                     'login_count': lazy_gettext('Login count'),
                     'fail_login_count': lazy_gettext('Failed login count'),
                     'created_on': lazy_gettext('Created on'),
                     'created_by': lazy_gettext('Created by'),
                     'changed_on': lazy_gettext('Changed on'),
                     'changed_by': lazy_gettext('Changed by'),
                     'dept': '部门',
                     'person_contact': '联系人',
                     'mobile_phone': '手机号',
                     'expire_date': '到期时间',}
