import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import { OverlayTrigger, Popover } from 'react-bootstrap';
import { SketchPicker } from 'react-color';

import ControlHeader from '../ControlHeader';
import { bnbColors } from '../../../modules/colors';

const propTypes = {
  onChange: PropTypes.func,
  value: PropTypes.object,
};

const defaultProps = {
  onChange: () => {},
};

const swatchCommon = {
  position: 'absolute',
  width: '50px',
  height: '20px',
  top: '0px',
  left: '0px',
  right: '0px',
  bottom: '0px',
};

const styles = {
  swatch: {
    width: '50px',
    height: '20px',
    position: 'relative',
    padding: '5px',
    borderRadius: '1px',
    display: 'inline-block',
    cursor: 'pointer',
    boxShadow: 'rgba(0, 0, 0, 0.15) 0px 0px 0px 1px inset, rgba(0, 0, 0, 0.25) 0px 0px 4px inset',
  },
  color: {
    ...swatchCommon,
    borderRadius: '2px',
  },
  checkboard: {
    ...swatchCommon,
    background: 'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uCTZhw1gGGYhAGBZIA/nYDCgBDAm9BGDWAAJyRCgLaBCAAgXwixzAS0pgAAAABJRU5ErkJggg==") left center',
  },
};
function ColorPickerControl(incomingProps) {
  const props = { ...incomingProps };
  Object.keys(ColorPickerControl.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = ColorPickerControl.defaultProps[key];
  });
  const propsRef = useRef(props);
  propsRef.current = props;
  function onChange(col) {
    propsRef.current.onChange(col.rgb);
  }
  function renderPopover() {
    return <Popover id="filter-popover" className="color-popover">
        <Popover.Body><SketchPicker color={propsRef.current.value} onChange={onChange} presetColors={bnbColors.filter((s, i) => i < 7)} /></Popover.Body>
      </Popover>;
  }
  const c = propsRef.current.value || {
    r: 0,
    g: 0,
    b: 0,
    a: 0
  };
  const colStyle = Object.assign({}, styles.color, {
    background: `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})`
  });
  return <div>
        <ControlHeader {...propsRef.current} />
        <OverlayTrigger container={document.body} trigger="click" rootClose placement="right" overlay={renderPopover()}>
          <div aria-label="Choose color" role="button" style={styles.swatch} tabIndex="0">
            <div style={styles.checkboard} />
            <div style={colStyle} />
          </div>
        </OverlayTrigger>
      </div>;
}


export default ColorPickerControl;

ColorPickerControl.propTypes = propTypes;
ColorPickerControl.defaultProps = defaultProps;
