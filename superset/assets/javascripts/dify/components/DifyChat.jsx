import React, { useLayoutEffect, useRef, useState } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import ChatHistory from './ChatHistory';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import { fetchGet, fetchStreamPost } from '../utils/api';

// 引入CSS文件
import '../../../stylesheets/dify/dify.css';
import '../../../stylesheets/dify/markdown.css';

function DifyChat(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(DifyChat.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = DifyChat.defaultProps[key];
  });
  const propsRef = useRef(props);
  const mountedRef = useRef(true);
  const readersRef = useRef(new Set());
  const [state, setState] = useState(() => ({
    messages: [],
    conversationId: null,
    appIndex: props.appIndex || 'app-index' // 默认使用'app-index'
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
  const messagesEndRefRef = useRef(null);
  function setMessagesEndRef(element) {
    messagesEndRefRef.current = element;
  }
  function scrollToBottom() {
    if (messagesEndRefRef.current) {
      messagesEndRefRef.current.scrollIntoView({
        behavior: 'smooth'
      });
    }
  }
  function handleSelectConversation(conversationId) {
    updateState({
      conversationId
    });
    if (conversationId) {
      // 如果选择了特定会话，获取该会话的消息
      fetchGet(`/superset/api/dify/messages?conversation_id=${conversationId}&app_index=${stateRef.current.appIndex}`).then(response => {
        if (!response.ok) {
          throw new Error(`HTTP状态码: ${response.status}`);
        }
        return response.json();
      }).then(responseData => {
        // 根据API文档，响应应该包含data数组
        const messages = responseData.data || [];
        console.log('获取到历史消息:', messages);

        // 将每条消息转换为组件可以处理的格式
        const formattedMessages = messages.map(msg => {
          if (msg.query && msg.answer) {
            // 分成用户消息和助手消息两条记录
            return [{
              id: `user-${msg.id}`,
              query: msg.query
            }, {
              id: msg.id,
              answer: msg.answer
            }];
          } else if (msg.query) {
            return [{
              id: `user-${msg.id}`,
              query: msg.query
            }];
          } else if (msg.answer) {
            return [{
              id: msg.id,
              answer: msg.answer
            }];
          }
          return [];
        });

        // 将二维数组展平为一维数组
        const flatMessages = [].concat(...formattedMessages);
        updateState({
          messages: flatMessages
        }, () => {
          // 在消息加载完成后滚动到底部
          scrollToBottom();
        });
      }).catch(error => {
        console.error('获取会话消息失败:', error);
        showErrorMessage(`获取会话消息失败: ${error.message}`);
      });
    } else {
      // 如果是新会话，清空消息
      updateState({
        messages: []
      });
    }
  }
  function handleSendMessage(message) {
    const {
      conversationId,
      appIndex
    } = stateRef.current;

    // 先添加用户消息到界面
    const userMessage = {
      query: message,
      id: `user-${Date.now()}`
    };
    updateState(prevState => ({
      messages: [...prevState.messages, userMessage]
    }));

    // 添加"正在查询"的提示消息
    const loadingMessage = {
      id: `loading-${Date.now()}`,
      answer: '正在查询',
      isLoading: true // 添加一个标记表示这是加载状态
    };
    updateState(prevState => ({
      messages: [...prevState.messages, loadingMessage]
    }));

    // 使用封装的fetchStreamPost函数，自动添加CSRF令牌
    fetchStreamPost('/superset/api/dify/chat', {
      query: message,
      conversation_id: conversationId,
      app_index: appIndex,
      // 添加app_index参数
      response_mode: 'streaming',
      // 确保使用流式返回
      user: 'default' // 添加用户标识
    }).then(response => {
      if (!response.ok) {
        throw new Error(`HTTP状态码: ${response.status}`);
      }
      const reader = response.body.getReader();
      readersRef.current.add(reader);
      const decoder = new TextDecoder();
      let buffer = '';
      const readChunk = () => {
        reader.read().then(({
          done,
          value
        }) => {
          if (done) {
            readersRef.current.delete(reader);
            return;
          }
          buffer += decoder.decode(value, {
            stream: true
          });

          // 按照 data: {...}\n\n 的格式分割消息
          const chunks = buffer.split('\n\n');
          buffer = chunks.pop() || ''; // 保留最后一个可能不完整的块

          chunks.forEach(chunk => {
            // 确保块以 'data: ' 开头
            if (chunk.trim().startsWith('data: ')) {
              try {
                const jsonStr = chunk.trim().substring(6);
                const data = JSON.parse(jsonStr);
                handleMessageChunk(data);
              } catch (e) {
                console.error('解析消息块失败:', e, chunk);
                showErrorMessage(`解析消息块失败: ${e.message}`);
              }
            }
          });
          readChunk();
        }).catch(error => {
          console.error('读取响应流失败:', error);
          showErrorMessage(`读取响应流失败: ${error.message}`);
        });
      };
      readChunk();
    }).catch(error => {
      console.error('发送消息失败:', error);
      showErrorMessage(`发送消息失败: ${error.message}`);
    });
  }
  function showErrorMessage(errorText) {
    updateState(prevState => {
      // 移除所有加载中的消息
      const updatedMessages = prevState.messages.filter(msg => !(msg.id && msg.id.toString().startsWith('loading-')));

      // 添加错误消息
      return {
        messages: [...updatedMessages, {
          id: `error-${Date.now()}`,
          answer: `❌ ${errorText}`,
          isError: true
        }]
      };
    }, scrollToBottom);
  }
  function handleMessageChunk(data) {
    if (data.event === 'message') {
      // 对于消息事件，更新或添加助手的回复
      const {
        message_id,
        answer,
        conversation_id
      } = data;

      // 如果是新会话，更新conversationId
      if (conversation_id && !stateRef.current.conversationId) {
        updateState({
          conversationId: conversation_id
        });
      }
      updateState(prevState => {
        // 先找到并移除所有"正在查询..."的消息
        const updatedMessages = prevState.messages.filter(msg => !(msg.id && msg.id.toString().startsWith('loading-')));

        // 检查是否已有这条消息
        const existingMessageIndex = updatedMessages.findIndex(msg => msg.id === message_id && !msg.query);
        if (existingMessageIndex >= 0) {
          // 累积新的文本块到现有消息
          const existingAnswer = updatedMessages[existingMessageIndex].answer || '';
          updatedMessages[existingMessageIndex] = {
            ...updatedMessages[existingMessageIndex],
            answer: existingAnswer + answer,
            // 累积文本块
            id: message_id
          };
          return {
            messages: updatedMessages
          };
        } else {
          // 添加新消息
          return {
            messages: [...updatedMessages, {
              id: message_id,
              answer
            }]
          };
        }
      }, () => {
        // 在每次消息更新后滚动到底部
        scrollToBottom();
      });
    } else if (data.event === 'message_end') {
      // 当消息结束时，可以做一些处理，比如更新UI状态
      console.log('消息结束', data);
    } else if (data.event === 'error') {
      // 处理错误
      console.error('聊天错误:', data);
      // 在聊天界面显示错误信息
      showErrorMessage(data.error || '与助手的对话发生错误');
    }
  }
  propsRef.current = props;
  useLayoutEffect(() => {
    const readers = readersRef.current;
    return () => {
      mountedRef.current = false;
      readers.forEach(reader => reader.cancel());
      readers.clear();
    };
  }, []);
  const previousCommitRef = useRef();
  useLayoutEffect(() => {
    if (previousCommitRef.current) {
      const {
        state: prevState
      } = previousCommitRef.current;
      if (prevState.messages.length !== stateRef.current.messages.length) {
        scrollToBottom();
      }
    }
    previousCommitRef.current = {
      props: props,
      state: state
    };
  });
  const {
    messages,
    appIndex
  } = stateRef.current;
  return <div className="chat-container">
        <div className="sidebar">
          <ChatHistory onSelectConversation={handleSelectConversation} appIndex={appIndex} />
        </div>
        <div className="main-content">
          <div className="chat-messages">
            {messages.length > 0 ? messages.map((msg, index) => <ChatMessage key={`${msg.id || index}`} message={msg} />) : <div className="empty-chat">
                <div className="empty-chat-text">
                  请输入您的问题开始对话...
                </div>
              </div>}
            <div ref={setMessagesEndRef} />
          </div>
          <ChatInput onSendMessage={handleSendMessage} />
        </div>
      </div>;
}



DifyChat.propTypes = {
  // 添加需要的props类型检查
  appIndex: PropTypes.string, // 添加appIndex类型检查
};

export default connect()(DifyChat); 
