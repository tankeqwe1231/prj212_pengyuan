// JS
import $ from 'jquery';
import throttle from 'lodash.throttle';
import d3 from 'd3';
import nv from 'nvd3';
import mathjs from 'mathjs';
import moment from 'moment';
import d3tip from 'd3-tip';
import debounce from 'lodash.debounce';

import { getColorFromScheme, getForcedColor, ALL_COLOR_SCHEMES } from '../javascripts/modules/colors';
import AnnotationTypes, {
  applyNativeColumns,
} from '../javascripts/modules/AnnotationTypes';
import { customizeToolTip, d3TimeFormatPreset, d3FormatPreset,
  tryNumify, createCkeditor, yAxisFormat } from '../javascripts/modules/utils';
import { isTruthy } from '../javascripts/utils/common';
import { t } from '../javascripts/locales';

// CSS
import 'nvd3/build/nv.d3.min.css';
import './nvd3_vis.css';
import VIZ_TYPES from './vizTypes';
// import {UTC} from "../javascripts/modules/dates";

const minBarWidth = 15;
// Limit on how large axes margins can grow as the chart window is resized
const maxMarginPad = 30;
const animationTime = 1000;
const minHeightForBrush = 480;

const BREAKPOINTS = {
  small: 340,
};

// NVD3 renders through a shared asynchronous queue.  A dashboard resize can
// enqueue several renders before the first one has run, so keep only the
// latest render for each chart facade.  A WeakMap avoids adding bookkeeping
// properties to the facade object exposed to visualizations.
const renderVersions = new WeakMap();

const addTotalBarValues = function (svg, chart, data, stacked, axisFormat, chartType = 'bar') {
  const format = d3.format(axisFormat || '.3s');
  // const countSeriesDisplayed = data.length;
  const dataFilter = data.filter(function (bar) {
    return !bar.disabled;
      });
  const countSeriesDisplayed = dataFilter.length;

  const totalStackedValues = stacked && data.length !== 0 ?
    data[0].values.map(function (bar, iBar) {
      const bars = dataFilter.map(function (series) {
        return series.values[iBar];
      });
      return d3.sum(bars, function (d) {
        return d.y;
      });
    }) : [];

  let wrapClass = 'nv-focus';
  if (chartType === 'dist_bar') {
    wrapClass = 'nv-barsWrap';
  }
  const rectsToBeLabeled = svg.selectAll(`g.${wrapClass} g.nv-group`).filter(
    function (d, i) {
      if (!stacked) {
        return true;
      }
      return i === countSeriesDisplayed - 1;
    }).selectAll('rect');

  let barsWrapClass = 'g.nv-focus g.nv-barsWrap';
  if (chartType === 'dist_bar') {
    barsWrapClass = 'g.nv-barsWrap';
  }

  const barsWrap = svg.selectAll(`${barsWrapClass} > g`);
  if (barsWrap[0].length > 1) {
    svg.selectAll(`${barsWrapClass} > g:last-of-type`).remove();
  }
  const groupLabels = svg.select(`${barsWrapClass}`).append('g');
  rectsToBeLabeled.each(
    function (d, index) {
      const rectObj = d3.select(this);
      if (rectObj.attr('class').includes('positive') || rectObj.attr('class').includes('negative')) {
        const transformAttr = rectObj.attr('transform');
        let barHeight = 1;
        if (d.y < 0) {
          barHeight = -(this.getBBox().height + 10);
        }
        const yPos = parseFloat(rectObj.attr('y'));
        const xPos = parseFloat(rectObj.attr('x'));
        const rectWidth = parseFloat(rectObj.attr('width'));
        const textEls = groupLabels.append('text')
          .attr('x', xPos) // rough position first, fine tune later
          .attr('y', yPos - barHeight)
          .text(format(stacked ? totalStackedValues[index] : d.y))
          .attr('transform', transformAttr)
          .attr('class', 'bar-chart-label');
        const labelWidth = textEls.node().getBBox().width;
        textEls.attr('x', xPos + rectWidth / 2 - labelWidth / 2); // fine tune
      }
    });
};

function hideTooltips() {
  $('.nvtooltip').css({ opacity: 0 });
}

function makeTxtBG(elem, bgcolor, className) {
  const svgns = 'http://www.w3.org/2000/svg';
  const bounds = elem.getBBox();
  const rect = document.createElementNS(svgns, 'rect');
    rect.setAttribute('x', bounds.x);
    rect.setAttribute('y', bounds.y);
    rect.setAttribute('width', bounds.width);
    rect.setAttribute('height', bounds.height);
    rect.setAttribute('fill', bgcolor);
    rect.setAttribute('class', className);
//    ctx.insertBefore(rect, elem);
    elem.parentNode.insertBefore(rect, elem);
}

function getMaxLabelSize(container, axisClass) {
  // axis class = .nv-y2  // second y axis on dual line chart
  // axis class = .nv-x  // x axis on time series line chart
  const labelEls = container.find(`.${axisClass} text`).not('.nv-axislabel');
  const labelDimensions = labelEls.map(i => labelEls[i].getComputedTextLength() * 0.75);
  return Math.ceil(Math.max(...labelDimensions));
}

export function formatLabel(input, verboseMap = {}) {
  // The input for label may be a string or an array of string
  // When using the time shift feature, the label contains a '---' in the array
  const verboseLkp = s => verboseMap[s] || s;
  let label;
  if (Array.isArray(input) && input.length) {
    const verboseLabels = input.filter(s => s !== '---').map(verboseLkp);
    label = verboseLabels.join(', ');
    if (input.length > verboseLabels.length) {
      label += ' ---';
    }
  } else {
    label = verboseLkp(input);
  }
  return label;
}

export function getLastValue(values, xAxisPos = 0) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }

  let lastPosition = values.length - 1;
  if (xAxisPos) {
    for (let i = 0; i < values.length; i += 1) {
      if (values[i] && values[i].x >= xAxisPos) {
        // Keep the point immediately before the brush position when the
        // first point at that position is already beyond the brush extent.
        lastPosition = Math.max(i - (values[i].x > xAxisPos ? 1 : 0), 0);
        break;
      }
    }
  }

  return values[lastPosition] || null;
}

export function getBarTickValues(values, availableWidth, showMinMax = false) {
  if (!Array.isArray(values) || !values.length || availableWidth <= 0) {
    return [];
  }
  const tickInterval = Math.max(1, Math.ceil(values.length / (availableWidth / 100)));
  return values
    .filter((d, i) => (
      i % tickInterval === 0 ||
      (showMinMax && (i === 0 || i === values.length - 1))
    ))
    .map(d => d.x)
    .filter((x, i, ticks) => ticks.indexOf(x) === i);
}

export function getStaggeredXAxisBottomMargin(vizType, reduceXTicks) {
  return vizType === VIZ_TYPES.bar && !reduceXTicks ? 60 : 40;
}

