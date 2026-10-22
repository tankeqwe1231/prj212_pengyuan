import echarts from 'echarts';
import { yAxisFormat, tooltipFormat, d3FormatPreset, yAxisLimit, dateFormatCustom } from '../javascripts/modules/utils';
import { ALL_COLOR_SCHEMES, getColorFromScheme } from '../javascripts/modules/colors';

function echartsShareData(slice, payload) {
    const div = d3.select(slice.selector);
    const sliceId1 = 'echarts_category_' + slice.formData.slice_id;
    const sliceId2 = 'echarts_line_' + slice.formData.slice_id;
    const sliceHeight = Math.floor(slice.height() / 2);
    // const html = '<div id=' + sliceId + ' style="width:' + slice.width() + 'px;height:' + slice.height() + 'px;"></div>';
    const html = '<div id=' + sliceId1 + ' style="width:' + slice.width() + 'px;height:'
        + sliceHeight + 'px;"></div><div id=' + sliceId2 + ' style="width:'
        + slice.width() + 'px;height:' + sliceHeight + 'px;"></div>';
    div.html(html);

    const myChart1 = echarts.init(document.getElementById(sliceId1));
    const myChart2 = echarts.init(document.getElementById(sliceId2));

    const fd = slice.formData;
    const sourceData = payload.data;
    const dfData = Object.assign({}, sourceData.data);
    const data1 = Object.assign({}, sourceData.data1);

    function genSeries(data, index) {
      const retDict = {
        type: 'line',
        data: data.data[index],
        name: data.index[index],
      };
      return retDict;
    }

    const xAxisData = dfData.columns;

    const option1 = {
        tooltip: {
            trigger: 'axis',
        },
        legend: {
            data: data1.index,
            orient: 'horizontal',
            x: 'center',
            y: 'top',
        },
        xAxis: {
            type: 'category',
            position: 'bottom',
            data: data1.columns,
            axisTick: {
            alignWithLabel: true,
        },
        },
        yAxis: {
            type: 'value',
        },
        series: [
        ],
    };

      for (let i = 0; i < data1.index.length; i++) {
        option1.series.push(
            {
                type: 'line',
                data: data1.data[i],
                name: data1.index[i],
                lineStyle: { normal: { width: i === 0 ? 5 : 2, opacity: 0.8 } },
                connectNulls: true,
            },
        );
    }

    const option2 = {
        animation: false,
        series: [...Array(dfData.index.length).keys()].map(x => genSeries(dfData, x)),
        xAxis: [{
            type: 'category',
            position: 'bottom',
            data: xAxisData,
        }],
        yAxis: [{
            type: 'value',
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
    };

    // 使用刚指定的配置项和数据显示图表。
    myChart2.setOption(option2);
    myChart1.setOption(option1);
}

export default echartsShareData;
