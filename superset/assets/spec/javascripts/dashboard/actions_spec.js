import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import $ from 'jquery';

import * as actions from '../../../javascripts/dashboard/actions';
import * as chartActions from '../../../javascripts/chart/chartAction';

describe('dashboard actions', () => {
  let ajaxStub;

  beforeEach(() => {
    ajaxStub = sinon.stub($, 'ajax');
  });

  afterEach(() => {
    ajaxStub.restore();
  });

  it('refreshes a slice from the latest persisted form data', () => {
    const dispatch = sinon.spy();
    const slice = {
      chartKey: 'slice_248',
      slice_id: 248,
    };
    const latestSliceFormData = {
      datasource: '2__table',
      viz_type: 'line',
      filters: [{ col: 'region', op: 'in', val: ['Europe'] }],
      groupby: [],
      metrics: ['sum__SP_POP_TOTL'],
      annotation_layers: [],
    };
    const queryFormData = {
      ...latestSliceFormData,
      extra_filters: [{ col: 'country_name', op: 'in', val: ['France'] }],
    };
    ajaxStub.resolves({
      form_data: queryFormData,
      slice_form_data: latestSliceFormData,
      data: [],
    });

    return actions.refreshSlice(slice, {
      // This represents filters from other dashboard slices.  The action
      // must not receive or submit the chart's old persisted filters.
      extra_filters: queryFormData.extra_filters,
    })(dispatch).then(() => {
      expect(ajaxStub.calledOnce).to.equal(true);
      const request = ajaxStub.firstCall.args[0];
      expect(request.type).to.equal('GET');
      expect(request.url).to.equal('/superset/slice_json/248?force=true');
      expect(JSON.parse(request.data.form_data)).to.deep.equal({
        slice_id: 248,
        extra_filters: queryFormData.extra_filters,
      });

      const actionTypes = dispatch.args.map(call => call[0].type);
      expect(actionTypes).to.include(actions.UPDATE_SLICE_FORM_DATA);
      expect(actionTypes).to.include(chartActions.UPDATE_CHART_FORM_DATA);
      const updateAction = dispatch.args
        .map(call => call[0])
        .find(action => action.type === actions.UPDATE_SLICE_FORM_DATA);
      expect(updateAction.rawFormData).to.deep.equal(latestSliceFormData);
      expect(updateAction.formData.filters).to.deep.equal(latestSliceFormData.filters);
    });
  });
});
