import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Button, Modal } from 'react-bootstrap';
import OnPasteSelect from '../../components/OnPasteSelect';
import { fetchMyDashboards } from '../api';

export default function SaveChartModal({ userId, defaultName, saving, onSave, onHide }) {
  const [chartName, setChartName] = useState(defaultName || '');
  const [addToDash, setAddToDash] = useState('new');
  const [newPageName, setNewPageName] = useState('');
  const [dashboardId, setDashboardId] = useState(null);
  const [dashboards, setDashboards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetchMyDashboards(userId)
      .then((options) => {
        if (active) setDashboards(options);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  function handleSave(gotoDash) {
    if (!chartName.trim()) {
      setError('请输入图表名');
      return;
    }
    if (addToDash === 'new' && !newPageName.trim()) {
      setError('请输入新页面名称');
      return;
    }
    if (addToDash === 'existing' && !dashboardId) {
      setError('请选择页面');
      return;
    }
    setError('');
    onSave({
      chartName: chartName.trim(),
      addToDash,
      newPageName: newPageName.trim(),
      dashboardId,
    }, gotoDash);
  }

  return (
    <Modal show onHide={onHide} backdrop="static" className="index-save-chart-modal index-data-modal">
      <Modal.Header closeButton>
        <Modal.Title>
          <span className="index-data-modal__title-icon" aria-hidden="true"><i className="fa fa-save" /></span>
          保存图表
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="save-chart-form-group">
          <label className="save-chart-label" htmlFor="save-chart-name">图表名：</label>
          <input
            id="save-chart-name"
            type="text"
            className="calc-form-input"
            value={chartName}
            onChange={e => setChartName(e.target.value)}
            placeholder="图表名"
          />
        </div>
        <div className={`save-chart-form-group save-chart-destination${addToDash === 'new' ? ' is-selected' : ''}`}>
          <label className="save-chart-radio-label">
            <input type="radio" name="addToDash" checked={addToDash === 'new'} onChange={() => setAddToDash('new')} />
            <span>保存到新页面</span>
          </label>
          <input
            type="text"
            className="calc-form-input"
            aria-label="新页面名称"
            value={newPageName}
            onChange={e => setNewPageName(e.target.value)}
            placeholder="页面名称"
            disabled={addToDash !== 'new'}
          />
        </div>
        <div className={`save-chart-form-group save-chart-destination${addToDash === 'existing' ? ' is-selected' : ''}`}>
          <label className="save-chart-radio-label">
            <input
              type="radio"
              name="addToDash"
              checked={addToDash === 'existing'}
              onChange={() => setAddToDash('existing')}
            />
            <span>保存到现有页面</span>
          </label>
          <OnPasteSelect
            className="index-data-select"
            aria-label="选择现有页面"
            placeholder="请选择页面"
            options={dashboards}
            value={dashboards.find(option => option.value === dashboardId) || null}
            onChange={option => setDashboardId(option ? option.value : null)}
            isLoading={loading}
            isDisabled={addToDash !== 'existing'}
            isClearable
            maxMenuHeight={200}
          />
        </div>
        <div className={`save-chart-form-group save-chart-destination${addToDash === 'none' ? ' is-selected' : ''}`}>
          <label className="save-chart-radio-label">
            <input type="radio" name="addToDash" checked={addToDash === 'none'} onChange={() => setAddToDash('none')} />
            <span>仅保存图表</span>
          </label>
        </div>
        {error && <div className="calc-form-error" role="alert">{error}</div>}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="primary" onClick={() => handleSave(false)} disabled={saving}>保存</Button>
        <Button
          variant="outline-primary"
          onClick={() => handleSave(true)}
          disabled={saving || addToDash === 'none'}
        >
          保存并转到页面
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

SaveChartModal.propTypes = {
  userId: PropTypes.string,
  defaultName: PropTypes.string,
  saving: PropTypes.bool,
  onSave: PropTypes.func.isRequired,
  onHide: PropTypes.func.isRequired,
};

SaveChartModal.defaultProps = {
  userId: '',
  defaultName: '',
  saving: false,
};
