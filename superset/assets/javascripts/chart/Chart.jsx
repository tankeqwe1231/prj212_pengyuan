/* eslint camelcase: 0 */
import React, { useCallback, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Mustache from 'mustache';
import { Tooltip } from 'react-bootstrap';

import ChartBody from './ChartBody';
import Loading from '../components/Loading';
import { Logger, LOG_ACTIONS_RENDER_EVENT } from '../logger';
import StackTraceMessage from '../components/StackTraceMessage';
import RefreshChartOverlay from '../components/RefreshChartOverlay';
import visMap from '../../visualizations/main';
import sandboxedEval from '../modules/sandbox';
import './chart.css';

const propTypes = {
  annotationData: PropTypes.object,
  actions: PropTypes.object,
  chartKey: PropTypes.string.isRequired,
  containerId: PropTypes.string.isRequired,
  datasource: PropTypes.object.isRequired,
  formData: PropTypes.object.isRequired,
  headerHeight: PropTypes.number,
  height: PropTypes.number,
  width: PropTypes.number,
  setControlValue: PropTypes.func,
  timeout: PropTypes.number,
  vizType: PropTypes.string.isRequired,
  editMode: PropTypes.bool,
  chartAlert: PropTypes.string,
  chartStatus: PropTypes.string,
  chartUpdateEndTime: PropTypes.number,
  chartUpdateStartTime: PropTypes.number,
  latestQueryFormData: PropTypes.object,
  queryRequest: PropTypes.object,
  queryResponse: PropTypes.object,
  lastRendered: PropTypes.number,
  triggerQuery: PropTypes.bool,
  refreshOverlayVisible: PropTypes.bool,
  errorMessage: PropTypes.node,
  addFilter: PropTypes.func,
  getFilters: PropTypes.func,
  clearFilter: PropTypes.func,
  removeFilter: PropTypes.func,
  onQuery: PropTypes.func,
  onDismissRefreshOverlay: PropTypes.func,
};

const defaultProps = {
  addFilter: () => ({}),
  getFilters: () => ({}),
  clearFilter: () => ({}),
  removeFilter: () => ({}),
};

const resolveProps = incomingProps => {
  const {
    addFilter = defaultProps.addFilter,
    getFilters = defaultProps.getFilters,
    clearFilter = defaultProps.clearFilter,
    removeFilter = defaultProps.removeFilter,
  } = incomingProps;
  return {
    ...incomingProps,
    addFilter,
    getFilters,
    clearFilter,
    removeFilter,
  };
};

function ChartWithRef(incomingProps, ref) {
  const props = resolveProps(incomingProps);
  const propsRef = useRef(props);
  propsRef.current = props;
  const containerRef = useRef(null);
  const facadeRef = useRef(null);
  const imperativeApiRef = useRef(null);
  const [state, setState] = useState({ tooltip: null, errorMsg: null });

  const width = useCallback(() => {
    const element = containerRef.current && containerRef.current.get(0);
    return propsRef.current.width || (element ? element.offsetWidth : 0);
  }, []);
  const headerHeight = useCallback(() => propsRef.current.headerHeight || 0, []);
  const height = useCallback(() => {
    const element = containerRef.current && containerRef.current.get(0);
    return propsRef.current.height || (element ? element.offsetHeight : 0);
  }, []);
  const getFilters = useCallback(() => propsRef.current.getFilters(), []);
  const setTooltip = useCallback(tooltip => {
    setState(previous => ({ ...previous, tooltip }));
  }, []);
  const addFilter = useCallback((col, vals, merge = true, refresh = true) => {
    return propsRef.current.addFilter(col, vals, merge, refresh);
  }, []);
  const clearFilter = useCallback(() => propsRef.current.clearFilter(), []);
  const removeFilter = useCallback((col, vals, refresh = true) => {
    return propsRef.current.removeFilter(col, vals, refresh);
  }, []);
  const clearError = useCallback(() => {
    setState(previous => ({ ...previous, errorMsg: null }));
  }, []);
  const error = useCallback(e => {
    propsRef.current.actions.chartRenderingFailed(e, propsRef.current.chartKey);
  }, []);
  const renderTemplate = useCallback(s => Mustache.render(s, {
    width: width(),
    height: height(),
  }), [height, width]);
  const renderViz = useCallback(() => {
    const currentProps = propsRef.current;
    const viz = visMap[currentProps.vizType];
    const fd = currentProps.formData;
    const qr = currentProps.queryResponse;
    const renderStart = Logger.getTimestamp();
    try {
      if (fd.js_data) {
        qr.data = sandboxedEval(fd.js_data)(qr.data);
      }
      viz(facadeRef.current, qr, currentProps.setControlValue);
      Logger.append(LOG_ACTIONS_RENDER_EVENT, {
        label: currentProps.chartKey,
        vis_type: currentProps.vizType,
        start_offset: renderStart,
        duration: Logger.getTimestamp() - renderStart,
      });
      currentProps.actions.chartRenderingSucceeded(currentProps.chartKey);
    } catch (e) {
      currentProps.actions.chartRenderingFailed(e, currentProps.chartKey);
    }
  }, []);

  if (facadeRef.current === null) {
    facadeRef.current = {};
    Object.defineProperties(facadeRef.current, {
      props: { enumerable: true, get: () => propsRef.current },
      annotationData: { enumerable: true, get: () => propsRef.current.annotationData },
      containerId: { enumerable: true, get: () => propsRef.current.containerId },
      container_id: { enumerable: true, get: () => propsRef.current.containerId },
      selector: { enumerable: true, get: () => `#${propsRef.current.containerId}` },
      formData: { enumerable: true, get: () => propsRef.current.formData },
      datasource: { enumerable: true, get: () => propsRef.current.datasource },
      container: { enumerable: true, get: () => containerRef.current },
    });
    Object.assign(facadeRef.current, {
      width,
      height,
      headerHeight,
      getFilters,
      setTooltip,
      addFilter,
      clearFilter,
      removeFilter,
      clearError,
      error,
      render_template: renderTemplate,
    });
  }
  if (imperativeApiRef.current === null) {
    imperativeApiRef.current = { renderViz };
  }
  useImperativeHandle(ref, () => imperativeApiRef.current, []);

  useLayoutEffect(() => {
    if (propsRef.current.triggerQuery) {
      propsRef.current.actions.runQuery(propsRef.current.formData, false, propsRef.current.timeout, propsRef.current.chartKey);
    }
    // The mount lifecycle intentionally uses the initial query props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const previousPropsRef = useRef(null);
  useLayoutEffect(() => {
    const previousProps = previousPropsRef.current;
    if (previousProps && propsRef.current.queryResponse && ['success', 'rendered'].indexOf(propsRef.current.chartStatus) > -1 && !propsRef.current.queryResponse.error && (previousProps.annotationData !== propsRef.current.annotationData || previousProps.queryResponse !== propsRef.current.queryResponse || previousProps.height !== propsRef.current.height || previousProps.width !== propsRef.current.width || previousProps.lastRendered !== propsRef.current.lastRendered)) {
      imperativeApiRef.current.renderViz();
    }
    previousPropsRef.current = propsRef.current;
  });

  const isLoading = props.chartStatus === 'loading';
  /* eslint-disable react/no-danger */
  const renderTooltip = state.tooltip ? <Tooltip className="chart-tooltip" id="chart-tooltip" placement="right" positionTop={state.tooltip.y - 10} positionLeft={state.tooltip.x + 30} arrowOffsetTop={10}>
    <div dangerouslySetInnerHTML={{ __html: state.tooltip.content }} />
  </Tooltip> : null;
  /* eslint-enable react/no-danger */

  return <div className={`token col-md-12 ${isLoading ? 'is-loading' : ''}`}>
    {renderTooltip}
    {isLoading && <Loading size={25} />}
    {props.chartAlert && <StackTraceMessage message={props.chartAlert} queryResponse={props.queryResponse} />}
    {!isLoading && !props.chartAlert && props.refreshOverlayVisible && !props.errorMessage && containerRef.current && <RefreshChartOverlay height={height()} width={width()} onQuery={props.onQuery} onDismiss={props.onDismissRefreshOverlay} />}
    {!isLoading && !props.chartAlert && <ChartBody containerId={props.containerId} vizType={props.vizType} height={height} width={width} faded={props.refreshOverlayVisible && !props.errorMessage} ref={containerRef} editMode={props.editMode} />}
  </div>;
}

const Chart = React.forwardRef(ChartWithRef);

Chart.propTypes = propTypes;

export default Chart;
