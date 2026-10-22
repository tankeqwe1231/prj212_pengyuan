import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';

import MetricDefinitionValue from '../../../../javascripts/explore/components/MetricDefinitionValue';
import AdhocMetric from '../../../../javascripts/explore/AdhocMetric';
import { AGGREGATES } from '../../../../javascripts/explore/constants';

const sumValueAdhocMetric = new AdhocMetric({
  column: { type: 'DOUBLE', column_name: 'value' },
  aggregate: AGGREGATES.SUM,
});

describe('MetricDefinitionValue', () => {
  afterEach(cleanup);

  it('renders saved and ad-hoc metric values', () => {
    const { rerender } = render(
      <MetricDefinitionValue option={{ metric_name: 'a_saved_metric' }} />,
    );
    expect(screen.getByText('a_saved_metric')).not.to.equal(null);

    rerender(<MetricDefinitionValue onMetricEdit={() => {}} option={sumValueAdhocMetric} />);
    expect(screen.getByText(sumValueAdhocMetric.label)).not.to.equal(null);
  });
});
