import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import AdhocMetric from '../../../../javascripts/explore/AdhocMetric';
import AdhocMetricEditPopoverTitle from '../../../../javascripts/explore/components/AdhocMetricEditPopoverTitle';
import { AGGREGATES } from '../../../../javascripts/explore/constants';

const metric = new AdhocMetric({
  aggregate: AGGREGATES.SUM,
  column: { type: 'DOUBLE', column_name: 'value' },
});

describe('AdhocMetricEditPopoverTitle', () => {
  afterEach(cleanup);

  it('shows the default title and enters edit mode when clicked', () => {
    render(<AdhocMetricEditPopoverTitle adhocMetric={metric} onChange={() => {}} />);
    fireEvent.click(screen.getByText('My Metric'));
    expect(screen.getByRole('textbox')).not.to.equal(null);
  });
});
