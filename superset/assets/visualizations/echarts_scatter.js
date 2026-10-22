import echarts from 'echarts';
import { yAxisFormat, tooltipFormat, yAxisLimit } from '../javascripts/modules/utils';
import { getColorFromScheme } from '../javascripts/modules/colors';

function echartsScatter(slice, payload) {
    const div = d3.select(slice.selector);
    const fd = slice.formData;
    const sliceId = slice.containerId + '_slice_' + fd.slice_id;
    const html = '<div id=' + sliceId + ' style="width:' + slice.width() + 'px;height:' + slice.height() + 'px;"></div>';
    div.html(html); // reset

    const myChart = echarts.init(document.getElementById(sliceId));

    const sourceData = payload.data;
    const data = sourceData.data;
    const metricCaption = fd.metric_caption ? JSON.parse(fd.metric_caption) : {};
    const color = getColorFromScheme('11', fd.color_scheme);
    const leftAxisMinValue = parseFloat(fd.left_axis_min_value);
    const leftAxisMaxValue = parseFloat(fd.left_axis_max_value);
    const option = {
            xAxis: {
                name: metricCaption.hasOwnProperty('x') ? metricCaption.x : sourceData.columns[0],
                nameLocation: 'middle',
                type: 'category',
                axisLabel: {},
                nameGap: 23,
            },
            yAxis: {
                name: metricCaption.hasOwnProperty('y') ? metricCaption.y : sourceData.columns[1],
                axisLabel: {},
                min: yAxisLimit(leftAxisMinValue, 'min'),
                max: yAxisLimit(leftAxisMaxValue, 'max'),
            },
            tooltip: {
                trigger: 'axis',
            },
            // grid: {
            //     // bottom: 100,
            // },
            series: [{
                type: 'scatter',
                symbol(value, params) {
                    if (params.dataIndex === sourceData.max_position) {
                        return 'triangle';
                      }
                      return '';
                },
                symbolSize: fd.size_from,
                data,
                // itemStyle: { color: getColorFromScheme('11', fd.color_scheme) },
                itemStyle: {
                    color(e) {
                      if (e.dataIndex === sourceData.max_position) {
                          return `rgb(${fd.color_picker.r}, ${fd.color_picker.g}, ${fd.color_picker.b})`;
                      }
                      return color;
                    },
                },
              }],
    };
    if (fd.y_axis_format_right) {
        option.xAxis.axisLabel.formatter = yAxisFormat(fd.y_axis_format_right);
    }
    if (fd.y_axis_format_left) {
        option.yAxis.axisLabel.formatter = yAxisFormat(fd.y_axis_format_left);
    }
    option.tooltip.formatter = tooltipFormat({ formatStringLeft: fd.y_axis_format_left,
    formatDateX: fd.y_axis_format_right,
        visType: 'scatter' });

    // 使用刚指定的配置项和数据显示图表。
    myChart.setOption(option);
}

export default echartsScatter;
