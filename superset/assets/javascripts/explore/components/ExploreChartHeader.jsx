import React from 'react';
import PropTypes from 'prop-types';

import { chartPropType } from '../../chart/chartReducer';
import ExploreActionButtons from './ExploreActionButtons';
import RowCountLabel from './RowCountLabel';
import EditableTitle from '../../components/EditableTitle';
import AlteredSliceTag from '../../components/AlteredSliceTag';
import FaveStar from '../../components/FaveStar';
import TooltipWrapper from '../../components/TooltipWrapper';
import Timer from '../../components/Timer';
import CachedLabel from '../../components/CachedLabel';
import { t } from '../../locales';

const CHART_STATUS_MAP = {
  failed: 'danger',
  loading: 'warning',
  success: 'success',
};

const propTypes = {
  actions: PropTypes.object.isRequired,
  addHistory: PropTypes.func,
  can_overwrite: PropTypes.bool.isRequired,
  can_download: PropTypes.bool.isRequired,
  isStarred: PropTypes.bool.isRequired,
  slice: PropTypes.object,
  table_name: PropTypes.string,
  form_data: PropTypes.object,
  timeout: PropTypes.number,
  chart: PropTypes.shape(chartPropType),
};

function ExploreChartHeader(props) {
  const runQuery = () => {
    props.actions.runQuery(props.form_data, true, props.timeout, props.chart.chartKey);
  };
  const updateChartTitleOrSaveSlice = newTitle => {
    const isNewSlice = !props.slice;
    const params = {
      slice_name: newTitle,
      action: isNewSlice ? 'saveas' : 'overwrite'
    };
    props.actions.saveSlice(props.form_data, params).then(data => {
      if (isNewSlice) {
        props.actions.createNewSlice(data.can_add, data.can_download, data.can_overwrite, data.slice, data.form_data);
        props.addHistory({
          isReplace: true,
          title: `[chart] ${data.slice.slice_name}`
        });
      } else {
        props.actions.updateChartTitle(newTitle);
      }
    });
  };
  const renderChartTitle = () => {
    let title;
    if (props.slice) {
      title = props.slice.slice_name;
    } else {
      title = t('%s - untitled', props.table_name);
    }
    return title;
  };
    const formData = props.form_data;
    const {
      chartStatus,
      chartUpdateEndTime,
      chartUpdateStartTime,
      latestQueryFormData,
      queryResponse
    } = props.chart;
    const chartSucceeded = ['success', 'rendered'].indexOf(props.chart.chartStatus) > 0;
    return <div id="slice-header" className="clearfix chart-title-large">
        <EditableTitle title={renderChartTitle()} canEdit={!props.slice || props.can_overwrite} onSaveTitle={updateChartTitleOrSaveSlice} />

        {props.slice && <span>
          <FaveStar itemId={props.slice.slice_id} fetchFaveStar={props.actions.fetchFaveStar} saveFaveStar={props.actions.saveFaveStar} isStarred={props.isStarred} />

          <TooltipWrapper label="edit-desc" tooltip={t('Edit chart properties')}>
            <a className="edit-desc-icon" href={`/slicemodelview/edit/${props.slice.slice_id}`}>
              <i className="fa fa-edit" />
            </a>
          </TooltipWrapper>
        </span>}
        {props.chart.sliceFormData && <AlteredSliceTag origFormData={props.chart.sliceFormData} currentFormData={formData} />}
        <div className="float-end">
          {chartSucceeded && queryResponse && <RowCountLabel rowcount={queryResponse.rowcount} limit={formData.row_limit} />}
          {chartSucceeded && queryResponse && queryResponse.is_cached && <CachedLabel onClick={runQuery} cachedTimestamp={queryResponse.cached_dttm} />}
          <Timer startTime={chartUpdateStartTime} endTime={chartUpdateEndTime} isRunning={chartStatus === 'loading'} status={CHART_STATUS_MAP[chartStatus]} style={{
          fontSize: '10px',
          marginRight: '5px'
        }} />
          <ExploreActionButtons slice={props.slice} canDownload={props.can_download} chartStatus={chartStatus} latestQueryFormData={latestQueryFormData} queryResponse={queryResponse} />
        </div>
      </div>;
}

ExploreChartHeader.propTypes = propTypes;

export default ExploreChartHeader;
