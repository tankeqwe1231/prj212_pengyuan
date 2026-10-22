import { describe, it } from 'mocha';
import { expect } from 'chai';

import { dashboard as reducers } from '../../../javascripts/dashboard/reducers';
import chartReducer from '../../../javascripts/chart/chartReducer';
import * as actions from '../../../javascripts/dashboard/actions';
import * as chartActions from '../../../javascripts/chart/chartAction';
import { charts, defaultFilters, dashboard as initState } from './fixtures';

describe('Dashboard reducers', () => {
  it('should remove slice', () => {
    const action = {
      type: actions.REMOVE_SLICE,
      slice: initState.dashboard.slices[1],
    };
    expect(initState.dashboard.slices).to.have.length(3);

    const { dashboard, filters, refresh } = reducers(initState, action);
    expect(dashboard.slices).to.have.length(2);
    expect(filters).to.deep.equal(defaultFilters);
    expect(refresh).to.equal(false);
    expect(filters).to.equal(initState.filters);
  });

  it('should remove filter slice', () => {
    const action = {
      type: actions.REMOVE_SLICE,
      slice: initState.dashboard.slices[0],
    };
    const initFilters = Object.keys(initState.filters);
    expect(initFilters).to.have.length(2);

    const { dashboard, filters, refresh } = reducers(initState, action);
    expect(dashboard.slices).to.have.length(2);
    expect(Object.keys(filters)).to.have.length(1);
    expect(refresh).to.equal(true);
  });

  it('should replace the dashboard slice form data after refresh', () => {
    const slice = initState.dashboard.slices.find(item => item.slice_id === 248);
    const rawFormData = {
      ...slice.form_data,
      filters: [{ col: 'region', op: 'in', val: ['Europe'] }],
    };
    const formData = { ...rawFormData, show_legend: true };
    const result = reducers(
      initState,
      actions.updateSliceFormData(slice, formData, rawFormData),
    );
    const refreshedSlice = result.dashboard.slices
      .find(item => item.slice_id === slice.slice_id);

    expect(refreshedSlice.formData).to.equal(formData);
    expect(refreshedSlice.form_data).to.equal(rawFormData);
  });

  it('should replace the chart form data after refresh', () => {
    const chartKey = 'slice_248';
    const rawFormData = {
      ...charts[chartKey].form_data,
      filters: [{ col: 'region', op: 'in', val: ['Europe'] }],
    };
    const formData = { ...rawFormData, show_legend: true };
    const latestQueryFormData = {
      ...formData,
      filters: rawFormData.filters.concat({
        col: 'country_name',
        op: 'in',
        val: ['France'],
      }),
    };
    const result = chartReducer(charts, chartActions.updateChartFormData(
      formData,
      rawFormData,
      latestQueryFormData,
      chartKey,
    ));

    expect(result[chartKey].formData).to.equal(formData);
    expect(result[chartKey].form_data).to.equal(rawFormData);
    expect(result[chartKey].latestQueryFormData).to.equal(latestQueryFormData);
  });
});
