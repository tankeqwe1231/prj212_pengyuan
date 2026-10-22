import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import ModalTrigger from '../../components/ModalTrigger';
import { t } from '../../locales';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-balham.css';
import { AgGridReact } from 'ag-grid-react';
import { AllEnterpriseModule, LicenseManager } from 'ag-grid-enterprise';
import { aggridlicense } from '../../../visualizations/constants';
// import { d3format } from '../../modules/utils';

const $ = window.$ = require('jquery');
const AG_GRID_MODULES = [AllEnterpriseModule];
LicenseManager.setLicenseKey(aggridlicense);

const propTypes = {
  triggerNode: PropTypes.node.isRequired,
  slice: PropTypes.object.isRequired,
  formData: PropTypes.object.isRequired,
};

function ShowTop10RecordModal(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(ShowTop10RecordModal.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = ShowTop10RecordModal.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    loading: true,
    data: null,
    error: null
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
  const modalRef = useRef(null);
  const gridApiRef = useRef(null);
  function renderModalTitle(sliceName) {
    return <div className="dashboard-modal-title">
        <span className="dashboard-modal-title__icon" aria-hidden="true">
          <i className="fa fa-list-ol" />
        </span>
        <span>{sliceName}</span>
      </div>;
  }
  function fetchData() {
    $.ajax({
      url: `/superset/show_top10_record/${propsRef.current.slice.slice_id}`,
      type: 'POST',
      data: {
        formData: JSON.stringify(propsRef.current.formData)
      },
      success: data => {
        updateState({
          loading: false,
          data
        });
      },
      error: xhr => {
        updateState({
          loading: false,
          error: xhr.responseText || t('获取数据失败')
        });
      }
    });
  }
  function onGridReady(params) {
    gridApiRef.current = params.api;
    params.api.sizeColumnsToFit();
  }
  function renderModalBody() {
    if (stateRef.current.loading) {
      return <div className="text-center"><i className="fa fa-spinner fa-spin fa-3x" /></div>;
    }
    if (stateRef.current.error) {
      return <div className="alert alert-danger">{stateRef.current.error}</div>;
    }
    const columnDefs = stateRef.current.data.columns.map((column, index) => ({
      field: column,
      headerName: column,
      ...(index === 0 && {
        width: 340,
        suppressSizeToFit: true
      }),
      ...(index === 1 && {
        width: 130,
        suppressSizeToFit: true
      })
    }));
    const rowData = stateRef.current.data.data;
    const autoHeight = rowData.length < 10;
    return <div className="ag-theme-balham" style={{
      width: '100%',
      height: autoHeight ? 'auto' : '400px'
    }}>
        <AgGridReact modules={AG_GRID_MODULES} theme="legacy" columnDefs={columnDefs} rowData={rowData} animateRows defaultColDef={{
        sortable: true,
        resizable: true,
        filter: true,
        suppressHeaderMenuButton: true
      }} domLayout={autoHeight ? 'autoHeight' : 'normal'} onGridReady={onGridReady} />
      </div>;
  }
  propsRef.current = props;
  return <ModalTrigger ref={modal => {
    modalRef.current = modal;
  }} beforeOpen={fetchData.bind(undefined)} triggerNode={propsRef.current.triggerNode} modalTitle={renderModalTitle(propsRef.current.slice.slice_name)} dialogClassName="Top10RecordDialog" componentClassTitle="div" modalBody={renderModalBody()} />;
}



ShowTop10RecordModal.propTypes = propTypes;

export default ShowTop10RecordModal;
