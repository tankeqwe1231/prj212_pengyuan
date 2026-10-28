import { ALL_COLOR_SCHEMES } from '../../modules/colors';

export const CHART_TYPE_OPTIONS = [
  { value: 'line', label: '折线' },
  { value: 'bar', label: '柱状' },
  { value: 'area', label: '面积' },
  { value: 'season', label: '季节' },
  { value: 'pivot', label: '透视图' },
];

export const SERIES_TYPE_OPTIONS = [
  { value: 'line', label: '折线图' },
  { value: 'bar', label: '柱状图' },
  { value: 'area', label: '面积图' },
];

export const DEFAULT_COLOR_SCHEME = 'zbColors';
export const PIVOT_PALETTE_SIZE = 6;

export function getPalette(scheme = DEFAULT_COLOR_SCHEME) {
  return ALL_COLOR_SCHEMES[scheme] || ALL_COLOR_SCHEMES[DEFAULT_COLOR_SCHEME] || [];
}

export function supportsSeriesOptions(chartType) {
  return chartType !== 'season' && chartType !== 'pivot';
}

export function isVisible(configs, name) {
  return !configs[name] || configs[name].visible !== false;
}

export function getVisibleRows(rows, configs, chartType) {
  const visible = (rows || []).filter(row => row && row.指标名称 && isVisible(configs || {}, row.指标名称));
  return chartType === 'season' ? visible.slice(0, 1) : visible;
}

export function getDefaultChartName(rows, configs) {
  const visible = getVisibleRows(rows, configs, 'line');
  return visible.length === 1 ? visible[0].指标名称 : '';
}

// ---------- 季节图 ----------
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function pad2(value) {
  return value < 10 ? `0${value}` : String(value);
}

export function normalizeSeasonDay(value) {
  if (value === null || value === undefined) return null;
  const match = String(value).trim().replace(/\//g, '-').match(/(?:\d{4}-)?(\d{1,2})-(\d{1,2})(?:[ T].*)?$/);
  if (!match) return null;
  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  if (month < 1 || month > 12 || day < 1 || day > DAYS_IN_MONTH[month - 1]) {
    return null;
  }
  return `${pad2(month)}-${pad2(day)}`;
}

export function buildSeasonAxis() {
  const axis = [];
  DAYS_IN_MONTH.forEach((days, monthIndex) => {
    for (let day = 1; day <= days; day += 1) {
      axis.push(`${pad2(monthIndex + 1)}-${pad2(day)}`);
    }
  });
  return axis;
}

// 返回 { axis, years, seriesData: {year: [...]}}，按全年 366 天对齐
export function buildSeasonData(timeSeriesData, columnName) {
  const dates = (timeSeriesData && timeSeriesData.index) || [];
  const columns = (timeSeriesData && timeSeriesData.columns) || [];
  const data = (timeSeriesData && timeSeriesData.data) || [];
  const columnIndex = columns.indexOf(columnName);
  const axis = buildSeasonAxis();
  if (columnIndex === -1) {
    return { axis, years: [], seriesData: {} };
  }
  const byYear = {};
  dates.forEach((date, i) => {
    const year = String(date).substring(0, 4);
    const day = normalizeSeasonDay(String(date).substring(0, 10));
    const value = (data[i] || [])[columnIndex];
    if (!day || value === '' || value === null || value === undefined) return;
    if (!byYear[year]) byYear[year] = {};
    byYear[year][day] = value;
  });
  const years = Object.keys(byYear).sort();
  const seriesData = {};
  years.forEach((year) => {
    seriesData[year] = axis.map(day => (
      Object.prototype.hasOwnProperty.call(byYear[year], day) ? byYear[year][day] : null
    ));
  });
  return { axis, years, seriesData };
}

// 季节图配色：最新年份取调色板第一个颜色
export function getSeasonColors(years, scheme) {
  const palette = getPalette(scheme);
  const last = years.length - 1;
  return years.map((year, i) => palette[(last - i) % palette.length]);
}

// ---------- 透视图 ----------
export function formatPivotDate(value) {
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})(?:[ T].*)?$/);
  return match ? match[1] : String(value);
}

export function reconcileIndicatorOrder(order, rows) {
  const names = (rows || []).map(row => row.指标名称);
  const result = (order || []).filter((name, i, list) => names.indexOf(name) !== -1 && list.indexOf(name) === i);
  names.forEach((name) => {
    if (result.indexOf(name) === -1) result.push(name);
  });
  return result;
}

export function moveIndicator(order, sourceName, targetName) {
  const result = (order || []).slice();
  const sourceIndex = result.indexOf(sourceName);
  if (sourceIndex === -1 || result.indexOf(targetName) === -1 || sourceName === targetName) {
    return result;
  }
  result.splice(sourceIndex, 1);
  result.splice(result.indexOf(targetName), 0, sourceName);
  return result;
}

export function orderRows(rows, order) {
  const byName = {};
  (rows || []).forEach((row) => {
    byName[row.指标名称] = row;
  });
  return reconcileIndicatorOrder(order, rows).map(name => byName[name]);
}

