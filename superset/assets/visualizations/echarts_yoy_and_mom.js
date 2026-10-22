import echarts from 'echarts';
import { yAxisLimit } from '../javascripts/modules/utils';

function echartsYoyAndMom(slice, payload) {
    const div = d3.select(slice.selector);
    const fd = slice.formData;
    const sliceId = slice.containerId + '_slice_' + fd.slice_id;
    const html = '<div id=' + sliceId + ' style="width:' + slice.width() + 'px;height:' + slice.height() + 'px;"></div>';
    div.html(html); // reset

    const myChart = echarts.init(document.getElementById(sliceId));

    const sourceData = payload.data;
    const dfData = sourceData.data;
    const leftAxisMinValue = parseFloat(fd.left_axis_min_value);
    const leftAxisMaxValue = parseFloat(fd.left_axis_max_value);

    function genSeries(data, index) {
      return {
        type: 'line',
        data: data.data[index],
        name: data.index[index],
      };
    }

    function fun(params) {
        let axisLabel = '';
        const retDict = {};
        for (let i = 0, l = params.length; i < l; i++) {
            const val = params[i];
            if (val.seriesName in retDict) {
                if (retDict[val.seriesName].data === 0) {
                    retDict[val.seriesName] = val;
                }
            } else {
                retDict[val.seriesName] = val;
            }
            axisLabel = val.axisValueLabel;
        }

        const retHtmlList = [];
        retHtmlList.push(axisLabel);
        for (const prop in retDict) {
            if (retDict[prop].data) {
                retHtmlList.push(retDict[prop].marker + retDict[prop].seriesName + ': ' + retDict[prop].data + '%');
            } else {
                retHtmlList.push(retDict[prop].marker + retDict[prop].seriesName + ': -');
            }
        }

        return retHtmlList.join('<br>');
    }

    const option = {
        title: {
            text: '同、环比图',
        },
        tooltip: {
            trigger: 'axis',
            formatter: fun,
        },
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
            axisLabel: {
                formatter: '{value} %',
            },
        },
        series: [...Array(dfData.index.length).keys()].map(x => genSeries(dfData, x)),
    };

  // 使用刚指定的配置项和数据显示图表。
  myChart.setOption(option);
}

export default echartsYoyAndMom;
