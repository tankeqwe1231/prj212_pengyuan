import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import { Responsive, WidthProvider } from 'react-grid-layout';

import GridCell from './GridCell';

require('react-grid-layout/css/styles.css');
require('react-resizable/css/styles.css');

const ResponsiveReactGridLayout = WidthProvider(Responsive);

const propTypes = {
  dashboard: PropTypes.object.isRequired,
  datasources: PropTypes.object,
  charts: PropTypes.object.isRequired,
  filters: PropTypes.object,
  timeout: PropTypes.number,
  onChange: PropTypes.func,
  getFormDataExtra: PropTypes.func,
  exploreChart: PropTypes.func,
  exportCSV: PropTypes.func,
  html2Image: PropTypes.func,
  fetchSlice: PropTypes.func,
  refreshSlice: PropTypes.func,
  saveSlice: PropTypes.func,
  saveSliceFormData: PropTypes.func,
  removeSlice: PropTypes.func,
  removeChart: PropTypes.func,
  updateDashboardLayout: PropTypes.func,
  toggleExpandSlice: PropTypes.func,
  addFilter: PropTypes.func,
  getFilters: PropTypes.func,
  clearFilter: PropTypes.func,
  removeFilter: PropTypes.func,
  editMode: PropTypes.bool.isRequired,
  can_exportCsv: PropTypes.bool,
  can_save_monitor: PropTypes.bool,
  show_top10_record: PropTypes.bool,
};

const defaultProps = {
  onChange: () => ({}),
  getFormDataExtra: () => ({}),
  exploreChart: () => ({}),
  exportCSV: () => ({}),
  fetchSlice: () => ({}),
  refreshSlice: () => ({}),
  saveSlice: () => ({}),
  saveSliceFormData: () => ({}),
  removeSlice: () => ({}),
  removeChart: () => ({}),
  updateDashboardLayout: () => ({}),
  toggleExpandSlice: () => ({}),
  addFilter: () => ({}),
  getFilters: () => ({}),
  clearFilter: () => ({}),
  removeFilter: () => ({}),
};

function GridLayout(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(GridLayout.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = GridLayout.defaultProps[key];
  });
  const propsRef = useRef(props);
  function onResizeStop(layout) {
    propsRef.current.updateDashboardLayout(layout);
    propsRef.current.onChange();
  }
  function onDragStop(layout) {
    propsRef.current.updateDashboardLayout(layout);
    propsRef.current.onChange();
  }
  function findSliceIndexById(sliceId) {
    return propsRef.current.dashboard.slices.map(slice => slice.slice_id).indexOf(sliceId);
  }
  function forceRefresh(sliceId) {
    return propsRef.current.refreshSlice(propsRef.current.charts['slice_' + sliceId]);
  }
  function removeSlice(slice) {
    if (!slice) {
      return;
    }

    // remove slice dashboard and charts
    propsRef.current.removeSlice(slice);
    propsRef.current.removeChart(propsRef.current.charts['slice_' + slice.slice_id].chartKey);
    propsRef.current.onChange();
  }
  function updateSliceName(sliceId, sliceName) {
    const index = findSliceIndexById(sliceId);
    if (index === -1) {
      return;
    }
    const currentSlice = propsRef.current.dashboard.slices[index];
    if (currentSlice.slice_name === sliceName) {
      return;
    }
    propsRef.current.saveSlice(currentSlice, sliceName);
  }
  function updateSliceFormData(sliceId, formData) {
    const index = findSliceIndexById(sliceId);
    if (index === -1) {
      return;
    }
    const currentSlice = propsRef.current.dashboard.slices[index];
    propsRef.current.saveSliceFormData(currentSlice, formData);
  }
  function isExpanded(slice) {
    return propsRef.current.dashboard.metadata.expanded_slices && propsRef.current.dashboard.metadata.expanded_slices[slice.slice_id];
  }
  propsRef.current = props;
  // render left sidebar height, added by zdz.
  // if ($('div#sidebar').height() < $('div#dashboard-container').height()) {
  //   $('div#sidebar').css('height', $('div#dashboard-container').css('height'));
  // }
  //   $('div#sidebar').css('height', '100%');
  // render by origin.

  const isPhone = navigator.userAgent.match(/(phone|pad|pod|iPhone|iPod|ios|iPad|Android|Mobile|BlackBerry|IEMobile|MQQBrowser|JUC|Fennec|wOSBrowser|BrowserNG|WebOS|Symbian|Windows Phone)/i);
  const updateSliceNameHandler = propsRef.current.dashboard.dash_edit_perm ? updateSliceName : null;
  const cells = propsRef.current.dashboard.slices.map(slice => {
    const chartKey = `slice_${slice.slice_id}`;
    const currentChart = propsRef.current.charts[chartKey];
    const queryResponse = currentChart.queryResponse || {};
    return <div id={'slice_' + slice.slice_id} key={slice.slice_id} data-slice-id={slice.slice_id} className={isPhone ? `widget ${slice.form_data.viz_type} dash_phone` : `widget ${slice.form_data.viz_type}`}>
          <GridCell slice={slice} chartKey={chartKey} datasource={propsRef.current.datasources[slice.form_data.datasource]} filters={propsRef.current.filters} formData={propsRef.current.getFormDataExtra(slice)} timeout={propsRef.current.timeout} exploreChart={propsRef.current.exploreChart} exportCSV={propsRef.current.exportCSV} html2Image={propsRef.current.html2Image} dashboardId={propsRef.current.dashboard.id} sliceExplorePerm={propsRef.current.dashboard.slice_explore_perm}
      // showChartForTimeTable={this.props.showChartForTimeTable}
      can_exportCsv={propsRef.current.can_exportCsv} can_save_monitor={propsRef.current.can_save_monitor} show_top10_record={propsRef.current.show_top10_record} isExpanded={!!isExpanded(slice)} isLoading={currentChart.chartStatus === 'loading'} isCached={queryResponse.is_cached} cachedDttm={queryResponse.cached_dttm} toggleExpandSlice={propsRef.current.toggleExpandSlice} forceRefresh={forceRefresh} removeSlice={removeSlice} updateSliceName={updateSliceNameHandler} updateSliceFormData={updateSliceFormData} addFilter={propsRef.current.addFilter} getFilters={propsRef.current.getFilters} clearFilter={propsRef.current.clearFilter} removeFilter={propsRef.current.removeFilter} editMode={propsRef.current.editMode} annotationQuery={currentChart.annotationQuery} annotationError={currentChart.annotationError} />
        </div>;
  });
  return <ResponsiveReactGridLayout className="layout" layouts={{
    lg: propsRef.current.dashboard.layout
  }} onResizeStop={onResizeStop} onDragStop={onDragStop} cols={{
    lg: 48,
    md: 48,
    sm: 40,
    xs: 32,
    xxs: 24
  }} rowHeight={10} autoSize margin={[20, 20]} useCSSTransforms draggableHandle=".drag">
        {cells}
      </ResponsiveReactGridLayout>;
}



GridLayout.propTypes = propTypes;
GridLayout.defaultProps = defaultProps;

export default GridLayout;
