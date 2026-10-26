import React, { useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { snapdom } from '@zumer/snapdom';
import AlertsWrapper from '../../components/AlertsWrapper';
import GridLayout from './GridLayout';
import Header from './Header';
import { exportChart } from '../../explore/exploreUtils';
import { areObjectsEqual } from '../../reduxUtils';
import { addWaterMark } from '../../modules/utils';
import { Logger, ActionLog, LOG_ACTIONS_PAGE_LOAD,
  LOG_ACTIONS_LOAD_EVENT, LOG_ACTIONS_RENDER_EVENT } from '../../logger';
import { t } from '../../locales';
import { isDashboardResizeSuppressed } from '../resizeUtils';

import '../../../stylesheets/dashboard.css';


const propTypes = {
  actions: PropTypes.object,
  initMessages: PropTypes.array,
  dashboard: PropTypes.object.isRequired,
  slices: PropTypes.object,
  datasources: PropTypes.object,
  filters: PropTypes.object,
  refresh: PropTypes.bool,
  timeout: PropTypes.number,
  userId: PropTypes.string,
  userName: PropTypes.string,
  isStarred: PropTypes.bool,
  editMode: PropTypes.bool,
  water_mark: PropTypes.string,
  noWaterMarkUser: PropTypes.array,
  impressionId: PropTypes.string,
  can_exportCsv: PropTypes.bool,
  can_save_monitor: PropTypes.bool,
  show_top10_record: PropTypes.bool,
};

const defaultProps = {
  initMessages: [],
  dashboard: {},
  slices: {},
  datasources: {},
  filters: {},
  refresh: false,
  timeout: 60,
  userId: '',
  isStarred: false,
  editMode: false,
  can_exportCsv: false,
  can_save_monitor: false,
  show_top10_record: false,
};

function Dashboard(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(Dashboard.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = Dashboard.defaultProps[key];
  });
  const propsRef = useRef(props);
  const refreshTimerRef = useRef(null);
  const firstLoadRef = useRef(true);
  const loadingLogRef = useRef(null);
  const lastViewportWidthRef = useRef(window.innerWidth);
  if (loadingLogRef.current === null) {
    loadingLogRef.current = new ActionLog({
      impressionId: props.impressionId,
      actionType: LOG_ACTIONS_PAGE_LOAD,
      source: 'dashboard',
      sourceId: props.dashboard.id,
      eventNames: [LOG_ACTIONS_LOAD_EVENT, LOG_ACTIONS_RENDER_EVENT]
    });
    Logger.start(loadingLogRef.current);
  }
  const locationSearchParamsRef = useRef(new URLSearchParams(window.location.search));
  const standaloneRef = useRef(locationSearchParamsRef.current.get('standalone_token'));
  const searchSliceRef = useRef(locationSearchParamsRef.current.get('slice_id'));
  const fetchAllSlicesRef = useRef(null);
  const [state, setState] = useState(() => ({
    unsavedChanges: false,
    // showPopover: false,
    // overlayTarget: null,
    showDifyChat: false // 是否显示DifyChat
  }));
  const stateRef = useRef(state);
  stateRef.current = state;
  const updateState = (update, callback) => {
    const previous = stateRef.current;
    const partial = typeof update === 'function' ? update(previous, propsRef.current) : update;
    if (partial == null) return;
    const next = {
      ...previous,
      ...partial
    };
    stateRef.current = next;
    setState(next);
    if (typeof callback === 'function') callback();
  };
  function onBeforeUnload(hasChanged) {
    if (hasChanged) {
      window.addEventListener('beforeunload', unload);
    } else {
      window.removeEventListener('beforeunload', unload);
    }
  }
  function onChange() {
    onBeforeUnload(true);
    updateState({
      unsavedChanges: true
    });
  }
  function onSave() {
    onBeforeUnload(false);
    updateState({
      unsavedChanges: false
    });
  }
  function getAllSlices() {
    return Object.values(propsRef.current.slices);
  }
  function getFormDataExtra(slice) {
    const formDataExtra = Object.assign({}, slice.formData);
    const extraFilters = effectiveExtraFilters(slice.slice_id);
    formDataExtra.extra_filters = formDataExtra.filters.concat(extraFilters);
    return formDataExtra;
  }
  function getFilters(sliceId) {
    return propsRef.current.filters[sliceId];
  }
  function unload() {
    const message = t('You have unsaved changes.');
    window.event.returnValue = message; // Gecko + IE
    return message; // Gecko + Webkit, Safari, Chrome etc.
  }
  function effectiveExtraFilters(sliceId) {
    const metadata = propsRef.current.dashboard.metadata;
    const filters = propsRef.current.filters;
    const f = [];
    const immuneSlices = metadata.filter_immune_slices || [];
    if (sliceId && immuneSlices.includes(sliceId)) {
      // The slice is immune to dashboard filters
      return f;
    }

    // Building a list of fields the slice is immune to filters on
    let immuneToFields = [];
    if (sliceId && metadata.filter_immune_slice_fields && metadata.filter_immune_slice_fields[sliceId]) {
      immuneToFields = metadata.filter_immune_slice_fields[sliceId];
    }
    for (const filteringSliceId in filters) {
      if (filteringSliceId === sliceId.toString()) {
        // Filters applied by the slice don't apply to itself
        continue;
      }
      for (const field in filters[filteringSliceId]) {
        if (!immuneToFields.includes(field)) {
          f.push({
            col: field,
            op: 'in',
            val: filters[filteringSliceId][field]
          });
        }
      }
    }
    return f;
  }
  function refreshExcept(filterKey) {
    const immune = propsRef.current.dashboard.metadata.filter_immune_slices || [];
    let slices = getAllSlices();
    if (filterKey) {
      slices = slices.filter(slice => String(slice.slice_id) !== filterKey && immune.indexOf(slice.slice_id) === -1);
    }
    fetchSlices(slices);
  }
  function stopPeriodicRender() {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }
  function startPeriodicRender(interval) {
    stopPeriodicRender();
    const immune = propsRef.current.dashboard.metadata.timed_refresh_immune_slices || [];
    const refreshAll = () => {
      const affectedSlices = getAllSlices().filter(slice => immune.indexOf(slice.slice_id) === -1);
      fetchSlices(affectedSlices, true, interval * 0.2);
    };
    const fetchAndRender = () => {
      refreshAll();
      if (interval > 0) {
        refreshTimerRef.current = setTimeout(fetchAndRender, interval);
      }
    };
    fetchAndRender();
  }
  function updateDashboardTitle(title) {
    propsRef.current.actions.updateDashboardTitle(title);
    onChange();
  }
  function serialize() {
    return propsRef.current.dashboard.layout.map(reactPos => ({
      slice_id: reactPos.i,
      col: reactPos.x + 1,
      row: reactPos.y,
      size_x: reactPos.w,
      size_y: reactPos.h
    }));
  }
  function addSlicesToDashboard(sliceIds) {
    return propsRef.current.actions.addSlicesToDashboard(propsRef.current.dashboard.id, sliceIds);
  }
  function fetchSlice(slice, force = false) {
    // console.log('slice---', slice);
    return propsRef.current.actions.runQuery(getFormDataExtra(slice), force, propsRef.current.timeout, slice.chartKey);
  }
  function refreshSlice(slice) {
    return propsRef.current.actions.refreshSlice(
      slice,
      // Only send filters contributed by other dashboard slices.  The slice
      // configuration itself must be reloaded from the database; including
      // this chart's in-memory `filters` here would re-introduce values that
      // were removed directly from `slices.params` before the refresh.
      { extra_filters: effectiveExtraFilters(slice.slice_id) },
      propsRef.current.timeout,
    );
  }
  function fetchSlices(slc, force = false, interval = 0) {
    const slices = slc || getAllSlices();
    if (!interval) {
      slices.forEach(slice => {
        fetchSlice(slice, force);
      });
      return;
    }
    const meta = propsRef.current.dashboard.metadata;
    const refreshTime = Math.max(interval, meta.stagger_time || 5000); // default 5 seconds
    if (typeof meta.stagger_refresh !== 'boolean') {
      meta.stagger_refresh = meta.stagger_refresh === undefined ? true : meta.stagger_refresh === 'true';
    }
    const delay = meta.stagger_refresh ? refreshTime / (slices.length - 1) : 0;
    slices.forEach((slice, i) => {
      setTimeout(() => {
        fetchSlice(slice, force);
      }, delay * i);
    });
  }
  if (fetchAllSlicesRef.current === null) {
    fetchAllSlicesRef.current = () => fetchSlices(getAllSlices());
  }
  function exploreChart(slice) {
    const formData = getFormDataExtra(slice);
    exportChart(formData);
  }
  function exportCSV(slice) {
    const formData = getFormDataExtra(slice);
    exportChart(formData, 'csv');
  }
  function rerenderCharts() {
    if (isDashboardResizeSuppressed()) {
      return;
    }
    // Opening/closing a Bootstrap modal temporarily changes the scrollbar and
    // emits resize while the viewport itself remains the same. Ignore that
    // synthetic event so modal interactions do not rerender every slice.
    if (window.innerWidth === lastViewportWidthRef.current) {
      return;
    }
    lastViewportWidthRef.current = window.innerWidth;
    // alert('111');
    getAllSlices().forEach(slice => {
      setTimeout(() => {
        propsRef.current.actions.renderTriggered(new Date().getTime(), slice.chartKey);
      }, 50);
    });
  }
  function filterHtmlToImage(vizType) {
    return function (node) {
      if (node.className === 'chart-controls') {
        return false;
      }
      if (vizType.includes('echarts_')) {
        if (node.tagName === 'DIV' && node.style && node.style.position === 'absolute') {
          // Exclude the node watermark
          return false; // Exclude the node from the captured image
        }
        return true; // Include the node in the captured image
      }
      return true;
    };
  }
  async function html2Image(slice) {
    const vizType = slice.formData.viz_type;
    if (vizType === 'html_set' || vizType === 'iframe' || vizType === 'ckeditor_slice') {
      alert('系统不支持该类图片导出，可使用微信、QQ截图等功能');
      return;
    }
    const elementId = 'cell-' + slice.slice_id;
    const nodeFilter = filterHtmlToImage(vizType);
    try {
      const canvas = await snapdom.toCanvas(document.getElementById(elementId), {
        backgroundColor: 'white',
        filter: nodeFilter,
        // Match html-to-image's filtering: remove nodes instead of keeping spacers.
        filterMode: 'remove'
      });
      const ctx = canvas.getContext('2d');
      if (propsRef.current.water_mark) {
        // 添加水印
        const waterMarkArr = propsRef.current.water_mark.split('|');
        // ctx.font = '23px 思源宋体';
        ctx.font = `${waterMarkArr[9]} ${waterMarkArr[7]}`;
        ctx.fillStyle = `rgba(0, 0, 0, ${waterMarkArr[10]})`;
        ctx.textAlign = 'center';
        ctx.fillText(waterMarkArr[0], canvas.width / 2, canvas.height / 2);
      }
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(image => {
          if (image) {
            resolve(image);
          } else {
            reject(new Error('Failed to encode the slice image as PNG'));
          }
        }, 'image/png');
      });
      const data = [new window.ClipboardItem({
        'image/png': blob
      })];
      await navigator.clipboard.write(data);
      notify.success('图片已复制到剪切板', {
        time: 1500
      });
    } catch (error) {
      console.error('oops, something went wrong!', error);
      notify.error('图片复制失败，请重试或使用截图工具');
    }
  }
  function receiveProps(nextProps) {
    if (firstLoadRef.current && Object.values(nextProps.slices).every(slice => ['rendered', 'failed', 'stopped'].indexOf(slice.chartStatus) > -1)) {
      Logger.end(loadingLogRef.current);
      firstLoadRef.current = false;
    }
  }
  const previousIncomingPropsRef = useRef(incomingProps);
  const incomingKeys = Object.keys(incomingProps);
  const previousIncomingProps = previousIncomingPropsRef.current;
  const incomingPropsChanged = incomingKeys.length !== Object.keys(previousIncomingProps).length || incomingKeys.some(key => incomingProps[key] !== previousIncomingProps[key]);
  if (incomingPropsChanged) {
    receiveProps(props);
    previousIncomingPropsRef.current = incomingProps;
  }
  propsRef.current = props;
  useLayoutEffect(() => {
    // Keep the document scrollbar present while editing a dashboard.  When
    // removing the last row makes the page shorter than the viewport, the
    // scrollbar would otherwise disappear and increase the available width.
    // That width change is reported to every chart as a resize and causes
    // unrelated slices to render again.
    document.documentElement.classList.add('dashboard-page');
    if (!propsRef.current.dashboard.isMobile) {
      window.addEventListener('resize', rerenderCharts);
    }
    // window.addEventListener('resize', this.rerenderCharts);
    if (propsRef.current.water_mark && !propsRef.current.noWaterMarkUser.includes(propsRef.current.userName)) {
      const waterMarkArr = propsRef.current.water_mark.split('|');
      for (const key in propsRef.current.slices) {
        const vizType = propsRef.current.slices[key].formData.viz_type;
        if (vizType === 'markup' || vizType === 'iframe' || vizType === 'ckeditor_slice') {
          continue;
        }
        const parentNode = 'slice_' + key.split('_')[1];
        addWaterMark().load({
          watermark_txt: waterMarkArr[0],
          watermark_parent_node: parentNode,
          watermark_id: parentNode + '-wm',
          watermark_rows: parseInt(waterMarkArr[1], 10),
          watermark_cols: parseInt(waterMarkArr[2], 10),
          watermark_x: parseInt(waterMarkArr[3], 10),
          watermark_y: parseInt(waterMarkArr[4], 10),
          watermark_x_space: parseInt(waterMarkArr[5], 10),
          watermark_y_space: parseInt(waterMarkArr[6], 10),
          watermark_font: waterMarkArr[7],
          watermark_color: waterMarkArr[8],
          watermark_fontsize: waterMarkArr[9],
          watermark_alpha: waterMarkArr[10],
          watermark_width: parseInt(waterMarkArr[11], 10),
          watermark_height: parseInt(waterMarkArr[12], 10),
          watermark_angle: waterMarkArr[13],
          watermark_fontweight: waterMarkArr[14]
        });
      }
    }

    // const queryString = window.location.search;
    // const searchParams = new URLSearchParams(queryString);
    // const searchSlice = searchParams.get("slice_id");
    if (searchSliceRef.current) {
      const scrollElementId = '#cell-' + searchSliceRef.current;
      // const scrollElement = document.getElementById(scrollElementId);
      // const scrollTop = scrollElement.offsetTop;
      // window.scrollTo(0, scrollTop);
      document.querySelector(scrollElementId).scrollIntoView({
        behavior: 'smooth',
        // 定义过渡动画 instant立刻跳过去 smooth平滑过渡过去
        block: 'center',
        // 定义垂直滚动方向的对齐 start顶部 center中间 end（底部）
        inline: 'center' // 定义水平滚动方向的对齐
      });
      // console.log('触发滚动', scrollTop);
      console.log('触发滚动');
    }
    return () => {
      document.documentElement.classList.remove('dashboard-page');
      window.removeEventListener('resize', rerenderCharts);
      window.removeEventListener('beforeunload', unload);
      stopPeriodicRender();
    };
    // The mount lifecycle intentionally captures the stable ref-backed handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const previousCommitRef = useRef();
  useLayoutEffect(() => {
    if (previousCommitRef.current) {
      const {
        props: prevProps
      } = previousCommitRef.current;
      if (propsRef.current.refresh) {
        let changedFilterKey;
        const prevFiltersKeySet = new Set(Object.keys(prevProps.filters));
        Object.keys(propsRef.current.filters).some(key => {
          prevFiltersKeySet.delete(key);
          if (prevProps.filters[key] === undefined || !areObjectsEqual(prevProps.filters[key], propsRef.current.filters[key])) {
            changedFilterKey = key;
            return true;
          }
          return false;
        });
        // has changed filter or removed a filter?
        if (!!changedFilterKey || prevFiltersKeySet.size) {
          refreshExcept(changedFilterKey);
        }
      }
    }
    previousCommitRef.current = {
      props: props,
      state: state
    };
  });
  return <div id="dashboard-container">
        {!standaloneRef.current && <div id="dashboard-header">
          <AlertsWrapper initMessages={propsRef.current.initMessages} />
          <Header dashboard={propsRef.current.dashboard} unsavedChanges={stateRef.current.unsavedChanges} filters={propsRef.current.filters} userId={propsRef.current.userId} isStarred={propsRef.current.isStarred} updateDashboardTitle={updateDashboardTitle} onSave={onSave} onChange={onChange} serialize={serialize} fetchFaveStar={propsRef.current.actions.fetchFaveStar} saveFaveStar={propsRef.current.actions.saveFaveStar} renderSlices={fetchAllSlicesRef.current} startPeriodicRender={startPeriodicRender} addSlicesToDashboard={addSlicesToDashboard} editMode={propsRef.current.editMode} setEditMode={propsRef.current.actions.setEditMode} />
        </div>}
        <div id="grid-container" className="slice-grid gridster">
          <GridLayout dashboard={propsRef.current.dashboard} datasources={propsRef.current.datasources} filters={propsRef.current.filters} charts={propsRef.current.slices} timeout={propsRef.current.timeout} onChange={onChange} getFormDataExtra={getFormDataExtra} exploreChart={exploreChart} exportCSV={exportCSV} html2Image={html2Image}
      // showChartForTimeTable={this.showChartForTimeTable}
      can_exportCsv={propsRef.current.can_exportCsv} can_save_monitor={propsRef.current.can_save_monitor} show_top10_record={propsRef.current.show_top10_record} fetchSlice={fetchSlice} refreshSlice={refreshSlice} saveSlice={propsRef.current.actions.saveSlice} saveSliceFormData={propsRef.current.actions.saveSliceFormData} removeSlice={propsRef.current.actions.removeSlice} removeChart={propsRef.current.actions.removeChart} updateDashboardLayout={propsRef.current.actions.updateDashboardLayout} toggleExpandSlice={propsRef.current.actions.toggleExpandSlice} addFilter={propsRef.current.actions.addFilter} getFilters={getFilters} clearFilter={propsRef.current.actions.clearFilter} removeFilter={propsRef.current.actions.removeFilter} editMode={propsRef.current.editMode} />
        </div>
      </div>;
}



Dashboard.propTypes = propTypes;
Dashboard.defaultProps = defaultProps;

export default Dashboard;
