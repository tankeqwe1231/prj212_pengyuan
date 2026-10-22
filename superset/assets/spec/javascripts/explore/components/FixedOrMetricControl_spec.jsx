import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import FixedOrMetricControl from '../../../../javascripts/explore/components/controls/FixedOrMetricControl';

describe('FixedOrMetricControl', () => {
  afterEach(cleanup);

  it('opens fixed and metric editors', () => {
    render(<FixedOrMetricControl label="Threshold" value={{ type: 'fix', value: 5 }} />);
    fireEvent.click(screen.getByText('5'));
    expect(screen.getByText('Fixed')).not.to.equal(null);
    expect(screen.getByText('Based on a metric')).not.to.equal(null);
    expect(document.querySelector('.Select__control')).not.to.equal(null);
  });
});
