# -*- coding: utf-8 -*-
"""指标数据管理页的数据源注册表、SQL 构建与分类树组装。

指标元数据统一来自config INDEX_MANAGE里的indexListView值这个视图，
都带有所在品种库（数据库）、指标列表、数据表与 Superset datasource_id。
所有对品种库的读写都必须先经过注册表校验，再生成三段式表名。
"""
from __future__ import unicode_literals

from collections import OrderedDict
from datetime import datetime
import logging
import math
import re
import threading
import time
from superset import (
    app
)


config = app.config
INDEX_METADATA_VIEW = config.get('INDEX_MANAGE', {}).get('indexListView')
UNCATEGORIZED_NODE_KEY = 'virtual_uncategorized'
UNCATEGORIZED_NODE_NAME = '未分类'
INDEX_METADATA_COLUMNS = (
    'table_ID', '指标ID', '指标名称', '指标来源', '指标说明', '计算配置',
    '数据库', '品种', '指标列表', '数据表', 'datasource_id', 'node_id',
    'node_order',
)

_SAFE_IDENTIFIER_RE = re.compile(r'^[^\[\]\.\x00-\x1f\'";]+$')
_FORBIDDEN_SQL_RE = re.compile(
    r'\b(?:insert|update|delete|merge|exec(?:ute)?|drop|alter|create|'
    r'truncate|grant|revoke|into)\b',
    re.IGNORECASE,
)


def is_safe_identifier(identifier):
    return bool(identifier) and bool(
        _SAFE_IDENTIFIER_RE.match(str(identifier)))


def quote_identifier(identifier):
    if not is_safe_identifier(identifier):
        raise ValueError('非法标识符: {}'.format(identifier))
    return '[{}]'.format(str(identifier))


def full_table_name(database_name, table_name):
    return '{}.[dbo].{}'.format(
        quote_identifier(database_name), quote_identifier(table_name))


def resolve_index_fields(index_manage):
    """把 INDEX_MANAGE 配置转换为已校验的数据表列名。"""
    config = index_manage or {}
    fields = {
        'date': config.get('dateField'),
        'name': config.get('indexNameField'),
        'value': config.get('valueField'),
        'type': config.get('indexTypeField'),
    }
    for key, value in fields.items():
        if not is_safe_identifier(value):
            raise ValueError('INDEX_MANAGE 字段配置无效: {}'.format(key))
    return fields


def is_safe_select_sql(sql):
    value = str(sql or '').strip().rstrip(';').strip()
    if not re.match(r'^(?:select|with)\b', value, re.IGNORECASE):
        return False
    if ';' in value:
        return False
    return not _FORBIDDEN_SQL_RE.search(value)


def _clean_value(value):
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    return value


def _to_int(value):
    value = _clean_value(value)
    if value in (None, ''):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def build_source_registry_sql():
    return (
        'SELECT DISTINCT 数据库, 品种, 指标列表, 数据表, datasource_id '
        'FROM [dbo].{}'.format(quote_identifier(INDEX_METADATA_VIEW))
    )


def build_index_metadata_sql():
    return 'SELECT {} FROM [dbo].{}'.format(
        ','.join(INDEX_METADATA_COLUMNS),
        quote_identifier(INDEX_METADATA_VIEW),
    )


def build_index_source_registry(rows):
    """以 (数据库, 指标列表) 为键建立可信数据源注册表。"""
    sources = OrderedDict()
    by_data = {}
    for raw_row in rows or []:
        row = dict(raw_row)
        database = str(_clean_value(row.get('数据库')) or '').strip()
        list_table = str(_clean_value(row.get('指标列表')) or '').strip()
        data_table = str(_clean_value(row.get('数据表')) or '').strip()
        if not database or not list_table or not data_table:
            continue
        if not (is_safe_identifier(database)
                and is_safe_identifier(list_table)
                and is_safe_identifier(data_table)):
            logging.warning('跳过非法指标数据源: %s', database)
            continue
        key = (database, list_table)
        source = sources.get(key)
        if source is None:
            source = {
                'database': database,
                'list_table': list_table,
                'data_table': data_table,
                'variety': str(_clean_value(row.get('品种')) or '').strip(),
                'datasource_id': _to_int(row.get('datasource_id')),
            }
            sources[key] = source
            by_data.setdefault((database, data_table), source)
        elif source['datasource_id'] is None:
            source['datasource_id'] = _to_int(row.get('datasource_id'))
    return {'sources': sources, 'by_data': by_data}


