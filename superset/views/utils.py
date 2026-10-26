# -*- coding: utf-8 -*-
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals
from collections import defaultdict
from flask import (g, jsonify)
import sqlalchemy as sqla
# from flask_appbuilder.security.sqla import models as ab_models
from ..sec_models_core import UserCustom
from superset import db, utils, app
from datetime import datetime
from .utils_ppt import ScreenShotToPPTX
import os
import logging
import urllib.parse
import oss2
from Crypto.Cipher import AES
import base64
import pandas as pd
from superset.views.difyapis.dify_chatflow_client import DifyChatFlowClient
from superset.views.difyapis.dify_workflow_client import DifyWorkFlowClient

# 创建DifyChatFlowClient实例池
dify_chatflow_client_instances = {}

# 创建DifyWorkFlowClient实例池
dify_workflow_client_instances = {}


def bootstrap_user_data(username=None, include_perms=False):
    if username:
        username = username
    else:
        username = g.user.username

    user = (
        db.session.query(UserCustom)
        .filter_by(username=username)
        .one()
    )
    payload = {
        'username': user.username,
        'firstName': user.first_name,
        'lastName': user.last_name,
        'userId': user.id,
        'isActive': user.is_active,
        'createdOn': user.created_on.isoformat(),
        'email': user.email,
        'agreeTime': user.agree_time.isoformat() if user.agree_time else ''
    }
    if include_perms:
        roles, permissions = get_permissions(user)
        payload['roles'] = roles
        payload['permissions'] = permissions
    return payload


def get_permissions(user):
    if not user.roles:
        raise AttributeError('User object does not have roles')
    roles = {}
    permissions = defaultdict(set)
    for role in user.roles:
        perms = set()
        for perm in role.permissions:
            if perm.permission and perm.view_menu:
                perms.add(
                    (perm.permission.name, perm.view_menu.name),
                )
                if perm.permission.name in ('datasource_access',
                                            'database_access'):
                    permissions[perm.permission.name].add(perm.view_menu.name)
        roles[role.name] = [
            [perm.permission.name, perm.view_menu.name]
            for perm in role.permissions
            if perm.permission and perm.view_menu
        ]
    return roles, permissions


def is_user_login():
    return g.user.is_authenticated


def create_ppt_with_images(user_name, standalone_token, task_info, web_port):
    try:
        print(f"create_ppt_with_images 开始执行, task_node_list: {task_info['task_node_list']}")
        """运行截图流程"""
        screenshotter = ScreenShotToPPTX()
        for i, dash_id in enumerate(task_info['task_node_list']):
            url = f"http://localhost:{web_port}/superset/dashboard/{dash_id}/?standalone_token={standalone_token}"
            screenshotter.capture_grouped_screenshots(url, dash_id)
            print(f"URL {i + 1}/{len(task_info['task_node_list'])} 截图完成: {url}")
        print("所有URL截图完成")
        if screenshotter.slide_list:
            # 生成带有时间戳的PPT文件名
            # timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            timestamp = datetime.now().strftime('%Y%m%d%H%M')
            ppt_filename = f"{task_info['task_name']}-{timestamp}.pptx"
            ppt_dir = os.path.join(screenshotter.output_folder, user_name)
            if not os.path.exists(ppt_dir):
                os.makedirs(ppt_dir)
            ppt_path = os.path.join(ppt_dir, ppt_filename)
            # 将截图保存为PPT
            screenshotter.save_to_ppt(task_info, ppt_path)
            print(f"截图已成功写入PPT文件: {ppt_path}")
        else:
            raise Exception("slide_list 为空，无法生成PPT")
        update_sql = sqla.text("""
            UPDATE task_report
            SET task_finish_time = :task_finish_time,
                task_status = :task_status,
                task_file_name = :task_file_name
            WHERE taskid = :taskid
        """)
        db.session.execute(update_sql, {
            'task_finish_time': datetime.now(),
            'task_status': 'finished',
            'taskid': task_info['taskid'],
            'task_file_name': ppt_filename,
        })
        db.session.commit()
        to = task_info['task_email']
        if to:
            subject = ppt_filename
            content = '请查看附件'
            files = [ppt_path]
            utils.send_email_smtp(to, subject, content, app.config, files)
    except Exception as e:
        print(f"截图子线程发生错误: {e}")
        logging.error(f"截图子线程发生错误: {e}")
        update_sql = sqla.text("""
            UPDATE task_report
            SET task_finish_time = :task_finish_time, task_status = :task_status
            WHERE taskid = :taskid
        """)
        db.session.execute(update_sql, {
            'task_finish_time': datetime.now(),
            'task_status': 'failed',
            'taskid': task_info['taskid'],
        })
        db.session.commit()
    finally:
        if screenshotter.driver:
            screenshotter.driver.quit()


