/* eslint no-unused-vars: 0 */
import React from 'react';
import { renderReact } from '../modules/reactRoot';
import { initAxios } from '../modules/utils';
import ReportsDataManage from './components/ReportsDataManage';
import ReportsDataShow from './components/ReportsDataShow';

initAxios();

const container = document.getElementById('row-main-container');

const pageName = container.getAttribute('page-name');
switch (pageName) {
  case 'reportsDataManage':
    renderReact(<ReportsDataManage />, container);
    break;
  case 'reportsDataShow':
    renderReact(<ReportsDataShow />, container);
    break;
}
