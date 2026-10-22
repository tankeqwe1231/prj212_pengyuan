import React, { useLayoutEffect, useRef, useState } from 'react';
import $ from 'jquery';
import PropTypes from 'prop-types';
import dompurify from 'dompurify';

import AppTable from '../../components/AppTable/AppTable';
import ModalTrigger from '../../components/ModalTrigger';
import { t } from '../../locales';
import '../../../stylesheets/save-chart-modal.css';
import {
  resumeDashboardResize,
  suppressDashboardResize,
} from '../resizeUtils';

const propTypes = {
  dashboard: PropTypes.object.isRequired,
  triggerNode: PropTypes.node.isRequired,
  userId: PropTypes.string.isRequired,
  addSlicesToDashboard: PropTypes.func,
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

function SliceSelectionCell(info) {
  const slice = info.row.original;
  return (
    <input
      aria-label={t('Select %(sliceName)s', { sliceName: slice.sliceName })}
      checked={slice.isSelected}
      onChange={() => slice.onSelect(slice)}
      type="checkbox"
    />
  );
}

function SanitizedHtmlCell(info) {
  return <SanitizedHtml html={info.getValue()} />;
}

const columns = [{
  id: 'select',
  cell: SliceSelectionCell,
  enableGlobalFilter: false,
  enableSorting: false,
  header: '',
}, {
  accessorKey: 'sliceName',
  enableGlobalFilter: true,
  enableSorting: true,
  header: t('Name'),
  id: 'sliceName',
}, {
  accessorKey: 'vizType',
  enableGlobalFilter: true,
  enableSorting: true,
  header: t('Viz'),
  id: 'vizType',
}, {
  accessorKey: 'datasourceLink',
  cell: SanitizedHtmlCell,
  enableGlobalFilter: true,
  enableSorting: true,
  header: t('Datasource'),
  id: 'datasourceLink',
}, {
  accessorKey: 'modified',
  cell: SanitizedHtmlCell,
  enableGlobalFilter: true,
  enableSorting: true,
  header: t('Modified'),
  id: 'modified',
}];

function SliceAdder(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(SliceAdder.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = SliceAdder.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    slices: [],
    slicesLoaded: false,
    selectionMap: {},
    search: '',
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
  const slicesRequestRef = useRef(undefined);
  const erroredRef = useRef(undefined);
  const modalRef = useRef(undefined);
  const resizeResumeFrameRef = useRef(undefined);
  function cancelResizeResume() {
    if (resizeResumeFrameRef.current !== undefined) {
      cancelAnimationFrame(resizeResumeFrameRef.current);
      resizeResumeFrameRef.current = undefined;
    }
  }
  function onModalExit() {
    cancelResizeResume();
    suppressDashboardResize();
  }
  function onModalExited() {
    // The scrollbar is restored after the exit transition. Keep chart resize
    // handlers paused until layout and ResizeObserver have both settled.
    resizeResumeFrameRef.current = requestAnimationFrame(() => {
      resizeResumeFrameRef.current = requestAnimationFrame(() => {
        resizeResumeFrameRef.current = undefined;
        resumeDashboardResize();
      });
    });
  }
  function onEnterModal() {
    if (stateRef.current.slices.length > 0) {
      return;
    }
    const uri = `/sliceaddview/api/read?_flt_0_created_by=${propsRef.current.userId}`;
    slicesRequestRef.current = $.ajax({
      url: uri,
      type: 'GET',
      success: response => {
        // Prepare slice data for table
        const slices = response.result.map(slice => ({
          id: slice.id,
          sliceName: slice.slice_name,
          vizType: slice.viz_type,
          datasourceLink: slice.datasource_link,
          modified: slice.modified
        }));
        updateState({
          slices,
          selectionMap: {},
          slicesLoaded: true,
          search: '',
        });
      },
      error: error => {
        erroredRef.current = true;
        updateState({
          errorMsg: t('Sorry, there was an error fetching slices to this dashboard: ') + getAjaxErrorMsg(error)
        });
      }
    });
  }
  function getAjaxErrorMsg(error) {
    const respJSON = error.responseJSON;
    return respJSON && respJSON.message ? respJSON.message : error.responseText;
  }
  function addSlices() {
    if (modalRef.current) {
      modalRef.current.close();
    }
    propsRef.current.addSlicesToDashboard(Object.keys(stateRef.current.selectionMap))
    // if successful, page will be reloaded.
    .fail(error => {
      erroredRef.current = true;
      updateState({
        errorMsg: t('Sorry, there was an error adding slices to this dashboard: ') + getAjaxErrorMsg(error)
      });
    });
  }
  function toggleSlice(slice) {
    const selectionMap = Object.assign({}, stateRef.current.selectionMap);
    selectionMap[slice.id] = !selectionMap[slice.id];
    updateState({
      selectionMap
    });
  }
  function updateSearch(event) {
    updateState({
      search: event.target.value,
    });
  }
  propsRef.current = props;
  useLayoutEffect(() => {
    return () => {
      cancelResizeResume();
      resumeDashboardResize();
      if (slicesRequestRef.current) {
        slicesRequestRef.current.abort();
      }
    };
  }, []);
  const hideLoad = stateRef.current.slicesLoaded || erroredRef.current;
  let enableAddSlice = stateRef.current.selectionMap && Object.keys(stateRef.current.selectionMap);
  if (enableAddSlice) {
    enableAddSlice = enableAddSlice.some(function (key) {
      return stateRef.current.selectionMap[key];
    });
  }
  const tableSlices = stateRef.current.slices.map(slice => ({
    ...slice,
    isSelected: Boolean(stateRef.current.selectionMap[slice.id]),
    onSelect: toggleSlice,
  }));
  const modalContent = <div className="slice-adder-content">
    <img src="/static/assets/images/loading.gif" className={'loading ' + (hideLoad ? 'd-none' : '')} alt={hideLoad ? '' : 'loading'} />
    <div className={erroredRef.current ? '' : 'd-none'}>
      {stateRef.current.errorMsg}
    </div>
    <div className={stateRef.current.slicesLoaded ? '' : 'd-none'}>
      <div className="slice-adder-toolbar">
        <input
          aria-label={t('Search')}
          className="form-control form-control-sm slice-adder-search"
          onChange={updateSearch}
          placeholder={t('Search')}
          type="search"
          value={stateRef.current.search}
        />
      </div>
      <div className="slice-adder-table-container">
        <AppTable
          className="table table-sm slice-adder-table"
          columns={columns}
          data={tableSlices}
          getRowId={row => String(row.id)}
          globalFilter={stateRef.current.search}
          noDataText={t('No slices found')}
          pageSize={10}
        />
      </div>
      <button type="button" className="btn btn-primary save-chart-btn save-chart-btn--primary slice-adder-submit" onClick={addSlices} disabled={!enableAddSlice}>
        {t('Add Slices')}
      </button>
    </div>
  </div>;
  return <ModalTrigger ref={modal => {
    modalRef.current = modal;
  }} triggerNode={propsRef.current.triggerNode} tooltip={t('Add a new slice to the dashboard')} beforeOpen={onEnterModal} onExit={onModalExit} onExited={onModalExited} isMenuItem modalBody={modalContent} size="lg" dialogClassName="slice-adder-dialog" modalTitle={<span className="save-chart-modal__heading">
        <span className="save-chart-modal__title-icon" aria-hidden="true">
          <i className="fa fa-plus" />
        </span>
        {t('Add Slices to Dashboard')}
      </span>} />;
}



SliceAdder.propTypes = propTypes;

export default SliceAdder;
