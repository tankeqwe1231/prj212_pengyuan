import echarts from 'echarts';
// import * as echarts from 'echarts';
import { yAxisLimit, tooltipFormat, yAxisFormat } from '../javascripts/modules/utils';

function echartsComparison(slice, payload) {
    const div = d3.select(slice.selector);
    const fd = slice.formData;
    const sliceId = slice.containerId + '_slice_' + fd.slice_id;
    const html = '<div id=' + sliceId + ' style="width:' + slice.width() + 'px;height:' + slice.height() + 'px;"></div>';
    div.html(html); // reset

    const myChart = echarts.init(document.getElementById(sliceId));
    const data = payload.data;
    const dfData = data.data;
    const leftAxisUseType = data.left_axis_use_histogram ? 'bar' : 'line';
    const rightAxisUseType = data.right_axis_use_histogram ? 'bar' : 'line';
    const leftAxisUseReverseOrder = !!data.left_axis_use_reverse_order;
    const leftAxisMinValue = parseFloat(fd.left_axis_min_value);
    const leftAxisMaxValue = parseFloat(fd.left_axis_max_value);
    const rightAxisMinValue = parseFloat(fd.right_axis_min_value);
    const rightAxisMaxValue = parseFloat(fd.right_axis_max_value);
    const showBrush = fd.show_brush !== 'no';
    const aliasLabels = fd.alias_labels && fd.alias_labels !== '' ? JSON.parse(fd.alias_labels) : {};
    const brushExtentStart = fd.brushExtentStart !== '' ? Math.floor(fd.brushExtentStart * 100) : 50;

    const option = {
        series: [{
            type: leftAxisUseType,
            data: dfData.data[0],
            name: aliasLabels.hasOwnProperty(dfData.index[0])
            ? aliasLabels[dfData.index[0]] : dfData.index[0],
        }, {
            type: rightAxisUseType,
            data: dfData.data[1],
            name: aliasLabels.hasOwnProperty(dfData.index[1])
            ? aliasLabels[dfData.index[1]] : dfData.index[1],
            yAxisIndex: '1',
        }],
        xAxis: [{
            type: 'category',
            position: 'bottom',
            data: dfData.columns,
        }],
        yAxis: [{
            type: 'value',
            position: 'left',
            min: yAxisLimit(leftAxisMinValue, 'min'),
            max: yAxisLimit(leftAxisMaxValue, 'max'),
            inverse: leftAxisUseReverseOrder,
            axisLabel: {},
        }, {
            type: 'value',
            position: 'right',
            min: yAxisLimit(rightAxisMinValue, 'min'),
            max: yAxisLimit(rightAxisMaxValue, 'max'),
            axisLabel: {},
        }],
        legend: {
            // data: dfData.index,
            orient: 'horizontal',
            x: 'center',
            y: 'top',
        },
        tooltip: {
            trigger: 'axis',
        },
        dataZoom: [
                {
                    show: showBrush,
                    realtime: true,
                    start: brushExtentStart,
                },
            ],
    };

    if (dfData.index.length > 2) {
        for (let i = 2; i < dfData.index.length; i++) {
            option.series.push(
                {
                    type: rightAxisUseType,
                    data: dfData.data[i],
                    name: aliasLabels.hasOwnProperty(dfData.index[i])
            ? aliasLabels[dfData.index[i]] : dfData.index[i],
                    yAxisIndex: '1',
                },
        );
        }
    }

    if (fd.y_axis_format_left) {
        option.yAxis[0].axisLabel.formatter = yAxisFormat(fd.y_axis_format_left);
    }
    if (fd.y_axis_format_right) {
        option.yAxis[1].axisLabel.formatter = yAxisFormat(fd.y_axis_format_right);
    }
    option.tooltip.formatter = tooltipFormat({ formatStringLeft: fd.y_axis_format_left,
            formatStringRight: fd.y_axis_format_right });

    // 使用刚指定的配置项和数据显示图表。
    myChart.setOption(option);
}

export default echartsComparison;
