/* eslint no-unused-vars: 0 */
import React from 'react';
import { renderReact } from '../modules/reactRoot';

import App from './components/App';
import { appSetup } from '../common';
import { initJQueryAjax } from '../modules/utils';

import './main.css';

appSetup();
initJQueryAjax();

const profileViewContainer = document.getElementById('app');
const bootstrap = JSON.parse(profileViewContainer.getAttribute('data-bootstrap'));

const user = bootstrap.user;
renderReact(
  <App user={user} />,
  profileViewContainer,
);
