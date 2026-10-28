import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Button, Modal } from 'react-bootstrap';
import OnPasteSelect from '../../components/OnPasteSelect';

function filterParentOption(option, input) {
  const path = option.label.toLowerCase();
  return input.trim().toLowerCase().split(/\s+/).filter(Boolean)
    .every(keyword => path.includes(keyword));
}

// 添加和修改节点共用表单；添加时固定父节点，修改时可重新选择。
export function CategoryNameModal({
  title, description, initialName, parentPath, initialParentId, parentOptions, saving, onSubmit, onHide,
}) {
  const [name, setName] = useState(initialName || '');
  const [parentId, setParentId] = useState(initialParentId);
  const [error, setError] = useState('');
  const selectedParent = parentOptions && parentOptions.find(option => option.value === Number(parentId));

  function handleSubmit(event) {
    if (event) event.preventDefault();
    if (saving) return;
    const value = name.trim();
    if (!value) {
      setError('请输入节点名称');
      return;
    }
    if (value.length > 100) {
      setError('节点名称不能超过100个字符');
      return;
    }
    if (parentOptions && !selectedParent) {
      setError('请选择父节点');
      return;
    }
    setError('');
    if (parentOptions) onSubmit(value, Number(parentId));
    else onSubmit(value);
  }

  return (
    <Modal show onHide={onHide} backdrop="static" className="index-category-modal index-data-modal">
      <form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>
            <span className="index-data-modal__title-icon" aria-hidden="true">
              <i className="fa fa-folder-o" />
            </span>
            {title}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {description && <div className="category-modal-description">{description}</div>}
          <div className="index-category-modal__field">
            <label htmlFor="category-node-name">节点名称</label>
            <input
              id="category-node-name"
              type="text"
              className="calc-form-input"
              placeholder="请输入节点名称"
              value={name}
              disabled={saving}
              onChange={e => setName(e.target.value)}
            />
          </div>
          {(parentOptions || parentPath) && (
            <div className="index-category-modal__field">
              <label htmlFor="category-parent-node">父节点</label>
              {parentOptions ? (
                <OnPasteSelect
                  inputId="category-parent-node"
                  className="index-data-select"
                  options={parentOptions}
                  value={selectedParent || null}
                  isDisabled={saving}
                  isSearchable
                  placeholder="输入关键字筛选父节点"
                  noOptionsMessage={() => '没有匹配的父节点'}
                  filterOption={filterParentOption}
                  onChange={option => setParentId(option ? option.value : null)}
                  maxMenuHeight={200}
                  menuPlacement="auto"
                />
              ) : (
                <div id="category-parent-node" className="index-category-modal__parent-path" role="textbox" aria-label="父节点" aria-readonly="true">
                  {parentPath}
                </div>
              )}
              {selectedParent && <div className="index-category-modal__path">{selectedParent.label}</div>}
            </div>
          )}
          {error && <div className="calc-form-error" role="alert">{error}</div>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onHide} disabled={saving}>取消</Button>
          <Button type="submit" variant="primary" disabled={saving}>{saving ? '保存中…' : '保存'}</Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}

CategoryNameModal.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.node,
  initialName: PropTypes.string,
  parentPath: PropTypes.string,
  initialParentId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  parentOptions: PropTypes.arrayOf(PropTypes.shape({ value: PropTypes.number, label: PropTypes.string })),
  saving: PropTypes.bool,
  onSubmit: PropTypes.func.isRequired,
  onHide: PropTypes.func.isRequired,
};

CategoryNameModal.defaultProps = {
  description: null,
  initialName: '',
  parentPath: '',
  initialParentId: null,
  parentOptions: null,
  saving: false,
};

export function ConfirmModal({ title, message, confirmText = '删除', saving = false, onConfirm, onHide }) {
  return (
    <Modal show onHide={onHide} backdrop="static" className="index-confirm-modal index-data-modal">
      <Modal.Header closeButton>
        <Modal.Title>
          <span className="index-data-modal__title-icon" aria-hidden="true">
            <i className="fa fa-trash-o" />
          </span>
          {title}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="index-confirm-modal__message">{message}</div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide}>取消</Button>
        <Button variant="danger" onClick={onConfirm} disabled={saving}>{confirmText}</Button>
      </Modal.Footer>
    </Modal>
  );
}

ConfirmModal.propTypes = {
  title: PropTypes.string.isRequired,
  message: PropTypes.node.isRequired,
  confirmText: PropTypes.string,
  saving: PropTypes.bool,
  onConfirm: PropTypes.func.isRequired,
  onHide: PropTypes.func.isRequired,
};

ConfirmModal.defaultProps = {
  confirmText: '删除',
  saving: false,
};
