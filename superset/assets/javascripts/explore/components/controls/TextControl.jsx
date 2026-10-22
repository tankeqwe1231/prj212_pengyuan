import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import { FormGroup, FormControl } from 'react-bootstrap';
import * as v from '../../validators';
import ControlHeader from '../ControlHeader';

const propTypes = {
  onChange: PropTypes.func,
  onFocus: PropTypes.func,
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
  ]),
  isFloat: PropTypes.bool,
  isInt: PropTypes.bool,
  disabled: PropTypes.bool,
};

const defaultProps = {
  onChange: () => {},
  onFocus: () => {},
  value: '',
  isInt: false,
  isFloat: false,
  disabled: false,
};

function TextControl(incomingProps) {
  const props = { ...incomingProps };
  Object.keys(TextControl.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = TextControl.defaultProps[key];
  });
  const propsRef = useRef(props);
  propsRef.current = props;
  function onChange(event) {
    let value = event.target.value;

    // Validation & casting
    const errors = [];
    if (value !== '' && propsRef.current.isFloat) {
      const error = v.numeric(value);
      if (error) {
        errors.push(error);
      } else {
        value = parseFloat(value);
      }
    }
    if (value !== '' && propsRef.current.isInt) {
      const error = v.integer(value);
      if (error) {
        errors.push(error);
      } else {
        value = parseInt(value, 10);
      }
    }
    propsRef.current.onChange(value, errors);
  }
  const {
    value: rawValue
  } = propsRef.current;
  const value = typeof rawValue !== 'undefined' && rawValue !== null ? rawValue.toString() : '';
  return <div>
        <ControlHeader {...propsRef.current} />
        <FormGroup controlId="formInlineName">
          <FormControl type="text" placeholder="" onChange={onChange} onFocus={propsRef.current.onFocus} value={value} disabled={propsRef.current.disabled} />
        </FormGroup>
      </div>;
}


export default TextControl;

TextControl.propTypes = propTypes;
TextControl.defaultProps = defaultProps;
