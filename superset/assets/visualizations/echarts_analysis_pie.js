import echarts from 'echarts';
import { spectrums } from '../javascripts/modules/colors';

function echartsAnalysisPie(slice, payload) {
    const div = d3.select(slice.selector);
    const fd = slice.formData;
    const sliceId = slice.containerId + '_slice_' + fd.slice_id;
    const html = '<div id=' + sliceId + ' style="width:' + slice.width() + 'px;height:' + slice.height() + 'px;"></div>';
    div.html(html); // reset

    const myChart = echarts.init(document.getElementById(sliceId));
    const sourceData = payload.data;
    const textReplace = fd.text_replace ? JSON.parse(fd.text_replace) : {};

    function convertPieData(data) {
        let name = data[0];
        if (textReplace.hasOwnProperty(name)) {
            name = textReplace[name];
        }
      return {
        name: name,
        value: [100, data[1]],
        selected: true,
      };
    }

    function convertPieArrayData(index) {
      return {
        title: [{
            text: fd.display_date_in_tile ? fd.pie_title + '(' + sourceData.date[index] + ')' : fd.pie_title,
        }],
        series: [{
            data: sourceData.data[index].map(k => convertPieData(k)),
        }],
      };
    }

    const option = {
        baseOption: {
            timeline: {
                axisType: 'category',
                orient: 'vertical',
                autoPlay: fd.auto_play,
                inverse: true,
                playInterval: fd.auto_play_interval,
                currentIndex: sourceData.date.length - 1, // 默认的当前时间轴 放在最新的日期
                left: null,
                right: 0,
                top: 20,
                bottom: 20,
                width: 100,
                height: null,
                label: {
                    normal: {
                        textStyle: {
                            color: '#999',
                        },
                    },
                    emphasis: {
                        textStyle: {
                            color: '#fff',
                        },
                    },
                },
                symbol: 'none',
                lineStyle: {
                    color: '#555',
                },
                checkpointStyle: {
                    color: '#bbb',
                    borderColor: '#777',
                    borderWidth: 2,
                },
                controlStyle: {
                    showNextBtn: false,
                    showPrevBtn: false,
                    normal: {
                        color: '#666',
                        borderColor: '#666',
                    },
                    emphasis: {
                        color: '#aaa',
                        borderColor: '#aaa',
                    },
                },
                data: sourceData.date,
            },
            tooltip: {
                trigger: 'item',
                formatter: params => params.name + ' : ' + params.value[1],
            },
            visualMap: {
                type: 'continuous',
                min: sourceData.visual_map_min_value,
                max: sourceData.visual_map_max_value,
                text: ['High', 'Low'],
                realtime: false,
                calculable: true,
                color: [...spectrums[fd.world_flow_linear_color_scheme]].reverse(),
                show: false,
            },
            title: [{
                        text: fd.pie_title,
                        textAlign: 'center',
                        left: '50%',
                        top: '85%',
                        textStyle: {
                            fontSize: 20,
                        },
                    }],
            series: {
                name: fd.pie_title,
                type: 'pie',
                avoidLabelOverlap: false,
                center: ['50%', '50%'],
                radius: fd.max_radius,
                label: {
                    normal: {
                        show: true,
                        position: 'inside',
                        textStyle: {
                            fontSize: '20',
                            fontWeight: 'bold',
                        },
                    },
                    emphasis: {
                        show: true,
                        textStyle: {
                            fontSize: '30',
                            fontWeight: 'bold',
                        },
                    },
                },
                selectedMode: 'multiple',
                labelLine: {
                    normal: {
                        show: false,
                    },
                },
            },
        },
        options: [...Array(sourceData.date.length).keys()].map(x => convertPieArrayData(x)),
    };


  // 使用刚指定的配置项和数据显示图表。
  myChart.setOption(option);
}

export default echartsAnalysisPie;
