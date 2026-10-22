import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import sinon from 'sinon';

import SplitPane from '../../../javascripts/components/SplitPane';

describe('SplitPane', () => {
  afterEach(cleanup);

  it('renders both panes with a vertical separator and panel styles', () => {
    const { container } = render(
      <SplitPane
        defaultSize="12vw"
        pane1Style={{ marginTop: 0 }}
        pane2Style={{ minWidth: 0 }}
        split="vertical"
      >
        <div>Navigation</div>
        <div>Content</div>
      </SplitPane>,
    );

    const group = container.querySelector('.SplitPane.vertical');
    const separator = container.querySelector('[role="separator"]');
    expect(group).not.to.equal(null);
    expect(group.getAttribute('data-group')).not.to.equal(null);
    expect(group.style.flexDirection).to.equal('row');
    expect(separator.getAttribute('aria-orientation')).to.equal('vertical');
    expect(container.querySelector('.Pane1').style.marginTop).to.equal('0px');
    expect(container.querySelector('.Pane2').textContent).to.equal('Content');
  });

  it('publishes drag start only when resizing is enabled', () => {
    const enabledDragStarted = sinon.spy();
    const disabledDragStarted = sinon.spy();
    const { container } = render(
      <SplitPane
        defaultSize="25%"
        onDragStarted={enabledDragStarted}
      >
        <div>First</div>
        <div>Second</div>
      </SplitPane>,
    );
    fireEvent.mouseDown(container.querySelector('[role="separator"]'));
    expect(enabledDragStarted.calledOnce).to.equal(true);

    cleanup();
    const disabledView = render(
      <SplitPane allowResize={false} onDragStarted={disabledDragStarted}>
        <div>First</div>
        <div>Second</div>
      </SplitPane>,
    );
    const disabledSeparator = disabledView.container.querySelector('[role="separator"]');
    fireEvent.mouseDown(disabledSeparator);
    expect(disabledSeparator.getAttribute('aria-disabled')).to.equal('true');
    expect(disabledDragStarted.called).to.equal(false);
  });
});
