import echarts from 'echarts';
import moment from 'moment';
import AnnotationTypes, {
  applyNativeColumns,
} from '../javascripts/modules/AnnotationTypes';
import {
    yAxisLimit,
    dateFormatCustom,
    tooltipFormat,
    yAxisFormat,
} from '../javascripts/modules/utils';
import { ALL_COLOR_SCHEMES } from '../javascripts/modules/colors';

function echartsStatLine2(slice, payload) {
    // 曲线季节
    const div = d3.select(slice.selector);
    const fd = slice.formData;
    // div.style('overflow', 'visible');
    const sliceId = slice.containerId + '_slice_' + fd.slice_id;
    const html = '<div id=' + sliceId + ' style="width:' + slice.width() + 'px;height:' + slice.height() + 'px;"></div>';
    div.html(html); // reset

    const myChart = echarts.init(document.getElementById(sliceId));
    const sourceData = payload.data;
    const data = sourceData.data;
    const customParams = sourceData.custom_params;
    let columnsClone = Object.assign([], data.columns);
    const seriesColor = fd.series_color ? JSON.parse(fd.series_color) : {};
    const legendSelectedIndex = fd.legend_selected_index ? JSON.parse(fd.legend_selected_index) : [];
    const seriesLineWidthOrder = fd.series_line_width_order ? JSON.parse(fd.series_line_width_order) : {};
    const annotationLayers = (slice.formData.annotation_layers || []).filter(x => x.show);
    const leftAxisMinValue = parseFloat(fd.left_axis_min_value);
    const leftAxisMaxValue = parseFloat(fd.left_axis_max_value);
    const rightAxisMinValue = parseFloat(fd.right_axis_min_value);
    const rightAxisMaxValue = parseFloat(fd.right_axis_max_value);
    let chartGrid = { left: '14%', right: '4%', bottom: 25 };
    const connectNulls = fd.connect_nulls || false;
    const showAllSymbol = fd.showAllSymbol || 'auto';
    let lastClickTime = 0;
    let singleLegendClickTimeout = null;
    const DOUBLE_CLICK_DELAY = 400; // 双击间隔（毫秒）

    // 隐藏 graphic 同比差那些 元素的 tooltip
    function hideGraphicTooltip() {
        const selectors = ['div[style*="pointer-events: none"][style*="position: absolute"]'];
        const chartDom = myChart.getDom();
        const nodes = selectors.reduce((acc, sel) => {
          if (chartDom && chartDom.querySelectorAll) acc.push(...chartDom.querySelectorAll(sel));
          if (typeof document !== 'undefined' && document.querySelectorAll) acc.push(...document.querySelectorAll(sel));
          return acc;
        }, []);
        nodes.forEach(node => {
          node.style.display = 'none';
          node.style.visibility = 'hidden';
        });
      }
    hideGraphicTooltip();
    
    const graphic = [];
    if (fd.show_t_h_bi) {
        chartGrid.right = 30;
        graphic.push({
            type: 'group',
            right: 0,
            id: 'tongbi_group',
            ignore: true,
            top: 'middle',
            children: [
                {
                    type: 'image',
                    style: {
                        width: 20,
                        height: 20,
                        fill: '#2c2c2c',
                        image: customParams.cal_type === 'tongbi_pctminus' ? '/static/assets/images/tongbi1.png' : '/static/assets/images/tongbi.png',
                    },
                    tooltip: {
                        formatter: '同比差', // 悬停时显示的文字
                        show: true,
                    },
                    onclick() {
                        console.log('同比差');
                        slice.props.actions.runQuery(
                            slice.formData,
                            true,
                            60,
                            slice.props.chartKey,
                            customParams.cal_type === 'tongbi_pctminus' ? {} : { cal_type: 'tongbi_pctminus' },
                        );
                    },
                },
                {
                    type: 'image',
                    top: 28,
                    style: {
                        width: 20,
                        height: 20,
                        fill: '#cb2929',
                        image: customParams.cal_type === 'tongbi_pctchange' ? '/static/assets/images/tongbi_fd1.png' : '/static/assets/images/tongbi_fd.png',
                    },
                    tooltip: {
                        formatter: '同比幅度', // 悬停时显示的文字
                        show: true,
                    },
                    onclick() {
                        console.log('同比幅度');
                        slice.props.actions.runQuery(
                            slice.formData,
                            true,
                            60,
                            slice.props.chartKey,
                            customParams.cal_type === 'tongbi_pctchange' ? {} : { cal_type: 'tongbi_pctchange' },
                        );
                    },
                },
                {
                    type: 'image',
                    top: 56,
                    style: {
                        width: 20,
                        height: 20,
                        fill: '#cb2929',
                        image: customParams.cal_type === 'huanbi_pctminus' ? '/static/assets/images/huanbi1.png' : '/static/assets/images/huanbi.png',
                    },
                    tooltip: {
                        formatter: '环比差', // 悬停时显示的文字
                        show: true,
                    },
                    onclick() {
                        console.log('环比差');
                        slice.props.actions.runQuery(
                            slice.formData,
                            true,
                            60,
                            slice.props.chartKey,
                            customParams.cal_type === 'huanbi_pctminus' ? {} : { cal_type: 'huanbi_pctminus' },
                        );
                    },
                },
                {
                    type: 'image',
                    top: 84,
                    style: {
                        width: 20,
                        height: 20,
                        fill: '#cb2929',
                        image: customParams.cal_type === 'huanbi_pctchange' ? '/static/assets/images/huanbi_fd1.png' : '/static/assets/images/huanbi_fd.png',
                    },
                    tooltip: {
                        formatter: '环比幅度', // 悬停时显示的文字
                        show: true,
                    },
                    onclick() {
                        console.log('环比幅度');
                        slice.props.actions.runQuery(
                            slice.formData,
                            true,
                            60,
                            slice.props.chartKey,
                            customParams.cal_type === 'huanbi_pctchange' ? {} : { cal_type: 'huanbi_pctchange' },
                        );
                    },
                },
            ],
        });
    }

    if (fd.chartGrid) {
        chartGrid = Object.assign(chartGrid, JSON.parse(fd.chartGrid));
    }

    function genSeries(index) {
        return {
            type: fd.data_display_type,
            data: data.data[index],
            name: data.index[index],
            connectNulls,
            showAllSymbol,
            itemStyle: { normal: {} },
            lineStyle: { normal: {} },
        };
    }

    Array.prototype.insert = function (index, item) {
      this.splice(index, 0, item);
    };

    // 均值 的索引
    const meanIndex = data.index.findIndex(v => v.includes('均值'));

    const option = {
        animation: false,
        title: {
          text: sourceData.newest_value.length > 0 ? sourceData.newest_value : '',
          subtext: sourceData.newest_date.length > 0 ? sourceData.newest_date : '',
          show: false,
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
            formatter: tooltipFormat({ formatStringLeft: fd.y_axis_format,
                formatDateX: fd.x_axis_time_format }),
        },
        legend: {
            data: Object.assign([], data.index),
            orient: 'horizontal',
            x: 'center',
            y: 'top',
        },
        dataZoom: [],
        grid: chartGrid,
        xAxis: {
            type: 'category',
            position: 'bottom',
            // data: data.columns,
            axisTick: {
                alignWithLabel: true,
            },
            boundaryGap: fd.data_display_type === 'bar',
            axisLabel: {
                formatter: fd.x_axis_time_format ? dateFormatCustom(fd.x_axis_time_format) : null,
                showMinLabel: fd.x_axis_showminmax,
                showMaxLabel: fd.x_axis_showminmax,
            },
        },
        yAxis: [{
            type: 'value',
            min: fd.show_y_min_max_strict && !isNaN(leftAxisMinValue) ? leftAxisMinValue : yAxisLimit(leftAxisMinValue, 'min'),
            max: fd.show_y_min_max_strict && !isNaN(leftAxisMaxValue) ? leftAxisMaxValue : yAxisLimit(leftAxisMaxValue, 'max'),
            axisLabel: { formatter: yAxisFormat(fd.y_axis_format) },
        }],
        color: ['#2f4554', '#61a0a8', '#d48265', '#91c7ae', '#749f83',  '#ca8622', '#bda29a', '#6e7074', '#546570', '#c4ccd3'],
        series: data.index.slice(0, meanIndex - 1).map((x, index) => genSeries(index)),
        graphic,
    };


    option.series.push(
        {
            type: fd.data_display_type,
            symbol: fd.chart_symbol ? fd.chart_symbol : 'emptyCircle',
            symbolSize: fd.symbol_size ? fd.symbol_size : 4,
            data: data.data[meanIndex - 1],
            name: data.index[meanIndex - 1],
            itemStyle: { normal: {
                color: '#2F4554',
                },
            },
            lineStyle: { normal: {
                width: fd.stroke_width,
                type: fd.stroke_type,
                },
             },
            connectNulls,
            showAllSymbol,
        },
        {
            type: 'line',
            data: data.data[meanIndex],
            name: data.index[meanIndex],
            itemStyle: { normal: { color: '#666666' } },
            lineStyle: { normal: { width: 2, type: 'dotted' } },
            connectNulls,
            showAllSymbol,
        });

    const annotationDataLength = annotationLayers.length;
    if (annotationDataLength) {
          annotationLayers.filter(x => (
            x.annotationType === AnnotationTypes.TIME_SERIES &&
            slice.annotationData && slice.annotationData[x.name]
          )).forEach((config) => {
              const e = applyNativeColumns(config);
              if (option.yAxis.length === 1 && e.rightYAxis) {
                  option.yAxis.push({
                      type: 'value',
                      position: 'right',
                      min: yAxisLimit(rightAxisMinValue, 'min'),
                      max: yAxisLimit(rightAxisMaxValue, 'max'),
                  });
              }
              const annotationData = slice.annotationData[e.name][0].values;
              const annotationDataNew = [];
              for (let i = annotationData.length - 1; i >= 0; i--) {
                  const annoX = moment(annotationData[i].x).format('YYYY-MM-DD');
                  if (annoX >= sourceData.annotationDataStart) {
                      annotationDataNew.unshift([annoX.slice(5), annotationData[i].y]);
                  } else {
                      break;
                  }
              }
              // annotationDataNew增加进去，然后再去重
                  if (annotationDataNew.length) {
                  let forPos = 0; // 记录columnsClone遍历位置
                      for (let i = 0; i < annotationDataNew.length; i++) {
                          for (let iii = forPos; iii < columnsClone.length; iii++) {
                          if (annotationDataNew[i][0] < columnsClone[iii]) {
                              columnsClone.insert(iii, annotationDataNew[i][0]);
                              forPos = iii + 2;
                              break;
                          }
                      }
                      }
                      columnsClone = Array.from(new Set(columnsClone)); // 去重
                  }
              option.series.push({
                        type: fd.data_display_type,
                        data: annotationDataNew,
                        name: e.name,
                        itemStyle: { normal: {
                            color: e.color,
                            },
                        },
                  lineStyle: fd.data_display_type === 'line' ? { normal: { width: e.width, type: e.style === 'solid' ? 'solid' : 'dotted' } } : {},
                  connectNulls,
                  showAllSymbol,
                  yAxisIndex: e.rightYAxis ? 1 : 0,
                    });
              option.legend.data.push(e.name);
          });

    }

    option.xAxis.data = columnsClone;
    option.legend.selected = {};
    const yAxisStart = !isNaN(parseInt(fd.brushExtentStart_yAxis)) && isFinite(fd.brushExtentStart_yAxis);
    const yAxisEnd = !isNaN(parseInt(fd.brushExtentEnd_yAxis)) && isFinite(fd.brushExtentEnd_yAxis);
    if (yAxisStart || yAxisEnd) {
      option.dataZoom.push({
          type: 'slider',
            yAxisIndex: 0,
            filterMode: 'empty',
          start: yAxisStart ? fd.brushExtentStart_yAxis : undefined,
          end: yAxisEnd ? fd.brushExtentEnd_yAxis : undefined,
      });
    }

    // 均值以及注释层的颜色全都是固定的，不使用color_scheme
    if (fd.color_scheme) {
        let colorSchmesLength = 0;
        const colorScheme = ALL_COLOR_SCHEMES[fd.color_scheme];
        for (let i = meanIndex - 1; i >= 0; i--) {
            if (colorSchmesLength <= colorScheme.length - 1) {
                // eslint-disable-next-line max-len
                option.series[i].itemStyle.normal.color = colorScheme[colorSchmesLength];
                colorSchmesLength++;
            }
        }
    }

    if (fd.series_color) {
        option.series.forEach((value, index, arr) => {
            if (seriesColor.hasOwnProperty(value.name)) {
               arr[index].itemStyle.normal.color = seriesColor[value.name];
            }
    });
    }

    if (fd.series_line_width_order) {
        option.series.forEach((value, index) => {
            if (seriesLineWidthOrder.hasOwnProperty(meanIndex - index)) {
                option.series[index].lineStyle.normal.width = seriesLineWidthOrder[meanIndex - index];
            }
        });
    }

    if (!fd.whether_show_average_line) {
      option.legend.selected[data.index[meanIndex]] = false;
    }

    if (legendSelectedIndex.length) {
        option.series.forEach((value, index) => {
            if (index < meanIndex) {
                if (legendSelectedIndex.includes(meanIndex - index)) {
                    option.legend.selected[value.name] = true;
                } else {
                    option.legend.selected[value.name] = false;
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
                    const target = option.series.find(s => s.name === sName);
                    if (!target) {
                        return;
                    }
                    const sc = cfg[sName] || {};
                    if (sc.type) {
                        target.type = sc.type;
                    }
                    if (sc.color) {
                        target.itemStyle = target.itemStyle || {};
                        target.itemStyle.normal = Object.assign({}, target.itemStyle.normal, { color: sc.color });
                    }
                    if (sc.width !== undefined && sc.width !== '') {
                        target.lineStyle = target.lineStyle || {};
                        target.lineStyle.normal = Object.assign({}, target.lineStyle.normal, { width: Number(sc.width) });
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

    if (fd.show_lastvalue && columnsClone.indexOf(sourceData.newest_date) >= 0) {
          const graphicLeftXaxis = myChart.convertToPixel({ xAxisIndex: 0 },
              sourceData.newest_date) - 36;
          const graphicTopYaxis = myChart.convertToPixel({ yAxisIndex: 0 },
              sourceData.newest_value) - 15;
          const newestValueStr = String(yAxisFormat(fd.y_axis_format)(sourceData.newest_value));
          let vRectWidth = newestValueStr.length * 10;
              if (newestValueStr.indexOf('.') > -1) {
                  vRectWidth -= 2;
              }
              if (newestValueStr.indexOf('-') > -1) {
                  vRectWidth -= 2;
              }
              // const vRectWidth = 60;
          const graphicLeftYaxis = myChart.convertToPixel({ xAxisIndex: 0 },
              data.columns[0]) - vRectWidth - 3;
          const graphicColor = myChart.getOption().series[meanIndex - 1].itemStyle.color;
            option.graphic.push(
                                {
                                  type: 'group',
                                  left: Math.round(graphicLeftXaxis),
                                   // bottom: 35,
                                    bottom: option.grid.bottom - 25,
                                  children: [
                                    {
                                      type: 'rect',
                                      z: 100,
                                      left: 'center',
                                      top: 'middle',
                                      shape: {
                                        width: 70,
                                        height: 20,
                                      },
                                      style: {
                                        fill: '#fff',
                                        // stroke: graphicColor,
                                        lineWidth: 1,
                                      },
                                    },
                                    {
                                      type: 'text',
                                      z: 100,
                                      left: 'center',
                                      top: 'middle',
                                      style: {
                                        fill: graphicColor,
                                        width: 45,
                                        overflow: 'break',
                                        text: sourceData.newest_date,
                                        font: 'bold 14px "Microsoft YaHei"',
                                      },
                                    },
                                  ],
                                },
                                {
                                  type: 'group',
                                  left: graphicLeftYaxis,
                                    width: vRectWidth,
                                    height: 20,
                                top: Math.round(graphicTopYaxis),
                                  children: [
                                  {
                                      type: 'image',
                                      z: 100,
                                      left: 0,
                                      top: 'middle',
                                      style: {
                                        fill: '#F5B800',
                                        stroke: graphicColor,
                                        lineWidth: 1,
                                        width: vRectWidth,
                                        height: 20,
                                        image: '/static/assets/images/rightArrow.png',
                                      },
                                    },
                                    {
                                      type: 'text',
                                      z: 100,
                                      right: 4,
                                      top: 4,
                                      style: {
                                        fill: graphicColor,
                                        width: vRectWidth,
                                        overflow: 'break',
                                          // eslint-disable-next-line max-len
                                        text: newestValueStr,
                                        font: 'bold 14px "Microsoft YaHei"',
                                      },
                                    },
                                  ],
                                },
                    );
            // option.graphic[option.graphic.length - 1].children[0].style.image = '/static/assets/images/rightArrow.png';
            myChart.setOption(option);
    }

     myChart.on('legendselectchanged', function (params) {
            const currentTime = new Date().getTime();
            const selectedLegends = params.selected;
            const clickedLegend = params.name;
            let allLegendNames = Object.keys(selectedLegends); // 获取所有 legend 名称
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
        if (fd.show_t_h_bi) {
            const chartDom = myChart.getDom();
            chartDom.addEventListener('mouseenter', () => {
                // console.log('鼠标进入图表区域');
                myChart.setOption({
                    graphic: [
                        {
                            ...option.graphic[0],
                            ignore: false,
                        },
                        ...option.graphic.slice(1),
                    ],
                });
            });
            chartDom.addEventListener('mouseleave', () => {
                // console.log('鼠标离开图表区域');
                myChart.setOption({
                    graphic: [
                        {
                            ...option.graphic[0],
                            ignore: true,
                        },
                        ...option.graphic.slice(1),
                    ],
                });
            });
        }

}

export default echartsStatLine2;
