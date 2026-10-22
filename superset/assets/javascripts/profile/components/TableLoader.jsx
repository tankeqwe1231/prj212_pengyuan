import React, { isValidElement, useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import $ from 'jquery';

import AppTable from '../../components/AppTable/AppTable';

const propTypes = {
  dataEndpoint: PropTypes.string.isRequired,
  mutator: PropTypes.func,
  columns: PropTypes.arrayOf(PropTypes.string),
  columnsText: PropTypes.array,
};

function comparableValue(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (Array.isArray(value)) return value.map(comparableValue).join(' ');
  if (isValidElement(value)) return comparableValue(value.props.children);
  return String(value);
}

function TableLoader(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(TableLoader.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = TableLoader.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    isLoading: true,
    data: []
  }));
  const stateRef = useRef(state);
  stateRef.current = state;
  const updateState = (update, callback) => {
    const previous = stateRef.current;
    const partial = typeof update === 'function' ? update(previous, propsRef.current) : update;
    if (partial == null) return;
    const next = {
      ...previous,
      ...partial
    };
    stateRef.current = next;
    setState(next);
    if (typeof callback === 'function') callback();
  };
  propsRef.current = props;
  useLayoutEffect(() => {
    const request = $.get(propsRef.current.dataEndpoint, data => {
      let actualData = data;
      if (propsRef.current.mutator) {
        actualData = propsRef.current.mutator(data);
      }
      updateState({
        data: actualData,
        isLoading: false
      });
    });
    return () => {
      if (request && typeof request.abort === 'function') request.abort();
    };
  }, []);
  let {
    columns
  } = propsRef.current;
  if (!columns && stateRef.current.data.length > 0) {
    columns = Object.keys(stateRef.current.data[0]).filter(col => col[0] !== '_');
  }
  if (!columns) {
    columns = (propsRef.current.columnsText || []).map(column => column.key);
  }
  if (stateRef.current.isLoading) {
    return <img alt="loading" width="25" src="/static/assets/images/loading.gif" />;
  }
  const columnLabels = (propsRef.current.columnsText || []).reduce((result, column) => {
    result[column.key] = column.label; // eslint-disable-line no-param-reassign
    return result;
  }, {});
  const tableColumns = columns.map(column => ({
    accessorFn: row => (row.hasOwnProperty('_' + column)
      ? row['_' + column] : comparableValue(row[column])),
    cell: info => info.row.original[column],
    enableSorting: Boolean(propsRef.current.sortable),
    header: columnLabels[column] == null ? column : columnLabels[column],
    id: column
  }));
  return <AppTable
    className={propsRef.current.className || 'table'}
    columns={tableColumns}
    data={stateRef.current.data}
    noDataText={propsRef.current.noDataText}
    pageSize={50}
    style={{ textTransform: 'capitalize' }}
  />;
}


export default TableLoader;
TableLoader.propTypes = propTypes;