def get_source(registry, database, list_table):
    source = (registry or {}).get('sources', {}).get((database, list_table))
    if source is None:
        raise ValueError('未知指标列表: {}'.format(list_table))
    return source


def build_index_key(database, list_table, data_table, table_id):
    return '{}|{}|{}|{}'.format(database, list_table, data_table, table_id)


def parse_index_key(index_key, registry):
    """校验指标 key 并返回其可信数据源与 table_ID。"""
    parts = index_key.split('|') if isinstance(index_key, str) else []
    if len(parts) != 4:
        raise ValueError('指标 key 格式错误')
    database, list_table, data_table, table_id_value = parts
    source = get_source(registry, database, list_table)
    if source['data_table'] != data_table:
        raise ValueError('指标数据表与注册信息不一致')
    try:
        table_id = int(table_id_value)
    except (TypeError, ValueError):
        raise ValueError('指标 table_ID 无效')
    return {'key': index_key, 'source': source, 'table_id': table_id}


def group_index_keys(node_keys, registry):
    """按数据源分组指标 key，保持首次出现顺序。"""
    if not node_keys:
        raise ValueError('未选择指标')
    groups = OrderedDict()
    for node_key in node_keys:
        parsed = parse_index_key(node_key, registry)
        source = parsed['source']
        group_key = (source['database'], source['list_table'])
        group = groups.setdefault(group_key, {
            'source': source,
            'table_ids': [],
            'node_keys_by_id': {},
        })
        if parsed['table_id'] not in group['node_keys_by_id']:
            group['table_ids'].append(parsed['table_id'])
            group['node_keys_by_id'][parsed['table_id']] = node_key
    return list(groups.values())


def validate_category_move(node_id, new_parent_id, parent_by_id):
    """禁止移动根目录、移动到自身或自己的子分类。"""
    node_id = int(node_id)
    new_parent_id = int(new_parent_id)
    if node_id not in parent_by_id or new_parent_id not in parent_by_id:
        raise ValueError('分类节点不存在')
    if parent_by_id[node_id] == 0:
        raise ValueError('根目录不能移动')
    if node_id == new_parent_id:
        raise ValueError('分类不能移动到自身')
    current_id = new_parent_id
    visited = set()
    while current_id in parent_by_id and current_id not in visited:
        if current_id == node_id:
            raise ValueError('分类不能移动到自己的子分类')
        visited.add(current_id)
        current_id = parent_by_id[current_id]
    return True


def build_category_paths(category_rows):
    name_by_id = {}
    parent_by_id = {}
    for row in category_rows:
        name_by_id[int(row['node_id'])] = row['node_name']
        parent_by_id[int(row['node_id'])] = int(row['parent_id'] or 0)
    cache = {}

    def build(node_id, depth=0):
        if node_id in cache:
            return cache[node_id]
        parent_id = parent_by_id.get(node_id, 0)
        name = name_by_id.get(node_id, '')
        if parent_id == 0 or parent_id not in name_by_id or depth > 100:
            path = name
        else:
            path = '{}|{}'.format(build(parent_id, depth + 1), name)
        cache[node_id] = path
        return path

    return [
        {'node_id': node_id, 'nodes_path': build(node_id)}
        for node_id in name_by_id
    ]


def normalize_index_records(records, registry):
    """清洗视图记录：补 key，丢弃空名称或来源未登记的行，去除重复。"""
    result = []
    seen = set()
    for raw in records or []:
        record = {key: _clean_value(value) for key, value in dict(raw).items()}
        index_name = str(record.get('指标名称') or '').strip()
        table_id = _to_int(record.get('table_ID'))
        database = record.get('数据库')
        list_table = record.get('指标列表')
        if not index_name or table_id is None:
            continue
        source = (registry or {}).get('sources', {}).get(
            (database, list_table))
        if source is None:
            continue
        key = build_index_key(
            database, list_table, source['data_table'], table_id)
        if key in seen:
            continue
        seen.add(key)
        record['指标名称'] = index_name
        record['table_ID'] = table_id
        record['数据表'] = source['data_table']
        record['datasource_id'] = source['datasource_id']
        record['品种'] = record.get('品种') or source['variety']
        record['key'] = key
        record['node_id'] = _to_int(record.get('node_id'))
        record['node_order'] = _to_int(record.get('node_order'))
        for field in ('指标ID', '指标来源', '指标说明', '计算配置'):
            if record.get(field) is None:
                record[field] = ''
        result.append(record)
    return result


