# -*- coding: utf-8 -*-
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import sys
from datetime import datetime, timedelta
import json
import logging
import os
import re
import subprocess
import time
import traceback
import threading
import fitz
import requests
from urllib import parse

from flask import (
    abort, flash, g, redirect, render_template, request, Response, url_for,
    jsonify, stream_with_context, send_file, make_response
)
from markupsafe import Markup
from flask_appbuilder import expose, SimpleFormView
from flask_appbuilder.actions import action
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import (
    has_access, has_access_api, permission_name,
)
from .decorators_custom import has_access_custom, has_access_api_custom
from flask_babel import gettext as __
from flask_babel import lazy_gettext as _
import pandas as pd
from six import text_type
import sqlalchemy as sqla
from sqlalchemy import create_engine
from sqlalchemy.engine.url import make_url
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func as sqlfunc, case
from sqlalchemy.orm import joinedload, load_only
from unidecode import unidecode
from werkzeug.routing import BaseConverter
from werkzeug.utils import secure_filename

from superset import (
    app, appbuilder, cache, csrf, db, results_backend, security_manager, sql_lab,
    utils, viz,
)
from superset.connectors.connector_registry import ConnectorRegistry
from superset.connectors.sqla.models import AnnotationDatasource, SqlaTable
from superset.exceptions import SupersetException, SupersetSecurityException
from superset.forms import CsvToDatabaseForm
from superset.jinja_context import get_template_processor
from superset.legacy import cast_form_data
import superset.models.core as models
from superset.models.sql_lab import Query
from superset.sqlalchemy_uri import normalize_sqlalchemy_uri
from superset.sql_parse import SupersetQuery
from superset.utils import (
    merge_extra_filters, merge_request_params, QueryStatus,
)
from .base import (
    api, BaseSupersetView, CsvResponse, DeleteMixin,
    generate_download_headers, get_error_msg, get_user_roles,
    json_error_response, SliceClientListWidget, SupersetFilter,
    SupersetModelView, YamlExportMixin,
)
from .utils import (bootstrap_user_data, create_ppt_with_images, aes_decrypt, get_dify_chatflow_client_instance,
get_dify_workflow_client_instance, is_user_login)
from flask_appbuilder.forms import QuerySelectField
from superset.fab_bs5 import (
    BS5AjaxSelect2ManyWidget, BS5Select2Widget,
    LazyQuerySelectMultipleField,
)
from .shot_dash import ScreenShotDash
from .slice_utils import (
    CurrentUserSliceOwnerFilter, filter_accessible_datasources,
    format_viz_type_pill, resolve_datasource_info,
)


config = app.config
stats_logger = config.get('STATS_LOGGER')
log_this = models.Log.log_this
DAR = models.DatasourceAccessRequest
DASHBOARD_SLICE_FILTER_THRESHOLD = config.get('DASHBOARD_SLICE_FILTER_THRESHOLD', 5)

ALL_DATASOURCE_ACCESS_ERR = __(
    'This endpoint requires the `all_datasource_access` permission')
DATASOURCE_MISSING_ERR = __('The datasource seems to have been deleted')
INVALID_DATASOURCE_ERR = __('无法识别所选数据源，请重新选择。')
ACCESS_REQUEST_MISSING_ERR = __(
    'The access requests seem to have been deleted')
USER_MISSING_ERR = __('The user seems to have been deleted')
perms_instruction_link = config.get('PERMISSION_INSTRUCTIONS_LINK')
if perms_instruction_link:
    # DATASOURCE_ACCESS_ERR = __(
    #     "You don't have access to this datasource. <a href='{}'>(Gain access)</a>"
    #     .format(perms_instruction_link),
    # )
    DATASOURCE_ACCESS_ERR = __(
        "您没有取得该数据的浏览权限，请联系管理员. <a href='{}'>(Gain access)</a>"
        .format(perms_instruction_link),
    )
else:
    # DATASOURCE_ACCESS_ERR = __("You don't have access to this datasource")
    DATASOURCE_ACCESS_ERR = __("您没有取得该数据的浏览权限，请联系管理员.")

FORM_DATA_KEY_BLACKLIST = []
if not config.get('ENABLE_JAVASCRIPT_CONTROLS'):
    FORM_DATA_KEY_BLACKLIST = [
        'js_tooltip',
        'js_onclick_href',
        'js_data_mutator',
    ]


def get_database_access_error_msg(database_name):
    return __('This view requires the database %(name)s or '
              '`all_datasource_access` permission', name=database_name)


def get_datasource_access_error_msg(datasource_name):
    return __('This endpoint requires the datasource %(name)s, database or '
              '`all_datasource_access` permission', name=datasource_name)


def json_success(json_msg, status=200):
    return Response(json_msg, status=status, mimetype='application/json')


def is_owner(obj, user):
    """ Check if user is owner of the slice """
    return obj and user in obj.owners


def check_ownership(obj, raise_if_false=True):
    """Meant to be used in `pre_update` hooks on models to enforce ownership

    Admin have all access, and other users need to be referenced on either
    the created_by field that comes with the ``AuditMixin``, or in a field
    named ``owners`` which is expected to be a one-to-many with the User
    model. It is meant to be used in the ModelView's pre_update hook in
    which raising will abort the update.
    """
    if not obj:
        return False

    security_exception = SupersetSecurityException(
        "You don't have the rights to alter [{}]".format(obj))

    if g.user.is_anonymous:
        if raise_if_false:
            raise security_exception
        return False
    roles = (r.name for r in get_user_roles())
    if 'Admin' in roles:
        return True
    session = db.create_scoped_session()
    orig_obj = session.query(obj.__class__).filter_by(id=obj.id).first()
    owner_names = (user.username for user in orig_obj.owners)
    if (
            hasattr(orig_obj, 'created_by') and
            orig_obj.created_by and
            orig_obj.created_by.username == g.user.username):
        return True
    if (
            hasattr(orig_obj, 'owners') and
            g.user and
            hasattr(g.user, 'username') and
            g.user.username in owner_names):
        return True
    if raise_if_false:
        raise security_exception
    else:
        return False


# TODO：This function is added by myself.
def gen_top_category(cur_appbuilder):
    print('----------进入 gen_top_category ----', datetime.now())
    origin_lst = cur_appbuilder.app.view_functions['DashboardModelViewAsync.get_dashboards_list']()
    if not origin_lst:
        err_msg = _('No Category can be show.')
        logging.error(err_msg)
        return json_error_response(err_msg)
    print('---get_dashboards_list 执行结束，开始一次性处理-------', datetime.now())

    _top_category_dict = {}
    non_private_dashboards = []

    def extract_and_build_dict(dashboard):
        """一次性提取数据并构建字典，避免重复访问"""
        # 过滤私人看板
        if dashboard.dashboard_type == 'private':
            return None

        # 提取嵌套属性
        categorys = dashboard.categorys
        second_category = categorys.second_category if categorys else None
        top_category_obj = second_category.top_category if second_category else None

        # 构建数据行（用于排序和后续处理）
        dashboard_data = {
            'dashboard_id': dashboard.id,
            'url': dashboard.url,
            'dashboard_type': dashboard.dashboard_type,
            'created_by_fk': dashboard.created_by_fk,
            'sub_sub_category': categorys.category_name if categorys else 'Unknown',
            'sub_sub_category_priority': categorys.list_order if categorys else 999,
            'dashboard_title': dashboard.dashboard_title,
            'dashboard_priority': dashboard.dashboard_priority if dashboard.dashboard_priority else 999,
            'sub_category': second_category.category_name if second_category else 'Unknown',
            'top_category': top_category_obj.category_name if top_category_obj else 'Unknown',
        }

        # 构建嵌套字典结构
        top_cat = dashboard_data['top_category']
        sub_cat = dashboard_data['sub_category']
        sub_sub_cat = dashboard_data['sub_sub_category']

        if top_cat not in _top_category_dict:
            _top_category_dict[top_cat] = {}
        if sub_cat not in _top_category_dict[top_cat]:
            _top_category_dict[top_cat][sub_cat] = {}
        if sub_sub_cat not in _top_category_dict[top_cat][sub_cat]:
            _top_category_dict[top_cat][sub_cat][sub_sub_cat] = {
                'priority': dashboard_data['sub_sub_category_priority'],
                'values': []
            }

        # 添加dashboard信息
        _top_category_dict[top_cat][sub_cat][sub_sub_cat]['values'].append([
            dashboard_data['dashboard_title'],
            dashboard_data['url'],
            dashboard_data['dashboard_priority']
        ])

        return dashboard_data

    # 一次循环完成所有处理
    for dashboard in origin_lst:
        dashboard_data = extract_and_build_dict(dashboard)
        if dashboard_data:  # 非私人看板
            non_private_dashboards.append(dashboard_data)

    print('---- 开始排序和后续处理 ------', datetime.now())

    # non_private_dashboards.sort(key=lambda x: (
    #     x['dashboard_priority'],
    #     x['top_category'],
    #     x['sub_category'],
    #     x['sub_sub_category']
    # ))
    # non_private_dashboards.sort(key=lambda x: (
    #     x['dashboard_priority']
    # ))

    # 处理category排序
    for top_cat, top_cat_data in _top_category_dict.items():
        for sub_cat, sub_cat_data in top_cat_data.items():
            # 直接排序，避免创建临时DataFrame
            sorted_categories = sorted(
                [(cat_name, cat_data['priority']) for cat_name, cat_data in sub_cat_data.items()],
                key=lambda x: x[1]
            )
            sub_cat_data['third_category_list_order'] = [cat[0] for cat in sorted_categories]

    _top_category_lst = list(set(item['top_category'] for item in non_private_dashboards))
    _top_category_lst_str = gen_top_category_lst_str_by_order(_top_category_lst)
    top_category_arr_by_order = _top_category_lst_str.split('|')

    # 获取第一个top_category对应的sub_category
    first_top_cat_items = [item for item in non_private_dashboards if item['top_category'] == top_category_arr_by_order[0]]
    _sub_category = first_top_cat_items[0]['sub_category'] if first_top_cat_items else 'Unknown'

    second_category_list_order = gen_second_category_list_order()
    print('---------出去 gen_top_category----', datetime.now())

    return {
        'top_category_arr_by_order': top_category_arr_by_order,
        '_top_category_lst_str': _top_category_lst_str,
        '_sub_category': _sub_category,
        '_top_category_dict': _top_category_dict,
        'second_category_list_order': second_category_list_order,
    }


# TODO：This function is added by myself.
def gen_top_category_lst_str_by_order(_top_category_lst):
    # weight_order_list = ['研究体系', '能源化工', '黑色商品', '有色商品', '农产品', '基本面量化']
    weight_order_list = [obj.category_name for obj in
                         db.session().query(models.TopCategory).order_by(models.TopCategory.list_order)]
    order_list = [x for x in weight_order_list if x in _top_category_lst]
    un_order_list = [x for x in _top_category_lst if x not in order_list]
    all_order_list = order_list + un_order_list
    return '|'.join(all_order_list)


def gen_second_category_list_order():
    top_qry = db.session().query(models.TopCategory)
    order_dict = {}
    for obj in top_qry:
        order_dict[obj.category_name] = [second_obj.category_name for second_obj in obj.second_category]
    return order_dict


def get_client_ip():
    x_forwarded_for = request.headers.get('X-Forwarded-For')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
        if ip:
            return ip
    x_real_ip = request.headers.get('X-Real-IP')
    if x_real_ip:
        return x_real_ip.strip()
    x_forwarded = request.headers.get('X-Forwarded')
    if x_forwarded:
        return x_forwarded.split(',')[0].strip()
    return request.remote_addr


def remove_outputs_metadata(result):
    if 'outputs' in result:
        result['outputs'] = {
            key: [{k: v for k, v in item.items() if k != 'metadata'}
                  for item in value]
            for key, value in result['outputs'].items()
            if isinstance(value, list)
        }
    return result


class SliceFilter(SupersetFilter):
    def apply(self, query, func):  # noqa
        if self.has_all_datasource_access():
            return query
        perms = self.get_view_menus('datasource_access')
        # TODO(bogdan): add `schema_access` support here
        return query.filter(self.model.perm.in_(perms))


class DashboardFilter(SupersetFilter):
    """List dashboards for which users have less than 5 inaccessible slices AND at least 1 accessible slice"""

    def apply(self, query, func):  # noqa
        if self.has_all_datasource_access():
            return query
        Slice = models.Slice  # noqa
        Dash = models.Dashboard  # noqa
        # TODO(bogdan): add `schema_access` support here
        datasource_perms = self.get_view_menus('datasource_access')

        accessible_dashboard_ids = (
            db.session
            .query(Dash.id)
            .outerjoin(models.dashboard_slices, Dash.id == models.dashboard_slices.c.dashboard_id)
            .outerjoin(Slice, models.dashboard_slices.c.slice_id == Slice.id)
            .group_by(Dash.id)
            .having(
                sqla.and_(
                    # 条件1: 用户没有权限的slice数量 < 5
                    sqlfunc.coalesce(
                        sqlfunc.sum(
                            case(
                                [(Slice.perm.notin_(datasource_perms), 1)],
                                else_=0
                            )
                        ), 0
                    ) < DASHBOARD_SLICE_FILTER_THRESHOLD,
                    # 条件2: 用户至少有1个slice的权限（排除全部没权限的情况）
                    sqlfunc.coalesce(
                        sqlfunc.sum(
                            case(
                                [(Slice.perm.in_(datasource_perms), 1)],
                                else_=0
                            )
                        ), 0
                    ) > 0
                )
            )
        )

        query = query.filter(Dash.id.in_(accessible_dashboard_ids))
        return query


class DatabaseView(SupersetModelView, DeleteMixin, YamlExportMixin):  # noqa
    datamodel = SQLAInterface(models.Database)

    list_title = _('List Databases')
    show_title = _('Show Database')
    add_title = _('Add Database')
    edit_title = _('Edit Database')

    list_columns = [
        'database_name', 'backend', 'allow_run_sync', 'allow_run_async',
        'allow_dml', 'creator', 'modified']
    order_columns = [
        'database_name', 'allow_run_sync', 'allow_run_async', 'allow_dml',
        'modified',
    ]
    add_columns = [
        'database_name', 'sqlalchemy_uri', 'cache_timeout', 'extra',
        'expose_in_sqllab', 'allow_run_sync', 'allow_run_async',
        'allow_ctas', 'allow_dml', 'force_ctas_schema', 'impersonate_user',
        'allow_multi_schema_metadata_fetch',
    ]
    search_exclude_columns = (
        'password', 'tables', 'created_by', 'changed_by', 'queries',
        'saved_queries')
    edit_columns = add_columns
    show_columns = [
        'tables',
        'cache_timeout',
        'extra',
        'database_name',
        'sqlalchemy_uri',
        'perm',
        'created_by',
        'created_on',
        'changed_by',
        'changed_on',
    ]
    add_template = 'superset/models/database/add.html'
    edit_template = 'superset/models/database/edit.html'
    base_order = ('changed_on', 'desc')
    description_columns = {
        'sqlalchemy_uri': utils.markdown(
            'Refer to the '
            '[SqlAlchemy docs]'
            '(http://docs.sqlalchemy.org/en/rel_1_0/core/engines.html#'
            'database-urls) '
            'for more information on how to structure your URI.', True),
        'expose_in_sqllab': _('Expose this DB in SQL Lab'),
        'allow_run_sync': _(
            'Allow users to run synchronous queries, this is the default '
            'and should work well for queries that can be executed '
            'within a web request scope (<~1 minute)'),
        'allow_run_async': _(
            'Allow users to run queries, against an async backend. '
            'This assumes that you have a Celery worker setup as well '
            'as a results backend.'),
        'allow_ctas': _('Allow CREATE TABLE AS option in SQL Lab'),
        'allow_dml': _(
            'Allow users to run non-SELECT statements '
            '(UPDATE, DELETE, CREATE, ...) '
            'in SQL Lab'),
        'force_ctas_schema': _(
            'When allowing CREATE TABLE AS option in SQL Lab, '
            'this option forces the table to be created in this schema'),
        'extra': utils.markdown(
            'JSON string containing extra configuration elements. '
            'The ``engine_params`` object gets unpacked into the '
            '[sqlalchemy.create_engine]'
            '(http://docs.sqlalchemy.org/en/latest/core/engines.html#'
            'sqlalchemy.create_engine) call, while the ``metadata_params`` '
            'gets unpacked into the [sqlalchemy.MetaData]'
            '(http://docs.sqlalchemy.org/en/rel_1_0/core/metadata.html'
            '#sqlalchemy.schema.MetaData) call. ', True),
        'impersonate_user': _(
            'If Presto, all the queries in SQL Lab are going to be executed as the '
            'currently logged on user who must have permission to run them.<br/>'
            'If Hive and hive.server2.enable.doAs is enabled, will run the queries as '
            'service account, but impersonate the currently logged on user '
            'via hive.server2.proxy.user property.'),
        'allow_multi_schema_metadata_fetch': _(
            'Allow SQL Lab to fetch a list of all tables and all views across '
            'all database schemas. For large data warehouse with thousands of '
            'tables, this can be expensive and put strain on the system.'),
    }
    label_columns = {
        'expose_in_sqllab': _('Expose in SQL Lab'),
        'allow_ctas': _('Allow CREATE TABLE AS'),
        'allow_dml': _('Allow DML'),
        'force_ctas_schema': _('CTAS Schema'),
        'database_name': _('Database'),
        'creator': _('Creator'),
        'changed_on_': _('Last Changed'),
        'sqlalchemy_uri': _('SQLAlchemy URI'),
        'cache_timeout': _('Cache Timeout'),
        'extra': _('Extra'),
        'allow_run_sync': _('Allow Run Sync'),
        'allow_run_async': _('Allow Run Async'),
        'impersonate_user': _('Impersonate the logged on user'),
    }

    def pre_add(self, db):
        db.set_sqlalchemy_uri(db.sqlalchemy_uri)
        security_manager.merge_perm('database_access', db.perm)
        for schema in db.all_schema_names():
            security_manager.merge_perm(
                'schema_access', security_manager.get_schema_perm(db, schema))

    def pre_update(self, db):
        self.pre_add(db)

    def _delete(self, pk):
        DeleteMixin._delete(self, pk)


appbuilder.add_link(
    'Import Dashboards',
    label=__('Import Dashboards'),
    href='/superset/import_dashboards',
    icon='fa-cloud-upload',
    category='Manage',
    category_label=__('Manage'),
    category_icon='fa-wrench')

appbuilder.add_view(
    DatabaseView,
    'Databases',
    label=__('Databases'),
    icon='fa-database',
    category='Sources',
    category_label=__('Sources'),
    category_icon='fa-database')


class DatabaseAsync(DatabaseView):
    list_columns = [
        'id', 'database_name',
        'expose_in_sqllab', 'allow_ctas', 'force_ctas_schema',
        'allow_run_async', 'allow_run_sync', 'allow_dml',
        'allow_multi_schema_metadata_fetch',
    ]


appbuilder.add_view_no_menu(DatabaseAsync)


class CsvToDatabaseView(SimpleFormView):
    form = CsvToDatabaseForm
    form_title = _('CSV to Database configuration')
    add_columns = ['database', 'schema', 'table_name']

    def form_get(self, form):
        form.sep.data = ','
        form.header.data = 0
        form.mangle_dupe_cols.data = True
        form.skipinitialspace.data = False
        form.skip_blank_lines.data = True
        form.infer_datetime_format.data = True
        form.decimal.data = '.'
        form.if_exists.data = 'append'

    @expose("/form", methods=['GET'])
    @has_access
    def this_form_get(self):
        self._init_vars()
        form = self.form.refresh()

        if 'Admin' not in [x.name for x in g.user.roles]:
            database_for_client = [y.view_menu.name
                                   for x in g.user.roles
                                   for y in x.permissions
                                   if y.permission.name == 'datasource_access']
            database_for_client = [re.match(r'\[([a-zA-Z0-9_]+)\].\(id:[0-9]+\)', x).group(1)
                                   for x in database_for_client if re.match(r'\[([a-zA-Z0-9_]+)\].\(id:[0-9]+\)', x)]
            if form.con._get_object_list():
                lst = [x for x in form.con._get_object_list() if x[1].name in database_for_client]
                setattr(form.con, "_object_list", lst)

        # TODO：judge the premission in here, and use the premission to change the form's con.
        self.form_get(form)
        widgets = self._get_edit_widget(form=form)
        self.update_redirect()

        if 'Admin' in [x.name for x in get_user_roles()]:
            return self.render_template(self.form_template,
                                        title=self.form_title,
                                        widgets=widgets,
                                        appbuilder=self.appbuilder)
        else:
            return redirect(self.appbuilder.get_url_for_login)
            # top_category_data = gen_top_category(self.appbuilder)
            # return self.render_template(
            #     'appbuilder/general/model/edit_for_client.html',
            #     title=self.form_title,
            #     widgets=widgets,
            #     appbuilder=self.appbuilder,
            #     userId=g.user.id,
            #     favorites=self.appbuilder.app.view_functions['Superset.fave_dashboards'](g.user.id).get_data(
            #         as_text=True),
            #     can_save_monitor=security_manager.can_access('can_save_monitor', 'Superset'),
            #     show_top10_record=security_manager.can_access('can_show_top10_record', 'Superset'),
            #     show_sclice=security_manager.can_access('can_add', 'SliceModelView'),
            #     current_top_category=top_category_data['top_category_arr_by_order'][0],
            #     current_sub_category=top_category_data['_sub_category'],
            #     top_category_lst=top_category_data['_top_category_lst_str'],
            #     top_category_dict=json.dumps(top_category_data['_top_category_dict']),
            #     second_category_list_order=json.dumps(top_category_data['second_category_list_order']),
            # )

    def form_post(self, form):
        csv_file = form.csv_file.data
        form.csv_file.data.filename = secure_filename(form.csv_file.data.filename)
        csv_filename = form.csv_file.data.filename
        try:
            csv_file.save(os.path.join(config['UPLOAD_FOLDER'], csv_filename))
            table = SqlaTable(table_name=form.name.data)
            table.database = form.data.get('con')
            table.database_id = table.database.id
            table.database.db_engine_spec.create_table_from_csv(form, table)
        except Exception as e:
            try:
                os.remove(os.path.join(config['UPLOAD_FOLDER'], csv_filename))
            except OSError:
                pass
            message = 'Table name {} already exists. Please pick another'.format(
                form.name.data) if isinstance(e, IntegrityError) else text_type(e)
            flash(
                message,
                'danger')
            return redirect('/csvtodatabaseview/form')

        os.remove(os.path.join(config['UPLOAD_FOLDER'], csv_filename))
        # Go back to welcome page / splash screen
        db_name = table.database.database_name
        message = _('CSV file "{0}" uploaded to table "{1}" in '
                    'database "{2}"'.format(csv_filename,
                                            form.name.data,
                                            db_name))
        flash(message, 'info')
        if 'Admin' in [x.name for x in get_user_roles()]:
            return redirect('/tablemodelview/list/')
        else:
            return redirect('/csvtodatabaseview/form')


