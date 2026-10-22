import React from 'react';
import { cleanup, render } from '@testing-library/react';

import SideBarCustom from '../../../javascripts/custom/components/SideBarCustom';

describe('SideBarCustom', () => {
  let originalResizeObserver;

  beforeEach(() => {
    originalResizeObserver = window.ResizeObserver;
    localStorage.removeItem('scrollTop');
    window.history.replaceState({}, '', '/superset/dashboard/1251/');
  });

  afterEach(() => {
    cleanup();
    window.ResizeObserver = originalResizeObserver;
    global.ResizeObserver = originalResizeObserver;
    document.body.innerHTML = '';
    window.history.replaceState({}, '', '/');
  });

  it('keeps the dashboard offset synchronized with the responsive header height', () => {
    let resizeCallback;
    let observerDisconnected = false;
    let headerHeight = 92;
    let rightNavbarTop = 32;

    class ResizeObserverMock {
      constructor(callback) {
        resizeCallback = callback;
      }

      observe() {}

      disconnect() {
        observerDisconnected = true;
      }
    }

    window.ResizeObserver = ResizeObserverMock;
    global.ResizeObserver = ResizeObserverMock;

    const header = document.createElement('header');
    header.className = 'top';
    Object.defineProperty(header, 'clientHeight', {
      configurable: true,
      get: () => headerHeight,
    });

    const clientNavbar = document.createElement('nav');
    clientNavbar.className = 'client-navbar';
    const navbarCollapse = document.createElement('div');
    navbarCollapse.className = 'navbar-collapse collapse';
    const customNavbar = document.createElement('div');
    customNavbar.id = 'navbar';
    customNavbar.getBoundingClientRect = () => ({ top: 0 });
    const rightNavbar = document.createElement('ul');
    rightNavbar.className = 'navbar-nav ms-auto';
    rightNavbar.getBoundingClientRect = () => ({ top: rightNavbarTop });

    navbarCollapse.appendChild(customNavbar);
    navbarCollapse.appendChild(rightNavbar);
    clientNavbar.appendChild(navbarCollapse);
    header.appendChild(clientNavbar);
    document.body.appendChild(header);

    const splitPaneContainer = document.createElement('div');
    splitPaneContainer.id = 'SplitPaneDom';
    document.body.appendChild(splitPaneContainer);

    const view = render(
      <SideBarCustom
        agree_flag
        isMobile={false}
        third_category={{ third_category_list_order: [] }}
      />,
    );

    expect(splitPaneContainer.style.paddingTop).to.equal('92px');
    expect(clientNavbar.classList.contains('navbar-actions-wrapped')).to.equal(true);

    headerHeight = 60;
    rightNavbarTop = 0;
    resizeCallback();

    expect(splitPaneContainer.style.paddingTop).to.equal('60px');
    expect(clientNavbar.classList.contains('navbar-actions-wrapped')).to.equal(false);

    view.unmount();
    expect(observerDisconnected).to.equal(true);
  });

  it('marks the current dashboard without updating state during render', () => {
    const { getByText } = render(
      <SideBarCustom
        agree_flag
        isMobile={false}
        third_category={{
          third_category_list_order: ['Market'],
          Market: {
            values: [['Current dashboard', '/superset/dashboard/1251/', 1]],
          },
        }}
      />,
    );

    expect(getByText('Market').className).to.contain('activate-third');
    expect(getByText('Current dashboard').className).to.contain('activate-dash');
  });

  it('removes the compact sidebar offset when the explore header wraps', () => {
    window.history.replaceState({}, '', '/superset/explore/');
    let resizeCallback;
    let headerHeight = 92;

    function ResizeObserverMock(callback) {
      resizeCallback = callback;
    }
    ResizeObserverMock.prototype.observe = () => {};
    ResizeObserverMock.prototype.disconnect = () => {};

    window.ResizeObserver = ResizeObserverMock;
    global.ResizeObserver = ResizeObserverMock;

    const header = document.createElement('header');
    header.className = 'top';
    Object.defineProperty(header, 'clientHeight', {
      configurable: true,
      get: () => headerHeight,
    });
    document.body.appendChild(header);

    const splitPaneContainer = document.createElement('div');
    splitPaneContainer.id = 'SplitPaneDom';
    const firstPane = document.createElement('div');
    firstPane.className = 'Pane Pane1';
    firstPane.style.marginTop = '-20px';
    splitPaneContainer.appendChild(firstPane);
    document.body.appendChild(splitPaneContainer);

    render(
      <SideBarCustom
        agree_flag
        isMobile={false}
        third_category={{ third_category_list_order: [] }}
      />,
    );

    expect(splitPaneContainer.style.paddingTop).to.equal('92px');
    expect(firstPane.style.marginTop).to.equal('');

    headerHeight = 60;
    resizeCallback();

    expect(splitPaneContainer.style.paddingTop).to.equal('');
    expect(firstPane.style.marginTop).to.equal('-20px');
  });
});
