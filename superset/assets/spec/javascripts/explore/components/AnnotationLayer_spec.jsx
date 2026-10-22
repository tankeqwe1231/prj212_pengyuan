/* eslint-disable no-unused-expressions */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';

import AnnotationLayer from '../../../../javascripts/explore/components/controls/AnnotationLayer';

describe('AnnotationLayer', () => {
  afterEach(cleanup);

  it('renders a new annotation layer without accessing uninitialized state', () => {
    render(<AnnotationLayer vizType="line" />);

    expect(screen.getByText('Layer Configuration')).to.exist;
    expect(screen.queryByText('Formula')).to.equal(null);
  });

  it('renders action buttons with outlined secondary styling', () => {
    render(<AnnotationLayer vizType="line" />);

    ['Cancel', 'Apply', 'OK'].forEach(label => {
      const button = screen.getByRole('button', { name: label });
      expect(button.classList.contains('btn-outline-secondary')).to.equal(true);
      expect(button.classList.contains('bg-transparent')).to.equal(true);
      expect(button.classList.contains('btn-btn-outline-secondary')).to.equal(false);
    });
  });
});
