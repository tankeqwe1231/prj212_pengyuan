import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import { Badge, Popover, OverlayTrigger } from 'react-bootstrap';
import { decimal2sexagesimal } from 'geolib';

import TextControl from './TextControl';
import ControlHeader from '../ControlHeader';
import { defaultViewport } from '../../../modules/geo';

const PARAMS = [
  'longitude',
  'latitude',
  'zoom',
  'bearing',
  'pitch',
];

const propTypes = {
  onChange: PropTypes.func.isRequired,
  value: PropTypes.shape({
    longitude: PropTypes.number,
    latitude: PropTypes.number,
    zoom: PropTypes.number,
    bearing: PropTypes.number,
    pitch: PropTypes.number,
  }),
  default: PropTypes.object,
  name: PropTypes.string.isRequired,
};

const defaultProps = {
  onChange: () => {},
  default: { type: 'fix', value: 5 },
  value: defaultViewport,
};

function ViewportControl(incomingProps) {
  const props = { ...incomingProps };
  Object.keys(ViewportControl.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = ViewportControl.defaultProps[key];
  });
  const propsRef = useRef(props);
  propsRef.current = props;
  function onChange(ctrl, value) {
    propsRef.current.onChange({
      ...propsRef.current.value,
      [ctrl]: value
    });
  }
  function renderTextControl(ctrl) {
    return <div key={ctrl}>
        {ctrl}
        <TextControl value={propsRef.current.value[ctrl]} onChange={onChange.bind(undefined, ctrl)} isFloat />
      </div>;
  }
  function renderPopover() {
    return <Popover id={`filter-popover-${propsRef.current.name}`}>
        <Popover.Header as="h3">Viewport</Popover.Header>
        <Popover.Body>{PARAMS.map(ctrl => renderTextControl(ctrl))}</Popover.Body>
      </Popover>;
  }
  function renderLabel() {
    if (propsRef.current.value.longitude && propsRef.current.value.latitude) {
      return decimal2sexagesimal(propsRef.current.value.longitude) + ' | ' + decimal2sexagesimal(propsRef.current.value.latitude);
    }
    return 'N/A';
  }
  return <div>
        <ControlHeader {...propsRef.current} />
        <OverlayTrigger container={document.body} trigger="click" rootClose placement="right" overlay={renderPopover()}>
          <Badge style={{
        cursor: 'pointer'
      }}>
            {renderLabel()}
          </Badge>
        </OverlayTrigger>
      </div>;
}


export default ViewportControl;

ViewportControl.propTypes = propTypes;
ViewportControl.defaultProps = defaultProps;
