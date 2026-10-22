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
import time
import traceback
import fitz
import requests
from urllib import parse

from flask import (
    flash, g, redirect, render_template, request, Response, url_for,
    jsonify, stream_with_context, send_file, make_response
)
from markupsafe import Markup
from flask_appbuilder import expose, SimpleFormView

from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import has_access, has_access_api
from flask_babel import gettext as __
from flask_babel import lazy_gettext as _
import pandas as pd
import sqlalchemy as sqla
import oss2

from superset import (
    app, appbuilder, csrf, db,
)

from superset.forms import SencondCatgoryForm, ThirdCatgoryForm, CkeUploadImgForm
import superset.models.core as models
from .base import (BaseSupersetView,
                   json_error_response, SupersetModelView,
                   )
from .utils import aes_decrypt, get_dify_workflow_client_instance, generate_oss_preview_url
from .utils_analyze import summarize_series
from flask_appbuilder.forms import QuerySelectField
from superset.fab_bs5 import BS5Select2Widget
from wtforms.validators import DataRequired
import uuid
from bs4 import BeautifulSoup
from collections import defaultdict
from .core import gen_top_category
from aliyunsdkcore.client import AcsClient
from aliyunsdksts.request.v20150401.AssumeRoleRequest import AssumeRoleRequest

config = app.config
log_this = models.Log.log_this


class TopCategory(SupersetModelView):
    datamodel = SQLAInterface(models.TopCategory)

    list_title = _('一级栏目列表')
    show_title = _('栏目详情')
    add_title = _('新增一级栏目')
    edit_title = _('修改一级栏目')
    can_add = False

    list_columns = ['id', 'category_name', 'list_order']
    add_columns = ['category_name', 'list_order']
    edit_columns = ['category_name', 'list_order']
    show_columns = ['list_order', 'category_name', 'show_second_category_name']

    search_columns = ('category_name',)

    label_columns = {
        'category_name': _('栏目名称'),
        'show_second_category_name': _('下属二级栏目'),
    }
    validators_columns = {
        'category_name': [DataRequired()],
        'list_order': [DataRequired()],
    }


def json_success(json_msg, status=200):
    return Response(json_msg, status=status, mimetype='application/json')


class SecondCategory(SupersetModelView):
    datamodel = SQLAInterface(models.SecondCategory)

    list_title = _('二级栏目列表')
    show_title = _('栏目详情')
    add_title = _('新增二级栏目')
    edit_title = _('修改二级栏目')
    can_add = False

    add_form = SencondCatgoryForm
    edit_form = SencondCatgoryForm

    list_columns = ['id', 'category_name', 'top_category_name', 'list_order']
    add_columns = ['top_category', 'category_name', 'list_order']
    edit_columns = ['top_category', 'category_name', 'list_order']
    order_columns = ['id', 'category_name', 'list_order']
    show_columns = ['list_order', 'category_name', 'top_category_name', 'show_third_category_name']

    search_columns = ['category_name', 'top_category']
    search_form_extra_fields = {
        "top_category": QuerySelectField(
            "一级栏目",
            query_func=lambda: db.session().query(models.TopCategory),
            get_pk_func=lambda a: a.id, get_label=lambda a: a.category_name,
            widget=BS5Select2Widget(),
        )
    }

    label_columns = {
        'category_name': _('栏目名称'),
        'top_category_name': _('所属一级栏目'),
        'show_third_category_name': _('下属三级栏目'),
    }


class ThirdCategory(SupersetModelView):
    datamodel = SQLAInterface(models.ThirdCategory)

    list_title = _('三级栏目列表')
    show_title = _('栏目详情')
    add_title = _('新增三级栏目')
    edit_title = _('修改三级栏目')
    can_add = False

    add_form = ThirdCatgoryForm
    edit_form = ThirdCatgoryForm
    add_template = 'appbuilder/general/model/add_third_category.html'
    edit_template = 'appbuilder/general/model/edit_third_category.html'

    list_columns = ['id', 'category_name', 'top_category_name', 'second_category_name', 'list_order']
    add_columns = ['top_category', 'second_category', 'category_name', 'list_order']
    edit_columns = ['top_category', 'second_category', 'category_name', 'list_order']
    order_columns = ['id', 'category_name', 'list_order']
    show_columns = ['list_order', 'category_name', 'top_category_name', 'second_category_name']

    search_columns = ['category_name', 'second_category']

    search_form_extra_fields = {
        "second_category": QuerySelectField(
            "二级栏目",
            query_func=lambda: db.session().query(models.SecondCategory),
            get_pk_func=lambda a: a.id, get_label=lambda a: a.category_name,
            widget=BS5Select2Widget(),
        )
    }

    label_columns = {
        'category_name': _('栏目名称'),
        'second_category_name': _('所属二级栏目'),
        'top_category_name': _('所属一级栏目'),
    }

    @expose('/add', methods=['GET', 'POST'])
    @has_access
    def add(self):
        widget = self._add()
        if not widget:
            return self.post_add_redirect()
        else:
            return self.render_template(
                self.add_template,
                categorydata=json.dumps(self.gen_category_data()),
                title=self.add_title,
                widgets=widget
            )

    @expose('/edit/<pk>', methods=['GET', 'POST'])
    @has_access
    def edit(self, pk):
        pk = self._deserialize_pk_if_composite(pk)
        second_category_id = self.datamodel.get(pk).parent_id
        top_category_id = self.datamodel.get(pk).second_category.parent_id
        widgets = self._edit(pk)
        if not widgets:
            return self.post_edit_redirect()
        else:
            return self.render_template(self.edit_template,
                                        title=self.edit_title,
                                        widgets=widgets,
                                        categorydata=json.dumps(self.gen_category_data()),
                                        topcategoryid=top_category_id,
                                        secondcategoryid=second_category_id,
                                        related_views=self._related_views)

    @staticmethod
    def gen_category_data():
        second_category = db.session.query(models.SecondCategory)
        category_dict = dict()
        for second_category_row in second_category:
            if second_category_row.parent_id in category_dict.keys():
                category_dict[second_category_row.parent_id].append({"id": second_category_row.id,
                                                                     "name": second_category_row.category_name})
            else:
                category_dict[second_category_row.parent_id] = [{"id": second_category_row.id,
                                                                 "name": second_category_row.category_name}]

        return category_dict


appbuilder.add_view(
    TopCategory,
    'topCategorys',
    label=__('一级栏目'),
    icon='fa-wrench',
    category='Category Manage',
    category_label=__('栏目管理'),
    category_icon='fa-wrench')

appbuilder.add_view(
    SecondCategory,
    'secondCategorys',
    label=__('二级栏目'),
    icon='fa-wrench',
    category='Category Manage',
    category_label=__('栏目管理'),
    category_icon='fa-wrench')

appbuilder.add_view(
    ThirdCategory,
    'thirdCategorys',
    label=__('三级栏目'),
    icon='fa-wrench',
    category='Category Manage',
    category_label=__('栏目管理'),
    category_icon='fa-wrench')


class test(SupersetModelView):
    datamodel = SQLAInterface(models.test)
    list_columns = ['id', 'name', 'parent_id']
    add_form_extra_fields = {
        "second_category": QuerySelectField(
            "Table",
            query_func=lambda: db.session().query(models.SecondCategory),
            get_pk_func=lambda a: a.id, get_label=lambda a: a.category_name + "eee" + a.top_category.category_name,
        )
    }


# appbuilder.add_view(
#     test,
#     'test',
#     label=__('test'),
#     icon='fa-wrench',
#     category='Category Manage',
#     category_label=__('Category Manage'),
#     category_icon='fa-wrench')

class CkeditorUploadApi(SimpleFormView):
    # datamodel = SQLAInterface(models.test)
    form = CkeUploadImgForm

    @expose("/upload", methods=['POST'])
    @has_access
    def form_post1(self):
        self._init_vars()
        form = self.form.refresh()
        extension_list = ['.png', '.jpg', '.gif']
        img_file = form.upload.data
        # form.upload.data.filename = secure_filename(form.upload.data.filename)
        extension = os.path.splitext(form.upload.data.filename)[1]
        if extension not in extension_list:
            return json.dumps({"error": {"message": "不支持的类型"}})
        img_filename = str(uuid.uuid4())
        pattern = re.compile(r"-*")
        img_filename = pattern.sub("", img_filename) + extension
        try:
            img_file.save(os.path.join(config['UPLOAD_FOLDER'], img_filename))
        except Exception as e:
            try:
                os.remove(os.path.join(config['UPLOAD_FOLDER'], img_filename))
            except OSError:
                pass
            return json.dumps({"error": {"message": str(e)}})
        file_url = "/ckeditoruploadapi/images/" + img_filename
        return json.dumps({"url": file_url, "uploaded": 1})

    @expose("/images/<img_filename>", methods=['GET'])
    @has_access
    def get_image(self, img_filename):
        from flask import (send_file)
        file_url = os.path.join(config['UPLOAD_FOLDER'], img_filename)
        return send_file(file_url, mimetype='image/*')


