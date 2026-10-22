import { renderReact } from '../javascripts/modules/reactRoot';
import React, { useLayoutEffect, useRef, useState } from 'react';
import propTypes from 'prop-types';
import d3 from 'd3';
import Mustache from 'mustache';
import Highcharts from 'highcharts';
import $ from 'jquery';
import MetricOption from '../javascripts/components/MetricOption';
import { d3format, d3TimeFormatPresetLocal } from '../javascripts/modules/utils';
import InfoTooltipWithTrigger from '../javascripts/components/InfoTooltipWithTrigger';
import './time_table.css';
import { Popover, OverlayTrigger } from 'react-bootstrap';
import echarts from 'echarts';
import AppTable from '../javascripts/components/AppTable/AppTable';


const ACCESSIBLE_COLOR_BOUNDS = ['#008000', '#ca0020'];
const dataUiColType = ['spark', 'bar', 'volatility_line'];
const stickyHeaderStyle = {
  backgroundColor: '#fff',
  position: 'sticky',
  top: 0,
  zIndex: 3,
};
const isMobile = navigator.userAgent.match(/(phone|pad|pod|iPhone|iPod|ios|iPad|Android|Mobile|BlackBerry|IEMobile|MQQBrowser|JUC|Fennec|wOSBrowser|BrowserNG|WebOS|Symbian|Windows Phone)/i);
const fontSize = isMobile ? null : '0.88vw';
function FormattedNumber({ num, format }) {
  const isRealNumber = typeof num === 'number' && !Number.isNaN(num);
  if (isRealNumber) {
    const displayValue = format ? d3format(format, num) : num;
    return <span title={num}>{displayValue}</span>;
  }
  return <span>-</span>;
}


FormattedNumber.propTypes = {
  num: propTypes.number,
  format: propTypes.string,
};

const popChartOption = {
    title: {
        text: '折线图堆叠',
        x: 'center',
        y: 'top',
        textStyle: {
            fontSize: 15,
        },
    },
    xAxis: {
        type: 'category',
        data: [],
    },
    yAxis: {
        type: 'value',
    },
    tooltip: {
        trigger: 'axis',
    },
    series: [{
        data: [],
        type: 'line',
        connectNulls: true,
    }],
    dataZoom: [
        {
            show: true,
            realtime: true,
            showDetail: false,
        },
    ],
    grid: { top: 30 },
};


let popChart = '';
const popoverId = 'pop-timetable';
const popoverContentId = 'pop-content-timetable';
const popoverChart = (
  <Popover id={popoverId}>
    <Popover.Body><div id={popoverContentId} style={{ width: 400, height: 300 }} /></Popover.Body>
  </Popover>
);

const renderTimeTableCell = info => info.row.original.cells[info.column.id].display;
const renderTimeTableMetric = info => info.row.original.metric;

