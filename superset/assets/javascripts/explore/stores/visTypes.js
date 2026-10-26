/**
 * This file defines how controls (defined in controls.js) are structured into sections
 * and associated with each and every visualization type.
 */
import { D3_TIME_FORMAT_OPTIONS } from './controls';
import * as v from '../validators';
import { t } from '../../locales';

export const sections = {
  druidTimeSeries: {
    label: t('Time'),
    expanded: true,
    description: t('Time related form attributes'),
    controlSetRows: [
      ['granularity', 'druid_time_origin'],
      ['since', 'until'],
    ],
  },
  datasourceAndVizType: {
    label: t('Datasource & Chart Type'),
    expanded: true,
    controlSetRows: [
      ['datasource'],
      ['viz_type'],
      ['slice_id', 'cache_timeout'],
    ],
  },
  colorScheme: {
    label: t('Color Scheme'),
    controlSetRows: [
      ['color_scheme'],
    ],
  },
  sqlaTimeSeries: {
    label: t('Time'),
    description: t('Time related form attributes'),
    expanded: true,
    controlSetRows: [
      ['granularity_sqla', 'time_grain_sqla'],
      ['since', 'until'],
    ],
  },
  sqlClause: {
    label: t('SQL'),
    controlSetRows: [
      ['where'],
      ['having'],
    ],
    description: t('This section exposes ways to include snippets of SQL in your query'),
  },
  annotations: {
    label: t('Annotations and Layers'),
    expanded: true,
    controlSetRows: [
      ['annotation_layers'],
    ],
  },
  NVD3TimeSeries: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['metrics'],
        ['groupby'],
        ['limit', 'timeseries_limit_metric'],
        ['order_desc', 'contribution'],
      ],
    },
    {
      label: t('Advanced Analytics'),
      description: t('This section contains options ' +
      'that allow for advanced analytical post processing ' +
      'of query results'),
      controlSetRows: [
        ['rolling_type', 'rolling_periods', 'min_periods'],
        ['time_compare', null],
        ['num_period_compare', 'period_ratio_type'],
        ['resample_how', 'resample_rule', 'resample_fillmethod'],
      ],
    },
  ],
  filters: [
    {
      label: t('Filters'),
      expanded: true,
      controlSetRows: [['filters']],
    },
    {
      label: t('Result Filters'),
      expanded: true,
      description: t('The filters to apply after post-aggregation.' +
      'Leave the value control empty to filter empty strings or nulls'),
      controlSetRows: [['having_filters']],
    },
  ],
};

