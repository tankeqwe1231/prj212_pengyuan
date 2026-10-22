import React from 'react';
import { cleanup, render } from '@testing-library/react';
import $ from 'jquery';
import sinon from 'sinon';

import { QueryAutoRefresh } from '../../../javascripts/SqlLab/components/QueryAutoRefresh';

describe('QueryAutoRefresh', () => {
  let clock;
  let getJsonStub;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
    getJsonStub = sinon.stub($, 'getJSON');
  });

  afterEach(() => {
    cleanup();
    getJsonStub.restore();
    clock.restore();
  });

  it('stops persisted in-progress queries without polling them', () => {
    const persistedQuery = { id: 'persisted-query', state: 'running' };
    const actions = {
      refreshQueries: sinon.spy(),
      stopQuery: sinon.spy(),
    };

    render(
      <QueryAutoRefresh
        actions={actions}
        queries={{ [persistedQuery.id]: persistedQuery }}
        queriesLastUpdate={10000}
      />,
    );
    clock.tick(4000);

    expect(actions.stopQuery.calledOnceWithExactly(persistedQuery)).to.equal(true);
    expect(getJsonStub.notCalled).to.equal(true);
  });

  it('polls for a query started after the component mounts', () => {
    const actions = {
      refreshQueries: sinon.spy(),
      stopQuery: sinon.spy(),
    };
    const { rerender } = render(
      <QueryAutoRefresh
        actions={actions}
        queries={{}}
        queriesLastUpdate={10000}
      />,
    );
    rerender(
      <QueryAutoRefresh
        actions={actions}
        queries={{ current: { id: 'current', state: 'running' } }}
        queriesLastUpdate={10000}
      />,
    );
    clock.tick(2000);

    expect(actions.stopQuery.notCalled).to.equal(true);
    expect(getJsonStub.calledOnce).to.equal(true);
    expect(getJsonStub.firstCall.args[0]).to.equal('/superset/queries/5000');
  });
});
