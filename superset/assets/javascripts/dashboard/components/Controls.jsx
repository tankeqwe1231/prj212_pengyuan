import React, { useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { DropdownButton, DropdownItem } from 'react-bootstrap';

import CssEditor from './CssEditor';
import RefreshIntervalModal from './RefreshIntervalModal';
import SaveModal from './SaveModal';
import SliceAdder from './SliceAdder';
import ExportDashToImageBySnapdom from './ExportDashToImageBySnapdom';
import { t } from '../../locales';
import InfoTooltipWithTrigger from '../../components/InfoTooltipWithTrigger';

const $ = window.$ = require('jquery');

const propTypes = {
  dashboard: PropTypes.object.isRequired,
  filters: PropTypes.object.isRequired,
  slices: PropTypes.array,
  userId: PropTypes.string.isRequired,
  addSlicesToDashboard: PropTypes.func,
  onSave: PropTypes.func,
  onChange: PropTypes.func,
  renderSlices: PropTypes.func,
  serialize: PropTypes.func,
  startPeriodicRender: PropTypes.func,
  editMode: PropTypes.bool,
};

function MenuItemContent({ faIcon, text, tooltip, children }) {
  return (
    <span>
      <i className={`fa fa-${faIcon}`} /> {text} {''}
      <InfoTooltipWithTrigger
        tooltip={tooltip}
        label={`dash-${faIcon}`}
        placement="top"
      />
      {children}
    </span>
  );
}
MenuItemContent.propTypes = {
  faIcon: PropTypes.string.isRequired,
  text: PropTypes.string,
  tooltip: PropTypes.string,
  children: PropTypes.node,
};

function ActionMenuItem(props) {
  return (
    <DropdownItem onClick={props.onClick}>
      <MenuItemContent {...props} />
    </DropdownItem>
  );
}
ActionMenuItem.propTypes = {
  onClick: PropTypes.func,
};

function Controls(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(Controls.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = Controls.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    css: props.dashboard.css || '',
    cssTemplates: []
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
  function refresh() {
    // Force refresh all slices
    propsRef.current.renderSlices(true);
  }
  function setHome() {
    $.get('/superset/save_home/' + propsRef.current.dashboard.id, () => {
      // console.log(data);
      notify.success('设置成功');
    });
  }
  function changeCss(css) {
    updateState({
      css
    }, () => {
      updateDom(css);
    });
    propsRef.current.onChange();
  }
  function updateDom(css) {
    const className = 'CssEditor-css';
    const head = document.head || document.getElementsByTagName('head')[0];
    let style = document.querySelector('.' + className);
    if (!style) {
      style = document.createElement('style');
      style.className = className;
      style.type = 'text/css';
      head.appendChild(style);
    }
    if (style.styleSheet) {
      style.styleSheet.cssText = css;
    } else {
      style.innerHTML = css;
    }
  }
  propsRef.current = props;
  useLayoutEffect(() => {
    updateDom(stateRef.current.css);
    $.get('/csstemplateasyncmodelview/api/read', data => {
      const cssTemplates = data.result.map(row => ({
        value: row.template_name,
        css: row.css,
        label: row.template_name
      }));
      updateState({
        cssTemplates
      });
    });
  }, []);
  const {
    dashboard,
    userId,
    filters,
    addSlicesToDashboard,
    startPeriodicRender,
    serialize,
    onSave,
    editMode
  } = propsRef.current;
  const emailBody = t('Checkout this dashboard: %s', window.location.href);
  const emailLink = 'mailto:?Subject=Superset%20Dashboard%20' + `${dashboard.dashboard_title}&Body=${emailBody}`;
  let saveText = t('Save as');
  if (editMode) {
    saveText = t('Save');
  }
  return <span>
        <DropdownButton title={t('Actions')} variant="default" size="sm" id="bg-nested-dropdown" className="dashboard-actions" align="end">
          <ActionMenuItem text={t('设置为个人主页')} tooltip={t('设置为个人主页')} faIcon="home" onClick={setHome} />
          <ActionMenuItem text={t('Force Refresh')} tooltip={t('Force refresh the whole dashboard')} faIcon="refresh" onClick={refresh} />
          <RefreshIntervalModal onChange={refreshInterval => startPeriodicRender(refreshInterval * 1000)} triggerNode={<MenuItemContent text={t('Set autorefresh')} tooltip={t('Set the auto-refresh interval for this session')} faIcon="clock-o" />} />
          {/*{this.props.dashboard.slice_explore_perm && <SaveModal*/}
          {<SaveModal dashboard={dashboard} filters={filters} serialize={serialize} onSave={onSave} css={stateRef.current.css} triggerNode={<MenuItemContent text={saveText} tooltip={t('Save the dashboard')} faIcon="save" />} />}
          {editMode && !propsRef.current.dashboard.dashboard_type && <ActionMenuItem text={t('Edit properties')} tooltip={t("Edit the dashboards's properties")} faIcon="edit" onClick={() => {
        window.location = `/dashboardmodelview/edit/${dashboard.id}`;
      }} />}
          {editMode && !propsRef.current.dashboard.dashboard_type && <ActionMenuItem text={t('Email')} tooltip={t('Email a link to this dashboard')} onClick={() => {
        window.location = emailLink;
      }} faIcon="envelope" />}
          {editMode && !propsRef.current.dashboard.dashboard_type && <SliceAdder dashboard={dashboard} addSlicesToDashboard={addSlicesToDashboard} userId={userId} triggerNode={<MenuItemContent text={t('Add Slices')} tooltip={t('Add some slices to this dashboard')} faIcon="plus" />} />}
          {editMode && !propsRef.current.dashboard.dashboard_type && <CssEditor dashboard={dashboard} triggerNode={<MenuItemContent text={t('Edit CSS')} tooltip={t('Change the style of the dashboard using CSS code')} faIcon="css3" />} initialCss={stateRef.current.css} templates={stateRef.current.cssTemplates} onChange={changeCss} />}
          <ExportDashToImageBySnapdom slices={dashboard.slices} dashboardTitle={dashboard.dashboard_title} triggerNode={<MenuItemContent text={t('页面导出为图片')} tooltip={t('页面导出为图片')} faIcon="camera" />} />
        </DropdownButton>
      </span>;
}


Controls.propTypes = propTypes;

export default Controls;
