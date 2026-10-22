import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  columnFilteringFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  functionalUpdate,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'; // eslint-disable-line import/no-unresolved

import './AppTable.css';

const features = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: { includesString: filterFn_includesString },
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: {
    appTable(left, right, columnId) {
      const leftValue = left.getValue(columnId);
      const rightValue = right.getValue(columnId);
      if (leftValue == null && rightValue == null) return 0;
      if (leftValue == null) return 1;
      if (rightValue == null) return -1;
      if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        return leftValue - rightValue;
      }
      return String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true });
    },
  },
});

const EMPTY_SORTING = [];
const MAX_VISIBLE_PAGE_BUTTONS = 5;

function getVisiblePageIndexes(pageCount, pageIndex) {
  const visiblePageCount = Math.min(pageCount, MAX_VISIBLE_PAGE_BUTTONS);
  const firstPage = Math.min(
    Math.max(pageIndex - Math.floor(visiblePageCount / 2), 0),
    pageCount - visiblePageCount,
  );

  return Array.from(
    { length: visiblePageCount },
    (_, index) => firstPage + index,
  );
}

function mergeProps(baseProps, suppliedProps) {
  const extraProps = suppliedProps || {};
  const className = [baseProps.className, extraProps.className].filter(Boolean).join(' ');
  return {
    ...baseProps,
    ...extraProps,
    ...(className ? { className } : {}),
  };
}

