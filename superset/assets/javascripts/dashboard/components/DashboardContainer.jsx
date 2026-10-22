import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import * as dashboardActions from '../actions';
import * as chartActions from '../../chart/chartAction';
import Dashboard from './Dashboard';

function mapStateToProps({ charts, dashboard, impressionId }) {
  return {
    initMessages: dashboard.common.flash_messages,
    timeout: dashboard.common.conf.SUPERSET_WEBSERVER_TIMEOUT,
    dashboard: dashboard.dashboard,
    slices: charts,
    datasources: dashboard.datasources,
    filters: dashboard.filters,
    refresh: !!dashboard.refresh,
    userId: dashboard.userId,
    userName: dashboard.userName,
    isStarred: !!dashboard.isStarred,
    editMode: dashboard.editMode,
    water_mark: dashboard.water_mark,
    noWaterMarkUser: dashboard.noWaterMarkUser,
    impressionId,
    can_exportCsv: dashboard.can_exportCsv,
    can_save_monitor: dashboard.can_save_monitor,
    show_top10_record: dashboard.show_top10_record,
  };
}

function mapDispatchToProps(dispatch) {
  const actions = { ...chartActions, ...dashboardActions };
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(Dashboard);
