# -*- coding: utf-8 -*-
"""This module contains the 'Viz' objects

These objects represent the backend of all the visualizations that
Superset can render.
"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from collections import defaultdict
import copy
from datetime import datetime, timedelta
import hashlib
import inspect
from itertools import product
import logging
import math
import re
import traceback
import uuid

from dateutil import relativedelta as rdelta
from flask import request
from flask_babel import lazy_gettext as _
import geohash2 as geohash
from geopy.point import Point
from markupsafe import escape
from markdown import markdown
import numpy as np
import pandas as pd
from pandas.tseries.frequencies import to_offset
import polyline
import simplejson as json
from six import string_types, text_type
from six.moves import cPickle as pkl, reduce

from superset import app, cache, get_manifest_file, utils
from superset.aes_utils import aes_encrypt
from superset.dataframe_export import dataframe_to_excel
from superset.utils import DTTM_ALIAS, JS_MAX_INTEGER, merge_extra_filters, calculate_year_days, shift_dataframe
from ast import literal_eval
import base64

config = app.config
stats_logger = config.get('STATS_LOGGER')


class BaseViz(object):
    """All visualizations derive this base class"""

    viz_type = None
    verbose_name = 'Base Viz'
    credits = ''
    is_timeseries = False
    default_fillna = 0
    cache_type = 'df'

    def __init__(self, datasource, form_data, force=False, custom_params={}):
        if not datasource:
            raise Exception(_('Viz is missing a datasource'))
        self.datasource = datasource
        self.request = request
        self.viz_type = form_data.get('viz_type')
        self.form_data = form_data

        self.query = ''
        self.token = self.form_data.get(
            'token', 'token_' + uuid.uuid4().hex[:8])
        metrics = self.form_data.get('metrics') or []
        self.metrics = []
        for metric in metrics:
            if isinstance(metric, dict):
                self.metrics.append(metric['label'])
            else:
                self.metrics.append(metric)

        self.groupby = self.form_data.get('groupby') or []
        self.time_shift = timedelta()

        self.status = None
        self.error_message = None
        self.force = force
        self.custom_params = custom_params

        # Keeping track of whether some data came from cache
        # this is useful to trigerr the <CachedLabel /> when
        # in the cases where visualization have many queries
        # (FilterBox for instance)
        self._some_from_cache = False
        self._any_cache_key = None
        self._any_cached_dttm = None
        self._extra_chart_data = None

    @staticmethod
    def handle_js_int_overflow(data):
        for d in data.get('records', dict()):
            for k, v in list(d.items()):
                if isinstance(v, int):
                    # if an int is too big for Java Script to handle
                    # convert it to a string
                    if abs(v) > JS_MAX_INTEGER:
                        d[k] = str(v)
        return data

    def run_extra_queries(self):
        """Lyfecycle method to use when more than one query is needed

        In rare-ish cases, a visualization may need to execute multiple
        queries. That is the case for FilterBox or for time comparison
        in Line chart for instance.

        In those cases, we need to make sure these queries run before the
        main `get_payload` method gets called, so that the overall caching
        metadata can be right. The way it works here is that if any of
        the previous `get_df_payload` calls hit the cache, the main
        payload's metadata will reflect that.

        The multi-query support may need more work to become a first class
        use case in the framework, and for the UI to reflect the subtleties
        (show that only some of the queries were served from cache for
        instance). In the meantime, since multi-query is rare, we treat
        it with a bit of a hack. Note that the hack became necessary
        when moving from caching the visualization's data itself, to caching
        the underlying query(ies).
        """
        pass

    def get_fillna_for_col(self, col):
        """Returns the value for use as filler for a specific Column.type"""
        if col:
            if col.is_string:
                return ' NULL'
        return self.default_fillna

    def get_fillna_for_columns(self, columns=None):
        """Returns a dict or scalar that can be passed to DataFrame.fillna"""
        if columns is None:
            return self.default_fillna
        columns_dict = {col.column_name: col for col in self.datasource.columns}
        fillna = {
            c: self.get_fillna_for_col(columns_dict.get(c))
            for c in columns
        }
        return fillna

    def get_df(self, query_obj=None):
        """Returns a pandas dataframe based on the query object"""
        if not query_obj:
            query_obj = self.query_obj()
        if not query_obj:
            return None

        self.error_msg = ''
        self.results = None

        timestamp_format = None
        if self.datasource.type == 'table':
            dttm_col = self.datasource.get_col(query_obj['granularity'])
            if dttm_col:
                # Empty string must be treated as unspecified; pandas 2.x
                # rejects format="" when values are date strings.
                timestamp_format = dttm_col.python_date_format or None

        # The datasource here can be different backend but the interface is common
        self.results = self.datasource.query(query_obj)
        self.query = self.results.query
        self.status = self.results.status
        self.error_message = self.results.error_message

        df = self.results.df
        # Transform the timestamp we received from database to pandas supported
        # datetime format. If no python_date_format is specified, the pattern will
        # be considered as the default ISO date format
        # If the datetime format is unix, the parse will use the corresponding
        # parsing logic.
        if df is None or df.empty:
            return pd.DataFrame()
        else:
            if DTTM_ALIAS in df.columns:
                if timestamp_format in ('epoch_s', 'epoch_ms'):
                    df[DTTM_ALIAS] = pd.to_datetime(
                        df[DTTM_ALIAS], utc=False, unit=timestamp_format[6:])
                else:
                    df[DTTM_ALIAS] = pd.to_datetime(
                        df[DTTM_ALIAS], utc=False, format=timestamp_format)
                if self.datasource.offset:
                    df[DTTM_ALIAS] += timedelta(hours=self.datasource.offset)
                df[DTTM_ALIAS] += self.time_shift

            self.df_metrics_to_num(df, query_obj.get('metrics') or [])

            df.replace([np.inf, -np.inf], np.nan)
            # tanke 20250910 注释掉以下2行
            fillna = self.get_fillna_for_columns(df.columns)
            df = df.fillna(fillna)
        return df

    @staticmethod
    def df_metrics_to_num(df, metrics):
        """Converting metrics to numeric when pandas.read_sql cannot"""
        for col, dtype in df.dtypes.items():
            if dtype.type == np.object_ and col in metrics:
                df[col] = pd.to_numeric(df[col])

    def query_obj(self):
        """Building a query object"""
        form_data = self.form_data
        gb = form_data.get('groupby') or []
        metrics = form_data.get('metrics') or []
        columns = form_data.get('columns') or []
        groupby = []
        for o in gb + columns:
            if o not in groupby:
                groupby.append(o)

        is_timeseries = self.is_timeseries
        if DTTM_ALIAS in groupby:
            groupby.remove(DTTM_ALIAS)
            is_timeseries = True

        # Add extra filters into the query form data
        merge_extra_filters(form_data)

        granularity = (
                form_data.get('granularity') or
                form_data.get('granularity_sqla')
        )
        limit = int(form_data.get('limit') or 0)
        timeseries_limit_metric = form_data.get('timeseries_limit_metric')
        row_limit = int(form_data.get('row_limit') or config.get('ROW_LIMIT'))

        # default order direction
        order_desc = form_data.get('order_desc', True)

        since = form_data.get('since', '')
        until = form_data.get('until', 'now')
        time_shift = form_data.get('time_shift', '')

        # Backward compatibility hack
        if since:
            since_words = since.split(' ')
            grains = ['days', 'years', 'hours', 'day', 'year', 'weeks']
            if (len(since_words) == 2 and since_words[1] in grains):
                since += ' ago'

        self.time_shift = utils.parse_human_timedelta(time_shift)

        since = utils.parse_human_datetime(since)
        until = utils.parse_human_datetime(until)
        from_dttm = None if since is None else (since - self.time_shift)
        to_dttm = None if until is None else (until - self.time_shift)
        if from_dttm and to_dttm and from_dttm > to_dttm:
            raise Exception(_('From date cannot be larger than to date'))

        self.from_dttm = from_dttm
        self.to_dttm = to_dttm

        # extras are used to query elements specific to a datasource type
        # for instance the extra where clause that applies only to Tables
        extras = {
            'where': form_data.get('where', ''),
            'having': form_data.get('having', ''),
            'having_druid': form_data.get('having_filters', []),
            'time_grain_sqla': form_data.get('time_grain_sqla', ''),
            'druid_time_origin': form_data.get('druid_time_origin', ''),
        }
        filters = form_data.get('filters', [])
        d = {
            'granularity': granularity,
            'from_dttm': from_dttm,
            'to_dttm': to_dttm,
            'is_timeseries': is_timeseries,
            'groupby': groupby,
            'metrics': metrics,
            'row_limit': row_limit,
            'filter': filters,
            'timeseries_limit': limit,
            'extras': extras,
            'timeseries_limit_metric': timeseries_limit_metric,
            'order_desc': order_desc,
            'prequeries': [],
            'is_prequery': False,
        }
        return d

    @property
    def cache_timeout(self):
        if self.form_data.get('cache_timeout'):
            return int(self.form_data.get('cache_timeout'))
        if self.datasource.cache_timeout:
            return self.datasource.cache_timeout
        if (
                hasattr(self.datasource, 'database') and
                self.datasource.database.cache_timeout):
            return self.datasource.database.cache_timeout
        return config.get('CACHE_DEFAULT_TIMEOUT')

    def get_json(self):
        return json.dumps(
            self.get_payload(),
            default=utils.json_int_dttm_ser, ignore_nan=True)

    def cache_key(self, query_obj):
        """
        The cache key is made out of the key/values in `query_obj`

        We remove datetime bounds that are hard values,
        and replace them with the use-provided inputs to bounds, which
        may we time-relative (as in "5 days ago" or "now").
        """
        cache_dict = copy.deepcopy(query_obj)

        for k in ['from_dttm', 'to_dttm']:
            del cache_dict[k]

        for k in ['since', 'until']:
            cache_dict[k] = self.form_data.get(k)

        cache_dict['datasource'] = self.datasource.uid
        json_data = self.json_dumps(cache_dict, sort_keys=True)
        return hashlib.md5(json_data.encode('utf-8')).hexdigest()

    def get_payload(self, query_obj=None):
        """Returns a payload of metadata and data"""
        self.run_extra_queries()
        payload = self.get_df_payload(query_obj)

        df = payload.get('df')
        if self.status != utils.QueryStatus.FAILED:
            if df is not None and df.empty:
                payload['error'] = 'No data'
            else:
                payload['data'] = self.get_data(df)
        if 'df' in payload:
            del payload['df']
        return payload

    def get_df_payload(self, query_obj=None):
        """Handles caching around the df payload retrieval"""
        if not query_obj:
            query_obj = self.query_obj()
        cache_key = self.cache_key(query_obj) if query_obj else None
        logging.info('Cache key: {}'.format(cache_key))
        is_loaded = False
        stacktrace = None
        df = None
        cached_dttm = datetime.utcnow().isoformat().split('.')[0]
        if cache_key and cache and not self.force:
            cache_value = cache.get(cache_key)
            if cache_value:
                stats_logger.incr('loaded_from_cache')
                try:
                    cache_value = pkl.loads(cache_value)
                    df = cache_value['df']
                    self.query = cache_value['query']
                    self._any_cached_dttm = cache_value['dttm']
                    self._any_cache_key = cache_key
                    self.status = utils.QueryStatus.SUCCESS
                    is_loaded = True
                except Exception as e:
                    logging.exception(e)
                    logging.error('Error reading cache: ' +
                                  utils.error_msg_from_exception(e))
                logging.info('Serving from cache')

        if query_obj and not is_loaded:
            try:
                df = self.get_df(query_obj)
                if self.status != utils.QueryStatus.FAILED:
                    stats_logger.incr('loaded_from_source')
                    is_loaded = True
            except Exception as e:
                logging.exception(e)
                if not self.error_message:
                    self.error_message = escape('{}'.format(e))
                self.status = utils.QueryStatus.FAILED
                stacktrace = traceback.format_exc()

            if (
                    is_loaded and
                    cache_key and
                    cache and
                    self.status != utils.QueryStatus.FAILED):
                try:
                    cache_value = dict(
                        dttm=cached_dttm,
                        df=df if df is not None else None,
                        query=self.query,
                    )
                    cache_value = pkl.dumps(
                        cache_value, protocol=pkl.HIGHEST_PROTOCOL)

                    logging.info('Caching {} chars at key {}'.format(
                        len(cache_value), cache_key))

                    stats_logger.incr('set_cache_key')
                    cache.set(
                        cache_key,
                        cache_value,
                        timeout=self.cache_timeout)
                except Exception as e:
                    # cache.set call can fail if the backend is down or if
                    # the key is too large or whatever other reasons
                    logging.warning('Could not cache key {}'.format(cache_key))
                    logging.exception(e)
                    cache.delete(cache_key)

        return {
            'cache_key': self._any_cache_key,
            'cached_dttm': self._any_cached_dttm,
            'cache_timeout': self.cache_timeout,
            'df': df,
            'error': self.error_message,
            'form_data': self.form_data,
            'is_cached': self._any_cache_key is not None,
            'query': self.query,
            'status': self.status,
            'stacktrace': stacktrace,
            'rowcount': len(df.index) if df is not None else 0,
        }

    def json_dumps(self, obj, sort_keys=False):
        return json.dumps(
            obj,
            default=utils.json_int_dttm_ser,
            ignore_nan=True,
            sort_keys=sort_keys,
        )

    @property
    def data(self):
        """This is the data object serialized to the js layer"""
        content = {
            'form_data': self.form_data,
            'token': self.token,
            'viz_name': self.viz_type,
            'filter_select_enabled': self.datasource.filter_select_enabled,
        }
        return content

    def get_csv(self):
        df = self.get_df()
        include_index = not isinstance(df.index, pd.RangeIndex)
        return df.to_csv(index=include_index, **config.get('CSV_EXPORT'))

    def get_excel(self):
        return dataframe_to_excel(self.get_df(), config)

    def get_data(self, df):
        return []

    @property
    def json_data(self):
        return json.dumps(self.data)

    @staticmethod
    def get_default_value(fd, key, default_val):
        tmp_val = fd.get(key)
        if tmp_val is None or tmp_val == '':
            return default_val
        else:
            return tmp_val

    @staticmethod
    def get_float_or_default_value(fd, key, default_val):
        tmp_val = fd.get(key)
        if tmp_val is None or tmp_val == '':
            return default_val
        else:
            return float(tmp_val)

    @staticmethod
    def index_rename_season(index):
        if str(index).isdigit():
            index_tmp = str(index)[2:] + '/' + str(int(index) + 1)[2:]
            return index_tmp
        else:
            return index


# ----------------------------- this is echarts start --------------------------------

class EchartsFunnelViz(BaseViz):
    """ Funnel Chart"""
    viz_type = 'echarts_funnel'
    is_timeseries = False

    def get_data(self, df):
        df = df.pivot_table(
            index=self.groupby,
            values=[self.metrics[0]])
        df.sort_values(by=self.metrics[0], ascending=False, inplace=True)
        df = df.reset_index()
        df.columns = ['name', 'value']
        return df.to_dict(orient='records')


class EchartsStatLineViz(BaseViz):
    """ Statistics Line Chart 面积季节"""
    viz_type = 'echarts_stat_line'
    is_timeseries = True

    def query_obj(self):
        d = super(EchartsStatLineViz, self).query_obj()
        fd = self.form_data

        if fd.get('all_columns') and fd.get('metrics'):
            raise Exception(_('Please choose only one of "Columns" or "Metrics"'))
        elif not fd.get('all_columns') and not fd.get('metrics'):
            raise Exception(_('Please choose only one of "Columns" or "Metrics"'))
        elif fd.get('all_columns'):
            columns = fd.get('all_columns')
            if len(columns) != 1:
                raise Exception(_('Please choose only one column in "Columns"'))
            d['columns'] = fd.get('all_columns')
            d['groupby'] = []
        elif fd.get('metrics'):
            metrics = fd.get('metrics')
            if len(metrics) != 1:
                raise Exception(_('Please choose only one metric in "Metrics"'))
            d['groupby'] = []
        return d

    def get_data(self, df):
        fd = self.form_data
        df = df.sort_values(by="__timestamp", ascending=False)

        rolling_type = fd.get('rolling_type')
        rolling_periods = int(fd.get('rolling_periods') or 0)
        min_periods = int(fd.get('min_periods') or 0)
        metrics_name_list = list()
        if fd.get('metrics'):
            metrics_name_list = utils.get_metric_names(fd.get('metrics'))
        else:
            metrics_name_list = fd.get('all_columns')
        if rolling_periods and len(metrics_name_list):
            df.sort_values(by="__timestamp", inplace=True)
            if rolling_type in ('mean', 'std', 'sum'):
                for metricName in metrics_name_list:
                    if rolling_type == 'mean':
                        df[metricName] = df[metricName].rolling(window=rolling_periods, min_periods=min_periods).mean()
                    elif rolling_type == 'std':
                        df[metricName] = df[metricName].rolling(window=rolling_periods, min_periods=min_periods).std()
                    elif rolling_type == 'sum':
                        df[metricName] = df[metricName].rolling(window=rolling_periods, min_periods=min_periods).sum()
            elif rolling_type == 'cumsum':
                for metricName in metrics_name_list:
                    df[metricName] = df[metricName].cumsum()
            if min_periods:
                df = df[min_periods:]

        if fd.get('metrics'):
            df = df.pivot_table(
                index=DTTM_ALIAS,
                values=utils.get_metric_names(fd.get('metrics')))
            df.columns = ['value']
            df['date'] = df.index
        else:
            df.columns = ['value', 'date']

        if fd.get('whether_accumulate'):
            if fd.get("lowest_limit") != "":
                df.loc[df['value'] < fd.get("lowest_limit"), 'value'] = 0
            if fd.get("highest_limit") != "":
                df.loc[df['value'] > fd.get("highest_limit"), 'value'] = fd.get("highest_limit")

        # 计算百分比或者万等
        df.sort_values(by='date', inplace=True)
        huanbi_type = fd.get('huanbi')
        cal_type = self.custom_params.get('cal_type', None)
        if cal_type and cal_type.startswith('huanbi'):
            huanbi_type = cal_type.split('_')[1]
        if not cal_type or not cal_type.startswith('tongbi'):
            if huanbi_type:
                if huanbi_type == 'pctchange':
                    df['value'] = df['value'].pct_change()
                    df['value'] = df['value'].fillna(method='bfill')
                elif huanbi_type == 'pctminus':
                    df['value'] = df['value'].diff()
                    df['value'] = df['value'].fillna(method='bfill')
        df.date = pd.to_datetime(df.date.dt.date)
        newest_value = round(df.iloc[-1]['value'], 3)
        newest_date = df.iloc[-1]['date'].strftime('%m-%d')

        min_date = df['date'].min()
        max_date = df['date'].max()
        dt_index = pd.date_range(start=min_date, end=max_date)
        df.index = df['date']
        df = df.reindex(dt_index)
        df['date'] = df.index

        if (cal_type and cal_type.startswith('tongbi')) or fd.get('tongbi'):
            df_tongbi_fillna = df.copy()
            df_tongbi_fillna['value'] = df_tongbi_fillna['value'].fillna(method='ffill')
        day_shift_for_month_display = self.form_data.get('day_shift_for_month_display')
        only_show_first_day_in_month = self.form_data.get('only_show_first_day_in_month')
        if only_show_first_day_in_month and day_shift_for_month_display != 0:
            df['value'] = df['value'].shift(-day_shift_for_month_display)

        if fd.get('fill_fix') != "" and fd.get('fill_fix') is not None:
            df['value'] = df['value'].fillna(fd.get('fill_fix'))
        if fd.get('first_fillna_method') != 'None':
            df['value'] = df['value'].fillna(method=fd.get('first_fillna_method'))
        if fd.get('second_fillna_method') != 'None':
            df['value'] = df['value'].fillna(method=fd.get('second_fillna_method'))

        df['nianfen'] = df['date'].dt.strftime('%Y')
        df['tongbi'] = df['date'].dt.strftime('%m-%d')

        df_pivot = pd.pivot_table(df, index=['tongbi'], columns=['nianfen'], values=['value'])
        # 谭科 测试注释20221129
        # df_pivot[df_pivot.columns[1:]] = df_pivot[df_pivot.columns[1:]].fillna(method='bfill').astype(float)
        df_pivot = df_pivot['value']
        if fd.get('legend_type') == 1:
            df_pivot.columns = [str(int(x) + 1) if len(x) == 4 else x for x in df_pivot.columns]
        if len(df_pivot.columns) < 3:
            raise Exception(_('同比图至少需要包含2年的历史数据'))

        last_year = df_pivot.columns[-1]
        first_year = df_pivot.columns[0]
        pre_first_year = int(first_year) - 1

        # 起始日期配置项处理
        day_shift_for_annual_start_days = fd.get('day_shift_for_annual_start_days')
        if day_shift_for_annual_start_days > 0:
            df_pivot_tail = df_pivot.iloc[:day_shift_for_annual_start_days].copy()
            df_pivot_tail.columns = [str(int(x) - 1) for x in df_pivot_tail.columns]
            df_pivot_tail[last_year] = np.nan

            df_pivot_head = df_pivot.iloc[day_shift_for_annual_start_days:].copy()
            df_pivot_head.insert(0, str(pre_first_year), np.nan)

            df_pivot = pd.concat([df_pivot_head, df_pivot_tail])
            df_pivot.dropna(axis=1, how='all', inplace=True)

        # 起始日期配置项处理  结束

        ret_dict = dict()

        ret_dict['left_axis_min_value'] = \
            self.get_float_or_default_value(self.form_data, 'left_axis_min_value', 'dataMin')
        ret_dict['left_axis_max_value'] = \
            self.get_float_or_default_value(self.form_data, 'left_axis_max_value', 'dataMax')

        df_output = df_pivot.T

        day_shift = self.form_data.get('day_shift')
        if day_shift > 0:
            df_output = df_output[df_output.columns[day_shift:].tolist() + df_output.columns[0:day_shift].tolist()]

        day_skip = self.form_data.get('day_skip')
        if day_skip > 0:
            df_output = df_output[df_output.columns[day_skip:].tolist()]
        if only_show_first_day_in_month:
            new_columns = [column for column in df_output.columns if column.endswith('-01')]
            df_output = df_output[new_columns]
        if fd.get('divide_start'):
            df_output = df_output.div(df_output.iloc[:, 0], axis=0)
        if fd.get('sub_start'):
            df_output = df_output.sub(df_output.iloc[:, 0], axis=0)

        if fd.get('whether_accumulate') and not cal_type:
            df_output.replace([''], np.nan, inplace=True)
            last_column = len(df_output.columns) - 1
            df_output.iloc[0:-1, [last_column]] = df_output.iloc[0:-1, [last_column]].fillna(0)
            df_output = df_output.cumsum(1)
        tongbi_type = fd.get('tongbi')
        if cal_type and cal_type.startswith('tongbi'):
            tongbi_type = cal_type.split('_')[1]
        if not cal_type or not cal_type.startswith('huanbi'):
            if tongbi_type:
                df_tongbi_fillna['nianfen'] = df_tongbi_fillna['date'].dt.strftime('%Y')
                df_tongbi_fillna['tongbi'] = df_tongbi_fillna['date'].dt.strftime('%m-%d')
                df_tongbi_fillna_pivot = pd.pivot_table(df_tongbi_fillna , index=['nianfen'], columns=['tongbi'], values=['value'])
                df_tongbi_fillna_pivot = df_tongbi_fillna_pivot['value'].fillna(method='bfill', axis=1)
                if tongbi_type == 'pctchange':
                    df_tongbi_pctchange = df_tongbi_fillna_pivot.pct_change()
                    df_output = df_output.mask(df_output.notna(), df_tongbi_pctchange)
                    df_output = df_output.iloc[1:, :]
                elif tongbi_type == 'pctminus':
                    df_tongbi_pctminus = df_tongbi_fillna_pivot.diff()
                    df_output = df_output.mask(df_output.notna(), df_tongbi_pctminus)
                    df_output = df_output.iloc[1:, :]

        df_output = df_output.T
        df_pivot_tmp = df_output.fillna(method='ffill').fillna(method='bfill')
        last_year = df_pivot_tmp.columns[-1]
        year_range = '{0}-{1}'.format(df_pivot_tmp.columns[0], df_pivot_tmp.columns[-2])
        df_output.loc[:, year_range + '最大值'] = df_pivot_tmp.drop(last_year, axis=1).max(1)
        df_output.loc[:, year_range + '最小值'] = df_pivot_tmp.drop(last_year, axis=1).min(1)
        df_output.loc[:, year_range + '均值'] = df_pivot_tmp.drop(last_year, axis=1).mean(1)
        # df_output.loc[:, '高低差'] = df_output[year_range + '最大值'] - df_output[year_range + '最小值']

        # 各列减去均值列
        if fd.get('wether_avg_minus'):
            for cl_name in df_output.columns.tolist():
                df_output[cl_name] = df_output[cl_name] - df_output.iloc[:, -1]

        df_output = df_output.round(3).T

        ret_dict['newest_value'] = newest_value
        ret_dict['newest_date'] = newest_date
        max_year = df_output.index.tolist()[-4]
        if newest_date in df_output.columns:
            newest_value = df_output.loc[max_year, newest_date]
            if not np.isnan(newest_value):
                ret_dict['newest_value'] = newest_value

        if fd.get('legend_type') == 2:
            df_output.index = df_output.index.map(self.index_rename_season)
        # df_output 排除最后4行
        df_max_min = df_output.iloc[:-4, :]
        # 获取 df_max_min 的最大值和最小值 所在行的索引，如果有多个最大值或最小值，只取第一个
        max_index = df_max_min.max(axis=1).idxmax()
        min_index = df_max_min.min(axis=1).idxmin()
        ret_dict['max_index'] = max_index
        ret_dict['min_index'] = min_index

        ret_dict['data'] = df_output.to_dict(orient='split')
        ret_dict['custom_params'] = self.custom_params
        return ret_dict


class EchartsStatLineViz2(BaseViz):
    """ Statistics Line Chart 曲线季节"""
    viz_type = 'echarts_stat_line_2'
    is_timeseries = True

    def handle_duplicate_2m(self, column):
        if "均值" in column.name:
            return (column[0] + column[1]) / 2
        else:
            return column[0] if not math.isnan(column[0]) else column[1]

    def query_obj(self):
        d = super(EchartsStatLineViz2, self).query_obj()
        fd = self.form_data

        if fd.get('all_columns') and fd.get('metrics'):
            raise Exception(_('Please choose only one of "Columns" or "Metrics"'))
        elif not fd.get('all_columns') and not fd.get('metrics'):
            raise Exception(_('Please choose only one of "Columns" or "Metrics"'))
        elif fd.get('all_columns'):
            columns = fd.get('all_columns')
            if len(columns) != 1:
                raise Exception(_('Please choose only one column in "Columns"'))
            d['columns'] = fd.get('all_columns')
            d['groupby'] = []
        elif fd.get('metrics'):
            metrics = fd.get('metrics')
            if len(metrics) != 1:
                raise Exception(_('Please choose only one metric in "Metrics"'))
            d['groupby'] = []
        return d

    def get_data(self, df):
        fd = self.form_data
        loc_dict = {"df": df,}
        if fd.get('exec_code'):
            exec_code_str = fd.get('exec_code')
            regex_exec_code = re.compile(re.escape('execute'), re.IGNORECASE)
            exec_code_str = regex_exec_code.sub("", exec_code_str)
            regex_exec_code = re.compile(re.escape('to_sql'), re.IGNORECASE)
            exec_code_str = regex_exec_code.sub("", exec_code_str)
            regex_exec_code = re.compile(re.escape('read_sql'), re.IGNORECASE)
            exec_code_str = regex_exec_code.sub("", exec_code_str)

            exec(exec_code_str, globals(), loc_dict)
            df = loc_dict['df']
        first_fillna_method = fd.get('first_fillna_method')
        second_fillna_method = fd.get('second_fillna_method')
        rolling_type = fd.get('rolling_type')
        rolling_periods = int(fd.get('rolling_periods') or 0)
        min_periods = int(fd.get('min_periods') or 0)
        metrics_name_list = list()
        if fd.get('metrics'):
            metrics_name_list = utils.get_metric_names(fd.get('metrics'))
        else:
            metrics_name_list = fd.get('all_columns')
        if rolling_periods and len(metrics_name_list):
            df.sort_values(by="__timestamp", inplace=True)
            if rolling_type in ('mean', 'std', 'sum'):
                for metricName in metrics_name_list:
                    if rolling_type == 'mean':
                        df[metricName] = df[metricName].rolling(window=rolling_periods, min_periods=min_periods).mean()
                    elif rolling_type == 'std':
                        df[metricName] = df[metricName].rolling(window=rolling_periods, min_periods=min_periods).std()
                    elif rolling_type == 'sum':
                        df[metricName] = df[metricName].rolling(window=rolling_periods, min_periods=min_periods).sum()
            elif rolling_type == 'cumsum':
                for metricName in metrics_name_list:
                    df[metricName] = df[metricName].cumsum()
            if min_periods:
                df = df[min_periods:]

        if fd.get('metrics'):
            df = df.pivot_table(
                index=DTTM_ALIAS,
                values=utils.get_metric_names(fd.get('metrics')))
            df.columns = ['value']
            df['date'] = df.index
        else:
            df.columns = ['value', 'date']

        if fd.get("lowest_limit") != "":
            df.loc[df['value'] < fd.get("lowest_limit"), 'value'] = 0
        if fd.get("highest_limit") != "":
            df.loc[df['value'] > fd.get("highest_limit"), 'value'] = fd.get("highest_limit")
        # 计算百分比或者万等
        df.sort_values(by='date', inplace=True)

        huanbi_type = fd.get('huanbi')
        cal_type = self.custom_params.get('cal_type', None)
        if cal_type and cal_type.startswith('huanbi'):
            huanbi_type = cal_type.split('_')[1]
        if not cal_type or not cal_type.startswith('tongbi'):
            if huanbi_type:
                if huanbi_type == 'pctchange':
                    df['value'] = df['value'].pct_change()
                elif huanbi_type == 'pctminus':
                    df['value'] = df['value'].diff()

        df.date = pd.to_datetime(df.date.dt.date)
        newest_value = round(df.iloc[-1]['value'], 3)
        newest_date = df.iloc[-1]['date'].strftime('%m-%d')

        min_date = df['date'].min()
        max_date = df['date'].max()
        dt_index = pd.date_range(start=min_date, end=max_date)
        dt_m_d = [x.strftime('%m-%d') for x in dt_index]
        dt_m_d = list(set(dt_m_d))
        dt_m_d.sort()
        day_shift_for_annual_start_days = fd.get('day_shift_for_annual_start_days')
        start_day = dt_m_d[day_shift_for_annual_start_days]

        time_grain_sqla = fd.get('time_grain_sqla')
        if time_grain_sqla == 'P1D' or (day_shift_for_annual_start_days > 0 and not time_grain_sqla):
            df.index = df['date']
            df = df.reindex(dt_index)
            df['date'] = df.index

        if first_fillna_method != 'None':
            df['value'] = df['value'].fillna(method=first_fillna_method)
        if second_fillna_method != 'None':
            df['value'] = df['value'].fillna(method=second_fillna_method)

        df['nianfen'] = df['date'].dt.strftime('%Y')
        df['tongbi'] = df['date'].dt.strftime('%m-%d')
        df_pivot = pd.pivot_table(df, index=['tongbi'], columns=['nianfen'], values=['value'])
        df_pivot = df_pivot['value']

        if fd.get('legend_type') == 1:
            df_pivot.columns = [str(int(x) + 1) if len(str(x)) == 4 else x for x in df_pivot.columns]

        # if len(df_pivot.columns) < 3:
        # raise Exception(_('同比图至少需要包含2年的历史数据'))

        last_year = df_pivot.columns[-1]
        first_year = df_pivot.columns[0]
        pre_first_year = int(first_year) - 1

        # 起始日期配置项处理
        if day_shift_for_annual_start_days > 0:
            df_pivot_tail = df_pivot.iloc[:day_shift_for_annual_start_days].copy()
            if time_grain_sqla != 'P1D':
                df_pivot_tail = df_pivot.loc[df_pivot.index < start_day].copy()
            if len(df_pivot_tail):
                df_pivot_tail.columns = [str(int(x) - 1) for x in df_pivot_tail.columns]
                df_pivot_tail[last_year] = np.nan

                df_pivot_head = df_pivot.iloc[day_shift_for_annual_start_days:].copy()
                if time_grain_sqla != 'P1D':
                    df_pivot_head = df_pivot.loc[df_pivot.index >= start_day].copy()
                df_pivot_head.insert(0, str(pre_first_year), np.nan)

                df_pivot = pd.concat([df_pivot_head, df_pivot_tail])
                df_pivot.dropna(axis=1, how='all', inplace=True)
            # df_pivot = df_pivot.fillna(method='bfill')
        # 起始日期配置项处理  结束
        ret_dict = dict()
        ret_dict['left_axis_min_value'] = \
            self.get_float_or_default_value(self.form_data, 'left_axis_min_value', 'dataMin')
        ret_dict['left_axis_max_value'] = \
            self.get_float_or_default_value(self.form_data, 'left_axis_max_value', 'dataMax')

        df_output = df_pivot.T
        day_shift = self.form_data.get('day_shift')
        if day_shift > 0:
            df_output = df_output[df_output.columns[day_shift:].tolist() + df_output.columns[0:day_shift].tolist()]
        day_skip = self.form_data.get('day_skip')
        if day_skip > 0:
            df_output = df_output[df_output.columns[day_skip:].tolist()]
        only_show_first_day_in_month = self.form_data.get('only_show_first_day_in_month')
        if only_show_first_day_in_month:
            new_columns = [column for column in df_output.columns if column.endswith('-01')]
            df_output = df_output[new_columns]

        if fd.get('divide_start'):
            # 如果某行第一列单元格是nan，就用该行从左到右最近那个不是nan的单元格来填充第1列
            df_output.iloc[:, 0] = df_output.bfill(axis=1).iloc[:, 0]
            df_output = df_output.div(df_output.iloc[:, 0], axis=0)
        if fd.get('sub_start'):
            df_output = df_output.sub(df_output.iloc[:, 0], axis=0)

        # 此处计算叠加数据的起始日期
        annotation_data_start = df_output.index[-2] if fd.get('legend_type') else df_output.index[-1]
        annotation_data_start = annotation_data_start + "-" + df_output.columns[0]
        if fd.get('whether_accumulate') and not cal_type:
            df_output.replace([''], np.nan, inplace=True)
            # last_column = len(df_output.columns) - 1
            # df_output.iloc[0:-1, [last_column]] = df_output.iloc[0:-1, [last_column]].fillna(0)
            df_output = df_output.cumsum(1)
        tongbi_type = fd.get('tongbi')
        if cal_type and cal_type.startswith('tongbi'):
            tongbi_type = cal_type.split('_')[1]
        if not cal_type or not cal_type.startswith('huanbi'):
            if tongbi_type:
                if tongbi_type == 'pctchange':
                    df_output_fillna = df_output.fillna(method=first_fillna_method if first_fillna_method != 'None' else 'ffill', axis=1)
                    df_output = (df_output.iloc[1:].values - df_output_fillna.iloc[:-1].values) / df_output_fillna.iloc[:-1].values
                    df_output = pd.DataFrame(df_output, index=df_output_fillna.index[1:], columns=df_output_fillna.columns)
                elif tongbi_type == 'pctminus':
                    df_output_fillna = df_output.fillna(method=first_fillna_method if first_fillna_method != 'None' else 'ffill', axis=1)
                    df_output = (df_output.iloc[1:].values - df_output_fillna.iloc[:-1].values)
                    df_output = pd.DataFrame(df_output, index=df_output_fillna.index[1:], columns=df_output_fillna.columns)

        df_pivot_mean = df_output.T
        last_year = df_pivot_mean.columns[-1]
        year_range = '{0}-{1}'.format(df_pivot_mean.columns[0], df_pivot_mean.columns[-1])
        if len(df_pivot_mean.columns) > 1:
            year_range = '{0}-{1}'.format(df_pivot_mean.columns[0], df_pivot_mean.columns[-2])
            df_pivot_mean.loc[:, year_range + '均值'] = df_pivot_mean.fillna(method=first_fillna_method if first_fillna_method != 'None' else 'ffill').drop(last_year, axis=1).mean(1)
        else:
            df_pivot_mean.loc[:, year_range + '均值'] = df_pivot_mean.fillna(method=first_fillna_method if first_fillna_method != 'None' else 'ffill').mean(1)

        # 各列减去均值列
        if fd.get('wether_avg_minus'):
            for cl_name in df_pivot_mean.columns.tolist():
                df_pivot_mean[cl_name] = df_pivot_mean[cl_name] - df_pivot_mean.iloc[:, -1]

        df_output = df_pivot_mean.round(3).T
        if fd.get('legend_type') == 2:
            df_output.index = df_output.index.map(self.index_rename_season)
        ret_dict['data'] = df_output.to_dict(orient='split')

        ret_dict['newest_date'] = newest_date
        ret_dict['newest_value'] = newest_value
        max_year = df_output.index.tolist()[-2]
        if newest_date in df_output.columns:
            newest_value = df_output.loc[max_year, newest_date]
            if not np.isnan(newest_value):
                ret_dict['newest_value'] = newest_value

        data_list = []
        for val in ret_dict['data']['data']:
            add_x_list = []
            for i, iner_val in enumerate(val):
                add_x_list.append([ret_dict['data']['columns'][i], iner_val])
            data_list.append(add_x_list)
        ret_dict['data']['data'] = data_list

        ret_dict['annotationDataStart'] = annotation_data_start
        ret_dict['custom_params'] = self.custom_params

        return ret_dict


class EchartsSeasonLunarCalendar(BaseViz):
    """ EchartsSeasonLunarCalendar"""
    viz_type = 'echarts_season_lunar_calendar'
    is_timeseries = True

    def query_obj(self):
        d = super(EchartsSeasonLunarCalendar, self).query_obj()
        fd = self.form_data

        if fd.get('all_columns') and fd.get('metrics'):
            raise Exception(_('Please choose only one of "Columns" or "Metrics"'))
        elif not fd.get('all_columns') and not fd.get('metrics'):
            raise Exception(_('Please choose only one of "Columns" or "Metrics"'))
        elif fd.get('all_columns'):
            columns = fd.get('all_columns')
            if len(columns) != 1:
                raise Exception(_('Please choose only one column in "Columns"'))
            d['columns'] = fd.get('all_columns')
            d['groupby'] = []
        elif fd.get('metrics'):
            metrics = fd.get('metrics')
            if len(metrics) != 1:
                raise Exception(_('Please choose only one metric in "Metrics"'))
            d['groupby'] = []
        return d

    def get_data(self, df):
        fd = self.form_data

        rolling_type = fd.get('rolling_type')
        rolling_periods = int(fd.get('rolling_periods') or 0)
        min_periods = int(fd.get('min_periods') or 0)
        metrics_name_list = list()
        if fd.get('metrics'):
            metrics_name_list = utils.get_metric_names(fd.get('metrics'))
        else:
            metrics_name_list = fd.get('all_columns')
        if rolling_periods and len(metrics_name_list):
            df.sort_values(by="__timestamp", inplace=True)
            if rolling_type in ('mean', 'std', 'sum'):
                for metricName in metrics_name_list:
                    if rolling_type == 'mean':
                        df[metricName] = df[metricName].rolling(window=rolling_periods, min_periods=min_periods).mean()
                    elif rolling_type == 'std':
                        df[metricName] = df[metricName].rolling(window=rolling_periods, min_periods=min_periods).std()
                    elif rolling_type == 'sum':
                        df[metricName] = df[metricName].rolling(window=rolling_periods, min_periods=min_periods).sum()
            elif rolling_type == 'cumsum':
                for metricName in metrics_name_list:
                    df[metricName] = df[metricName].cumsum()
            if min_periods:
                df = df[min_periods:]

        if fd.get('metrics'):
            df = df.pivot_table(
                index=DTTM_ALIAS,
                values=utils.get_metric_names(fd.get('metrics')))
            df.columns = ['value']
            df['date'] = df.index
        else:
            df.columns = ['value', 'date']

        if fd.get('whether_accumulate'):
            if fd.get("lowest_limit") != "":
                df.loc[df['value'] < fd.get("lowest_limit"), 'value'] = 0
            if fd.get("highest_limit") != "":
                df.loc[df['value'] > fd.get("highest_limit"), 'value'] = fd.get("highest_limit")
        # 计算百分比或者万等
        df.sort_values(by='date', inplace=True)

        # 设置标题
        if fd.get('whether_show_title') == 1:
            title = str(round(df.iloc[-1]['value'], 3))
            sub_title = df.iloc[-1]['date'].strftime('%m-%d')
        else:
            title = ''
            sub_title = ''

        df.date = pd.to_datetime(df.date.dt.date)
        day_shift_for_annual_start_days = fd.get('day_shift_for_annual_start_days')
        # 先根据需要偏移的天数 重新构造当前的时间INDEX，也就是把偏移后的第一天设置成1月1日，在后面再恢复
        if day_shift_for_annual_start_days > 0:
            df.date = df.date - pd.Timedelta('{0} days'.format(day_shift_for_annual_start_days))

        if fd.get('time_grain_sqla') == 'P1D':
            min_date = df['date'].min()
            min_date = pd.Timestamp(min_date).replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
            max_date = df['date'].max()
            dt_index = pd.date_range(start=min_date, end=max_date)
            df.index = df['date']
            df = df.reindex(dt_index)
            df['date'] = df.index

        if fd.get('first_fillna_method') != 'None':
            df['value'] = df['value'].fillna(method=fd.get('first_fillna_method'))
        if fd.get('second_fillna_method') != 'None':
            df['value'] = df['value'].fillna(method=fd.get('second_fillna_method'))

        pre_days = int(fd.get('pre_days')) if fd.get('pre_days') else -90
        if pre_days > 0:
            pre_days = -pre_days
        after_days = int(fd.get('after_days')) if fd.get('after_days') else 90

        df[['nianfen', 'days', 'nianfen_near', 'days_near']] = df['date'].apply(calculate_year_days, args=(
            fd.get('festival_type'), pre_days, after_days))
        # 筛选出nianfen_near不为空的数据
        df_copy = df[df['nianfen_near'] != 'None'].copy()
        if len(df_copy):
            df_copy.loc[:, 'nianfen'] = df_copy['nianfen_near']
            df_copy.loc[:, 'days'] = df_copy['days_near']
            df = pd.concat([df, df_copy], ignore_index=True)
        df_output = pd.pivot_table(df, index=['days'], columns=['nianfen'], values=['value'])
        df_output = df_output['value']
        if fd.get('legend_type') == 1:
            df_output.columns = [str(int(x) + 1) if len(str(x)) == 4 else x for x in df_output.columns]

        if len(df_output.columns) < 3:
            raise Exception(_('同比图至少需要包含2年的历史数据'))

        if fd.get('tongbi'):
            df_output = df_output.pct_change(axis='columns')
            df_output = df_output.iloc[:, 1:]

        df_pivot_tmp = df_output.fillna(method='ffill').fillna(method='bfill')
        cur_year = df_output.columns[-1]
        year_range = '{0}-{1}'.format(df_output.columns[0], df_output.columns[-2])
        df_output.loc[:, year_range + '最大值'] = df_pivot_tmp.drop(cur_year, axis=1).max(1)
        df_output.loc[:, year_range + '最小值'] = df_pivot_tmp.drop(cur_year, axis=1).min(1)
        df_output[year_range + '均值'] = df_pivot_tmp.drop(cur_year, axis=1).mean(1)

        ret_dict = {}

        ret_dict['title'] = title
        ret_dict['sub_title'] = sub_title

        ret_dict['left_axis_min_value'] = \
            self.get_float_or_default_value(self.form_data, 'left_axis_min_value', 'dataMin')
        ret_dict['left_axis_max_value'] = \
            self.get_float_or_default_value(self.form_data, 'left_axis_max_value', 'dataMax')

        df_output = df_output.round(3).fillna('').T
        # 恢复原本的日期
        if day_shift_for_annual_start_days > 0:
            df_output.columns = df_output.columns[day_shift_for_annual_start_days:].tolist() + df_output.columns[
                                                                                               0:day_shift_for_annual_start_days].tolist()
        day_shift = self.form_data.get('day_shift')
        if day_shift > 0:
            df_output = df_output[df_output.columns[day_shift:].tolist() + df_output.columns[0:day_shift].tolist()]
        day_skip = self.form_data.get('day_skip')
        if day_skip > 0:
            df_output = df_output[df_output.columns[day_skip:].tolist()]
        only_show_first_day_in_month = self.form_data.get('only_show_first_day_in_month')
        if only_show_first_day_in_month:
            new_columns = [column for column in df_output.columns if column.endswith('-01')]
            df_output = df_output[new_columns]

        if fd.get('whether_accumulate'):
            df_output.replace([''], np.nan, inplace=True)
            df_output = df_output.cumsum(1).round(3)

        df_output.drop(df_output.columns[(df_output.columns > after_days) | (df_output.columns < pre_days)], axis=1,
                       inplace=True)
        columns_series = df_output.columns
        # 如果原始数据没有和节日一天的日期，导致没有0列，需要补0列
        if 0 not in columns_series:
            columns_list_pre0 = columns_series[columns_series < 0].tolist()
            columns_list = columns_series.tolist()
            columns_list.insert(len(columns_list_pre0), 0)
            df_output = df_output.reindex(columns_list, axis=1)

        df_output.replace(r'^\s*$', np.nan, regex=True, inplace=True)
        ret_dict['max'] = df_output.max().max()
        ret_dict['min'] = df_output.min().min()
        df_output.fillna('', inplace=True)

        if fd.get('legend_type') == 2:
            df_output.index = df_output.index.map(self.index_rename_season)

        ret_dict['data'] = df_output.to_dict(orient='split')
        ret_dict['data']['index'] = list(map(str, ret_dict['data']['index']))
        ret_dict['data']['columns'] = list(map(str, ret_dict['data']['columns']))
        return ret_dict


class EchartsAnalysisPieViz(BaseViz):
    """ Analysis Pie Chart """
    viz_type = 'echarts_analysis_pie'
    is_timeseries = True

    def query_obj(self):
        d = super(EchartsAnalysisPieViz, self).query_obj()
        fd = self.form_data

        d['columns'] = [fd.get('entity'), fd.get('series')]
        d['groupby'] = []
        d['metrics'] = []
        return d

    def get_data(self, df):
        fd = self.form_data
        name = fd.get('entity')
        value = fd.get('series')
        date = '__timestamp'
        df = df.sort_values(by=[date, name], ascending=True)
        df[date] = df[date].dt.strftime('%Y-%m-%d')

        data_list = []
        df_group = df.groupby(date)
        for key, group in df_group:
            data_list.append(list(zip(group[name], group[value])))

        ret_dict = {}
        ret_dict['date'] = list(df[date].unique())
        ret_dict['data'] = data_list

        ret_dict['visual_map_min_value'] = \
            self.get_float_or_default_value(self.form_data, 'visual_map_min_value', df[value].min())
        ret_dict['visual_map_max_value'] = \
            self.get_float_or_default_value(self.form_data, 'visual_map_max_value', df[value].max())

        return ret_dict


class EchartsPeriodogramViz(BaseViz):
    """ Statistics Line Chart"""
    viz_type = 'echarts_periodogram'
    is_timeseries = True

    def query_obj(self):
        d = super(EchartsPeriodogramViz, self).query_obj()
        fd = self.form_data

        if fd.get('all_columns_custom'):
            columns = fd.get('all_columns_custom')
            if len(columns) != 1:
                raise Exception(_('Please choose only one column in "Columns"'))
            d['columns'] = columns
            d['groupby'] = []

        if fd.get('days_used_for_truncation'):
            days_used_for_truncation = fd.get('days_used_for_truncation')
            if days_used_for_truncation < 5:
                raise Exception(_('The value of "Days used for truncation and reorganization" '
                                  'must be greater than or equal to 5.'))

        return d

    def get_data(self, df):
        fd = self.form_data
        df.columns = ['value', 'date']
        df = df.sort_values(by='date', ascending=True)

        if fd.get('first_fillna_method') != 'None':
            df['value'] = df['value'].fillna(method=fd.get('first_fillna_method'))
        if fd.get('second_fillna_method') != 'None':
            df['value'] = df['value'].fillna(method=fd.get('second_fillna_method'))

        df['date'] = df['date'].dt.strftime('%Y-%m-%d')

        truncation_custom = fd.get('truncation_custom')
        truncation_custom_dict = json.loads(truncation_custom) if truncation_custom else dict()
        truncation_dict_end = {}
        for k, v in truncation_custom_dict.items():
            k_date = datetime.strptime(k, '%Y-%m-%d')
            k_date_end = k_date + timedelta(days=v)
            k_date_end = datetime.strftime(k_date_end, '%Y-%m-%d')
            truncation_dict_end[k] = k_date_end
        truncation_dict_end = sorted(truncation_dict_end.items(), key=lambda item: item[0])
        days_used_for_truncation = fd.get('days_used_for_truncation')

        if truncation_dict_end:
            df_list = [df.loc[(df['date'] >= k) & (df['date'] <= v)] for k, v in truncation_dict_end]
            df_list = [df for df in df_list if len(df)]
        elif days_used_for_truncation:
            df_list = [df[m:m + days_used_for_truncation] for m in range(0, len(df), days_used_for_truncation)]

        index = []
        max_len = max([len(item) for item in df_list])
        for x in range(max_len):
            index.append('\n'.join([y.date.iloc[x] for y in df_list if len(y) > x]))
        df_output = pd.DataFrame(index=index)
        for x in df_list:
            if len(x) == max_len:
                # df_output['{0} ~ {1}'.format(x.date.iloc[0], x.date.iloc[-1])] = x['value'].tolist()
                df_output['{0}'.format(x.date.iloc[0])] = x['value'].tolist()
            else:
                tmp_list = x['value'].tolist() + [np.nan for k in range(max_len - len(x))]
                # df_output['{0} ~ {1}'.format(x.date.iloc[0], x.date.iloc[-1])] = tmp_list
                df_output['{0}'.format(x.date.iloc[0])] = tmp_list

        if fd.get('wether_divide_first'):
            df_output = df_output.div(df_output.iloc[0]).round(2)
        ret_dict = {}
        ret_dict['left_axis_min_value'] = \
            self.get_float_or_default_value(self.form_data, 'left_axis_min_value', 'dataMin')
        ret_dict['left_axis_max_value'] = \
            self.get_float_or_default_value(self.form_data, 'left_axis_max_value', 'dataMax')

        ret_dict['data'] = df_output.T.to_dict(orient='split')
        return ret_dict


class EchartsCategoryLineViz(BaseViz):
    """ Funnel Chart"""
    viz_type = 'echarts_category_line'
    is_timeseries = True

    def query_obj(self):
        d = super(EchartsCategoryLineViz, self).query_obj()
        fd = self.form_data

        if fd.get('all_lines_start_at_the_same_zero_point') and fd.get('all_lines_end_at_the_same_zero_point'):
            raise Exception("Could only choose "
                            "'all_lines_start_at_the_same_zero_point' or 'all_lines_end_at_the_same_zero_point'")

        # d['columns'] = [fd.get('entity')]
        d['groupby'] = [fd.get('entity')]
        # d['metrics'] = []
        return d

    def get_data(self, df):
        fd = self.form_data
        name = fd.get('entity')
        value = fd.get('metrics')[0]
        date = '__timestamp'
        max_mon = df[date].max().month

        is_use_historical_data = fd.get('whether_use_average_historical_data')
        is_select_today = fd.get('select_today')
        is_select_7D = fd.get('select_7D')
        is_select_1M = fd.get('select_1M')
        is_select_3M = fd.get('select_3M')
        is_select_1Y = fd.get('select_1Y')
        is_everyday = fd.get('select_everyday')

        # dt = pd.DataFrame()
        dt = df.pivot_table(index=date, columns=name, values=value).astype(float).round(3)
        if fd.get('standard'):
            # dt = df.pivot_table(index=date, columns=name, values=value).astype(float).round(3)
            # dt.index = dt.index.map(lambda x: datetime.strftime(x, "%Y-%m-%d"))
            dt.sort_index(ascending=True, inplace=True)
            dt = dt.fillna(method='bfill')
            if fd.get('first_fillna_method') != 'None':
                dt = dt.fillna(method=fd.get('first_fillna_method'))
            dt['daynameofweek'] = dt.index.weekday_name
            dt_monday = dt[dt['daynameofweek'] == 'Monday']
            dt.drop(['daynameofweek'], axis=1, inplace=True)
            monday_list = dt_monday.index.tolist()[-2:]
            series_pre_week = dt.iloc[(dt.index >= monday_list[0]) & (dt.index < monday_list[1])].mean()
            max_date = dt.index.max()
            recent1m_startdate = max_date + rdelta.relativedelta(months=-1)
            recent1y_startdate = max_date + rdelta.relativedelta(years=-1)
            series_1m = dt.iloc[dt.index >= recent1m_startdate].mean()
            series_1y = dt.iloc[dt.index >= recent1y_startdate].mean()
            series_lastrow = dt.iloc[-1]
            series_prerow = dt.iloc[-2]
            series_lastrow_name = 'Today'
            series_prerow_name = '-1D'
            if fd.get('column_isdate'):
                series_lastrow_name = datetime.strftime(series_lastrow.name, "%Y-%m-%d")
                series_prerow_name = datetime.strftime(series_prerow.name, "%Y-%m-%d")
            dt = pd.DataFrame({series_lastrow_name: series_lastrow,
                               series_prerow_name: series_prerow,
                               '上周平均': series_pre_week,
                               '近月平均': series_1m,
                               '近年平均': series_1y})
            column_order = [series_lastrow_name, series_prerow_name,
                            '上周平均', '近月平均', '近年平均']
            dt = dt[column_order]
            dt = dt.round(3).fillna('').T
        elif fd.get('area_list'):
            # dt = df.pivot_table(index=date, columns=name, values=value).astype(float).round(3)
            dt.index = dt.index.map(lambda x: datetime.strftime(x, "%Y-%m-%d"))
            dt.sort_index(ascending=True, inplace=True)
            area_list = fd.get('area_list').split('|')
            area_list = [int(i) for i in area_list if i != '' and int(i) < 0]
            area_list.sort(reverse=True)
            dt = dt.iloc[area_list]
            if not fd.get('column_isdate'):
                dt.index = dt.index.map(lambda x: str(area_list.pop(0)))

        elif is_everyday:
            # dt = df.pivot_table(index=date, columns=name, values=value).astype(float).round(3)
            dt.index = dt.index.map(lambda x: datetime.strftime(x, "%Y-%m-%d"))
            dt.sort_index(ascending=False, inplace=True)
            # dt = dt.round(3).fillna('')
        else:
            # dt = df.pivot_table(index=date, columns=name, values=value).astype(float).round(3)
            dt.sort_index(ascending=True, inplace=True)
            dt = dt.fillna(method='bfill')
            if fd.get('first_fillna_method') != 'None':
                dt = dt.fillna(method=fd.get('first_fillna_method'))
            columns = []
            if not fd.get('column_isdate'):
                if is_select_today:
                    columns.append('Today')
                if is_select_7D:
                    columns.append('-7D')
                if is_select_1M:
                    columns.append('-1M')
                if is_select_3M:
                    columns.append('-3M')
                if is_select_1Y:
                    columns.append('-1Y')

            index = dt.columns
            df_list = []
            loop_count = 1
            for column in dt.columns:
                tmp_list = []
                df_tmp = dt[[column]]
                if is_select_today:
                    tmp_list.append(df_tmp[column].iloc[-1])
                    ix_isdate = df_tmp.iloc[-1].name
                    ix_isdate = datetime.strftime(ix_isdate, "%Y-%m-%d")
                    if fd.get('column_isdate') and loop_count == 1:
                        columns.append(ix_isdate)
                if is_select_7D:
                    tmp_list.append(df_tmp.loc[:df_tmp.index[-1] - pd.Timedelta(days=7), column][-1])
                    ix_isdate = df_tmp.loc[:df_tmp.index[-1] - pd.Timedelta(days=7)].iloc[-1].name
                    ix_isdate = datetime.strftime(ix_isdate, "%Y-%m-%d")
                    if fd.get('column_isdate') and loop_count == 1:
                        columns.append(ix_isdate)
                if is_use_historical_data:
                    if is_select_1M:
                        tmp_list.append(
                            df_tmp.loc[
                            df_tmp.index[-1] - pd.Timedelta(days=33):df_tmp.index[-1] - pd.Timedelta(days=26),
                            column].mean())
                        ix_isdate = df_tmp.loc[
                                    df_tmp.index[-1] - pd.Timedelta(days=33):df_tmp.index[-1] - pd.Timedelta(
                                        days=26)].iloc[-1].name
                        ix_isdate = datetime.strftime(ix_isdate, "%Y-%m-%d")
                        if fd.get('column_isdate') and loop_count == 1:
                            columns.append(ix_isdate)
                    if is_select_3M:
                        tmp_list.append(
                            df_tmp.loc[
                            df_tmp.index[-1] - pd.Timedelta(days=93):df_tmp.index[-1] - pd.Timedelta(days=86),
                            column].mean())
                        ix_isdate = df_tmp.loc[
                                    df_tmp.index[-1] - pd.Timedelta(days=93):df_tmp.index[-1] - pd.Timedelta(
                                        days=86)].iloc[-1].name
                        ix_isdate = datetime.strftime(ix_isdate, "%Y-%m-%d")
                        if fd.get('column_isdate') and loop_count == 1:
                            columns.append(ix_isdate)
                    if is_select_1Y:
                        tmp_list.append(
                            df_tmp.loc[
                            df_tmp.index[-1] - pd.Timedelta(days=368):df_tmp.index[-1] - pd.Timedelta(days=361),
                            column].mean())
                        ix_isdate = df_tmp.loc[
                                    df_tmp.index[-1] - pd.Timedelta(days=368):df_tmp.index[-1] - pd.Timedelta(
                                        days=361)].iloc[-1].name
                        ix_isdate = datetime.strftime(ix_isdate, "%Y-%m-%d")
                        if fd.get('column_isdate') and loop_count == 1:
                            columns.append(ix_isdate)
                else:
                    if is_select_1M:
                        tmp_list.append(
                            df_tmp.loc[
                            df_tmp.index[-1] - pd.Timedelta(days=30):df_tmp.index[-1] - pd.Timedelta(days=30),
                            column].mean())
                        ix_isdate = datetime.strftime(df_tmp.index[-1] - pd.Timedelta(days=30), "%Y-%m-%d")
                        if fd.get('column_isdate') and loop_count == 1:
                            columns.append(ix_isdate)
                    if is_select_3M:
                        tmp_list.append(
                            df_tmp.loc[
                            df_tmp.index[-1] - pd.Timedelta(days=90):df_tmp.index[-1] - pd.Timedelta(days=90),
                            column].mean())
                        ix_isdate = datetime.strftime(df_tmp.index[-1] - pd.Timedelta(days=90), "%Y-%m-%d")
                        if fd.get('column_isdate') and loop_count == 1:
                            columns.append(ix_isdate)
                    if is_select_1Y:
                        tmp_list.append(
                            df_tmp.loc[
                            df_tmp.index[-1] - pd.Timedelta(days=365):df_tmp.index[-1] - pd.Timedelta(days=365),
                            column].mean())
                        ix_isdate = datetime.strftime(df_tmp.index[-1] - pd.Timedelta(days=365), "%Y-%m-%d")
                        if fd.get('column_isdate') and loop_count == 1:
                            columns.append(ix_isdate)
                loop_count += 1
                df_list.append(tmp_list)
            dt = pd.DataFrame(df_list, index=index, columns=columns)
            dt = dt.round(3).fillna('').T

        columns_order = fd.get('range_labels')
        column_alias_labels = fd.get('alias_labels')
        column_alias_dict = json.loads(column_alias_labels) if len(column_alias_labels) else dict()

        if len(columns_order):
            columns_order_list = columns_order.split('|')
            columns_order_list = [x for x in columns_order_list if x in dt.columns]
            other_columns = [x for x in dt.columns if x not in columns_order_list]
            dt = dt[columns_order_list + other_columns]
        if fd.get('index_order'):
            index_order_dict = json.loads(fd.get('index_order'))
            index_order_dict = sorted(index_order_dict.items(), key=lambda x: int(x[0]))
            x_oder_list = []
            for key, value in index_order_dict:
                if max_mon <= int(key):
                    x_oder_list = value
                    break
            columns_order_list = [x for x in x_oder_list if x in dt.columns]
            other_columns = [x for x in dt.columns if x not in columns_order_list]
            dt = dt[columns_order_list + other_columns]

        dt.columns = dt.columns.map(lambda x: column_alias_dict[x] if x in column_alias_dict.keys() else x)
        is_change_start_values = fd.get('all_lines_start_at_the_same_zero_point')
        if is_change_start_values:
            dt[dt.columns[1:]] = dt[dt.columns[1:]].apply(lambda x: x - dt[dt.columns[0]]).round(3)
            dt[dt.columns[0]] = 0

        is_change_end_values = fd.get('all_lines_end_at_the_same_zero_point')
        if is_change_end_values:
            dt[dt.columns[:-1]] = dt[dt.columns[:-1]].apply(lambda x: x - dt[dt.columns[-1]]).round(3)
            dt[dt.columns[-1]] = 0

        ret_dict = {}
        # ret_dict['axis_label_interval'] = 0 if fd.get('whether_show_all_X_axis_label') else 'auto'
        ret_dict['left_axis_min_value'] = \
            self.get_float_or_default_value(fd, 'left_axis_min_value', 'dataMin')
        ret_dict['left_axis_max_value'] = \
            self.get_float_or_default_value(fd, 'left_axis_max_value', 'dataMax')
        ret_dict['data'] = dt.to_dict(orient='split')

        return ret_dict


class EchartsCorrelationLineViz(BaseViz):
    """ Echarts Correlation"""
    viz_type = 'echarts_correlation'
    is_timeseries = True

    def query_obj(self):
        d = super(EchartsCorrelationLineViz, self).query_obj()
        fd = self.form_data

        d['columns'] = [fd.get('entity'), fd.get('series')]
        d['groupby'] = []
        d['metrics'] = []
        return d

    def get_data(self, df):
        fd = self.form_data
        name = fd.get('entity')
        value = fd.get('series')
        date = '__timestamp'
        day = fd.get('rolling_periods')

        if len(df[name].unique()) != 2:
            raise Exception('Please use filter choose two instrument in "{0}"'.format(name))

        df = df.pivot_table(index=date, columns=name, values=value)
        df = df.fillna(method='pad').fillna(method='bfill').astype(float)
        df = df.sort_index()
        # 给在右侧坐标轴显示的曲线标记上（右）
        if fd.get('swap_left_and_right_axis'):
            df.rename({df.columns[0]: df.columns[0] + '(右)'}, axis=1, inplace=True)
            df = df[list(reversed(df.columns))]
        else:
            df.columns = [df.columns[0]] + [x + '(右)' for x in df.columns[1:]]

        corr = []
        for x in range(len(df.index)):
            if x > day:
                corr.append(round(df.iloc[max(0, x - day):max(0, x - day) + day, 0].corr(
                    df.iloc[max(0, x - day):max(0, x - day) + day, 1]), 5))
            else:
                corr.append('')
        df['corr'] = corr
        df.index = df.index.strftime('%Y%m%d')

        ret_dict = {}
        ret_dict['left_axis_use_histogram'] = fd.get('left_axis_use_histogram')
        ret_dict['right_axis_use_histogram'] = fd.get('right_axis_use_histogram')
        ret_dict['left_axis_use_reverse_order'] = fd.get('left_axis_use_reverse_order')
        ret_dict['data'] = df.T.to_dict(orient='split')
        return ret_dict


"""
************* EchartsWorldFlowViz Source Table Example *************

