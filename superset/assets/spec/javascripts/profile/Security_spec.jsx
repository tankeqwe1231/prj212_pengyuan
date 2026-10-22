import React from 'react';
import { cleanup, render } from '@testing-library/react';

import { user, userNoPerms } from './fixtures';
import Security from '../../../javascripts/profile/components/Security';

describe('Security', () => {
  afterEach(cleanup);

  it('renders roles and granted resources', () => {
    const { container } = render(<Security user={user} />);
    expect(container.querySelectorAll('.roles .permission-badge')).to.have.length(2);
    expect(container.querySelectorAll('.datasources .permission-badge')).to.have.length(2);
    expect(container.querySelectorAll('.databases .permission-badge')).to.have.length(3);
  });

  it('renders no resource labels when permissions are absent', () => {
    const { container } = render(<Security user={userNoPerms} />);
    expect(container.querySelectorAll('.datasources .permission-badge')).to.have.length(0);
    expect(container.querySelectorAll('.databases .permission-badge')).to.have.length(0);
  });
});
