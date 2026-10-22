/* eslint-disable no-param-reassign */
/* eslint-disable react/no-multi-comp */
import d3 from 'd3';
import React, { useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { renderReact } from '../javascripts/modules/reactRoot';
import MapGL from 'react-map-gl';
import Immutable from 'immutable';
import supercluster from 'supercluster';
import ViewportMercator from 'viewport-mercator-project';

import {
  kmToPixels,
  rgbLuminance,
  isNumeric,
  MILES_PER_KM,
  DEFAULT_LONGITUDE,
  DEFAULT_LATITUDE,
  DEFAULT_ZOOM,
} from '../javascripts/utils/common';
import './mapbox.css';

const NOOP = () => {};

function ScatterPlotGlowOverlay(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(ScatterPlotGlowOverlay.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = ScatterPlotGlowOverlay.defaultProps[key];
  });
  const propsRef = useRef(props);
  const overlayRef = useRef(null);
  function drawText(ctx, pixel, options = {}) {
    const IS_DARK_THRESHOLD = 110;
    const {
      fontHeight = 0,
      label = '',
      radius = 0,
      rgb = [0, 0, 0],
      shadow = false
    } = options;
    const maxWidth = radius * 1.8;
    const luminance = rgbLuminance(rgb[1], rgb[2], rgb[3]);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = luminance <= IS_DARK_THRESHOLD ? 'white' : 'black';
    ctx.font = fontHeight + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (shadow) {
      ctx.shadowBlur = 15;
      ctx.shadowColor = luminance <= IS_DARK_THRESHOLD ? 'black' : '';
    }
    const textWidth = ctx.measureText(label).width;
    if (textWidth > maxWidth) {
      const scale = fontHeight / textWidth;
      ctx.font = scale * maxWidth + 'px sans-serif';
    }
    ctx.fillText(label, pixel[0], pixel[1]);
    ctx.globalCompositeOperation = propsRef.current.compositeOperation;
    ctx.shadowBlur = 0;
    ctx.shadowColor = '';
  }
  function redraw() {
    const props = propsRef.current;
    const pixelRatio = window.devicePixelRatio || 1;
    const canvas = overlayRef.current;
    const ctx = canvas.getContext('2d');
    const radius = props.dotRadius;
    const mercator = new ViewportMercator(props);
    const rgb = props.rgb;
    const clusterLabelMap = [];
    let maxLabel = -1;
    props.locations.forEach(function (location, i) {
      if (location.get('properties').get('cluster')) {
        let clusterLabel = location.get('properties').get('metric') ? location.get('properties').get('metric') : location.get('properties').get('point_count');
        if (clusterLabel instanceof Immutable.List) {
          clusterLabel = clusterLabel.toArray();
          if (props.aggregatorName === 'mean') {
            clusterLabel = d3.mean(clusterLabel);
          } else if (props.aggregatorName === 'median') {
            clusterLabel = d3.median(clusterLabel);
          } else if (props.aggregatorName === 'stdev') {
            clusterLabel = d3.deviation(clusterLabel);
          } else {
            clusterLabel = d3.variance(clusterLabel);
          }
        }
        clusterLabel = isNumeric(clusterLabel) ? d3.round(clusterLabel, 2) : location.get('properties').get('point_count');
        maxLabel = Math.max(clusterLabel, maxLabel);
        clusterLabelMap[i] = clusterLabel;
      }
    }, undefined);
    ctx.save();
    ctx.scale(pixelRatio, pixelRatio);
    ctx.clearRect(0, 0, props.width, props.height);
    ctx.globalCompositeOperation = props.compositeOperation;
    if ((props.renderWhileDragging || !props.isDragging) && props.locations) {
      props.locations.forEach(function _forEach(location, i) {
        const pixel = mercator.project(props.lngLatAccessor(location));
        const pixelRounded = [d3.round(pixel[0], 1), d3.round(pixel[1], 1)];
        if (pixelRounded[0] + radius >= 0 && pixelRounded[0] - radius < props.width && pixelRounded[1] + radius >= 0 && pixelRounded[1] - radius < props.height) {
          ctx.beginPath();
          if (location.get('properties').get('cluster')) {
            let clusterLabel = clusterLabelMap[i];
            const scaledRadius = d3.round(Math.pow(clusterLabel / maxLabel, 0.5) * radius, 1);
            const fontHeight = d3.round(scaledRadius * 0.5, 1);
            const gradient = ctx.createRadialGradient(pixelRounded[0], pixelRounded[1], scaledRadius, pixelRounded[0], pixelRounded[1], 0);
            gradient.addColorStop(1, 'rgba(' + rgb[1] + ', ' + rgb[2] + ', ' + rgb[3] + ', 0.8)');
            gradient.addColorStop(0, 'rgba(' + rgb[1] + ', ' + rgb[2] + ', ' + rgb[3] + ', 0)');
            ctx.arc(pixelRounded[0], pixelRounded[1], scaledRadius, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();
            if (isNumeric(clusterLabel)) {
              if (clusterLabel >= 10000) {
                clusterLabel = Math.round(clusterLabel / 1000) + 'k';
              } else if (clusterLabel >= 1000) {
                clusterLabel = Math.round(clusterLabel / 100) / 10 + 'k';
              }
              drawText(ctx, pixelRounded, {
                fontHeight,
                label: clusterLabel,
                radius: scaledRadius,
                rgb,
                shadow: true
              });
            }
          } else {
            const defaultRadius = radius / 6;
            const radiusProperty = location.get('properties').get('radius');
            const pointMetric = location.get('properties').get('metric');
            let pointRadius = radiusProperty === null ? defaultRadius : radiusProperty;
            let pointLabel;
            if (radiusProperty !== null) {
              const pointLatitude = props.lngLatAccessor(location)[1];
              if (props.pointRadiusUnit === 'Kilometers') {
                pointLabel = d3.round(pointRadius, 2) + 'km';
                pointRadius = kmToPixels(pointRadius, pointLatitude, props.zoom);
              } else if (props.pointRadiusUnit === 'Miles') {
                pointLabel = d3.round(pointRadius, 2) + 'mi';
                pointRadius = kmToPixels(pointRadius * MILES_PER_KM, pointLatitude, props.zoom);
              }
            }
            if (pointMetric !== null) {
              pointLabel = isNumeric(pointMetric) ? d3.round(pointMetric, 2) : pointMetric;
            }

            // Fall back to default points if pointRadius wasn't a numerical column
            if (!pointRadius) {
              pointRadius = defaultRadius;
            }
            ctx.arc(pixelRounded[0], pixelRounded[1], d3.round(pointRadius, 1), 0, Math.PI * 2);
            ctx.fillStyle = 'rgb(' + rgb[1] + ', ' + rgb[2] + ', ' + rgb[3] + ')';
            ctx.fill();
            if (pointLabel !== undefined) {
              drawText(ctx, pixelRounded, {
                fontHeight: d3.round(pointRadius, 1),
                label: pointLabel,
                radius: pointRadius,
                rgb,
                shadow: false
              });
            }
          }
        }
      }, undefined);
    }
    ctx.restore();
  }
  propsRef.current = props;
  useLayoutEffect(() => {
    redraw();
  });
  const {
    globalOpacity,
    width,
    height
  } = propsRef.current;
  const pixelRatio = window.devicePixelRatio || 1;
  return React.createElement('canvas', {
    ref: overlayRef,
    width: width * pixelRatio,
    height: height * pixelRatio,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      position: 'absolute',
      pointerEvents: 'none',
      opacity: globalOpacity,
      left: 0,
      top: 0
    }
  });
}