来源		    |去向	|流动量	|国家地区		    |国家地区值	|地址		|地址经度	    |地址纬度
美国洛杉矶	|上海	|2370	|NULL			|0			|NULL		|0			|0
巴西		    |上海	|1500	|NULL			|0			|NULL		|0			|0
天津		    |昆明	|5000	|NULL			|0			|NULL		|0			|0
乌鲁木齐	    |昆明	|3200	|NULL			|0			|NULL		|0			|0
NULL		|NULL	|0		|China			|500		|NULL		|0			|0
NULL		|NULL	|0		|UnitedStates	|10000		|NULL		|0			|0
NULL		|NULL	|0		|Japan			|300		|NULL		|0			|0
NULL		|NULL	|0		|Russia			|2000		|NULL		|0			|0
NULL		|NULL	|0		|NULL			|0			|尼日利亚	    |-4.388361	|11.186148
NULL		|NULL	|0		|NULL			|0			|巴西		|-48.678945	|-10.493623
NULL		|NULL	|0		|NULL			|0			|上海		|121.4648	|31.2891
NULL		|NULL	|0		|NULL			|0			|昆明		|102.9199	|25.4663
NULL		|NULL	|0		|NULL			|0			|天津		|117.4219	|39.4189
NULL		|NULL	|0		|NULL			|0			|乌鲁木齐   	|87.9236	|43.5883
NULL		|NULL	|0		|NULL			|0			|美国洛杉矶	|118.15		|34.04
"""


class EchartsWorldFlowViz(BaseViz):
    """ Echarts World Flow"""
    viz_type = 'echarts_world_flow'
    is_timeseries = False

    def query_obj(self):
        d = super(EchartsWorldFlowViz, self).query_obj()
        fd = self.form_data

        d['columns'] = [fd.get('from_city'), fd.get('to_city'), fd.get('city_flow_value'),
                        fd.get('city_name'), fd.get('city_longitude'), fd.get('city_latitude'),
                        fd.get('country_name'), fd.get('country_weight')]
        d['groupby'] = []
        d['metrics'] = []
        return d

    @staticmethod
    def handle_null_data(df, str_cols, int_cols):
        df = df.dropna()
        for col in str_cols:
            NONE_VIN = (df[col].isnull()) | \
                       (df[col].apply(lambda x: str(x).isspace() or str(x).find('NULL') >= 0 or not len(str(x))))
            df = df[~NONE_VIN]
        for col in int_cols:
            # ``Series.nonzero`` was removed in pandas 2.0.  Keep the
            # original positional-indexing behavior while using the
            # NumPy array API supported by current pandas versions.
            VIVID_VIN = np.flatnonzero(df[col].to_numpy())
            df = df.iloc[VIVID_VIN]
        return df

    def get_data(self, df):
        fd = self.form_data
        columns = ['from_city', 'to_city', 'city_flow_value',
                   'city_name', 'city_longitude', 'city_latitude',
                   'country_name', 'country_weight', ]
        # df.rename(columns={fd.get(x): x for x in columns}, inplace=True)
        df.columns = columns

        df_city_flow = df[['from_city', 'to_city', 'city_flow_value']]
        df_city_location = df[['city_name', 'city_longitude', 'city_latitude']]
        df_country_weight = df[['country_name', 'country_weight']]
        df_city_flow = self.handle_null_data(df_city_flow, ['from_city', 'to_city'], ['city_flow_value'])
        df_city_location = self.handle_null_data(df_city_location, ['city_name'], [])
        df_country_weight = self.handle_null_data(df_country_weight, ['country_name'], ['country_weight'])

        # 数据检查
        for city in set(df_city_flow.from_city.tolist() + df_city_flow.to_city.tolist()):
            if city not in df_city_location.city_name.tolist():
                raise Exception('Please check original data, city[{0}] location not found'.format(city))

        list_city_flow = list()
        for k, v in df_city_flow.groupby('to_city'):
            list_city_flow.append([k, v[['from_city', 'city_flow_value']].values.tolist()])

        ret_dict = dict()

        # 数组 [ 目的地1，[[出发地1，值1]，[出发地2，值2] ]
        ret_dict['list_city_flow'] = list_city_flow
        # 字典 { 上海：[经度，纬度] }
        ret_dict['dict_city_location'] = \
            {x[1].city_name: [x[1].city_longitude, x[1].city_latitude] for x in df_city_location.iterrows()}
        ret_dict['df_country_weight'] = df_country_weight.T.to_dict(orient='split')
        ret_dict['visual_map_min_value'] = \
            float(self.get_default_value(fd, 'visual_map_min_value', df_city_flow.city_flow_value.min()))
        ret_dict['visual_map_max_value'] = \
            float(self.get_default_value(fd, 'visual_map_max_value', df_city_flow.city_flow_value.max()))
        ret_dict['map_zoom_factor'] = float(fd.get('map_zoom_factor'))
        # ret_dict['map_center_longitude'] = float(fd.get('map_center_longitude'))
        # ret_dict['map_center_latitude'] = float(fd.get('map_center_latitude'))
        ret_dict['map_select'] = fd.get('map_select')
        return ret_dict


class EchartsYoyAndMomViz(BaseViz):
    """ Echarts YoY and MoM"""
    viz_type = 'echarts_yoy_and_mom'
    is_timeseries = True

    def query_obj(self):
        d = super(EchartsYoyAndMomViz, self).query_obj()
        fd = self.form_data

        d['columns'] = [fd.get('entity'), fd.get('series')]
        d['groupby'] = []
        d['metrics'] = []
        return d

    def get_data(self, df):
        fd = self.form_data
        name = fd.get('entity')
        value = fd.get('series')
        date = '__timestamp'

        if len(df[name].unique()) != 1:
            raise Exception('Please use filter choose only one instrument in "{0}"'.format(name))
        index_name = df[name].unique()[0]

        df.index = df[date]
        df = df.sort_index()
        df = df.fillna(method='pad').fillna(method='bfill')

        # 同比 和 环比 向前查找时 最好用现实时间轴填充原始数据，效果可能会较好。
        export_columns = []
        if fd.get('whether_show_YoY'):
            year_shift = len(df.loc[df.index[-1] - pd.Timedelta(days=365):])
            col_name = index_name + ' 指标同比'
            export_columns.append(col_name)
            df[col_name] = df[value] / df[value].shift(year_shift) - 1

        if fd.get('whether_show_MoM'):
            month_shift = len(df.loc[df.index[-1] - pd.Timedelta(days=30):])
            col_name = index_name + ' 指标环比'
            export_columns.append(col_name)
            df[col_name] = df[value] / df[value].shift(month_shift) - 1

        df = df.dropna(how='all', subset=export_columns)
        select = fd.get('data_aggregation_method')
        if select == 'monthly':
            df_group = df.groupby(df[date].apply(lambda x: x.year * 10 + x.month))
            df = df_group.mean()
            df.index = df_group.first()[date].apply(lambda x: '{0}年{1}月'.format(x.year, x.month))
            df = df[export_columns]
        elif select == 'quarterly':
            df_group = df.groupby(df[date].apply(lambda x: x.year * 10 + x.quarter))
            df = df_group.mean()
            df.index = df_group.first()[date].apply(lambda x: '{0}年{1}季度'.format(x.year, x.quarter))
            df = df[export_columns]
        else:
            df = df[export_columns]
            df.index = df.index.strftime('%Y%m%d')

        df = df[export_columns] * 100
        df = df[export_columns].round(2)

        ret_dict = dict()
        ret_dict['left_axis_min_value'] = \
            self.get_float_or_default_value(fd, 'left_axis_min_value', 'dataMin')
        ret_dict['left_axis_max_value'] = \
            self.get_float_or_default_value(fd, 'left_axis_max_value', 'dataMax')
        ret_dict['data'] = df.T.to_dict(orient='split')
        return ret_dict


class EchartsComparisonLineViz(BaseViz):
    """ Echarts Correlation"""
    viz_type = 'echarts_comparison'
    is_timeseries = True

    def query_obj(self):
        d = super(EchartsComparisonLineViz, self).query_obj()
        fd = self.form_data

        d['columns'] = [fd.get('entity'), fd.get('series')]
        d['groupby'] = []
        d['metrics'] = []
        return d

    def get_data(self, df):
        fd = self.form_data
        name = fd.get('entity')
        value = fd.get('series')
        date = '__timestamp'
        lag_days = fd.get('day_shift')
        lag_indexes = fd.get('shift_indexes')
        shift_days_shows_in_YYYYMMDD = fd.get('shift_days_shows_in_YYYYMMDD')

        if len(df[name].unique()) < 2:
            raise Exception('Please select at least two instrument in "{0}"'.format(name))

        df = df.pivot_table(index=date, columns=name, values=value)
        df = df.fillna(method='pad').fillna(method='bfill').astype(float)
        df = df.sort_index()

        df.index = df.index.strftime('%Y%m%d')

        if len(lag_indexes):
            lag_indexes = set(lag_indexes.split('|'))
            lag_indexes = [x for x in lag_indexes if x in df.columns]
            if lag_days > 0:
                if shift_days_shows_in_YYYYMMDD:
                    min_date = pd.to_datetime(df.index[-1]) + timedelta(days=1)
                    max_date = min_date + timedelta(days=lag_days - 1)
                    dt_index = pd.date_range(start=min_date, end=max_date)
                    df_tmp = pd.DataFrame(index=[x.strftime('%Y%m%d') for x in dt_index])
                else:
                    df_tmp = pd.DataFrame(
                        index=['{0} (Shift +{1} days)'.format(df.index[-1], x) for x in range(1, lag_days + 1)])
                df = pd.concat([df, df_tmp])
                df[lag_indexes] = df[lag_indexes].shift(lag_days)
                df.columns = ['{0} (Shift +{1} days)'.format(x, lag_days) if x in lag_indexes else x for x in
                              df.columns]
            elif lag_days < 0:
                if shift_days_shows_in_YYYYMMDD:
                    max_date = pd.to_datetime(df.index[0]) + timedelta(days=-1)
                    min_date = max_date + timedelta(days=lag_days + 1)
                    dt_index = pd.date_range(start=min_date, end=max_date)
                    df_tmp = pd.DataFrame(index=[x.strftime('%Y%m%d') for x in dt_index])
                else:
                    df_tmp = pd.DataFrame(
                        index=['{0} (Shift {1} days)'.format(df.index[0], x) for x in range(lag_days, 0)])
                df = pd.concat([df_tmp, df])
                df[lag_indexes] = df[lag_indexes].shift(lag_days)
                df.columns = ['{0} (Shift {1} days)'.format(x, lag_days) if x in lag_indexes else x for x in df.columns]

        if fd.get('swap_left_and_right_axis'):
            df.rename({df.columns[0]: df.columns[0] + '(右)'}, axis=1, inplace=True)
            df = df[list(reversed(df.columns))]
        else:
            df.columns = [df.columns[0]] + [x + '(右)' for x in df.columns[1:]]

        ret_dict = {}
        ret_dict['left_axis_use_histogram'] = fd.get('left_axis_use_histogram')
        ret_dict['right_axis_use_histogram'] = fd.get('right_axis_use_histogram')
        ret_dict['left_axis_use_reverse_order'] = fd.get('left_axis_use_reverse_order')
        ret_dict['left_axis_min_value'] = self.get_float_or_default_value(fd, 'left_axis_min_value', 'dataMin')
        ret_dict['left_axis_max_value'] = self.get_float_or_default_value(fd, 'left_axis_max_value', 'dataMax')
        ret_dict['right_axis_min_value'] = self.get_float_or_default_value(fd, 'right_axis_min_value', 'dataMin')
        ret_dict['right_axis_max_value'] = self.get_float_or_default_value(fd, 'right_axis_max_value', 'dataMax')
        ret_dict['data'] = df.T.to_dict(orient='split')
        return ret_dict


class EchartsEventsLineViz(BaseViz):
    """ Echarts Correlation"""
    viz_type = 'echarts_events'
    is_timeseries = True

    def query_obj(self):
        d = super(EchartsEventsLineViz, self).query_obj()
        fd = self.form_data
        d['columns'] = [fd.get('entity'), fd.get('series')]
        if fd.get('column_for_events_display'):
            d['columns'].append(fd.get('column_for_events_display'))
        d['groupby'] = []
        d['metrics'] = []
        return d

    def get_data(self, df):
        fd = self.form_data
        name = fd.get('entity')
        value = fd.get('series')
        event_column = fd.get('column_for_events_display')
        date = '__timestamp'

        max_value = df[value].max()
        min_value = df[value].min()

        if event_column:
            df_events = df[[date, value, event_column]]
            df_events[date] = df_events[date].dt.strftime('%Y%m%d')
            df_events = df_events.dropna()
            # 得到所有空值 或者 只有空格的行
            NONE_VIN = (df_events[event_column].isnull()) | \
                       (df_events[event_column].apply(lambda x: str(x).isspace() or str(x).find('NULL') >= 0))
            df_events = df_events[~NONE_VIN]
            df_events[event_column] = df_events[event_column].str.replace(r'<br/>|</br>|<br>', '\n')
        # lst = []
        # for x, y in df_events.groupby(date):
        #     lst.append([x, '\n'.join(y[event_column].astype(str).values)])
        # df_events = pd.DataFrame(lst, columns=[date, event_column])

        df = df.pivot_table(index=date, columns=name, values=value)
        df = df.fillna(method='pad').fillna(method='bfill').astype(float)
        df = df.sort_index()

        df.index = df.index.strftime('%Y%m%d')

        ret_dict = {}
        ret_dict['left_axis_min_value'] = self.get_float_or_default_value(fd, 'left_axis_min_value', 'dataMin')
        ret_dict['left_axis_max_value'] = self.get_float_or_default_value(fd, 'left_axis_max_value', 'dataMax')
        ret_dict['X_axis_zoom_start'] = fd.get('X_axis_zoom_start')
        ret_dict['X_axis_zoom_end'] = fd.get('X_axis_zoom_end')

        if ret_dict['X_axis_zoom_end'] < ret_dict['X_axis_zoom_start']:
            raise Exception('X axis zoom start must larger than X axis zoom end.')

        ret_dict['data'] = df.T.to_dict(orient='split')
        ret_dict['events'] = []
        if event_column:
            ret_dict['events'] = [list(x) for x in df_events.values]
        if ret_dict['left_axis_min_value'] != 'dataMin':
            ret_dict['min_value'] = ret_dict['left_axis_min_value']
        else:
            ret_dict['min_value'] = min_value
        if ret_dict['left_axis_max_value'] != 'dataMax':
            ret_dict['max_value'] = ret_dict['left_axis_max_value']
        else:
            ret_dict['max_value'] = max_value
        return ret_dict


class EchartsCombineChartViz(BaseViz):
    """ Echarts Correlation"""
    viz_type = 'echarts_combine'
    # is_timeseries = True
    is_timeseries = False

    def extract_number(self, index_str):
        parts = index_str.split('-')
        return int(parts[-1])

    def query_obj(self):
        d = super(EchartsCombineChartViz, self).query_obj()
        fd = self.form_data
        d['groupby'] = []
        entity = fd.get('entity')
        # 如果 fd.get('entity') 为真 且是list 则添加到 groupby 中
        if entity:
            if isinstance(entity, list):
                d['groupby'] = entity
            else:
                d['groupby'].append(entity)
        index = fd.get('columns')
        # 删除index里 = DTTM_ALIAS得元素
        if index:
            index = [x for x in index if x != DTTM_ALIAS]
            d['groupby'] = list(set(d['groupby'] + index))
        return d

    def get_data(self, df):
        fd = self.form_data
        first_fillna_method = fd.get('first_fillna_method')
        second_fillna_method = fd.get('second_fillna_method')
        # columns x 轴文本配置项
        index = fd.get('columns')
        if DTTM_ALIAS in df.columns.values.tolist() and not fd.get("x_is_time"):
            df[DTTM_ALIAS] = df[DTTM_ALIAS].apply(lambda x: x.strftime('%Y%m%d'))
        groupby = []
        entity = fd.get('entity')
        if entity:
            if isinstance(entity, list):
                groupby = entity
            else:
                groupby.append(entity)

        # value = utils.get_metric_names(fd.get('metrics'))[0]
        value = utils.get_metric_names(fd.get('metrics'))
        if fd.get('cross_period') and len(value) == 1:
            cross_period = json.loads(fd.get('cross_period'))
            df = utils.generate_cross_year_period_data(df, cross_period, index[0], value[0])
        elif groupby:
            df = df.pivot_table(index=index, columns=groupby, values=value if len(value) > 1 else value[0])
            if fd.get('mm_dd_align') and len(value) == 1:
                df = utils.mm_dd_align(df)
        else:
            df = df.pivot_table(index=index, values=value if len(value) > 1 else value[0])

        if fd.get('whether_show_average_line'):
            df['均值'] = df.mean(axis=1)
        if first_fillna_method != 'None':
            if first_fillna_method == 'ffill' or first_fillna_method == 'bfill':
                df = df.fillna(method=first_fillna_method)
            else:
                df = df.fillna(first_fillna_method)

        if second_fillna_method != 'None':
            if second_fillna_method == 'ffill' or second_fillna_method == 'bfill':
                df = df.fillna(method=second_fillna_method)
            else:
                df = df.fillna(second_fillna_method)

        df = df.astype(float)
        if not fd.get('cross_period') and not fd.get('mm_dd_align'):
            df = df.sort_index()
        # 当列索引是多层时，逗号拼接成字符串
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.map(lambda x: ','.join(str(item) for item in x))
        df.columns = df.columns.astype(str)
        column_order_list = fd.get('column_order_list')
        if column_order_list:
            columns_order_list = json.loads(column_order_list)
            columns_order = [x for x in columns_order_list if x in df.columns]
            other_columns = [x for x in df.columns if x not in columns_order_list]
            df = df[columns_order + other_columns]

        if fd.get('shift_indexes_set'):
            df = shift_dataframe(df, fd.get('shift_indexes_set'))

        # loc_dict = locals()
        loc_dict = {"df": df, 'df_table': pd.DataFrame()}
        if fd.get('exec_code'):
            exec_code_str = fd.get('exec_code')
            regex_exec_code = re.compile(re.escape('execute'), re.IGNORECASE)
            exec_code_str = regex_exec_code.sub("", exec_code_str)
            regex_exec_code = re.compile(re.escape('to_sql'), re.IGNORECASE)
            exec_code_str = regex_exec_code.sub("", exec_code_str)
            regex_exec_code = re.compile(re.escape('read_sql'), re.IGNORECASE)
            exec_code_str = regex_exec_code.sub("", exec_code_str)

            exec(exec_code_str, globals(), loc_dict)
            df = loc_dict['df']
        if fd.get('exec_code1') and fd.get('if_show_table'):
            exec_code_str = fd.get('exec_code1')
            regex_exec_code = re.compile(re.escape('execute'), re.IGNORECASE)
            exec_code_str = regex_exec_code.sub("", exec_code_str)
            regex_exec_code = re.compile(re.escape('to_sql'), re.IGNORECASE)
            exec_code_str = regex_exec_code.sub("", exec_code_str)
            regex_exec_code = re.compile(re.escape('read_sql'), re.IGNORECASE)
            exec_code_str = regex_exec_code.sub("", exec_code_str)

            exec(exec_code_str, globals(), loc_dict)

        columns_value_display_on_the_right_Y_axis = fd.get('columns_value_display_on_the_right_Y_axis')
        columns_value_represent_by_histogram = fd.get('columns_value_represent_by_histogram')
        columns_value_represent_by_area = fd.get('columns_value_represent_by_area')
        if columns_value_display_on_the_right_Y_axis:
            lst = columns_value_display_on_the_right_Y_axis.split('|')
            for x in lst:
                df.rename({x: x + '(右)'}, axis=1, inplace=True)
            if len(lst):
                histogram_list = columns_value_represent_by_histogram.split('|')
                for ix in range(len(histogram_list)):
                    if histogram_list[ix] in lst:
                        histogram_list[ix] = histogram_list[ix] + '(右)'

                area_list = columns_value_represent_by_area.split('|')
                for ix in range(len(area_list)):
                    if area_list[ix] in lst:
                        area_list[ix] = area_list[ix] + '(右)'

                columns_value_represent_by_histogram = '|'.join(histogram_list)
                columns_value_represent_by_area = '|'.join(area_list)

            columns_value_display_on_the_right_Y_axis = '|'.join([x + '(右)' for x in lst])

        ret_dict = {}
        ret_dict['left_axis_use_reverse_order'] = fd.get('left_axis_use_reverse_order')
        ret_dict['columns_value_display_on_the_right_Y_axis'] = columns_value_display_on_the_right_Y_axis
        ret_dict['columns_value_represent_by_histogram'] = columns_value_represent_by_histogram
        ret_dict['columns_value_represent_by_area'] = columns_value_represent_by_area
        if fd.get("index_slice_order"):
            index_order_list = json.loads(fd.get("index_slice_order"))
            frames = []
            for index_range in index_order_list:
                start_index, end_index = index_range
                frames.append(df.loc[start_index:end_index])
            df = pd.concat(frames) if frames else df.iloc[0:0]

        # if fd.get("bar_expand"):
        #     row_sums = df.sum(axis=1)
        #     df = df.div(row_sums, axis=0)
        df_t = df.T
        if (fd.get('cross_period') or fd.get('mm_dd_align')) and len(value) == 1:
            # df_t = df_t.reindex(sorted(df_t.columns, key=lambda x: self.extract_number(x)), axis=1)
            df_t.columns = df_t.columns.str[:5]
        ret_dict['data'] = df_t.to_dict(orient='split')
        if len(loc_dict['df_table']):
            ret_dict['df_table'] = loc_dict['df_table'].to_html(index_names=False,
                                                                na_rep='', classes='echarts_combine_table').replace(
                "\\n", "<br>")
        return ret_dict


class EchartsDistCombineChartViz(BaseViz):
    """ Echarts Correlation"""
    viz_type = 'echarts_dist_combine'
    is_timeseries = False

    @staticmethod
    def _normalize_granularity_column(series):
        """Normalize string and native date values to the chart's date key."""
        inferred_dtype = pd.api.types.infer_dtype(series, skipna=True)
        if inferred_dtype == 'string':
            return series.str.replace('-', '', regex=False)
        if inferred_dtype in ('date', 'datetime', 'datetime64'):
            return pd.to_datetime(series, errors='coerce').dt.strftime('%Y%m%d')
        if inferred_dtype != 'empty':
            # A mixed column can occur after the common fillna step. Keep
            # non-date values unchanged while normalizing the date/string
            # values that are safe to convert.
            return series.map(
                lambda value: value.strftime('%Y%m%d')
                if hasattr(value, 'strftime') else
                value.replace('-', '')
                if isinstance(value, string_types) else value)
        return series

    def query_obj(self):
        d = super(EchartsDistCombineChartViz, self).query_obj()
        fd = self.form_data
        return d

    def get_data(self, df):
        fd = self.form_data
        column_order_type_dict = json.loads(fd.get("column_order_type")) if fd.get("column_order_type") else dict()
        show_group_totitle = fd.get('show_group_totitle')
        title_str = ''
        pivot_index = self.groupby
        granularity = fd.get('granularity_sqla')
        if granularity in df.columns:
            df[granularity] = self._normalize_granularity_column(df[granularity])

        if show_group_totitle:
            col_list = show_group_totitle.split('|')
            # 根据列名列表的长度决定拼接方式
            if len(col_list) == 1:
                title_str = df[col_list[0]].iloc[0]
            else:
                title_str = ",".join(df[col].iloc[0] for col in col_list)
            df = df.drop(columns=col_list)
            pivot_index = list(set(pivot_index) - set(col_list))

        df = df.pivot_table(
            index=pivot_index,
            columns=[],
            values=self.metrics)
        if len(column_order_type_dict):
            order_keys = list(column_order_type_dict.keys())
            order_ascending = []
            for k in order_keys:
                order_ascending.append(True if column_order_type_dict[k] == 'asc' else False)
            df = df.sort_values(order_keys, ascending=order_ascending)
        if fd.get('whether_show_average_line'):
            df['均值'] = df.mean(axis=1)

        column_order_list = fd.get('column_order_list')
        if column_order_list:
            columns_order_list = json.loads(column_order_list)
            columns_order = [x for x in columns_order_list if x in df.columns]
            other_columns = [x for x in df.columns if x not in columns_order_list]
            df = df[columns_order + other_columns]
        ret_dict = {'data': df.T.to_dict(orient='split'), 'title_str': title_str}
        return ret_dict


