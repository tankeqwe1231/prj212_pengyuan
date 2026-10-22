import $ from 'jquery';
import React, { useLayoutEffect } from 'react';
import PropTypes from 'prop-types';
import { Card } from 'react-bootstrap';

import { chartPropType } from '../../chart/chartReducer';
import ChartContainer from '../../chart/ChartContainer';
import ExploreChartHeader from './ExploreChartHeader';

const propTypes = {
  actions: PropTypes.object.isRequired,
  addHistory: PropTypes.func,
  onQuery: PropTypes.func,
  onDismissRefreshOverlay: PropTypes.func,
  can_overwrite: PropTypes.bool.isRequired,
  can_download: PropTypes.bool.isRequired,
  datasource: PropTypes.object,
  column_formats: PropTypes.object,
  containerId: PropTypes.string.isRequired,
  height: PropTypes.string.isRequired,
  width: PropTypes.string.isRequired,
  isStarred: PropTypes.bool.isRequired,
  slice: PropTypes.object,
  table_name: PropTypes.string,
  vizType: PropTypes.string.isRequired,
  form_data: PropTypes.object,
  standalone: PropTypes.bool,
  timeout: PropTypes.number,
  refreshOverlayVisible: PropTypes.bool,
  chart: PropTypes.shape(chartPropType),
  errorMessage: PropTypes.node,
};

function ExploreChartPanel(props) {
  const getHeight = () => {
    const headerHeight = props.standalone ? 0 : 100;
    return parseInt(props.height, 10) - headerHeight;
  };
  const renderChart = () => <ChartContainer containerId={props.containerId} datasource={props.datasource} formData={props.form_data} height={getHeight()} slice={props.slice} chartKey={props.chart.chartKey} setControlValue={props.actions.setControlValue} timeout={props.timeout} vizType={props.vizType} refreshOverlayVisible={props.refreshOverlayVisible} errorMessage={props.errorMessage} onQuery={props.onQuery} onDismissRefreshOverlay={props.onDismissRefreshOverlay} />;
  useLayoutEffect(() => {
    if (props.standalone) $('body').addClass('background-transparent');
  }, [props.standalone]);
    if (props.standalone) {
      return renderChart();
    }
    const header = <ExploreChartHeader actions={props.actions} addHistory={props.addHistory} can_overwrite={props.can_overwrite} can_download={props.can_download} isStarred={props.isStarred} slice={props.slice} table_name={props.table_name} form_data={props.form_data} timeout={props.timeout} chart={props.chart} />;
    return <div className="chart-container">
        <Card style={{ height: props.height }}>
          <Card.Header>{header}</Card.Header>
          <Card.Body>{renderChart()}</Card.Body>
        </Card>
      </div>;
}

ExploreChartPanel.propTypes = propTypes;

export default ExploreChartPanel;
