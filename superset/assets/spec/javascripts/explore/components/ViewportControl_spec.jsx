import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import ViewportControl from '../../../../javascripts/explore/components/controls/ViewportControl';

const value = { longitude: 6.85236157047845, latitude: 31.222656842808707, zoom: 1, bearing: 0, pitch: 0 };

describe('ViewportControl', () => {
  afterEach(cleanup);

  it('renders its coordinate summary and five editors', () => {
    render(<ViewportControl name="viewport" onChange={() => {}} value={value} />);
    fireEvent.click(screen.getByText("6° 51' 8.50\" | 31° 13' 21.56\""));
    expect(screen.getByText('Viewport')).not.to.equal(null);
    expect(document.querySelectorAll('#filter-popover-viewport input')).to.have.length(5);
  });
});
