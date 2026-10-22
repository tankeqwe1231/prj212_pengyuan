/* eslint no-unused-vars: 0 */
import React, { useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import dompurify from 'dompurify';

import AppTable from '../components/AppTable/AppTable';

const $ = window.$ = require('jquery');

const propTypes = {
  search: PropTypes.string,
};

function SanitizedHtml({ html }) {
  const sanitized = dompurify.sanitize(html == null ? '' : String(html), {
    ALLOWED_ATTR: ['class', 'href'],
    ALLOWED_TAGS: ['a', 'span'],
  });
  return <span dangerouslySetInnerHTML={{ __html: sanitized }} />; // eslint-disable-line react/no-danger
}

SanitizedHtml.propTypes = {
  html: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};

const columns = [{
  accessorKey: 'dashboard_title',
  cell: info => <a href={info.row.original.url}>{info.getValue()}</a>,
  enableGlobalFilter: true,
  enableSorting: true,
  header: 'Dashboard',
  id: 'dashboard'
}, {
  accessorKey: 'changed_by_name',
  cell: info => <SanitizedHtml html={info.row.original.creator} />,
  enableGlobalFilter: true,
  enableSorting: true,
  header: 'Creator',
  id: 'creator'
}, {
  accessorKey: 'changed_on',
  cell: info => <SanitizedHtml html={info.row.original.modified} />,
  enableSorting: true,
  header: 'Modified',
  id: 'modified',
  meta: { className: 'text-muted' }
}, ...[
  ['top_category', 'Top Category'],
  ['sub_category', 'Sub Category'],
  ['sub_sub_category', 'Sub Sub Category'],
  ['sub_sub_category_priority', 'Sub Sub Category Priority'],
  ['dashboard_priority', 'Dashboard Priority'],
].map(([key, label]) => ({
  accessorKey: key,
  enableSorting: true,
  header: label,
  meta: { className: 'text-muted' }
}))];

function DashboardTable(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(DashboardTable.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = DashboardTable.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    dashboards: false
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
    const url = '/dashboardmodelviewasync/api/read' + '?_oc_DashboardModelViewAsync=changed_on' + '&_od_DashboardModelViewAsync=desc';
    $.getJSON(url, data => {
      updateState({
        dashboards: data.result
      });
    });
  }, []);
  if (stateRef.current.dashboards) {
    return <AppTable
      className="table"
      columns={columns}
      data={stateRef.current.dashboards}
      getCellProps={cell => cell.column.columnDef.meta || {}}
      getRowId={row => String(row.id)}
      globalFilter={propsRef.current.search || ''}
      initialSorting={[{ id: 'modified', desc: true }]}
      pageSize={50}
    />;
  }
  return <img className="loading" alt="Loading..." src="/static/assets/images/loading.gif" />;
}


export default DashboardTable;
DashboardTable.propTypes = propTypes;
