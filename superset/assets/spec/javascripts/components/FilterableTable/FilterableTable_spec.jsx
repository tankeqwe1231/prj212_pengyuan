import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import FilterableTable from '../../../../javascripts/components/FilterableTable/FilterableTable';

const defaultProps = {
  orderedColumnKeys: ['a', 'b', 'c'],
  data: [
    { a: 'a1', b: 'b1', c: 'c1', d: 0 },
    { a: 'a2', b: 'b2', c: 'c2', d: 100 },
  ],
  height: 500,
};

describe('FilterableTable', () => {
  afterEach(cleanup);

  it('renders all rows and filters strings and numbers', () => {
    const { rerender } = render(<FilterableTable {...defaultProps} />);
    expect(screen.getAllByRole('row')).to.have.length(3);

    rerender(<FilterableTable {...defaultProps} filterText="b1" />);
    expect(screen.getAllByRole('row')).to.have.length(2);
    expect(screen.queryByText('b2')).to.equal(null);

    rerender(<FilterableTable {...defaultProps} filterText="100" />);
    const dataRow = screen.getAllByRole('row')[1];
    expect(within(dataRow).getByText('a2')).not.to.equal(null);
  });
});
