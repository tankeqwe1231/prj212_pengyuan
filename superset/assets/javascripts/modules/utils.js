/* eslint camelcase: 0 */
import d3 from 'd3';
import $ from 'jquery';
import BootstrapAlert from 'bootstrap/js/dist/alert';
import BootstrapModal from 'bootstrap/js/dist/modal';
import { t } from '../locales';
import axios from 'axios';
import CryptoJS from "crypto-js";

import { formatDate, UTC } from './dates';

const siFormatter = d3.format('.3s');
const AES_KEY = "WQ7VcAQ8BHDzIUPo"; 
const AES_IV  = "WQ7VcAQ8BHDzIUPo";

const formatSeriesData  = function(formatString, data) {
            switch (formatString) {
                case '':
                case null:
                    break;
                case '亿':
                    data = (data / 100000000).toFixed(2) + '亿';
                    break;
                case '万':
                    data = (data / 10000).toFixed(2) + '万';
                    break;
                default:
                    if (data !== null) {
                        data = d3FormatPreset(formatString)(data);
                    }
            }
            if (data === null || data === undefined) {
                data = '-';
            }
            return data;
};

export function defaultNumberFormatter(n) {
  let si = siFormatter(n);
  // Removing trailing `.00` if any
  if (si.slice(-1) < 'A') {
    si = parseFloat(si).toString();
  }
  return si;
}

export function d3FormatPreset(format) {
  // like d3.format, but with support for presets like 'smart_date'
  if (format === 'smart_date') {
    return formatDate;
  }
  if (format) {
    return d3.format(format);
  }
  return defaultNumberFormatter;
}
export const d3TimeFormatPreset = function (format, xList=[]) {
  const effFormat = format || 'smart_date';
  if (effFormat === 'smart_date') {
    return formatDate;
  }
  const f = d3.time.format(effFormat);
  return function (dttm) {
    let d = UTC(new Date(dttm));
    if (xList.length > 0 && dttm<100000) {
        d = UTC(new Date(xList[dttm]));
    }
    return f(d);
  };
};

// export const d3TimeFormatPresetMinute = function (format, xList) {
//   const effFormat = format || 'smart_date';
//   if (effFormat === 'smart_date') {
//     return formatDate;
//   }
//   const f = d3.time.format(effFormat);
//   return function (dttm) {
//     const d = UTC(new Date(xList[dttm]));
//     return f(d);
//   };
// };

export const d3TimeFormatPresetLocal = function (format) {
  const effFormat = format || 'smart_date';
  if (effFormat === 'smart_date') return formatDate;

  const f = d3.time.format.utc(effFormat);

  function toDate(dttm) {
    const s = String(dttm).trim();

    // 纯数字：时间戳（毫秒13位/秒10位）或 yyyyMMdd（8位）
    if (/^\d+$/.test(s)) {
      if (s.length === 13) return new Date(Number(s));
      if (s.length === 10) return new Date(Number(s) * 1000);
      if (s.length === 8) {
        return new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)));
      }
    }

    // yyyy-MM-dd / yyyy/MM/dd → UTC
    if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(s)) {
      const [y, m, d] = s.split(/[-/]/).map(Number);
      return new Date(Date.UTC(y, m - 1, d));
    }
    // yyyy-MM-dd HH:mm:ss / yyyy/MM/dd HH:mm:ss → UTC
    if (/^\d{4}[-/]\d{2}[-/]\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
      const [datePart, timePart] = s.split(' ');
      const [y, m, d] = datePart.split(/[-/]/).map(Number);
      const [h, i, sec] = timePart.split(':').map(Number);
      return new Date(Date.UTC(y, m - 1, d, h, i, sec));
    }

    // fallback：交给 Date 自行解析（含带时区的 ISO 字符串等）
    return new Date(dttm);
  }

  return function (dttm) {
    const date = toDate(dttm);
    return f(isNaN(date) ? new Date(dttm) : date);
  };
};