appbuilder.add_view_no_menu(CsvToDatabaseView)


class DatabaseTablesAsync(DatabaseView):
    list_columns = ['id', 'all_table_names', 'all_schema_names']


appbuilder.add_view_no_menu(DatabaseTablesAsync)

if config.get('ENABLE_ACCESS_REQUEST'):
    class AccessRequestsModelView(SupersetModelView, DeleteMixin):
        datamodel = SQLAInterface(DAR)
        list_columns = [
            'username', 'user_roles', 'datasource_link',
            'roles_with_datasource', 'created_on']
        order_columns = ['created_on']
        base_order = ('changed_on', 'desc')
        label_columns = {
            'username': _('User'),
            'user_roles': _('User Roles'),
            'database': _('Database URL'),
            'datasource_link': _('Datasource'),
            'roles_with_datasource': _('Roles to grant'),
            'created_on': _('Created On'),
        }


    appbuilder.add_view(
        AccessRequestsModelView,
        'Access requests',
        label=__('Access requests'),
        category='Security',
        category_label=__('Security'),
        icon='fa-table')


class SliceModelView(SupersetModelView, DeleteMixin):  # noqa
    datamodel = SQLAInterface(models.Slice)

    list_title = _('List Charts')
    show_title = _('Show Chart')
    add_title = _('Add Chart')
    edit_title = _('Edit Chart')

    can_add = False
    label_columns = {
        'datasource_link': _('Datasource'),
    }
    search_columns = (
        'slice_name', 'description', 'viz_type', 'datasource_name', 'owners',
    )
    list_columns = [
        'slice_link', 'viz_type', 'datasource_link', 'creator', 'modified']
    order_columns = ['viz_type', 'datasource_link', 'modified']
    edit_columns = [
        'slice_name', 'description', 'viz_type', 'owners', 'dashboards',
        'params', 'cache_timeout']
    base_order = ('changed_on', 'desc')
    description_columns = {
        'description': Markup(
            'The content here can be displayed as widget headers in the '
            'dashboard view. Supports '
            '<a href="https://daringfireball.net/projects/markdown/"">'
            'markdown</a>'),
        'params': _(
            'These parameters are generated dynamically when clicking '
            'the save or overwrite button in the explore view. This JSON '
            'object is exposed here for reference and for power users who may '
            'want to alter specific parameters.',
        ),
        'cache_timeout': _(
            'Duration (in seconds) of the caching timeout for this slice.'),
    }
    base_filters = [['id', SliceFilter, lambda: []]]
    label_columns = {
        'cache_timeout': _('Cache Timeout'),
        'creator': _('Creator'),
        'dashboards': _('Dashboards'),
        'datasource_link': _('Datasource'),
        'description': _('Description'),
        'modified': _('Last Modified'),
        'modified_client': _('Last Modified'),
        'owners': _('Owners'),
        'params': _('Parameters'),
        'slice_link': _('Chart'),
        'slice_name': _('Name'),
        'table': _('Table'),
        'viz_type': _('Visualization Type'),
    }

    _client_list_columns = [
        'slice_link', 'viz_type', 'datasource_link', 'creator',
        'modified_client',
    ]
    _client_order_columns = [
        'viz_type', 'datasource_link', 'modified_client',
    ]

    def pre_add(self, obj):
        utils.validate_json(obj.params)
        print('--------------')
        print(obj)

    def pre_update(self, obj):
        utils.validate_json(obj.params)
        check_ownership(obj)

    def pre_delete(self, obj):
        check_ownership(obj)

    def _get_list_widget(
            self,
            filters,
            actions=None,
            order_column="",
            order_direction="",
            page=None,
            page_size=None,
            widgets=None,
            **kwargs):
        if not getattr(g, 'slice_list_for_client', False):
            return super(SliceModelView, self)._get_list_widget(
                filters,
                actions=actions,
                order_column=order_column,
                order_direction=order_direction,
                page=page,
                page_size=page_size,
                widgets=widgets,
                **kwargs)

        widgets = widgets or {}
        actions = actions or self.actions
        page_size = page_size or self.page_size
        if not order_column and self.base_order:
            order_column, order_direction = self.base_order
        joined_filters = filters.get_joined_filters(self._base_filters)
        count, lst = self.datamodel.query(
            joined_filters,
            order_column,
            order_direction,
            page=page,
            page_size=page_size,
        )
        pks = self.datamodel.get_keys(lst)
        pks = [self._serialize_pk_if_composite(pk) for pk in pks]
        widgets['list'] = SliceClientListWidget(
            label_columns=self.label_columns,
            include_columns=self._client_list_columns,
            value_columns=self.datamodel.get_values(
                lst, self._client_list_columns),
            order_columns=self._client_order_columns,
            formatters_columns={'viz_type': format_viz_type_pill},
            page=page,
            page_size=page_size,
            count=count,
            pks=pks,
            actions=actions,
            filters=filters,
            modelview_name=self.__class__.__name__,
            **kwargs)
        return widgets

    @expose('/add', methods=['GET', 'POST'])
    @has_access
    def add(self):
        datasources = ConnectorRegistry.get_all_datasources(db.session)
        datasources = filter_accessible_datasources(
            datasources, security_manager, user=g.user)
        datasources = [
            {'value': str(d.id) + '__' + d.type, 'label': repr(d)}
            for d in datasources
        ]
        if 'Admin' in [x.name for x in get_user_roles()]:
            return self.render_template(
                'superset/add_slice.html',
                bootstrap_data=json.dumps({
                    'datasources': sorted(datasources, key=lambda d: d['label']),
                }),
            )
        else:
            # _top_category_arr, _top_category_lst, _sub_category, _top_category_dict, second_category_list_order, _ \
            top_category_data = gen_top_category(self.appbuilder)

            return self.render_template(
                'superset/add_slice_for_client.html',
                bootstrap_data=json.dumps({
                    'datasources': sorted(datasources, key=lambda d: d['label']),
                }),
                userId=g.user.id,
                # favorites=self.appbuilder.app.view_functions['Superset.fave_dashboards'](g.user.id).get_data(
                #     as_text=True),
                can_save_monitor=security_manager.can_access('can_save_monitor', 'Superset'),
                show_top10_record=security_manager.can_access('can_show_top10_record', 'Superset'),
                show_sclice=security_manager.can_access('can_add', 'SliceModelView'),
                current_top_category=top_category_data['top_category_arr_by_order'][0],
                current_sub_category=top_category_data['_sub_category'],
                top_category_lst=top_category_data['_top_category_lst_str'],
                top_category_dict=json.dumps(top_category_data['_top_category_dict']),
                second_category_list_order=json.dumps(top_category_data['second_category_list_order']),
            )

    @expose('/list/')
    @has_access
    def list(self):
        # if not is_user_login():
        #     return redirect(self.appbuilder.get_url_for_login)
        if 'Admin' in [x.name for x in get_user_roles()]:
            widgets = self._list()
            return self.render_template(self.list_template,
                                        title=self.list_title,
                                        widgets=widgets)
        else:
            # _top_category_arr, _top_category_lst, _sub_category, _top_category_dict, second_category_list_order, _ \
            top_category_data = gen_top_category(self.appbuilder)
            g.slice_list_for_client = True
            try:
                widgets = self._list()
            finally:
                g.slice_list_for_client = False

            return self.render_template('appbuilder/general/model/list_for_client.html',
                                        title=self.list_title,
                                        widgets=widgets,
                                        userId=g.user.id,
                                        # favorites=self.appbuilder.app.view_functions['Superset.fave_dashboards'](
                                        #     g.user.id).get_data(as_text=True),
                                        can_save_monitor=security_manager.can_access('can_save_monitor', 'Superset'),
                                        show_top10_record=security_manager.can_access('can_show_top10_record',
                                                                                      'Superset'),
                                        show_sclice=security_manager.can_access('can_add', 'SliceModelView'),
                                        current_top_category=top_category_data['top_category_arr_by_order'][0],
                                        current_sub_category=top_category_data['_sub_category'],
                                        top_category_lst=top_category_data['_top_category_lst_str'],
                                        top_category_dict=json.dumps(top_category_data['_top_category_dict']),
                                        second_category_list_order=json.dumps(
                                            top_category_data['second_category_list_order']),
                                        )

    @expose('/edit/<pk>', methods=['GET', 'POST'])
    @has_access
    def edit(self, pk):
        pk = self._deserialize_pk_if_composite(pk)
        widgets = self._edit(pk)
        if not widgets:
            return self.post_edit_redirect()
        else:
            if 'Admin' in [x.name for x in get_user_roles()]:
                return self.render_template(self.edit_template,
                                            title=self.edit_title,
                                            widgets=widgets,
                                            related_views=self._related_views)
            else:
                # _top_category_arr, _top_category_lst, _sub_category, _top_category_dict, second_category_list_order, _ \
                top_category_data = gen_top_category(self.appbuilder)

                return self.render_template('appbuilder/general/model/edit_for_client.html',
                                            title=self.edit_title,
                                            widgets=widgets,
                                            related_views=self._related_views,
                                            userId=g.user.id,
                                            # favorites=self.appbuilder.app.view_functions['Superset.fave_dashboards'](
                                            #     g.user.id).get_data(as_text=True),
                                            can_save_monitor=security_manager.can_access('can_save_monitor',
                                                                                         'Superset'),
                                            show_top10_record=security_manager.can_access('can_show_top10_record',
                                                                                          'Superset'),
                                            show_sclice=security_manager.can_access('can_add', 'SliceModelView'),
                                            current_top_category=top_category_data['top_category_arr_by_order'][0],
                                            current_sub_category=top_category_data['_sub_category'],
                                            top_category_lst=top_category_data['_top_category_lst_str'],
                                            top_category_dict=json.dumps(top_category_data['_top_category_dict']),
                                            second_category_list_order=json.dumps(
                                                top_category_data['second_category_list_order']),
                                            )


appbuilder.add_view(
    SliceModelView,
    'Charts',
    label=__('Charts'),
    icon='fa-bar-chart',
    category='',
    category_icon='')


class SliceAsync(SliceModelView):  # noqa
    list_columns = [
        'id', 'slice_link', 'viz_type', 'slice_name',
        'creator', 'modified', 'icons']
    label_columns = {
        'icons': ' ',
        'slice_link': _('Chart'),
    }


appbuilder.add_view_no_menu(SliceAsync)


class SliceAddView(SliceModelView):  # noqa
    # FAB 4.5 only applies request filters declared in search_columns. The
    # legacy Add Slice request still sends created_by, which is intentionally
    # not searchable here. Keep the owner restriction on the server so this
    # endpoint cannot return slices owned by another user.
    base_filters = SliceModelView.base_filters + [
        ['owners', CurrentUserSliceOwnerFilter, lambda: g.user],
    ]
    list_columns = [
        'id', 'slice_name', 'slice_link', 'viz_type',
        'datasource_link', 'owners', 'modified', 'changed_on']
    show_columns = list(set(SliceModelView.edit_columns + list_columns))


appbuilder.add_view_no_menu(SliceAddView)


class DashboardModelView(SupersetModelView, DeleteMixin):  # noqa
    datamodel = SQLAInterface(models.Dashboard)

    list_title = _('List Dashboards')
    show_title = _('Show Dashboard')
    add_title = _('Add Dashboard')
    edit_title = _('Edit Dashboard')

    list_columns = [
        'dashboard_link', 'creator', 'modified', 'dashboard_priority', 'show_category']
    order_columns = ['modified']
    edit_columns = [
        'dashboard_title', 'slug', 'slices', 'owners', 'position_json', 'css',
        'json_metadata', 'categorys', 'dashboard_priority']
    show_columns = [
                       'dashboard_title', 'slug', 'slices', 'owners', 'position_json', 'css',
                       'json_metadata', 'dashboard_priority'] + ['table_names', 'show_category']
    search_columns = ('dashboard_title', 'slug', 'owners')
    add_columns = edit_columns
    base_order = ('changed_on', 'desc')
    description_columns = {
        'position_json': _(
            'This json object describes the positioning of the widgets in '
            'the dashboard. It is dynamically generated when adjusting '
            'the widgets size and positions by using drag & drop in '
            'the dashboard view'),
        'css': _(
            'The css for individual dashboards can be altered here, or '
            'in the dashboard view where changes are immediately '
            'visible'),
        'slug': _('To get a readable URL for your dashboard'),
        'json_metadata': _(
            'This JSON object is generated dynamically when clicking '
            'the save or overwrite button in the dashboard view. It '
            'is exposed here for reference and for power users who may '
            'want to alter specific parameters.'),
        'owners': _('Owners is a list of users who can alter the dashboard.'),
        'sub_sub_category_priority': _(
            'The range of the priority is from 1 to 999. '
            'The lower the value, the higher the priority.'),
        'dashboard_priority': _(
            'The range of the priority is from 1 to 999. '
            'The lower the value, the higher the priority.'),
    }
    base_filters = [['slice', DashboardFilter, lambda: []]]
    add_form_query_rel_fields = {
        'slices': [['slices', SliceFilter, None]],
    }
    edit_form_query_rel_fields = add_form_query_rel_fields
    label_columns = {
        'dashboard_link': _('Dashboard'),
        'dashboard_title': _('Title'),
        'slug': _('Slug'),
        'slices': _('Charts'),
        'owners': _('Owners'),
        'creator': _('Creator'),
        'modified': _('Modified'),
        'position_json': _('Position JSON'),
        'css': _('CSS'),
        'json_metadata': _('JSON Metadata'),
        'table_names': _('Underlying Tables'),
        'top_category': _('Top Category'),
        'sub_category': _('Sub Category'),
        'sub_sub_category': _('Sub Sub Category'),
        'sub_sub_category_priority': _('Sub Sub Category Priority'),
        'dashboard_priority': _('Dashboard Priority'),
        'show_category': _('所属栏目'),
    }
    @staticmethod
    def _get_slices_by_ids(slice_ids):
        if not slice_ids:
            return []
        query = db.session.query(models.Slice).filter(
            models.Slice.id.in_(slice_ids))
        query = SliceFilter(
            'slices', SQLAInterface(models.Slice)).apply(query, None)
        slices = query.all()
        slices_by_id = {str(slc.id): slc for slc in slices}
        return [slices_by_id[slice_id] for slice_id in slice_ids
                if slice_id in slices_by_id]

    @staticmethod
    def _get_owners_by_ids(owner_ids):
        if not owner_ids:
            return []
        owners = db.session.query(security_manager.user_model).filter(
            security_manager.user_model.id.in_(owner_ids),
        ).all()
        owners_by_id = {str(owner.id): owner for owner in owners}
        return [owners_by_id[owner_id] for owner_id in owner_ids
                if owner_id in owners_by_id]

    @staticmethod
    def _remote_relation_fields(action):
        endpoint = '/dashboardmodelview/api/related/{}/'.format(action)
        return {
            'slices': LazyQuerySelectMultipleField(
                _('Charts'),
                query_ids_func=lambda ids: (
                    DashboardModelView._get_slices_by_ids(ids)),
                get_pk_func=lambda slc: slc.id,
                widget=BS5AjaxSelect2ManyWidget(
                    endpoint + 'slices', style='width:700px'),
            ),
            'owners': LazyQuerySelectMultipleField(
                _('Owners'),
                query_ids_func=lambda ids: (
                    DashboardModelView._get_owners_by_ids(ids)),
                get_pk_func=lambda owner: owner.id,
                widget=BS5AjaxSelect2ManyWidget(
                    endpoint + 'owners', style='width:700px'),
            ),
        }

    add_form_extra_fields = {
        **_remote_relation_fields.__func__('add'),
        "categorys": QuerySelectField(
            "所属栏目",
            query_func=lambda: db.session().query(models.ThirdCategory),
            get_pk_func=lambda a: a.id,
            get_label=lambda
                a: "[" + a.second_category.top_category.category_name + "]/[" + a.second_category.category_name +
                   "]/[" + a.category_name + "]",
            widget=BS5Select2Widget(style=u'width:700px'),
        )
    }
    edit_form_extra_fields = {
        **_remote_relation_fields.__func__('edit'),
        'categorys': add_form_extra_fields['categorys'],
    }

    def _related_search(self, relation):
        page_size = 30
        try:
            page = max(int(request.args.get('page', 1)), 1)
        except (TypeError, ValueError):
            page = 1
        search = request.args.get('q', '').strip()[:100]

        if relation == 'slices':
            datamodel = SQLAInterface(models.Slice, db.session)
            filters = datamodel.get_filters().add_filter_list(
                self.edit_form_query_rel_fields['slices'])
            query = datamodel.session.query(models.Slice)
            query = datamodel.apply_all(query, filters)
            if search:
                query = query.filter(models.Slice.slice_name.like(
                    '%{}%'.format(search)))
            query = query.order_by(models.Slice.slice_name, models.Slice.id)
        elif relation == 'owners':
            User = security_manager.user_model
            query = db.session.query(User).filter(User.active.is_(True))
            if search:
                pattern = '%{}%'.format(search)
                query = query.filter(sqla.or_(
                    User.username.like(pattern),
                    User.first_name.like(pattern),
                    User.last_name.like(pattern),
                ))
            query = query.order_by(User.username, User.id)
        else:
            abort(404)

        rows = query.offset((page - 1) * page_size).limit(page_size + 1).all()
        return jsonify(
            results=[{'id': row.id, 'text': text_type(row)}
                     for row in rows[:page_size]],
            pagination={'more': len(rows) > page_size},
        )

    @expose('/api/related/add/<relation>', methods=['GET'])
    @has_access
    @permission_name('add')
    def related_add(self, relation):
        return self._related_search(relation)

    @expose('/api/related/edit/<relation>', methods=['GET'])
    @has_access
    @permission_name('edit')
    def related_edit(self, relation):
        return self._related_search(relation)

    def pre_add(self, obj):
        print('---pre添加dashborad----')
        obj.slug = obj.slug.strip() or None
        if obj.slug:
            obj.slug = obj.slug.replace(' ', '-')
            obj.slug = re.sub(r'[^\w\-]+', '', obj.slug)
        if g.user not in obj.owners:
            obj.owners.append(g.user)
        utils.validate_json(obj.json_metadata)
        utils.validate_json(obj.position_json)
        owners = [o for o in obj.owners]
        for slc in obj.slices:
            slc.owners = list(set(owners) | set(slc.owners))

    def post_add(self, item):
        print('---添加dashborad 之后----')

    def pre_update(self, obj):
        print('---更新dashborad----')
        check_ownership(obj)
        self.pre_add(obj)

    def pre_delete(self, obj):
        check_ownership(obj)

    @action('mulexport', __('Export'), __('Export dashboards?'), 'fa-database')
    def mulexport(self, items):
        if not isinstance(items, list):
            items = [items]
        ids = ''.join('&id={}'.format(d.id) for d in items)
        return redirect(
            '/dashboardmodelview/export_dashboards_form?{}'.format(ids[1:]))

    @expose('/export_dashboards_form')
    def download_dashboards(self):
        if request.args.get('action') == 'go':
            ids = request.args.getlist('id')
            return Response(
                models.Dashboard.export_dashboards(ids),
                headers=generate_download_headers('json'),
                mimetype='application/text')
        return self.render_template(
            'superset/export_dashboards.html',
            dashboards_url='/dashboardmodelview/list',
        )


