import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import sinon from 'sinon';

import $ from 'jquery';
import QuerySearch from '../../../javascripts/SqlLab/components/QuerySearch';

describe('QuerySearch', () => {
  let getJsonStub;
  let getStub;
  const actions = {
    addAlert: sinon.spy(),
    setDatabases: sinon.spy(),
  };

  beforeEach(() => {
    getStub = sinon.stub($, 'get').returns($.Deferred().promise());
    getJsonStub = sinon.stub($, 'getJSON').callsFake((url, callback) => {
      callback([], 'success');
    });
  });

  afterEach(() => {
    cleanup();
    getJsonStub.restore();
    getStub.restore();
  });

  it('renders the query filters and refreshes with entered search criteria', () => {
    const { container } = render(<QuerySearch actions={actions} height="400px" />);

    expect(container.querySelectorAll('.Select__control')).to.have.length(5);
    const searchInput = container.querySelector('input.form-control');
    fireEvent.change(searchInput, { target: { value: 'orders' } });

    const statusControl = container.querySelectorAll('.Select__control')[4];
    fireEvent.mouseDown(statusControl);
    fireEvent.click(screen.getByRole('option', { name: 'failed' }));
    fireEvent.click(container.querySelector('button.btn-success'));

    const requestUrl = getJsonStub.lastCall.args[0];
    expect(requestUrl).to.contain('search_text=orders');
    expect(requestUrl).to.contain('status=failed');
    expect(container.querySelector('.QueryTable')).not.to.equal(null);
  });
});