/*
  Utility function that takes a d3 svg:text selection and a max width, and splits the
  text's text across multiple tspan lines such that any given line does not exceed max width

  If text does not span multiple lines AND adjustedY is passed,
  will set the text to the passed val
*/
export function wrapSvgText(text, width, adjustedY) {
  const lineHeight = 1;
  // ems
  text.each(function () {
    const d3Text = d3.select(this);
    const words = d3Text.text().split(/\s+/);
    let word;
    let line = [];
    let lineNumber = 0;
    const x = d3Text.attr('x');
    const y = d3Text.attr('y');
    const dy = parseFloat(d3Text.attr('dy'));
    let tspan =
      d3Text.text(null).append('tspan').attr('x', x)
            .attr('y', y)
            .attr('dy', dy + 'em');

    let didWrap = false;
    for (let i = 0; i < words.length; i++) {
      word = words[i];
      line.push(word);
      tspan.text(line.join(' '));
      if (tspan.node().getComputedTextLength() > width) {
        line.pop();
        // remove word that pushes over the limit
        tspan.text(line.join(' '));
        line = [word];
        tspan =
          d3Text.append('tspan').attr('x', x).attr('y', y)
                .attr('dy', ++lineNumber * lineHeight + dy + 'em')
                .text(word);
        didWrap = true;
      }
    }
    if (!didWrap && typeof adjustedY !== 'undefined') {
      tspan.attr('y', adjustedY);
    }
  });
}

/**
 * Sets the body and title content of a modal, and shows it. Assumes HTML for modal exists and that
 * it handles closing (i.e., works with bootstrap)
 *
 * @param {object} options object of the form
 *  {
 *    title: {string},
 *    body: {string},
 *    modalSelector: {string, default: '.misc-modal' },
 *    titleSelector: {string, default: '.misc-modal .modal-title' },
 *    bodySelector:  {string, default: '.misc-modal .modal-body' },
 *   }
 */
export function showModal(options) {
  /* eslint no-param-reassign: 0 */
  options.modalSelector = options.modalSelector || '.misc-modal';
  options.titleSelector = options.titleSelector || '.misc-modal .modal-title';
  options.bodySelector = options.bodySelector || '.misc-modal .modal-body';
  $(options.titleSelector).html(options.title || '');
  $(options.bodySelector).html(options.body || '');
  const modalElement = document.querySelector(options.modalSelector);
  if (modalElement) {
    BootstrapModal.getOrCreateInstance(modalElement).show();
  }
}


function showApiMessage(resp) {
  const template =
    '<div class="alert alert-dismissible"> ' +
    '<button type="button" class="btn-close" ' +
    'data-bs-dismiss="alert" aria-label="Close"></button> </div>';
  const severity = resp.severity || 'info';
  const alertElement = $(template).addClass('alert-' + severity)
    .append(resp.message)
    .appendTo($('#alert-container'))[0];
  BootstrapAlert.getOrCreateInstance(alertElement);
}

export function toggleCheckbox(apiUrlPrefix, selector) {
  const apiUrl = apiUrlPrefix + $(selector)[0].checked;
  $.get(apiUrl).fail(function (xhr) {
    const resp = xhr.responseJSON;
    if (resp && resp.message) {
      showApiMessage(resp);
    }
  });
}

/**
 * Fix the height of the table body of a DataTable with scrollY set
 */
export const fixDataTableBodyHeight = function ($tableDom, height) {
  const headHeight = $tableDom.find('.dataTables_scrollHead').height();
  const filterHeight = $tableDom.find('.dataTables_filter').height() || 0;
  const pageLengthHeight = $tableDom.find('.dataTables_length').height() || 0;
  const paginationHeight = $tableDom.find('.dataTables_paginate').height() || 0;
  const controlsHeight = (pageLengthHeight > filterHeight) ? pageLengthHeight : filterHeight;
  $tableDom.find('.dataTables_scrollBody').css('max-height', height - headHeight - controlsHeight - paginationHeight);
};

export function d3format(format, number) {
  const formatters = {};
  // Formats a number and memoizes formatters to be reused
  format = format || '.3s';
  if (!(format in formatters)) {
    formatters[format] = d3.format(format);
  }
  try {
    return formatters[format](number);
  } catch (e) {
    return 'ERR';
  }
}

