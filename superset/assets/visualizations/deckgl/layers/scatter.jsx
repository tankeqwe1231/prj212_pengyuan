/* eslint no-underscore-dangle: ["error", { "allow": ["", "__timestamp"] }] */

import React, { useRef, useState } from 'react';
import { renderReact } from '../../../javascripts/modules/reactRoot';
import PropTypes from 'prop-types';

import { ScatterplotLayer } from 'deck.gl';

import AnimatableDeckGLContainer from '../AnimatableDeckGLContainer';
import Legend from '../../Legend';

import * as common from './common';
import { getColorFromScheme, hexToRGB } from '../../../javascripts/modules/colors';
import { getPlaySliderParams } from '../../../javascripts/modules/time';
import { unitToRadius } from '../../../javascripts/modules/geo';
import sandboxedEval from '../../../javascripts/modules/sandbox';


function getPoints(data) {
  return data.map(d => d.position);
}

function getCategories(formData, payload) {
  const fd = formData;
  const c = fd.color_picker || { r: 0, g: 0, b: 0, a: 1 };
  const fixedColor = [c.r, c.g, c.b, 255 * c.a];
  const categories = {};

  payload.data.features.forEach((d) => {
    if (d.cat_color != null && !categories.hasOwnProperty(d.cat_color)) {
      let color;
      if (fd.dimension) {
        color = hexToRGB(getColorFromScheme(d.cat_color, fd.color_scheme), c.a * 255);
      } else {
        color = fixedColor;
      }
      categories[d.cat_color] = { color, enabled: true };
    }
  });
  return categories;
}

function getLayer(formData, payload, slice, filters) {
  const fd = formData;
  const c = fd.color_picker || { r: 0, g: 0, b: 0, a: 1 };
  const fixedColor = [c.r, c.g, c.b, 255 * c.a];

  let data = payload.data.features.map((d) => {
    let radius = unitToRadius(fd.point_unit, d.radius) || 10;
    if (fd.multiplier) {
      radius *= fd.multiplier;
    }
    let color;
    if (fd.dimension) {
      color = hexToRGB(getColorFromScheme(d.cat_color, fd.color_scheme), c.a * 255);
    } else {
      color = fixedColor;
    }
    return {
      ...d,
      radius,
      color,
    };
  });

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

  return new ScatterplotLayer({
    id: `scatter-layer-${fd.slice_id}`,
    data,
    fp64: true,
    radiusMinPixels: fd.min_radius || null,
    radiusMaxPixels: fd.max_radius || null,
    outline: false,
    ...common.commonLayerProps(fd, slice),
  });
}

const propTypes = {
  slice: PropTypes.object.isRequired,
  payload: PropTypes.object.isRequired,
  setControlValue: PropTypes.func.isRequired,
  viewport: PropTypes.object.isRequired,
};

function DeckGLScatter(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(DeckGLScatter.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = DeckGLScatter.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => getScatterState(props));
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

    // legend filter
    if (propsRef.current.slice.formData.dimension) {
      filters.push(d => stateRef.current.categories[d.cat_color].enabled);
    }
    const layer = getLayer(propsRef.current.slice.formData, propsRef.current.payload, propsRef.current.slice, filters);
    return [layer];
  }
  function toggleCategory(category) {
    const categoryState = stateRef.current.categories[category];
    categoryState.enabled = !categoryState.enabled;
    const categories = {
      ...stateRef.current.categories,
      [category]: categoryState
    };

    // if all categories are disabled, enable all -- similar to nvd3
    if (Object.values(categories).every(v => !v.enabled)) {
      /* eslint-disable no-param-reassign */
      Object.values(categories).forEach(v => {
        v.enabled = true;
      });
    }
    updateState({
      categories
    });
  }
  function showSingleCategory(category) {
    const categories = {
      ...stateRef.current.categories
    };
    /* eslint-disable no-param-reassign */
    Object.values(categories).forEach(v => {
      v.enabled = false;
    });
    categories[category].enabled = true;
    updateState({
      categories
    });
  }
  function receiveProps(nextProps) {
    updateState(getScatterState(nextProps));
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
        <AnimatableDeckGLContainer getLayers={getLayers} start={stateRef.current.start} end={stateRef.current.end} step={stateRef.current.step} values={stateRef.current.values} disabled={stateRef.current.disabled} viewport={propsRef.current.viewport} mapboxApiAccessToken={propsRef.current.payload.data.mapboxApiKey} mapStyle={propsRef.current.slice.formData.mapbox_style} setControlValue={propsRef.current.setControlValue}>
          <Legend categories={stateRef.current.categories} toggleCategory={toggleCategory} showSingleCategory={showSingleCategory} position={propsRef.current.slice.formData.legend_position} />
        </AnimatableDeckGLContainer>
      </div>;
}


function getScatterState(nextProps) {
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
  const categories = getCategories(fd, nextProps.payload);
  return {
    start,
    end,
    step,
    values,
    disabled,
    categories
  };
}

DeckGLScatter.propTypes = propTypes;

function deckScatter(slice, payload, setControlValue) {
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
    <DeckGLScatter
      slice={slice}
      payload={payload}
      setControlValue={setControlValue}
      viewport={viewport}
    />,
    document.getElementById(slice.containerId),
  );
}

export { DeckGLScatter, getLayer, getScatterState };
export default deckScatter;
