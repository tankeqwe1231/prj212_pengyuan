import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import TooltipWrapper from './TooltipWrapper';
import { t } from '../locales';

const propTypes = {
  title: PropTypes.string,
  canEdit: PropTypes.bool,
  onSaveTitle: PropTypes.func,
  noPermitTooltip: PropTypes.string,
  showTooltip: PropTypes.bool,
};
const defaultProps = {
  title: t('Title'),
  canEdit: false,
  showTooltip: true,
};

function EditableTitle(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(EditableTitle.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = EditableTitle.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    isEditing: false,
    title: propsRef.current.title,
    lastTitle: propsRef.current.title
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
  function handleClick() {
    if (!propsRef.current.canEdit) {
      return;
    }
    updateState({
      isEditing: true
    });
  }
  function handleBlur() {
    if (!propsRef.current.canEdit) {
      return;
    }
    updateState({
      isEditing: false
    });
    if (!stateRef.current.title.length) {
      updateState({
        title: stateRef.current.lastTitle
      });
      return;
    }
    if (stateRef.current.lastTitle !== stateRef.current.title) {
      updateState({
        lastTitle: stateRef.current.title
      });
      propsRef.current.onSaveTitle(stateRef.current.title);
    }
  }
  function handleChange(ev) {
    if (!propsRef.current.canEdit) {
      return;
    }
    updateState({
      title: ev.target.value
    });
  }
  function handleKeyPress(ev) {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      handleBlur();
    }
  }
  function receiveProps(nextProps) {
    if (nextProps.title !== stateRef.current.title) {
      updateState({
        lastTitle: stateRef.current.title,
        title: nextProps.title
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
  let input = <input required type={stateRef.current.isEditing ? 'text' : 'button'} value={stateRef.current.title} onChange={handleChange} onBlur={handleBlur} onClick={handleClick} onKeyPress={handleKeyPress} />;
  if (propsRef.current.showTooltip) {
    input = <TooltipWrapper label="title" tooltip={propsRef.current.canEdit ? t('click to edit title') : propsRef.current.noPermitTooltip || t('You don\'t have the rights to alter this title.')}>
          {input}
        </TooltipWrapper>;
  }
  return <span className="editable-title">{input}</span>;
}


EditableTitle.propTypes = propTypes;
EditableTitle.defaultProps = defaultProps;

export default EditableTitle;