appbuilder.add_view_no_menu(CkeditorUploadApi)


class IndexManage(BaseSupersetView):
    """指标管理页面视图"""

    @expose('/list/<varicode>', methods=['GET', 'POST'])
    @has_access
    def index(self, varicode=None):
        INDEX_MANAGE = config.get('INDEX_MANAGE', {})
        if request.method == 'GET':
            try:
                database = db.session.query(models.Database).filter_by(
                    database_name=INDEX_MANAGE['paramsDbName']).first()
                sql = "SELECT param_name, index_table_name, data_table_name, db_name FROM index_params"
                del_param_name = ['price_diff', 'jfjs', 'fof', 'jinlong', 'quant', 'mind']
                df = database.get_df(sql, schema=None)
                df = df[~df['param_name'].isin(del_param_name)]
                db_dict = {row['param_name']: {
                    'index_table_name': row['index_table_name'],
                    'data_table_name': row['data_table_name'],
                    'db_name': row['db_name']
                } for row in df.to_dict('records')}
                return self.render_template('superset/index_manage.html',
                                            db_dict=json.dumps(db_dict),
                                            index_manage=json.dumps(INDEX_MANAGE))
            except Exception as e:
                flash(f"IndexManage Get出错: {str(e)}", "danger")
                print('IndexManage Get:', str(e))
                return self.render_template('superset/index_manage.html')
        else:
            try:
                def update_order(engineobj, data_table_name, sql, index_name, index_type, update_type):
                    sql_final = ''
                    sql = re.sub(r'select', f"select '{index_type}','{index_name}',", sql[:8],
                                 flags=re.IGNORECASE) + sql[-len(sql) + 8:]
                    print('指标语句:', sql)
                    if update_type == '覆盖':
                        sql_final = f"DELETE FROM {data_table_name} WHERE {INDEX_MANAGE['indexNameField']}='{index_name}'; "

                    sql_final = sql_final + f" INSERT INTO {data_table_name} ({INDEX_MANAGE['indexTypeField']}," \
                                            f"{INDEX_MANAGE['indexNameField']},{INDEX_MANAGE['dateField']},{INDEX_MANAGE['valueField']}) " + sql
                    print('sql_final:', sql_final)
                    engineobj.execute(sql_final)

                json_data = request.get_json()
                action = json_data.get('action')
                dbinfo = json_data.get('dbinfo')
                if action == 'get_index_list':
                    database = db.session.query(models.Database).filter_by(database_name=dbinfo['db_name']).first()
                    sql = "SELECT table_id,指标分类,指标id,指标名称,指标来源,指标说明,指标语句,增加方式,更新次序,更新时间,刷新语句,wind指标项,栏目类别 FROM " + \
                          dbinfo['index_table_name']
                    df = database.get_df(sql, schema=None)
                    df = df.fillna('')
                    data_dict = df.to_dict('records') if not df.empty else []
                    return json_success(json.dumps(data_dict, default=str, ensure_ascii=False))

                elif action == 'add_index':
                    formData = json_data.get('formData')
                    shouldCalculate = json_data.get('shouldCalculate', False)
                    database = db.session.query(models.Database).filter_by(database_name=dbinfo['db_name']).first()
                    columns = ['指标分类', '指标id', '指标名称', '指标来源', '指标说明', '指标语句', '增加方式',
                               '更新次序', '更新时间', '刷新语句', 'wind指标项', '栏目类别']
                    values = [formData.get(col, '') for col in columns]

                    if not values[7]:
                        values[7] = None
                    if not values[8]:
                        values[8] = None
                    values[5] = aes_decrypt(values[5])
                    placeholders = ','.join(['%s' for _ in columns])
                    sql = f"INSERT INTO {dbinfo['index_table_name']} ({','.join(columns)}) VALUES ({placeholders}) RETURNING table_id"
                    print(sql)
                    db_engine = database.get_sqla_engine()
                    result = db_engine.execute(sql, values)
                    table_id = result.scalar()
                    if shouldCalculate and len(values[5]) > 20 and len(values[6]):
                        update_order(db_engine, dbinfo['data_table_name'], values[5], values[2], values[0], values[6])
                    return json_success(json.dumps({'table_id': int(table_id)}, ensure_ascii=False))

                elif action == 'edit_index':
                    formData = json_data.get('formData')
                    table_id = json_data.get('table_id')
                    database = db.session.query(models.Database).filter_by(database_name=dbinfo['db_name']).first()
                    # 构建更新SQL语句
                    columns = ['指标分类', '指标id', '指标名称', '指标来源', '指标说明', '指标语句', '增加方式',
                               '更新次序', '更新时间', '刷新语句', 'wind指标项', '栏目类别']
                    values = [formData.get(col, '') for col in columns]

                    if not values[7]:
                        values[7] = None
                    if not values[8]:
                        values[8] = None
                    values[5] = aes_decrypt(values[5])
                    set_clause = ','.join([f"{col}=%s" for col in columns])
                    sql = f"UPDATE {dbinfo['index_table_name']} SET {set_clause} WHERE table_id=%s"
                    # 添加table_id到参数列表
                    values.append(table_id)
                    db_engine = database.get_sqla_engine()
                    db_engine.execute(sql, values)
                    return json_success(json.dumps({'success': True}, ensure_ascii=False))

                elif action == 'delete_index':
                    table_id = json_data.get('table_id')
                    database = db.session.query(models.Database).filter_by(database_name=dbinfo['db_name']).first()
                    sql = f"DELETE FROM {dbinfo['index_table_name']} WHERE table_id=%s"
                    db_engine = database.get_sqla_engine()
                    db_engine.execute(sql, [table_id])
                    return json_success(json.dumps({'success': True}, ensure_ascii=False))

                elif action == 'update_index':
                    rowData = json_data.get('rowData')
                    shouldCalculate = True
                    database = db.session.query(models.Database).filter_by(database_name=dbinfo['db_name']).first()
                    db_engine = database.get_sqla_engine()
                    columns = ['table_id', '指标分类', '指标id', '指标名称', '指标来源', '指标语句', '增加方式',
                               '更新时间', '刷新语句', 'wind指标项']
                    values = [rowData.get(col, '') for col in columns]
                    values[5] = aes_decrypt(values[5])
                    if shouldCalculate and len(values[5]) > 20 and len(values[6]):
                        update_order(db_engine, dbinfo['data_table_name'], values[5], values[3], values[1], values[6])
                    return json_success(json.dumps({'success': True}, ensure_ascii=False))

                elif action == 'preview_data':
                    sql = json_data.get('sqlStatement')
                    sql = aes_decrypt(sql)
                    database = db.session.query(models.Database).filter_by(database_name=dbinfo['db_name']).first()
                    df = database.get_df(sql, schema=None)
                    df = df.sort_values(by='日期', ascending=False)
                    df['日期'] = df['日期'].dt.strftime('%Y%m%d %H:%M')
                    df = df.head(1000)
                    data_dict = df.to_dict('records') if not df.empty else []
                    return json_success(json.dumps(data_dict, default=str, ensure_ascii=False))

                elif action == 'delete_index_data':
                    index_name = json_data.get('indexName')
                    database = db.session.query(models.Database).filter_by(database_name=dbinfo['db_name']).first()
                    sql = f"DELETE FROM {dbinfo['data_table_name']} WHERE {INDEX_MANAGE['indexNameField']}='{index_name}';"
                    db_engine = database.get_sqla_engine()
                    db_engine.execute(sql)
                    return json_success(json.dumps({'success': True}, ensure_ascii=False))

                elif action == 'get_index_by_tablename':
                    table_name = json_data.get('table_name')
                    database = db.session.query(models.Database).filter_by(database_name=dbinfo['db_name']).first()
                    sql = f"SELECT 指标名称 as value, 指标名称 as label FROM {table_name} group by 指标名称"
                    df = database.get_df(sql, schema=None)
                    data_dict = df.to_dict('records') if not df.empty else []
                    return json_success(json.dumps(data_dict, default=str, ensure_ascii=False))
            except Exception as e:
                print(e)
                return json_error_response(f"请求失败: {str(e)}")


