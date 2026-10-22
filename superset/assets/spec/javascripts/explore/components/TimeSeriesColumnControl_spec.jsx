import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import TimeSeriesColumnControl from '../../../../javascripts/explore/components/controls/TimeSeriesColumnControl';

describe('TimeSeriesColumnControl', () => {
  afterEach(cleanup);

  it('opens column configuration fields', () => {
    const { container } = render(
      <TimeSeriesColumnControl label="X Axis Label" name="x_axis_label" />,
    );
    fireEvent.click(container.querySelector('.fa-edit'));
    expect(screen.getByText('Column Configuration')).not.to.equal(null);
    expect(screen.getByPlaceholderText('Label')).not.to.equal(null);
    expect(screen.getByPlaceholderText('Tooltip')).not.to.equal(null);
    expect(screen.getByPlaceholderText('Width')).not.to.equal(null);
  });
});
