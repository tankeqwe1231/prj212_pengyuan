import React from 'react';
import PropTypes from 'prop-types';
import ControlHeader from '../ControlHeader';
import Checkbox from '../../../components/Checkbox';

const propTypes = {
  name: PropTypes.string.isRequired,
  value: PropTypes.bool,
  label: PropTypes.string,
  description: PropTypes.string,
  onChange: PropTypes.func,
};

const checkboxStyle = { paddingRight: '5px' };

function CheckboxControl({ value = false, onChange = () => {}, ...props }) {
  return <ControlHeader {...props} value={value} leftNode={<Checkbox onChange={() => onChange(!value)} style={checkboxStyle} checked={!!value} />} />;
}
export default CheckboxControl;

CheckboxControl.propTypes = propTypes;
