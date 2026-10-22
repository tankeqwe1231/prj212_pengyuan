import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';

import Tree from '../../../javascripts/components/Tree';

describe('Tree', () => {
  afterEach(cleanup);

  it('uses compact node text and omits the leaf circle icon', () => {
    const { container } = render(<Tree
      data={{
        name: 'Parent',
        toggled: true,
        children: [{ name: 'Leaf' }],
      }}
      onToggle={() => {}}
    />);
    const leaf = screen.getByRole('treeitem', { name: 'Leaf' });
    expect(leaf.style.fontSize).to.equal('14px');
    expect(leaf.style.lineHeight).to.equal('20px');
    expect(container.querySelector('.fa-circle-o')).to.equal(null);
    expect(container.querySelector('.fa-caret-down')).not.to.equal(null);
  });
});