appbuilder.add_view(
    DashboardModelView,
    'Dashboards',
    label=__('Dashboards'),
    icon='fa-dashboard',
    category='',
    category_icon='')


class DashboardModelViewAsync(DashboardModelView):  # noqa
    list_columns = [
        'id', 'dashboard_link', 'creator', 'modified', 'dashboard_title',
        'changed_on', 'url', 'changed_by_name', 'top_category', 'sub_category', 'sub_sub_category',
        'sub_sub_category_priority', 'dashboard_priority',
    ]
    label_columns = {
        'dashboard_link': _('Dashboard'),
        'dashboard_title': _('Title'),
        'creator': _('Creator'),
        'modified': _('Modified'),
        'top_category': _('Top Category'),
        'sub_category': _('Sub Category'),
        'sub_sub_category': _('Sub Sub Category'),
        'sub_sub_category_priority': _('Sub Sub Category Priority'),
        'dashboard_priority': _('Dashboard Priority'),
    }

    @expose('/api/read', methods=['GET'])
    def api_read(self):
        from flask_appbuilder.urltools import get_order_args, get_page_args, get_page_size_args, get_filter_args
        """
        """
        # Get arguments for ordering
        if get_order_args().get(self.__class__.__name__):
            order_column, order_direction = get_order_args().get(self.__class__.__name__)
        else:
            order_column, order_direction = '', ''
        page = get_page_args().get(self.__class__.__name__)
        page_size = get_page_size_args().get(self.__class__.__name__)
        get_filter_args(self._filters)
        joined_filters = self._filters.get_joined_filters(self._base_filters)
        count, lst = self.datamodel.query(joined_filters, order_column, order_direction, page=page, page_size=page_size)
        result = self.datamodel.get_values_json(lst, self.list_columns)
        pks = self.datamodel.get_keys(lst)

        # dash页面点击收藏图标时检查当前用户是否有权限覆盖slice_id参数
        can_overwrite = False
        slice_id = request.args.get('slice_id')
        if slice_id:
            try:
                slice_obj = db.session.query(models.Slice).filter_by(id=slice_id).first()
                if slice_obj:
                    can_overwrite = slice_obj.owners and g.user in slice_obj.owners
            except Exception:
                can_overwrite = False

        ret_json = jsonify(label_columns=self._label_columns_json(),
                           list_columns=self.list_columns,
                           order_columns=self.order_columns,
                           page=page,
                           page_size=page_size,
                           count=count,
                           modelview_name=self.__class__.__name__,
                           pks=pks,
                           result=result,
                           can_overwrite=can_overwrite)
        response = make_response(ret_json, 200)
        response.headers['Content-Type'] = "application/json"
        return response

    # use for get model list.
    @expose('/api/get_dashboard_list', methods=['GET'])
    def get_dashboards_list(self):
        print('----进入get_dashboards_list------', datetime.now())
        # 这里返回的列表是提供给初始化 上方和左方的用户导航用，不需要去按照用户设置的条件过滤
        self._filters.clear_filters()
        joined_filters = self._filters.get_joined_filters(self._base_filters)
        order_column = 'id'
        order_direction = 'asc'
        print('----开始执行 dashboard 过滤查询------', datetime.now())
        # ``SQLAInterface.query`` always executes ``query_count`` before loading
        # the rows.  The navigation endpoint never uses that count and, for a
        # regular user, both statements repeat the dashboard-slice permission
        # aggregation in ``DashboardFilter``.  Apply the filters and ordering
        # directly so this endpoint performs one database query only.
        query = self.datamodel.session.query(models.Dashboard)
        query = self.datamodel.apply_all(
            query, joined_filters, order_column, order_direction)

        # ``gen_top_category`` reads the complete category hierarchy for every
        # dashboard.  Load that many-to-one chain with the list query to avoid
        # issuing lazy-load statements while building the navigation structure.
        query = query.options(
            load_only(
                models.Dashboard.id,
                models.Dashboard.slug,
                models.Dashboard.json_metadata,
                models.Dashboard.dashboard_type,
                models.Dashboard.created_by_fk,
                models.Dashboard.dashboard_title,
                models.Dashboard.dashboard_priority,
                models.Dashboard.category_id,
            ),
            joinedload(models.Dashboard.categorys)
            .load_only(
                models.ThirdCategory.id,
                models.ThirdCategory.category_name,
                models.ThirdCategory.list_order,
                models.ThirdCategory.parent_id,
            )
            .joinedload(models.ThirdCategory.second_category)
            .load_only(
                models.SecondCategory.id,
                models.SecondCategory.category_name,
                models.SecondCategory.parent_id,
                models.SecondCategory.list_order,
            )
            .joinedload(models.SecondCategory.top_category)
            .load_only(
                models.TopCategory.id,
                models.TopCategory.category_name,
                models.TopCategory.list_order,
            )
        )
        lst = query.all()
        print('----执行完成，出去get_dashboards_list------', datetime.now())
        return lst

    @expose('/api/get_latest_dashboards_url', methods=['GET'])
    def get_latest_dashboards_url(self):
        if config.get('HOME_PAGE'):
            if 'only_show_dashboards_test' not in [x.name for x in g.user.roles]:
                return config.get('HOME_PAGE')
        if g.user.home_dash_id:
            return '/superset/dashboard/{0}/'.format(str(g.user.home_dash_id))
        lst = self.get_dashboards_list()
        if len(lst):
            return lst[0].url
        return '/superset/profile/{0}/'.format(g.user.username)

    @expose('/api/get_category_df', methods=['GET'])
    def get_category_df(self):
        print('----进入get_category_df------', datetime.now())
        origin_lst = self.get_dashboards_list()
        print('---get_dashboards_list 执行结束-------', datetime.now())

        def extract_dashboard_data(dashboard):
            categorys = dashboard.categorys
            second_category = categorys.second_category if categorys else None
            top_category = second_category.top_category if second_category else None

            return [
                dashboard.id,
                dashboard.url,
                dashboard.dashboard_type,
                dashboard.created_by_fk,
                categorys.category_name if categorys else None,
                categorys.list_order if categorys else None,
                dashboard.dashboard_title,
                dashboard.dashboard_priority,
                second_category.category_name if second_category else None,
                top_category.category_name if top_category else None,
            ]

        # 使用列表推导式替代for循环+append，性能更优
        lst_dash = [extract_dashboard_data(x) for x in origin_lst]
        columns = ['dashboard_id', 'url', 'dashboard_type', 'created_by_fk', 'sub_sub_category',
                   'sub_sub_category_priority', 'dashboard_title', 'dashboard_priority', 'sub_category', 'top_category']
        df_dash_self = pd.DataFrame(lst_dash, columns=columns)
        df_dash_self['dashboard_priority'].fillna(999, inplace=True)
        df_dash_self['sub_sub_category_priority'].fillna(999, inplace=True)
        df_dash_self[['sub_sub_category', 'sub_category', 'top_category']] = df_dash_self[
            ['sub_sub_category', 'sub_category', 'top_category']].replace('', 'Unknown').fillna('Unknown')
        print('----出去 get_category_df------', datetime.now())
        return df_dash_self


appbuilder.add_view_no_menu(DashboardModelViewAsync)


class DashboardAddView(DashboardModelView):  # noqa
    list_columns = [
        'id', 'dashboard_link', 'creator', 'modified', 'dashboard_title',
        'changed_on', 'url', 'changed_by_name',
    ]
    show_columns = list(set(DashboardModelView.edit_columns + list_columns))


appbuilder.add_view_no_menu(DashboardAddView)


class LogModelView(SupersetModelView):
    datamodel = SQLAInterface(models.Log)
    list_columns = ('user', 'action', 'dttm')
    edit_columns = ('user', 'action', 'dttm', 'json')
    base_order = ('dttm', 'desc')
    label_columns = {
        'user': _('User'),
        'action': _('Action'),
        'dttm': _('dttm'),
        'json': _('JSON'),
    }


appbuilder.add_view(
    LogModelView,
    'Action Log',
    label=__('Action Log'),
    category='Security',
    category_label=__('Security'),
    icon='fa-list-ol')


@app.route('/health')
def health():
    return 'OK'


@app.route('/healthcheck')
def healthcheck():
    return 'OK'


@app.route('/ping')
def ping():
    return 'OK'


class KV(BaseSupersetView):
    """Used for storing and retrieving key value pairs"""

    @log_this
    @expose('/store/', methods=['POST'])
    def store(self):
        try:
            value = request.form.get('data')
            obj = models.KeyValue(value=value)
            db.session.add(obj)
            db.session.commit()
        except Exception as e:
            return json_error_response(e)
        return Response(
            json.dumps({'id': obj.id}),
            status=200)

    @log_this
    @expose('/<key_id>/', methods=['GET'])
    def get_value(self, key_id):
        kv = None
        try:
            kv = db.session.query(models.KeyValue).filter_by(id=key_id).one()
        except Exception as e:
            return json_error_response(e)
        return Response(kv.value, status=200)


appbuilder.add_view_no_menu(KV)


class R(BaseSupersetView):
    """used for short urls"""

    @log_this
    @expose('/<url_id>')
    def index(self, url_id):
        url = db.session.query(models.Url).filter_by(id=url_id).first()
        if url:
            return redirect('/' + url.url)
        else:
            flash('URL to nowhere...', 'danger')
            return redirect('/')

    @log_this
    @expose('/shortner/', methods=['POST', 'GET'])
    def shortner(self):
        url = request.form.get('data')
        directory = url.split('?')[0][2:]
        obj = models.Url(url=url)
        db.session.add(obj)
        db.session.commit()
        return ('http://{request.headers[Host]}/{directory}?r={obj.id}'.format(
            request=request, directory=directory, obj=obj))

    @expose('/msg/')
    def msg(self):
        """Redirects to specified url while flash a message"""
        flash(Markup(request.args.get('msg')), 'info')
        return redirect(request.args.get('url'))


appbuilder.add_view_no_menu(R)


