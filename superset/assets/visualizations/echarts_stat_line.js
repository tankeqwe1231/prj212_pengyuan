import echarts from 'echarts';
import { yAxisLimit, dateFormatCustom, tooltipFormat, yAxisFormat } from '../javascripts/modules/utils';
import { ALL_COLOR_SCHEMES } from '../javascripts/modules/colors';

function echartsStatLine(slice, payload) {
    const div = d3.select(slice.selector);
    const fd = slice.formData;
    // d3.select(slice.selector).style('overflow', 'visible');

    const sliceId = slice.containerId + '_slice_' + fd.slice_id;
    const EditorId = 'ckeditor_' + slice.containerId;
    // const lineCount = fd.editor_content.split('<p>').length - 1;
    // const ckHeight = lineCount > 0 ? lineCount * 22 : 0;
    // const html = '<div id=' + sliceId + ' style="width:' + slice.width() + 'px;height:'
    //     + (slice.height() - ckHeight) + 'px;"></div><div id=' + EditorId + ' style="width:'
    //     + slice.width() + 'px;height:' + ckHeight + 'px;line-height:0.3;padding-top: 7px"></div>';
    const html = '<div id=' + sliceId + ' style="width:' + slice.width() + 'px;height:' + slice.height() + 'px;"></div>';
    div.html(html);

    d3.select('#' + EditorId).html(fd.editor_content);

    const myChart = echarts.init(document.getElementById(sliceId));
    const sourceData = payload.data;
    const data = sourceData.data;
    const customParams = sourceData.custom_params;
    const maxIndexName = sourceData.max_index;
    const minIndexName = sourceData.min_index;
    const customTooltipObj = { '最大值年份': maxIndexName, '最小值年份': minIndexName };
    const seriesColor = fd.series_color ? JSON.parse(fd.series_color) : {};
    const legendSelectedIndex = fd.legend_selected_index ? JSON.parse(fd.legend_selected_index) : [];
    const seriesLineWidthOrder = fd.series_line_width_order ? JSON.parse(fd.series_line_width_order) : {};
    const leftAxisMinValue = parseFloat(fd.left_axis_min_value);
    const leftAxisMaxValue = parseFloat(fd.left_axis_max_value);
    let chartGrid = { left: '14%', right: '4%', bottom: 25 };
    let lastClickTime = 0;
    let singleLegendClickTimeout = null;
    const DOUBLE_CLICK_DELAY = 400; // 双击间隔（毫秒）
    // 原始index:
    // 2008,2009,一直到  2018, "2008-2017最大值", "2008-2017最小值", "2008-2017均值", "高低差"(高低去掉了)

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
          top: 'middle',
          ignore: true,
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
                      formatter: '同比差',
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
                      formatter: '同比幅度',
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
                      formatter: '环比差',
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
                      formatter: '环比幅度',
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
    // 最大值 的索引
    const maxIndex = data.index.findIndex(v => v.includes('最大值'));
    function genSeries(index) {
      const seriesData = data.data[index];
      const seriesName = data.index[index];
      let retDict = {
                symbol: fd.chart_symbol ? fd.chart_symbol : 'none',
                symbolSize: fd.symbol_size ? fd.symbol_size : 4,
                showAllSymbol: !!fd.chart_symbol,
                type: 'line',
                data: seriesData,
                name: seriesName,
                itemStyle: { normal: { } },
                lineStyle: { normal: { width: 2, opacity: 0.8 } },
            };
        if (index === maxIndex - 1) {
            retDict = {
                symbol: fd.chart_symbol ? fd.chart_symbol : 'none',
                symbolSize: fd.symbol_size ? fd.symbol_size : 4,
                showAllSymbol: !!fd.chart_symbol,
                type: 'line',
                data: seriesData,
                name: seriesName,
                itemStyle: { normal: { color: '#2F4554' } },
                lineStyle: { normal: { width: fd.stroke_width, opacity: 0.8, type: fd.stroke_type } },
            };
        }
      if (index === maxIndex) {
         retDict = {
             symbol: 'none',
            type: 'line',
            data: seriesData,
            name: seriesName,
            areaStyle: { normal: { color: 'rgb(0,0,0)', opacity: 0.1, origin: 'start' } },
            itemStyle: { normal: { color: '#666666' } },
            lineStyle: { normal: { opacity: 0 } },
        };
      }
      if (index === maxIndex + 1) {
         retDict = {
             symbol: 'none',
            type: 'line',
            data: seriesData,
            name: seriesName,
            areaStyle: { normal: { color: 'rgb(255,255,255)', opacity: 1, origin: 'start' } },
            itemStyle: { normal: { color: '#666666' } },
            lineStyle: { normal: { opacity: 0 } },
        };
      }
      if (index === maxIndex + 2) {
         retDict = {
             symbol: 'none',
            type: 'line',
            data: seriesData,
            name: seriesName,
            itemStyle: { normal: { color: '#666666' } },
            lineStyle: { normal: { type: 'dashed', opacity: 0.5 } },
        };
      }
      retDict.connectNulls = true;
      return retDict;
    }

    const legendSelected = {};
    data.index.forEach((v, ix) => {
        if (ix < maxIndex - 2) {
            legendSelected[data.index[ix]] = false;
        }
        });

    const option = {
        animation: false,
    backgroundColor: 'rgb(255, 255, 255)',
    title: {
        text: sourceData.newest_value.length > 0 ? sourceData.newest_value : '',
        subtext: sourceData.newest_date.length > 0 ? sourceData.newest_date : '',
        show: false,
    },
    tooltip: {
        trigger: 'axis',
        appendToBody: true,
        className: 'echarts-tooltip',
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
            formatDateX: fd.x_axis_time_format, customObj: customTooltipObj, visType: fd.viz_type }),
    },
    legend: {
        data: data.index,
        orient: 'horizontal',
        x: 'center',
        y: 'top',
        selected: legendSelected,
    },
    grid: chartGrid,
    xAxis: {
        type: 'category',
        position: 'bottom',
        data: data.columns,
        z: 99,
        axisTick: {
            alignWithLabel: true,
        },
        boundaryGap: false,
        axisLabel: {
                formatter: fd.x_axis_time_format ? dateFormatCustom(fd.x_axis_time_format) : null,
                showMinLabel: fd.x_axis_showminmax,
                showMaxLabel: fd.x_axis_showminmax,
            },
    },
    yAxis: {
        type: 'value',
        min: yAxisLimit(leftAxisMinValue, 'min'),
        max: yAxisLimit(leftAxisMaxValue, 'max'),
        splitLine: { lineStyle: { opacity: 0.5 } },
        z: 99,
        axisLabel: { formatter: yAxisFormat(fd.y_axis_format) },
    },
    series: data.index.map((v, ix) => genSeries(ix)),
    graphic,
};


     

    if (fd.color_scheme) {
        let colorSchmesLength = 0;
        const colorScheme = ALL_COLOR_SCHEMES[fd.color_scheme];
        // // 复制colorScheme这个对象
        // colorScheme = JSON.parse(JSON.stringify(colorScheme));
        // if (fd.color_scheme === 'bnbColors') {
        //     colorScheme.shift();
        // }

        for (let i = maxIndex - 1; i >= 0; i--) {
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
          if (seriesLineWidthOrder.hasOwnProperty(maxIndex - index)) {
              option.series[index].lineStyle.normal.width = seriesLineWidthOrder[maxIndex - index];
          }
      });
  }

  if (legendSelectedIndex.length) {
      option.series.forEach((value, index) => {
        if (index < maxIndex - 2) {
          if (legendSelectedIndex.includes(maxIndex - index)) {
              option.legend.selected[value.name] = true;
              } else {
                  option.legend.selected[value.name] = false;
              }
          }
      });
  }
  // 使用刚指定的配置项和数据显示图表。
  myChart.setOption(option);

       if (fd.show_lastvalue && data.columns.indexOf(sourceData.newest_date) >= 0) {
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
          const graphicColor = myChart.getOption().series[maxIndex - 1].itemStyle.color;
            option.graphic.push(
                                {
                                  type: 'group',
                                  left: Math.round(graphicLeftXaxis),
                                // bottom: -2,
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

                    // option.graphic[1].children[0].style.image = '/static/assets/images/rightArrow.png';
            myChart.setOption(option);
    }

       myChart.on('legendselectchanged', function (params) {
            const currentTime = new Date().getTime();
            const selectedLegends = params.selected;
            const clickedLegend = params.name;
            const allLegendNames = Object.keys(selectedLegends); // 获取所有 legend 名称
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


    // createCkeditor(slice, EditorId, lineCount, ckHeight);
}

export default echartsStatLine;
