import React, { useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import ModalTrigger from '../../components/ModalTrigger';
import { t } from '../../locales';

const $ = window.$ = require('jquery');

const propTypes = {
  triggerNode: PropTypes.node.isRequired,
  dashboardId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  dashboardTitle: PropTypes.string.isRequired,
};

function ExportDashToImage(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(ExportDashToImage.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = ExportDashToImage.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    status: 'exporting',
    // exporting, completed, error
    countdown: 45,
    filename: null,
    errorMessage: null
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
  function startExport() {
    updateState({
      status: 'exporting',
      countdown: 45,
      filename: null,
      errorMessage: null
    });

    // 开始倒计时
    countdownTimerRef.current = setInterval(() => {
      updateState(prevState => {
        if (prevState.countdown <= 1) {
          clearInterval(countdownTimerRef.current);
          return {
            countdown: 0
          };
        }
        return {
          countdown: prevState.countdown - 1
        };
      });
    }, 1000);

    // 发送ajax请求
    const url = '/superset/dash_screenshot';
    const params = {
      dash_id: propsRef.current.dashboardId,
      dash_name: propsRef.current.dashboardTitle
    };
    $.get(url, params).done(response => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
      if (response.filename) {
        updateState({
          status: 'completed',
          filename: response.filename,
          countdown: 0
        });
      } else {
        updateState({
          status: 'error',
          errorMessage: '返回数据格式错误',
          countdown: 0
        });
      }
    }).fail(xhr => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
      let errorMessage = '截图出错了';
      try {
        const response = JSON.parse(xhr.responseText);
        if (response.error) {
          errorMessage = response.error;
        }
      } catch (e) {
        errorMessage = xhr.status ? `请求失败 (${xhr.status})` : '网络错误';
      }
      updateState({
        status: 'error',
        errorMessage,
        countdown: 0
      });
    });
  }
  function renderContent() {
    const {
      status,
      countdown,
      filename,
      errorMessage
    } = stateRef.current;
    switch (status) {
      case 'exporting':
        return <div>
            <p>{t('正在生成页面截图,请勿离开')}</p>
            {countdown > 0 ? <p>{t('%s秒倒计时', countdown)}</p> : <div style={{
            textAlign: 'center',
            marginTop: '10px'
          }}>
                <i className="fa fa-spinner fa-spin fa-2x" style={{
              color: '#337ab7'
            }} />
                <p style={{
              marginTop: '10px'
            }}>{t('处理中...')}</p>
              </div>}
          </div>;
      case 'completed':
        return <div>
            <p>{t('正在生成页面截图,请勿离开')}</p>
            <div style={{
            marginTop: '10px'
          }}>
              <p>{t('截图：')}
                <a href={`/static/assets/images/dash_shots/${filename}`} target="_blank" rel="noopener noreferrer" download={filename}>
                  {filename}
                </a>
              </p>
            </div>
          </div>;
      case 'error':
        return <div>
            <p>{t('正在生成页面截图,请勿离开')}</p>
            <div style={{
            marginTop: '10px',
            color: 'red'
          }}>
              <p>{errorMessage || t('截图出错了')}</p>
            </div>
          </div>;
      default:
        return null;
    }
  }
  propsRef.current = props;
  useLayoutEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, []);
  return <ModalTrigger triggerNode={propsRef.current.triggerNode} isMenuItem modalTitle={t('页面导出为图片')} modalBody={renderContent()} beforeOpen={() => startExport()} backdrop="static" />;
}



ExportDashToImage.propTypes = propTypes;

export default ExportDashToImage;
