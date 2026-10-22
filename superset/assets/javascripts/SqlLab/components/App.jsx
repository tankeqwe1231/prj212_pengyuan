import React, { useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import TabbedSqlEditors from './TabbedSqlEditors';
import QueryAutoRefresh from './QueryAutoRefresh';
import QuerySearch from './QuerySearch';
import AlertsWrapper from '../../components/AlertsWrapper';
import * as Actions from '../actions';

const $ = window.$ = require('jquery');

function App(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(App.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = App.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    hash: window.location.hash,
    contentHeight: '0px'
  }));
  const stateRef = useRef(state);
  stateRef.current = state;
  const updateState = (update, callback) => {
    const previous = stateRef.current;
    const partial = typeof update === 'function' ? update(previous, propsRef.current) : update;
    if (partial == null) return;
    const next = {
      ...previous,
      ...partial
    };
    stateRef.current = next;
    setState(next);
    if (typeof callback === 'function') callback();
  };
  function onHashChanged() {
    updateState({
      hash: window.location.hash
    });
  }
  function getHeight() {
    const warningEl = $('#navbar-warning');
    const tabsEl = $('.nav-tabs');
    const searchHeaderEl = $('#search-header');
    const alertEl = $('#sqllab-alerts');
    const headerEl = $('header .navbar');
    const height = element => element.outerHeight() || 0;
    const marginBottom = element => parseInt(element.css('marginBottom'), 10) || 0;
    const headerHeight = height(headerEl) + marginBottom(headerEl);
    const searchHeaderHeight = searchHeaderEl.length > 0 ? height(searchHeaderEl) + marginBottom(searchHeaderEl) : 0;
    const tabsHeight = tabsEl.length > 0 ? height(tabsEl) : searchHeaderHeight;
    const warningHeight = warningEl.length > 0 ? height(warningEl) : 0;
    const alertHeight = alertEl.length > 0 ? height(alertEl) : 0;
    return `${window.innerHeight - headerHeight - tabsHeight - warningHeight - alertHeight}px`;
  }
  function handleResize() {
    updateState({
      contentHeight: getHeight()
    });
  }
  propsRef.current = props;
  useLayoutEffect(() => {
    /* eslint-disable react/no-did-mount-set-state */
    updateState({
      contentHeight: getHeight()
    });
    window.addEventListener('hashchange', onHashChanged);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('hashchange', onHashChanged);
      window.removeEventListener('resize', handleResize);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  let content;
  if (stateRef.current.hash) {
    content = <div className="container-fluid">
          <div className="row">
            <div className="col-md-12">
              <QuerySearch height={stateRef.current.contentHeight} actions={propsRef.current.actions} />
            </div>
          </div>
        </div>;
  } else {
    content = <div>
          <QueryAutoRefresh />
          <TabbedSqlEditors getHeight={getHeight} />
        </div>;
  }
  return <div className="App SqlLab">
        <AlertsWrapper initMessages={propsRef.current.initMessages} />
        <div className="container-fluid">
          {content}
        </div>
      </div>;
}



App.propTypes = {
  alerts: PropTypes.array,
  actions: PropTypes.object,
  initMessages: PropTypes.array,
};

function mapStateToProps(state) {
  return {
    alerts: state.alerts,
    initMessages: state.flash_messages,
  };
}
function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}

export { App };
export default connect(mapStateToProps, mapDispatchToProps)(App);
