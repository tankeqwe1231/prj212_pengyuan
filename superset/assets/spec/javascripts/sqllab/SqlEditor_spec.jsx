import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore } from 'redux';
import sinon from 'sinon';

import $ from 'jquery';
import { initialState, queries, table } from './fixtures';
import * as sqlLabActions from '../../../javascripts/SqlLab/actions';
import SqlEditor, { getEditorPaneHeight } from '../../../javascripts/SqlLab/components/SqlEditor';
import { sqlLabReducer } from '../../../javascripts/SqlLab/reducers';

describe('SqlEditor', () => {
  let getStub;

  beforeEach(() => {
    getStub = sinon.stub($, 'get').returns($.Deferred().promise());
  });

  afterEach(() => {
    cleanup();
    getStub.restore();
  });

  it('keeps enough room for the query results pane', () => {
    expect(getEditorPaneHeight(900, 500)).to.equal(335);
    expect(getEditorPaneHeight(50, 500)).to.equal(100);
    expect(getEditorPaneHeight(undefined, 500)).to.equal(200);
  });

  it('starts with the compact editor pane when an old height was persisted', () => {
    const actions = Object.keys(sqlLabActions).reduce((result, actionName) => ({
      ...result,
      [actionName]: sinon.spy(),
    }), {});
    const queryEditor = {
      ...initialState.queryEditors[0],
      height: 600,
    };
    const store = createStore(sqlLabReducer, initialState);

    render(
      <Provider store={store}>
        <SqlEditor
          actions={actions}
          database={{ allow_ctas: false, allow_run_async: false, allow_run_sync: true }}
          dataPreviewQueries={[]}
          editorQueries={[]}
          getHeight={() => '500px'}
          latestQuery={queries[0]}
          queryEditor={queryEditor}
          tables={[table]}
        />
      </Provider>,
    );

    expect(actions.persistEditorHeight.calledWith(queryEditor, 200)).to.equal(true);
  });

  it('renders the SQL editor, left toolbar, and query controls', () => {
    const actions = Object.keys(sqlLabActions).reduce((result, actionName) => ({
      ...result,
      [actionName]: sinon.spy(),
    }), {});
    const store = createStore(sqlLabReducer, initialState);
    const { container } = render(
      <Provider store={store}>
        <SqlEditor
          actions={actions}
          database={{ allow_ctas: false, allow_run_async: false, allow_run_sync: true }}
          dataPreviewQueries={[]}
          editorQueries={[]}
          getHeight={() => '500px'}
          latestQuery={queries[0]}
          queries={queries}
          queryEditor={initialState.queryEditors[0]}
          tables={[table]}
        />
      </Provider>,
    );

    expect(container.querySelector('.SqlEditor')).not.to.equal(null);
    expect(container.querySelector('.sql-toolbar')).not.to.equal(null);
    expect(container.querySelector('.ace_editor')).not.to.equal(null);
    expect(container.querySelector('.TableElement')).not.to.equal(null);
  });
});
