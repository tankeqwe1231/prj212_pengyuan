import React from 'react';
import PropTypes from 'prop-types';

const propTypes = {
  checked: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  style: PropTypes.object,
};

export default function Checkbox({ checked, onChange, style }) {
  const toggle = () => onChange(!checked);
  return (
    <span style={style}>
      <i
        aria-checked={checked}
        className={`fa fa-check ${checked ? 'text-primary' : 'text-transparent'}`}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            toggle();
          }
        }}
        role="checkbox"
        style={{
          border: '1px solid #aaa',
          borderRadius: '2px',
          cursor: 'pointer',
        }}
        tabIndex="0"
      />
    </span>);
}
Checkbox.propTypes = propTypes;
