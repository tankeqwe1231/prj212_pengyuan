/* eslint no-unused-vars: 0 */
import React from 'react';
import { renderReact } from '../modules/reactRoot';
import { initJQueryAjax } from '../modules/utils';
import { appSetup } from '../common';
import IndexDataManageMain from './components/IndexDataManageMain';

appSetup();
initJQueryAjax();

const container = document.getElementById('main_contain');
if (container) {
  renderReact(<IndexDataManageMain />, container);
}
