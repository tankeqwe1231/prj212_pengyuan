import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import ColorPickerControl from '../../../../javascripts/explore/components/controls/ColorPickerControl';

describe('ColorPickerControl', () => {
  afterEach(cleanup);

  it('opens the color picker popover', () => {
    render(<ColorPickerControl label="Color" value={{ r: 1, g: 2, b: 3, a: 1 }} />);
    expect(screen.getByText('Color')).not.to.equal(null);
    fireEvent.click(screen.getByRole('button', { name: 'Choose color' }));
    expect(document.querySelector('.color-popover')).not.to.equal(null);
    expect(document.querySelector('.sketch-picker')).not.to.equal(null);
  });
});
