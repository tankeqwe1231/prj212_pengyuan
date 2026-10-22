/* eslint-disable no-unused-expressions */
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import sinon from 'sinon';

import { user } from './fixtures';
import Favorites from '../../../javascripts/profile/components/Favorites';

const $ = window.$ = require('jquery');

describe('Favorites', () => {
  let getStub;
  beforeEach(() => { getStub = sinon.stub($, 'get'); });
  afterEach(() => { cleanup(); getStub.restore(); });

  it('loads favorite dashboards and charts', () => {
    const { container } = render(<Favorites user={user} />);
    expect(getStub.calledWith(`/superset/fave_dashboards/${user.userId}/`)).to.be.true;
    expect(getStub.calledWith(`/superset/fave_slices/${user.userId}/`)).to.be.true;
    expect(container.querySelectorAll('h3')).to.have.length(2);
    expect(container.querySelectorAll('img[alt="loading"]')).to.have.length(2);
  });
});
