/* eslint no-unused-vars: 0 */
import React from 'react';
import { renderReact } from '../modules/reactRoot';
import { initAxios } from '../modules/utils';

import HomePage from './components/HomePage';

initAxios();

const container = document.getElementById('row-main-container');
if (container) {
  renderReact(<HomePage />, container);
}
