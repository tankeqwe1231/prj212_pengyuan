import echarts from 'echarts';
import { yAxisLimit } from '../javascripts/modules/utils';
import { ALL_COLOR_SCHEMES } from '../javascripts/modules/colors';

function echartsCategoryLine(slice, payload) {
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
    const chartGrid = fd.chartGrid ? JSON.parse(fd.chartGrid) : {};
    let lastClickTime = 0;
    let singleLegendClickTimeout = null;
    const DOUBLE_CLICK_DELAY = 400; // 双击间隔（毫秒）

    const option = {
        tooltip: {
            trigger: 'axis',
        },
        legend: {
            data: data.index,
            orient: 'horizontal',
            x: 'center',
            y: 'top',
        },
        grid: Object.assign({ left: '18%', right: 25 }, chartGrid),
        xAxis: {
            type: 'category',
            position: 'bottom',
            data: data.columns,
            axisLabel: { interval: fd.whether_show_all_X_axis_label ? 0 : 'auto' },
            axisTick: {
            alignWithLabel: true,
        },
        },
        yAxis: {
            type: 'value',
            min: leftAxisMinValue !== '' ? yAxisLimit(leftAxisMinValue, 'min') : null,
            max: leftAxisMaxValue !== '' ? yAxisLimit(leftAxisMaxValue, 'max') : null,
        },
        series: [
        ],
    };

    for (let i = 0; i < data.index.length; i++) {
        option.series.push(
            {
                type: fd.show_bar_value ? 'bar' : 'line',
                data: data.data[i],
                name: data.index[i],
                lineStyle: { normal: { width: i === 0 ? 5 : 2, opacity: 0.8 } },
                connectNulls: true,
                itemStyle: { normal: {
                color: i === 0 ? '#FF0000' : ALL_COLOR_SCHEMES.d3Category20[i - 1],
                },
            },
            },
        );
    }
    myChart.setOption(option);

    myChart.on('legendselectchanged', function (params) {
        const currentTime = new Date().getTime();
        const selectedLegends = params.selected;
        const clickedLegend = params.name;
        const activeLegends = Object.keys(selectedLegends).filter(name => selectedLegends[name]);
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
                name: clickedLegend,
            });
            console.log('双击激活：' + clickedLegend);
        } else {
            // **单击逻辑**：延迟执行，避免影响双击
            singleLegendClickTimeout = setTimeout(() => {
                console.log('单击 legend：' + params.name);
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

export default echartsCategoryLine;
