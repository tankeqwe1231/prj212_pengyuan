import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import sinon from 'sinon';

import ResultSet from '../../../javascripts/SqlLab/components/ResultSet';
import { queries, stoppedQuery, runningQuery } from './fixtures';
import { t } from '../../../javascripts/locales';

function actions() {
  return {
    clearQueryResults: sinon.spy(),
    fetchQueryResults: sinon.spy(),
    reFetchQueryResults: sinon.spy(),
  };
}

describe('ResultSet', () => {
  afterEach(cleanup);

  it('renders successful results and filters them', () => {
    const { container } = render(<ResultSet actions={actions()} height={300} query={queries[0]} />);
    expect(container.querySelectorAll('tbody tr')).to.have.length(2);
    fireEvent.change(screen.getByPlaceholderText(t('Search Results')), { target: { value: '3' } });
    expect(container.querySelectorAll('tbody tr')).to.have.length(1);
    expect(screen.getByText(t('Visualize'))).not.to.equal(null);
  });

  it('renders empty, stopped, and running states', () => {
    const emptyQuery = { ...queries[0], results: { ...queries[0].results, data: [] } };
    const { container, rerender } = render(
      <ResultSet actions={actions()} height={300} query={emptyQuery} />,
    );
    expect(screen.getByText('The query returned no data')).not.to.equal(null);

    rerender(<ResultSet actions={actions()} height={300} query={stoppedQuery} />);
    expect(screen.getByText('Query was stopped')).not.to.equal(null);

    rerender(<ResultSet actions={actions()} height={300} query={runningQuery} />);
    expect(container.querySelector('.progress-bar')).not.to.equal(null);
  });

  it('fetches and caches a newly supplied result set', () => {
    const resultActions = actions();
    const first = { ...queries[0], cached: true };
    const { rerender } = render(
      <ResultSet actions={resultActions} cache height={300} query={first} />,
    );
    const next = {
      ...queries[0],
      cached: false,
      resultsKey: 'new-key',
      results: { ...queries[0].results, data: [{ col1: 'new', col2: 'data' }] },
    };
    rerender(<ResultSet actions={resultActions} cache height={300} query={next} />);
    expect(resultActions.clearQueryResults.calledOnceWithExactly(next)).to.equal(true);
    expect(resultActions.fetchQueryResults.calledOnceWithExactly(next)).to.equal(true);
    expect(document.querySelectorAll('tbody tr')).to.have.length(1);
  });
});