export function getVarieties(rows) {
  const varieties = [];
  (rows || []).forEach((row) => {
    const variety = String(row.品种 || '').trim();
    if (variety && varieties.indexOf(variety) === -1) varieties.push(variety);
  });
  return varieties;
}

// 品种 -> 颜色序号；按名称排序保证同一组品种配色稳定
export function buildVarietyColorMap(rows, paletteSize = PIVOT_PALETTE_SIZE) {
  const map = {};
  getVarieties(rows)
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))
    .forEach((variety, i) => {
      map[variety] = i % paletteSize;
    });
  return map;
}

export function buildPivotTable(timeSeriesData, rows, configs, order, dateRange) {
  const source = timeSeriesData || {};
  const dates = source.index || [];
  const columns = source.columns || [];
  const data = source.data || [];
  const range = dateRange || {};
  const dateOrder = dates
    .map((date, index) => ({ date, index }))
    .filter((item) => {
      const text = formatPivotDate(item.date);
      return (!range.startDate || text >= range.startDate) &&
        (!range.endDate || text <= range.endDate);
    })
    .sort((left, right) => String(right.date).localeCompare(String(left.date)));
  const indicators = orderRows(rows, order)
    .map(row => row.指标名称)
    .filter(name => isVisible(configs || {}, name) && columns.indexOf(name) !== -1);
  return {
    indicators,
    rows: dateOrder.map(item => ({
      date: item.date,
      values: indicators.map((name) => {
        const value = (data[item.index] || [])[columns.indexOf(name)];
        return value === null || value === undefined ? '' : value;
      }),
    })),
  };
}

// ---------- 折线/柱状/面积 ----------
export function buildSeriesOption(timeSeriesData, rows, configs, chartType, isStacked) {
  const dates = timeSeriesData.index || [];
  const columns = timeSeriesData.columns || [];
  const data = timeSeriesData.data || [];
  const visible = getVisibleRows(rows, configs, chartType)
    .filter(row => columns.indexOf(row.指标名称) !== -1);
  const hasRightAxis = visible.some(row => (configs[row.指标名称] || {}).yAxisIndex === 1);
  const toNumber = value => (value === '' || value === undefined ? null : value);
  const series = visible.map((row) => {
    const name = row.指标名称;
    const config = configs[name] || {};
    const type = config.chartType || chartType;
    const stacked = config.stacked !== undefined ? config.stacked : isStacked;
    const columnIndex = columns.indexOf(name);
    const item = {
      name: config.yAxisIndex === 1 ? `${name}(右轴)` : name,
      type: type === 'area' ? 'line' : type,
      data: data.map(values => toNumber(values[columnIndex])),
      connectNulls: true,
      yAxisIndex: config.yAxisIndex === 1 ? 1 : 0,
    };
    if (type === 'area') item.areaStyle = {};
    if (stacked) item.stack = 'total';
    return item;
  });
  return {
    color: getPalette(),
    tooltip: { trigger: 'axis' },
    legend: { data: series.map(item => item.name), top: 15, type: 'scroll' },
    grid: { left: '3%', right: hasRightAxis ? '8%' : '4%', bottom: '15%', containLabel: true },
    xAxis: { type: 'category', boundaryGap: chartType === 'bar', data: dates },
    yAxis: hasRightAxis
      ? [{ type: 'value', position: 'left', scale: true }, { type: 'value', position: 'right', scale: true }]
      : { type: 'value', scale: true },
    series,
    dataZoom: [{ type: 'inside' }, { show: true, type: 'slider' }],
  };
}

export function buildSeasonOption(timeSeriesData, rows, configs) {
  const target = getVisibleRows(rows, configs, 'season')
    .find(row => ((timeSeriesData.columns || []).indexOf(row.指标名称) !== -1));
  if (!target) return null;
  const { axis, years, seriesData } = buildSeasonData(timeSeriesData, target.指标名称);
  const colors = getSeasonColors(years);
  return {
    title: { text: target.指标名称, left: 'center', top: 0, textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    legend: { data: years, top: 30, type: 'scroll' },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '18%', containLabel: true },
    xAxis: { type: 'category', boundaryGap: false, data: axis },
    yAxis: { type: 'value', scale: true },
    series: years.map((year, i) => ({
      name: year,
      type: 'line',
      data: seriesData[year],
      connectNulls: true,
      showSymbol: false,
      itemStyle: { color: colors[i] },
      lineStyle: i === years.length - 1 ? { width: 3 } : undefined,
    })),
    dataZoom: [{ type: 'inside' }, { show: true, type: 'slider' }],
  };
}

// 本地存储的面板尺寸
export function readStoredSize(key, fallback, min, max) {
  try {
    const value = Number(window.localStorage.getItem(key));
    if (!Number.isFinite(value) || value <= 0) return fallback;
    return Math.min(max, Math.max(min, value));
  } catch (e) {
    return fallback;
  }
}

export function writeStoredSize(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch (e) {
    // 存储不可用时忽略
  }
}
