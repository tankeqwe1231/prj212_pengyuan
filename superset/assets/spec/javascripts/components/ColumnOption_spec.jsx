import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';

import ColumnOption from '../../../javascripts/components/ColumnOption';

describe('ColumnOption', () => {
  afterEach(cleanup);

  it('shows the verbose label and column metadata', () => {
    const { container } = render(<ColumnOption column={{
      column_name: 'foo',
      description: 'Foo is the greatest column of all',
      expression: 'SUM(foo)',
      verbose_name: 'Foo',
    }} />);
    expect(screen.getByText('Foo')).not.to.equal(null);
    expect(container.querySelectorAll('.fa-info, .fa-question-circle-o').length).to.equal(2);
  });

  it('falls back to the column name and renders expression type', () => {
    const { container } = render(<ColumnOption column={{
      column_name: 'foo',
      expression: 'SUM(foo)',
    }} showType />);
    expect(screen.getByText('foo')).not.to.equal(null);
    expect(container.querySelector('.type-label')).not.to.equal(null);
  });

  it('prefers the datetime type and omits missing types', () => {
    const { container, rerender } = render(
      <ColumnOption column={{ column_name: 'date', is_dttm: true }} showType />,
    );
    expect(container.querySelector('.fa-clock-o')).not.to.equal(null);
    rerender(<ColumnOption column={{ column_name: 'unknown', type: null }} showType />);
    expect(container.querySelector('.type-label')).to.equal(null);
  });
});
