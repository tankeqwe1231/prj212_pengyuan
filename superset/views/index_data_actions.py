# -*- coding: utf-8 -*-
"""指标数据管理页的分类树、指标与计算公式写操作。

所有函数都接收调用方开启的事务 connection（TFFY_CENTER 连接，可跨库访问
同实例的品种库），表名只来自注册表中已校验的数据源。
"""
from __future__ import unicode_literals

from collections import OrderedDict
import json
import re

from .index_data_sources import (
    full_table_name,
    is_safe_select_sql,
    quote_identifier,
    validate_category_move,
)

CALCULATED_INDEX_SOURCE = '计算指标'
METRIC_APPEND_ORDER = 2147483647


def _category_row(connection, node_id):
    return connection.execute(
        'SELECT node_id,parent_id FROM index_categorys WITH (UPDLOCK, HOLDLOCK) '
        'WHERE node_id=%s AND node_status=1',
        [int(node_id)],
    ).fetchone()


def _require_metric_parent(connection, node_id):
    row = _category_row(connection, node_id)
    if row is None:
        raise ValueError('目标分类不存在或已停用')
    if row[1] in (None, 0):
        raise ValueError('根目录不能直接存放指标')


def _next_category_order(connection, parent_id):
    max_order = connection.execute(
        'SELECT ISNULL(MAX(node_order), 0) FROM index_categorys '
        'WITH (UPDLOCK, HOLDLOCK) WHERE parent_id=%s AND node_status=1',
        [int(parent_id)],
    ).scalar()
    return (max_order or 0) + 1


def _update_metric_orders(connection, table, rows):
    # SQL Server 单条语句最多 2100 个参数，每行 3 个参数，分批更新。
    batch_size = 600
    for offset in range(0, len(rows), batch_size):
        batch = rows[offset:offset + batch_size]
        result = connection.execute(
            'UPDATE target SET node_id=desired.node_id,'
            'node_order=desired.node_order FROM {} AS target '
            'JOIN (VALUES {}) AS desired(node_id,node_order,table_ID) '
            'ON target.table_ID=desired.table_ID'.format(
                table, ','.join(['(%s,%s,%s)'] * len(batch))),
            [value for row in batch for value in row],
        )
        if result.rowcount != len(batch):
            raise ValueError('指标顺序已变更，请刷新后重试')


def _update_category_orders(connection, rows):
    if not rows:
        return
    result = connection.execute(
        'UPDATE target SET parent_id=desired.parent_id,'
        'node_order=desired.node_order FROM index_categorys AS target '
        'JOIN (VALUES {}) AS desired(parent_id,node_order,node_id) '
        'ON target.node_id=desired.node_id WHERE target.node_status=1'.format(
            ','.join(['(%s,%s,%s)'] * len(rows))),
        [value for row in rows for value in row],
    )
    if result.rowcount != len(rows):
        raise ValueError('分类树已变更，请刷新后重试')


def normalize_category_name(node_name):
    name = str(node_name or '').strip()
    if not name:
        raise ValueError('分类名称不能为空')
    if len(name) > 100:
        raise ValueError('分类名称不能超过100个字符')
    return name


def create_category(connection, node_name, parent_node_id, groups=None):
    """新建分类，可同时把选中的指标移动到新分类下。"""
    node_name = normalize_category_name(node_name)
    parent_node_id = int(parent_node_id)
    if _category_row(connection, parent_node_id) is None:
        raise ValueError('父节点不存在或已停用')
    duplicate = connection.execute(
        'SELECT COUNT(1) FROM index_categorys WITH (UPDLOCK, HOLDLOCK) '
        'WHERE parent_id=%s AND node_name=%s AND node_status=1',
        [parent_node_id, node_name],
    ).scalar()
    if duplicate:
        raise ValueError('父节点下已存在同名节点')
    node_order = _next_category_order(connection, parent_node_id)
    inserted = connection.execute(
        'INSERT INTO index_categorys (node_name,parent_id,node_order,node_status) '
        'OUTPUT INSERTED.node_id VALUES (%s,%s,%s,1)',
        [node_name, parent_node_id, node_order],
    ).fetchone()
    node_id = int(inserted[0])

    node_orders = {}
    for group in groups or []:
        source = group['source']
        rows = []
        for order, table_id in enumerate(group['table_ids'], 1):
            rows.append((node_id, order, table_id))
            node_orders[group['node_keys_by_id'][table_id]] = order
        _update_metric_orders(
            connection,
            full_table_name(source['database'], source['list_table']),
            rows,
        )
    return {
        'node_id': node_id,
        'node_name': node_name,
        'parent_id': parent_node_id,
        'node_order': node_order,
        'node_orders': node_orders,
    }


