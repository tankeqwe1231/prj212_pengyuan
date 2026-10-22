import echarts from 'echarts';
import { yAxisFormat, tooltipFormat, yAxisLimit, dateFormatCustom, d3FormatPreset } from '../javascripts/modules/utils';
import { ALL_COLOR_SCHEMES } from '../javascripts/modules/colors';
import $ from "jquery";
// import './echarts_combine.css';

function echartsDistCombine(slice, payload) {
    const div = d3.select(slice.selector);
    const fd = slice.formData;
    div.style('overflow', 'visible');
    const sourceData = payload.data;
    const sliceId = slice.containerId + '_slice_' + fd.slice_id;

    const html = '<div id=' + sliceId + ' style="width:' + slice.width() + 'px;height:' + slice.height() + 'px;"></div>';
    div.html(html);
    const myChart = echarts.init(document.getElementById(sliceId));

    const dfData = Object.assign({}, sourceData.data);

    const columnsValueRepresentByHistogram = fd.columns_value_represent_by_histogram ? fd.columns_value_represent_by_histogram.split('|') : [];
    const columnsByStack = fd.columns_by_stack !== '' ? fd.columns_by_stack.split('|') : [];
    const seriesColor = fd.series_color && fd.series_color !== '' ? JSON.parse(fd.series_color) : {};
    const aliasLabels = fd.alias_labels && fd.alias_labels !== '' ? JSON.parse(fd.alias_labels) : {};
    const chartGrid = fd.chartGrid ? JSON.parse(fd.chartGrid) : {};
    const legend = fd.legend_set ? JSON.parse(fd.legend_set) : {};
    const xAxisAxisLabel = fd.xAxisAxisLabel ? JSON.parse(fd.xAxisAxisLabel) : {};
    const yAxisAxisLabel = fd.yAxisAxisLabel ? JSON.parse(fd.yAxisAxisLabel) : {};
    const xAxissplitLine = fd.xAxissplitLine ? JSON.parse(fd.xAxissplitLine) : {};
    const barColor = fd.barColor ? JSON.parse(fd.barColor) : {};
    const is_bar_chart = fd.columns_value_represent_by_histogram === 'allbar' ? true : false;
    const is_stack = fd.columns_by_stack === 'allstack' ? true : false;
    // 看板图表标题节点
    const targetSpan = $('#cell-' + fd.slice_id + ' .editable-title');

    if(sourceData.title_str) {
        if (targetSpan.length) {
            if (!targetSpan.find('span').length) {
                targetSpan.append('<span style="font-size:13px">(' + sourceData.title_str + ')</span>');
            }
        } else {
            if (!$('.editable-title').find('span').length) {
                $('.editable-title').append('<span style="font-size:13px">(' + sourceData.title_str + ')</span>');
            }
        }
    }

    function genSeries(data, index) {
      let chartType = columnsValueRepresentByHistogram.indexOf(data.index[index]) >= 0 ? 'bar' : 'line';
      if (is_bar_chart) {
            chartType = 'bar';
        }
      const retDict = {
        type: chartType,
        data: data.data[index],
        name: aliasLabels.hasOwnProperty(data.index[index])
            ? aliasLabels[data.index[index]] : data.index[index],
      itemStyle: fd.current_color_prior && index === data.index.length - 1 ? { color: `rgb(${fd.stroke_color_picker.r}, ${fd.stroke_color_picker.g}, ${fd.stroke_color_picker.b})` } : {},
      };
      if (retDict.type === 'line') {
          retDict.connectNulls = slice.formData.connect_nulls;
      }
      if (columnsByStack.indexOf(data.index[index]) >= 0 || is_stack) {
            retDict.stack = '总量';
        }
      if (chartType === 'bar') {
          // retDict.itemStyle.opacity = fd.opacity;
          if (fd.show_bar_value) {
              retDict.label = { show: true,
                position: fd.xy_reversal ? 'insideTop' : 'insideRight',
                formatter: params =>fd.lable_format ? yAxisFormat(fd.lable_format)(params.value) : params.value,
              };
              if(fd.lable_set){
                retDict.label = Object.assign(retDict.label, JSON.parse(fd.lable_set));
              }
          }
          if (fd.barColor) {
              retDict.data = retDict.data.map((value, index) => {
                  const color = value > 0 ? barColor['positive'] : value < 0 ? barColor['negative'] : null;
                  return {
                      value: value,
                      itemStyle: {
                          color: color,
                      },
                  };
              });
          }
      }

      return retDict;
    }

    const xAxisData = dfData.columns;

    const option = {
        series: [...Array(dfData.index.length).keys()].map(x => genSeries(dfData, x)),
        xAxis: [{
            type: fd.xy_reversal ? 'category' : 'value',
            axisLabel: {},
        }],
        grid: Object.assign({"top": 40, "right": 15}, chartGrid),
        yAxis: [{
            type: fd.xy_reversal ? 'value' : 'category',
            axisLabel: {},
        }],
        legend: Object.assign({}, legend),
        tooltip: {
            trigger: 'axis',
        },
        title: {
            // text: sourceData.title_str ? sourceData.title_str : '',
            text: '',
            // textAlign: 'center',
            textStyle: {
                fontSize: 14,
            },
        },
    };

    if (fd.y_axis_format) {
        if (fd.xy_reversal) {
        option.yAxis[0].axisLabel.formatter = yAxisFormat(fd.y_axis_format);
        } else {
            option.xAxis[0].axisLabel.formatter = yAxisFormat(fd.y_axis_format);
        }
    }
    if (fd.xy_reversal) {
        option.xAxis[0].data = xAxisData;
        option.xAxis[0].axisLabel = xAxisAxisLabel;
        option.yAxis[0].axisLabel = yAxisAxisLabel;
        option.xAxis[0].splitLine = xAxissplitLine;
    } else {
        option.yAxis[0].data = xAxisData;
        option.yAxis[0].axisLabel = xAxisAxisLabel;
        option.xAxis[0].axisLabel = yAxisAxisLabel;
        option.yAxis[0].splitLine = xAxissplitLine;
    }

    option.tooltip.formatter = tooltipFormat({ formatStringLeft: fd.y_axis_format });

    if (fd.color_scheme) {
        let colorSchmesLength = 0;
        for (let i = option.series.length - 1; i >= 0; i--) {
                if (colorSchmesLength <= ALL_COLOR_SCHEMES[fd.color_scheme].length - 1) {
                    // eslint-disable-next-line max-len
                    option.series[i].itemStyle.color = ALL_COLOR_SCHEMES[fd.color_scheme][colorSchmesLength];
                    colorSchmesLength++;
                }
        }
    }

    if (fd.series_color) {
        option.series.forEach((value, index, arr) => {
            if (seriesColor.hasOwnProperty(value.name)) {
                   arr[index].itemStyle.color = seriesColor[value.name];
            }
    });
    }

    // 使用刚指定的配置项和数据显示图表。
    myChart.setOption(option);
}

export default echartsDistCombine;
