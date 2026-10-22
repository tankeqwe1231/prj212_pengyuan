import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import sinon from 'sinon';

import Timer from '../../../javascripts/components/Timer';
import { now } from '../../../javascripts/modules/dates';

describe('Timer', () => {
  let clock;
  beforeEach(() => { clock = sinon.useFakeTimers(); });
  afterEach(() => { cleanup(); clock.restore(); });

  it('updates while running and clears its interval on unmount', () => {
    const clearSpy = sinon.spy(global, 'clearInterval');
    const { container, unmount } = render(
      <Timer endTime={null} isRunning startTime={now() - 1000} status="warning" />,
    );
    expect(container.querySelector('.badge.bg-warning').textContent).to.equal('');
    act(() => clock.tick(31));
    expect(container.querySelector('.badge.bg-warning').textContent).not.to.equal('');
    unmount();
    expect(clearSpy.called).to.equal(true);
    clearSpy.restore();
  });
});