export const visTypes = {
  dist_bar: {
    label: t('Distribution - Bar Chart'),
    showOnExplore: true,
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['metrics'],
          ['groupby'],
          ['columns'],
          ['row_limit'],
          ['contribution'],
          ['text_replace'],
          ['text_replace_x'],
          ['index_order'],
          ['editor_content'],
          ['slice_data_from'],
        ],
      },
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['color_scheme'],
          ['show_legend', 'show_bar_value'],
          ['bar_stacked', 'order_bars'],
          ['show_controls', 'show_horizontal'],
        ],
      },
      {
        label: t('X Axis'),
        expanded: true,
        controlSetRows: [
          ['x_axis_label', 'bottom_margin'],
          ['x_ticks_layout', 'reduce_x_ticks'],
        ],
      },
     {
        label: t('Y Axis'),
        expanded: true,
        controlSetRows: [
          ['y_axis_label', 'left_margin'],
          ['y_axis_showminmax', 'y_log_scale'],
          ['y_axis_format'],
          ['y_axis_bounds'],
        ],
      },
    ],
    controlOverrides: {
      groupby: {
        label: t('Series'),
      },
      index_order: {
        label: t('X轴类目顺序,例如: 类目A|类目B'),
        description: t('X轴类目顺序,例如: 类目A|类目B'),
      },
      columns: {
        label: t('Breakdowns'),
        description: t('Defines how each series is broken down'),
      },
      text_replace: {
        label: t('指标名替换,例如:{"原名":"新名"}'),
        description: t('指标名替换,例如：{"原名":"新名","原名1":"新名1"}'),
      },
    },
  },

  pie: {
    label: t('Pie Chart'),
    showOnExplore: true,
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['metrics'],
          ['groupby'],
          ['limit'],
          ['pie_others'],
        ],
      },
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['pie_label_type'],
          ['donut', 'show_legend'],
          ['labels_outside'],
          ['color_scheme'],
        ],
      },
    ],
  },

  line: {
    label: t('Time Series - Line Chart'),
    showOnExplore: true,
    requiresTime: true,
    controlPanelSections: [
      sections.NVD3TimeSeries[0],
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['color_scheme'],
          ['show_brush', 'brushExtentStart'],
          ['rich_tooltip', 'show_markers'],
          ['line_interpolation', 'show_legend'],
          ['show_lastvalue', 'hidden_grid'],
        ],
      },
      {
        label: t('X Axis'),
        expanded: true,
        controlSetRows: [
          ['x_axis_label', 'bottom_margin'],
          ['x_ticks_layout', 'x_axis_format'],
          ['x_axis_showminmax'],
        ],
      },
      {
        label: t('Y Axis'),
        expanded: true,
        controlSetRows: [
          ['left_margin', 'right_margin'],
          ['y_axis_format', 'y_axis_label'],
          ['y_axis_showminmax', 'y_log_scale'],
          ['highlight_tick_zero'],
          ['y_axis_bounds'],
        ],
      },
      {
      label: t('Advanced Analytics'),
      description: t('This section contains options ' +
      'that allow for advanced analytical post processing ' +
      'of query results'),
      controlSetRows: [
        ['rolling_type', 'rolling_periods', 'min_periods'],
        ['time_compare', null],
        ['num_period_compare', 'period_ratio_type'],
        ['compare_lag', 'list_ratio_type'],
        ['resample_how', 'resample_rule', 'resample_fillmethod'],
        ['column_order_list'],
        ['text_replace'],
        ['series_color'],
        ['series_line_width'],
        ['editor_content'],
        ['chart_description1'],
        ['slice_data_from'],
        ['event_list'],
        ['remove_space', null],
      ],
    },
      sections.annotations,
    ],
    controlOverrides: {
      x_axis_format: {
        choices: D3_TIME_FORMAT_OPTIONS,
        default: '%Y-%m-%d',
      },
      x_axis_showminmax: {
        default: true,
      },
      y_axis_format: {
        default: '.4r',
      },
      column_order_list: {
        label: t('列顺序,例如: columnA|columnB'),
        description: t('列顺序,例如: columnA|columnB'),
      },
      text_replace: {
        label: t('指标名替换,例如:{"原名":"新名"}'),
        description: t('指标名替换,例如：{"原名":"新名","原名1":"新名1"}'),
      },
      compare_lag: {
        label: t('时序数'),
        description: t('[integer] Number of period to compare against, ' +
    'this is relative to the granularity selected'),
      },
    },
  },

  time_pivot: {
    label: t('Time Series - Periodicity Pivot'),
    showOnExplore: true,
    requiresTime: true,
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['metric', 'freq'],
        ],
      },
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['show_legend', 'line_interpolation'],
          ['color_picker', null],
        ],
      },
      {
        label: t('X Axis'),
        expanded: true,
        controlSetRows: [
          ['x_axis_label', 'bottom_margin'],
          ['x_axis_showminmax', 'x_axis_format'],
        ],
      },
      {
        label: t('Y Axis'),
        expanded: true,
        controlSetRows: [
          ['y_axis_label', 'left_margin'],
          ['y_axis_showminmax', 'y_log_scale'],
          ['y_axis_format', 'y_axis_bounds'],
        ],
      },
    ],
    controlOverrides: {
      x_axis_format: {
        choices: D3_TIME_FORMAT_OPTIONS,
        default: 'smart_date',
      },
    },
  },

  dual_line: {
    label: t('Dual Axis Line Chart'),
    requiresTime: true,
    controlPanelSections: [
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['color_scheme'],
          ['x_axis_format'],
          ['left_margin', 'right_margin'],
        ],
      },
      {
        label: t('Y Axis 1'),
        expanded: true,
        controlSetRows: [
          ['metric', 'y_axis_format'],
        ],
      },
      {
        label: t('Y Axis 2'),
        expanded: true,
        controlSetRows: [
          ['metric_2', 'y_axis_2_format'],
        ],
      },
      sections.annotations,
    ],
    controlOverrides: {
      metric: {
        label: t('Left Axis Metric'),
        description: t('Choose a metric for left axis'),
      },
      y_axis_format: {
        label: t('Left Axis Format'),
      },
      x_axis_format: {
        choices: D3_TIME_FORMAT_OPTIONS,
        default: 'smart_date',
      },
    },
  },

  bar: {
    label: t('Time Series - Bar Chart'),
    showOnExplore: true,
    requiresTime: true,
    controlPanelSections: [
      sections.NVD3TimeSeries[0],
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['color_scheme'],
          ['show_brush', 'line_interpolation'],
          ['show_legend', 'show_bar_value', 'rich_tooltip'],
          ['show_controls', 'bar_stacked', 'bar_expand'],
          ['hidden_grid'],
        ],
      },
      {
        label: t('X Axis'),
        expanded: true,
        controlSetRows: [
          ['x_axis_label', 'bottom_margin'],
          ['x_ticks_layout', 'x_axis_format'],
          ['x_axis_showminmax', 'reduce_x_ticks'],
        ],
      },
      {
        label: t('Y Axis'),
        expanded: true,
        controlSetRows: [
          ['y_axis_label', 'left_margin'],
          ['y_axis_showminmax', 'y_log_scale'],
          ['y_axis_format'],
          ['y_axis_bounds'],
        ],
      },
      {
      label: t('Advanced Analytics'),
      description: t('This section contains options ' +
      'that allow for advanced analytical post processing ' +
      'of query results'),
      controlSetRows: [
        ['rolling_type', 'rolling_periods', 'min_periods'],
        ['time_compare', null],
        ['num_period_compare', 'period_ratio_type'],
        ['resample_how', 'resample_rule', 'resample_fillmethod'],
        ['column_order_list'],
        ['text_replace'],
        ['editor_content'],
        ['exec_code'],
        ['slice_data_from'],
      ],
      },
      sections.annotations,
    ],
    controlOverrides: {
      x_axis_format: {
        choices: D3_TIME_FORMAT_OPTIONS,
        default: '%Y-%m-%d',
      },
      x_axis_showminmax: {
        default: true,
      },
      y_axis_format: {
        default: '.4r',
      },
      column_order_list: {
        label: t('列顺序,例如: columnA|columnB'),
        description: t('列顺序,例如: columnA|columnB'),
      },
      text_replace: {
        label: t('指标名替换,例如:{"原名":"新名"}'),
        description: t('指标名替换,例如：{"原名":"新名","原名1":"新名1"}'),
      },
    },
  },

  compare: {
    label: t('Time Series - Percent Change'),
    requiresTime: true,
    controlPanelSections: [
      sections.NVD3TimeSeries[0],
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['color_scheme'],
        ],
      },
      {
        label: t('X Axis'),
        expanded: true,
        controlSetRows: [
          ['x_axis_label', 'bottom_margin'],
          ['x_ticks_layout', 'x_axis_format'],
          ['x_axis_showminmax', null],
        ],
      },
      {
        label: t('Y Axis'),
        expanded: true,
        controlSetRows: [
          ['y_axis_label', 'left_margin'],
          ['y_axis_showminmax', 'y_log_scale'],
          ['y_axis_format', 'y_axis_bounds'],
        ],
      },
      sections.NVD3TimeSeries[1],
      sections.annotations,
    ],
    controlOverrides: {
      x_axis_format: {
        choices: D3_TIME_FORMAT_OPTIONS,
        default: 'smart_date',
      },
    },
  },

  deck_multi: {
    label: t('Deck.gl - Multiple Layers'),
    requiresTime: true,
    controlPanelSections: [
      {
        label: t('Map'),
        expanded: true,
        controlSetRows: [
          ['mapbox_style', 'viewport'],
          ['deck_slices', null],
        ],
      },
    ],
  },

  deck_hex: {
    label: t('Deck.gl - Hexagons'),
    requiresTime: true,
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['spatial', 'size'],
          ['row_limit', null],
        ],
      },
      {
        label: t('Map'),
        controlSetRows: [
          ['mapbox_style', 'viewport'],
          ['color_picker', 'autozoom'],
          ['grid_size', 'extruded'],
        ],
      },
      {
        label: t('Advanced'),
        controlSetRows: [
          ['js_columns'],
          ['js_data_mutator'],
          ['js_tooltip'],
          ['js_onclick_href'],
        ],
      },
    ],
    controlOverrides: {
      size: {
        label: t('Height'),
        description: t('Metric used to control height'),
      },
    },
  },

  deck_grid: {
    label: t('Deck.gl - Grid'),
    requiresTime: true,
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['spatial', 'size'],
          ['row_limit', null],
        ],
      },
      {
        label: t('Map'),
        controlSetRows: [
          ['mapbox_style', 'viewport'],
          ['color_picker', 'autozoom'],
          ['grid_size', 'extruded'],
        ],
      },
      {
        label: t('Advanced'),
        controlSetRows: [
          ['js_columns'],
          ['js_data_mutator'],
          ['js_tooltip'],
          ['js_onclick_href'],
        ],
      },
    ],
    controlOverrides: {
      size: {
        label: t('Height'),
        description: t('Metric used to control height'),
        validators: [v.nonEmpty],
      },
    },
  },

  deck_path: {
    label: t('Deck.gl - Paths'),
    requiresTime: true,
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['line_column', 'line_type'],
          ['row_limit', null],
        ],
      },
      {
        label: t('Map'),
        expanded: true,
        controlSetRows: [
          ['mapbox_style', 'viewport'],
          ['color_picker', 'line_width'],
          ['reverse_long_lat', 'autozoom'],
        ],
      },
      {
        label: t('Advanced'),
        controlSetRows: [
          ['js_columns'],
          ['js_data_mutator'],
          ['js_tooltip'],
          ['js_onclick_href'],
        ],
      },
    ],
  },

  deck_screengrid: {
    label: t('Deck.gl - Screen grid'),
    requiresTime: true,
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['spatial', 'size'],
          ['row_limit', null],
        ],
      },
      {
        label: t('Map'),
        controlSetRows: [
          ['mapbox_style', 'viewport'],
          ['autozoom', null],
        ],
      },
      {
        label: t('Grid'),
        controlSetRows: [
          ['grid_size', 'color_picker'],
        ],
      },
      {
        label: t('Advanced'),
        controlSetRows: [
          ['js_columns'],
          ['js_data_mutator'],
          ['js_tooltip'],
          ['js_onclick_href'],
        ],
      },
    ],
    controlOverrides: {
      size: {
        label: t('Weight'),
        description: t("Metric used as a weight for the grid's coloring"),
        validators: [v.nonEmpty],
      },
    },
  },

  deck_geojson: {
    label: t('Deck.gl - geoJson'),
    requiresTime: true,
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['geojson', 'row_limit'],
        ],
      },
      {
        label: t('Map'),
        controlSetRows: [
          ['mapbox_style', 'viewport'],
          // TODO ['autozoom', null],
        ],
      },
      {
        label: t('GeoJson Settings'),
        controlSetRows: [
          ['fill_color_picker', 'stroke_color_picker'],
          ['filled', 'stroked'],
          ['extruded', null],
          ['point_radius_scale', null],
        ],
      },
      {
        label: t('Advanced'),
        controlSetRows: [
          ['js_columns'],
          ['js_data_mutator'],
          ['js_tooltip'],
          ['js_onclick_href'],
        ],
      },
    ],
  },

  deck_polygon: {
    label: t('Deck.gl - Polygon'),
    requiresTime: true,
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['line_column', 'line_type'],
          ['row_limit', null],
        ],
      },
      {
        label: t('Map'),
        controlSetRows: [
          ['mapbox_style', 'viewport'],
          ['reverse_long_lat', null],
        ],
      },
      {
        label: t('Polygon Settings'),
        controlSetRows: [
          ['fill_color_picker', 'stroke_color_picker'],
          ['filled', 'stroked'],
          ['extruded', null],
          ['point_radius_scale', null],
        ],
      },
      {
        label: t('Advanced'),
        controlSetRows: [
          ['js_columns'],
          ['js_data_mutator'],
          ['js_tooltip'],
          ['js_onclick_href'],
        ],
      },
    ],
  },

  deck_arc: {
    label: t('Deck.gl - Arc'),
    requiresTime: true,
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['start_spatial', 'end_spatial'],
          ['row_limit', null],
        ],
      },
      {
        label: t('Map'),
        controlSetRows: [
          ['mapbox_style', 'viewport'],
          ['autozoom', null],
        ],
      },
      {
        label: t('Arc'),
        controlSetRows: [
          ['color_picker', null],
          ['stroke_width', null],
        ],
      },
      {
        label: t('Advanced'),
        controlSetRows: [
          ['js_columns'],
          ['js_data_mutator'],
          ['js_tooltip'],
          ['js_onclick_href'],
        ],
      },
    ],
  },

  deck_scatter: {
    label: t('Deck.gl - Scatter plot'),
    requiresTime: true,
    onInit: controlState => ({
      ...controlState,
      time_grain_sqla: {
        ...controlState.time_grain_sqla,
        value: null,
      },
      granularity: {
        ...controlState.granularity,
        value: null,
      },
    }),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['spatial', 'row_limit'],
        ],
      },
      {
        label: t('Map'),
        expanded: true,
        controlSetRows: [
          ['mapbox_style', 'viewport'],
          ['autozoom', null],
        ],
      },
      {
        label: t('Point Size'),
        controlSetRows: [
          ['point_radius_fixed', 'point_unit'],
          ['min_radius', 'max_radius'],
          ['multiplier', null],
        ],
      },
      {
        label: t('Point Color'),
        controlSetRows: [
          ['color_picker', 'legend_position'],
          ['dimension', 'color_scheme'],
        ],
      },
      {
        label: t('Advanced'),
        controlSetRows: [
          ['js_columns'],
          ['js_data_mutator'],
          ['js_tooltip'],
          ['js_onclick_href'],
        ],
      },
    ],
    controlOverrides: {
      dimension: {
        label: t('Categorical Color'),
        description: t('Pick a dimension from which categorical colors are defined'),
      },
      size: {
        validators: [],
      },
    },
  },

  area: {
    label: t('Time Series - Stacked'),
    requiresTime: true,
    controlPanelSections: [
      sections.NVD3TimeSeries[0],
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['show_brush', 'show_legend'],
          ['line_interpolation', 'stacked_style'],
          ['color_scheme'],
          ['rich_tooltip', 'show_controls'],
        ],
      },
      {
        label: t('X Axis'),
        expanded: true,
        controlSetRows: [
          ['x_axis_label', 'bottom_margin'],
          ['x_ticks_layout', 'x_axis_format'],
          ['x_axis_showminmax', null],
        ],
      },
      {
        label: t('Y Axis'),
        expanded: true,
        controlSetRows: [
          ['y_axis_format', 'y_axis_bounds'],
          ['y_log_scale', null],
        ],
      },
      {
      label: t('Advanced Analytics'),
      description: t('This section contains options ' +
      'that allow for advanced analytical post processing ' +
      'of query results'),
      controlSetRows: [
        ['rolling_type', 'rolling_periods', 'min_periods'],
        ['time_compare', null],
        ['num_period_compare', 'period_ratio_type'],
        ['resample_how', 'resample_rule', 'resample_fillmethod'],
        ['column_order_list'],
        ['text_replace'],
      ],
      },
      sections.annotations,
    ],
    controlOverrides: {
      text_replace: {
        label: t('指标名替换,例如:{"原名":"新名"}'),
        description: t('指标名替换,例如：{"原名":"新名","原名1":"新名1"}'),
      },
      x_axis_format: {
        choices: D3_TIME_FORMAT_OPTIONS,
        default: '%Y-%m-%d',
      },
      x_axis_showminmax: {
        default: true,
      },
      y_axis_format: {
        default: '.4r',
      },
      color_scheme: {
        renderTrigger: false,
      },
      column_order_list: {
        label: t('列顺序,例如: columnA|columnB'),
        description: t('列顺序,例如: columnA|columnB'),
      },
    },
  },

  table: {
    label: t('Table View'),
    controlPanelSections: [
      {
        label: t('GROUP BY'),
        description: t('Use this section if you want a query that aggregates'),
        expanded: true,
        controlSetRows: [
          ['groupby'],
          ['metrics'],
          ['percent_metrics'],
          ['timeseries_limit_metric', 'row_limit'],
          ['include_time', 'order_desc'],
          ['th_width'],
          ['latest_data_interface_url', 'table_timestamp_format'],
          ['alias_labels'],
          ['number_format'],
          ['number_format_column'],
          ['excel_style'],
        ],
      },
      {
        label: t('NOT GROUPED BY'),
        description: t('Use this section if you want to query atomic rows'),
        controlSetRows: [
          ['all_columns'],
          ['order_by_cols'],
          ['row_limit', null],
        ],
      },
      {
        label: t('Options'),
        expanded: true,
        controlSetRows: [
          ['page_length', null],
          ['include_search', 'table_filter'],
          ['align_pn', 'color_pn'],
          ['slice_data_from'],
        ],
      },
    ],
    controlOverrides: {
      metrics: {
        validators: [],
      },
      table_timestamp_format: {
        renderTrigger: false,
      },
      latest_data_interface_url: {
        label: t('日期格式化列：列1|列2'),
        description: t('日期格式化列：列1|列2'),
      },
      time_grain_sqla: {
        default: null,
      },
      excel_style: {
        label: t('Table CSS Style'),
      },
    },
  },

  time_table: {
    label: t('Time Series Table'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['groupby', 'metrics'],
          ['limit', 'day_shift_for_annual_start_days'],
          ['first_fillna_method', 'second_fillna_method'],
          ['column_collection'],
          ['url'],
          ['metric_caption', 'font_weight_class'],
          ['index_order'],
          ['number_format_row'],
          ['column_order_list'],
          ['alias_labels'],
          ['text_replace'],
          ['slice_data_from'],
          ['excel_style'],
          ['chart_description'],
          ['table_column_num', 'order_type'],
          sections.NVD3TimeSeries[1].controlSetRows[0],
          ['pandas_aggfunc', 'wether_aggfunc'],
          ['show_modal_chart'],
        ],
      },
    ],
    controlOverrides: {
      groupby: {
        multiple: false,
      },
      url: {
        description: t(
          "Templated link, it's possible to include {{ metric }} " +
          'or other values coming from the controls.'),
      },
      column_order_list: {
        label: t('多层级列时,指定1级列顺序,例如: 列2|列1'),
        description: t('多层级列时,指定1级列顺序,例如: 列2|列1'),
      },
      text_replace: {
        label: t('1级列别名,例如：{"原名":"别名"}'),
        description: t('1级列别名,例如：{"原名":"别名"}'),
      },
      font_weight_class: {
        label: t('Table body font weight class'),
      },
      alias_labels: {
        label: t('左侧指标别名,例如:{"原名":"别名"}'),
      },
      excel_style: {
        label: 'Table CSS Style',
        description: 'table thead tr { background-color: #87CEEB; }',
      },
      day_shift_for_annual_start_days: {
        label: '日期移动天数',
        description: '往前移动请填入负数',
      },
      first_fillna_method: {
        choices: [
                    ['ffill', 'ffill'],
                    ['bfill', 'bfill'],
                    ['0', 0],
                    ['None', 'None'],
                  ],
      },
      second_fillna_method: {
        choices: [
                    ['ffill', 'ffill'],
                    ['bfill', 'bfill'],
                    ['0', 0],
                    ['None', 'None'],
                  ],
      },
    },
  },

  markup: {
    label: t('Markup'),
    controlPanelSections: [
      {
        label: t('Code'),
        expanded: true,
        controlSetRows: [
          ['markup_type'],
          ['code'],
          ['font_size', 'font_size_2'],
          ['is_divided_title', null],
        ],
      },
    ],
    controlOverrides: {
      font_size: {
        label: 'Text Font Size',
        description: '正文字体大小',
      },
      font_size_2: {
        label: 'Code Font Size',
        description: '代码块字体大小',
      },
    },
  },

  pivot_table: {
    label: t('Pivot Table'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['groupby', 'columns'],
          ['metrics'],
        ],
      },
      {
        label: t('Pivot Options'),
        controlSetRows: [
          ['pandas_aggfunc', 'day_shift_for_annual_start_days'],
          ['number_format', 'table_timestamp_format'],
          ['combine_metric', 'order_type'],
          ['sub_total', 'pivot_margins'],
          ['show_max', 'show_min'],
          ['show_hsl_bg', 'show_hsl_bg_zero'],
          ['show_hsl_bg_text', 'hsl_reversal'],
          ['hsl_color_max', 'hsl_color_min', 'hsl_column'],
          ['number_format_column'],
          ['column_order_list'],
          ['hide_rows'],
          ['text_replace'],
          ['color_column'],
          ['row_background_color'],
          ['date_time_format'],
          ['excel_style'],
          ['chart_width', 'chart_column'],
          ['chart_xAix_name'],
          ['eval_code'],
          ['exec_code'],
          ['column_order_type'],
          ['chart_description'],
          ['slice_data_from'],
        ],
      },
    ],
    controlOverrides: {
      groupby: { includeTime: true },
      columns: { includeTime: true },
      table_timestamp_format: { default: '%Y-%m-%d' },
      excel_style: {
        label: 'Table CSS Style',
        description: 'table thead tr { background-color: #87CEEB; }',
      },
      date_time_format: {
        label: '表头时间戳格式',
        description: '表头时间戳格式',
        default: '',
      },
      day_shift_for_annual_start_days: {
        label: '日期移动天数',
        description: '往前移动请填入负数',
      },
      order_type: {
        label: t('index 排序类型'),
        default: 'desc',
      },
      number_format: {
        default: '.4r',
      },
    },
  },

  excel_view: {
    label: t('Excel View'),
    showOnExplore: true,
    controlPanelSections: [
      {
        label: t('Option'),
        expanded: true,
        controlSetRows: [
          ['excel_url'],
          ['excel_load_parameter'],
          ['data_frame_to_html_parameter'],
          ['start_row', 'end_row'],
          ['start_column', 'end_column'],
          ['excel_style'],
        ],
      },
    ],
  },

  html_set: {
    label: t('HtmlSet View'),
    showOnExplore: true,
    controlPanelSections: [
      {
        label: t('Option'),
        expanded: true,
        controlSetRows: [
          ['excel_url'],
          ['beautifulsoup_expression'],
          ['excel_style'],
        ],
      },
    ],
    controlOverrides: {
      excel_url: {
        label: t('Website Link'),
        description: t('Website Link'),
      },
      excel_style: {
        label: t('Html CSS Style'),
      },
    },
  },

  separator: {
    label: t('Separator'),
    controlPanelSections: [
      {
        label: t('Code'),
        controlSetRows: [
          ['markup_type'],
          ['code'],
        ],
      },
    ],
    controlOverrides: {
      code: {
        default: '####Section Title\n' +
        'A paragraph describing the section' +
        'of the dashboard, right before the separator line ' +
        '\n\n' +
        '---------------',
      },
    },
  },

  word_cloud: {
    label: t('Word Cloud'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['series', 'metric'],
          ['row_limit', null],
        ],
      },
      {
        label: t('Options'),
        controlSetRows: [
          ['size_from', 'size_to'],
          ['rotation'],
          ['color_scheme'],
        ],
      },
    ],
  },

  treemap: {
    label: t('Treemap'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['metrics'],
          ['groupby'],
        ],
      },
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['color_scheme'],
          ['treemap_ratio'],
          ['number_format'],
        ],
      },
    ],
    controlOverrides: {
      color_scheme: {
        renderTrigger: false,
      },
    },
  },

  cal_heatmap: {
    label: t('Calendar Heatmap'),
    requiresTime: true,
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['metric'],
        ],
      },
      {
        label: t('Options'),
        controlSetRows: [
          ['domain_granularity'],
          ['subdomain_granularity'],
        ],
      },
    ],
  },

  box_plot: {
    label: t('Box Plot'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['metrics'],
          ['groupby', 'limit'],
          ['column_order_list'],
          ['text_replace'],
        ],
      },
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['color_scheme'],
          ['whisker_options'],
          ['y_axis_format'],
        ],
      },
    ],
    controlOverrides: {
      column_order_list: {
        label: t('X轴类目顺序,例如: 类目A|类目B'),
        description: t('X轴类目顺序,例如: 类目A|类目B'),
      },
      text_replace: {
        label: t('X轴类目名替换,例如:{"原名":"新名"}'),
        description: t('X轴类目名替换,例如:{"原名":"新名"}'),
      },
    },
  },

  bubble: {
    label: t('Bubble Chart'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['series', 'entity'],
          ['x', 'y'],
          ['size', 'max_bubble_size'],
          ['limit', null],
        ],
      },
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['color_scheme'],
          ['show_legend', null],
        ],
      },
      {
        label: t('X Axis'),
        expanded: true,
        controlSetRows: [
          ['x_axis_label', 'left_margin'],
          ['x_axis_format', 'x_ticks_layout'],
          ['x_log_scale', 'x_axis_showminmax'],
        ],
      },
      {
        label: t('Y Axis'),
        expanded: true,
        controlSetRows: [
          ['y_axis_label', 'bottom_margin'],
          ['y_axis_format', null],
          ['y_log_scale', 'y_axis_showminmax'],
        ],
      },
    ],
    controlOverrides: {
      x_axis_format: {
        default: '.3s',
      },
      color_scheme: {
        renderTrigger: false,
      },
    },
  },

  bullet: {
    label: t('Bullet Chart'),
    requiresTime: false,
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['metric'],
        ],
      },
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['metric'],
          ['ranges', 'range_labels'],
          ['markers', 'marker_labels'],
          ['marker_lines', 'marker_line_labels'],
        ],
      },
    ],
  },

  big_number: {
    label: t('Big Number with Trendline'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['metric'],
        ],
      },
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['compare_lag', 'compare_suffix'],
          ['y_axis_format', 'x_axis_time_format'],
          ['show_last_date', null]
        ],
      },
    ],
    controlOverrides: {
      y_axis_format: {
        label: t('Number format'),
      },
      x_axis_time_format: {
        default: '%Y-%m-%d',
      },
    },
  },

  big_number_total: {
    label: t('Big Number'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['metric'],
        ],
      },
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['subheader'],
          ['y_axis_format'],
          ['color', null],
        ],
      },
    ],
    controlOverrides: {
      y_axis_format: {
        label: t('Number format'),
      },
      color: {
        default: { r: 0, g: 0, b: 0, a: 1 },
        renderTrigger: true,
      },
    },
  },

  histogram: {
    label: t('Histogram'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['all_columns_x'],
          ['row_limit'],
          ['groupby'],
        ],
      },
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['color_scheme'],
          ['link_length', 'global_opacity'],
          ['x_axis_format', 'x_axis_label'],
          ['y_axis_format', 'y_axis_label'],
          ['normalized', 'column_isdate', 'highlight_tick_zero'],
        ],
      },
    ],
    controlOverrides: {
      x_axis_format: {
        default: '.4r',
      },
      all_columns_x: {
        label: t('Numeric Columns'),
        description: t('Select the numeric columns to draw the histogram'),
        multi: true,
      },
      link_length: {
        label: t('分组数'),
        description: t('Select number of bins for the histogram'),
        default: 5,
      },
      global_opacity: {
        description: t('Opacity of the bars. Between 0 and 1'),
        renderTrigger: true,
      },
      column_isdate: {
        label: t('突显最新值'),
        description: t('突显最新值'),
      },
      highlight_tick_zero: {
        label: t('突显分位点'),
        description: t('突显分位点'),
      },
    },
  },

  sunburst: {
    label: t('Sunburst'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['groupby'],
          ['metric', 'secondary_metric'],
          ['row_limit'],
        ],
      },
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['color_scheme'],
        ],
      },
    ],
    controlOverrides: {
      metric: {
        label: t('Primary Metric'),
        description: t('The primary metric is used to define the arc segment sizes'),
      },
      secondary_metric: {
        label: t('Secondary Metric'),
        default: null,
        description: t('[optional] this secondary metric is used to ' +
        'define the color as a ratio against the primary metric. ' +
        'When omitted, the color is categorical and based on labels'),
      },
      groupby: {
        label: t('Hierarchy'),
        description: t('This defines the level of the hierarchy'),
      },
    },
  },

  sankey: {
    label: t('Sankey'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['groupby'],
          ['metric'],
          ['row_limit'],
        ],
      },
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['color_scheme'],
        ],
      },
    ],
    controlOverrides: {
      groupby: {
        label: t('Source / Target'),
        description: t('Choose a source and a target'),
      },
    },
  },

  directed_force: {
    label: t('Directed Force Layout'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['groupby'],
          ['metric'],
          ['row_limit'],
        ],
      },
      {
        label: t('Options'),
        controlSetRows: [
          ['link_length'],
          ['charge'],
        ],
      },
    ],
    controlOverrides: {
      groupby: {
        label: t('Source / Target'),
        description: t('Choose a source and a target'),
      },
    },
  },
  chord: {
    label: t('Chord Diagram'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['groupby', 'columns'],
          ['metric', 'row_limit'],
        ],
      },
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['y_axis_format', null],
          ['color_scheme'],
        ],
      },
    ],
    controlOverrides: {
      y_axis_format: {
        label: t('Number format'),
        description: t('Choose a number format'),
      },
      groupby: {
        label: t('Source'),
        multi: false,
        validators: [v.nonEmpty],
        description: t('Choose a source'),
      },
      columns: {
        label: t('Target'),
        multi: false,
        validators: [v.nonEmpty],
        description: t('Choose a target'),
      },
    },
  },
  country_map: {
    label: t('Country Map'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['entity'],
          ['metric'],
        ],
      },
      {
        label: t('Options'),
        expanded: true,
        controlSetRows: [
          ['select_country', 'number_format'],
          ['linear_color_scheme'],
        ],
      },
    ],
    controlOverrides: {
      entity: {
        label: t('ISO 3166-2 codes of region/province/department'),
        description: t('It\'s ISO 3166-2 of your region/province/department in your table. (see documentation for list of ISO 3166-2)'),
      },
      metric: {
        label: t('Metric'),
        description: 'Metric to display bottom title',
      },
      linear_color_scheme: {
        renderTrigger: false,
      },
    },
  },
  world_map: {
    label: t('World Map'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['entity'],
          ['country_fieldtype'],
          ['metric'],
        ],
      },
      {
        label: t('Bubbles'),
        controlSetRows: [
          ['show_bubbles'],
          ['secondary_metric'],
          ['max_bubble_size'],
        ],
      },
    ],
    controlOverrides: {
      entity: {
        label: t('Country Control'),
        description: t('3 letter code of the country'),
      },
      metric: {
        label: t('Metric for color'),
        description: t('Metric that defines the color of the country'),
      },
      secondary_metric: {
        label: t('Bubble size'),
        description: t('Metric that defines the size of the bubble'),
      },
    },
  },

  filter_box: {
    label: t('Filter Box'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['groupby'],
          ['metric'],
          ['index_tree_source'],
          ['tree_order_dict'],
          ['date_filter', 'instant_filtering'],
          ['show_sqla_time_granularity', 'show_sqla_time_column'],
          ['show_druid_time_granularity', 'show_druid_time_origin'],
        ],
      },
    ],
    controlOverrides: {
      groupby: {
        label: t('Filter controls'),
        description: t(
          'The controls you want to filter on. Note that only columns ' +
          'checked as "filterable" will show up on this list.'),
        mapStateToProps: state => ({
          options: (state.datasource) ? state.datasource.columns.filter(c => c.filterable) : [],
        }),
      },
    },
  },

  filter_box_min: {
    label: t('Filter Box Min'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['groupby'],
          ['metric'],
          ['date_filter', 'instant_filtering'],
          ['show_sqla_time_granularity', 'show_sqla_time_column'],
          ['show_druid_time_granularity', 'show_druid_time_origin'],
          ['tabs_group'],
          ['group_is_tabs', null],
        ],
      },
    ],
    controlOverrides: {
      groupby: {
        label: t('Filter controls'),
        description: t(
          'The controls you want to filter on. Note that only columns ' +
          'checked as "filterable" will show up on this list.'),
        mapStateToProps: state => ({
          options: (state.datasource) ? state.datasource.columns.filter(c => c.filterable) : [],
        }),
      },
      date_filter: {
        default: false,
      },
    },
  },

  iframe: {
    label: t('iFrame'),
    controlPanelSections: [
      {
        label: t('Options'),
        controlSetRows: [
          ['url'],
          ['iframe_by_token', 'iframe_app_name'],
          ['slice_data_from'],
          ['hide_chart_header', null],
        ],
      },
    ],
  },

  para: {
    label: t('Parallel Coordinates'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['series'],
          ['metrics'],
          ['secondary_metric'],
          ['limit'],
        ],
      },
      {
        label: t('Options'),
        controlSetRows: [
          ['show_datatable', 'include_series'],
        ],
      },
    ],
  },

  heatmap: {
    label: t('Heatmap'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['all_columns_x', 'all_columns_y'],
          ['metric', 'row_limit'],
        ],
      },
      {
        label: t('Heatmap Options'),
        controlSetRows: [
          ['linear_color_scheme'],
          ['xscale_interval', 'yscale_interval'],
          ['canvas_image_rendering', 'normalize_across'],
          ['left_margin', 'bottom_margin'],
          ['y_axis_bounds', 'y_axis_format'],
          ['show_legend', 'show_perc'],
          ['show_values'],
          ['sort_x_axis', 'sort_y_axis'],
        ],
      },
    ],
    controlOverrides: {
      all_columns_x: {
        validators: [v.nonEmpty],
      },
      all_columns_y: {
        validators: [v.nonEmpty],
      },
      y_axis_bounds: {
        label: t('Value bounds'),
        renderTrigger: false,
        description: (
          'Hard value bounds applied for color coding. Is only relevant ' +
          'and applied when the normalization is applied against the whole ' +
          'heatmap.'
        ),
      },
      y_axis_format: {
        label: t('Value Format'),
      },
    },
  },

  horizon: {
    label: t('Horizon'),
    controlPanelSections: [
      sections.NVD3TimeSeries[0],
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['series_height', 'horizon_color_scale'],
        ],
      },
    ],
  },

  mapbox: {
    label: t('Mapbox'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['all_columns_x', 'all_columns_y'],
          ['clustering_radius'],
          ['row_limit'],
          ['groupby'],
        ],
      },
      {
        label: t('Points'),
        controlSetRows: [
          ['point_radius'],
          ['point_radius_unit'],
        ],
      },
      {
        label: t('Labelling'),
        controlSetRows: [
          ['mapbox_label'],
          ['pandas_aggfunc'],
        ],
      },
      {
        label: t('Visual Tweaks'),
        controlSetRows: [
          ['render_while_dragging'],
          ['mapbox_style'],
          ['global_opacity'],
          ['mapbox_color'],
        ],
      },
      {
        label: t('Viewport'),
        controlSetRows: [
          ['viewport_longitude', 'viewport_latitude'],
          ['viewport_zoom', null],
        ],
      },
    ],
    controlOverrides: {
      all_columns_x: {
        label: t('Longitude'),
        description: t('Column containing longitude data'),
      },
      all_columns_y: {
        label: t('Latitude'),
        description: t('Column containing latitude data'),
      },
      pandas_aggfunc: {
        label: t('Cluster label aggregator'),
        description: t('Aggregate function applied to the list of points ' +
          'in each cluster to produce the cluster label.'),
      },
      rich_tooltip: {
        label: t('Tooltip'),
        description: t('Show a tooltip when hovering over points and clusters ' +
          'describing the label'),
      },
      groupby: {
        description: t('One or many controls to group by. If grouping, latitude ' +
          'and longitude columns must be present.'),
      },
    },
  },

  event_flow: {
    label: t('Event flow'),
    requiresTime: true,
    controlPanelSections: [
      {
        label: t('Event definition'),
        controlSetRows: [
          ['entity'],
          ['all_columns_x'],
          ['row_limit'],
          ['order_by_entity'],
          ['min_leaf_node_event_count'],
        ],
      },
      {
        label: t('Additional meta data'),
        controlSetRows: [
          ['all_columns'],
        ],
      },
    ],
    controlOverrides: {
      entity: {
        label: t('Column containing entity ids'),
        description: t('e.g., a "user id" column'),
      },
      all_columns_x: {
        label: t('Column containing event names'),
        validators: [v.nonEmpty],
        default: control => (
          control.choices && control.choices.length > 0 ?
            control.choices[0][0] : null
        ),
      },
      row_limit: {
        label: t('Event count limit'),
        description: t('The maximum number of events to return, equivalent to number of rows'),
      },
      all_columns: {
        label: t('Meta data'),
        description: t('Select any columns for meta data inspection'),
      },
    },
  },

