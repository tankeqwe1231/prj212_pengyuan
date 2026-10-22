import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import sinon from 'sinon';
import DatasourceControl from '../../../../javascripts/explore/components/controls/DatasourceControl';

const $ = window.$ = require('jquery');

const defaultProps = {
  name: 'datasource',
  label: 'Datasource',
  value: '1__table',
  datasource: {
    name: 'birth_names',
    type: 'table',
    uid: '1__table',
    id: 1,
    columns: [],
    metrics: [],
    edit_url: '/datasource/1',
    database: { backend: 'mysql', name: 'main' },
  },
  onChange: () => {},
};

describe('DatasourceControl', () => {
  let ajaxStub;

  beforeEach(() => { ajaxStub = sinon.stub($, 'ajax'); });
  afterEach(() => { cleanup(); ajaxStub.restore(); });

  it('opens a modal for choosing another datasource', () => {
    render(<DatasourceControl {...defaultProps} />);
    fireEvent.click(screen.getByText('birth_names'));
    expect(document.querySelector('.modal')).not.to.equal(null);
    expect(screen.getByRole('textbox')).not.to.equal(null);
  });

  it('filters datasource links by their raw names', () => {
    render(<DatasourceControl {...defaultProps} />);
    fireEvent.click(screen.getByText('birth_names'));
    act(() => {
      ajaxStub.firstCall.args[0].success([{
        connection: 'main', creator: 'admin', name: 'Sales source', schema: 'public', type: 'table', uid: '2__table',
      }, {
        connection: 'main', creator: 'admin', name: 'Inventory source', schema: 'public', type: 'table', uid: '3__table',
      }]);
    });

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Inventory' } });
    expect(screen.queryByText('Sales source')).to.equal(null);
    expect(screen.getByText('Inventory source')).not.to.equal(null);
  });
});
