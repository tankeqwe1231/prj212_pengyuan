import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import sinon from 'sinon';

import VizTypeControl from '../../../../javascripts/explore/components/controls/VizTypeControl';
import visTypes from '../../../../javascripts/explore/stores/visTypes';

describe('VizTypeControl', () => {
  afterEach(cleanup);

  it('opens, filters, and selects a visualization type', () => {
    const onChange = sinon.spy();
    render(
      <VizTypeControl label="Visualization Type" name="viz_type" onChange={onChange} value="table" />,
    );
    fireEvent.click(screen.getByText(visTypes.table.label));
    const allImages = document.querySelectorAll('img[alt^="viz-type-"]').length;
    expect(allImages).to.be.above(20);

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: visTypes.line.label.slice(0, 2).toLowerCase() },
    });
    expect(document.querySelectorAll('img[alt^="viz-type-"]').length).to.be.below(10);
    fireEvent.click(document.querySelector('.viztype-selector-container'));
    expect(onChange.calledOnce).to.equal(true);
  });
});