class Superset(BaseSupersetView):
    """The base views for Superset!"""

    def json_response(self, obj, status=200):
        return Response(
            json.dumps(obj, default=utils.json_int_dttm_ser),
            status=status,
            mimetype='application/json')

    @has_access_api
    @expose('/datasources/')
    def datasources(self):
        datasources = ConnectorRegistry.get_all_datasources(db.session)
        datasources = [o.short_data for o in datasources]
        datasources = sorted(datasources, key=lambda o: o['name'])
        return self.json_response(datasources)

    @has_access_api
    @expose('/override_role_permissions/', methods=['POST'])
    def override_role_permissions(self):
        """Updates the role with the give datasource permissions.

          Permissions not in the request will be revoked. This endpoint should
          be available to admins only. Expects JSON in the format:
           {
            'role_name': '{role_name}',
            'database': [{
                'datasource_type': '{table|druid}',
                'name': '{database_name}',
                'schema': [{
                    'name': '{schema_name}',
                    'datasources': ['{datasource name}, {datasource name}']
                }]
            }]
        }
        """
        data = request.get_json(force=True)
        role_name = data['role_name']
        databases = data['database']

        db_ds_names = set()
        for dbs in databases:
            for schema in dbs['schema']:
                for ds_name in schema['datasources']:
                    fullname = utils.get_datasource_full_name(
                        dbs['name'], ds_name, schema=schema['name'])
                    db_ds_names.add(fullname)

        existing_datasources = ConnectorRegistry.get_all_datasources(db.session)
        datasources = [
            d for d in existing_datasources if d.full_name in db_ds_names]
        role = security_manager.find_role(role_name)
        # remove all permissions
        role.permissions = []
        # grant permissions to the list of datasources
        granted_perms = []
        for datasource in datasources:
            view_menu_perm = security_manager.find_permission_view_menu(
                view_menu_name=datasource.perm,
                permission_name='datasource_access')
            # prevent creating empty permissions
            if view_menu_perm and view_menu_perm.view_menu:
                role.permissions.append(view_menu_perm)
                granted_perms.append(view_menu_perm.view_menu.name)
        db.session.commit()
        return self.json_response({
            'granted': granted_perms,
            'requested': list(db_ds_names),
        }, status=201)

    @log_this
    @has_access
    @expose('/request_access/')
    def request_access(self):
        datasources = set()
        dashboard_id = request.args.get('dashboard_id')
        if dashboard_id:
            dash = (
                db.session.query(models.Dashboard)
                .filter_by(id=int(dashboard_id))
                .one()
            )
            datasources |= dash.datasources
        datasource_id = request.args.get('datasource_id')
        datasource_type = request.args.get('datasource_type')
        if datasource_id:
            try:
                datasource_id, datasource_type = self.datasource_info(
                    datasource_id, datasource_type, {})
            except ValueError:
                flash(INVALID_DATASOURCE_ERR, 'danger')
                return redirect('/slicemodelview/list/')
            datasource = ConnectorRegistry.get_datasource(
                datasource_type, datasource_id, db.session)
            if not datasource:
                flash(DATASOURCE_MISSING_ERR, 'danger')
                return redirect('/slicemodelview/list/')
            datasources.add(datasource)

        has_access = all(
            (
                datasource and security_manager.datasource_access(datasource)
                for datasource in datasources
            ))
        if has_access:
            return redirect('/superset/dashboard/{}'.format(dashboard_id))

        if request.args.get('action') == 'go':
            for datasource in datasources:
                access_request = DAR(
                    datasource_id=datasource.id,
                    datasource_type=datasource.type)
                db.session.add(access_request)
                db.session.commit()
            flash(__('Access was requested'), 'info')
            return redirect('/')

        return self.render_template(
            'superset/request_access.html',
            datasources=datasources,
            datasource_names=', '.join([o.name for o in datasources]),
        )

    @log_this
    @has_access
    @expose('/approve')
    def approve(self):
        def clean_fulfilled_requests(session):
            for r in session.query(DAR).all():
                datasource = ConnectorRegistry.get_datasource(
                    r.datasource_type, r.datasource_id, session)
                user = security_manager.get_user_by_id(r.created_by_fk)
                if not datasource or \
                        security_manager.datasource_access(datasource, user):
                    # datasource does not exist anymore
                    session.delete(r)
            session.commit()

        datasource_type = request.args.get('datasource_type')
        datasource_id = request.args.get('datasource_id')
        created_by_username = request.args.get('created_by')
        role_to_grant = request.args.get('role_to_grant')
        role_to_extend = request.args.get('role_to_extend')

        session = db.session
        datasource = ConnectorRegistry.get_datasource(
            datasource_type, datasource_id, session)

        if not datasource:
            flash(DATASOURCE_MISSING_ERR, 'alert')
            return json_error_response(DATASOURCE_MISSING_ERR)

        requested_by = security_manager.find_user(username=created_by_username)
        if not requested_by:
            flash(USER_MISSING_ERR, 'alert')
            return json_error_response(USER_MISSING_ERR)

        requests = (
            session.query(DAR)
            .filter(
                DAR.datasource_id == datasource_id,
                DAR.datasource_type == datasource_type,
                DAR.created_by_fk == requested_by.id)
            .all()
        )

        if not requests:
            flash(ACCESS_REQUEST_MISSING_ERR, 'alert')
            return json_error_response(ACCESS_REQUEST_MISSING_ERR)

        # check if you can approve
        if security_manager.all_datasource_access() or g.user.id == datasource.owner_id:
            # can by done by admin only
            if role_to_grant:
                role = security_manager.find_role(role_to_grant)
                requested_by.roles.append(role)
                msg = __(
                    '%(user)s was granted the role %(role)s that gives access '
                    'to the %(datasource)s',
                    user=requested_by.username,
                    role=role_to_grant,
                    datasource=datasource.full_name)
                utils.notify_user_about_perm_udate(
                    g.user, requested_by, role, datasource,
                    'email/role_granted.txt', app.config)
                flash(msg, 'info')

            if role_to_extend:
                perm_view = security_manager.find_permission_view_menu(
                    'email/datasource_access', datasource.perm)
                role = security_manager.find_role(role_to_extend)
                security_manager.add_permission_role(role, perm_view)
                msg = __('Role %(r)s was extended to provide the access to '
                         'the datasource %(ds)s', r=role_to_extend,
                         ds=datasource.full_name)
                utils.notify_user_about_perm_udate(
                    g.user, requested_by, role, datasource,
                    'email/role_extended.txt', app.config)
                flash(msg, 'info')
            clean_fulfilled_requests(session)
        else:
            flash(__('You have no permission to approve this request'),
                  'danger')
            return redirect('/accessrequestsmodelview/list/')
        for r in requests:
            session.delete(r)
        session.commit()
        return redirect('/accessrequestsmodelview/list/')

    def get_form_data(self, slice_id=None, merge_slice_form_data=True):
        """Build form data from the request and, when requested, a slice.

        Explore and slice query endpoints commonly submit only a slice ID and
        a small set of temporary overrides.  Those callers need the persisted
        slice form data as a base.  Save operations submit a complete snapshot
        instead, so they explicitly disable that merge to allow removed
        controls to stay removed.
        """
        form_data = {}
        post_data = request.form.get('form_data')
        custom_params = request.form.get('custom_params')
        if custom_params:
            custom_params = json.loads(custom_params)
        else:
            custom_params = {}
        request_args_data = request.args.get('form_data')
        # Supporting POST
        if post_data:
            form_data.update(json.loads(post_data))
        # request params can overwrite post body
        if request_args_data:
            form_data.update(json.loads(request_args_data))

        url_id = request.args.get('r')
        if url_id and merge_slice_form_data:
            saved_url = db.session.query(models.Url).filter_by(id=url_id).first()
            if saved_url:
                url_str = parse.unquote_plus(
                    saved_url.url.split('?')[1][10:], encoding='utf-8', errors=None)
                url_form_data = json.loads(url_str)
                # allow form_date in request override saved url
                url_form_data.update(form_data)
                form_data = url_form_data

        if request.args.get('viz_type'):
            # Converting old URLs
            form_data = cast_form_data(form_data)

        form_data = {
            k: v
            for k, v in form_data.items()
            if k not in FORM_DATA_KEY_BLACKLIST
        }

        # Resolve the slice for callers that need its metadata or permissions.
        # Query endpoints merge its persisted form data, while save endpoints
        # intentionally keep only the submitted snapshot.
        slice_id = form_data.get('slice_id') or slice_id
        slc = None

        if slice_id:
            slc = db.session.query(models.Slice).filter_by(id=slice_id).first()
            if merge_slice_form_data:
                slice_form_data = slc.form_data.copy()
                # allow form_data in request override slice from_data
                slice_form_data.update(form_data)
                form_data = slice_form_data

        return form_data, slc, custom_params

    def get_viz(
            self,
            slice_id=None,
            form_data=None,
            datasource_type=None,
            datasource_id=None,
            force=False,
            custom_params={}
    ):
        if slice_id:
            slc = (
                db.session.query(models.Slice)
                .filter_by(id=slice_id)
                .one()
            )
            return slc.get_viz()
        else:
            viz_type = form_data.get('viz_type', 'table')
            datasource = ConnectorRegistry.get_datasource(
                datasource_type, datasource_id, db.session)
            viz_obj = viz.viz_types[viz_type](
                datasource,
                form_data=form_data,
                force=force,
                custom_params=custom_params,
            )
            return viz_obj

    @has_access
    @expose('/slice/<slice_id>/')
    def slice(self, slice_id):
        # form_data, slc = self.get_form_data(slice_id)
        form_data_all = self.get_form_data(slice_id)
        form_data = form_data_all[0]
        endpoint = '/superset/explore/?form_data={}'.format(
            parse.quote(json.dumps(form_data)),
        )
        if request.args.get('standalone') == 'true':
            endpoint += '&standalone=true'
        return redirect(endpoint)

    def get_query_string_response(self, viz_obj):
        query = None
        try:
            query_obj = viz_obj.query_obj()
            if query_obj:
                query = viz_obj.datasource.get_query_str(query_obj)
        except Exception as e:
            logging.exception(e)
            return json_error_response(e)

        if query_obj and query_obj['prequeries']:
            query_obj['prequeries'].append(query)
            query = ';\n\n'.join(query_obj['prequeries'])
        if query:
            query += ';'
        else:
            query = 'No query.'

        return Response(
            json.dumps({
                'query': query,
                'language': viz_obj.datasource.query_language,
            }),
            status=200,
            mimetype='application/json')

    def generate_json(self, datasource_type, datasource_id, form_data,
                      csv=False, query=False, force=False, custom_params={},
                      slice_form_data=None):
        try:
            viz_obj = self.get_viz(
                datasource_type=datasource_type,
                datasource_id=datasource_id,
                form_data=form_data,
                force=force,
                custom_params=custom_params,
            )
        except Exception as e:
            logging.exception(e)
            return json_error_response(
                utils.error_msg_from_exception(e),
                stacktrace=traceback.format_exc())

        if not security_manager.datasource_access(viz_obj.datasource, g.user):
            return json_error_response(DATASOURCE_ACCESS_ERR, status=404)

        if csv:
            return CsvResponse(
                # viz_obj.get_csv(),
                viz_obj.get_excel(),
                status=200,
                headers=generate_download_headers('xlsx'),
                mimetype='application/x-xls')

        if query:
            return self.get_query_string_response(viz_obj)

        try:
            payload = viz_obj.get_payload()
        except SupersetException as se:
            logging.exception(se)
            return json_error_response(utils.error_msg_from_exception(se),
                                       status=se.status)
        except Exception as e:
            logging.exception(e)
            return json_error_response(utils.error_msg_from_exception(e))

        status = 200
        if (
                payload.get('status') == QueryStatus.FAILED or
                payload.get('error') is not None
        ):
            status = 400

        if slice_form_data is not None:
            payload['slice_form_data'] = slice_form_data

        return json_success(viz_obj.json_dumps(payload), status=status)

    @log_this
    @has_access_api
    @expose('/slice_json/<slice_id>')
    def slice_json(self, slice_id):
        try:
            # form_data, slc = self.get_form_data(slice_id)
            form_data_all = self.get_form_data(slice_id)
            form_data = form_data_all[0]
            slc = form_data_all[1]
            force = request.args.get('force') == 'true'
            datasource_type = slc.datasource.type
            datasource_id = slc.datasource.id

        except Exception as e:
            return json_error_response(
                utils.error_msg_from_exception(e),
                stacktrace=traceback.format_exc())
        return self.generate_json(datasource_type=datasource_type,
                                  datasource_id=datasource_id,
                                  form_data=form_data,
                                  force=force,
                                  slice_form_data=slc.form_data)

    @log_this
    @has_access_api
    @expose('/annotation_json/<layer_id>')
    def annotation_json(self, layer_id):
        form_data_all = self.get_form_data()
        form_data = form_data_all[0]
        form_data['layer_id'] = layer_id
        form_data['filters'] = [{'col': 'layer_id',
                                 'op': '==',
                                 'val': layer_id}]
        datasource = AnnotationDatasource()
        viz_obj = viz.viz_types['table'](
            datasource,
            form_data=form_data,
            force=False,
        )
        try:
            payload = viz_obj.get_payload()
        except Exception as e:
            logging.exception(e)
            return json_error_response(utils.error_msg_from_exception(e))
        status = 200
        if payload.get('status') == QueryStatus.FAILED:
            status = 400
        return json_success(viz_obj.json_dumps(payload), status=status)

    @csrf.exempt
    @log_this
    @has_access_api
    @expose('/explore_json/<datasource_type>/<datasource_id>/', methods=['GET', 'POST'])
    @expose('/explore_json/', methods=['GET', 'POST'])
    def explore_json(self, datasource_type=None, datasource_id=None):
        try:
            csv = request.args.get('csv') == 'true'
            query = request.args.get('query') == 'true'
            force = request.args.get('force') == 'true'
            form_data_all = self.get_form_data()
            form_data = form_data_all[0]
            custom_params = form_data_all[2]
            datasource_id, datasource_type = self.datasource_info(
                datasource_id, datasource_type, form_data)
        except Exception as e:
            logging.exception(e)
            return json_error_response(
                utils.error_msg_from_exception(e),
                stacktrace=traceback.format_exc())
        return self.generate_json(datasource_type=datasource_type,
                                  datasource_id=datasource_id,
                                  form_data=form_data,
                                  csv=csv,
                                  query=query,
                                  force=force,
                                  custom_params=custom_params)

    @has_access
    @expose('/explore_json_timetable/<slice_id>', methods=['GET', 'POST'])
    def explore_json_timetable(self, slice_id):
        try:
            form_data_all = self.get_form_data(slice_id)
            form_data = form_data_all[0]
            datasource_id, datasource_type = self.datasource_info(
                None, None, form_data)
            form_data['since'] = '2015-01-01'
            form_data['until'] = ''
            viz_obj = self.get_viz(
                datasource_type=datasource_type,
                datasource_id=datasource_id,
                form_data=form_data,
                force=False,
            )
            df_slice = viz_obj.get_df()
            values = form_data.get('metrics')[0]
            # 判断values是否为字典
            if isinstance(values, dict):
                values = values['label']
            columns = form_data.get('groupby')
            if len(columns) > 1:
                columns = [columns[1]]
            df_slice[utils.DTTM_ALIAS] = df_slice[utils.DTTM_ALIAS].apply(lambda x: x.strftime('%Y%m%d'))
            df_slice = df_slice.pivot_table(
                index=utils.DTTM_ALIAS,
                columns=columns,
                values=values)
            ret_json = df_slice.T.to_json(orient='split')
            return json_success(ret_json, )
        except Exception as e:
            logging.exception(e)
            return json_error_response(
                utils.error_msg_from_exception(e),
                stacktrace=traceback.format_exc())

    @has_access
    @expose('/save_monitor', methods=['POST'])
    def save_monitor(self):
        try:
            dashboard_id = int(request.form.get('dashboard_id'))
            slice_id = int(request.form.get('slice_id'))
            datasource_id = int(request.form.get('datasource_id'))
            viz_type = request.form.get('viz_type')
            granularity_sqla = request.form.get('granularity_sqla')
            # 如果granularity_sqla为空或者为'最新数据日期'
            if not granularity_sqla or granularity_sqla == '最新数据日期':
                granularity_sqla = '指标日期'
            warn_col = request.form.get('warn_col')
            warn_index = request.form.get('warn_index')
            metrics = request.form.get('metrics')
            warn_condition = request.form.get('warn_condition')
            warn_value = float(request.form.get('warn_value'))
            warn_cause = request.form.get('warn_cause')
            warn_phone = request.form.get('warn_phone')
            if not warn_phone:
                warn_phone = g.user.username
            create_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            expire_time = request.form.get('warnExpireDate')
            insert_sql = sqla.text("""
                INSERT INTO warn_index (
                    datasource_id, slice_id, dashboard_id, viz_type,
                    granularity_sqla, metrics, warn_col, warn_value,
                    warn_condition, warn_cause, warn_index, warn_phone,
                    username, create_time, expire_time
                ) VALUES (
                    :datasource_id, :slice_id, :dashboard_id, :viz_type,
                    :granularity_sqla, :metrics, :warn_col, :warn_value,
                    :warn_condition, :warn_cause, :warn_index, :warn_phone,
                    :username, :create_time, :expire_time
                )
            """)
            db.session.execute(insert_sql, {
                'datasource_id': datasource_id,
                'slice_id': slice_id,
                'dashboard_id': dashboard_id,
                'viz_type': viz_type,
                'granularity_sqla': granularity_sqla,
                'metrics': metrics,
                'warn_col': warn_col,
                'warn_value': warn_value,
                'warn_condition': warn_condition,
                'warn_cause': warn_cause,
                'warn_index': warn_index,
                'warn_phone': warn_phone,
                'username': g.user.username,
                'create_time': create_time,
                'expire_time': expire_time,
            })
            db.session.commit()
            return json_success(json.dumps({'errcode': 0, 'errmsg': '保存成功'}))
        except Exception as e:
            db.session.rollback()
            logging.exception(e)
            return json_error_response(
                utils.error_msg_from_exception(e),
                stacktrace=traceback.format_exc())

    @has_access
    @expose('/update_monitor/<id>', methods=['GET'])
    def update_monitor(self, id):
        try:
            read_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            update_sql = sqla.text("""
                UPDATE warn_index
                SET warn_status = :warn_status, read_time = :read_time
                WHERE id = :id
            """)
            db.session.execute(update_sql, {
                # The imported PostgreSQL column is SMALLINT (the legacy
                # MySQL schema used a tinyint-backed Boolean).
                'warn_status': 1,
                'read_time': read_time,
                'id': int(id),
            })
            db.session.commit()
            return json_success(json.dumps({'errcode': 0, 'errmsg': '更新成功'}))
        except Exception as e:
            db.session.rollback()
            logging.exception(e)
            return json_error_response(
                utils.error_msg_from_exception(e),
                stacktrace=traceback.format_exc())

    @has_access
    @expose('/update_agree', methods=['GET'])
    def update_agree(self):
        try:
            agree_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            agree_ip = get_client_ip()
            update_sql = sqla.text("""
                UPDATE ab_user
                SET agree_time = :agree_time, agree_ip = :agree_ip
                WHERE id = :id
            """)
            db.session.execute(update_sql, {
                'agree_time': agree_time,
                'agree_ip': agree_ip,
                'id': g.user.id,
            })
            db.session.commit()
            return json_success(json.dumps({'errcode': 0, 'errmsg': '更新成功'}))
        except Exception as e:
            db.session.rollback()
            logging.exception(e)
            return json_error_response(
                utils.error_msg_from_exception(e),
                stacktrace=traceback.format_exc())

    @has_access
    @expose('/save_home/<dashboard_id>', methods=['GET'])
    def save_home(self, dashboard_id):
        try:
            update_sql = sqla.text("""
                UPDATE ab_user SET home_dash_id = :dashboard_id WHERE id = :user_id
            """)
            db.session.execute(update_sql, {
                'dashboard_id': int(dashboard_id),
                'user_id': g.user.id,
            })
            db.session.commit()
            return json_success(json.dumps({'errcode': 0, 'errmsg': '设置成功'}))
        except Exception as e:
            db.session.rollback()
            logging.exception(e)
            return json_error_response(
                utils.error_msg_from_exception(e),
                stacktrace=traceback.format_exc())

    @has_access
    @expose('/fetch_monitor', methods=['GET'])
    @log_this
    def fetch_monitor(self):
        try:
            sql_qry_warn = sqla.text("""
                SELECT id, datasource_id, slice_id, dashboard_id,
                       granularity_sqla, metrics, warn_col, warn_value,
                       warn_condition, warn_index, warn_status, warn_cause
                FROM warn_index
                WHERE username = :username
                  AND expire_time > LOCALTIMESTAMP
            """)
            df_warn = pd.read_sql(
                sql_qry_warn,
                db.engine,
                params={'username': g.user.username},
            )
            df_warn_unread = df_warn[df_warn['warn_status'] == 0].copy()
            df_warn_readed = df_warn[df_warn['warn_status'] == 1].copy()
            df_warn_group = df_warn_unread.groupby(['datasource_id', 'granularity_sqla', 'metrics', 'warn_col'])
            df_warn_unread_list = []
            # 采用for循环遍历df_warn_group对象
            for keys, group_df in df_warn_group:
                datasource_id, granularity_sqla, metrics, warn_col = keys
                datasource_type = 'table'
                warn_index_tuple = tuple(set(group_df['warn_index'].tolist()))
                sql_custom_in = str(warn_index_tuple).replace(',)', ')')
                datasource = ConnectorRegistry.get_datasource(datasource_type, datasource_id, db.session)
                sql_custom = """
                SELECT t1.%s as index_name, t1.%s as index_time, t1.%s as index_value
                FROM %s t1
                INNER JOIN (
                  SELECT %s as 指标名称, MAX(%s) AS 指标时间
                  FROM %s
                  WHERE %s IN %s
                  GROUP BY %s
                ) t2 ON t1.%s = t2.指标名称 AND t1.%s = t2.指标时间   
                """ % (warn_col, granularity_sqla, metrics, datasource.table_name,
                       warn_col, granularity_sqla, datasource.table_name, warn_col,
                       sql_custom_in, warn_col, warn_col, granularity_sqla)
                df_data = datasource.query_custom_sql(sql_custom)
                df_merge = pd.merge(group_df, df_data[['index_name', 'index_value']], left_on='warn_index',
                                    right_on='index_name')
                df_warn_unread_list.append(df_merge)
            df_warn_unread_arr = []
            if len(df_warn_unread_list):
                df_warn_unread = pd.concat(df_warn_unread_list)
                df_warn_unread = df_warn_unread.query("(warn_condition == '>' and index_value > warn_value) or ("
                                                      "warn_condition == '<' and index_value < warn_value)")
                df_warn_unread_arr = df_warn_unread.to_dict(orient='records')
            df_warn_readed_arr = df_warn_readed.to_dict(orient='records')
            rtn_json = {'errcode': 0, 'errmsg': '查询成功', 'unread_list': df_warn_unread_arr,
                        'read_list': df_warn_readed_arr}
            return json_success(json.dumps(rtn_json))

        except Exception as e:
            logging.exception(e)
            return json_error_response(
                utils.error_msg_from_exception(e),
                stacktrace=traceback.format_exc())

    @has_access
    @expose('/show_top10_record/<slice_id>', methods=['POST'])
    def show_top10_record(self, slice_id):
        form_data = request.form.get('formData')
        form_data = json.loads(form_data)
        datasource_id, datasource_type = self.datasource_info(
            None, None, form_data)
        unnormal_viz_type = ['filter_box', 'filter_box_min']
        no_name_viz_type = ['echarts_stat_line', 'echarts_stat_line_2']
        try:
            # viz_obj = self.get_viz(
            #     slice_id=slice_id,
            # )
            viz_obj = self.get_viz(
                datasource_type=datasource_type,
                datasource_id=datasource_id,
                form_data=form_data,
                force=False,
            )
            viz_type = viz_obj.viz_type
            if viz_type in unnormal_viz_type:
                viz_obj.query_obj = viz_obj.filter_query_obj

            df_slice = viz_obj.get_df()
            if len(df_slice) and viz_type in no_name_viz_type:
                filters = form_data.get('filters')
                if filters:
                    for filter_obj in filters:
                        # if "指标名" in filter_obj['col'] or "品名" in filter_obj['col']:
                        index_name_col = filter_obj['col']
                        index_name_str = ""
                        if filter_obj['op'] == 'in' and len(filter_obj['val']):
                            index_name_str = filter_obj['val'][0]
                        elif filter_obj['op'] == '==' and filter_obj['val']:
                            index_name_str = filter_obj['val']
                        if index_name_col:
                            df_slice.insert(0, index_name_col, index_name_str)
                            break

            result_dict = {}
            result_dict['columns'] = df_slice.columns.tolist()
            # 检查df_slice是否包含 datetime 类型的列
            datetime_columns = [col for col in df_slice.columns if pd.api.types.is_datetime64_any_dtype(df_slice[col])]
            if datetime_columns:
                datetime_column = datetime_columns[0]
                # 获取时间列，降序排序，去重后取前10条
                datetime_column_list = sorted(set(df_slice[datetime_column]), reverse=True)[:10]
                datetime_column_value = datetime_column_list[-1]
                # df_slice 取时间列等于>=datetime_column_value的记录
                df_slice = df_slice[df_slice[datetime_column] >= datetime_column_value]
                df_slice = df_slice.sort_values(by=datetime_column, ascending=False)
            else:
                df_slice = df_slice.head(200)

            result_dict['data'] = df_slice.to_dict(orient='records')
            return json_success(json.dumps(result_dict, default=str))

        except Exception as e:
            logging.exception(e)
            return json_error_response(
                utils.error_msg_from_exception(e),
                stacktrace=traceback.format_exc())

    @log_this
    @has_access
    @expose('/import_dashboards', methods=['GET', 'POST'])
    def import_dashboards(self):
        """Overrides the dashboards using json instances from the file."""
        f = request.files.get('file')
        if request.method == 'POST' and f:
            current_tt = int(time.time())
            data = json.loads(f.stream.read(), object_hook=utils.decode_dashboards)
            # TODO: import DRUID datasources
            for table in data['datasources']:
                type(table).import_obj(table, import_time=current_tt)
            db.session.commit()
            for dashboard in data['dashboards']:
                models.Dashboard.import_obj(
                    dashboard, import_time=current_tt)
            db.session.commit()
            return redirect('/dashboardmodelview/list/')
        return self.render_template('superset/import_dashboards.html')

    @log_this
    @has_access
    @expose('/explorev2/<datasource_type>/<datasource_id>/')
    def explorev2(self, datasource_type, datasource_id):
        """Deprecated endpoint, here for backward compatibility of urls"""
        return redirect(url_for(
            'Superset.explore',
            datasource_type=datasource_type,
            datasource_id=datasource_id,
            **request.args))

    @staticmethod
    def datasource_info(datasource_id, datasource_type, form_data):
        """Compatibility layer for handling of datasource info

        datasource_id & datasource_type used to be passed in the URL
        directory, now they should come as part of the form_data,
        This function allows supporting both without duplicating code"""
        return resolve_datasource_info(
            datasource_id, datasource_type, form_data,
            ConnectorRegistry.sources)

    @log_this
    @has_access
    @expose('/explore/<datasource_type>/<datasource_id>/', methods=['GET', 'POST'])
    @expose('/explore/', methods=['GET', 'POST'])
    def explore(self, datasource_type=None, datasource_id=None):
        # form_data, slc = self.get_form_data()
        form_data_all = self.get_form_data()
        form_data = form_data_all[0]
        slc = form_data_all[1]
        error_redirect = '/slicemodelview/list/'
        try:
            datasource_id, datasource_type = self.datasource_info(
                datasource_id, datasource_type, form_data)
        except ValueError:
            logging.warning('Invalid datasource selection for explore')
            flash(INVALID_DATASOURCE_ERR, 'danger')
            return redirect(error_redirect)

        datasource = ConnectorRegistry.get_datasource(
            datasource_type, datasource_id, db.session)
        if not datasource:
            flash(DATASOURCE_MISSING_ERR, 'danger')
            return redirect(error_redirect)

        if not security_manager.datasource_access(datasource):
            if (
                    config.get('ENABLE_ACCESS_REQUEST') and
                    security_manager.can_access(
                        'can_request_access', 'Superset')):
                flash(
                    __(get_datasource_access_error_msg(datasource.name)),
                    'danger')
                return redirect(url_for(
                    'Superset.request_access',
                    datasource_type=datasource_type,
                    datasource_id=datasource_id))
            flash(DATASOURCE_ACCESS_ERR, 'danger')
            return redirect(error_redirect)

        viz_type = form_data.get('viz_type')
        if not viz_type and datasource.default_endpoint:
            return redirect(datasource.default_endpoint)

        # slc perms
        slice_add_perm = security_manager.can_access('can_add', 'SliceModelView')
        slice_overwrite_perm = is_owner(slc, g.user)
        if 'Admin' in [x.name for x in get_user_roles()]:
            slice_overwrite_perm = True
        slice_download_perm = security_manager.can_access(
            'can_download', 'SliceModelView')

        form_data['datasource'] = str(datasource_id) + '__' + datasource_type

        # On explore, merge extra filters into the form data
        merge_extra_filters(form_data)

        # merge request url params
        if request.method == 'GET':
            merge_request_params(form_data, request.args)

        # handle save or overwrite
        action = request.args.get('action')

        if action == 'overwrite' and not slice_overwrite_perm:
            return json_error_response(
                _('You don\'t have the rights to ') + _('alter this ') + _('chart'),
                status=400)

        if action == 'saveas' and not slice_add_perm:
            return json_error_response(
                _('You don\'t have the rights to ') + _('create a ') + _('chart'),
                status=400)

        if action in ('saveas', 'overwrite'):
            return self.save_or_overwrite_slice(
                request.args,
                slc, slice_add_perm,
                slice_overwrite_perm,
                slice_download_perm,
                datasource_id,
                datasource_type,
                datasource.name)

        standalone = request.args.get('standalone') == 'true'
        url_params_formdata = request.args.get('form_data') if request.args.get('form_data') else "{}"
        url_params_formdata = json.loads(url_params_formdata)
        if 'url_params' in url_params_formdata:
            url_params_dict = url_params_formdata['url_params']
            if 'standalone' in url_params_dict:
                standalone = url_params_dict['standalone'] == 'true'
                if 'url_params' not in form_data:
                    form_data['url_params'] = {'standalone': url_params_dict.get('standalone'),
                                               'height': url_params_dict.get('height')}
                else:
                    form_data['url_params']['standalone'] = url_params_dict.get('standalone')
                    form_data['url_params']['height'] = url_params_dict.get('height')

        bootstrap_data = {
            'can_add': slice_add_perm,
            'can_download': slice_download_perm,
            'can_overwrite': slice_overwrite_perm,
            'datasource': datasource.data,
            'form_data': form_data,
            'datasource_id': datasource_id,
            'datasource_type': datasource_type,
            'slice': slc.data if slc else None,
            'standalone': standalone,
            'user_id': g.user.get_id(),
            'username': g.user.username if hasattr(g.user, 'username') else None,
            'forced_height': request.args.get('height'),
            'common': self.common_bootsrap_payload(),
        }
        table_name = datasource.table_name \
            if datasource_type == 'table' \
            else datasource.datasource_name
        if slc:
            title = slc.slice_name
        else:
            title = 'Explore - ' + table_name

        # not hasattr(g.user, 'roles') 表示用户是匿名访问，使用访客模式
        if standalone or 'Admin' in [x.name for x in get_user_roles()]:
            return self.render_template(
                'superset/basic.html',
                bootstrap_data=json.dumps(bootstrap_data),
                entry='explore',
                title=title,
                standalone_mode=standalone)
        else:
            top_category_data = gen_top_category(self.appbuilder)

            return self.render_template(
                'superset/basic_for_client.html',
                bootstrap_data=json.dumps(bootstrap_data),
                entry='explore',
                title=title,
                standalone_mode=standalone,
                userId=g.user.id,
                # favorites=self.fave_dashboards(g.user.id).get_data(as_text=True),
                can_save_monitor=security_manager.can_access('can_save_monitor', 'Superset'),
                show_top10_record=security_manager.can_access('can_show_top10_record', 'Superset'),
                show_sclice=security_manager.can_access('can_add', 'SliceModelView'),
                current_top_category=top_category_data['top_category_arr_by_order'][0],
                current_sub_category=top_category_data['_sub_category'],
                top_category_lst=top_category_data['_top_category_lst_str'],
                top_category_dict=json.dumps(top_category_data['_top_category_dict']),
                second_category_list_order=json.dumps(top_category_data['second_category_list_order']),
            )

    @api
    @has_access_api
    @expose('/filter/<datasource_type>/<datasource_id>/<column>/')
    def filter(self, datasource_type, datasource_id, column):
        """
        Endpoint to retrieve values for specified column.

        :param datasource_type: Type of datasource e.g. table
        :param datasource_id: Datasource id
        :param column: Column name to retrieve values for
        :return:
        """
        # TODO: Cache endpoint by user, datasource and column
        datasource = ConnectorRegistry.get_datasource(
            datasource_type, datasource_id, db.session)
        if not datasource:
            return json_error_response(DATASOURCE_MISSING_ERR)
        if not security_manager.datasource_access(datasource):
            return json_error_response(DATASOURCE_ACCESS_ERR)

        payload = json.dumps(
            datasource.values_for_column(
                column,
                config.get('FILTER_SELECT_ROW_LIMIT', 10000),
            ),
            default=utils.json_int_dttm_ser)
        return json_success(payload)

    def save_or_overwrite_slice(
            self, args, slc, slice_add_perm, slice_overwrite_perm, slice_download_perm,
            datasource_id, datasource_type, datasource_name):
        """Save or overwrite a slice"""
        slice_name = args.get('slice_name')
        action = args.get('action')
        # Saving is replacement semantics: omitted controls must be removed,
        # rather than inherited from the persisted slice configuration.
        form_data = self.get_form_data(merge_slice_form_data=False)[0]

        if action in ('saveas'):
            if 'slice_id' in form_data:
                form_data.pop('slice_id')  # don't save old slice_id
            slc = models.Slice(owners=[g.user] if g.user else [])

        slc.params = json.dumps(form_data)
        slc.datasource_name = datasource_name
        slc.viz_type = form_data['viz_type']
        slc.datasource_type = datasource_type
        slc.datasource_id = datasource_id
        slc.slice_name = slice_name

        if action in ('saveas') and slice_add_perm:
            self.save_slice(slc)
        elif action == 'overwrite' and slice_overwrite_perm:
            self.overwrite_slice(slc)

        # Adding slice to a dashboard if requested
        dash = None
        if request.args.get('add_to_dash') == 'existing':
            dash = (
                db.session.query(models.Dashboard)
                .filter_by(id=int(request.args.get('save_to_dashboard_id')))
                .one()
            )

            # check edit dashboard permissions
            dash_overwrite_perm = check_ownership(dash, raise_if_false=False)
            if not dash_overwrite_perm:
                return json_error_response(
                    _('You don\'t have the rights to ') + _('alter this ') +
                    _('dashboard'),
                    status=400)

            flash(
                'Slice [{}] was added to dashboard [{}]'.format(
                    slc.slice_name,
                    dash.dashboard_title),
                'info')
        elif request.args.get('add_to_dash') == 'new':
            # check create dashboard permissions
            dash_add_perm = security_manager.can_access('can_add', 'DashboardModelView')
            if not dash_add_perm:
                return json_error_response(
                    _('You don\'t have the rights to ') + _('create a ') + _('dashboard'),
                    status=400)

            dash = models.Dashboard(
                dashboard_title=request.args.get('new_dashboard_name'),
                owners=[g.user] if g.user else [])
            flash(
                'Dashboard [{}] just got created and slice [{}] was added '
                'to it'.format(
                    dash.dashboard_title,
                    slc.slice_name),
                'info')

        if dash and slc not in dash.slices:
            dash.slices.append(slc)
            db.session.commit()

        response = {
            'can_add': slice_add_perm,
            'can_download': slice_download_perm,
            'can_overwrite': is_owner(slc, g.user),
            'form_data': slc.form_data,
            'slice': slc.data,
        }

        if request.args.get('goto_dash') == 'true':
            response.update({'dashboard': dash.url})

        return json_success(json.dumps(response))

    def save_slice(self, slc):
        session = db.session()
        msg = 'Slice [{}] has been saved'.format(slc.slice_name)
        session.add(slc)
        session.commit()
        flash(msg, 'info')

    def overwrite_slice(self, slc):
        session = db.session()
        session.merge(slc)
        session.commit()
        msg = 'Slice [{}] has been overwritten'.format(slc.slice_name)
        flash(msg, 'info')

    @api
    @has_access_api
    @expose('/checkbox/<model_view>/<id_>/<attr>/<value>', methods=['GET'])
    def checkbox(self, model_view, id_, attr, value):
        """endpoint for checking/unchecking any boolean in a sqla model"""
        modelview_to_model = {
            'TableColumnInlineView':
                ConnectorRegistry.sources['table'].column_class,
            'DruidColumnInlineView':
                ConnectorRegistry.sources['druid'].column_class,
        }
        model = modelview_to_model[model_view]
        col = db.session.query(model).filter_by(id=id_).first()
        checked = value == 'true'
        if col:
            setattr(col, attr, checked)
            if checked:
                metrics = col.get_metrics().values()
                col.datasource.add_missing_metrics(metrics)
            db.session.commit()
        return json_success('OK')

    @api
    @has_access_api
    @expose('/schemas/<db_id>/')
    def schemas(self, db_id):
        db_id = int(db_id)
        database = (
            db.session
            .query(models.Database)
            .filter_by(id=db_id)
            .one()
        )
        schemas = database.all_schema_names()
        schemas = security_manager.schemas_accessible_by_user(database, schemas)
        return Response(
            json.dumps({'schemas': schemas}),
            mimetype='application/json')

    @api
    @has_access_api
    @expose('/tables/<db_id>/<schema>/<substr>/')
    def tables(self, db_id, schema, substr):
        """Endpoint to fetch the list of tables for given database"""
        db_id = int(db_id)
        schema = utils.js_string_to_python(schema)
        substr = utils.js_string_to_python(substr)
        database = db.session.query(models.Database).filter_by(id=db_id).one()
        table_names = security_manager.accessible_by_user(
            database, database.all_table_names(schema), schema)
        view_names = security_manager.accessible_by_user(
            database, database.all_view_names(schema), schema)

        if substr:
            table_names = [tn for tn in table_names if substr in tn]
            view_names = [vn for vn in view_names if substr in vn]

        max_items = config.get('MAX_TABLE_NAMES') or len(table_names)
        total_items = len(table_names) + len(view_names)
        max_tables = len(table_names)
        max_views = len(view_names)
        if total_items and substr:
            max_tables = max_items * len(table_names) // total_items
            max_views = max_items * len(view_names) // total_items

        table_options = [{'value': tn, 'label': tn}
                         for tn in table_names[:max_tables]]
        table_options.extend([{'value': vn, 'label': '[view] {}'.format(vn)}
                              for vn in view_names[:max_views]])
        payload = {
            'tableLength': len(table_names) + len(view_names),
            'options': table_options,
        }
        return json_success(json.dumps(payload))

    @api
    @has_access_api
    @expose('/copy_dash/<dashboard_id>/', methods=['GET', 'POST'])
    def copy_dash(self, dashboard_id):
        """Copy dashboard"""
        session = db.session()
        data = json.loads(request.form.get('data'))
        dash = models.Dashboard()
        original_dash = (
            session
            .query(models.Dashboard)
            .filter_by(id=dashboard_id).first())

        dash.owners = [g.user] if g.user else []
        dash.dashboard_title = data['dashboard_title']
        if data['duplicate_slices']:
            # Duplicating slices as well, mapping old ids to new ones
            old_to_new_sliceids = {}
            for slc in original_dash.slices:
                new_slice = slc.clone()
                new_slice.owners = [g.user] if g.user else []
                session.add(new_slice)
                session.flush()
                new_slice.dashboards.append(dash)
                old_to_new_sliceids['{}'.format(slc.id)] = \
                    '{}'.format(new_slice.id)
            for d in data['positions']:
                d['slice_id'] = old_to_new_sliceids[d['slice_id']]
        else:
            dash.slices = original_dash.slices
        dash.params = original_dash.params
        dash.top_category = original_dash.top_category
        dash.sub_category = original_dash.sub_category
        dash.sub_sub_category = original_dash.sub_sub_category
        dash.sub_sub_category_priority = original_dash.sub_sub_category_priority
        dash.dashboard_priority = original_dash.dashboard_priority

        self._set_dash_metadata(dash, data)
        session.add(dash)
        session.commit()
        dash_json = json.dumps(dash.data)
        session.close()
        return json_success(dash_json)

    @api
    @has_access_api
    @expose('/save_dash/<dashboard_id>/', methods=['GET', 'POST'])
    def save_dash(self, dashboard_id):
        """Save a dashboard's metadata"""
        session = db.session()
        dash = (session
                .query(models.Dashboard)
                .filter_by(id=dashboard_id).first())
        check_ownership(dash, raise_if_false=True)
        data = json.loads(request.form.get('data'))
        self._set_dash_metadata(dash, data)
        session.merge(dash)
        session.commit()
        session.close()
        return 'SUCCESS'

    @staticmethod
    def _set_dash_metadata(dashboard, data):
        positions = data['positions']
        slice_ids = [int(d['slice_id']) for d in positions]
        dashboard.slices = [o for o in dashboard.slices if o.id in slice_ids]
        positions = sorted(data['positions'], key=lambda x: int(x['slice_id']))
        dashboard.position_json = json.dumps(positions, indent=4, sort_keys=True)
        md = dashboard.params_dict
        dashboard.css = data['css']
        dashboard.dashboard_title = data['dashboard_title']

        if 'filter_immune_slices' not in md:
            md['filter_immune_slices'] = []
        if 'timed_refresh_immune_slices' not in md:
            md['timed_refresh_immune_slices'] = []
        if 'filter_immune_slice_fields' not in md:
            md['filter_immune_slice_fields'] = {}
        md['expanded_slices'] = data['expanded_slices']
        md['default_filters'] = data.get('default_filters', '')
        dashboard.json_metadata = json.dumps(md, indent=4)

    @api
    @has_access_api
    @expose('/add_slices/<dashboard_id>/', methods=['POST'])
    def add_slices(self, dashboard_id):
        """Add and save slices to a dashboard"""
        data = json.loads(request.form.get('data'))
        session = db.session()
        Slice = models.Slice  # noqa
        dash = (
            session.query(models.Dashboard).filter_by(id=dashboard_id).first())
        check_ownership(dash, raise_if_false=True)
        new_slices = session.query(Slice).filter(
            Slice.id.in_(data['slice_ids']))
        dash.slices += new_slices
        session.merge(dash)
        session.commit()
        session.close()
        return 'SLICES ADDED'

    @api
    @has_access_api
    @expose('/testconn', methods=['POST', 'GET'])
    def testconn(self):
        """Tests a sqla connection"""
        try:
            username = g.user.username if g.user is not None else None
            uri = request.json.get('uri')
            db_name = request.json.get('name')
            impersonate_user = request.json.get('impersonate_user')
            database = None
            if db_name:
                database = (
                    db.session
                    .query(models.Database)
                    .filter_by(database_name=db_name)
                    .first()
                )
                if database and uri == database.safe_sqlalchemy_uri():
                    # the password-masked uri was passed
                    # use the URI associated with this database
                    uri = database.sqlalchemy_uri_decrypted

            uri = normalize_sqlalchemy_uri(uri.strip())

            configuration = {}

            if database and uri:
                url = make_url(uri)
                db_engine = models.Database.get_db_engine_spec_for_backend(
                    url.get_backend_name())
                db_engine.patch()

                masked_url = database.get_password_masked_url_from_uri(uri)
                logging.info('Superset.testconn(). Masked URL: {0}'.format(masked_url))

                configuration.update(
                    db_engine.get_configuration_for_impersonation(uri,
                                                                  impersonate_user,
                                                                  username),
                )

            connect_args = (
                request.json
                .get('extras', {})
                .get('engine_params', {})
                .get('connect_args', {}))

            if configuration:
                connect_args['configuration'] = configuration

            engine = create_engine(uri, connect_args=connect_args)
            engine.connect()
            return json_success(json.dumps(engine.table_names(), indent=4))
        except Exception as e:
            logging.exception(e)
            return json_error_response((
                                           'Connection failed!\n\n'
                                           'The error message returned was:\n{}').format(e))

    @api
    @has_access_api
    @expose('/recent_activity/<user_id>/', methods=['GET'])
    def recent_activity(self, user_id):
        """Recent activity (actions) for a given user"""
        M = models  # noqa

        if request.args.get('limit'):
            limit = int(request.args.get('limit'))
        else:
            limit = 1000

        qry = (
            db.session.query(M.Log, M.Dashboard, M.Slice)
            .outerjoin(
                M.Dashboard,
                M.Dashboard.id == M.Log.dashboard_id,
            )
            .outerjoin(
                M.Slice,
                M.Slice.id == M.Log.slice_id,
            )
            .filter(
                sqla.and_(
                    ~M.Log.action.in_(('queries', 'shortner', 'sql_json')),
                    M.Log.user_id == user_id,
                ),
            )
            .order_by(M.Log.dttm.desc())
            .limit(limit)
        )
        payload = []
        for log in qry.all():
            item_url = None
            item_title = None
            if log.Dashboard:
                item_url = log.Dashboard.url
                item_title = log.Dashboard.dashboard_title
            elif log.Slice:
                item_url = log.Slice.slice_url
                item_title = log.Slice.slice_name

            payload.append({
                'action': log.Log.action,
                'item_url': item_url,
                'item_title': item_title,
                'time': log.Log.dttm,
            })
        return json_success(
            json.dumps(payload, default=utils.json_int_dttm_ser))

    @api
    @has_access_api
    @expose('/csrf_token/', methods=['GET'])
    def csrf_token(self):
        return Response(
            self.render_template('superset/csrf_token.json'),
            mimetype='text/json',
        )

    @api
    @has_access_api
    @expose('/fave_dashboards_by_username/<username>/', methods=['GET'])
    def fave_dashboards_by_username(self, username):
        """This lets us use a user's username to pull favourite dashboards"""
        user = security_manager.find_user(username=username)
        return self.fave_dashboards(user.get_id())

    @api
    @has_access_api
    @expose('/fave_dashboards/<user_id>/', methods=['GET'])
    def fave_dashboards(self, user_id):
        dashboard_slices = models.dashboard_slices

        qry_with_category = (
            db.session.query(
                models.Dashboard,
                models.FavStar.dttm,
                models.SecondCategory.category_name.label("category_name_second"),
            )
            .join(
                models.FavStar,
                sqla.and_(
                    models.Dashboard.id == models.FavStar.obj_id,
                ),
            ).join(
                models.ThirdCategory,
                sqla.and_(
                    models.Dashboard.category_id == models.ThirdCategory.id,
                ),
            ).join(
                models.SecondCategory,
                sqla.and_(
                    models.ThirdCategory.parent_id == models.SecondCategory.id,
                ),
            ).join(
                dashboard_slices,
                sqla.and_(
                    models.Dashboard.id == dashboard_slices.c.dashboard_id,
                ),
            ).filter(models.FavStar.user_id == int(user_id),
                     models.FavStar.class_name == 'Dashboard', )
        )

        qry_private = (
            db.session.query(
                models.Dashboard,
                models.FavStar.dttm,
                sqla.literal('收藏').label("category_name_second"),
            )
            .join(
                models.FavStar,
                sqla.and_(
                    models.Dashboard.id == models.FavStar.obj_id,
                ),
            ).join(
                dashboard_slices,
                sqla.and_(
                    models.Dashboard.id == dashboard_slices.c.dashboard_id,
                ),
            ).filter(models.FavStar.user_id == int(user_id),
                     models.FavStar.class_name == 'Dashboard',
                     models.Dashboard.dashboard_type == 'private')
        )

        qry = qry_with_category.union(qry_private).order_by(
            models.FavStar.dttm.desc(),
        )

        # # 获取绑定参数
        # params = qry.statement.compile().params
        # # 获取 SQL 语句并替换占位符
        # sql_statement = str(qry.statement.compile(compile_kwargs={"literal_binds": True}))
        # print(sql_statement)

        payload = []
        for o in qry.all():
            d = {
                'id': o.Dashboard.id,
                'dashboard': o.Dashboard.dashboard_link(),
                'title': o.Dashboard.dashboard_title,
                'url': o.Dashboard.url,
                'dttm': o.dttm,
                'second_menu': o.category_name_second,
            }
            if o.Dashboard.created_by:
                user = o.Dashboard.created_by
                d['creator'] = str(user)
                d['creator_url'] = '/superset/profile/{}/'.format(
                    user.username)
            payload.append(d)
        return json_success(
            json.dumps(payload, default=utils.json_int_dttm_ser))

    @api
    @has_access_api
    @expose('/created_dashboards/<user_id>/', methods=['GET'])
    def created_dashboards(self, user_id):
        Dash = models.Dashboard  # noqa
        qry = (
            db.session.query(
                Dash,
            )
            .filter(
                sqla.or_(
                    Dash.created_by_fk == user_id,
                    Dash.changed_by_fk == user_id,
                ),
            )
            .order_by(
                Dash.changed_on.desc(),
            )
        )
        payload = [{
            'id': o.id,
            'dashboard': o.dashboard_link(),
            'title': o.dashboard_title,
            'url': o.url,
            'dttm': o.changed_on,
        } for o in qry.all()]
        return json_success(
            json.dumps(payload, default=utils.json_int_dttm_ser))

    @api
    @has_access_api
    @expose('/user_slices', methods=['GET'])
    @expose('/user_slices/<user_id>/', methods=['GET'])
    def user_slices(self, user_id=None):
        """List of slices a user created, or faved"""
        if not user_id:
            user_id = g.user.id
        Slice = models.Slice  # noqa
        FavStar = models.FavStar  # noqa
        qry = (
            db.session.query(Slice,
                             FavStar.dttm).join(
                models.FavStar,
                sqla.and_(
                    models.FavStar.user_id == int(user_id),
                    models.FavStar.class_name == 'slice',
                    models.Slice.id == models.FavStar.obj_id,
                ),
                isouter=True).filter(
                sqla.or_(
                    Slice.created_by_fk == user_id,
                    Slice.changed_by_fk == user_id,
                    FavStar.user_id == user_id,
                ),
            )
            .order_by(Slice.slice_name.asc())
        )
        payload = [{
            'id': o.Slice.id,
            'title': o.Slice.slice_name,
            'url': o.Slice.slice_url,
            'data': o.Slice.form_data,
            'dttm': o.dttm if o.dttm else o.Slice.changed_on,
            'viz_type': o.Slice.viz_type,
        } for o in qry.all()]
        return json_success(
            json.dumps(payload, default=utils.json_int_dttm_ser))

    @api
    @has_access_api
    @expose('/created_slices', methods=['GET'])
    @expose('/created_slices/<user_id>/', methods=['GET'])
    def created_slices(self, user_id=None):
        """List of slices created by this user"""
        if not user_id:
            user_id = g.user.id
        Slice = models.Slice  # noqa
        qry = (
            db.session.query(Slice)
            .filter(
                sqla.or_(
                    Slice.created_by_fk == user_id,
                    Slice.changed_by_fk == user_id,
                ),
            )
            .order_by(Slice.changed_on.desc())
        )
        payload = [{
            'id': o.id,
            'title': o.slice_name,
            'url': o.slice_url,
            'dttm': o.changed_on,
            'viz_type': o.viz_type,
        } for o in qry.all()]
        return json_success(
            json.dumps(payload, default=utils.json_int_dttm_ser))

    @api
    @has_access_api
    @expose('/fave_slices', methods=['GET'])
    @expose('/fave_slices/<user_id>/', methods=['GET'])
    def fave_slices(self, user_id=None):
        """Favorite slices for a user"""
        if not user_id:
            user_id = g.user.id
        qry = (
            db.session.query(
                models.Slice,
                models.FavStar.dttm,
            )
            .join(
                models.FavStar,
                sqla.and_(
                    models.FavStar.user_id == int(user_id),
                    models.FavStar.class_name == 'slice',
                    models.Slice.id == models.FavStar.obj_id,
                ),
            )
            .order_by(
                models.FavStar.dttm.desc(),
            )
        )
        payload = []
        for o in qry.all():
            d = {
                'id': o.Slice.id,
                'title': o.Slice.slice_name,
                'url': o.Slice.slice_url,
                'dttm': o.dttm,
                'viz_type': o.Slice.viz_type,
            }
            if o.Slice.created_by:
                user = o.Slice.created_by
                d['creator'] = str(user)
                d['creator_url'] = '/superset/profile/{}/'.format(
                    user.username)
            payload.append(d)
        return json_success(
            json.dumps(payload, default=utils.json_int_dttm_ser))

    @api
    @has_access_api
    @expose('/warm_up_cache/', methods=['GET'])
    def warm_up_cache(self):
        """Warms up the cache for the slice or table.

        Note for slices a force refresh occurs.
        """
        slices = None
        session = db.session()
        slice_id = request.args.get('slice_id')
        table_name = request.args.get('table_name')
        db_name = request.args.get('db_name')

        if not slice_id and not (table_name and db_name):
            return json_error_response(__(
                'Malformed request. slice_id or table_name and db_name '
                'arguments are expected'), status=400)
        if slice_id:
            slices = session.query(models.Slice).filter_by(id=slice_id).all()
            if not slices:
                return json_error_response(__(
                    'Slice %(id)s not found', id=slice_id), status=404)
        elif table_name and db_name:
            SqlaTable = ConnectorRegistry.sources['table']
            table = (
                session.query(SqlaTable)
                .join(models.Database)
                .filter(
                    models.Database.database_name == db_name or
                    SqlaTable.table_name == table_name)
            ).first()
            if not table:
                return json_error_response(__(
                    "Table %(t)s wasn't found in the database %(d)s",
                    t=table_name, s=db_name), status=404)
            slices = session.query(models.Slice).filter_by(
                datasource_id=table.id,
                datasource_type=table.type).all()

        for slc in slices:
            try:
                obj = slc.get_viz(force=True)
                obj.get_json()
            except Exception as e:
                return json_error_response(utils.error_msg_from_exception(e))
        return json_success(json.dumps(
            [{'slice_id': slc.id, 'slice_name': slc.slice_name}
             for slc in slices]))

    @expose('/favstar/<class_name>/<obj_id>/<action>/')
    def favstar(self, class_name, obj_id, action):
        """Toggle favorite stars on Slices and Dashboard"""
        session = db.session()
        FavStar = models.FavStar  # noqa
        count = 0
        favs = session.query(FavStar).filter_by(
            class_name=class_name, obj_id=obj_id,
            user_id=g.user.get_id()).all()
        if action == 'select':
            if not favs:
                session.add(
                    FavStar(
                        class_name=class_name,
                        obj_id=obj_id,
                        user_id=g.user.get_id(),
                        dttm=datetime.now(),
                    ),
                )
            count = 1
        elif action == 'unselect':
            for fav in favs:
                session.delete(fav)
        else:
            count = len(favs)
        session.commit()
        return json_success(json.dumps({'count': count}))

    # @has_access
    @has_access_custom
    @expose('/dashboard/<dashboard_id>/')
    def dashboard(self, dashboard_id):
        """Server side rendering for a dashboard"""
        print('-----def dashboard(self, dashboard_id)-----', datetime.now())
        standalone_mode = False
        standalone_token = request.args.get('standalone_token')
        if standalone_token == config.get('STANDALONE_TOKEN'):
            standalone_mode = True
        session = db.session()
        qry = session.query(models.Dashboard)
        if dashboard_id.isdigit():
            qry = qry.filter_by(id=int(dashboard_id))
        else:
            qry = qry.filter_by(slug=dashboard_id)

        dash = qry.one()
        datasources = set()
        for slc in dash.slices:
            datasource = slc.datasource
            if datasource:
                datasources.add(datasource)
        if config.get('ENABLE_ACCESS_REQUEST'):
            for datasource in datasources:
                if datasource and not security_manager.datasource_access(datasource):
                    flash(
                        __(get_datasource_access_error_msg(datasource.name)),
                        'danger')
                    return redirect(url_for(
                        'Superset.request_access', dashboard_id=dash.id))

        # Hack to log the dashboard_id properly, even when getting a slug
        @log_this
        def dashboard(**kwargs):  # noqa
            pass

        dashboard(dashboard_id=dash.id)
        dash_edit_perm = check_ownership(dash, raise_if_false=False)
        dash_save_perm = \
            dash_edit_perm and security_manager.can_access('can_save_dash', 'Superset')

        # standalone_mode = request.args.get('standalone') == 'true'

        slice_explore_perm = security_manager.can_access('can_explore', 'Superset')

        dashboard_data = dash.data
        dashboard_data.update({
            'standalone_mode': standalone_mode,
            'dash_save_perm': dash_save_perm,
            'dash_edit_perm': dash_edit_perm,
            'slice_explore_perm': slice_explore_perm,
            'dashboard_type': dash.dashboard_type,
        })

        if standalone_mode:
            roles_name = ['iframe']
        else:
            if not hasattr(g.user, 'roles'):
                return redirect(appbuilder.get_url_for_login)
            roles_name = [x.name for x in get_user_roles()]
        bootstrap_data = {
            'user_id': g.user.get_id(),
            'username': g.user.username if hasattr(g.user, 'username') else None,
            'expire_date': g.user.expire_date.isoformat() if hasattr(g.user,
                                                                     'username') and g.user.expire_date else None,
            'agree_time': g.user.agree_time.isoformat() if hasattr(g.user,
                                                                   'agree_time') and g.user.agree_time else None,
            'water_mark': config.get('WATER_MARK'),
            'no_water_mark_user': config.get('NO_WATER_MARK_USER_LIST'),
            'dashboard_data': dashboard_data,
            'datasources': {ds.uid: ds.data for ds in datasources},
            'common': self.common_bootsrap_payload(),
            'editMode': request.args.get('edit') == 'true',
            'can_exportCsv': True if 'Admin' in roles_name or 'exportCsv' in roles_name else False,
            'can_save_monitor': security_manager.can_access('can_save_monitor', 'Superset'),
            'show_top10_record': security_manager.can_access('can_show_top10_record', 'Superset'),
            'show_sclice': security_manager.can_access('can_add', 'SliceModelView'),
        }

        if request.args.get('json') == 'true':
            return json_success(json.dumps(bootstrap_data))

        if 'Admin' in roles_name or 'iframe' in roles_name:
            return self.render_template(
                'superset/dashboard.html',
                entry='dashboard',
                standalone_mode=standalone_mode,
                title=dash.dashboard_title,
                bootstrap_data=json.dumps(bootstrap_data),
            )
        else:
            print('-------非admin-------', datetime.now())
            # _top_category_arr, _top_category_lst, _sub_category, _top_category_dict, second_category_list_order, _ \
            top_category_data = gen_top_category(self.appbuilder)
            current_top_category = "Unknown"
            current_sub_category = "Unknown"
            if dash.categorys:
                current_top_category = dash.categorys.second_category.top_category.category_name
                current_sub_category = dash.categorys.second_category.category_name
            else:
                if dash.dashboard_type == 'private':
                    current_top_category = top_category_data['top_category_arr_by_order'][0]
                    current_sub_category = top_category_data['second_category_list_order'][current_top_category][0]

            return self.render_template(
                'superset/dashboard_for_client.html',
                entry='dashboard',
                standalone_mode=standalone_mode,
                title=dash.dashboard_title,
                bootstrap_data=json.dumps(bootstrap_data),
                userId=g.user.id,
                # favorites=self.fave_dashboards(g.user.id).get_data(as_text=True),
                can_save_monitor=security_manager.can_access('can_save_monitor', 'Superset'),
                show_top10_record=security_manager.can_access('can_show_top10_record', 'Superset'),
                show_sclice=security_manager.can_access('can_add', 'SliceModelView'),
                current_top_category=current_top_category,
                current_sub_category=current_sub_category,
                top_category_lst=top_category_data['_top_category_lst_str'],
                top_category_dict=json.dumps(top_category_data['_top_category_dict']),
                second_category_list_order=json.dumps(top_category_data['second_category_list_order']),
            )

    # @expose('/get_position_array/<dashboard_id>/<slice_id>/<standalone_token>/', methods=['GET'])
    # def get_position_array(self, dashboard_id, slice_id, standalone_token):
    #     if standalone_token != config.get('STANDALONE_TOKEN'):
    #         return json_success(json.dumps({}))
    #     """即将舍弃 Get position data for a specific slice in a dashboard"""
    #     session = db.session()
    #     dash = session.query(models.Dashboard).get(int(dashboard_id))
    #     if not dash:
    #         return json_success(json.dumps({}))
    #     slice = session.query(models.Slice).get(int(slice_id))
    #     if not slice:
    #         return json_success(json.dumps({}))
    #     position_array = dash.position_array or []
    #     item_dict = {"size_x": 16, "size_y": 16, "slice_id": slice_id, "slice_name": slice.slice_name}
    #     for item in position_array:
    #         if item.get('slice_id') == slice_id:
    #             item_dict.update(item)
    #             break
    #     return json_success(json.dumps(item_dict))

    @has_access
    @expose('/home_page/', methods=['GET', 'POST'])
    def home_page(self):
        if request.method == 'GET':
            if 'Admin' in [x.name for x in get_user_roles()]:
                return redirect('/logout')
            bootstrap_data = {
                'user_id': g.user.get_id(),
                'username': g.user.username if hasattr(g.user, 'username') else None,
                'expire_date': g.user.expire_date.isoformat() if hasattr(g.user,
                                                                        'username') and g.user.expire_date else None,
                'agree_time': g.user.agree_time.isoformat() if hasattr(g.user,
                                                                    'agree_time') and g.user.agree_time else None,
                'water_mark': config.get('WATER_MARK'),
                'no_water_mark_user': config.get('NO_WATER_MARK_USER_LIST'),
                'common': self.common_bootsrap_payload(),
            }
            top_category_data = gen_top_category(self.appbuilder)
            return self.render_template('superset/home_page.html',
                entry='homePage',
                bootstrap_data=json.dumps(bootstrap_data),
                userId=g.user.id,
                current_top_category=top_category_data['top_category_arr_by_order'][0],
                current_sub_category=top_category_data['_sub_category'],
                top_category_lst=top_category_data['_top_category_lst_str'],
                top_category_dict=json.dumps(top_category_data['_top_category_dict']),
                second_category_list_order=json.dumps(top_category_data['second_category_list_order']),
                )
        elif request.method == 'POST':
            post_data = request.get_json(force=True)
            print(post_data)
            action = post_data.get('action')
            if action == 'get_risefallcount_treemap_data':
                try:
                    response = requests.post(
                        config.get('FENGYUN_PUBLIC_API'),
                        headers={
                            'User-Agent': 'zijin_superset',
                        },
                        json={
                            'token': config.get('API_TOKEN'),
                            'action': 'get_risefallcount_treemap_data',
                        },
                        timeout=30,
                    )
                    response.raise_for_status()
                    data = response.json()
                    if not isinstance(data, dict) or any(
                        not isinstance(data.get(key), list)
                        for key in ('riseFallData', 'snapshotData')
                    ):
                        raise ValueError('Invalid market data response')
                    return json_success(json.dumps(data, ensure_ascii=False))
                except (requests.RequestException, ValueError) as e:
                    logging.warning('获取首页行情数据失败: %s', e)
                    return json_error_response('获取数据失败，请稍后重试', status=502)
                    
            elif action == 'get_home_extradata':
                # 获取额外数据
                try:
                    # 获取预警数据
                    sql_qry_warn = sqla.text("""
                        SELECT warn_index, warn_condition, warn_value,
                               index_max_date, send_time, dashboard_id, slice_id
                        FROM warn_index
                        WHERE username = :username
                          AND LOCALTIMESTAMP <= expire_time
                          AND send_time IS NOT NULL
                    """)
                    df_warn = pd.read_sql(
                        sql_qry_warn, db.engine,
                        params={'username': g.user.username})
                    df_warn_arr = df_warn.to_dict(orient='records')
                    # 获取核心品种观点和路演数据
                    reports_sql = """
                    select id,report_title,variety,report_public_date,report_file_suffix from reports where report_file_suffix = 'pdf' ORDER BY report_public_date DESC, id DESC limit 5
                    """
                    df_reports_all = pd.read_sql(reports_sql, db.engine)
                    df_reports_all['report_public_date'] = df_reports_all['report_public_date'].dt.strftime('%Y-%m-%d')
                    # 核心品种观点数据
                    df_reports_pdf = df_reports_all[df_reports_all['report_file_suffix'] == 'pdf']
                    df_reports_pdf_arr = df_reports_pdf.to_dict(orient='records')
                    # 获取情绪指数数据,form-data请求
                    form_fyapi_data = {
                        'username': config.get('FYAPI_KEY'),
                        'pwd': config.get('FYAPI_KEY'),
                        'symbol': '期货多空情绪MA30',
                        'algo': 'original',
                        'post_name': 'getDataByCount',
                        'count': 1
                    }
                    response = requests.post(config.get('FYAPI_URL'), headers={
                        'User-Agent': 'zijin_superset'
                    },
                    data=form_fyapi_data)
                    if response.status_code == 200:
                        response_text = response.text
                        mood_index_data_arr = json.loads(response_text)
                        if len(mood_index_data_arr) > 0:
                            mood_index_data = mood_index_data_arr[0]['指标值']
                        else:
                            mood_index_data = 0
                    else:
                        mood_index_data = 0

                    rtn_data = {
                        'warnData': df_warn_arr,
                        'reportsData': {
                            'pdf': df_reports_pdf_arr
                        },
                        'moodIndexData': mood_index_data
                    }
                    return json_success(json.dumps(rtn_data, default=str, ensure_ascii=False))
                except Exception as e:
                    print(f"获取数据失败: {str(e)}")
                    import traceback
                    traceback.print_exc()
                    return json_error_response(f'获取数据失败: {str(e)}')
    @api
    @log_this
    @expose('/log/', methods=['POST'])
    def log(self):
        return Response(status=200)


    @has_access
    @expose('/sync_druid/', methods=['POST'])
    @log_this
    def sync_druid_source(self):
        """Syncs the druid datasource in main db with the provided config.

        The endpoint takes 3 arguments:
            user - user name to perform the operation as
            cluster - name of the druid cluster
            config - configuration stored in json that contains:
                name: druid datasource name
                dimensions: list of the dimensions, they become druid columns
                    with the type STRING
                metrics_spec: list of metrics (dictionary). Metric consists of
                    2 attributes: type and name. Type can be count,
                    etc. `count` type is stored internally as longSum
                    other fields will be ignored.

            Example: {
                'name': 'test_click',
                'metrics_spec': [{'type': 'count', 'name': 'count'}],
                'dimensions': ['affiliate_id', 'campaign', 'first_seen']
            }
        """
        payload = request.get_json(force=True)
        druid_config = payload['config']
        user_name = payload['user']
        cluster_name = payload['cluster']

        user = security_manager.find_user(username=user_name)
        DruidDatasource = ConnectorRegistry.sources['druid']
        DruidCluster = DruidDatasource.cluster_class
        if not user:
            err_msg = __("Can't find User '%(name)s', please ask your admin "
                         'to create one.', name=user_name)
            logging.error(err_msg)
            return json_error_response(err_msg)
        cluster = db.session.query(DruidCluster).filter_by(
            cluster_name=cluster_name).first()
        if not cluster:
            err_msg = __("Can't find DruidCluster with cluster_name = "
                         "'%(name)s'", name=cluster_name)
            logging.error(err_msg)
            return json_error_response(err_msg)
        try:
            DruidDatasource.sync_to_db_from_config(
                druid_config, user, cluster)
        except Exception as e:
            logging.exception(utils.error_msg_from_exception(e))
            return json_error_response(utils.error_msg_from_exception(e))
        return Response(status=201)

    @has_access
    @expose('/sqllab_viz/', methods=['POST'])
    @log_this
    def sqllab_viz(self):
        SqlaTable = ConnectorRegistry.sources['table']
        data = json.loads(request.form.get('data'))
        table_name = data.get('datasourceName')
        table = (
            db.session.query(SqlaTable)
            .filter_by(table_name=table_name)
            .first()
        )
        if not table:
            table = SqlaTable(table_name=table_name)
        table.database_id = data.get('dbId')
        table.schema = data.get('schema')
        q = SupersetQuery(data.get('sql'))
        table.sql = q.stripped()
        db.session.add(table)
        cols = []
        dims = []
        metrics = []
        for column_name, config in data.get('columns').items():
            is_dim = config.get('is_dim', False)
            SqlaTable = ConnectorRegistry.sources['table']
            TableColumn = SqlaTable.column_class
            SqlMetric = SqlaTable.metric_class
            col = TableColumn(
                column_name=column_name,
                filterable=is_dim,
                groupby=is_dim,
                is_dttm=config.get('is_date', False),
                type=config.get('type', False),
            )
            cols.append(col)
            if is_dim:
                dims.append(col)
            agg = config.get('agg')
            if agg:
                if agg == 'count_distinct':
                    metrics.append(SqlMetric(
                        metric_name='{agg}__{column_name}'.format(**locals()),
                        expression='COUNT(DISTINCT {column_name})'
                        .format(**locals()),
                    ))
                else:
                    metrics.append(SqlMetric(
                        metric_name='{agg}__{column_name}'.format(**locals()),
                        expression='{agg}({column_name})'.format(**locals()),
                    ))
        if not metrics:
            metrics.append(SqlMetric(
                metric_name='count'.format(**locals()),
                expression='count(*)'.format(**locals()),
            ))
        table.columns = cols
        table.metrics = metrics
        db.session.commit()
        return self.json_response(json.dumps({
            'table_id': table.id,
        }))

    @has_access
    @expose('/table/<database_id>/<table_name>/<schema>/')
    @log_this
    def table(self, database_id, table_name, schema):
        schema = utils.js_string_to_python(schema)
        mydb = db.session.query(models.Database).filter_by(id=database_id).one()
        payload_columns = []
        indexes = []
        primary_key = []
        foreign_keys = []
        try:
            columns = mydb.get_columns(table_name, schema)
            indexes = mydb.get_indexes(table_name, schema)
            primary_key = mydb.get_pk_constraint(table_name, schema)
            foreign_keys = mydb.get_foreign_keys(table_name, schema)
        except Exception as e:
            return json_error_response(utils.error_msg_from_exception(e))
        keys = []
        if primary_key and primary_key.get('constrained_columns'):
            primary_key['column_names'] = primary_key.pop('constrained_columns')
            primary_key['type'] = 'pk'
            keys += [primary_key]
        for fk in foreign_keys:
            fk['column_names'] = fk.pop('constrained_columns')
            fk['type'] = 'fk'
        keys += foreign_keys
        for idx in indexes:
            idx['type'] = 'index'
        keys += indexes

        for col in columns:
            dtype = ''
            try:
                dtype = '{}'.format(col['type'])
            except Exception:
                pass
            payload_columns.append({
                'name': col['name'],
                'type': dtype.split('(')[0] if '(' in dtype else dtype,
                'longType': dtype,
                'keys': [
                    k for k in keys
                    if col['name'] in k.get('column_names')
                ],
            })
        tbl = {
            'name': table_name,
            'columns': payload_columns,
            'selectStar': mydb.select_star(
                table_name, schema=schema, show_cols=True, indent=True,
                cols=columns, latest_partition=False),
            'primaryKey': primary_key,
            'foreignKeys': foreign_keys,
            'indexes': keys,
        }
        return json_success(json.dumps(tbl))

    @has_access
    @expose('/extra_table_metadata/<database_id>/<table_name>/<schema>/')
    @log_this
    def extra_table_metadata(self, database_id, table_name, schema):
        schema = utils.js_string_to_python(schema)
        mydb = db.session.query(models.Database).filter_by(id=database_id).one()
        payload = mydb.db_engine_spec.extra_table_metadata(
            mydb, table_name, schema)
        return json_success(json.dumps(payload))

    @has_access
    @expose('/select_star/<database_id>/<table_name>/')
    @log_this
    def select_star(self, database_id, table_name):
        mydb = db.session.query(
            models.Database).filter_by(id=database_id).first()
        return self.render_template(
            'superset/ajah.html',
            content=mydb.select_star(table_name, show_cols=True),
        )

    @expose('/theme/')
    def theme(self):
        return self.render_template('superset/theme.html')

    @has_access_api
    @expose('/cached_key/<key>/')
    @log_this
    def cached_key(self, key):
        """Returns a key from the cache"""
        resp = cache.get(key)
        if resp:
            return resp
        return 'nope'

    @has_access_api
    @expose('/cache_key_exist/<key>/')
    @log_this
    def cache_key_exist(self, key):
        """Returns if a key from cache exist"""
        key_exist = True if cache.get(key) else False
        status = 200 if key_exist else 404
        return json_success(json.dumps({'key_exist': key_exist}),
                            status=status)

    @has_access_api
    @expose('/results/<key>/')
    @log_this
    def results(self, key):
        """Serves a key off of the results backend"""
        if not results_backend:
            return json_error_response("Results backend isn't configured")

        blob = results_backend.get(key)
        if not blob:
            return json_error_response(
                'Data could not be retrieved. '
                'You may want to re-run the query.',
                status=410,
            )

        query = db.session.query(Query).filter_by(results_key=key).one()
        rejected_tables = security_manager.rejected_datasources(
            query.sql, query.database, query.schema)
        if rejected_tables:
            return json_error_response(get_datasource_access_error_msg(
                '{}'.format(rejected_tables)))

        payload = utils.zlib_decompress_to_string(blob)
        display_limit = app.config.get('DISPLAY_SQL_MAX_ROW', None)
        if display_limit:
            payload_json = json.loads(payload)
            payload_json['data'] = payload_json['data'][:display_limit]
        return json_success(
            json.dumps(payload_json, default=utils.json_iso_dttm_ser))

    @has_access_api
    @expose('/stop_query/', methods=['POST'])
    @log_this
    def stop_query(self):
        client_id = request.form.get('client_id')
        try:
            query = (
                db.session.query(Query)
                .filter_by(client_id=client_id).one()
            )
            query.status = utils.QueryStatus.STOPPED
            db.session.commit()
        except Exception:
            pass
        return self.json_response('OK')

    @has_access_api
    @expose('/sql_json/', methods=['POST', 'GET'])
    @log_this
    def sql_json(self):
        """Runs arbitrary sql and returns and json"""
        run_async = request.form.get('runAsync') == 'true'
        sql = request.form.get('sql')
        database_id = request.form.get('database_id')
        schema = request.form.get('schema') or None
        template_params = json.loads(
            request.form.get('templateParams') or '{}')

        session = db.session()
        mydb = session.query(models.Database).filter_by(id=database_id).first()

        if not mydb:
            json_error_response(
                'Database with id {} is missing.'.format(database_id))

        rejected_tables = security_manager.rejected_datasources(sql, mydb, schema)
        if rejected_tables:
            return json_error_response(get_datasource_access_error_msg(
                '{}'.format(rejected_tables)))
        session.commit()

        select_as_cta = request.form.get('select_as_cta') == 'true'
        tmp_table_name = request.form.get('tmp_table_name')
        if select_as_cta and mydb.force_ctas_schema:
            tmp_table_name = '{}.{}'.format(
                mydb.force_ctas_schema,
                tmp_table_name,
            )

        query = Query(
            database_id=int(database_id),
            limit=int(app.config.get('SQL_MAX_ROW', None)),
            sql=sql,
            schema=schema,
            select_as_cta=request.form.get('select_as_cta') == 'true',
            start_time=utils.now_as_float(),
            tab_name=request.form.get('tab'),
            status=QueryStatus.PENDING if run_async else QueryStatus.RUNNING,
            sql_editor_id=request.form.get('sql_editor_id'),
            tmp_table_name=tmp_table_name,
            user_id=int(g.user.get_id()),
            client_id=request.form.get('client_id'),
        )
        session.add(query)
        session.flush()
        query_id = query.id
        session.commit()  # shouldn't be necessary
        if not query_id:
            raise Exception(_('Query record was not created as expected.'))
        logging.info('Triggering query_id: {}'.format(query_id))

        try:
            template_processor = get_template_processor(
                database=query.database, query=query)
            rendered_query = template_processor.process_template(
                query.sql,
                **template_params)
        except Exception as e:
            return json_error_response(
                'Template rendering failed: {}'.format(utils.error_msg_from_exception(e)))

        # Async request.
        if run_async:
            logging.info('Running query on a Celery worker')
            # Ignore the celery future object and the request may time out.
            try:
                sql_lab.get_sql_results.delay(
                    query_id,
                    rendered_query,
                    return_results=False,
                    store_results=not query.select_as_cta,
                    user_name=g.user.username)
            except Exception as e:
                logging.exception(e)
                msg = (
                    'Failed to start remote query on a worker. '
                    'Tell your administrator to verify the availability of '
                    'the message queue.'
                )
                query.status = QueryStatus.FAILED
                query.error_message = msg
                session.commit()
                return json_error_response('{}'.format(msg))

            resp = json_success(json.dumps(
                {'query': query.to_dict()}, default=utils.json_int_dttm_ser,
                allow_nan=False), status=202)
            session.commit()
            return resp

        # Sync request.
        try:
            timeout = config.get('SQLLAB_TIMEOUT')
            timeout_msg = (
                'The query exceeded the {timeout} seconds '
                'timeout.').format(**locals())
            with utils.timeout(seconds=timeout,
                               error_message=timeout_msg):
                # pylint: disable=no-value-for-parameter
                data = sql_lab.get_sql_results(
                    query_id,
                    rendered_query,
                    return_results=True)
            payload = json.dumps(
                data, default=utils.pessimistic_json_iso_dttm_ser)
        except Exception as e:
            logging.exception(e)
            return json_error_response('{}'.format(e))
        if data.get('status') == QueryStatus.FAILED:
            return json_error_response(payload=data)
        return json_success(payload)

    @has_access
    @expose('/csv/<client_id>')
    @log_this
    def csv(self, client_id):
        """Download the query results as csv."""
        logging.info('Exporting CSV file [{}]'.format(client_id))
        query = (
            db.session.query(Query)
            .filter_by(client_id=client_id)
            .one()
        )

        rejected_tables = security_manager.rejected_datasources(
            query.sql, query.database, query.schema)
        if rejected_tables:
            flash(get_datasource_access_error_msg('{}'.format(rejected_tables)))
            return redirect('/')
        blob = None
        if results_backend and query.results_key:
            logging.info(
                'Fetching CSV from results backend '
                '[{}]'.format(query.results_key))
            blob = results_backend.get(query.results_key)
        if blob:
            logging.info('Decompressing')
            json_payload = utils.zlib_decompress_to_string(blob)
            obj = json.loads(json_payload)
            columns = [c['name'] for c in obj['columns']]
            df = pd.DataFrame.from_records(obj['data'], columns=columns)
            logging.info('Using pandas to convert to CSV')
            csv = df.to_csv(index=False, **config.get('CSV_EXPORT'))
        else:
            logging.info('Running a query to turn into CSV')
            sql = query.select_sql or query.executed_sql
            df = query.database.get_df(sql, query.schema)
            # TODO(bkyryliuk): add compression=gzip for big files.
            csv = df.to_csv(index=False, **config.get('CSV_EXPORT'))
        response = Response(csv, mimetype='text/csv')
        response.headers['Content-Disposition'] = (
            'attachment; filename={}.csv'.format(unidecode(query.name)))
        logging.info('Ready to return response')
        return response

    @has_access
    @expose('/fetch_datasource_metadata')
    @log_this
    def fetch_datasource_metadata(self):
        datasource_id, datasource_type = (
            request.args.get('datasourceKey').split('__'))
        datasource = ConnectorRegistry.get_datasource(
            datasource_type, datasource_id, db.session)
        # Check if datasource exists
        if not datasource:
            return json_error_response(DATASOURCE_MISSING_ERR)

        # Check permission for datasource
        if not security_manager.datasource_access(datasource):
            return json_error_response(DATASOURCE_ACCESS_ERR)
        return json_success(json.dumps(datasource.data))

    @expose('/queries/<last_updated_ms>')
    def queries(self, last_updated_ms):
        """Get the updated queries."""
        stats_logger.incr('queries')
        if not g.user.get_id():
            return json_error_response(
                'Please login to access the queries.', status=403)

        # Unix time, milliseconds.
        last_updated_ms_int = int(float(last_updated_ms)) if last_updated_ms else 0

        # UTC date time, same that is stored in the DB.
        last_updated_dt = utils.EPOCH + timedelta(seconds=last_updated_ms_int / 1000)

        sql_queries = (
            db.session.query(Query)
            .filter(
                Query.user_id == g.user.get_id(),
                Query.changed_on >= last_updated_dt,
            )
            .all()
        )
        dict_queries = {q.client_id: q.to_dict() for q in sql_queries}
        return json_success(
            json.dumps(dict_queries, default=utils.json_int_dttm_ser))

    @has_access
    @expose('/search_queries')
    @log_this
    def search_queries(self):
        """Search for queries."""
        query = db.session.query(Query)
        search_user_id = request.args.get('user_id')
        database_id = request.args.get('database_id')
        search_text = request.args.get('search_text')
        status = request.args.get('status')
        # From and To time stamp should be Epoch timestamp in seconds
        from_time = request.args.get('from')
        to_time = request.args.get('to')

        if search_user_id:
            # Filter on db Id
            query = query.filter(Query.user_id == search_user_id)

        if database_id:
            # Filter on db Id
            query = query.filter(Query.database_id == database_id)

        if status:
            # Filter on status
            query = query.filter(Query.status == status)

        if search_text:
            # Filter on search text
            query = query \
                .filter(Query.sql.like('%{}%'.format(search_text)))

        if from_time:
            query = query.filter(Query.start_time > int(from_time))

        if to_time:
            query = query.filter(Query.start_time < int(to_time))

        query_limit = config.get('QUERY_SEARCH_LIMIT', 1000)
        sql_queries = (
            query.order_by(Query.start_time.asc())
            .limit(query_limit)
            .all()
        )

        dict_queries = [q.to_dict() for q in sql_queries]

        return Response(
            json.dumps(dict_queries, default=utils.json_int_dttm_ser),
            status=200,
            mimetype='application/json')

    @app.errorhandler(500)
    def show_traceback(self):
        return render_template(
            'superset/traceback.html',
            error_msg=get_error_msg(),
        ), 500

    # @staticmethod
    # def check_md5():
    #     try:
    #         file_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../license.dat'))
    #         with open(file_path, 'r') as f:
    #             origin_str = f.read()
    #     except:
    #         return False
    #     origin_list = origin_str.split('/')
    #     start_date = origin_list[1]
    #     md5 = origin_list[0][:-3]
    #     valid_day = origin_list[0][-3:]
    #
    #     from datetime import datetime, timedelta
    #     start_time = datetime.strptime(str(start_date), '%Y%m%d')
    #     cur_time = datetime.now()
    #
    #     if (cur_time - start_time).days > int(valid_day):
    #         return False
    #     elif (cur_time - start_time).days >= (int(valid_day) - 3):
    #         deadline = start_time + timedelta(days=(int(valid_day) + 1))
    #         flash('license将于[{0}]到期，若需继续使用此平台，请联系天风期货业务人员。'.format(deadline.strftime('%Y%m%d')),
    #               'warning')
    #     return True

    @expose('/welcome')
    def welcome(self):
        # if not self.check_md5():
        #     flash('license已到期，若需继续使用此平台，请联系天风期货业务人员', 'warning')
        #     from flask_login import logout_user
        #     logout_user()
        #     return redirect(appbuilder.get_url_for_login)
        """Personalized welcome page"""
        if not g.user or not g.user.get_id():
            return redirect(appbuilder.get_url_for_login)

        payload = {
            'user': bootstrap_user_data(),
            'common': self.common_bootsrap_payload(),
        }

        if 'Admin' in [x.name for x in get_user_roles()]:
            return self.render_template(
                'superset/basic.html',
                entry='welcome',
                bootstrap_data=json.dumps(payload, default=utils.json_iso_dttm_ser),
            )
        else:
            return redirect(self.appbuilder.app.view_functions['DashboardModelViewAsync.get_latest_dashboards_url']())

    @has_access
    @expose('/profile/<username>/')
    def profile(self, username):
        """User profile page"""
        if not username and g.user:
            username = g.user.username

        payload = {
            'user': bootstrap_user_data(username, include_perms=True),
            'common': self.common_bootsrap_payload(),
        }

        if 'Admin' in [x.name for x in get_user_roles()]:
            return self.render_template(
                'superset/basic.html',
                title=username + "'s profile",
                entry='profile',
                bootstrap_data=json.dumps(payload, default=utils.json_iso_dttm_ser),
            )
        else:
            # _top_category_arr, _top_category_lst, _sub_category, _top_category_dict, second_category_list_order, dashboard_list \
            top_category_data = gen_top_category(self.appbuilder)

            return self.render_template(
                'superset/basic_for_client.html',
                bootstrap_data=json.dumps(payload, default=utils.json_iso_dttm_ser),
                entry='profile',
                title=username + "'s profile",
                standalone_mode=False,
                userId=g.user.id,
                # favorites=self.fave_dashboards(g.user.id).get_data(as_text=True),
                can_save_monitor=security_manager.can_access('can_save_monitor', 'Superset'),
                show_top10_record=security_manager.can_access('can_show_top10_record', 'Superset'),
                show_sclice=security_manager.can_access('can_add', 'SliceModelView'),
                current_top_category=top_category_data['top_category_arr_by_order'][0],
                current_sub_category=top_category_data['_sub_category'],
                top_category_lst=top_category_data['_top_category_lst_str'],
                top_category_dict=json.dumps(top_category_data['_top_category_dict']),
                second_category_list_order=json.dumps(top_category_data['second_category_list_order']),
                # dashboard_list=json.dumps(top_category_data['dashboard_list']),
            )

    @has_access
    @expose('/sqllab')
    def sqllab(self):
        """SQL Editor"""
        d = {
            'defaultDbId': config.get('SQLLAB_DEFAULT_DBID'),
            'common': self.common_bootsrap_payload(),
        }
        return self.render_template(
            'superset/basic.html',
            entry='sqllab',
            bootstrap_data=json.dumps(d, default=utils.json_iso_dttm_ser),
        )

    @api
    @has_access_api
    @expose('/slice_query/<slice_id>/')
    def sliceQuery(self, slice_id):
        """
        This method exposes an API endpoint to
        get the database query string for this slice
        """
        viz_obj = self.get_viz(slice_id)
        if not security_manager.datasource_access(viz_obj.datasource):
            return json_error_response(DATASOURCE_ACCESS_ERR, status=401)
        return self.get_query_string_response(viz_obj)

    @has_access
    @expose('/ppt/tasks/')
    def get_ppt_tasks(self):
        """获取当前用户的PPT任务和ppt模版列表"""
        try:
            user_id = g.user.id
            type = request.args.get('type')
            sql = sqla.text("""
                SELECT * FROM task_report
                WHERE task_create_userid = :user_id
                ORDER BY task_creat_time DESC
            """)
            params = {'user_id': user_id}
            if type == 'running':
                sql = sqla.text("""
                    SELECT * FROM task_report 
                    WHERE task_create_userid = :user_id AND task_start_time >= :start_time
                    ORDER BY task_creat_time DESC
                """)
                params['start_time'] = datetime.now() - timedelta(minutes=30)
            tasks = db.session.execute(sql, params).fetchall()

            # 转换为字典列表
            tasks_list = []
            for task in tasks:
                task_dict = {
                    'taskid': task.taskid,
                    'task_name': task.task_name,
                    'task_node_list': task.task_node_list,
                    'task_current_node': task.task_current_node,
                    'task_status': task.task_status,
                    'task_creat_time': str(task.task_creat_time),
                    'task_start_time': str(task.task_start_time) if task.task_start_time else None,
                    'task_finish_time': str(task.task_finish_time) if task.task_finish_time else None,
                    'task_file_name': task.task_file_name,
                    'task_file_type': task.task_file_type,
                    'task_count': task.task_count,
                    'task_email': task.task_email,
                    'task_ppt_home_title': task.task_ppt_home_title,
                    'task_ppt_template_id': task.task_ppt_template_id,
                }
                tasks_list.append(task_dict)

            ppt_templates_list = []
            if type != 'running':
                ppt_ppt_templates_sql = sqla.text("""
                    SELECT * FROM ppt_templates
                    WHERE user_id = :user_id OR template_type = 'public'
                    ORDER BY created_time DESC
                """)
                ppt_templates = db.session.execute(
                    ppt_ppt_templates_sql, {'user_id': user_id}).fetchall()
                for ppt_template in ppt_templates:
                    ppt_templates_list.append({
                        'template_id': ppt_template.template_id,
                        'template_name': ppt_template.template_name,
                        'template_type': ppt_template.template_type,
                        'created_time': str(ppt_template.created_time),
                    })

            return json_success(json.dumps({'tasks': tasks_list, 'ppt_templates': ppt_templates_list}))
        except Exception as e:
            return json_error_response(str(e))

    @has_access
    @expose('/ppt/task/', methods=['POST'])
    def handle_ppt_task(self):
        """处理PPT任务的新建、修改和删除操作"""
        try:
            operation = request.form.get('operation')
            user_id = g.user.id
            user_name = g.user.username
            if operation == 'create':
                task_name = request.form.get('task_name')
                task_node_list = request.form.get('task_node_list')
                task_email = request.form.get('task_email', '')
                task_ppt_home_title = request.form.get('task_ppt_home_title', '')
                task_ppt_template_id = request.form.get('task_ppt_template_id', '')

                if not task_name or not task_node_list:
                    return json_error_response('任务名称和栏目列表不能为空')

                create_time = datetime.now()
                sql = sqla.text("""
                    INSERT INTO task_report
                    (task_name, task_node_list, task_status, task_creat_time,
                     task_file_type, task_create_userid, task_count, task_email,
                     task_ppt_home_title, task_ppt_template_id)
                    VALUES (:task_name, :task_node_list, 'created', :create_time,
                            'ppt', :user_id, 0, :task_email,
                            :task_ppt_home_title, :task_ppt_template_id)
                    RETURNING taskid
                """)
                result = db.session.execute(sql, {
                    'task_name': task_name,
                    'task_node_list': task_node_list,
                    'create_time': create_time,
                    'user_id': user_id,
                    'task_email': task_email,
                    'task_ppt_home_title': task_ppt_home_title,
                    'task_ppt_template_id': task_ppt_template_id or None,
                })
                taskid = result.scalar()
                db.session.commit()

                return json_success(json.dumps({'status': 'success',
                                                'task_creat_time': str(create_time),
                                                'task_create_userid': user_id,
                                                'taskid': taskid}))

            elif operation == 'edit':
                taskid = request.form.get('taskid')
                task_name = request.form.get('task_name')
                task_node_list = request.form.get('task_node_list')
                task_email = request.form.get('task_email', '')
                task_ppt_home_title = request.form.get('task_ppt_home_title', '')
                task_ppt_template_id = request.form.get('task_ppt_template_id', '')

                if not taskid or not task_name or not task_node_list:
                    return json_error_response('参数不完整')

                update_sql = sqla.text("""
                    UPDATE task_report
                    SET task_name = :task_name,
                        task_node_list = :task_node_list,
                        task_email = :task_email,
                        task_ppt_home_title = :task_ppt_home_title,
                        task_ppt_template_id = :task_ppt_template_id
                    WHERE taskid = :taskid AND task_create_userid = :user_id
                """)
                db.session.execute(update_sql, {
                    'task_name': task_name,
                    'task_node_list': task_node_list,
                    'task_email': task_email,
                    'task_ppt_home_title': task_ppt_home_title,
                    'task_ppt_template_id': task_ppt_template_id or None,
                    'taskid': int(taskid),
                    'user_id': user_id,
                })
                db.session.commit()

                return json_success(json.dumps({'status': 'success'}))

            elif operation == 'delete':
                taskid = request.form.get('taskid')
                if not taskid:
                    return json_error_response('参数不完整')

                delete_sql = sqla.text("""
                    DELETE FROM task_report
                    WHERE taskid = :taskid AND task_create_userid = :user_id
                """)
                db.session.execute(delete_sql, {
                    'taskid': int(taskid),
                    'user_id': user_id,
                })
                db.session.commit()

                return json_success(json.dumps({'status': 'success'}))
            elif operation == 'run':
                taskid = request.form.get('taskid')
                if not taskid:
                    return json_error_response('参数不完整')
                # 检查任务是否存在且属于当前用户
                check_sql = sqla.text("""
                    SELECT a.*, b.template_name, b.template_type
                    FROM task_report a
                    LEFT JOIN ppt_templates b ON a.task_ppt_template_id = b.template_id
                    WHERE a.taskid = :taskid AND a.task_create_userid = :user_id
                """)
                task = db.session.execute(check_sql, {
                    'taskid': int(taskid),
                    'user_id': user_id,
                }).fetchone()
                if not task:
                    return json_error_response('任务不存在')
                task_name = task.task_name
                task_email = task.task_email
                # 检查任务状态
                if task.task_status == 'running':
                    return json_error_response('任务正在运行中')
                task_node_list = task.task_node_list.split(',')
                task_ppt_home_title = task.task_ppt_home_title
                task_ppt_template_name = task.template_name
                if task_ppt_template_name:
                    if task.template_type != 'public':
                        task_ppt_template_name = str(user_id) + '_' + task_ppt_template_name
                else:
                    task_ppt_template_name = 'ppt_template'
                task_ppt_template_name = task_ppt_template_name + '.pptx'

                # 更新任务状态为running，设置开始时间，重置当前节点
                update_sql = sqla.text("""
                    UPDATE task_report
                    SET task_status = 'running',
                        task_start_time = :start_time,
                        task_current_node = NULL,
                        task_count = task_count + 1
                    WHERE taskid = :taskid
                """)
                db.session.execute(update_sql, {
                    'start_time': datetime.now(),
                    'taskid': int(taskid),
                })
                db.session.commit()

                # 启动线程，执行create_ppt_with_images函数
                standalone_token = config.get('STANDALONE_TOKEN')

                task_info = {
                    'taskid': taskid,
                    'task_name': task_name,
                    'task_email': task_email,
                    'task_node_list': task_node_list,
                    'task_ppt_home_title': task_ppt_home_title if task_ppt_home_title else '标题',
                    'task_ppt_template_name': task_ppt_template_name,
                }
                thread = threading.Thread(target=create_ppt_with_images, args=(user_name, standalone_token, task_info, config.get('SUPERSET_WEBSERVER_PORT'),))
                thread.start()

                return json_success(json.dumps({'status': 'success'}))

        except Exception as e:
            db.session.rollback()
            return json_error_response(str(e))

    @has_access
    @expose('/ppt/template_action/', methods=['POST'])
    def handle_ppt_template_action(self):
        """处理PPT模版的上传和修改操作"""
        try:
            operation = request.form.get('operation')
            user_id = g.user.id

            if operation == 'upload':
                template_name = request.form.get('template_name')
                template_file = request.files.get('template_file')

                if not template_name or not template_file:
                    return json_error_response('模版名称和文件不能为空')

                # 检查文件类型
                if not template_file.filename.lower().endswith('.pptx'):
                    return json_error_response('只支持PPTX格式文件')

                created_time = datetime.now()
                sql = sqla.text("""
                    INSERT INTO ppt_templates
                    (template_name, user_id, template_type, created_time)
                    VALUES (:template_name, :user_id, 'private', :created_time)
                    RETURNING template_id
                """)
                result = db.session.execute(sql, {
                    'template_name': template_name,
                    'user_id': user_id,
                    'created_time': created_time,
                })
                template_id = result.scalar()
                db.session.commit()
                unique_filename = str(user_id) + '_' + template_name + '.pptx'
                file_path = os.path.join(config['PPT_TEMPLATE_DIR'], unique_filename)
                template_file.save(file_path)

                return json_success(json.dumps({
                    'status': 'success',
                    'template_id': template_id,
                    'created_time': str(created_time)
                }))

            elif operation == 'edit':
                template_id = request.form.get('template_id')
                template_name = request.form.get('template_name')
                template_file = request.files.get('template_file')

                if not template_name:
                    return json_error_response('模版名称不能为空')

                # 检查模版是否存在
                check_sql = sqla.text("""
                    SELECT * FROM ppt_templates
                    WHERE template_id = :template_id AND user_id = :user_id
                """)
                old_template = db.session.execute(check_sql, {
                    'template_id': int(template_id),
                    'user_id': user_id,
                }).fetchone()
                if not old_template:
                    return json_error_response('模版不存在')
                template_name_old = old_template.template_name

                if template_name != template_name_old:
                    update_sql = sqla.text("""
                        UPDATE ppt_templates
                        SET template_name = :template_name
                        WHERE template_id = :template_id AND user_id = :user_id
                    """)
                    db.session.execute(update_sql, {
                        'template_name': template_name,
                        'template_id': int(template_id),
                        'user_id': user_id,
                    })
                    db.session.commit()

                if not template_file and template_name != template_name_old:
                    old_file_path = os.path.join(config['PPT_TEMPLATE_DIR'],
                                                    str(user_id) + '_' + template_name_old + '.pptx')
                    if os.path.exists(old_file_path):
                        os.rename(old_file_path, os.path.join(config['PPT_TEMPLATE_DIR'],
                                                                str(user_id) + '_' + template_name + '.pptx'))

                if template_file:
                    if not template_file.filename.lower().endswith('.pptx'):
                        return json_error_response('只支持PPTX格式文件')
                    try:
                        old_file_path = os.path.join(config['PPT_TEMPLATE_DIR'],
                                                     str(user_id) + '_' + template_name_old + '.pptx')
                        if os.path.exists(old_file_path):
                            os.remove(old_file_path)
                    except Exception:
                        pass
                    template_name_save = template_name if template_name else template_name_old
                    file_path = os.path.join(config['PPT_TEMPLATE_DIR'],
                                             str(user_id) + '_' + template_name_save + '.pptx')
                    template_file.save(file_path)

                return json_success(json.dumps({'status': 'success'}))

        except Exception as e:
            db.session.rollback()
            return json_error_response(str(e))

    @has_access
    @expose('/api/dashboard/list/', methods=['GET'])
    def api_dashboard_list(self):
        """获取dashboard列表"""
        try:
            origin_lst = self.appbuilder.app.view_functions['DashboardModelViewAsync.get_dashboards_list']()
            lst_dash = [[x.id, x.dashboard_title] for x in origin_lst]
            return json_success(json.dumps(lst_dash))
        except Exception as e:
            return json_error_response(str(e))

    
    @expose('/api/dify/chat', methods=['POST'])
    def dify_chat(self):
        """Handle Dify chat API request
        
        支持的请求参数:
            - query: 用户查询内容 (必填)
            - conversation_id: 会话ID (可选，用于继续之前的对话)
            - app_index: 应用索引 (可选，默认为'app-index')
            - inputs: 应用定义的各变量值 (可选)
            - files: 文件列表 (可选，用于传入图片等文件)
            - auto_generate_name: 是否自动生成会话标题 (可选，默认True)
        """
        try:
            data = request.json
            query = data.get('query', '')
            conversation_id = data.get('conversation_id')
            app_index = data.get('app_index', 'app-index')  # 获取app_index参数，默认为'app-index'
            inputs = data.get('inputs', {})  # 应用定义的各变量值
            files = data.get('files')  # 文件列表
            auto_generate_name = data.get('auto_generate_name', True)  # 是否自动生成会话标题

            if not query:
                return jsonify({"error": "查询内容不能为空"}), 400

            # 获取DifyClient实例
            dify_chatflow_client, error_response, status_code = get_dify_chatflow_client_instance(app_index, config)
            if error_response:
                return error_response

            def generate():
                try:
                    response = dify_chatflow_client.send_chat_message(
                        query=query,
                        inputs=inputs,
                        conversation_id=conversation_id,
                        user=g.user.username,
                        response_mode="streaming",
                        files=files,
                        auto_generate_name=auto_generate_name
                    )

                    for event in dify_chatflow_client.parse_sse_response(response):
                        yield f"data: {json.dumps(event)}\n\n"

                except Exception as e:
                    error_msg = str(e)
                    logging.error(f"dify_chat generate error: {error_msg}")
                    yield f"data: {json.dumps({'event': 'error', 'error': error_msg})}\n\n"

            return Response(
                stream_with_context(generate()),
                mimetype='text/event-stream',
                headers={
                    'Cache-Control': 'no-cache',
                    'X-Accel-Buffering': 'no'
                }
            )

        except Exception as e:
            logging.error(f"dify_chat function error: {str(e)}")
            return jsonify({"error": str(e)}), 500

    @expose('/api/dify/conversations')
    def get_conversations(self):
        """Get Dify conversations"""
        try:
            app_index = request.args.get('app_index', 'app-index')  # 获取app_index参数，默认为'app-index'

            # 获取DifyClient实例
            dify_chatflow_client, error_response, status_code = get_dify_chatflow_client_instance(app_index, config)
            if error_response:
                return error_response

            # 获取会话列表
            conversations = dify_chatflow_client.get_conversations(user=g.user.username)
            return jsonify(conversations)
        except Exception as e:
            return jsonify([]), 200  # 即使出错也返回空数组而不是错误

    @expose('/api/dify/messages')
    def get_messages(self):
        """Get Dify conversation messages"""
        try:
            conversation_id = request.args.get('conversation_id')
            app_index = request.args.get('app_index', 'app-index')  # 获取app_index参数，默认为'app-index'

            if not conversation_id:
                return jsonify({"error": "未提供会话ID"}), 400

            # 获取DifyClient实例
            dify_chatflow_client, error_response, status_code = get_dify_chatflow_client_instance(app_index, config)
            if error_response:
                return error_response

            messages = dify_chatflow_client.get_conversation_messages(
                conversation_id=conversation_id,
                user=g.user.username
            )
            return jsonify(messages)
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @has_access
    @expose('/api/dify/workflows/run', methods=['POST'])
    def run_workflow(self):
        """执行 Dify workflow, 全局搜索工作流
        
        支持的请求参数:
            - inputs: 工作流定义的各变量值 (必填)
            - response_mode: 响应模式 (可选，默认'blocking'，可选'streaming')
            - app_index: 应用索引 (可选，默认为'slices-search')
            - files: 文件列表 (可选，用于传入图片等文件)
            - trace_id: 链路追踪ID (可选)
        """
        try:
            data = request.json
            inputs = data.get('inputs', {})
            response_mode = data.get('response_mode', 'blocking')
            app_index = data.get('app_index', 'slices-search')
            files = data.get('files')
            trace_id = data.get('trace_id')

            if not inputs:
                return jsonify({"error": "inputs 参数不能为空"}), 400

            # 获取DifyWorkFlowClient实例
            workflow_client, error_response, status_code = get_dify_workflow_client_instance(app_index, config)
            if error_response:
                return error_response

            if response_mode == "streaming":
                def generate():
                    try:
                        response = workflow_client.run_workflow(
                            inputs=inputs,
                            user=g.user.username,
                            response_mode="streaming",
                            files=files,
                            trace_id=trace_id
                        )

                        for event in workflow_client.handle_workflow_events(response):
                            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

                    except Exception as e:
                        error_msg = str(e)
                        yield f"data: {json.dumps({'type': 'error', 'error': error_msg}, ensure_ascii=False)}\n\n"

                return Response(
                    stream_with_context(generate()),
                    mimetype='text/event-stream',
                    headers={
                        'Cache-Control': 'no-cache',
                        'X-Accel-Buffering': 'no'
                    }
                )
            else:
                result = workflow_client.run_workflow(
                    inputs=inputs,
                    user=g.user.username,
                    response_mode="blocking",
                    files=files,
                    trace_id=trace_id
                )
                result = remove_outputs_metadata(result)
                result['titleMap'] = config.get('INDEX_FILTER_INFO')
                return jsonify(result)

        except Exception as e:
            logging.error(f"run_workflow function error: {str(e)}")
            return jsonify({"error": str(e)}), 500

    @has_access
    @expose('/dash_screenshot', methods=['GET'])
    def dash_screenshot(self):
        """获取dashboard截图"""
        screenshotter = None
        try:
            dash_id = request.args.get('dash_id')
            standalone_token = config.get('STANDALONE_TOKEN')
            dash_url = f"http://localhost:{config.get('SUPERSET_WEBSERVER_PORT')}/superset/dashboard/{dash_id}/?standalone_token={standalone_token}"
            dash_name = request.args.get('dash_name')
            filename = f"{dash_name}_{dash_id}.png"
            screenshotter = ScreenShotDash()
            if os.path.exists(os.path.join(screenshotter.output_folder, filename)):
                # 检查文件创建时间是否超过10分钟
                if time.time() - os.path.getctime(os.path.join(screenshotter.output_folder, filename)) > 600:
                    logging.info(f"文件创建时间超过10分钟，重新捕获: {filename}")
                    os.remove(os.path.join(screenshotter.output_folder, filename))
                else:
                    logging.info(f"文件创建时间未超过10分钟，直接返回: {filename}")
                    return jsonify({"filename": filename}), 200
            screenshotter.setup_driver()
            screenshotter.capture_full_screenshot(dash_url, filename)
            return jsonify({"filename": filename}), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500
        finally:
            if screenshotter and screenshotter.driver:
                try:
                    screenshotter.driver.quit()
                except Exception as e:
                    logging.warning("关闭dashboard截图浏览器失败: %s", e)

    @api
    @has_access_api
    @expose('/user_slices_with_dashboards', methods=['GET'])
    def user_slices_with_dashboards(self):
        """获取用户有权限访问的slice以及所属的dashboard信息"""
        Slice = models.Slice
        Dashboard = models.Dashboard
        dashboard_slices = models.dashboard_slices
        ThirdCategory = models.ThirdCategory
        SecondCategory = models.SecondCategory
        TopCategory = models.TopCategory
        username = g.user.username

        if security_manager.all_datasource_access():
            qry = (
                db.session.query(
                    Slice.id.label('slice_id'),
                    Slice.slice_name.label('slice_name'),
                    Dashboard.id.label('dashboard_id'),
                    Dashboard.dashboard_title.label('dashboard_title'),
                    Dashboard.category_id.label('category_id'),
                    TopCategory.category_name.label('top_category_name'),
                    SecondCategory.category_name.label('second_category_name'),
                    ThirdCategory.category_name.label('third_category_name'),
                )
                .select_from(Slice)
                .join(
                    dashboard_slices,
                    Slice.id == dashboard_slices.c.slice_id,
                )
                .join(
                    Dashboard,
                    dashboard_slices.c.dashboard_id == Dashboard.id,
                ).join(
                    ThirdCategory,
                    Dashboard.category_id == ThirdCategory.id,
                ).join(
                    SecondCategory,
                    ThirdCategory.parent_id == SecondCategory.id,
                ).join(
                    TopCategory,
                    SecondCategory.parent_id == TopCategory.id,
                )
            )
        else:
            datasource_perms = security_manager.user_datasource_perms()
            qry = (
                db.session.query(
                    Slice.id.label('slice_id'),
                    Slice.slice_name.label('slice_name'),
                    Dashboard.id.label('dashboard_id'),
                    Dashboard.dashboard_title.label('dashboard_title'),
                    Dashboard.category_id.label('category_id'),
                    TopCategory.category_name.label('top_category_name'),
                    SecondCategory.category_name.label('second_category_name'),
                    ThirdCategory.category_name.label('third_category_name'),
                )
                .select_from(Slice)
                .join(
                    dashboard_slices,
                    Slice.id == dashboard_slices.c.slice_id,
                )
                .join(
                    Dashboard,
                    dashboard_slices.c.dashboard_id == Dashboard.id,
                ).join(
                    ThirdCategory,
                    Dashboard.category_id == ThirdCategory.id,
                ).join(
                    SecondCategory,
                    ThirdCategory.parent_id == SecondCategory.id,
                ).join(
                    TopCategory,
                    SecondCategory.parent_id == TopCategory.id,
                )
                .filter(Slice.perm.in_(datasource_perms))
            )

        user_slices = pd.DataFrame([(
            row.slice_id,
            row.slice_name,
            row.dashboard_id,
            row.dashboard_title,
            row.category_id,
            row.top_category_name,
            row.second_category_name,
        ) for row in qry.all()], columns=['slice_id', 'slice_name', 'dashboard_id'
            ,'dashboard_title', 'category_id', 'top_category_name', 'second_category_name'])

        user_slices = user_slices.dropna(subset=['category_id'])

        keyword = request.args.get('keyword', '').strip()
        if not keyword:
            result = user_slices.to_dict('records')
            return json_success(json.dumps(result, ensure_ascii=False))

        keywords = keyword.lower().split()
        mask = user_slices.apply(
            lambda row: all(
                kw in (str(row['slice_name']) + ' ' + str(row['dashboard_title'])).lower()
                for kw in keywords
            ), axis=1,
        )
        filtered_slices_dashboards = user_slices[mask]

        # 从filtered_slices_dashboards中提取second_category_name集合,每个second_category_name只要一个
        target_categories = set(filtered_slices_dashboards['second_category_name'].dropna())
        seen_categories = set()
        data_query_dashboards = []
        # 然后从user_slices过滤出second_category_name在target_categories中，并且dashboard_title包含'数据查询'的dashboard
        user_slices_filtered = user_slices[user_slices['second_category_name'].isin(target_categories) & user_slices['dashboard_title'].str.contains('数据查询')]
        #  second_category_name 和 dashboard_id 去重
        user_slices_filtered = user_slices_filtered.drop_duplicates(subset=['second_category_name', 'dashboard_id'])

        for _, row in user_slices_filtered.iterrows():
            if len(seen_categories) == len(target_categories):
                break
            seen_categories.add(row['second_category_name'])
            data_query_dashboards.append(row.to_dict())

        result = {
            'slices_dashboards': filtered_slices_dashboards.to_dict('records'),
            'data_query_dashboards': data_query_dashboards,
        }
        return json_success(json.dumps(result, ensure_ascii=False))

    @has_access
    @expose('/add_slice_to_private_dashboard', methods=['POST'])
    def add_slice_to_private_dashboard(self):
        """将slice添加到用户的私人dashboard"""
        try:
            request_form = request.form
            extra_params = json.loads(request_form.get('extra_params'))
            print(extra_params)
            slice_name = extra_params.get('slice_name')
            action = extra_params.get('action')
            # form_data, slc = self.get_form_data()
            # The submitted dashboard save payload is also a complete
            # snapshot and must not inherit removed chart controls.
            form_data_all = self.get_form_data(merge_slice_form_data=False)
            form_data = form_data_all[0]
            slc = form_data_all[1]
            print(form_data)
            merge_extra_filters(form_data)

            if action == 'saveas':
                if 'slice_id' in form_data:
                    form_data.pop('slice_id')  # don't save old slice_id
                slc = models.Slice(owners=[g.user] if g.user else [])

            slc.params = json.dumps(form_data)
            datasource_str = form_data.get('datasource')
            datasource_id, datasource_type = (
                datasource_str.split('__')
            )
            datasource_id, datasource_type = self.datasource_info(
                datasource_id, datasource_type, form_data)
            datasource = ConnectorRegistry.get_datasource(
                datasource_type, datasource_id, db.session)
            slc.datasource_name = datasource.name
            slc.viz_type = form_data['viz_type']
            slc.datasource_type = datasource_type
            slc.datasource_id = datasource_id
            slc.slice_name = slice_name

            if action in ('saveas'):
                self.save_slice(slc)

            # Adding slice to a dashboard if requested
            dash = None
            if extra_params.get('add_to_dash') == 'existing':
                dash = (
                    db.session.query(models.Dashboard)
                    .filter_by(id=int(extra_params.get('save_to_dashboard_id')))
                    .one()
                )
            elif extra_params.get('add_to_dash') == 'new':
                dash = models.Dashboard(
                    dashboard_title=extra_params.get('new_dashboard_name'),
                    owners=[g.user] if g.user else [],
                    dashboard_type='private',
                )
                db.session.add(dash)
                db.session.flush()  # Flush to get the dashboard ID

            if dash and slc not in dash.slices:
                dash.slices.append(slc)

                if extra_params.get('add_to_dash') == 'new':
                    user_id = g.user.id
                    fav_star = models.FavStar(
                        user_id=user_id,
                        obj_id=dash.id,
                        class_name='Dashboard',
                        dttm=datetime.now(),
                    )
                    db.session.add(fav_star)
                db.session.commit()

            response = {
                'status': 'success',
                'message': '收藏成功',
                'dashboard': dash.url,
                'dashboard_name': dash.dashboard_title,
            }
            return json_success(json.dumps(response))

        except Exception as e:
            logging.exception(e)
            db.session.rollback()
            return json_error_response('收藏失败: ' + str(e), status=500)


