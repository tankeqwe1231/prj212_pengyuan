import React from 'react';
import { cleanup, render } from '@testing-library/react';

import ControlSetRow from '../../../../javascripts/explore/components/ControlRow';

describe('ControlSetRow', () => {
  afterEach(cleanup);

  it('lays out every supplied control in one row', () => {
    const { container } = render(<ControlSetRow controls={[
      <a href="#one" key="one">one</a>,
      <a href="#two" key="two">two</a>,
    ]} />);
    expect(container.querySelector('.row.control-row')).not.to.equal(null);
    expect(container.querySelectorAll('.row a')).to.have.length(2);
  });

  it('does not render empty control columns or an entirely empty row', () => {
    const { container, rerender } = render(<ControlSetRow controls={[
      null,
      <a href="#one" key="one">one</a>,
      null,
    ]} />);
    expect(container.querySelectorAll('.row > div')).to.have.length(1);
    expect(container.querySelector('.col-lg-12')).not.to.equal(null);

    rerender(<ControlSetRow controls={[null, null]} />);
    expect(container.querySelector('.row')).to.equal(null);
  });
});
