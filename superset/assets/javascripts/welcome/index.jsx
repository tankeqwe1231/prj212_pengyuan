/* eslint no-unused-vars: 0 */
import React from 'react';
import { renderReact } from '../modules/reactRoot';
import { appSetup } from '../common';
import App from './App';

appSetup();

const container = document.getElementById('app');
const bootstrap = JSON.parse(container.getAttribute('data-bootstrap'));
const user = {
  ...bootstrap.user,
};

renderReact(
  <App
    user={user}
  />,
  container,
);