// Slice objects interact with their context through objects that implement
// this controllerInterface (dashboard, explore, standalone)
export const controllerInterface = {
  type: null,
  done: () => {},
  error: () => {},
  always: () => {},
  addFiler: () => {},
  setFilter: () => {},
  getFilters: () => false,
  clearFilter: () => {},
  removeFilter: () => {},
  filters: {},
};

export function formatSelectOptionsForRange(start, end) {
  // outputs array of arrays
  // formatSelectOptionsForRange(1, 5)
  // returns [[1,1], [2,2], [3,3], [4,4], [5,5]]
  const options = [];
  for (let i = start; i <= end; i++) {
    options.push([i, i.toString()]);
  }
  return options;
}

export function formatSelectOptions(options) {
  return options.map(opt =>
     [opt, opt.toString()],
  );
}

export function slugify(string) {
  // slugify('My Neat Label! '); returns 'my-neat-label'
  return string
          .toString()
          .toLowerCase()
          .trim()
          .replace(/[\s\W-]+/g, '-') // replace spaces, non-word chars, w/ a single dash (-)
          .replace(/-$/, ''); // remove last floating dash
}

export function getAjaxErrorMsg(error) {
  const respJSON = error.responseJSON;
  return (respJSON && respJSON.message) ? respJSON.message :
          error.responseText;
}

export function customizeToolTip(chart, xAxisFormatter, yAxisFormatters) {
  chart.useInteractiveGuideline(true);
  chart.interactiveLayer.tooltip.contentGenerator(function (d) {
    const tooltipTitle = xAxisFormatter(d.value);
    let tooltip = '';

    tooltip += "<table><thead><tr><td colspan='3'>"
      + `<strong class='x-value'>${tooltipTitle}</strong>`
      + '</td></tr></thead><tbody>';

    d.series.forEach((series, i) => {
      const yAxisFormatter = yAxisFormatters[i];
      const value = yAxisFormatter(series.value);
      tooltip += "<tr><td class='legend-color-guide'>"
        + `<div style="background-color: ${series.color};"></div></td>`
        + `<td class='key'>${series.key}</td>`
        + `<td class='value'>${value}</td></tr>`;
    });

    tooltip += '</tbody></table>';

    return tooltip;
  });
}

export function initJQueryAjax() {
  // Works in conjunction with a Flask-WTF token as described here:
  // http://flask-wtf.readthedocs.io/en/stable/csrf.html#javascript-requests
  const token = $('input#csrf_token').val();
  if (token) {
    $.ajaxSetup({
      beforeSend(xhr, settings) {
        if (!/^(GET|HEAD|OPTIONS|TRACE)$/i.test(settings.type) && !this.crossDomain) {
          xhr.setRequestHeader('X-CSRFToken', token);
        }
      },
    });
  }
}

export function initAxios() {
  axios.defaults.headers.common['X-CSRFToken'] = $('input#csrf_token').val();
}

export function tryNumify(s) {
  // Attempts casting to Number, returns string when failing
  const n = Number(s);
  if (isNaN(n)) {
    return s;
  }
  return n;
}

