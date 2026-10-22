import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';

function DataTable({
  columns,
  data,
  keyField = 'id',
  onSelect = null,
  searchable = false,
  selectedKeys = {},
}) {
  const [search, setSearch] = useState('');
  const visibleRows = useMemo(() => {
    if (!search) return data;
    const needle = search.toLowerCase();
    return data.filter(row => columns.some(column => String(row[column.field] || '').toLowerCase().includes(needle)));
  }, [columns, data, search]);
  return (
    <div className="table-responsive">
      {searchable ? (
        <input
          className="form-control form-control-sm"
          onChange={event => setSearch(event.target.value)}
          placeholder="Search"
          type="search"
          value={search}
        />
      ) : null}
      <table className="table table-sm table-hover">
        <thead>
          <tr>
            {onSelect ? <th /> : null}
            {columns.filter(column => !column.hidden).map(column => <th key={column.field}>{column.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map(row => (
            <tr key={row[keyField]}>
              {onSelect ? (
                <td><input checked={Boolean(selectedKeys[row[keyField]])} onChange={() => onSelect(row)} type="checkbox" /></td>
              ) : null}
              {columns.filter(column => !column.hidden).map(column => (
                <td key={column.field}>{column.render ? column.render(row[column.field], row) : row[column.field]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

DataTable.propTypes = {
  columns: PropTypes.array.isRequired,
  data: PropTypes.array.isRequired,
  keyField: PropTypes.string,
  onSelect: PropTypes.func,
  searchable: PropTypes.bool,
  selectedKeys: PropTypes.object,
};

export default DataTable;