ScatterPlotGlowOverlay.propTypes = {
  locations: PropTypes.instanceOf(Immutable.List).isRequired,
  lngLatAccessor: PropTypes.func,
  renderWhileDragging: PropTypes.bool,
  globalOpacity: PropTypes.number,
  dotRadius: PropTypes.number,
  dotFill: PropTypes.string,
  compositeOperation: PropTypes.string,
  height: PropTypes.number.isRequired,
  isDragging: PropTypes.bool,
  width: PropTypes.number.isRequired,
};

ScatterPlotGlowOverlay.defaultProps = {
  lngLatAccessor: location => [location.get(0), location.get(1)],
  renderWhileDragging: true,
  dotRadius: 4,
  dotFill: '#1FBAD6',
  globalOpacity: 1,
  // Same as browser default.
  compositeOperation: 'source-over',
  isDragging: false,
};

function MapboxViz(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(MapboxViz.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = MapboxViz.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => {
    const longitude = props.viewportLongitude || DEFAULT_LONGITUDE;
    const latitude = props.viewportLatitude || DEFAULT_LATITUDE;
    return {
      viewport: {
        longitude,
        latitude,
        zoom: props.viewportZoom || DEFAULT_ZOOM,
        startDragLngLat: [longitude, latitude]
      }
    };
  });
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
  function onViewportChange(viewport) {
    updateState({
      viewport
    });
    propsRef.current.setControlValue('viewport_longitude', viewport.longitude);
    propsRef.current.setControlValue('viewport_latitude', viewport.latitude);
    propsRef.current.setControlValue('viewport_zoom', viewport.zoom);
  }
  propsRef.current = props;
  const mercator = new ViewportMercator({
    width: propsRef.current.sliceWidth,
    height: propsRef.current.sliceHeight,
    longitude: stateRef.current.viewport.longitude,
    latitude: stateRef.current.viewport.latitude,
    zoom: stateRef.current.viewport.zoom
  });
  const topLeft = mercator.unproject([0, 0]);
  const bottomRight = mercator.unproject([propsRef.current.sliceWidth, propsRef.current.sliceHeight]);
  const bbox = [topLeft[0], bottomRight[1], bottomRight[0], topLeft[1]];
  const clusters = propsRef.current.clusterer.getClusters(bbox, Math.round(stateRef.current.viewport.zoom));
  const isDragging = stateRef.current.viewport.isDragging === undefined ? false : stateRef.current.viewport.isDragging;
  return <MapGL {...stateRef.current.viewport} mapStyle={propsRef.current.mapStyle} width={propsRef.current.sliceWidth} height={propsRef.current.sliceHeight} mapboxApiAccessToken={propsRef.current.mapboxApiKey} onViewportChange={onViewportChange}>
        <ScatterPlotGlowOverlay {...stateRef.current.viewport} isDragging={isDragging} width={propsRef.current.sliceWidth} height={propsRef.current.sliceHeight} locations={Immutable.fromJS(clusters)} dotRadius={propsRef.current.pointRadius} pointRadiusUnit={propsRef.current.pointRadiusUnit} rgb={propsRef.current.rgb} globalOpacity={propsRef.current.globalOpacity} compositeOperation={'screen'} renderWhileDragging={propsRef.current.renderWhileDragging} aggregatorName={propsRef.current.aggregatorName} lngLatAccessor={function (location) {
      const coordinates = location.get('geometry').get('coordinates');
      return [coordinates.get(0), coordinates.get(1)];
    }} />
      </MapGL>;
}


