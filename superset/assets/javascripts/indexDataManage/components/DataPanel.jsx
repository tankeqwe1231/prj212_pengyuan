import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'react-bootstrap';
import { AgGridReact } from 'ag-grid-react';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import IndexDataChart from './IndexDataChart';
import IndexDataPivotTable from './IndexDataPivotTable';
import {
  CHART_TYPE_OPTIONS,
  SERIES_TYPE_OPTIONS,
  getVarieties,
  moveIndicator,
  orderRows,
  reconcileIndicatorOrder,
  supportsSeriesOptions,
} from '../utils/chartUtils';

const AG_GRID_MODULES = [AllEnterpriseModule];

function DataGrid({ timeSeriesData }) {
  const columnDefs = useMemo(() => [
    { headerName: '日期', field: '日期', width: 140, pinned: 'left', sort: 'desc' },
    ...(timeSeriesData.columns || []).map((name, i) => ({
      headerName: name,
      colId: `c${i}`,
      width: 150,
      valueGetter: params => params.data.values[i],
    })),
  ], [timeSeriesData]);
  const rowData = useMemo(() => (timeSeriesData.index || []).map((date, i) => ({
    日期: date,
    values: (timeSeriesData.data || [])[i] || [],
  })), [timeSeriesData]);
  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    suppressHeaderMenuButton: true,
    cellStyle: { textAlign: 'center' },
  }), []);
  return (
    <div className="ag-theme-balham data-grid">
      <AgGridReact
        modules={AG_GRID_MODULES}
        theme="legacy"
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        rowData={rowData}
        cellSelection
      />
    </div>
  );
}

DataGrid.propTypes = {
  timeSeriesData: PropTypes.object.isRequired,
};

