import echarts from 'echarts';
import { d3TimeFormatPresetLocal } from '../javascripts/modules/utils';

function echartsRadar(slice, payload) {
    const container = d3.select(slice.selector);
    const fd = slice.formData;
    const sliceId = slice.containerId + '_slice_' + fd.slice_id;
    const html = '<div id=' + sliceId + ' style="width:' + slice.width() + 'px;height:' + slice.height() + 'px;"></div>';
    container.html(html); // reset

    const myChart = echarts.init(document.getElementById(sliceId));
    const sourceData = payload.data;
    const data = Object.assign({}, sourceData.data);
    const tsFormatter = d3TimeFormatPresetLocal('%Y-%m-%d');
    const seriesColor = fd.series_color ? JSON.parse(fd.series_color) : {};
    if (fd.text_replace) {
        const textReplace = JSON.parse(fd.text_replace);
        data.columns = data.columns.map((currentValue) => {
            if (textReplace.hasOwnProperty(currentValue)) {
                return textReplace[currentValue];
            }
            return currentValue;
        });
    }

    if (fd.date_time_format) {
        const tsFormatter1 = d3TimeFormatPresetLocal(fd.date_time_format);
        data.index = data.index.map((currentValue) => {
            if (Number.isInteger(currentValue) && tsFormatter(currentValue) !== '1970-01-01') {
                return tsFormatter1(currentValue);
            }
            return currentValue;
        });
    }

    function toolFormat(params) {
            let showHtm = params.name;
                for (let i = 0; i < params.value.length; i++) {
                    const itemName = data.columns[i];
                    // data = (data * 100).toFixed(2) + '%';
                    showHtm += '<br>' + itemName + '：' + params.value[i];
                }
                return showHtm;
        }

    const option = {
    tooltip: { trigger: 'item',
    formatter: fd.show_datatable ? toolFormat : null,
    },
    legend: {
        data: data.index,
    },
    radar: {
        // shape: 'circle',
        axisLabel: { showMinLabel: false, show: !!fd.highlight_tick_zero },
        name: {
            textStyle: {
                color: `rgb(${fd.color_picker.r}, ${fd.color_picker.g}, ${fd.color_picker.b})`,
                // backgroundColor: '#999',
                borderRadius: 3,
                fontSize: 13,
                padding: [3, 5],
           },
        },
        indicator: data.columns.map((value, index) => {
            const rtnDict = { name: fd.show_datatable ? value + '\n近月差：' + data.data[data.data.length - 1][index].toFixed(2) : value };
            if (fd.lowest_limit !== '') {
                rtnDict.min = fd.lowest_limit;
            }
            if (fd.highest_limit !== '') {
                rtnDict.max = fd.highest_limit;
            }
            return rtnDict;
            }),
    },
    series: [{
        type: 'radar',
        // areaStyle: {normal: {}},
        data: data.index.map((value, index) => ({ name: value,
            value: fd.show_datatable && index === data.index.length - 1 ? [] : data.data[index],
            itemStyle: fd.series_color ? { color: seriesColor[value] } : {} })),
    }],
};
    option.legend.selected = {};
    if (fd.show_datatable) {
        option.legend.selected[data.index[data.index.length - 1]] = false;
    }
    option.series[0].data[0].itemStyle.color = `rgb(${fd.stroke_color_picker.r}, ${fd.stroke_color_picker.g}, ${fd.stroke_color_picker.b})`;
    option.series[0].data[0].lineStyle = { width: fd.stroke_width ? fd.stroke_width : null };

  // 使用刚指定的配置项和数据显示图表。
  myChart.setOption(option);
}

export default echartsRadar;
