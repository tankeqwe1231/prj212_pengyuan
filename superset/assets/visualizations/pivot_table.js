import 'datatables.net-bs5';
import 'datatables.net-bs5/css/dataTables.bootstrap5.css';
import $ from 'jquery';
import Highcharts from 'highcharts';
import moment from 'moment';

import { d3format, d3TimeFormatPresetLocal, fixDataTableBodyHeight } from '../javascripts/modules/utils';
import './pivot_table.css';

export default function pivotTable(slice, payload) {
  const container = slice.container;
  const fd = slice.formData;
  const height = container.height();
  let cols = payload.data.columns;
  const maxList = payload.data.max;
  const minList = payload.data.min;
  let maxAll = payload.data.max_all;
  let minAll = payload.data.min_all;
  const hslColorMax = fd.hsl_color_max ? JSON.parse(fd.hsl_color_max) : [0, '100%'];
  const hslColorMin = fd.hsl_color_min ? JSON.parse(fd.hsl_color_min) : [120, '100%'];
  const hideRows = fd.hide_rows ? fd.hide_rows.split('|') : [];
  const categoryData = fd.chart_xAix_name ? JSON.parse(fd.chart_xAix_name) : [];
  const chartColumn = fd.chart_column ? JSON.parse(fd.chart_column) : [];
//   const orderValue = fd.order_by_asc ? 'asc' : 'desc';
  const orderValue = fd.order_type;
  const chartWidthDefault = 80;
  const chartWidth = fd.chart_width ? fd.chart_width + 'px' : chartWidthDefault + 'px';
  const colorColumn = fd.color_column ? fd.color_column.split('|') : [];
  const hslColumn = fd.hsl_column ? fd.hsl_column.split('|') : [];
  const maxMinColumnDict = payload.data.max_min_column_dict;
  const columnOrderType = fd.column_order_type ? JSON.parse(fd.column_order_type) : [];
  const textReplace = fd.text_replace ? JSON.parse(fd.text_replace) : {};
  let chartDescriptionHeight = 0;
  if (fd.chart_description) {
      chartDescriptionHeight = fd.chart_description.split('\n').length * 20;
  }

  const numberFormatColumnSpan = {};
  if (fd.number_format_column) {
      const numberFormatColumn = JSON.parse(fd.number_format_column);
      Object.keys(numberFormatColumn).forEach((objKey) => {
          objKey.split('|').forEach((v) => {
              numberFormatColumnSpan[v] = numberFormatColumn[objKey];
          });
      });
  }

  if (Array.isArray(cols[0])) {
    cols = cols.map(col => col[0]);
  }

  let html = payload.data.html;
  if (fd.excel_style) {
      html += `<style>${fd.excel_style}</style>`;
  }
  if (fd.chart_description) {
      html += fd.chart_description.replace(/\n/g, '<br>');
  }

  // payload data is a string of html with a single table element
  container.html(html);
  // jQuery hack to set verbose names in headers
  const replaceCell = function () {
    const s = $(this)[0].textContent;
    $(this)[0].textContent = slice.datasource.verbose_map[s] || s;
  };
  slice.container.find('thead tr:first th').each(replaceCell);
  slice.container.find('thead tr th:first-child').each(replaceCell);

  // jQuery hack to format number
  const tsFormatter = d3TimeFormatPresetLocal(fd.table_timestamp_format);
  const tsFormatterHead = d3TimeFormatPresetLocal(fd.date_time_format);

  let thLength = 0;
  const tdLength = slice.container.find('tbody>tr:first>td').length;
  slice.container.find('tbody tr').each(function (trIndex) {
      if (trIndex === 0) { thLength = $(this).find('th').length; }
    $(this).find('td').each(function (i) {
      const metric = cols[i];
      const format = slice.datasource.column_formats[metric] || fd.number_format || '.3s';
      let tdText = $(this)[0].textContent;
      if (tdText === 'inf' || tdText === 'None') {
          $(this)[0].textContent = '';
          tdText = '';
      }
      if (tdText !== '' && !isNaN(tdText)) {
            if (fd.show_max) {
                  if (Math.abs(maxList[i] - parseFloat(tdText)) <= 0.000001)  {
                            $(this).css('background-color', '#f4cccc');
                            // $(this).css('color', 'white');
                    }
              }
            if (fd.show_min) {
              if (Math.abs(minList[i] - parseFloat(tdText)) <= 0.000001) {
                            $(this).css('background-color', '#b6d7a8');
                            // $(this).css('color', 'white');
                    }
              }
      }
      if ((fd.show_hsl_bg || fd.show_hsl_bg_zero) && tdText !== '' && !isNaN(tdText)) {
          let valuePos, lightness, hslColor;
          if (hslColumn.length && maxMinColumnDict) {
            if (hslColumn.includes((i + thLength + 1).toString())) {
                maxAll = maxMinColumnDict[(i + thLength + 1)][0];
                minAll = maxMinColumnDict[(i + thLength + 1)][1];
            }
          }
          if (fd.show_hsl_bg_zero) {
              // 零值HSL背景色：单向映射
              valuePos = tdText / maxAll;
              if (tdText < 0) {
                  valuePos = tdText / minAll;
              }
              lightness = ((1 - valuePos) * 50 + 50) + '%';
              hslColor = tdText <= 0 ? hslColorMin : hslColorMax;
          } else if (fd.show_hsl_bg) {
              // 常规HSL背景色：双向映射
              valuePos = (tdText - minAll) / (maxAll - minAll);
              lightness = ((1 - Math.abs((valuePos - 0.5) * 2)) * 50 + 50) + '%';
              hslColor = valuePos <= 0.5 ? hslColorMin : hslColorMax;
          }
          if (fd.hsl_reversal) {
             hslColor = hslColor.toString() === hslColorMax.toString() ? hslColorMin : hslColorMax;
          }
          if (hslColumn.length) {
            if (hslColumn.includes((i + thLength + 1).toString())) {
                $(this).css('background-color', 'hsl(' + hslColor[0] + ',' + hslColor[1] + ',' + lightness + ', 0.5 )');
            }
          } else {
            $(this).css('background-color', 'hsl(' + hslColor[0] + ',' + hslColor[1] + ',' + lightness + ', 0.5 )');
          }

      }

      if (fd.show_hsl_bg_text && tdText !== '' && !isNaN(tdText)) {
          const valuePos = (tdText - minAll) / (maxAll - minAll);
          // const lightness = ((1 - Math.abs((valuePos - 0.5) * 2)) * 50 + 50) + '%';
          const lightness = (0.5 - Math.abs(valuePos - 0.5)) * 45 + 50 + '%';
          let hslColor = hslColorMax;
          if (valuePos <= 0.5) {
              hslColor = hslColorMin;
          }
          if (fd.hsl_reversal) {
             hslColor = hslColor.toString() ===  hslColorMax.toString() ? hslColorMin : hslColorMax;
          }
          $(this).css('color', 'hsl(' + hslColor[0] + ',' + hslColor[1] + ',' + lightness + ', 1 )');
      }


        if (!isNaN(tdText) && tdText !== '') {
            const textColor = tdText >= 0 ? 'blue' : 'red';
            if (colorColumn.length) {
                if (colorColumn[0] === 'all') {
                    $(this).css('color', textColor);
                } else if (colorColumn.includes((i + thLength + 1).toString())) {
                    $(this).css('color', textColor);
                }
            }
            $(this)[0].textContent = d3format(format, tdText);
            if (numberFormatColumnSpan.hasOwnProperty((i + thLength + 1).toString())) {
                $(this)[0].textContent = d3format(numberFormatColumnSpan[(i + thLength + 1).toString()], tdText);
            }
            // eslint-disable-next-line max-len
            if (numberFormatColumnSpan.hasOwnProperty((i - tdLength).toString())) {
                $(this)[0].textContent = d3format(numberFormatColumnSpan[(i - tdLength).toString()]
                    , tdText);
            }
        }
    });

    // if (trIndex === 0) { thLength = $(this).find('th').length; }

    $(this).find('th').each(function () {
      let tdText = $(this)[0].textContent;
      const isValidDate = moment(tdText, moment.ISO_8601, true).isValid();
      if (tdText !== '' && tdText !== 'All' && isValidDate && (isNaN(tdText) && !isNaN(Date.parse(tdText)))) {
        $(this)[0].textContent = tsFormatter(tdText);
      }

      tdText = $(this)[0].textContent;
      if (tdText !== '') {
          if (textReplace.hasOwnProperty(tdText)) {
              $(this)[0].textContent = textReplace[tdText];
          }
      }
    });

    if (chartColumn.length) {

        const divIdHighcharts = slice.containerId + '-divIdHighcharts-' + trIndex;
        const addtd = $('<td style="width:' + chartWidth + '"><div id="' + divIdHighcharts + '" style="height:' + ($(this).height() - 12) + '"></div></td>');

        $(this).append(addtd);

        const trData = [];
        $(this).find('td').each(function (i) {
            let tdText = $(this)[0].textContent;
            if (chartColumn.indexOf(i + 1 + thLength) > -1) {
                if (tdText.charAt(tdText.length - 1) === 'k') {
                    tdText = parseFloat(tdText.substr(0, tdText.length - 1)) * 1000;
                }
                trData.push(parseFloat(tdText));
            }
        });

        const trDataMaxMin = [];
        for (let i = 0; i < trData.length; i++) {
            if (!isNaN(trData[i])) {
                trDataMaxMin.push(trData[i]);
            }
        }

        if (trDataMaxMin.length) {
            Highcharts.chart(divIdHighcharts, {
                chart: {
                    type: 'areaspline',
                    width: fd.chart_width ? fd.chart_width : null,
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
                    style: {
                        width: '100px',
                    },
                    // headerFormat: '<span>{formatDate(data[point.x].iso)}:</span><br/>',
                    //     pointFormat: '<b>' + d3format(c.d3format, point.y) + '</b>',
                    formatter() {
                        let xName = '';
                        if (categoryData.length - 1 >= this.point.x) {
                            xName = categoryData[this.point.x];
                        }
                        return xName + '<br>' + this.point.y + '</div>';
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
                    max: isNaN(Math.max(...trDataMaxMin)) ? null :
                        Math.max(...trDataMaxMin),
                    min: isNaN(Math.min(...trDataMaxMin)) ? null :
                        Math.min(...trDataMaxMin),
                },
                legend: {
                    enabled: false,
                },
                plotOptions: {
                    series: {
                        animation: false,
                        lineWidth: 1,
                        connectNulls: true,
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
                    data: trData,
                    negativeColor: 'rgb(144,238,144,1)',
                    color: 'rgb(255,192,203,1)',
                }],
            });// end
        }

    }
  });


  slice.container.find('thead tr').each(function () {
    $(this).find('th').each(function () {
      const tdText = $(this)[0].textContent;
      if (tdText !== '' && !isNaN(Date.parse(tdText)) && fd.date_time_format) {
          $(this)[0].textContent = tsFormatterHead(tdText);
      }
      if (tdText !== '') {
          if (textReplace.hasOwnProperty(tdText)) {
              $(this)[0].textContent = textReplace[tdText];
          }
      }
    });
  });

    if (fd.row_background_color) {
        const rowBackGroundColorJson = JSON.parse(fd.row_background_color);
        Object.keys(rowBackGroundColorJson).forEach((objKey) => {
            objKey.split('|').forEach((v) => {
                $('tbody tr:contains(' + v + ')').css('background-color', rowBackGroundColorJson[objKey]);
            });
        });
    }

if (chartColumn.length) {
    // const subnum = 35;
    slice.container.find('thead').each(function (theadix) {
        if (!theadix) {
            $(this).find('tr').each(function () {
                const addTdHead = $('<th rowspan="1" colspan="1" ></th>');
                $(this).append(addTdHead);
            });
        }
    });
}

  if (fd.hide_rows) {
      container.find('table thead').each(function () {
          $(this).find('tr').each(function (index) {
              if (hideRows.indexOf(index + 1 + '') > -1) {
                  // $(this).hide();
                  $(this).remove();
              }
          });
      });
  }

  if (payload.data.groupby.length === 1) {
    // When there is only 1 group by column,
    // we use the DataTable plugin to make the header fixed.
    // The plugin takes care of the scrolling so we don't need
    // overflow: 'auto' on the table.
    container.css('overflow', 'hidden');
      const table = container.find('table').DataTable({
          order: [],
          paging: false,
          searching: false,
          bInfo: false,
          scrollY: `${height}px`,
          scrollCollapse: true,
          scrollX: true,
          // columnDefs: [
          //     {width: "200px", targets: 1},
          //     {width: "8%", targets: 2},
          // ],
      });

    if (!columnOrderType.length && orderValue) {
        table.column('0').order(orderValue).draw();
    }
    // table.column('0').order(orderValue).draw();
    // table.column('0').order([]).draw();
    const colLength = table.context[0].aoColumns.length;
    columnOrderType.forEach((colMap) => {
        Object.keys(colMap).forEach((objKey) => {
            let columnNo = (Number(objKey) - 1) + '';
            if (Number(objKey) < 0) {
                columnNo = (colLength + Number(objKey)) + '';
            }
            if (colMap[objKey].toLowerCase() === 'asc' || colMap[objKey].toLowerCase() === 'desc') {
                table.column(columnNo).order(colMap[objKey]).draw();
            }
      });
    });
    fixDataTableBodyHeight(container.find('.dataTables_wrapper'), height - chartDescriptionHeight);
  } else {
    // When there is more than 1 group by column we just render the table, without using
    // the DataTable plugin, so we need to handle the scrolling ourselves.
    // In this case the header is not fixed.
    container.css('overflow', 'auto');
    container.css('height', `${height + 10}px`);
  }

  // if (fd.hide_rows) {
  //     container.find('table thead').each(function () {
  //         $(this).find('tr').each(function (index) {
  //             if (hideRows.indexOf(index + 1 + '') > -1) {
  //                 $(this).hide();
  //             }
  //         });
  //     });
  // }


  if (container.find('.dataTables_scrollBody').css('max-height')) {
    // const dd = parseInt(container.find('.dataTables_scrollBody')
      // .css('max-height').replace('px', ''), 10) + 60;
    const dataTablesScrollHeight = container.find('.dataTables_scroll').height();
    const dataTablesScrollHeadHeight = container.find('.dataTables_scrollHead').height();
    // container.find('.dataTables_scrollBody').css('max-height',
    //     dataTablesScrollHeight - (dataTablesScrollHeadHeight + 8));
      container.find('.dataTables_scrollBody').css('max-height',
        dataTablesScrollHeight - (dataTablesScrollHeadHeight));
  }


}
