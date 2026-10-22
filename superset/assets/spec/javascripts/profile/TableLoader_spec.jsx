import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import sinon from 'sinon';

import TableLoader from '../../../javascripts/profile/components/TableLoader';

const $ = window.$ = require('jquery');

describe('TableLoader', () => {
  let getStub;

  beforeEach(() => { getStub = sinon.stub($, 'get'); });
  afterEach(() => { cleanup(); getStub.restore(); });

  it('sorts by hidden raw values while rendering display values', () => {
    let respond;
    getStub.callsFake((url, callback) => {
      respond = callback;
      return { abort() {} };
    });
    render(<TableLoader
      columns={['name', 'time']}
      dataEndpoint="/table-data"
      sortable
    />);
    act(() => {
      respond([{
        name: <a href="/new">New item</a>,
        time: 'a minute ago',
        _time: '2026-08-12T10:00:00Z',
      }, {
        name: <a href="/old">Old item</a>,
        time: 'a year ago',
        _time: '2025-08-12T10:00:00Z',
      }]);
    });

    fireEvent.click(screen.getByRole('button', { name: 'time' }));
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('a year ago')).not.to.equal(null);
    expect(within(rows[1]).getByText('a minute ago')).not.to.equal(null);
  });
});
