import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import CreatableSelect from 'react-select/creatable';
import ControlHeader from '../ControlHeader';

import { colorScalerFactory } from '../../../modules/colors';

const propTypes = {
  description: PropTypes.string,
  label: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  onChange: PropTypes.func,
  value: PropTypes.string,
  default: PropTypes.string,
  choices: PropTypes.arrayOf(PropTypes.array).isRequired,
  schemes: PropTypes.object.isRequired,
  isLinear: PropTypes.bool,
};

const defaultProps = {
  choices: [],
  schemes: {},
  onChange: () => {},
};

function ColorSchemeControl(incomingProps) {
  const props = { ...incomingProps };
  Object.keys(ColorSchemeControl.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = ColorSchemeControl.defaultProps[key];
  });
  const propsRef = useRef(props);
  propsRef.current = props;
  const [state, setState] = useState(() => ({
    scheme: propsRef.current.value
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
  function onChange(option) {
    const optionValue = option ? option.value : null;
    propsRef.current.onChange(optionValue);
    updateState({
      scheme: optionValue
    });
  }
  function renderOption(key) {
    const currentScheme = key.value ? propsRef.current.schemes[key.value] : propsRef.current.schemes[defaultProps.value];
    let colors = currentScheme;
    if (propsRef.current.isLinear) {
      const colorScaler = colorScalerFactory(currentScheme);
      colors = [...Array(20).keys()].map(d => colorScaler(d / 20));
    }
    const list = colors.map((color, i) => <li key={`${currentScheme}-${i}`} style={{
      backgroundColor: color,
      border: `1px solid ${color === 'white' ? 'black' : color}`
    }}>&nbsp;</li>);
    return <ul className="color-scheme-container">{list}</ul>;
  }
  const selectProps = {
    isMulti: false,
    name: `select-${propsRef.current.name}`,
    placeholder: `Select (${propsRef.current.choices.length})`,
    options: propsRef.current.choices.map(choice => ({
      value: choice[0],
      label: choice[1]
    })),
    isClearable: false,
    onChange: onChange,
    formatOptionLabel: renderOption,
    value: propsRef.current.value ? {
      value: propsRef.current.value,
      label: propsRef.current.value
    } : null
  };
  return <div>
        <ControlHeader {...propsRef.current} />
        <CreatableSelect classNamePrefix="Select" {...selectProps} />
      </div>;
}


export default ColorSchemeControl;

ColorSchemeControl.propTypes = propTypes;
ColorSchemeControl.defaultProps = defaultProps;
