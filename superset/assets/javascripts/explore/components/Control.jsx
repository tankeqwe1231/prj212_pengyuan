import React, { useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

import controlMap from './controls';

const controlTypes = Object.keys(controlMap);

const propTypes = {
  actions: PropTypes.object.isRequired,
  name: PropTypes.string.isRequired,
  type: PropTypes.oneOf(controlTypes).isRequired,
  hidden: PropTypes.bool,
  label: PropTypes.string.isRequired,
  choices: PropTypes.arrayOf(PropTypes.array),
  description: PropTypes.string,
  tooltipOnClick: PropTypes.func,
  places: PropTypes.number,
  validators: PropTypes.array,
  validationErrors: PropTypes.array,
  renderTrigger: PropTypes.bool,
  rightNode: PropTypes.node,
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.object,
    PropTypes.bool,
    PropTypes.array,
    PropTypes.func]),
};

const defaultProps = {
  renderTrigger: false,
  validators: [],
  hidden: false,
  validationErrors: [],
};

function Control(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(Control.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = Control.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    hovered: false
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
  function onChange(value, errors) {
    validateAndSetValue(value, errors);
  }
  function setHover(hovered) {
    updateState({
      hovered
    });
  }
  function validateAndSetValue(value, errors) {
    let validationErrors = propsRef.current.validationErrors;
    let currentErrors = validate(value);
    if (errors && errors.length > 0) {
      currentErrors = validationErrors.concat(errors);
    }
    if (validationErrors.length + currentErrors.length > 0) {
      validationErrors = currentErrors;
    }
    if (value !== propsRef.current.value || validationErrors !== propsRef.current.validationErrors) {
      propsRef.current.actions.setControlValue(propsRef.current.name, value, validationErrors);
    }
  }
  function validate(value) {
    const validators = propsRef.current.validators;
    const validationErrors = [];
    if (validators && validators.length > 0) {
      validators.forEach(f => {
        const v = f(value);
        if (v) {
          validationErrors.push(v);
        }
      });
    }
    return validationErrors;
  }
  propsRef.current = props;
  useLayoutEffect(() => {
    validateAndSetValue(propsRef.current.value, []);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const ControlType = controlMap[propsRef.current.type];
  const divStyle = propsRef.current.hidden ? {
    display: 'none'
  } : null;
  return <div style={divStyle} onMouseEnter={setHover.bind(undefined, true)} onMouseLeave={setHover.bind(undefined, false)}>
        <ControlType onChange={onChange} hovered={stateRef.current.hovered} {...propsRef.current} />
      </div>;
}


export default Control;

Control.propTypes = propTypes;
Control.defaultProps = defaultProps;