export default function DataPanel({ timeSeriesData, chartRows, loading, onSaveChart }) {
  const [tab, setTab] = useState('data');
  const [chartType, setChartType] = useState('line');
  const [isStacked, setIsStacked] = useState(false);
  const [configs, setConfigs] = useState({});
  const [selectedName, setSelectedName] = useState(null);
  const [pivotOrder, setPivotOrder] = useState([]);
  const [showVarietyLabels, setShowVarietyLabels] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setShowVarietyLabels(getVarieties(chartRows).length > 1);
    setPivotOrder(order => reconcileIndicatorOrder(order, chartRows));
  }, [chartRows]);

  useEffect(() => {
    if (!expanded) return undefined;
    const handleKey = (event) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [expanded]);

  const listedRows = chartType === 'pivot' ? orderRows(chartRows, pivotOrder) : chartRows;
  const selectedConfig = (selectedName && configs[selectedName]) || {};

  function updateConfig(name, patch) {
    setConfigs(current => ({ ...current, [name]: { ...(current[name] || {}), ...patch } }));
  }

  function handleSave() {
    onSaveChart({
      chartType,
      isStacked,
      configs,
      pivotOrder: reconcileIndicatorOrder(pivotOrder, chartRows),
      showVarietyLabels,
    });
  }

  const hasData = Boolean(timeSeriesData && timeSeriesData.data);
  let content;
  if (!hasData) {
    content = <div className="empty-message">暂无数据，请先提取数据</div>;
  } else if (tab === 'data') {
    content = <DataGrid timeSeriesData={timeSeriesData} />;
  } else {
    content = (
      <div className={`chart-tab-container${expanded ? ' chart-tab-container-expanded' : ''}`}>
        <div className="chart-control-bar">
          <div className="chart-type-group">
            {CHART_TYPE_OPTIONS.map(option => (
              <button
                type="button"
                key={option.value}
                className={`chart-type-btn${chartType === option.value ? ' active' : ''}`}
                onClick={() => setChartType(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          {supportsSeriesOptions(chartType) && (
            <label className="stack-checkbox">
              <input type="checkbox" checked={isStacked} onChange={e => setIsStacked(e.target.checked)} />
              <span>堆叠</span>
            </label>
          )}
          <div className="chart-action-group">
            <Button className="index-data-action" variant="outline-primary" size="sm" onClick={() => setExpanded(!expanded)}>
              {expanded ? '还原' : '放大'}
            </Button>
            <Button className="index-data-action" variant="outline-primary" size="sm" onClick={handleSave}>保存图表</Button>
          </div>
        </div>
        <div className="chart-main-content">
          <div className="chart-area">
            {chartType === 'pivot' ? (
              <IndexDataPivotTable
                timeSeriesData={timeSeriesData}
                chartRows={chartRows}
                chartIndexConfigs={configs}
                indicatorOrder={pivotOrder}
                onIndicatorMove={(source, target) => setPivotOrder(moveIndicator(
                  reconcileIndicatorOrder(pivotOrder, chartRows), source, target))}
                showVarietyLabels={showVarietyLabels}
                onShowVarietyLabelsChange={setShowVarietyLabels}
              />
            ) : (
              <IndexDataChart
                timeSeriesData={timeSeriesData}
                chartType={chartType}
                isStacked={isStacked}
                chartIndexConfigs={configs}
                chartRows={chartRows}
                resizeToken={expanded}
              />
            )}
          </div>
          <div className="config-panel">
            <div className="config-panel-title">指标</div>
            <div className="index-list-area">
              {listedRows.map((row) => {
                const name = row.指标名称;
                return (
                  <div
                    key={name}
                    className={`index-item${selectedName === name ? ' selected' : ''}`}
                    onClick={() => setSelectedName(name)}
                    role="presentation"
                  >
                    <input
                      type="checkbox"
                      aria-label={`显示 ${name}`}
                      checked={!configs[name] || configs[name].visible !== false}
                      onClick={e => e.stopPropagation()}
                      onChange={e => updateConfig(name, { visible: e.target.checked })}
                    />
                    <span className="index-name" title={name}>{name}</span>
                  </div>
                );
              })}
            </div>
            {selectedName && supportsSeriesOptions(chartType) && (
              <div className="extra-info-form">
                <label className="extra-info-group">
                  <span>图型：</span>
                  <select
                    value={selectedConfig.chartType || chartType}
                    onChange={e => updateConfig(selectedName, { chartType: e.target.value })}
                  >
                    {SERIES_TYPE_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="extra-info-group">
                  <span>左右轴：</span>
                  <select
                    value={selectedConfig.yAxisIndex === 1 ? 1 : 0}
                    onChange={e => updateConfig(selectedName, { yAxisIndex: Number(e.target.value) })}
                  >
                    <option value={0}>左轴</option>
                    <option value={1}>右轴</option>
                  </select>
                </label>
                <label className="extra-info-group">
                  <span>堆叠：</span>
                  <input
                    type="checkbox"
                    checked={selectedConfig.stacked !== undefined ? selectedConfig.stacked : isStacked}
                    onChange={e => updateConfig(selectedName, { stacked: e.target.checked })}
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="data-display-area">
      <div className="tab-header">
        <div className={`tab-item${tab === 'data' ? ' active' : ''}`} onClick={() => setTab('data')} role="tab">
          数据
        </div>
        <div className={`tab-item${tab === 'chart' ? ' active' : ''}`} onClick={() => setTab('chart')} role="tab">
          图形
        </div>
      </div>
      <div className="tab-content">
        {loading && (
          <div className="data-loading-overlay" role="status">
            <span className="data-loading-spinner" aria-hidden="true" />
            <span>正在提取数据…</span>
          </div>
        )}
        {content}
      </div>
    </div>
  );
}

DataPanel.propTypes = {
  timeSeriesData: PropTypes.object,
  chartRows: PropTypes.array,
  loading: PropTypes.bool,
  onSaveChart: PropTypes.func.isRequired,
};

DataPanel.defaultProps = {
  timeSeriesData: null,
  chartRows: [],
  loading: false,
};