export function getParam(name) {
  /* eslint no-useless-escape: 0 */
  const formattedName = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
  const regex = new RegExp('[\\?&]' + formattedName + '=([^&#]*)');
  const results = regex.exec(location.search);
  return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

export function mainMetric(savedMetrics) {
  // Using 'count' as default metric if it exists, otherwise using whatever one shows up first
  let metric;
  if (savedMetrics && savedMetrics.length > 0) {
    savedMetrics.forEach((m) => {
      if (m.metric_name === 'count') {
        metric = 'count';
      }
    });
    if (!metric) {
      metric = savedMetrics[0].metric_name;
    }
  }
  return metric;
}

 export function yAxisFormat(formatString) {
                return function (value) {
                    if (value === null) {
                        return '-';
                    }
                    switch (formatString) {
                        case '亿':
                            return (value / 100000000).toFixed(2) + '亿';
                        case '万':
                            return (value / 10000).toFixed(2) + '万';
                        case '':
                            return value;
                        default:
                            return d3FormatPreset(formatString)(value);
                    }
                };
    }

 export function dateFormatCustom(formatString) {
                return function (value) {
                    if (value.length === 8) {
                        // 20200101
                        value = value.substr(0, 4) + '/' + value.substr(4, 2) + '/' + value.substr(-2);
                    }
                    if (formatString) {
                        const formatDateCustom = d3TimeFormatPresetLocal(formatString);
                        return formatDateCustom(value);
                    }
                    return value;
                };
    }

export function tooltipFormat({
                                  formatStringLeft = '',
                                  formatStringRight = '',
                                  formatDateX = '',
                                  visType = '',
                                  customObj = ''
                              } = {}) {
    return function (params) {
        let showHtm = '';
        if (params.constructor === Object) {
            showHtm += formatDateX ? dateFormatCustom(formatDateX)(params.name)
            : params.name.replace('\n', '<br>');
            const formatStr = params.seriesName.indexOf('(右)') !== -1 ? formatStringRight : formatStringLeft;
            showHtm += '<br>' + params.marker + '<span>'
                + params.seriesName + '：' + formatSeriesData(formatStr, params.value) + '</span>';
            return showHtm;
        }

        if (visType !== 'scatter') {
            showHtm += formatDateX ? dateFormatCustom(formatDateX)(params[0].name) : params[0].name.replace('\n', '<br>');
        }
        if (visType === 'echarts_combine') {
          params.sort((a, b) => b.value - a.value);
        }
        for (let i = 0; i < params.length; i++) {
            const seriesName = params[i].seriesName;
            let fontWeight = null;
            // eslint-disable-next-line max-len
            let data = Array.isArray(params[i].data) ? params[i].data[1] : params[i].value;
            if (visType === 'scatter') {
                data = params[i].data[1];
                showHtm = params[0].name;
            }
            const formatString = seriesName.indexOf('(右)') !== -1 ? formatStringRight : formatStringLeft;
            data = formatSeriesData(formatString, data);
            if (visType === 'scatter') {
                showHtm += '<br>' + params[i].marker + data;
            } else {
                if (window.selectSeries === seriesName) {
                    // spanColor = '#ff9900';
                    fontWeight = 'bold';
                }
                showHtm += '<br>' + params[i].marker + '<span style="font-weight:' + fontWeight + '";>' + seriesName + '：' + data + '</span>';
            }
        }
        if (visType === 'echarts_stat_line' && Object.keys(customObj).length) {
            Object.keys(customObj).forEach(function (key) {
                showHtm += '<br><span style="display:inline-block;margin-right:5px;border-radius:10px;width:10px;height:10px;"></span><span style="color:null";>' + key + ':' + customObj[key] + '</span>';
            });
        }
        return showHtm;
    };
}


 export function tooltipFormatMultipleY({ formatStringArr = [], formatDateX = '' }) {
                return function (params) {
                    // const newParams = [...params];
                    const newParams = params;
                    // newParams.sort((a, b) => b.value - a.value);
                    let showHtm = formatDateX ? dateFormatCustom(formatDateX)(newParams[0].name)
                        : newParams[0].name.replace('\n', '<br>');
                    for (let i = 0; i < newParams.length; i++) {
                        let spanColor = null;
                        // eslint-disable-next-line max-len
                        let data = Array.isArray(newParams[i].data) ? newParams[i].data[1] : newParams[i].data;
                        const seriesName = newParams[i].seriesName;
                        const formatString = formatStringArr[i];
                        data = formatSeriesData(formatString, data);
                        if (window.selectSeries === seriesName) {
                            spanColor = '#ff9900';
                        }
                        showHtm += '<br>' + newParams[i].marker + '<span style="color:' + spanColor + '";>' + seriesName + ':' + data + '</span>';
                    }
                    return showHtm;
                };
    }

 export function yAxisLimit(limitValue, type, force= false) {
    const limitCompare = 5;
    if (type === 'min') {
        return (value) => {
            if (force && !isNaN(limitValue) && typeof limitValue !== 'undefined') {
                return limitValue;
            }
            if (value.min > limitValue) {
                    return limitValue;
                }
                if (value.min >= 0) {
                    if (value.min * 0.99 > limitCompare) {
                        return Math.floor(value.min * 0.99);
                    }
                    return (value.min * 0.9).toFixed(3);
                }
                if (Math.abs(value.min * 1.01) > limitCompare) {
                        return Math.floor(value.min * 1.01);
                    }
                return (value.min * 1.1).toFixed(3);
        };
    }

    return (value) => {
        if (force && !isNaN(limitValue) && typeof limitValue !== 'undefined') {
                return limitValue;
            }
        if (value.max < limitValue) {
            return limitValue;
        }
        if (value.max >= 0) {
            if (value.max * 1.01 > limitCompare) {
                        return Math.ceil(value.max * 1.01);
                    }
            return (value.max * 1.1).toFixed(3);
        }
        if (Math.abs(value.max * 0.99) > limitCompare) {
                        return Math.ceil(value.max * 0.99);
                    }
        return (value.max * 0.9).toFixed(3);
    };
 }


export function createCkeditor(slice, EditorId, lineCount, ckHeight) {
    // ckHeight = lineCount > 1 ? lineCount * 20 : 24;
    const fd = slice.formData;
    const ckInstance = CKEDITOR.replace(EditorId, { toolbar: [], height: ckHeight });
    const sliceName = $('#cell-' + fd.slice_id + ' .editable-title input').val();
    ckInstance.on('instanceReady', function (event) {
      const editor = event.editor;
      let editorChanged = false;
      editor.setData(fd.editor_content, function () {
          $(slice.selector + ' iframe').contents().find('.cke_editable').css({ 'line-height': 0.3 });
        console.log('setData');
        editor.on('change', function () {
          console.log('datachange');
          console.log(editor.getData());
          editorChanged = true;
        });
      });

      $('#' + slice.containerId + ' .cke_top').hide();
      const button = document.querySelector('.ckeditor-switch');
      if (sliceName && button && button.firstChild.data === t('Edit Dashboard')) {
          editor.setReadOnly(true);
          slice.container.find('#cke_' + EditorId).css('border', 0);
          if (lineCount  <= 0) {
              $('#cke_' + EditorId).hide();
              // slice.container.find('#' + sliceId).css('height', slice.height());
          }
      }
      if (sliceName && !button) {
          editor.setReadOnly(true);
          if (lineCount  <= 0) {
              $('#cke_' + EditorId).hide();
          }
      }
      if (button) {
          button.addEventListener('click', (obj) => {
          if (obj.target.firstChild.data === t('Edit Dashboard')) {
              editor.setReadOnly(false);
              slice.container.find('#cke_' + EditorId).css('border', '1px solid #d1d1d1');
              $('#cke_' + EditorId).show();
          } else {
              editor.setReadOnly(true);
              slice.container.find('#cke_' + EditorId).css('border', 0);
              if ($.trim(editor.getData()) === '') {
                  $('#cke_' + EditorId).hide();
              }
          }
          });
      }
      editor.on('blur', function () {
          console.log('blur');
          if (editorChanged) {
            editorChanged = false;
            fd.editor_content = editor.getData();
            if (!sliceName) {
                slice.props.setControlValue('editor_content', editor.getData(), []);
            }
            if (sliceName) {
                slice.props.updateSliceFormData(fd.slice_id, fd);
            }
          }
        });
      $('.cke_bottom').hide();
      //   iframe.css('height', slice.height());
    });
}

export function addWaterMark() {
  const watermark = {};
  const option = {
    childList: true,
    attributes: true,
    subtree: true,
  };
  const defaultSettings = {
    watermark_id: 'wm_div_id',          // 水印总体的id
    watermark_prefix: 'mask_div_id',    // 小水印的id前缀
    watermark_txt: '测试水印',             // 水印的内容
    watermark_rows: 0,                   // 水印行数
    watermark_cols: 0,                   // 水印列数
    watermark_x: 30,                     // 水印起始位置x轴坐标
    watermark_y: 30,                     // 水印起始位置Y轴坐标
    watermark_x_space: 50,              // 水印x轴间隔
    watermark_y_space: 50,               // 水印y轴间隔
    watermark_font: '微软雅黑',           // 水印字体
    watermark_color: 'black',            // 水印字体颜色
    watermark_fontsize: '23px',          // 水印字体大小
    watermark_fontweight: 100,           //  水印字体font weight
    watermark_alpha: 0.20,               // 水印透明度，要求设置在大于等于0.005
    watermark_width: 200,                // 水印宽度
    watermark_height: 50,               // 水印长度
    watermark_angle: 0,                 // 水印倾斜度数
    watermark_parent_width: 0,      // 水印的总体宽度（默认值：body的scrollWidth和clientWidth的较大值）
    watermark_parent_height: 0,     // 水印的总体高度（默认值：body的scrollHeight和clientHeight的较大值）
    watermark_parent_node: null,     // 水印插件挂载的父元素element,不输入则默认挂在body上
    monitor: false,                   // monitor 是否监控， true: 不可删除水印; false: 可删水印。
  };


  /* 加载水印 */
  const loadMark = function (settings) {
      const setting = arguments[0] || {};
    /* 采用配置项替换默认值，作用类似jquery.extend */
    if (arguments.length === 1 && typeof arguments[0] === 'object') {
      // const src = arguments[0] || {};
      for (const key in setting) {
        if (setting[key] && defaultSettings[key] && setting[key] === defaultSettings[key]) continue;
        else if (setting[key] || setting[key] === 0) defaultSettings[key] = setting[key];
      }
    }

    /* 如果元素存在则移除 */
    // const watermark_element = document.getElementById(defaultSettings.watermark_id);
    // watermark_element && watermark_element.parentNode
    // && watermark_element.parentNode.removeChild(watermark_element);

    /* 如果设置水印挂载的父元素的id */
    const watermark_parent_element = document.getElementById(defaultSettings.watermark_parent_node);
    const watermark_hook_element = watermark_parent_element || document.body;
    const page_width = Math.max(watermark_hook_element.scrollWidth
        , watermark_hook_element.clientWidth);
    /* 获取页面最大长度 */
    const page_height = Math.max(watermark_hook_element.scrollHeight
        , watermark_hook_element.clientHeight);

    const parentEle = watermark_hook_element;

    const page_offsetTop = parentEle.offsetTop || 0;
    const page_offsetLeft = parentEle.offsetLeft || 0;
    if (setting.watermark_parent_width || setting.watermark_parent_height) {
      /* 指定父元素同时指定了宽或高 */
      if (parentEle) {
        defaultSettings.watermark_x += page_offsetLeft;
        defaultSettings.watermark_y += page_offsetTop;
      }
    }

    /* 创建水印外壳div */
    let otdiv = document.getElementById(defaultSettings.watermark_id);
    let shadowRoot = null;

    if (!otdiv) {
      otdiv = document.createElement('div');
      /* 创建shadow dom */
      otdiv.id = defaultSettings.watermark_id;
      otdiv.setAttribute('style', 'pointer-events: none !important; display: block !important');
      /* 判断浏览器是否支持attachShadow方法 */
      if (typeof otdiv.attachShadow === 'function') {
        /* createShadowRoot Deprecated. Not for use in new websites. Use attachShadow */
        shadowRoot = otdiv.attachShadow({ mode: 'open' });
      } else {
        shadowRoot = otdiv;
      }
      /* 将shadow dom随机插入body内的任意位置 */
      const nodeList = watermark_hook_element.children;
      const index = Math.floor(Math.random() * (nodeList.length - 1));
      if (nodeList[index]) {
        watermark_hook_element.insertBefore(otdiv, nodeList[index]);
      } else {
          // watermark_hook_element.insertBefore(otdiv, nodeList[index]);
        watermark_hook_element.appendChild(otdiv);
      }
    } else if (otdiv.shadowRoot) {
      shadowRoot = otdiv.shadowRoot;
    }
    if (!defaultSettings.watermark_cols) {
        /* 三种情况下会重新计算水印列数和x方向水印间隔：1、水印列数设置为0，2、水印宽度大于页面宽度，3、水印宽度小于于页面宽度 */
        defaultSettings.watermark_cols = parseInt((page_width - defaultSettings.watermark_x) /
            (defaultSettings.watermark_width + defaultSettings.watermark_x_space), 10);
        const temp_watermark_x_space = parseInt((page_width - defaultSettings.watermark_x -
            defaultSettings.watermark_width * defaultSettings.watermark_cols) /
            (defaultSettings.watermark_cols), 10);
        defaultSettings.watermark_x_space = temp_watermark_x_space
            ? defaultSettings.watermark_x_space
            : temp_watermark_x_space;
    }

    if (!defaultSettings.watermark_rows) {
        defaultSettings.watermark_rows = parseInt((page_height - defaultSettings.watermark_y) /
            (defaultSettings.watermark_height + defaultSettings.watermark_y_space), 10);
        const temp_watermark_y_space = parseInt((page_height - defaultSettings.watermark_y -
            defaultSettings.watermark_height * defaultSettings.watermark_rows) /
            (defaultSettings.watermark_rows), 10);
        defaultSettings.watermark_y_space = temp_watermark_y_space
            ? defaultSettings.watermark_y_space
            : temp_watermark_y_space;
    }

    let allWatermarkWidth;
    let allWatermarkHeight;

    if (watermark_parent_element) {
      allWatermarkWidth = defaultSettings.watermark_x + defaultSettings.watermark_width
          * defaultSettings.watermark_cols + defaultSettings.watermark_x_space
          * (defaultSettings.watermark_cols - 1);
      allWatermarkHeight = defaultSettings.watermark_y + defaultSettings.watermark_height
          * defaultSettings.watermark_rows + defaultSettings.watermark_y_space
          * (defaultSettings.watermark_rows - 1);
    } else {
      allWatermarkWidth = page_offsetLeft + defaultSettings.watermark_x
          + defaultSettings.watermark_width
          * defaultSettings.watermark_cols + defaultSettings.watermark_x_space
          * (defaultSettings.watermark_cols - 1);
      allWatermarkHeight = page_offsetTop + defaultSettings.watermark_y
          + defaultSettings.watermark_height
          * defaultSettings.watermark_rows + defaultSettings.watermark_y_space
          * (defaultSettings.watermark_rows - 1);
    }

    let x;
    let y;
    for (let i = 0; i < defaultSettings.watermark_rows; i++) {
      if (watermark_parent_element) {
        y = page_offsetTop + defaultSettings.watermark_y + (page_height - allWatermarkHeight)
            / 2 + (defaultSettings.watermark_y_space + defaultSettings.watermark_height) * i;
        if (defaultSettings.watermark_rows === 1) {
              y = page_height / 2;
          }
      } else {
        y = defaultSettings.watermark_y + (page_height - allWatermarkHeight)
            / 2 + (defaultSettings.watermark_y_space + defaultSettings.watermark_height) * i;
      }
      for (let j = 0; j < defaultSettings.watermark_cols; j++) {
        if (watermark_parent_element) {
            x = page_offsetLeft + defaultSettings.watermark_x + (page_width - allWatermarkWidth)
                / 2 + (defaultSettings.watermark_width + defaultSettings.watermark_x_space) * j;
            if (defaultSettings.watermark_cols === 1) {
                x = page_width / 3;
            }
        } else {
          x = defaultSettings.watermark_x + (page_width - allWatermarkWidth)
              / 2 + (defaultSettings.watermark_width + defaultSettings.watermark_x_space) * j;
        }
        const mask_div = document.createElement('div');
        const oText = document.createTextNode(defaultSettings.watermark_txt);
        mask_div.appendChild(oText);
        /* 设置水印相关属性start */
        mask_div.id = defaultSettings.watermark_prefix + i + j;
        /* 设置水印div倾斜显示 */
        mask_div.style.webkitTransform = 'rotate(-' + defaultSettings.watermark_angle + 'deg)';
        mask_div.style.MozTransform = 'rotate(-' + defaultSettings.watermark_angle + 'deg)';
        mask_div.style.msTransform = 'rotate(-' + defaultSettings.watermark_angle + 'deg)';
        mask_div.style.OTransform = 'rotate(-' + defaultSettings.watermark_angle + 'deg)';
        // mask_div.style.transform = 'rotate(-' + defaultSettings.watermark_angle + 'deg)';
        mask_div.style.transform = 'translate(-50%,0)';
        mask_div.style.visibility = '';
        mask_div.style.position = 'absolute';
        /* 选不中 */
        // mask_div.style.left = x + 'px';
        mask_div.style.left = '50%';
        mask_div.style['margin-top'] = y + 'px';
        mask_div.style.overflow = 'hidden';
        mask_div.style.zIndex = '9999999';
        mask_div.style.opacity = defaultSettings.watermark_alpha;
        mask_div.style.fontSize = defaultSettings.watermark_fontsize;
        mask_div.style.fontFamily = defaultSettings.watermark_font;
        mask_div.style.fontWeight = defaultSettings.watermark_fontweight;
        mask_div.style.color = defaultSettings.watermark_color;
        mask_div.style.textAlign = 'center';
        mask_div.style.width = defaultSettings.watermark_width + 'px';
        mask_div.style.height = defaultSettings.watermark_height + 'px';
        mask_div.style.display = 'block';
        mask_div.style['-ms-user-select'] = 'none';
        /* 设置水印相关属性end */
        shadowRoot.appendChild(mask_div);
      }
    }

    // monitor 是否监控， true: 不可删除水印; false: 可删水印。
    // const minotor = settings.monitor === undefined ? defaultSettings.monitor : settings.monitor;
    // if (minotor) {
    //   watermarkDom.observe(watermark_hook_element, option);
    //   watermarkDom.observe(document.getElementById(defaultSettings.watermark_id).shadowRoot,
    //       option);
    // }
  };

  /* 移除水印 */
  const removeMark = function () {
    /* 采用配置项替换默认值，作用类似jquery.extend */
    if (arguments.length === 1 && typeof arguments[0] === 'object') {
      const src = arguments[0] || {};
      for (const key in src) {
        if (src[key] && defaultSettings[key] && src[key] === defaultSettings[key]) continue;
        /* veronic: resolution of watermark_angle=0 not in force */
        else if (src[key] || src[key] === 0) defaultSettings[key] = src[key];
      }
    }

    /* 移除水印 */
    const watermark_element = document.getElementById(defaultSettings.watermark_id);
    const parentElement = watermark_element.parentNode;
    parentElement.removeChild(watermark_element);
  };

  let globalSetting;
  /* 初始化水印，添加load和resize事件 */
  watermark.init = function (settings) {
    globalSetting = settings;
    loadMark(settings);
    window.addEventListener('onload', function () {
      loadMark(settings);
    });
    window.addEventListener('resize', function () {
      loadMark(settings);
    });
  };

  /* 手动加载水印 */
  watermark.load = function (settings) {
    globalSetting = settings;
    loadMark(settings);
  };

  /* 手动移除水印 */
  watermark.remove = function () {
    removeMark();
  };

  // 监听dom是否被移除或者改变属性的回调函数
  const callback = function (records) {
    if ((globalSetting && records.length === 1) || records.length === 1
        && records[0].removedNodes.length >= 1) {
      loadMark(globalSetting);
    }
  };
  const MutationObserver = window.MutationObserver || window.WebKitMutationObserver
      || window.MozMutationObserver;
  const watermarkDom = new MutationObserver(callback);

  return watermark;
}

export function strtobase64(str){
  return btoa(unescape(encodeURIComponent(str)));
}

export function aesEncrypt(str) {
  const key = CryptoJS.enc.Utf8.parse(AES_KEY);
  const iv  = CryptoJS.enc.Utf8.parse(AES_IV);

  const encrypted = CryptoJS.AES.encrypt(str, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });

  return encrypted.toString();
}