class EchartsMultipleYChartViz(BaseViz):
    """ Echarts Correlation"""
    viz_type = 'echarts_multiple_y'
    # is_timeseries = True
    is_timeseries = False

    def query_obj(self):
        d = super(EchartsMultipleYChartViz, self).query_obj()
        fd = self.form_data
        d['groupby'] = d['groupby'] + [fd.get('entity')]
        d['groupby'] = list(set(d['groupby']))
        return d

    def get_data(self, df):
        fd = self.form_data
        index = fd.get('columns')
        # if DTTM_ALIAS in df.columns.values.tolist():
        #     df[DTTM_ALIAS] = df[DTTM_ALIAS].apply(lambda x: x.strftime('%Y%m%d'))
        # index = index + [DTTM_ALIAS]
        name = [fd.get('entity')]

        value = utils.get_metric_names(fd.get('metrics'))[0]
        df[DTTM_ALIAS] = df[DTTM_ALIAS].astype('str')
        df = df.pivot_table(index=index, columns=name, values=value)
        if fd.get('first_fillna_method') != 'None':
            df = df.fillna(method=fd.get('first_fillna_method'))
        if fd.get('second_fillna_method') != 'None':
            df = df.fillna(method=fd.get('second_fillna_method'))

        df = df.astype(float)
        df = df.sort_index()
        column_order_list = fd.get('column_order_list')
        if column_order_list:
            columns_order_list = json.loads(column_order_list)
            columns_order = [x for x in columns_order_list if x in df.columns]
            other_columns = [x for x in df.columns if x not in columns_order_list]
            df = df[columns_order + other_columns]

        # columns_value_display_on_the_right_Y_axis = fd.get('columns_value_display_on_the_right_Y_axis')
        columns_value_represent_by_histogram = fd.get('columns_value_represent_by_histogram')
        histogram_list = columns_value_represent_by_histogram.split('|')
        columns_value_represent_by_area = fd.get('columns_value_represent_by_area')
        area_list = columns_value_represent_by_area.split('|')

        columns_value_represent_by_histogram = '|'.join(histogram_list)
        columns_value_represent_by_area = '|'.join(area_list)

        ret_dict = {}
        ret_dict['left_axis_use_reverse_order'] = fd.get('left_axis_use_reverse_order')
        ret_dict['columns_value_represent_by_histogram'] = columns_value_represent_by_histogram
        ret_dict['columns_value_represent_by_area'] = columns_value_represent_by_area
        ret_dict['data'] = df.T.to_dict(orient='split')
        return ret_dict