def aes_decrypt_cbc(cipher_text):
    aes_key = b"WQ7VcAQ8BHDzIUPo"
    aes_iv = b"WQ7VcAQ8BHDzIUPo"
    cipher = AES.new(aes_key, AES.MODE_CBC, aes_iv)
    data = base64.b64decode(cipher_text)
    decrypted = cipher.decrypt(data)

    pad_len = decrypted[-1]
    decrypted = decrypted[:-pad_len]

    return decrypted.decode("utf-8")


def get_dify_chatflow_client_instance(app_index, config):
        """从实例池中获取DifyClient实例，如果不存在则创建"""
        try:
            if app_index not in dify_chatflow_client_instances:
                dify_api_key = config.get('DIFY_API_KEY_INDEX', {}).get(app_index)
                if not dify_api_key:
                    return None, jsonify({"error": f"未找到名为 {app_index} 的API密钥配置"}), 400
                dify_chatflow_client_instances[app_index] = DifyChatFlowClient(api_key=dify_api_key)

            return dify_chatflow_client_instances[app_index], None, 200
        except Exception as e:
            return None, jsonify({"error": str(e)}), 500


def get_dify_workflow_client_instance(app_index, config):
    """从实例池中获取DifyWorkFlowClient实例，如果不存在则创建"""
    try:
        if app_index not in dify_workflow_client_instances:
            dify_api_key = config.get('DIFY_API_KEY_INDEX', {}).get(app_index)
            if not dify_api_key:
                return None, jsonify({"error": f"未找到名为 {app_index} 的API密钥配置"}), 400
            dify_workflow_client_instances[app_index] = DifyWorkFlowClient(api_key=dify_api_key)

        return dify_workflow_client_instances[app_index], None, 200
    except Exception as e:
        return None, jsonify({"error": str(e)}), 500


def generate_oss_preview_url(
        access_key_id,
        access_key_secret,
        endpoint,
        bucket_name,
        object_key,
        origin_filename,
        expire=3600):
    """
    生成 OSS 预览 URL
    endpoint           例如: https://oss-cn-shanghai.aliyuncs.com
    bucket_name        bucket 名
    object_key         OSS 文件名，例如 uuid.pdf
    origin_filename    原始文件名，例如 期货研究报告.pdf
    expire             URL有效期（秒）

    返回：
    signed url
    """

    auth = oss2.Auth(access_key_id, access_key_secret)
    bucket = oss2.Bucket(auth, endpoint, bucket_name)
    encoded_filename = urllib.parse.quote(origin_filename)
    disposition_value = f"inline; filename*=UTF-8''{encoded_filename}"
    params = {
        'response-content-disposition': disposition_value
    }
    url = bucket.sign_url(
        'GET',
        object_key,
        expire,
        params=params
    )
    return url

def find_yoy_point(series, latest_date):
    """Find the nearest available value on or before the same date last year."""
    target_date = latest_date - pd.DateOffset(years=1)
    candidates = series[series.index <= target_date]
    if candidates.empty:
        return None, None
    yoy_date = candidates.index[-1]
    return yoy_date, float(candidates.iloc[-1])

