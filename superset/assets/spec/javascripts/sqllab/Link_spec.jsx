/* eslint-disable no-unused-expressions */
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import sinon from 'sinon';

import Link from '../../../javascripts/SqlLab/components/Link';

describe('Link', () => {
  afterEach(cleanup);

  it('renders an actionable anchor and its tooltip', async () => {
    const onClick = sinon.spy(event => event.preventDefault());
    render(
      <Link href="http://www.airbnb.com" onClick={onClick} tooltip="This is a tooltip">TEST</Link>,
    );
    const anchor = screen.getByRole('link', { name: 'TEST' });
    expect(anchor.getAttribute('href')).to.equal('http://www.airbnb.com');
    fireEvent.click(anchor);
    expect(onClick.calledOnce).to.be.true;
    fireEvent.mouseEnter(anchor);
    await waitFor(() => {
      expect(document.body.textContent).to.contain('This is a tooltip');
    });
  });
});
