/* eslint-disable no-unused-expressions */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import sinon from 'sinon';

import PopoverSection from '../../../javascripts/components/PopoverSection';

describe('PopoverSection', () => {
  afterEach(cleanup);

  it('shows selection state and publishes selection clicks', () => {
    const onSelect = sinon.spy();
    const view = render(
      <PopoverSection info="info section" isSelected onSelect={onSelect} title="Section Title">
        <div>child</div>
      </PopoverSection>,
    );
    expect(view.container.querySelector('.fa-check')).to.exist;
    fireEvent.click(screen.getByText('Section Title'));
    expect(onSelect.calledOnce).to.be.true;

    view.rerender(
      <PopoverSection info="info section" isSelected={false} onSelect={onSelect} title="Section Title">
        <div>child</div>
      </PopoverSection>,
    );
    expect(view.container.querySelector('.fa-check')).to.equal(null);
    expect(view.container.querySelector('.PopoverSection.dimmed')).to.exist;
  });
});