class EchartsScatterChartViz(BaseViz):
    """ Echarts Correlation"""
    viz_type = 'echarts_scatter'
    is_timeseries = True

    def query_obj(self):
        d = super(EchartsScatterChartViz, self).query_obj()
        fd = self.form_data

        if fd.get('all_columns') and fd.get('metrics'):
            raise Exception(_('Please choose only one of "Columns" or "Metrics"'))
        elif not fd.get('all_columns') and not fd.get('metrics'):
            raise Exception(_('Please choose only one of "Columns" or "Metrics"'))
        elif fd.get('all_columns'):
            columns = fd.get('all_columns')
            if len(columns) != 1:
                raise Exception(_('Please choose only one column in "Columns"'))
            d['columns'] = [fd.get('entity')] + fd.get('all_columns')
            d['groupby'] = []
        elif fd.get('metrics'):
            metrics = fd.get('metrics')
            if len(metrics) != 1:
                raise Exception(_('Please choose only one metric in "Metrics"'))
            d['groupby'] = [fd.get('entity')]
        return d

    def get_data(self, df):
        fd = self.form_data
        name = fd.get('entity')
        date = DTTM_ALIAS
        if fd.get('metrics') and len(fd.get('metrics')):
            value = utils.get_metric_names(fd.get('metrics'))[0]
        else:
            value = fd.get('all_columns')[0]

        if len(df[name].unique()) < 2:
            raise Exception('Please select at least two instrument in "{0}"'.format(name))

        df = df.pivot_table(index=date, columns=name, values=value)
        df.dropna(inplace=True)

        column_order_list = fd.get('column_order_list')
        if column_order_list:
            columns_order_list = json.loads(column_order_list)
            columns_order = [x for x in columns_order_list if x in df.columns]
            other_columns = [x for x in df.columns if x not in columns_order_list]
            df = df[columns_order + other_columns]
        index_max = df.index.values[-1]
        df.sort_values(by=df.columns[0], inplace=True)
        # df.index = df.index.strftime('%Y-%m-%d')
        # dt = df.to_dict()
        ret_dict = {}
        ret_dict['columns'] = df.columns.tolist()
        # ret_dict['data'] = df.T.to_dict(orient='split')
        # ret_dict['data'] = {k: [[k1, v1] for k1, v1 in v.items()] for k, v in dt.items()}
        ret_dict['data'] = df.values.tolist()
        ret_dict['max_position'] = np.where(df.index.values == index_max)[0][0]
        return ret_dict


class EchartsDynamicLineChart(BaseViz):
    """ Echarts Dynamic Line Chart"""
    viz_type = 'echarts_dynamic_line_chart'
    is_timeseries = False

    def query_obj(self):
        fd = self.form_data
        if not len(fd.get('history_data_interface_url')) and not len(fd.get('latest_data_interface_url')):
            raise Exception(
                _('Please write at least one of "History Data Interface Url" or "Latest Data Interface Url"'))
        return None

    def get_df(self, query_obj=None):
        return None


class EchartsThermodynamicChart(BaseViz):
    """ Echarts Correlation"""
    viz_type = 'echarts_thermodynamic_chart'
    is_timeseries = False

    def query_obj(self):
        return None

    def get_df(self, query_obj=None):
        return None


class EchartsBollingBondViz(BaseViz):
    """ Echarts Correlation"""
    viz_type = 'echarts_bolling_bond'
    is_timeseries = True

    def query_obj(self):
        d = super(EchartsBollingBondViz, self).query_obj()
        fd = self.form_data

        d['columns'] = [fd.get('entity'), fd.get('series')]
        d['groupby'] = []
        d['metrics'] = []
        return d

    def get_data(self, df):
        fd = self.form_data
        name = fd.get('entity')
        value = fd.get('series')
        date = '__timestamp'
        ma = fd.get('rolling_periods')
        bolling_ratio_1 = float(fd.get('bolling_ratio_1'))
        bolling_ratio_2 = float(fd.get('bolling_ratio_2'))
        lag_days = fd.get('day_shift')

        if len(df[name].unique()) > 1:
            raise Exception('Please use filter select only one instrument in "{0}"'.format(name))
        order_book_id = df[name].unique()

        df = df.pivot_table(index=date, columns=name, values=value)
        df = df.fillna(method='pad').fillna(method='bfill').astype(float)
        df = df.sort_index()
        df.index = df.index.strftime('%Y-%m-%d')
        df['均线'] = df[order_book_id].rolling(ma).mean()
        df['tmp'] = df[order_book_id].rolling(ma).std()
        df['上一轨'] = df['均线'] + bolling_ratio_1 * df['tmp']
        df['下一轨'] = df['均线'] - bolling_ratio_1 * df['tmp']
        df['上二轨'] = df['均线'] + bolling_ratio_2 * df['tmp']
        df['下二轨'] = df['均线'] - bolling_ratio_2 * df['tmp']

        lag_indexes = ['均线', '上一轨', '下一轨', '上二轨', '下二轨']
        df[lag_indexes] = df[lag_indexes].round(3)
        if lag_days > 0:
            df[lag_indexes] = df[lag_indexes].shift(lag_days)

        df_tmp = df.iloc[-1]
        per = ((df_tmp[order_book_id] - df_tmp['下一轨']) / (df_tmp['上一轨'] - df_tmp['下一轨'])).round(3)
        per_str = '{0}%'.format(per.iloc[0] * 100)
        df = df.drop('tmp', axis=1)

        if lag_days > 0:
            df.columns = ['{0} (Lag {1} days)'.format(x, lag_days) if x in lag_indexes else x for x in df.columns]

        ret_dict = {}
        ret_dict['percent'] = per_str
        ret_dict['left_axis_min_value'] = self.get_float_or_default_value(fd, 'left_axis_min_value', 'dataMin')
        ret_dict['left_axis_max_value'] = self.get_float_or_default_value(fd, 'left_axis_max_value', 'dataMax')
        ret_dict['is_show_bolling_1'] = self.form_data.get('whether_show_bolling_1_at_beginning')
        ret_dict['is_show_bolling_2'] = self.form_data.get('whether_show_bolling_2_at_beginning')
        ret_dict['data'] = df.T.to_dict(orient='split')
        return ret_dict


