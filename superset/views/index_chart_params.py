# -*- coding: utf-8 -*-
"""指标数据管理页“保存图表”使用的 slice 参数模板与数据源选择。

图表数据源（config INDEX_MANAGE里的indexListView值这个视图表 中的 datasource_id）的列固定为
指标日期 / 指标名 / 指标值。
"""
from __future__ import unicode_literals

from collections import OrderedDict
import copy
import json

CHART_DATE_COLUMN = '指标日期'
CHART_NAME_COLUMN = '指标名'
CHART_METRIC = 'avg__指标值'

_COMMON_FILTERS = [{'col': CHART_NAME_COLUMN, 'op': 'in', 'val': []}]

echarts_combine_params = {
    'viz_type': 'echarts_combine',
    'granularity_sqla': CHART_DATE_COLUMN,
    'time_grain_sqla': None,
    'since': '',
    'until': 'now',
    'entity': [CHART_NAME_COLUMN],
    'metrics': [CHART_METRIC],
    'columns': ['__timestamp'],
    'row_limit': 50000,
    'left_axis_use_reverse_order': False,
    'x_axis_showminmax': True,
    'boundaryGap': True,
    'whether_show_average_line': False,
    'connect_nulls': False,
    'is_item': False,
    'show_bar_value': False,
    'legend_right': False,
    'lable_format': '',
    'barGap': '',
    'barCategoryGap': '',
    'first_fillna_method': 'ffill',
    'second_fillna_method': 'bfill',
    'columns_value_display_on_the_right_Y_axis': '',
    'columns_value_represent_by_histogram': '',
    'columns_value_represent_by_area': '',
    'alias_labels': '',
    'opacity': 0.5,
    'x_axis_format': '',
    'x_is_time': False,
    'bar_expand': False,
    'mm_dd_align': False,
    'index_slice_order': '',
    'y_axis_format_left': '',
    'y_axis_format_right': '',
    'chartGrid': '',
    'tooltip_position': '',
    'chart_description1': '',
    'slice_data_from': '',
    'shift_indexes_set': '',
    'cross_period': '',
    'stroke_color_picker': {'r': 213, 'g': 26, 'b': 33, 'a': 1},
    'current_color_prior': False,
    'show_brush': 'auto',
    'brushExtentStart': 0.5,
    'stroke_width': None,
    'show_lastvalue': False,
    'event_list': '',
    'exec_code': '',
    'exec_code1': 'df_table = df.tail(5).copy()',
    'if_show_table': False,
    'color_scheme': 'bnbColors',
    'where': '',
    'having': '',
    'filters': _COMMON_FILTERS,
    'url_params': {},
}

echarts_stat_line_2_params = {
    'viz_type': 'echarts_stat_line_2',
    'granularity_sqla': CHART_DATE_COLUMN,
    'time_grain_sqla': None,
    'since': '',
    'until': 'now',
    'metrics': [CHART_METRIC],
    'all_columns': [],
    'day_shift_for_annual_start_days': 0,
    'legend_type': 0,
    'show_y_min_max_strict': False,
    'day_shift': 0,
    'day_skip': 0,
    'first_fillna_method': 'ffill',
    'second_fillna_method': 'bfill',
    'day_shift_for_month_display': 0,
    'stroke_width': 5,
    'stroke_type': 'solid',
    'chart_symbol': '',
    'y_axis_format': '',
    'data_display_type': 'line',
    'show_lastvalue': True,
    'x_axis_showminmax': False,
    'divide_start': False,
    'sub_start': False,
    'only_show_first_day_in_month': False,
    'whether_show_average_line': True,
    'connect_nulls': True,
    'showAllSymbol': False,
    'chart_description1': '',
    'slice_data_from': '',
    'whether_accumulate': False,
    'wether_avg_minus': False,
    'show_t_h_bi': True,
    'tongbi': '',
    'huanbi': '',
    'x_axis_time_format': '',
    'chartGrid': '',
    'rolling_type': 'None',
    'exec_code': '',
    'color_scheme': 'bnbColors1',
    'annotation_layers': [],
    'where': '',
    'having': '',
    'filters': _COMMON_FILTERS,
    'url_params': {},
}