// Chart facades expose annotationData as a read-only getter. Build a fresh
// object before adding annotations that are defined directly in form data so
// rendering never attempts to mutate the facade (or Redux state) in place.
export function buildAnnotationData(annotationData, eventList) {
  const result = { ...(annotationData || {}) };
  if (eventList) {
    const eventArray = eventList.split('\n').map((item) => {
      const [date, description] = item.split('|');
      return {
        发生时间: `${date}T00:00:00`,
        基本面事件: description,
      };
    });
    result.selfEvent = { columns: ['发生时间', '基本面事件'], records: eventArray };
  }
  return result;
}

// nvd3 keeps `height: 100%` on the chart svg while the horizontally scrollable
// bar charts override the width with `auto`.  Once the horizontal scrollbar
// eats into the visible height, `auto` is resolved from the svg's intrinsic
// width/height ratio, so the viewport becomes narrower than the rendered chart
// and clips the trailing bars, the legend and the boundary x labels.  The gap
// is proportional to the chart width, which is why only charts with many bars
// look broken.  Pin the used width whenever the chart is wider than its
// container so the viewport always matches what was rendered.
export function getPinnedSvgWidth(chartWidth, containerWidth) {
  if (!chartWidth || chartWidth <= containerWidth) {
    return null;
  }
  return `${chartWidth}px`;
}

const extractUniqueX = (data) => {
  const xSet = new Set();
  data.forEach((item, index) => {
    if (index === 0 || item.classed) {
      item.values.forEach((value) => {
        xSet.add(value.x);
      });
    }
  });
  return Array.from(xSet).sort((a, b) => a - b);
};

