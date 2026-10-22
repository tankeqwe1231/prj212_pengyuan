import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore } from 'redux';
import sinon from 'sinon';

import $ from 'jquery';
import { App } from '../../../javascripts/SqlLab/components/App';
import { sqlLabReducer } from '../../../javascripts/SqlLab/reducers';
import { initialState } from './fixtures';

describe('App', () => {
  let getStub;

  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    getStub = sinon.stub($, 'get').returns($.Deferred().promise());
  });

  afterEach(() => {
    cleanup();
    getStub.restore();
  });

  it('renders SQL Lab and its active query editor', () => {
    const store = createStore(
      sqlLabReducer,
      { ...initialState, flash_messages: [] },
    );

    const { container } = render(
      <Provider store={store}>
        <App actions={{}} initMessages={[]} />
      </Provider>,
    );

    expect(container.querySelector('.SqlLab')).not.to.equal(null);
    expect(screen.getByText('Untitled Query')).not.to.equal(null);
    expect(container.querySelector('.SqlEditor')).not.to.equal(null);
  });
});
