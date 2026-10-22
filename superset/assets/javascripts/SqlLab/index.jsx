import React from 'react';
import { Provider } from 'react-redux';

import { getInitialState, sqlLabReducer } from './reducers';
import { createAppStore } from '../reduxUtils';
import { initJQueryAjax } from '../modules/utils';
import { renderReact } from '../modules/reactRoot';
import App from './components/App';
import { appSetup } from '../common';

import './main.less';
import '../components/FilterableTable/FilterableTableStyles.css';

appSetup();
initJQueryAjax();

const appContainer = document.getElementById('app');
const bootstrapData = JSON.parse(appContainer.getAttribute('data-bootstrap'));
const state = Object.assign({}, getInitialState(bootstrapData.defaultDbId), bootstrapData);

const store = createAppStore({ reducer: sqlLabReducer, preloadedState: state, persist: true });

// jquery hack to highlight the navbar menu
$('a:contains("SQL Lab")').parent().addClass('active');

renderReact(
  <Provider store={store}>
    <App />
  </Provider>,
  appContainer,
);
