import echarts from 'echarts';
// import * as echarts from 'echarts';
import {
    yAxisFormat,
    tooltipFormat,
    yAxisLimit,
    dateFormatCustom,
    d3FormatPreset,
} from '../javascripts/modules/utils';
import { ALL_COLOR_SCHEMES } from '../javascripts/modules/colors';
import './echarts_combine.css';

function echartsCombine(slice, payload) {
    const div = d3.select(slice.selector);
    const fd = slice.formData;
    div.style('overflow', 'visible');
    const sourceData = payload.data;
    const sliceId = slice.containerId + '_slice_' + fd.slice_id;
    const sliceId2 = slice.containerId + '_slice_table_' + fd.slice_id;
    // const tableHeight = Math.floor(slice.height() / 3);
    const tableHeight = 120;
    let chartHeight = slice.height();
    if (sourceData.df_table) {
        chartHeight = slice.height() - tableHeight - 10;
    }

    let html = '<div id=' + sliceId + ' style="width:' + slice.width() + 'px;height:' + chartHeight + 'px;"></div>';
    if (sourceData.df_table) {
        html += '<div id=' + sliceId2 + ' style="width:'
            + slice.width() * 0.85 + 'px;height:' + tableHeight + 'px;overflow: auto;margin: 0 auto;"></div>';
    }
    div.html(html);
    const myChart = echarts.init(document.getElementById(sliceId));

    const dfData = Object.assign({}, sourceData.data);
    const columnsValueDisplayOnTheRightYAxis = sourceData.columns_value_display_on_the_right_Y_axis !== '' ? sourceData.columns_value_display_on_the_right_Y_axis.split('|') : [];
    const columnsValueRepresentByHistogram = sourceData.columns_value_represent_by_histogram !== '' ? sourceData.columns_value_represent_by_histogram.split('|') : [];
    const isBarChart = sourceData.columns_value_represent_by_histogram === 'allbar' ? true : false;
    const columnsValueRepresentByArea = sourceData.columns_value_represent_by_area !== '' ? sourceData.columns_value_represent_by_area.split('|') : [];
    const isStack = sourceData.columns_value_represent_by_area === 'allstack' ? true : false;
    const leftAxisUseReverseOrder = sourceData.left_axis_use_reverse_order;
    const seriesColor = fd.series_color && fd.series_color !== '' ? JSON.parse(fd.series_color) : {};
    const aliasLabels = fd.alias_labels && fd.alias_labels !== '' ? JSON.parse(fd.alias_labels) : {};
    const areaList = fd.area_list ? JSON.parse(fd.area_list) : [];
    const leftAxisMinValue = parseFloat(fd.left_axis_min_value);
    const leftAxisMaxValue = parseFloat(fd.left_axis_max_value);
    const rightAxisMinValue = parseFloat(fd.right_axis_min_value);
    const rightAxisMaxValue = parseFloat(fd.right_axis_max_value);
    const showBrush = fd.show_brush !== 'no';
    const brushExtentStart = fd.brushExtentStart !== '' ? Math.floor(fd.brushExtentStart * 100) : 50;
    const chartGrid = fd.chartGrid ? JSON.parse(fd.chartGrid) : {};
    const toolYPos = fd.tooltip_position.trim();
    let lastClickTime = 0;
    let singleLegendClickTimeout = null;
    const DOUBLE_CLICK_DELAY = 400; // 双击间隔（毫秒）
    let seriesCopy = null;
    let seriesJson = '';

    let xAxisData = dfData.columns;
    if (fd.columns.length > 1) {
        xAxisData = xAxisData.map(obj => obj.join('\n'));
    }

    // event_list： 2|20240101|事件内容
    const eventSplit = fd.event_list.split('\n');
    const eventDict = {};
    eventSplit.forEach((itm) => {
        const itmArr = itm.split('|');
        const category = itmArr[0];
        const eventDate = itmArr[1];
        const eventContent = itmArr[2];
        if (!eventDict[category]) {
            eventDict[category] = [];
        }
        eventDict[category].push([eventDate, eventContent]);
    });

    // let selectorFlag = false;
    // if (isBarChart & isStack & dfData.index.length > 8) {
    //     selectorFlag = true;
    // }

    if (sourceData.df_table) {
        d3.select('#' + sliceId2).html(sourceData.df_table);
    }

    function culSymbolSize(value) {
        const maxLength = 30; // 每行最大字符数
        const lineHeight = 15; // 每行高度
        const charWidth = 6.5; // 一个字符占的宽度
        let actualLength = 0;
        for (let i = 0; i < value.length; i++) {
            const char = value[i];
            if (/[\u4e00-\u9fa5]/.test(char)) {
                actualLength += 2;
            } else if (/[a-zA-Z0-9]/.test(char)) {
                actualLength += 1;
            } else {
                actualLength += 1.5;
            }
        }
        // 计算行数
        const lines = Math.ceil(actualLength / maxLength);
        // 根据行数计算总高度
        const height = lines === 1 ? 18 : lines * lineHeight;
        const actualWidth = Math.min(maxLength * charWidth, actualLength * charWidth);
        console.log(actualLength, lines, maxLength * charWidth, actualLength * charWidth);
        return [actualWidth, height]; // 返回 [宽度, 高度]
    }

    function symbolLabelFomat(params) {
        const maxLength = 30; // 每行最大字符数
        const value = params.value;
        let result = '';
        let currentLength = 0;
        // 遍历字符并处理换行
        for (let i = 0; i < value.length; i++) {
            const char = value[i];
            if (/[\u4e00-\u9fa5]/.test(char)) {
                currentLength += 2;
            } else if (/[a-zA-Z0-9]/.test(char)) {
                currentLength += 1;
            } else {
                currentLength += 1.5;
            }
            result += char;
            if (currentLength >= maxLength) {
                result += '\n';
                currentLength = 0;
            }
        }
        return result.trim();
    }

    function genSeries(sName, index) {
        let chartType = columnsValueRepresentByHistogram.indexOf(sName) >= 0 ? 'bar' : 'line';
        if (isBarChart) {
            chartType = 'bar';
        }
        const seriesName = aliasLabels.hasOwnProperty(sName)
                ? aliasLabels[sName] : sName;
        const eventList = eventDict[index + 1] || [];
        const markPointData = eventList.map((itm) => {
            const datePos = xAxisData.indexOf(itm[0]);
            return {
                name: seriesName,
                coord: [itm[0], dfData.data[index][datePos]],
                value: itm[1],
            };
        });
        const retDict = {
            type: chartType,
            data: dfData.data[index].map(item => ({
                    value: item,
                    label: {
                        show: fd.show_bar_value && chartType === 'bar',
                        position: item >= 0 ? 'top' : 'bottom',
                        // formatter: params =>
                        // // console.log(params);
                        // fd.lable_format ? d3FormatPreset(fd.lable_format)(params.value) : params.value,
                    },
                })),
            name: seriesName,
            yAxisIndex: columnsValueDisplayOnTheRightYAxis.indexOf(sName) >= 0 ? 1 : 0,
            itemStyle: fd.current_color_prior && index === dfData.index.length - 1 ? { color: `rgb(${fd.stroke_color_picker.r}, ${fd.stroke_color_picker.g}, ${fd.stroke_color_picker.b})` } : {},
            // eslint-disable-next-line max-len
            lineStyle: fd.stroke_width && index === dfData.index.length - 1 ? { width: fd.stroke_width } : {},
            markPoint: {
                data: markPointData,
                symbol: 'rect',
                label: {
                    position: 'insideLeft',
                    color: 'black',
                    formatter: symbolLabelFomat,
                },
                symbolSize: culSymbolSize,
                itemStyle: {
                    color: '#C5B8A5',
                    opacity: 0.9,
                },
            },
        };
        if (retDict.type === 'line') {
            retDict.connectNulls = slice.formData.connect_nulls;
        }
        if (areaList.indexOf(sName) >= 0) {
            retDict.areaStyle = {};
        }
        if (columnsValueRepresentByArea.indexOf(sName) >= 0 || isStack) {
            retDict.areaStyle = {};
            retDict.areaStyle.opacity = fd.opacity;
            retDict.stack = '总量';
            retDict.lineStyle = { width: 0, opacity: 0 };
            retDict.symbol = 'none';
        }
        if (chartType === 'bar') {
            retDict.itemStyle.opacity = fd.opacity;
            if (fd.show_bar_value) {
                retDict.label = {
                    formatter: params =>
                        fd.lable_format ? d3FormatPreset(fd.lable_format)(params.value) : params.value,
                };
            }
            if (fd.barGap) {
                retDict.barGap = fd.barGap;
            }
            if (fd.barCategoryGap) {
                retDict.barCategoryGap = fd.barCategoryGap;
            }
        }

        return retDict;
    }

    function culculatePercent(series, selectedMap) {
        let n = series.length, m = series[0]['data'].length, k = 1 / n, i, j, o;
      for (j = 0; j < m; ++j) {
        for (i = 0, o = 0; i < n; i++) {
            if (!selectedMap[series[i]['name']]) {
                series[i]['data'][j]['value'] = 0;
            }
            o += series[i]['data'][j]['value'];
        }
        if (o) {
            for (i = 0; i < n; i++) series[i]['data'][j]['value'] /= o;
        } else {
            for (i = 0; i < n; i++) series[i]['data'][j]['value'] = k;
        }
      }
    }

    const series = dfData.index.map((itm, index) => genSeries(itm, index));

    let legendData = series.map(item => item.name);
    // 当 isStack为 true 时，重新排序 legend
    if (isStack) {
        const positiveItems = [];
        const negativeItems = [];

        series.forEach((seriesItem) => {
            const lastValue = seriesItem.data[seriesItem.data.length - 1];
            const lastValueNum = typeof lastValue === 'object' ? lastValue.value : lastValue;

            if (lastValueNum >= 0) {
                positiveItems.push(seriesItem.name);
            } else {
                negativeItems.push(seriesItem.name);
            }
        });

        // 将正值数组反转后合并到负值数组前面
        legendData = positiveItems.reverse().concat(negativeItems);
    }
    const option = {
        animation: false,
        series,
        xAxis: [{
            type: 'category',
            position: 'bottom',
            data: xAxisData,
            axisLabel: {
                showMinLabel: fd.x_axis_showminmax ? fd.x_axis_showminmax : null,
                showMaxLabel: fd.x_axis_showminmax ? fd.x_axis_showminmax : null,
            },
            boundaryGap: fd.boundaryGap,
        }],
        grid: fd.columns.length > 1 ? Object.assign({ bottom: 70 }
            , chartGrid) : Object.assign({}, chartGrid),
        yAxis: [{
            type: 'value',
            position: 'left',
            // min:null,
            // max:null,
            // min: fd.bar_expand ? yAxisLimit(0, 'min', true) : yAxisLimit(leftAxisMinValue, 'min'),
            // max: fd.bar_expand ? yAxisLimit(1, 'max', true) : yAxisLimit(leftAxisMinValue, 'max'),
            inverse: leftAxisUseReverseOrder,
            axisLabel: {},
        }, {
            type: 'value',
            position: 'right',
            min: yAxisLimit(rightAxisMinValue, 'min'),
            max: yAxisLimit(rightAxisMaxValue, 'max'),
            axisLabel: {},
        }],
        legend: {
            data: legendData,
            right: fd.legend_right ? '0px' : null,
            top: fd.legend_right ? 'middle' : null,
            orient: fd.legend_right ? 'vertical' : 'horizontal',
            itemGap:  legendData.length > 20 ? 3 : 10,
            // x: 'center',
            // y: 'top',
            // width: selectorFlag ? '90%' : null,
            // selector: selectorFlag,
            // selectorPosition: 'end',
            // selectorLabel: {
            //     fontSize: 9,
            // },
        },
        dataZoom: [
            {
                show: showBrush,
                realtime: true,
                start: showBrush ? brushExtentStart : 0,
            },
        ],
        tooltip: {
            trigger: fd.is_item ? 'item' : 'axis',
            triggerOn: 'mousemove',
            appendToBody: true,
            hideDelay: 0,
            transitionDuration: 0,
            // confine: false,
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
            // position: tooltipPosition,
            position: toolYPos ? (point, params, dom, rect, size) => {
                // return [point[0], '10%'];
                const chartWidth = size.viewSize[0];
                const tooltipWidth = size.contentSize[0];
                const offset = 10;
                let x = point[0]; // 默认显示在鼠标右侧
                // 如果靠近右边缘，显示在鼠标左侧
                if (point[0] + tooltipWidth > chartWidth) {
                    x = point[0] - tooltipWidth - offset;
                } else {
                    x = point[0] + offset;
                }
                return [x, toolYPos];
            } : null,
            formatter: tooltipFormat({
                formatStringLeft: fd.y_axis_format_left,
                formatStringRight: fd.y_axis_format_right,
                formatDateX: fd.x_axis_format,
                visType: fd.viz_type,
            }),
        },
    };

    if (fd.y_axis_format_left) {
        option.yAxis[0].axisLabel.formatter = yAxisFormat(fd.y_axis_format_left);
    }
    if (fd.x_axis_format) {
        option.xAxis[0].axisLabel.formatter = dateFormatCustom(fd.x_axis_format);
    }
    if (fd.y_axis_format_right) {
        option.yAxis[1].axisLabel.formatter = yAxisFormat(fd.y_axis_format_right);
    }
    if (fd.bar_expand) {
        option.yAxis[0].min = yAxisLimit(0, 'min', true);
        option.yAxis[0].max = yAxisLimit(1, 'max', true);
    }
    if (!(columnsValueRepresentByHistogram.length && columnsValueRepresentByArea.length)) {
        option.yAxis[0].min = yAxisLimit(leftAxisMinValue, 'min');
        option.yAxis[0].max = yAxisLimit(leftAxisMaxValue, 'max');
    }
    // option.yAxis[0].min = 'dataMin';
    // option.yAxis[0].max ='dataMax';

    if (fd.color_scheme) {
        let colorSchmesLength = 0;
        for (let i = option.series.length - 1; i >= 0; i--) {
            if (!(fd.current_color_prior && i === option.series.length - 1)) {
                if (colorSchmesLength <= ALL_COLOR_SCHEMES[fd.color_scheme].length - 1) {
                    // eslint-disable-next-line max-len
                    option.series[i].itemStyle.color = ALL_COLOR_SCHEMES[fd.color_scheme][colorSchmesLength];
                } else {
                    option.series[i].itemStyle.color = ALL_COLOR_SCHEMES['hugeColor'][colorSchmesLength];
                }
                colorSchmesLength++;
            }
        }
    }

    if (fd.series_color) {
        option.series.forEach((value, index, arr) => {
            if (seriesColor.hasOwnProperty(value.name)) {
                if (!(fd.current_color_prior && index === dfData.index.length - 1)) {
                    arr[index].itemStyle.color = seriesColor[value.name];
                }
            }
        });
    }

    // EchartsOption 自定义配置面板(与原有控件独立叠加, 冲突时以此处为准)
    if (Array.isArray(fd.echarts_options)) {
        fd.echarts_options.forEach((opt) => {
            if (!opt || !opt.type) {
                return;
            }
            const cfg = opt.config || {};
            if (opt.type === 'grid') {
                option.grid = option.grid || {};
                ['top', 'right', 'bottom', 'left'].forEach((k) => {
                    if (cfg[k] !== undefined && cfg[k] !== '') {
                        option.grid[k] = isNaN(cfg[k]) ? cfg[k] : Number(cfg[k]);
                    }
                });
            } else if (opt.type === 'series') {
                Object.keys(cfg).forEach((sName) => {
                    const idx = dfData.index.indexOf(sName);
                    if (idx < 0) {
                        return;
                    }
                    const target = option.series[idx];
                    if (!target) {
                        return;
                    }
                    const sc = cfg[sName] || {};
                    if (sc.type) {
                        target.type = sc.type;
                    }
                    if (sc.name !== undefined && sc.name !== '') {
                        const oldName = target.name;
                        target.name = sc.name;
                        const li = option.legend.data.indexOf(oldName);
                        if (li >= 0) {
                            option.legend.data[li] = sc.name;
                        }
                    }
                    if (sc.yAxisIndex !== undefined && sc.yAxisIndex !== '') {
                        target.yAxisIndex = Number(sc.yAxisIndex);
                    }
                    if (sc.color) {
                        target.itemStyle = Object.assign({}, target.itemStyle, { color: sc.color });
                    }
                    if (sc.width !== undefined && sc.width !== '') {
                        target.lineStyle = Object.assign({}, target.lineStyle, { width: Number(sc.width) });
                    }
                    if (sc.stack) {
                        target.stack = '总量';
                    }
                });
            }
        });
    }

    // 使用刚指定的配置项和数据显示图表。
    myChart.setOption(option);
    myChart.on('mouseover', function (params) {
        window.selectSeries = params.seriesName;
    });

    myChart.on('mouseout', function (params) {
        window.selectSeries = '';
    });

    function showLastV(datazoomChange, evt = {}) {

        option.graphic = [];
        const startZoom = myChart.getModel().option.dataZoom[0].startValue;
        // const endZoom = myChart.getModel().option.dataZoom[0].endValue;

        if (datazoomChange) {
            option.dataZoom[0].start = evt.start;
            option.dataZoom[0].end = evt.end;
        }

        const startDate = myChart.getModel().option.xAxis[0].data[startZoom].toString();
        myChart.getOption().series.forEach((currentSeries) => {
            let newestValue = currentSeries.data[currentSeries.data.length - 1];
            if (typeof newestValue === 'object') {
                newestValue = newestValue.value;
            }
            // eslint-disable-next-line consistent-return
            for (let i = currentSeries.data.length - 1; i >= 0; i--) {
                if (currentSeries.data[i].value) {
                    newestValue = currentSeries.data[i].value;
                    break;
                }
            }

            // eslint-disable-next-line max-len
            const graphicTopYaxis = myChart.convertToPixel({ yAxisIndex: currentSeries.yAxisIndex }
                , newestValue) - 15;
            // eslint-disable-next-line max-len
            const graphicColor = currentSeries.itemStyle.color;
            const yAixs = myChart.getOption().yAxis;
            const formatterFunc = yAixs[currentSeries.yAxisIndex].axisLabel.formatter;
            if (formatterFunc) {
                newestValue = formatterFunc(newestValue);
            }

            const newestValueStr = String(newestValue);
            let vRectWidth = newestValueStr.length * 10;
            if (newestValueStr.indexOf('.') > -1) {
                vRectWidth -= 2;
            }
            if (newestValueStr.indexOf('-') > -1) {
                vRectWidth -= 2;
            }
            const graphicLeftYaxis = myChart.convertToPixel({ xAxisIndex: 0 },
                startDate) - vRectWidth - 3;

            const groupDict = {
                type: 'group',
                width: vRectWidth,
                height: 20,
                top: Math.round(graphicTopYaxis),
                children: [
                    {
                        type: 'image',
                        z: 100,
                        left: 0,
                        top: 'middle',
                        // shape: {
                        //   width: vRectWidth,
                        //   height: 20,
                        // },
                        style: {
                            fill: '#F5B800',
                            stroke: graphicColor,
                            lineWidth: 1,
                            width: vRectWidth,
                            height: 20,
                        },
                    },
                    {
                        type: 'text',
                        z: 100,
                        // right: 0,
                        top: 4,
                        style: {
                            fill: graphicColor,
                            width: vRectWidth,
                            overflow: 'break',
                            // eslint-disable-next-line max-len
                            text: newestValue,
                            font: 'bold 14px "Microsoft YaHei"',
                        },
                    },
                ],
            };
            if (currentSeries.yAxisIndex === 0) {
                groupDict.left = graphicLeftYaxis;
                groupDict.children[1].right = 4;
                // groupDict.children[0].style.image = 'https://fengyun.thanf.com/static/assets/images/rightArrow.png';
                groupDict.children[0].style.image = '/static/assets/images/rightArrow.png';
            } else {
                groupDict.right = graphicLeftYaxis;
                groupDict.children[1].left = 4;
                // groupDict.children[0].style.image = 'https://fengyun.thanf.com/static/assets/images/leftArrow.png';
                groupDict.children[0].style.image = '/static/assets/images/rightArrow.png';
            }
            option.graphic.push(groupDict);
        });
        myChart.setOption(option);
    }

    if (fd.show_lastvalue) {
        showLastV(false);
        let timer1;
        myChart.on('dataZoom', function (evt) {
            window.clearTimeout(timer1);
            timer1 = window.setTimeout(function () {
                console.log('timer触发', evt);
                showLastV(true, evt);
            }, 1000);

            console.log('zoom', evt);
        });
    }

    if (isBarChart & isStack & fd.bar_expand) {
        seriesJson = JSON.stringify(series);
        seriesCopy = JSON.parse(seriesJson);
        // console.log('seriesCopy', seriesCopy);
        const selectedMap = dfData.index.reduce((acc, item) => {
            acc[item] = true;
            return acc;
        }, {});
        culculatePercent(seriesCopy, selectedMap);
        myChart.setOption({ series: seriesCopy });

    }


    myChart.on('legendselectchanged', function (params) {
            const currentTime = new Date().getTime();
            console.log('currentTime：', currentTime, 'lastClickTime：', lastClickTime);
            const selectedLegends = params.selected;
            const clickedLegend = params.name;
            // let allLegendNames = Object.keys(selectedLegends); // 获取所有 legend 名称
            const activeLegends = Object.keys(selectedLegends).filter(name => selectedLegends[name]);
            let legendForCulculate = {};
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
                // 获取legend 对象
                legendForCulculate = myChart.getOption().legend[0].selected;

                if (isBarChart & isStack & fd.bar_expand) {
                    seriesCopy = JSON.parse(seriesJson);
                    culculatePercent(seriesCopy, legendForCulculate);
                    myChart.setOption({ series: seriesCopy });
                }
                console.log('双击激活：' + clickedLegend);
            } else {
                // **单击逻辑**：延迟执行，避免影响双击
                console.log('单击 legend：' + params.name);
                singleLegendClickTimeout = setTimeout(() => {
                    console.log('单击 legend： setTimeout 开始执行');
                    legendForCulculate = selectedLegends;
                    if (!activeLegends.length) {
                        console.log('activeLegends == 0');
                        myChart.dispatchAction({
                                type: 'legendAllSelect',
                            });
                        legendForCulculate = myChart.getOption().legend[0].selected;
                    }
                    if (isBarChart & isStack & fd.bar_expand) {
                        // console.log('isBarChart & isStack & fd.bar_expand');
                        seriesCopy = JSON.parse(seriesJson);
                        culculatePercent(seriesCopy, legendForCulculate);
                        myChart.setOption({ series: seriesCopy });
                    }

                }, DOUBLE_CLICK_DELAY);
            }
            console.log('end---：', new Date().getTime());
            lastClickTime = currentTime;
        });
}

export default echartsCombine;
