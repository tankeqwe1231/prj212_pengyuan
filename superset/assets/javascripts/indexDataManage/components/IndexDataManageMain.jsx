/* global notify */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'react-bootstrap';
import { LicenseManager } from 'ag-grid-enterprise';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-balham.css';
import '../../../stylesheets/index_data_manage.css';
import AlertsWrapper from '../../components/AlertsWrapper';
import { aesEncrypt } from '../../modules/utils';
import { aggridlicense } from '../../../visualizations/constants';
import { postAction } from '../api';
import IndexTreePanel from './IndexTreePanel';
import SelectedIndexGrid from './SelectedIndexGrid';
import DataPanel from './DataPanel';
import FormulaModal from '../modals/FormulaModal';
import SaveChartModal from '../modals/SaveChartModal';
import { CategoryNameModal, ConfirmModal } from '../modals/CategoryModals';
import {
  buildMoveRequest,
  findNode,
  getParentCategoryOptions,
  isCategoryNode,
  isRealCategory,
  isRootCategory,
} from '../utils/treeUtils';
import {
  FORMULA_LETTERS,
  childIndexToDependencies,
  dependenciesToChildIndex,
  generateSqlFromFormula,
} from '../utils/formulaUtils';
import {
  DEFAULT_COLOR_SCHEME,
  buildVarietyColorMap,
  getDefaultChartName,
  getVisibleRows,
  orderRows,
  readStoredSize,
  writeStoredSize,
} from '../utils/chartUtils';

LicenseManager.setLicenseKey(aggridlicense);

const MAX_BATCH = 100;
const SELECTION_HEIGHT_KEY = 'indexDataManage.selectionPanelHeight';
const SIDEBAR_WIDTH_KEY = 'indexDataManage.sidebarWidth';

function readPageConfig() {
  const container = document.getElementById('main_contain');
  let indexManage = {};
  try {
    indexManage = JSON.parse(container.getAttribute('data-index_manage') || '{}');
  } catch (e) {
    indexManage = {};
  }
  return { indexManage, userId: container.getAttribute('data-user-id') || '' };
}

function notifyWarning(message) {
  notify.show(message, { type: 'warning', time: 5000 });
}

