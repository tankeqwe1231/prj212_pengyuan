/* eslint-disable no-unused-expressions */
import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import sinon from 'sinon';

import TabStatusIcon from '../../../javascripts/SqlLab/components/TabStatusIcon';

describe('TabStatusIcon', () => {
  afterEach(cleanup);

  it('reveals the close mark on hover and publishes close clicks', () => {
    const onClose = sinon.spy();
    const { container } = render(<TabStatusIcon onClose={onClose} tabState="running" />);
    const trigger = container.querySelector('span');
    expect(container.querySelector('.circle').textContent).to.equal('');
    fireEvent.mouseOver(trigger);
    expect(container.querySelector('.circle').textContent).to.equal('×');
    fireEvent.click(trigger);
    expect(onClose.calledOnce).to.be.true;
  });
});