appbuilder.add_view_no_menu(IndexManage)


class IndexDataManage(BaseSupersetView):
    """指标管理页面视图1"""

    @expose('/list/<varicode>', methods=['GET', 'POST'])
    @has_access
    def index(self, varicode=None):
        INDEX_MANAGE = config.get('INDEX_MANAGE', {})
        user_id = g.user.id
        print('user_id:', user_id)
        if request.method == 'GET':
            try:
                database = db.session.query(models.Database).filter_by(
                    database_name=INDEX_MANAGE['paramsDbName']).first()
                sql = "SELECT param_name, index_table_name, data_table_name, db_name FROM index_params"
                del_param_name = ['price_diff', 'jfjs', 'fof', 'jinlong', 'quant', 'mind']
                df = database.get_df(sql, schema=None)
                df = df[~df['param_name'].isin(del_param_name)]
                db_dict = {row['param_name']: {
                    'index_table_name': row['index_table_name'],
                    'data_table_name': row['data_table_name'],
                    'db_name': row['db_name']
                } for row in df.to_dict('records')}
                return self.render_template('superset/index_data_manage.html',
                                            db_dict=json.dumps(db_dict),
                                            index_manage=json.dumps(INDEX_MANAGE))
            except Exception as e:
                flash(f"IndexManage Get出错: {str(e)}", "danger")
                return self.render_template('superset/index_data_manage.html')
        else:
            try:
                def update_order(engineobj, data_table_name, sql, index_name, index_type, update_type):
                    sql_final = ''
                    sql = re.sub(r'select', f"select '{index_type}','{index_name}',", sql[:8],
                                 flags=re.IGNORECASE) + sql[-len(sql) + 8:]
                    print('指标语句:', sql)
                    if update_type == '覆盖':
                        sql_final = f"DELETE FROM {data_table_name} WHERE {INDEX_MANAGE['indexNameField']}='{index_name}'; "

                    sql_final = sql_final + f" INSERT INTO {data_table_name} ({INDEX_MANAGE['indexTypeField']}," \
                                            f"{INDEX_MANAGE['indexNameField']},{INDEX_MANAGE['dateField']},{INDEX_MANAGE['valueField']}) " + sql
                    print('sql_final:', sql_final)
                    engineobj.execute(sql_final)

                json_data = request.get_json()
                action = json_data.get('action')
                dbinfo = json_data.get('dbinfo')
                if action == 'get_index_list':
                    # 所有库的指标列表union成视图表了，新增了 数据库、品种、指标列表、数据表、指标说明 5个字段
                    database = db.session.query(models.Database).filter_by(database_name=INDEX_MANAGE['paramsDbName']).first()
                    sql = "SELECT table_id,指标id,指标名称,指标来源,栏目类别,计算配置,数据库,品种,指标列表,数据表,指标说明 FROM 视图_全站指标管理"
                    if 'localhost' and '192.168' in request.url:
                        sql = "SELECT table_id,指标id,指标名称,指标来源,栏目类别,计算配置,数据库,品种,指标列表,数据表,指标说明 FROM 视图_全站指标管理 where 品种 in ('红枣','贵金属')"
                    # 判断用户是否包含角色only_show_dashboards_test，该角色目前用于指定用户测试，core.py里也有判断
                    if 'only_show_dashboards_test' in [x.name for x in g.user.roles]:
                        sql = "SELECT table_id,指标id,指标名称,指标来源,栏目类别,计算配置,数据库,品种,指标列表,数据表,指标说明 FROM 视图_全站指标管理_测试"
                    df_index = database.get_df(sql, schema=None)
                    df_index['指标说明'] = df_index['指标说明'].fillna('')
                    df_index = df_index[~df_index['指标说明'].str.contains('停')]
                    df_index = df_index.dropna(subset=['指标名称'])
                    df_index = df_index.drop_duplicates(subset=['数据库', '指标名称'])

                    # 计算配置转换为字典,如果计算配置为空,则设置为空字典
                    df_index['计算配置'] = df_index['计算配置'].apply(lambda x: json.loads(x) if x else {})
                    df_index['栏目类别'] = df_index['栏目类别'].fillna('未分类')
                    df_index['栏目类别'] = df_index['栏目类别'].replace('', '未分类')
                    df_index['key'] = df_index['数据库'] + '|' + df_index['指标列表'] + '|' + df_index['数据表'] + '|' + \
                                      df_index['table_id'].astype(str)
                    df_index = df_index.fillna('')
                    df_index = df_index.drop_duplicates(subset=['指标名称'])

                    cols_dict = ['品种', '数据库', '指标列表', '数据表']
                    db_map = {}
                    for variety, group in df_index.groupby('品种'):
                        row = group[cols_dict].iloc[0].to_dict()
                        category_list = group['栏目类别'].dropna().unique().tolist()
                        db_map[variety] = {
                            **row,
                            "栏目类别": category_list
                        }

                    index_data_list = df_index.to_dict('records') if not df_index.empty else []
                    result_data = {'indexDataList': index_data_list, 'treeNodeDict': [], 'db_map': db_map}
                    # 开始生成 ReactTreeVirtualized 数据
                    node_map = {}
                    node_list = []
                    for _, row in df_index.iterrows():
                        categories = row['栏目类别'].strip().split('|')
                        path_parts = []
                        current_children = node_list
                        for cat in categories:
                            cat = cat.strip()
                            path_parts.append(cat)
                            full_path = "|".join(path_parts)
                            if full_path in node_map:
                                node = node_map[full_path]
                            else:
                                node = {'name': cat, 'key': full_path, 'children': []}
                                node_map[full_path] = node
                                current_children.append(node)
                            current_children = node['children']
                        # 叶子节点
                        current_children.append({'name': row['指标名称'], 'key': row['key']})
                    if len(node_list):
                        tree_node_dict = {"name": "目录", "key": "root", "children": node_list}
                        result_data['treeNodeDict'] = tree_node_dict
                    return json_success(json.dumps(result_data, default=str, ensure_ascii=False))

                elif action == 'add_index':
                    indexinfo = json_data.get('indexinfo')
                    shouldCalculate = indexinfo.get('isCalculate', False)
                    database = db.session.query(models.Database).filter_by(database_name=indexinfo['数据库']).first()
                    columns = ['指标分类', '指标id', '指标名称', '指标来源', '指标语句', '增加方式', '更新次序',
                               '栏目类别', '计算配置']
                    values = [indexinfo.get(col, '') for col in columns]
                    values[0] = indexinfo['品种']
                    values[5] = '覆盖'
                    values[6] = 1
                    values[4] = aes_decrypt(values[4])
                    child_index = values[8].get("childIndex", {})
                    # 调整child_index保留必要属性写入计算配置字段
                    if child_index:
                        for key, value in child_index.items():
                            value = {'key': value.get('key', ''), '指标名称': value.get('指标名称', '')}
                            child_index[key] = value
                    values[8] = json.dumps(values[8], ensure_ascii=False)
                    placeholders = ','.join(['%s' for _ in columns])
                    sql = f"INSERT INTO {indexinfo['指标列表']} ({','.join(columns)}) VALUES ({placeholders}) RETURNING table_id"
                    print(sql)
                    db_engine = database.get_sqla_engine()
                    result = db_engine.execute(sql, values)
                    table_id = result.scalar()
                    if shouldCalculate and len(values[4]) > 20:
                        update_order(db_engine, indexinfo['数据表'], values[4], values[2], values[0], values[5])
                    return json_success(json.dumps({'table_id': int(table_id)}, ensure_ascii=False))

                elif action == 'delete_index':
                    indexinfo = json_data.get('indexinfo')
                    dbinfo_list = indexinfo['key'].split('|')
                    database = db.session.query(models.Database).filter_by(database_name=dbinfo_list[0]).first()
                    sql = f"DELETE FROM {dbinfo_list[2]} WHERE {INDEX_MANAGE['indexNameField']}=%s;"
                    db_engine = database.get_sqla_engine()
                    db_engine.execute(sql, [indexinfo['index_name']])
                    sql = f"DELETE FROM {dbinfo_list[1]} WHERE table_id=%s"
                    db_engine.execute(sql, [int(dbinfo_list[3])])
                    return json_success(json.dumps({'success': True}, ensure_ascii=False))

                elif action == 'edit_index':
                    indexinfo = json_data.get('indexinfo')
                    database = db.session.query(models.Database).filter_by(database_name=indexinfo['数据库']).first()
                    columns = ['指标语句']
                    values = [indexinfo.get(col, '') for col in columns]
                    table_id = indexinfo.get('table_id')
                    index_name = indexinfo.get('指标名称')
                    index_type = indexinfo['品种']
                    update_type = '覆盖'
                    values[0] = aes_decrypt(values[0])
                    values.append(table_id)
                    set_clause = ','.join([f"{col}=%s" for col in columns])
                    sql = f"UPDATE {indexinfo['指标列表']} SET {set_clause} WHERE table_id=%s"
                    db_engine = database.get_sqla_engine()
                    db_engine.execute(sql, values)
                    if len(values[0]) > 20:
                        update_order(db_engine, indexinfo['数据表'], values[0], index_name, index_type, update_type)
                    return json_success(json.dumps({'success': True}, ensure_ascii=False))

                elif action == 'get_index_data':
                    # table_name = dbinfo['data_table_name']
                    index_list = json_data.get('indexlist')

                    index_list_by_full_table_name = defaultdict(list)
                    df_calculate_merge = pd.DataFrame()
                    database = db.session.query(models.Database).filter_by(
                        database_name=INDEX_MANAGE['paramsDbName']).first()
                    for index in index_list:
                        if index['is_calculate']:
                            df_calculate = database.get_df(aes_decrypt(index['指标语句']), schema=None)
                            df_calculate['indexname'] = index['index_name']
                            df_calculate_merge = pd.concat([df_calculate_merge, df_calculate])
                        else:
                            index_list_by_full_table_name[index['数据表']].append(index['index_name'])
                    if len(index_list_by_full_table_name.keys()):
                        for full_table_name, index_name_list in index_list_by_full_table_name.items():
                            index_values_normal = ",".join(
                                ["'" + index_name.replace("'", "''") + "'" for index_name in index_name_list])
                            sql = (
                                f"SELECT {INDEX_MANAGE['dateField']} AS 日期,"
                                f"{INDEX_MANAGE['indexNameField']} AS indexname,"
                                f"{INDEX_MANAGE['valueField']} AS 价格 "
                                f"FROM {full_table_name} "
                                f"WHERE {INDEX_MANAGE['indexNameField']} IN ({index_values_normal})"
                            )
                            df = database.get_df(sql, schema=None)
                            df_calculate_merge = pd.concat([df_calculate_merge, df])
                    if not df_calculate_merge.empty:
                        df_calculate_merge = df_calculate_merge.drop_duplicates(subset=['日期', 'indexname'])
                        df_calculate_merge = df_calculate_merge.pivot(index='日期', columns='indexname', values='价格')
                        df_calculate_merge = df_calculate_merge.fillna('')
                        data_dict = df_calculate_merge.to_dict(orient='split') if not df_calculate_merge.empty else []
                        return json_success(json.dumps({'dataDict': data_dict}, default=str, ensure_ascii=False))
                    else:
                        return json_success(json.dumps({'dataDict': []}, default=str, ensure_ascii=False))
            except Exception as e:
                print(e)
                return json_error_response(f"请求失败: {str(e)}")


