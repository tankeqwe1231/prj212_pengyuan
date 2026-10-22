import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import sinon from 'sinon';

import TableElement from '../../../javascripts/SqlLab/components/TableElement';
import { table } from './fixtures';

function actions() {
  return {
    collapseTable: sinon.spy(),
    expandTable: sinon.spy(),
    removeDataPreview: sinon.spy(),
    removeTable: sinon.spy(),
  };
}

describe('TableElement', () => {
  afterEach(cleanup);

  it('renders, sorts, collapses, and removes table metadata', async () => {
    const tableActions = actions();
    const { container } = render(<TableElement actions={tableActions} table={table} timeout={0} />);
    const names = () => Array.from(container.querySelectorAll('.table-columns .col-name'))
      .map(node => node.textContent);
    expect(container.querySelectorAll('.table-columns > div')).to.have.length(14);
    expect(container.querySelectorAll('.ws-el-controls .m-l-2')).to.have.length(0);
    expect(names()[0]).to.contain('id');

    fireEvent.click(container.querySelector('.sort-cols'));
    expect(names()[0]).to.contain('active');
    fireEvent.click(screen.getByText(table.name));
    expect(tableActions.collapseTable.calledOnceWithExactly(table)).to.equal(true);

    fireEvent.click(container.querySelector('.table-remove'));
    expect(tableActions.removeDataPreview.calledOnceWithExactly(table)).to.equal(true);
    await waitFor(() => {
      expect(tableActions.removeTable.calledOnceWithExactly(table)).to.equal(true);
    });
  });
});
