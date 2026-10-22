import echarts from 'echarts';
import AnnotationTypes, {applyNativeColumns} from "../javascripts/modules/AnnotationTypes";
import moment from "moment";

function echartsStatLine(slice, payload) {
    const div = d3.select(slice.selector);
    div.style('overflow', 'visible');
    const sliceId = 'highcharts_slice_' + slice.formData.slice_id;
    const html = '<div id=' + sliceId + ' style="width:' + slice.width() + 'px;height:' + slice.height() + 'px;"></div>';
    div.html(html); // reset
    const fd = slice.formData;
    const myChart = echarts.init(document.getElementById(sliceId));
    const seriesColor = fd.series_color ? JSON.parse(fd.series_color) : {};

    // const fd = slice.formData;
    const stockData = payload.data.data;
    const isShowMa = fd.whether_show_ma_at_beginning;
    const quoteData = stockData.data;
    const downColor = '#00da3c';
    const upColor = '#ec0000';

    const lastClose = quoteData[quoteData.length - 1][2];
    const lastPreClose = quoteData[quoteData.length - 2][2];
    const priceChange = lastClose - lastPreClose;
    const priceChangePer = (priceChange / lastPreClose * 100).toFixed(2);
    const annotationLayers = (slice.formData.annotation_layers || []).filter(x => x.show);
    const markPointData = {};
    if (annotationLayers.length) {
        annotationLayers.filter(x => (
            x.annotationType === AnnotationTypes.EVENT &&
            slice.annotationData && slice.annotationData[x.name]
          )).forEach((layer) => {
            const e = applyNativeColumns(layer);
            slice.annotationData[e.name].records.forEach((r) => {
                const timeValue = moment(r[e.timeColumn]).format('YYYY-MM-DD');
                const titleValue = r[e.titleColumn];
                markPointData[timeValue] = titleValue;
            });
        });
    }

function splitData(rawData) {
    const categoryData = [];
    const values = [];
    const volumes = [];
    const markPointDataMatch = [];
    for (let i = 0; i < rawData.length; i++) {
        const rowObj = Object.assign([], rawData[i]);
        if(rowObj[0] in markPointData) {
            markPointDataMatch.push({coord: [rowObj[0], rowObj[4]]});
        }
        categoryData.push(rowObj.splice(0, 1)[0]);
        values.push(rowObj);
        volumes.push([i, rowObj[4], rowObj[0] > rowObj[1] ? 1 : -1]);
    }

    return {
        categoryData,
        values,
        volumes,
        markPointDataMatch,
    };
}

function calculateMA(dayCount, data) {
    const result = [];
    for (let i = 0, len = data.values.length; i < len; i++) {
        if (i < dayCount) {
            result.push('-');
            continue;
        }
        let sum = 0;
        for (let j = 0; j < dayCount; j++) {
            sum += data.values[i - j][1];
        }
        result.push(+(sum / dayCount).toFixed(3));
    }
    return result;
}


    const data = splitData(quoteData);

    const option = {
        backgroundColor: '#fff',
        animation: false,
        title: {
            subtext: fd.show_lastvalue ? '' + priceChange + '/' + priceChangePer + '%' : '',
            subtextStyle: {
                color: '#333333',
                fontWeight: 'bold',
            },
        },
        legend: {
            // bottom: 10,
            // left: 'center',
            data: ['Index', 'MA5', 'MA10', 'MA20', 'MA30'],
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'line',
            },
            // backgroundColor: 'rgba(245, 245, 245, 0.8)',
            borderWidth: 1,
            borderColor: '#ccc',
            padding: 10,
            // textStyle: {
            //     color: '#000',
            // },
            formatter: (param) => {
                param.sort((a, b) => {
                    return a.seriesIndex - b.seriesIndex;
                });
                const name = param[0].name;
                const marker = param[0].marker;
                const tooltipArr = param.map((item, index) => {
                    if(index === 0) {
                        return [
                            name + '<br/>',
                            marker + '<span>open: ' + echarts.format.addCommas(item.data[1]) + '</span><br/>',
                            marker + '<span>close: ' + echarts.format.addCommas(item.data[2]) + '</span><br/>',
                            marker + '<span>lowest: ' + echarts.format.addCommas(item.data[3]) + '</span><br/>',
                            marker + '<span>highest: ' + echarts.format.addCommas(item.data[4]) + '</span><br/>',
                        ].join('');
                    }
                    // ma均线value不是数组
                    if(!Array.isArray(item.value)) {
                        return item.marker + item.seriesName + ': ' + echarts.format.addCommas(item.value) + '<br/>';
                    }
                    return marker + item.seriesName + ': ' + echarts.format.addCommas(item.value[1]) + '<br/>';
                });
                if(name in markPointData) {
                    tooltipArr.push('事件: ' + markPointData[name]);
                }
                return tooltipArr.join('');
            },
        },
        axisPointer: {
            link: { xAxisIndex: 'all' },
            label: {
                backgroundColor: '#777',
            },
        },
        toolbox: {
            show: false,
        },
        brush: {
            xAxisIndex: 'all',
            brushLink: 'all',
            outOfBrush: {
                colorAlpha: 0.1,
            },
        },
        visualMap: {
            show: false,
            seriesIndex: 5,
            dimension: 2,
            pieces: [
                {
                value: 1,
                color: downColor,
                },
                {
                value: -1,
                color: upColor,
                },
            ],
        },
        grid: [
            {
                left: '10%',
                right: '8%',
                height: '50%',
            },
            {
                left: '10%',
                right: '8%',
                top: '63%',
                height: '16%',
            },
        ],
        xAxis: [
            {
                type: 'category',
                data: data.categoryData,
                scale: true,
                boundaryGap: false,
                axisLine: { onZero: false },
                splitLine: { show: false },
                splitNumber: 20,
                min: 'dataMin',
                max: 'dataMax',
                axisPointer: {
                    z: 100,
                },
                axisLabel: {
                    showMinLabel: true,
                    showMaxLabel: true,
                },
            },
            {
                type: 'category',
                gridIndex: 1,
                data: data.categoryData,
                scale: true,
                boundaryGap: false,
                axisLine: { onZero: false },
                axisTick: { show: false },
                splitLine: { show: false },
                axisLabel: { show: false },
                splitNumber: 20,
                min: 'dataMin',
                max: 'dataMax',
                axisPointer: {
                    label: {
                        show: false,
                        formatter: (params) => {
                            const seriesValue = (params.seriesData[0] || {}).value[1];
                            return params.value
                            + (seriesValue != null
                                ? '\n' + echarts.format.addCommas(seriesValue)
                                : ''
                            );
                        },
                    },
                },
            },
        ],
        yAxis: [
            {
                scale: true,
                splitArea: {
                    show: true,
                },
            },
            {
                scale: true,
                gridIndex: 1,
                splitNumber: 2,
                axisLabel: { show: false },
                axisLine: { show: false },
                axisTick: { show: false },
                splitLine: { show: false },
            },
        ],
        dataZoom: [
            {
                type: 'inside',
                xAxisIndex: [0, 1],
                start: fd.kline_x_axis_start,
                end: fd.kline_x_axis_end,
            },
            {
                show: true,
                xAxisIndex: [0, 1],
                type: 'slider',
                top: '85%',
                start: fd.kline_x_axis_start,
                end: fd.kline_x_axis_end,
            },
        ],
        series: [
            {
                name: 'Index',
                type: 'candlestick',
                data: data.values,
                large: false,
                itemStyle: {
                    normal: {
                        color: upColor,
                        color0: downColor,
                        borderColor: null,
                        borderColor0: null,
                    },
                },
                markPoint: {
                    // symbol: 'image:///static/assets/images/flash.png',
                    symbol: 'circle',
                    symbolSize: 10,
                    symbolOffset:[0,'-80%'],
                    symbolKeepAspect: false,
                    data: data.markPointDataMatch,
                },
            },
            {
                name: 'MA5',
                type: 'line',
                data: calculateMA(5, data),
                smooth: true,
                lineStyle: {
                    normal: { opacity: 0.8 },
                },
                itemStyle: fd.series_color ? { color: seriesColor.MA5 } : {},
                symbol: 'none',
            },
            {
                name: 'MA10',
                type: 'line',
                data: calculateMA(10, data),
                smooth: true,
                lineStyle: {
                    normal: { opacity: 0.8 },
                },
                itemStyle: fd.series_color ? { color: seriesColor.MA10 } : {},
                symbol: 'none',
            },
            {
                name: 'MA20',
                type: 'line',
                data: calculateMA(20, data),
                smooth: true,
                lineStyle: {
                    normal: { opacity: 0.8 },
                },
                itemStyle: fd.series_color ? { color: seriesColor.MA20 } : {},
                symbol: 'none',
            },
            {
                name: 'MA30',
                type: 'line',
                data: calculateMA(30, data),
                smooth: true,
                lineStyle: {
                    normal: { opacity: 0.8 },
                },
                itemStyle: fd.series_color ? { color: seriesColor.MA30 } : {},
                symbol: 'none',
            },
            {
                name: 'Volume',
                type: 'bar',
                xAxisIndex: 1,
                yAxisIndex: 1,
                data: data.volumes,
                large: false,
            },
        ],
    };
    if (!isShowMa) {
        option.legend.selected = {};
        option.legend.selected.MA5 = false;
        option.legend.selected.MA10 = false;
        option.legend.selected.MA20 = false;
        option.legend.selected.MA30 = false;
    }

  // 使用刚指定的配置项和数据显示图表。
  myChart.setOption(option);

}

export default echartsStatLine;
