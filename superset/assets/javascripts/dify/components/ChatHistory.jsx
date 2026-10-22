import React, { useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { fetchGet } from '../utils/api';

function ChatHistory(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(ChatHistory.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = ChatHistory.defaultProps[key];
  });
  const propsRef = useRef(props);
  const mountedRef = useRef(true);
  const [state, setState] = useState(() => ({
    conversations: [],
    selectedConversationId: null,
    loading: true,
    error: null
  }));
  const stateRef = useRef(state);
  stateRef.current = state;
  const updateState = (update, callback) => {
    if (!mountedRef.current) return;
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
  function fetchConversations() {
    updateState({
      loading: true,
      error: null
    });
    const appIndex = propsRef.current.appIndex || 'app-index'; // 使用传入的appIndex或默认值

    fetchGet(`/superset/api/dify/conversations?app_index=${appIndex}`).then(response => {
      if (!response.ok) {
        throw new Error(`HTTP状态码: ${response.status}`);
      }
      return response.json();
    }).then(responseData => {
      // 根据API文档，响应应该包含data数组
      const conversations = responseData.data || [];
      updateState({
        conversations,
        loading: false,
        error: null
      });
      // console.log('获取到会话列表:', conversations);
    }).catch(error => {
      console.error('获取会话列表失败:', error);
      updateState({
        loading: false,
        error: `获取会话列表失败: ${error.message}`
      });
    });
  }
  function handleConversationSelect(conversationId) {
    updateState({
      selectedConversationId: conversationId
    });
    propsRef.current.onSelectConversation(conversationId);
  }
  propsRef.current = props;
  useLayoutEffect(() => {
    fetchConversations();
    return () => {
      mountedRef.current = false;
    };
    // Preserve the legacy mount-only request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const {
    conversations,
    selectedConversationId,
    loading,
    error
  } = stateRef.current;
  return <div className="chat-history">
        <div className="sidebar-header">
          <h2>风云小助手</h2>
        </div>
        <div className="new-chat-btn" onClick={() => handleConversationSelect(null)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>新对话</span>
        </div>
        <div className="conversation-list">
          {loading ? <div className="loading-conversations">加载中...</div> : error ? <div className="error-conversations" onClick={fetchConversations}>
              {error}，点击重试
            </div> : conversations.length > 0 ? conversations.map(conv => <div key={conv.id} className={`conversation-item ${selectedConversationId === conv.id ? 'active' : ''}`} onClick={() => handleConversationSelect(conv.id)}>
                {conv.name || '新对话'}
              </div>) : <div className="no-conversations">暂无会话记录</div>}
        </div>
      </div>;
}



ChatHistory.propTypes = {
  onSelectConversation: PropTypes.func.isRequired,
  appIndex: PropTypes.string,
};

export default ChatHistory; 
