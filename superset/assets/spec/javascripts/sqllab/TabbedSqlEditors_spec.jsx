import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore } from 'redux';
import sinon from 'sinon';

import $ from 'jquery';
import * as sqlLabActions from '../../../javascripts/SqlLab/actions';
import { sqlLabReducer } from '../../../javascripts/SqlLab/reducers';
import { initialState } from './fixtures';
import { TabbedSqlEditors } from '../../../javascripts/SqlLab/components/TabbedSqlEditors';

function createActions() {
  return Object.keys(sqlLabActions).reduce((result, actionName) => ({
    ...result,
    [actionName]: sinon.spy(),
  }), {});
}

function renderEditors(actions, props = {}) {
  const store = createStore(sqlLabReducer, initialState);
  return render(
    <Provider store={store}>
      <TabbedSqlEditors
        actions={actions}
        databases={{}}
        getHeight={() => '500px'}
        queries={{}}
        queryEditors={initialState.queryEditors}
        tabHistory={initialState.tabHistory}
        tables={[]}
        {...props}
      />
    </Provider>,
  );
}

describe('TabbedSqlEditors', () => {
  let getStub;

  beforeEach(() => {
    window.history.replaceState({}, '', '/superset/sqllab');
    getStub = sinon.stub($, 'get').returns($.Deferred().promise());
  });

  afterEach(() => {
    cleanup();
    getStub.restore();
    delete global.prompt;
  });

  it('renders the active editor and creates a new tab from the plus control', () => {
    const actions = createActions();
    const { container } = renderEditors(actions);

    expect(screen.getByText('Untitled Query')).not.to.equal(null);
    expect(container.querySelector('.SqlEditor')).not.to.equal(null);
    expect(container.querySelector('.query-tab-dropdown-toggle')).not.to.equal(null);
    expect(container.querySelector('.query-tab-dropdown-toggle').classList.contains('btn')).to.equal(false);
    fireEvent.click(container.querySelector('.fa-plus-circle').closest('[role="tab"]'));

    expect(actions.addQueryEditor.calledOnce).to.equal(true);
    expect(actions.addQueryEditor.firstCall.args[0].title).to.be.a('string').and.not.equal('');
  });

  it('renames and closes an editor from its tab menu', () => {
    const actions = createActions();
    const queryEditor = initialState.queryEditors[0];
    const { container } = renderEditors(actions);
    global.prompt = sinon.stub().returns('Renamed query');

    fireEvent.click(container.querySelector('.dropdown-toggle'));
    const menuItems = container.querySelectorAll('.dropdown-menu .dropdown-item');
    fireEvent.click(menuItems[1]);
    fireEvent.click(menuItems[0]);

    expect(actions.queryEditorSetTitle.calledWith(queryEditor, 'Renamed query')).to.equal(true);
    expect(actions.removeQueryEditor.calledWith(queryEditor)).to.equal(true);
  });

  it('opens SQL supplied in the URL and then cleans the browser address', () => {
    const actions = createActions();
    window.history.replaceState(
      {},
      '',
      '/superset/sqllab?sql=SELECT%201&dbid=1&title=Shared',
    );

    renderEditors(actions, { queryEditors: [], tabHistory: [] });

    expect(actions.addQueryEditor.calledOnce).to.equal(true);
    expect(actions.addQueryEditor.firstCall.args[0]).to.include({
      dbId: 1,
      sql: 'SELECT 1',
      title: 'Shared',
    });
    expect(window.location.pathname).to.equal('/superset/sqllab');
    expect(window.location.search).to.equal('');
  });
});
