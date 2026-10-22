import echarts from 'echarts';

function echartsThermodynamicChart(slice, payload) {
    const div = d3.select(slice.selector);
    const fd = slice.formData;
    const sliceId = slice.containerId + '_slice_' + fd.slice_id;
    const html = '<div id=' + sliceId + ' style="width:' + slice.width() + 'px;height:' + slice.height() + 'px;"></div>';
    div.html(html); // reset

    const myChart = echarts.init(document.getElementById(sliceId));

    const sourceData = payload.data;
    const dfData = sourceData.data;
    const columnsValueDisplayOnTheRightYAxis = sourceData.columns_value_display_on_the_right_Y_axis;
    const columnsValueRepresentByHistogram = sourceData.columns_value_represent_by_histogram;
    const columnsValueRepresentByArea = sourceData.columns_value_represent_by_area;
    const leftAxisUseReverseOrder = !!sourceData.left_axis_use_reverse_order;

    function genSeries(data, index) {
      const retDict = {
        type: columnsValueRepresentByHistogram.indexOf(data.index[index]) >= 0 ? 'bar' : 'line',
        data: data.data[index],
        name: data.index[index],
        yAxisIndex: columnsValueDisplayOnTheRightYAxis.indexOf(data.index[index]) >= 0 ? 1 : 0,
      };
      if (retDict.type === 'line') {
          retDict.connectNulls = fd.connect_nulls;
      }
      if (columnsValueRepresentByArea.indexOf(data.index[index]) >= 0) {
          retDict.areaStyle = {
              normal: { opacity: 0.5 },
          };
      }
      if (columnsValueRepresentByHistogram.indexOf(data.index[index]) >= 0) {
          retDict.itemStyle = {
              normal: { opacity: 0.5 },
          };
      }
      return retDict;
    }

    const option = {
        series: [...Array(dfData.index.length).keys()].map(x => genSeries(dfData, x)),
        xAxis: [{
            type: 'category',
            position: 'bottom',
            data: dfData.columns,
        }],
        yAxis: [{
            type: 'value',
            position: 'left',
            min: sourceData.left_axis_min_value,
            max: sourceData.left_axis_max_value,
            inverse: leftAxisUseReverseOrder,
        }, {
            type: 'value',
            position: 'right',
            min: sourceData.right_axis_min_value,
            max: sourceData.right_axis_max_value,
        }],
        legend: {
            data: dfData.index,
            orient: 'horizontal',
            x: 'center',
            y: 'top',
        },
        tooltip: {
            trigger: 'axis',
        },
    };


    // 使用刚指定的配置项和数据显示图表。
    myChart.setOption(option);
}

export default echartsThermodynamicChart;