def rename_category(connection, node_id, node_name):
    node_name = normalize_category_name(node_name)
    row = _category_row(connection, node_id)
    if row is None:
        raise ValueError('分类不存在或已停用')
    if row[1] in (None, 0):
        raise ValueError('根目录不能重命名')
    duplicate = connection.execute(
        'SELECT COUNT(1) FROM index_categorys WHERE parent_id=%s '
        'AND node_name=%s AND node_id<>%s AND node_status=1',
        [row[1], node_name, int(node_id)],
    ).scalar()
    if duplicate:
        raise ValueError('同级已存在同名分类')
    connection.execute(
        'UPDATE index_categorys SET node_name=%s WHERE node_id=%s',
        [node_name, int(node_id)],
    )
    return {'node_id': int(node_id), 'node_name': node_name}


def update_category(connection, node_id, node_name, parent_node_id):
    """在调用方的同一事务中修改名称与父节点，失败时一并回滚。"""
    node_name = normalize_category_name(node_name)
    node_id = int(node_id)
    parent_node_id = int(parent_node_id)
    row = _category_row(connection, node_id)
    if row is None:
        raise ValueError('节点不存在或已停用')
    if row[1] in (None, 0):
        raise ValueError('根目录不能修改')
    duplicate = connection.execute(
        'SELECT COUNT(1) FROM index_categorys WITH (UPDLOCK, HOLDLOCK) '
        'WHERE parent_id=%s AND node_name=%s AND node_id<>%s AND node_status=1',
        [parent_node_id, node_name, node_id],
    ).scalar()
    if duplicate:
        raise ValueError('父节点下已存在同名节点')
    result = {'node_id': node_id, 'parent_id': parent_node_id}
    if int(row[1]) != parent_node_id:
        result.update(move_category_node(connection, node_id, parent_node_id))
    updated = connection.execute(
        'UPDATE index_categorys SET node_name=%s WHERE node_id=%s AND node_status=1',
        [node_name, node_id],
    )
    if updated.rowcount != 1:
        raise ValueError('节点已变更，请刷新后重试')
    result['node_name'] = node_name
    return result


def move_category_node(connection, node_id, new_parent_id, new_order=None):
    """移动分类（同级排序也走这里），并重排新旧父节点下的顺序。"""
    rows = connection.execute(
        'SELECT node_id,parent_id,node_order FROM index_categorys '
        'WITH (UPDLOCK, HOLDLOCK) WHERE node_status=1',
    ).fetchall()
    parent_by_id = {int(row[0]): int(row[1] or 0) for row in rows}
    validate_category_move(node_id, new_parent_id, parent_by_id)
    node_id = int(node_id)
    new_parent_id = int(new_parent_id)
    old_parent_id = parent_by_id[node_id]

    siblings_by_parent = {}
    for row in rows:
        category_id = int(row[0])
        if category_id == node_id:
            continue
        siblings_by_parent.setdefault(int(row[1] or 0), []).append(
            (int(row[2] or 0), category_id))
    for siblings in siblings_by_parent.values():
        siblings.sort()

    target_ids = [
        category_id
        for _, category_id in siblings_by_parent.get(new_parent_id, [])
    ]
    requested = int(new_order) if new_order is not None else len(target_ids) + 1
    target_order = max(1, min(requested, len(target_ids) + 1))
    target_ids.insert(target_order - 1, node_id)

    update_rows = []
    if old_parent_id != new_parent_id:
        update_rows.extend(
            (old_parent_id, order, category_id)
            for order, (_, category_id) in enumerate(
                siblings_by_parent.get(old_parent_id, []), 1)
        )
    update_rows.extend(
        (new_parent_id, order, category_id)
        for order, category_id in enumerate(target_ids, 1)
    )
    _update_category_orders(connection, update_rows)
    return {
        'node_id': node_id,
        'old_parent_id': old_parent_id,
        'parent_id': new_parent_id,
        'node_order': target_order,
    }


