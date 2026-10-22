/**
 * This file exports all controls available for use in the different visualization types
 *
 * While the React components located in `controls/components` represent different
 * types of controls (CheckboxControl, SelectControl, TextControl, ...), the controls here
 * represent instances of control types, that can be reused across visualisation types.
 *
 * When controls are reused across viz types, their values are carried over as a user
 * changes the chart types.
 *
 * While the keys defined in the control itself get passed to the controlType as props,
 * here's a list of the keys that are common to all controls, and as a result define the
 * control interface:
 *
 * - type: the control type, referencing a React component of the same name
 * - label: the label as shown in the control's header
 * - description: shown in the info tooltip of the control's header
 * - default: the default value when opening a new chart, or changing visualization type
 * - renderTrigger: a bool that defines whether the visualization should be re-rendered
     when changed. This should `true` for controls that only affect the rendering (client side)
     and don't affect the query or backend data processing as those require to re run a query
     and fetch the data
 * - validators: an array of functions that will receive the value of the component and
     should return error messages when the value is not valid. The error message gets
     bubbled up to the control header, section header and query panel header.
 * - warning: text shown as a tooltip on a warning icon in the control's header
 * - error: text shown as a tooltip on a error icon in the control's header
 * - mapStateToProps: a function that receives the App's state and return an object of k/v
     to overwrite configuration at runtime. This is useful to alter a component based on
     anything external to it, like another control's value. For instance it's possible to
     show a warning based on the value of another component. It's also possible to bind
     arbitrary data from the redux store to the component this way.
 * - tabOverride: set to 'data' if you want to force a renderTrigger to show up on the `Data`
     tab, otherwise `renderTrigger: true` components will show up on the `Style` tab.
 *
 * Note that the keys defined in controls in this file that are not listed above represent
 * props specific for the React component defined as `type`. Also note that this module work
 * in tandem with `visTypes.js` that defines how controls are composed into sections for
 * each and every visualization type.
 */
import React from 'react';
import {
  formatSelectOptionsForRange,
  formatSelectOptions,
  mainMetric,
} from '../../modules/utils';
import * as v from '../validators';
import { colorPrimary, ALL_COLOR_SCHEMES, spectrums } from '../../modules/colors';
import { defaultViewport } from '../../modules/geo';
import MetricOption from '../../components/MetricOption';
import ColumnOption from '../../components/ColumnOption';
import OptionDescription from '../../components/OptionDescription';
import { t } from '../../locales';
import {integerPercent} from "../validators";

const D3_FORMAT_DOCS = 'D3 format syntax: https://github.com/d3/d3-format';

// input choices & options
const D3_FORMAT_OPTIONS = [
  ['.1s', '.1s | 12k'],
  ['.3s', '.3s | 12.3k'],
  ['.1%', '.1% | 12.3%'],
  ['.3%', '.3% | 1234543.210%'],
  ['.4r', '.4r | 12350'],
  ['.3f', '.3f | 12345.432'],
  ['+,', '+, | +12,345.4321'],
  ['$,.2f', '$,.2f | $12,345.43'],
];

const ROW_LIMIT_OPTIONS = [10, 50, 100, 250, 500, 1000, 5000, 10000, 50000];

const SERIES_LIMITS = [0, 5, 10, 25, 50, 100, 500];

export const D3_TIME_FORMAT_OPTIONS = [
  ['smart_date', 'Adaptative formating'],
  ['%d/%m/%Y', '%d/%m/%Y | 14/01/2019'],
  ['%m/%d/%Y', '%m/%d/%Y | 01/14/2019'],
  ['%Y-%m', '%Y-%m | 2019-01'],
  ['%Y-%m-%d', '%Y-%m-%d | 2019-01-14'],
  ['%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M:%S | 2019-01-14 01:32:10'],
  ['%d-%m-%Y %H:%M:%S', '%Y-%m-%d %H:%M:%S | 14-01-2019 01:32:10'],
  ['%H:%M:%S', '%H:%M:%S | 01:32:10'],
];

const timeColumnOption = {
  verbose_name: 'Time',
  column_name: '__timestamp',
  description: t(
   'A reference to the [Time] configuration, taking granularity into ' +
  'account'),
};
const sortAxisChoices = [
  ['alpha_asc', 'Axis ascending'],
  ['alpha_desc', 'Axis descending'],
  ['value_asc', 'sum(value) ascending'],
  ['value_desc', 'sum(value) descending'],
];

const groupByControl = {
  type: 'SelectControl',
  multi: true,
  label: t('Group by'),
  default: [],
  includeTime: false,
  description: t('One or many controls to group by'),
  optionRenderer: c => <ColumnOption column={c} showType />,
  valueRenderer: c => <ColumnOption column={c} />,
  valueKey: 'column_name',
  mapStateToProps: (state, control) => {
    const newState = {};
    if (state.datasource) {
      newState.options = state.datasource.columns.filter(c => c.groupby);
      if (control && control.includeTime) {
        newState.options.push(timeColumnOption);
      }
    }
    return newState;
  },
};

const sandboxUrl = (
  'https://github.com/apache/incubator-superset/' +
  'blob/master/superset/assets/javascripts/modules/sandbox.js');
const jsFunctionInfo = (
  <div>
    {t('For more information about objects are in context in the scope of this function, refer to the')}
    <a href={sandboxUrl}>
      {t(" source code of Superset's sandboxed parser")}.
    </a>.
  </div>
);

function jsFunctionControl(label, description, extraDescr = null, height = 100, defaultText = '') {
  return {
    type: 'TextAreaControl',
    language: 'javascript',
    label,
    description,
    height,
    default: defaultText,
    aboveEditorSection: (
      <div>
        <p>{description}</p>
        <p>{jsFunctionInfo}</p>
        {extraDescr}
      </div>
    ),
    mapStateToProps: state => ({
      warning: !state.common.conf.ENABLE_JAVASCRIPT_CONTROLS ?
        t('This functionality is disabled in your environment for security reasons.') : null,
      readOnly: !state.common.conf.ENABLE_JAVASCRIPT_CONTROLS,
    }),
  };
}

