import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';

import TableLoader from './TableLoader';

const propTypes = {
  user: PropTypes.object,
};

function RecentActivity({ user }) {
    const rowLimit = 50;
    const mutator = function (data) {
      return data.filter(row => row.action === 'dashboard' || row.action === 'explore').map(row => ({
        name: <a href={row.item_url}>{row.item_title}</a>,
        type: row.action,
        time: moment.utc(row.time).fromNow(),
        _time: row.time
      }));
    };
    return <div>
        <TableLoader className="table table-sm" mutator={mutator} sortable dataEndpoint={`/superset/recent_activity/${user.userId}/?limit=${rowLimit}`} />
      </div>;
}
export default RecentActivity;
RecentActivity.propTypes = propTypes;
