import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import marked from 'marked';

function ChatMessage(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(ChatMessage.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = ChatMessage.defaultProps[key];
  });
  const propsRef = useRef(props);
  function renderMarkdown(content) {
    if (!content) return {
      __html: ''
    };
    try {
      return {
        __html: marked(content)
      };
    } catch (error) {
      console.error('Markdown渲染失败:', error);
      return {
        __html: content || ''
      };
    }
  }
  propsRef.current = props;
  const {
    message
  } = propsRef.current;
  // 判断是否为用户消息：如果有query字段则为用户消息，如果只有answer字段则为助手消息
  const isUser = !!message.query;
  const content = isUser ? message.query : message.answer;
  const isLoading = message.isLoading;
  const isError = message.isError;
  if (!content) {
    return null; // 如果内容为空，不渲染任何内容
  }
  /* eslint-disable react/no-danger */
  return <div className={`message ${isUser ? 'user-message' : 'assistant-message'}`}>
        <div className="message-avatar">
          {isUser ? '你' : '助'}
        </div>
        <div className="message-content">
          {isUser ? <div className="message-text">{content}</div> : <div className="message-wrapper">
              <div className={`message-text markdown-body ${isLoading ? 'loading-message' : ''} ${isError ? 'error-message' : ''}`} dangerouslySetInnerHTML={renderMarkdown(content)} />
              {isLoading && <div className="loading-spinner"></div>}
            </div>}
        </div>
      </div>;
  /* eslint-enable react/no-danger */
}



ChatMessage.propTypes = {
  message: PropTypes.shape({
    query: PropTypes.string, // A user message
    answer: PropTypes.string, // An assistant message
    id: PropTypes.string, // message ID
    isLoading: PropTypes.bool, // 是否处于加载状态
    isError: PropTypes.bool, // 是否为错误消息
  }).isRequired,
};

export default ChatMessage; 
