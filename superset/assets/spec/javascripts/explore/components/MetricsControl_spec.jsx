import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import sinon from 'sinon';

import MetricsControl from '../../../../javascripts/explore/components/controls/MetricsControl';
import AdhocMetric from '../../../../javascripts/explore/AdhocMetric';
import { AGGREGATES } from '../../../../javascripts/explore/constants';

const columns = [
  { type: 'VARCHAR(255)', column_name: 'source' },
  { type: 'DOUBLE', column_name: 'value' },
];
const savedMetrics = [
  { metric_name: 'sum__value', expression: 'SUM(energy_usage.value)' },
  { metric_name: 'custom_metric', expression: 'SUM(FANCY(value))' },
];

function renderControl(onChange, props = {}) {
  return render(<MetricsControl
    columns={columns}
    datasourceType="sqla"
    label="Metrics"
    multi
    name="metrics"
    onChange={onChange}
    savedMetrics={savedMetrics}
    {...props}
  />);
}

describe('MetricsControl', () => {
  afterEach(cleanup);

  it('selects a saved metric as its persisted metric name', () => {
    const onChange = sinon.spy();
    const { container } = renderControl(onChange);
    fireEvent.mouseDown(container.querySelector('.Select__control'));
    fireEvent.click(screen.getByText('custom_metric'));
    expect(onChange.calledOnceWithExactly(['custom_metric'])).to.equal(true);
  });

  it('turns a selected numeric column into an ad-hoc SUM metric', () => {
    const onChange = sinon.spy();
    const { container } = renderControl(onChange);
    fireEvent.mouseDown(container.querySelector('.Select__control'));
    fireEvent.click(screen.getByText('value'));
    const selected = onChange.firstCall.args[0][0];
    expect(selected).to.be.instanceOf(AdhocMetric);
    expect(selected.column).to.include(columns[1]);
    expect(selected.aggregate).to.equal(AGGREGATES.SUM);
  });

  it('keeps aggregate function input controlled for column completion', () => {
    const onChange = sinon.spy();
    const { container } = renderControl(onChange);
    const combobox = container.querySelector('[role="combobox"]');
    fireEvent.mouseDown(container.querySelector('.Select__control'));
    fireEvent.click(screen.getByText('SUM'));
    expect(combobox.value).to.equal('SUM()');
    fireEvent.change(combobox, { target: { value: 'SUM(val' } });
    expect(combobox.value).to.equal('SUM(val');
    expect(screen.getByText('value')).not.to.equal(null);
  });

  it('coerces URL form-data metrics and refreshes options when columns change', () => {
    const onChange = sinon.spy();
    const metric = {
      column: columns[1], aggregate: AGGREGATES.SUM, label: 'SUM(value)', optionName: 'metric_value',
    };
    const { container, rerender } = renderControl(onChange, { value: [metric] });
    expect(container.querySelector('.Select__multi-value')).not.to.equal(null);
    rerender(<MetricsControl
      columns={[...columns, { type: 'INT', column_name: 'count' }]}
      datasourceType="sqla"
      multi
      name="metrics"
      onChange={onChange}
      savedMetrics={savedMetrics}
      value={[metric]}
    />);
    expect(onChange.calledWith([])).to.equal(true);
  });
});
