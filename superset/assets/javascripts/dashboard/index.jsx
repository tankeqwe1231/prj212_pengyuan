import React from 'react';
import { Provider } from 'react-redux';

import { createAppStore } from '../reduxUtils';
import { appSetup } from '../common';
import { initJQueryAjax } from '../modules/utils';
import { renderReact } from '../modules/reactRoot';
import DashboardContainer from './components/DashboardContainer';
import rootReducer, { getInitialState } from './reducers';

appSetup();
initJQueryAjax();

const appContainer = document.getElementById('app');

if (appContainer) {
    const bootstrapData = JSON.parse(appContainer.getAttribute('data-bootstrap'));
    const initState = Object.assign({}, getInitialState(bootstrapData));
    const store = createAppStore({ reducer: rootReducer, preloadedState: initState });

    renderReact(
      <Provider store={store}>
        <DashboardContainer />
      </Provider>,
      appContainer,
    );
}