MapboxViz.propTypes = {
  aggregatorName: PropTypes.string,
  clusterer: PropTypes.object,
  setControlValue: PropTypes.func,
  globalOpacity: PropTypes.number,
  mapStyle: PropTypes.string,
  mapboxApiKey: PropTypes.string,
  pointRadius: PropTypes.number,
  pointRadiusUnit: PropTypes.string,
  renderWhileDragging: PropTypes.bool,
  rgb: PropTypes.array,
  sliceHeight: PropTypes.number,
  sliceWidth: PropTypes.number,
  viewportLatitude: PropTypes.number,
  viewportLongitude: PropTypes.number,
  viewportZoom: PropTypes.number,
};
MapboxViz.defaultProps = {
  aggregatorName: null,
  clusterer: null,
  setControlValue: NOOP,
  globalOpacity: 1,
  mapStyle: null,
  mapboxApiKey: null,
  pointRadius: 60,
  pointRadiusUnit: null,
  renderWhileDragging: true,
  rgb: [],
  sliceHeight: 0,
  sliceWidth: 0,
  viewportLatitude: undefined,
  viewportLongitude: undefined,
  viewportZoom: undefined,
};
export { MapboxViz, ScatterPlotGlowOverlay };

function mapbox(slice, json, setControlValue) {
  const div = d3.select(slice.selector);
  const DEFAULT_POINT_RADIUS = 60;
  const DEFAULT_MAX_ZOOM = 16;

  // Validate mapbox color
  const rgb = /^rgb\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)$/.exec(json.data.color);
  if (rgb === null) {
    slice.error('Color field must be of form \'rgb(%d, %d, %d)\'');
    return;
  }

  const aggName = json.data.aggregatorName;
  let reducer;

  if (aggName === 'sum' || !json.data.customMetric) {
    reducer = function (a, b) {
      return a + b;
    };
  } else if (aggName === 'min') {
    reducer = Math.min;
  } else if (aggName === 'max') {
    reducer = Math.max;
  } else {
    reducer = function (a, b) {
      if (a instanceof Array) {
        if (b instanceof Array) {
          return a.concat(b);
        }
        a.push(b);
        return a;
      }
      if (b instanceof Array) {
        b.push(a);
        return b;
      }
      return [a, b];
    };
  }

  const clusterer = supercluster({
    radius: json.data.clusteringRadius,
    maxZoom: DEFAULT_MAX_ZOOM,
    metricKey: 'metric',
    metricReducer: reducer,
  });
  clusterer.load(json.data.geoJSON.features);

  div.selectAll('*').remove();
  renderReact(
    <MapboxViz
      {...json.data}
      rgb={rgb}
      sliceHeight={slice.height()}
      sliceWidth={slice.width()}
      clusterer={clusterer}
      pointRadius={DEFAULT_POINT_RADIUS}
      aggregatorName={aggName}
      setControlValue={setControlValue || NOOP}
    />,
    div.node(),
  );
}

export default mapbox;