def move_index_node(connection, group, table_id, new_parent_id, new_order):
    """移动单个指标（含同分类内排序），重排同一指标列表内的顺序。"""
    source = group['source']
    table_id = int(table_id)
    new_parent_id = int(new_parent_id)
    lock_result = connection.execute(
        'DECLARE @lock_result int; '
        "EXEC @lock_result=sp_getapplock @Resource=%s, "
        "@LockMode='Exclusive', @LockOwner='Transaction'; "
        'SELECT @lock_result',
        ['index_metric_move:{}:{}'.format(
            source['database'], source['list_table'])],
    ).scalar()
    if lock_result is None or int(lock_result) < 0:
        raise ValueError('指标移动事务锁获取失败')
    _require_metric_parent(connection, new_parent_id)

    table = full_table_name(source['database'], source['list_table'])
    metric_row = connection.execute(
        'SELECT table_ID,node_id FROM {} WITH (UPDLOCK, HOLDLOCK) '
        'WHERE table_ID=%s'.format(table),
        [table_id],
    ).fetchone()
    if metric_row is None:
        raise ValueError('指标不存在或已删除')
    source_parent_id = None if metric_row[1] is None else int(metric_row[1])

    if source_parent_id is None:
        related_sql = ('SELECT table_ID,node_id,node_order FROM {} '
                       'WITH (UPDLOCK, HOLDLOCK) '
                       'WHERE node_id IS NULL OR node_id=%s').format(table)
        related_params = [new_parent_id]
    else:
        related_sql = ('SELECT table_ID,node_id,node_order FROM {} '
                       'WITH (UPDLOCK, HOLDLOCK) '
                       'WHERE node_id=%s OR node_id=%s').format(table)
        related_params = [source_parent_id, new_parent_id]
    rows_by_parent = {}
    for row in connection.execute(related_sql, related_params).fetchall():
        parent_id = None if row[1] is None else int(row[1])
        rows_by_parent.setdefault(parent_id, []).append(
            (int(row[2] or 0), int(row[0])))
    for sibling_rows in rows_by_parent.values():
        sibling_rows.sort()

    target_ids = [
        related_id for _, related_id in rows_by_parent.get(new_parent_id, [])
        if related_id != table_id
    ]
    target_order = max(1, min(int(new_order), len(target_ids) + 1))
    target_ids.insert(target_order - 1, table_id)
    update_rows = [
        (new_parent_id, order, related_id)
        for order, related_id in enumerate(target_ids, 1)
    ]
    if source_parent_id != new_parent_id and source_parent_id is not None:
        update_rows.extend(
            (source_parent_id, order, related_id)
            for order, related_id in enumerate([
                related_id
                for _, related_id in rows_by_parent.get(source_parent_id, [])
                if related_id != table_id
            ], 1)
        )
    _update_metric_orders(connection, table, update_rows)
    return {
        'node_key': group['node_keys_by_id'][table_id],
        'parent_id': new_parent_id,
        'node_order': target_order,
    }


def move_index_nodes(connection, groups, new_parent_id, new_order=None):
    """移动一个或多个指标；未指定顺序时依次追加到目标分类末尾。"""
    node_orders = {}
    single = (len(groups) == 1 and len(groups[0]['table_ids']) == 1)
    for group in groups:
        for table_id in group['table_ids']:
            order = (int(new_order) if single and new_order is not None
                     else METRIC_APPEND_ORDER)
            if order < 1:
                raise ValueError('指标顺序无效')
            result = move_index_node(
                connection, group, table_id, new_parent_id, order)
            node_orders[result['node_key']] = result['node_order']
    return {'parent_id': int(new_parent_id), 'node_orders': node_orders}


def delete_category(connection, node_id, registry):
    node_id = int(node_id)
    row = _category_row(connection, node_id)
    if row is None:
        raise ValueError('分类不存在或已停用')
    if row[1] in (None, 0):
        raise ValueError('根目录不能删除')
    child_count = connection.execute(
        'SELECT COUNT(1) FROM index_categorys WHERE parent_id=%s '
        'AND node_status=1',
        [node_id],
    ).scalar()
    if child_count:
        raise ValueError('该分类下还有子分类，不能删除')
    for source in registry['sources'].values():
        metric_count = connection.execute(
            'SELECT COUNT(1) FROM {} WHERE node_id=%s'.format(
                full_table_name(source['database'], source['list_table'])),
            [node_id],
        ).scalar()
        if metric_count:
            raise ValueError('该分类下还有指标，不能删除')
    connection.execute(
        'DELETE FROM index_categorys WHERE node_id=%s', [node_id])
    return {'node_id': node_id}