export function TimeTable({
  aliasLabels,
  chartDescription,
  columnCollection,
  defaultSort,
  drawGraph,
  fontWeightClass,
  metricCaption,
  sliceId,
  tableData,
  topColumns,
}) {
  const normalizedDefaultSort = defaultSort ? [{
    id: defaultSort.column,
    desc: String(defaultSort.direction).toLowerCase() === 'desc',
  }] : [];
  const defaultSortKey = normalizedDefaultSort.length
    ? `${normalizedDefaultSort[0].id}:${normalizedDefaultSort[0].desc}` : '';
  const [sorting, setSorting] = useState(normalizedDefaultSort);
  const previousDefaultSortRef = useRef(defaultSortKey);
  const containerRef = useRef(null);
  const headerRefs = useRef({});
  const topHeaderRefs = useRef([]);
  const topMetricHeaderRef = useRef(null);
  const topTableRef = useRef(null);

  useLayoutEffect(() => {
    if (previousDefaultSortRef.current !== defaultSortKey) {
      previousDefaultSortRef.current = defaultSortKey;
      setSorting(normalizedDefaultSort);
    }
  }, [defaultSortKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = tableData.length ? tableData[0].map((row, rowIndex) => ({
    cells: tableData.reduce((result, currentTable, tableIndex) => {
      columnCollection.forEach((column) => {
        result[column.key + tableIndex] = currentTable[rowIndex][column.key]; // eslint-disable-line no-param-reassign
      });
      return result;
    }, {}),
    id: String(rowIndex),
    metric: typeof row.metric === 'string' && aliasLabels.hasOwnProperty(row.metric)
      ? aliasLabels[row.metric] : row.metric,
  })) : [];
  const columns = [{
    accessorKey: 'metric',
    cell: renderTimeTableMetric,
    header: metricCaption,
    id: 'metric',
  }];
  tableData.forEach((currentTable, tableIndex) => {
    columnCollection.forEach((column, columnIndex) => {
      const columnId = column.key + tableIndex;
      columns.push({
        accessorFn: row => row.cells[columnId].data,
        cell: renderTimeTableCell,
        enableSorting: !dataUiColType.includes(column.colType),
        header: <React.Fragment>
          {column.label} {column.tooltip && (
            <InfoTooltipWithTrigger
              tooltip={column.tooltip}
              label={`tt-col-${tableIndex}-${columnIndex}`}
              placement="top"
            />
          )}
        </React.Fragment>,
        id: columnId,
        meta: {
          style: { textAlign: 'right' },
        },
      });
    });
  });

  useLayoutEffect(() => {
    columnCollection.forEach((column) => {
      tableData.forEach((currentTable, tableIndex) => {
        const header = headerRefs.current[column.key + tableIndex];
        if (header && column.width) {
          header.style.width = typeof column.width === 'number'
            ? `${column.width}px` : column.width;
        }
      });
    });
    const bottomTable = containerRef.current
      ? containerRef.current.querySelector(`.second-timetb${sliceId}`) : null;
    if (topTableRef.current && bottomTable) {
      topTableRef.current.style.width = `${bottomTable.offsetWidth}px`;
    }
    if (topMetricHeaderRef.current && headerRefs.current.metric) {
      topMetricHeaderRef.current.style.width = `${headerRefs.current.metric.offsetWidth}px`;
    }
    topColumns.forEach((topName, tableIndex) => {
      const topHeader = topHeaderRefs.current[tableIndex];
      if (topHeader) {
        const width = columnCollection.reduce((total, column) => {
          const header = headerRefs.current[column.key + tableIndex];
          return total + (header ? header.offsetWidth : 0);
        }, 0);
        topHeader.style.width = `${width}px`;
      }
    });
    drawGraph();
  }, [columnCollection, drawGraph, sliceId, sorting, tableData, topColumns]);

  return <div ref={containerRef}>
    {topColumns.length ? (
      <table className="timetable" id={`top-timetb${sliceId}`} ref={topTableRef} style={{ fontSize }}>
        <thead><tr style={{ borderBottom: '1px solid #ddd' }}>
          <th id={`top_timeth${sliceId}`} ref={topMetricHeaderRef} />
          {topColumns.map((columnName, tableIndex) => (
            <th
              colSpan={columnCollection.length}
              id={`top_timeth${sliceId}${columnName}`}
              key={`${columnName}-${tableIndex}`}
              ref={(element) => { topHeaderRefs.current[tableIndex] = element; }}
              style={{
                borderRight: '2px solid #ddd',
                paddingBottom: '8px',
                paddingTop: '8px',
                textAlign: 'center',
              }}
            >
              {columnName}
            </th>
          ))}
        </tr></thead>
      </table>
    ) : null}
    <AppTable
      className={`table table-no-hover timetable second-timetb${sliceId}`}
      columns={columns}
      data={rows}
      getCellProps={cell => ({
        className: fontWeightClass,
        style: {
          ...(cell.column.id === 'metric' ? {} : { textAlign: 'right' }),
          ...((cell.row.original.cells[cell.column.id]
            && cell.row.original.cells[cell.column.id].style) || {}),
        },
      })}
      getHeaderProps={header => ({
        id: header.column.id === 'metric' ? `second_timeth${sliceId}` : undefined,
        ref: (element) => { headerRefs.current[header.column.id] = element; },
        style: {
          ...stickyHeaderStyle,
          ...(header.column.columnDef.meta && header.column.columnDef.meta.style),
        },
      })}
      getRowId={row => row.id}
      onSortingChange={setSorting}
      sorting={sorting}
      style={{ fontSize }}
    />
    {chartDescription ? (
      <div className="time-table-description">{chartDescription}</div>
    ) : null}
  </div>;
}

TimeTable.propTypes = {
  aliasLabels: propTypes.object.isRequired,
  chartDescription: propTypes.string,
  columnCollection: propTypes.array.isRequired,
  defaultSort: propTypes.oneOfType([propTypes.bool, propTypes.object]).isRequired,
  drawGraph: propTypes.func.isRequired,
  fontWeightClass: propTypes.string,
  metricCaption: propTypes.string,
  sliceId: propTypes.oneOfType([propTypes.number, propTypes.string]).isRequired,
  tableData: propTypes.array.isRequired,
  topColumns: propTypes.array.isRequired,
};


function viz(slice, payload) {
  slice.container.css('height', slice.height());
  const records = payload.data.records;
  // const fd = payload.form_data;
  const fd = slice.formData;
  let popChartData = '';
  const postUrl = '/superset/explore_json_timetable/' + fd.slice_id;

    const showPopoverChart = (event, metric) => {
        console.log('showPopoverChart 触发', metric);
        if (!popChartData) {
            console.log('popChartData未存在, 开始请求ajax');
            $.ajax({
                url: postUrl,
                type: 'POST',
                data: {},
                dataType: 'json',
                success: (data) => {
                    console.log('ajax success 开始画图');
                    popChartData = data;
                    updateChart(metric);
                    console.log(data);
                },
                error: (err) => {
                    console.error(err);
                    notify.error('加载失败');
                },
            });
        } else {
            console.log('popChartData已存在，不请求ajax');
        }

    };

    const PopEntered = (metric) => {
        console.log('PopEntered 触发', metric);
        if (popChartData) {
            setTimeout(() => {
                console.log('PopEntered 进来画图');
                updateChart(metric);
            }, 50);

        } else {
            console.log('popChartData is null');
        }

    };

    const updateChart = (metric) => {
        console.log('updateChart 触发', metric);
        popChart = echarts.init(document.getElementById(popoverContentId));
        popChartOption.title.text = metric;
        popChartOption.xAxis.data = popChartData.columns;
        popChartOption.series[0].data = popChartData.data[popChartData.index.indexOf(metric)];
        console.log(popChartOption);
        popChart.setOption(popChartOption);
    };

  // const data = Object.keys(records).sort().map(iso => ({ ...records[iso], iso }));
  // const reversedData = [...data].reverse();
  const data = records.map(rd => Object.keys(rd).sort().map(iso => ({ ...rd[iso], iso })));
  // data = data[0];
  const reversedData = data.map(item => [...item].reverse());
  const aliasLabels = fd.alias_labels ? JSON.parse(fd.alias_labels) : {};
  const metricMap = {};
  slice.datasource.metrics.forEach((m) => {
    metricMap[m.metric_name] = m;
  });

  let defaultSort = false;
  if (fd.index_order === '' && fd.table_column_num !== '' && fd.order_type !== ''
  && fd.table_column_num !== null && fd.order_type !== null) {
      let columnCollectionPosition = fd.table_column_num;
      let tableIndex = 0;
      if (fd.table_column_num + 1 > fd.column_collection.length) {
         columnCollectionPosition = (fd.table_column_num + 1) % (fd.column_collection.length);
         tableIndex = Math.floor((fd.table_column_num + 1) / (fd.column_collection.length));
         tableIndex = columnCollectionPosition ? tableIndex : tableIndex - 1;
         columnCollectionPosition = columnCollectionPosition ?
             columnCollectionPosition - 1 : fd.column_collection.length - 1;
      }
      defaultSort = { column: fd.column_collection[columnCollectionPosition].key + tableIndex,
          direction: fd.order_type };
  }

  function DrawBarChart({ c, topix, mix }) {
    let divId = c.key + topix + mix + fd.slice_id;
    if (c.colType === 'spark' || c.colType === 'volatility_line') {
        divId = c.colType + divId;
    }
    const divObj = (<div
      id={divId}
      style={{ width: parseInt(c.width, 10) || 300,
                height: parseInt(c.height, 10) || 50 }}
    />);
  return divObj;
}

DrawBarChart.propTypes = {
    c: propTypes.object,
    topix: propTypes.number,
    mix: propTypes.number,
};


  let metrics;
  // const defaultSort = false;
  if (payload.data.is_group_by) {
    metrics = [].concat(payload.data.columns);
  } else {
    metrics = [].concat(fd.metrics);
  }
    const show_modal_chart = fd.show_modal_chart;

    const numberFormatRowDict = {};
    if (fd.number_format_row) {
        const numberFormatrow = JSON.parse(fd.number_format_row);
        Object.keys(numberFormatrow).forEach((objKey) => {
            objKey.split('|').forEach((v) => {
                numberFormatRowDict[v] = numberFormatrow[objKey];
            });
        });
    }

  const tableData = data.map((item, itemIndex) => metrics.map((metric, mix) => {
          let leftCell;
          const context = { ...fd, metric };
          const url = fd.url ? Mustache.render(fd.url, context) : null;
          if (!payload.data.is_group_by) {
              leftCell = (
                <MetricOption
                  metric={metricMap[metric]}
                  // metricOrigin={metric}
                  url={url}
                  showFormula={false}
                  openInNewWindow
                  show_modal_chart
                  showPopoverChart={showPopoverChart}
                  popoverChart
                />
              );
          } else {
              // leftCell = url ? (<a href={url} target="_blank" rel="noopener noreferrer">
              //   {aliasLabels.hasOwnProperty(metric) ? aliasLabels[metric] : metric}
              // </a>) : metric;
              leftCell = (<span>
                {aliasLabels.hasOwnProperty(metric) ? aliasLabels[metric] : metric}
              </span>);

              if (show_modal_chart) {
                  // leftCell = <span rel="noopener noreferrer" style={{color: "#00A699", cursor: "pointer"}}
                  //                  onClick={event => {showChartForTimeTable(event, fd.slice_id, metric)}}>
                  //   {aliasLabels.hasOwnProperty(metric) ? aliasLabels[metric] : metric}</span>
                  leftCell = (<OverlayTrigger
                    trigger="click"
                    placement="right"
                    overlay={popoverChart}
                    onEntered={() => PopEntered(metric)}
                    rootClose
                  >
                    <span
                      className="metric-hover"
                      style={{ color: '#05132b', cursor: 'pointer' }}
                      onClick={(event) => { showPopoverChart(event, metric); }}
                    >
                      {aliasLabels.hasOwnProperty(metric) ? aliasLabels[metric] : metric}</span>
                  </OverlayTrigger>);
              }

          }
          const row = { metric: leftCell };
          fd.column_collection.forEach((column, ix, arr) => {
              if (dataUiColType.includes(column.colType)) {
                  let sparkData;
                  if (column.colType === 'spark' || column.colType === 'bar') {
                      if (!column.timeRatio) {
                          sparkData = item.map(d => d[metric]);
                      } else {
                          // Period ratio sparkline
                          sparkData = [];
                          for (let i = column.timeRatio; i < item.length; i++) {
                              const prevData = item[i - column.timeRatio][metric];
                              if (prevData && prevData !== 0) {
                                  sparkData.push(item[i][metric] / prevData);
                              } else {
                                  sparkData.push(null);
                              }
                          }
                      }
                  } else if (column.colType === 'volatility_line') {
                      sparkData = payload.data.volatility_list[itemIndex][metric + column.key];
                  }
                  // const formatDate = d3TimeFormatPresetLocal(column.dateFormat);
                  row[column.key] = {
                      // data: sparkData[sparkData.length - 1],
                      dataShow: sparkData,
                      display: (<DrawBarChart c={column} topix={itemIndex} mix={mix} />),
                  };
              } else {
                  const recent = reversedData[itemIndex][0][metric];
                  let v;
                  let errorMsg;
                  if (column.colType === 'time') {
                      // Time lag ratio
                      const timeLag = parseInt(column.timeLag, 10);
                      const totalLag = Object.keys(reversedData[itemIndex]).length;
                      if (timeLag > totalLag) {
                          errorMsg = `The time lag set at ${timeLag} exceeds the length of data at ${reversedData[itemIndex].length}. No data available.`;
                      } else {
                          v = reversedData[itemIndex][timeLag][metric];
                          if (column.lableisdate) {
                              arr[ix].label = d3TimeFormatPresetLocal(column.lableDateFormat)(reversedData[itemIndex][timeLag].iso);
                          }
                      }
                      if (column.comparisonType && column.comparisonType !== 'value') {
                          if (recent === null || v === null) {
                              v = NaN;
                          } else if (column.comparisonType === 'diff') {
                              v = recent - v;
                          } else {
                              const ratio = recent / v;
                              if (!v || isNaN(ratio)) {
                                  v = NaN;
                              } else if (column.comparisonType === 'perc') {
                                  v = ratio;
                              } else if (column.comparisonType === 'perc_change') {
                                  v = (recent - v) > 0 ? Math.abs(ratio - 1) : ratio - 1;
                              } else {
                                  v = NaN;
                              }
                          }
                      }

                  } else if (column.colType === 'contrib') {
                      // contribution to column total
                      v = recent / Object.keys(reversedData[itemIndex][0])
                              .map(k => k !== 'iso' ? reversedData[itemIndex][0][k] : null)
                              .reduce((a, b) => a + b);
                  } else if (column.colType === 'avg') {
                      // Average over the last {timeLag}
                      v = reversedData[itemIndex]
                              .map((k, i) => i < column.timeLag ? k[metric] : 0)
                              .reduce((a, b) => a + b) / column.timeLag;
                  } else if (column.colType === 'sum') {
                      // Sum over the last {timeLag}
                      v = reversedData[itemIndex]
                          .map((k, i) => i < column.timeLag ? k[metric] : 0)
                          .reduce((a, b) => a + b);
                  } else if (column.colType === 'max') {
                      v = reversedData[itemIndex]
                          .filter((k, i) => i < column.timeLag)
                          .map(k => k[metric])
                          .reduce((a, b) => a > b ? a : b);
                  } else if (column.colType === 'min') {
                      v = reversedData[itemIndex]
                          .filter((k, i) => i < column.timeLag)
                          .map(k => k[metric])
                          .reduce((a, b) => a > b ? b : a);
                  } else if (column.colType === 'quantile') {
                      // const minV = reversedData[itemIndex]
                      // .filter((k, i) => i < column.timeLag)
                      // .map(k => k[metric])
                      // .reduce((a, b) => a > b ? b : a);
                      const originArr = reversedData[itemIndex]
                          .filter((k, i) => i < column.timeLag)
                          .map(k => k[metric]).filter(itemobj => itemobj);
                      const smallerArr = originArr.filter(itemobj =>
                          (itemobj && itemobj < originArr[0]));
                      v = smallerArr.length / originArr.length;
                  } else if (column.colType === 'quantile_change') {
                      const originArr = reversedData[itemIndex]
                          .filter((k, i) => i < column.timeLag)
                          .map(k => k[metric]);
                      const smallerThanNowArr = originArr.filter(itemobj =>
                          (itemobj && itemobj < originArr[0]));
                      const smallerThanChangeLagArr = originArr.filter(itemobj =>
                          (itemobj && itemobj < originArr[Math.abs(column.changeLag)]));
                      v = (smallerThanNowArr.length - smallerThanChangeLagArr.length) /
                          originArr.length;
                  } else if (column.colType === 'period_position') {
                      const maxPeriodPosition = reversedData[itemIndex]
                          .filter((k, i) => i < column.timeLag)
                          .map(k => k[metric])
                          .reduce((a, b) => a > b ? a : b);
                      const minPeriodPosition = reversedData[itemIndex]
                          .filter((k, i) => i < column.timeLag)
                          .map(k => k[metric])
                          .reduce((a, b) => a > b ? b : a);
                      const originArr = reversedData[itemIndex]
                          .filter((k, i) => i < column.timeLag)
                          .map(k => k[metric]);
                      v = (originArr[0] - minPeriodPosition) /
                          (maxPeriodPosition - minPeriodPosition);

                  } else if (column.colType === 'position_change') {
                      const maxPeriodPosition = reversedData[itemIndex]
                          .filter((k, i) => i < column.timeLag)
                          .map(k => k[metric])
                          .reduce((a, b) => a > b ? a : b);
                      const minPeriodPosition = reversedData[itemIndex]
                          .filter((k, i) => i < column.timeLag)
                          .map(k => k[metric])
                          .reduce((a, b) => a > b ? b : a);
                      const originArr = reversedData[itemIndex]
                          .filter((k, i) => i < column.timeLag)
                          .map(k => k[metric]);
                      v = (originArr[0] - originArr[Math.abs(column.changeLag)]) /
                          (maxPeriodPosition - minPeriodPosition);

                  } else if (column.colType === 'period_volatility') {
                      v = payload.data.volatility_list[itemIndex][metric + column.key];
                  } else if (column.colType === 'period_volatility_quantile') {
                      const originArr = payload.data
                          .volatility_list[itemIndex][metric + column.key];
                      const smallerArr = originArr.filter(itemobj =>
                          (itemobj && itemobj < originArr[0]));
                      v = smallerArr.length / originArr.length;
                  } else if (column.colType === 'period_volatility_quantile_change') {
                      const originArr = payload.data
                          .volatility_list[itemIndex][metric + column.key];
                      const smallerThanNowArr = originArr.filter(itemobj =>
                          (itemobj && itemobj < originArr[0]));
                      const smallerThanChangeLagArr = originArr.filter(itemobj =>
                          (itemobj && itemobj < originArr[Math.abs(column.changeLag)]));
                      v = (smallerThanNowArr.length - smallerThanChangeLagArr.length) /
                          originArr.length;
                  }
                  let color;
                  if (column.bounds && column.bounds[0] !== null && column.bounds[1] !== null) {
                      const scaler = d3.scale.linear()
                          .domain([
                              column.bounds[0],
                              column.bounds[0] + ((column.bounds[1] - column.bounds[0]) / 2),
                              column.bounds[1],
                          ])
                          .range([ACCESSIBLE_COLOR_BOUNDS[0], 'grey', ACCESSIBLE_COLOR_BOUNDS[1]]);
                      color = scaler(v);
                  } else if (column.bounds && column.bounds[0] !== null) {
                      // eslint-disable-next-line max-len
                      color = v >= column.bounds[0] ? ACCESSIBLE_COLOR_BOUNDS[1] : ACCESSIBLE_COLOR_BOUNDS[0];
                  } else if (column.bounds && column.bounds[1] !== null) {
                      // eslint-disable-next-line max-len
                      color = v < column.bounds[1] ? ACCESSIBLE_COLOR_BOUNDS[1] : ACCESSIBLE_COLOR_BOUNDS[0];
                  }
                  row[column.key] = {
                      data: v,
                      display: errorMsg ?
                          (<div>{errorMsg}</div>) :
                          (<div style={{ color }}>
                            <FormattedNumber
                              num={v}
                              format={numberFormatRowDict.hasOwnProperty(mix + 1)
                                ? numberFormatRowDict[mix + 1] : column.d3format}
                            />
                          </div>),
                      style: color && {
                          // boxShadow: `inset 0px -2.5px 0px 0px ${color}`,
                          borderBottom: `2px solid ${color}`,
                          borderRight: '2px solid #fff',
                      },
                  };
              }
          });
          return row;
      }));

  const drawGraph = function () {
      tableData.forEach((td, ix) => {
          td.forEach((row, rownum) => {
              fd.column_collection.forEach((c) => {
                  let divId = c.key + ix + rownum + fd.slice_id;
                  const formatDate = c.dateFormat ? d3TimeFormatPresetLocal(c.dateFormat) : v => v;
            if (c.colType === 'bar') {
                Highcharts.chart(divId, {
                    chart: {
                        type: 'column',
                        // width: 200,
                        // height: 35,
                        margin: [1, 0, 1, 0],
                        style: {
                        overflow: 'visible',
                        },
                        // small optimalization, saves 1-2 ms each sparkline
                        skipClone: true,
                    },
                    title: {
                    text: '',
                    },
                    exporting: { enabled: false },
                    tooltip: {
                        formatter() {
                            return formatDate(data[ix][this.x].iso) + '<br>' + d3format(c.d3format, this.point.y);
                        },
                        padding: 3,
                        hideDelay: 0,
                        outside: true,
                    },
                    credits: {
                        enabled: false,
                    },
                    xAxis: {
                        labels: {
                            enabled: false,
                        },
                        title: {
                            text: null,
                        },
                        startOnTick: false,
                        endOnTick: false,
                        tickPositions: [],
                    },
                    yAxis: {
                        endOnTick: false,
                        startOnTick: false,
                        labels: {
                            enabled: false,
                        },
                        title: {
                            text: null,
                        },
                        tickPositions: [],
                        // max: isNaN(Math.max(...row[c.key].dataShow)) ? null :
                        //     Math.max(...row[c.key].dataShow),
                        // min: isNaN(Math.min(...row[c.key].dataShow)) ? null :
                        //     Math.min(...row[c.key].dataShow),
                    },
                    legend: {
                        enabled: false,
                    },
                    plotOptions: {
                           series: {
                        animation: false,
                        lineWidth: 1,
                        shadow: false,
                        states: {
                            hover: {
                                lineWidth: 1,
                            },
                        },
                        marker: {
                            radius: 1,
                            states: {
                                hover: {
                                    radius: 2,
                                },
                            },
                        },
                        fillOpacity: 0.25,
                    },
                    },
                    series: [{
                    name: '小张',
                    data: row[c.key].dataShow,
                        negativeColor: 'rgb(144,238,144,1)',
                        color: 'rgb(255,192,203,1)',
                    }],
                });// end


                }

                if (c.colType === 'spark' || c.colType === 'volatility_line') {
                divId = c.colType + divId;
                Highcharts.chart(divId, {
                    chart: {
                        type: 'areaspline',
                        // width: 200,
                        // height: 35,
                        margin: [1, 0, 1, 0],
                        style: {
                        overflow: 'visible',
                        },
                        // small optimalization, saves 1-2 ms each sparkline
                        skipClone: true,
                    },
                    title: {
                    text: '',
                    },
                    exporting: { enabled: false },
                    tooltip: {
                    // headerFormat: '<span>{formatDate(data[point.x].iso)}:</span><br/>',
                    //     pointFormat: '<b>' + d3format(c.d3format, point.y) + '</b>',
                        formatter() {
                            return formatDate(data[ix][this.x].iso) + '<br>' + d3format(c.d3format, this.point.y);
                        },
                        padding: 3,
                        hideDelay: 0,
                        outside: true,
                    },
                    credits: {
                        enabled: false,
                    },
                    xAxis: {
                        // categories: ['苹果', '橘子', '梨', '葡萄', '香蕉'],
                        labels: {
                            enabled: false,
                        },
                        title: {
                            text: null,
                        },
                        startOnTick: false,
                        endOnTick: false,
                        tickPositions: [],
                    },
                    yAxis: {
                        endOnTick: false,
                        startOnTick: false,
                        labels: {
                            enabled: false,
                        },
                        title: {
                            text: null,
                        },
                        tickPositions: [],
                        max: isNaN(Math.max(...row[c.key].dataShow)) ? null :
                            Math.max(...row[c.key].dataShow),
                        min: isNaN(Math.min(...row[c.key].dataShow)) ? null :
                            Math.min(...row[c.key].dataShow),
                    },
                    legend: {
                        enabled: false,
                    },
                    plotOptions: {
                    series: {
                        animation: false,
                        lineWidth: 1,
                        shadow: false,
                        states: {
                            hover: {
                                lineWidth: 1,
                            },
                        },
                        marker: {
                            radius: 1,
                            states: {
                                hover: {
                                    radius: 2,
                                },
                            },
                        },
                        fillOpacity: 0.25,
                    },
                    },
                    series: [{
                    name: '小张',
                    data: row[c.key].dataShow,
                        negativeColor: 'rgb(144,238,144,1)',
                        color: 'rgb(255,192,203,1)',
                    }],
                });// end
                }
            });
      });
});
};

  renderReact(
    <React.Fragment>
      <TimeTable
        aliasLabels={aliasLabels}
        chartDescription={fd.chart_description}
        columnCollection={fd.column_collection}
        defaultSort={defaultSort}
        drawGraph={drawGraph}
        fontWeightClass={fd.font_weight_class}
        metricCaption={fd.metric_caption}
        sliceId={fd.slice_id}
        tableData={tableData}
        topColumns={payload.data.topcolumn}
      />
      {fd.excel_style ? <style>{fd.excel_style}</style> : null}
    </React.Fragment>,
    document.getElementById(slice.containerId),
  );
}

export default viz;
