import React from 'react';
import { cleanup, render } from '@testing-library/react';

import { user } from './fixtures';
import UserInfo from '../../../javascripts/profile/components/UserInfo';

describe('UserInfo', () => {
  afterEach(cleanup);

  it('renders the current user identity', () => {
    const { container } = render(<UserInfo user={user} />);
    expect(container.querySelector('.card')).not.to.equal(null);
    expect(container.querySelector('.username').textContent).to.contain(user.username);
    expect(container.querySelector('.email').textContent).to.contain(user.email);
  });
});
