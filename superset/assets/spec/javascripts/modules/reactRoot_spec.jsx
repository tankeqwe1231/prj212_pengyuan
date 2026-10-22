import React, { useLayoutEffect } from 'react';

import { renderReact, unmountReact } from '../../../javascripts/modules/reactRoot';

describe('renderReact', () => {
  let outerContainer;
  let nestedContainer;

  beforeEach(() => {
    outerContainer = document.createElement('div');
    nestedContainer = document.createElement('div');
    document.body.appendChild(outerContainer);
    document.body.appendChild(nestedContainer);
  });

  afterEach(() => {
    unmountReact(outerContainer);
    unmountReact(nestedContainer);
    outerContainer.remove();
    nestedContainer.remove();
  });

  it('commits Hook layout work before a synchronous entry render returns', () => {
    function HookEntry() {
      useLayoutEffect(() => {
        renderReact(<span data-testid="nested-root">ready</span>, nestedContainer);
      }, []);
      return <div data-testid="outer-root" />;
    }

    renderReact(<HookEntry />, outerContainer, { sync: true });

    expect(outerContainer.querySelector('[data-testid="outer-root"]')).not.to.equal(null);
    expect(nestedContainer.querySelector('[data-testid="nested-root"]')).not.to.equal(null);
  });
});
