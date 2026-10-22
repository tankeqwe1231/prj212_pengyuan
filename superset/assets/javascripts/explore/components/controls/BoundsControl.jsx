import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Col, Row, FormGroup, FormControl } from 'react-bootstrap';
import ControlHeader from '../ControlHeader';
import { t } from '../../../locales';

const propTypes = {
  onChange: PropTypes.func,
  value: PropTypes.array,
};

const defaultProps = {
  onChange: () => {},
  value: [null, null],
};

function BoundsControl(incomingProps) {
  const props = { ...incomingProps };
  Object.keys(BoundsControl.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = BoundsControl.defaultProps[key];
  });
  const propsRef = useRef(props);
  propsRef.current = props;
  const [state, setState] = useState(() => ({
    minMax: [props.value[0] === null ? '' : props.value[0], props.value[1] === null ? '' : props.value[1]]
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
  function onMinChange(event) {
    updateState({
      minMax: [event.target.value, stateRef.current.minMax[1]]
    }, onChange);
  }
  function onMaxChange(event) {
    updateState({
      minMax: [stateRef.current.minMax[0], event.target.value]
    }, onChange);
  }
  function onChange() {
    const mm = stateRef.current.minMax;
    const errors = [];
    if (mm[0] && isNaN(mm[0])) {
      errors.push(t('`Min` value should be numeric or empty'));
    }
    if (mm[1] && isNaN(mm[1])) {
      errors.push(t('`Max` value should be numeric or empty'));
    }
    if (errors.length === 0) {
      propsRef.current.onChange([parseFloat(mm[0]), parseFloat(mm[1])], errors);
    } else {
      propsRef.current.onChange([null, null], errors);
    }
  }
  return <div>
        <ControlHeader {...propsRef.current} />
        <FormGroup>
          <Row>
            <Col xs={6}>
              <FormControl type="text" placeholder={t('Min')} onChange={onMinChange} value={stateRef.current.minMax[0]} />
            </Col>
            <Col xs={6}>
              <FormControl type="text" placeholder={t('Max')} onChange={onMaxChange} value={stateRef.current.minMax[1]} />
            </Col>
          </Row>
        </FormGroup>
      </div>;
}


export default BoundsControl;

BoundsControl.propTypes = propTypes;
BoundsControl.defaultProps = defaultProps;
