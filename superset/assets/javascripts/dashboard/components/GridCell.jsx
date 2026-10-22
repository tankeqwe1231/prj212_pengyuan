/* eslint-disable react/no-danger */
import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

import SliceHeader from './SliceHeader';
import ChartContainer from '../../chart/ChartContainer';
import { areObjectsEqual } from '../../reduxUtils';
import { isDashboardResizeSuppressed } from '../resizeUtils';

import '../../../stylesheets/dashboard.css';

const propTypes = {
  timeout: PropTypes.number,
  datasource: PropTypes.object,
  isLoading: PropTypes.bool,
  isCached: PropTypes.bool,
  cachedDttm: PropTypes.string,
  isExpanded: PropTypes.bool,
  widgetHeight: PropTypes.number,
  widgetWidth: PropTypes.number,
  slice: PropTypes.object,
  chartKey: PropTypes.string,
  formData: PropTypes.object,
  filters: PropTypes.object,
  forceRefresh: PropTypes.func,
  removeSlice: PropTypes.func,
  updateSliceName: PropTypes.func,
  updateSliceFormData: PropTypes.func,
  toggleExpandSlice: PropTypes.func,
  exploreChart: PropTypes.func,
  exportCSV: PropTypes.func,
  html2Image: PropTypes.func,
  // showChartForTimeTable: PropTypes.func,
  addFilter: PropTypes.func,
  getFilters: PropTypes.func,
  clearFilter: PropTypes.func,
  removeFilter: PropTypes.func,
  editMode: PropTypes.bool,
  annotationQuery: PropTypes.object,
  can_exportCsv: PropTypes.bool,
  can_save_monitor: PropTypes.bool,
  show_top10_record: PropTypes.bool,
  dashboardId: PropTypes.number,
};

const defaultProps = {
  forceRefresh: () => ({}),
  removeSlice: () => ({}),
  updateSliceName: () => ({}),
  updateSliceFormData: () => ({}),
  toggleExpandSlice: () => ({}),
  exploreChart: () => ({}),
  exportCSV: () => ({}),
  addFilter: () => ({}),
  getFilters: () => ({}),
  clearFilter: () => ({}),
  removeFilter: () => ({}),
  editMode: false,
};

