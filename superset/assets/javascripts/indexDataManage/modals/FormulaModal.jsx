import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Button, Modal } from 'react-bootstrap';
import OnPasteSelect from '../../components/OnPasteSelect';
import CategoryTreePicker from '../components/CategoryTreePicker';
import {
  FORMULA_HINT,
  FORMULA_LETTERS,
  addDependency,
  formatSqlForDisplay,
  isCalculatedSource,
  normalizeFormulaDependencies,
  removeDependency,
  validateFormula,
} from '../utils/formulaUtils';
import { getListGroup } from '../utils/treeUtils';

const TITLES = {
  create: '新建公式',
  editTemporary: '编辑临时计算指标',
  edit: '查看与编辑计算公式',
};

// superset.less 将 .modal-dialog 设为 1100，根节点内的菜单需高于弹窗主体。
const SELECT_MENU_STYLES = { menuPortal: base => ({ ...base, zIndex: 1101 }) };
const SELECT_MENU_CLASSES = { menuPortal: () => 'index-data-select' };

function sourceValue(source) {
  return `${source.database}|${source.list_table}`;
}

// mode: create | editTemporary | edit
// 提交结果 type: temporary（仅加入当前列表）| create（新建计算指标）| update（覆盖原公式）| saveAs（另存为新指标）
export default function FormulaModal({
  mode,
  initial,
  candidateIndexes,
  sources,
  tree,
  categoryMap,
  saving,
  onSubmit,
  onHide,
}) {
  const [name, setName] = useState(initial.name || '');
  const [formula, setFormula] = useState(initial.formula || '');
  const [dependencies, setDependencies] = useState(initial.dependencies || []);
  const [saveAsIndex, setSaveAsIndex] = useState(false);
  const [sourceKey, setSourceKey] = useState(() => {
    const first = (initial.dependencies || [])[0];
    const group = first ? getListGroup(first.key) : '';
    return sources.some(source => sourceValue(source) === group) ? group : null;
  });
  const [nodeId, setNodeId] = useState(null);
  const [saveAsName, setSaveAsName] = useState('');
  const [showSql, setShowSql] = useState(false);
  const [error, setError] = useState('');
  const [selectPortalTarget, setSelectPortalTarget] = useState(null);

  // 下拉菜单放在弹层根节点内，避开表单滚动区域裁剪并保留弹层焦点管理。
  const selectMenuProps = {
    menuPortalTarget: selectPortalTarget,
    menuPosition: 'fixed',
    menuPlacement: 'auto',
    minMenuHeight: 80,
    styles: SELECT_MENU_STYLES,
    classNames: SELECT_MENU_CLASSES,
  };

  const readOnly = mode === 'edit' && Boolean(initial.readOnlyReason);
  const definition = initial.calculationDefinition || null;
  const sourceOptions = useMemo(() => sources.map(source => ({
    value: sourceValue(source),
    label: `${source.variety || source.list_table}（${source.database}）`,
  })), [sources]);
  const dependencyOptions = candidateIndexes
    .filter(index => index.key && !index.isCalculate &&
      !dependencies.some(item => item.key === index.key) &&
      (!initial.index || index.key !== initial.index.key))
    .map(index => ({ value: index.key, label: index.指标名称, data: index }));

  function buildResult(type) {
    const message = validateFormula(formula, dependencies.map(item => item.letter));
    if (message) {
      setError(message);
      return null;
    }
    const normalized = normalizeFormulaDependencies(formula, dependencies);
    return { type, formula: normalized.formula, dependencies: normalized.dependencies };
  }

  function handleConfirm() {
    setError('');
    if (mode === 'edit') {
      const result = buildResult('update');
      if (result) onSubmit(result);
      return;
    }
    if (!name.trim()) {
      setError('请输入新指标名称');
      return;
    }
    if (saveAsIndex && (!sourceKey || !nodeId)) {
      setError(sourceKey ? '请选择保存节点' : '请选择保存品种');
      return;
    }
    const result = buildResult(saveAsIndex ? 'create' : 'temporary');
    if (!result) return;
    const source = sources.find(item => sourceValue(item) === sourceKey);
    onSubmit({ ...result, name: name.trim(), source, nodeId });
  }

  function handleSaveAs() {
    setError('');
    if (!saveAsName.trim()) {
      setError('请输入另存指标名');
      return;
    }
    const result = buildResult('saveAs');
    if (result) onSubmit({ ...result, name: saveAsName.trim() });
  }

  return (
    <Modal
      show
      scrollable
      onHide={onHide}
      onEnter={node => setSelectPortalTarget(node)}
      size="lg"
      backdrop="static"
      className="index-formula-modal index-data-modal"
    >
      <Modal.Header closeButton>
        <Modal.Title>
          <span className="index-data-modal__title-icon" aria-hidden="true"><i className="fa fa-calculator" /></span>
          {TITLES[mode]}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="calc-modal-body">
          <div className="calc-modal-left">
            <div className="index-list-label">指标列表</div>
            <div className="index-list-box">
              {dependencies.map(item => (
                <div key={item.letter} className="index-list-item">
                  <span className="index-list-letter">{item.letter}</span>
                  <span className="index-list-name" title={item.指标名称}>{item.指标名称}</span>
                  {!readOnly && (
                    <button
                      type="button"
                      className="index-list-remove"
                      title={`移除依赖 ${item.指标名称}`}
                      onClick={() => setDependencies(removeDependency(dependencies, item.letter))}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            {!readOnly && (
              <div className="edit-dependency-select">
                <OnPasteSelect
                  {...selectMenuProps}
                  className="index-data-select"
                  aria-label="添加公式依赖"
                  placeholder="从操作列表添加依赖"
                  options={dependencyOptions}
                  value={null}
                  isDisabled={dependencies.length >= FORMULA_LETTERS.length}
                  onChange={option => option && setDependencies(addDependency(dependencies, option.data))}
                  maxMenuHeight={150}
                />
              </div>
            )}
          </div>
          <div className="calc-modal-right">
            {mode === 'edit' ? (
              <div className="calc-form-group">
                <label className="calc-form-label">指标名：</label>
                <div className="calc-form-text">{initial.name}</div>
              </div>
            ) : (
              <div className="calc-form-group">
                <label className="calc-form-label" htmlFor="formula-index-name">新指标名：</label>
                <input
                  id="formula-index-name"
                  type="text"
                  className="calc-form-input"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
            )}
            {definition && definition.displayFormula && (
              <div className="calc-form-group">
                <label className="calc-form-label">公式说明：</label>
                <div className="calc-form-text">{definition.displayFormula}</div>
              </div>
            )}
            <div className="calc-form-group">
              <label className="calc-form-label" htmlFor="formula-expression">计算公式：</label>
              <input
                id="formula-expression"
                type="text"
                className="calc-form-input"
                value={readOnly ? (initial.displayFormula || '') : formula}
                disabled={readOnly}
                onChange={e => setFormula(e.target.value)}
              />
            </div>
            {readOnly && <div className="calc-form-hint calc-form-warning">{initial.readOnlyReason}</div>}
            {mode === 'edit' && initial.index && !isCalculatedSource(initial.index) && !readOnly && (
              <div className="calc-form-hint">保存后将覆盖原指标计算逻辑，并把指标来源改为“计算指标”。</div>
            )}
            <div className="calc-form-hint">{FORMULA_HINT}</div>
            {initial.rawSql && (
              <div className="calc-form-group">
                <button type="button" className="dynamic-sql-toggle" onClick={() => setShowSql(!showSql)}>
                  {showSql ? '收起 SQL ▴' : '查看 SQL ▾'}
                </button>
                {showSql && (
                  <textarea className="calc-sql-textarea" value={formatSqlForDisplay(initial.rawSql)} readOnly />
                )}
              </div>
            )}
            {mode === 'edit' && !readOnly && (
              <div className="calc-form-group">
                <label className="calc-form-label" htmlFor="formula-save-as">另存指标名：</label>
                <input
                  id="formula-save-as"
                  type="text"
                  className="calc-form-input"
                  value={saveAsName}
                  onChange={e => setSaveAsName(e.target.value)}
                />
              </div>
            )}
            {mode !== 'edit' && (
              <>
                <label className="calc-save-toggle">
                  <input
                    type="checkbox"
                    checked={saveAsIndex}
                    onChange={e => setSaveAsIndex(e.target.checked)}
                  />
                  <span>保存为计算指标</span>
                </label>
                <div className="calc-form-hint">
                  {saveAsIndex
                    ? '将写入所选品种的指标列表，并按公式生成数据。'
                    : '不保存时仅作为临时指标加入当前操作列表，刷新页面后失效。'}
                </div>
                {saveAsIndex && (
                  <>
                    <div className="calc-form-group">
                      <label className="calc-form-label" htmlFor="formula-source">品种：</label>
                      <OnPasteSelect
                        {...selectMenuProps}
                        inputId="formula-source"
                        className="index-data-select"
                        placeholder="请选择品种"
                        options={sourceOptions}
                        value={sourceOptions.find(option => option.value === sourceKey) || null}
                        onChange={option => setSourceKey(option ? option.value : null)}
                        isClearable
                        maxMenuHeight={150}
                      />
                    </div>
                    <div className="calc-form-group">
                      <CategoryTreePicker
                        label="保存到节点："
                        tree={tree}
                        categoryMap={categoryMap}
                        value={nodeId}
                        onChange={setNodeId}
                      />
                    </div>
                  </>
                )}
              </>
            )}
            {error && <div className="calc-form-error" role="alert">{error}</div>}
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide}>取消</Button>
        {mode === 'edit' && !readOnly && (
          <Button variant="outline-primary" onClick={handleSaveAs} disabled={saving}>另存为</Button>
        )}
        {!readOnly && (
          <Button variant="primary" onClick={handleConfirm} disabled={saving}>
            {saving ? '保存中…' : (mode === 'edit' ? '保存' : '确定')}
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}

FormulaModal.propTypes = {
  mode: PropTypes.oneOf(['create', 'editTemporary', 'edit']).isRequired,
  initial: PropTypes.shape({
    name: PropTypes.string,
    formula: PropTypes.string,
    dependencies: PropTypes.array,
    index: PropTypes.object,
    readOnlyReason: PropTypes.string,
    displayFormula: PropTypes.string,
    rawSql: PropTypes.string,
    calculationDefinition: PropTypes.object,
  }),
  candidateIndexes: PropTypes.array,
  sources: PropTypes.array,
  tree: PropTypes.object,
  categoryMap: PropTypes.array,
  saving: PropTypes.bool,
  onSubmit: PropTypes.func.isRequired,
  onHide: PropTypes.func.isRequired,
};

FormulaModal.defaultProps = {
  initial: {},
  candidateIndexes: [],
  sources: [],
  tree: null,
  categoryMap: [],
  saving: false,
};
