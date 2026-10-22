import React from 'react';

import SearchGlobal from '../custom/components/SearchGlobal';
import PopoverMonitor from '../custom/components/PopoverMonitor';
import { renderReact } from './reactRoot';

function ensureNotifyFallback() {
  if (!window.notify) {
    window.notify = {
      error() {},
      info() {},
      show() {},
      success() {},
    };
  }
}

export default function mountStandardNavbarControls() {
  // Client pages mount the navbar controls through custom.js together with
  // the category sidebar. The standard Superset and FAB shells only expose
  // the two containers and share this small mounting helper.
  if (document.getElementById('navbar')) return;

  ensureNotifyFallback();
  const searchContainer = document.getElementById('search-slices');
  const monitorContainer = document.getElementById('myMonitors');

  if (searchContainer && searchContainer.dataset.reactMounted !== 'true') {
    renderReact(<SearchGlobal />, searchContainer, { sync: true });
    searchContainer.dataset.reactMounted = 'true';
  }
  if (monitorContainer && monitorContainer.dataset.reactMounted !== 'true') {
    renderReact(<PopoverMonitor />, monitorContainer, { sync: true });
    monitorContainer.dataset.reactMounted = 'true';
  }
}
