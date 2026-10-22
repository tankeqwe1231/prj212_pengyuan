/* eslint camelcase: 0 */
import React, { useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import ExploreChartPanel from './ExploreChartPanel';
import ControlPanelsContainer from './ControlPanelsContainer';
import SaveModal from './SaveModal';
import QueryAndSaveBtns from './QueryAndSaveBtns';
import { getExploreUrlAndPayload, getExploreLongUrl } from '../exploreUtils';
import { areObjectsEqual } from '../../reduxUtils';
import {
  getFormDataFromControls,
  getFormDataFromControlsAndRaw,
} from '../stores/store';
import { chartPropType } from '../../chart/chartReducer';
import * as exploreActions from '../actions/exploreActions';
import * as saveModalActions from '../actions/saveModalActions';
import * as chartActions from '../../chart/chartAction';
import { Logger, ActionLog, LOG_ACTIONS_PAGE_LOAD,
  LOG_ACTIONS_LOAD_EVENT, LOG_ACTIONS_RENDER_EVENT } from '../../logger';

const propTypes = {
  actions: PropTypes.object.isRequired,
  datasource_type: PropTypes.string.isRequired,
  isDatasourceMetaLoading: PropTypes.bool.isRequired,
  chart: PropTypes.shape(chartPropType).isRequired,
  slice: PropTypes.object,
  controls: PropTypes.object.isRequired,
  forcedHeight: PropTypes.string,
  form_data: PropTypes.object.isRequired,
  standalone: PropTypes.bool.isRequired,
  timeout: PropTypes.number,
  impressionId: PropTypes.string,
};

function ExploreViewContainer(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(ExploreViewContainer.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = ExploreViewContainer.defaultProps[key];
  });
  const propsRef = useRef(props);
  const loadingLogRef = useRef(new ActionLog({
    impressionId: props.impressionId,
    actionType: LOG_ACTIONS_PAGE_LOAD,
    source: 'slice',
    sourceId: props.slice ? props.slice.slice_id : 0,
    eventNames: [LOG_ACTIONS_LOAD_EVENT, LOG_ACTIONS_RENDER_EVENT]
  }));
  const [state, setState] = useState(() => (() => {
    Logger.start(loadingLogRef.current);
    return {
      height: getHeight(),
      width: getWidth(),
      showModal: false,
      chartIsStale: false,
      refreshOverlayVisible: false
    };
  })());
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
  const firstLoadRef = useRef(true);
  const resizeTimerRef = useRef(undefined);
  function onQuery() {
    // remove alerts when query
    propsRef.current.actions.removeControlPanelAlert();
    propsRef.current.actions.triggerQuery(true, propsRef.current.chart.chartKey);
    updateState({
      chartIsStale: false,
      refreshOverlayVisible: false
    });
    addHistory({});
  }
  function onDismissRefreshOverlay() {
    updateState({
      refreshOverlayVisible: false
    });
  }
  function onStop() {
    return propsRef.current.chart.queryRequest.abort();
  }
  function getWidth() {
    return `${window.innerWidth}px`;
  }
  function getHeight() {
    if (propsRef.current.forcedHeight) {
      return propsRef.current.forcedHeight + 'px';
    }
    const navHeight = propsRef.current.standalone ? 0 : 90;
    return `${window.innerHeight - navHeight}px`;
  }
  function findChangedControlKeys(prevControls, currentControls) {
    return Object.keys(currentControls).filter(key => typeof prevControls[key] !== 'undefined' && !areObjectsEqual(currentControls[key].value, prevControls[key].value));
  }
  function hasDisplayControlChanged(changedControlKeys, currentControls) {
    return changedControlKeys.some(key => currentControls[key].renderTrigger);
  }
  function hasQueryControlChanged(changedControlKeys, currentControls) {
    return changedControlKeys.some(key => !currentControls[key].renderTrigger && !currentControls[key].dontRefreshOnChange);
  }
  function triggerQueryIfNeeded() {
    if (propsRef.current.chart.triggerQuery && !hasErrors()) {
      propsRef.current.actions.runQuery(propsRef.current.form_data, false, propsRef.current.timeout, propsRef.current.chart.chartKey);
    }
  }
  function addHistory({
    isReplace = false,
    title
  }) {
    const {
      payload
    } = getExploreUrlAndPayload({
      formData: propsRef.current.form_data
    });
    const longUrl = getExploreLongUrl(propsRef.current.form_data);
    if (isReplace) {
      history.replaceState(payload, title, longUrl);
    } else {
      history.pushState(payload, title, longUrl);
    }

    // it seems some browsers don't support pushState title attribute
    if (title) {
      document.title = title;
    }
  }
  function handleResize() {
    clearTimeout(resizeTimerRef.current);
    resizeTimerRef.current = setTimeout(() => {
      updateState({
        height: getHeight(),
        width: getWidth()
      });
    }, 250);
  }
  function handlePopstate() {
    const formData = history.state;
    if (formData && Object.keys(formData).length) {
      propsRef.current.actions.setExploreControls(formData);
      propsRef.current.actions.runQuery(formData, false, propsRef.current.timeout, propsRef.current.chart.chartKey);
    }
  }
  function toggleModal() {
    updateState({
      showModal: !stateRef.current.showModal
    });
  }
  function hasErrors() {
    const ctrls = propsRef.current.controls;
    return Object.keys(ctrls).some(k => ctrls[k].validationErrors && ctrls[k].validationErrors.length > 0);
  }
  function renderErrorMessage() {
    // Returns an error message as a node if any errors are in the store
    const errors = [];
    for (const controlName in propsRef.current.controls) {
      const control = propsRef.current.controls[controlName];
      if (control.validationErrors && control.validationErrors.length > 0) {
        errors.push(<div key={controlName}>
            <strong>{`[ ${control.label} ] `}</strong>
            {control.validationErrors.join('. ')}
          </div>);
      }
    }
    let errorMessage;
    if (errors.length > 0) {
      errorMessage = <div style={{
        textAlign: 'left'
      }}>{errors}</div>;
    }
    return errorMessage;
  }
  function renderChartContainer() {
    return <ExploreChartPanel width={stateRef.current.width} height={stateRef.current.height} {...propsRef.current} errorMessage={renderErrorMessage()} refreshOverlayVisible={stateRef.current.refreshOverlayVisible} addHistory={addHistory} onQuery={onQuery.bind(undefined)} onDismissRefreshOverlay={onDismissRefreshOverlay.bind(undefined)} />;
  }
  function receiveProps(prevProps, np, changedControlKeys) {
    if (firstLoadRef.current && ['rendered', 'failed', 'stopped'].indexOf(np.chart.chartStatus) > -1) {
      Logger.end(loadingLogRef.current);
      firstLoadRef.current = false;
    }
    if (np.controls.viz_type.value !== prevProps.controls.viz_type.value) {
      np.actions.resetControls();
      np.actions.triggerQuery(true, np.chart.chartKey);
    }
    if (np.controls.datasource.value !== prevProps.controls.datasource.value) {
      np.actions.fetchDatasourceMetadata(np.form_data.datasource, true);
    }
    if (hasDisplayControlChanged(changedControlKeys, np.controls)) {
      np.actions.updateQueryFormData(getFormDataFromControls(np.controls), np.chart.chartKey);
      np.actions.renderTriggered(new Date().getTime(), np.chart.chartKey);
    }
    if (hasQueryControlChanged(changedControlKeys, np.controls)) {
      updateState({
        chartIsStale: true,
        refreshOverlayVisible: true
      });
    }
  }
  propsRef.current = props;
  useLayoutEffect(() => {
    window.addEventListener('resize', handleResize);
    window.addEventListener('popstate', handlePopstate);
    addHistory({
      isReplace: true
    });
    const navbarElement = document.querySelector('.navbar-collapse.collapse');
    const topHeight = navbarElement ? navbarElement.clientHeight : 0;
    console.log('ExploreViewContainer topHeight:', topHeight);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('popstate', handlePopstate);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const previousCommitRef = useRef();
  useLayoutEffect(() => {
    if (previousCommitRef.current) {
      const { props: prevProps } = previousCommitRef.current;
      const changedControlKeys = findChangedControlKeys(prevProps.controls, propsRef.current.controls);
      receiveProps(prevProps, propsRef.current, changedControlKeys);
      triggerQueryIfNeeded();
      if (hasDisplayControlChanged(changedControlKeys, propsRef.current.controls)) {
        addHistory({});
      }
    }
    previousCommitRef.current = {
      props: props,
      state: state
    };
  });
  if (propsRef.current.standalone) {
    return renderChartContainer();
  }
  return <div id="explore-container" className="container-fluid" style={{
    height: stateRef.current.height,
    overflow: 'hidden'
  }}>
        {stateRef.current.showModal && <SaveModal onHide={toggleModal.bind(undefined)} actions={propsRef.current.actions} form_data={propsRef.current.form_data} />}
        <div className="row">
          <div className="col-sm-4">
            <QueryAndSaveBtns canAdd="True" onQuery={onQuery.bind(undefined)} onSave={toggleModal.bind(undefined)} onStop={onStop.bind(undefined)} loading={propsRef.current.chart.chartStatus === 'loading'} chartIsStale={stateRef.current.chartIsStale} errorMessage={renderErrorMessage()} />
            <br />
            <ControlPanelsContainer actions={propsRef.current.actions} form_data={propsRef.current.form_data} controls={propsRef.current.controls} datasource_type={propsRef.current.datasource_type} isDatasourceMetaLoading={propsRef.current.isDatasourceMetaLoading} />
          </div>
          <div className="col-sm-8">
            {renderChartContainer()}
          </div>
        </div>
      </div>;
}



ExploreViewContainer.propTypes = propTypes;

function mapStateToProps({ explore, charts, impressionId }) {
  const form_data = getFormDataFromControlsAndRaw(
    explore.controls,
    explore.rawFormData,
  );
  const chartKey = Object.keys(charts)[0];
  const chart = charts[chartKey];
  return {
    isDatasourceMetaLoading: explore.isDatasourceMetaLoading,
    datasource: explore.datasource,
    datasource_type: explore.datasource.type,
    datasourceId: explore.datasource_id,
    controls: explore.controls,
    can_overwrite: !!explore.can_overwrite,
    can_download: !!explore.can_download,
    column_formats: explore.datasource ? explore.datasource.column_formats : null,
    containerId: explore.slice ? `slice-container-${explore.slice.slice_id}` : 'slice-container',
    isStarred: explore.isStarred,
    slice: explore.slice,
    form_data,
    table_name: form_data.datasource_name,
    vizType: form_data.viz_type,
    standalone: explore.standalone,
    forcedHeight: explore.forced_height,
    chart,
    timeout: explore.common.conf.SUPERSET_WEBSERVER_TIMEOUT,
    impressionId,
  };
}

function mapDispatchToProps(dispatch) {
  const actions = Object.assign({}, exploreActions, saveModalActions, chartActions);
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export { ExploreViewContainer };
export default connect(mapStateToProps, mapDispatchToProps)(ExploreViewContainer);