class HighchartsCandleStick(BaseViz):
    """ Candle Stick View"""
    viz_type = 'highcharts_candle_stick'
    is_timeseries = True

    def query_obj(self):
        d = super(HighchartsCandleStick, self).query_obj()
        fd = self.form_data

        if fd.get('all_columns'):
            columns = fd.get('all_columns')
            if len(columns) < 5:
                raise Exception(_('Please choose open/high/low/close/volume columns in "Columns"'))
            d['columns'] = fd.get('all_columns')
            d['groupby'] = []
        if fd.get('granularity_sqla'):
            d['orderby'] = [(fd.get('granularity_sqla'), True)]

        return d

    def get_data(self, df):
        fd = self.form_data
        df['date'] = df['__timestamp'].dt.strftime('%Y-%m-%d')
        if fd.get('fields_map'):
            fields_map = json.loads(fd.get('fields_map'))
            df.rename(columns=fields_map, inplace=True)
        ret_dict = {}
        ret_dict['data'] = df[['date', 'open', 'close', 'low', 'high', 'volume']].to_dict(orient='split')
        # ret_dict['is_show_ma'] = self.form_data.get('whether_show_ma_at_beginning')
        # ret_dict['kline_x_axis_start'] = float(self.form_data.get('kline_x_axis_start'))
        # ret_dict['kline_x_axis_end'] = float(self.form_data.get('kline_x_axis_end'))
        return ret_dict


class HtmlSetViewViz(BaseViz):
    viz_type = 'html_set'
    verbose_name = _('Html Set')
    is_timeseries = False

    def query_obj(self):
        fd = self.form_data
        if not len(fd.get('excel_url')):
            raise Exception(
                _('Please Write Website Link"'))
        return None

    def get_data(self, df):
        from bs4 import BeautifulSoup
        from urllib import parse, request
        from IPython.display import display, HTML
        import requests
        fd = self.form_data
        beautifulsoup_expression = fd.get('beautifulsoup_expression')
        excel_style = fd.get('excel_style')
        website_url = fd.get('excel_url')
        req = request.Request(website_url)
        # response = requests.get(website_url, headers=headers)
        # response.encoding = response.apparent_encoding
        req.add_header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; WOW64) "
                                     "AppleWebKit/537.36 (KHTML, like Gecko) "
                                     "Chrome/70.0.3538.77 Safari/537.36")
        html = request.urlopen(req).read()
        html = html.decode("utf-8")
        if beautifulsoup_expression:
            soup = BeautifulSoup(html, "lxml")
            # method = "soup.find_all(class_='sina')[0].contents[1]"
            method = beautifulsoup_expression
            # 只允许输入单条，soup.find_all开头的非嵌套函数。
            # 必须以soup.find开头，并以序号结尾
            import re
            p1 = re.compile(r'soup.find_all\(', re.S)
            pos1 = re.match(p1, method)
            can_eval = False
            if pos1:
                can_eval = True
            if method[-1] != ']':
                can_eval = False
            ####不允许操作系统文件
            if 'os' in method or '__' in method or 'load' in method:
                can_eval = False
            ####不允许多条语句
            p2 = re.compile(r'\).*?,.*?\(', re.S)  # 最小匹配
            finds = p2.findall(method)
            if len(finds) > 0:
                can_eval = False
            ####不允许嵌套函数
            p3 = re.compile(r'\([^\)]*?\(', re.S)  # 最小匹配
            finds = p3.findall(method)
            if len(finds) > 0:
                can_eval = False
            # 通过全部检查
            if can_eval:
                html = eval(method)
                img_src = html.get('src')
                if img_src:
                    img_src = parse.urljoin(website_url, str(img_src))
                    if img_src.split("://")[0] == 'http':
                        base64_image = base64.b64encode(requests.get(img_src).content).decode('utf-8')
                        img_src = f'data:image/jpeg;base64,{base64_image}'
                    html["src"] = img_src
                html = str(html)
                if excel_style and len(excel_style):
                    html = HTML('<style>{0}</style> '.format(excel_style) + html).data
        return dict(
            html=html,
        )


class EchartsRadarViz(BaseViz):
    """A pivot table view, define your rows, columns and metrics"""

    viz_type = 'echarts_radar'
    verbose_name = _('Echarts Radar')
    is_timeseries = True

    def query_obj(self):
        d = super(EchartsRadarViz, self).query_obj()
        groupby = self.form_data.get('groupby')
        columns = self.form_data.get('columns')
        metrics = self.form_data.get('metrics')
        if not columns:
            columns = []
        if not groupby:
            groupby = []
        if not groupby:
            raise Exception(_("Please choose at least one 'Group by' field "))
        if not metrics:
            raise Exception(_('Please choose at least one metric'))
        if (
                any(v in groupby for v in columns) or
                any(v in columns for v in groupby)):
            raise Exception(_("Group By' and 'Columns' can't overlap"))
        return d

    def get_data(self, df):

        df = df.pivot_table(
            index=self.form_data.get('groupby'),
            columns=self.form_data.get('columns'),
            values=self.form_data.get('metrics'),
        )
        df = df[self.form_data.get('metrics')[0]]
        column_order_list = self.form_data.get('column_order_list')

        if column_order_list:
            columns_order_list = json.loads(column_order_list)
            columns_order = [x for x in columns_order_list if x in df.columns]
            other_columns = [x for x in df.columns if x not in columns_order_list]
            df = df[columns_order + other_columns]

        df = df.sort_index(ascending=False)
        if self.form_data.get('show_datatable'):
            index_name = str(df.index[0].year) + '年' + str(df.index[0].month) + '月-' + str(df.index[1].month) + '月'
            # df = df.append(df.head(1).rename(index=lambda x: index_name))
            df.loc[index_name] = df.iloc[0] - df.iloc[1]
        return dict(
            data=df.to_dict(orient='split')
        )


class CkEditorViz(BaseViz):
    """Use html or markdown to create a free form widget"""

    viz_type = 'ckeditor_slice'
    verbose_name = _('CkEditor_Slice')
    is_timeseries = False

    def query_obj(self):
        return None

    def get_df(self, query_obj=None):
        return None

    def get_data(self, df):
        return dict(editor_content=self.form_data.get('editor_content', ''))


class EchartsShareDataViz(BaseViz):
    """A pivot table view, define your rows, columns and metrics"""

    viz_type = 'echarts_share_data'
    verbose_name = _('Echarts Share Data')
    is_timeseries = True

    def query_obj(self):
        d = super(EchartsShareDataViz, self).query_obj()
        groupby = self.form_data.get('groupby')
        metrics = self.form_data.get('metrics')
        if not groupby:
            groupby = []
        if not groupby:
            raise Exception(_("Please choose at least one 'Group by' field "))
        if not metrics:
            raise Exception(_('Please choose at least one metric'))

        return d

    def get_data(self, df):
        fd = self.form_data
        values = utils.get_metric_names(fd.get('metrics'))[0]
        groupby = self.form_data.get('groupby')[0]
        df[DTTM_ALIAS] = df[DTTM_ALIAS].astype('str')

        line_list = json.loads(fd.get('line_list'))
        line_index_df = df[df[groupby].isin(line_list)]

        category_index_df = df[~df[groupby].isin(line_list)]

        line_index_df = line_index_df.pivot_table(
            index=DTTM_ALIAS,
            columns=groupby,
            values=values,
        )
        line_index_df = line_index_df.sort_index(ascending=False).T

        category_index_df = category_index_df.pivot_table(
            index=DTTM_ALIAS,
            columns=groupby,
            values=values,
        )

        return dict(
            data=line_index_df.to_dict(orient='split'),
            data1=category_index_df.tail().to_dict(orient='split')
        )


class AgGridViz(BaseViz):
    """A pivot table view, define your rows, columns and metrics"""

    viz_type = 'ag_grid'
    verbose_name = _('AgGrid View')
    is_timeseries = False

    def should_be_timeseries(self):
        fd = self.form_data
        # TODO handle datasource-type-specific code in datasource
        conditions_met = (
                (fd.get('granularity') and fd.get('granularity') != 'all') or
                (fd.get('granularity_sqla') and fd.get('time_grain_sqla'))
        )
        if fd.get('include_time') and not conditions_met:
            raise Exception(_(
                'Pick a granularity in the Time section or '
                "uncheck 'Include Time'"))
        return fd.get('include_time')

    def query_obj(self):
        d = super(AgGridViz, self).query_obj()
        fd = self.form_data
        groupby = fd.get('groupby')
        all_columns = fd.get('all_columns')
        metrics = fd.get('metrics')
        if all_columns and (groupby or metrics):
            raise Exception(_(
                'Choose either fields to [Group By] and [Metrics] or '
                '[Columns], not both'))

        sort_by = fd.get('timeseries_limit_metric')
        if all_columns:
            d['columns'] = all_columns
            d['groupby'] = []
            order_by_cols = fd.get('order_by_cols') or []
            d['orderby'] = [json.loads(t) for t in order_by_cols]
        elif sort_by:
            if sort_by not in d['metrics']:
                d['metrics'] += [sort_by]
            d['orderby'] = [(sort_by, not fd.get('order_desc', True))]
        d['is_timeseries'] = self.should_be_timeseries()
        return d

    def build_list(self, df, parent_id, path):
        result = []
        all_columns = self.form_data.get('all_columns')
        all_columns_relation = self.form_data.get('all_columns_relation')
        for _, row in df[df[all_columns_relation[1]] == parent_id].iterrows():
            current_path = path + [row[all_columns_relation[0]]]
            entry = {
                col: (current_path if col == all_columns_relation[0] else row[col])
                for col in all_columns
            }
            result.append(entry)
            # 递归查找子节点
            result.extend(self.build_list(df, row[all_columns_relation[0]], current_path))
        return result

    def get_data(self, df):
        fd = self.form_data
        # all_columns = fd.get('all_columns')
        # all_columns_relation = fd.get('all_columns_relation')
        date_col = []
        float_col = []
        for col in df.columns:
            if pd.api.types.is_datetime64_any_dtype(df[col]):
                df[col] = df[col].dt.strftime('%Y/%m/%d')
                date_col.append(col)
            if df[col].dtype == np.float64 or df[col].dtype == np.float32:
                # df[col] = df[col].round(2)
                float_col.append(col)
        result_records = df.to_dict(orient='records')
        # if len(all_columns_relation):
        #     result_records = self.build_list(df, 0, [])

        data = self.handle_js_int_overflow(
            dict(
                records=result_records,
                columns=list(df.columns),
                date_col=date_col,
                float_col=float_col
            ))

        return data


class EchartsBubbleViz(BaseViz):
    """Based on the Echarts bubble chart"""

    viz_type = 'echarts_bubble'
    verbose_name = _('Echarts Bubble Chart')
    is_timeseries = False

    def query_obj(self):
        form_data = self.form_data
        d = super(EchartsBubbleViz, self).query_obj()
        d['groupby'] = [
            form_data.get('entity'),
        ]
        if form_data.get('series') == form_data.get('entity'):
            raise Exception(_("Label and Legend 列不能相同"))
        if form_data.get('series'):
            d['groupby'].append(form_data.get('series'))
        # d['row_limit'] = form_data.get('limit')
        d['metrics'] = [
            form_data.get('size'),
            form_data.get('x'),
            form_data.get('y'),
        ]
        if not all(d['metrics']):
            raise Exception(_('Pick a metric for x, y and size'))
        return d

    def get_data(self, df):
        fd = self.form_data
        if fd.get('exec_code'):
            exec_code_str = fd.get('exec_code')
            regex_exec_code = re.compile(re.escape('execute'), re.IGNORECASE)
            exec_code_str = regex_exec_code.sub("", exec_code_str)
            regex_exec_code = re.compile(re.escape('to_sql'), re.IGNORECASE)
            exec_code_str = regex_exec_code.sub("", exec_code_str)
            regex_exec_code = re.compile(re.escape('read_sql'), re.IGNORECASE)
            exec_code_str = regex_exec_code.sub("", exec_code_str)
            exec(exec_code_str, globals(), {"df": df})
        # 如果指定了series(气泡图的label)字段，那么就用series，否则用entity 代替
        # entity 是echarts 得 legend
        columns = [fd.get('x'), fd.get('y'), fd.get('size')]
        if fd.get('series') and fd.get('series') in df.columns:
            columns.append(fd.get('series'))
        else:
            df['series'] = df[fd.get('entity')]
            columns.append('series')
        columns.append(fd.get('entity'))
        df = df[columns]
        data = df.groupby(fd.get('entity')).apply(
            lambda group: group.values.tolist()
        ).to_dict()
        rtn_dict = dict(
            data=data,
            max_size=df[fd.get('size')].max(),
            min_size=df[fd.get('size')].min(),
        )
        return rtn_dict


# ------------------------------ this is echarts end ---------------------------------


class TableViz(BaseViz):
    """A basic html table that is sortable and searchable"""

    viz_type = 'table'
    verbose_name = _('Table View')
    credits = 'a <a href="https://github.com/airbnb/superset">Superset</a> original'
    is_timeseries = False

    def should_be_timeseries(self):
        fd = self.form_data
        # TODO handle datasource-type-specific code in datasource
        conditions_met = (
                (fd.get('granularity') and fd.get('granularity') != 'all') or
                (fd.get('granularity_sqla') and fd.get('time_grain_sqla'))
        )
        if fd.get('include_time') and not conditions_met:
            raise Exception(_(
                'Pick a granularity in the Time section or '
                "uncheck 'Include Time'"))
        return fd.get('include_time')

    def query_obj(self):
        d = super(TableViz, self).query_obj()
        fd = self.form_data

        if fd.get('all_columns') and (fd.get('groupby') or fd.get('metrics')):
            raise Exception(_(
                'Choose either fields to [Group By] and [Metrics] or '
                '[Columns], not both'))

        sort_by = fd.get('timeseries_limit_metric')
        if fd.get('all_columns'):
            d['columns'] = fd.get('all_columns')
            d['groupby'] = []
            order_by_cols = fd.get('order_by_cols') or []
            d['orderby'] = [json.loads(t) for t in order_by_cols]
        elif sort_by:
            if sort_by not in d['metrics']:
                d['metrics'] += [sort_by]
            d['orderby'] = [(sort_by, not fd.get('order_desc', True))]

        # Add all percent metrics that are not already in the list
        if 'percent_metrics' in fd:
            d['metrics'] = d['metrics'] + list(filter(
                lambda m: m not in d['metrics'],
                fd['percent_metrics'],
            ))

        d['is_timeseries'] = self.should_be_timeseries()
        return d

    def get_data(self, df):
        # df = df.fillna("")
        fd = self.form_data
        if fd.get('latest_data_interface_url'):
            for column_name in fd.get('latest_data_interface_url').split("|"):
                df[column_name] = df[column_name].astype('datetime64[ns]')
                df[column_name] = df[column_name].apply(lambda x: x.strftime(fd.get('table_timestamp_format'))
                if isinstance(x, pd.Timestamp) else x)
        if (
                not self.should_be_timeseries() and
                df is not None and
                DTTM_ALIAS in df
        ):
            del df[DTTM_ALIAS]

        # Sum up and compute percentages for all percent metrics
        percent_metrics = fd.get('percent_metrics', [])
        if len(percent_metrics):
            percent_metrics = list(filter(lambda m: m in df, percent_metrics))
            metric_sums = {
                m: reduce(lambda a, b: a + b, df[m])
                for m in percent_metrics
            }
            metric_percents = {
                m: list(map(lambda a: a / metric_sums[m], df[m]))
                for m in percent_metrics
            }
            for m in percent_metrics:
                m_name = '%' + m
                df[m_name] = pd.Series(metric_percents[m], name=m_name)
            # Remove metrics that are not in the main metrics list
            for m in filter(
                    lambda m: m not in fd['metrics'] and m in df.columns,
                    percent_metrics,
            ):
                del df[m]

        data = self.handle_js_int_overflow(
            dict(
                records=df.to_dict(orient='records'),
                columns=list(df.columns),
            ))

        return data

    def json_dumps(self, obj, sort_keys=False):
        if self.form_data.get('all_columns'):
            return json.dumps(
                obj, default=utils.json_iso_dttm_ser, sort_keys=sort_keys)
        else:
            return super(TableViz, self).json_dumps(obj)


class TimeTableViz(BaseViz):
    """A data table with rich time-series related columns"""

    viz_type = 'time_table'
    verbose_name = _('Time Table View')
    credits = 'a <a href="https://github.com/airbnb/superset">Superset</a> original'
    is_timeseries = True

    def query_obj(self):
        d = super(TimeTableViz, self).query_obj()
        fd = self.form_data

        if not fd.get('metrics'):
            raise Exception(_('Pick at least one metric'))

        if fd.get('groupby') and len(fd.get('metrics')) > 1:
            raise Exception(_(
                "When using 'Group By' you are limited to use a single metric"))
        return d

    def compute_volatility(self, data_list, metrics):
        volatility_list = [itm for itm in self.form_data.get('column_collection')
                           if 'volatility' in itm['colType']]
        sigma_list = []
        if len(volatility_list) == 0:
            return sigma_list

        def compute_core(price_arr):
            price_series = pd.Series(price_arr)
            # 价格序列取自然对数差值
            diff_price_array = np.log(price_series / price_series.shift()).dropna()
            # nan_len = len(np.argwhere(np.isnan(diff_price_array)))
            sigma_rtn = np.nanstd(diff_price_array) * np.sqrt(250 / len(diff_price_array))
            return sigma_rtn

        def compute_move_volatility(price_arr, rolling_periods):
            # 计算移动波动率
            volatility_rolling = []
            if rolling_periods > len(price_arr):
                return volatility_rolling
            price_series = pd.Series(price_arr)
            # 价格序列取自然对数差值
            diff_price_array = np.log(price_series / price_series.shift()).dropna()
            volatility_rolling = diff_price_array.rolling(window=rolling_periods).std() * np.sqrt(250 / rolling_periods)
            volatility_rolling = volatility_rolling.dropna().tolist()
            return volatility_rolling

        for item in data_list:
            keys = list(item.keys())
            keys.sort(reverse=True)
            data_list_reverse = [item[key] for key in keys]
            sigma_dict = {}
            for cl in metrics:
                for col_item in volatility_list:
                    data_list_reverse_timelag = data_list_reverse[0:int(col_item['timeLag'])]
                    # 获取每日价格并存入数组
                    price_array = [itm[cl] for itm in data_list_reverse_timelag]
                    if col_item['colType'] == 'period_volatility':
                        sigma = compute_core(price_array)
                    else:
                        sigma = compute_move_volatility(price_array, int(col_item['rollingPeriods']))
                    sigma_dict[cl + col_item['key']] = sigma
            sigma_list.append(sigma_dict)
        return sigma_list

    def get_data(self, df):
        fd = self.form_data
        values = self.metrics
        columns = None
        if self.form_data.get('day_shift_for_annual_start_days') != 0:
            df[DTTM_ALIAS] = df[DTTM_ALIAS] + \
                             pd.Timedelta(
                                 '{0} days'.format(self.form_data.get('day_shift_for_annual_start_days')))
        if fd.get('groupby'):
            values = self.metrics[0]
            columns = fd.get('groupby')
        pt = df.pivot_table(
            index=DTTM_ALIAS,
            columns=columns,
            values=values)
        pt.index = pt.index.map(str)
        pt = pt.sort_index()
        if fd.get('wether_aggfunc'):
            pt[fd.get('pandas_aggfunc')] = pt.agg(fd.get('pandas_aggfunc'), axis=1)

        rolling_type = fd.get('rolling_type')
        rolling_periods = int(fd.get('rolling_periods') or 0)
        min_periods = int(fd.get('min_periods') or 0)
        metrics_name_list = pt.columns.tolist()
        if rolling_periods and len(metrics_name_list):
            if rolling_type in ('mean', 'std', 'sum'):
                for metricName in metrics_name_list:
                    if rolling_type == 'mean':
                        pt[metricName] = pt[metricName].rolling(window=rolling_periods, min_periods=min_periods).mean()
                    elif rolling_type == 'std':
                        pt[metricName] = pt[metricName].rolling(window=rolling_periods, min_periods=min_periods).std()
                    elif rolling_type == 'sum':
                        pt[metricName] = pt[metricName].rolling(window=rolling_periods, min_periods=min_periods).sum()
            elif rolling_type == 'cumsum':
                for metricName in metrics_name_list:
                    pt[metricName] = pt[metricName].cumsum()
            if min_periods:
                pt = pt[min_periods:]

        if fd.get('first_fillna_method') != 'None':
            if fd.get('first_fillna_method') == '0':
                pt = pt.fillna(0)
            else:
                pt = pt.fillna(method=fd.get('first_fillna_method'))
        if fd.get('second_fillna_method') != 'None':
            if fd.get('second_fillna_method') == '0':
                pt = pt.fillna(0)
            else:
                pt = pt.fillna(method=fd.get('second_fillna_method'))

        columns_order = fd.get('index_order')
        records = []
        topcolumn = []
        if hasattr(pt.columns, 'levels'):
            topcolumn = list(pt.columns.levels[0])
            if fd.get('column_order_list'):
                topcolumn_order_list = fd.get('column_order_list').split('|')
                topcolumn_order_list = [x for x in topcolumn_order_list if x in topcolumn]
                topother_columns = [x for x in topcolumn if x not in topcolumn_order_list]
                topcolumn = topcolumn_order_list + topother_columns
                pt = pt[topcolumn]

            columns = list(pt.columns.levels[1])
            for cname in topcolumn:
                child_dt = pt[cname]
                records.append(child_dt.to_dict(orient='index'))
            if fd.get('text_replace'):
                topcolumn_alias = json.loads(fd.get('text_replace'))
                topcolumn = [topcolumn_alias[x] if x in topcolumn_alias else x for x in topcolumn]
        else:
            records.append(pt.to_dict(orient='index'))
            columns = list(pt.columns)
        if len(columns_order):
            columns_order_list = columns_order.split('|')
            columns_order_list = [x for x in columns_order_list if x in columns]
            other_columns = [x for x in columns if x not in columns_order_list]
            columns = columns_order_list + other_columns
        return dict(
            records=records,
            columns=columns,
            topcolumn=topcolumn,
            is_group_by=len(fd.get('groupby')) > 0,
            volatility_list=self.compute_volatility(records, columns)
        )


