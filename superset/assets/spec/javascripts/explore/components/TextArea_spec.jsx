import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import sinon from 'sinon';

import TextAreaControl from '../../../../javascripts/explore/components/controls/TextAreaControl';

describe('TextAreaControl', () => {
  afterEach(cleanup);

  it('renders a textarea and publishes changes', () => {
    const onChange = sinon.spy();
    render(<TextAreaControl label="X Axis Label" name="x_axis_label" onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'x' } });
    expect(onChange.calledOnceWithExactly('x')).to.equal(true);
  });

  it('renders Ace when a language is specified', () => {
    const { container } = render(
      <TextAreaControl language="markdown" name="markdown" offerEditInModal={false} />,
    );
    expect(container.querySelector('.ace_editor')).not.to.equal(null);
    expect(container.querySelector('textarea[placeholder]')).to.equal(null);
  });
});
