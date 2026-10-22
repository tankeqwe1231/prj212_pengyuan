import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import sinon from 'sinon';

import AppTable from '../../../javascripts/components/AppTable/AppTable';

const columns = [
  {
    accessorKey: 'name',
    cell: info => <strong>{info.row.original.label}</strong>,
    enableGlobalFilter: true,
    enableSorting: true,
    header: 'Name',
  },
  {
    accessorKey: 'rank',
    enableGlobalFilter: false,
    enableSorting: true,
    header: 'Rank',
  },
];

const data = [
  { id: 'b', label: 'Displayed B', name: 'Beta', rank: 10 },
  { id: 'a', label: 'Displayed A', name: 'Alpha', rank: 2 },
  { id: 'c', label: 'Displayed C', name: 'Gamma', rank: 30 },
];

describe('AppTable', () => {
  afterEach(cleanup);

  it('sorts by raw accessor values while retaining cell renderers', () => {
    render(<AppTable columns={columns} data={data} getRowId={row => row.id} />);
    expect(screen.getByText('Name').closest('th').getAttribute('aria-sort')).to.equal('none');
    fireEvent.click(screen.getByRole('button', { name: 'Name' }));
    expect(screen.getByText('Name').closest('th').getAttribute('aria-sort')).to.equal('ascending');
    let rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('Displayed A')).not.to.equal(null);
    expect(screen.getByText('Displayed A').closest('td').textContent).not.to.contain('Alpha');

    fireEvent.click(screen.getByRole('button', { name: 'Name' }));
    rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('Displayed C')).not.to.equal(null);
  });

  it('filters only eligible columns and resets pagination', () => {
    const { rerender } = render(
      <AppTable columns={columns} data={data} globalFilter="" pageSize={1} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    expect(screen.getByText('Displayed C')).not.to.equal(null);

    rerender(<AppTable columns={columns} data={data} globalFilter="Alpha" pageSize={1} />);
    expect(screen.getByText('Displayed A')).not.to.equal(null);
    expect(screen.queryByRole('button', { name: '2' })).to.equal(null);

    rerender(<AppTable columns={columns} data={data} globalFilter="30" pageSize={1} />);
    expect(screen.getByText('No data')).not.to.equal(null);
  });

  it('applies the requested initial sorting state', () => {
    render(<AppTable
      columns={columns}
      data={data}
      initialSorting={[{ id: 'rank', desc: true }]}
    />);
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('Displayed C')).not.to.equal(null);
    expect(screen.getByText('Rank').closest('th').getAttribute('aria-sort')).to.equal('descending');
  });

  it('preserves a valid page across data refresh and clamps an invalid page', () => {
    const { rerender } = render(<AppTable columns={columns} data={data} pageSize={1} />);
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(screen.getByText('Displayed A')).not.to.equal(null);

    rerender(<AppTable columns={columns} data={[...data, {
      id: 'd', label: 'Displayed D', name: 'Delta', rank: 40,
    }]} pageSize={1} />);
    expect(screen.getByText('Displayed A')).not.to.equal(null);

    rerender(<AppTable columns={columns} data={[data[0]]} pageSize={1} />);
    expect(screen.getByText('Displayed B')).not.to.equal(null);
  });

  it('shows compact pagination controls for large result sets', () => {
    const manyRows = Array.from({ length: 169 }, (_, index) => ({
      id: String(index + 1),
      label: `Displayed ${index + 1}`,
      name: `Name ${index + 1}`,
      rank: index + 1,
    }));

    render(<AppTable columns={columns} data={manyRows} pageSize={1} />);

    expect(document.querySelector('.app-table-page-previous').disabled).to.equal(true);
    expect(document.querySelector('.app-table-page-next').disabled).to.equal(false);
    expect(document.querySelector('.app-table-page-first').disabled).to.equal(true);
    expect(document.querySelector('.app-table-page-last').disabled).to.equal(false);
    expect(screen.getByRole('button', { name: 'First page' }).textContent).to.equal('<<');
    expect(screen.getByRole('button', { name: 'Last page' }).textContent).to.equal('>>');
    expect(screen.getByRole('button', { name: '1' })).not.to.equal(null);
    expect(screen.getByRole('button', { name: '5' })).not.to.equal(null);
    expect(screen.queryByRole('button', { name: '6' })).to.equal(null);
    expect(screen.queryByRole('button', { name: '169' })).to.equal(null);

    fireEvent.click(document.querySelector('.app-table-page-next'));
    expect(screen.getByText('Displayed 2')).not.to.equal(null);
    expect(screen.queryByRole('button', { name: '1' })).not.to.equal(null);

    fireEvent.click(screen.getByRole('button', { name: 'Last page' }));
    expect(screen.getByText('Displayed 169')).not.to.equal(null);
    expect(document.querySelector('.app-table-page-last').disabled).to.equal(true);

    fireEvent.click(screen.getByRole('button', { name: 'First page' }));
    expect(screen.getByText('Displayed 1')).not.to.equal(null);
  });

  it('supports controlled sorting, empty text, and DOM prop callbacks', () => {
    const onSortingChange = sinon.spy();
    const { rerender } = render(<AppTable
      className="custom-table"
      columns={columns}
      data={data}
      getCellProps={cell => ({ className: `cell-${cell.column.id}` })}
      getHeaderProps={header => ({ id: `header-${header.column.id}` })}
      getRowProps={row => ({ 'data-row-id': row.original.id })}
      id="example-table"
      onSortingChange={onSortingChange}
      sorting={[]}
      style={{ width: '50%' }}
    />);
    const table = document.querySelector('#example-table');
    expect(table.className).to.equal('custom-table');
    expect(table.style.width).to.equal('50%');
    expect(document.querySelector('#header-name')).not.to.equal(null);
    expect(document.querySelector('[data-row-id="b"]')).not.to.equal(null);
    expect(document.querySelector('.cell-name')).not.to.equal(null);

    fireEvent.click(screen.getByRole('button', { name: 'Rank' }));
    expect(onSortingChange.calledOnceWithExactly([{ id: 'rank', desc: false }])).to.equal(true);

    rerender(<AppTable columns={columns} data={[]} noDataText="Nothing here" />);
    expect(screen.getByText('Nothing here')).not.to.equal(null);
  });
});