function AppTable({
  className = '',
  columns,
  data,
  getCellProps,
  getHeaderProps,
  getRowId,
  getRowProps,
  globalFilter = '',
  id,
  initialSorting = EMPTY_SORTING,
  noDataText = 'No data',
  onSortingChange,
  pageSize,
  sorting,
  style,
}) {
  const hasPagination = Number.isInteger(pageSize) && pageSize > 0;
  const [internalSorting, setInternalSorting] = useState(initialSorting);
  const effectiveSorting = sorting === undefined ? internalSorting : sorting;
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: hasPagination ? pageSize : Math.max(data.length, 1),
  });

  useEffect(() => {
    setPagination(() => ({
      pageIndex: 0,
      pageSize: hasPagination ? pageSize : Math.max(data.length, 1),
    }));
  }, [globalFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPagination(current => ({
      ...current,
      pageSize: hasPagination ? pageSize : Math.max(data.length, 1),
    }));
  }, [data.length, hasPagination, pageSize]);

  const handleSortingChange = useCallback((updater) => {
    const nextSorting = functionalUpdate(updater, effectiveSorting);
    if (sorting === undefined) setInternalSorting(nextSorting);
    if (onSortingChange) onSortingChange(nextSorting);
  }, [effectiveSorting, onSortingChange, sorting]);

  const tableOptions = useMemo(() => ({
    autoResetPageIndex: false,
    columns,
    data,
    defaultColumn: {
      cell: info => info.getValue(),
      enableGlobalFilter: false,
      enableSorting: false,
      sortFn: 'appTable',
    },
    enableMultiSort: false,
    enableSortingRemoval: false,
    features,
    getColumnCanGlobalFilter: column => column.columnDef.enableGlobalFilter === true,
    getRowId,
    globalFilterFn: 'includesString',
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: hasPagination ? pageSize : Math.max(data.length, 1),
      },
    },
    manualPagination: !hasPagination,
    onPaginationChange: updater => setPagination(current => functionalUpdate(updater, current)),
    onSortingChange: handleSortingChange,
    state: {
      globalFilter,
      pagination,
      sorting: effectiveSorting,
    },
  }), [
    columns, data, effectiveSorting, getRowId, globalFilter, handleSortingChange,
    hasPagination, pageSize, pagination,
  ]);
  const table = useTable(tableOptions);
  const pageCount = hasPagination ? table.getPageCount() : 1;

  useEffect(() => {
    if (!hasPagination) return;
    setPagination(current => ({
      ...current,
      pageIndex: Math.min(current.pageIndex, Math.max(pageCount - 1, 0)),
    }));
  }, [hasPagination, pageCount]);

  const rows = table.getRowModel().rows;
  return (
    <div className="app-table-wrapper">
      <table className={className} id={id} style={style}>
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const sortDirection = header.column.getIsSorted();
                const canSort = header.column.getCanSort();
                const headerProps = mergeProps({
                  'aria-sort': canSort
                    ? (sortDirection
                      ? (sortDirection === 'asc' ? 'ascending' : 'descending')
                      : 'none')
                    : undefined,
                  'data-column': header.column.id,
                }, getHeaderProps ? getHeaderProps(header) : null);
                return (
                  <th {...headerProps} key={header.id}>
                    {header.isPlaceholder ? null : (canSort ? (
                      <button
                        className={`btn btn-link app-table-header-sortable${sortDirection ? ` app-table-header-sort-${sortDirection}` : ''}`}
                        onClick={() => table.setSorting([{
                          id: header.column.id,
                          desc: sortDirection === 'asc',
                        }])}
                        type="button"
                      >
                        <table.FlexRender header={header} />
                      </button>
                    ) : <table.FlexRender header={header} />)}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {rows.map((row) => {
            const rowProps = getRowProps ? getRowProps(row) : {};
            return (
              <tr {...rowProps} key={row.id}>
                {row.getAllCells().map((cell) => {
                  const cellProps = mergeProps({ 'data-column': cell.column.id },
                    getCellProps ? getCellProps(cell) : null);
                  return (
                    <td {...cellProps} key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {!rows.length ? (
            <tr className="app-table-no-data">
              <td colSpan={Math.max(table.getAllLeafColumns().length, 1)}>{noDataText}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
      {hasPagination && pageCount > 1 ? (
        <nav aria-label="Table pagination" className="app-table-pagination">
          <button
            aria-label="First page"
            className="app-table-page-button app-table-page-first"
            disabled={pagination.pageIndex === 0}
            onClick={() => table.setPageIndex(0)}
            type="button"
          >
           ‹‹
          </button>
          <button
            aria-label="Previous page"
            className="app-table-page-button app-table-page-previous"
            disabled={pagination.pageIndex === 0}
            onClick={() => table.previousPage()}
            type="button"
          >
            ‹
          </button>
          {getVisiblePageIndexes(pageCount, pagination.pageIndex).map(index => (
            <button
              aria-current={index === pagination.pageIndex ? 'page' : undefined}
              className={index === pagination.pageIndex
                ? 'app-table-page-button app-table-current-page'
                : 'app-table-page-button'}
              disabled={index === pagination.pageIndex}
              key={index}
              onClick={() => table.setPageIndex(index)}
              type="button"
            >
              {index + 1}
            </button>
          ))}
          <button
            aria-label="Next page"
            className="app-table-page-button app-table-page-next"
            disabled={pagination.pageIndex === pageCount - 1}
            onClick={() => table.nextPage()}
            type="button"
          >
            ›
          </button>
          <button
            aria-label="Last page"
            className="app-table-page-button app-table-page-last"
            disabled={pagination.pageIndex === pageCount - 1}
            onClick={() => table.setPageIndex(pageCount - 1)}
            type="button"
          >
            ››
          </button>
        </nav>
      ) : null}
    </div>
  );
}

AppTable.propTypes = {
  className: PropTypes.string,
  columns: PropTypes.array.isRequired,
  data: PropTypes.array.isRequired,
  getCellProps: PropTypes.func,
  getHeaderProps: PropTypes.func,
  getRowId: PropTypes.func,
  getRowProps: PropTypes.func,
  globalFilter: PropTypes.string,
  id: PropTypes.string,
  initialSorting: PropTypes.array,
  noDataText: PropTypes.node,
  onSortingChange: PropTypes.func,
  pageSize: PropTypes.number,
  sorting: PropTypes.array,
  style: PropTypes.object,
};

export default AppTable;
