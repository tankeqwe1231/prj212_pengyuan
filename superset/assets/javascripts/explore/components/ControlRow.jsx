import React from 'react';
import PropTypes from 'prop-types';

const NUM_COLUMNS = 12;

const propTypes = {
  controls: PropTypes.arrayOf(PropTypes.object).isRequired,
  className: PropTypes.string,
};

const defaultProps = {
  className: 'control-row',
};

function ControlSetRow(props) {
  const controls = props.controls.filter(Boolean);
  if (controls.length === 0) {
    return null;
  }
  const colSize = NUM_COLUMNS / controls.length;
  const rowClassName = props.className || 'control-row';
  return (
    <div className={`row space-1 ${rowClassName}`}>
      {controls.map((control, i) => (
        <div className={`col-lg-${colSize} col-xs-12`} key={i} >
          {control}
        </div>
      ))}
    </div>
  );
}

ControlSetRow.propTypes = propTypes;
ControlSetRow.defaultProps = defaultProps;
export default ControlSetRow;
