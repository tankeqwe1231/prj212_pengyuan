/* eslint-disable no-unused-expressions */
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import sinon from 'sinon';

import { user } from './fixtures';
import CreatedContent from '../../../javascripts/profile/components/CreatedContent';

const $ = window.$ = require('jquery');

describe('CreatedContent', () => {
  let getStub;
  beforeEach(() => { getStub = sinon.stub($, 'get'); });
  afterEach(() => { cleanup(); getStub.restore(); });

  it('loads dashboards and charts created by the user', () => {
    const { container } = render(<CreatedContent user={user} />);
    expect(getStub.calledWith(`/superset/created_dashboards/${user.userId}/`)).to.be.true;
    expect(getStub.calledWith(`/superset/created_slices/${user.userId}/`)).to.be.true;
    expect(container.querySelectorAll('h3')).to.have.length(2);
  });
});