export default function nvd3Vis(slice, payload) {
  let chart;
  let colorKey = 'key';
  const isExplore = $('#explore-container').length === 1;
  const fd = slice.formData;
  const annotationData = buildAnnotationData(slice.annotationData, fd.event_list);
  const renderVersion = (renderVersions.get(slice) || 0) + 1;
  renderVersions.set(slice, renderVersion);

  let data;
  const xAixsTickV = [];
  const xAixsTickI = [];
  if (payload.data) {
    data = payload.data.map((x, index) => {
      if (fd.viz_type === 'line') {
        const values = x.values.map(function (obj) {
          if (index === 0) {
            xAixsTickV.push(obj.x);
            xAixsTickI.push(obj.i);
          }
          return { x: Math.floor(obj.x), y: obj.y, i: obj.i };
        });
        return {
          values, key: formatLabel(x.key, slice.datasource.verbose_map),
        };
      }
      return {
          ...x, key: formatLabel(x.key, slice.datasource.verbose_map),
        };
    });
  } else {
    data = [];
  }

  const dataOrder = [];
  const oldPosition = [];
  const columnOrder = fd.column_order_list;
  if (columnOrder) {
    const columnOrderList = columnOrder.split('|');
    if (fd.viz_type === 'box_plot') {
      columnOrderList.forEach((item) => {
        data.forEach((item1, index) => {
          if (item === item1.label) {
            dataOrder.push(item1);
            oldPosition.push(index);
          }
        });
      });
    } else {
      columnOrderList.forEach((item) => {
        data.forEach((item1, index) => {
          if (item === item1.key) {
            dataOrder.push(item1);
            oldPosition.push(index);
          }
        });
      });
    }

    if (data.length > dataOrder.length) {
      data.forEach((item, index) => {
        if (!oldPosition.includes(index)) {
          dataOrder.push(item);
        }
      });
    }
    data = dataOrder;
  }

  slice.container.html('');
  slice.clearError();

  let width = slice.width();

  const barchartWidth = function () {
    let bars;
    if (fd.bar_stacked) {
      bars = d3.max(data, function (d) { return d.values.length; });
    } else {
      bars = d3.sum(data, function (d) { return d.values.length; });
    }
    if (bars * minBarWidth > width) {
      return bars * minBarWidth;
    }
    return width;
  };

  const vizType = fd.viz_type;
  const f = d3.format('.3s');
  let reduceXTicks = fd.reduce_x_ticks || false;
  if (vizType === 'dist_bar' && fd.show_horizontal) {
    reduceXTicks = true;
  }
  slice.container.toggleClass(
    'reduce-x-ticks-disabled',
    vizType === VIZ_TYPES.bar && !reduceXTicks,
  );
  let stacked = false;
  let row;

  // 改为line图后端python切片
  // const recalculateDataCompareLag = function (data, compare_lag) {
  //   return data.map((x) => {
  //     let newValues = x.values.slice(-compare_lag);
  //     return {
  //       ...x,
  //       values: newValues
  //     };
  //   });
  // }
  // if (vizType === 'line' && fd.compare_lag && fd.list_ratio_type) {
  //   data = recalculateDataCompareLag(data, fd.compare_lag);
  // }

  const drawGraph = function () {
    // Do not let an older queued render clear the chart produced by a newer
    // resize/render request.
    if (renderVersions.get(slice) !== renderVersion) {
      return null;
    }
    slice.container.html('');
    const yAxisFormatter = yAxisFormat(fd.y_axis_format);

    let svg = d3.select(slice.selector).select('svg');
    if (svg.empty()) {
      svg = d3.select(slice.selector).append('svg');
    }
    const EditorId = 'ckeditor_' + slice.containerId;
    const editordiv = d3.select('#' + EditorId);
    let height = slice.height();
    if (fd.editor_content) {
        // const lineCount = fd.editor_content.split('<p>').length;
        const lineCount = 1;
        const ckHeight = lineCount > 0 ? lineCount * 22 : 0;
        height = slice.height() - ckHeight;
        if (editordiv.empty()) {
      $(slice.selector).append("<div id='" + EditorId + "' style='width:" + slice.width() + 'px;height:' + ckHeight
          + "px;line-height:0.3;padding-top: 7px'></div>");
    }
        $('#' + EditorId).html(fd.editor_content);
    // createCkeditor(slice, EditorId, lineCount, ckHeight);
        $(slice.selector + ' svg').css('height', height);
    }
    const isTimeSeries = [
      'line', 'dual_line', 'area', 'compare', 'bar', 'time_pivot'].indexOf(vizType) >= 0;

    // Handling xAxis ticks settings
    let xLabelRotation = 0;
    let staggerLabels = false;
    if (fd.x_ticks_layout === 'auto') {
      if (['column', 'dist_bar'].indexOf(vizType) >= 0) {
        xLabelRotation = 45;
      } else if (isTimeSeries) {
        staggerLabels = true;
      }
    } else if (fd.x_ticks_layout === 'staggered') {
      staggerLabels = true;
    } else if (fd.x_ticks_layout === '45°') {
      if (isTruthy(fd.show_brush)) {
        const error = t('You cannot use 45° tick layout along with the time range filter');
        slice.error(error);
        return null;
      }
      xLabelRotation = 45;
    }
    const showBrush = (
      isTruthy(fd.show_brush) ||
      (fd.show_brush === 'auto' && height >= minHeightForBrush && fd.x_ticks_layout !== '45°')
    );

    const textReplace = fd.text_replace ? JSON.parse(fd.text_replace) : {};
    const seriesColor = fd.series_color ? JSON.parse(fd.series_color) : {};
    const textReplaceX = fd.text_replace_x ? JSON.parse(fd.text_replace_x) : {};
    const seriesLineWidth = fd.series_line_width ? JSON.parse(fd.series_line_width) : {};
    // 保存折线图的series颜色
    const lineColorMap = {};

    data = data.map((value) => {
      const valTmp = value;
        if (fd.viz_type === 'box_plot' && textReplace.hasOwnProperty(valTmp.label)) {
            valTmp.label = textReplace[valTmp.label];
        } else if (textReplace.hasOwnProperty(value.key)) {
            valTmp.key = textReplace[valTmp.key];
        }

        if (fd.text_replace_x) {
          valTmp.values.forEach(((v1) => {
              if (textReplaceX.hasOwnProperty(v1.x)) {
                    v1.x = textReplaceX[v1.x];
                  }
              }));
        }
        return valTmp;
    });

    switch (vizType) {
      case 'line':
        if (showBrush) {
          chart = nv.models.lineWithFocusChart();
          chart.options({ extraDict: { compare_lag: fd.compare_lag, list_ratio_type: fd.list_ratio_type, remove_space: fd.remove_space } });
          if (data.length && data[0].values.length > 1) {
            let brushExtentStart = Math.round(data[0].values.length * fd.brushExtentStart);
            if (brushExtentStart >= data[0].values.length) {
              brushExtentStart = data[0].values.length - 1;
            }
            chart.options({
              brushExtent: [data[0].values[brushExtentStart].x,
                  data[0].values[data[0].values.length - 1].x],
            });
            if (fd.remove_space) {
              chart.options({
                  brushExtent: [data[0].values[brushExtentStart].i,
                      data[0].values[data[0].values.length - 1].i],
                });
            }
          }
          if (staggerLabels) {
            // Give a bit more room to focus area if X axis ticks are staggered
            chart.focus.margin({ bottom: 40 });
            chart.focusHeight(80);
          }
          if (!fd.remove_space) {
            chart.focus.xScale(d3.time.scale.utc());
          }
          // chart.focus.xScale(d3.time.scale.utc());

        } else {
          chart = nv.models.lineChart();
        }
        // To alter the tooltip header
        // chart.interactiveLayer.tooltip.headerFormatter(function(){return '';});
        // chart.xScale(d3.time.scale.utc());
          if (!fd.remove_space) {
            chart.xScale(d3.time.scale.utc());
          } else {
            chart.x(d => d.i);
            chart.options({
              removeSpace: true,
            });
          }
        chart.interpolate(fd.line_interpolation);
        break;

      case 'time_pivot':
        chart = nv.models.lineChart();
        chart.xScale(d3.time.scale.utc());
        chart.interpolate(fd.line_interpolation);
        break;

      case 'dual_line':
        chart = nv.models.multiChart();
        chart.interpolate('linear');
        break;

      case 'bar': {
        chart = nv.models.multiBarWithFocusChart()
        .showControls(fd.show_controls)
        .reduceXTicks(reduceXTicks)
        .groupSpacing(0.1);
            // .focusEnable(showBrush);

        if (!reduceXTicks) {
          width = barchartWidth();
        }
        chart.width(width);
        if (!reduceXTicks && data.length && data[0].values.length && chart.xAxis.tickValues) {
          const margins = chart.margin();
          const availableWidth = chart.width() - margins.left - margins.right;
          chart.xAxis.tickValues(getBarTickValues(
            data[0].values,
            availableWidth,
            fd.x_axis_showminmax,
          ));
        }
        chart.xAxis
        .showMaxMin(fd.x_axis_showminmax);

        // stacked = fd.bar_stacked;
        let lengendStyle = 'group';
        if (fd.bar_stacked) {
          lengendStyle = 'stack';
          stacked = fd.bar_stacked;
        }
        if (fd.bar_expand) {
          lengendStyle = 'expand';
          stacked = fd.bar_expand;
        }
        chart.stacked(stacked);
        chart.style(lengendStyle);

        if (fd.show_bar_value) {
          setTimeout(function () {
            addTotalBarValues(svg, chart, data, stacked, fd.y_axis_format);
          }, animationTime);
        }
        chart.legend.dispatch.on('legendClick', function (d, i) {
          // if (data[i].hasOwnProperty('disabled')) {
          //   data[i].disabled = !data[i].disabled;
          // } else {
          //   data[i].disabled = false;
          // }
           if (fd.show_bar_value) {
               setTimeout(function () {
                   addTotalBarValues(svg, chart, data, stacked, fd.y_axis_format);
               }, animationTime);
           }
          // console.log('legendClick', d, i);
        });

        // chart.dispatch.on('brush', function (d) {
        //    if (fd.show_bar_value) {
        //        // setTimeout(function () {
        //        //     addTotalBarValues(svg, chart, data, stacked, fd.y_axis_format);
        //        // }, animationTime);
        //      console.log('brush trigger', d);
        //    }
        // });
        break;
      }

      case 'dist_bar':
        chart = fd.show_horizontal ? nv.models.multiBarHorizontalChart()
            : nv.models.multiBarChart();
        chart.showControls(fd.show_controls);
        if (!fd.show_horizontal) {
          chart.reduceXTicks(reduceXTicks);
        }
        if (fd.show_bar_value && fd.show_horizontal) {
          chart.showValues(fd.show_bar_value);
        }
        chart.groupSpacing(0.1); // Distance between each group of bars.

        chart.xAxis.showMaxMin(false);

        stacked = fd.bar_stacked;
        chart.stacked(stacked);
        if (fd.order_bars) {
          data.forEach((d) => {
            d.values.sort((a, b) => tryNumify(a.x) < tryNumify(b.x) ? -1 : 1);
          });
        }
        if (fd.show_bar_value && !fd.show_horizontal) {
          setTimeout(function () {
            addTotalBarValues(svg, chart, data, stacked, fd.y_axis_format, 'dist_bar');
          }, animationTime);
        }
        if (!reduceXTicks) {
          width = barchartWidth();
        }
        chart.width(width);
        break;

      case 'pie':
        chart = nv.models.pieChart();
        colorKey = 'x';
        chart.valueFormat(f);
        if (fd.donut) {
          chart.donut(true);
        }
        chart.labelsOutside(fd.labels_outside);
        chart.labelThreshold(0.05);  // Configure the minimum slice size for labels to show up
        if (fd.pie_label_type !== 'key_percent' && fd.pie_label_type !== 'key_value') {
          chart.labelType(fd.pie_label_type);
        } else if (fd.pie_label_type === 'key_value') {
          chart.labelType(d => `${d.data.x}: ${d3.format('.3s')(d.data.y)}`);
        }
        chart.cornerRadius(true);

        if (fd.pie_label_type === 'percent' || fd.pie_label_type === 'key_percent' || fd.pie_label_type === 'key_v_percent') {
          let total = 0;
          data.forEach((d) => { total += d.y; });
          chart.tooltip.valueFormatter(d => `${((d / total) * 100).toFixed()}%`);
          if (fd.pie_label_type === 'key_percent') {
            chart.labelType(d => `${d.data.x}: ${((d.data.y / total) * 100).toFixed()}%`);
          }
          if (fd.pie_label_type === 'key_v_percent') {
            chart.labelType(d => `${d3.format('.3s')(d.data.y)}: ${((d.data.y / total) * 100).toFixed()}%`);
          }
        }

        break;

      case 'column':
        chart = nv.models.multiBarChart()
        .reduceXTicks(false);
        break;

      case 'compare':
        chart = nv.models.cumulativeLineChart();
        chart.xScale(d3.time.scale.utc());
        chart.useInteractiveGuideline(true);
        chart.xAxis.showMaxMin(false);
        break;

      case 'bubble':
        row = (col1, col2) => `<tr><td>${col1}</td><td>${col2}</td></tr>`;
        chart = nv.models.scatterChart();
        chart.showDistX(true);
        chart.showDistY(true);
        chart.tooltip.contentGenerator(function (obj) {
          const p = obj.point;
          let s = '<table>';
          s += (
            `<tr><td style="color: ${p.color};">` +
              `<strong>${p[fd.entity]}</strong> (${p.group})` +
            '</td></tr>');
          s += row(fd.x, f(p.x));
          s += row(fd.y, f(p.y));
          s += row(fd.size, f(p.size));
          s += '</table>';
          return s;
        });
        chart.pointRange([5, fd.max_bubble_size ** 2]);
        chart.pointDomain([0, d3.max(data, d => d3.max(d.values, v => v.size))]);
        break;

      case 'area':
        chart = nv.models.stackedAreaChart();
        chart.showControls(fd.show_controls);
        chart.style(fd.stacked_style);
        chart.xScale(d3.time.scale.utc());
        break;

      case 'box_plot':
        colorKey = 'label';
        chart = nv.models.boxPlotChart();
        chart.x(d => d.label);
        chart.maxBoxWidth(75); // prevent boxes from being incredibly wide
        chart.tooltip.contentGenerator(function (d) {
          const keyAlias = { Q1: '25%', Q2: '50%', Q3: '75%' };
          let tooltip = '';
          tooltip += "<table><thead><tr><td colspan='3'>"
            + `<strong class='x-value'>${d.key ? d.key : ''}</strong>`
            + '</td></tr></thead><tbody>';
          // d.series.sort((a, b) => a.value >= b.value ? -1 : 1);
          d.series.forEach((series) => {
            let value = '';
            if (series.value) {
              value = series.value;
              if (fd.y_axis_format) {
                value = yAxisFormatter(series.value);
              }
            }

            let key = series.key;
            if (!d.hasOwnProperty('data')) {
              if (fd.y_axis_format) {
                key = yAxisFormatter(key);
              }
            }
            tooltip += (
              '<tr>' +
                '<td class="legend-color-guide">' +
                  '<div ' +
                    `style="background-color: ${series.color};"` +
                  '></div>' +
                '</td>' +
                `<td class="key">${keyAlias.hasOwnProperty(series.key) ? keyAlias[series.key] : key}</td>` +
                `<td class="value">${value}</td>` +
              '</tr>'
            );
          });
          if (d.hasOwnProperty('data')) {
              tooltip += (
              '<tr>' +
                '<td class="legend-color-guide">' +
                  '<div ' +
                    `style="background-color: ${d.series[0].color};"` +
                  '></div>' +
                '</td>' +
                '<td class="key">最大</td>' +
                `<td class="value">${fd.y_axis_format ? yAxisFormatter(d.data.values.extra_data.max) : d.data.values.extra_data.max}</td>` +
              '</tr>' +
              '<tr>' +
                '<td class="legend-color-guide">' +
                  '<div ' +
                    `style="background-color: ${d.series[0].color};"` +
                  '></div>' +
                '</td>' +
                '<td class="key">最小</td>' +
                `<td class="value">${fd.y_axis_format ? yAxisFormatter(d.data.values.extra_data.min) : d.data.values.extra_data.min}</td>` +
              '</tr>' +
              '<tr>' +
                '<td class="legend-color-guide">' +
                  '<div ' +
                    `style="background-color: ${d.series[0].color};"` +
                  '></div>' +
                '</td>' +
                '<td class="key">最新</td>' +
                `<td class="value">${(d.data.values.extra_data.last_pos_per * 100).toFixed(2) + '%'}
                ，${fd.y_axis_format ? yAxisFormatter(d.data.values.extra_data.last) : d.data.values.extra_data.last}</td>` +
              '</tr>'
            );
            }
          tooltip += '</tbody></table>';
          return tooltip;
        });
        break;

      case 'bullet':
        chart = nv.models.bulletChart();
        break;

      default:
        throw new Error('Unrecognized visualization for nvd3' + vizType);
    }

    if (chart.xAxis && chart.xAxis.staggerLabels) {
      chart.xAxis.staggerLabels(staggerLabels);
    }
    if (chart.xAxis && chart.xAxis.rotateLabels) {
      chart.xAxis.rotateLabels(xLabelRotation);
    }
    if (chart.x2Axis && chart.x2Axis.staggerLabels) {
      chart.x2Axis.staggerLabels(staggerLabels);
    }
    if (chart.x2Axis && chart.x2Axis.rotateLabels) {
      chart.x2Axis.rotateLabels(xLabelRotation);
    }

    if ('showLegend' in chart && typeof fd.show_legend !== 'undefined') {
      if (width < BREAKPOINTS.small && vizType !== 'pie') {
        chart.showLegend(false);
      } else {
        chart.showLegend(fd.show_legend);
      }
    }

    if (vizType === 'bullet') {
      height = Math.min(height, 50);
    }

    if (chart.forceY &&
        fd.y_axis_bounds &&
        (fd.y_axis_bounds[0] !== null || fd.y_axis_bounds[1] !== null)) {
      chart.forceY(fd.y_axis_bounds);
    }
    if (fd.y_log_scale) {
      chart.yScale(d3.scale.log());
    }
    if (fd.x_log_scale) {
      chart.xScale(d3.scale.log());
    }

    let xAxisFormatter = d3FormatPreset(fd.x_axis_format);
    if (isTimeSeries) {
      xAxisFormatter = d3TimeFormatPreset(fd.x_axis_format);
      if (fd.remove_space) {
        xAxisFormatter = d3TimeFormatPreset(fd.x_axis_format, xAixsTickV);
      }
    }
    if (chart.x2Axis && chart.x2Axis.tickFormat) {
      chart.x2Axis.tickFormat(xAxisFormatter);
    }
    const isXAxisString = ['dist_bar', 'box_plot'].indexOf(vizType) >= 0;
    if (!isXAxisString && chart.xAxis && chart.xAxis.tickFormat) {
      chart.xAxis.tickFormat(xAxisFormatter);
    }


    if (chart.yAxis && chart.yAxis.tickFormat) {
      if (fd.num_period_compare) {
        // When computing a "Period Ratio", we force a percentage format
        // chart.yAxis.tickFormat(d3.format('.1%'));
        chart.yAxis.tickFormat(yAxisFormatter);
      } else {
        chart.yAxis.tickFormat(yAxisFormatter);
      }
    }
    if (chart.y2Axis && chart.y2Axis.tickFormat) {
      chart.y2Axis.tickFormat(yAxisFormatter);
    }


    // Set showMaxMin for all axis
    function setAxisShowMaxMin(axis, showminmax) {
      if (axis && axis.showMaxMin && showminmax !== undefined) {
        axis.showMaxMin(showminmax);
      }
    }
    setAxisShowMaxMin(chart.xAxis, fd.x_axis_showminmax);
    setAxisShowMaxMin(chart.x2Axis, fd.x_axis_showminmax);
    setAxisShowMaxMin(chart.yAxis, fd.y_axis_showminmax);
    setAxisShowMaxMin(chart.y2Axis, fd.y_axis_showminmax);

    if (vizType === 'time_pivot') {
      chart.color((d) => {
        const c = fd.color_picker;
        let alpha = 1;
        if (d.rank > 0) {
          alpha = d.perc * 0.5;
        }
        return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
      });
    } else if (vizType !== 'bullet') {
      chart.color((d, ix) => {
        const pickColor = fd.color_scheme ? ALL_COLOR_SCHEMES[fd.color_scheme]
            : ALL_COLOR_SCHEMES.bnbColors;
        let colorCustom = null;
        if (seriesColor.hasOwnProperty(d.key)) {
          colorCustom = seriesColor[d.key];
        }
        const nvSeriesLine = svg.selectAll('.nvd3 .nv-groups g.nv-series-' + ix);
        if (seriesLineWidth.hasOwnProperty(d.key)) {
          nvSeriesLine.style('stroke-width', 5);
        }
        // The series index keeps the palette order stable no matter in which
        // order the charts of a dashboard happen to render. Registering these
        // colors through getColorFromScheme() would instead pin each label to
        // the first scheme that rendered it.
        lineColorMap[d.key] = colorCustom || getForcedColor(d[colorKey])
            || pickColor[ix % pickColor.length];
        return lineColorMap[d.key];
      });
    }
    if ((vizType === 'line' || vizType === 'area') && fd.rich_tooltip) {
      chart.useInteractiveGuideline(true);
      if (vizType === 'line') {
        // Custom sorted tooltip
        chart.interactiveLayer.tooltip.contentGenerator((d) => {
          let tooltip = '';
          tooltip += "<table><thead><tr><td colspan='3'>"
            + `<strong class='x-value'>${xAxisFormatter(d.value)}</strong>`
            + '</td></tr></thead><tbody>';
          d.series.sort((a, b) => a.value >= b.value ? -1 : 1);
          d.series.forEach((series) => {
            tooltip += (
              `<tr class="${series.highlight ? 'emph' : ''}">` +
                `<td class='legend-color-guide' style="opacity: ${series.highlight ? '1' : '0.75'};"">` +
                  '<div ' +
                    `style="border: 2px solid ${series.highlight ? 'black' : 'transparent'}; background-color: ${series.color};"` +
                  '></div>' +
                '</td>' +
                `<td>${series.key}</td>` +
                `<td>${yAxisFormatter(series.value)}</td>` +
              '</tr>'
            );
          });
          tooltip += '</tbody></table>';
          return tooltip;
        });
      }
    }

    if (vizType === 'dual_line') {
      const yAxisFormatter1 = d3.format(fd.y_axis_format);
      const yAxisFormatter2 = d3.format(fd.y_axis_2_format);
      chart.yAxis1.tickFormat(yAxisFormatter1);
      chart.yAxis2.tickFormat(yAxisFormatter2);
      customizeToolTip(chart, xAxisFormatter, [yAxisFormatter1, yAxisFormatter2]);
      chart.showLegend(width > BREAKPOINTS.small);
    }
    chart.height(height);
    if (typeof (fd.editor_content) !== 'undefined') {
        slice.container.css('height', slice.height() + 'px');
    } else {
      slice.container.css('height', height + 'px');
    }

    svg.style('width', getPinnedSvgWidth(width, slice.width()));

    svg
    .datum(data)
    .transition().duration(500)
    .attr('height', height)
    .attr('width', width)
    .call(chart);


    if (fd.show_markers) {
      svg.selectAll('.nv-point')
      .style('stroke-opacity', 1)
      .style('fill-opacity', 1);
    }

    if (fd.highlight_tick_zero) {
      svg.selectAll('g.tick.zero line').style('stroke', 'black').style('stroke-width', 2);
    }

    if (chart.yAxis !== undefined || chart.yAxis2 !== undefined) {
      // Hack to adjust y axis left margin to accommodate long numbers
      const containerWidth = slice.container.width();
      const marginPad = Math.ceil(
        Math.min(isExplore ? containerWidth * 0.01 : containerWidth * 0.03, maxMarginPad),
      );
      const maxYAxisLabelWidth = chart.yAxis2 ? getMaxLabelSize(slice.container, 'nv-y1')
                                              : getMaxLabelSize(slice.container, 'nv-y');
      const maxXAxisLabelHeight = getMaxLabelSize(slice.container, 'nv-x');
      chart.margin({ left: maxYAxisLabelWidth + marginPad });
      if (fd.y_axis_label && fd.y_axis_label !== '') {
        chart.margin({ left: maxYAxisLabelWidth + marginPad + 25 });
      }
      // Hack to adjust margins to accommodate long axis tick labels.
      // - has to be done only after the chart has been rendered once
      // - measure the width or height of the labels
      // ---- (x axis labels are rotated 45 degrees so we use height),
      // - adjust margins based on these measures and render again
      const margins = chart.margin();
      margins.bottom = 28;
      if (fd.x_axis_showminmax) {
        // If x bounds are shown, we need a right margin
        margins.right = Math.max(20, maxXAxisLabelHeight / 2) + marginPad;
      }
      if (xLabelRotation === 45) {
        margins.bottom = maxXAxisLabelHeight + marginPad;
        margins.right = maxXAxisLabelHeight + marginPad;
      } else if (staggerLabels) {
        // When every bar tick is retained, leave enough space below the
        // staggered second row so it is not clipped by the scrollbar.
        margins.bottom = getStaggeredXAxisBottomMargin(vizType, reduceXTicks);
        if (vizType === 'line') {
          margins.bottom = 30;
          if (showBrush) {
            margins.bottom = 20;
          }
        }
      }

      if (vizType === 'dual_line') {
        const maxYAxis2LabelWidth = getMaxLabelSize(slice.container, 'nv-y2');
        // use y axis width if it's wider than axis width/height
        if (maxYAxis2LabelWidth > maxXAxisLabelHeight) {
          margins.right = maxYAxis2LabelWidth + marginPad;
        }
      }
      if (vizType === 'bar') {
        chart.legend.margin({ top: 2 });
      }
      if (fd.bottom_margin && fd.bottom_margin !== 'auto') {
        margins.bottom = parseInt(fd.bottom_margin, 10);
      }
      if (fd.left_margin && fd.left_margin !== 'auto') {
        margins.left = fd.left_margin;
      }
      if (fd.right_margin && fd.right_margin !== 'auto') {
        margins.right = fd.right_margin;
      }
      if (fd.x_axis_label && fd.x_axis_label !== '' && chart.xAxis) {
        margins.bottom += 25;
        let distance = 0;
        if (margins.bottom && !isNaN(margins.bottom)) {
          distance = margins.bottom - 45;
        }
        // nvd3 bug axisLabelDistance is disregarded on xAxis
        // https://github.com/krispo/angular-nvd3/issues/90
        chart.xAxis.axisLabel(fd.x_axis_label).axisLabelDistance(distance);
      }

      if (fd.y_axis_label && fd.y_axis_label !== '' && chart.yAxis) {
        let distance = 0;
        if (margins.left && !isNaN(margins.left)) {
          distance = margins.left - 70;
        }
        chart.yAxis.axisLabel(fd.y_axis_label).axisLabelDistance(distance);
      }

      // render chart tanke 注释20240612
      svg
      .datum(data)
      .transition().duration(500)
      .attr('height', height)
      .attr('width', width)
      .call(chart);

      // on scroll, hide tooltips. throttle to only 4x/second.
      $(window).scroll(throttle(hideTooltips, 250));

      const annotationLayers = (slice.formData.annotation_layers || []).filter(x => x.show);
      if (fd.event_list) {
        annotationLayers.push({
          name: 'selfEvent',
          annotationType: 'EVENT',
          sourceType: 'table',
          show: true,
          rightYAxis: false,
          annotationShowTip: true,
          customIndex: '',
          titleColumn: '基本面事件',
          descriptionColumns: [],
          timeColumn: '发生时间',
          intervalEndColumn: '',
          color: '#4472c4',
          opacity: '',
          style: 'solid',
          width: 2,
        });
      }
      // The below code should be run AFTER rendering because chart is updated in call()
      if (isTimeSeries && annotationLayers.length) {
        // Formula annotations
        const formulas = annotationLayers.filter(a => a.annotationType === AnnotationTypes.FORMULA)
          .map(a => ({ ...a, formula: mathjs.parse(a.value) }));

        let xMax;
        let xMin;
        let xScale;
        if (vizType === VIZ_TYPES.bar) {
          xMin = d3.min(data[0].values, d => (d.x));
          xMax = d3.max(data[0].values, d => (d.x));
          xScale = d3.scale.quantile()
            .domain([xMin, xMax])
            .range(chart.xAxis.range());
        } else {
          // 添加防护检查，确保 chart.xAxis 和 scale 已正确初始化
          if (chart.xAxis && chart.xAxis.scale && typeof chart.xAxis.scale === 'function') {
            const domain = chart.xAxis.scale().domain();
            if (domain && domain.length >= 2 && domain[0] != null && domain[1] != null) {
              xMin = domain[0].valueOf();
              xMax = domain[1].valueOf();
            } else {
              // 使用数据的最小最大值作为备用
              xMin = d3.min(data[0] ? data[0].values : [], d => d.x);
              xMax = d3.max(data[0] ? data[0].values : [], d => d.x);
            }
          } else {
            // 如果 chart.xAxis 不可用，使用数据的最小最大值
            xMin = d3.min(data[0] ? data[0].values : [], d => d.x);
            xMax = d3.max(data[0] ? data[0].values : [], d => d.x);
          }

          xScale = chart.xScale ? chart.xScale() : d3.scale.linear();
          // 确保 xScale 有正确的 domain
          if (xMin != null && xMax != null && !isNaN(xMin) && !isNaN(xMax)) {
            xScale.domain([xMin, xMax]);
            if (chart.xAxis && chart.xAxis.scale && typeof chart.xAxis.scale === 'function') {
              const range = chart.xAxis.scale().range();
              if (range && range.length >= 2) {
                xScale.range(range);
              }
            }
          }
          // TODO: Fixed original bug. leiris
          xScale.clamp(true);
        }

        if (Array.isArray(formulas) && formulas.length) {
          const xValues = [];
          if (vizType === VIZ_TYPES.bar) {
            // For bar-charts we want one data point evaluated for every
            // data point that will be displayed.
            const distinct = data.reduce((xVals, d) => {
              d.values.forEach(x => xVals.add(x.x));
              return xVals;
            }, new Set());
            xValues.push(...distinct.values());
            xValues.sort();
          } else {
            // For every other time visualization it should be ok, to have a
            // data points in even intervals.
            let period = Math.min(...data.map(d =>
              Math.min(...d.values.slice(1).map((v, i) => v.x - d.values[i].x))));
            const dataPoints = (xMax - xMin) / (period || 1);
            // make sure that there are enough data points and not too many
            period = dataPoints < 100 ? (xMax - xMin) / 100 : period;
            period = dataPoints > 500 ? (xMax - xMin) / 500 : period;
            // xValues.push(xMin);  20211103注释掉这行
            const xMinFormula = data && data[0] && data[0].values ?
              d3.min(data[0].values, d => (d.x)) : xMin;
            for (let x = xMinFormula; x < xMax; x += period) {
              xValues.push(x);
            }
            xValues.push(xMax);
          }
          const formulaData = formulas.map(fo => ({
            key: fo.name,
            values: xValues.map((x => ({ y: fo.formula.eval({ x }), x }))),
            color: fo.color,
            strokeWidth: fo.width,
            classed: `${fo.opacity} ${fo.style}`,
          }));
          data.push(...formulaData);
        }
        const xAxis = chart.xAxis1 ? chart.xAxis1 : chart.xAxis;
        const yAxis = chart.yAxis1 ? chart.yAxis1 : chart.yAxis;
        const chartWidth = xAxis.scale().range()[1];
        const annotationHeight = yAxis.scale().range()[0];
        const tipFactory = layer => d3tip()
          .attr('class', 'd3-tip')
          .direction('n')
          .offset([-5, 0])
          .html((d) => {
            if (!d) {
              return '';
            }
            // const title = d[layer.titleColumn] && d[layer.titleColumn].length ?
            //   d[layer.titleColumn] + ' - ' + layer.name :
            //   layer.name;
            const title = d[layer.titleColumn] && d[layer.titleColumn].length ?
              d[layer.titleColumn] : '';
            const body = Array.isArray(layer.descriptionColumns) ?
              layer.descriptionColumns.map(c => d[c]) : Object.values(d);
            return '<div><strong>' + title + '</strong></div><br/>' +
              '<div>' + body.join(', ') + '</div>';
          });

        if (Object.keys(annotationData).length) {
          // 验证基础数据是否存在
          if (!data || !Array.isArray(data) || data.length === 0) {
            console.warn('No valid data for annotations');
            return;
          }

          // 创建安全的 xScale 包装函数，防止返回 NaN
          const safeXScale = (date) => {
            try {
              const result = xScale(date);
              return (!isNaN(result) && isFinite(result)) ? result : 0;
            } catch (e) {
              console.warn('xScale error:', e);
              return 0;
            }
          };

          // Event annotations
             annotationLayers.filter(x => (
            x.annotationType === AnnotationTypes.EVENT &&
             annotationData[x.name]
          )).forEach((config, index) => {
            const e = applyNativeColumns(config);
            // Add event annotation layer
            const annotations = d3.select(slice.selector).select('.nv-wrap').append('g')
              .attr('class', `nv-event-annotation-layer-${index}`);
            const aColor = e.color || getColorFromScheme(e.name, fd.color_scheme);

            const tip = tipFactory(e);
            const records = (annotationData[e.name].records || []).map((r) => {
              const timeValue = new Date(moment.utc(r[e.timeColumn]));

              return {
                ...r,
                [e.timeColumn]: timeValue,
              };
            }).filter(record => !Number.isNaN(record[e.timeColumn].getMilliseconds()));
               const foreignObjectTextWidth = 120;
               if (records.length && records.every(r => r[e.timeColumn] && !isNaN(new Date(r[e.timeColumn]).getTime()))) {
                 // const domain = [xMin, xMax]; // 20240725注释掉这2行
                 // xScale.domain(domain);
                   annotations.selectAll('line')
                       .data(records)
                       .enter()
                       .append('line')
                       .attr({
                         x1: d => safeXScale(new Date(d[e.timeColumn])),
                         y1: 0,
                         x2: d => safeXScale(new Date(d[e.timeColumn])),
                         y2: annotationHeight,
                       })
                       .attr('class', `${e.opacity} ${e.style}`)
                       .style('stroke', aColor)
                       .style('stroke-width', e.width)
                       .on('mouseover', tip.show)
                       .on('mouseout', tip.hide);

                   // 安全地调用 tip，避免在全屏模式下的 DOM 问题
                   try {
                     if (tip && typeof tip === 'function') {
                       annotations.selectAll('line').call(tip);
                     }
                   } catch (tipError) {
                     console.warn('d3-tip error:', tipError);
                   }

                   const getTextHeight = (htmlText, styles, maxWidth) => {
                     const div = document.createElement('div');
                     div.style.width = `${maxWidth}px`;
                     div.style.fontSize = styles['font-size'];
                     div.innerHTML = htmlText;
                     const container = document.createElement('div');
                     container.appendChild(div);
                     document.body.appendChild(container);
                     const textHeight = div.offsetHeight;
                     document.body.removeChild(container);
                     return textHeight + 2;
                   };

                 if (e.annotationShowTip) {
                   // event添加文本元素显示注释内容
                   annotations.selectAll('.annotation-text')
                       .data(records)
                       .enter()
                       .append('foreignObject')
                       .attr('class', 'annotation-text')
                       .attr('width', foreignObjectTextWidth)
                       .attr('height', (d) => {
                         const title = d[e.titleColumn];
                         const textHeight = getTextHeight(title, {
                           'font-family': 'Arial',
                           'font-size': '12px',
                         }, foreignObjectTextWidth);
                         return textHeight;
                       })
                       .attr('x', (d) => {
                         const xposition = safeXScale(new Date(d[e.timeColumn]));
                         return xposition - foreignObjectTextWidth / 2;
                       })
                       .attr('y', 0)
                       .html(function (d) {
                         const title = d[e.titleColumn];
                         return `<div style="background-color: #C5B8A5;opacity: 0.9;
                                font-size: 12px">${title}</div>`;
                       });
                 }

               }

               // update annotation positions on brush event
               if (chart.focus && chart.focus.dispatch) {
                 chart.focus.dispatch.on(`onBrush.event-annotation-${index}`, function () {
                   annotations.selectAll('line')
                     .data(records)
                     .attr({
                       x1: d =>
                         // console.log('chart.xScale() ', chart.xScale()(new Date(d[e.timeColumn])));
                         // console.log('xAxis.scale() ', xAxis.scale()(new Date(d[e.timeColumn])));
                         safeXScale(new Date(d[e.timeColumn])),

                       y1: 0,
                       x2: d => safeXScale(new Date(d[e.timeColumn])),
                       y2: annotationHeight,
                       opacity: (d) => {
                         const x = safeXScale(new Date(d[e.timeColumn]));
                         // console.log('x & chartwidth: ', x, chartWidth,  xAxis.scale().range());
                         return (x > 0) && (x < chartWidth) ? 1 : 0;
                       },
                     });

                 if (e.annotationShowTip) {
                   annotations.selectAll('.annotation-text')
                       .attr({
                         x: (d) => {
                           const titleLength = d[e.titleColumn].length;
                           const xposition = safeXScale(new Date(d[e.timeColumn]));
                           return xposition - Math.min(titleLength * 12, foreignObjectTextWidth) / 2;
                         },
                         y: (d, i) => i % 2 === 0 ? 0 : 60,
                         opacity: (d) => {
                           const x = safeXScale(new Date(d[e.timeColumn]));
                           return (x > 0) && (x < chartWidth) ? 1 : 0;
                         },
                         width: (d) => {
                           const x = safeXScale(new Date(d[e.timeColumn]));
                           const titleLength = d[e.titleColumn].length;
                           return (x > 0) && (x < chartWidth) ? Math.min(titleLength * 12, foreignObjectTextWidth) : 0;
                         },
                       });
                 }

               });
               }

          });

          // Interval annotations
          annotationLayers.filter(x => (
            x.annotationType === AnnotationTypes.INTERVAL &&
            annotationData[x.name]
          )).forEach((config, index) => {
            const e = applyNativeColumns(config);
            // Add interval annotation layer
            const annotations = d3.select(slice.selector).select('.nv-wrap').append('g')
              .attr('class', `nv-interval-annotation-layer-${index}`);

            const aColor = e.color || getColorFromScheme(e.name, fd.color_scheme);
            const tip = tipFactory(e);

            const records = (annotationData[e.name].records || []).map((r) => {
              const timeValue = new Date(moment.utc(r[e.timeColumn]));
              const intervalEndValue = new Date(moment.utc(r[e.intervalEndColumn]));
              return {
                ...r,
                [e.timeColumn]: timeValue,
                [e.intervalEndColumn]: intervalEndValue,
              };
            }).filter(record => (
              !Number.isNaN(record[e.timeColumn].getMilliseconds()) &&
              !Number.isNaN(record[e.intervalEndColumn].getMilliseconds())
            ));

            if (records.length && records.every(r =>
              r[e.timeColumn] && !isNaN(new Date(r[e.timeColumn]).getTime()) &&
              r[e.intervalEndColumn] && !isNaN(new Date(r[e.intervalEndColumn]).getTime()),
            )) {
              annotations.selectAll('rect')
                .data(records)
                .enter()
                .append('rect')
                .attr({
                  x: d => Math.min(safeXScale(new Date(d[e.timeColumn])),
                    safeXScale(new Date(d[e.intervalEndColumn]))),
                  y: 0,
                  width: d => Math.max(Math.abs(safeXScale(new Date(d[e.intervalEndColumn])) -
                    safeXScale(new Date(d[e.timeColumn]))), 1),
                  height: annotationHeight,
                })
                .attr('class', `${e.opacity} ${e.style}`)
                .style('stroke-width', e.width)
                .style('stroke', aColor)
                .style('fill', aColor)
                .style('fill-opacity', 0.2)
                .on('mouseover', tip.show)
                .on('mouseout', tip.hide);

            // 安全地调用 tip，避免在全屏模式下的 DOM 问题
            try {
              if (tip && typeof tip === 'function') {
                annotations.selectAll('rect').call(tip);
              }
            } catch (tipError) {
              console.warn('d3-tip error:', tipError);
            }
            }

            // update annotation positions on brush event
            if (chart.focus && chart.focus.dispatch) {
              chart.focus.dispatch.on('onBrush.interval-annotation', function () {
                annotations.selectAll('rect')
                  .data(records)
                                  .attr({
                  x: d => safeXScale(new Date(d[e.timeColumn])),
                  width: (d) => {
                    const x1 = safeXScale(new Date(d[e.timeColumn]));
                    const x2 = safeXScale(new Date(d[e.intervalEndColumn]));
                    return x2 - x1;
                  },
                });
              });
            }


          });

          // Time series annotations add additional data
          const timeSeriesAnnotations = annotationLayers
            .filter(a => a.annotationType === AnnotationTypes.TIME_SERIES).reduce((bushel, a) =>
          bushel.concat((annotationData[a.name] || []).map((series) => {
              if (!series) {
                return {};
              }
              const key = Array.isArray(series.key) ?
                `${a.name}, ${series.key.join(', ')}` : `${a.name}, ${series.key}`;
              return {
                ...series,
                key,
                rightYAxis: a.rightYAxis,
                color: a.color,
                strokeWidth: a.width,
                classed: `${a.opacity} ${a.style}`,
              };
            })), []);
          data.push(...timeSeriesAnnotations);

          if (showBrush && timeSeriesAnnotations.length) {
            const uniqueXArray = extractUniqueX(data);
            let brushExtentStart = Math.round(uniqueXArray.length * fd.brushExtentStart);
            if (brushExtentStart >= uniqueXArray.length) {
              brushExtentStart = uniqueXArray.length - 1;
            }
            chart.options({
              brushExtent: [uniqueXArray[brushExtentStart], uniqueXArray[uniqueXArray.length - 1]],
            });
          }


        }
      }

      // rerender chart
      svg.datum(data)
        .attr('height', height)
        .attr('width', width)
        .call(chart);
    }

    if (fd.show_horizontal) {
      const xTicks = svg.selectAll('.nv-x.nv-axis > g').selectAll('g');
      if (fd.x_ticks_layout === 'auto' || fd.x_ticks_layout === '45°') {
        const rotateV = -45;
        xTicks.selectAll('.tick text')
            .attr('transform', 'rotate(' + rotateV + ' 0,0)')
            .style('text-anchor', rotateV > 0 ? 'start' : 'end');
      }
    }

    const drawLastVtext = function (xAixPos = 0, data) {
      svg.selectAll('.lastRect' + fd.slice_id).remove();
      svg.selectAll('.lastText' + fd.slice_id).remove();
      data.forEach((value) => {
        const values = value.values;
        if (!Array.isArray(values) || values.length === 0) {
          return;
        }
        const lastValue = getLastValue(values, xAixPos);
        if (!lastValue || lastValue.y == null) {
          return;
        }
        const opentext = svg.append('text')
            // .attr('x', chart.xAxis.scale()(values[0].x) + 20)
            .attr('x', 20)
            .attr('y', chart.yAxis.scale()(lastValue.y) + 25)
            .attr('dy', '.35em')
            .attr('text-anchor', 'middle')
            .attr('class', 'lastText' + fd.slice_id)
            .style('fill', 'white')
            .style('font-size', '12')
            .text(yAxisFormatter(lastValue.y));
        makeTxtBG(opentext[0][0], lineColorMap[value.key], 'lastRect' + fd.slice_id);
      });
    };

    if (fd.show_lastvalue) {
        drawLastVtext(0, data);
      }

    if (vizType === 'line' && showBrush) {
      chart.focus.brush.on('brushend.end1', function (series) {
        const extent = chart.focus.brush.extent();
        if (fd.show_lastvalue) {
          let brushEndPos = extent[1];
          if (brushEndPos instanceof Date) {
            brushEndPos = brushEndPos.getTime();
          } else {
            brushEndPos = xAixsTickV[Math.floor(brushEndPos)];
          }
          console.log('brush end pos:', brushEndPos);
          drawLastVtext(brushEndPos, data);
        }
      });
    }

     if (vizType === 'area' && fd.show_controls) {
       // chart.stacked.dispatch.on('areaClick', removeStream);
         const streamArea = svg.selectAll('g.nv-controlsWrap > g > g >g:nth-child(2)');
         const transformAttr = streamArea.attr('transform');
         svg.selectAll('g.nv-controlsWrap > g > g >g:nth-child(2)').style('display', 'none');
         svg.selectAll('g.nv-controlsWrap > g > g >g:nth-child(3)').attr('transform', transformAttr);
    }

    if (vizType === 'box_plot') {
      const boxObj = svg.selectAll('.tick.zero')[0];
      data.forEach((item, ix) => {
        const ynum = chart.yAxis.scale()(item.values.extra_data.last) + 20;
        const transformAttr = d3.select(boxObj[ix]).attr('transform');
        const transformArr = transformAttr.split(',');
        const xnum = parseFloat(transformArr[0].split('(')[1]) + 3 * (ix + 1) + 30;
        const translate = 'translate(' + xnum + ',' + ynum + ')';
        // const ynum1 = chart.yAxis.domain(item.values.extra_data.last);
        // const xnum = chart.xAxis.scale()(item.label);
        svg.append('text')
            .attr('transform', translate)
            .attr('font-family', 'FontAwesome')
            // .attr('x', xnum)
            // .attr('y', ynum)
            .style('fill', 'black')
            .style('font-size', '12')
            .text('\uf219');
      });
    }
    if (fd.hidden_grid) {
      svg.selectAll('g.tick line').style('opacity', 0);
    }

    return chart;
  };

  // hide tooltips before rendering chart, if the chart is being re-rendered sometimes
  // there are left over tooltips in the dom,
  // this will clear them before rendering the chart again.
  hideTooltips();

  nv.addGraph(drawGraph);
   // $(slice.selector + ' iframe').contents().find('-webkit-scrollbar').css({ 'width':'10px' });
}
