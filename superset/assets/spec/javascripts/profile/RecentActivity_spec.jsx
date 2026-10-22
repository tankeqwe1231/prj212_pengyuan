/* eslint-disable no-unused-expressions */
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import sinon from 'sinon';

import { user } from './fixtures';
import RecentActivity from '../../../javascripts/profile/components/RecentActivity';

const $ = window.$ = require('jquery');

describe('RecentActivity', () => {
  let getStub;
  beforeEach(() => { getStub = sinon.stub($, 'get'); });
  afterEach(() => { cleanup(); getStub.restore(); });

  it('loads recent activity for the current user', () => {
    const { container } = render(<RecentActivity user={user} />);
    expect(getStub.calledWith(`/superset/recent_activity/${user.userId}/?limit=50`)).to.be.true;
    expect(container.querySelector('img[alt="loading"]')).to.exist;
  });
});
