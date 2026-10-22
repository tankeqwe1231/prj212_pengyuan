/* global notify */
import React from 'react';
import PropTypes from 'prop-types';
import Select from '../../../components/AsyncSelect';
import ControlHeader from '../ControlHeader';
import { t } from '../../../locales';

const propTypes = {
  dataEndpoint: PropTypes.string.isRequired,
  multi: PropTypes.bool,
  mutator: PropTypes.func,
  onAsyncErrorMessage: PropTypes.string,
  onChange: PropTypes.func,
  placeholder: PropTypes.string,
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.arrayOf(PropTypes.string),
    PropTypes.arrayOf(PropTypes.number),
  ]),
};

function renderValue(value) {
  return <div>{value.label}</div>;
}

const SelectAsyncControl = ({
  dataEndpoint,
  multi = true,
  mutator,
  onAsyncErrorMessage = t('Error while fetching data'),
  onChange = () => {},
  placeholder = t('Select ...'),
  value,
  ...props
}) => {
  const onSelectionChange = (options) => {
    const optionValues = options.map(option => option.value);
    onChange(optionValues);
  };

  return (
    <div>
      <ControlHeader {...props} />
      <Select
        dataEndpoint={dataEndpoint}
        onChange={onSelectionChange}
        onAsyncError={errorMsg => notify.error(onAsyncErrorMessage + ': ' + errorMsg)}
        mutator={mutator}
        isMulti={multi}
        value={value}
        placeholder={placeholder}
        valueRenderer={renderValue}
      />
    </div>
  );
};

SelectAsyncControl.propTypes = propTypes;

export default SelectAsyncControl;
