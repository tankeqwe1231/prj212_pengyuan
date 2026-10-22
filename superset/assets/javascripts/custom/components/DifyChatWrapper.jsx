import React, { useLayoutEffect, useRef, useState } from 'react';
import { Provider } from 'react-redux';
import DifyChat from '../../dify/components/DifyChat';

function DifyChatWrapper(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(DifyChatWrapper.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = DifyChatWrapper.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    showDifyChat: false
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
  const chatContainerRefRef = useRef(null);
  function setChatContainerRef(element) {
    chatContainerRefRef.current = element;
  }
  function handleClickOutside(event) {
    if (chatContainerRefRef.current && !chatContainerRefRef.current.contains(event.target) && stateRef.current.showDifyChat) {
      updateState({
        showDifyChat: false
      });
    }
  }
  function toggleDifyChat() {
    updateState(prevState => ({
      showDifyChat: !prevState.showDifyChat
    }));
  }
  propsRef.current = props;
  useLayoutEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
    // The listener is stable because it reads current state and props through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const {
    store
  } = propsRef.current;
  return <div>
        <div className="dify-chat-icon" onClick={toggleDifyChat}>
          <i className="fa fa-comments-o" style={{
        fontSize: '24px'
      }} />
        </div>
        
        {stateRef.current.showDifyChat && <div className="dify-chat-overlay">
            <div className="dify-chat-container" ref={setChatContainerRef}>
              <div className="dify-chat-header">
                <span>风云小助手</span>
                <i className="fa fa-times" onClick={toggleDifyChat} />
              </div>
              <Provider store={store}>
                <DifyChat appIndex="app-index" />
              </Provider>
            </div>
          </div>}
      </div>;
}



export default DifyChatWrapper;
