"""Bootstrap 5 form widgets used by the legacy FAB views.

Flask-AppBuilder 4 still names and emits a number of Bootstrap 3 widgets.  The
application owns this small adapter so FAB can stay pinned while its generated
forms use the same Bootstrap 5 runtime as the React pages.
"""

from markupsafe import Markup, escape
from flask_appbuilder.fields import QuerySelectMultipleField
from wtforms import widgets
from wtforms.widgets import html_params


class BS5TextFieldWidget(widgets.TextInput):
    def __call__(self, field, **kwargs):
        kwargs['class'] = 'form-control'
        if field.label:
            kwargs['placeholder'] = field.label.text
        if 'name_' in kwargs:
            field.name = kwargs.pop('name_')
        return super().__call__(field, **kwargs)


class BS5TextAreaFieldWidget(widgets.TextArea):
    def __call__(self, field, **kwargs):
        kwargs['class'] = 'form-control'
        kwargs.setdefault('rows', 3)
        if field.label:
            kwargs['placeholder'] = field.label.text
        return super().__call__(field, **kwargs)


class BS5PasswordFieldWidget(widgets.PasswordInput):
    def __call__(self, field, **kwargs):
        kwargs['class'] = 'form-control'
        if field.label:
            kwargs['placeholder'] = field.label.text
        return super().__call__(field, **kwargs)


class BS5Select2Widget(widgets.Select):
    def __init__(self, extra_classes=None, style=None):
        self.extra_classes = extra_classes
        self.style = style
        super().__init__()

    def __call__(self, field, **kwargs):
        classes = 'my_select2 form-select'
        if self.extra_classes:
            classes += ' ' + self.extra_classes
        kwargs['class'] = classes
        if self.style:
            kwargs['style'] = self.style
        kwargs['data-placeholder'] = 'Select Value'
        if 'name_' in kwargs:
            field.name = kwargs.pop('name_')
        return super().__call__(field, **kwargs)


class BS5Select2ManyWidget(BS5Select2Widget):
    def __call__(self, field, **kwargs):
        kwargs['multiple'] = True
        return super().__call__(field, **kwargs)


class BS5AjaxSelect2ManyWidget(BS5Select2ManyWidget):
    """Render a multi-select whose unselected choices are loaded on demand."""

    def __init__(self, endpoint, extra_classes=None, style=None):
        self.endpoint = endpoint
        super().__init__(extra_classes=extra_classes, style=style)

    def __call__(self, field, **kwargs):
        kwargs['data-endpoint'] = self.endpoint
        rendered = super().__call__(field, **kwargs)
        return Markup(str(rendered).replace(
            'class="my_select2 form-select',
            'class="my_select2_remote form-select',
            1,
        ))


class LazyQuerySelectMultipleField(QuerySelectMultipleField):
    """Query only the selected related rows instead of every possible row."""

    def __init__(self, *args, query_ids_func=None, **kwargs):
        self.query_ids_func = query_ids_func
        kwargs.setdefault('query_func', lambda: [])
        super().__init__(*args, **kwargs)

    def _get_object_list(self):
        if self._object_list is None:
            if self._formdata is not None:
                values = list(self._formdata)
                objects = self.query_ids_func(values) if values else []
            else:
                objects = self._data or []
            self._object_list = [
                (str(self.get_pk_func(obj)), obj) for obj in objects
            ]
        return self._object_list


class _BS5DatePickerWidget:
    picker_class = 'appbuilder_date'
    input_format = 'yyyy-MM-dd'

    def __call__(self, field, **kwargs):
        kwargs.setdefault('id', field.id)
        kwargs.setdefault('name', field.name)
        kwargs['class'] = 'form-control'
        kwargs['autocomplete'] = 'off'
        value = field.data or ''
        if hasattr(value, 'strftime'):
            value = value.strftime(
                '%Y-%m-%d %H:%M:%S'
                if self.picker_class == 'appbuilder_datetime'
                else '%Y-%m-%d'
            )
        input_html = html_params(type='text', value=value, **kwargs)
        return Markup(
            '<div id="{field_id}-picker" class="input-group date {picker}" '
            'data-td-target-input="nearest" data-td-target-toggle="nearest">'
            '<input {input_html} data-format="{input_format}">'
            '<button class="btn btn-outline-secondary" type="button" '
            'data-td-toggle="datetimepicker" '
            'aria-label="Choose date"><i class="fa fa-calendar"></i></button>'
            '</div>'.format(
                picker=self.picker_class,
                input_html=input_html,
                field_id=kwargs['id'],
                input_format=self.input_format,
            )
        )


class BS5DatePickerWidget(_BS5DatePickerWidget):
    pass


