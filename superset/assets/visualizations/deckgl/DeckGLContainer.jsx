import React, { useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import MapGL from 'react-map-gl';
import DeckGL from 'deck.gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const propTypes = {
  viewport: PropTypes.object.isRequired,
  layers: PropTypes.array.isRequired,
  setControlValue: PropTypes.func.isRequired,
  mapStyle: PropTypes.string,
  mapboxApiAccessToken: PropTypes.string.isRequired,
  onViewportChange: PropTypes.func,
};
const defaultProps = {
  mapStyle: 'light',
  onViewportChange: () => {},
};

function DeckGLContainer(incomingProps) {
  const props = { ...incomingProps };
  Object.keys(defaultProps).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = defaultProps[key];
  });
  const propsRef = useRef(props);
  propsRef.current = props;
  const [viewport, setViewport] = useState(() => props.viewport);
  const viewportRef = useRef(viewport);
  const viewportPropRef = useRef(props.viewport);
  const lastPublishedViewportRef = useRef(null);

  if (viewportPropRef.current !== props.viewport) {
    viewportPropRef.current = props.viewport;
    lastPublishedViewportRef.current = viewportRef.current;
    const nextViewport = { ...props.viewport };
    viewportRef.current = nextViewport;
    setViewport(nextViewport);
  }

  useLayoutEffect(() => {
    const timer = setInterval(() => {
      if (lastPublishedViewportRef.current !== viewportRef.current) {
        const { setControlValue } = propsRef.current;
        if (setControlValue) {
          setControlValue('viewport', viewportRef.current);
        }
        lastPublishedViewportRef.current = viewportRef.current;
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const onViewportChange = nextViewport => {
    const changedViewport = { ...nextViewport };
    delete changedViewport.width;
    delete changedViewport.height;
    const mergedViewport = {
      ...viewportRef.current,
      ...changedViewport,
    };
    viewportRef.current = mergedViewport;
    setViewport(mergedViewport);
    propsRef.current.onViewportChange(mergedViewport);
  };
  const layers = props.layers.map(layer => (
    typeof layer === 'function' ? layer() : layer
  ));
  return (
    <MapGL
      {...viewport}
      mapStyle={props.mapStyle}
      onViewportChange={onViewportChange}
      mapboxApiAccessToken={props.mapboxApiAccessToken}
    >
      <DeckGL {...viewport} layers={layers} initWebGLParameters />
    </MapGL>
  );
}

DeckGLContainer.propTypes = propTypes;
DeckGLContainer.defaultProps = defaultProps;
export default DeckGLContainer;
