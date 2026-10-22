import echarts from 'echarts';
// import * as echarts from 'echarts';
import {
    yAxisFormat,
    d3FormatPreset,
} from '../javascripts/modules/utils';

function echartsBubble(slice, payload) {
    const div = d3.select(slice.selector);
    const fd = slice.formData;
    div.style('overflow', 'visible');
    const sourceData = payload.data;
    const seriesData = sourceData.data;
    const maxSize = sourceData.max_size;
    const minSize = sourceData.min_size;
    const max_bubble_size = fd.max_bubble_size;
    const min_bubble_size = 5;
    const show_hsl_bg_zero = fd.show_hsl_bg_zero;
    const sliceId = slice.containerId + '_slice_' + fd.slice_id;
    let sliceHeight = slice.height();
    if (fd.editor_content) {
        sliceHeight -= 14;
    }

    let html = '<div id=' + sliceId + ' style="width:' + slice.width() + 'px;height:' + sliceHeight + 'px;"></div>';
    if (fd.editor_content) {
        html += '<span id=' + sliceId + '_editor_content' + ' style="height: 14px;width:' + slice.width() + 'px;">'+fd.editor_content+'</span>';
    }
    div.html(html);
    const myChart = echarts.init(document.getElementById(sliceId));
    const chartGrid = fd.chartGrid ? JSON.parse(fd.chartGrid) : {};
    const xTitleGrid = fd.xTitleGrid ? JSON.parse(fd.xTitleGrid) : {};
    const yTitleGrid = fd.yTitleGrid ? JSON.parse(fd.yTitleGrid) : {};
    if (chartGrid.right && !xTitleGrid.right) {
        xTitleGrid.right = chartGrid.right;
    }
    if (chartGrid.left && !yTitleGrid.left) {
        yTitleGrid.left = chartGrid.left;
    }


    function culSymbolColor(params) {
        // console.log(params);
        const size = params.data[2];
        let valuePos;
        if (show_hsl_bg_zero) {
            valuePos = size >= 0 ? size / maxSize : size / minSize;
        } else {
            valuePos = (size - minSize) / (maxSize - minSize);
        }
        let r, g, b;
        if (show_hsl_bg_zero) {
            // valuePos 0-1 越接近0颜色越淡，越接近1颜色越深，分别为红色和绿色
            const intensity = valuePos;
            if (size > 0) {
                r = 255;
                g = Math.round(255 * (1 - intensity));
                b = Math.round(255 * (1 - intensity));
            } else {
                r = Math.round(255 * (1 - intensity));
                g = 255;
                b = Math.round(255 * (1 - intensity));
            }
        } else {
            if (valuePos > 0.5) {
                // 红色，越接近1越红
                const intensity = (valuePos - 0.5) * 2;
                r = 255;
                g = Math.round(255 * (1 - intensity));
                b = Math.round(255 * (1 - intensity));
            } else {
                // 绿色，越接近0越绿
                const intensity = 1 - (valuePos * 2);
                r = Math.round(255 * (1 - intensity));
                g = 255;
                b = Math.round(255 * (1 - intensity));
            }
        }

        return `rgba(${r}, ${g}, ${b}, ${fd.opacity})`;
    }

    function culSymbolSize(params) {
        const size = params[2];
        let valuePos;
        if (show_hsl_bg_zero) {
            valuePos = size >= 0
                ? size / maxSize
                : size / minSize;
        } else {
            valuePos = (size - minSize) / (maxSize - minSize);
        }

        let symbolSize;
        if (show_hsl_bg_zero) {
            symbolSize = Math.max(min_bubble_size, max_bubble_size * valuePos);
        } else {
            if (valuePos > 0.5) {
                const intensity = (valuePos - 0.5) * 2;
                symbolSize = Math.max(min_bubble_size, max_bubble_size * intensity);
            } else {
                const intensity = 1 - (valuePos * 2);
                symbolSize = Math.max(min_bubble_size, max_bubble_size * intensity);
            }
        }
        return Math.round(symbolSize);
    }

    function genSeries(item) {
        const itemValue = seriesData[item];
        const retDict = {
            type: 'scatter',
            data: itemValue,
            name: item,
            symbolSize: culSymbolSize,
            label: {
                textBorderWidth: 3,

                color: '#000',
                show: true,
                formatter(params) {
                    return params.data[3];
                },
                position: 'inside',
            },
            itemStyle: {
                opacity: 1,
                color: culSymbolColor,
            },
        };

        return retDict;
    }

    const series = Object.keys(seriesData).map(item => genSeries(item));
    const option = {
        series,
        grid: chartGrid,
        xAxis: {
            axisLabel: {},
            // name: fd.x,
            // nameLocation: 'middle',
            // nameGap: 25,
        },
        yAxis: {
            axisLabel: {},
        },
        graphic: [{
            type: 'text',
            right: xTitleGrid.right ? xTitleGrid.right : '10%',
            bottom: xTitleGrid.bottom ? xTitleGrid.bottom : 25,
            style: {
                text: fd.x,
            },
        }, {
            type: 'text',
            left: yTitleGrid.left ? yTitleGrid.left : '10%',
            top: yTitleGrid.top ? yTitleGrid.top : 40,
            style: {
                text: fd.y,
            },
        }],
        legend: {
            show: fd.show_legend,
        },
        tooltip: {
            formatter(params) {
                // console.log(params);
                let showHtml = params.data[3];
                if (params.data[3] !== params.seriesName) {
                    showHtml += '(' + params.seriesName + ')';
                }
                showHtml +=
                    '<br>' + fd.x + ':' + (fd.x_axis_format ? d3FormatPreset(fd.x_axis_format)(params.data[0]) : params.data[0]) +
                    '<br>' + fd.y + ':' + (fd.y_axis_format ? d3FormatPreset(fd.y_axis_format)(params.data[1]) : params.data[1]) +
                    '<br>' + fd.size + ':' + (fd.y_axis_2_format ? d3FormatPreset(fd.y_axis_2_format)(params.data[2]) : params.data[2]);
                return showHtml;
            },
        },
    };
    if (fd.y_axis_format) {
        option.yAxis.axisLabel.formatter = yAxisFormat(fd.y_axis_format);
    }
    if (fd.x_axis_format) {
        option.xAxis.axisLabel.formatter = yAxisFormat(fd.x_axis_format);
    }


    // 使用刚指定的配置项和数据显示图表。
    myChart.setOption(option);

}

export default echartsBubble;
