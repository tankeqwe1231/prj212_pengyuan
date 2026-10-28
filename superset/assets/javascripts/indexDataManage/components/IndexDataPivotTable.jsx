import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  buildPivotTable,
  buildVarietyColorMap,
  formatPivotDate,
} from '../utils/chartUtils';

export default function IndexDataPivotTable({
  timeSeriesData,
  chartRows,
  chartIndexConfigs,
  indicatorOrder,
  onIndicatorMove,
  showVarietyLabels,
  onShowVarietyLabelsChange,
}) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dragging, setDragging] = useState('');
  const [dragOver, setDragOver] = useState('');
  const rangeError = startDate && endDate && startDate > endDate ? '开始日期不能晚于结束日期' : '';

  const rowsByName = useMemo(() => {
    const result = {};
    chartRows.forEach((row) => {
      result[row.指标名称] = row;
    });
    return result;
  }, [chartRows]);
  const colorMap = useMemo(() => buildVarietyColorMap(chartRows), [chartRows]);
  const pivot = useMemo(() => buildPivotTable(
    timeSeriesData, chartRows, chartIndexConfigs, indicatorOrder,
    rangeError ? {} : { startDate, endDate },
  ), [timeSeriesData, chartRows, chartIndexConfigs, indicatorOrder, startDate, endDate, rangeError]);

  const colorClass = (name) => {
    const row = rowsByName[name];
    const variety = row ? String(row.品种 || '').trim() : '';
    return showVarietyLabels && variety && colorMap[variety] !== undefined
      ? `pivot-variety-color-${colorMap[variety]}`
      : '';
  };
  const clearDrag = () => {
    setDragging('');
    setDragOver('');
  };

  return (
    <div className="index-pivot-container">
      <div className="pivot-date-toolbar">
        <label htmlFor="pivot-start-date">
          <span>开始日期</span>
          <input
            type="date"
            id="pivot-start-date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
        </label>
        <span className="pivot-date-separator">至</span>
        <label htmlFor="pivot-end-date">
          <span>结束日期</span>
          <input
            type="date"
            id="pivot-end-date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="pivot-date-clear"
          onClick={() => {
            setStartDate('');
            setEndDate('');
          }}
        >
          清除
        </button>
        {rangeError && <span className="pivot-date-error">{rangeError}</span>}
        <label htmlFor="pivot-show-variety-labels" className="pivot-variety-toggle">
          <input
            id="pivot-show-variety-labels"
            type="checkbox"
            checked={showVarietyLabels}
            onChange={e => onShowVarietyLabelsChange(e.target.checked)}
          />
          <span>显示品种标签</span>
        </label>
      </div>
      {!pivot.indicators.length || !pivot.rows.length ? (
        <div className="pivot-table-empty">暂无可展示的指标</div>
      ) : (
        <div className="index-pivot-table-scroll">
          <table className="index-pivot-table">
            <thead>
              <tr>
                <th className="index-pivot-row-header">指标日期</th>
                {pivot.indicators.map(name => (
                  <th
                    key={name}
                    title={`${name}（可拖动调整顺序）`}
                    className={[
                      dragging === name ? 'is-dragging' : '',
                      dragOver === name ? 'is-drag-over' : '',
                      colorClass(name),
                    ].filter(Boolean).join(' ')}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', name);
                      setDragging(name);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragOver !== name) setDragOver(name);
                    }}
                    onDragEnd={clearDrag}
                    onDrop={(e) => {
                      e.preventDefault();
                      const source = e.dataTransfer.getData('text/plain') || dragging;
                      clearDrag();
                      if (source && source !== name) onIndicatorMove(source, name);
                    }}
                  >
                    <span className="pivot-header-content">
                      {showVarietyLabels && rowsByName[name] && rowsByName[name].品种 && (
                        <span className="pivot-variety-tag">{rowsByName[name].品种}</span>
                      )}
                      <span>{name}</span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pivot.rows.map(row => (
                <tr key={String(row.date)}>
                  <th className="index-pivot-row-header">{formatPivotDate(row.date)}</th>
                  {row.values.map((value, i) => (
                    <td key={pivot.indicators[i]} className={colorClass(pivot.indicators[i])}>
                      {value === '' ? '' : String(value)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

IndexDataPivotTable.propTypes = {
  timeSeriesData: PropTypes.object,
  chartRows: PropTypes.array,
  chartIndexConfigs: PropTypes.object,
  indicatorOrder: PropTypes.arrayOf(PropTypes.string),
  onIndicatorMove: PropTypes.func,
  showVarietyLabels: PropTypes.bool,
  onShowVarietyLabelsChange: PropTypes.func,
};

IndexDataPivotTable.defaultProps = {
  timeSeriesData: {},
  chartRows: [],
  chartIndexConfigs: {},
  indicatorOrder: [],
  onIndicatorMove: () => {},
  showVarietyLabels: false,
  onShowVarietyLabelsChange: () => {},
};
