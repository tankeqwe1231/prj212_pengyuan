/* eslint camelcase: 0 */
import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Mustache from 'mustache';
import $ from 'jquery';

import { getExploreUrlAndPayload, getAnnotationJsonUrl } from '../explore/exploreUtils';
import ChartBody from './ChartBody';
import visMap from '../../visualizations/main';
import './chart.css';
import { ANNOTATION_SOURCE_TYPES } from '../modules/AnnotationTypes';
import Loading from '../components/Loading';

const FULL_SCREEN_WIDTH_RATIO = 0.9;

const propTypes = {
  chartKey: PropTypes.string.isRequired,
  containerId: PropTypes.string.isRequired,
  datasource: PropTypes.object.isRequired,
  formData: PropTypes.object.isRequired,
  height: PropTypes.number,
  width: PropTypes.number,
  sliceId: PropTypes.number,
  setControlValue: PropTypes.func,
  vizType: PropTypes.string.isRequired,
};

function ChartFullScreen(props) {
  const propsRef = useRef(props);
  propsRef.current = props;
  const [isLoading, setIsLoading] = useState(true);
  const annotationDataRef = useRef({});
  const queryResponseRef = useRef({});
  const screenWidthRef = useRef(document.documentElement.clientWidth);
  const screenHeightRef = useRef(window.innerHeight);
  const containerRef = useRef(null);
  const facadeRef = useRef(null);
  const queryRequestsRef = useRef([]);

  const width = useCallback(() => Math.floor(screenWidthRef.current * FULL_SCREEN_WIDTH_RATIO) - 10, []);
  const height = useCallback(() => Math.floor(screenHeightRef.current * 0.95) - 45, []);
  const getFilters = useCallback(() => ({}), []);
  const addFilter = useCallback(() => ({}), []);
  const clearFilter = useCallback(() => ({}), []);
  const removeFilter = useCallback(() => ({}), []);
  const setTooltip = useCallback(() => {}, []);
  const clearError = useCallback(() => {}, []);
  const error = useCallback(() => {}, []);
  const renderTemplate = useCallback(s => Mustache.render(s, {
    width: width(),
    height: height(),
  }), [height, width]);
  const renderViz = useCallback(() => {
    const currentProps = propsRef.current;
    const viz = visMap[currentProps.vizType];
    try {
      setIsLoading(false);
      viz(facadeRef.current, queryResponseRef.current, currentProps.setControlValue);
    } catch (e) {
      error(e);
    }
  }, [error]);
  const runQueryFullScreen = useCallback((formData, force = true, timeout = 60) => {
    const { url, payload } = getExploreUrlAndPayload({
      formData,
      endpointType: 'json',
      force,
    });
    const request = $.ajax({
      type: 'POST',
      url,
      dataType: 'json',
      data: {
        form_data: JSON.stringify(payload),
      },
      timeout: timeout * 1000,
      success: data => {
        queryResponseRef.current = data;
        renderViz();
      },
    });
    queryRequestsRef.current.push(request);
  }, [renderViz]);
  const runAnnotationQuery = useCallback((annotation, timeout = 60, formData = null) => {
    if (!annotation.sourceType) return;
    const sliceFormData = Object.keys(annotation.overrides).reduce((result, key) => ({
      ...result,
      [key]: annotation.overrides[key] || formData[key],
    }), {});
    const isNative = annotation.sourceType === ANNOTATION_SOURCE_TYPES.NATIVE;
    const request = $.ajax({
      url: getAnnotationJsonUrl(annotation.value, sliceFormData, isNative),
      dataType: 'json',
      timeout: timeout * 1000,
      success: data => {
        annotationDataRef.current[annotation.name] = data.data;
        renderViz();
      },
    });
    queryRequestsRef.current.push(request);
  }, [renderViz]);

  if (facadeRef.current === null) {
    facadeRef.current = {};
    Object.defineProperties(facadeRef.current, {
      props: { enumerable: true, get: () => propsRef.current },
      annotationData: { enumerable: true, get: () => annotationDataRef.current },
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
      headerHeight: () => 0,
      getFilters,
      addFilter,
      clearFilter,
      removeFilter,
      setTooltip,
      clearError,
      error,
      render_template: renderTemplate,
    });
  }

  useLayoutEffect(() => {
    const formData = propsRef.current.formData;
    runQueryFullScreen(formData, true, 60);
    (formData.annotation_layers || []).forEach(annotation => {
      runAnnotationQuery(annotation, 60, formData);
    });
    const modalTop = (screenHeightRef.current - Math.floor(screenHeightRef.current * 0.95)) / 2;
    $('.ChartFullScreenDialog').css({
      width: `${FULL_SCREEN_WIDTH_RATIO * 100}vw`,
      maxWidth: `${FULL_SCREEN_WIDTH_RATIO * 100}vw`,
      margin: `${modalTop}px auto`,
    });
    $('.ChartFullScreenDialog .modal-content').css({
      height: Math.floor(screenHeightRef.current * 0.95),
    });
    $('.ChartFullScreenDialog .modal-header').css({ padding: '2px' });
    $('.ChartFullScreenDialog .modal-body').css({ padding: '2px' });
    return () => {
      queryRequestsRef.current.forEach(request => request.abort());
      queryRequestsRef.current = [];
    };
  }, [runAnnotationQuery, runQueryFullScreen]);

  return <div>
    {isLoading && <Loading size={35} />}
    <ChartBody containerId={props.containerId} vizType={props.vizType} height={height} width={width} ref={containerRef} />
  </div>;
}

ChartFullScreen.propTypes = propTypes;

export default ChartFullScreen;