def build_category_tree(category_rows, index_records):
    """组装分类树；node_id 为空或失效的指标挂到虚拟“未分类”节点。"""
    node_dict = OrderedDict()
    roots = []
    for row in category_rows:
        node_id = int(row['node_id'])
        node_dict[node_id] = {
            'name': row['node_name'],
            'key': 'node_{}'.format(node_id),
            'node_id': node_id,
            'parent_id': int(row['parent_id'] or 0),
            'node_order': _to_int(row.get('node_order')) or 0,
            'children': [],
        }
    for node in node_dict.values():
        parent = node_dict.get(node['parent_id'])
        if node['parent_id'] == 0 or parent is None:
            roots.append(node)
        else:
            parent['children'].append(node)

    if len(roots) == 1 and roots[0]['parent_id'] == 0:
        root = roots[0]
    else:
        root = {
            'name': '目录', 'key': 'root', 'node_id': 0, 'parent_id': None,
            'node_order': 0, 'children': roots,
        }

    uncategorized = []
    for record in index_records:
        leaf = {
            'name': record['指标名称'],
            'searchText': '{} {} {}'.format(
                record['指标名称'], record.get('指标ID') or '',
                record.get('指标来源') or ''),
            'key': record['key'],
            'node_id': record['node_id'],
            'node_order': record['node_order'] or 0,
        }
        parent = node_dict.get(record['node_id'])
        if parent is None:
            uncategorized.append(leaf)
        else:
            parent['children'].append(leaf)

    def sort_children(node):
        children = node.get('children')
        if children:
            children.sort(key=lambda item: (
                0 if 'children' in item else 1, item.get('node_order') or 0))
            for child in children:
                sort_children(child)

    sort_children(root)
    if uncategorized:
        root['children'].append({
            'name': UNCATEGORIZED_NODE_NAME,
            'key': UNCATEGORIZED_NODE_KEY,
            'node_id': UNCATEGORIZED_NODE_KEY,
            'parent_id': root['node_id'],
            'node_order': 999999,
            'is_virtual': True,
            'children': uncategorized,
        })
    return root


def infer_index_frequency(dates):
    normalized = set()
    for value in dates:
        if value is None:
            continue
        if isinstance(value, str):
            normalized.add(
                datetime.strptime(value.strip()[:10], '%Y-%m-%d').date())
        elif hasattr(value, 'date') and callable(value.date):
            normalized.add(value.date())
        else:
            normalized.add(value)
    ordered = sorted(normalized, reverse=True)[:12]
    if len(ordered) < 2:
        return '未知'
    gap = min((left - right).days for left, right in zip(ordered, ordered[1:]))
    for lower, upper, label in [(1, 3, '日度'), (6, 8, '周度'),
                                (28, 31, '月度'), (365, 366, '年度')]:
        if lower <= gap <= upper:
            return label
    return '未知'


def build_latest_values_sql(source, index_names, fields):
    if not index_names:
        raise ValueError('指标名称不能为空')
    placeholders = ', '.join(['%s'] * len(index_names))
    sql = (
        'SELECT 指标名, 指标日期, 指标值 FROM ('
        'SELECT {name} AS 指标名, {date} AS 指标日期, {value} AS 指标值, '
        'ROW_NUMBER() OVER (PARTITION BY {name} ORDER BY {date} DESC) AS rn '
        'FROM {table} WHERE {name} IN ({placeholders})'
        ') latest WHERE rn = 1'
    ).format(
        name=quote_identifier(fields['name']),
        date=quote_identifier(fields['date']),
        value=quote_identifier(fields['value']),
        table=full_table_name(source['database'], source['data_table']),
        placeholders=placeholders,
    )
    return sql, list(index_names)


def build_frequency_dates_sql(source, index_names, fields):
    if not index_names:
        raise ValueError('指标名称不能为空')
    queries = []
    params = []
    for name in dict.fromkeys(index_names):
        queries.append((
            'SELECT %s AS 指标名, recent.日期 FROM ('
            'SELECT TOP (12) CAST({date} AS DATE) AS 日期 FROM {table} '
            'WHERE {name} = %s AND {value} IS NOT NULL AND {date} IS NOT NULL '
            'GROUP BY CAST({date} AS DATE) ORDER BY 日期 DESC'
            ') recent'
        ).format(
            name=quote_identifier(fields['name']),
            date=quote_identifier(fields['date']),
            value=quote_identifier(fields['value']),
            table=full_table_name(source['database'], source['data_table']),
        ))
        params.extend([name, name])
    return ' UNION ALL '.join(queries), params


