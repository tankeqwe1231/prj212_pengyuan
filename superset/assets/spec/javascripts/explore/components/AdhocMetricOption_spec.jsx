import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import AdhocMetric from '../../../../javascripts/explore/AdhocMetric';
import AdhocMetricOption from '../../../../javascripts/explore/components/AdhocMetricOption';
import { AGGREGATES } from '../../../../javascripts/explore/constants';

const metric = new AdhocMetric({
  aggregate: AGGREGATES.SUM,
  column: { type: 'DOUBLE', column_name: 'value' },
  optionName: 'metric_value',
});

describe('AdhocMetricOption', () => {
  afterEach(cleanup);

  it('renders the label and opens its editor', async () => {
    const { container } = render(
      <AdhocMetricOption adhocMetric={metric} columns={[]} onMetricEdit={() => {}} />,
    );
    expect(screen.getByText(metric.label)).not.to.equal(null);
    fireEvent.click(container.querySelector('.badge'));
    const popover = document.querySelector('.popover');
    expect(popover).not.to.equal(null);
    await waitFor(() => expect(popover.style.position).to.equal('fixed'));
  });

  it('waits for the badge ref before automatically opening a new metric editor', async () => {
    const newMetric = new AdhocMetric({
      aggregate: AGGREGATES.COUNT_DISTINCT,
      column: { type: 'VARCHAR(255)', column_name: 'long_metric_column' },
    });
    const { container } = render(
      <AdhocMetricOption adhocMetric={newMetric} columns={[]} onMetricEdit={() => {}} />,
    );

    await waitFor(() => expect(document.querySelector('.popover')).not.to.equal(null));
    expect(document.body.getAttribute('aria-describedby')).to.equal(null);
    expect(container.querySelector('.badge').getAttribute('aria-describedby'))
      .to.equal('metrics-edit-popover');
  });
});
