import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import sinon from 'sinon';

import $ from 'jquery';
import { queries } from './fixtures';
import { VisualizeModal } from '../../../javascripts/SqlLab/components/VisualizeModal';

describe('VisualizeModal', () => {
  let notifyError;
  let notifyInfo;

  beforeEach(() => {
    notifyError = sinon.spy();
    notifyInfo = sinon.spy();
    global.notify = { error: notifyError, info: notifyInfo };
  });

  afterEach(cleanup);

  it('shows a clear empty state when a query has no results', () => {
    render(<VisualizeModal actions={{ createDatasource: sinon.spy() }} query={{}} show />);
    expect(document.querySelector('.modal-body').textContent.trim()).not.to.equal('');
    expect(document.querySelector('.modal table')).to.equal(null);
  });

  it('renders query columns and submits the edited datasource definition', () => {
    const request = $.Deferred();
    const createDatasource = sinon.stub().returns(request.promise());
    const query = queries[0];
    render(<VisualizeModal
      actions={{ createDatasource }}
      errorMessage="Unable to create datasource"
      query={query}
      show
      timeout={45}
    />);

    expect(document.querySelectorAll('.modal tbody tr')).to.have.length(query.results.columns.length);
    const datasourceInput = document.querySelector('.modal input.form-control-sm');
    fireEvent.change(datasourceInput, { target: { value: 'sales_datasource' } });
    const dimensionCheckbox = document.querySelector('.modal tbody input[type="checkbox"]');
    fireEvent.click(dimensionCheckbox);
    fireEvent.click(document.querySelector('.modal-body button.btn-primary'));

    expect(createDatasource.calledOnce).to.equal(true);
    expect(createDatasource.firstCall.args[0]).to.include({
      datasourceName: 'sales_datasource',
      dbId: query.dbId,
      schema: query.schema,
      sql: query.sql,
    });
    expect(createDatasource.firstCall.args[0].columns.ds.is_dim).to.equal(true);
  });

  it('blocks visualization when a result column has an invalid name', () => {
    const query = {
      ...queries[0],
      results: {
        ...queries[0].results,
        columns: [{ is_date: false, is_dim: true, name: '&', type: 'STRING' }],
      },
    };
    render(<VisualizeModal
      actions={{ createDatasource: sinon.spy() }}
      query={query}
      show
      timeout={45}
    />);

    expect(document.querySelector('.modal .alert-warning')).not.to.equal(null);
    expect(document.querySelector('.modal-body button.btn-primary').disabled).to.equal(true);
  });

  it('warns when the query duration exceeds the explore timeout', () => {
    const query = {
      ...queries[0],
      endDttm: queries[0].startDttm + 101000,
    };
    render(<VisualizeModal
      actions={{ createDatasource: sinon.spy() }}
      query={query}
      show
      timeout={45}
    />);

    expect(screen.getByText(/This query took 101 seconds to run/)).not.to.equal(null);
  });

  it('reports datasource creation failures', () => {
    const createDatasource = sinon.stub().returns(
      $.Deferred().reject('error message').promise(),
    );
    render(<VisualizeModal
      actions={{ createDatasource }}
      errorMessage="Unable to create datasource"
      query={queries[0]}
      show
      timeout={45}
    />);

    fireEvent.click(document.querySelector('.modal-body button.btn-primary'));
    expect(notifyError.calledOnceWithExactly('Unable to create datasource')).to.equal(true);
  });
});
