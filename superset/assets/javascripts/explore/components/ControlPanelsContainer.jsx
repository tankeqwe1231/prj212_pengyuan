/* eslint camelcase: 0 */
import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { Alert, Tab, Tabs } from 'react-bootstrap';
import visTypes, { sectionsToRender } from '../stores/visTypes';
import ControlPanelSection from './ControlPanelSection';
import ControlRow from './ControlRow';
import Control from './Control';
import controls from '../stores/controls';
import { t } from '../../locales';
import * as actions from '../actions/exploreActions';

const propTypes = {
  actions: PropTypes.object.isRequired,
  alert: PropTypes.string,
  datasource_type: PropTypes.string.isRequired,
  exploreState: PropTypes.object.isRequired,
  controls: PropTypes.object.isRequired,
  form_data: PropTypes.object.isRequired,
  isDatasourceMetaLoading: PropTypes.bool.isRequired,
};

function ControlPanelsContainer(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(ControlPanelsContainer.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = ControlPanelsContainer.defaultProps[key];
  });
  const propsRef = useRef(props);
  function getControlData(controlName) {
    const control = propsRef.current.controls[controlName];
    // Identifying mapStateToProps function to apply (logic can't be in store)
    let mapF = controls[controlName].mapStateToProps;

    // Looking to find mapStateToProps override for this viz type
    const controlOverrides = visTypes[propsRef.current.controls.viz_type.value].controlOverrides || {};
    if (controlOverrides[controlName] && controlOverrides[controlName].mapStateToProps) {
      mapF = controlOverrides[controlName].mapStateToProps;
    }
    // Applying mapStateToProps if needed
    if (mapF) {
      return Object.assign({}, control, mapF(propsRef.current.exploreState, control));
    }
    return control;
  }
  function getSectionsToRender() {
    return sectionsToRender(propsRef.current.form_data.viz_type, propsRef.current.datasource_type);
  }
  function removeAlert() {
    propsRef.current.actions.removeControlPanelAlert();
  }
  function renderControlPanelSection(section) {
    const ctrls = propsRef.current.controls;
    const hasErrors = section.controlSetRows.some(rows => rows.some(s => ctrls[s] && ctrls[s].validationErrors && ctrls[s].validationErrors.length > 0));
    return <ControlPanelSection key={section.label} label={section.label} startExpanded={section.expanded} hasErrors={hasErrors} description={section.description}>
        {section.controlSetRows.map((controlSets, i) => <ControlRow key={`controlsetrow-${i}`} className={controlSets.some(controlName => controlName === 'filters' || controlName === 'having_filters') ? 'filter-control-row' : 'control-row'} controls={controlSets.map(controlName => controlName && ctrls[controlName] && <Control name={controlName} key={`control-${controlName}`} value={propsRef.current.form_data[controlName]} validationErrors={ctrls[controlName].validationErrors} actions={propsRef.current.actions} {...getControlData(controlName)} />)} />)}
      </ControlPanelSection>;
  }
  propsRef.current = props;
  const allSectionsToRender = getSectionsToRender();
  const querySectionsToRender = [];
  const displaySectionsToRender = [];
  allSectionsToRender.forEach(section => {
    if (section.controlSetRows.some(rows => rows.some(control => controls[control] && (!controls[control].renderTrigger || controls[control].tabOverride === 'data')))) {
      querySectionsToRender.push(section);
    } else {
      displaySectionsToRender.push(section);
    }
  });
  return <div className="scrollbar-container">
        <div className="scrollbar-content">
          {propsRef.current.alert && <Alert variant="warning">
              {propsRef.current.alert}
              <i className="fa fa-close float-end" onClick={removeAlert} style={{
          cursor: 'pointer'
        }} />
            </Alert>}
          <Tabs id="controlSections" defaultActiveKey="query">
            <Tab eventKey="query" title={t('Data')}>
              {querySectionsToRender.map(renderControlPanelSection)}
            </Tab>
            {displaySectionsToRender.length > 0 && <Tab eventKey="display" title={t('Style')}>
                {displaySectionsToRender.map(renderControlPanelSection)}
              </Tab>}
          </Tabs>
        </div>
      </div>;
}



ControlPanelsContainer.propTypes = propTypes;

function mapStateToProps({ explore }) {
  return {
    alert: explore.controlPanelAlert,
    isDatasourceMetaLoading: explore.isDatasourceMetaLoading,
    controls: explore.controls,
    exploreState: explore,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export { ControlPanelsContainer };

export default connect(mapStateToProps, mapDispatchToProps)(ControlPanelsContainer);
