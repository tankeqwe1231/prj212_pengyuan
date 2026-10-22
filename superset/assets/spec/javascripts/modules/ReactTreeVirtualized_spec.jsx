import React from 'react';
import sinon from 'sinon';
import { cleanup, fireEvent, render } from '@testing-library/react';

import ReactTreeVirtualized from '../../../javascripts/modules/ReactTreeVirtualized';

const tree = {
  key: 'root',
  name: 'Root',
  children: [
    { key: 'alpha', name: 'Alpha' },
    { key: 'beta', name: 'Beta' },
  ],
};

describe('ReactTreeVirtualized', () => {
  afterEach(cleanup);

  it('expands the root and distinguishes leaf clicks from double-clicks', () => {
    const clock = sinon.useFakeTimers();
    const onNodeClick = sinon.spy();
    const onNodeDoubleClick = sinon.spy();
    const { getByText, unmount } = render(<ReactTreeVirtualized
      data={tree}
      height={120}
      toggled
      onNodeClick={onNodeClick}
      onNodeDoubleClick={onNodeDoubleClick}
    />);

    fireEvent.click(getByText('Alpha'));
    clock.tick(300);
    expect(onNodeClick.calledOnce).to.equal(true);

    fireEvent.click(getByText('Beta'));
    fireEvent.doubleClick(getByText('Beta'));
    clock.tick(300);
    expect(onNodeClick.calledOnce).to.equal(true);
    expect(onNodeDoubleClick.calledOnce).to.equal(true);

    unmount();
    clock.restore();
  });

  it('filters visible rows and closes the context menu on outside click', () => {
    const onDelete = sinon.spy();
    const { container, getByText, queryByText, rerender } = render(<ReactTreeVirtualized
      data={tree}
      height={120}
      toggled
      contextMenuItems={() => [{ label: 'Delete', onClick: onDelete }]}
    />);

    fireEvent.contextMenu(getByText('Alpha'), { clientX: 10, clientY: 20 });
    expect(getByText('Delete')).not.to.equal(null);
    fireEvent.mouseDown(document.body);
    expect(queryByText('Delete')).to.equal(null);

    rerender(<ReactTreeVirtualized data={tree} height={120} toggled searchText="beta" />);
    expect(container.textContent).to.contain('Beta');
    expect(container.textContent).not.to.contain('Alpha');
  });
});
