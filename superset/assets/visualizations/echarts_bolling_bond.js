import echarts from 'echarts';
import { yAxisLimit } from '../javascripts/modules/utils';

function echartsBollingBond(slice, payload) {
    const div = d3.select(slice.selector);
    const fd = slice.formData;
    const sliceId = slice.containerId + '_slice_' + fd.slice_id;
    const html = '<div id=' + sliceId + ' style="width:' + slice.width() + 'px;height:' + slice.height() + 'px;"></div>';
    div.html(html); // reset

    const myChart = echarts.init(document.getElementById(sliceId));
    const sourceData = payload.data;
    const dfData = sourceData.data;
    const isShowBolling1 = sourceData.is_show_bolling_1;
    const isShowBolling2 = sourceData.is_show_bolling_2;
    const leftAxisMinValue = parseFloat(fd.left_axis_min_value);
    const leftAxisMaxValue = parseFloat(fd.left_axis_max_value);

    // 颜色列表：value，均线，上一轨，下一轨，上二轨，下二轨
    const colorArray = ['#2F4554', '#6E7074', '#C23531', '#C23531', '#61A0A8', '#61A0A8'];
    const lineTypeArray = ['solid', 'solid', 'dashed', 'dashed', 'dashed', 'dashed'];
    const lineWidthArray = [2, 2, 1, 1, 1, 1];

    function genSeries(data, index) {
      return {
        type: 'line',
        data: data.data[index],
        name: data.index[index],
        itemStyle: { normal: { color: colorArray[index] } },
        lineStyle: {
            normal: {
              color: colorArray[index],
              type: lineTypeArray[index],
              width: lineWidthArray[index],
            },
        },
      };
    }

    const option = {
        title: {
            text: 'Band',
            subtext: sourceData.percent,
        },
        tooltip: {
            trigger: 'axis',
        },
        dataZoom: [
            {
                type: 'inside',
                start: 50,
                end: 100,
            },
            {
                show: true,
                type: 'slider',
                start: 50,
                end: 100,
            },
        ],
        legend: {
            data: dfData.index,
            orient: 'horizontal',
            x: 'center',
            y: 'top',
        },
        xAxis: {
            type: 'category',
            position: 'bottom',
            data: dfData.columns,
        },
        yAxis: {
            type: 'value',
            min: yAxisLimit(leftAxisMinValue, 'min'),
            max: yAxisLimit(leftAxisMaxValue, 'max'),
        },
        series: [...Array(dfData.index.length).keys()].map(x => genSeries(dfData, x)),
    };


    option.legend.selected = {};
    if (!isShowBolling1) {
        option.legend.selected.上一轨 = false;
        option.legend.selected.下一轨 = false;
    }
    if (!isShowBolling2) {
        option.legend.selected.上二轨 = false;
        option.legend.selected.下二轨 = false;
    }


  // 使用刚指定的配置项和数据显示图表。
  myChart.setOption(option);
}

export default echartsBollingBond;
