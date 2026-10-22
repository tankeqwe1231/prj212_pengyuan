import React, { useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Row, Col, Button, Badge, OverlayTrigger, Popover,
} from 'react-bootstrap';
import 'react-datetime/css/react-datetime.css';

import ControlHeader from '../ControlHeader';
import SelectControl from './SelectControl';
import PopoverSection from '../../../components/PopoverSection';
import Checkbox from '../../../components/Checkbox';
import { t } from '../../../locales';

const spatialTypes = {
  latlong: 'latlong',
  delimited: 'delimited',
  geohash: 'geohash',
};

const propTypes = {
  onChange: PropTypes.func,
  value: PropTypes.object,
  animation: PropTypes.bool,
  choices: PropTypes.array,
};

const defaultProps = {
  onChange: () => {},
  animation: true,
  choices: [],
};

function SpatialControl(incomingProps) {
  const props = { ...incomingProps };
  Object.keys(SpatialControl.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = SpatialControl.defaultProps[key];
  });
  const propsRef = useRef(props);
  propsRef.current = props;
  const [state, setState] = useState(() => ({
    type: v.type || spatialTypes.latlong,
    delimiter: v.delimiter || ',',
    latCol: v.latCol || defaultCol,
    lonCol: v.lonCol || defaultCol,
    lonlatCol: v.lonlatCol || defaultCol,
    reverseCheckbox: v.reverseCheckbox || false,
    geohashCol: v.geohashCol || defaultCol,
    value: null,
    errors: [],
    showPopover: false
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
  function onChange() {
    const type = stateRef.current.type;
    const value = {
      type
    };
    const errors = [];
    const errMsg = t('Invalid lat/long configuration.');
    if (type === spatialTypes.latlong) {
      value.latCol = stateRef.current.latCol;
      value.lonCol = stateRef.current.lonCol;
      if (!value.lonCol || !value.latCol) {
        errors.push(errMsg);
      }
    } else if (type === spatialTypes.delimited) {
      value.lonlatCol = stateRef.current.lonlatCol;
      value.delimiter = stateRef.current.delimiter;
      value.reverseCheckbox = stateRef.current.reverseCheckbox;
      if (!value.lonlatCol || !value.delimiter) {
        errors.push(errMsg);
      }
    } else if (type === spatialTypes.geohash) {
      value.geohashCol = stateRef.current.geohashCol;
      if (!value.geohashCol) {
        errors.push(errMsg);
      }
    }
    updateState({
      value,
      errors
    });
    propsRef.current.onChange(value, errors);
  }
  function setType(type) {
    updateState({
      type
    }, onChange);
  }
  function close() {
    updateState({
      showPopover: false
    });
  }
  function toggleCheckbox() {
    updateState({
      reverseCheckbox: !stateRef.current.reverseCheckbox
    }, onChange);
  }
  function renderLabelContent() {
    if (stateRef.current.errors.length > 0) {
      return 'N/A';
    }
    if (stateRef.current.type === spatialTypes.latlong) {
      return `${stateRef.current.lonCol} | ${stateRef.current.latCol}`;
    } else if (stateRef.current.type === spatialTypes.delimited) {
      return `${stateRef.current.lonlatCol}`;
    } else if (stateRef.current.type === spatialTypes.geohash) {
      return `${stateRef.current.geohashCol}`;
    }
    return null;
  }
  function renderSelect(name, type) {
    return <SelectControl name={name} choices={propsRef.current.choices} value={stateRef.current[name]} clearable={false} onFocus={() => {
      setType(type);
    }} onChange={value => {
      updateState({
        [name]: value
      }, onChange);
    }} />;
  }
  function renderPopover() {
    return <Popover id="filter-popover">
        <Popover.Body style={{
        width: '300px'
      }}>
          <PopoverSection title={t('Longitude & Latitude columns')} isSelected={stateRef.current.type === spatialTypes.latlong} onSelect={setType.bind(undefined, spatialTypes.latlong)}>
            <Row>
              <Col md={6}>
                Longitude
                {renderSelect('lonCol', spatialTypes.latlong)}
              </Col>
              <Col md={6}>
                Latitude
                {renderSelect('latCol', spatialTypes.latlong)}
              </Col>
            </Row>
          </PopoverSection>
          <PopoverSection title={t('Delimited long & lat single column')} info={t('Multiple formats accepted, look the geopy.points ' + 'Python library for more details')} isSelected={stateRef.current.type === spatialTypes.delimited} onSelect={setType.bind(undefined, spatialTypes.delimited)}>
            <Row>
              <Col md={6}>
                Column
                {renderSelect('lonlatCol', spatialTypes.delimited)}
              </Col>
              <Col md={6}>
                {t('Reverse lat/long ')}
                <Checkbox checked={stateRef.current.reverseCheckbox} onChange={toggleCheckbox} />
              </Col>
            </Row>
          </PopoverSection>
          <PopoverSection title={t('Geohash')} isSelected={stateRef.current.type === spatialTypes.geohash} onSelect={setType.bind(undefined, spatialTypes.geohash)}>
            <Row>
              <Col md={6}>
                Column
                {renderSelect('geohashCol', spatialTypes.geohash)}
              </Col>
            </Row>
          </PopoverSection>
          <div className="clearfix">
            <Button size="sm" className="float-start ok" variant="primary" onClick={close.bind(undefined)}>
              Ok
            </Button>
          </div>
        </Popover.Body>
      </Popover>;
  }
  // Lifecycle-equivalent mount effect intentionally runs once.
  useLayoutEffect(() => {
    onChange();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <div>
        <ControlHeader {...propsRef.current} />
        <OverlayTrigger animation={propsRef.current.animation} container={document.body} trigger="click" rootClose placement="right" show={stateRef.current.showPopover} onToggle={showPopover => updateState({
      showPopover
    })} overlay={renderPopover()}>
          <Badge style={{
        cursor: 'pointer'
      }}>
            {renderLabelContent()}
          </Badge>
        </OverlayTrigger>
      </div>;
}


export default SpatialControl;

SpatialControl.propTypes = propTypes;
SpatialControl.defaultProps = defaultProps;
