import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

const roots = new WeakMap();

export function renderReact(element, container, options = {}) {
  if (!container) {
    return null;
  }

  let root = roots.get(container);
  if (!root) {
    root = createRoot(container);
    roots.set(container, root);
  }

  if (options.sync) {
    flushSync(() => root.render(element));
  } else {
    root.render(element);
  }
  return root;
}

export function unmountReact(container) {
  const root = container && roots.get(container);
  if (root) {
    root.unmount();
    roots.delete(container);
  }
}