function chunk(items, size) {
  const result = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

function useDragResize(storageKey, fallback, min, max, axis) {
  const [size, setSize] = useState(() => readStoredSize(storageKey, fallback, min, max));
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const start = useCallback((event) => {
    event.preventDefault();
    const origin = axis === 'x' ? event.clientX : event.clientY;
    const initial = sizeRef.current;
    const handleMove = (moveEvent) => {
      const delta = (axis === 'x' ? moveEvent.clientX : moveEvent.clientY) - origin;
      setSize(Math.min(max, Math.max(min, initial + delta)));
    };
    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      writeStoredSize(storageKey, sizeRef.current);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [storageKey, min, max, axis]);
  const reset = useCallback(() => {
    setSize(fallback);
    writeStoredSize(storageKey, fallback);
  }, [storageKey, fallback]);
  return [size, start, reset];
}

export default function IndexDataManageMain() {
  const pageConfig = useMemo(readPageConfig, []);
  const [catalog, setCatalog] = useState({ indexes: {}, tree: null, categoryMap: [], sources: [] });
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [treeMoving, setTreeMoving] = useState(false);
  const treeMovingRef = useRef(false);
  const [treeSelectedKeys, setTreeSelectedKeys] = useState([]);
  const [revealNodeKey, setRevealNodeKey] = useState(null);
  const [selectedIndexes, setSelectedIndexes] = useState([]);
  const [checkedKeys, setCheckedKeys] = useState([]);
  const [latestValues, setLatestValues] = useState({});
  const [timeSeriesData, setTimeSeriesData] = useState(null);
  const [chartRows, setChartRows] = useState([]);
  const [extracting, setExtracting] = useState(false);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sidebarWidth, startSidebarResize, resetSidebarWidth] =
    useDragResize(SIDEBAR_WIDTH_KEY, 300, 220, 640, 'x');
  const [selectionHeight, startSelectionResize, resetSelectionHeight] =
    useDragResize(SELECTION_HEIGHT_KEY, 210, 120, 520, 'y');
  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;
  const selectedRef = useRef(selectedIndexes);
  selectedRef.current = selectedIndexes;

  const loadCatalog = useCallback(() => {
    setCatalogLoading(true);
    return postAction('get_index_list')
      .then((response) => {
        const indexes = {};
        (response.indexDataList || []).forEach((item) => {
          indexes[item.key] = item;
        });
        setCatalog({
          indexes,
          tree: response.treeNodeDict || null,
          categoryMap: response.categoryMap || [],
          sources: response.sources || [],
        });
      })
      .catch(error => notify.error(`获取指标列表失败: ${error.message}`))
      .finally(() => setCatalogLoading(false));
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const loadLatestValues = useCallback((rows) => {
    const targets = rows.filter(row => !row.isCalculate);
    chunk(targets, MAX_BATCH).forEach((batch) => {
      postAction('get_latest_values', {
        indexes: batch.map(row => ({ key: row.key, 指标名称: row.指标名称 })),
      })
        .then(response => setLatestValues(current => ({ ...current, ...(response.latestValues || {}) })))
        .catch(error => notify.error(`获取最新值失败: ${error.message}`));
    });
  }, []);

  const addIndexes = useCallback((keys) => {
    const existing = new Set(selectedRef.current.map(row => row.key));
    const rows = keys
      .filter(key => !existing.has(key) && catalogRef.current.indexes[key])
      .map(key => catalogRef.current.indexes[key]);
    if (!rows.length) {
      notify.info(keys.length === 1 ? '该指标已添加' : '所选指标均已添加');
      return;
    }
    setSelectedIndexes(current => current.concat(rows));
    setCheckedKeys(current => current.concat(rows.map(row => row.key)));
    loadLatestValues(rows);
  }, [loadLatestValues]);

  const gridRows = useMemo(() => selectedIndexes.map(row => (
    latestValues[row.key] ? { ...row, ...latestValues[row.key] } : row
  )), [selectedIndexes, latestValues]);

  // ---------- 树交互 ----------
  function handleTreeClick(node, event) {
    if (isCategoryNode(node)) return;
    if (event && (event.ctrlKey || event.metaKey)) {
      setTreeSelectedKeys(current => (current.indexOf(node.key) === -1
        ? current.concat(node.key)
        : current.filter(key => key !== node.key)));
      return;
    }
    setTreeSelectedKeys([node.key]);
  }

  function getTargetLeafKeys(node) {
    return treeSelectedKeys.indexOf(node.key) !== -1 ? treeSelectedKeys : [node.key];
  }

  function runTreeMutation(request, successMessage, revealKey, onSuccess) {
    setSaving(true);
    const { action, ...payload } = request;
    return postAction(action, payload)
      .then(() => {
        setModal(null);
        if (onSuccess) onSuccess();
        if (successMessage) notify.success(successMessage);
        if (revealKey) setRevealNodeKey(revealKey);
        return loadCatalog();
      })
      .catch(error => notify.error(error.message))
      .finally(() => setSaving(false));
  }

  function handleNodeDrop(dragNode, target, position) {
    if (treeMovingRef.current) return;
    const request = buildMoveRequest(catalogRef.current.tree, dragNode, target, position);
    if (!request) return;
    // 同步阻止重复提交，直到移动请求和目录刷新都结束后才恢复交互。
    treeMovingRef.current = true;
    setTreeMoving(true);
    runTreeMutation(request, null, dragNode.key).finally(() => {
      treeMovingRef.current = false;
      setTreeMoving(false);
    });
  }

  function getContextMenuItems(node) {
    if (isCategoryNode(node)) {
      if (!isRealCategory(node)) return [];
      const items = [{
        label: '添加子节点',
        icon: 'fa fa-plus',
        onClick: () => setModal({ type: 'addCategory', parent: node }),
      }];
      if (!isRootCategory(node)) {
        items.push({ label: '修改节点', icon: 'fa fa-edit', onClick: () => setModal({ type: 'editCategory', node }) });
        const original = findNode(catalogRef.current.tree, node.key);
        if (original && original.node.children.length === 0) {
          items.push(
            { divider: true },
            { label: '删除节点', icon: 'fa fa-trash-o', onClick: () => setModal({ type: 'deleteNode', node }) },
          );
        }
      }
      return items;
    }
    const keys = getTargetLeafKeys(node);
    const located = findNode(catalogRef.current.tree, node.key);
    const parent = located && located.parent;
    const items = [{
      label: keys.length > 1 ? `添加 ${keys.length} 个指标到操作列表` : '添加到操作列表',
      icon: 'fa fa-plus-square-o',
      onClick: () => addIndexes(keys),
    }];
    if (parent && isRealCategory(parent)) {
      items.push({
        label: keys.length > 1 ? `为 ${keys.length} 个指标新建节点` : '新建节点并移入',
        icon: 'fa fa-folder-open-o',
        onClick: () => setModal({ type: 'groupCategory', parent, keys }),
      });
    }
    // items.push(
    //   { divider: true },
    //   { label: '删除指标', icon: 'fa fa-trash-o', onClick: () => setModal({ type: 'deleteNode', node }) },
    // );
    return items;
  }

  // ---------- 操作列表 ----------
  function getCheckedRows() {
    const checked = new Set(checkedKeys);
    return selectedIndexes.filter(row => checked.has(row.key));
  }

  function handleRemoveRow(key) {
    setSelectedIndexes(current => current.filter(row => row.key !== key));
    setCheckedKeys(current => current.filter(item => item !== key));
  }

  function handleReorder(orderedKeys) {
    setSelectedIndexes((current) => {
      const byKey = {};
      current.forEach((row) => {
        byKey[row.key] = row;
      });
      return orderedKeys.map(key => byKey[key]).filter(Boolean);
    });
  }

  function handleClearRows() {
    setSelectedIndexes([]);
    setCheckedKeys([]);
  }

  function handleExtract() {
    const rows = getCheckedRows();
    if (!rows.length) {
      notify.error('请至少勾选一个指标');
      return;
    }
    if (rows.length > MAX_BATCH) {
      notify.error(`单次最多提取${MAX_BATCH}个指标`);
      return;
    }
    setExtracting(true);
    postAction('get_index_data', {
      indexlist: rows.map(row => ({
        key: row.key,
        指标名称: row.指标名称,
        is_calculate: Boolean(row.isCalculate),
        指标语句: row.isCalculate ? aesEncrypt(row.指标语句) : undefined,
      })),
    })
      .then((response) => {
        const data = response.dataDict || {};
        if (!data.index || !data.index.length) {
          notify.info('所选指标暂无数据');
        }
        setTimeSeriesData(data);
        setChartRows(rows);
      })
      .catch(error => notify.error(`提取数据失败: ${error.message}`))
      .finally(() => setExtracting(false));
  }

  // ---------- 计算公式 ----------
  function handleNewFormula() {
    const rows = getCheckedRows().filter(row => !row.isCalculate);
    if (!rows.length) {
      notify.error('请先勾选参与计算的普通指标');
      return;
    }
    if (rows.length > FORMULA_LETTERS.length) {
      notify.error(`最多选择 ${FORMULA_LETTERS.length} 个指标参与计算`);
      return;
    }
    setModal({
      type: 'formula',
      mode: 'create',
      initial: {
        dependencies: rows.map((row, i) => ({ letter: FORMULA_LETTERS[i], key: row.key, 指标名称: row.指标名称 })),
      },
    });
  }

  function handleEditRow(row) {
    if (row.isCalculate) {
      setModal({
        type: 'formula',
        mode: 'editTemporary',
        initial: {
          index: row,
          name: row.指标名称,
          formula: row.计算配置.formula,
          dependencies: childIndexToDependencies(row.计算配置.childIndex),
        },
      });
      return;
    }
    postAction('get_index_formula', { key: row.key })
      .then((response) => {
        const config = response.formula_config || {};
        setModal({
          type: 'formula',
          mode: 'edit',
          initial: {
            index: row,
            name: row.指标名称,
            formula: config.formula || '',
            dependencies: childIndexToDependencies(config.childIndex),
            readOnlyReason: response.is_formula_read_only ? (response.read_only_reason || '该公式暂不支持编辑') : '',
            displayFormula: response.display_formula || '',
            rawSql: response.raw_sql || '',
            calculationDefinition: response.calculation_definition || null,
          },
        });
      })
      .catch(error => notify.error(`获取指标公式失败: ${error.message}`));
  }

  function upsertRow(row, replaceKey) {
    setSelectedIndexes((current) => {
      const index = current.findIndex(item => item.key === (replaceKey || row.key));
      if (index === -1) return current.concat(row);
      const next = current.slice();
      next[index] = row;
      return next;
    });
    setCheckedKeys((current) => {
      const next = current.filter(key => key !== replaceKey && key !== row.key);
      return next.concat(row.key);
    });
    setChartRows(current => current.map(item => (item.key === (replaceKey || row.key) ? row : item)));
  }

  function warnIfNotRefreshed(response) {
    if (response.data_refreshed === false) {
      notifyWarning('公式已保存，但该语句无法直接写入数据表，指标数据未刷新');
    }
  }

  function handleFormulaSubmit(result) {
    const { initial } = modal;
    const childIndex = dependenciesToChildIndex(result.dependencies);
    const config = { formula: result.formula, childIndex };
    let sql;
    try {
      sql = generateSqlFromFormula(result.formula, childIndex, pageConfig.indexManage);
    } catch (error) {
      notify.error(error.message);
      return;
    }
    const replacedKey = result.type === 'saveAs' ? null : initial.index && initial.index.key;
    if (result.type !== 'update' && selectedIndexes.some(row =>
      row.指标名称 === result.name && row.key !== replacedKey)) {
      notify.error('操作列表中已存在同名指标');
      return;
    }

    if (result.type === 'temporary') {
      const key = initial.index ? initial.index.key : `calc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      upsertRow({
        key,
        指标名称: result.name,
        指标来源: '计算指标',
        品种: '',
        isCalculate: true,
        计算配置: config,
        指标语句: sql,
      }, initial.index && initial.index.key);
      setModal(null);
      return;
    }

    let indexinfo;
    let action = 'add_index';
    if (result.type === 'create') {
      indexinfo = {
        指标名称: result.name,
        数据库: result.source.database,
        指标列表: result.source.list_table,
        node_id: result.nodeId,
      };
    } else if (result.type === 'saveAs') {
      const source = initial.index;
      if (!Number.isInteger(source.node_id) || source.node_id <= 0) {
        notify.error('原指标未归类，不能另存，请先将其移入节点');
        return;
      }
      indexinfo = {
        指标名称: result.name,
        数据库: source.数据库,
        指标列表: source.指标列表,
        node_id: source.node_id,
      };
    } else {
      action = 'edit_index';
      indexinfo = { key: initial.index.key };
    }
    indexinfo.指标语句 = aesEncrypt(sql);
    indexinfo.计算配置 = config;

    setSaving(true);
    postAction(action, { indexinfo })
      .then((response) => {
        warnIfNotRefreshed(response);
        if (action === 'edit_index') {
          upsertRow({ ...initial.index, 计算配置: response.formula_config, 指标来源: response.指标来源 });
          notify.success('公式已保存');
        } else {
          upsertRow(response, initial.index && initial.index.isCalculate ? initial.index.key : null);
          setRevealNodeKey(response.key);
          notify.success('计算指标已保存');
        }
        setModal(null);
        return loadCatalog();
      })
      .catch(error => notify.error(`保存失败: ${error.message}`))
      .finally(() => setSaving(false));
  }

  // ---------- 保存图表 ----------
  function handleOpenSaveChart(chartState) {
    const rows = chartState.chartType === 'pivot'
      ? orderRows(chartRows, chartState.pivotOrder)
      : chartRows;
    const visible = getVisibleRows(rows, chartState.configs, chartState.chartType);
    const savable = visible.filter(row => !row.isCalculate);
    if (!savable.length) {
      notify.error('没有可保存的指标（临时计算指标需先保存为计算指标）');
      return;
    }
    if (savable.length < visible.length) {
      notifyWarning('临时计算指标不会保存到图表中');
    }
    setModal({
      type: 'saveChart',
      chartState,
      rows: savable,
      defaultName: getDefaultChartName(savable, chartState.configs),
    });
  }

  function handleSaveChart(form, gotoDash) {
    const { chartState, rows } = modal;
    setSaving(true);
    postAction('save_chart', {
      ...form,
      chartType: chartState.chartType,
      colorScheme: DEFAULT_COLOR_SCHEME,
      indexes: rows.map((row) => {
        const config = chartState.configs[row.指标名称] || {};
        return {
          key: row.key,
          指标名称: row.指标名称,
          chartType: config.chartType || chartState.chartType,
          stacked: config.stacked !== undefined ? config.stacked : chartState.isStacked,
          yAxisIndex: config.yAxisIndex === 1 ? 1 : 0,
        };
      }),
      pivotIndicatorOrder: chartState.pivotOrder,
      pivotShowVarietyLabels: chartState.showVarietyLabels,
      pivotVarietyColors: buildVarietyColorMap(rows),
    })
      .then((response) => {
        setModal(null);
        const dropped = rows.length - (response.savedIndexNames || []).length;
        notify.success(dropped > 0
          ? `图表已保存（${dropped} 个其他数据源的指标未保存）`
          : '图表已保存');
        if (gotoDash && response.dashboard) {
          window.open(response.dashboard, '_blank');
        }
      })
      .catch(error => notify.error(`保存图表失败: ${error.message}`))
      .finally(() => setSaving(false));
  }

  // ---------- 弹窗 ----------
  function renderModal() {
    if (!modal) return null;
    const hide = () => !saving && setModal(null);
    const parentOptions = getParentCategoryOptions(catalog.tree, modal.node && modal.node.node_id);
    const parentOption = modal.parent && parentOptions.find(option => option.value === modal.parent.node_id);
    switch (modal.type) {
      case 'formula':
        return (
          <FormulaModal
            mode={modal.mode}
            initial={modal.initial}
            candidateIndexes={selectedIndexes}
            sources={catalog.sources}
            tree={catalog.tree}
            categoryMap={catalog.categoryMap}
            saving={saving}
            onSubmit={handleFormulaSubmit}
            onHide={hide}
          />
        );
      case 'saveChart':
        return (
          <SaveChartModal
            userId={pageConfig.userId}
            defaultName={modal.defaultName}
            saving={saving}
            onSave={handleSaveChart}
            onHide={hide}
          />
        );
      case 'addCategory':
        return (
          <CategoryNameModal
            title="添加子节点"
            parentPath={parentOption ? parentOption.label : modal.parent.name}
            saving={saving}
            onSubmit={name => runTreeMutation(
              { action: 'add_category', node_name: name, parent_node_id: modal.parent.node_id },
              '节点已创建', modal.parent.key)}
            onHide={hide}
          />
        );
      case 'groupCategory':
        return (
          <CategoryNameModal
            title="新建节点并移入指标"
            description={`新建节点后将移入 ${modal.keys.length} 个指标`}
            parentPath={parentOption ? parentOption.label : modal.parent.name}
            saving={saving}
            onSubmit={name => runTreeMutation({
              action: 'add_category',
              node_name: name,
              parent_node_id: modal.parent.node_id,
              node_keys: modal.keys,
            }, '节点已创建', modal.keys[0])}
            onHide={hide}
          />
        );
      case 'editCategory':
        return (
          <CategoryNameModal
            title="修改节点"
            initialName={modal.node.name}
            initialParentId={modal.node.parent_id}
            parentOptions={parentOptions}
            saving={saving}
            onSubmit={(name, parentId) => runTreeMutation(
              { action: 'update_category', node_id: modal.node.node_id, node_name: name, parent_node_id: parentId },
              '节点已修改', modal.node.key)}
            onHide={hide}
          />
        );
      case 'deleteNode':
        return (
          <ConfirmModal
            title={isCategoryNode(modal.node) ? '删除节点' : '删除指标'}
            message={isCategoryNode(modal.node)
              ? `确定删除节点“${modal.node.name}”吗？节点下不能有子节点或指标。`
              : `确定从指标列表中删除“${modal.node.name}”吗？此操作不可恢复。`}
            saving={saving}
            onConfirm={() => runTreeMutation(
              { action: 'delete_node', node_key: modal.node.key }, '删除成功', null,
              () => handleRemoveRow(modal.node.key))}
            onHide={hide}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className="index-data-manage-container">
      <AlertsWrapper />
      <div className="left-panel" style={{ width: sidebarWidth, flexBasis: sidebarWidth }}>
        <IndexTreePanel
          tree={catalog.tree}
          loading={catalogLoading}
          moving={treeMoving}
          selectedKeys={treeSelectedKeys}
          revealNodeKey={revealNodeKey}
          onNodeClick={handleTreeClick}
          onNodeDoubleClick={node => addIndexes([node.key])}
          contextMenuItems={getContextMenuItems}
          onNodeDrop={handleNodeDrop}
        />
      </div>
      <div
        className="panel-resizer panel-resizer-column"
        onMouseDown={startSidebarResize}
        onDoubleClick={resetSidebarWidth}
        title="拖动调整宽度，双击恢复默认"
        role="presentation"
      />
      <div className="right-panel">
        <div className="button-area">
          <Button className="index-data-action" variant="outline-primary" onClick={handleExtract} disabled={extracting}>提取数据</Button>
          <Button className="index-data-action" variant="outline-primary" onClick={handleNewFormula}>新建公式</Button>
          <Button className="index-data-action" variant="outline-primary" onClick={handleClearRows} disabled={!selectedIndexes.length}>
            清空指标
          </Button>
          <span className="button-area-hint">双击或右键指标添加到下方操作列表，Ctrl+单击可多选</span>
        </div>
        <div className="selection-grid-area" style={{ height: selectionHeight, flexBasis: selectionHeight }}>
          <SelectedIndexGrid
            rows={gridRows}
            checkedKeys={checkedKeys}
            onCheckedChange={setCheckedKeys}
            onEdit={handleEditRow}
            onRemove={handleRemoveRow}
            onReorder={handleReorder}
          />
        </div>
        <div
          className="panel-resizer panel-resizer-row"
          onMouseDown={startSelectionResize}
          onDoubleClick={resetSelectionHeight}
          title="拖动调整高度，双击恢复默认"
          role="presentation"
        />
        <DataPanel
          timeSeriesData={timeSeriesData}
          chartRows={chartRows}
          loading={extracting}
          onSaveChart={handleOpenSaveChart}
        />
      </div>
      {renderModal()}
    </div>
  );
}
