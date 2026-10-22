import React, { useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Select from 'react-select';
import { t } from '../locales';
import { normalizeSelectValue, renderSelectLabel } from './selectUtils';

const $ = window.$ = require('jquery');

const propTypes = {
  dataEndpoint: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  mutator: PropTypes.func.isRequired,
  onAsyncError: PropTypes.func,
  value: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.arrayOf(PropTypes.number),
  ]),
  valueRenderer: PropTypes.func,
  isMulti: PropTypes.bool,
  multi: PropTypes.bool,
  isClearable: PropTypes.bool,
  isDisabled: PropTypes.bool,
  placeholder: PropTypes.string,
  autoSelect: PropTypes.bool,
};

const defaultProps = {
  placeholder: t('Select ...'),
  valueRenderer: o => (<div>{o.label}</div>),
  onAsyncError: () => {},
};

function AsyncSelect(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(AsyncSelect.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = AsyncSelect.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    isLoading: false,
    options: []
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
    propsRef.current.onChange(opt);
  }
  function fetchOptions() {
    updateState({
      isLoading: true
    });
    const mutator = propsRef.current.mutator;
    $.get(propsRef.current.dataEndpoint).done(data => {
      updateState({
        options: mutator ? mutator(data) : data,
        isLoading: false
      });
      if (!propsRef.current.value && propsRef.current.autoSelect && stateRef.current.options.length) {
        onChange(stateRef.current.options[0]);
      }
    }).fail(xhr => {
      propsRef.current.onAsyncError(xhr.responseText);
    }).always(() => {
      updateState({
        isLoading: false
      });
    });
  }
  propsRef.current = props;
  useLayoutEffect(() => {
    fetchOptions();
    // Preserve the legacy mount-only fetch; callbacks read current props through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const selectProps = {
    ...propsRef.current
  };
  ['dataEndpoint', 'mutator', 'onAsyncError', 'autoSelect', 'valueRenderer', 'multi'].forEach(prop => delete selectProps[prop]);
  const selectedIsMulti = propsRef.current.isMulti || Boolean(propsRef.current.multi);
  const selectedValue = normalizeSelectValue(propsRef.current.value, stateRef.current.options, 'value', 'label', selectedIsMulti);
  return <div>
        <Select {...selectProps} classNamePrefix="Select" placeholder={propsRef.current.placeholder} options={stateRef.current.options} value={selectedValue} isMulti={selectedIsMulti} isLoading={stateRef.current.isLoading} onChange={onChange.bind(undefined)} formatOptionLabel={(option, meta) => renderSelectLabel(option, meta.context, null, propsRef.current.valueRenderer)} />
      </div>;
}



AsyncSelect.propTypes = propTypes;
AsyncSelect.defaultProps = defaultProps;

export default AsyncSelect;
