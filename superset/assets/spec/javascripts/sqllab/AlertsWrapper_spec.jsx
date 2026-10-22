/* eslint-disable no-unused-expressions */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';

import AlertsWrapper from '../../../javascripts/components/AlertsWrapper';

describe('AlertsWrapper', () => {
  afterEach(cleanup);

  it('renders initial messages and installs the notification API', () => {
    const { container } = render(<AlertsWrapper initMessages={[["success", 'Saved']]} />);
    expect(screen.getByText('Saved')).not.to.equal(null);
    expect(container.querySelector('.alert-success')).not.to.equal(null);
    expect(global.notify.show).to.be.a('function');
  });
});
