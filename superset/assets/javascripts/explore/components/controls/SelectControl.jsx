import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import ControlHeader from '../ControlHeader';
import { t } from '../../../locales';
import OnPasteSelect from '../../../components/OnPasteSelect';
import WindowedMenuList from '../../../components/WindowedMenuList';
import { normalizeSelectValue, renderSelectLabel } from '../../../components/selectUtils';

const propTypes = {
  choices: PropTypes.array,
  clearable: PropTypes.bool,
  description: PropTypes.string,
  disabled: PropTypes.bool,
  freeForm: PropTypes.bool,
  isLoading: PropTypes.bool,
  label: PropTypes.string,
  multi: PropTypes.bool,
  name: PropTypes.string.isRequired,
  onChange: PropTypes.func,
  onFocus: PropTypes.func,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.array]),
  showHeader: PropTypes.bool,
  optionRenderer: PropTypes.func,
  valueRenderer: PropTypes.func,
  valueKey: PropTypes.string,
  options: PropTypes.array,
  placeholder: PropTypes.string,
};

const defaultProps = {
  choices: [],
  clearable: true,
  description: null,
  disabled: false,
  freeForm: false,
  isLoading: false,
  label: null,
  multi: false,
  onChange: () => {},
  onFocus: () => {},
  showHeader: true,
  optionRenderer: opt => opt.label,
  valueRenderer: opt => opt.label,
  valueKey: 'value',
};

function SelectControl(incomingProps) {
  const props = { ...incomingProps };
  Object.keys(SelectControl.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = SelectControl.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    options: getOptions(props)
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
  function onChange(opt) {
    let optionValue = opt ? opt[propsRef.current.valueKey] : null;
    // if multi, return options values as an array
    if (propsRef.current.multi) {
      optionValue = opt ? opt.map(o => o[propsRef.current.valueKey]) : null;
    }
    propsRef.current.onChange(optionValue);
  }
  function getOptions(props) {
    if (props.options) {
      return props.options;
    }
    // Accepts different formats of input
    const options = props.choices.map(c => {
      let option;
      if (Array.isArray(c)) {
        const label = c.length > 1 ? c[1] : c[0];
        option = {
          value: c[0],
          label
        };
      } else if (Object.is(c)) {
        option = c;
      } else {
        option = {
          value: c,
          label: c
        };
      }
      return option;
    });
    if (props.freeForm) {
      // For FreeFormSelect, insert value into options if not exist
      const values = options.map(c => c.value);
      if (props.value) {
        let valuesToAdd = props.value;
        if (!Array.isArray(valuesToAdd)) {
          valuesToAdd = [valuesToAdd];
        }
        valuesToAdd.forEach(v => {
          if (values.indexOf(v) < 0) {
            options.push({
              value: v,
              label: v
            });
          }
        });
      }
    }
    return options;
  }
  function receiveProps(nextProps) {
    if (nextProps.choices !== propsRef.current.choices || nextProps.options !== propsRef.current.options) {
      const options = getOptions(nextProps);
      updateState({
        options
      });
    }
  }
  const previousIncomingPropsRef = useRef(incomingProps);
  const incomingKeys = Object.keys(incomingProps);
  const previousIncomingProps = previousIncomingPropsRef.current;
  const incomingPropsChanged = incomingKeys.length !== Object.keys(previousIncomingProps).length || incomingKeys.some(key => incomingProps[key] !== previousIncomingProps[key]);
  if (incomingPropsChanged) {
    receiveProps(props);
    previousIncomingPropsRef.current = incomingProps;
  }
  propsRef.current = props;
  //  Tab, comma or Enter will trigger a new option created for FreeFormSelect
  const placeholder = propsRef.current.placeholder || t('%s option(s)', stateRef.current.options.length);
  const selectedValue = normalizeSelectValue(propsRef.current.value, stateRef.current.options, propsRef.current.valueKey, 'label', propsRef.current.multi);
  const selectProps = {
    isMulti: propsRef.current.multi,
    name: `select-${propsRef.current.name}`,
    placeholder,
    options: stateRef.current.options,
    value: selectedValue,
    valueKey: propsRef.current.valueKey,
    isClearable: propsRef.current.clearable,
    isLoading: propsRef.current.isLoading,
    onChange: onChange,
    onFocus: propsRef.current.onFocus,
    formatOptionLabel: (option, meta) => renderSelectLabel(option, meta.context, propsRef.current.optionRenderer, propsRef.current.valueRenderer),
    SelectComponent: propsRef.current.freeForm ? CreatableSelect : Select,
    components: {
      MenuList: WindowedMenuList
    },
    isDisabled: propsRef.current.disabled
  };
  return <div>
        {propsRef.current.showHeader && <ControlHeader {...propsRef.current} />}
        <OnPasteSelect {...selectProps} />
      </div>;
}


export default SelectControl;

SelectControl.propTypes = propTypes;
SelectControl.defaultProps = defaultProps;