pivot_table_params = {
    'viz_type': 'pivot_table',
    'granularity_sqla': CHART_DATE_COLUMN,
    'time_grain_sqla': None,
    'since': '',
    'until': 'now',
    'groupby': ['__timestamp'],
    'columns': [CHART_NAME_COLUMN],
    'metrics': [CHART_METRIC],
    'pandas_aggfunc': 'sum',
    'number_format': '.4r',
    'table_timestamp_format': '%Y-%m-%d',
    'split_datetime_index_periods': False,
    'combine_metric': False,
    'order_type': 'desc',
    'sub_total': False,
    'pivot_margins': False,
    'show_max': False,
    'show_min': False,
    'show_hsl_bg': False,
    'show_hsl_bg_zero': False,
    'show_hsl_bg_text': False,
    'hsl_reversal': False,
    'exec_code': '',
    'where': '',
    'having': '',
    'filters': _COMMON_FILTERS,
    'url_params': {},
}

CHART_TYPES = ('line', 'bar', 'area', 'season', 'pivot')
ALLOWED_COLOR_SCHEMES = frozenset([
    'bnbColors', 'bnbColors1', 'zahfColors', 'zbColors',
])


def build_saved_chart_params(chart_type, color_scheme=None):
    if chart_type not in CHART_TYPES:
        raise ValueError('不支持的图表类型')
    if chart_type == 'season':
        template = echarts_stat_line_2_params
    elif chart_type == 'pivot':
        template = pivot_table_params
    else:
        template = echarts_combine_params
    params = copy.deepcopy(template)
    if color_scheme in ALLOWED_COLOR_SCHEMES:
        params['color_scheme'] = color_scheme
    return params


def pick_primary_datasource(chart_indexes):
    """选出指标最多的数据源，数量相同时取最先出现的。

    ``chart_indexes`` 为按图表顺序排列的 ``[(指标名称, 配置), ...]``，配置中
    的 datasource_id 已由后端按指标 key 回填。返回
    ``(datasource_id, [(指标名称, 配置), ...])``，其余数据源的指标被丢弃。
    """
    counts = OrderedDict()
    for _, info in chart_indexes:
        datasource_id = info.get('datasource_id')
        if datasource_id is None:
            continue
        counts[datasource_id] = counts.get(datasource_id, 0) + 1
    if not counts:
        raise ValueError('图表指标缺少数据源')
    best_count = max(counts.values())
    datasource_id = next(
        key for key, count in counts.items() if count == best_count)
    kept = [
        (name, info) for name, info in chart_indexes
        if info.get('datasource_id') == datasource_id
    ]
    return datasource_id, kept


def apply_series_options(params, chart_type, chart_indexes):
    """写入指标过滤与每个指标的柱状/面积（含堆叠）/右轴配置。"""
    names = [name for name, _ in chart_indexes]
    params['filters'] = [
        {'col': CHART_NAME_COLUMN, 'op': 'in', 'val': names},
    ]
    if chart_type in ('season', 'pivot'):
        return params
    bars = []
    areas = []
    right_axis = []
    for name, info in chart_indexes:
        series_type = info.get('chartType') or chart_type
        if series_type == 'bar':
            bars.append(name)
        elif series_type == 'area' or info.get('stacked'):
            areas.append(name)
        if info.get('yAxisIndex') == 1:
            right_axis.append(name)
    params['columns_value_represent_by_histogram'] = '|'.join(bars)
    params['columns_value_represent_by_area'] = '|'.join(areas)
    params['columns_value_display_on_the_right_Y_axis'] = '|'.join(right_axis)
    return params


def order_pivot_indicator_names(indicator_names, requested_order):
    available = list(indicator_names or [])
    available_set = set(available)
    ordered = []
    for name in requested_order or []:
        if name in available_set and name not in ordered:
            ordered.append(name)
    ordered.extend(name for name in available if name not in ordered)
    return ordered


def apply_pivot_personalization(
        params, show_variety_labels, variety_map, variety_colors):
    params['pivot_show_variety_labels'] = bool(show_variety_labels)
    params['pivot_variety_map'] = json.dumps(
        variety_map or {}, ensure_ascii=False)
    params['pivot_variety_colors'] = json.dumps(
        variety_colors or {}, ensure_ascii=False)
    return params


def apply_saved_chart_to_slice(slc, params, datasource, chart_name):
    params['datasource'] = '{}__table'.format(datasource.id)
    slc.params = json.dumps(params, ensure_ascii=False)
    slc.datasource_name = datasource.name
    slc.datasource_type = 'table'
    slc.datasource_id = datasource.id
    slc.viz_type = params.get('viz_type')
    slc.slice_name = chart_name
    return slc
