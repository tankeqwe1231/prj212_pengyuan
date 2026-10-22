/* global notify */
import $ from 'jquery';
import { getExploreUrlAndPayload } from '../explore/exploreUtils';
import { applyDefaultFormData } from '../explore/stores/store';
import * as chartActions from '../chart/chartAction';

export const ADD_FILTER = 'ADD_FILTER';
export function addFilter(sliceId, col, vals, merge = true, refresh = true) {
  return { type: ADD_FILTER, sliceId, col, vals, merge, refresh };
}

export const CLEAR_FILTER = 'CLEAR_FILTER';
export function clearFilter(sliceId) {
  return { type: CLEAR_FILTER, sliceId };
}

export const REMOVE_FILTER = 'REMOVE_FILTER';
export function removeFilter(sliceId, col, vals, refresh = true) {
  return { type: REMOVE_FILTER, sliceId, col, vals, refresh };
}

export const UPDATE_DASHBOARD_LAYOUT = 'UPDATE_DASHBOARD_LAYOUT';
export function updateDashboardLayout(layout) {
  return { type: UPDATE_DASHBOARD_LAYOUT, layout };
}

export const UPDATE_DASHBOARD_TITLE = 'UPDATE_DASHBOARD_TITLE';
export function updateDashboardTitle(title) {
  return { type: UPDATE_DASHBOARD_TITLE, title };
}

export function addSlicesToDashboard(dashboardId, sliceIds) {
  return () => (
    $.ajax({
      type: 'POST',
      url: `/superset/add_slices/${dashboardId}/`,
      data: {
        data: JSON.stringify({ slice_ids: sliceIds }),
      },
    })
      .done(() => {
        // Refresh page to allow for slices to re-render
        window.location.reload();
      })
  );
}

export const REMOVE_SLICE = 'REMOVE_SLICE';
export function removeSlice(slice) {
  return { type: REMOVE_SLICE, slice };
}

export const UPDATE_SLICE_NAME = 'UPDATE_SLICE_NAME';
export function updateSliceName(slice, sliceName) {
  return { type: UPDATE_SLICE_NAME, slice, sliceName };
}
export function saveSlice(slice, sliceName) {
  const oldName = slice.slice_name;
  return (dispatch) => {
    const sliceParams = {};
    sliceParams.slice_id = slice.slice_id;
    sliceParams.action = 'overwrite';
    sliceParams.slice_name = sliceName;

    const { url, payload } = getExploreUrlAndPayload({
      formData: slice.form_data,
      endpointType: 'base',
      force: false,
      curUrl: null,
      requestParams: sliceParams,
    });
    return $.ajax({
      url,
      type: 'POST',
      data: {
        form_data: JSON.stringify(payload),
      },
      success: () => {
        dispatch(updateSliceName(slice, sliceName));
        notify.success('This slice name was saved successfully.');
      },
      error: () => {
        // if server-side reject the overwrite action,
        // revert to old state
        dispatch(updateSliceName(slice, oldName));
        notify.error("You don't have the rights to alter this slice");
      },
    });
  };
}

export const UPDATE_SLICE_FORM_DATA = 'UPDATE_SLICE_FORM_DATA';
export function updateSliceFormData(slice, formData, rawFormData = formData) {
  return { type: UPDATE_SLICE_FORM_DATA, slice, formData, rawFormData };
}
export function saveSliceFormData(slice, formData) {
  return (dispatch) => {
    // alert('111');
    const sliceParams = {};
    sliceParams.slice_id = slice.slice_id;
    sliceParams.action = 'overwrite';
    sliceParams.slice_name = slice.slice_name;

    const { url, payload } = getExploreUrlAndPayload({
      formData,
      endpointType: 'base',
      force: false,
      curUrl: null,
      requestParams: sliceParams,
    });
    return $.ajax({
      url,
      type: 'POST',
      data: {
        form_data: JSON.stringify(payload),
      },
      success: () => {
        dispatch(updateSliceFormData(slice, formData));
        notify.success('This slice content was saved successfully.');
      },
      error: () => {
        // if server-side reject the overwrite action,
        // revert to old state
        // dispatch(updateSliceName(slice, oldName));
        notify.error('更新失败');
      },
    });
  };
}

