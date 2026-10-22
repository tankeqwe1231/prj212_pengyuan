import echarts from 'echarts';
import moment from 'moment';
import AnnotationTypes, {
  applyNativeColumns,
} from '../javascripts/modules/AnnotationTypes';
import { d3TimeFormatPresetLocal, yAxisLimit } from '../javascripts/modules/utils';

function echartsEvents(slice, payload) {
    const div = d3.select(slice.selector);
    const fd = slice.formData;
    const sliceId = slice.containerId + '_slice_' + fd.slice_id;
    const html = '<div id=' + sliceId + ' style="width:' + slice.width() + 'px;height:' + slice.height() + 'px;"></div>';
    div.html(html); // reset

    const myChart = echarts.init(document.getElementById(sliceId));
    const xFormatter = d3TimeFormatPresetLocal(fd.x_axis_time_format);

    const sourceData = payload.data;
    let eventsData = [];
    const dfData = sourceData.data;
    const annotationLayers = (slice.formData.annotation_layers || []).filter(x => x.show);
    const leftAxisMinValue = parseFloat(fd.left_axis_min_value);
    const leftAxisMaxValue = parseFloat(fd.left_axis_max_value);
    if (annotationLayers.length) {
          // Event annotations
          annotationLayers.filter(x => (
            x.annotationType === AnnotationTypes.EVENT &&
            slice.annotationData && slice.annotationData[x.name]
          )).forEach((config, index) => {
                const e = applyNativeColumns(config);
                const records = (slice.annotationData[e.name].records || []).map((r) => {
                const timeValue = moment(r[e.timeColumn]).format('YYYYMMDD');
                const originaltimeindex = dfData.columns.indexOf(timeValue);
                if (originaltimeindex >= 0) {
                    const originalval = dfData.data[0][originaltimeindex];
                    return [timeValue, originalval + index, r[e.titleColumn]];
                }
                return [];
                });
                if (records.length) {
                    eventsData = [...records, ...eventsData];
                }
          });
    }

    if (sourceData.events.length) {
       eventsData = [...sourceData.events, ...eventsData];
    }

    const xformatfunc = (value) => {
                if (fd.x_axis_time_format) {
                    if (value.length === 8) {
                    const valueNew = value.substr(0, 4) + '/' + value.substr(4, 2) + '/' + value.substr(6, 2);
                    return xFormatter(valueNew);
                }
                return xFormatter(value);
            }
            return value;
            };

    function markPoint(data) {
        if (data.length) {
            return {
            coord: [data[0], data[1]],
            label: {
                offset: [0, -30],
                color: '#111',
                formatter: () => data[2].replace(/(<br>|<br\/>)/g, '\n'),
            },
          };
        }
        return {};
    }

    const option = {
        series: [{
            type: 'line',
            data: dfData.data[0],
            name: dfData.index[0],
            markPoint: {
                symbol: 'pin',
                symbolSize: 15,
                symbolOffset: [0, -10],
                data: eventsData.map(x => markPoint(x)),
            },
        }],
        xAxis: [{
            type: 'category',
            position: 'bottom',
            data: dfData.columns,
            axisLabel: { formatter: xformatfunc,
            },
        }],
        yAxis: [{
            type: 'value',
            position: 'left',
            min: yAxisLimit(leftAxisMinValue, 'min'),
            max: yAxisLimit(leftAxisMaxValue, 'max'),
        }],
        legend: {
            data: dfData.index,
            orient: 'horizontal',
            x: 'center',
            y: 'top',
        },
        tooltip: {
            trigger: 'axis',
            formatter: (params) => {
                    let showHtm = xformatfunc(params[0].name);
                    for (let i = 0; i < params.length; i++) {
                        const data = params[i].data;
                        const seriesName = params[i].seriesName;
                        showHtm += '<br>' + params[i].marker + seriesName + ':' + data;
                    }
                    return showHtm;
                },
        },
        dataZoom: [{
            show: true,
            start: sourceData.X_axis_zoom_start,
            end: sourceData.X_axis_zoom_end,
        }],
    };

    if (dfData.index.length > 1) {
        for (let i = 1; i < dfData.index.length; i++) {
            option.series.push(
                {
                    type: 'line',
                    data: dfData.data[i],
                    name: dfData.index[i],
                },
        );
        }
    }

    // 使用刚指定的配置项和数据显示图表。
    myChart.setOption(option);
}

export default echartsEvents;
