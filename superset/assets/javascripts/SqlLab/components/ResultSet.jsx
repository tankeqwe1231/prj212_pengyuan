import React, { useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Alert, Button, ButtonGroup, ProgressBar } from 'react-bootstrap';
import shortid from 'shortid';

import { VisualizeModal } from './VisualizeModal';
import HighlightedSql from './HighlightedSql';
import FilterableTable from '../../components/FilterableTable/FilterableTable';
import QueryStateLabel from './QueryStateLabel';
import { t } from '../../locales';

const propTypes = {
  actions: PropTypes.object,
  csv: PropTypes.bool,
  query: PropTypes.object,
  search: PropTypes.bool,
  showSql: PropTypes.bool,
  visualize: PropTypes.bool,
  cache: PropTypes.bool,
  height: PropTypes.number.isRequired,
};
const defaultProps = {
  search: true,
  visualize: true,
  showSql: false,
  csv: true,
  actions: {},
  cache: false,
};

const SEARCH_HEIGHT = 46;

function ResultSet(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(ResultSet.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = ResultSet.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    searchText: '',
    showModal: false,
    data: null
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
  function getControls() {
    if (propsRef.current.search || propsRef.current.visualize || propsRef.current.csv) {
      let csvButton;
      if (propsRef.current.csv) {
        csvButton = <Button size="sm" href={'/superset/csv/' + propsRef.current.query.id}>
            <i className="fa fa-file-text-o" /> {t('.CSV')}
          </Button>;
      }
      let visualizeButton;
      if (propsRef.current.visualize) {
        visualizeButton = <Button size="sm" onClick={showModal.bind(undefined)}>
            <i className="fa fa-line-chart m-l-1" /> {t('Visualize')}
          </Button>;
      }
      let searchBox;
      if (propsRef.current.search) {
        searchBox = <input type="text" onChange={changeSearch.bind(undefined)} className="form-control form-control-sm" placeholder={t('Search Results')} />;
      }
      return <div className="ResultSetControls">
          <div className="clearfix">
            <div className="float-start">
              <ButtonGroup>
                {visualizeButton}
                {csvButton}
              </ButtonGroup>
            </div>
            <div className="float-end">
              {searchBox}
            </div>
          </div>
        </div>;
    }
    return <div className="noControls" />;
  }
  function clearQueryResults(query) {
    propsRef.current.actions.clearQueryResults(query);
  }
  function popSelectStar() {
    const qe = {
      id: shortid.generate(),
      title: propsRef.current.query.tempTable,
      autorun: false,
      dbId: propsRef.current.query.dbId,
      sql: `SELECT * FROM ${propsRef.current.query.tempTable}`
    };
    propsRef.current.actions.addQueryEditor(qe);
  }
  function showModal() {
    updateState({
      showModal: true
    });
  }
  function hideModal() {
    updateState({
      showModal: false
    });
  }
  function changeSearch(event) {
    updateState({
      searchText: event.target.value
    });
  }
  function fetchResults(query) {
    propsRef.current.actions.fetchQueryResults(query);
  }
  function reFetchQueryResults(query) {
    propsRef.current.actions.reFetchQueryResults(query);
  }
  function reRunQueryIfSessionTimeoutErrorOnMount() {
    const {
      query
    } = propsRef.current;
    if (query.errorMessage && query.errorMessage.indexOf('session timed out') > 0) {
      propsRef.current.actions.runQuery(query, true);
    }
  }
  function receiveProps(nextProps) {
    // when new results comes in, save them locally and clear in store
    if (propsRef.current.cache && !nextProps.query.cached && nextProps.query.results && nextProps.query.results.data.length > 0) {
      updateState({
        data: nextProps.query.results.data
      }, clearQueryResults(nextProps.query));
    }
    if (nextProps.query.resultsKey && nextProps.query.resultsKey !== propsRef.current.query.resultsKey) {
      fetchResults(nextProps.query);
    }
  }
  const previousIncomingPropsRef = useRef(incomingProps);
  const incomingKeys = Object.keys(incomingProps);
  const previousIncomingProps = previousIncomingPropsRef.current;
  const incomingPropsChanged = incomingKeys.length !== Object.keys(previousIncomingProps).length || incomingKeys.some(key => incomingProps[key] !== previousIncomingProps[key]);
  if (incomingPropsChanged) {
    receiveProps(props);
    previousIncomingPropsRef.current = incomingProps;
  }
  propsRef.current = props;
  useLayoutEffect(() => {
    // only do this the first time the component is rendered/mounted
    reRunQueryIfSessionTimeoutErrorOnMount();
  }, []);
  const query = propsRef.current.query;
  const height = Math.max(0, propsRef.current.search ? propsRef.current.height - SEARCH_HEIGHT : propsRef.current.height);
  let sql;
  if (propsRef.current.showSql) {
    sql = <HighlightedSql sql={query.sql} />;
  }
  if (query.state === 'stopped') {
    return <Alert variant="warning">Query was stopped</Alert>;
  } else if (query.state === 'failed') {
    return <Alert variant="danger">{query.errorMessage}</Alert>;
  } else if (query.state === 'success' && query.ctas) {
    return <div>
          <Alert variant="info">
            {t('Table')} [<strong>{query.tempTable}</strong>] {t('was ' + 'created')} &nbsp;
            <Button size="sm" className="m-r-5" onClick={popSelectStar.bind(undefined)}>
              {t('Query in a new tab')}
            </Button>
          </Alert>
        </div>;
  } else if (query.state === 'success') {
    const results = query.results;
    let data;
    if (propsRef.current.cache && query.cached) {
      data = stateRef.current.data;
    } else if (results && results.data) {
      data = results.data;
    }
    if (data && data.length > 0) {
      return <div>
            <VisualizeModal show={stateRef.current.showModal} query={propsRef.current.query} onHide={hideModal.bind(undefined)} />
            {getControls.bind(undefined)()}
            {sql}
            <FilterableTable data={data} orderedColumnKeys={results.columns.map(col => col.name)} height={height} filterText={stateRef.current.searchText} />
          </div>;
    } else if (data && data.length === 0) {
      return <Alert variant="warning">The query returned no data</Alert>;
    }
  }
  if (query.cached) {
    return <Button size="sm" variant="primary" onClick={reFetchQueryResults.bind(undefined, query)}>
          {t('Fetch data preview')}
        </Button>;
  }
  let progressBar;
  let trackingUrl;
  if (query.progress > 0 && query.state === 'running') {
    progressBar = <ProgressBar striped now={query.progress} label={`${query.progress}%`} />;
  }
  if (query.trackingUrl) {
    trackingUrl = <Button size="sm" onClick={() => {
      window.open(query.trackingUrl);
    }}>
          {t('Track Job')}
        </Button>;
  }
  return <div>
        <img className="loading" alt={t('Loading...')} src="/static/assets/images/loading.gif" />
        <QueryStateLabel query={query} />
        {progressBar}
        <div>
          {trackingUrl}
        </div>
      </div>;
}


export default ResultSet;
ResultSet.propTypes = propTypes;
ResultSet.defaultProps = defaultProps;