class BS5DateTimePickerWidget(_BS5DatePickerWidget):
    picker_class = 'appbuilder_datetime'
    input_format = 'yyyy-MM-dd HH:mm:ss'


class BS5FileUploadFieldWidget:
    def __call__(self, field, **kwargs):
        kwargs.setdefault('id', field.id)
        kwargs.setdefault('name', field.name)
        file_html = html_params(type='file', class_='form-control', **kwargs)
        current = ''
        if field.data:
            current = (
                '<div class="form-check mb-2">'
                '<input class="form-check-input" type="checkbox" '
                'name="_{name}-delete" id="_{name}-delete" value="1">'
                '<label class="form-check-label" for="_{name}-delete">'
                'Delete {value}</label></div>'
            ).format(name=field.name, value=escape(field.data))
        return Markup(
            current + '<div class="input-group"><span class="input-group-text">'
            '<i class="fa fa-upload"></i></span><input {}/></div>'.format(file_html)
        )


class BS5ImageUploadFieldWidget(BS5FileUploadFieldWidget):
    def get_url(self, field):
        # Reuse the manager configured on the field. Constructing a new
        # ImageManager discards custom upload paths and needs app context.
        return field.imagemanager.get_url(field.data)

    def __call__(self, field, **kwargs):
        preview = ''
        if field.data:
            preview = '<img class="img-thumbnail d-block mb-2" src="{}" alt="">'.format(
                escape(self.get_url(field))
            )
        return Markup(preview + str(super().__call__(field, **kwargs)))


def install_bs5_form_converter():
    """Point FAB's runtime converter at project-owned Bootstrap 5 widgets."""
    from flask_appbuilder import forms as fab_forms
    from flask_appbuilder import baseviews as fab_baseviews
    from flask_appbuilder.models.mongoengine.fields import MongoFileField, MongoImageField
    from flask_appbuilder.upload import FileUploadField, ImageUploadField
    from wtforms import (
        DateField,
        DateTimeField,
        DecimalField,
        FloatField,
        IntegerField,
        StringField,
        TextAreaField,
    )

    if getattr(fab_forms, '_superset_bs5_installed', False):
        return

    class BS5FieldConverter(fab_forms.FieldConverter):
        conversion_table = (
            ('is_image', ImageUploadField, BS5ImageUploadFieldWidget),
            ('is_file', FileUploadField, BS5FileUploadFieldWidget),
            ('is_gridfs_file', MongoFileField, BS5FileUploadFieldWidget),
            ('is_gridfs_image', MongoImageField, BS5ImageUploadFieldWidget),
            ('is_text', TextAreaField, BS5TextAreaFieldWidget),
            ('is_binary', TextAreaField, BS5TextAreaFieldWidget),
            ('is_string', StringField, BS5TextFieldWidget),
            ('is_integer', IntegerField, BS5TextFieldWidget),
            ('is_numeric', DecimalField, BS5TextFieldWidget),
            ('is_float', FloatField, BS5TextFieldWidget),
            ('is_boolean', fab_forms.BooleanField, None),
            ('is_date', DateField, BS5DatePickerWidget),
            ('is_datetime', DateTimeField, BS5DateTimePickerWidget),
        )

    fab_forms.FieldConverter = BS5FieldConverter
    fab_forms.Select2Widget = BS5Select2Widget
    fab_forms.Select2ManyWidget = BS5Select2ManyWidget
    fab_baseviews.GeneralModelConverter = fab_forms.GeneralModelConverter

    # Security forms and UserDBModelView fields are created when FAB modules
    # are imported, before this installer runs. Update those already-bound
    # fields without modifying the installed package.
    from flask_appbuilder.security import forms as security_forms
    from flask_appbuilder.security import views as security_views

    for form_class in (
        security_forms.UserInfoEdit,
        security_forms.ResetPasswordForm,
        security_forms.RegisterUserDBForm,
        security_forms.RegisterUserOIDForm,
    ):
        for unbound_field in form_class.__dict__.values():
            if hasattr(unbound_field, 'kwargs') and unbound_field.kwargs.get('widget'):
                old_widget = unbound_field.kwargs['widget']
                if old_widget.__class__.__name__ == 'BS3PasswordFieldWidget':
                    unbound_field.kwargs['widget'] = BS5PasswordFieldWidget()
                elif old_widget.__class__.__name__ == 'BS3TextFieldWidget':
                    unbound_field.kwargs['widget'] = BS5TextFieldWidget()

    for field in security_views.UserDBModelView.add_form_extra_fields.values():
        field.kwargs['widget'] = BS5PasswordFieldWidget()

    fab_forms._superset_bs5_installed = True
