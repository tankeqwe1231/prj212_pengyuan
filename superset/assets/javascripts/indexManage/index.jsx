/* eslint no-unused-vars: 0 */
import React from 'react';
import { renderReact } from '../modules/reactRoot';
import { initJQueryAjax } from '../modules/utils';
import { appSetup } from '../common';
import IndexManageMain from './components/IndexManageMain';

appSetup();
initJQueryAjax();

const container = document.getElementById('ag_grid_container');
if (container) {
  renderReact(<IndexManageMain />, container);
}
