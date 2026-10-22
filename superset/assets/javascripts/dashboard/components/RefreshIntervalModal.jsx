import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Select from 'react-select';
import ModalTrigger from '../../components/ModalTrigger';
import { t } from '../../locales';
import { normalizeSelectValue } from '../../components/selectUtils';

const propTypes = {
  triggerNode: PropTypes.node.isRequired,
  initialRefreshFrequency: PropTypes.number,
  onChange: PropTypes.func,
};

const defaultProps = {
  initialRefreshFrequency: 0,
  onChange: () => {},
};

const options = [
  [0, t('Don\'t refresh')],
  [10, t('10 seconds')],
  [30, t('30 seconds')],
  [60, t('1 minute')],
  [300, t('5 minutes')],
].map(o => ({ value: o[0], label: o[1] }));

function RefreshIntervalModal(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(RefreshIntervalModal.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = RefreshIntervalModal.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    refreshFrequency: props.initialRefreshFrequency
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
  propsRef.current = props;
  return <ModalTrigger triggerNode={propsRef.current.triggerNode} isMenuItem modalTitle={t('Refresh Interval')} modalBody={<div>
            {t('Choose the refresh frequency for this dashboard')}
            <Select classNamePrefix="Select" options={options} value={normalizeSelectValue(stateRef.current.refreshFrequency, options)} onChange={opt => {
      updateState({
        refreshFrequency: opt.value
      });
      propsRef.current.onChange(opt.value);
    }} />
          </div>} />;
}


RefreshIntervalModal.propTypes = propTypes;
RefreshIntervalModal.defaultProps = defaultProps;

export default RefreshIntervalModal;
