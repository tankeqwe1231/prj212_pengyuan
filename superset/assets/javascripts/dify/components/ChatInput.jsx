import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';

function ChatInput(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(ChatInput.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = ChatInput.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    message: ''
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
  function handleChange(e) {
    updateState({
      message: e.target.value
    });
  }
  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }
  function handleSubmit() {
    const {
      message
    } = stateRef.current;
    if (message.trim()) {
      propsRef.current.onSendMessage(message.trim());
      updateState({
        message: ''
      });
    }
  }
  propsRef.current = props;
  const {
    message
  } = stateRef.current;
  return <div className="chat-input" style={{
    margin: '10px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    padding: '5px',
    display: 'flex',
    backgroundColor: 'white'
  }}>
        <textarea className="message-input" value={message} onChange={handleChange} onKeyDown={handleKeyDown} placeholder="请输入您的问题..." style={{
      flex: 1,
      border: 'none',
      outline: 'none',
      fontSize: '14px',
      minHeight: '20px',
      maxHeight: '100px',
      overflowY: 'auto',
      resize: 'none'
    }} />
        <button className="send-button" onClick={handleSubmit} type="button" style={{
      backgroundColor: '#4a90e2',
      color: 'white',
      border: 'none',
      borderRadius: '50%',
      width: '36px',
      height: '36px',
      cursor: 'pointer',
      marginLeft: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 0,
      marginTop: '20px'
    }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </div>;
}



ChatInput.propTypes = {
  onSendMessage: PropTypes.func.isRequired,
};

export default ChatInput; 