export const controls = {
  datasource: {
    type: 'DatasourceControl',
    label: t('Datasource'),
    default: null,
    description: null,
    mapStateToProps: state => ({
      datasource: state.datasource,
    }),
  },

  viz_type: {
    type: 'VizTypeControl',
    label: t('Visualization Type'),
    default: 'table',
    description: t('The type of visualization to display'),
  },

  metrics: {
    type: 'MetricsControl',
    multi: true,
    label: t('Metrics'),
    validators: [v.nonEmpty],
    default: (c) => {
      const metric = mainMetric(c.savedMetrics);
      return metric ? [metric] : null;
    },
    mapStateToProps: (state) => {
      const datasource = state.datasource;
      return {
        columns: datasource ? datasource.columns : [],
        savedMetrics: datasource ? datasource.metrics : [],
        datasourceType: datasource && datasource.type,
      };
    },
    description: t('One or many metrics to display'),
  },

  percent_metrics: {
    type: 'SelectControl',
    multi: true,
    label: t('Percentage Metrics'),
    valueKey: 'metric_name',
    optionRenderer: m => <MetricOption metric={m} showType />,
    valueRenderer: m => <MetricOption metric={m} />,
    mapStateToProps: state => ({
      options: (state.datasource) ? state.datasource.metrics : [],
    }),
    description: t('Metrics for which percentage of total are to be displayed'),
  },

  y_axis_bounds: {
    type: 'BoundsControl',
    label: t('Y Axis Bounds'),
    renderTrigger: true,
    default: [null, null],
    description: t('Bounds for the Y axis. When left empty, the bounds are ' +
    'dynamically defined based on the min/max of the data. Note that ' +
    "this feature will only expand the axis range. It won't " +
    "narrow the data's extent."),
  },

  order_by_cols: {
    type: 'SelectControl',
    multi: true,
    label: t('Ordering'),
    default: [],
    description: t('One or many metrics to display'),
    mapStateToProps: state => ({
      choices: (state.datasource) ? state.datasource.order_by_choices : [],
    }),
  },
  color_picker: {
    label: t('Fixed Color'),
    description: t('Use this to define a static color for all circles'),
    type: 'ColorPickerControl',
    default: colorPrimary,
    renderTrigger: true,
  },
  legend_position: {
    label: t('Legend Position'),
    description: t('Choose the position of the legend'),
    type: 'SelectControl',
    clearable: false,
    default: 'tr',
    choices: [
      ['tl', 'Top left'],
      ['tr', 'Top right'],
      ['bl', 'Bottom left'],
      ['br', 'Bottom right'],
    ],
    renderTrigger: true,
  },

  fill_color_picker: {
    label: t('Fill Color'),
    description: t(' Set the opacity to 0 if you do not want to override the color specified in the GeoJSON'),
    type: 'ColorPickerControl',
    default: colorPrimary,
    renderTrigger: true,
  },

  stroke_color_picker: {
    label: t('Stroke Color'),
    description: t(' Set the opacity to 0 if you do not want to override the color specified in the GeoJSON'),
    type: 'ColorPickerControl',
    default: colorPrimary,
    renderTrigger: true,
  },

  metric: {
    type: 'MetricsControl',
    multi: false,
    label: t('Metric'),
    clearable: false,
    validators: [v.nonEmpty],
    default: props => mainMetric(props.savedMetrics),
    mapStateToProps: state => ({
      columns: state.datasource ? state.datasource.columns : [],
      savedMetrics: state.datasource ? state.datasource.metrics : [],
      datasourceType: state.datasource && state.datasource.type,
    }),
  },

  metric_2: {
    type: 'SelectControl',
    label: t('Right Axis Metric'),
    default: null,
    validators: [v.nonEmpty],
    clearable: true,
    description: t('Choose a metric for right axis'),
    valueKey: 'metric_name',
    optionRenderer: m => <MetricOption metric={m} showType />,
    valueRenderer: m => <MetricOption metric={m} />,
    mapStateToProps: state => ({
      options: (state.datasource) ? state.datasource.metrics : [],
    }),
  },

  stacked_style: {
    type: 'SelectControl',
    label: t('Stacked Style'),
    renderTrigger: true,
    choices: [
      ['stack', 'stack'],
      ['stream', 'stream'],
      ['expand', 'expand'],
    ],
    default: 'stack',
    description: '',
  },

  sort_x_axis: {
    type: 'SelectControl',
    label: t('Sort X Axis'),
    choices: sortAxisChoices,
    clearable: false,
    default: 'alpha_asc',
  },

  sort_y_axis: {
    type: 'SelectControl',
    label: t('Sort Y Axis'),
    choices: sortAxisChoices,
    clearable: false,
    default: 'alpha_asc',
  },

  linear_color_scheme: {
    type: 'ColorSchemeControl',
    label: t('Linear Color Scheme'),
    choices: [
      ['fire', 'fire'],
      ['blue_white_yellow', 'blue/white/yellow'],
      ['white_black', 'white/black'],
      ['black_white', 'black/white'],
      ['dark_blue', 'light/dark blue'],
      ['pink_grey', 'pink/white/grey'],
    ],
    default: 'blue_white_yellow',
    clearable: false,
    description: '',
    renderTrigger: true,
    schemes: spectrums,
    isLinear: true,
  },

  normalize_across: {
    type: 'SelectControl',
    label: t('Normalize Across'),
    choices: [
      ['heatmap', 'heatmap'],
      ['x', 'x'],
      ['y', 'y'],
    ],
    default: 'heatmap',
    description: t('Color will be rendered based on a ratio ' +
    'of the cell against the sum of across this ' +
    'criteria'),
  },

  horizon_color_scale: {
    type: 'SelectControl',
    label: t('Horizon Color Scale'),
    choices: [
      ['series', 'series'],
      ['overall', 'overall'],
      ['change', 'change'],
    ],
    default: 'series',
    description: t('Defines how the color are attributed.'),
  },

  canvas_image_rendering: {
    type: 'SelectControl',
    label: t('Rendering'),
    renderTrigger: true,
    choices: [
      ['pixelated', 'pixelated (Sharp)'],
      ['auto', 'auto (Smooth)'],
    ],
    default: 'pixelated',
    description: t('image-rendering CSS attribute of the canvas object that ' +
    'defines how the browser scales up the image'),
  },

  xscale_interval: {
    type: 'SelectControl',
    label: t('XScale Interval'),
    choices: formatSelectOptionsForRange(1, 50),
    default: '1',
    description: t('Number of steps to take between ticks when ' +
    'displaying the X scale'),
  },

  yscale_interval: {
    type: 'SelectControl',
    label: t('YScale Interval'),
    choices: formatSelectOptionsForRange(1, 50),
    default: null,
    description: t('Number of steps to take between ticks when ' +
    'displaying the Y scale'),
  },

  include_time: {
    type: 'CheckboxControl',
    label: t('Include Time'),
    description: t('Whether to include the time granularity as defined in the time section'),
    default: false,
  },

  autozoom: {
    type: 'CheckboxControl',
    label: t('Auto Zoom'),
    default: true,
    renderTrigger: true,
    description: t('When checked, the map will zoom to your data after each query'),
  },

  show_perc: {
    type: 'CheckboxControl',
    label: t('Show percentage'),
    renderTrigger: true,
    description: t('Whether to include the percentage in the tooltip'),
    default: true,
  },

  bar_stacked: {
    type: 'CheckboxControl',
    label: t('Stacked Bars'),
    renderTrigger: true,
    default: false,
    description: null,
  },

  bar_expand: {
    type: 'CheckboxControl',
    label: t('Expanded Bars'),
    renderTrigger: true,
    default: false,
    description: null,
  },

  pivot_margins: {
    type: 'CheckboxControl',
    label: t('Show totals'),
    renderTrigger: false,
    default: true,
    description: t('Display total row/column'),
  },

  show_markers: {
    type: 'CheckboxControl',
    label: t('Show Markers'),
    renderTrigger: true,
    default: false,
    description: t('Show data points as circle markers on the lines'),
  },

  show_bar_value: {
    type: 'CheckboxControl',
    label: t('Bar Values'),
    default: false,
    renderTrigger: true,
    description: t('Show the value on top of the bar'),
  },

  order_bars: {
    type: 'CheckboxControl',
    label: t('Sort Bars'),
    default: false,
    renderTrigger: true,
    description: t('Sort bars by x labels.'),
  },

  combine_metric: {
    type: 'CheckboxControl',
    label: t('Combine Metrics'),
    default: false,
    description: t('Display metrics side by side within each column, as ' +
    'opposed to each column being displayed side by side for each metric.'),
  },

  show_controls: {
    type: 'CheckboxControl',
    label: t('Extra Controls'),
    renderTrigger: true,
    default: false,
    description: t('Whether to show extra controls or not. Extra controls ' +
    'include things like making mulitBar charts stacked ' +
    'or side by side.'),
  },

  reduce_x_ticks: {
    type: 'CheckboxControl',
    label: t('Reduce X ticks'),
    renderTrigger: true,
    default: true,
    description: t('Reduces the number of X axis ticks to be rendered. ' +
    'If true, the x axis wont overflow and labels may be ' +
    'missing. If false, a minimum width will be applied ' +
    'to columns and the width may overflow into an ' +
    'horizontal scroll.'),
  },

  include_series: {
    type: 'CheckboxControl',
    label: t('Include Series'),
    renderTrigger: true,
    default: false,
    description: t('Include series name as an axis'),
  },

  secondary_metric: {
    type: 'SelectControl',
    label: t('Color Metric'),
    default: null,
    description: t('A metric to use for color'),
    mapStateToProps: state => ({
      choices: (state.datasource) ? state.datasource.metrics_combo : [],
    }),
  },
  select_country: {
    type: 'SelectControl',
    label: t('Country Name'),
    default: 'France',
    choices: [
      'Belgium',
      'Brazil',
      'China',
      'Egypt',
      'France',
      'Germany',
      'Italy',
      'Morocco',
      'Netherlands',
      'Russia',
      'Singapore',
      'Spain',
      'Uk',
      'Ukraine',
      'Usa',
    ].map(s => [s, s]),
    description: t('The name of country that Superset should display'),
  },
  country_fieldtype: {
    type: 'SelectControl',
    label: t('Country Field Type'),
    default: 'cca2',
    choices: [
      ['name', 'Full name'],
      ['cioc', 'code International Olympic Committee (cioc)'],
      ['cca2', 'code ISO 3166-1 alpha-2 (cca2)'],
      ['cca3', 'code ISO 3166-1 alpha-3 (cca3)'],
    ],
    description: t('The country code standard that Superset should expect ' +
    'to find in the [country] column'),
  },

  freq: {
    type: 'SelectControl',
    label: t('Frequency'),
    default: 'W-MON',
    freeForm: true,
    clearable: false,
    choices: [
      ['AS', 'Year (freq=AS)'],
      ['52W-MON', '52 weeks starting Monday (freq=52W-MON)'],
      ['W-SUN', '1 week starting Sunday (freq=W-SUN)'],
      ['W-MON', '1 week starting Monday (freq=W-MON)'],
      ['D', 'Day (freq=D)'],
      ['4W-MON', '4 weeks (freq=4W-MON)'],
    ],
    description: t(
      `The periodicity over which to pivot time. Users can provide
      "Pandas" offset alias.
      Click on the info bubble for more details on accepted "freq" expressions.`),
    tooltipOnClick: () => {
      window.open(
        'https://pandas.pydata.org/pandas-docs/stable/timeseries.html#offset-aliases');
    },
  },

  groupby: groupByControl,
  dimension: {
    ...groupByControl,
    label: t('Dimension'),
    description: t('Select a dimension'),
    multi: false,
    default: null,
  },

  columns: Object.assign({}, groupByControl, {
    label: t('Columns'),
    description: t('One or many controls to pivot as columns'),
  }),

  all_columns: {
    type: 'SelectControl',
    multi: true,
    label: t('Columns'),
    default: [],
    description: t('Columns to display'),
    optionRenderer: c => <ColumnOption column={c} showType />,
    valueRenderer: c => <ColumnOption column={c} />,
    valueKey: 'column_name',
    mapStateToProps: state => ({
      options: (state.datasource) ? state.datasource.columns : [],
    }),
  },

  spatial: {
    type: 'SpatialControl',
    label: t('Longitude & Latitude'),
    validators: [v.nonEmpty],
    description: t('Point to your spatial columns'),
    mapStateToProps: state => ({
      choices: (state.datasource) ? state.datasource.all_cols : [],
    }),
  },

  start_spatial: {
    type: 'SpatialControl',
    label: t('Start Longitude & Latitude'),
    validators: [v.nonEmpty],
    description: t('Point to your spatial columns'),
    mapStateToProps: state => ({
      choices: (state.datasource) ? state.datasource.all_cols : [],
    }),
  },

  end_spatial: {
    type: 'SpatialControl',
    label: t('End Longitude & Latitude'),
    validators: [v.nonEmpty],
    description: t('Point to your spatial columns'),
    mapStateToProps: state => ({
      choices: (state.datasource) ? state.datasource.all_cols : [],
    }),
  },

  longitude: {
    type: 'SelectControl',
    label: t('Longitude'),
    default: 1,
    validators: [v.nonEmpty],
    description: t('Select the longitude column'),
    mapStateToProps: state => ({
      choices: (state.datasource) ? state.datasource.all_cols : [],
    }),
  },

  latitude: {
    type: 'SelectControl',
    label: t('Latitude'),
    default: 1,
    validators: [v.nonEmpty],
    description: t('Select the latitude column'),
    mapStateToProps: state => ({
      choices: (state.datasource) ? state.datasource.all_cols : [],
    }),
  },

  geojson: {
    type: 'SelectControl',
    label: t('GeoJson Column'),
    validators: [v.nonEmpty],
    description: t('Select the geojson column'),
    mapStateToProps: state => ({
      choices: (state.datasource) ? state.datasource.all_cols : [],
    }),
  },

  polygon: {
    type: 'SelectControl',
    label: t('Polygon Column'),
    validators: [v.nonEmpty],
    description: t('Select the polygon column. Each row should contain JSON.array(N) of [longitude, latitude] points'),
    mapStateToProps: state => ({
      choices: (state.datasource) ? state.datasource.all_cols : [],
    }),
  },

  point_radius_scale: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Point Radius Scale'),
    validators: [v.integer],
    default: null,
    choices: formatSelectOptions([0, 100, 200, 300, 500]),
  },

  stroke_width: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Stroke Width'),
    validators: [v.integer],
    default: null,
    choices: formatSelectOptions([2, 3, 4, 5, 6, 7]),
  },

  all_columns_x: {
    type: 'SelectControl',
    label: 'X',
    default: null,
    description: t('Columns to display'),
    mapStateToProps: state => ({
      choices: (state.datasource) ? state.datasource.all_cols : [],
    }),
  },

  all_columns_y: {
    type: 'SelectControl',
    label: 'Y',
    default: null,
    description: t('Columns to display'),
    mapStateToProps: state => ({
      choices: (state.datasource) ? state.datasource.all_cols : [],
    }),
  },

  druid_time_origin: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Origin'),
    choices: [
      ['', 'default'],
      ['now', 'now'],
    ],
    default: null,
    description: t('Defines the origin where time buckets start, ' +
    'accepts natural dates as in `now`, `sunday` or `1970-01-01`'),
  },

  bottom_margin: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Bottom Margin'),
    choices: formatSelectOptions(['auto', 50, 75, 100, 125, 150, 200]),
    default: 'auto',
    renderTrigger: true,
    description: t('Bottom margin, in pixels, allowing for more room for axis labels'),
  },

  x_ticks_layout: {
    type: 'SelectControl',
    label: t('X Tick Layout'),
    choices: formatSelectOptions(['auto', 'flat', '45°', 'staggered']),
    default: 'auto',
    clearable: false,
    renderTrigger: true,
    description: t('The way the ticks are laid out on the X axis'),
  },

  left_margin: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Left Margin'),
    choices: formatSelectOptions(['auto', 50, 75, 100, 125, 150, 200]),
    default: 'auto',
    renderTrigger: true,
    description: t('Left margin, in pixels, allowing for more room for axis labels'),
  },

  right_margin: {
    type: 'SelectControl',
    freeForm: true,
    label: t('右边距'),
    choices: formatSelectOptions(['auto', 50, 75, 100, 125, 150, 200]),
    default: 'auto',
    renderTrigger: true,
    description: t('Right margin, in pixels, allowing for more room for axis labels'),
  },

  granularity: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Time Granularity'),
    default: 'one day',
    choices: [
      [null, 'all'],
      ['PT5S', '5 seconds'],
      ['PT30S', '30 seconds'],
      ['PT1M', '1 minute'],
      ['PT5M', '5 minutes'],
      ['PT1H', '1 hour'],
      ['PT6H', '6 hour'],
      ['P1D', '1 day'],
      ['P7D', '7 days'],
      ['P1W', 'week'],
      ['P1W', 'week_starting_sunday'],
      ['P1W', 'week_ending_saturday'],
      ['P1M', 'month'],
    ],
    description: t('The time granularity for the visualization. Note that you ' +
    'can type and use simple natural language as in `10 seconds`, ' +
    '`1 day` or `56 weeks`'),
  },

  domain_granularity: {
    type: 'SelectControl',
    label: t('Domain'),
    default: 'month',
    choices: formatSelectOptions(['hour', 'day', 'week', 'month', 'year']),
    description: t('The time unit used for the grouping of blocks'),
  },

  subdomain_granularity: {
    type: 'SelectControl',
    label: t('Subdomain'),
    default: 'day',
    choices: formatSelectOptions(['min', 'hour', 'day', 'week', 'month']),
    description: t('The time unit for each block. Should be a smaller unit than ' +
    'domain_granularity. Should be larger or equal to Time Grain'),
  },

  link_length: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Link Length'),
    default: '200',
    choices: formatSelectOptions(['10', '25', '50', '75', '100', '150', '200', '250']),
    description: t('Link length in the force layout'),
  },

  charge: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Charge'),
    default: '-500',
    choices: formatSelectOptions([
      '-50',
      '-75',
      '-100',
      '-150',
      '-200',
      '-250',
      '-500',
      '-1000',
      '-2500',
      '-5000',
    ]),
    description: t('Charge in the force layout'),
  },

  granularity_sqla: {
    type: 'SelectControl',
    label: t('Time Column'),
    description: t('The time column for the visualization. Note that you ' +
    'can define arbitrary expression that return a DATETIME ' +
    'column in the table. Also note that the ' +
    'filter below is applied against this column or ' +
    'expression'),
    default: (c) => {
      if (c.options && c.options.length > 0) {
        return c.options[0].column_name;
      }
      return null;
    },
    clearable: false,
    optionRenderer: c => <ColumnOption column={c} showType />,
    valueRenderer: c => <ColumnOption column={c} />,
    valueKey: 'column_name',
    mapStateToProps: (state) => {
      const newState = {};
      if (state.datasource) {
        newState.options = state.datasource.columns.filter(c => c.is_dttm);
      }
      return newState;
    },
  },

  time_grain_sqla: {
    type: 'SelectControl',
    label: t('Time Grain'),
    default: control => control.choices && control.choices.length ? control.choices[0][0] : null,
    description: t('The time granularity for the visualization. This ' +
    'applies a date transformation to alter ' +
    'your time column and defines a new time granularity. ' +
    'The options here are defined on a per database ' +
    'engine basis in the Superset source code.'),
    mapStateToProps: state => ({
      choices: (state.datasource) ? state.datasource.time_grain_sqla : null,
    }),
  },

  resample_rule: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Resample Rule'),
    default: null,
    choices: formatSelectOptions(['', '1T', '1H', '1D', '7D', '1M', '1AS']),
    description: t('Pandas resample rule'),
  },

  resample_how: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Resample How'),
    default: null,
    choices: formatSelectOptions(['', 'mean', 'sum', 'median', 'first', 'last']),
    description: t('Pandas resample how'),
  },

  resample_fillmethod: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Resample Fill Method'),
    default: null,
    choices: formatSelectOptions(['', 'ffill', 'bfill']),
    description: t('Pandas resample fill method'),
  },

  since: {
    type: 'DateFilterControl',
    freeForm: true,
    label: t('Since'),
    default: t('7 days ago'),
  },

  until: {
    type: 'DateFilterControl',
    freeForm: true,
    label: t('Until'),
    default: 'now',
  },

  max_bubble_size: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Max Bubble Size'),
    default: '60',
    renderTrigger: true,
    choices: formatSelectOptions(['15', '25', '50', '60', '75', '100']),
  },

  whisker_options: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Whisker/outlier options'),
    default: 'Tukey',
    description: t('Determines how whiskers and outliers are calculated.'),
    choices: formatSelectOptions([
      'Tukey',
      'Min/max (no outliers)',
      '2/98 percentiles',
      '9/91 percentiles',
    ]),
  },

  treemap_ratio: {
    type: 'TextControl',
    label: t('Ratio'),
    renderTrigger: true,
    isFloat: true,
    default: 0.5 * (1 + Math.sqrt(5)),  // d3 default, golden ratio
    description: t('Target aspect ratio for treemap tiles.'),
  },

  number_format: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Number format'),
    renderTrigger: true,
    default: '.3s',
    choices: D3_FORMAT_OPTIONS,
    description: D3_FORMAT_DOCS,
  },

  row_limit: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Row limit'),
    validators: [v.integer],
    default: 10000,
    choices: formatSelectOptions(ROW_LIMIT_OPTIONS),
  },

  limit: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Series limit'),
    validators: [v.integer],
    choices: formatSelectOptions(SERIES_LIMITS),
    description: t(
      'Limits the number of time series that get displayed. A sub query ' +
      '(or an extra phase where sub queries are not supported) is applied to limit ' +
      'the number of time series that get fetched and displayed. This feature is useful ' +
      'when grouping by high cardinality dimension(s).'),
  },

  timeseries_limit_metric: {
    type: 'SelectControl',
    label: t('Sort By'),
    default: null,
    description: t('Metric used to define the top series'),
    mapStateToProps: state => ({
      choices: (state.datasource) ? state.datasource.metrics_combo : [],
    }),
  },

  order_desc: {
    type: 'CheckboxControl',
    label: t('Sort Descending'),
    default: true,
    description: t('Whether to sort descending or ascending'),
  },

  rolling_type: {
    type: 'SelectControl',
    label: t('Rolling'),
    default: 'None',
    choices: formatSelectOptions(['None', 'mean', 'sum', 'std', 'cumsum']),
    description: t('Defines a rolling window function to apply, works along ' +
    'with the [Periods] text box'),
  },

  multiplier: {
    type: 'TextControl',
    label: t('Multiplier'),
    isFloat: true,
    renderTrigger: true,
    default: 1,
    description: t('Factor to multiply the metric by'),
  },

  rolling_periods: {
    type: 'TextControl',
    label: t('Periods'),
    isInt: true,
    description: t('Defines the size of the rolling window function, ' +
    'relative to the time granularity selected'),
  },

  grid_size: {
    type: 'TextControl',
    label: t('Grid Size'),
    renderTrigger: true,
    default: 20,
    isInt: true,
    description: t('Defines the grid size in pixels'),
  },

  min_periods: {
    type: 'TextControl',
    label: t('Min Periods'),
    isInt: true,
    description: t('The minimum number of rolling periods required to show ' +
    'a value. For instance if you do a cumulative sum on 7 days ' +
    'you may want your "Min Period" to be 7, so that all data points ' +
    'shown are the total of 7 periods. This will hide the "ramp up" ' +
    'taking place over the first 7 periods'),
  },

  series: {
    type: 'SelectControl',
    label: t('Series'),
    default: null,
    description: t('Defines the grouping of entities. ' +
    'Each series is shown as a specific color on the chart and ' +
    'has a legend toggle'),
    mapStateToProps: state => ({
      choices: (state.datasource) ? state.datasource.gb_cols : [],
    }),
  },

  entity: {
    type: 'SelectControl',
    label: t('Entity'),
    default: null,
    validators: [v.nonEmpty],
    description: t('This defines the element to be plotted on the chart'),
    mapStateToProps: state => ({
      choices: (state.datasource) ? state.datasource.gb_cols : [],
    }),
  },

  x: {
    type: 'SelectControl',
    label: t('X Axis'),
    description: t('Metric assigned to the [X] axis'),
    default: null,
    validators: [v.nonEmpty],
    optionRenderer: m => <MetricOption metric={m} showType />,
    valueRenderer: m => <MetricOption metric={m} />,
    valueKey: 'metric_name',
    mapStateToProps: state => ({
      options: (state.datasource) ? state.datasource.metrics : [],
    }),
  },

  y: {
    type: 'SelectControl',
    label: t('Y Axis'),
    default: null,
    validators: [v.nonEmpty],
    description: t('Metric assigned to the [Y] axis'),
    optionRenderer: m => <MetricOption metric={m} showType />,
    valueRenderer: m => <MetricOption metric={m} />,
    valueKey: 'metric_name',
    mapStateToProps: state => ({
      options: (state.datasource) ? state.datasource.metrics : [],
    }),
  },

  size: {
    type: 'SelectControl',
    label: t('Bubble Size'),
    default: null,
    validators: [v.nonEmpty],
    optionRenderer: m => <MetricOption metric={m} showType />,
    valueRenderer: m => <MetricOption metric={m} />,
    valueKey: 'metric_name',
    mapStateToProps: state => ({
      options: (state.datasource) ? state.datasource.metrics : [],
    }),
  },

  url: {
    type: 'TextControl',
    label: t('URL'),
    description: t('The URL, this control is templated, so you can integrate ' +
    '{{ width }} and/or {{ height }} in your URL string.'),
    default: '',
  },

  x_axis_label: {
    type: 'TextControl',
    label: t('X Axis Label'),
    renderTrigger: true,
    default: '',
  },

  y_axis_label: {
    type: 'TextControl',
    label: t('Y Axis Label'),
    renderTrigger: true,
    default: '',
  },

  where: {
    type: 'TextAreaControl',
    label: t('Custom WHERE clause'),
    default: '',
    language: 'sql',
    minLines: 2,
    maxLines: 10,
    offerEditInModal: false,
    description: t('The text in this box gets included in your query\'s WHERE ' +
    'clause, as an AND to other criteria. You can include ' +
    'complex expression, parenthesis and anything else ' +
    'supported by the backend it is directed towards.'),
  },

  having: {
    type: 'TextAreaControl',
    label: t('Custom HAVING clause'),
    default: '',
    language: 'sql',
    minLines: 2,
    maxLines: 10,
    offerEditInModal: false,
    description: t('The text in this box gets included in your query\'s HAVING ' +
    'clause, as an AND to other criteria. You can include ' +
    'complex expression, parenthesis and anything else ' +
    'supported by the backend it is directed towards.'),
  },

  compare_lag: {
    type: 'TextControl',
    label: t('Comparison Period Lag'),
    isInt: true,
    description: t('Based on granularity, number of time periods to compare against'),
  },

  compare_suffix: {
    type: 'TextControl',
    label: t('Comparison suffix'),
    description: t('Suffix to apply after the percentage display'),
  },

  table_timestamp_format: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Table Timestamp Format'),
    default: '%Y-%m-%d %H:%M:%S',
    renderTrigger: true,
    validators: [v.nonEmpty],
    clearable: false,
    choices: D3_TIME_FORMAT_OPTIONS,
    description: t('Timestamp Format'),
  },

  series_height: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Series Height'),
    default: '25',
    choices: formatSelectOptions(['10', '25', '40', '50', '75', '100', '150', '200']),
    description: t('Pixel height of each series'),
  },

  page_length: {
    type: 'SelectControl',
    freeForm: true,
    renderTrigger: true,
    label: t('Page Length'),
    default: 0,
    choices: formatSelectOptions([0, 10, 25, 40, 50, 75, 100, 150, 200]),
    description: t('Rows per page, 0 means no pagination'),
  },

  x_axis_format: {
    type: 'SelectControl',
    freeForm: true,
    label: t('X Axis Format'),
    renderTrigger: true,
    default: '.3s',
    choices: D3_FORMAT_OPTIONS,
    description: D3_FORMAT_DOCS,
  },

  x_axis_time_format: {
    type: 'SelectControl',
    freeForm: true,
    label: t('X Axis Format'),
    renderTrigger: true,
    // default: 'smart_date',
    default: '',
    choices: D3_TIME_FORMAT_OPTIONS,
    description: D3_FORMAT_DOCS,
  },

  y_axis_format: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Y Axis Format'),
    renderTrigger: true,
    default: '.3s',
    choices: [['万', '万']].concat(D3_FORMAT_OPTIONS),
    description: D3_FORMAT_DOCS,
    mapStateToProps: (state) => {
      const showWarning = (
          state.controls &&
          state.controls.num_period_compare &&
          state.controls.num_period_compare.value !== '');
      return {
        // warning: showWarning ?
        //   t('When `Period Ratio` is set, the Y Axis Format is forced to `.1%`') : null,
        // disabled: showWarning,
        warning: showWarning ?
          t('When `Period Ratio` is set, the Y Axis Format recommend set to `.1%`') : null,
        disabled: false,
      };
    },
  },

  y_axis_2_format: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Right Axis Format'),
    default: '.3s',
    choices: D3_FORMAT_OPTIONS,
    description: D3_FORMAT_DOCS,
  },

  date_time_format: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Date Time Format'),
    renderTrigger: true,
    default: 'smart_date',
    choices: D3_TIME_FORMAT_OPTIONS,
    description: D3_FORMAT_DOCS,
  },

  markup_type: {
    type: 'SelectControl',
    label: t('Markup Type'),
    clearable: false,
    choices: formatSelectOptions(['markdown', 'html']),
    default: 'markdown',
    validators: [v.nonEmpty],
    description: t('Pick your favorite markup language'),
  },

  rotation: {
    type: 'SelectControl',
    label: t('Rotation'),
    choices: formatSelectOptions(['random', 'flat', 'square']),
    default: 'random',
    description: t('Rotation to apply to words in the cloud'),
  },

  line_interpolation: {
    type: 'SelectControl',
    label: t('Line Style'),
    renderTrigger: true,
    choices: formatSelectOptions(['linear', 'basis', 'cardinal',
      'monotone', 'step-before', 'step-after']),
    default: 'linear',
    description: t('Line interpolation as defined by d3.js'),
  },

  pie_label_type: {
    type: 'SelectControl',
    label: t('Label Type'),
    default: 'key',
    renderTrigger: true,
    choices: [
      ['key', 'Category Name'],
      ['value', 'Value'],
      ['percent', 'Percentage'],
      ['key_value', 'Category and Value'],
      ['key_percent', 'Category and Percentage'],
      ['key_v_percent', 'Value and Percentage'],
    ],
    description: t('What should be shown on the label?'),
  },

  code: {
    type: 'TextAreaControl',
    label: t('Code'),
    description: t('Put your code here'),
    mapStateToProps: state => ({
      language: state.controls && state.controls.markup_type ? state.controls.markup_type.value : 'markdown',
    }),
    default: '',
  },

  pandas_aggfunc: {
    type: 'SelectControl',
    label: t('Aggregation function'),
    clearable: false,
    choices: formatSelectOptions([
      'sum',
      'mean',
      'min',
      'max',
      'median',
      'stdev',
      'var',
    ]),
    default: 'sum',
    description: t('Aggregate function to apply when pivoting and ' +
    'computing the total rows and columns'),
  },

  size_from: {
    type: 'TextControl',
    isInt: true,
    label: t('Font Size From'),
    default: 20,
    description: t('Font size for the smallest value in the list'),
  },

  size_to: {
    type: 'TextControl',
    isInt: true,
    label: t('Font Size To'),
    default: '150',
    description: t('Font size for the biggest value in the list'),
  },

  instant_filtering: {
    type: 'CheckboxControl',
    label: t('Instant Filtering'),
    renderTrigger: true,
    default: true,
    description: (
      'Whether to apply filters as they change, or wait for' +
      'users to hit an [Apply] button'
    ),
  },

  extruded: {
    type: 'CheckboxControl',
    label: t('Extruded'),
    renderTrigger: true,
    default: true,
    description: ('Whether to make the grid 3D'),
  },

  show_brush: {
    type: 'SelectControl',
    label: t('Show Range Filter'),
    renderTrigger: true,
    clearable: false,
    default: 'auto',
    choices: [
      ['yes', 'Yes'],
      ['no', 'No'],
      ['auto', 'Auto'],
    ],
    description: t('Whether to display the time range interactive selector'),
  },

  date_filter: {
    type: 'CheckboxControl',
    label: t('Date Filter'),
    default: true,
    description: t('Whether to include a time filter'),
  },

  show_sqla_time_granularity: {
    type: 'CheckboxControl',
    label: t('Show SQL Granularity Dropdown'),
    default: false,
    description: t('Check to include SQL Granularity dropdown'),
  },

  show_sqla_time_column: {
    type: 'CheckboxControl',
    label: t('Show SQL Time Column'),
    default: false,
    description: t('Check to include Time Column dropdown'),
  },

  show_druid_time_granularity: {
    type: 'CheckboxControl',
    label: t('Show Druid Granularity Dropdown'),
    default: false,
    description: t('Check to include Druid Granularity dropdown'),
  },

  show_druid_time_origin: {
    type: 'CheckboxControl',
    label: t('Show Druid Time Origin'),
    default: false,
    description: t('Check to include Time Origin dropdown'),
  },

  show_datatable: {
    type: 'CheckboxControl',
    label: t('Data Table'),
    default: false,
    description: t('Whether to display the interactive data table'),
  },

  include_search: {
    type: 'CheckboxControl',
    label: t('Search Box'),
    renderTrigger: true,
    default: false,
    description: t('Whether to include a client side search box'),
  },

  table_filter: {
    type: 'CheckboxControl',
    label: t('Table Filter'),
    renderTrigger: true,
    default: false,
    description: t('Whether to apply filter when table cell is clicked'),
  },

  align_pn: {
    type: 'CheckboxControl',
    label: t('Align +/-'),
    renderTrigger: true,
    default: false,
    description: t('Whether to align the background chart for +/- values'),
  },

  color_pn: {
    type: 'CheckboxControl',
    label: t('Color +/-'),
    renderTrigger: true,
    default: true,
    description: t('Whether to color +/- values'),
  },

  show_bubbles: {
    type: 'CheckboxControl',
    label: t('Show Bubbles'),
    default: false,
    renderTrigger: true,
    description: t('Whether to display bubbles on top of countries'),
  },

  show_legend: {
    type: 'CheckboxControl',
    label: t('Legend'),
    renderTrigger: true,
    default: true,
    description: t('Whether to display the legend (toggles)'),
  },

  show_values: {
    type: 'CheckboxControl',
    label: t('Show Values'),
    renderTrigger: true,
    default: false,
    description: t('Whether to display the numerical values within the cells'),
  },

  x_axis_showminmax: {
    type: 'CheckboxControl',
    label: t('X bounds'),
    renderTrigger: true,
    default: false,
    description: t('Whether to display the min and max values of the X axis'),
  },

  boundaryGap: {
    type: 'CheckboxControl',
    label: t('x轴两边是否留白'),
    renderTrigger: true,
    default: true,
    description: t('x轴两边是否留白'),
  },

  y_axis_showminmax: {
    type: 'CheckboxControl',
    label: t('Y bounds'),
    renderTrigger: true,
    default: false,
    description: t('Whether to display the min and max values of the Y axis'),
  },

  rich_tooltip: {
    type: 'CheckboxControl',
    label: t('Rich Tooltip'),
    renderTrigger: true,
    default: true,
    description: t('The rich tooltip shows a list of all series for that ' +
    'point in time'),
  },

  y_log_scale: {
    type: 'CheckboxControl',
    label: t('Y Log Scale'),
    default: false,
    renderTrigger: true,
    description: t('Use a log scale for the Y axis'),
  },

  x_log_scale: {
    type: 'CheckboxControl',
    label: t('X Log Scale'),
    default: false,
    renderTrigger: true,
    description: t('Use a log scale for the X axis'),
  },

  log_scale: {
    type: 'CheckboxControl',
    label: t('Log Scale'),
    default: false,
    renderTrigger: true,
    description: t('Use a log scale'),
  },

  donut: {
    type: 'CheckboxControl',
    label: t('Donut'),
    default: false,
    renderTrigger: true,
    description: t('Do you want a donut or a pie?'),
  },

  labels_outside: {
    type: 'CheckboxControl',
    label: t('Put labels outside'),
    default: true,
    renderTrigger: true,
    description: t('Put the labels outside the pie?'),
  },

  contribution: {
    type: 'CheckboxControl',
    label: t('Contribution'),
    default: false,
    description: t('Compute the contribution to the total'),
  },

  num_period_compare: {
    type: 'TextControl',
    label: t('Period Ratio'),
    default: '',
    isInt: true,
    description: t('[integer] Number of period to compare against, ' +
    'this is relative to the granularity selected'),
  },

  period_ratio_type: {
    type: 'SelectControl',
    label: t('Period Ratio Type'),
    default: 'growth',
    choices: formatSelectOptions(['factor', 'growth', 'value']),
    description: t('`factor` means (new/previous), `growth` is ' +
    '((new/previous) - 1), `value` is (new-previous)'),
  },

  list_ratio_type: {
    type: 'SelectControl',
    label: t('时序内比率类型'),
    default: 'growth',
    choices: formatSelectOptions(['growth', 'value']),
    description: t('“growth”是 (each / first)，“value”是 (each - first)'),
  },

  time_compare: {
    type: 'TextControl',
    label: t('Time Shift'),
    default: null,
    description: t('Overlay a timeseries from a ' +
    'relative time period. Expects relative time delta ' +
    'in natural language (example:  24 hours, 7 days, ' +
    '56 weeks, 365 days)'),
  },

  subheader: {
    type: 'TextControl',
    label: t('Subheader'),
    description: t('Description text that shows up below your Big Number'),
  },

  mapbox_label: {
    type: 'SelectControl',
    multi: true,
    label: t('label'),
    default: [],
    description: t('`count` is COUNT(*) if a group by is used. ' +
    'Numerical columns will be aggregated with the aggregator. ' +
    'Non-numerical columns will be used to label points. ' +
    'Leave empty to get a count of points in each cluster.'),
    mapStateToProps: state => ({
      choices: (state.datasource) ? state.datasource.all_cols : [],
    }),
  },

  mapbox_style: {
    type: 'SelectControl',
    label: t('Map Style'),
    clearable: false,
    renderTrigger: true,
    choices: [
      ['mapbox://styles/mapbox/streets-v9', 'Streets'],
      ['mapbox://styles/mapbox/dark-v9', 'Dark'],
      ['mapbox://styles/mapbox/light-v9', 'Light'],
      ['mapbox://styles/mapbox/satellite-streets-v9', 'Satellite Streets'],
      ['mapbox://styles/mapbox/satellite-v9', 'Satellite'],
      ['mapbox://styles/mapbox/outdoors-v9', 'Outdoors'],
    ],
    default: 'mapbox://styles/mapbox/light-v9',
    description: t('Base layer map style'),
  },

  clustering_radius: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Clustering Radius'),
    default: '60',
    choices: formatSelectOptions([
      '0',
      '20',
      '40',
      '60',
      '80',
      '100',
      '200',
      '500',
      '1000',
    ]),
    description: t('The radius (in pixels) the algorithm uses to define a cluster. ' +
    'Choose 0 to turn off clustering, but beware that a large ' +
    'number of points (>1000) will cause lag.'),
  },

  point_radius_fixed: {
    type: 'FixedOrMetricControl',
    label: t('Point Size'),
    default: { type: 'fix', value: 1000 },
    description: t('Fixed point radius'),
    mapStateToProps: state => ({
      datasource: state.datasource,
    }),
  },

  point_radius: {
    type: 'SelectControl',
    label: t('Point Radius'),
    default: 'Auto',
    description: t('The radius of individual points (ones that are not in a cluster). ' +
    'Either a numerical column or `Auto`, which scales the point based ' +
    'on the largest cluster'),
    mapStateToProps: state => ({
      choices: [].concat([['Auto', 'Auto']], state.datasource.all_cols),
    }),
  },

  point_radius_unit: {
    type: 'SelectControl',
    label: t('Point Radius Unit'),
    default: 'Pixels',
    choices: formatSelectOptions(['Pixels', 'Miles', 'Kilometers']),
    description: t('The unit of measure for the specified point radius'),
  },

  point_unit: {
    type: 'SelectControl',
    label: t('Point Unit'),
    default: 'square_m',
    clearable: false,
    choices: [
      ['square_m', 'Square meters'],
      ['square_km', 'Square kilometers'],
      ['square_miles', 'Square miles'],
      ['radius_m', 'Radius in meters'],
      ['radius_km', 'Radius in kilometers'],
      ['radius_miles', 'Radius in miles'],
    ],
    description: t('The unit of measure for the specified point radius'),
  },

  global_opacity: {
    type: 'TextControl',
    label: t('Opacity'),
    default: 1,
    isFloat: true,
    description: t('Opacity of all clusters, points, and labels. ' +
    'Between 0 and 1.'),
  },

  viewport: {
    type: 'ViewportControl',
    label: t('Viewport'),
    renderTrigger: false,
    description: t('Parameters related to the view and perspective on the map'),
    // default is whole world mostly centered
    default: defaultViewport,
    // Viewport changes shouldn't prompt user to re-run query
    dontRefreshOnChange: true,
  },

  viewport_zoom: {
    type: 'TextControl',
    label: t('Zoom'),
    isFloat: true,
    default: 11,
    description: t('Zoom level of the map'),
    places: 8,
  },

  viewport_latitude: {
    type: 'TextControl',
    label: t('Default latitude'),
    default: 37.772123,
    isFloat: true,
    description: t('Latitude of default viewport'),
    places: 8,
  },

  viewport_longitude: {
    type: 'TextControl',
    label: t('Default longitude'),
    default: -122.405293,
    isFloat: true,
    description: t('Longitude of default viewport'),
    places: 8,
  },

  render_while_dragging: {
    type: 'CheckboxControl',
    label: t('Live render'),
    default: true,
    description: t('Points and clusters will update as viewport is being changed'),
  },

  mapbox_color: {
    type: 'SelectControl',
    freeForm: true,
    label: t('RGB Color'),
    default: 'rgb(0, 122, 135)',
    choices: [
      ['rgb(0, 139, 139)', 'Dark Cyan'],
      ['rgb(128, 0, 128)', 'Purple'],
      ['rgb(255, 215, 0)', 'Gold'],
      ['rgb(69, 69, 69)', 'Dim Gray'],
      ['rgb(220, 20, 60)', 'Crimson'],
      ['rgb(34, 139, 34)', 'Forest Green'],
    ],
    description: t('The color for points and clusters in RGB'),
  },

  color: {
    type: 'ColorPickerControl',
    label: t('Color'),
    default: colorPrimary,
    description: t('Pick a color'),
  },

  ranges: {
    type: 'TextControl',
    label: t('Ranges'),
    default: '',
    description: t('Ranges to highlight with shading'),
  },

  range_labels: {
    type: 'TextControl',
    label: t('Range labels'),
    default: '',
    description: t('Labels for the ranges'),
  },

  alias_labels: {
    type: 'TextControl',
    label: t('指标别名,例如:{"原名":"别名"}'),
    default: '',
    description: t('指标别名,例如:{"原名":"别名"}'),
  },

  markers: {
    type: 'TextControl',
    label: t('Markers'),
    default: '',
    description: t('List of values to mark with triangles'),
  },

  marker_labels: {
    type: 'TextControl',
    label: t('Marker labels'),
    default: '',
    description: t('Labels for the markers'),
  },

  marker_lines: {
    type: 'TextControl',
    label: t('Marker lines'),
    default: '',
    description: t('List of values to mark with lines'),
  },

  marker_line_labels: {
    type: 'TextControl',
    label: t('Marker line labels'),
    default: '',
    description: t('Labels for the marker lines'),
  },

  filters: {
    type: 'FilterControl',
    label: '',
    default: [],
    description: '',
    mapStateToProps: state => ({
      datasource: state.datasource,
    }),
  },

  annotation_layers: {
    type: 'AnnotationLayerControl',
    label: '',
    default: [],
    description: 'Annotation Layers',
    renderTrigger: true,
    tabOverride: 'data',
  },

  having_filters: {
    type: 'FilterControl',
    label: '',
    default: [],
    description: '',
    mapStateToProps: state => ({
      choices: (state.datasource) ? state.datasource.metrics_combo
        .concat(state.datasource.filterable_cols) : [],
      datasource: state.datasource,
    }),
  },

  slice_id: {
    type: 'HiddenControl',
    label: t('Slice ID'),
    hidden: true,
    description: t('The id of the active slice'),
  },

  cache_timeout: {
    type: 'HiddenControl',
    label: t('Cache Timeout (seconds)'),
    hidden: true,
    description: t('The number of seconds before expiring the cache'),
  },

  order_by_entity: {
    type: 'CheckboxControl',
    label: t('Order by entity id'),
    description: t('Important! Select this if the table is not already sorted by entity id, ' +
    'else there is no guarantee that all events for each entity are returned.'),
    default: true,
  },

  min_leaf_node_event_count: {
    type: 'SelectControl',
    freeForm: false,
    label: t('Minimum leaf node event count'),
    default: 1,
    choices: formatSelectOptionsForRange(1, 10),
    description: t('Leaf nodes that represent fewer than this number of events will be initially ' +
    'hidden in the visualization'),
  },

  color_scheme: {
    type: 'ColorSchemeControl',
    label: t('Color Scheme'),
    default: 'bnbColors',
    renderTrigger: true,
    choices: Object.keys(ALL_COLOR_SCHEMES).map(s => ([s, s])),
    description: t('The color scheme for rendering chart'),
    schemes: ALL_COLOR_SCHEMES,
  },

  significance_level: {
    type: 'TextControl',
    label: t('Significance Level'),
    default: 0.05,
    description: t('Threshold alpha level for determining significance'),
  },

  pvalue_precision: {
    type: 'TextControl',
    label: t('p-value precision'),
    default: 6,
    description: t('Number of decimal places with which to display p-values'),
  },

  liftvalue_precision: {
    type: 'TextControl',
    label: t('Lift percent precision'),
    default: 4,
    description: t('Number of decimal places with which to display lift values'),
  },

  column_collection: {
    type: 'CollectionControl',
    label: t('Time Series Columns'),
    validators: [v.nonEmpty],
    controlName: 'TimeSeriesColumnControl',
  },

  rose_area_proportion: {
    type: 'CheckboxControl',
    label: t('Use Area Proportions'),
    description: t(
      'Check if the Rose Chart should use segment area instead of ' +
      'segment radius for proportioning',
    ),
    default: false,
    renderTrigger: true,
  },

  time_series_option: {
    type: 'SelectControl',
    label: t('Options'),
    validators: [v.nonEmpty],
    default: 'not_time',
    valueKey: 'value',
    options: [
      {
        label: t('Not Time Series'),
        value: 'not_time',
        description: t('Ignore time'),
      },
      {
        label: t('Time Series'),
        value: 'time_series',
        description: t('Standard time series'),
      },
      {
        label: t('Aggregate Mean'),
        value: 'agg_mean',
        description: t('Mean of values over specified period'),
      },
      {
        label: t('Aggregate Sum'),
        value: 'agg_sum',
        description: t('Sum of values over specified period'),
      },
      {
        label: t('Difference'),
        value: 'point_diff',
        description: t('Metric change in value from `since` to `until`'),
      },
      {
        label: t('Percent Change'),
        value: 'point_percent',
        description: t('Metric percent change in value from `since` to `until`'),
      },
      {
        label: t('Factor'),
        value: 'point_factor',
        description: t('Metric factor change from `since` to `until`'),
      },
      {
        label: t('Advanced Analytics'),
        value: 'adv_anal',
        description: t('Use the Advanced Analytics options below'),
      },
    ],
    optionRenderer: op => <OptionDescription option={op} />,
    valueRenderer: op => <OptionDescription option={op} />,
    description: t('Settings for time series'),
  },

  equal_date_size: {
    type: 'CheckboxControl',
    label: t('Equal Date Sizes'),
    default: true,
    renderTrigger: true,
    description: t('Check to force date partitions to have the same height'),
  },

  partition_limit: {
    type: 'TextControl',
    label: t('Partition Limit'),
    isInt: true,
    default: '5',
    description:
      t('The maximum number of subdivisions of each group; ' +
      'lower values are pruned first'),
  },

  min_radius: {
    type: 'TextControl',
    label: t('Minimum Radius'),
    isFloat: true,
    validators: [v.nonEmpty],
    default: 2,
    description:
    t('Minimum radius size of the circle, in pixels. As the zoom level changes, this ' +
      'insures that the circle respects this minimum radius.'),
  },

  max_radius: {
    type: 'TextControl',
    label: t('Maximum Radius'),
    isFloat: true,
    validators: [v.nonEmpty],
    default: 250,
    description:
    t('Maxium radius size of the circle, in pixels. As the zoom level changes, this ' +
      'insures that the circle respects this maximum radius.'),
  },

  partition_threshold: {
    type: 'TextControl',
    label: t('Partition Threshold'),
    isFloat: true,
    default: '0.05',
    description:
      t('Partitions whose height to parent height proportions are ' +
      'below this value are pruned'),
  },

  line_column: {
    type: 'SelectControl',
    label: t('Lines column'),
    default: null,
    description: t('The database columns that contains lines information'),
    mapStateToProps: state => ({
      choices: (state.datasource) ? state.datasource.all_cols : [],
    }),
    validators: [v.nonEmpty],
  },
  line_type: {
    type: 'SelectControl',
    label: t('Lines encoding'),
    clearable: false,
    default: 'json',
    description: t('The encoding format of the lines'),
    choices: [
      ['polyline', 'Polyline'],
      ['json', 'JSON'],
    ],
  },

  line_width: {
    type: 'TextControl',
    label: t('Line width'),
    isInt: true,
    default: 10,
    description: t('The width of the lines'),
  },

  reverse_long_lat: {
    type: 'CheckboxControl',
    label: t('Reverse Lat & Long'),
    default: false,
  },

  deck_slices: {
    type: 'SelectAsyncControl',
    multi: true,
    label: t('deck.gl charts'),
    validators: [v.nonEmpty],
    default: [],
    description: t('Pick a set of deck.gl charts to layer on top of one another'),
    dataEndpoint: '/sliceasync/api/read?_flt_0_viz_type=deck_&_flt_7_viz_type=deck_multi',
    placeholder: t('Select charts'),
    onAsyncErrorMessage: t('Error while fetching charts'),
    mutator: (data) => {
      if (!data || !data.result) {
        return [];
      }
      return data.result.map(o => ({ value: o.id, label: o.slice_name }));
    },
  },

  js_data_mutator: jsFunctionControl(
    t('Javascript data interceptor'),
    t('Define a javascript function that receives the data array used in the visualization ' +
      'and is expected to return a modified version of that array. This can be used ' +
      'to alter properties of the data, filter, or enrich the array.'),
  ),

  js_data: jsFunctionControl(
    t('Javascript data mutator'),
    t('Define a function that receives intercepts the data objects and can mutate it'),
  ),

  js_tooltip: jsFunctionControl(
    t('Javascript tooltip generator'),
    t('Define a function that receives the input and outputs the content for a tooltip'),
  ),

  js_onclick_href: jsFunctionControl(
    t('Javascript onClick href'),
    t('Define a function that returns a URL to navigate to when user clicks'),
  ),

  js_columns: {
    ...groupByControl,
    label: t('Extra data for JS'),
    default: [],
    description: t('List of extra columns made available in Javascript functions'),
  },

  stroked: {
    type: 'CheckboxControl',
    label: t('Stroked'),
    renderTrigger: true,
    description: t('Whether to display the stroke'),
    default: false,
  },

  filled: {
    type: 'CheckboxControl',
    label: t('Filled'),
    renderTrigger: true,
    description: t('Whether to fill the objects'),
    default: false,
  },

  normalized: {
    type: 'CheckboxControl',
    label: t('Normalized'),
    renderTrigger: true,
    description: t('Whether to normalize the histogram'),
    default: false,
  },

  //  added by custom---start
  left_axis_use_histogram: {
    type: 'CheckboxControl',
    label: t('Left Axis Use Histogram'),
    description: t('Whether use histogram to display left axis series'),
    default: false,
  },

  right_axis_use_histogram: {
  type: 'CheckboxControl',
  label: t('Right Axis Use Histogram'),
  description: t('Whether use histogram to display Right axis series'),
  default: false,
  },


  swap_left_and_right_axis: {
  type: 'CheckboxControl',
  label: t('Swap left and right axis'),
  description: t('Swap left and right axis'),
  default: false,
  },


  left_axis_use_reverse_order: {
  type: 'CheckboxControl',
  label: t('Left axis use reverse order'),
  description: t('Left axis use reverse order'),
  default: true,
  },

  left_axis_min_value: {
    type: 'TextControl',
    label: t('Left axis min value'),
    description: t('Defines left axis min value, Default values is dataMin.'),
    validators: [v.numeric],
  },

  left_axis_max_value: {
    type: 'TextControl',
    label: t('Left axis max value'),
    description: t('Defines left axis max value, Default values is dataMax.'),
    validators: [v.numeric],
  },

  right_axis_min_value: {
    type: 'TextControl',
    label: t('Right axis min value'),
    description: t('Defines right axis min value, Default values is dataMin.'),
    validators: [v.numeric],
  },

  right_axis_max_value: {
    type: 'TextControl',
    label: t('Right axis max value'),
    description: t('Defines right axis max value, Default values is dataMax.'),
    validators: [v.numeric],
  },

  all_lines_end_at_the_same_zero_point: {
    type: 'CheckboxControl',
    label: t('All lines end at the same zero point'),
    description: t('All lines end at the same zero point'),
    default: false,
  },

  all_lines_start_at_the_same_zero_point: {
    type: 'CheckboxControl',
    label: t('All lines start at the same zero point'),
    description: t('All lines start at the same zero point'),
    default: false,
  },

  whether_show_ma_at_beginning: {
    type: 'CheckboxControl',
    label: t('Whether show MA at beginning'),
    description: t('Whether show MA at beginning'),
    default: false,
    renderTrigger: true,
  },

  bolling_ratio_1: {
    type: 'TextControl',
    label: t('Bolling ratio 1'),
    default: 1.0,
    description: t('Bolling ratio 1.'),
  },

  bolling_ratio_2: {
    type: 'TextControl',
    label: t('Bolling ratio 2'),
    default: 2.0,
    description: t('Bolling ratio 2.'),
  },

  whether_show_bolling_1_at_beginning: {
    type: 'CheckboxControl',
    label: t('Whether show bolling bond 1 at beginning'),
    description: t('Whether show bolling bond 1 at beginning'),
    default: true,
  },

  whether_show_bolling_2_at_beginning: {
    type: 'CheckboxControl',
    label: t('Whether show bolling bond 2 at beginning'),
    description: t('Whether show bolling bond 2 at beginning'),
    default: true,
  },

  columns_value_display_on_the_right_Y_axis: {
    type: 'TextControl',
    label: t('The value of the specified column will be displayed with the Y axis on the right. For example: Column_A|Column_B'),
    default: '',
    description: t('指定列的数值将使用右侧的Y轴来实现, 使用方法为: Column_A|Column_B'),
  },

  columns_value_represent_by_histogram: {
    type: 'TextControl',
    label: t('The value of the specified column will be represented by histogram. For example: Column_A|Column_B'),
    default: '',
    description: t('指定列的数值将使用柱状图表示, 使用方法为: Column_A|Column_B,全部使用柱状图时, 请使用 allbar'),
  },

  columns_value_represent_by_area: {
    type: 'TextControl',
    label: t('The value of the specified column will be represented by area chart. For example: Column_A|Column_B'),
    default: '',
    description: t('指定列的数值将使用面积图表示, 使用方法为: Column_A|Column_B,全部使用堆叠图时, 请使用 allstack'),
  },

  column_for_events_display: {
    type: 'SelectControl',
    label: t('Columns used for Events'),
    default: null,
    description: t('Columns used for Events'),
    validators: [],
    mapStateToProps: state => ({
      choices: (state.datasource) ? state.datasource.all_cols : [],
    }),
  },

  whether_show_all_X_axis_label: {
    type: 'CheckboxControl',
    label: t('Whether show all X axis label'),
    description: t('Whether show all X axis label'),
    default: false,
    renderTrigger: true,
  },

  whether_use_average_historical_data: {
    type: 'CheckboxControl',
    label: t('Whether use average historical data'),
    description: t('Whether use average historical data'),
    default: true,
  },

  select_today: {
    type: 'CheckboxControl',
    label: t('Today'),
    description: t('Today'),
    default: true,
  },

  select_7D: {
    type: 'CheckboxControl',
    label: t('-7D'),
    description: t('-7 days'),
    default: true,
  },

  select_1M: {
    type: 'CheckboxControl',
    label: t('-1M'),
    description: t('-1 month'),
    default: true,
  },

  select_3M: {
    type: 'CheckboxControl',
    label: t('-3M'),
    description: t('-3 month'),
    default: true,
  },

  select_1Y: {
    type: 'CheckboxControl',
    label: t('-1Y'),
    description: t('-1 year '),
    default: true,
  },

  select_everyday: {
    type: 'CheckboxControl',
    label: t('Everyday'),
    description: t('Everyday'),
    default: false,
  },

  day_shift: {
    type: 'TextControl',
    isInt: true,
    validators: [v.nonEmpty],
    label: t('Day Shift'),
    default: 0,
    description: t('开始时间相对于当年首个交易日的偏移天数'),
  },

  day_skip: {
    type: 'TextControl',
    isInt: true,
    validators: [v.nonEmpty],
    label: t('Day Skip'),
    default: 0,
    description: t('开始时间需要跳过的天数'),
  },

  only_show_first_day_in_month: {
    type: 'CheckboxControl',
    label: t('Only show first day in month'),
    default: false,
    description: t('Only show first day in month'),
  },

  shift_indexes: {
    type: 'TextControl',
    label: t('Shift Indexes. For example: Index_A|Index_B|Index_C'),
    default: '',
    description: t('Lag indexes: Index_A|Index_B|Index_C'),
  },

  X_axis_zoom_start: {
    type: 'TextControl',
    label: t('X axis zoom start'),
    isInt: true,
    default: 50,
    validators: [v.nonEmpty, v.integerPercent],
    description: t('X axis zoom start.'),
  },

  X_axis_zoom_end: {
    type: 'TextControl',
    label: t('X axis zoom end'),
    isInt: true,
    default: 100,
    validators: [v.nonEmpty, v.integerPercent],
    description: t('X axis zoom end.'),
  },

  whether_show_YoY: {
    type: 'CheckboxControl',
    label: t('Whether show YoY at beginning'),
    description: t('Whether show YoY at beginning'),
    default: true,
  },

  whether_show_MoM: {
    type: 'CheckboxControl',
    label: t('Whether show MoM at beginning'),
    description: t('Whether show MoM at beginning'),
    default: true,
  },

  data_aggregation_method: {
    label: t('Data aggregation method (average)'),
    description: t('Data aggregation method (average)'),
    type: 'SelectControl',
    clearable: false,
    default: 'daily',
    choices: [
      ['daily', 'daily'],
      ['monthly', 'monthly'],
      ['quarterly', 'quarterly'],
    ],
  },

  from_city: {
    type: 'SelectControl',
    label: t('From City'),
    description: t('From City'),
    validators: [v.nonEmpty],
    mapStateToProps: state => ({
      choices: (state.datasource) ? state.datasource.all_cols : [],
    }),
  },

  to_city: {
    type: 'SelectControl',
    label: t('To City'),
    description: t('From City'),
    validators: [v.nonEmpty],
    mapStateToProps: state => ({
      choices: (state.datasource) ? state.datasource.all_cols : [],
    }),
  },

  city_flow_value: {
    type: 'SelectControl',
    label: t('City Flow Value'),
    description: t('City Flow Value'),
    validators: [v.nonEmpty],
    mapStateToProps: state => ({
      choices: (state.datasource) ? state.datasource.all_cols : [],
    }),
  },

  city_name: {
    type: 'SelectControl',
    label: t('City Name'),
    description: t('City Name'),
    validators: [v.nonEmpty],
    mapStateToProps: state => ({
      choices: (state.datasource) ? state.datasource.all_cols : [],
    }),
  },

  city_longitude: {
    type: 'SelectControl',
    label: t('City Longitude'),
    description: t('City Longitude'),
    validators: [v.nonEmpty],
    mapStateToProps: state => ({
      choices: (state.datasource) ? state.datasource.all_cols : [],
    }),
  },

  city_latitude: {
    type: 'SelectControl',
    label: t('City Latitude'),
    description: t('City Latitude'),
    validators: [v.nonEmpty],
    mapStateToProps: state => ({
      choices: (state.datasource) ? state.datasource.all_cols : [],
    }),
  },

  country_name: {
    type: 'SelectControl',
    label: t('Country Name'),
    description: t('Country Name'),
    validators: [v.nonEmpty],
    mapStateToProps: state => ({
      choices: (state.datasource) ? state.datasource.all_cols : [],
    }),
  },

  country_weight: {
    type: 'SelectControl',
    label: t('Country Weight'),
    description: t('Country Weight'),
    validators: [v.nonEmpty],
    mapStateToProps: state => ({
      choices: (state.datasource) ? state.datasource.all_cols : [],
    }),
  },

  visual_map_min_value: {
    type: 'TextControl',
    label: t('World Flow Visual Min Value'),
    description: t('World Flow Visual Min Value.'),
  },

  visual_map_max_value: {
    type: 'TextControl',
    label: t('World Flow Visual Max Value'),
    description: t('World Flow Visual Max Value.'),
  },

  country_linear_color_scheme: {
    type: 'ColorSchemeControl',
    label: t('Country Linear Color Scheme'),
    choices: [
      ['white_red', 'white/red'],
      ['green_red', 'green/red'],
      ['cyanine_aqua', 'cyanine/orange/yellow/lime/aqua'],
      ['blue_white_yellow', 'blue/white/yellow'],
      ['white_black', 'white/black'],
      ['black_white', 'black/white'],
      ['dark_blue', 'light/dark blue'],
      ['pink_grey', 'pink/white/grey'],
    ],
    default: 'white_red',
    clearable: false,
    description: '',
    renderTrigger: false,
    schemes: spectrums,
    isLinear: true,
  },


  world_flow_linear_color_scheme: {
    type: 'ColorSchemeControl',
    label: t('World Flow Linear Color Scheme'),
    choices: [
      ['white_red', 'white/red'],
      ['green_red', 'green/red'],
      ['green_white_red', 'green/white/red'],
      ['cyanine_aqua', 'cyanine/orange/yellow/lime/aqua'],
      ['blue_white_yellow', 'blue/white/yellow'],
      ['white_black', 'white/black'],
      ['black_white', 'black/white'],
      ['dark_blue', 'light/dark blue'],
      ['pink_grey', 'pink/white/grey'],
    ],
    default: 'cyanine_aqua',
    clearable: false,
    description: '',
    renderTrigger: false,
    schemes: spectrums,
    isLinear: true,
  },

  map_center_longitude: {
    type: 'TextControl',
    label: t('Map Center Longitude'),
    description: t('Map Center Longitude.'),
    default: 0,
    // validators: [v.nonEmpty],
    renderTrigger: true,
  },

  map_center_latitude: {
    type: 'TextControl',
    label: t('Map Center Latitude'),
    description: t('Map Center Latitude.'),
    default: 20,
    // validators: [v.nonEmpty],
    renderTrigger: true,
  },

  map_zoom_factor: {
    type: 'TextControl',
    label: t('Map Zoom Factor'),
    description: t('Map Zoom Factor.'),
    default: 1.2,
    validators: [v.nonEmpty],
    renderTrigger: true,
  },

  kline_x_axis_start: {
    type: 'TextControl',
    label: t('Kline x axis start'),
    validators: [v.integerPercent],
    default: 98,
    description:
    t('Kline x axis start percent'),
  },

  kline_x_axis_end: {
    type: 'TextControl',
    label: t('Kline x axis end'),
    validators: [v.integerPercent],
    default: 100,
    description:
    t('Kline x axis end percent'),
  },

  first_fillna_method: {
    label: t('First Fillna Method'),
    description: t('First Fillna Method'),
    type: 'SelectControl',
    clearable: false,
    default: 'ffill',
    choices: [
      ['ffill', 'ffill'],
      ['bfill', 'bfill'],
      [0, '0'],
      ['None', 'None'],
    ],
  },

  second_fillna_method: {
    label: t('Second Fillna Method'),
    description: t('Second Fillna Method'),
    type: 'SelectControl',
    clearable: false,
    default: 'bfill',
    choices: [
      ['ffill', 'ffill'],
      ['bfill', 'bfill'],
      ['None', 'None'],
    ],
  },

  day_shift_for_month_display: {
    type: 'TextControl',
    isInt: true,
    validators: [v.nonEmpty],
    label: t('Day Shift For Month Display'),
    default: 0,
    description: t('用于月度显示的偏移天数'),
  },

  day_shift_for_annual_start_days: {
    type: 'TextControl',
    isInt: true,
    validators: [v.nonEmpty],
    label: t('Day Shift For Annual Start Days'),
    default: 0,
    description: t('每年从多少天开始切割数据'),
  },

  legend_type: {
    label: t('Legend Type'),
    description: t('Legend Type'),
    type: 'SelectControl',
    clearable: false,
    default: 0,
    choices: [
      [0, 'start'],
      [1, 'end'],
      [2, '作物年度'],
    ],
  },

  shift_days_shows_in_YYYYMMDD: {
    type: 'CheckboxControl',
    label: t('Shift days shows in YYYYMMDD'),
    description: t('Shift days shows in YYYYMMDD'),
    default: false,
  },

  days_used_for_truncation: {
    type: 'TextControl',
    isInt: true,
    label: t('Days used for truncation and reorganization'),
    description: t('截断、重组的天数'),
  },

  all_columns_custom: {
    type: 'SelectControl',
    multi: true,
    label: t('Columns'),
    validators: [v.nonEmpty],
    default: [],
    description: t('Columns to display'),
    optionRenderer: c => <ColumnOption column={c} showType />,
    valueRenderer: c => <ColumnOption column={c} />,
    valueKey: 'column_name',
    mapStateToProps: state => ({
      options: (state.datasource) ? state.datasource.columns : [],
    }),
  },

  metric_caption: {
    type: 'TextControl',
    label: t('Metric caption'),
    default: 'Metric',
    description: t('Metric caption'),
  },

  index_order: {
    type: 'TextControl',
    label: t('Index order'),
    default: '',
    description: t('Index order'),
  },

  font_weight_class: {
    label: t('Font Weight Class'),
    description: t('Font Weight Class'),
    type: 'SelectControl',
    clearable: false,
    default: 'normal',
    choices: [
      ['font_weight_normal', 'normal'],
      ['font_weight_bold', 'bold'],
      ['font_weight_inherit', 'inherit'],
    ],
  },

  connect_nulls: {
    type: 'CheckboxControl',
    label: t('Connect Nulls'),
    description: t('Connect Nulls'),
    default: false,
    renderTrigger: true,
  },

  map_select: {
    label: t('Map Select'),
    description: t('Map Select'),
    type: 'SelectControl',
    clearable: false,
    default: 'china',
    choices: [
      ['world', '世界'],
      ['china', '中国'],
      ['anhui', '安徽'],
      ['aomen', '澳门'],
      ['beijing', '北京'],
      ['chongqing', '重庆'],
      ['fujian', '福建'],
      ['gansu', '甘肃'],
      ['guangdong', '广东'],
      ['guangxi', '广西'],
      ['guizhou', '贵州'],
      ['hainan', '海南'],
      ['hebei', '河北'],
      ['heilongjiang', '黑龙江'],
      ['henan', '河南'],
      ['hubei', '湖北'],
      ['hunan', '湖南'],
      ['jiangsu', '江苏'],
      ['jiangxi', '江西'],
      ['jilin', '吉林'],
      ['liaoning', '辽宁'],
      ['neimenggu', '内蒙古'],
      ['ningxia', '宁夏'],
      ['qinghai', '青海'],
      ['shandong', '山东'],
      ['shanghai', '上海'],
      ['shanxi', '山西'],
      ['shanxi1', '陕西'],
      ['sichuan', '四川'],
      ['taiwan', '台湾'],
      ['tianjin', '天津'],
      ['xianggang', '香港'],
      ['xinjiang', '新疆'],
      ['xizang', '西藏'],
      ['yunnan', '云南'],
      ['zhejiang', '浙江'],
      ['brazil', '巴西'],
      ['indonesia', '印度尼西亚'],
      ['thailand', '泰国'],
    ],
  },

  auto_play: {
    type: 'CheckboxControl',
    label: t('Auto Play'),
    description: t('Auto Play'),
    default: false,
    renderTrigger: true,
  },

  auto_play_interval: {
    type: 'TextControl',
    label: t('Auto Play Interval'),
    default: 2000,
    isInt: true,
    description: t('Auto Play Interval'),
  },

  pie_title: {
    type: 'TextControl',
    label: t('Pie Title'),
    description: t('Pie Title'),
    default: '标的',
    validators: [v.nonEmpty],
  },

  display_date_in_tile: {
    type: 'CheckboxControl',
    label: t('Display Date In Title'),
    description: t('Display Date In Title'),
    renderTrigger: true,
    default: true,
  },

  stroke_type: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Stroke Type'),
    validators: [v.nonEmpty],
    default: 'solid',
    choices: formatSelectOptions(['solid', 'dashed', 'dotted']),
  },

  data_display_type: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Data Display Type'),
    validators: [v.nonEmpty],
    default: 'line',
    choices: formatSelectOptions(['line', 'bar']),
  },

  whether_show_average_line: {
    type: 'CheckboxControl',
    label: t('Whether Show Average Line'),
    description: t('Whether Show Average Line'),
    renderTrigger: true,
    default: true,
  },

  font_size: {
    type: 'TextControl',
    label: t('Font Size'),
    default: 17,
    isInt: true,
    description: t('Font Size'),
  },

  font_size_2: {
    type: 'TextControl',
    label: t('Font Size'),
    default: 17,
    isInt: true,
    description: t('Font Size'),
  },

  history_data_interface_url: {
    type: 'TextControl',
    label: t('History Data Interface Url'),
    description: t('History Data Interface Url'),
  },

  latest_data_interface_url: {
    type: 'TextControl',
    label: t('Latest Data Interface Url'),
    description: t('Latest Data Interface Url'),
  },

  date_column_name: {
    type: 'TextControl',
    label: t('Date Column Name'),
    description: t('Date Column Name'),
    validators: [v.nonEmpty],
  },

  value_column_name: {
    type: 'TextControl',
    label: t('Single Value Column Name.For example: Column_A'),
    description: t('Single Value Column Name.For example: Column_A'),
    validators: [v.nonEmpty],
  },

  whether_show_title: {
    type: 'CheckboxControl',
    label: t('Whether Show Title'),
    description: t('Whether Show Title'),
    default: false,
  },

  value_type: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Value Type'),
    validators: [v.nonEmpty],
    default: 'origin',
    choices: formatSelectOptions(['origin', 'percent', 'ten thousand', 'a hundred million']),
  },

  whether_use_accumulate_value: {
    type: 'CheckboxControl',
    label: t('Whether Accumulate Origin Value'),
    description: t('Whether Accumulate Origin Value'),
    default: false,
  },

  chart_title: {
    type: 'TextControl',
    label: t('Chart Title'),
    description: t('Chart Title'),
    default: '标题',
    validators: [v.nonEmpty],
  },

  refresh_interval: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Refresh_interval, The Unit is milliseconds'),
    validators: [v.integer],
    default: 30000,
    choices: formatSelectOptions([10000, 20000, 30000, 60000, 120000, 180000]),
  },

  excel_url: {
    type: 'TextControl',
    label: t('Excel Url'),
    description: t('Excel Url'),
    validators: [v.nonEmpty],
  },

  excel_load_parameter: {
    type: 'TextAreaControl',
    default: '',
    language: 'javascript',
    minLines: 3,
    maxLines: 5,
    label: t('Excel Load Parameter'),
    offerEditInModal: false,
    description: t('Example: index=False, skiprows=20'),
  },

  data_frame_to_html_parameter: {
    type: 'TextAreaControl',
    default: '',
    language: 'javascript',
    minLines: 3,
    maxLines: 5,
    label: t('DataFrame To Html Parameter'),
    offerEditInModal: false,
    description: t("Example: classes=['df', 'table'], header=False"),
  },

  start_row: {
    type: 'TextControl',
    label: t('Start Row'),
    isInt: true,
    validators: [v.integer, v.nonEmpty],
    default: 0,
    description: t('Start Row'),
  },

  end_row: {
    type: 'TextControl',
    label: t('End Row'),
    isInt: true,
    validators: [v.integer],
    description: t('End Row'),
  },

  start_column: {
    type: 'TextControl',
    label: t('Start Column'),
    isInt: true,
    validators: [v.integer, v.nonEmpty],
    default: 0,
    description: t('Start Column'),
  },

  end_column: {
    type: 'TextControl',
    label: t('End Column'),
    isInt: true,
    validators: [v.integer],
    description: t('End Column'),
  },

  excel_style: {
    type: 'TextAreaControl',
    label: t('Excel CSS Style'),
    default: '',
    language: 'html',
    minLines: 4,
    maxLines: 10,
    offerEditInModal: false,
    description: t('.df tbody tr { background-color: #87CEEB; }'),
  },

  lowest_limit: {
    type: 'TextControl',
    isInt: true,
    validators: [v.integer],
    label: t('lowest limit'),
    description: t('值下限'),
  },

  highest_limit: {
    type: 'TextControl',
    isInt: true,
    validators: [v.integer],
    label: t('highest limit'),
    description: t('值上限'),
  },

  whether_accumulate: {
    type: 'CheckboxControl',
    label: t('whether accumulate'),
    description: t('是否累积'),
    default: false,
  },

  series_color: {
    type: 'TextControl',
    label: t('series color'),
    description: t('自定义图表系列颜色，参数说明：{"系列名1":"#FF0000","系列名2":"#00FF00"}'),
  },

  series_line_width: {
    type: 'TextControl',
    label: t('曲线Size，参数说明：{"系列名1":5,"系列名2":3}'),
    description: t('自定义系列曲线Size，参数说明：{"系列名1":5,"系列名2":3}'),
  },

  series_line_width_order: {
    type: 'TextControl',
    label: t('曲线Size(年份倒序)，参数说明：{"1":5,"2":3}'),
    description: t('曲线Size(年份倒序)，参数说明：{"1":5,"2":3}，1表示最新年份，2表示次新年份，以此类推'),
  },

  opacity: {
    type: 'TextControl',
    label: t('opacity'),
    validators: [v.nonEmpty, v.numeric],
    default: 0.5,
    renderTrigger: true,
    description: t('透明度，线条,柱状图,面积图,气泡等图形的透明度'),
  },

  beautifulsoup_expression: {
    type: 'TextControl',
    label: t('BeautifulSoup Expression'),
    description: t("BeautifulSoup Expression,For Example:soup.find_all(class_='sina')[0]"),
  },

  column_isdate: {
    type: 'CheckboxControl',
    label: t('列是否显示为日期'),
    description: t('列是否显示为日期'),
    renderTrigger: true,
    default: false,
  },

  x_only_month: {
    type: 'CheckboxControl',
    label: t('x轴时间只显示月份'),
    description: t('x轴时间只显示月份'),
    renderTrigger: true,
    default: false,
  },

  highlight_tick_zero: {
    type: 'CheckboxControl',
    label: t('0轴线是否高亮显示'),
    renderTrigger: true,
    default: false,
    description: t('0轴线是否高亮显示'),
  },

  column_order_list: {
    type: 'TextControl',
    label: t("列顺序,例如:[('value', 'column1'),('value', 'column2')]兼容[2,3,4,1]"),
    description: t('指定列顺序'),
  },

  area_list: {
    type: 'TextControl',
    label: t('指定展示为基础area图形的指标,例如:["指标1","指标2"]'),
    description: t('指定展示为基础area图形的指标,例如:["指标1","指标2"]'),
  },

  hide_rows: {
    type: 'TextControl',
    label: t('隐藏头部指定行,例如：1|3'),
    description: t('隐藏头部指定行(多行用|分隔),例如：1|3'),
  },

  text_replace: {
    type: 'TextControl',
    freeForm: true,
    label: t('表头部文本替换,例如：{"原字符":"新字符"}'),
    description: t('表头部文本替换,例如：{"原字符":"新字符","原字符1":"新字符1"}'),
  },

  text_replace_x: {
    type: 'TextControl',
    freeForm: true,
    label: t('x轴文本替换,例如：{"原字符":"新字符"}'),
    description: t('x轴文本替换,例如：{"原字符":"新字符","原字符1":"新字符1"}'),
  },

  order_by_asc: {
    type: 'CheckboxControl',
    label: t('index 按正序排序'),
    description: t('Time 列按正序排序'),
    default: false,
  },

  y_axis_format_left: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Y轴格式化(左)'),
    renderTrigger: true,
    default: '',
    choices: [['%', '%'], ['万', '万'], ['亿', '亿']].concat(D3_FORMAT_OPTIONS),
  },

  y_axis_format_right: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Y轴格式化(右1)'),
    renderTrigger: true,
    default: '',
    choices: [['%', '%'], ['万', '万'], ['亿', '亿']].concat(D3_FORMAT_OPTIONS),
  },

  y_axis_format_right2: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Y轴格式化(右2)'),
    renderTrigger: true,
    default: '',
    choices: [['%', '%'], ['万', '万'], ['亿', '亿']].concat(D3_FORMAT_OPTIONS),
  },

  y_axis_format_right3: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Y轴格式化(右3)'),
    renderTrigger: true,
    default: '',
    choices: [['%', '%'], ['万', '万'], ['亿', '亿']].concat(D3_FORMAT_OPTIONS),
  },

  current_color_prior: {
    type: 'CheckboxControl',
    label: t('优先采用最新系列颜色'),
    description: t(
      '优先采用最新系列颜色',
    ),
    default: false,
    renderTrigger: true,
  },

  editor_content: {
    type: 'TextControl',
    label: t('图表脚注'),
    default: '',
    description: t('图表脚注'),
  },

  th_width: {
    type: 'TextControl',
    freeForm: true,
    label: t('列宽度,例如：{"列1":"20px","列2":"10%"}'),
    description: t('列宽度,例如：{"列1":"20px","列2":"10%"}'),
  },

    show_horizontal: {
    type: 'CheckboxControl',
    label: t('Bar 水平显示'),
    renderTrigger: true,
    default: false,
    description: t('是否水平显示Bar图'),
  },

    brushExtentStart: {
    type: 'TextControl',
    label: t('缩放窗口起点: 0<= 起点 <=1'),
    validators: [v.nonEmpty, v.numeric],
    default: 0.5,
    renderTrigger: true,
    description: t('缩放窗口起点: 0<= 起点 <=1'),
  },

    festival_type: {
    type: 'SelectControl',
    freeForm: true,
    label: t('节日名称'),
    default: '春节',
    choices: formatSelectOptions(['春节', '中秋节']),
  },

  show_lastvalue: {
    type: 'CheckboxControl',
    label: t('显示最新值'),
    description: t('显示最新值'),
    default: false,
    renderTrigger: true,
  },

  show_last_date: {
    type: 'CheckboxControl',
    label: t('显示最新日期'),
    description: t('显示最新日期'),
    default: false,
    renderTrigger: true,
  },

  table_column_num: {
    type: 'SelectControl',
    freeForm: true,
    label: t('排序列序号'),
    default: '',
    choices: [[0, 2], [1, 3], [2, 4], [3, 5],
        [4, 6], [5, 7], [6, 8], [7, 9], [8, 10]],
  },

  order_type: {
    type: 'SelectControl',
    freeForm: true,
    label: t('排序类型'),
    default: '',
    choices: [['asc', '升序'], ['desc', '降序']],
  },

  number_format_column: {
    type: 'TextControl',
    freeForm: true,
    label: t('各列数字格式,例如：{"1|3|5":".2f","2|4":".2%"}'),
    description: t('指定各列数字格式,例如：{"1|3|5":".2f","2|4":".2%"}'),
  },

  number_format_row: {
    type: 'TextControl',
    freeForm: true,
    label: t('各行数字格式,例如：{"1|3|5":".2f","2|4":".2%"}'),
    description: t('指定各行数字格式,例如：{"1|3|5":".2f","2|4":".2%"}'),
  },

  sub_total: {
    type: 'CheckboxControl',
    label: t('分组合计'),
    renderTrigger: false,
    default: false,
    description: t('分组合计'),
  },

  fill_fix: {
    type: 'TextControl',
    freeForm: true,
    label: t('空数据填充-固定值'),
    description: t('空数据填充-固定值'),
    isFloat: true,
  },

  legend_selected: {
    type: 'TextControl',
    freeForm: true,
    label: t('图例状态：{"图例名A":0,"图例名B":1}'),
    description: t('0：图例不选中，1：选中'),
  },

  legend_selected_index: {
    type: 'TextControl',
    freeForm: true,
    label: t('选中图例序号,例如：[1,2],按年倒序'),
    description: t('选中图例序号,例如：[1,2],按年倒序'),
  },

  chart_width: {
    type: 'TextControl',
    freeForm: true,
    isInt: true,
    label: t('折线图宽度'),
    description: t('折线图宽度'),
  },

  chart_column: {
    type: 'TextControl',
    freeForm: true,
    label: t('画折线的列,例如:[2,3,4,6]'),
    description: t('画折线的列,例如:[2,3,4,6]'),
  },

  chart_xAix_name: {
    type: 'TextControl',
    freeForm: true,
    label: t('折线x轴类目名,例如:["类目1","类目2"]'),
    description: t('折线x轴类目名,例如:["类目1","类目2"]'),
  },

  eval_code: {
    type: 'TextControl',
    freeForm: true,
    label: t('自定义代码(不可赋值)'),
    description: t('自定义代码(不可赋值)'),
  },

  exec_code: {
    type: 'TextAreaControl',
    default: '',
    language: 'html',
    minLines: 4,
    maxLines: 10,
    offerEditInModal: false,
    freeForm: true,
    label: t('自定义代码(可赋值)'),
    description: t('自定义代码(可赋值)'),
  },

  exec_code1: {
    type: 'TextAreaControl',
    default: 'df_table = df.tail(5).copy()',
    language: 'html',
    minLines: 4,
    maxLines: 10,
    offerEditInModal: false,
    freeForm: true,
    label: t('自定义代码1(可赋值)'),
    description: t('自定义代码1(可赋值)'),
  },

  sql_expression: {
    type: 'TextControl',
    label: t('自定义分组,例如[{"expression":"AVG(指标值)","alias":"到期时间","type":"groupby","pos":1}]'),
    description: t('自定义分组,例如[{"expression":"AVG(指标值)","alias":"到期时间","type":"groupby","pos":1}]'),
  },

  color_column: {
    type: 'TextControl',
    label: t('正负数字需要颜色区分的列序号，所有列:all 或者指定:2|4'),
    description: t('正负数字需要颜色区分的列序号，所有列:all 或者指定:2|4'),
  },

  hsl_column: {
    type: 'TextControl',
    label: t('应用HSL列序号：2|4'),
    description: t('应用HSL列序号：2|4'),
  },

  row_background_color: {
    type: 'TextControl',
    freeForm: true,
    label: t('行背景色,例如：{"2020-02-01|2020-03-01":"#FFB6C1"}'),
    description: t('行背景色,例如：{"2020-02-01|2020-03-01":"#FFB6C1","2020-04-01":"#DC143C"}'),
  },

  column_order_type: {
    type: 'TextControl',
    freeForm: true,
    label: t('列排序方式：[{"1":"asc"}],asc:正序、desc:倒序'),
    description: t('列排序方式：[{"1":"asc"}],asc:正序、desc:倒序'),
  },

  standard: {
    type: 'CheckboxControl',
    label: t('标准'),
    renderTrigger: false,
    default: false,
    description: ('包含当日、前日、上周平均、近月平均、近1年平均'),
  },

  chart_symbol: {
    type: 'SelectControl',
    freeForm: true,
    label: t('最新折线标记'),
    default: '',
    choices: [['emptyCircle', '空心圆点'], ['circle', '实心圆点']],
    renderTrigger: true,
  },

  symbol_size: {
    type: 'TextControl',
    label: t('标记尺寸'),
    isInt: true,
    validators: [v.integer],
    description: t('标记尺寸'),
    renderTrigger: true,
  },

  chart_description: {
    type: 'TextAreaControl',
    label: t('图表脚注'),
    default: '',
    language: 'html',
    minLines: 4,
    maxLines: 10,
    offerEditInModal: false,
    description: t('图表脚注'),
  },

  show_area_name: {
    type: 'CheckboxControl',
    label: t('显示区域名'),
    description: t('显示区域名'),
    default: false,
    renderTrigger: true,
  },

  show_area_value: {
    type: 'CheckboxControl',
    label: t('显示区域值'),
    description: t('显示区域值'),
    default: false,
    renderTrigger: true,
  },

  lable_format: {
    type: 'SelectControl',
    freeForm: true,
    label: t('标签值格式'),
    renderTrigger: true,
    default: '',
    choices: D3_FORMAT_OPTIONS,
    description: D3_FORMAT_DOCS,
    mapStateToProps: (state) => {
      const showWarning = (
          state.controls &&
          state.controls.num_period_compare &&
          state.controls.num_period_compare.value !== '');
      return {
        // warning: showWarning ?
        //   t('When `Period Ratio` is set, the Y Axis Format is forced to `.1%`') : null,
        // disabled: showWarning,
        warning: showWarning ?
          t('When `Period Ratio` is set, the Y Axis Format recommend set to `.1%`') : null,
        disabled: false,
      };
    },
  },

  barGap: {
    type: 'TextControl',
    label: t('不同系列柱间距,值范围[-1,1]'),
    renderTrigger: false,
    default: '',
    validators: [v.numeric],
    description: t('不同系列柱间距,值范围[-1,1]'),
  },

  barCategoryGap: {
    type: 'TextControl',
    label: t('同系列柱间距,值范围[10,50]'),
    renderTrigger: false,
    default: '',
    validators: [v.numeric],
    description: t('同系列柱间距,值范围[10,50]'),
  },

  chartGrid: {
    type: 'TextControl',
    label: t('图表容器Margin,{"left":30,"right":"3%"}'),
    renderTrigger: false,
    default: '',
    description: t('图表容器Margin,{"left":30,"right":"3%"}'),
  },

  xTitleGrid: {
    type: 'TextControl',
    label: t('x轴标题Margin,{"right":"10%","bottom":"60"}'),
    renderTrigger: false,
    default: '',
    description: t('x轴标题Margin,{"right":"10%","bottom":"60"}'),
  },

  yTitleGrid: {
    type: 'TextControl',
    label: t('y轴标题Margin,{"left":"10%","top":"60"}'),
    renderTrigger: false,
    default: '',
    description: t('y轴标题Margin,{"left":"10%","top":"60"}'),
  },

  rightYaxisMinMax: {
    type: 'TextControl',
    freeForm: true,
    default: '',
    label: t('右轴边界值,如：{"1":{"min":2,"max":10},"2":{"min":2,"max":10}}'),
    description: t('{"1"(1代表右边第一个y轴):{"min":2,"max":10},"2":{"min":2,"max":10}}'),
  },

  rightMulYaxisFormat: {
    type: 'TextControl',
    freeForm: true,
    default: '',
    label: t('右轴格式,如：{"1":".1f","3":".1s"}'),
    description: t('右轴格式,如：{"1":".1f","2":".1s"},可参考Y轴格式化右1'),
  },

  show_max: {
    type: 'CheckboxControl',
    label: t('凸显最大值'),
    default: false,
    renderTrigger: true,
    description: t('凸显最大值'),
  },

  show_min: {
    type: 'CheckboxControl',
    label: t('凸显最小值'),
    default: false,
    renderTrigger: true,
    description: t('凸显最小值'),
  },

  show_y_min_max_strict: {
    type: 'CheckboxControl',
    label: t('Y轴边界严格模式'),
    default: false,
    renderTrigger: true,
    description: t('Y轴边界严格模式'),
  },

  wether_aggfunc: {
    type: 'CheckboxControl',
    label: t('是否聚合'),
    renderTrigger: false,
    default: false,
    description: t('是否聚合'),
  },

  remove_space: {
    type: 'CheckboxControl',
    label: t('x轴按实际点连续'),
    default: false,
    description: t('如勾选此项,必须同时设置上方的X轴格式'),
  },

  wether_avg_minus: {
    type: 'CheckboxControl',
    label: t('距平处理'),
    renderTrigger: false,
    default: false,
    description: t('距平处理'),
  },

  tongbi: {
    type: 'SelectControl',
    label: t('同比类型'),
    choices: [['pctchange', '同比幅度'], ['pctminus', '同比']],
    default: '',
    clearable: true,
    renderTrigger: false,
    description: t('同比类型'),
  },

  huanbi: {
    type: 'SelectControl',
    label: t('环比类型'),
    choices: [['pctchange', '环比幅度'], ['pctminus', '环比']],
    default: '',
    clearable: true,
    renderTrigger: false,
    description: t('环比类型'),
  },

  // tongbi_after: {
  //   type: 'CheckboxControl',
  //   label: t('同比(累积后)'),
  //   default: false,
  //   renderTrigger: false,
  //   description: t('同比(累积后)'),
  // },

  // huanbi_after: {
  //   type: 'CheckboxControl',
  //   label: t('环比(累积后)'),
  //   default: false,
  //   renderTrigger: false,
  //   description: t('环比(累积后)'),
  // },

  arrow_loop: {
    type: 'CheckboxControl',
    label: t('循环箭头'),
    renderTrigger: false,
    default: true,
    description: t('循环箭头'),
  },

  truncation_custom: {
    type: 'TextControl',
    label: t('自定义切分，例：{"2001-01-01":200,"2003-02-01":600}'),
    description: t('自定义切分，{"2001-01-01":200,"2003-02-01":600}'),
  },

  wether_divide_first: {
    type: 'CheckboxControl',
    label: t('起点归一化'),
    default: false,
    description: t('起点归一化'),
  },

  line_list: {
    type: 'TextControl',
    freeForm: true,
    label: t('折线图指标,如：["指标1","指标2"]'),
    description: t('折线图指标,如：["指标1","指标2"]'),
    validators: [v.nonEmpty],
  },

  hsl_color_max: {
    type: 'TextControl',
    freeForm: true,
    label: t('最大热力颜色'),
    description: t('最大热力颜色,如：[0, "100%"]'),
  },

  hsl_color_min: {
    type: 'TextControl',
    freeForm: true,
    label: t('最小热力颜色'),
    description: t('最小热力颜色,如：[120, "100%"]'),
  },

  show_hsl_bg: {
    type: 'CheckboxControl',
    label: t('显示HSL热力图'),
    default: false,
    renderTrigger: true,
    description: t('显示HSL热力图'),
  },

  show_hsl_bg_text: {
    type: 'CheckboxControl',
    label: t('文字红绿色'),
    default: false,
    renderTrigger: true,
    description: t('文字红绿色'),
  },

  hsl_reversal: {
    type: 'CheckboxControl',
    label: t('反色'),
    default: false,
    renderTrigger: true,
    description: t('反色'),
  },

  show_hsl_bg_zero: {
    type: 'CheckboxControl',
    label: t('0值白色'),
    default: false,
    renderTrigger: true,
    description: t('0值白色'),
  },

  pie_others: {
    type: 'TextControl',
    label: t('突显前N项'),
    validators: [v.integer],
    description: t('突显前N项'),
  },

  if_show_table: {
    type: 'CheckboxControl',
    label: t('显示底部表格'),
    default: false,
    renderTrigger: false,
    description: t('显示底部表格'),
  },

  x_is_time: {
    type: 'CheckboxControl',
    label: t('x轴是时间'),
    default: false,
    renderTrigger: false,
    description: t('x轴是时间'),
  },

  xy_reversal: {
    type: 'CheckboxControl',
    label: t('XY轴对调'),
    default: false,
    renderTrigger: true,
    description: t('XY轴对调'),
  },

  brushExtentStart_yAxis: {
    type: 'TextControl',
    label: t('Y缩放轴起点: 0<=起点<=100'),
    validators: [v.integer],
    renderTrigger: false,
    description: t('Y缩放轴起点: 0<=起点<=100,百分比位置'),
  },

  brushExtentEnd_yAxis: {
    type: 'TextControl',
    label: t('Y缩放轴终点: 0<=终点<=100'),
    validators: [v.integer],
    renderTrigger: false,
    description: t('Y缩放轴终点: 0<=终点<=100,百分比位置'),
  },

  show_modal_chart: {
    type: 'CheckboxControl',
    label: t('允许弹窗图表'),
    default: false,
    renderTrigger: true,
    description: t('允许弹窗图表'),
  },

  index_slice_order: {
    type: 'TextControl',
    label: t('x轴切片顺序'),
    default: '',
    description: t('[[2, 10], [30, 41]]，代表2至10,30至41，如是时间请参考[["20230515","20301231"]]'),
  },

  pre_days: {
    type: 'SelectControl',
    freeForm: true,
    validators: [v.integer],
    label: t('节前天数'),
    renderTrigger: false,
    default: '',
    choices: [[180, 180], [270, 270]],
  },

  after_days: {
    type: 'SelectControl',
    freeForm: true,
    validators: [v.integer],
    label: t('节后天数'),
    renderTrigger: false,
    default: '',
    choices: [[180, 180], [270, 270]],
  },

  is_item: {
    type: 'CheckboxControl',
    label: t('仅提示选中项'),
    default: false,
    renderTrigger: true,
    description: t('提示框仅提示选中项'),
  },

  hidden_grid: {
    type: 'CheckboxControl',
    label: t('隐藏网格线'),
    default: false,
    renderTrigger: true,
    description: t('隐藏图表背景网格线'),
  },

  index_tree_source: {
    type: 'TextControl',
    label: t('指标树表信息,例如：{"datasource":"tffy_ec.dbo.行情_商品价格指标列表", "indexnamefield":"指标名称","typefield":"栏目类别"}'),
    default: '',
    description: t('例如：{"datasource":"tffy_ec.dbo.行情_商品价格指标列表", "indexnamefield":"指标名称","typefield":"栏目类别"}'),
  },

  chart_description1: {
    type: 'TextControl',
    label: t('图表说明-标题后'),
    default: '',
    description: t('显示在栏目页面各图表标题后位置'),
  },

  tree_order_dict: {
    type: 'TextControl',
    label: t('树节点顺序,例如：{("目录",): ["1级2", "1级1"], ("目录", "1级1",): ["2级2", "2级1"], ("目录", "1级1", "2级1",): ["3级2", "3级1"]}'),
    default: '',
    description: t('树节点顺序,例如：{("目录",): ["1级2", "1级1"], ("目录", "1级1",): ["2级2", "2级1"], ("目录", "1级1", "2级1",): ["3级2", "3级1"]}'),
  },

  show_min_max: {
    type: 'CheckboxControl',
    label: t('按面积呈现'),
    default: false,
    renderTrigger: true,
    description: t('按面积呈现'),
  },

  divide_start: {
    type: 'CheckboxControl',
    label: t('起点归一化'),
    default: false,
    renderTrigger: false,
    description: t('起点归一化'),
  },

  sub_start: {
    type: 'CheckboxControl',
    label: t('起点归零差'),
    default: false,
    renderTrigger: false,
    description: t('起点归零差'),
  },

  event_list: {
    type: 'TextAreaControl',
    label: t('自定义事件,如: 2022-01-31|某一个事情,多个事情请换行输入'),
    default: '',
    language: 'html',
    minLines: 4,
    maxLines: 10,
    offerEditInModal: false,
    description: t('自定义事件,如: 2022-01-31|某一个事情,多个事情请换行输入'),
  },

  xAxisAxisLabel: {
    type: 'TextControl',
    label: t('x轴刻度配置{"interval":0}'),
    default: '',
    description: t('如显示所有刻度:{"interval":0}'),
  },

  yAxisAxisLabel: {
    type: 'TextControl',
    label: t('y轴刻度配置{"showMinLabel":true}'),
    default: '',
    description: t('如显示Y轴最小刻度:{"showMinLabel":true}'),
  },

  columns_by_stack: {
    type: 'TextControl',
    label: t('指定系列堆叠. 例如: Column_A|Column_B'),
    default: '',
    description: t('指定系列堆叠.例如:Column_A|Column_B,全部堆叠时,请使用 allstack'),
  },

  lable_set: {
    type: 'TextControl',
    label: t('文本标签配置{"position":"top"}'),
    default: '',
    description: t('文本标签配置{"position":"top"}'),
  },

  shift_indexes_set: {
    type: 'TextControl',
    label: t('指标偏移.如: 指标A@2|指标B@-2|showYMD@false'),
    default: '',
    description: t('指标偏移.如: 指标A@2|指标B@-2|showYMD@false'),
  },

  show_group_totitle: {
    type: 'TextControl',
    label: t('分组显示为图表标题,如: 字段A|字段B'),
    default: '',
    description: t('分组显示为图表标题,如: 字段A|字段B'),
  },

  legend_set: {
    type: 'TextControl',
    label: t('legend图例配置.例如:{"right":10}'),
    default: '',
    description: t('legend图例配置.例如:{"right":10}'),
  },

  xAxissplitLine: {
    type: 'TextControl',
    label: t('x轴grid区域中的分隔线{"show":true}'),
    default: '',
    description: t('x轴grid区域中的分隔线{"show":true}'),
  },

  barColor: {
    type: 'TextControl',
    label: t('bar正负值颜色{"positive":"#ff0000","negative":"#00ff00"}'),
    default: '',
    description: t('bar正负值颜色{"positive":"#ff0000","negative":"#00ff00"}'),
  },

  showAllSymbol: {
    type: 'CheckboxControl',
    label: t('显示所有标记'),
    default: false,
    renderTrigger: true,
    description: t('显示所有标记'),
  },

  all_columns_relation: {
    type: 'SelectControl',
    label: '节点关系列',
    multi: true,
    default: null,
    description: t('节点关系列'),
    mapStateToProps: state => ({
      choices: (state.datasource) ? state.datasource.all_cols : [],
    }),
  },

  all_columns_group: {
    type: 'SelectControl',
    label: '表分组列',
    multi: true,
    default: null,
    description: t('表分组列'),
    mapStateToProps: state => ({
      choices: (state.datasource) ? state.datasource.all_cols : [],
    }),
  },

  column_aggfunc: {
    type: 'TextControl',
    label: t('列聚合函数.如: {"列A":"sum","列B":"avg"}'),
    default: '',
    description: t('列聚合函数.如: {"列A":"sum","列B":"avg"}'),
  },

  column_width_adapt: {
    type: 'CheckboxControl',
    label: t('列宽自适应'),
    renderTrigger: true,
    default: true,
    description: t('列宽自适应'),
  },

  fields_map: {
    type: 'TextControl',
    label: t('字段匹配关系.如: {"表字段":"open","表字段":"high","表字段":"low","表字段":"close","表字段":"volume"}'),
    default: '',
    description: t('字段匹配关系.如: {"表字段":"open","表字段":"high","表字段":"low","表字段":"close","表字段":"volume"}'),
  },

  tabs_group: {
    type: 'TextControl',
    label: t('自定义分组,如{"组1":["成员1","2"], "组2":["成员3"], "其他":[]}'),
    description: t('自定义分组,如{"组1":["成员1","2"], "组2":["成员3"], "其他":[]}，不写其他时，其他组不展示'),
  },

  group_is_tabs: {
    type: 'CheckboxControl',
    label: t('标签页展示分组'),
    renderTrigger: true,
    default: false,
    description: t('标签页展示分组'),
  },

  show_cke_menu: {
    type: 'CheckboxControl',
    label: t('显示样式菜单'),
    renderTrigger: true,
    default: false,
    description: t('显示样式菜单'),
  },

  hide_chart_header: {
    type: 'CheckboxControl',
    label: t('隐藏图表标题'),
    renderTrigger: false,
    default: false,
    description: t('隐藏图表标题'),
  },

  cross_period: {
    type: 'TextControl',
    label: t('跨期配置:{"start_day":"02-01","days":400,"legend":-1/1}从每年的02-01开始,往后400天'),
    default: '',
    description: t('跨期配置:{"start_day":"02-01","days":400,"legend":-1/1}从每年的02-01开始,往后400天,legend -1: 年-1/年 1:年/年+1'),
  },

  mm_dd_align: {
    type: 'CheckboxControl',
    label: t('x轴mmdd日期对齐'),
    renderTrigger: false,
    default: false,
    description: t('x轴mmdd日期对齐'),
  },

  legend_right: {
    type: 'CheckboxControl',
    label: t('图例右侧显示'),
    default: false,
    renderTrigger: true,
    description: t('图例右侧垂直显示'),
  },

  show_t_h_bi: {
    type: 'CheckboxControl',
    label: t('同环比图标'),
    default: true,
    renderTrigger: true,
    description: t('同环比图标'),
  },

  last_minus_mean: {
    type: 'CheckboxControl',
    label: t('近-均值'),
    default: false,
    renderTrigger: false,
    description: t('最近1年减去均值'),
  },

  tooltip_position: {
    type: 'TextControl',
    label: t('提示层距上方位置：10%'),
    default: '',
    description: t('提示层距上方位置：10%'),
  },

  slice_data_from: {
    type: 'TextControl',
    label: t('数据源提示'),
    default: '',
    description: t('数据源提示'),
  },

  echarts_options: {
    type: 'EchartsOption',
    label: t('图表配置面板'),
    description: t('图表配置面板'),
    default: [],
    renderTrigger: true,
  },

  iframe_by_token: {
    type: 'CheckboxControl',
    label: t('添加token参数'),
    default: false,
    renderTrigger: false,
    description: t('添加token参数'),
  },

  iframe_app_name: {
    type: 'TextControl',
    label: t('token对应的app名称'),
    default: '',
    description: t('token对应的app名称'),
  },

  //  added by custom---end
};
export default controls;
