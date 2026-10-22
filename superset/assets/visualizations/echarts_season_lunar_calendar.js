import echarts from 'echarts';
import { yAxisLimit, tooltipFormat, yAxisFormat } from '../javascripts/modules/utils';

function echartsSeasonLunarCalendar(slice, payload) {
    const div = d3.select(slice.selector);
    const fd = slice.formData;
    // div.style('overflow', 'visible');
    const sliceId = slice.containerId + '_slice_' + fd.slice_id;
    const html = '<div id=' + sliceId + ' style="width:' + slice.width() + 'px;height:' + slice.height() + 'px;"></div>';
    div.html(html); // reset

    const myChart = echarts.init(document.getElementById(sliceId));
    const sourceData = payload.data;
    const data = sourceData.data;
    const seriesColor = fd.series_color ? JSON.parse(fd.series_color) : {};
    const leftAxisMinValue = parseFloat(fd.left_axis_min_value);
    const leftAxisMaxValue = parseFloat(fd.left_axis_max_value);
    const legendSelected = fd.legend_selected ? JSON.parse(fd.legend_selected) : {};
    const preCount = data.index.length - 5 ;
    let lastClickTime = 0;
    let singleLegendClickTimeout = null;
    const DOUBLE_CLICK_DELAY = 400; // 双击间隔（毫秒）


    function genSeries(index) {
      return {
        type: fd.data_display_type,
        data: data.data[index],
        name: data.index[index],
        connectNulls: true,
        itemStyle: { normal: { } },
      };
    }

    function axisLabelShow(index, value) {
        if (value === '春节' || value === '中秋节' || index % 15 === 0) {
            return true;
        }
      return false;
    }

    const option = {
        title: {
          text: sourceData.title.length > 0 ? sourceData.title : '',
          subtext: sourceData.sub_title.length > 0 ? sourceData.sub_title : '',
          show: sourceData.title.length > 0,
        },
        tooltip: {
            trigger: 'axis',
            appendToBody: true,
            textStyle: {
                fontSize: 13,
                color: '#333',
            },
            extraCssText: `
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                border-radius: 4px;
                padding: 8px 12px;
                line-height: 1.5;
            `,
            backgroundColor: 'rgba(255,255,255,0.8)',
            borderColor: '#E0E0E0',
            borderWidth: 1,
            formatter: tooltipFormat({ formatStringLeft: fd.y_axis_format }),
        },
        legend: {
            data: data.index,
            orient: 'horizontal',
            x: 'center',
            y: 'top',
            selected: {},
        },
        grid: Object.assign({ bottom: 25 }),
        xAxis: {
            type: 'category',
            position: 'bottom',
            // data: data.columns.map(value => '第' + value + '天'),
            data: data.columns.map(value => (value === '0' ? fd.festival_type : value)),
            axisLabel: {
                // interval: 9,
                interval: axisLabelShow,
            },
        },
        yAxis: {
            type: 'value',
            min: yAxisLimit(leftAxisMinValue, 'min'),
            max: yAxisLimit(leftAxisMaxValue, 'max'),
            axisLabel: { formatter: yAxisFormat(fd.y_axis_format) },
        },
        series: [...Array(data.index.length - 4).keys()].map(x => genSeries(x)),
    };

    // 添加最新年份线
    option.series.push(
        {
            type: fd.data_display_type,
            data: data.data[data.index.length - 4],
            name: data.index[data.index.length - 4],
            itemStyle: { normal: {
                color: `rgb(${fd.stroke_color_picker.r}, ${fd.stroke_color_picker.g}, ${fd.stroke_color_picker.b})`,
                },
            },
            lineStyle: { normal: {
                width: fd.stroke_width,
                type: fd.stroke_type,
                },
             },
            connectNulls: true,
            markLine: {
                lineStyle: { color: { colorStops: [{ offset: 0, color: 'black' }] } },
                silent: true, // ignore mouse events
              label: { show: false },
              data: [
                         [
                                {
                                    coord: [fd.festival_type, yAxisLimit(leftAxisMinValue, 'min')(
                                        { min: sourceData.min, max: sourceData.max })],
                                },
                                {
                                    coord: [fd.festival_type, yAxisLimit(leftAxisMaxValue, 'max')(
                                        { min: sourceData.min, max: sourceData.max })],
                                },
                        ],
                    ],
            },
        },
    );

    //添加最大最小值线
    if(fd.show_min_max) {

        data.index.forEach((v, ix) => {
        if (ix < preCount) {
            option.legend.selected[data.index[ix]] = false;
        }
        });

        option.series.push({
            type: 'line',
            // symbol: 'none',
            symbolSize: 0,
            data: data.data[data.index.length - 3],
            name: data.index[data.index.length - 3],
            areaStyle: { normal: { color: 'rgb(0,0,0)', opacity: 0.1, origin: 'start' } },
            itemStyle: { normal: { color: '#000' } },
            lineStyle: { normal: { opacity: 0 } },
        },{
            type: 'line',
            // symbol: 'none',
            symbolSize: 0,
            data: data.data[data.index.length - 2],
            name: data.index[data.index.length - 2],
            areaStyle: { normal: { color: 'rgb(255,255,255)', opacity: 1, origin: 'start' } },
            itemStyle: { normal: { color: '#000' } },
            lineStyle: { normal: { opacity: 0 } },
        },);
    }
    // 添加平均线
    option.series.push({
            type: 'line',
            data: data.data[data.index.length - 1],
            name: data.index[data.index.length - 1],
            itemStyle: { normal: { color: '#000' } },
            lineStyle: { normal: { width: 2, type: 'dotted' } },
            connectNulls: true,
        },);

    if (fd.whether_show_average_line === false) {
      option.legend.selected = {};
      option.legend.selected[data.index[data.index.length - 1]] = false;
    }

    if (fd.series_color) {
        option.series.map((value, index, arr) => {
            if (seriesColor.hasOwnProperty(value.name)) {
                arr[index].itemStyle.normal.color = seriesColor[value.name];
            }
            return null;
    });
    }

    if (fd.legend_selected) {
        option.series.forEach((value) => {
            if (legendSelected.hasOwnProperty(value.name)) {
                option.legend.selected[value.name] = legendSelected[value.name];
            }
    });
    }

  // 使用刚指定的配置项和数据显示图表。
  myChart.setOption(option);

    myChart.on('legendselectchanged', function (params) {
            let currentTime = new Date().getTime();
            const selectedLegends = params.selected;
            let clickedLegend = params.name;
            let allLegendNames = Object.keys(selectedLegends); // 获取所有 legend 名称
            let activeLegends = Object.keys(selectedLegends).filter(name => selectedLegends[name]);
            if (currentTime - lastClickTime < DOUBLE_CLICK_DELAY) {
                // **双击逻辑**：只选中当前双击的 legend，取消其他 legend
                clearTimeout(singleLegendClickTimeout); // 取消单击事件
                myChart.dispatchAction({
                                type: 'legendAllSelect',
                            });
                myChart.dispatchAction({
                                type: 'legendInverseSelect',
                            });
                myChart.dispatchAction({
                    type: 'legendSelect',
                    name: clickedLegend
                });
                console.log("双击激活：" + clickedLegend);
            } else {
                // **单击逻辑**：延迟执行，避免影响双击
                singleLegendClickTimeout = setTimeout(() => {
                    console.log("单击 legend：" + params.name);
                    if (!activeLegends.length) {
                        myChart.dispatchAction({
                                type: 'legendAllSelect',
                            });
                    }
                }, DOUBLE_CLICK_DELAY);
            }
            lastClickTime = currentTime;
        });
}

export default echartsSeasonLunarCalendar;
