import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';

const propTypes = {
  onClose: PropTypes.func.isRequired,
  tabState: PropTypes.string.isRequired,
};

function TabStatusIcon(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(TabStatusIcon.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = TabStatusIcon.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    isHovered: false
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
  function onMouseOver() {
    updateState({
      isHovered: true
    });
  }
  function onMouseOut() {
    updateState({
      isHovered: false
    });
  }
  propsRef.current = props;
  return <span onMouseOver={onMouseOver} onMouseOut={onMouseOut} onClick={propsRef.current.onClose}>
        <div className={'circle ' + propsRef.current.tabState}>
          {stateRef.current.isHovered ? '×' : null}
        </div>
      </span>;
}



TabStatusIcon.propTypes = propTypes;
export default TabStatusIcon;
