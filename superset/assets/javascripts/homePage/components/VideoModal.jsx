/* eslint no-unused-vars: 0 */
import React, { useLayoutEffect, useRef } from 'react';
import PropTypes from 'prop-types';

function VideoModal(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(VideoModal.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = VideoModal.defaultProps[key];
  });
  const propsRef = useRef(props);
  function handleEscKey(e) {
    if (e.key === 'Escape') {
      handleClose();
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
  propsRef.current = props;
  useLayoutEffect(() => {
    // 添加ESC键监听
    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
    // Install the stable ref-backed key handler once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const {
    video
  } = propsRef.current;
  if (!video) return null;
  const videoUrl = `/reportsdatamanage/show/content?report_id=${video.id}`;
  return <div className="homepage-video-modal-overlay" onClick={handleOverlayClick}>
        <div className="homepage-video-modal">
          <div className="homepage-video-modal-header">
            <h3 className="homepage-video-modal-title">{video.report_title}</h3>
            <button className="homepage-video-modal-close" onClick={handleClose}>
              ×
            </button>
          </div>
          
          <div className="homepage-video-modal-content">
            <video src={videoUrl} controls preload="metadata" autoPlay className="homepage-video-player">
              您的浏览器不支持视频播放
            </video>
          </div>
        </div>
      </div>;
}



VideoModal.propTypes = {
  video: PropTypes.object,
  onClose: PropTypes.func.isRequired,
};

VideoModal.defaultProps = {
  video: null,
};

export default VideoModal;