def delete_index(connection, source, table_id):
    result = connection.execute(
        'DELETE FROM {} WHERE table_ID=%s'.format(
            full_table_name(source['database'], source['list_table'])),
        [int(table_id)],
    )
    if result.rowcount != 1:
        raise ValueError('指标不存在或已删除')
    return {'table_ID': int(table_id)}


def normalize_formula_config(formula_config):
    config = formula_config or {}
    if isinstance(config, str):
        config = json.loads(config) if config else {}
    formula = re.sub(r'\s+', '', str(config.get('formula') or ''))
    child_index = config.get('childIndex') or {}
    if not formula or not isinstance(child_index, dict) or not child_index:
        raise ValueError('计算公式和依赖指标不能为空')
    if re.search(r'[^a-o0-9\.\+\-\*/\(\)]', formula):
        raise ValueError('计算公式包含不支持的字符')
    children = OrderedDict()
    for letter in sorted(child_index):
        value = child_index[letter]
        if not isinstance(value, dict) or not value.get('key'):
            raise ValueError('依赖指标配置无效')
        children[str(letter)] = {
            'key': value.get('key'),
            '指标名称': value.get('指标名称') or '',
        }
    return {'formula': formula, 'childIndex': children}


def refresh_calculated_index_data(
        connection, source, index_sql, index_name, variety, fields):
    """用计算 SQL 的结果覆盖写入该指标在数据表中的数据。"""
    sql = str(index_sql or '').strip().rstrip(';').strip()
    if not is_safe_select_sql(sql) or re.match(r'^with\b', sql, re.I):
        return False
    table = full_table_name(source['database'], source['data_table'])
    connection.execute(
        'DELETE FROM {} WHERE {}=%s'.format(
            table, quote_identifier(fields['name'])),
        [index_name],
    )
    connection.execute(
        'INSERT INTO {table} ({type},{name},{date},{value}) '
        'SELECT %s, %s, calc.[日期], calc.[价格] FROM ({sql}) calc'.format(
            table=table,
            type=quote_identifier(fields['type']),
            name=quote_identifier(fields['name']),
            date=quote_identifier(fields['date']),
            value=quote_identifier(fields['value']),
            sql=sql.replace('%', '%%'),
        ),
        [variety, index_name],
    )
    return True


def add_calculated_index(
        connection, source, index_name, index_sql, formula_config, node_id):
    index_name = str(index_name or '').strip()
    if not index_name:
        raise ValueError('指标名称不能为空')
    if not is_safe_select_sql(index_sql):
        raise ValueError('指标语句不是安全的只读查询')
    config = normalize_formula_config(formula_config)
    _require_metric_parent(connection, node_id)
    table = full_table_name(source['database'], source['list_table'])
    duplicate = connection.execute(
        'SELECT COUNT(1) FROM {} WITH (UPDLOCK, HOLDLOCK) '
        'WHERE 指标名称=%s'.format(table),
        [index_name],
    ).scalar()
    if duplicate:
        raise ValueError('该品种下已存在同名指标')
    max_order = connection.execute(
        'SELECT ISNULL(MAX(node_order), 0) FROM {} WHERE node_id=%s'.format(
            table),
        [int(node_id)],
    ).scalar()
    node_order = (max_order or 0) + 1
    inserted = connection.execute(
        'INSERT INTO {} (指标分类,指标ID,指标名称,指标来源,指标语句,增加方式,'
        '更新次序,node_id,node_order,计算配置) OUTPUT INSERTED.table_ID '
        'VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)'.format(table),
        [
            source['variety'], '', index_name, CALCULATED_INDEX_SOURCE,
            index_sql,
            '覆盖', 1, int(node_id), node_order,
            json.dumps(config, ensure_ascii=False),
        ],
    ).fetchone()
    return {
        'table_ID': int(inserted[0]),
        'node_id': int(node_id),
        'node_order': node_order,
        '指标名称': index_name,
        '指标来源': CALCULATED_INDEX_SOURCE,
        '计算配置': config,
    }


def update_index_formula(
        connection, source, table_id, index_sql, formula_config):
    if not is_safe_select_sql(index_sql):
        raise ValueError('指标语句不是安全的只读查询')
    config = normalize_formula_config(formula_config)
    result = connection.execute(
        'UPDATE {} SET 指标来源=%s,指标语句=%s,计算配置=%s '
        'WHERE table_ID=%s'.format(
            full_table_name(source['database'], source['list_table'])),
        [
            CALCULATED_INDEX_SOURCE, index_sql,
            json.dumps(config, ensure_ascii=False), int(table_id),
        ],
    )
    if result.rowcount != 1:
        raise ValueError('指标已变化，请刷新后重试')
    return {'formula_config': config, '指标来源': CALCULATED_INDEX_SOURCE}


