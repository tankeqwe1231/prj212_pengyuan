import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import sinon from 'sinon';

import RunQueryActionButton from '../../../javascripts/SqlLab/components/RunQueryActionButton';

describe('RunQueryActionButton', () => {
  afterEach(cleanup);

  it('uses the same small Bootstrap size as the other query controls', () => {
    const runQuery = sinon.spy();
    render(
      <RunQueryActionButton
        allowAsync={false}
        dbId={1}
        runQuery={runQuery}
        stopQuery={() => {}}
        sql="SELECT 1"
      />,
    );

    const button = screen.getByRole('button');
    expect(button.classList.contains('btn-sm')).to.equal(true);
    expect(button.classList.contains('btn-small')).to.equal(false);
    fireEvent.click(button);
    expect(runQuery.calledOnceWithExactly(false)).to.equal(true);
  });
});