class PivotTableViz(BaseViz):
    """A pivot table view, define your rows, columns and metrics"""

    viz_type = 'pivot_table'
    verbose_name = _('Pivot Table')
    credits = 'a <a href="https://github.com/airbnb/superset">Superset</a> original'
    is_timeseries = False

    def query_obj(self):
        d = super(PivotTableViz, self).query_obj()
        groupby = self.form_data.get('groupby')
        columns = self.form_data.get('columns')
        metrics = self.form_data.get('metrics')
        if not columns:
            columns = []
        if not groupby:
            groupby = []
        if not groupby:
            raise Exception(_("Please choose at least one 'Group by' field "))
        if not metrics:
            raise Exception(_('Please choose at least one metric'))
        if (
                any(v in groupby for v in columns) or
                any(v in columns for v in groupby)):
            raise Exception(_("Group By' and 'Columns' can't overlap"))
        return d

    def get_data(self, df):
        if self.form_data.get('granularity') == 'all' and DTTM_ALIAS in df:
            del df[DTTM_ALIAS]
        if DTTM_ALIAS in df:
            df.rename(columns={DTTM_ALIAS: self.form_data.get('granularity_sqla')}, inplace=True)
        granularity_sqla = self.form_data.get('granularity_sqla')
        groupby = [granularity_sqla if i == DTTM_ALIAS else i for i
                   in self.form_data.get('groupby')]
        columns = [granularity_sqla if i == DTTM_ALIAS else i for i
                   in self.form_data.get('columns')]
        if self.form_data.get('day_shift_for_annual_start_days') != 0:
            df[granularity_sqla] = df[granularity_sqla] + \
                                   pd.Timedelta(
                                       '{0} days'.format(self.form_data.get('day_shift_for_annual_start_days')))

        metrics = self.form_data.get('metrics')
        metric_renew = []
        if isinstance(metrics, list):
            for metric in metrics:
                if isinstance(metric, dict):
                    metric_renew.append(metric['label'])
                else:
                    metric_renew.append(metric)

        if 'table_id' in groupby:
            # 处理乐勒文本数据表同一日期多个文本值合并排序问题
            groupby.remove('table_id')
            df['listorder'] = df.groupby(groupby + columns).rank(method='first', ascending=0)['table_id']
            groupby = groupby + ['listorder']
        df = df.pivot_table(
            index=groupby,
            columns=columns,
            values=metric_renew,
            aggfunc=self.form_data.get('pandas_aggfunc'),
            margins=self.form_data.get('pivot_margins'),
        )
        if 'listorder' in groupby:
            df.sort_index(ascending=[False, True], level=groupby, inplace=True)
        if self.form_data.get('sub_total') and df.index.nlevels > 1:
            table_total = df.groupby(level=groupby[0]).sum()
            if 'All' in table_total.index:
                table_total.drop(index='All', inplace=True)
            table_total_reix = [table_total.index]
            if df.index.nlevels > 1:
                # 索引大于2级的时候，添加索引层级
                for i in range(df.index.nlevels - 2):
                    table_total_reix.append([''] * len(table_total))
                table_total_reix.append(['Total'] * len(table_total))
            # else:
            #     for i in range(len(table_total)):
            #         table_total_reix.append('Total')
            table_total.index = table_total_reix
            table_index = df.index.values.tolist()
            table_reindex = []
            df_concat = pd.concat([df, table_total])
            for idx, val in enumerate(table_index):
                table_reindex.append(val)
                if idx > 0:
                    if df.index.nlevels > 1:
                        tuple_ix = (table_index[idx - 1][0], 'Total')
                        if df.index.nlevels > 2:
                            tuple_ix = (table_index[idx - 1][0], *[''] * (df.index.nlevels - 2), 'Total')
                        if val[0] != table_index[idx - 1][0]:
                            del table_reindex[-1]
                            table_reindex.append(tuple_ix)
                            table_reindex.append(val)
                        if idx == (len(table_index) - 1) and val[0] != 'All':
                            table_reindex.append(tuple_ix)

                    # else:
                    #     if val != table_index[idx - 1]:
                    #         del table_reindex[-1]
                    #         table_reindex.append('Total')
                    #         table_reindex.append(val)
                    #     if idx == (len(table_index) - 1) and val != 'All':
                    #         table_reindex.append('Total')
            df = df_concat.reindex(table_reindex)
        # Display metrics side by side with each column
        if self.form_data.get('combine_metric'):
            df = df.stack(0).unstack()

        # df = pd.concat([df, pd.Series(df['sum__Value']['Ending Stocks'] / df['sum__Value']['Domestic Consumption'])],
        #                axis=1)
        if self.form_data.get('eval_code'):
            df = eval(self.form_data.get('eval_code'))
        if self.form_data.get('exec_code'):
            exec_code_str = self.form_data.get('exec_code')
            regex_exec_code = re.compile(re.escape('execute'), re.IGNORECASE)
            exec_code_str = regex_exec_code.sub("", exec_code_str)
            regex_exec_code = re.compile(re.escape('to_sql'), re.IGNORECASE)
            exec_code_str = regex_exec_code.sub("", exec_code_str)
            regex_exec_code = re.compile(re.escape('read_sql'), re.IGNORECASE)
            exec_code_str = regex_exec_code.sub("", exec_code_str)

            loc_dict = {"df": df}
            # exec(exec_code_str, {'__builtins__': {}, "pd": pd, "np": np, "datetime": datetime}, loc_dict)
            # df = loc_dict['df']
            exec(exec_code_str, {"pd": pd, "datetime": datetime, "np": np, "timedelta": timedelta}, loc_dict)
            df = loc_dict['df']

        columns = list(df.columns)
        if self.form_data.get('column_order_list'):
            column_order_list = literal_eval(self.form_data.get('column_order_list'))
            if isinstance(column_order_list[0], int):
                order_idx = [
                    i - 1 for i in column_order_list
                    if 1 <= i <= len(columns)
                ]
                ordered_cols = [columns[i] for i in order_idx]
                remaining_cols = [
                    col for i, col in enumerate(columns)
                    if i not in order_idx
                ]
                columns = ordered_cols + remaining_cols
            else:
                ordered_cols = [col for col in column_order_list if col in columns]
                remaining_cols = [col for col in columns if col not in ordered_cols]
                columns = ordered_cols + remaining_cols
        # df.columns = columns
        df = df.reindex(columns=columns)
        pd.set_option('display.max_colwidth', None)
        max_list = df.max().tolist()
        min_list = df.min().tolist()
        max_min_column_dict = {}
        if self.form_data.get('hsl_column'):
            hsl_column = self.form_data.get('hsl_column')
            if hsl_column:
                hsl_column_list = hsl_column.split('|')
                for col in hsl_column_list:
                    col_index = int(col) - 2
                    max_min_column_dict[col] = [max_list[col_index], min_list[col_index]]
        rtn_dict = dict(
            columns=columns,
            groupby=groupby,
            max=max_list,
            min=min_list,
            max_all=np.nanmax(pd.to_numeric(max_list, errors="coerce")),
            min_all=np.nanmin(pd.to_numeric(min_list, errors="coerce")),
            max_min_column_dict=max_min_column_dict,
            html=df.to_html(
                columns=columns,
                # header=False,
                na_rep='',
                classes=(
                    'dataframe table table-striped table-bordered '
                    'table-condensed table-hover').split(' ')).replace("\\n", "<br>"),
        )
        return rtn_dict


class ExcelViewViz(BaseViz):
    viz_type = 'excel_view'
    verbose_name = _('Excel View')
    credits = 'a <a href="https://github.com/airbnb/superset">Superset</a> original'
    is_timeseries = False

    def query_obj(self):
        fd = self.form_data
        if not len(fd.get('excel_url')):
            raise Exception(
                _('Please write Excel Url"'))
        return None

    def get_data(self, df):
        from urllib.parse import quote
        fd = self.form_data

        excel_load_parameter = fd.get('excel_load_parameter')
        data_frame_to_html_parameter = fd.get('data_frame_to_html_parameter')
        excel_style = fd.get('excel_style')

        excel_url = fd.get('excel_url')
        excel_url = excel_url[:8] + quote(excel_url[8:])

        if excel_load_parameter and len(excel_load_parameter):
            df = eval("pd.read_excel(excel_url, {0})".format(excel_load_parameter))
        else:
            df = pd.read_excel(excel_url)

        start_row = fd.get('start_row')
        end_row = fd.get('end_row') if fd.get('end_row') else -1
        start_column = fd.get('start_column')
        end_column = fd.get('end_column') if fd.get('end_column') else -1
        df = df.iloc[start_row:end_row, start_column:end_column]

        if data_frame_to_html_parameter and len(data_frame_to_html_parameter):
            html = eval(
                "df.to_html(na_rep='',"
                "{0})".format(data_frame_to_html_parameter))
        else:
            html = df.to_html(
                index=False, na_rep='',
                classes='dataframe table table-striped table-bordered table-condensed table-hover'.split(' '))

        if excel_style and len(excel_style):
            from IPython.display import HTML
            html = HTML('<style>{0}</style> '.format(excel_style) + html).data

        # Display metrics side by side with each column
        return dict(
            columns=list(df.columns),
            html=html,
        )


class MarkupViz(BaseViz):
    """Use html or markdown to create a free form widget"""

    viz_type = 'markup'
    verbose_name = _('Markup')
    is_timeseries = False

    def query_obj(self):
        return None

    def get_df(self, query_obj=None):
        return None

    def get_data(self, df):
        markup_type = self.form_data.get('markup_type')
        code = self.form_data.get('code', '')
        if markup_type == 'markdown':
            code = markdown(code, extensions=['markdown.extensions.tables'])
        return dict(html=code, theme_css=get_manifest_file('theme.css'))


class SeparatorViz(MarkupViz):
    """Use to create section headers in a dashboard, similar to `Markup`"""

    viz_type = 'separator'
    verbose_name = _('Separator')


class WordCloudViz(BaseViz):
    """Build a colorful word cloud

    Uses the nice library at:
    https://github.com/jasondavies/d3-cloud
    """

    viz_type = 'word_cloud'
    verbose_name = _('Word Cloud')
    is_timeseries = False

    def query_obj(self):
        d = super(WordCloudViz, self).query_obj()

        d['metrics'] = [self.form_data.get('metric')]
        d['groupby'] = [self.form_data.get('series')]
        return d

    def get_data(self, df):
        # Ordering the columns
        df = df[[self.form_data.get('series'), self.form_data.get('metric')]]
        # Labeling the columns for uniform json schema
        df.columns = ['text', 'size']
        return df.to_dict(orient='records')


class TreemapViz(BaseViz):
    """Tree map visualisation for hierarchical data."""

    viz_type = 'treemap'
    verbose_name = _('Treemap')
    credits = '<a href="https://d3js.org">d3.js</a>'
    is_timeseries = False

    def _nest(self, metric, df):
        nlevels = df.index.nlevels
        if nlevels == 1:
            result = [{'name': n, 'value': v}
                      for n, v in zip(df.index, df[metric])]
        else:
            result = [{'name': l, 'children': self._nest(metric, df.loc[l])}
                      for l in df.index.levels[0]]
        return result

    def get_data(self, df):
        df = df.set_index(self.form_data.get('groupby'))
        chart_data = [{'name': metric, 'children': self._nest(metric, df)}
                      for metric in df.columns]
        return chart_data


class CalHeatmapViz(BaseViz):
    """Calendar heatmap."""

    viz_type = 'cal_heatmap'
    verbose_name = _('Calendar Heatmap')
    credits = (
        '<a href=https://github.com/wa0x6e/cal-heatmap>cal-heatmap</a>')
    is_timeseries = True

    def get_data(self, df):
        form_data = self.form_data

        df.columns = ['timestamp', 'metric']
        timestamps = {str(obj['timestamp'].value / 10 ** 9):
                          obj.get('metric') for obj in df.to_dict('records')}

        start = utils.parse_human_datetime(form_data.get('since'))
        end = utils.parse_human_datetime(form_data.get('until'))
        domain = form_data.get('domain_granularity')
        diff_delta = rdelta.relativedelta(end, start)
        diff_secs = (end - start).total_seconds()

        if domain == 'year':
            range_ = diff_delta.years + 1
        elif domain == 'month':
            range_ = diff_delta.years * 12 + diff_delta.months + 1
        elif domain == 'week':
            range_ = diff_delta.years * 53 + diff_delta.weeks + 1
        elif domain == 'day':
            range_ = diff_secs // (24 * 60 * 60) + 1
        else:
            range_ = diff_secs // (60 * 60) + 1

        return {
            'timestamps': timestamps,
            'start': start,
            'domain': domain,
            'subdomain': form_data.get('subdomain_granularity'),
            'range': range_,
        }

    def query_obj(self):
        qry = super(CalHeatmapViz, self).query_obj()
        qry['metrics'] = [self.form_data['metric']]
        return qry


class NVD3Viz(BaseViz):
    """Base class for all nvd3 vizs"""

    credits = '<a href="http://nvd3.org/">NVD3.org</a>'
    viz_type = None
    verbose_name = 'Base NVD3 Viz'
    is_timeseries = False


class BoxPlotViz(NVD3Viz):
    """Box plot viz from ND3"""

    viz_type = 'box_plot'
    verbose_name = _('Box Plot')
    sort_series = False
    is_timeseries = True

    def to_series(self, df, extra_data, classed='', title_suffix=''):
        label_sep = ' - '
        chart_data = []
        for index_value, row in zip(df.index, df.to_dict(orient='records')):
            if isinstance(index_value, tuple):
                index_value = label_sep.join(index_value)
            boxes = defaultdict(dict)
            for (label, key), value in row.items():
                if key == 'median':
                    key = 'Q2'
                boxes[label][key] = value
            for label, box in boxes.items():
                if len(self.form_data.get('metrics')) > 1:
                    # need to render data labels with metrics
                    chart_label = label_sep.join([index_value, label])
                else:
                    chart_label = index_value
                box['extra_data'] = extra_data[index_value]
                chart_data.append({
                    'label': chart_label,
                    'values': box,
                })
        return chart_data

    def get_data(self, df):
        form_data = self.form_data
        df = df.fillna(0)

        # conform to NVD3 names
        def Q1(series):  # need to be named functions - can't use lambdas
            return np.percentile(series, 25)

        def Q3(series):
            return np.percentile(series, 75)

        whisker_type = form_data.get('whisker_options')
        if whisker_type == 'Tukey':

            def whisker_high(series):
                upper_outer_lim = Q3(series) + 1.5 * (Q3(series) - Q1(series))
                series = series[series <= upper_outer_lim]
                return series[np.abs(series - upper_outer_lim).argmin()]

            def whisker_low(series):
                lower_outer_lim = Q1(series) - 1.5 * (Q3(series) - Q1(series))
                # find the closest value above the lower outer limit
                series = series[series >= lower_outer_lim]
                return series[np.abs(series - lower_outer_lim).argmin()]

        elif whisker_type == 'Min/max (no outliers)':

            def whisker_high(series):
                return series.max()

            def whisker_low(series):
                return series.min()

        elif ' percentiles' in whisker_type:
            low, high = whisker_type.replace(' percentiles', '').split('/')

            def whisker_high(series):
                return np.percentile(series, int(high))

            def whisker_low(series):
                return np.percentile(series, int(low))

        else:
            raise ValueError('Unknown whisker type: {}'.format(whisker_type))

        def outliers(series):
            above = series[series > whisker_high(series)]
            below = series[series < whisker_low(series)]
            # pandas sometimes doesn't like getting lists back here
            return set(above.tolist() + below.tolist())

        aggregate = [Q1, np.median, Q3, whisker_high, whisker_low, outliers]
        df_agg = df.groupby(form_data.get('groupby')).agg(aggregate)
        df_groupby = df.sort_values(by=[DTTM_ALIAS]).groupby(form_data.get('groupby'))
        extra_data = dict()
        for keys, data in df_groupby:
            last = data[self.form_data.get('metrics')[0]].iloc[-1]
            sort_metrics = data[self.form_data.get('metrics')[0]].sort_values()
            max = sort_metrics.iloc[-1]
            min = sort_metrics.iloc[0]
            last_pos = 0
            for v in sort_metrics:
                if v <= last:
                    last_pos = last_pos + 1
            last_pos_per = last_pos / len(sort_metrics)
            extra_data[keys] = {'last': last, 'last_pos_per': last_pos_per, 'max': max, 'min': min}
        chart_data = self.to_series(df_agg, extra_data)
        return chart_data


class BubbleViz(NVD3Viz):
    """Based on the NVD3 bubble chart"""

    viz_type = 'bubble'
    verbose_name = _('Bubble Chart')
    is_timeseries = False

    def query_obj(self):
        form_data = self.form_data
        d = super(BubbleViz, self).query_obj()
        d['groupby'] = [
            form_data.get('entity'),
        ]
        if form_data.get('series'):
            d['groupby'].append(form_data.get('series'))
        self.x_metric = form_data.get('x')
        self.y_metric = form_data.get('y')
        self.z_metric = form_data.get('size')
        self.entity = form_data.get('entity')
        self.series = form_data.get('series') or self.entity
        d['row_limit'] = form_data.get('limit')

        d['metrics'] = [
            self.z_metric,
            self.x_metric,
            self.y_metric,
        ]
        if not all(d['metrics'] + [self.entity]):
            raise Exception(_('Pick a metric for x, y and size'))
        return d

    def get_data(self, df):
        df['x'] = df[[self.x_metric]]
        df['y'] = df[[self.y_metric]]
        df['size'] = df[[self.z_metric]]
        df['shape'] = 'circle'
        df['group'] = df[[self.series]]

        series = defaultdict(list)
        for row in df.to_dict(orient='records'):
            series[row['group']].append(row)
        chart_data = []
        for k, v in series.items():
            chart_data.append({
                'key': k,
                'values': v})
        return chart_data


class BulletViz(NVD3Viz):
    """Based on the NVD3 bullet chart"""

    viz_type = 'bullet'
    verbose_name = _('Bullet Chart')
    is_timeseries = False

    def query_obj(self):
        form_data = self.form_data
        d = super(BulletViz, self).query_obj()
        self.metric = form_data.get('metric')

        def as_strings(field):
            value = form_data.get(field)
            return value.split(',') if value else []

        def as_floats(field):
            return [float(x) for x in as_strings(field)]

        self.ranges = as_floats('ranges')
        self.range_labels = as_strings('range_labels')
        self.markers = as_floats('markers')
        self.marker_labels = as_strings('marker_labels')
        self.marker_lines = as_floats('marker_lines')
        self.marker_line_labels = as_strings('marker_line_labels')

        d['metrics'] = [
            self.metric,
        ]
        if not self.metric:
            raise Exception(_('Pick a metric to display'))
        return d

    def get_data(self, df):
        df = df.fillna(0)
        df['metric'] = df[[self.metric]]
        values = df['metric'].values
        return {
            'measures': values.tolist(),
            'ranges': self.ranges or [0, values.max() * 1.1],
            'rangeLabels': self.range_labels or None,
            'markers': self.markers or None,
            'markerLabels': self.marker_labels or None,
            'markerLines': self.marker_lines or None,
            'markerLineLabels': self.marker_line_labels or None,
        }


class BigNumberViz(BaseViz):
    """Put emphasis on a single metric with this big number viz"""

    viz_type = 'big_number'
    verbose_name = _('Big Number with Trendline')
    credits = 'a <a href="https://github.com/airbnb/superset">Superset</a> original'
    is_timeseries = True

    def query_obj(self):
        d = super(BigNumberViz, self).query_obj()
        metric = self.form_data.get('metric')
        if not metric:
            raise Exception(_('Pick a metric!'))
        d['metrics'] = [self.form_data.get('metric')]
        self.form_data['metric'] = metric
        return d

    def get_data(self, df):
        form_data = self.form_data
        df.sort_values(by=df.columns[0], inplace=True)
        compare_lag = form_data.get('compare_lag')
        return {
            'data': df.values.tolist(),
            'compare_lag': compare_lag,
            'compare_suffix': form_data.get('compare_suffix', ''),
        }


class BigNumberTotalViz(BaseViz):
    """Put emphasis on a single metric with this big number viz"""

    viz_type = 'big_number_total'
    verbose_name = _('Big Number')
    credits = 'a <a href="https://github.com/airbnb/superset">Superset</a> original'
    is_timeseries = False

    def query_obj(self):
        d = super(BigNumberTotalViz, self).query_obj()
        metric = self.form_data.get('metric')
        if not metric:
            raise Exception(_('Pick a metric!'))
        d['metrics'] = [self.form_data.get('metric')]
        self.form_data['metric'] = metric
        return d

    def get_data(self, df):
        form_data = self.form_data
        df.sort_values(by=df.columns[0], inplace=True)
        return {
            'data': df.values.tolist(),
            'subheader': form_data.get('subheader', ''),
        }


class NVD3TimeSeriesViz(NVD3Viz):
    """A rich line chart component with tons of options"""

    viz_type = 'line'
    verbose_name = _('Time Series - Line Chart')
    sort_series = False
    is_timeseries = True

    def to_series(self, df, classed='', title_suffix=''):
        cols = []
        for col in df.columns:
            if col == '':
                cols.append('N/A')
            elif col is None:
                cols.append('NULL')
            else:
                cols.append(col)
        df.columns = cols
        series = df.to_dict('series')

        chart_data = []
        for name in df.T.index.tolist():
            ys = series[name]
            if df[name].dtype.kind not in 'biufc':
                continue
            if isinstance(name, list):
                series_title = [str(title) for title in name]
            elif isinstance(name, tuple):
                series_title = tuple(str(title) for title in name)
            else:
                series_title = str(name)
            if (
                    isinstance(series_title, (list, tuple)) and
                    len(series_title) > 1 and
                    len(self.metrics) == 1):
                # Removing metric from series name if only one metric
                series_title = series_title[1:]
            if title_suffix:
                if isinstance(series_title, string_types):
                    series_title = (series_title, title_suffix)
                elif isinstance(series_title, (list, tuple)):
                    series_title = series_title + (title_suffix,)

            values = []
            # for ds in df.index:
            for index, ds in enumerate(df.index):
                if ds in ys:
                    d = {
                        'x': ds,
                        'y': ys[ds],
                        'i': index
                    }
                else:
                    continue
                values.append(d)

            series_dict = {
                'key': series_title,
                'values': values,
            }
            if classed:
                series_dict['classed'] = classed
            chart_data.append(series_dict)
        return chart_data

    def process_data(self, df, aggregate=False):
        fd = self.form_data
        df = df.fillna(0)
        if fd.get('granularity') == 'all':
            raise Exception(_('Pick a time granularity for your time series'))
        if not aggregate:
            df = df.pivot_table(
                index=DTTM_ALIAS,
                columns=fd.get('groupby'),
                values=utils.get_metric_names(fd.get('metrics')))
        else:
            df = df.pivot_table(
                index=DTTM_ALIAS,
                columns=fd.get('groupby'),
                values=utils.get_metric_names(fd.get('metrics')),
                fill_value=0,
                aggfunc=sum)

        if fd.get('remove_space'):
            df.fillna(method="ffill", axis=0, inplace=True)
        fm = fd.get('resample_fillmethod')
        if not fm:
            fm = None
        how = fd.get('resample_how')
        rule = fd.get('resample_rule')
        if how and rule:
            df = df.resample(rule).agg(how)
            if fm:
                df = df.ffill() if fm in ('ffill', 'pad') else df.bfill()
            if not fm:
                df = df.fillna(0)

        if self.sort_series:
            dfs = df.sum()
            dfs.sort_values(ascending=False, inplace=True)
            df = df[dfs.index]

        if fd.get('contribution'):
            dft = df.T
            df = (dft / dft.sum()).T

        rolling_type = fd.get('rolling_type')
        rolling_periods = int(fd.get('rolling_periods') or 0)
        min_periods = int(fd.get('min_periods') or 0)

        if rolling_type in ('mean', 'std', 'sum') and rolling_periods:
            rolling = df.rolling(
                window=rolling_periods,
                min_periods=min_periods)
            if rolling_type == 'mean':
                df = rolling.mean()
            elif rolling_type == 'std':
                df = rolling.std()
            elif rolling_type == 'sum':
                df = rolling.sum()
        elif rolling_type == 'cumsum':
            df = df.cumsum()
        if min_periods:
            df = df[min_periods:]

        num_period_compare = fd.get('num_period_compare')
        if num_period_compare:
            num_period_compare = int(num_period_compare)
            prt = fd.get('period_ratio_type')
            if prt and prt == 'growth':
                df = (df / df.shift(num_period_compare)) - 1
            elif prt and prt == 'value':
                df = df - df.shift(num_period_compare)
            else:
                df = df / df.shift(num_period_compare)

            df = df[num_period_compare:]
        if fd.get('compare_lag') and fd.get('list_ratio_type'):
            df = df.iloc[-int(fd.get('compare_lag')):]
        return df

    def run_extra_queries(self):
        fd = self.form_data
        time_compare = fd.get('time_compare')
        if time_compare:
            query_object = self.query_obj()
            delta = utils.parse_human_timedelta(time_compare)
            query_object['inner_from_dttm'] = query_object['from_dttm']
            query_object['inner_to_dttm'] = query_object['to_dttm']

            if not query_object['from_dttm'] or not query_object['to_dttm']:
                raise Exception(_(
                    '`Since` and `Until` time bounds should be specified '
                    'when using the `Time Shift` feature.'))
            query_object['from_dttm'] -= delta
            query_object['to_dttm'] -= delta

            df2 = self.get_df_payload(query_object).get('df')
            if df2 is not None:
                df2[DTTM_ALIAS] += delta
                df2 = self.process_data(df2)
                self._extra_chart_data = self.to_series(
                    df2, classed='superset', title_suffix='---')

    def get_data(self, df):
        df = self.process_data(df)
        if self.viz_type == 'line' and self.form_data.get('compare_lag'):
            df = df.fillna(method='ffill').fillna(method='bfill')
        chart_data = self.to_series(df)
        if self._extra_chart_data:
            chart_data += self._extra_chart_data
            chart_data = sorted(chart_data, key=lambda x: tuple(x['key']))

        return chart_data


