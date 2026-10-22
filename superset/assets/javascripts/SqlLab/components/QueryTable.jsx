import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';

import moment from 'moment';
import { Badge, Card, ProgressBar } from 'react-bootstrap';
import Link from './Link';
import { VisualizeModal } from './VisualizeModal';
import ResultSet from './ResultSet';
import ModalTrigger from '../../components/ModalTrigger';
import HighlightedSql from './HighlightedSql';
import { fDuration } from '../../modules/dates';
import { storeQuery } from '../../utils/common';
import QueryStateLabel from './QueryStateLabel';
import { t } from '../../locales';
import AppTable from '../../components/AppTable/AppTable';

const propTypes = {
  columns: PropTypes.array,
  actions: PropTypes.object,
  queries: PropTypes.array,
  onUserClicked: PropTypes.func,
  onDbClicked: PropTypes.func,
};
const defaultProps = {
  columns: ['started', 'duration', 'rows'],
  queries: [],
  onUserClicked: () => {},
  onDbClicked: () => {},
};


function QueryTable(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(QueryTable.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = QueryTable.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => (() => {
    const uri = window.location.toString();
    const cleanUri = uri.substring(0, uri.indexOf('#'));
    return {
      cleanUri,
      showVisualizeModal: false,
      activeQuery: null
    };
  })());
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
  function callback(url) {
    window.open(url);
  }
  function openQuery(dbId, schema, sql) {
    const newQuery = {
      dbId,
      title: t('Untitled Query'),
      schema,
      sql
    };
    storeQuery(newQuery, callback);
  }
  function hideVisualizeModal() {
    updateState({
      showVisualizeModal: false
    });
  }
  function showVisualizeModal(query) {
    updateState({
      activeQuery: query,
      showVisualizeModal: true
    });
  }
  function restoreSql(query) {
    propsRef.current.actions.queryEditorSetSql({
      id: query.sqlEditorId
    }, query.sql);
  }
  function openQueryInNewTab(query) {
    propsRef.current.actions.cloneQueryToNewTab(query);
  }
  function openAsyncResults(query) {
    propsRef.current.actions.fetchQueryResults(query);
  }
  function clearQueryResults(query) {
    propsRef.current.actions.clearQueryResults(query);
  }
  function removeQuery(query) {
    propsRef.current.actions.removeQuery(query);
  }
  propsRef.current = props;
  const columns = propsRef.current.columns.map(column => ({
    accessorKey: column,
    header: column,
  }));
  const data = propsRef.current.queries.map(query => {
    const q = Object.assign({}, query);
    if (q.endDttm) {
      q.duration = fDuration(q.startDttm, q.endDttm);
    }
    const time = moment(q.startDttm).format().split('T');
    q.time = <div>
          <span>
            {time[0]} <br /> {time[1]}
          </span>
        </div>;
    q.user = <button className="btn btn-link btn-sm" onClick={propsRef.current.onUserClicked.bind(undefined, q.userId)}>
          {q.user}
        </button>;
    q.db = <button className="btn btn-link btn-sm" onClick={propsRef.current.onDbClicked.bind(undefined, q.dbId)}>
          {q.db}
        </button>;
    q.started = moment(q.startDttm).format('HH:mm:ss');
    q.querylink = <div style={{
      width: '100px'
    }}>
          <button className="btn btn-link btn-sm" onClick={openQuery.bind(undefined, q.dbId, q.schema, q.sql)}>
            <i className="fa fa-external-link" />{t('Open in SQL Editor')}
          </button>
        </div>;
    q.sql = <Card className="bg-light"><Card.Body className="p-2">
          <HighlightedSql sql={q.sql} rawSql={q.executedSql} shrink maxWidth={60} />
        </Card.Body></Card>;
    if (q.resultsKey) {
      q.output = <ModalTrigger size="lg" className="ResultsModal" triggerNode={<Badge bg="info" style={{
        cursor: 'pointer'
      }}>
                {t('view results')}
              </Badge>} modalTitle={t('Data preview')} beforeOpen={openAsyncResults.bind(undefined, query)} onExit={clearQueryResults.bind(undefined, query)} modalBody={<ResultSet showSql query={query} actions={propsRef.current.actions} height={400} />} />;
    } else {
      // if query was run using ctas and force_ctas_schema was set
      // tempTable will have the schema
      const schemaUsed = q.ctas && q.tempTable && q.tempTable.includes('.') ? '' : q.schema;
      q.output = [schemaUsed, q.tempTable].filter(v => v).join('.');
    }
    q.progress = <ProgressBar style={{
      width: '75px'
    }} striped now={q.progress} label={`${q.progress}%`} />;
    let errorTooltip;
    if (q.errorMessage) {
      errorTooltip = <Link tooltip={q.errorMessage}>
            <i className="fa fa-exclamation-circle text-danger" />
          </Link>;
    }
    q.state = <div>
          <QueryStateLabel query={query} />
          {errorTooltip}
        </div>;
    q.actions = <div style={{
      width: '75px'
    }}>
          <Link className="fa fa-line-chart m-r-3" tooltip={t('Visualize the data out of this query')} onClick={showVisualizeModal.bind(undefined, query)} />
          <Link className="fa fa-pencil m-r-3" onClick={restoreSql.bind(undefined, query)} tooltip={t('Overwrite text in editor with a query on this table')} placement="top" />
          <Link className="fa fa-plus-circle m-r-3" onClick={openQueryInNewTab.bind(undefined, query)} tooltip={t('Run query in a new tab')} placement="top" />
          <Link className="fa fa-trash m-r-3" tooltip={t('Remove query from log')} onClick={removeQuery.bind(undefined, query)} />
        </div>;
    return q;
  }).reverse();
  return <div className="QueryTable">
        <VisualizeModal show={stateRef.current.showVisualizeModal} query={stateRef.current.activeQuery} onHide={hideVisualizeModal.bind(undefined)} />
        <AppTable columns={columns} className="table table-sm" data={data} pageSize={50} />
      </div>;
}


QueryTable.propTypes = propTypes;
QueryTable.defaultProps = defaultProps;

export default QueryTable;
