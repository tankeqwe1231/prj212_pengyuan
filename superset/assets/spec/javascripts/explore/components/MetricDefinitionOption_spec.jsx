import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';

import MetricDefinitionOption from '../../../../javascripts/explore/components/MetricDefinitionOption';

describe('MetricDefinitionOption', () => {
  afterEach(cleanup);

  it('renders saved metrics, columns, and aggregate choices', () => {
    const { rerender } = render(
      <MetricDefinitionOption option={{ metric_name: 'a_saved_metric' }} />,
    );
    expect(screen.getByText('a_saved_metric')).not.to.equal(null);

    rerender(<MetricDefinitionOption option={{ column_name: 'a_column' }} />);
    expect(screen.getByText('a_column')).not.to.equal(null);

    rerender(<MetricDefinitionOption option={{ aggregate_name: 'an_aggregate' }} />);
    expect(screen.getByText('an_aggregate')).not.to.equal(null);
  });
});