class NVD3DualLineViz(NVD3Viz):
    """A rich line chart with dual axis"""

    viz_type = 'dual_line'
    verbose_name = _('Time Series - Dual Axis Line Chart')
    sort_series = False
    is_timeseries = True

    def query_obj(self):
        d = super(NVD3DualLineViz, self).query_obj()
        m1 = self.form_data.get('metric')
        m2 = self.form_data.get('metric_2')
        d['metrics'] = [m1, m2]
        if not m1:
            raise Exception(_('Pick a metric for left axis!'))
        if not m2:
            raise Exception(_('Pick a metric for right axis!'))
        if m1 == m2:
            raise Exception(_('Please choose different metrics'
                              ' on left and right axis'))
        return d

    def to_series(self, df, classed=''):
        cols = []
        for col in df.columns:
            if col == '':
                cols.append('N/A')
            elif col is None:
                cols.append('NULL')
            else:
                cols.append(col)
        df.columns = cols
        series = df.to_dict('series')
        chart_data = []
        metric = self.form_data.get('metric')
        # 如果metric是dict类型，取出其中叫label的key的值
        if isinstance(metric, dict):
            metric = metric.get('label')
        metrics = [
            metric,
            self.form_data.get('metric_2'),
        ]
        for i, m in enumerate(metrics):
            ys = series[m]
            if df[m].dtype.kind not in 'biufc':
                continue
            series_title = m
            d = {
                'key': series_title,
                'classed': classed,
                'values': [
                    {'x': ds, 'y': ys[ds] if ds in ys else None}
                    for ds in df.index
                ],
                'yAxis': i + 1,
                'type': 'line',
            }
            chart_data.append(d)
        return chart_data

    def get_data(self, df):
        fd = self.form_data
        df = df.fillna(0)

        if self.form_data.get('granularity') == 'all':
            raise Exception(_('Pick a time granularity for your time series'))

        metric = fd.get('metric')
        if isinstance(metric, dict):
            metric = metric.get('label')
        metric_2 = fd.get('metric_2')
        df = df.pivot_table(
            index=DTTM_ALIAS,
            values=[metric, metric_2])

        chart_data = self.to_series(df)
        return chart_data


class NVD3TimeSeriesBarViz(NVD3TimeSeriesViz):
    """A bar chart where the x axis is time"""

    viz_type = 'bar'
    # sort_series = True
    sort_series = False
    verbose_name = _('Time Series - Bar Chart')

    def get_data(self, df):
        df = self.process_data(df)
        fd = self.form_data
        loc_dict = {"df": df}
        if fd.get('exec_code'):
            exec_code_str = fd.get('exec_code')
            regex_exec_code = re.compile(re.escape('execute'), re.IGNORECASE)
            exec_code_str = regex_exec_code.sub("", exec_code_str)
            regex_exec_code = re.compile(re.escape('to_sql'), re.IGNORECASE)
            exec_code_str = regex_exec_code.sub("", exec_code_str)
            regex_exec_code = re.compile(re.escape('read_sql'), re.IGNORECASE)
            exec_code_str = regex_exec_code.sub("", exec_code_str)
            exec(exec_code_str, globals(), loc_dict)
            df = loc_dict['df']
        chart_data = self.to_series(df)
        if self._extra_chart_data:
            chart_data += self._extra_chart_data
            chart_data = sorted(chart_data, key=lambda x: tuple(x['key']))

        return chart_data


class NVD3TimePivotViz(NVD3TimeSeriesViz):
    """Time Series - Periodicity Pivot"""

    viz_type = 'time_pivot'
    sort_series = True
    verbose_name = _('Time Series - Period Pivot')

    def query_obj(self):
        d = super(NVD3TimePivotViz, self).query_obj()
        d['metrics'] = [self.form_data.get('metric')]
        return d

    def get_data(self, df):
        fd = self.form_data
        df = self.process_data(df)
        freq = to_offset(fd.get('freq'))
        freq.normalize = True
        df[DTTM_ALIAS] = df.index.map(freq.rollback)
        df['ranked'] = df[DTTM_ALIAS].rank(method='dense', ascending=False) - 1
        df.ranked = df.ranked.map(int)
        df['series'] = '-' + df.ranked.map(str)
        df['series'] = df['series'].str.replace('-0', 'current')
        rank_lookup = {
            row['series']: row['ranked']
            for row in df.to_dict(orient='records')
        }
        max_ts = df[DTTM_ALIAS].max()
        max_rank = df['ranked'].max()
        df[DTTM_ALIAS] = df.index + (max_ts - df[DTTM_ALIAS])
        df = df.pivot_table(
            index=DTTM_ALIAS,
            columns='series',
            values=fd.get('metric'))
        chart_data = self.to_series(df)
        for serie in chart_data:
            serie['rank'] = rank_lookup[serie['key']]
            serie['perc'] = 1 - (serie['rank'] / (max_rank + 1))
        return chart_data


class NVD3CompareTimeSeriesViz(NVD3TimeSeriesViz):
    """A line chart component where you can compare the % change over time"""

    viz_type = 'compare'
    verbose_name = _('Time Series - Percent Change')


class NVD3TimeSeriesStackedViz(NVD3TimeSeriesViz):
    """A rich stack area chart"""

    viz_type = 'area'
    verbose_name = _('Time Series - Stacked')
    sort_series = True

    def process_data(self, df, aggregate=False):
        fd = self.form_data
        df = df.fillna(0)
        if fd.get('granularity') == 'all':
            raise Exception(_('Pick a time granularity for your time series'))
        if not aggregate:
            df = df.pivot_table(
                index=DTTM_ALIAS,
                columns=fd.get('groupby'),
                values=utils.get_metric_names(fd.get('metrics')))
        else:
            df = df.pivot_table(
                index=DTTM_ALIAS,
                columns=fd.get('groupby'),
                values=utils.get_metric_names(fd.get('metrics')),
                fill_value=0,
                aggfunc=sum)

        if fd.get('remove_space'):
            df.fillna(method="ffill", axis=0, inplace=True)
        fm = fd.get('resample_fillmethod')
        if not fm:
            fm = None
        how = fd.get('resample_how')
        rule = fd.get('resample_rule')
        if how and rule:
            df = df.resample(rule).agg(how)
            if fm:
                df = df.ffill() if fm in ('ffill', 'pad') else df.bfill()
            if not fm:
                df = df.fillna(0)

        if self.sort_series:
            dfs = df.sum()
            dfs.sort_values(ascending=False, inplace=True)
            df = df[dfs.index]

        if fd.get('contribution'):
            dft = df.T
            df = (dft / dft.sum()).T

        rolling_type = fd.get('rolling_type')
        rolling_periods = int(fd.get('rolling_periods') or 0)
        min_periods = int(fd.get('min_periods') or 0)

        if rolling_type in ('mean', 'std', 'sum') and rolling_periods:
            rolling = df.rolling(
                window=rolling_periods,
                min_periods=min_periods)
            if rolling_type == 'mean':
                df = rolling.mean()
            elif rolling_type == 'std':
                df = rolling.std()
            elif rolling_type == 'sum':
                df = rolling.sum()
        elif rolling_type == 'cumsum':
            df = df.cumsum()
        if min_periods:
            df = df[min_periods:]

        num_period_compare = fd.get('num_period_compare')
        if num_period_compare:
            num_period_compare = int(num_period_compare)
            prt = fd.get('period_ratio_type')
            if prt and prt == 'growth':
                df = (df / df.shift(num_period_compare)) - 1
            elif prt and prt == 'value':
                df = df - df.shift(num_period_compare)
            else:
                df = df / df.shift(num_period_compare)

            df = df[num_period_compare:]
        if fd.get('compare_lag') and fd.get('list_ratio_type'):
            df = df.iloc[-int(fd.get('compare_lag')):]
        # df = df.sub(df.iloc[0])
        return df


class DistributionPieViz(NVD3Viz):
    """Annoy visualization snobs with this controversial pie chart"""

    viz_type = 'pie'
    verbose_name = _('Distribution - NVD3 - Pie Chart')
    is_timeseries = False

    def get_data(self, df):
        fd = self.form_data
        df = df.pivot_table(
            index=self.groupby,
            values=[self.metrics[0]])
        df.sort_values(by=self.metrics[0], ascending=False, inplace=True)
        df = df.reset_index()
        if fd.get('pie_others') and int(fd.get('pie_others')) > 0:
            df_head = df.head(int(fd.get('pie_others'))).copy()
            # df_head = df_head.append([['others', df.iloc[int(fd.get('pie_others')):][self.metrics[0]].sum()]], ignore_index=True)
            df_head.loc['others'] = ['others', df.iloc[int(fd.get('pie_others')):][self.metrics[0]].sum()]
            df = df_head
        df.columns = ['x', 'y']
        return df.to_dict(orient='records')


class HistogramViz(BaseViz):
    """Histogram"""

    viz_type = 'histogram'
    verbose_name = _('Histogram')
    is_timeseries = False

    def query_obj(self):
        """Returns the query object for this visualization"""
        d = super(HistogramViz, self).query_obj()
        d['row_limit'] = self.form_data.get(
            'row_limit', int(config.get('VIZ_ROW_LIMIT')))
        numeric_columns = self.form_data.get('all_columns_x')
        if numeric_columns is None:
            raise Exception(_('Must have at least one numeric column specified'))
        self.columns = numeric_columns
        d['columns'] = numeric_columns + self.groupby
        # override groupby entry to avoid aggregation
        d['groupby'] = []
        granularity = (
                self.form_data.get('granularity') or
                self.form_data.get('granularity_sqla')
        )
        if granularity:
            d['orderby'] = [(granularity, True)]
        return d

    def get_data(self, df):
        """Returns the chart data"""
        chart_data = []
        if len(self.groupby) > 0:
            groups = df.groupby(self.groupby)
        else:
            groups = [((), df)]
        for keys, data in groups:
            if isinstance(keys, str):
                keys = (keys,)
            # removing undesirable characters
            keys = [re.sub(r'\W+', r'_', k) for k in keys]
            chart_data.extend([{
                'key': '__'.join([c] + keys),
                'values': data[c].tolist()}
                for c in self.columns])
        data_dict = {obj['key']: obj['values'] for obj in chart_data}
        dt = pd.DataFrame(data_dict)
        dt = dt.quantile([.25, .5, .75])
        extra_data = dt.to_dict()
        for obj in chart_data:
            extra_data[obj['key']]['last'] = obj['values'][-1]
        return {'extra_data': extra_data, 'data': chart_data}


class DistributionBarViz(DistributionPieViz):
    """A good old bar chart"""

    viz_type = 'dist_bar'
    verbose_name = _('Distribution - Bar Chart')
    is_timeseries = False

    def query_obj(self):
        d = super(DistributionBarViz, self).query_obj()  # noqa
        fd = self.form_data
        if (
                len(d['groupby']) <
                len(fd.get('groupby') or []) + len(fd.get('columns') or [])
        ):
            raise Exception(
                _("Can't have overlap between Series and Breakdowns"))
        if not fd.get('metrics'):
            raise Exception(_('Pick at least one metric'))
        if not fd.get('groupby'):
            raise Exception(_('Pick at least one field for [Series]'))
        return d

    def get_data(self, df):
        fd = self.form_data

        # Only sum the metric. Breakdown columns such as MSSQL DATE values are
        # datetime.date on Linux (pymssql) but str on Windows; summing the whole
        # frame raises TypeError: datetime.date + datetime.date.
        row = df.groupby(self.groupby)[self.metrics[0]].sum().copy()
        row.sort_values(ascending=False, inplace=True)
        columns = fd.get('columns') or []
        index_order = fd.get('index_order')
        pt = df.pivot_table(
            index=self.groupby,
            columns=columns,
            values=self.metrics)
        if fd.get('contribution'):
            pt = pt.fillna(0)
            pt = pt.T
            pt = (pt / pt.sum()).T
        pt = pt.reindex(row.index)
        if len(index_order):
            index_order_list = index_order.split('|')
            index_order_list = [x for x in index_order_list if x in row.index]
            other_index = [x for x in row.index if x not in index_order_list]
            pt = pt.reindex(index_order_list + other_index)
        # pt = pt.reindex(['Vietnam'])
        chart_data = []
        for name, ys in pt.items():
            if pt[name].dtype.kind not in 'biufc' or name in self.groupby:
                continue
            if isinstance(name, string_types):
                series_title = name
            elif len(self.metrics) > 1:
                series_title = ', '.join(name)
            else:
                l = [str(s) for s in name[1:]]  # noqa: E741
                series_title = ', '.join(l)
            values = []
            for i, v in ys.items():
                x = i
                if isinstance(x, (tuple, list)):
                    x = ', '.join([text_type(s) for s in x])
                else:
                    x = text_type(x)
                values.append({
                    'x': x,
                    'y': v,
                })
            d = {
                'key': series_title,
                'values': values,
            }
            chart_data.append(d)
        return chart_data


class SunburstViz(BaseViz):
    """A multi level sunburst chart"""

    viz_type = 'sunburst'
    verbose_name = _('Sunburst')
    is_timeseries = False
    credits = (
        'Kerry Rodden '
        '@<a href="https://bl.ocks.org/kerryrodden/7090426">bl.ocks.org</a>')

    def get_data(self, df):
        fd = self.form_data
        cols = fd.get('groupby')
        metric = fd.get('metric')
        secondary_metric = fd.get('secondary_metric')
        if metric == secondary_metric or secondary_metric is None:
            df.columns = cols + ['m1']
            df['m2'] = df['m1']
        return json.loads(df.to_json(orient='values'))

    def query_obj(self):
        qry = super(SunburstViz, self).query_obj()
        fd = self.form_data
        qry['metrics'] = [fd['metric']]
        secondary_metric = fd.get('secondary_metric')
        if secondary_metric and secondary_metric != fd['metric']:
            qry['metrics'].append(secondary_metric)
        return qry


class SankeyViz(BaseViz):
    """A Sankey diagram that requires a parent-child dataset"""

    viz_type = 'sankey'
    verbose_name = _('Sankey')
    is_timeseries = False
    credits = '<a href="https://www.npmjs.com/package/d3-sankey">d3-sankey on npm</a>'

    def query_obj(self):
        qry = super(SankeyViz, self).query_obj()
        if len(qry['groupby']) != 2:
            raise Exception(_('Pick exactly 2 columns as [Source / Target]'))
        qry['metrics'] = [
            self.form_data['metric']]
        return qry

    def get_data(self, df):
        df.columns = ['source', 'target', 'value']
        recs = df.to_dict(orient='records')

        hierarchy = defaultdict(set)
        for row in recs:
            hierarchy[row['source']].add(row['target'])

        def find_cycle(g):
            """Whether there's a cycle in a directed graph"""
            path = set()

            def visit(vertex):
                path.add(vertex)
                for neighbour in g.get(vertex, ()):
                    if neighbour in path or visit(neighbour):
                        return (vertex, neighbour)
                path.remove(vertex)

            for v in g:
                cycle = visit(v)
                if cycle:
                    return cycle

        cycle = find_cycle(hierarchy)
        if cycle:
            raise Exception(_(
                "There's a loop in your Sankey, please provide a tree. "
                "Here's a faulty link: {}").format(cycle))
        return recs


class DirectedForceViz(BaseViz):
    """An animated directed force layout graph visualization"""

    viz_type = 'directed_force'
    verbose_name = _('Directed Force Layout')
    credits = 'd3noob @<a href="http://bl.ocks.org/d3noob/5141278">bl.ocks.org</a>'
    is_timeseries = False

    def query_obj(self):
        qry = super(DirectedForceViz, self).query_obj()
        if len(self.form_data['groupby']) != 2:
            raise Exception(_("Pick exactly 2 columns to 'Group By'"))
        qry['metrics'] = [self.form_data['metric']]
        return qry

    def get_data(self, df):
        df.columns = ['source', 'target', 'value']
        return df.to_dict(orient='records')


class ChordViz(BaseViz):
    """A Chord diagram"""

    viz_type = 'chord'
    verbose_name = _('Directed Force Layout')
    credits = '<a href="https://github.com/d3/d3-chord">Bostock</a>'
    is_timeseries = False

    def query_obj(self):
        qry = super(ChordViz, self).query_obj()
        fd = self.form_data
        qry['groupby'] = [fd.get('groupby'), fd.get('columns')]
        qry['metrics'] = [fd.get('metric')]
        return qry

    def get_data(self, df):
        df.columns = ['source', 'target', 'value']

        # Preparing a symetrical matrix like d3.chords calls for
        nodes = list(set(df['source']) | set(df['target']))
        matrix = {}
        for source, target in product(nodes, nodes):
            matrix[(source, target)] = 0
        for source, target, value in df.to_records(index=False):
            matrix[(source, target)] = value
        m = [[matrix[(n1, n2)] for n1 in nodes] for n2 in nodes]
        return {
            'nodes': list(nodes),
            'matrix': m,
        }


class CountryMapViz(BaseViz):
    """A country centric"""

    viz_type = 'country_map'
    verbose_name = _('Country Map')
    is_timeseries = False
    credits = 'From bl.ocks.org By john-guerra'

    def query_obj(self):
        qry = super(CountryMapViz, self).query_obj()
        qry['metrics'] = [
            self.form_data['metric']]
        qry['groupby'] = [self.form_data['entity']]
        return qry

    def get_data(self, df):
        fd = self.form_data
        cols = [fd.get('entity')]
        metric = fd.get('metric')
        cols += [metric]
        ndf = df[cols]
        df = ndf
        df.columns = ['country_id', 'metric']
        d = df.to_dict(orient='records')
        return d


class WorldMapViz(BaseViz):
    """A country centric world map"""

    viz_type = 'world_map'
    verbose_name = _('World Map')
    is_timeseries = False
    credits = 'datamaps on <a href="https://www.npmjs.com/package/datamaps">npm</a>'

    def query_obj(self):
        qry = super(WorldMapViz, self).query_obj()
        qry['metrics'] = [
            self.form_data['metric'], self.form_data['secondary_metric']]
        qry['groupby'] = [self.form_data['entity']]
        return qry

    def get_data(self, df):
        from superset.data import countries
        fd = self.form_data
        cols = [fd.get('entity')]
        metric = fd.get('metric')
        secondary_metric = fd.get('secondary_metric')
        if metric == secondary_metric:
            ndf = df[cols]
            # df[metric] will be a DataFrame
            # because there are duplicate column names
            ndf['m1'] = df[metric].iloc[:, 0]
            ndf['m2'] = ndf['m1']
        else:
            cols += [metric, secondary_metric]
            ndf = df[cols]
        df = ndf
        df.columns = ['country', 'm1', 'm2']
        d = df.to_dict(orient='records')
        for row in d:
            country = None
            if isinstance(row['country'], string_types):
                country = countries.get(
                    fd.get('country_fieldtype'), row['country'])

            if country:
                row['country'] = country['cca3']
                row['latitude'] = country['lat']
                row['longitude'] = country['lng']
                row['name'] = country['name']
            else:
                row['country'] = 'XXX'
        return d


class FilterBoxViz(BaseViz):
    """A multi filter, multi-choice filter box to make dashboards interactive"""

    viz_type = 'filter_box'
    verbose_name = _('Filters')
    is_timeseries = False
    credits = 'a <a href="https://github.com/airbnb/superset">Superset</a> original'
    cache_type = 'get_data'

    def query_obj(self):
        return None

    def run_extra_queries(self):
        qry = self.filter_query_obj()
        filters = [g for g in self.form_data['groupby']]
        self.dataframes = {}
        for flt in filters:
            qry['groupby'] = [flt]
            df = self.get_df_payload(query_obj=qry).get('df')
            self.dataframes[flt] = df

    def filter_query_obj(self):
        qry = super(FilterBoxViz, self).query_obj()
        groupby = self.form_data.get('groupby')
        if len(groupby) < 1 and not self.form_data.get('date_filter'):
            raise Exception(_('Pick at least one filter field'))
        qry['metrics'] = [
            self.form_data['metric']]
        return qry

    def get_data(self, df):
        d = {}
        fd = self.form_data
        filters = [g for g in fd['groupby']]
        for flt in filters:
            df = self.dataframes[flt]
            d[flt] = [{
                'id': row[0],
                'text': row[0],
                'filter': flt,
                'metric': row[1]}
                for row in df.itertuples(index=False)
            ]
        if fd.get('index_tree_source'):
            index_tree_source = json.loads(fd.get('index_tree_source'))
            sql_query = "select %s as 指标名称, %s as 栏目类别 from %s " \
                        % (index_tree_source.get('indexnamefield'),
                           index_tree_source.get('typefield'),
                           index_tree_source.get('datasource'))
            engine = self.datasource.database.get_sqla_engine()
            df_index = pd.read_sql(sql_query, con=engine)
            df_index = df_index.dropna(subset=['指标名称'])
            df_index['栏目类别'] = df_index['栏目类别'].fillna('未分类')
            # 排除未分类的指标
            df_index = df_index[df_index['栏目类别'] != '未分类']
            df_index = df_index.drop_duplicates(subset=['指标名称'])
            node_list = []
            for _, row in df_index.iterrows():
                categories = row['栏目类别'].split('|')
                current_level = node_list
                for category in categories:
                    existing_category = next((c for c in current_level if c['name'] == category), None)
                    if existing_category:
                        current_level = existing_category['children']
                    else:
                        new_category = {'name': category, 'children': []}
                        current_level.append(new_category)
                        current_level = new_category['children']
                current_level.append({'name': row['指标名称']})
            if len(node_list):
                tree_node_dict = {"name": "目录", "children": node_list, "toggled": True}
                if fd.get('tree_order_dict'):
                    tree_order_dict = eval(fd.get('tree_order_dict'))
                    for k, v in tree_order_dict.items():
                        node = utils.get_child_node(k, [tree_node_dict])
                        print(k, '--', v, '--', node)
                        # 倒序遍历v,将v中对应的node list中的节点放到node_list的最前面
                        if node and len(node):
                            for i in v[::-1]:
                                for j in node:
                                    if j['name'] == i:
                                        node.insert(0, node.pop(node.index(j)))
                                        break
                d['tree_node_dict'] = tree_node_dict
        return d
    

class FilterBoxMinViz(BaseViz):
    """A filter, single-choice filter box to make dashboards interactive"""

    viz_type = 'filter_box_min'
    verbose_name = _('Filters Min')
    is_timeseries = False
    credits = ''
    cache_type = 'get_data'

    def query_obj(self):
        return None

    def run_extra_queries(self):
        qry = self.filter_query_obj()
        filters = [g for g in self.form_data['groupby']]
        self.dataframes = {}
        for flt in filters:
            qry['groupby'] = [flt]
            df = self.get_df_payload(query_obj=qry).get('df')
            self.dataframes[flt] = df

    def filter_query_obj(self):
        qry = super(FilterBoxMinViz, self).query_obj()
        groupby = self.form_data.get('groupby')
        if len(groupby) < 1 and not self.form_data.get('date_filter'):
            raise Exception(_('Pick at least one filter field'))
        qry['metrics'] = [
            self.form_data['metric']]
        return qry


    def get_data(self, df):
        d = {}
        fd = self.form_data
        filters = [g for g in fd['groupby']]
        for flt in filters:
            df = self.dataframes[flt]
            d[flt] = [{
                'id': row[0],
                'text': row[0],
                'filter': flt,
                'metric': row[1]}
                for row in df.itertuples(index=False)
            ]
        return d


