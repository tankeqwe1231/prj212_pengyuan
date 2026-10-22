import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';

import DeckGLContainer from './DeckGLContainer';
import PlaySlider from '../PlaySlider';

const propTypes = {
  getLayers: PropTypes.func.isRequired,
  start: PropTypes.number.isRequired,
  end: PropTypes.number.isRequired,
  step: PropTypes.number.isRequired,
  values: PropTypes.array.isRequired,
  disabled: PropTypes.bool,
  viewport: PropTypes.object.isRequired,
  children: PropTypes.node,
};
const defaultProps = {
  disabled: false,
  step: 1,
};

function AnimatableDeckGLContainer(incomingProps) {
  const props = { ...incomingProps };
  Object.keys(defaultProps).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = defaultProps[key];
  });
  const otherPropsRef = useRef(null);
  if (otherPropsRef.current === null) {
    const {
      getLayers, start, end, step, values, disabled, viewport, children, ...other
    } = props;
    otherPropsRef.current = other;
  }
  const [values, setValues] = useState(() => props.values);
  const [viewport, setViewport] = useState(() => props.viewport);
  const previousValuesPropRef = useRef(props.values);
  const previousViewportPropRef = useRef(props.viewport);
  if (previousValuesPropRef.current !== props.values) {
    previousValuesPropRef.current = props.values;
    setValues(props.values);
  }
  if (previousViewportPropRef.current !== props.viewport) {
    previousViewportPropRef.current = props.viewport;
    setViewport(props.viewport);
  }

  return (
    <div>
      <DeckGLContainer
        {...otherPropsRef.current}
        viewport={viewport}
        layers={props.getLayers(values)}
        onViewportChange={setViewport}
      />
      {!props.disabled && (
        <PlaySlider
          start={props.start}
          end={props.end}
          step={props.step}
          values={values}
          onChange={setValues}
        />
      )}
      {props.children}
    </div>
  );
}

AnimatableDeckGLContainer.propTypes = propTypes;
AnimatableDeckGLContainer.defaultProps = defaultProps;
export default AnimatableDeckGLContainer;
