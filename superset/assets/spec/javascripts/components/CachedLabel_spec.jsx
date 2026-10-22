/* eslint-disable no-unused-expressions */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import sinon from 'sinon';

import CachedLabel from '../../../javascripts/components/CachedLabel';

describe('CachedLabel', () => {
  afterEach(cleanup);

  it('renders cache status and invokes refresh', () => {
    const onClick = sinon.spy();
    const { container } = render(
      <CachedLabel cachedTimestamp="2017-01-01" onClick={onClick} />,
    );
    const label = screen.getByText('cached', { exact: false }).closest('.badge');
    expect(label).to.exist;
    expect(container.querySelector('.fa-refresh')).to.exist;
    fireEvent.mouseOver(label);
    fireEvent.click(label);
    expect(onClick.calledOnce).to.be.true;
  });
});
