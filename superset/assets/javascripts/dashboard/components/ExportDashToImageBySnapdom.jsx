import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Button, DropdownItem, Modal } from 'react-bootstrap';
import { useStore } from 'react-redux';
import { snapdom } from '@zumer/snapdom';

import { t } from '../../locales';
import { downloadDashboardPng, waitForDashboardRender } from '../snapshotUtils';
import { resumeDashboardResize, suppressDashboardResize } from '../resizeUtils';
import '../../../stylesheets/export-dash-image-modal.css';

function ExportDashToImageBySnapdom({ dashboardTitle, slices, triggerNode }) {
  const store = useStore();
  const slicesRef = useRef(slices);
  slicesRef.current = slices;
  const exportRef = useRef(null);
  const resizeFrameRef = useRef(null);
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => () => {
    if (exportRef.current) exportRef.current.abort();
    if (resizeFrameRef.current !== null) cancelAnimationFrame(resizeFrameRef.current);
    resumeDashboardResize();
  }, []);

  function close() {
    if (exportRef.current) exportRef.current.abort();
    exportRef.current = null;
    suppressDashboardResize();
    setShow(false);
  }

  function onExited() {
    // Match the dashboard's other modals: resume measurements after the
    // scrollbar is restored, to avoid a spurious resize of every slice.
    resizeFrameRef.current = requestAnimationFrame(() => {
      resizeFrameRef.current = requestAnimationFrame(() => {
        resizeFrameRef.current = null;
        resumeDashboardResize();
      });
    });
  }

  async function startExport() {
    if (exportRef.current) return;
    if (resizeFrameRef.current !== null) cancelAnimationFrame(resizeFrameRef.current);
    resizeFrameRef.current = null;
    resumeDashboardResize();
    const controller = new AbortController();
    exportRef.current = controller;
    setErrorMessage('');
    setStatus('exporting');
    setShow(true);

    try {
      const grid = document.getElementById('grid-container');
      if (!grid) throw new Error(t('未找到页面截图区域，请刷新页面后重试'));
      const dashboardState = store.getState().dashboard;
      const conf = dashboardState && dashboardState.common && dashboardState.common.conf;
      const queryTimeout = Number(conf && conf.SUPERSET_WEBSERVER_TIMEOUT) || 60;
      // This asynchronous wait lets the dialog paint immediately, including
      // when every chart was already rendered before the menu was clicked.
      await waitForDashboardRender(
        grid,
        () => slicesRef.current,
        () => store.getState().charts,
        controller.signal,
        Math.max(120000, (queryTimeout + 30) * 1000),
      );
      if (controller.signal.aborted) return;
      // No viewport clip: capture the entire grid, including offscreen rows.
      // PNG Blob export also supports SnapDOM's tiling for very tall pages.
      const blob = await snapdom.toBlob(grid, {
        format: 'png',
        backgroundColor: '#ffffff',
        dpr: 1,
        fast: false,
        exclude: '.chart-controls',
        excludeMode: 'remove',
      });
      if (controller.signal.aborted) return;
      downloadDashboardPng(blob, dashboardTitle);
      setStatus('completed');
    } catch (error) {
      if (!controller.signal.aborted) {
        setErrorMessage(error.message || t('截图生成失败，请重试'));
        setStatus('error');
      }
    } finally {
      if (exportRef.current === controller) exportRef.current = null;
    }
  }

  const exporting = status === 'exporting';
  return (
    <>
      <DropdownItem onClick={startExport}>{triggerNode}</DropdownItem>
      <Modal
        show={show}
        onHide={close}
        onExited={onExited}
        animation={false}
        backdrop="static"
        keyboard={!exporting}
        centered
        dialogClassName="export-dash-image-modal"
        aria-labelledby="export-dash-image-title"
      >
        <Modal.Header closeButton closeLabel={t('关闭')}>
          <Modal.Title as="h4" id="export-dash-image-title">
            <span className="export-dash-image-modal__title-icon" aria-hidden="true">
              <i className="fa fa-camera" />
            </span>
            {t('页面导出为图片')}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div
            className={`export-dash-image-modal__status${status === 'error' ? ' is-error' : ''}`}
            role={status === 'error' ? 'alert' : 'status'}
            aria-live="polite"
          >
            {exporting && <span className="export-dash-image-modal__spinner" aria-hidden="true" />}
            {status === 'completed' && <i className="fa fa-check-circle" aria-hidden="true" />}
            <span>
              {exporting && t('正在生成页面截图,请勿离开')}
              {status === 'completed' && t('截图完成，已下载至本机，请看浏览器右上角下载提示')}
              {status === 'error' && errorMessage}
            </span>
          </div>
        </Modal.Body>
        <Modal.Footer>
          {status === 'error' && <Button variant="outline-secondary" onClick={startExport}>{t('重试')}</Button>}
          <Button className="export-dash-image-modal__button" onClick={close}>
            {exporting ? t('取消') : t('关闭')}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

ExportDashToImageBySnapdom.propTypes = {
  dashboardTitle: PropTypes.string.isRequired,
  slices: PropTypes.array.isRequired,
  triggerNode: PropTypes.node.isRequired,
};

export default ExportDashToImageBySnapdom;