// added by custom---start
  echarts_funnel: {
    label: t('Funnel View'),
    showOnExplore: true,
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['metrics', 'groupby'],
          ['limit'],
        ],
      },
      {
        label: t('Chart Options'),
        controlSetRows: [
          ['color_scheme'],
        ],
      },
    ],
  },

  echarts_stat_line: {
    label: t('Statistic Line View'),
    showOnExplore: true,
    controlPanelSections: [
      {
        label: t('Option'),
        expanded: true,
        description: t('Use this section if you want to query atomic rows'),
        controlSetRows: [
          ['metrics'],
          ['all_columns'],
          ['day_shift_for_annual_start_days', 'legend_type'],
          ['left_axis_min_value', 'left_axis_max_value'],
          ['day_shift', 'day_skip'],
          ['first_fillna_method', 'second_fillna_method'],
          ['day_shift_for_month_display', 'fill_fix'],
          ['only_show_first_day_in_month', 'show_lastvalue'],
          ['divide_start', 'sub_start'],
          ['y_axis_format', 'x_axis_showminmax'],
          ['stroke_width', 'stroke_type'],
          ['chart_symbol', 'symbol_size'],
          ['chart_description1'],
          ['slice_data_from'],
        ],
      },
      {
        label: t('Advanced Analytics'),
        description: t('This section contains options ' +
        'that allow for advanced analytical post processing ' +
        'of query results'),
        controlSetRows: [
          ['whether_accumulate', 'wether_avg_minus', 'show_t_h_bi'],
          ['tongbi', 'huanbi'],
          ['x_axis_time_format'],
          ['lowest_limit', 'highest_limit'],
          ['series_color'],
          ['legend_selected_index'],
          ['series_line_width_order'],
          sections.NVD3TimeSeries[1].controlSetRows[0],
          // ['editor_content'],
          ['chartGrid'],
        ],
      },
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['color_scheme'],
        ],
      },
    ],
    controlOverrides: {
      chart_symbol: {
        label: t('折线标记'),
      },
      metrics: {
        validators: null,
        default: null,
      },
      y_axis_format: {
        default: '',
      },
      color_scheme: {
        default: 'bnbColors1',
      },
      show_lastvalue: {
        default: true,
      },
      stroke_width: {
        label: t('Current Year Stroke Width'),
        description: t('Current Year Stroke Width'),
        default: 2,
        renderTrigger: true,
      },
      stroke_type: {
        label: t('Current Year Stroke Type'),
        description: t('Current Year Stroke Type'),
        renderTrigger: true,
      },
    },
  },

  echarts_stat_line_2: {
    label: t('Statistic Line 2 View'),
    showOnExplore: true,
    controlPanelSections: [
      {
        label: t('Option'),
        expanded: true,
        description: t('Use this section if you want to query atomic rows'),
        controlSetRows: [
          ['metrics'],
          ['all_columns'],
          ['day_shift_for_annual_start_days', 'legend_type'],
          ['left_axis_min_value', 'left_axis_max_value'],
          ['right_axis_min_value', 'right_axis_max_value'],
          ['show_y_min_max_strict', null],
          ['brushExtentStart_yAxis', 'brushExtentEnd_yAxis'],
          ['day_shift', 'day_skip'],
          ['first_fillna_method', 'second_fillna_method'],
          ['day_shift_for_month_display', 'fill_fix'],
          ['stroke_width', 'stroke_type'],
          // ['stroke_color_picker', 'current_color_prior'],
          ['chart_symbol', 'symbol_size'],
          ['y_axis_format', 'data_display_type'],
          ['show_lastvalue', 'x_axis_showminmax'],
          ['divide_start', 'sub_start'],
          ['only_show_first_day_in_month', 'whether_show_average_line'],
          ['connect_nulls', 'showAllSymbol'],
          ['chart_description1'],
          ['slice_data_from'],
        ],
      },
      {
        label: t('Advanced Analytics'),
        description: t('This section contains options ' +
        'that allow for advanced analytical post processing ' +
        'of query results'),
        controlSetRows: [
          ['whether_accumulate', 'wether_avg_minus', 'show_t_h_bi'],
          ['tongbi', 'huanbi'],
          ['x_axis_time_format'],
          ['lowest_limit', 'highest_limit'],
          ['series_color'],
          ['legend_selected_index'],
          ['series_line_width_order'],
          ['chartGrid'],
          sections.NVD3TimeSeries[1].controlSetRows[0],
          ['exec_code'],
        ],
      },
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['color_scheme'],
        ],
      },
      {
        label: t('Echarts Options'),
        expanded: true,
        controlSetRows: [
          ['echarts_options'],
        ],
      },
      sections.annotations,
    ],
    controlOverrides: {
      metrics: {
        validators: null,
        default: null,
      },
      stroke_width: {
        label: t('Current Year Stroke Width'),
        description: t('Current Year Stroke Width'),
        default: 5,
        renderTrigger: true,
      },
      stroke_type: {
        label: t('Current Year Stroke Type'),
        description: t('Current Year Stroke Type'),
        renderTrigger: true,
      },
      // stroke_color_picker: {
      //   label: t('Current Year Stroke Color'),
      //   description: t('Current Year Stroke Color'),
      //   default: { r: 213, g: 26, b: 33, a: 1 },
      // },
      show_lastvalue: {
        default: true,
      },
      y_axis_format: {
        default: '',
      },
      connect_nulls: {
        default: true,
      },
      color_scheme: {
        default: 'bnbColors1',
      },
    },
  },

  echarts_analysis_pie: {
    label: t('Analysis Pie Chart'),
    showOnExplore: true,
    controlPanelSections: [
      {
        label: t('Option'),
        expanded: true,
        description: t('Use this section if you want to query atomic rows'),
        controlSetRows: [
          ['entity', 'series'],
          ['auto_play', 'display_date_in_tile'],
          ['auto_play_interval', null],
          ['pie_title', 'max_radius'],
          ['visual_map_min_value', 'visual_map_max_value'],
          ['world_flow_linear_color_scheme'],
          ['text_replace'],
        ],
      },
    ],
    controlOverrides: {
      entity: {
        label: t('Index Column'),
        description: t('Index Column'),
      },
      text_replace: {
        label: t('指标名替换,例如:{"原名":"新名"}'),
        description: t('指标名替换,例如：{"原名":"新名","原名1":"新名1"}'),
      },
      series: {
        label: t('Index Value'),
        description: t('Index Value'),
        validators: [v.nonEmpty],
        mapStateToProps: state => ({
          choices: (state.datasource) ? state.datasource.all_cols : [],
        }),
      },
      max_radius: {
        label: t('Pie Radius'),
      },
      world_flow_linear_color_scheme: {
        label: t('Analysis Pie Linear Color Scheme'),
        description: t('Analysis Pie Linear Color Scheme'),
      },
      visual_map_min_value: {
        label: t('Pie Visual Map Min Value'),
        description: t('Pie Visual Map Min Value'),
      },
      visual_map_max_value: {
        label: t('Pie Visual Map Max Value'),
        description: t('Pie Visual Map Max Value'),
      },
    },
  },

  echarts_periodogram: {
    label: t('Periodogram View'),
    showOnExplore: true,
    controlPanelSections: [
      {
        label: t('Option'),
        expanded: true,
        description: t('Use this section if you want to query atomic rows'),
        controlSetRows: [
          ['all_columns_custom'],
          ['left_axis_min_value', 'left_axis_max_value'],
          ['days_used_for_truncation'],
          ['truncation_custom'],
          ['first_fillna_method', 'second_fillna_method'],
          ['wether_divide_first'],
        ],
      },
    ],
    controlOverrides: {
      metrics: {
        validators: null,
        default: null,
      },
    },
  },

  echarts_category_line: {
    label: t('Category Line View'),
    showOnExplore: true,
    controlPanelSections: [
      {
        label: t('Axis definition'),
        expanded: true,
        controlSetRows: [
          ['entity', 'metrics'],
          ['range_labels'],
          ['index_order'],
          ['alias_labels'],
          ['chartGrid'],
          ['left_axis_min_value', 'left_axis_max_value', 'first_fillna_method'],
          ['all_lines_start_at_the_same_zero_point'],
          ['all_lines_end_at_the_same_zero_point'],
          ['whether_show_all_X_axis_label'],
          ['whether_use_average_historical_data'],
          ['show_bar_value', 'column_isdate'],
          ['slice_data_from'],
        ],
      },
      {
        label: t('Select Display days'),
        expanded: true,
        controlSetRows: [
          ['select_today', 'select_7D', 'select_1M', 'select_3M', 'select_1Y', 'select_everyday', 'standard'],
          ['area_list'],
        ],
      },
    ],
    controlOverrides: {
      entity: {
        label: t('Column used for X-axis'),
        description: t('Column used for X-axis'),
      },
      show_bar_value: {
        label: t('显示为Bar'),
        description: t('显示为Bar'),
      },
      first_fillna_method: {
        default: 'None',
      },
      column_isdate: {
        label: t('Legend显示为日期'),
        description: t('Legend显示为日期'),
        renderTrigger: false,
      },
      series: {
        label: t('Column used for Y-axis'),
        description: t('Column used for Y-axis'),
        validators: [v.nonEmpty],
        mapStateToProps: state => ({
          choices: (state.datasource) ? state.datasource.all_cols : [],
        }),
      },
      range_labels: {
        label: t('X轴类目顺序,例如: 类目A|类目B'),
        description: t('X轴类目顺序,例如: 类目A|类目B'),
      },
      index_order: {
        label: t('x轴月度自动调整规则,优先级高'),
        description: t('示例：{"5":["指标2","指标1","指标3"],"9":["指标3","指标1","指标2"],"12":["指标1","指标3","指标2"]},5,9,12指的是指标最大日期的月份'),
      },
      area_list: {
        label: t('自定义日期,例如: -1|-3|-100'),
        description: t('自定义日期,例如: -1|-3|-100'),
      },
    },
  },

  echarts_correlation: {
    label: t('Correlation Line View'),
    showOnExplore: true,
    controlPanelSections: [
      {
        label: t('Axis definition'),
        expanded: true,
        controlSetRows: [
          ['entity', 'series'],
          ['rolling_periods', 'brushExtentStart'],
          ['left_axis_use_histogram', 'right_axis_use_histogram'],
          ['swap_left_and_right_axis', 'left_axis_use_reverse_order'],
          ['series_color'],
        ],
      },
    ],
    controlOverrides: {
      rolling_periods: {
        label: t('Correlation Parameter'),
        description: t('Parameter set for correlation'),
        default: 30,
      },
      entity: {
        label: t('Instrument Column'),
        description: t('Instrument Column'),
      },
      series: {
        label: t('Column used for Y-axis'),
        description: t('Column used for Y-axis'),
        validators: [v.nonEmpty],
        mapStateToProps: state => ({
          choices: (state.datasource) ? state.datasource.all_cols : [],
        }),
      },
    },
  },

  echarts_world_flow: {
    label: t('World Flow Chart'),
    showOnExplore: true,
    controlPanelSections: [
      {
        label: t('Axis definition'),
        expanded: true,
        controlSetRows: [
          ['from_city', 'to_city'],
          ['city_flow_value', 'city_name'],
          ['city_longitude', 'city_latitude'],
          ['country_name', 'country_weight'],
          ['lable_format', null],
          ['show_area_name', 'show_area_value', 'arrow_loop'],
        ],
      }, {
        label: t('Visual definition'),
        expanded: true,
        controlSetRows: [
          ['map_select', 'map_zoom_factor'],
          ['map_center_longitude', 'map_center_latitude'],
          ['visual_map_min_value', 'visual_map_max_value'],
          ['world_flow_linear_color_scheme'],
          ['country_linear_color_scheme'],
        ],
      },
    ],
  },

  echarts_yoy_and_mom: {
    label: t('YoY and MoM Chart'),
    showOnExplore: true,
    controlPanelSections: [
      {
        label: t('Axis definition'),
        expanded: true,
        controlSetRows: [
          ['entity', 'series'],
          ['left_axis_min_value', 'left_axis_max_value'],
          ['whether_show_YoY', 'whether_show_MoM'],
          ['data_aggregation_method', null],
        ],
      },
    ],
    controlOverrides: {
      entity: {
        label: t('Instrument Column'),
        description: t('Instrument Column'),
      },
      series: {
        label: t('Column used for Y-axis'),
        description: t('Column used for Y-axis'),
        validators: [v.nonEmpty],
        mapStateToProps: state => ({
          choices: (state.datasource) ? state.datasource.all_cols : [],
        }),
      },
    },
  },

  echarts_comparison: {
    label: t('Comparison Line View'),
    showOnExplore: true,
    controlPanelSections: [
      {
        label: t('Axis definition'),
        expanded: true,
        controlSetRows: [
          ['entity', 'series'],
          ['left_axis_min_value', 'left_axis_max_value'],
          ['right_axis_min_value', 'right_axis_max_value'],
          ['y_axis_format_left', 'y_axis_format_right'],
          ['left_axis_use_histogram', 'right_axis_use_histogram'],
          ['swap_left_and_right_axis', 'left_axis_use_reverse_order'],
          ['show_brush', 'brushExtentStart'],
          ['alias_labels'],
        ],
      },
      {
        label: t('Shift definition'),
        expanded: true,
        controlSetRows: [
          ['shift_indexes'],
          ['day_shift', null],
          ['shift_days_shows_in_YYYYMMDD'],
        ],
      },
    ],
    controlOverrides: {
      day_shift: {
        label: t('Shift Days'),
        description: t('Shift Days'),
        default: 0,
      },
      entity: {
        label: t('Instrument Column'),
        description: t('Instrument Column'),
      },
      series: {
        label: t('Column used for Y-axis'),
        description: t('Column used for Y-axis'),
        validators: [v.nonEmpty],
        mapStateToProps: state => ({
          choices: (state.datasource) ? state.datasource.all_cols : [],
        }),
      },
    },
  },

  echarts_events: {
    label: t('Line With Events View'),
    showOnExplore: true,
    requiresTime: true,
    controlPanelSections: [
      {
        label: t('Axis definition'),
        expanded: true,
        controlSetRows: [
          ['entity', 'x_axis_time_format'],
          ['series', 'column_for_events_display'],
          ['left_axis_min_value', 'left_axis_max_value'],
          ['X_axis_zoom_start', 'X_axis_zoom_end'],
        ],
      },
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['color_scheme'],
          ['x_axis_format'],
        ],
      },
        sections.annotations,
    ],
    controlOverrides: {
      entity: {
        label: t('列'),
        description: t('列'),
      },
      x_axis_time_format: {
        description: t('X Axis Format'),
        default: '',
      },
      series: {
        label: t('Column used for Y-axis'),
        description: t('Column used for Y-axis'),
        validators: [v.nonEmpty],
        mapStateToProps: state => ({
          choices: (state.datasource) ? state.datasource.all_cols : [],
        }),
      },
    },
  },

  echarts_combine: {
    label: t('Combine Chart View'),
    showOnExplore: true,
    controlPanelSections: [
      {
        label: t('Option'),
        expanded: true,
        controlSetRows: [
          ['entity'],
          ['metrics'],
          ['columns'],
          ['row_limit', null],
          ['left_axis_use_reverse_order', 'x_axis_showminmax'],
          ['boundaryGap', 'whether_show_average_line'],
          ['left_axis_min_value', 'left_axis_max_value'],
          ['right_axis_min_value', 'right_axis_max_value'],
          ['connect_nulls', 'is_item'],
          ['show_bar_value', 'legend_right'],
          ['lable_format'],
          ['barGap', 'barCategoryGap'],
          ['first_fillna_method', 'second_fillna_method'],
          ['columns_value_display_on_the_right_Y_axis'],
          ['columns_value_represent_by_histogram'],
          ['columns_value_represent_by_area'],
          ['series_color'],
          ['alias_labels'],
          ['opacity', 'x_axis_format'],
          ['x_is_time', 'bar_expand', 'mm_dd_align'],
          ['area_list'],
          ['column_order_list'],
          ['index_slice_order'],
          ['y_axis_format_left', 'y_axis_format_right'],
          ['chartGrid'],
          ['tooltip_position'],
          ['chart_description1'],
          ['slice_data_from'],
          ['shift_indexes_set'],
          ['cross_period'],
          ['stroke_color_picker', 'current_color_prior'],
          ['show_brush', 'brushExtentStart'],
          ['stroke_width', 'show_lastvalue'],
          ['event_list'],
          ['exec_code'],
          ['exec_code1'],
          ['if_show_table'],
        ],
      },
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['color_scheme'],
        ],
      },
      {
        label: t('Echarts Options'),
        expanded: true,
        controlSetRows: [
          ['echarts_options'],
        ],
      },
    ],
    controlOverrides: {
      entity: {
        label: t('分组'),
        description: t('分组'),
        validators: [],
        multi: true,
      },
      event_list: {
        label: t('自定义事件,如: 2|20220131|某一个事情,多个事情请换行输入,2是指标的顺序'),
        description: t('自定义事件,如: 2|20220131|某一个事情,多个事情请换行输入,2是指标的顺序'),
      },
      bar_expand: {
        label: t('百分比'),
      },
      column_order_list: {
        label: t('列排序，例如:["指标2","指标1"]'),
        description: t('列排序，例如:["指标2","指标1"]'),
      },
      x_axis_format: {
        choices: D3_TIME_FORMAT_OPTIONS,
        default: '',
      },
      x_axis_showminmax: {
        default: true,
      },
      left_axis_use_reverse_order: {
        default: false,
      },
      metrics: {
        default: null,
      },
      columns: {
        label: t('x轴文本列'),
        includeTime: true,
        default: ['__timestamp'],
        description: t('x轴文本列'),
      },
      current_color_prior: {
        default: false,
      },
      stroke_color_picker: {
        label: t('Current Year Stroke Color'),
        description: t('Current Year Stroke Color'),
        default: { r: 213, g: 26, b: 33, a: 1 },
      },
      stroke_width: {
        label: t('Current Year Stroke Width'),
        description: t('Current Year Stroke Width'),
        renderTrigger: true,
      },
      whether_show_average_line: {
        default: false,
        renderTrigger: false,
      },
      exec_code1: {
        label: t('自定义表格'),
        description: t('自定义表格'),
      },
      row_limit: {
        default: 50000,
      },
    },
  },

  echarts_dist_combine: {
    label: t('Dist Combine Chart View'),
    showOnExplore: true,
    controlPanelSections: [
      {
        label: t('Option'),
        expanded: true,
        controlSetRows: [
          ['metrics'],
          ['groupby'],
          ['row_limit'],
          ['connect_nulls', 'xy_reversal'],
          ['show_bar_value', 'lable_format'],
          ['lable_set'],
          ['legend_set'],
          ['columns_value_represent_by_histogram'],
          ['show_group_totitle'],
          ['columns_by_stack'],
          ['series_color'],
          ['alias_labels'],
          ['column_order_list'],
          ['column_order_type'],
          ['y_axis_format'],
          ['chartGrid'],
          ['xAxisAxisLabel'],
          ['yAxisAxisLabel'],
          ['xAxissplitLine'],
          ['barColor'],
          ['slice_data_from'],
        ],
      },
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['color_scheme'],
        ],
      },
    ],
    controlOverrides: {
      entity: {
        label: t('分组'),
        description: t('分组'),
      },
      column_order_list: {
        label: t('列排序，例如:["指标2","指标1"]'),
        description: t('列排序，例如:["指标2","指标1"]'),
      },
      column_order_type: {
        label: t('指标排序方式：{"指标1":"asc"},asc:正序、desc:倒序'),
        description: t('{"指标1":"asc","指标2":"asc"},asc:正序、desc:倒序'),
      },
      x_axis_format: {
        choices: D3_TIME_FORMAT_OPTIONS,
        default: '',
      },
      x_axis_showminmax: {
        default: true,
      },
      left_axis_use_reverse_order: {
        default: false,
      },
      metrics: {
        default: null,
      },
      columns: {
        label: t('x轴文本列'),
        includeTime: true,
        default: ['__timestamp'],
        description: t('x轴文本列'),
      },
      current_color_prior: {
        default: false,
      },
      stroke_color_picker: {
        label: t('Current Year Stroke Color'),
        description: t('Current Year Stroke Color'),
        default: { r: 213, g: 26, b: 33, a: 1 },
      },
      stroke_width: {
        label: t('Current Year Stroke Width'),
        description: t('Current Year Stroke Width'),
        renderTrigger: true,
      },
      whether_show_average_line: {
        default: false,
        renderTrigger: false,
      },
      exec_code1: {
        label: t('自定义表格'),
        description: t('自定义表格'),
      },
    },
  },

  echarts_multiple_y: {
    label: t('Multiple Y Axes Chart View'),
    showOnExplore: true,
    controlPanelSections: [
      {
        label: t('Option'),
        expanded: true,
        controlSetRows: [
          ['entity'],
          ['metrics'],
          ['columns'],
          ['left_axis_use_reverse_order', 'x_axis_showminmax'],
          ['boundaryGap', 'show_y_min_max_strict'],
          ['left_axis_min_value', 'left_axis_max_value'],
          ['rightYaxisMinMax'],
          ['connect_nulls', 'show_bar_value'],
          ['show_lastvalue', 'lable_format'],
          ['barGap', 'barCategoryGap'],
          ['first_fillna_method', 'second_fillna_method'],
          ['columns_value_represent_by_histogram'],
          ['columns_value_represent_by_area'],
          ['series_color'],
          ['alias_labels'],
          ['chartGrid'],
          ['opacity', 'x_axis_format'],
          ['area_list'],
          ['column_order_list'],
          ['y_axis_format_left', 'y_axis_format_right'],
          ['y_axis_format_right2', 'y_axis_format_right3'],
          ['rightMulYaxisFormat'],
          ['show_brush', 'brushExtentStart'],
          ['slice_data_from'],
        ],
      },
    ],
    controlOverrides: {
      entity: {
        label: t('分组'),
        description: t('分组'),
      },
      column_order_list: {
        label: t('列排序，例如:["指标2","指标1"]'),
        description: t('列排序，例如:["指标2","指标1"]'),
      },
      x_axis_format: {
        choices: D3_TIME_FORMAT_OPTIONS,
        default: '',
      },
      x_axis_showminmax: {
        default: true,
      },
      left_axis_use_reverse_order: {
        default: false,
      },
      metrics: {
        default: null,
      },
      columns: {
        label: t('x轴文本列'),
        includeTime: true,
        default: ['__timestamp'],
        description: t('x轴文本列'),
      },
    },
  },


    echarts_scatter: {
    label: t('Scatter Chart View'),
    showOnExplore: true,
    controlPanelSections: [
      {
        label: t('Option'),
        expanded: true,
        controlSetRows: [
          ['entity'],
          ['all_columns'],
          ['metrics'],
          ['color_scheme'],
          ['y_axis_format_left', 'y_axis_format_right'],
          ['metric_caption'],
          ['column_order_list'],
          ['size_from', 'color_picker'],
          ['left_axis_min_value', 'left_axis_max_value'],
        ],
      },
    ],
    controlOverrides: {
      entity: {
        label: t('分组(选择了指标时) | 列(未选指标时)'),
        description: t('分组(选择了指标时) | 列(未选指标时)'),
      },
      column_order_list: {
        label: t('X,Y轴对应指标，例如:["指标1(X轴)","指标2(Y轴)"]'),
        description: t('X,Y轴对应指标，例如:["指标1(X轴)","指标2(Y轴)"]'),
      },
      size_from: {
        label: t('圆点大小'),
        description: t('圆点大小'),
        default: 10,
      },
      y_axis_format_left: {
        label: t('Y轴格式'),
        description: t('Y轴格式'),
      },
      y_axis_format_right: {
        label: t('X轴格式'),
        description: t('X轴格式'),
      },
      metric_caption: {
        label: t('轴标题,例如：{"x":"x轴标题","y":"y轴标题"}'),
        description: t('轴标题,例如：{"x":"x轴标题","y":"y轴标题"}'),
        default: '',
      },
      x_axis_format: {
        choices: D3_TIME_FORMAT_OPTIONS,
        default: '',
      },
      metrics: {
        validators: null,
        default: null,
      },
      color_picker: {
        label: t('最新值顔色'),
        description: t('最新值顔色'),
        default: { r: 255, g: 125, b: 54, a: 1 },
      },
    },
  },

  echarts_dynamic_line_chart: {
    label: t('Dynamic Line Chart View'),
    showOnExplore: true,
    controlPanelSections: [
      {
        label: t('Option'),
        expanded: true,
        controlSetRows: [
          ['history_data_interface_url'],
          ['latest_data_interface_url'],
          ['date_column_name'],
          ['value_column_name'],
          ['value_type', 'chart_title'],
          ['whether_use_accumulate_value', 'refresh_interval'],
        ],
      },
    ],
  },

  echarts_thermodynamic_chart: {
    label: t('Thermodynamic Chart View'),
    showOnExplore: true,
    controlPanelSections: [
      {
        label: t('Option'),
        expanded: true,
        controlSetRows: [
          ['latest_data_interface_url'],
          ['date_column_name'],
          ['value_column_name'],
        ],
      },
    ],
  },

  echarts_bolling_bond: {
    label: t('Bolling Bond View'),
    showOnExplore: true,
    controlPanelSections: [
      {
        label: t('Axis definition'),
        expanded: true,
        controlSetRows: [
          ['entity', 'series'],
          ['rolling_periods', null],
          ['left_axis_min_value', 'left_axis_max_value'],
        ],
      },
      {
        label: t('Bolling Bond Options'),
        expanded: true,
        controlSetRows: [
          ['bolling_ratio_1', 'whether_show_bolling_1_at_beginning'],
          ['bolling_ratio_2', 'whether_show_bolling_2_at_beginning'],
          ['day_shift', null],
        ],
      },
    ],
    controlOverrides: {
      day_shift: {
        label: t('Lag Days'),
        description: t('Lag Days'),
        default: 0,
      },
      rolling_periods: {
        label: t('Mean Average Parameter'),
        description: t('Mean Average Parameter'),
        default: 20,
      },
      entity: {
        label: t('Instrument Column'),
        description: t('Instrument Column'),
      },
      series: {
        label: t('Column used for Y-axis'),
        description: t('Column used for Y-axis'),
        validators: [v.nonEmpty],
        mapStateToProps: state => ({
          choices: (state.datasource) ? state.datasource.all_cols : [],
        }),
      },
    },
  },

  highcharts_candle_stick: {
    label: t('Candle Stick View'),
    showOnExplore: true,
    controlPanelSections: [
      {
        label: t('Option'),
        expanded: true,
        description: t('Use this section if you want to query atomic rows'),
        controlSetRows: [
          ['all_columns'],
          ['whether_show_ma_at_beginning', 'show_lastvalue'],
          ['kline_x_axis_start', 'kline_x_axis_end'],
          ['series_color'],
          ['fields_map'],
          ['slice_data_from'],
        ],
      },
      {
        label: t('Chart Options'),
        controlSetRows: [
          ['color_scheme'],
        ],
      },
      sections.annotations,
    ],
    controlOverrides: {
      all_columns: {
        label: t('Columns, Please select open/high/low/close/volume'),
        description: t('Please select open/high/low/close/volume'),
      },
      series_color: {
        default: '{ "MA5": "orange","MA10": "Black", "MA20": "purple", "MA30": "blue" }',
      },
      show_lastvalue: {
        label: t('显示涨跌幅'),
        description: t('显示涨跌幅'),
      },
    },
  },

  echarts_season_lunar_calendar: {
    label: t('Season lunar calendar View'),
    showOnExplore: true,
    controlPanelSections: [
      {
        label: t('Option'),
        expanded: true,
        description: t('Use this section if you want to query atomic rows'),
        controlSetRows: [
          ['metrics'],
          ['all_columns'],
          ['day_shift_for_annual_start_days', 'legend_type'],
          ['left_axis_min_value', 'left_axis_max_value'],
          ['day_shift', 'day_skip'],
          ['day_shift_for_month_display', null],
          ['first_fillna_method', 'second_fillna_method'],
          ['whether_show_title', 'whether_show_average_line', 'show_min_max'],
          ['stroke_width', 'stroke_type'],
          ['stroke_color_picker', 'data_display_type'],
          ['y_axis_format', 'festival_type'],
          ['pre_days', 'after_days'],
          ['chart_description1'],
          ['slice_data_from'],
        ],
      },
      {
        label: t('Advanced Analytics'),
        description: t('This section contains options ' +
        'that allow for advanced analytical post processing ' +
        'of query results'),
        controlSetRows: [
          ['whether_accumulate', 'tongbi'],
          ['lowest_limit', 'highest_limit'],
          ['series_color'],
          ['legend_selected'],
          sections.NVD3TimeSeries[1].controlSetRows[0],
        ],
      },
    ],
    controlOverrides: {
      metrics: {
        validators: null,
        default: null,
      },
      stroke_width: {
        label: t('Current Year Stroke Width'),
        description: t('Current Year Stroke Width'),
        default: 3,
        renderTrigger: true,
      },
      stroke_type: {
        label: t('Current Year Stroke Type'),
        description: t('Current Year Stroke Type'),
        renderTrigger: true,
      },
      stroke_color_picker: {
        label: t('Current Year Stroke Color'),
        description: t('Current Year Stroke Color'),
      },
    },
  },

  echarts_radar: {
    label: t('Radar View'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['groupby', 'columns'],
          ['metrics'],
        ],
      },
      {
        label: t('Advanced Analytics'),
        expanded: true,
        description: t('This section contains options ' +
        'that allow for advanced analytical post processing ' +
        'of query results'),
        controlSetRows: [
          ['column_order_list'],
          ['text_replace'],
          ['date_time_format', 'color_picker'],
          ['series_color'],
          ['lowest_limit', 'highest_limit'],
          ['highlight_tick_zero', 'show_datatable'],
          ['stroke_width', 'stroke_color_picker'],
        ],
      },
    ],
    controlOverrides: {
      groupby: { includeTime: true },
      columns: { includeTime: true },
      date_time_format: {
        default: '',
      },
      column_order_list: {
        label: '指标顺序,例如["指标2","指标1"]',
        description: '指标顺序,例如["指标2","指标1"]',
        default: '',
      },
      show_datatable: {
        label: '显示近月差',
        description: '显示近月差',
      },
      text_replace: {
        label: t('指标名替换,例如:{"原名":"新名"}'),
        description: t('指标名替换,例如：{"原名":"新名","原名1":"新名1"}'),
      },
      highlight_tick_zero: {
        label: t('显示坐标轴线'),
        description: t('显示坐标轴轴线'),
      },
      stroke_width: {
        label: t('Current Year Stroke Width'),
        description: t('Current Year Stroke Width'),
        default: 3,
        renderTrigger: true,
      },
      stroke_color_picker: {
        label: t('Current Year Stroke Color'),
        description: t('Current Year Stroke Color'),
      },
      color_picker: {
        label: t('指标文本颜色'),
        description: t('指标文本颜色'),
        default: { r: 255, g: 102, b: 0, a: 1 },
      },
    },
  },

  ckeditor_slice: {
    label: t('CkEditor Slice'),
    controlPanelSections: [{
        label: t('Option'),
        expanded: false,
        description: t('Use this section if you want to query atomic rows'),
        controlSetRows: [
          ['show_cke_menu', 'hide_chart_header'],
          ['editor_content'],
        ],
      }],
  },

  echarts_share_data: {
    label: t('Share Data View'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['groupby'],
          ['metrics'],
        ],
      },
      {
        label: t('Advanced Analytics'),
        expanded: true,
        description: t('This section contains options ' +
        'that allow for advanced analytical post processing ' +
        'of query results'),
        controlSetRows: [
          ['line_list'],
        ],
      },
    ],
    controlOverrides: {
      groupby: { includeTime: true },
      columns: { includeTime: true },
    },
  },

  ag_grid: {
    label: t('agGrid分组汇总表格'),
    showOnExplore: true,
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['groupby'],
          ['metrics'],
          ['timeseries_limit_metric', 'row_limit'],
          ['include_time', 'order_desc'],
          ['all_columns'],
          ['all_columns_group'],
          ['column_aggfunc'],
          ['th_width'],
          ['number_format_column'],
          ['column_width_adapt', null, null],
          ['slice_data_from'],
        ],
      },
    ],
    controlOverrides: {
      all_columns: {
        label: t('Columns to display'),
        description: t('Columns to display'),
      },
      number_format_column: {
        label: t('列数字格式,例如：{"列A":".2f","列B":".2%"}'),
        description: t('列数字格式,例如：{"列A":".2f","列B":".2%"}'),
      },
      th_width: {
        label: t('列宽度,例如：{"分组列":20,"列名":20},分组列名固定为:分组列'),
        description: t('列宽度,例如：{"group":20,"列名":20},分组列名固定为:分组列'),
      },
      metrics: {
        validators: [],
      },
    },
  },

   echarts_bubble: {
    label: t('Echarts Bubble(气泡) Chart'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['series', 'entity'],
          ['x', 'y'],
          ['size', 'max_bubble_size'],
          ['show_hsl_bg_zero', 'y_axis_2_format'],
          ['x_axis_format', 'y_axis_format'],
          ['chartGrid'],
          ['xTitleGrid'],
          ['yTitleGrid'],
          ['exec_code'],
          ['editor_content'],
        ],
      },
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['color_scheme'],
          ['show_legend', null],
          ['opacity'],
        ],
      }
    ],
     controlOverrides: {
       entity: {
         label: t('气泡图Legend'),
         description: t('分组字段,用于显示气泡图Legend'),
       },
       series: {
         label: t('气泡Label,不选时使用Legend字段'),
         description: t('气泡Label,不选时使用Legend字段,不能和Legend选一样的字段'),
       },
       show_legend: {default: false,},
       opacity: {default: 0.4,},
       y_axis_2_format: {
        label: t('泡泡大小字段格式'),
        description: t('泡泡大小字段格式'),
        renderTrigger: true,
       }
     },
  },

