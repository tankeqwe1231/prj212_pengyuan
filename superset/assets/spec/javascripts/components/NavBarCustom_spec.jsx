import React from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';

import NavBarCustom from '../../../javascripts/custom/components/NavBarCustom';
import { unmountReact } from '../../../javascripts/modules/reactRoot';

function mountNavBarWithSplitPane() {
  const navbar = document.createElement('nav');
  navbar.className = 'client-navbar';
  const navbarCollapse = document.createElement('div');
  navbarCollapse.className = 'navbar-collapse collapse';
  Object.defineProperty(navbarCollapse, 'clientHeight', { value: 60 });

  const navContainer = document.createElement('div');
  navContainer.id = 'navbar';
  navContainer.setAttribute('current_top_category', 'Top');
  navContainer.setAttribute('current_sub_category', 'Sub');
  navContainer.setAttribute('top_category_lst', 'Top');
  navContainer.setAttribute('second_category_list_order', '{}');
  navContainer.setAttribute('data-js', JSON.stringify({
    Top: {
      Sub: {
        third_category_list_order: [],
      },
    },
  }));
  navbarCollapse.appendChild(navContainer);
  navbar.appendChild(navbarCollapse);
  document.body.appendChild(navbar);

  const splitPaneContainer = document.createElement('div');
  splitPaneContainer.id = 'SplitPaneDom';
  document.body.appendChild(splitPaneContainer);

  render(
    <NavBarCustom
      agree_flag
      bootstrapData={null}
      container={navContainer}
      isMac={false}
      isMobile={false}
      MonitorsContainer={null}
      onscrollFunc={() => {}}
      SplitPaneDom={splitPaneContainer}
      urlStr={window.location.href}
    />,
  );

  return splitPaneContainer;
}

describe('NavBarCustom', () => {
  let splitPaneContainer;

  beforeEach(() => {
    window.history.replaceState({}, '', '/superset/dashboard/945/');
    localStorage.removeItem('FengYunSplitPos');
    localStorage.removeItem('scrollTop');
  });

  afterEach(() => {
    unmountReact(splitPaneContainer);
    cleanup();
    document.body.innerHTML = '';
    window.history.replaceState({}, '', '/');
  });

  it('applies the compact dashboard layout without querying an uncommitted pane', async () => {
    localStorage.setItem('FengYunSplitPos', '320');
    splitPaneContainer = mountNavBarWithSplitPane();

    expect(splitPaneContainer.style.paddingTop).to.equal('60px');
    await waitFor(() => {
      expect(document.querySelector('[data-bs-toggle="dropdown"]')).not.to.equal(null);
    });
    expect(document.querySelector('[data-toggle="dropdown"]')).to.equal(null);
    await waitFor(() => {
      const firstPane = splitPaneContainer.querySelector('.Pane1');
      const sidebar = splitPaneContainer.querySelector('#sidebar');
      expect(firstPane).not.to.equal(null);
      expect(firstPane.style.marginTop).to.equal('');
      expect(sidebar.style.width).to.equal('320px');
    });
  });

  it('widens the sidebar scrollbar only when the pointer is near the right edge', async () => {
    localStorage.setItem('FengYunSplitPos', '320');
    splitPaneContainer = mountNavBarWithSplitPane();

    let sidebar;
    await waitFor(() => {
      sidebar = splitPaneContainer.querySelector('#sidebar');
      expect(sidebar).not.to.equal(null);
    });

    sidebar.getBoundingClientRect = () => ({
      left: 0,
      right: 320,
      top: 0,
      bottom: 600,
      width: 320,
      height: 600,
    });

    fireEvent.mouseMove(sidebar, { clientX: 100, clientY: 100 });
    expect(sidebar.classList.contains('sidebar-scrollbar-wide')).to.equal(false);

    fireEvent.mouseMove(sidebar, { clientX: 315, clientY: 100 });
    expect(sidebar.classList.contains('sidebar-scrollbar-wide')).to.equal(true);

    fireEvent.mouseLeave(sidebar);
    expect(sidebar.classList.contains('sidebar-scrollbar-wide')).to.equal(false);
  });
});