def load_latest_values_with_frequency(engine, source, index_names, fields):
    sql, params = build_latest_values_sql(source, index_names, fields)
    values = {
        row[0]: {'最新数据日期': row[1], '最新值': row[2], '频率': '未知'}
        for row in engine.execute(sql, params).fetchall()
    }
    try:
        sql, params = build_frequency_dates_sql(source, index_names, fields)
        dates = {}
        for row in engine.execute(sql, params).fetchall():
            dates.setdefault(row[0], []).append(row[1])
        for name, value in values.items():
            value['频率'] = infer_index_frequency(dates.get(name, []))
    except Exception:
        logging.exception('指标频率查询失败: %s', source['database'])
        for value in values.values():
            value['频率'] = '获取失败'
    return values


def build_index_history_sql(groups, fields):
    """多数据源历史数据宽表查询。

    ``groups`` 为 ``[(source, [指标名称, ...]), ...]``；同名指标只保留首个
    数据源的数据，返回 ``(sql, params, output_names)``。
    """
    output_names = []
    output_sources = []
    source_queries = []
    source_params = []
    for index, (source, index_names) in enumerate(groups or []):
        unique_names = [
            name for name in dict.fromkeys(index_names or [])
            if name not in output_names
        ]
        if not unique_names:
            continue
        for name in unique_names:
            output_names.append(name)
            output_sources.append(index)
        source_queries.append((
            'SELECT {index} AS 来源, {date} AS 日期, {name} AS 指标名, '
            '{value} AS 指标值 FROM {table} WHERE {name} IN ({placeholders})'
        ).format(
            index=index,
            date=quote_identifier(fields['date']),
            name=quote_identifier(fields['name']),
            value=quote_identifier(fields['value']),
            table=full_table_name(source['database'], source['data_table']),
            placeholders=', '.join(['%s'] * len(unique_names)),
        ))
        source_params.extend(unique_names)
    if not source_queries:
        raise ValueError('指标不能为空')

    value_columns = []
    column_params = []
    for position, (name, source_index) in enumerate(
            zip(output_names, output_sources)):
        value_columns.append(
            'MAX(CASE WHEN 来源 = {} AND 指标名 = %s THEN 指标值 END) '
            'AS [c{}]'.format(source_index, position))
        column_params.append(name)
    sql = (
        'SELECT 日期, {columns} FROM ({sources}) history '
        'GROUP BY 日期 ORDER BY 日期'
    ).format(
        columns=', '.join(value_columns),
        sources=' UNION ALL '.join(source_queries),
    )
    return sql, column_params + source_params, output_names


def build_history_cache_key(groups):
    return tuple(sorted(
        (source['database'], source['data_table'],
         tuple(sorted(set(names))))
        for source, names in groups
    ))


class QueryResultCache(object):
    """线程安全的短期查询缓存，相同 key 的并发请求只计算一次。"""

    def __init__(self, ttl_seconds, max_entries, time_fn=None):
        self.ttl_seconds = ttl_seconds
        self.max_entries = max_entries
        self.time_fn = time_fn or time.time
        self._entries = OrderedDict()
        self._inflight = {}
        self._lock = threading.RLock()

    def get_or_compute(self, key, compute):
        while True:
            with self._lock:
                now = self.time_fn()
                entry = self._entries.get(key)
                if entry is not None:
                    expires_at, value = entry
                    if expires_at > now:
                        self._entries.move_to_end(key)
                        return value, True
                    del self._entries[key]
                event = self._inflight.get(key)
                is_owner = event is None
                if is_owner:
                    event = threading.Event()
                    self._inflight[key] = event
            if not is_owner:
                event.wait()
                continue
            try:
                value = compute()
            except Exception:
                with self._lock:
                    self._inflight.pop(key, None)
                    event.set()
                raise
            with self._lock:
                self._entries[key] = (self.time_fn() + self.ttl_seconds, value)
                self._entries.move_to_end(key)
                while len(self._entries) > self.max_entries:
                    self._entries.popitem(last=False)
                self._inflight.pop(key, None)
                event.set()
            return value, False

    def clear(self):
        with self._lock:
            self._entries.clear()
