import echarts from 'echarts';
import { yAxisLimit } from '../javascripts/modules/utils';

function echartsPeriodogram(slice, payload) {
    const div = d3.select(slice.selector);
    const fd = slice.formData;
    const sliceId = slice.containerId + '_slice_' + fd.slice_id;
    const html = '<div id=' + sliceId + ' style="width:' + slice.width() + 'px;height:' + slice.height() + 'px;"></div>';
    div.html(html); // reset

    const myChart = echarts.init(document.getElementById(sliceId));

    const sourceData = payload.data;
    const data = sourceData.data;
    const leftAxisMinValue = parseFloat(fd.left_axis_min_value);
    const leftAxisMaxValue = parseFloat(fd.left_axis_max_value);
    // index:
    // "2017", "2018", "2008-2017最大值", "2008-2017最小值", "2008-2017均值", "高低差", "2015", "2016", ......

    const option = {
       color: ['#2f4554', '#61a0a8', '#d48265', '#91c7ae', '#749f83',  '#ca8622', '#bda29a', '#6e7074', '#546570', '#c4ccd3'],
    backgroundColor: 'rgb(255, 255, 255)',
    title: {
        text: '周期',
        textStyle: {
            fontSize: 14,
        }
    },
    tooltip: {
        trigger: 'axis',
    },
    legend: {
        data: data.index,
        orient: 'horizontal',
        x: 'center',
        y: 'top',
    },
    xAxis: {
        type: 'category',
        position: 'bottom',
        data: data.columns,
        z: 200,
    },
    yAxis: {
        type: 'value',
        min: yAxisLimit(leftAxisMinValue, 'min'),
        max: yAxisLimit(leftAxisMaxValue, 'max'),
        splitLine: { lineStyle: { opacity: 0.5 } },
        z: 200,
    },
    series: [
    ],
};

    function fun(params) {
        const paramsDelNan = [];
        for (let i = 0; i < params.length; i++) {
            if (params[i].value) {
                paramsDelNan.push(params[i]);
            }
        }
        const firstSerie = paramsDelNan[0];
        const xLabelList = firstSerie.name.split('\n');
        // console.log(params);
        // console.log(paramsDelNan);
        const retHtmlList = [];
        for (let i = 0, l = paramsDelNan.length; i < l; i++) {
            const val = paramsDelNan[i];
            retHtmlList.push(val.marker + xLabelList[i] + ': ' + val.value);
        }

        return retHtmlList.join('<br>');
    }

    for (let i = 0; i < data.index.length; i++) {
        option.series.push(
            {
                type: 'line',
                data: data.data[i],
                name: data.index[i],
                lineStyle: { normal: { width: 2, opacity: 0.8 } },
                itemStyle: { color: i === data.index.length - 1 ? '#c23531' : null },
            },
        );
    }

    option.tooltip.formatter = fun;

  // 使用刚指定的配置项和数据显示图表。
  myChart.setOption(option);
}

export default echartsPeriodogram;