def read_stored_index_sql(stored_value, decrypt):
    """兼容明文与 AES 加密两种已存储的指标语句。"""
    value = str(stored_value or '').strip()
    if not value:
        return ''
    if re.match(r'^(?:select|with)\b', value, flags=re.IGNORECASE):
        return value
    return decrypt(value)


class DynamicDependencyError(ValueError):
    def __init__(self, message, dependencies=None, formula=''):
        super(DynamicDependencyError, self).__init__(message)
        self.dependencies = dependencies or []
        self.formula = formula or ''


_TABLE_PART = r'(?:\[[^\]]+\]|[^\s\.\[\],()]+)'
_TABLE_REFERENCE_RE = re.compile(
    r'\b(?:from|join)\s+({part}(?:\s*\.\s*{part})*)\s+(?:as\s+)?([a-z])\b'
    .format(part=_TABLE_PART),
    re.IGNORECASE,
)


def _column_pattern(column):
    return r'\[?{}\]?'.format(re.escape(column))


def _alias_tables(sql):
    result = {}
    for reference, alias in _TABLE_REFERENCE_RE.findall(sql):
        parts = [part.strip().strip('[]') for part in reference.split('.')]
        database = parts[0] if len(parts) == 3 else None
        result[alias.lower()] = (database, parts[-1])
    return result


def _resolve_alias_source(registry, database, data_table):
    if database:
        return registry['by_data'].get((database, data_table))
    matches = [
        source for (db_name, table), source in registry['by_data'].items()
        if table == data_table
    ]
    return matches[0] if len(matches) == 1 else None


def recover_formula_config(index_sql, registry, dependency_lookup, fields):
    """从标准计算 SQL 反推可编辑的公式配置。

    ``dependency_lookup(source, 指标名称)`` 返回该数据源指标列表中同名记录的
    table_ID 列表。
    """
    sql = str(index_sql or '').strip()
    select_match = re.search(
        r',\s*(.+?)\s+from\s+', sql, flags=re.IGNORECASE | re.DOTALL)
    if not select_match:
        raise ValueError('未识别到标准计算表达式')
    value_pattern = r'\b([a-z])\s*\.\s*{}'.format(_column_pattern(fields['value']))
    expression = re.sub(
        r'\s+(?:as\s+)?\[?[^\]\s,\.\+\-\*/\(\)]+\]?\s*$', '',
        select_match.group(1), flags=re.IGNORECASE)
    aliases = re.findall(value_pattern, expression, re.IGNORECASE)
    if not aliases:
        raise ValueError('未识别到标准计算表达式')
    formula = re.sub(
        value_pattern, lambda match: match.group(1).lower(), expression,
        flags=re.IGNORECASE)
    formula = re.sub(r'\s+', '', formula)
    if re.search(r'[^a-o0-9\.\+\-\*/\(\)]', formula, re.IGNORECASE):
        raise ValueError('计算表达式包含暂不支持的内容')

    conditions = re.findall(
        r'\b([a-z])\s*\.\s*{}\s*=\s*N?\'((?:[^\']|\'\')+)\''.format(
            _column_pattern(fields['name'])),
        sql, flags=re.IGNORECASE)
    metric_names = {}
    dynamic = False
    for alias, metric_name in conditions:
        alias = alias.lower()
        metric_name = metric_name.replace("''", "'")
        if alias in metric_names and metric_names[alias] != metric_name:
            dynamic = True
        metric_names[alias] = metric_name

    alias_tables = _alias_tables(sql)

    def resolve(alias, metric_name):
        database, data_table = alias_tables.get(alias, (None, None))
        source = _resolve_alias_source(registry, database, data_table)
        if source is None:
            raise ValueError('依赖别名 {} 的数据表未登记'.format(alias))
        matches = dependency_lookup(source, metric_name) or []
        if len(matches) != 1:
            raise ValueError('依赖指标“{}”匹配到 {} 条记录'.format(
                metric_name, len(matches)))
        return {
            'key': '{}|{}|{}|{}'.format(
                source['database'], source['list_table'],
                source['data_table'], int(matches[0])),
            '指标名称': metric_name,
        }

    if dynamic:
        dependencies = []
        for alias, metric_name in conditions:
            try:
                dependencies.append(resolve(alias.lower(), metric_name))
            except ValueError:
                continue
        raise DynamicDependencyError(
            '该 SQL 使用按条件切换指标的动态依赖，暂不能转换为固定计算公式',
            dependencies, formula)

    child_index = OrderedDict()
    for alias in sorted(set(item.lower() for item in aliases)):
        if alias not in metric_names:
            raise ValueError('依赖别名 {} 缺少指标名条件'.format(alias))
        child_index[alias] = resolve(alias, metric_names[alias])
    return {'formula': formula, 'childIndex': child_index}