class IFrameViz(BaseViz):
    """You can squeeze just about anything in this iFrame component"""

    viz_type = 'iframe'
    verbose_name = _('iFrame')
    credits = 'a <a href="https://github.com/airbnb/superset">Superset</a> original'
    is_timeseries = False

    def query_obj(self):
        return None

    def get_df(self, query_obj=None):
        return None

    def build_iframe_access_token(self, config, iframe_app_name):
        """勾选 iframe_by_token 时，加密当前秒的访问凭证。"""
        plain_text = json.dumps(
            {
                'app': iframe_app_name,
                'issuance_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            },
            separators=(', ', ':'),
        )
        return aes_encrypt(plain_text, config)

    def get_data(self, df):
        fd = self.form_data
        if fd.get('iframe_by_token') and fd.get('iframe_app_name'):
            token = self.build_iframe_access_token(
                config,
                fd.get('iframe_app_name'),
            )
            return {'iframe_token': token}
        return None


class ParallelCoordinatesViz(BaseViz):
    """Interactive parallel coordinate implementation

    Uses this amazing javascript library
    https://github.com/syntagmatic/parallel-coordinates
    """

    viz_type = 'para'
    verbose_name = _('Parallel Coordinates')
    credits = (
        '<a href="https://syntagmatic.github.io/parallel-coordinates/">'
        "Syntagmatic's library</a>")
    is_timeseries = False

    def query_obj(self):
        d = super(ParallelCoordinatesViz, self).query_obj()
        fd = self.form_data
        d['metrics'] = copy.copy(fd.get('metrics'))
        second = fd.get('secondary_metric')
        if second not in d['metrics']:
            d['metrics'] += [second]
        d['groupby'] = [fd.get('series')]
        return d

    def get_data(self, df):
        return df.to_dict(orient='records')


class HeatmapViz(BaseViz):
    """A nice heatmap visualization that support high density through canvas"""

    viz_type = 'heatmap'
    verbose_name = _('Heatmap')
    is_timeseries = False
    credits = (
        'inspired from mbostock @<a href="http://bl.ocks.org/mbostock/3074470">'
        'bl.ocks.org</a>')

    def query_obj(self):
        d = super(HeatmapViz, self).query_obj()
        fd = self.form_data
        d['metrics'] = [fd.get('metric')]
        d['groupby'] = [fd.get('all_columns_x'), fd.get('all_columns_y')]
        return d

    def get_data(self, df):
        fd = self.form_data
        x = fd.get('all_columns_x')
        y = fd.get('all_columns_y')
        v = fd.get('metric')
        if x == y:
            df.columns = ['x', 'y', 'v']
        else:
            df = df[[x, y, v]]
            df.columns = ['x', 'y', 'v']
        norm = fd.get('normalize_across')
        overall = False
        max_ = df.v.max()
        min_ = df.v.min()
        bounds = fd.get('y_axis_bounds')
        if bounds and bounds[0] is not None:
            min_ = bounds[0]
        if bounds and bounds[1] is not None:
            max_ = bounds[1]
        if norm == 'heatmap':
            overall = True
        else:
            gb = df.groupby(norm, group_keys=False)
            if len(gb) <= 1:
                overall = True
            else:
                df['perc'] = (
                    gb.apply(
                        lambda x: (x.v - x.v.min()) / (x.v.max() - x.v.min()))
                )
        if overall:
            df['perc'] = (df.v - min_) / (max_ - min_)
        return {
            'records': df.to_dict(orient='records'),
            'extents': [min_, max_],
        }


class HorizonViz(NVD3TimeSeriesViz):
    """Horizon chart

    https://www.npmjs.com/package/d3-horizon-chart
    """

    viz_type = 'horizon'
    verbose_name = _('Horizon Charts')
    credits = (
        '<a href="https://www.npmjs.com/package/d3-horizon-chart">'
        'd3-horizon-chart</a>')


class MapboxViz(BaseViz):
    """Rich maps made with Mapbox"""

    viz_type = 'mapbox'
    verbose_name = _('Mapbox')
    is_timeseries = False
    credits = (
        '<a href=https://www.mapbox.com/mapbox-gl-js/api/>Mapbox GL JS</a>')

    def query_obj(self):
        d = super(MapboxViz, self).query_obj()
        fd = self.form_data
        label_col = fd.get('mapbox_label')

        if not fd.get('groupby'):
            d['columns'] = [fd.get('all_columns_x'), fd.get('all_columns_y')]

            if label_col and len(label_col) >= 1:
                if label_col[0] == 'count':
                    raise Exception(_(
                        "Must have a [Group By] column to have 'count' as the [Label]"))
                d['columns'].append(label_col[0])

            if fd.get('point_radius') != 'Auto':
                d['columns'].append(fd.get('point_radius'))

            d['columns'] = list(set(d['columns']))
        else:
            # Ensuring columns chosen are all in group by
            if (label_col and len(label_col) >= 1 and
                    label_col[0] != 'count' and
                    label_col[0] not in fd.get('groupby')):
                raise Exception(_(
                    'Choice of [Label] must be present in [Group By]'))

            if (fd.get('point_radius') != 'Auto' and
                    fd.get('point_radius') not in fd.get('groupby')):
                raise Exception(_(
                    'Choice of [Point Radius] must be present in [Group By]'))

            if (fd.get('all_columns_x') not in fd.get('groupby') or
                    fd.get('all_columns_y') not in fd.get('groupby')):
                raise Exception(_(
                    '[Longitude] and [Latitude] columns must be present in [Group By]'))
        return d

    def get_data(self, df):
        if df is None:
            return None
        fd = self.form_data
        label_col = fd.get('mapbox_label')
        custom_metric = label_col and len(label_col) >= 1
        metric_col = [None] * len(df.index)
        if custom_metric:
            if label_col[0] == fd.get('all_columns_x'):
                metric_col = df[fd.get('all_columns_x')]
            elif label_col[0] == fd.get('all_columns_y'):
                metric_col = df[fd.get('all_columns_y')]
            else:
                metric_col = df[label_col[0]]
        point_radius_col = (
            [None] * len(df.index)
            if fd.get('point_radius') == 'Auto'
            else df[fd.get('point_radius')])

        # using geoJSON formatting
        geo_json = {
            'type': 'FeatureCollection',
            'features': [
                {
                    'type': 'Feature',
                    'properties': {
                        'metric': metric,
                        'radius': point_radius,
                    },
                    'geometry': {
                        'type': 'Point',
                        'coordinates': [lon, lat],
                    },
                }
                for lon, lat, metric, point_radius
                in zip(
                    df[fd.get('all_columns_x')],
                    df[fd.get('all_columns_y')],
                    metric_col, point_radius_col)
            ],
        }

        return {
            'geoJSON': geo_json,
            'customMetric': custom_metric,
            'mapboxApiKey': config.get('MAPBOX_API_KEY'),
            'mapStyle': fd.get('mapbox_style'),
            'aggregatorName': fd.get('pandas_aggfunc'),
            'clusteringRadius': fd.get('clustering_radius'),
            'pointRadiusUnit': fd.get('point_radius_unit'),
            'globalOpacity': fd.get('global_opacity'),
            'viewportLongitude': fd.get('viewport_longitude'),
            'viewportLatitude': fd.get('viewport_latitude'),
            'viewportZoom': fd.get('viewport_zoom'),
            'renderWhileDragging': fd.get('render_while_dragging'),
            'tooltip': fd.get('rich_tooltip'),
            'color': fd.get('mapbox_color'),
        }


class DeckGLMultiLayer(BaseViz):
    """Pile on multiple DeckGL layers"""

    viz_type = 'deck_multi'
    verbose_name = _('Deck.gl - Multiple Layers')

    is_timeseries = False
    credits = '<a href="https://uber.github.io/deck.gl/">deck.gl</a>'

    def query_obj(self):
        return None

    def get_data(self, df):
        fd = self.form_data
        # Late imports to avoid circular import issues
        from superset.models.core import Slice
        from superset import db
        slice_ids = fd.get('deck_slices')
        slices = db.session.query(Slice).filter(Slice.id.in_(slice_ids)).all()
        return {
            'mapboxApiKey': config.get('MAPBOX_API_KEY'),
            'slices': [slc.data for slc in slices],
        }


class BaseDeckGLViz(BaseViz):
    """Base class for deck.gl visualizations"""

    is_timeseries = False
    credits = '<a href="https://uber.github.io/deck.gl/">deck.gl</a>'
    spatial_control_keys = []

    def get_metrics(self):
        self.metric = self.form_data.get('size')
        return [self.metric] if self.metric else []

    def process_spatial_query_obj(self, key, group_by):
        spatial = self.form_data.get(key)
        if spatial is None:
            raise ValueError(_('Bad spatial key'))

        if spatial.get('type') == 'latlong':
            group_by += [spatial.get('lonCol')]
            group_by += [spatial.get('latCol')]
        elif spatial.get('type') == 'delimited':
            group_by += [spatial.get('lonlatCol')]
        elif spatial.get('type') == 'geohash':
            group_by += [spatial.get('geohashCol')]

    def process_spatial_data_obj(self, key, df):
        spatial = self.form_data.get(key)
        if spatial is None:
            raise ValueError(_('Bad spatial key'))
        if spatial.get('type') == 'latlong':
            df[key] = list(zip(
                pd.to_numeric(df[spatial.get('lonCol')], errors='coerce'),
                pd.to_numeric(df[spatial.get('latCol')], errors='coerce'),
            ))
        elif spatial.get('type') == 'delimited':

            def tupleify(s):
                p = Point(s)
                return (p.latitude, p.longitude)

            df[key] = df[spatial.get('lonlatCol')].apply(tupleify)

            if spatial.get('reverseCheckbox'):
                df[key] = [
                    tuple(reversed(o)) if isinstance(o, (list, tuple)) else (0, 0)
                    for o in df[key]
                ]
            del df[spatial.get('lonlatCol')]
        elif spatial.get('type') == 'geohash':
            latlong = df[spatial.get('geohashCol')].map(geohash.decode)
            df[key] = list(zip(latlong.apply(lambda x: x[0]),
                               latlong.apply(lambda x: x[1])))
            del df[spatial.get('geohashCol')]
        return df

    def query_obj(self):
        d = super(BaseDeckGLViz, self).query_obj()
        fd = self.form_data
        gb = []

        for key in self.spatial_control_keys:
            self.process_spatial_query_obj(key, gb)

        if fd.get('dimension'):
            gb += [fd.get('dimension')]

        if fd.get('js_columns'):
            gb += fd.get('js_columns')
        metrics = self.get_metrics()
        gb = list(set(gb))
        if metrics:
            d['groupby'] = gb
            d['metrics'] = self.get_metrics()
        else:
            d['columns'] = gb

        return d

    def get_js_columns(self, d):
        cols = self.form_data.get('js_columns') or []
        return {col: d.get(col) for col in cols}

    def get_data(self, df):
        if df is None:
            return None
        for key in self.spatial_control_keys:
            df = self.process_spatial_data_obj(key, df)

        features = []
        for d in df.to_dict(orient='records'):
            feature = self.get_properties(d)
            extra_props = self.get_js_columns(d)
            if extra_props:
                feature['extraProps'] = extra_props
            features.append(feature)

        return {
            'features': features,
            'mapboxApiKey': config.get('MAPBOX_API_KEY'),
        }

    def get_properties(self, d):
        raise NotImplementedError()


class DeckScatterViz(BaseDeckGLViz):
    """deck.gl's ScatterLayer"""

    viz_type = 'deck_scatter'
    verbose_name = _('Deck.gl - Scatter plot')
    spatial_control_keys = ['spatial']
    is_timeseries = True

    def query_obj(self):
        fd = self.form_data
        self.is_timeseries = fd.get('time_grain_sqla') or fd.get('granularity')
        self.point_radius_fixed = (
                fd.get('point_radius_fixed') or {'type': 'fix', 'value': 500})
        return super(DeckScatterViz, self).query_obj()

    def get_metrics(self):
        self.metric = None
        if self.point_radius_fixed.get('type') == 'metric':
            self.metric = self.point_radius_fixed.get('value')
            return [self.metric]
        return None

    def get_properties(self, d):
        return {
            'metric': d.get(self.metric),
            'radius': self.fixed_value if self.fixed_value else d.get(self.metric),
            'cat_color': d.get(self.dim) if self.dim else None,
            'position': d.get('spatial'),
            '__timestamp': d.get(DTTM_ALIAS) or d.get('__time'),
        }

    def get_data(self, df):
        fd = self.form_data
        self.point_radius_fixed = fd.get('point_radius_fixed')
        self.fixed_value = None
        self.dim = self.form_data.get('dimension')
        if self.point_radius_fixed.get('type') != 'metric':
            self.fixed_value = self.point_radius_fixed.get('value')
        return super(DeckScatterViz, self).get_data(df)


class DeckScreengrid(BaseDeckGLViz):
    """deck.gl's ScreenGridLayer"""

    viz_type = 'deck_screengrid'
    verbose_name = _('Deck.gl - Screen Grid')
    spatial_control_keys = ['spatial']
    is_timeseries = True

    def query_obj(self):
        fd = self.form_data
        self.is_timeseries = fd.get('time_grain_sqla') or fd.get('granularity')
        return super(DeckScreengrid, self).query_obj()

    def get_properties(self, d):
        return {
            'position': d.get('spatial'),
            'weight': d.get(self.metric) or 1,
            '__timestamp': d.get(DTTM_ALIAS) or d.get('__time'),
        }


class DeckGrid(BaseDeckGLViz):
    """deck.gl's DeckLayer"""

    viz_type = 'deck_grid'
    verbose_name = _('Deck.gl - 3D Grid')
    spatial_control_keys = ['spatial']

    def get_properties(self, d):
        return {
            'position': d.get('spatial'),
            'weight': d.get(self.metric) or 1,
        }


class DeckPathViz(BaseDeckGLViz):
    """deck.gl's PathLayer"""

    viz_type = 'deck_path'
    verbose_name = _('Deck.gl - Paths')
    deck_viz_key = 'path'
    deser_map = {
        'json': json.loads,
        'polyline': polyline.decode,
    }

    def query_obj(self):
        d = super(DeckPathViz, self).query_obj()
        line_col = self.form_data.get('line_column')
        if d['metrics']:
            d['groupby'].append(line_col)
        else:
            d['columns'].append(line_col)
        return d

    def get_properties(self, d):
        fd = self.form_data
        deser = self.deser_map[fd.get('line_type')]
        path = deser(d[fd.get('line_column')])
        if fd.get('reverse_long_lat'):
            path = (path[1], path[0])
        return {
            self.deck_viz_key: path,
        }


class DeckPolygon(DeckPathViz):
    """deck.gl's Polygon Layer"""

    viz_type = 'deck_polygon'
    deck_viz_key = 'polygon'
    verbose_name = _('Deck.gl - Polygon')


class DeckHex(BaseDeckGLViz):
    """deck.gl's DeckLayer"""

    viz_type = 'deck_hex'
    verbose_name = _('Deck.gl - 3D HEX')
    spatial_control_keys = ['spatial']

    def get_properties(self, d):
        return {
            'position': d.get('spatial'),
            'weight': d.get(self.metric) or 1,
        }


class DeckGeoJson(BaseDeckGLViz):
    """deck.gl's GeoJSONLayer"""

    viz_type = 'deck_geojson'
    verbose_name = _('Deck.gl - GeoJSON')

    def query_obj(self):
        d = super(DeckGeoJson, self).query_obj()
        d['columns'] += [self.form_data.get('geojson')]
        d['metrics'] = []
        d['groupby'] = []
        return d

    def get_properties(self, d):
        geojson = d.get(self.form_data.get('geojson'))
        return json.loads(geojson)


class DeckArc(BaseDeckGLViz):
    """deck.gl's Arc Layer"""

    viz_type = 'deck_arc'
    verbose_name = _('Deck.gl - Arc')
    spatial_control_keys = ['start_spatial', 'end_spatial']

    def get_properties(self, d):
        return {
            'sourcePosition': d.get('start_spatial'),
            'targetPosition': d.get('end_spatial'),
        }

    def get_data(self, df):
        d = super(DeckArc, self).get_data(df)
        arcs = d['features']

        return {
            'arcs': arcs,
            'mapboxApiKey': config.get('MAPBOX_API_KEY'),
        }


class EventFlowViz(BaseViz):
    """A visualization to explore patterns in event sequences"""

    viz_type = 'event_flow'
    verbose_name = _('Event flow')
    credits = 'from <a href="https://github.com/williaster/data-ui">@data-ui</a>'
    is_timeseries = True

    def query_obj(self):
        query = super(EventFlowViz, self).query_obj()
        form_data = self.form_data

        event_key = form_data.get('all_columns_x')
        entity_key = form_data.get('entity')
        meta_keys = [
            col for col in form_data.get('all_columns')
            if col != event_key and col != entity_key
        ]

        query['columns'] = [event_key, entity_key] + meta_keys

        if form_data['order_by_entity']:
            query['orderby'] = [(entity_key, True)]

        return query

    def get_data(self, df):
        return df.to_dict(orient='records')


class PairedTTestViz(BaseViz):
    """A table displaying paired t-test values"""

    viz_type = 'paired_ttest'
    verbose_name = _('Time Series - Paired t-test')
    sort_series = False
    is_timeseries = True

    def get_data(self, df):
        """
        Transform received data frame into an object of the form:
        {
            'metric1': [
                {
                    groups: ('groupA', ... ),
                    values: [ {x, y}, ... ],
                }, ...
            ], ...
        }
        """
        fd = self.form_data
        groups = fd.get('groupby')
        metrics = fd.get('metrics')
        df.fillna(0)
        df = df.pivot_table(
            index=DTTM_ALIAS,
            columns=groups,
            values=metrics)
        cols = []
        # Be rid of falsey keys
        for col in df.columns:
            if col == '':
                cols.append('N/A')
            elif col is None:
                cols.append('NULL')
            else:
                cols.append(col)
        df.columns = cols
        data = {}
        series = df.to_dict('series')
        for nameSet in df.columns:
            # If no groups are defined, nameSet will be the metric name
            hasGroup = not isinstance(nameSet, string_types)
            Y = series[nameSet]
            d = {
                'group': nameSet[1:] if hasGroup else 'All',
                'values': [
                    {'x': t, 'y': Y[t] if t in Y else None}
                    for t in df.index
                ],
            }
            key = nameSet[0] if hasGroup else nameSet
            if key in data:
                data[key].append(d)
            else:
                data[key] = [d]
        return data


class RoseViz(NVD3TimeSeriesViz):
    viz_type = 'rose'
    verbose_name = _('Time Series - Nightingale Rose Chart')
    sort_series = False
    is_timeseries = True

    def get_data(self, df):
        data = super(RoseViz, self).get_data(df)
        result = {}
        for datum in data:
            key = datum['key']
            for val in datum['values']:
                timestamp = val['x'].value
                if not result.get(timestamp):
                    result[timestamp] = []
                value = 0 if math.isnan(val['y']) else val['y']
                result[timestamp].append({
                    'key': key,
                    'value': value,
                    'name': ', '.join(key) if isinstance(key, list) else key,
                    'time': val['x'],
                })
        return result


class PartitionViz(NVD3TimeSeriesViz):
    """
    A hierarchical data visualization with support for time series.
    """

    viz_type = 'partition'
    verbose_name = _('Partition Diagram')

    def query_obj(self):
        query_obj = super(PartitionViz, self).query_obj()
        time_op = self.form_data.get('time_series_option', 'not_time')
        # Return time series data if the user specifies so
        query_obj['is_timeseries'] = time_op != 'not_time'
        return query_obj

    def levels_for(self, time_op, groups, df):
        """
        Compute the partition at each `level` from the dataframe.
        """
        levels = {}
        for i in range(0, len(groups) + 1):
            agg_df = df.groupby(groups[:i]) if i else df
            levels[i] = (
                agg_df.mean() if time_op == 'agg_mean'
                else agg_df.sum(numeric_only=True))
        return levels

    def levels_for_diff(self, time_op, groups, df):
        # Obtain a unique list of the time grains
        times = list(set(df[DTTM_ALIAS]))
        times.sort()
        until = times[len(times) - 1]
        since = times[0]
        # Function describing how to calculate the difference
        func = {
            'point_diff': [
                pd.Series.sub,
                lambda a, b, fill_value: a - b,
            ],
            'point_factor': [
                pd.Series.div,
                lambda a, b, fill_value: a / float(b),
            ],
            'point_percent': [
                lambda a, b, fill_value=0: a.div(b, fill_value=fill_value) - 1,
                lambda a, b, fill_value: a / float(b) - 1,
            ],
        }[time_op]
        agg_df = df.groupby(DTTM_ALIAS).sum()
        levels = {0: pd.Series({
            m: func[1](agg_df[m][until], agg_df[m][since], 0)
            for m in agg_df.columns})}
        for i in range(1, len(groups) + 1):
            agg_df = df.groupby([DTTM_ALIAS] + groups[:i]).sum()
            levels[i] = pd.DataFrame({
                m: func[0](agg_df[m][until], agg_df[m][since], fill_value=0)
                for m in agg_df.columns})
        return levels

    def levels_for_time(self, groups, df):
        procs = {}
        for i in range(0, len(groups) + 1):
            self.form_data['groupby'] = groups[:i]
            df_drop = df.drop(groups[i:], 1)
            procs[i] = self.process_data(df_drop, aggregate=True).fillna(0)
        self.form_data['groupby'] = groups
        return procs

    def nest_values(self, levels, level=0, metric=None, dims=()):
        """
        Nest values at each level on the back-end with
        access and setting, instead of summing from the bottom.
        """
        if not level:
            return [{
                'name': m,
                'val': levels[0][m],
                'children': self.nest_values(levels, 1, m),
            } for m in levels[0].index]
        if level == 1:
            return [{
                'name': i,
                'val': levels[1][metric][i],
                'children': self.nest_values(levels, 2, metric, (i,)),
            } for i in levels[1][metric].index]
        if level >= len(levels):
            return []
        return [{
            'name': i,
            'val': levels[level][metric][dims][i],
            'children': self.nest_values(
                levels, level + 1, metric, dims + (i,),
            ),
        } for i in levels[level][metric][dims].index]

    def nest_procs(self, procs, level=-1, dims=(), time=None):
        if level == -1:
            return [{
                'name': m,
                'children': self.nest_procs(procs, 0, (m,)),
            } for m in procs[0].columns]
        if not level:
            return [{
                'name': t,
                'val': procs[0][dims[0]][t],
                'children': self.nest_procs(procs, 1, dims, t),
            } for t in procs[0].index]
        if level >= len(procs):
            return []
        return [{
            'name': i,
            'val': procs[level][dims][i][time],
            'children': self.nest_procs(procs, level + 1, dims + (i,), time),
        } for i in procs[level][dims].columns]

    def get_data(self, df):
        fd = self.form_data
        groups = fd.get('groupby', [])
        time_op = fd.get('time_series_option', 'not_time')
        if not len(groups):
            raise ValueError('Please choose at least one groupby')
        if time_op == 'not_time':
            levels = self.levels_for('agg_sum', groups, df)
        elif time_op in ['agg_sum', 'agg_mean']:
            levels = self.levels_for(time_op, groups, df)
        elif time_op in ['point_diff', 'point_factor', 'point_percent']:
            levels = self.levels_for_diff(time_op, groups, df)
        elif time_op == 'adv_anal':
            procs = self.levels_for_time(groups, df)
            return self.nest_procs(procs)
        else:
            levels = self.levels_for('agg_sum', [DTTM_ALIAS] + groups, df)
        return self.nest_values(levels)


viz_types = {
    o.viz_type: o for o in globals().values()
    if (
            inspect.isclass(o) and
            issubclass(o, BaseViz) and
            o.viz_type not in config.get('VIZ_TYPE_BLACKLIST'))}
