import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import sinon from 'sinon';

import RunQueryActionButton from '../../../../javascripts/SqlLab/components/RunQueryActionButton';
import { t } from '../../../../javascripts/locales';

describe('RunQueryActionButton', () => {
  afterEach(cleanup);

  it('runs a synchronous query', () => {
    const runQuery = sinon.spy();
    render(
      <RunQueryActionButton
        allowAsync={false}
        dbId={1}
        queryState="success"
        runQuery={runQuery}
        selectedText={null}
        stopQuery={() => {}}
        sql="select 1"
      />,
    );

    fireEvent.click(screen.getByText(t('Run Query')));
    expect(runQuery.calledOnceWithExactly(false)).to.equal(true);
  });

  it('replaces the run action with stop while a query is active', () => {
    const stopQuery = sinon.spy();
    render(
      <RunQueryActionButton
        allowAsync
        dbId={1}
        queryState="running"
        runQuery={() => {}}
        stopQuery={stopQuery}
        sql="select 1"
      />,
    );
    fireEvent.click(screen.getByText(t('Stop')));
    expect(stopQuery.calledOnce).to.equal(true);
  });
});
