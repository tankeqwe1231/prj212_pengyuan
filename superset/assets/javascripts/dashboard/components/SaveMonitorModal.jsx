/* global notify */
import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Button, Col, Form, FormControl, FormGroup, FormLabel, FormSelect, Row } from 'react-bootstrap';
import ModalTrigger from '../../components/ModalTrigger';
import { t } from '../../locales';

const $ = window.$ = require('jquery');

const propTypes = {
  triggerNode: PropTypes.node.isRequired,
  warnIndexList: PropTypes.array,
  warnCol: PropTypes.string,
};

function SaveMonitorModal(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(SaveMonitorModal.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = SaveMonitorModal.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    warnValue: '',
    warnCondition: '',
    warnCause: '',
    warnIndex: '',
    warnPhone: '',
    warnExpireDate: ''
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
  const warnConditionOptionsRef = useRef([{
    value: '',
    label: ''
  }, {
    value: '>',
    label: '>'
  }, {
    value: '<',
    label: '<'
  }, {
    value: 'update',
    label: '更新提醒'
  }]);
  const modalRef = useRef(null);
  function saveMonitor() {
    const sliceFormData = propsRef.current.slice.formData;
    const datasource_id = sliceFormData.datasource.split('__')[0];
    const viz_type = sliceFormData.viz_type;
    const slice_id = propsRef.current.slice.slice_id;
    const granularity_sqla = sliceFormData.granularity_sqla;
    const dashboard_id = propsRef.current.dashboardId;
    const warn_col = propsRef.current.warnCol;
    let metrics = '';
    // 判断 sliceFormData 是否存在 metrics 且 metrics 长度是否大于0
    if (sliceFormData.metrics && sliceFormData.metrics.length > 0) {
      metrics = sliceFormData.metrics[0];
      if (typeof metrics === 'object') {
        metrics = metrics.column.column_name;
      } else {
        metrics = metrics.split('__')[1];
      }
    } else if (sliceFormData.all_columns && sliceFormData.all_columns.length > 0) {
      metrics = sliceFormData.all_columns[0];
    } else if (sliceFormData.all_columns_custom && sliceFormData.all_columns_custom.length > 0) {
      metrics = sliceFormData.all_columns_custom[0];
    }
    console.log('saveMonitor', dashboard_id, slice_id, datasource_id, viz_type, granularity_sqla, warn_col, stateRef.current.warnIndex, metrics, stateRef.current.warnCondition, stateRef.current.warnValue, stateRef.current.warnExpireDate, stateRef.current.warnCause, stateRef.current.warnPhone);
    if (!stateRef.current.warnIndex || !stateRef.current.warnCondition || !stateRef.current.warnValue || !stateRef.current.warnExpireDate) {
      notify.error('必填项不能为空');
    } else {
      modalRef.current.close();
      const postUrl = '/superset/save_monitor';
      $.ajax({
        url: postUrl,
        type: 'POST',
        data: {
          dashboard_id,
          slice_id,
          datasource_id,
          viz_type,
          granularity_sqla,
          warn_col,
          warn_index: stateRef.current.warnIndex,
          metrics,
          warn_condition: stateRef.current.warnCondition,
          warn_value: stateRef.current.warnValue,
          warn_cause: stateRef.current.warnCause,
          warn_phone: stateRef.current.warnPhone,
          warnExpireDate: stateRef.current.warnExpireDate
        },
        success: data => {
          notify.success(data.errmsg);
          console.log(data);
        },
        error: err => {
          console.log(err.responseJSON.error);
          notify.error('保存失败:' + err.responseJSON.error);
        }
      });
    }
  }
  function handleTextChange(fieldName, value) {
    updateState({
      [fieldName]: value
    });
  }
  function handleModalHide() {
    updateState({
      warnValue: '',
      warnCondition: '',
      warnCause: '',
      warnIndex: '',
      warnPhone: '',
      warnExpireDate: ''
    });
  }
  propsRef.current = props;
  // console.log('-------------');
  return <ModalTrigger ref={modal => {
    modalRef.current = modal;
  }} triggerNode={propsRef.current.triggerNode} modalTitle={<span className="dashboard-modal-title">
    <span className="dashboard-modal-title__icon" aria-hidden="true">
      <i className="fa fa-bell" />
    </span>
    {t('添加预警')}
  </span>} dialogClassName="save-monitor-modal" onExit={() => handleModalHide()} modalBody={<Form>
            <FormGroup as={Row} className="mb-3">
              <FormLabel column sm={3} className="text-nowrap" htmlFor="monitor-index">
                指标名<span style={{
          color: 'red'
        }}>*</span>
              </FormLabel>
              <Col sm={9}>
                <FormSelect id="monitor-index" name="monitor-index" value={stateRef.current.warnIndex} onChange={event => handleTextChange('warnIndex', event.target.value)}>
                  <option value="" />
                  {propsRef.current.warnIndexList && propsRef.current.warnIndexList.map(option => <option key={option} value={option}>{option}</option>)}
                </FormSelect>
              </Col>
            </FormGroup>
            <FormGroup as={Row} className="mb-3">
              <FormLabel column sm={3} className="text-nowrap" htmlFor="monitor-condition">
                条件<span style={{
          color: 'red'
        }}>*</span>
              </FormLabel>
              <Col sm={9}>
                <FormSelect id="monitor-condition" name="monitor-condition" value={stateRef.current.warnCondition} onChange={event => handleTextChange('warnCondition', event.target.value)}>
                  {warnConditionOptionsRef.current.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </FormSelect>
              </Col>
            </FormGroup>
            <FormGroup as={Row} className="mb-3">
              <FormLabel column sm={3} className="text-nowrap" htmlFor="monitor-value">
                预警值<span style={{
          color: 'red'
        }}>*</span>
              </FormLabel>
              <Col sm={9}>
                <FormControl id="monitor-value" name="monitor-value" type="text" value={stateRef.current.warnValue} onChange={event => handleTextChange('warnValue', event.target.value)} />
              </Col>
            </FormGroup>
            <FormGroup as={Row} className="mb-3">
              <FormLabel column sm={3} className="text-nowrap" htmlFor="monitor-expire-date">
                到期时间<span style={{
          color: 'red'
        }}>*</span>
              </FormLabel>
              <Col sm={9}>
                <FormControl id="monitor-expire-date" name="monitor-expire-date" type="date" value={stateRef.current.warnExpireDate} onChange={event => handleTextChange('warnExpireDate', event.target.value)} />
              </Col>
            </FormGroup>
            <FormGroup as={Row} className="mb-3">
              <FormLabel column sm={3} className="text-nowrap" htmlFor="monitor-cause">
                预警原因
              </FormLabel>
              <Col sm={9}>
                <FormControl id="monitor-cause" name="monitor-cause" type="text" value={stateRef.current.warnCause} onChange={event => handleTextChange('warnCause', event.target.value)} />
              </Col>
            </FormGroup>
            <FormGroup as={Row} className="mb-3">
              <FormLabel column sm={3} className="text-nowrap" htmlFor="monitor-phone">
                手机号
              </FormLabel>
              <Col sm={9}>
                <FormControl id="monitor-phone" name="monitor-phone" type="text" value={stateRef.current.warnPhone} onChange={event => handleTextChange('warnPhone', event.target.value)} required />
              </Col>
            </FormGroup>

          </Form>} modalFooter={<div>
            <Button variant="primary" onClick={() => {
      saveMonitor();
    }}>
              {t('Save')}
            </Button>
          </div>} />;
}


SaveMonitorModal.propTypes = propTypes;

export default SaveMonitorModal;
