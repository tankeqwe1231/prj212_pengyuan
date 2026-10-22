import { t } from '../../../locales';

// EchartsOption 控件的预配置 schema。
// 通过 viztype -> 可选 Type 列表 -> 每个 Type 的子字段定义 来描述配置面板，
// 需要给某个 viztype 增减配置项时只需修改本文件。
//
// 字段(field)结构:
//   { name, label, control, options?, clearable?, placeholder? }
//   control: 'select' | 'text' | 'color' | 'checkbox'
//
// Type 配置(typeConfig)结构:
//   { perSeries: bool, items: field[] }
//   perSeries 为 true 时, 编辑器会先提供一个"子 serie"下拉(来自后端返回的 series),
//   配置值按子 serie 原始名称分别保存。

const LINE_BAR_OPTIONS = [
  { value: 'line', label: 'line' },
  { value: 'bar', label: 'bar' },
];

const Y_AXIS_OPTIONS = [
  { value: 0, label: t('左轴') },
  { value: 1, label: t('右轴') },
];

const GRID_ITEMS = [
  { name: 'top', label: 'top', control: 'text', placeholder: t('可不填') },
  { name: 'right', label: 'right', control: 'text', placeholder: t('可不填') },
  { name: 'bottom', label: 'bottom', control: 'text', placeholder: t('可不填') },
  { name: 'left', label: 'left', control: 'text', placeholder: t('可不填') },
];

const ECHARTS_OPTION_SCHEMA = {
  echarts_combine: {
    types: [
      { value: 'series', label: 'series' },
      { value: 'grid', label: 'grid' },
    ],
    fields: {
      series: {
        perSeries: true,
        items: [
          {
            name: 'type',
            label: 'type',
            control: 'select',
            options: LINE_BAR_OPTIONS,
            clearable: false,
            placeholder: 'line',
          },
          { name: 'name', label: 'name', control: 'text', placeholder: t('可不填') },
          {
            name: 'yAxisIndex',
            label: 'yAxisIndex',
            control: 'select',
            options: Y_AXIS_OPTIONS,
            placeholder: t('可不选'),
          },
          { name: 'color', label: 'itemStyle.color', control: 'color' },
          { name: 'width', label: 'lineStyle.width', control: 'text', placeholder: t('可不填') },
          { name: 'stack', label: 'stack', control: 'checkbox' },
        ],
      },
      grid: {
        perSeries: false,
        items: GRID_ITEMS,
      },
    },
  },

  echarts_stat_line_2: {
    types: [
      { value: 'series', label: 'series' },
      { value: 'grid', label: 'grid' },
    ],
    fields: {
      series: {
        perSeries: true,
        items: [
          {
            name: 'type',
            label: 'type',
            control: 'select',
            options: LINE_BAR_OPTIONS,
            clearable: false,
            placeholder: 'line',
          },
          { name: 'color', label: 'itemStyle.color', control: 'color' },
          { name: 'width', label: 'lineStyle.width', control: 'text', placeholder: t('可不填') },
        ],
      },
      grid: {
        perSeries: false,
        items: GRID_ITEMS,
      },
    },
  },
};

export default ECHARTS_OPTION_SCHEMA;
