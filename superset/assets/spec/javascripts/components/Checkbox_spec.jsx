/* eslint-disable no-unused-expressions */
import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import sinon from 'sinon';

import Checkbox from '../../../javascripts/components/Checkbox';

describe('Checkbox', () => {
  afterEach(cleanup);

  it('reflects its checked state and publishes the toggled value', () => {
    const onChange = sinon.spy();
    const view = render(<Checkbox checked onChange={onChange} />);
    const icon = view.container.querySelector('i');
    expect(icon.classList.contains('text-primary')).to.be.true;

    fireEvent.click(icon);
    expect(onChange.calledWith(false)).to.be.true;

    view.rerender(<Checkbox checked={false} onChange={onChange} />);
    expect(view.container.querySelector('i').classList.contains('text-transparent')).to.be.true;
  });
});
