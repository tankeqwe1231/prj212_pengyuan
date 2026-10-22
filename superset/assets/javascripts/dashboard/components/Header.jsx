import React, { useRef } from 'react';
import PropTypes from 'prop-types';

import Controls from './Controls';
import EditableTitle from '../../components/EditableTitle';
import Button from '../../components/Button';
import FaveStar from '../../components/FaveStar';
import InfoTooltipWithTrigger from '../../components/InfoTooltipWithTrigger';
import { t } from '../../locales';

const propTypes = {
  dashboard: PropTypes.object.isRequired,
  filters: PropTypes.object.isRequired,
  userId: PropTypes.string.isRequired,
  isStarred: PropTypes.bool,
  addSlicesToDashboard: PropTypes.func,
  onSave: PropTypes.func,
  onChange: PropTypes.func,
  fetchFaveStar: PropTypes.func,
  renderSlices: PropTypes.func,
  saveFaveStar: PropTypes.func,
  serialize: PropTypes.func,
  startPeriodicRender: PropTypes.func,
  updateDashboardTitle: PropTypes.func,
  editMode: PropTypes.bool.isRequired,
  setEditMode: PropTypes.func.isRequired,
  unsavedChanges: PropTypes.bool.isRequired,
};

function Header(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(Header.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = Header.defaultProps[key];
  });
  const propsRef = useRef(props);
  function handleSaveTitle(title) {
    propsRef.current.updateDashboardTitle(title);
  }
  function toggleEditMode() {
    propsRef.current.setEditMode(!propsRef.current.editMode);
  }
  function renderUnsaved() {
    if (!propsRef.current.unsavedChanges) {
      return null;
    }
    return <InfoTooltipWithTrigger label="unsaved" tooltip={t('Unsaved changes')} icon="exclamation-triangle" className="text-danger m-r-5" placement="top" />;
  }
  function renderEditButton() {
    if (!propsRef.current.dashboard.dash_save_perm) {
      return null;
    }
    const btnText = propsRef.current.editMode ? t('Switch to View Mode') : t('Edit Dashboard');
    return <Button variant="outline-secondary" className="m-r-5 ckeditor-switch dashboard-edit-toggle" onClick={toggleEditMode}>
        {btnText}
      </Button>;
  }
  propsRef.current = props;
  const dashboard = propsRef.current.dashboard;
  // title div flex布局，pull-left这个显示在左，pull-right这个显示在右
  return <div className="title flex-title">
        <div className="title-left">
          <div className="outer-container title-text-ds">
            <EditableTitle title={dashboard.dashboard_title} canEdit={dashboard.dash_save_perm && propsRef.current.editMode} onSaveTitle={handleSaveTitle} showTooltip={propsRef.current.editMode} />
            <span className="favstar m-r-5">
              <FaveStar itemId={dashboard.id} fetchFaveStar={propsRef.current.fetchFaveStar} saveFaveStar={propsRef.current.saveFaveStar} isStarred={propsRef.current.isStarred} />
            </span>
            {renderUnsaved()}
          </div>
        </div>
        <div className="title-right">
          {renderEditButton()}
          <Controls dashboard={dashboard} filters={propsRef.current.filters} userId={propsRef.current.userId} addSlicesToDashboard={propsRef.current.addSlicesToDashboard} onSave={propsRef.current.onSave} onChange={propsRef.current.onChange} renderSlices={propsRef.current.renderSlices} serialize={propsRef.current.serialize} startPeriodicRender={propsRef.current.startPeriodicRender} editMode={propsRef.current.editMode} />
        </div>
        {/* <div className="clearfix" /> */}
      </div>;
}


Header.propTypes = propTypes;

export default Header;
