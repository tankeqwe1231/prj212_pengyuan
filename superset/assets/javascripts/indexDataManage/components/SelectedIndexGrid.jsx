import React, { useEffect, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { AgGridReact } from 'ag-grid-react';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import { isCalculatedSource } from '../utils/formulaUtils';

const AG_GRID_MODULES = [AllEnterpriseModule];
const CENTER = { display: 'flex', justifyContent: 'center', alignItems: 'center' };

export function canEditStoredFormula(row) {
  if (!row || row.isCalculate) return false;
  const config = row.计算配置 || {};
  return isCalculatedSource(row) || Boolean(config.childIndex && Object.keys(config.childIndex).length);
}

function ActionCell({ data, context }) {
  const editable = data.isCalculate || canEditStoredFormula(data);
  return (
    <div className="selection-grid-actions">
      {editable && (
        <i
          className="fa fa-edit"
          role="button"
          title={data.isCalculate ? '编辑临时计算指标' : '查看或编辑指标公式'}
          onClick={() => context.onEdit(data)}
        />
      )}
      <i className="fa fa-trash" role="button" title="移除" onClick={() => context.onRemove(data.key)} />
    </div>
  );
}

ActionCell.propTypes = {
  data: PropTypes.object.isRequired,
  context: PropTypes.object.isRequired,
};

const formatFrequency = ({ value }) => (
  value == null || String(value).trim() === '' ? '未知' : String(value).trim()
);

export default function SelectedIndexGrid({ rows, checkedKeys, onCheckedChange, onEdit, onRemove, onReorder }) {
  const apiRef = useRef(null);
  const callbacksRef = useRef({});
  callbacksRef.current = { onEdit, onRemove };
  const checkedRef = useRef(checkedKeys);
  checkedRef.current = checkedKeys;

  const columnDefs = useMemo(() => [
    {
      headerName: '指标名称',
      field: '指标名称',
      rowDrag: true,
      width: 240,
      wrapText: true,
      autoHeight: true,
      cellStyle: { ...CENTER, lineHeight: '1.2', whiteSpace: 'normal', wordBreak: 'break-word' },
    },
    { headerName: '频率', field: '频率', width: 80, valueFormatter: formatFrequency },
    { headerName: '品种', field: '品种', width: 100 },
    { headerName: '指标来源', field: '指标来源', width: 100 },
    { headerName: '最新值', field: '最新值', width: 110 },
    { headerName: '最新数据日期', field: '最新数据日期', width: 120 },
    {
      headerName: '操作',
      colId: 'action',
      width: 80,
      resizable: false,
      suppressSizeToFit: true,
      cellRenderer: ActionCell,
    },
  ], []);
  const defaultColDef = useMemo(() => ({
    sortable: false,
    suppressHeaderMenuButton: true,
    resizable: true,
    cellStyle: CENTER,
  }), []);
  const rowSelection = useMemo(() => ({
    mode: 'multiRow',
    checkboxes: true,
    headerCheckbox: true,
    enableClickSelection: false,
  }), []);
  const context = useMemo(() => ({
    onEdit: row => callbacksRef.current.onEdit(row),
    onRemove: key => callbacksRef.current.onRemove(key),
  }), []);

  function syncSelection() {
    const api = apiRef.current;
    if (!api) return;
    const checked = new Set(checkedRef.current);
    const select = [];
    const unselect = [];
    api.forEachNode((node) => {
      const shouldSelect = checked.has(node.data.key);
      if (node.isSelected() !== shouldSelect) {
        (shouldSelect ? select : unselect).push(node);
      }
    });
    if (select.length) api.setNodesSelected({ nodes: select, newValue: true });
    if (unselect.length) api.setNodesSelected({ nodes: unselect, newValue: false });
  }

  useEffect(syncSelection, [checkedKeys]);

  return (
    <div className="ag-theme-balham selection-grid">
      <AgGridReact
        modules={AG_GRID_MODULES}
        theme="legacy"
        rowData={rows}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        rowSelection={rowSelection}
        selectionColumnDef={{ width: 50, minWidth: 50, maxWidth: 50, suppressSizeToFit: true }}
        context={context}
        getRowId={params => params.data.key}
        rowDragManaged
        onGridReady={(params) => {
          apiRef.current = params.api;
          syncSelection();
        }}
        onRowDataUpdated={syncSelection}
        onSelectionChanged={(event) => {
          if (event.source === 'api') return;
          onCheckedChange(event.api.getSelectedRows().map(row => row.key));
        }}
        onRowDragEnd={(event) => {
          const ordered = [];
          event.api.forEachNode(node => ordered.push(node.data.key));
          onReorder(ordered);
        }}
        enableCellTextSelection
      />
    </div>
  );
}

SelectedIndexGrid.propTypes = {
  rows: PropTypes.array.isRequired,
  checkedKeys: PropTypes.arrayOf(PropTypes.string).isRequired,
  onCheckedChange: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  onReorder: PropTypes.func.isRequired,
};