def build_formula_recovery_result(
        index_source, stored_config, index_sql, registry, dependency_lookup,
        fields):
    config = stored_config if isinstance(stored_config, dict) else {}
    if config.get('formula') and config.get('childIndex'):
        return {
            'formula_config': config,
            'raw_sql': index_sql,
            'is_formula_read_only': False,
        }
    try:
        return {
            'formula_config': recover_formula_config(
                index_sql, registry, dependency_lookup, fields),
            'raw_sql': index_sql,
            'is_formula_read_only': False,
        }
    except DynamicDependencyError as error:
        return {
            'formula_config': None,
            'display_formula': error.formula,
            'raw_sql': index_sql,
            'read_only_reason': str(error),
            'dependencies': error.dependencies,
            'is_formula_read_only': True,
        }
    except ValueError as error:
        return {
            'formula_config': None,
            'display_formula': '',
            'raw_sql': index_sql,
            'read_only_reason': '该 SQL 暂不能转换为可编辑公式：{}'.format(error),
            'dependencies': [],
            'is_formula_read_only': True,
        }


def build_calculation_definition(raw_config, raw_sql, fields):
    """生成只读展示用的计算定义：展示公式、依赖指标与解析状态。"""
    config = raw_config or {}
    if isinstance(config, str):
        try:
            config = json.loads(config) if config else {}
        except ValueError:
            config = {}
    if not isinstance(config, dict):
        config = {}
    sql = str(raw_sql or '').strip().rstrip(';').strip()
    children = config.get('childIndex') if isinstance(
        config.get('childIndex'), dict) else {}

    value_re = re.compile(
        r'\b([a-z])\s*\.\s*{}'.format(_column_pattern(fields['value'])),
        re.IGNORECASE)
    name_re = re.compile(
        r'\b([a-z])\s*\.\s*{}\s*=\s*N?\'((?:[^\']|\'\')+)\''.format(
            _column_pattern(fields['name'])),
        re.IGNORECASE)
    expression = ''
    match = re.search(
        r'^\s*select\s+.+?,\s*(.+?)\s+from\s+', sql,
        flags=re.IGNORECASE | re.DOTALL)
    if match:
        expression = re.sub(
            r'\s+(?:as\s+)?\[?[^\]\s,\.\+\-\*/\(\)]+\]?\s*$', '',
            match.group(1).strip(), flags=re.IGNORECASE).strip()
    metric_names = OrderedDict(
        (alias.lower(), name.replace("''", "'"))
        for alias, name in name_re.findall(sql))
    aliases = list(OrderedDict.fromkeys(
        alias.lower() for alias in value_re.findall(expression)))

    parser_status = 'unavailable' if not sql else 'complex'
    display_formula = ''
    dependencies = []
    complex_sql = re.search(
        r'\b(?:case|over|group\s+by|union|having)\b|\(\s*select\b',
        expression, re.IGNORECASE)
    if (expression and aliases and not complex_sql
            and all(alias in metric_names for alias in aliases)):
        display_formula = value_re.sub(
            lambda item: metric_names[item.group(1).lower()], expression)
        display_formula = re.sub(r'\s*([+\-*/()])\s*', r' \1 ', display_formula)
        display_formula = re.sub(r'\s+', ' ', display_formula).strip()
        display_formula = display_formula.replace('( ', '(').replace(' )', ')')
        dependencies = [
            {'alias': alias, 'metricName': metric_names[alias]}
            for alias in aliases
        ]
        parser_status = 'parsed'
    elif config.get('formula') and children:
        display_formula = config['formula']
        dependencies = [
            {'alias': alias, 'metricName': child.get('指标名称') or ''}
            for alias, child in children.items() if isinstance(child, dict)
        ]
        parser_status = 'configured'

    return {
        'parserStatus': parser_status,
        'formula': config.get('formula') or '',
        'displayFormula': display_formula,
        'dependencies': dependencies,
        'rawSql': sql,
        'isSafeSql': is_safe_select_sql(sql) if sql else False,
    }
