import echarts from 'echarts';
import { yAxisFormat, tooltipFormatMultipleY, yAxisLimit, dateFormatCustom, d3FormatPreset } from '../javascripts/modules/utils';
import { ALL_COLOR_SCHEMES } from '../javascripts/modules/colors';

function echartsCombine(slice, payload) {
    const div = d3.select(slice.selector);
    const fd = slice.formData;
    const sliceId = slice.containerId + '_slice_' + fd.slice_id;
    const html = '<div id=' + sliceId + ' style="width:' + slice.width() + 'px;height:' + slice.height() + 'px;"></div>';
    div.html(html); // reset

    const myChart = echarts.init(document.getElementById(sliceId));

    const sourceData = payload.data;
    const dfData = Object.assign({}, sourceData.data);
    const columnsValueRepresentByHistogram = sourceData.columns_value_represent_by_histogram !== '' ? sourceData.columns_value_represent_by_histogram.split('|') : [];
    const columnsValueRepresentByArea = sourceData.columns_value_represent_by_area !== '' ? sourceData.columns_value_represent_by_area.split('|') : [];
    const leftAxisUseReverseOrder = sourceData.left_axis_use_reverse_order;
    const seriesColor = fd.series_color && fd.series_color !== '' ? JSON.parse(fd.series_color) : {};
    const aliasLabels = fd.alias_labels && fd.alias_labels !== '' ? JSON.parse(fd.alias_labels) : {};
    const areaList = fd.area_list ? JSON.parse(fd.area_list) : [];
    const leftAxisMinValue = parseFloat(fd.left_axis_min_value);
    const leftAxisMaxValue = parseFloat(fd.left_axis_max_value);
    const rightAxisMinMaxValue = fd.rightYaxisMinMax !== '' ? JSON.parse(fd.rightYaxisMinMax) : {};
    const showBrush = fd.show_brush !== 'no';
    const brushExtentStart = fd.brushExtentStart !== '' ? Math.floor(fd.brushExtentStart * 100) : 50;
    const colors = ALL_COLOR_SCHEMES.lele1;
    const chartGrid = fd.chartGrid ? JSON.parse(fd.chartGrid) : {};
    const rightMulYaxisFormat = fd.rightMulYaxisFormat ? JSON.parse(fd.rightMulYaxisFormat) : {};

    function genSeries(index) {
        const chartType = columnsValueRepresentByHistogram.indexOf(dfData.index[index]) >= 0 ? 'bar' : 'line';
      const retDict = {
        type: chartType,
        data: dfData.data[index],
        name: aliasLabels.hasOwnProperty(dfData.index[index])
            ? aliasLabels[dfData.index[index]] : dfData.index[index],
        yAxisIndex: index,
        itemStyle: {
                color: colors[index],
            },
      };
      if (retDict.type === 'line') {
          retDict.connectNulls = slice.formData.connect_nulls;
      }
      if (areaList.indexOf(dfData.index[index]) >= 0) {
          retDict.areaStyle = {};
      }
      if (columnsValueRepresentByArea.indexOf(dfData.index[index]) >= 0) {
          retDict.areaStyle = {};
          retDict.areaStyle.opacity = fd.opacity;
          retDict.stack = '总量';
      }
      if (chartType === 'bar') {
          retDict.itemStyle.opacity = fd.opacity;
          if (fd.show_bar_value) {
              retDict.label = { show: true,
                position: 'top',
                formatter: params =>
                  // console.log(params);
                fd.lable_format ? d3FormatPreset('.1s')(params.value) : params.value,
              };
          }
          if (fd.barGap) {
              retDict.barGap = fd.barGap;
          }
          if (fd.barCategoryGap) {
              retDict.barCategoryGap = fd.barCategoryGap;
          }
      }
      if (seriesColor.hasOwnProperty(dfData.index[index])) {
          retDict.itemStyle.color = seriesColor[dfData.index[index]];
      }
      return retDict;
    }

    function genyAxis(index) {
        const retDict = {
            type: 'value',
            axisLabel: {},
            min: null,
            max: null,
            axisLine: {
                show: true,
                lineStyle: {
                    color: colors[index],
                },
            },
            splitLine: {
                lineStyle: {
                    opacity: 0.2,
                },
            },
        };
        if (index === 0) {
            retDict.position = 'left';
            retDict.min = fd.show_y_min_max_strict && !isNaN(leftAxisMinValue) ? leftAxisMinValue : yAxisLimit(leftAxisMinValue, 'min');
            retDict.max = fd.show_y_min_max_strict && !isNaN(leftAxisMaxValue) ? leftAxisMaxValue : yAxisLimit(leftAxisMaxValue, 'max');
            retDict.inverse = leftAxisUseReverseOrder;
        } else {
            retDict.position = 'right';
            retDict.min = yAxisLimit(NaN, 'min');
            retDict.max = yAxisLimit(NaN, 'max');
            const rightAxisMinMaxValueIndex = rightAxisMinMaxValue[index];
            if (rightAxisMinMaxValueIndex) {
                if (rightAxisMinMaxValueIndex.min) {
                    retDict.min = fd.show_y_min_max_strict ? rightAxisMinMaxValueIndex.min : yAxisLimit(rightAxisMinMaxValueIndex.min, 'min');
                }
                if (rightAxisMinMaxValueIndex.max) {
                    retDict.max = fd.show_y_min_max_strict ? rightAxisMinMaxValueIndex.max : yAxisLimit(rightAxisMinMaxValueIndex.max, 'max');
                }
            }
        }
        if (index > 1) {
            retDict.offset = (index - 1) * 60;
        }
        Object.keys(seriesColor).forEach((v) => {
            if (index === dfData.index.indexOf(v)) {
                retDict.axisLine.lineStyle.color = seriesColor[v];
            }
        });

        return retDict;
    }

    let xAxisData = dfData.columns;
    if (fd.columns.length > 1) {
        xAxisData = xAxisData.map(obj => obj.join('\n'));
    }
    const option = {
        series: [...Array(dfData.index.length).keys()].map(x => genSeries(x)),
        xAxis: [{
            type: 'category',
            position: 'bottom',
            data: xAxisData,
            axisLabel: { showMinLabel: fd.x_axis_showminmax ? fd.x_axis_showminmax : null,
                showMaxLabel: fd.x_axis_showminmax ? fd.x_axis_showminmax : null },
            boundaryGap: fd.boundaryGap,
        }],
        yAxis: [...Array(dfData.index.length).keys()].map(x => genyAxis(x)),
        legend: {
            // data: dfData.index,
            orient: 'horizontal',
            x: 'center',
            y: 'top',
        },
        grid: Object.assign({ bottom: fd.columns.length > 1 ? 70 : 60,
        right: dfData.index.length === 1 ? '10%' : (dfData.index.length - 1) * 60 }, chartGrid),
        dataZoom: [
        {
            show: showBrush,
            realtime: true,
            start: brushExtentStart,
        },
    ],
        tooltip: {
            trigger: 'axis',
        },
    };

    if (fd.y_axis_format_left) {
        option.yAxis[0].axisLabel.formatter = yAxisFormat(fd.y_axis_format_left);
    }
    if (fd.x_axis_format) {
        option.xAxis[0].axisLabel.formatter = dateFormatCustom(fd.x_axis_format);
    }
    if (fd.y_axis_format_right && option.yAxis.length > 1) {
        option.yAxis[1].axisLabel.formatter = yAxisFormat(fd.y_axis_format_right);
    }
    if (fd.y_axis_format_right2 && option.yAxis.length > 2) {
        option.yAxis[2].axisLabel.formatter = yAxisFormat(fd.y_axis_format_right2);
    }
    if (fd.y_axis_format_right3 && option.yAxis.length > 3) {
        option.yAxis[3].axisLabel.formatter = yAxisFormat(fd.y_axis_format_right3);
    }

    const formatStringArr = [fd.y_axis_format_left, fd.y_axis_format_right,
            fd.y_axis_format_right2, fd.y_axis_format_right3];
    dfData.index.forEach(function (element, index) {
        if (index > 3) {
            formatStringArr.push('');
        }
        const rightFormatStr = rightMulYaxisFormat[index];
        if (rightFormatStr) {
            formatStringArr[index] = rightFormatStr;
            option.yAxis[index].axisLabel.formatter = yAxisFormat(rightFormatStr);
        }
    });
    option.tooltip.formatter = tooltipFormatMultipleY(
        { formatStringArr, formatDateX: fd.x_axis_format });

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
          const endZoom = myChart.getModel().option.dataZoom[0].endValue;
          const boundaryGapLength = fd.boundaryGap ? 10 : 0;
          if (datazoomChange) {
               option.dataZoom[0].start = evt.start;
                option.dataZoom[0].end = evt.end;
          }

          const startDate = myChart.getModel().option.xAxis[0].data[startZoom];
          const endDate = myChart.getModel().option.xAxis[0].data[endZoom];
          myChart.getOption().series.forEach((currentSeries) => {
              let newestValue = currentSeries.data[currentSeries.data.length - 1];
              // eslint-disable-next-line consistent-return
              for (let i = currentSeries.data.length - 1; i >= 0; i--) {
                  if (currentSeries.data[i]) {
                      newestValue = currentSeries.data[i];
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
              startDate) - vRectWidth - 3 - boundaryGapLength;
              let graphicRightYaxis = myChart.convertToPixel({ xAxisIndex: 0 },
              endDate) + boundaryGapLength + 3;

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
                    groupDict.children[0].style.image = '/static/assets/images/rightArrow.png';
                } else {
                    graphicRightYaxis += (currentSeries.yAxisIndex - 1) * 60;
                    groupDict.left = graphicRightYaxis;
                    groupDict.children[1].left = 4;
                    groupDict.children[0].style.image = '/static/assets/images/leftArrow.png';
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


}

export default echartsCombine;