//  added by custom---end

  paired_ttest: {
    label: t('Time Series - Paired t-test'),
    showOnExplore: true,
    requiresTime: true,
    controlPanelSections: [
      sections.NVD3TimeSeries[0],
      {
        label: t('Paired t-test'),
        expanded: false,
        controlSetRows: [
          ['significance_level'],
          ['pvalue_precision'],
          ['liftvalue_precision'],
        ],
      },
    ],
  },

  rose: {
    label: t('Time Series - Nightingale Rose Chart'),
    showOnExplore: true,
    requiresTime: true,
    controlPanelSections: [
      sections.NVD3TimeSeries[0],
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['color_scheme'],
          ['number_format', 'date_time_format'],
          ['rich_tooltip', 'rose_area_proportion'],
        ],
      },
      sections.NVD3TimeSeries[1],
    ],
  },

  partition: {
    label: 'Partition Diagram',
    showOnExplore: true,
    controlPanelSections: [
      sections.NVD3TimeSeries[0],
      {
        label: t('Time Series Options'),
        expanded: true,
        controlSetRows: [
          ['time_series_option'],
        ],
      },
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['color_scheme'],
          ['number_format', 'date_time_format'],
          ['partition_limit', 'partition_threshold'],
          ['log_scale', 'equal_date_size'],
          ['rich_tooltip'],
        ],
      },
      sections.NVD3TimeSeries[1],
    ],
  },
};

export default visTypes;

export function sectionsToRender(vizType, datasourceType) {
  const viz = visTypes[vizType];
  return [].concat(
    sections.datasourceAndVizType,
    datasourceType === 'table' ? sections.sqlaTimeSeries : sections.druidTimeSeries,
    viz.controlPanelSections,
    datasourceType === 'table' ? sections.sqlClause : [],
    datasourceType === 'table' ? sections.filters[0] : sections.filters,
  );
}
