import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore } from 'redux';
import sinon from 'sinon';

import * as dashboardActions from '../../../javascripts/dashboard/actions';
import * as chartActions from '../../../javascripts/chart/chartAction';
import Dashboard from '../../../javascripts/dashboard/components/Dashboard';
import {
  resumeDashboardResize,
  suppressDashboardResize,
} from '../../../javascripts/dashboard/resizeUtils';
import { dashboard, charts } from './fixtures';

function createActions() {
  return Object.keys({ ...chartActions, ...dashboardActions })
    .reduce((result, actionName) => ({
      ...result,
      [actionName]: sinon.spy(),
    }), {});
}

function dashboardElement(store, actions, props = {}) {
  return (
    <Provider store={store}>
      <Dashboard
        actions={actions}
        dashboard={dashboard.dashboard}
        datasources={dashboard.datasources}
        filters={dashboard.filters}
        initMessages={[]}
        isStarred={false}
        refresh={false}
        slices={charts}
        timeout={60}
        userId={dashboard.userId}
        {...props}
      />
    </Provider>
  );
}

function renderDashboard(element) {
  try {
    return render(element);
  } catch (error) {
    if (error.errors && error.errors.length) throw error.errors[0];
    throw error;
  }
}

function createDashboardStore() {
  const mountedCharts = Object.keys(charts).reduce((result, chartKey) => ({
    ...result,
    [chartKey]: { ...charts[chartKey], triggerQuery: false },
  }), {});
  return createStore(state => state, { charts: mountedCharts });
}

describe('Dashboard', () => {
  afterEach(() => {
    cleanup();
    resumeDashboardResize();
  });

  it('renders every configured dashboard slice', () => {
    const actions = createActions();
    const store = createDashboardStore();
    const { container } = renderDashboard(dashboardElement(store, actions));

    expect(container.querySelector('#dashboard-container')).not.to.equal(null);
    expect(container.querySelectorAll('[data-slice-id]')).to.have.length(3);
    expect(container.querySelector('#cell-248')).not.to.equal(null);
  });

  it('keeps the page scrollbar stable while the dashboard is mounted', () => {
    const actions = createActions();
    const store = createDashboardStore();

    const { unmount } = renderDashboard(dashboardElement(store, actions));

    expect(document.documentElement.classList.contains('dashboard-page')).to.equal(true);
    unmount();
    expect(document.documentElement.classList.contains('dashboard-page')).to.equal(false);
  });

  it('does not rerender slices for a resize caused by modal scroll locking', () => {
    const actions = createActions();
    const store = createDashboardStore();
    const clock = sinon.useFakeTimers();

    try {
      renderDashboard(dashboardElement(store, actions));
      act(() => {
        window.dispatchEvent(new window.Event('resize'));
        clock.tick(50);
      });

      expect(actions.renderTriggered.called).to.equal(false);
    } finally {
      clock.restore();
    }
  });

  it('does not rerender slices while the slice adder modal is closing', () => {
    const actions = createActions();
    const store = createDashboardStore();
    const clock = sinon.useFakeTimers();
    const innerWidthDescriptor = Object.getOwnPropertyDescriptor(window, 'innerWidth');

    try {
      renderDashboard(dashboardElement(store, actions));
      suppressDashboardResize();
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: window.innerWidth + 20,
      });

      act(() => {
        window.dispatchEvent(new window.Event('resize'));
        clock.tick(50);
      });
      expect(actions.renderTriggered.called).to.equal(false);

      resumeDashboardResize();
      act(() => {
        window.dispatchEvent(new window.Event('resize'));
        clock.tick(50);
      });
      expect(actions.renderTriggered.callCount).to.equal(Object.keys(charts).length);
    } finally {
      if (innerWidthDescriptor) {
        Object.defineProperty(window, 'innerWidth', innerWidthDescriptor);
      }
      clock.restore();
    }
  });

  it('refreshes only affected slices after a dashboard filter changes', () => {
    const actions = createActions();
    const store = createDashboardStore();
    const { rerender } = renderDashboard(dashboardElement(store, actions));

    rerender(dashboardElement(store, actions, {
      filters: {
        256: { region: [] },
        257: { country_name: ['France'] },
      },
      refresh: true,
    }));

    expect(actions.runQuery.calledOnce).to.equal(true);
    const formData = actions.runQuery.firstCall.args[0];
    expect(formData.extra_filters).to.deep.include({
      col: 'country_name',
      op: 'in',
      val: ['France'],
    });
  });

  it('refreshes chart metadata using only contextual dashboard filters', () => {
    const actions = createActions();
    const store = createDashboardStore();
    const { container } = renderDashboard(dashboardElement(store, actions));

    fireEvent.click(container.querySelector('#cell-248 .refresh'));

    expect(actions.refreshSlice.calledOnce).to.equal(true);
    const refreshFormData = actions.refreshSlice.firstCall.args[1];
    expect(refreshFormData).not.to.have.property('filters');
    expect(refreshFormData.extra_filters).to.deep.include({
      col: 'country_name',
      op: 'in',
      val: ['United States'],
    });
  });
});
