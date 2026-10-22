import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Badge, Popover, OverlayTrigger } from 'react-bootstrap';

import controls from '../../stores/controls';
import TextControl from './TextControl';
import SelectControl from './SelectControl';
import ControlHeader from '../ControlHeader';
import PopoverSection from '../../../components/PopoverSection';

const controlTypes = {
  fixed: 'fix',
  metric: 'metric',
};

const propTypes = {
  onChange: PropTypes.func,
  value: PropTypes.object,
  isFloat: PropTypes.bool,
  datasource: PropTypes.object,
  default: PropTypes.shape({
    type: PropTypes.oneOf(['fix', 'metric']),
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }),
};

const defaultProps = {
  onChange: () => {},
  default: { type: controlTypes.fixed, value: 5 },
};

function FixedOrMetricControl(incomingProps) {
  const props = { ...incomingProps };
  Object.keys(FixedOrMetricControl.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = FixedOrMetricControl.defaultProps[key];
  });
  const propsRef = useRef(props);
  propsRef.current = props;
  const [state, setState] = useState(() => {
    const type = (props.value ? props.value.type : props.default.type) || controlTypes.fixed;
    const value = (props.value ? props.value.value : props.default.value) || '100';
    return {
      type,
      fixedValue: type === controlTypes.fixed ? value : '',
      metricValue: type === controlTypes.metric ? value : null
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
  function onChange() {
    propsRef.current.onChange({
      type: stateRef.current.type,
      value: stateRef.current.type === controlTypes.fixed ? stateRef.current.fixedValue : stateRef.current.metricValue
    });
  }
  function setType(type) {
    updateState({
      type
    }, onChange);
  }
  function setFixedValue(fixedValue) {
    updateState({
      fixedValue
    }, onChange);
  }
  function setMetric(metricValue) {
    updateState({
      metricValue
    }, onChange);
  }
  function renderPopover() {
    const value = propsRef.current.value || propsRef.current.default;
    const type = value.type || controlTypes.fixed;
    const metrics = propsRef.current.datasource ? propsRef.current.datasource.metrics : null;
    return <Popover id="filter-popover">
        <Popover.Body style={{
        width: '240px'
      }}>
          <PopoverSection title="Fixed" isSelected={type === controlTypes.fixed} onSelect={() => {
          onChange(controlTypes.fixed);
        }}>
            <TextControl isFloat onChange={setFixedValue} onFocus={() => {
            setType(controlTypes.fixed);
          }} value={stateRef.current.fixedValue} />
          </PopoverSection>
          <PopoverSection title="Based on a metric" isSelected={type === controlTypes.metric} onSelect={() => {
          onChange(controlTypes.metric);
        }}>
            <SelectControl {...controls.metric} name="metric" options={metrics} onFocus={() => {
            setType(controlTypes.metric);
          }} onChange={setMetric} value={stateRef.current.metricValue} />
          </PopoverSection>
        </Popover.Body>
      </Popover>;
  }
  return <div>
        <ControlHeader {...propsRef.current} />
        <OverlayTrigger container={document.body} trigger="click" rootClose placement="right" overlay={renderPopover()}>
          <Badge style={{
        cursor: 'pointer'
      }}>
            {stateRef.current.type === controlTypes.fixed && <span>{stateRef.current.fixedValue}</span>}
            {stateRef.current.type === controlTypes.metric && <span>
                <span style={{
            fontWeight: 'normal'
          }}>metric: </span>
                <strong>{stateRef.current.metricValue}</strong>
              </span>}
          </Badge>
        </OverlayTrigger>
      </div>;
}


export default FixedOrMetricControl;

FixedOrMetricControl.propTypes = propTypes;
FixedOrMetricControl.defaultProps = defaultProps;
