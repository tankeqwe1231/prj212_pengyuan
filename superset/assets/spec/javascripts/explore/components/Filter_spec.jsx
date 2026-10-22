import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import sinon from 'sinon';

import Filter from '../../../../javascripts/explore/components/controls/Filter';
import { t } from '../../../../javascripts/locales';

const datasource = {
  id: 1,
  type: 'table',
  filterable_cols: [['col1', 'Column 1'], ['col2', 'Column 2']],
  metrics_combo: [['m1', 'Metric 1'], ['m2', 'Metric 2']],
};

describe('Filter', () => {
  afterEach(cleanup);

  it('publishes column, operator, and removal changes', () => {
    const changeFilter = sinon.spy();
    const removeFilter = sinon.spy();
    const filter = { col: null, op: 'in', val: ['value'] };
    const { container } = render(<Filter
      changeFilter={changeFilter}
      datasource={datasource}
      filter={filter}
      removeFilter={removeFilter}
      valueChoices={[["value", "value"]]}
    />);
    const controls = container.querySelectorAll('.Select__control');
    expect(controls).to.have.length(3);

    fireEvent.mouseDown(controls[0]);
    fireEvent.click(screen.getByText('Column 1'));
    fireEvent.mouseDown(container.querySelectorAll('.Select__control')[1]);
    fireEvent.click(screen.getByText('LIKE'));
    fireEvent.click(container.querySelector('#remove-button'));

    expect(changeFilter.calledWith('col', 'col1')).to.equal(true);
    expect(changeFilter.calledWith(['val', 'op'], ['value', 'LIKE'])).to.equal(true);
    expect(removeFilter.calledOnce).to.equal(true);
  });

  it('renders text input operators and normalizes null values', () => {
    const { rerender } = render(<Filter
      datasource={datasource}
      filter={{ col: 'col1', op: '>=', val: null }}
    />);
    expect(screen.getByPlaceholderText(t('Filter value')).value).to.equal('');
    rerender(<Filter datasource={{ ...datasource, type: 'druid' }} filter={{ col: 'col1', op: 'regex', val: 'x' }} />);
    expect(screen.getByPlaceholderText(t('Filter value')).value).to.equal('x');
  });
});