appbuilder.add_view_no_menu(Superset)


class CssTemplateModelView(SupersetModelView, DeleteMixin):
    datamodel = SQLAInterface(models.CssTemplate)
    list_columns = ['template_name']
    edit_columns = ['template_name', 'css']
    add_columns = edit_columns
    label_columns = {
        'template_name': _('Template Name'),
    }


class CssTemplateAsyncModelView(CssTemplateModelView):
    list_columns = ['template_name', 'css']


appbuilder.add_separator('Sources')
appbuilder.add_separator('Sources')
appbuilder.add_view(
    CssTemplateModelView,
    'CSS Templates',
    label=__('CSS Templates'),
    icon='fa-css3',
    category='Manage',
    category_label=__('Manage'),
    category_icon='')

appbuilder.add_view_no_menu(CssTemplateAsyncModelView)

appbuilder.add_link(
    'SQL Editor',
    label=_('SQL Editor'),
    href='/superset/sqllab',
    category_icon='fa-flask',
    icon='fa-flask',
    category='SQL Lab',
    category_label=__('SQL Lab'),
)

appbuilder.add_link(
    'Query Search',
    label=_('Query Search'),
    href='/superset/sqllab#search',
    icon='fa-search',
    category_icon='fa-flask',
    category='SQL Lab',
    category_label=__('SQL Lab'),
)

appbuilder.add_link(
    'Upload a CSV',
    label=__('Upload a CSV'),
    href='/csvtodatabaseview/form',
    icon='fa-upload',
    category='Sources',
    category_label=__('Sources'),
    category_icon='fa-wrench')
appbuilder.add_separator('Sources')


@app.after_request
def apply_caching(response):
    """Applies the configuration's http headers to all responses"""
    for k, v in config.get('HTTP_HEADERS').items():
        response.headers[k] = v
    return response


# ---------------------------------------------------------------------
# Redirecting URL from previous names
class RegexConverter(BaseConverter):
    def __init__(self, url_map, *items):
        super(RegexConverter, self).__init__(url_map)
        self.regex = items[0]


app.url_map.converters['regex'] = RegexConverter


@app.route(r'/<regex("panoramix\/.*"):url>')
def panoramix(url):  # noqa
    return redirect(request.full_path.replace('panoramix', 'superset'))


@app.route(r'/<regex("caravel\/.*"):url>')
def caravel(url):  # noqa
    return redirect(request.full_path.replace('caravel', 'superset'))
