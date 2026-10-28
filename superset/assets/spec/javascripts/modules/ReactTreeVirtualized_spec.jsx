import React from 'react';
import sinon from 'sinon';
import { act, cleanup, fireEvent, render } from '@testing-library/react';

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

  it('keeps the wider context menu within the viewport and preserves item callbacks', () => {
    const originalRect = window.HTMLElement.prototype.getBoundingClientRect;
    const rectStub = sinon.stub(window.HTMLElement.prototype, 'getBoundingClientRect').callsFake(function () {
      if (this.classList.contains('tree-context-menu')) {
        return { width: 220, height: 126 };
      }
      return originalRect.call(this);
    });
    const onDelete = sinon.spy();
    const { baseElement, getByText, queryByText, unmount } = render(<ReactTreeVirtualized
      data={tree}
      height={120}
      toggled
      contextMenuItems={() => [{ label: 'Delete', icon: 'fa fa-trash-o', onClick: onDelete }]}
    />);
    try {
      fireEvent.contextMenu(getByText('Alpha'), { clientX: window.innerWidth - 2, clientY: window.innerHeight - 2 });
      let menu = baseElement.querySelector('.tree-context-menu');
      expect(parseFloat(menu.style.left)).to.equal(window.innerWidth - 220 - 8);
      expect(parseFloat(menu.style.top)).to.equal(window.innerHeight - 126 - 8);
      fireEvent.mouseDown(document.body);
      expect(queryByText('Delete')).to.equal(null);

      fireEvent.contextMenu(getByText('Alpha'), { clientX: 1, clientY: 1 });
      menu = baseElement.querySelector('.tree-context-menu');
      expect(menu.style.left).to.equal('8px');
      expect(menu.style.top).to.equal('8px');
      fireEvent.click(menu.querySelector('.fa-trash-o'));
      expect(onDelete.calledOnce).to.equal(true);
      expect(queryByText('Delete')).to.equal(null);
    } finally {
      unmount();
      rectStub.restore();
    }
  });

  it('renders the menu outside clipping and stacking ancestors and cleans it up', () => {
    const { container, baseElement, getByText, queryByText, unmount } = render(
      <div style={{ position: 'relative', zIndex: 0, overflow: 'hidden', height: 120 }}>
        <ReactTreeVirtualized
          data={tree}
          height={120}
          toggled
          contextMenuItems={() => [{ label: 'Modify', onClick: () => {} }]}
        />
      </div>,
    );
    fireEvent.contextMenu(getByText('Alpha'), { clientX: 280, clientY: 50 });
    const menu = baseElement.querySelector('.tree-context-menu');
    expect(menu.parentElement).to.equal(document.body);
    expect(container.querySelector('.tree-context-menu')).to.equal(null);
    expect(menu.style.position).to.equal('fixed');
    fireEvent.mouseDown(getByText('Modify'));
    expect(getByText('Modify')).not.to.equal(null);
    fireEvent.scroll(container.firstChild);
    expect(queryByText('Modify')).to.equal(null);
    fireEvent.contextMenu(getByText('Alpha'));
    expect(getByText('Modify')).not.to.equal(null);
    unmount();
    expect(baseElement.querySelector('.tree-context-menu')).to.equal(null);
  });

  const nestedTree = {
    key: 'root',
    name: 'Root',
    children: [
      { key: 'folder', name: 'Folder', children: [{ key: 'inner', name: 'Inner', searchText: 'Inner code-42' }] },
      { key: 'alpha', name: 'Alpha' },
    ],
  };
  const dataTransfer = () => ({ setData() {}, getData() { return ''; }, effectAllowed: '', dropEffect: '' });

  it('disables interaction, cancels pending clicks and keeps expansion on unlock', () => {
    const clock = sinon.useFakeTimers();
    const onNodeClick = sinon.spy();
    const onNodeDoubleClick = sinon.spy();
    const onNodeDrop = sinon.spy();
    const onMenuClick = sinon.spy();
    const props = {
      data: nestedTree, height: 160, toggled: true, onNodeClick, onNodeDoubleClick, onNodeDrop,
      canDragNode: () => true, canDropNode: () => true,
      contextMenuItems: () => [{ label: 'Modify', onClick: onMenuClick }],
    };
    const { getByText, queryByText, rerender, unmount } = render(<ReactTreeVirtualized {...props} />);
    try {
      fireEvent.click(getByText('Folder'));
      fireEvent.click(getByText('Alpha'));
      fireEvent.contextMenu(getByText('Alpha'));
      expect(getByText('Modify')).not.to.equal(null);
      fireEvent.dragStart(getByText('Alpha'), { dataTransfer: dataTransfer() });
      fireEvent.dragOver(getByText('Folder'), { dataTransfer: dataTransfer() });
      rerender(<ReactTreeVirtualized {...props} disabled />);
      expect(queryByText('Modify')).to.equal(null);
      expect(getByText('Alpha').closest('[draggable]').draggable).to.equal(false);
      fireEvent.click(getByText('Folder'));
      fireEvent.doubleClick(getByText('Alpha'));
      fireEvent.contextMenu(getByText('Alpha'));
      fireEvent.drop(getByText('Folder'), { dataTransfer: dataTransfer() });
      act(() => clock.tick(400));
      expect(getByText('Inner')).not.to.equal(null);
      expect(queryByText('Modify')).to.equal(null);
      expect(onNodeClick.called).to.equal(false);
      expect(onNodeDoubleClick.called).to.equal(false);
      expect(onNodeDrop.called).to.equal(false);
      expect(onMenuClick.called).to.equal(false);

      rerender(<ReactTreeVirtualized {...props} />);
      expect(getByText('Inner')).not.to.equal(null);
      expect(queryByText('Modify')).to.equal(null);
      fireEvent.drop(getByText('Folder'), { dataTransfer: dataTransfer() });
      expect(onNodeDrop.called).to.equal(false);
      fireEvent.click(getByText('Alpha'));
      act(() => clock.tick(300));
      expect(onNodeClick.calledOnce).to.equal(true);
      fireEvent.contextMenu(getByText('Alpha'));
      fireEvent.click(getByText('Modify'));
      expect(onMenuClick.calledOnce).to.equal(true);
    } finally {
      unmount();
      clock.restore();
    }
  });

  it('drops a dragged node onto an allowed target with the computed position', () => {
    const onNodeDrop = sinon.spy();
    const canDropNode = sinon.spy(() => true);
    const { getByText } = render(<ReactTreeVirtualized
      data={nestedTree}
      height={120}
      toggled
      canDragNode={node => !node.children}
      canDropNode={canDropNode}
      onNodeDrop={onNodeDrop}
    />);

    const alphaRow = getByText('Alpha').closest('[draggable]');
    expect(alphaRow.getAttribute('draggable')).to.equal('true');
    expect(getByText('Folder').closest('[draggable]').getAttribute('draggable')).to.equal('false');

    fireEvent.dragStart(alphaRow, { dataTransfer: dataTransfer() });
    fireEvent.dragOver(getByText('Folder'), { dataTransfer: dataTransfer() });
    fireEvent.drop(getByText('Folder'), { dataTransfer: dataTransfer() });

    expect(onNodeDrop.calledOnce).to.equal(true);
    const [dragNode, target, position] = onNodeDrop.firstCall.args;
    expect(dragNode.key).to.equal('alpha');
    expect(target.key).to.equal('folder');
    expect(position).to.equal('inside');
  });

  it('ignores drops rejected by canDropNode', () => {
    const onNodeDrop = sinon.spy();
    const { getByText } = render(<ReactTreeVirtualized
      data={nestedTree}
      height={120}
      toggled
      canDragNode={() => true}
      canDropNode={() => false}
      onNodeDrop={onNodeDrop}
    />);

    fireEvent.dragStart(getByText('Alpha'), { dataTransfer: dataTransfer() });
    fireEvent.dragOver(getByText('Folder'), { dataTransfer: dataTransfer() });
    fireEvent.drop(getByText('Folder'), { dataTransfer: dataTransfer() });
    expect(onNodeDrop.called).to.equal(false);
  });

  it('supports custom matching, controlled selection and revealing nested nodes', () => {
    const { container, getByText, queryByText, rerender } = render(<ReactTreeVirtualized
      data={nestedTree}
      height={120}
      toggled
      selectedKeys={['alpha']}
    />);
    expect(queryByText('Inner')).to.equal(null);

    rerender(<ReactTreeVirtualized data={nestedTree} height={120} toggled selectedKeys={['alpha']} revealNodeKey="inner" />);
    expect(getByText('Inner')).not.to.equal(null);

    rerender(<ReactTreeVirtualized
      data={nestedTree}
      height={120}
      toggled
      searchText="code-42"
      matchNode={(node, keywords) => keywords.every(word => String(node.searchText || node.name).includes(word))}
    />);
    expect(container.textContent).to.contain('Inner');
    expect(container.textContent).not.to.contain('Alpha');
  });
});
