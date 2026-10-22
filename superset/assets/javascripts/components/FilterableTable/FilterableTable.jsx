import PropTypes from 'prop-types';
import React, { useMemo, useState } from 'react';

const propTypes = {
  orderedColumnKeys: PropTypes.array.isRequired,
  data: PropTypes.array.isRequired,
  height: PropTypes.number.isRequired,
  filterText: PropTypes.string,
  headerHeight: PropTypes.number,
  rowHeight: PropTypes.number,
  striped: PropTypes.bool,
};

function formatTableData(data) {
  return data.map((row) => {
    const formattedRow = {};
    Object.keys(row).forEach((key) => {
      const value = row[key];
      formattedRow[key] = ['string', 'number'].includes(typeof value)
        ? value
        : JSON.stringify(value);
    });
    return formattedRow;
  });
}

function hasMatch(text, row) {
  const normalizedText = text.toLowerCase();
  return Object.keys(row).some(key => String(row[key]).toLowerCase().includes(normalizedText));
}

function FilterableTable({
  data,
  filterText = '',
  headerHeight = 32,
  height,
  orderedColumnKeys,
  rowHeight = 32,
  striped = true,
}) {
  const [sortBy, setSortBy] = useState(null);
  const [sortDirection, setSortDirection] = useState('ASC');
  const rows = useMemo(() => {
    let result = formatTableData(data);
    if (filterText) {
      result = result.filter(row => hasMatch(filterText, row));
    }
    if (sortBy) {
      result.sort((left, right) => String(left[sortBy]).localeCompare(String(right[sortBy]), undefined, {
        numeric: true,
      }));
      if (sortDirection === 'DESC') {
        result.reverse();
      }
    }
    return result;
  }, [data, filterText, sortBy, sortDirection]);

  const changeSort = (columnKey) => {
    if (sortBy === columnKey) {
      setSortDirection(direction => (direction === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortBy(columnKey);
      setSortDirection('ASC');
    }
  };

  return (
    <div className="filterable-table-container" style={{ height, overflow: 'auto' }}>
      <table className="table" role="grid">
        <thead>
          <tr style={{ height: headerHeight }}>
            {orderedColumnKeys.map(columnKey => (
              <th key={columnKey}>
                <button className="btn btn-link" onClick={() => changeSort(columnKey)} type="button">
                  {columnKey}
                  {sortBy === columnKey ? (sortDirection === 'ASC' ? ' ▲' : ' ▼') : null}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              className={striped ? (index % 2 === 0 ? 'even-row' : 'odd-row') : ''}
              key={orderedColumnKeys.map(key => row[key]).join('|') + index}
              style={{ height: rowHeight }}
            >
              {orderedColumnKeys.map(columnKey => (
                <td key={columnKey}>{row[columnKey]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

FilterableTable.propTypes = propTypes;

export default FilterableTable;
