/* eslint no-underscore-dangle: ["error", { "allow": ["", "__timestamp"] }] */

import React, { useRef, useState } from 'react';
import { renderReact } from '../../../javascripts/modules/reactRoot';
import PropTypes from 'prop-types';

import { ScreenGridLayer } from 'deck.gl';

import AnimatableDeckGLContainer from '../AnimatableDeckGLContainer';

import * as common from './common';
import { getPlaySliderParams } from '../../../javascripts/modules/time';
import sandboxedEval from '../../../javascripts/modules/sandbox';

function getPoints(data) {
  return data.map(d => d.position);
}

function getLayer(formData, payload, slice, filters) {
  const fd = formData;
  const c = fd.color_picker;
  let data = payload.data.features.map(d => ({
    ...d,
    color: [c.r, c.g, c.b, 255 * c.a],
  }));

  if (fd.js_data_mutator) {
    // Applying user defined data mutator if defined
    const jsFnMutator = sandboxedEval(fd.js_data_mutator);
    data = jsFnMutator(data);
  }

  if (filters != null) {
    filters.forEach((f) => {
      data = data.filter(f);
    });
  }

  // Passing a layer creator function instead of a layer since the
  // layer needs to be regenerated at each render
  return new ScreenGridLayer({
    id: `screengrid-layer-${fd.slice_id}`,
    data,
    pickable: true,
    cellSizePixels: fd.grid_size,
    minColor: [c.r, c.g, c.b, 0],
    maxColor: [c.r, c.g, c.b, 255 * c.a],
    outline: false,
    getWeight: d => d.weight || 0,
    ...common.commonLayerProps(fd, slice),
  });
}

const propTypes = {
  slice: PropTypes.object.isRequired,
  payload: PropTypes.object.isRequired,
  setControlValue: PropTypes.func.isRequired,
  viewport: PropTypes.object.isRequired,
};

function DeckGLScreenGrid(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(DeckGLScreenGrid.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = DeckGLScreenGrid.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => getScreenGridState(props));
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
  function getLayers(values) {
    const filters = [];

    // time filter
    if (values[0] === values[1] || values[1] === stateRef.current.end) {
      filters.push(d => d.__timestamp >= values[0] && d.__timestamp <= values[1]);
    } else {
      filters.push(d => d.__timestamp >= values[0] && d.__timestamp < values[1]);
    }
    const layer = getLayer(propsRef.current.slice.formData, propsRef.current.payload, propsRef.current.slice, filters);
    return [layer];
  }
  function receiveProps(nextProps) {
    updateState(getScreenGridState(nextProps));
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
  return <div>
        <AnimatableDeckGLContainer getLayers={getLayers} start={stateRef.current.start} end={stateRef.current.end} step={stateRef.current.step} values={stateRef.current.values} disabled={stateRef.current.disabled} viewport={propsRef.current.viewport} mapboxApiAccessToken={propsRef.current.payload.data.mapboxApiKey} mapStyle={propsRef.current.slice.formData.mapbox_style} setControlValue={propsRef.current.setControlValue} />
      </div>;
}


function getScreenGridState(nextProps) {
  const fd = nextProps.slice.formData;
  const timeGrain = fd.time_grain_sqla || fd.granularity || 'PT1M';
  const timestamps = nextProps.payload.data.features.map(f => f.__timestamp);
  const {
    start,
    end,
    step,
    values,
    disabled
  } = getPlaySliderParams(timestamps, timeGrain);
  return {
    start,
    end,
    step,
    values,
    disabled
  };
}

DeckGLScreenGrid.propTypes = propTypes;

function deckScreenGrid(slice, payload, setControlValue) {
  const fd = slice.formData;
  let viewport = {
    ...fd.viewport,
    width: slice.width(),
    height: slice.height(),
  };

  if (fd.autozoom) {
    viewport = common.fitViewport(viewport, getPoints(payload.data.features));
  }

  renderReact(
    <DeckGLScreenGrid
      slice={slice}
      payload={payload}
      setControlValue={setControlValue}
      viewport={viewport}
    />,
    document.getElementById(slice.containerId),
  );
}

export { DeckGLScreenGrid, getLayer, getScreenGridState };
export default deckScreenGrid;
