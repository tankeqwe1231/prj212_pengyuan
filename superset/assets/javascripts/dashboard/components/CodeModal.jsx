import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';

import ModalTrigger from '../../components/ModalTrigger';
import { t } from '../../locales';

const propTypes = {
  triggerNode: PropTypes.node.isRequired,
  code: PropTypes.string,
  codeCallback: PropTypes.func,
};

const defaultProps = {
  codeCallback: () => {},
};

function CodeModal(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(CodeModal.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = CodeModal.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    code: props.code
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
  function beforeOpen() {
    let code = propsRef.current.code;
    if (!code && propsRef.current.codeCallback) {
      code = propsRef.current.codeCallback();
    }
    updateState({
      code
    });
  }
  propsRef.current = props;
  return <ModalTrigger triggerNode={propsRef.current.triggerNode} isButton beforeOpen={beforeOpen.bind(undefined)} modalTitle={t('Active Dashboard Filters')} modalBody={<div className="CodeModal">
            <pre>
              {stateRef.current.code}
            </pre>
          </div>} />;
}


export default CodeModal;
CodeModal.propTypes = propTypes;
CodeModal.defaultProps = defaultProps;
