import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import TableLoader from './TableLoader';
import { t } from '../../locales';

const propTypes = {
  user: PropTypes.object.isRequired,
};

function Favorites({ user }) {
  function renderSliceTable() {
    const mutator = data => data.map(slice => ({
      slice: <a href={slice.url}>{slice.title}</a>,
      creator: <a href={slice.creator_url}>{slice.creator}</a>,
      favorited: moment.utc(slice.dttm).fromNow(),
      _favorited: slice.dttm
    }));
    return <TableLoader dataEndpoint={`/superset/fave_slices/${user.userId}/`} className="table table-sm" columns={['slice', 'creator', 'favorited']} mutator={mutator} noDataText={t('No favorite charts yet, go click on stars!')} sortable />;
  }
  function renderDashboardTable() {
    const mutator = data => data.map(dash => ({
      dashboard: <a href={dash.url}>{dash.title}</a>,
      creator: <a href={dash.creator_url}>{dash.creator}</a>,
      favorited: moment.utc(dash.dttm).fromNow(),
      _favorited: dash.dttm
    }));
    return <TableLoader className="table table-sm" mutator={mutator} dataEndpoint={`/superset/fave_dashboards/${user.userId}/`} noDataText={t('No favorite dashboards yet, go click on stars!')} columns={['dashboard', 'creator', 'favorited']} columnsText={[{
      key: 'dashboard',
      label: t('Dashboard')
    }, {
      key: 'creator',
      label: 'creator'
    }, {
      key: 'favorited',
      label: 'favorited'
    }]} sortable />;
  }
  return <div>
        <h3>{t('Dashboard')}</h3>
        {renderDashboardTable()}
        <hr />
        <h3>{t('Charts')}</h3>
        {renderSliceTable()}
      </div>;
}


export default Favorites;
Favorites.propTypes = propTypes;
