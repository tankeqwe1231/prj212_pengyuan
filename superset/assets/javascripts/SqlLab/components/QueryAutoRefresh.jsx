import { useLayoutEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import * as Actions from '../actions';

const $ = require('jquery');

const QUERY_UPDATE_FREQ = 2000;
const QUERY_UPDATE_BUFFER_MS = 5000;
const POLLING_QUERY_STATES = ['running', 'started', 'pending', 'fetching'];

function QueryAutoRefresh(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(QueryAutoRefresh.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = QueryAutoRefresh.defaultProps[key];
  });
  const propsRef = useRef(props);
  const timerRef = useRef(undefined);
  const staleQueryIdsRef = useRef(new Set(
    Object.keys(props.queries).filter(id =>
      POLLING_QUERY_STATES.indexOf(props.queries[id].state) >= 0),
  ));
  function shouldCheckForQueries() {
    // if there are started or running queries, this method should return true
    const {
      queries
    } = propsRef.current;
    const queryKeys = Object.keys(queries);
    return queryKeys.some(key =>
      !staleQueryIdsRef.current.has(key) &&
      POLLING_QUERY_STATES.indexOf(queries[key].state) >= 0);
  }
  function startTimer() {
    if (!timerRef.current) {
      timerRef.current = setInterval(stopwatch.bind(undefined), QUERY_UPDATE_FREQ);
    }
  }
  function stopTimer() {
    clearInterval(timerRef.current);
    timerRef.current = null;
  }
  function stopwatch() {
    // only poll /superset/queries/ if there are started or running queries
    if (shouldCheckForQueries()) {
      const url = `/superset/queries/${propsRef.current.queriesLastUpdate - QUERY_UPDATE_BUFFER_MS}`;
      $.getJSON(url, data => {
        if (Object.keys(data).length > 0) {
          propsRef.current.actions.refreshQueries(data);
        }
      });
    }
  }
  propsRef.current = props;
  useLayoutEffect(() => {
    staleQueryIdsRef.current.forEach((id) => {
      propsRef.current.actions.stopQuery(propsRef.current.queries[id]);
    });
    startTimer();
    return () => {
      stopTimer();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}


QueryAutoRefresh.propTypes = {
  queries: PropTypes.object.isRequired,
  actions: PropTypes.object.isRequired,
  queriesLastUpdate: PropTypes.number.isRequired,
};

function mapStateToProps(state) {
  return {
    queries: state.queries,
    queriesLastUpdate: state.queriesLastUpdate,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}

export { QueryAutoRefresh };
export default connect(mapStateToProps, mapDispatchToProps)(QueryAutoRefresh);
