/* global notify */
import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'react-bootstrap';
import { getAjaxErrorMsg } from '../../modules/utils';
import ModalTrigger from '../../components/ModalTrigger';
import { t } from '../../locales';
import Checkbox from '../../components/Checkbox';
import '../../../stylesheets/save-chart-modal.css';

const $ = window.$ = require('jquery');

const propTypes = {
  css: PropTypes.string,
  dashboard: PropTypes.object.isRequired,
  triggerNode: PropTypes.node.isRequired,
  filters: PropTypes.object.isRequired,
  serialize: PropTypes.func,
  onSave: PropTypes.func,
};

function SaveModal(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(SaveModal.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = SaveModal.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    dashboard: props.dashboard,
    css: props.css,
    saveType: 'overwrite',
    newDashName: props.dashboard.dashboard_title + ' [copy]',
    duplicateSlices: false
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
  function toggleDuplicateSlices() {
    updateState({
      duplicateSlices: !stateRef.current.duplicateSlices
    });
  }
  function changeSaveType(saveType) {
    updateState({
      saveType
    });
  }
  function handleNameChange(event) {
    updateState({
      newDashName: event.target.value,
      saveType: 'newDashboard'
    });
  }
  function saveDashboardRequest(data, url, saveType) {
    const saveModal = modalRef.current;
    const onSaveDashboard = propsRef.current.onSave;
    Object.assign(data, {
      css: propsRef.current.css
    });
    $.ajax({
      type: 'POST',
      url,
      data: {
        data: JSON.stringify(data)
      },
      success(resp) {
        saveModal.close();
        onSaveDashboard();
        if (saveType === 'newDashboard') {
          window.location = `/superset/dashboard/${resp.id}/`;
        } else {
          notify.success(t('This dashboard was saved successfully.'));
        }
      },
      error(error) {
        saveModal.close();
        const errorMsg = getAjaxErrorMsg(error);
        notify.error(t('Sorry, there was an error saving this dashboard: ') + '</ br>' + errorMsg);
      }
    });
  }
  function saveDashboard(saveType, newDashboardTitle) {
    const dashboard = propsRef.current.dashboard;
    const positions = propsRef.current.serialize();
    const data = {
      positions,
      css: stateRef.current.css,
      expanded_slices: dashboard.metadata.expanded_slices || {},
      dashboard_title: dashboard.dashboard_title,
      default_filters: JSON.stringify(propsRef.current.filters),
      duplicate_slices: stateRef.current.duplicateSlices
    };
    let url = null;
    if (saveType === 'overwrite') {
      url = `/superset/save_dash/${dashboard.id}/`;
      saveDashboardRequest(data, url, saveType);
    } else if (saveType === 'newDashboard') {
      if (!newDashboardTitle) {
        modalRef.current.close();
        showModal({
          title: t('Error'),
          body: t('You must pick a name for the new dashboard')
        });
      } else {
        data.dashboard_title = newDashboardTitle;
        url = `/superset/copy_dash/${dashboard.id}/`;
        saveDashboardRequest(data, url, saveType);
      }
    }
  }
  function renderOptionCard({
    selected,
    onSelect,
    label,
    children,
  }) {
    const className = [
      'save-chart-option-card',
      selected ? 'is-selected' : '',
    ].filter(Boolean).join(' ');
    return (
      <div
        className={className}
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
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
  const saveType = stateRef.current.saveType;
  return (
    <ModalTrigger
      ref={modal => {
        modalRef.current = modal;
      }}
      isMenuItem
      dialogClassName="save-chart-modal"
      triggerNode={propsRef.current.triggerNode}
      modalTitle={(
        <span className="save-chart-modal__heading">
          <span className="save-chart-modal__title-icon" aria-hidden="true">
            <i className="fa fa-save" />
          </span>
          {t('Save Dashboard')}
        </span>
      )}
      modalBody={(
        <div className="save-chart-section__body">
          {renderOptionCard({
            selected: saveType === 'overwrite',
            onSelect: () => changeSaveType('overwrite'),
            label: t('Overwrite Dashboard [%s]', propsRef.current.dashboard.dashboard_title),
          })}
          {renderOptionCard({
            selected: saveType === 'newDashboard',
            onSelect: () => changeSaveType('newDashboard'),
            label: t('Save as:'),
            children: saveType === 'newDashboard' ? (
              <div onClick={(event) => event.stopPropagation()}>
                <input
                  className="save-chart-input"
                  placeholder={t('[dashboard name]')}
                  value={stateRef.current.newDashName}
                  onFocus={handleNameChange}
                  onChange={handleNameChange}
                />
                <div className="save-chart-copy-option">
                  <Checkbox
                    checked={stateRef.current.duplicateSlices}
                    onChange={toggleDuplicateSlices.bind(undefined)}
                  />
                  <span className="m-l-5">also copy (duplicate) slices</span>
                </div>
              </div>
            ) : null,
          })}
        </div>
      )}
      modalFooter={(
        <Button
          variant="primary"
          className="save-chart-btn save-chart-btn--primary"
          onClick={() => {
            saveDashboard(stateRef.current.saveType, stateRef.current.newDashName);
          }}
        >
          {t('Save')}
        </Button>
      )}
    />
  );
}


SaveModal.propTypes = propTypes;

export default SaveModal;
