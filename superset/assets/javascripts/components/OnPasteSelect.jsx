import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';
import Select, { components as selectComponents } from 'react-select';

function assignRef(ref, value) {
  if (typeof ref === 'function') {
    ref(value);
  } else if (ref) {
    ref.current = value;
  }
}

function PasteInput(props) {
  const {
    PasteInputComponent,
    pasteInputRef,
    pasteHandler,
  } = props.selectProps;
  const mergedInputRef = (node) => {
    assignRef(props.innerRef, node);
    assignRef(pasteInputRef, node);
  };
  return (
    <PasteInputComponent
      {...props}
      innerRef={mergedInputRef}
      onPaste={pasteHandler}
    />
  );
}

const OnPasteSelect = forwardRef(function OnPasteSelect({
  SelectComponent = Select,
  components = {},
  getOptionLabel,
  getOptionValue,
  inputRef,
  isMulti = false,
  isOptionDisabled,
  isValidNewOption,
  labelKey = 'label',
  onChange,
  options = [],
  refFunc,
  separator = ',',
  value,
  valueKey = 'value',
  ...selectProps
}, forwardedRef) {
  const onPaste = (event) => {
    if (!isMulti) {
      return;
    }
    event.preventDefault();
    const clipboard = event.clipboardData.getData('Text');
    if (!clipboard) {
      return;
    }

    const values = clipboard.split(new RegExp(`[${separator}]+`)).map(item => item.trim());
    const selected = Array.isArray(value) ? value : [];
    const selectedKeys = {};
    const optionByKey = {};
    options.forEach((option) => {
      optionByKey[option[valueKey]] = option;
    });
    selected.forEach((option) => {
      selectedKeys[option[valueKey]] = true;
    });

    const nextValue = selected.slice();
    values.forEach((item) => {
      if (!item || selectedKeys[item]) {
        return;
      }
      const option = optionByKey[item] || {
        [labelKey]: item,
        [valueKey]: item,
      };
      if (isValidNewOption && !isValidNewOption(option)) {
        return;
      }
      selectedKeys[item] = true;
      if (!optionByKey[item]) {
        options.unshift(option);
        optionByKey[item] = option;
      }
      nextValue.push(option);
    });

    if (nextValue.length !== selected.length && onChange) {
      onChange(nextValue, { action: 'select-option' });
    }
  };

  const InputComponent = components.Input || selectComponents.Input;
  const mergedComponents = {
    ...components,
    Input: PasteInput,
  };
  const setSelectRef = (select) => {
    assignRef(forwardedRef, select);
    if (refFunc) {
      refFunc(select);
    }
  };

  return (
    <SelectComponent
      {...selectProps}
      ref={setSelectRef}
      classNamePrefix="Select"
      components={mergedComponents}
      getOptionLabel={getOptionLabel || (option => String(option[labelKey] == null ? '' : option[labelKey]))}
      getOptionValue={getOptionValue || (option => String(option[valueKey]))}
      isMulti={isMulti}
      isOptionDisabled={isOptionDisabled || (option => Boolean(option.disabled))}
      onChange={onChange}
      options={options}
      PasteInputComponent={InputComponent}
      pasteHandler={onPaste}
      pasteInputRef={inputRef}
      value={value}
    />
  );
});

OnPasteSelect.propTypes = {
  SelectComponent: PropTypes.elementType,
  components: PropTypes.object,
  getOptionLabel: PropTypes.func,
  getOptionValue: PropTypes.func,
  inputRef: PropTypes.oneOfType([PropTypes.func, PropTypes.object]),
  isMulti: PropTypes.bool,
  isOptionDisabled: PropTypes.func,
  isValidNewOption: PropTypes.func,
  labelKey: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.array,
  refFunc: PropTypes.func,
  separator: PropTypes.string,
  value: PropTypes.any,
  valueKey: PropTypes.string,
};

export default OnPasteSelect;
