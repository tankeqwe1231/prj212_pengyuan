import echarts from 'echarts';

function echartsCorrelation(slice, payload) {
    const div = d3.select(slice.selector);
    const fd = slice.formData;
    const sliceId = slice.containerId + '_slice_' + fd.slice_id;
    const html = '<div id=' + sliceId + ' style="width:' + slice.width() + 'px;height:' + slice.height() + 'px;"></div>';
    div.html(html); // reset

    const myChart = echarts.init(document.getElementById(sliceId));

    // const fd = slice.formData;
    const data = payload.data;
    const dfData = data.data;
    const leftAxisUseType = data.left_axis_use_histogram ? 'bar' : 'line';
    const rightAxisUseType = data.right_axis_use_histogram ? 'bar' : 'line';
    const leftAxisUseReverseOrder = !!data.left_axis_use_reverse_order;
    const brushExtentStart = fd.brushExtentStart !== '' ? Math.floor(fd.brushExtentStart * 100) : 50;
    const seriesColor = fd.series_color && fd.series_color !== '' ? JSON.parse(fd.series_color) : {};
    function minV(value) {
        const fixed = value.min.toFixed(2);
        return fixed;
    }
    function maxV(value) {
        const fixed = value.max.toFixed(2);
        return fixed;
    }

    const option = {
    series: [{
        type: leftAxisUseType,
        data: dfData.data[0],
        name: dfData.index[0],
        itemStyle: {},
    }, {
        type: rightAxisUseType,
        data: dfData.data[1],
        name: dfData.index[1],
        yAxisIndex: '1',
        itemStyle: {},
    }, {
        type: 'line',
        data: dfData.data[2],
        name: '相关度',
        yAxisIndex: '2',
        xAxisIndex: '1',
        itemStyle: {},
    }],
    xAxis: [{
        type: 'category',
        position: 'bottom',
        data: dfData.columns,
    }, {
        type: 'category',
        position: 'bottom',
        data: dfData.columns,
        gridIndex: '1',
    }],
    yAxis: [{
        type: 'value',
        position: 'left',
        min: minV,
        max: maxV,
        inverse: leftAxisUseReverseOrder,
    }, {
        type: 'value',
        position: 'right',
        min: minV,
        max: maxV,
    }, {
        type: 'value',
        position: 'left',
        min: -1,
        max: 1,
        gridIndex: '1',
    }],
    legend: {
        data: [dfData.index[0], dfData.index[1], '相关度'],
        orient: 'horizontal',
        x: 'center',
        y: 'top',
    },
    tooltip: {
        trigger: 'axis',
    },
    grid: [{
        right: '8%',
        left: '10%',
        height: '50%',
    }, {
        right: '8%',
        top: '63%',
        left: '10%',
        height: '25%',
    }],
    dataZoom: [
        {
            show: true,
            start: brushExtentStart,
            xAxisIndex: [0, 1],
        },
    ],
};

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

export default echartsCorrelation;
