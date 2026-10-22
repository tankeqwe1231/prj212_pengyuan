import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import TableLoader from './TableLoader';
import { t } from '../../locales';

const propTypes = {
  user: PropTypes.object.isRequired,
};

function CreatedContent({ user }) {
  function renderSliceTable() {
    const mutator = data => data.map(slice => ({
      slice: <a href={slice.url}>{slice.title}</a>,
      favorited: moment.utc(slice.dttm).fromNow(),
      _favorited: slice.dttm
    }));
    return <TableLoader dataEndpoint={`/superset/created_slices/${user.userId}/`} className="table table-sm" columns={['slice', 'favorited']} mutator={mutator} noDataText={t('No slices')} sortable />;
  }
  function renderDashboardTable() {
    const mutator = data => data.map(dash => ({
      dashboard: <a href={dash.url}>{dash.title}</a>,
      favorited: moment.utc(dash.dttm).fromNow(),
      _favorited: dash.dttm
    }));
    return <TableLoader className="table table-sm" mutator={mutator} dataEndpoint={`/superset/created_dashboards/${user.userId}/`} noDataText={t('No dashboards')} columns={['dashboard', 'favorited']} sortable />;
  }
  return <div>
        <h3>{t('Dashboards')}</h3>
        {renderDashboardTable()}
        <hr />
        <h3>{t('Slices')}</h3>
        {renderSliceTable()}
      </div>;
}


CreatedContent.propTypes = propTypes;

export default CreatedContent;
