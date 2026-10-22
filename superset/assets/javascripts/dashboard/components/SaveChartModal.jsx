/* eslint camelcase: 0 */
import React, { useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { Modal, Alert, Button } from 'react-bootstrap';
import Select from 'react-select';
import '../../../stylesheets/save-chart-modal.css';
import { t } from '../../locales';
import { supersetURL } from '../../utils/common';
import {
  fetchDashboards,
  removeSaveModalAlert,
  addSliceToPrivateDashboard,
} from '../actions';
import { normalizeSelectValue } from '../../components/selectUtils';

const PREFIX = '收藏-';

const propTypes = {
  can_overwrite: PropTypes.bool,
  onHide: PropTypes.func.isRequired,
  actions: PropTypes.object.isRequired,
  form_data: PropTypes.object,
  userId: PropTypes.string.isRequired,
  dashboards: PropTypes.array.isRequired,
  alert: PropTypes.string,
  slice: PropTypes.object,
  datasource: PropTypes.object,
};

function SaveChartModal(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(SaveChartModal.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = SaveChartModal.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => (() => {
    const action = props.can_overwrite ? 'overwrite' : 'saveas';
    const newSliceName = action === 'saveas' && props.slice && props.slice.slice_name ? PREFIX + props.slice.slice_name : '';
    return {
      saveToDashboardId: null,
      newDashboardName: '',
      newSliceName,
      alert: null,
      action,
      addToDash: 'existing'
    };
  })());
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
  function onChange(name, event) {
    switch (name) {
      case 'newSliceName':
        updateState({
          newSliceName: event.target.value
        });
        break;
      case 'saveToDashboardId':
        updateState({
          saveToDashboardId: event ? event.value : null
        });
        changeDash('existing');
        break;
      case 'newDashboardName':
        updateState({
          newDashboardName: event.target.value
        });
        break;
      default:
        break;
    }
  }
  function changeAction(action) {
    if (action === 'overwrite' && !propsRef.current.can_overwrite) {
      return;
    }
    const newState = {
      action
    };
    if (action === 'saveas' && propsRef.current.slice && propsRef.current.slice.slice_name) {
      newState.newSliceName = PREFIX + propsRef.current.slice.slice_name;
    } else {
      newState.newSliceName = '';
    }
    updateState(newState);
  }
  function changeDash(dash) {
    updateState({
      addToDash: dash
    });
  }
  function saveOrOverwrite(gotodash) {
    updateState({
      alert: null
    });
    propsRef.current.actions.removeSaveModalAlert();
    const sliceParams = {};
    let sliceName = null;
    sliceParams.action = stateRef.current.action;
    if (propsRef.current.slice && propsRef.current.slice.slice_id) {
      sliceParams.slice_id = propsRef.current.slice.slice_id;
    }
    if (sliceParams.action === 'saveas') {
      sliceName = stateRef.current.newSliceName;
      if (sliceName === '') {
        updateState({
          alert: t('Please enter a slice name')
        });
        return;
      }
      sliceParams.slice_name = sliceName;
    } else {
      sliceParams.slice_name = propsRef.current.slice.slice_name;
    }
    const addToDash = stateRef.current.addToDash;
    sliceParams.add_to_dash = addToDash;
    let dashboard = null;
    switch (addToDash) {
      case 'existing':
        dashboard = stateRef.current.saveToDashboardId;
        if (!dashboard) {
          updateState({
            alert: t('Please select a dashboard')
          });
          return;
        }
        sliceParams.save_to_dashboard_id = dashboard;
        break;
      case 'new':
        dashboard = stateRef.current.newDashboardName;
        if (dashboard === '') {
          updateState({
            alert: t('Please enter a dashboard name')
          });
          return;
        }
        sliceParams.new_dashboard_name = dashboard;
        break;
      default:
        dashboard = null;
    }
    sliceParams.goto_dash = gotodash;
    propsRef.current.actions.saveSlice(propsRef.current.form_data, sliceParams).then(data => {
      console.log(data);
      // Go to new slice url or dashboard url
      if (gotodash) {
        window.location = supersetURL(data.dashboard, {
          edit: 'true'
        });
      } else {
        if (addToDash === 'new') {
          const myFavorites = document.getElementById('myFavorites');
          const li = document.createElement('li');
          li.innerHTML = `<a href="${data.dashboard}">收藏-${data.dashboard_name}</a>`;
          myFavorites.appendChild(li);
        }
        notify.success(data.message);
      }
    }).catch(error => {
      console.log(error);
      let errorMessage = '收藏失败';
      if (error.responseJSON && error.responseJSON.error) {
        errorMessage = error.responseJSON.error;
      }
      notify.error(errorMessage);
    });
    propsRef.current.onHide();
  }
  function removeAlert() {
    if (propsRef.current.alert) {
      propsRef.current.actions.removeSaveModalAlert();
    }
    updateState({
      alert: null
    });
  }
  function renderOptionCard({
    selected,
    disabled,
    onSelect,
    label,
    children,
  }) {
    const className = [
      'save-chart-option-card',
      selected ? 'is-selected' : '',
      disabled ? 'is-disabled' : '',
    ].filter(Boolean).join(' ');
    return (
      <div
        className={className}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => {
          if (!disabled) {
            onSelect();
          }
        }}
        onKeyDown={(event) => {
          if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            onSelect();
          }
        }}
      >
        <div className="save-chart-option-card__header">
          <span className={`save-chart-radio ${selected ? 'is-checked' : ''}`} />
          <span className="save-chart-option-card__label">{label}</span>
        </div>
        {children}
      </div>
    );
  }
  propsRef.current = props;
  useLayoutEffect(() => {
    const sliceId = propsRef.current.slice.slice_id;
    propsRef.current.actions.fetchDashboards(propsRef.current.userId, sliceId);
  }, []);
  const previousCommitRef = useRef();
  useLayoutEffect(() => {
    if (previousCommitRef.current) {
      const {
        props: prevProps
      } = previousCommitRef.current;
      // 当can_overwrite状态从后端返回时，更新action状态
      if (prevProps.can_overwrite !== propsRef.current.can_overwrite) {
        updateState({
          action: propsRef.current.can_overwrite ? 'overwrite' : 'saveas',
          newSliceName: propsRef.current.can_overwrite ? '' : PREFIX + propsRef.current.slice.slice_name
        });
      }
      // 当dashboards数据更新时，调整addToDash状态
      if (prevProps.dashboards !== propsRef.current.dashboards) {
        const addToDash = propsRef.current.dashboards && propsRef.current.dashboards.length > 0 ? 'existing' : 'new';
        updateState({
          addToDash
        });
      }
    }
    previousCommitRef.current = {
      props: props,
      state: state
    };
  });
  const sliceName = propsRef.current.slice ? propsRef.current.slice.slice_name : '';
  const canOverwrite = !!propsRef.current.can_overwrite;
  const action = stateRef.current.action;
  const addToDash = stateRef.current.addToDash;

  return (
    <Modal show onHide={propsRef.current.onHide} dialogClassName="save-chart-modal" size="lg">
      <Modal.Header closeButton>
        <Modal.Title>
          <span className="save-chart-modal__title-icon" aria-hidden="true">
            <i className="fa fa-star" />
          </span>
          {t('图表收藏')}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {(stateRef.current.alert || propsRef.current.alert) && (
          <Alert>
            {stateRef.current.alert ? stateRef.current.alert : propsRef.current.alert}
            <i
              className="fa fa-close float-end"
              onClick={removeAlert.bind(undefined)}
              style={{ cursor: 'pointer' }}
            />
          </Alert>
        )}

        <div className="save-chart-section">
          <div className="save-chart-section__title">
            <span className="save-chart-section__index">1</span>
            <span>{t('选择保存方式')}</span>
          </div>
          <div className="save-chart-section__body">
            {propsRef.current.slice && renderOptionCard({
              selected: action === 'overwrite',
              disabled: !canOverwrite,
              onSelect: () => changeAction('overwrite'),
              label: t('覆盖图表「%s」', sliceName),
            })}
            {renderOptionCard({
              selected: action === 'saveas',
              disabled: false,
              onSelect: () => changeAction('saveas'),
              label: t('图表另存为'),
              children: action === 'saveas' ? (
                <input
                  className="save-chart-input"
                  name="new_slice_name"
                  placeholder={t('新图表名称')}
                  value={stateRef.current.newSliceName}
                  onChange={onChange.bind(undefined, 'newSliceName')}
                  onClick={(event) => event.stopPropagation()}
                  onFocus={changeAction.bind(undefined, 'saveas')}
                />
              ) : null,
            })}
          </div>
        </div>

        <div className="save-chart-section">
          <div className="save-chart-section__title">
            <span className="save-chart-section__index">2</span>
            <span>{t('收藏位置')}</span>
          </div>
          <div className="save-chart-section__body">
            {renderOptionCard({
              selected: addToDash === 'existing',
              disabled: false,
              onSelect: () => changeDash('existing'),
              label: t('收藏到现有页面'),
              children: addToDash === 'existing' ? (
                <div
                  className="save-chart-select-wrap"
                  onClick={(event) => event.stopPropagation()}
                >
                  <Select
                    className="save-modal-selector save-chart-select"
                    classNamePrefix="Select"
                    options={propsRef.current.dashboards}
                    onChange={onChange.bind(undefined, 'saveToDashboardId')}
                    value={normalizeSelectValue(
                      stateRef.current.saveToDashboardId,
                      propsRef.current.dashboards,
                    )}
                    placeholder={t('选择目标页面')}
                    onFocus={changeDash.bind(undefined, 'existing')}
                  />
                </div>
              ) : null,
            })}
            {renderOptionCard({
              selected: addToDash === 'new',
              disabled: false,
              onSelect: () => changeDash('new'),
              label: t('收藏到新的页面'),
              children: addToDash === 'new' ? (
                <input
                  className="save-chart-input"
                  onChange={onChange.bind(undefined, 'newDashboardName')}
                  onClick={(event) => event.stopPropagation()}
                  onFocus={changeDash.bind(undefined, 'new')}
                  placeholder={t('新页面名称')}
                  value={stateRef.current.newDashboardName}
                />
              ) : null,
            })}
          </div>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button
          type="button"
          id="btn_modal_save"
          className="btn btn-primary save-chart-btn"
          onClick={saveOrOverwrite.bind(undefined, false)}
        >
          {t('收藏')}
        </Button>
        <Button
          type="button"
          id="btn_modal_save_goto_dash"
          className="btn btn-primary save-chart-btn save-chart-btn--primary"
          disabled={stateRef.current.addToDash === 'noSave'}
          onClick={saveOrOverwrite.bind(undefined, true)}
        >
          {t('收藏并转到页面')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}



SaveChartModal.propTypes = propTypes;

function mapStateToProps({ dashboard, saveModal }, ownProps) {
  return {
    userId: dashboard.userId,
    dashboards: saveModal.dashboards || [],
    alert: saveModal.saveModalAlert,
    can_overwrite: saveModal.canOverwrite || false,
    slice: ownProps.slice,
    form_data: ownProps.form_data,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: {
      fetchDashboards: (userId, sliceId) => dispatch(fetchDashboards(userId, sliceId)),
      removeSaveModalAlert: () => dispatch(removeSaveModalAlert()),
      saveSlice: (formData, params) => dispatch(addSliceToPrivateDashboard(formData, params)),
    },
  };
}

export { SaveChartModal };
export default connect(mapStateToProps, mapDispatchToProps)(SaveChartModal);