export function refreshSlice(slice, formData, timeout = 60) {
  return (dispatch) => {
    const chartKey = slice.chartKey || `slice_${slice.slice_id}`;
    const requestFormData = {
      slice_id: slice.slice_id,
      extra_filters: formData.extra_filters || [],
    };
    const queryRequest = $.ajax({
      type: 'GET',
      url: `/superset/slice_json/${slice.slice_id}?force=true`,
      dataType: 'json',
      cache: false,
      data: {
        form_data: JSON.stringify(requestFormData),
      },
      timeout: timeout * 1000,
    });

    dispatch(chartActions.chartUpdateStarted(
      queryRequest,
      requestFormData,
      chartKey,
    ));
    dispatch(chartActions.triggerQuery(false, chartKey));

    return queryRequest
      .then((queryResponse) => {
        const latestQueryFormData = queryResponse.form_data;
        const rawFormData = queryResponse.slice_form_data || latestQueryFormData;
        const refreshedFormData = applyDefaultFormData(rawFormData);

        dispatch(updateSliceFormData(slice, refreshedFormData, rawFormData));
        dispatch(chartActions.updateChartFormData(
          refreshedFormData,
          rawFormData,
          latestQueryFormData,
          chartKey,
        ));
        dispatch(chartActions.chartUpdateSucceeded(queryResponse, chartKey));

        const annotationLayers = refreshedFormData.annotation_layers || [];
        return Promise.all(annotationLayers.map(annotation => dispatch(
          chartActions.runAnnotationQuery(
            annotation,
            timeout,
            latestQueryFormData,
            chartKey,
          ),
        )));
      })
      .catch((err) => {
        if (err.statusText === 'timeout') {
          dispatch(chartActions.chartUpdateTimeout(err.statusText, timeout, chartKey));
        } else if (err.statusText === 'abort') {
          dispatch(chartActions.chartUpdateStopped(chartKey));
        } else {
          dispatch(chartActions.chartUpdateFailed(
            err.responseJSON || { error: 'Unexpected error.' },
            chartKey,
          ));
        }
      });
  };
}

const FAVESTAR_BASE_URL = '/superset/favstar/Dashboard';
export const TOGGLE_FAVE_STAR = 'TOGGLE_FAVE_STAR';
export function toggleFaveStar(isStarred) {
  return { type: TOGGLE_FAVE_STAR, isStarred };
}

export const FETCH_FAVE_STAR = 'FETCH_FAVE_STAR';
export function fetchFaveStar(id) {
  return function (dispatch) {
    const url = `${FAVESTAR_BASE_URL}/${id}/count/`;
    return $.get(url)
      .done((data) => {
        if (data.count > 0) {
          dispatch(toggleFaveStar(true));
        }
      });
  };
}

export const SAVE_FAVE_STAR = 'SAVE_FAVE_STAR';
export function saveFaveStar(id, isStarred) {
  return function (dispatch) {
    const urlSuffix = isStarred ? 'unselect' : 'select';
    const url = `${FAVESTAR_BASE_URL}/${id}/${urlSuffix}/`;
    $.get(url);
    dispatch(toggleFaveStar(!isStarred));
  };
}

export const TOGGLE_EXPAND_SLICE = 'TOGGLE_EXPAND_SLICE';
export function toggleExpandSlice(slice, isExpanded) {
  return { type: TOGGLE_EXPAND_SLICE, slice, isExpanded };
}

export const SET_EDIT_MODE = 'SET_EDIT_MODE';
export function setEditMode(editMode) {
  return { type: SET_EDIT_MODE, editMode };
}

// SaveModal Actions
export const FETCH_DASHBOARDS_SUCCEEDED = 'FETCH_DASHBOARDS_SUCCEEDED';
export function fetchDashboardsSucceeded(choices, canOverwrite) {
  return { type: FETCH_DASHBOARDS_SUCCEEDED, choices, canOverwrite };
}

export const FETCH_DASHBOARDS_FAILED = 'FETCH_DASHBOARDS_FAILED';
export function fetchDashboardsFailed(userId) {
  return { type: FETCH_DASHBOARDS_FAILED, userId };
}

export function fetchDashboards(userId, sliceId) {
  return function (dispatch) {
    const url = `/dashboardmodelviewasync/api/read?_flt_0_owners=${userId}&slice_id=${sliceId}`;
    return $.ajax({
      url,
      success: (data) => {
        const choices = [];
        for (let i = 0; i < data.result.length; i++) {
          choices.push({
            value: data.pks[i],
            label: data.result[i].dashboard_title,
          });
        }
        dispatch(fetchDashboardsSucceeded(choices, data.can_overwrite));
      },
      error: () => {
        dispatch(fetchDashboardsFailed(userId));
      },
    });
  };
}

// export const SAVE_SLICE_FAILED = 'SAVE_SLICE_FAILED';
// export function saveSliceFailed() {
//   return { type: SAVE_SLICE_FAILED };
// }
//
// export const SAVE_SLICE_SUCCESS = 'SAVE_SLICE_SUCCESS';
// export function saveSliceSuccess(data) {
//   return { type: SAVE_SLICE_SUCCESS, data };
// }

export const REMOVE_SAVE_MODAL_ALERT = 'REMOVE_SAVE_MODAL_ALERT';
export function removeSaveModalAlert() {
  return { type: REMOVE_SAVE_MODAL_ALERT };
}

export function addSliceToPrivateDashboard(formData, params) {
  return () => {
    const url = '/superset/add_slice_to_private_dashboard';
    return $.ajax({
      type: 'POST',
      url,
      data: {
        form_data: JSON.stringify(formData),
        extra_params: JSON.stringify(params),
      },
      // success: ((data) => {
      //   dispatch(saveSliceSuccess(data));
      // }),
      // error: (() => {
      //   dispatch(saveSliceFailed());
      // }),
    });
  };
}
