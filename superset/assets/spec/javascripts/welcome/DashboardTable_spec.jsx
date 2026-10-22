/* eslint-disable no-unused-expressions */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import sinon from 'sinon';

import DashboardTable from '../../../javascripts/welcome/DashboardTable';

const $ = window.$ = require('jquery');

describe('DashboardTable', () => {
  let getJSONStub;
  beforeEach(() => { getJSONStub = sinon.stub($, 'getJSON'); });
  afterEach(() => { cleanup(); getJSONStub.restore(); });

  it('requests dashboards and shows a loading state', () => {
    const { container } = render(<DashboardTable />);
    expect(getJSONStub.calledOnce).to.be.true;
    expect(getJSONStub.firstCall.args[0]).to.contain('/dashboardmodelviewasync/api/read');
    expect(container.querySelector('img.loading')).to.exist;
  });

  it('sanitizes legacy HTML and sorts category fields by their real values', () => {
    getJSONStub.callsFake((url, callback) => {
      callback({
        result: [{
          changed_by_name: 'Zulu',
          changed_on: '2026-08-12',
          creator: '<a class="creator" href="javascript:bad()" onclick="bad()"><img src=x>Zulu</a><a class="profile" href="/users/2">Profile</a>',
          dashboard_priority: 1,
          dashboard_title: 'Zulu dashboard',
          id: 2,
          modified: '<span class="date" style="color:red">Today</span><script>bad()</script>',
          sub_category: 'S2',
          sub_sub_category: 'SS2',
          sub_sub_category_priority: 2,
          top_category: 'Zulu category',
          url: '/dashboard/2',
        }, {
          changed_by_name: 'Alpha',
          changed_on: '2026-08-11',
          creator: '<a href="/users/1">Alpha</a>',
          dashboard_priority: 2,
          dashboard_title: 'Alpha dashboard',
          id: 1,
          modified: '<span>Yesterday</span>',
          sub_category: 'S1',
          sub_sub_category: 'SS1',
          sub_sub_category_priority: 1,
          top_category: 'Alpha category',
          url: '/dashboard/1',
        }],
      });
      return { abort() {} };
    });

    const { container } = render(<DashboardTable />);
    expect(container.querySelector('script')).not.to.exist;
    expect(container.querySelector('img')).not.to.exist;
    expect(container.querySelector('[onclick]')).not.to.exist;
    expect(container.querySelector('[style]')).not.to.exist;
    expect(container.querySelector('a.creator').hasAttribute('href')).to.equal(false);
    expect(container.querySelector('a.profile').getAttribute('href')).to.equal('/users/2');

    fireEvent.click(screen.getByRole('button', { name: 'Top Category' }));
    const dashboardLinks = Array.from(container.querySelectorAll('tbody tr td:first-child a'));
    expect(dashboardLinks.map(link => link.textContent)).to.deep.equal([
      'Alpha dashboard', 'Zulu dashboard',
    ]);
  });
});
