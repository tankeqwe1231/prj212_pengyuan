import echarts from 'echarts';

function echartsFunnelVis(slice, payload) {
    const div = d3.select(slice.selector);
    const fd = slice.formData;
    const sliceId = slice.containerId + '_slice_' + fd.slice_id;
    const html = '<div id=' + sliceId + ' style="width:' + slice.width() + 'px;height:' + slice.height() + 'px;"></div>';
    div.html(html); // reset

    const myChart = echarts.init(document.getElementById(sliceId));

    // const fd = slice.formData;
    const json = payload.data;

    const dataName = [];  // echarts需要的是两个数组
    let maxValue = 0;
    const dataValue = json;
    dataValue.forEach(function (item) {
    dataName.push(item.name);
    if (item.value > maxValue) {
        maxValue = item.value;
        }
    });

    const option = {
    tooltip: {
        trigger: 'item',
        formatter: '{a} <br/>{b} : {c}',
    },
    legend: {
        data: dataName,
    },
    calculable: true,
    series: [
        {
            name: '漏斗图',
            type: 'funnel',
            left: '10%',
            top: 60,
            // x2: 80,
            bottom: 60,
            width: '80%',
            // height: {totalHeight} - y - y2,
            min: 0,
            max: maxValue,
            minSize: '0%',
            maxSize: '100%',
            sort: 'descending',
            gap: 2,
            label: {
                normal: {
                    show: true,
                    position: 'inside',
                },
                emphasis: {
                    textStyle: {
                        fontSize: 20,
                    },
                },
            },
            labelLine: {
                normal: {
                    length: 10,
                    lineStyle: {
                        width: 1,
                        type: 'solid',
                    },
                },
            },
            itemStyle: {
                normal: {
                    borderColor: '#fff',
                    borderWidth: 1,
                },
            },
            data: dataValue,
        },
    ],
};
  // 使用刚指定的配置项和数据显示图表。
  myChart.setOption(option);
}

export default echartsFunnelVis;