appbuilder.add_view_no_menu(IndexDataManage)


class ReportsDataManage(BaseSupersetView):
    """报告数据管理页面视图"""
    reports_init_data = config.get('REPORTS_INIT_DATA', {})

    @expose('/list', methods=['GET', 'POST'])
    @has_access
    def index(self):
        page_name = 'reportsDataManage'
        if request.method == 'GET':
            try:
                return self.render_template('superset/reports_data_manage.html',
                                            init_data_dict=json.dumps(self.reports_init_data), page_name=page_name)
            except Exception as e:
                flash(f"ReportsDataManage Get出错: {str(e)}", "danger")
                return self.render_template('superset/reports_data_manage.html',
                                            init_data_dict=json.dumps(self.reports_init_data), page_name=page_name)
        else:
            try:
                action = request.form.get('action') or request.json.get('action')

                if action == 'get_reports':
                    return self._get_reports()
                elif action == 'upload_cover':
                    return self._upload_cover()
                elif action == 'upload_report_file':
                    return self._upload_report_file()
                elif action == 'add_report':
                    return self._add_report()
                elif action == 'update_report':
                    return self._update_report()
                elif action == 'delete_report':
                    return self._delete_report()
                else:
                    return json_error_response("未知的操作类型")
            except Exception as e:
                print(traceback.format_exc())
                return json_error_response(f"请求失败: {str(e)}")

    def _get_reports(self):
        """获取报告列表"""
        try:
            sql = """
                SELECT id, report_title, report_subtitle, variety_section, variety, 
                       report_type, report_public_date, author, 
                       report_file_origin_name, upload_time, report_file_suffix
                FROM reports 
                where report_public_date >= CURRENT_DATE - INTERVAL '3 years'
                ORDER BY upload_time DESC
            """
            df_reports = pd.read_sql(sql, db.engine)
            reports_data = df_reports.to_dict('records') if not df_reports.empty else []
            return json_success(json.dumps({'reports_data': reports_data}, default=str, ensure_ascii=False))
        except Exception as e:
            print(traceback.format_exc())
            return json_error_response(f"获取报告列表失败: {str(e)}")

    def _upload_cover(self):
        """上传封面图"""
        try:
            if 'file' not in request.files:
                return json_error_response("未找到上传文件")

            file = request.files['file']
            author = request.form.get('author', 'unknown')

            if file.filename == '':
                return json_error_response("文件名为空")

            allowed_extensions = {'jpg', 'jpeg', 'png'}
            file_ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
            if file_ext not in allowed_extensions:
                return json_error_response("不支持的文件类型，只支持 jpg/png")

            # 生成文件名: uuid_ymd.后缀
            file_uuid = str(uuid.uuid4()).replace('-', '')[8:20]
            ymd = datetime.now().strftime('%Y%m%d')
            new_filename = f"{file_uuid}_{ymd}.{file_ext}"

            upload_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'assets', 'images', 'reports_covers')
            if not os.path.exists(upload_dir):
                os.makedirs(upload_dir)

            file_path = os.path.join(upload_dir, new_filename)
            file.save(file_path)

            file_url = f"/static/assets/images/reports_covers/{new_filename}"

            return jsonify({'success': True, 'file_url': file_url})
        except Exception as e:
            print(traceback.format_exc())
            return json_error_response(f"封面图上传失败: {str(e)}")

    def _upload_report_file(self):
        """直接保存报告；PPTX 原件保留，同名 PDF 用于预览和下载。"""
        try:
            file = request.files.get('file')
            if file is None or not file.filename:
                return json_error_response("未找到上传文件", status=400)

            origin_name = file.filename.replace('\\', '/').rsplit('/', 1)[-1]
            file_ext = os.path.splitext(origin_name)[1].lower()
            if file_ext not in {'.pdf', '.pptx'}:
                return json_error_response("不支持的文件类型，只支持 pdf/pptx", status=400)

            file.stream.seek(0, os.SEEK_END)
            file_size = file.stream.tell()
            file.stream.seek(0)
            if not file_size:
                return json_error_response("报告文件为空", status=400)
            if file_ext == '.pdf' and file_size > 20 * 1024 * 1024:
                return json_error_response("PDF文件大小不能超过 20MB", status=400)
            if file_ext == '.pdf':
                try:
                    with fitz.open(stream=file.read(), filetype='pdf') as document:
                        if not document.is_pdf or document.needs_pass or not document.page_count:
                            raise ValueError()
                except Exception:
                    return json_error_response("PDF文件无效、已加密或没有页面", status=400)
                file.stream.seek(0)

            upload_dir = os.path.join(os.path.dirname(__file__), 'reports_upload')
            os.makedirs(upload_dir, exist_ok=True)
            file_uuid = uuid.uuid4().hex
            file_path = os.path.join(upload_dir, file_uuid + file_ext)
            file.save(file_path)

            pdf_path = os.path.join(upload_dir, file_uuid + '.pdf')
            if file_ext == '.pptx':
                self._convert_pptx_to_pdf(file_path, pdf_path)

            return jsonify({
                'success': True,
                'file_uuid': file_uuid,
                'file_origin_name': os.path.splitext(origin_name)[0] + '.pdf',
                'file_suffix': 'pdf',
            })
        except Exception:
            logging.exception("报告文件上传或转换失败")
            return json_error_response("报告文件上传或转换失败，请检查文件及转换组件")

    def _get_libreoffice_executable(self):
        """优先查找 PATH，Windows 同时兼容 LibreOffice 默认安装目录。"""
        import shutil

        names = ('soffice.com', 'soffice.exe') if sys.platform == 'win32' else ('libreoffice', 'soffice')
        for name in names:
            executable = shutil.which(name)
            if executable:
                return executable
        if sys.platform == 'win32':
            for root in (os.environ.get('ProgramW6432'),
                         os.environ.get('ProgramFiles', r'C:\Program Files'),
                         os.environ.get('ProgramFiles(x86)', r'C:\Program Files (x86)')):
                if root:
                    for name in names:
                        executable = os.path.join(root, 'LibreOffice', 'program', name)
                        if os.path.isfile(executable):
                            return executable
        raise RuntimeError("未找到 LibreOffice，请检查安装目录或服务进程的 PATH")

    def _convert_pptx_to_pdf(self, pptx_path, pdf_path):
        """使用 LibreOffice 无界面转换，校验完整性后保存 PDF，保留 PPTX 原件。"""
        from pathlib import Path
        from pptx import Presentation
        import signal
        import subprocess
        import tempfile

        pptx_path = Path(pptx_path).resolve()
        pdf_path = Path(pdf_path).resolve()
        slide_count = len(Presentation(str(pptx_path)).slides)
        if not slide_count:
            raise ValueError("PPTX 没有幻灯片")
        executable = self._get_libreoffice_executable()

        # 配置和输出均按请求隔离，避免复用桌面实例、配置锁冲突和残留 PDF。
        with tempfile.TemporaryDirectory(prefix='reports-libreoffice-', dir=pdf_path.parent) as directory:
            work_dir = Path(directory)
            profile_dir = work_dir / 'profile'
            profile_user_dir = profile_dir / 'user'
            profile_user_dir.mkdir(parents=True)
            # 使用 7.3 也支持的配置文件，完整导出含隐藏页的报告。
            (profile_user_dir / 'registrymodifications.xcu').write_text(
                '<?xml version="1.0" encoding="UTF-8"?>'
                '<oor:items xmlns:oor="http://openoffice.org/2001/registry">'
                '<item oor:path="/org.openoffice.Office.Common/Filter/PDF/Export">'
                '<prop oor:name="ExportHiddenSlides" oor:op="fuse">'
                '<value>true</value></prop></item></oor:items>', encoding='utf-8')
            command = [
                executable, '-env:UserInstallation=' + profile_dir.as_uri(),
                '--headless', '--nologo', '--nodefault', '--nofirststartwizard',
                '--convert-to', 'pdf:impress_pdf_Export', '--outdir', str(work_dir),
                str(pptx_path),
            ]
            options = ({'creationflags': subprocess.CREATE_NO_WINDOW} if sys.platform == 'win32'
                       else {'start_new_session': True})
            with subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                  stderr=subprocess.PIPE, **options) as process:
                try:
                    process.communicate(timeout=120)
                except subprocess.TimeoutExpired:
                    # 同时终止本次启动的 soffice 子进程，不影响其他转换或桌面实例。
                    if sys.platform == 'win32':
                        subprocess.run(
                            ['taskkill', '/PID', str(process.pid), '/T', '/F'],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                            creationflags=subprocess.CREATE_NO_WINDOW, check=False, timeout=10)
                    else:
                        try:
                            os.killpg(process.pid, signal.SIGKILL)
                        except ProcessLookupError:
                            pass
                    process.communicate(timeout=10)
                    raise RuntimeError("LibreOffice 转换超时（120 秒）") from None
                if process.returncode:
                    raise RuntimeError("LibreOffice 转换失败（退出码 {}）".format(process.returncode))

            converted_path = work_dir / (pptx_path.stem + '.pdf')
            if not converted_path.is_file():
                raise ValueError("LibreOffice 未生成 PDF，请检查 PPTX 文件")
            # 从内存校验，避免损坏 PDF 在 Windows 上打开失败后仍占用临时文件。
            with fitz.open(stream=converted_path.read_bytes(), filetype='pdf') as document:
                if not document.is_pdf or document.needs_pass or document.page_count != slide_count:
                    raise ValueError("PPTX 转换结果不完整")
            os.replace(converted_path, pdf_path)

    def _get_uploaded_pdf(self, data):
        """只接受服务器生成的文件标识，不接受客户端提供的本地路径。"""
        file_uuid = data.get('report_file_url')
        if (not isinstance(file_uuid, str)
                or not re.fullmatch(r'[0-9a-f]{32}', file_uuid)
                or data.get('report_file_suffix') != 'pdf'):
            raise ValueError("报告文件标识无效，请重新上传")
        pdf_path = os.path.join(os.path.dirname(__file__), 'reports_upload', file_uuid + '.pdf')
        if not os.path.isfile(pdf_path):
            raise ValueError("报告文件不存在，请重新上传")
        return pdf_path

    def _get_oss_upload_credentials(self):
        """保留 OSS STS 临时上传凭证逻辑，当前上传流程不调用。"""
        try:
            file_ext = request.form.get('file_ext', '').lower().strip('.')
            file_origin_name = request.form.get('file_origin_name', '')

            allowed_extensions = {'pdf', 'mp4'}
            if file_ext not in allowed_extensions:
                return json_error_response("不支持的文件类型，只支持 pdf/mp4")

            file_uuid = str(uuid.uuid4()).replace('-', '')
            if file_ext == 'pdf':
                oss_key = f"pdfs/{file_uuid}.pdf"
            else:
                oss_key = f"videos/{file_uuid}.mp4"

            client = AcsClient(
                config['OSS_FILE_ACCESS_KEY_ID'],
                config['OSS_FILE_ACCESS_KEY_SECRET'],
                config['OSS_FILE_REGION'],
            )
            assume_role_request = AssumeRoleRequest()
            assume_role_request.set_accept_format('json')
            assume_role_request.set_RoleArn(config['OSS_FILE_ARN'])
            assume_role_request.set_RoleSessionName('report-upload-session')
            assume_role_request.set_DurationSeconds(1800)

            response = client.do_action_with_exception(assume_role_request)
            credentials = json.loads(response)['Credentials']

            return jsonify({
                'success': True,
                'accessKeyId': credentials['AccessKeyId'],
                'accessKeySecret': credentials['AccessKeySecret'],
                'stsToken': credentials['SecurityToken'],
                'expiration': credentials['Expiration'],
                'file_uuid': file_uuid,
                'oss_key': oss_key,
                'bucket': config['OSS_BUCKET_FILES'],
                'endpoint': f"https://{config['OSS_ENDPOINT']}",
                'file_origin_name': file_origin_name,
                'file_suffix': file_ext,
            })
        except Exception as e:
            print(traceback.format_exc())
            return json_error_response(f"获取上传凭证失败: {str(e)}")

    def _download_from_oss(self, oss_key):
        """从OSS下载文件到本地reports_upload目录，返回本地文件路径"""
        try:
            auth = oss2.Auth(config['OSS_FILE_ACCESS_KEY_ID'], config['OSS_FILE_ACCESS_KEY_SECRET'])
            endpoint = f"https://{config['OSS_ENDPOINT']}"
            bucket = oss2.Bucket(auth, endpoint, config['OSS_BUCKET_FILES'])

            upload_dir = os.path.join(os.path.dirname(__file__), 'reports_upload')
            if not os.path.exists(upload_dir):
                os.makedirs(upload_dir)

            local_filename = os.path.basename(oss_key)
            local_path = os.path.join(upload_dir, local_filename)
            bucket.get_object_to_file(oss_key, local_path)
            return local_path
        except Exception as e:
            print(f"从OSS下载文件失败: {str(e)}")
            print(traceback.format_exc())
            return None

    def _generate_cover_from_pdf(self, pdf_file_path, png_width=800):
        """
        从PDF文件的第一页生成PNG封面图
        
        Args:
            pdf_file_path: PDF文件的完整路径
            png_width: 生成PNG图片的宽度（像素），默认800
            
        Returns:
            生成的PNG文件的URL路径，格式如: /static/assets/images/reports_covers/xxx.png
        """
        try:
            # 固定截取完整第一页，按目标宽度等比例缩放。
            with fitz.open(pdf_file_path) as pdf_document:
                first_page = pdf_document[0]
                zoom = png_width / first_page.rect.width
                pix = first_page.get_pixmap(matrix=fitz.Matrix(zoom, zoom))

            # ---------- 保存 ----------
            file_uuid = str(uuid.uuid4()).replace('-', '')
            new_filename = f"{file_uuid}_auto.png"
            save_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'assets', 'images', 'reports_covers')
            os.makedirs(save_dir, exist_ok=True)
            png_file_path = os.path.join(save_dir, new_filename)
            pix.save(png_file_path)
            file_url = f"/static/assets/images/reports_covers/{new_filename}"
            return file_url

        except Exception as e:
            print(f"从PDF生成封面图失败: {str(e)}")
            print(traceback.format_exc())
            return None

    def _add_report(self):
        """新增报告"""
        try:
            data = request.json

            # 检查是否需要自动生成封面图
            cover_img_url = data.get('cover_img_url')
            local_pdf_path = self._get_uploaded_pdf(data)
            if not cover_img_url:
                cover_img_url = self._generate_cover_from_pdf(local_pdf_path, png_width=1080)

            sql = """
                INSERT INTO reports (
                    report_title, report_subtitle, variety_section, variety,
                    description, report_type, report_public_date, author,
                    cover_img_url, report_file_url, report_file_origin_name,
                    report_file_suffix, user_id, upload_time, oss_key
                ) VALUES (
                    :report_title, :report_subtitle, :variety_section, :variety,
                    :description, :report_type, :report_public_date, :author,
                    :cover_img_url, :report_file_url, :report_file_origin_name,
                    :report_file_suffix, :user_id, :upload_time, :oss_key
                )
            """

            params = {
                'report_title': data.get('report_title'),
                'report_subtitle': data.get('report_subtitle', ''),
                'variety_section': data.get('variety_section'),
                'variety': data.get('variety'),
                'description': data.get('description'),
                'report_type': data.get('report_type'),
                'report_public_date': data.get('report_public_date'),
                'author': data.get('author'),
                'cover_img_url': cover_img_url,
                'report_file_url': local_pdf_path,
                'report_file_origin_name': data.get('report_file_origin_name'),
                'report_file_suffix': 'pdf',
                'oss_key': None,
                'user_id': g.user.id,
                'upload_time': datetime.now()
            }

            db.session.execute(sqla.text(sql), params)
            db.session.commit()

            return jsonify({'success': True, 'message': '新增成功'})
        except ValueError as e:
            db.session.rollback()
            return json_error_response(str(e), status=400)
        except Exception as e:
            db.session.rollback()
            logging.error("新增报告失败：%s", type(e).__name__)
            return json_error_response("新增报告失败，请稍后重试")

    def _update_report(self):
        """修改报告"""
        try:
            data = request.json
            report_id = data.get('id')

            if not report_id:
                return json_error_response("缺少报告ID")

            update_fields = []
            params = {'id': report_id}

            basic_fields = ['report_title', 'report_subtitle', 'variety_section', 'variety',
                            'description', 'report_type', 'report_public_date', 'author']
            for field in basic_fields:
                if field in data:
                    update_fields.append(f"{field} = :{field}")
                    params[field] = data[field]

            # 文件字段（只在有新上传时更新）
            cover_img_url = data.get('cover_img_url')
            if cover_img_url:
                update_fields.append("cover_img_url = :cover_img_url")
                params['cover_img_url'] = cover_img_url

            if 'report_file_url' in data and data['report_file_url']:
                local_pdf_path = self._get_uploaded_pdf(data)
                if not cover_img_url:
                    new_cover = self._generate_cover_from_pdf(local_pdf_path, png_width=1080)
                    if new_cover:
                        update_fields.append("cover_img_url = :cover_img_url")
                        params['cover_img_url'] = new_cover
                update_fields.append("report_file_url = :report_file_url")
                update_fields.append("report_file_origin_name = :report_file_origin_name")
                update_fields.append("report_file_suffix = :report_file_suffix")
                update_fields.append("oss_key = :oss_key")
                params['report_file_url'] = local_pdf_path
                params['report_file_origin_name'] = data['report_file_origin_name']
                params['report_file_suffix'] = 'pdf'
                params['oss_key'] = None

            if not update_fields:
                return json_error_response("没有要更新的字段")

            sql = f"UPDATE reports SET {', '.join(update_fields)} WHERE id = :id"
            db.session.execute(sqla.text(sql), params)
            db.session.commit()

            return jsonify({'success': True, 'message': '修改成功'})
        except ValueError as e:
            db.session.rollback()
            return json_error_response(str(e), status=400)
        except Exception as e:
            db.session.rollback()
            logging.error("修改报告失败：%s", type(e).__name__)
            return json_error_response("修改报告失败，请稍后重试")

    def _delete_report(self):
        """删除报告"""
        try:
            data = request.json
            report_id = data.get('id')

            if not report_id:
                return json_error_response("缺少报告ID")
            sql = "SELECT cover_img_url, report_file_url FROM reports WHERE id = :id"
            result = db.session.execute(sqla.text(sql), {'id': report_id}).fetchone()

            if not result:
                return json_error_response("报告不存在")

            cover_img_url = result[0]
            report_file_url = result[1]

            delete_sql = "DELETE FROM reports WHERE id = :id"
            db.session.execute(sqla.text(delete_sql), {'id': report_id})
            db.session.commit()

            # # 删除封面图文件
            # if cover_img_url:
            #     try:
            #         # cover_img_url格式: /static/assets/images/reports_covers/xxx.jpg
            #         # 转换为实际文件路径
            #         filename = os.path.basename(cover_img_url)
            #         cover_path = os.path.join(
            #             os.path.dirname(os.path.dirname(__file__)), 
            #             'assets', 'images', 'reports_covers', 
            #             filename
            #         )
            #         if os.path.exists(cover_path):
            #             os.remove(cover_path)
            #     except Exception as e:
            #         print(f"删除封面图文件失败: {str(e)}")

            # # 删除报告文件
            # if report_file_url:
            #     try:
            #         if os.path.exists(report_file_url):
            #             os.remove(report_file_url)
            #     except Exception as e:
            #         print(f"删除报告文件失败: {str(e)}")

            return jsonify({'success': True, 'message': '删除成功'})
        except Exception as e:
            db.session.rollback()
            print(traceback.format_exc())
            return json_error_response(f"删除报告失败: {str(e)}")

    @expose('/show/<file_type>', methods=['GET', 'POST'])
    @has_access
    def show(self, file_type):
        if request.method == 'GET':
            try:
                if 'Admin' in [x.name for x in g.user.roles]:
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
                return self.render_template('superset/reports_data_show.html',
                                            page_name='reportsDataShow',
                                            init_data_dict=json.dumps(self.reports_init_data),
                                            bootstrap_data=json.dumps(bootstrap_data),
                                            userId=g.user.id,
                                            current_top_category=top_category_data['top_category_arr_by_order'][0],
                                            current_sub_category=top_category_data['_sub_category'],
                                            top_category_lst=top_category_data['_top_category_lst_str'],
                                            top_category_dict=json.dumps(top_category_data['_top_category_dict']),
                                            second_category_list_order=json.dumps(
                                                top_category_data['second_category_list_order']),
                                            )
            except Exception as e:
                flash(f"ReportsDataShow Get出错: {str(e)}", "danger")
                return self.render_template('superset/reports_data_show.html',
                                            page_name='reportsDataShow',
                                            init_data_dict=json.dumps(self.reports_init_data)
                                            )
        else:
            try:
                request_data = request.get_json()
                action = request_data.get('action')
                if action == 'get_reports':
                    return self._get_reports_by_type(file_type)
                elif action == 'get_description_by_id':
                    return self._get_description_by_id(request_data.get('id'))
                elif action == 'get_ai_description_by_id':
                    return self._get_ai_description_by_id(request_data.get('id'))
                else:
                    return json_error_response("未知的操作类型")
            except Exception as e:
                print(traceback.format_exc())
                return json_error_response(f"操作失败: {str(e)}")

    def _get_ai_description_by_id(self, id):
        """根据ID获取报告ai生成的摘要描述"""
        try:
            sql = "SELECT description_ai, report_file_url FROM reports WHERE id = :id"
            result = db.engine.execute(sqla.text(sql), {'id': id}).fetchone()

            if not result:
                return json_error_response("报告不存在")

            description_ai = result[0]
            report_file_url = result[1]

            # 如果已有AI描述，直接返回
            if description_ai and description_ai.strip():
                return json_success(json.dumps({
                    'description_ai': description_ai
                }, ensure_ascii=False))

            # 如果没有AI描述，需要生成
            # 1. 提取PDF文本
            file_path = report_file_url
            if not os.path.exists(file_path):
                return json_error_response("PDF文件不存在")

            # 使用fitz提取PDF文本
            pdf_text = ""
            try:
                doc = fitz.open(file_path)
                for page in doc:
                    pdf_text += page.get_text()
                doc.close()
            except Exception as e:
                print(f"PDF文本提取失败: {str(e)}")
                return json_error_response(f"PDF文本提取失败: {str(e)}")

            if not pdf_text or len(pdf_text.strip()) < 10:
                return json_error_response("PDF内容为空或过短")

            app_index = 'reports-ai-desc'  # 报告摘要工作流
            workflow_client, error_response, status_code = get_dify_workflow_client_instance(app_index, config)

            if error_response:
                return error_response

            inputs = {"query": pdf_text}  # 限制文本长度，避免token超限

            try:
                dify_result = workflow_client.run_workflow(
                    inputs=inputs,
                    user=g.user.username if hasattr(g, 'user') else 'system',
                    response_mode="blocking"
                )

                # 提取AI生成的文本
                ai_text = ""
                if 'outputs' in dify_result:
                    outputs = dify_result['outputs']
                    if 'text' in outputs:
                        ai_text = outputs['text']

                if not ai_text:
                    return json_error_response("AI生成的摘要为空")

                # 3. 更新数据库
                update_sql = "UPDATE reports SET description_ai = :description_ai WHERE id = :id"
                db.session.execute(sqla.text(update_sql), {
                    'description_ai': ai_text,
                    'id': id
                })
                db.session.commit()

                # 4. 返回结果
                return json_success(json.dumps({
                    'description_ai': ai_text
                }, ensure_ascii=False))

            except Exception as e:
                db.session.rollback()
                print(f"Dify调用失败: {str(e)}")
                print(traceback.format_exc())
                return json_error_response(f"AI摘要生成失败: {str(e)}")

        except Exception as e:
            db.session.rollback()
            print(traceback.format_exc())
            return json_error_response(f"获取AI描述失败: {str(e)}")

    def _get_description_by_id(self, id):
        """根据ID获取报告描述"""
        try:
            sql = "SELECT description FROM reports WHERE id = :id"
            result = db.engine.execute(sqla.text(sql), {'id': id}).fetchone()
            description = result[0]
            # description 有可能是html标签，找到所有a标签，将a标签的直系父标签删除
            soup = BeautifulSoup(description, "html.parser")
            for a in soup.find_all('a'):
                a.parent.decompose()
            # 删掉没有内容的p标签
            for p in soup.find_all('p'):
                if not p.text.strip():
                    p.decompose()
            description = str(soup)
            return json_success(json.dumps({'description': description}, default=str, ensure_ascii=False))
        except Exception as e:
            print(traceback.format_exc())
            return json_error_response(f"获取报告描述失败: {str(e)}")

    def _get_reports_by_type(self, file_type):
        """根据文件类型获取报告列表"""
        try:
            if file_type == 'video':
                sql = """
                    SELECT id, report_title, report_subtitle, variety_section, variety, 
                           report_type, report_public_date, author, 
                           cover_img_url, report_file_suffix, report_file_origin_name 
                    FROM reports 
                    WHERE report_file_suffix = 'mp4'
                    and report_public_date >= CURRENT_DATE - INTERVAL '3 years'
                    ORDER BY report_public_date DESC, id desc
                """
            else:
                sql = """
                    SELECT id, report_title, report_subtitle, variety_section, variety, 
                           report_type, report_public_date, author, 
                           cover_img_url, report_file_suffix, report_file_origin_name 
                    FROM reports 
                    WHERE report_file_suffix != 'mp4'
                    and report_public_date >= CURRENT_DATE - INTERVAL '3 years'
                    ORDER BY report_public_date DESC, id desc
                """

            df_reports = pd.read_sql(sql, db.engine)
            reports_data = df_reports.to_dict('records') if not df_reports.empty else []
            return json_success(json.dumps({'reports_data': reports_data}, default=str, ensure_ascii=False))
        except Exception as e:
            print(traceback.format_exc())
            return json_error_response(f"获取报告列表失败: {str(e)}")

    @expose('/show/download', methods=['GET'])
    @has_access
    def download_report_file(self):
        """下载报告文件（GET方式）"""
        try:
            report_id = request.args.get('report_id')
            if not report_id:
                return json_error_response("缺少报告ID")
            sql = """
                SELECT report_file_url, report_file_origin_name, report_file_suffix 
                FROM reports 
                WHERE id = :report_id
            """
            result = db.engine.execute(sqla.text(sql), {'report_id': report_id}).fetchone()
            if not result:
                return json_error_response("报告不存在")
            report_info = dict(result)
            file_url = report_info['report_file_url']
            origin_name = report_info['report_file_origin_name']

            file_path = os.path.join(os.path.dirname(__file__), 'reports_upload', os.path.basename(file_url))

            if not os.path.exists(file_path):
                return json_error_response("文件不存在")

            response = make_response(send_file(
                file_path,
                mimetype='application/octet-stream',
                as_attachment=True
            ))

            filename_utf8 = parse.quote(origin_name)
            response.headers['Content-Disposition'] = f'attachment; filename*=UTF-8\'\'{filename_utf8}'
            return response
        except Exception as e:
            print(traceback.format_exc())
            return json_error_response(f"下载失败: {str(e)}")


    @log_this
    @expose('/show/content', methods=['GET'])
    @has_access
    def get_report_file_content(self):
        """获取报告内容（GET方式，用于PDF阅读和视频播放）"""
        try:
            report_id = request.args.get('report_id')
            if not report_id:
                return json_error_response("缺少报告ID")

            sql = """
                SELECT report_file_url, report_file_suffix, report_file_origin_name, oss_key 
                FROM reports 
                WHERE id = :report_id
            """
            result = db.engine.execute(sqla.text(sql), {'report_id': report_id}).fetchone()
            if not result:
                return json_error_response("报告不存在")
            report_info = dict(result)
            origin_name = report_info['report_file_origin_name']
            file_suffix = report_info['report_file_suffix']
            oss_key = report_info.get('oss_key')
            expire = 3600
            if oss_key and file_suffix == 'pdf':
                oss_key = f'pdfs/{oss_key}'
            elif oss_key and file_suffix == 'mp4':
                oss_key = f'videos/{oss_key}'
                expire = 10800

            if oss_key:
                oss_sign_url = generate_oss_preview_url(
                    access_key_id=config.get('OSS_FILE_ACCESS_KEY_ID'),
                    access_key_secret=config.get('OSS_FILE_ACCESS_KEY_SECRET'),
                    endpoint=f"https://{config.get('OSS_ENDPOINT')}",
                    bucket_name=config['OSS_BUCKET_FILES'],
                    object_key=oss_key,
                    origin_filename=origin_name,
                    expire=expire,
                )
                # 将oss_sign_url域名部分替换为OSS_FILE_CUSTOM_DOMAIN
                oss_sign_url = oss_sign_url.replace(f"{config['OSS_BUCKET_FILES']}.{config['OSS_ENDPOINT']}", config['OSS_FILE_CUSTOM_DOMAIN'])
                return redirect(oss_sign_url)

            file_url = report_info['report_file_url']
            file_path = os.path.join(os.path.dirname(__file__), 'reports_upload', os.path.basename(file_url))

            if not os.path.exists(file_path):
                return json_error_response("文件不存在")

            if file_suffix == 'pdf':
                mimetype = 'application/pdf'
            elif file_suffix == 'mp4':
                mimetype = 'video/mp4'
            else:
                mimetype = 'application/octet-stream'

            response = send_file(
                file_path,
                mimetype=mimetype,
                conditional=True
            )
            filename_utf8 = parse.quote(origin_name)
            response.headers['Content-Disposition'] = f'inline; filename*=UTF-8\'\'{filename_utf8}'
            return response
        except Exception as e:
            print(traceback.format_exc())
            return json_error_response(f"获取内容失败: {str(e)}")


