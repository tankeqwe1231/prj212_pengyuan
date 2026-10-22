import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import sinon from 'sinon';

import FilterControl from '../../../../javascripts/explore/components/controls/FilterControl';
import { t } from '../../../../javascripts/locales';

const value = [
  { col: 'col1', op: 'in', val: ['a', 'b', 'd'] },
  { col: 'col2', op: '==', val: 'Z' },
];
const datasource = {
  id: 1,
  type: 'qtable',
  filter_select: true,
  filterable_cols: [['col1', 'Column 1'], ['col2', 'Column 2']],
  metrics_combo: [['m1', 'Metric 1'], ['m2', 'Metric 2']],
};

describe('FilterControl', () => {
  let ajax;
  beforeEach(() => {
    ajax = sinon.stub(window.$, 'ajax').callsFake(() => ({ abort: sinon.spy() }));
  });
  afterEach(() => { cleanup(); ajax.restore(); });

  it('loads filter choices and adds and removes filters', () => {
    const onChange = sinon.spy();
    const { container } = render(<FilterControl
      datasource={datasource}
      name="not_having_filters"
      onChange={onChange}
      value={value}
    />);
    expect(container.querySelectorAll('#remove-button')).to.have.length(2);
    expect(container.querySelectorAll('#remove-button.btn-outline-secondary')).to.have.length(2);
    expect(container.querySelector('#add-button.btn-outline-secondary')).not.to.equal(null);
    expect(ajax.firstCall.args[0].url).to.equal('/superset/filter/qtable/1/col1/');
    expect(ajax.secondCall.args[0].url).to.equal('/superset/filter/qtable/1/col2/');
    expect(ajax.firstCall.returnValue.abort.calledOnce).to.equal(true);

    fireEvent.click(screen.getByText(t('Add Filter')));
    expect(onChange.firstCall.args[0]).to.deep.equal([
      ...value,
      { col: 'col1', op: 'in', val: [] },
    ]);
    fireEvent.click(container.querySelectorAll('#remove-button')[1]);
    expect(onChange.secondCall.args[0]).to.deep.equal([value[0]]);
  });

  it('clears values and requests choices after a column change', () => {
    const onChange = sinon.spy();
    const { container } = render(<FilterControl
      datasource={datasource}
      name="not_having_filters"
      onChange={onChange}
      value={value}
    />);
    fireEvent.mouseDown(container.querySelectorAll('.Select__control')[0]);
    fireEvent.click(screen.getByRole('option', { name: 'Column 2' }));
    expect(onChange.lastCall.args[0][0]).to.deep.equal({ col: 'col2', op: 'in', val: [] });
    expect(ajax.lastCall.args[0].url).to.equal('/superset/filter/qtable/1/col2/');
  });
});
