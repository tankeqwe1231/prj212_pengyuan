/* eslint no-unused-vars: 0 */
import React, { useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import marked from 'marked';

function ReportsDataShowPDFModal(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(ReportsDataShowPDFModal.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = ReportsDataShowPDFModal.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    countdown: 30,
    countdownActive: true,
    aiCollapsed: false
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
  const countdownTimerRef = useRef(null);
  function handleToggleAI() {
    updateState(prevState => ({
      aiCollapsed: !prevState.aiCollapsed
    }));
  }
  function handleEscKey(e) {
    if (e.key === 'Escape') {
      handleClose();
    }
  }
  function startCountdown() {
    updateState({
      countdown: 30,
      countdownActive: true
    });
    countdownTimerRef.current = setInterval(() => {
      updateState(prevState => {
        const newCountdown = prevState.countdown - 1;
        if (newCountdown <= 0) {
          stopCountdown();
          return {
            countdown: 0,
            countdownActive: false
          };
        }
        return {
          countdown: newCountdown
        };
      });
    }, 1000);
  }
  function stopCountdown() {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }
  function handleClose() {
    if (propsRef.current.onClose) {
      propsRef.current.onClose();
    }
  }
  function handleOverlayClick(e) {
    // 只在点击遮罩层本身时关闭，不响应子元素的点击
    if (e.target === e.currentTarget) {
      // 不关闭，只有点击×才关闭
      // this.handleClose();
    }
  }
  function renderAIContent() {
    const {
      loadingAI,
      aiDescription
    } = propsRef.current;
    const {
      countdown,
      countdownActive
    } = stateRef.current;
    if (loadingAI) {
      if (countdownActive && countdown > 0) {
        return <div className="rds-pdf-modal-loading">
            <div className="loading-spinner"></div>
            <p>正在生成报告AI摘要</p>
            <p className="countdown">倒计时 {countdown} 秒</p>
          </div>;
      } else {
        return <div className="rds-pdf-modal-loading">
            <div className="loading-spinner"></div>
            <p>请稍等...</p>
          </div>;
      }
    }
    if (!aiDescription) {
      return <div className="rds-pdf-modal-empty">暂无AI摘要</div>;
    }

    // 使用marked渲染markdown
    const htmlContent = marked(aiDescription);
    return <div className="rds-pdf-modal-markdown" dangerouslySetInnerHTML={{
      __html: htmlContent
    }} />;
  }
  propsRef.current = props;
  useLayoutEffect(() => {
    // 启动倒计时
    if (propsRef.current.loadingAI) {
      startCountdown();
    }

    // 添加ESC键监听
    document.addEventListener('keydown', handleEscKey);
    return () => {
      stopCountdown();
      document.removeEventListener('keydown', handleEscKey);
    };
    // Preserve the legacy mount lifecycle; handlers read current props through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const previousCommitRef = useRef();
  useLayoutEffect(() => {
    if (previousCommitRef.current) {
      const {
        props: prevProps
      } = previousCommitRef.current;
      // 如果从loading变为完成，停止倒计时
      if (prevProps.loadingAI && !propsRef.current.loadingAI) {
        stopCountdown();
      }
      // 如果从非loading变为loading，启动倒计时
      if (!prevProps.loadingAI && propsRef.current.loadingAI) {
        startCountdown();
      }
    }
    previousCommitRef.current = {
      props: props,
      state: state
    };
  });
  const {
    report
  } = propsRef.current;
  const {
    aiCollapsed
  } = stateRef.current;
  if (!report) return null;
  const pdfUrl = `/reportsdatamanage/show/content?report_id=${report.id}#view=FitH`;
  const contentClassName = `rds-pdf-modal-content${aiCollapsed ? ' rds-pdf-modal-content-collapsed' : ''}`;
  return <div className="rds-modal-overlay" onClick={handleOverlayClick}>
        <div className="rds-pdf-modal">
          <div className="rds-pdf-modal-header">
            <h3 className="rds-pdf-modal-title">{report.report_title}</h3>
            <button className="rds-pdf-modal-close" onClick={handleClose}>
              ×
            </button>
          </div>
          
          <div className={contentClassName}>
            <div className="rds-pdf-modal-left">
              <iframe src={pdfUrl} title="PDF预览" className="rds-pdf-iframe" />
            </div>

            <div className="rds-pdf-modal-splitter">
              <button type="button" className="rds-pdf-modal-splitter-btn" onClick={handleToggleAI} title={aiCollapsed ? '展开AI摘要' : '折叠AI摘要'}>
                {aiCollapsed ? '‹' : '›'}
              </button>
            </div>
            
            <div className="rds-pdf-modal-right">
              <div className="rds-pdf-modal-ai-section">
                <h4 className="rds-pdf-modal-ai-title">AI摘要（仅供参考，以原文为准）</h4>
                <div className="rds-pdf-modal-ai-content">
                  {renderAIContent()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>;
}



ReportsDataShowPDFModal.propTypes = {
  report: PropTypes.object,
  loadingAI: PropTypes.bool,
  aiDescription: PropTypes.string,
  onClose: PropTypes.func.isRequired,
};

ReportsDataShowPDFModal.defaultProps = {
  report: null,
  loadingAI: false,
  aiDescription: '',
};

export default ReportsDataShowPDFModal;