appbuilder.add_view_no_menu(ReportsDataManage)


class PublicApi(BaseSupersetView):
    @csrf.exempt
    @expose('/apis/', methods=['POST'])
    def apis(self):
        try:
            payload = request.get_json(force=True)
            token = payload.get('token')
            action = payload.get('action')
            if not token or not action:
                return json_error_response("非法请求")
            if token != config['API_TOKEN']:
                return json_error_response("非法请求")
            if action == 'sync_reports' and payload.get('last_id'):
                return self._sync_reports(int(payload.get('last_id')))
            elif action == 'get_position_array' and payload.get('slices'):
                return self._get_position_array(payload.get('slices'))
            elif action == 'save_snapshot':
                return self._save_snapshot(payload.get('data'))
            elif action == 'data_integration':
                return self._data_integration(payload.get('data'))
            return json_error_response("非法请求")
        except Exception as e:
            print(traceback.format_exc())
            return json_error_response(f"请求失败: {str(e)}")
    def _sync_reports(self, last_id):
        """同步报告至中柏"""
        try:
            if not last_id:
                last_id = 999999999
            reports_sql = """
                SELECT id, report_title, report_subtitle, variety_section, variety, description,
                       report_type, report_public_date, oss_key,
                       cover_img_url, report_file_origin_name, report_file_suffix, upload_time 
                FROM reports 
                where id>:last_id and report_file_suffix='pdf'
            """
            reports_data = pd.read_sql(
                sqla.text(reports_sql),
                db.engine,
                params={'last_id': last_id},
            )
            reports_data = reports_data.to_dict('records') if not reports_data.empty else []
            return json_success(json.dumps({'reports_data': reports_data}, default=str, ensure_ascii=False))
        except Exception as e:
            print(traceback.format_exc())
            return json_error_response(f"同步报告失败: {str(e)}")
    
    def _save_snapshot(self, data):
        """保存快照"""
        try:
            """
            Create a current snapshot from rqdata
            接受一个json参数，将json保存到当前代码文件所在目录下的/data/json/current_snapshot.json文件中
            """
            current_dir = os.path.dirname(os.path.abspath(__file__))
            data_dir = os.path.join(current_dir, 'data', 'json')
            file_path = os.path.join(data_dir, 'current_snapshot.json')
            if not os.path.exists(data_dir):
                os.makedirs(data_dir)
            with open(file_path, 'w') as f:
                json.dump(data, f)
            return json_success(json.dumps({'message': '保存快照成功'}, default=str, ensure_ascii=False))
        except Exception as e:
            print(traceback.format_exc())
            return json_error_response(f"保存快照失败: {str(e)}")
    
    def _get_position_array(self, slices):
        session = db.session()
        # 提取唯一的 dashboard_id 和 slice_id
        dashboard_ids = list(set(int(s['dashboard_id']) for s in slices))
        slice_ids = list(set(int(s['slice_id']) for s in slices))
        # 批量查询 dashboard 和 slice
        dash_map = {
            d.id: d
            for d in session.query(models.Dashboard).filter(
                models.Dashboard.id.in_(dashboard_ids)
            ).all()
        }
        slice_map = {
            s.id: s
            for s in session.query(models.Slice).filter(
                models.Slice.id.in_(slice_ids)
            ).all()
        }

        result = []
        for item in slices:
            slice_id = int(item['slice_id'])
            dash_id = int(item['dashboard_id'])
            slice_obj = slice_map.get(slice_id)
            if not slice_obj:
                continue
            dash = dash_map.get(dash_id)
            position_array = (dash.position_array if dash and dash.position_array else [])

            item_dict = {
                "size_x": 16,
                "size_y": 16,
                "slice_id": slice_id,
                "slice_name": slice_obj.slice_name,
            }
            for pos_item in position_array:
                if int(pos_item.get('slice_id')) == slice_id:
                    pos_item_update = {"size_x": pos_item.get('size_x'), "size_y": pos_item.get('size_y')}
                    item_dict.update(pos_item_update)
                    break
            result.append(item_dict)

        return json_success(json.dumps(result))
    
    def _data_integration(self, data):
        """数据整合"""
        if not isinstance(data, dict):
            return json_error_response('数据整合失败: data 必须为对象', status=400)
        symbols = data.get('symbols')
        if not isinstance(symbols, list) or any(
                not isinstance(symbol, str) or not symbol.strip()
                for symbol in symbols):
            return json_error_response('数据整合失败: symbols 必须为指标名称列表', status=400)
        symbols = list(dict.fromkeys(symbols))
        if not symbols:
            return json_success(json.dumps({'data': []}, ensure_ascii=False))

        begin = data.get('begin') or '2000-01-01'
        end = data.get('end') or datetime.now().strftime('%Y-%m-%d')
        data_type = data.get('data_type', 'integration')
        try:
            begin = pd.Timestamp(begin)
            end = pd.Timestamp(end)
            if (pd.isna(begin) or pd.isna(end)
                    or begin.tzinfo is not None or end.tzinfo is not None
                    or begin > end):
                raise ValueError
            begin = begin.to_pydatetime()
            # Use an exclusive upper bound to include the entire end date.
            end = end.normalize().to_pydatetime() + timedelta(days=1)
        except (TypeError, ValueError, OverflowError):
            return json_error_response('数据整合失败: 日期范围无效', status=400)

        try:
            INDEX_MANAGE = config.get('INDEX_MANAGE', {})
            database = db.session.query(models.Database).filter_by(
                database_name=INDEX_MANAGE['paramsDbName']).first()
            if database is None:
                return json_error_response('数据整合失败: 未找到指标数据库')
            engine = database.get_sqla_engine()
            preparer = engine.dialect.identifier_preparer
            quote = preparer.quote_identifier
            symbols_param = sqla.bindparam('symbols', expanding=True)
            index_sql = sqla.text(
                f"SELECT DISTINCT {quote('指标名称')}, {quote('数据表')} "
                f"FROM {quote('视图_行情_全站指标列表')} "
                f"WHERE {quote('指标名称')} IN :symbols"
            ).bindparams(symbols_param)
            frames = []
            with engine.connect() as connection:
                df_index = pd.read_sql(
                    index_sql, connection, params={'symbols': symbols})
                for table_name, group in df_index.groupby('数据表', sort=False):
                    # Quote each component of a schema/database-qualified table.
                    table_parts = preparer.unformat_identifiers(table_name)
                    if not table_parts or any(not part for part in table_parts):
                        raise ValueError
                    quoted_table = '.'.join(quote(part) for part in table_parts)
                    data_sql = sqla.text(
                        f"SELECT {quote('指标名')}, {quote('指标日期')}, {quote('指标值')} "
                        f"FROM {quoted_table} "
                        f"WHERE {quote('指标名')} IN :symbols "
                        f"AND {quote('指标日期')} >= :begin "
                        f"AND {quote('指标日期')} < :end"
                    ).bindparams(
                        symbols_param,
                        sqla.bindparam('begin', type_=sqla.DateTime()),
                        sqla.bindparam('end', type_=sqla.DateTime()),
                    )
                    frame = pd.read_sql(data_sql, connection, params={
                        'symbols': group['指标名称'].tolist(),
                        'begin': begin,
                        'end': end,
                    })
                    if not frame.empty:
                        frames.append(frame)
            if not frames:
                return json_success(json.dumps({'data': []}, ensure_ascii=False))
            df = pd.concat(frames, ignore_index=True).rename(columns={
                '指标名': '指标名称', '指标日期': '指标时间'})
        except Exception:
            logging.warning('PublicApi data integration database query failed')
            return json_error_response('数据整合失败: 查询指标数据失败')

        if data_type == 'original':
            return json_success(json.dumps(
                {'data': df.to_dict(orient='records')},
                default=str, ensure_ascii=False))

        def is_empty_value(value):
            if value is None:
                return True
            if isinstance(value, float) and pd.isna(value):
                return True
            if isinstance(value, (list, dict, tuple, set)) and not value:
                return True
            if isinstance(value, str) and not value.strip():
                return True
            return False
        def clean_result(result):
            return {
                key: value
                for key, value in result.items()
                if not is_empty_value(value)
            }
        df['指标时间'] = pd.to_datetime(df['指标时间'])
        df = df.pivot(index='指标时间', columns='指标名称', values='指标值')
        df = df.apply(pd.to_numeric, errors="coerce")
        rows = [summarize_series(column, df[column]) for column in df.columns]
        records = [clean_result(row) for row in rows]

        return json_success(json.dumps({'data': records}, ensure_ascii=False))

appbuilder.add_view_no_menu(PublicApi)
