import React, { useCallback, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';

import { t } from '../../locales';
import EditableTitle from '../../components/EditableTitle';
import TooltipWrapper from '../../components/TooltipWrapper';
// import FaveStar from '../../components/FaveStar';
import SaveMonitorModal from './SaveMonitorModal';
import ChartFullScreenModal from './ChartFullScreenModal';
import ShowTop10RecordModal from './ShowTop10RecordModal';
import SaveChartModal from './SaveChartModal';

const propTypes = {
  slice: PropTypes.object.isRequired,
  isExpanded: PropTypes.bool,
  isCached: PropTypes.bool,
  cachedDttm: PropTypes.string,
  removeSlice: PropTypes.func,
  updateSliceName: PropTypes.func,
  toggleExpandSlice: PropTypes.func,
  forceRefresh: PropTypes.func,
  exploreChart: PropTypes.func,
  exportCSV: PropTypes.func,
  html2Image: PropTypes.func,
  editMode: PropTypes.bool,
  sliceExplorePerm: PropTypes.bool,
  annotationQuery: PropTypes.object,
  annotationError: PropTypes.object,
  can_exportCsv: PropTypes.bool,
  can_save_monitor: PropTypes.bool,
  show_top10_record: PropTypes.bool,
};

const defaultProps = {
  forceRefresh: () => ({}),
  removeSlice: () => ({}),
  updateSliceName: () => ({}),
  toggleExpandSlice: () => ({}),
  exploreChart: () => ({}),
  exportCSV: () => ({}),
  html2Image: () => ({}),
  editMode: false,
};

const NO_FULL_SCREEN_VIZ_TYPES = ['markup', 'html_set', 'ckeditor_slice', 'filter_box'];

function SliceHeader(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(SliceHeader.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = SliceHeader.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    showSaveChartModal: false
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
  const standaloneRef = useRef(new URLSearchParams(window.location.search).get('standalone_token'));
  const html2Image = useCallback(() => {
    propsRef.current.html2Image(propsRef.current.slice);
  }, []);
  const exportCSV = useCallback(() => {
    propsRef.current.exportCSV(propsRef.current.slice);
  }, []);
  const exploreChart = useCallback(() => {
    propsRef.current.exploreChart(propsRef.current.slice);
  }, []);
  const forceRefresh = useCallback(() => {
    propsRef.current.forceRefresh(propsRef.current.slice.slice_id);
  }, []);
  const removeSlice = useCallback(() => {
    propsRef.current.removeSlice(propsRef.current.slice);
  }, []);
  function onSaveTitle(newTitle) {
    if (propsRef.current.updateSliceName) {
      propsRef.current.updateSliceName(propsRef.current.slice.slice_id, newTitle);
    }
  }
  function onToggleExpandSlice() {
    propsRef.current.toggleExpandSlice(propsRef.current.slice, !propsRef.current.isExpanded);
  }
  function addToPrivateDashboard() {
    updateState({
      showSaveChartModal: true
    });
  }
  function hideSaveChartModal() {
    updateState({
      showSaveChartModal: false
    });
  }
  propsRef.current = props;
  const slice = propsRef.current.slice;
  const warnIndexSet = new Set();
  let warnCol = null;
  (slice.formData.filters || []).forEach(filter => {
    if (filter.col.includes('指标名') || filter.col.includes('品名')) {
      warnCol = filter.col;
      if (filter.op === 'in' && Array.isArray(filter.val)) {
        filter.val.forEach(value => warnIndexSet.add(value));
      } else if (filter.op === '==') {
        warnIndexSet.add(filter.val);
      }
    }
  });
  const warnIndexList = [...warnIndexSet];
  const isCached = propsRef.current.isCached;
  const cachedWhen = moment.utc(propsRef.current.cachedDttm).fromNow();
  const refreshTooltip = isCached ? t('Served from data cached %s . Click to refresh chart configuration and data.', cachedWhen) : t('Refresh chart configuration and data');
  const annoationsLoading = t('Annotation layers are still loading.');
  const annoationsError = t('One ore more annotation layers failed loading.');
  return <div className="row chart-header">
        <div className="col-md-12">
          <div className="header">
            <EditableTitle title={slice.slice_name} canEdit={!!propsRef.current.updateSliceName && propsRef.current.editMode} onSaveTitle={onSaveTitle} noPermitTooltip={"You don't have the rights to alter this dashboard."} />
            {!!Object.values(propsRef.current.annotationQuery || {}).length && <TooltipWrapper label="annotations-loading" placement="top" tooltip={annoationsLoading}>
                <i className="fa fa-refresh warning" />
              </TooltipWrapper>}
            {!!Object.values(propsRef.current.annotationError || {}).length && <TooltipWrapper label="annoation-errors" placement="top" tooltip={annoationsError}>
                <i className="fa fa-exclamation-circle danger" />
              </TooltipWrapper>}
            {slice.formData.chart_description1 && <TooltipWrapper label="chart-description1" placement="top" tooltip={slice.formData.chart_description1}>
                <i className="fa fa-info-circle" />
              </TooltipWrapper>}
          </div>
          {slice.formData.slice_data_from && <div className="sliceDataFrom">{slice.formData.slice_data_from}</div>}
          {!standaloneRef.current && <div className="chart-controls">
              <div id={'controls_' + slice.slice_id} className="float-end">
                {propsRef.current.editMode && <a>
                    <TooltipWrapper placement="top" label="move" tooltip={t('Move chart')}>
                      <i className="fa fa-arrows drag" />
                    </TooltipWrapper>
                  </a>}
                <a className={`refresh ${isCached ? 'danger' : ''}`} onClick={forceRefresh}>
                  <TooltipWrapper placement="top" label="refresh" tooltip={refreshTooltip}>
                    <i className="fa fa-repeat" />
                  </TooltipWrapper>
                </a>
                {propsRef.current.sliceExplorePerm && <a className="exploreChart" onClick={exploreChart}>
                  <TooltipWrapper placement="top" label="exploreChart" tooltip={t('编辑图表')}>
                    <i className="fa fa-edit" />
                  </TooltipWrapper>
                </a>}
                <a className="addToPrivateDashboard" onClick={addToPrivateDashboard}>
                  <TooltipWrapper placement="top" label="addToPrivateDashboard" tooltip={t('收藏')}>
                    <i className="fa fa-star-o" />
                  </TooltipWrapper>
                </a>
                {propsRef.current.show_top10_record && <a className="showTop10Record">
                    <ShowTop10RecordModal slice={slice} formData={propsRef.current.formData} triggerNode={<TooltipWrapper placement="top" label="showTop10Record" tooltip={t('显示最近10条原始数据')}>
                          <i className="fa fa-list-ol" />
                        </TooltipWrapper>} />
                  </a>}
                {slice.description && <a onClick={onToggleExpandSlice}>
                    <TooltipWrapper placement="top" label="description" tooltip={t('Toggle chart description')}>
                      <i className="fa fa-info-circle slice_info" />
                    </TooltipWrapper>
                  </a>}
                {propsRef.current.can_exportCsv && <a className="exportCSV" onClick={exportCSV}>
                    <TooltipWrapper placement="top" label="exportCSV" tooltip={t('Export xlsx')}>
                      <i className="fa fa-table" />
                    </TooltipWrapper>
                  </a>}
                <a className="saveImage" onClick={html2Image}>
                  <TooltipWrapper placement="top" label="saveImage" tooltip={t('saveImage')}>
                    <i className="fa fa-file-image-o" />
                  </TooltipWrapper>
                </a>
                {propsRef.current.can_save_monitor && <a className="saveMonitor">
                    <SaveMonitorModal dashboardId={propsRef.current.dashboardId} slice={propsRef.current.slice} warnIndexList={warnIndexList} warnCol={warnCol} triggerNode={<TooltipWrapper placement="top" label="saveMonitor" tooltip={t('预警')}>
                          <i className="fa fa-bell" />
                        </TooltipWrapper>} />
                  </a>}

                {NO_FULL_SCREEN_VIZ_TYPES.indexOf(slice.formData.viz_type) === -1 && <a className="fullScreen">
                    <ChartFullScreenModal dashboardId={propsRef.current.dashboardId} slice={propsRef.current.slice} formData={propsRef.current.formData} datasource={propsRef.current.datasource} triggerNode={<TooltipWrapper placement="top" label="fullScreen" tooltip={t('全屏显示')}>
                          <i className="fa fa-arrows-alt" />
                        </TooltipWrapper>} />
                  </a>}

                {propsRef.current.editMode && <a className="remove-chart" onClick={removeSlice}>
                    <TooltipWrapper placement="top" label="close" tooltip={t('Remove chart from dashboard')}>
                      <i className="fa fa-close" />
                    </TooltipWrapper>
                  </a>}
              </div>
            </div>}
        </div>
        {stateRef.current.showSaveChartModal && <SaveChartModal slice={propsRef.current.slice} onHide={hideSaveChartModal} form_data={propsRef.current.formData} />}
      </div>;
}



SliceHeader.propTypes = propTypes;
SliceHeader.defaultProps = defaultProps;

export default SliceHeader;