function GridCell(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(GridCell.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = GridCell.defaultProps[key];
  });
  const propsRef = useRef(props);
  const cellRef = useRef(null);
  const [widgetSize, setWidgetSize] = useState(() => ({
    height: props.widgetHeight || 400,
    width: props.widgetWidth || 400,
  }));
  const addFilter = useCallback((...args) => {
    const currentProps = propsRef.current;
    return currentProps.addFilter(currentProps.slice.slice_id, ...args);
  }, []);
  const getFilters = useCallback((...args) => {
    const currentProps = propsRef.current;
    return currentProps.getFilters(currentProps.slice.slice_id, ...args);
  }, []);
  const clearFilter = useCallback((...args) => {
    const currentProps = propsRef.current;
    return currentProps.clearFilter(currentProps.slice.slice_id, ...args);
  }, []);
  const removeFilter = useCallback((...args) => {
    const currentProps = propsRef.current;
    return currentProps.removeFilter(currentProps.slice.slice_id, ...args);
  }, []);
  const descriptionIdRef = useRef(null);
  const headerIdRef = useRef(null);
  function width() {
    return widgetSize.width - 10;
  }
  function height(slice) {
    const measuredHeaderHeight = headerHeight(slice);
    let descriptionHeight = 0;
    if (propsRef.current.isExpanded && descriptionIdRef.current) {
      descriptionHeight = descriptionIdRef.current.offsetHeight + 10;
    }
    return widgetSize.height - measuredHeaderHeight - descriptionHeight;
  }
  function headerHeight() {
    return headerIdRef.current ? headerIdRef.current.offsetHeight : 30;
  }
  propsRef.current = props;
  useLayoutEffect(() => {
    // react-grid-layout owns the ref on each grid child; measure the actual
    // item from a ref inside the cell instead of relying on the child's ref.
    const widget = cellRef.current && cellRef.current.parentElement;
    if (!widget) {
      return undefined;
    }

    const updateWidgetSize = () => {
      // React-Bootstrap modals lock the page scrollbar while opening and
      // closing. The temporary width change is not a real chart resize and
      // should not update every chart's measured size.
      const modalIsOpen = document.body.classList.contains('modal-open');
      if (modalIsOpen || isDashboardResizeSuppressed()) {
        return;
      }
      const nextSize = {
        height: widget.offsetHeight,
        width: widget.offsetWidth,
      };
      if (!nextSize.height || !nextSize.width) {
        return;
      }
      setWidgetSize(previousSize => (
        previousSize.height === nextSize.height && previousSize.width === nextSize.width
          ? previousSize
          : nextSize
      ));
    };

    updateWidgetSize();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidgetSize);
      return () => window.removeEventListener('resize', updateWidgetSize);
    }

    const resizeObserver = new ResizeObserver(updateWidgetSize);
    resizeObserver.observe(widget);
    return () => resizeObserver.disconnect();
  }, [props.slice.slice_id]);
  const {
    isExpanded,
    isLoading,
    isCached,
    cachedDttm,
    sliceExplorePerm,
    removeSlice,
    updateSliceName,
    toggleExpandSlice,
    forceRefresh,
    chartKey,
    slice,
    datasource,
    formData,
    timeout,
    annotationQuery,
    exploreChart,
    exportCSV,
    updateSliceFormData,
    html2Image,
    dashboardId
  } = propsRef.current;
  return <div className={isLoading ? 'slice-cell-highlight' : 'slice-cell'} id={`cell-${slice.slice_id}`} ref={cellRef}>
        <div ref={ref => {
      headerIdRef.current = ref;
    }}>
          <SliceHeader slice={slice} isExpanded={isExpanded} isCached={isCached} cachedDttm={cachedDttm} removeSlice={removeSlice} updateSliceName={updateSliceName} toggleExpandSlice={toggleExpandSlice} forceRefresh={forceRefresh} editMode={propsRef.current.editMode} annotationQuery={annotationQuery} exploreChart={exploreChart} exportCSV={exportCSV} html2Image={html2Image} can_exportCsv={propsRef.current.can_exportCsv} can_save_monitor={propsRef.current.can_save_monitor} show_top10_record={propsRef.current.show_top10_record} dashboardId={dashboardId} datasource={datasource} formData={formData} sliceExplorePerm={sliceExplorePerm} />
        </div>
        {
      /* This usage of dangerouslySetInnerHTML is safe since it is being used to render
         markdown that is sanitized with bleach. See:
           https://github.com/apache/incubator-superset/pull/4390
         and
           https://github.com/apache/incubator-superset/commit/b6fcc22d5a2cb7a5e92599ed5795a0169385a825 */}
        <div className="slice_description bs-callout bs-callout-default" style={isExpanded ? {} : {
      display: 'none'
    }} ref={ref => {
      descriptionIdRef.current = ref;
    }} dangerouslySetInnerHTML={{
      __html: slice.description_markeddown
    }} />
        <div className="row chart-container">
          <input type="hidden" value="false" />
          <ChartContainer containerId={`slice-container-${slice.slice_id}`} chartKey={chartKey} datasource={datasource} formData={formData} headerHeight={headerHeight()} height={height(slice)} width={width()} timeout={timeout} vizType={slice.formData.viz_type} addFilter={addFilter} getFilters={getFilters} clearFilter={clearFilter} removeFilter={removeFilter} editMode={propsRef.current.editMode} updateSliceFormData={updateSliceFormData} />
        </div>
      </div>;
}

// Removing a different slice changes the dashboard/layout props and causes
// GridLayout to create a new element for every remaining child.  Keep an
// unaffected cell (and its connected Chart) from rendering again when only
// those container-level props changed.  Callback props intentionally are not
// compared: the cell stores the latest callbacks in propsRef and its stable
// wrappers read them at call time.
function areGridCellPropsEqual(previousProps, nextProps) {
  return previousProps.slice === nextProps.slice &&
    previousProps.chartKey === nextProps.chartKey &&
    previousProps.datasource === nextProps.datasource &&
    areObjectsEqual(previousProps.formData, nextProps.formData) &&
    previousProps.filters === nextProps.filters &&
    previousProps.timeout === nextProps.timeout &&
    previousProps.isLoading === nextProps.isLoading &&
    previousProps.isCached === nextProps.isCached &&
    previousProps.cachedDttm === nextProps.cachedDttm &&
    previousProps.isExpanded === nextProps.isExpanded &&
    previousProps.sliceExplorePerm === nextProps.sliceExplorePerm &&
    previousProps.annotationQuery === nextProps.annotationQuery &&
    previousProps.annotationError === nextProps.annotationError &&
    previousProps.can_exportCsv === nextProps.can_exportCsv &&
    previousProps.can_save_monitor === nextProps.can_save_monitor &&
    previousProps.show_top10_record === nextProps.show_top10_record &&
    previousProps.editMode === nextProps.editMode &&
    previousProps.dashboardId === nextProps.dashboardId;
}



GridCell.propTypes = propTypes;
GridCell.defaultProps = defaultProps;

export default React.memo(GridCell, areGridCellPropsEqual);
