import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';

import ColorSchemeControl from '../../../../javascripts/explore/components/controls/ColorSchemeControl';
import { ALL_COLOR_SCHEMES } from '../../../../javascripts/modules/colors';

describe('ColorSchemeControl', () => {
  afterEach(cleanup);

  it('renders the color-scheme selector with the current palette', () => {
    const choices = Object.keys(ALL_COLOR_SCHEMES).map(scheme => [scheme, scheme]);
    const value = choices[0][0];
    const { container } = render(
      <ColorSchemeControl
        choices={choices}
        label="Color scheme"
        name="color_scheme"
        schemes={ALL_COLOR_SCHEMES}
        value={value}
      />,
    );

    expect(screen.getByRole('combobox')).not.to.equal(null);
    expect(container.querySelectorAll('.color-scheme-container li').length).to.equal(
      ALL_COLOR_SCHEMES[value].length,
    );
  });
});
