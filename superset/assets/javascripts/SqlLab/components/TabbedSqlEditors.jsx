import React, { useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Card, Dropdown, DropdownItem, Tab, Tabs } from 'react-bootstrap';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import URI from 'urijs';

import * as Actions from '../actions';
import SqlEditor from './SqlEditor';
import CopyQueryTabUrl from './CopyQueryTabUrl';
import { areArraysShallowEqual } from '../../reduxUtils';
import { t } from '../../locales';
import TabStatusIcon from './TabStatusIcon';

const propTypes = {
  actions: PropTypes.object.isRequired,
  defaultDbId: PropTypes.number,
  databases: PropTypes.object.isRequired,
  queries: PropTypes.object.isRequired,
  queryEditors: PropTypes.array,
  tabHistory: PropTypes.array.isRequired,
  tables: PropTypes.array.isRequired,
  getHeight: PropTypes.func.isRequired,
};
const defaultProps = {
  queryEditors: [],
};

let queryCount = 1;

function TabbedSqlEditors(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(TabbedSqlEditors.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = TabbedSqlEditors.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => (() => {
    const sqlLabUrl = '/superset/sqllab';
    return {
      sqlLabUrl,
      queriesArray: [],
      dataPreviewQueries: [],
      hideLeftBar: false
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
  function popNewTab() {
    queryCount++;
    // Clean the url in browser history
    window.history.replaceState({}, document.title, stateRef.current.sqlLabUrl);
  }
  function renameTab(qe) {
    /* eslint no-alert: 0 */
    const newTitle = prompt(t('Enter a new title for the tab'));
    if (newTitle) {
      propsRef.current.actions.queryEditorSetTitle(qe, newTitle);
    }
  }
  function activeQueryEditor() {
    const qeid = propsRef.current.tabHistory[propsRef.current.tabHistory.length - 1];
    for (let i = 0; i < propsRef.current.queryEditors.length; i++) {
      const qe = propsRef.current.queryEditors[i];
      if (qe.id === qeid) {
        return qe;
      }
    }
    return null;
  }
  function newQueryEditor() {
    queryCount++;
    const currentQueryEditor = activeQueryEditor();
    const qe = {
      title: t('Untitled Query %s', queryCount),
      dbId: currentQueryEditor && currentQueryEditor.dbId ? currentQueryEditor.dbId : propsRef.current.defaultDbId,
      schema: currentQueryEditor ? currentQueryEditor.schema : null,
      autorun: false,
      sql: 'SELECT ...'
    };
    propsRef.current.actions.addQueryEditor(qe);
  }
  function handleSelect(key) {
    if (key === 'add_tab') {
      newQueryEditor();
    } else {
      propsRef.current.actions.setActiveQueryEditor({
        id: key
      });
    }
  }
  function removeQueryEditor(qe) {
    propsRef.current.actions.removeQueryEditor(qe);
  }
  function toggleLeftBar() {
    updateState({
      hideLeftBar: !stateRef.current.hideLeftBar
    });
  }
  function receiveProps(nextProps) {
    const nextActiveQeId = nextProps.tabHistory[nextProps.tabHistory.length - 1];
    const queriesArray = [];
    for (const id in nextProps.queries) {
      if (nextProps.queries[id].sqlEditorId === nextActiveQeId) {
        queriesArray.push(nextProps.queries[id]);
      }
    }
    if (!areArraysShallowEqual(queriesArray, stateRef.current.queriesArray)) {
      updateState({
        queriesArray
      });
    }
    const dataPreviewQueries = [];
    nextProps.tables.forEach(table => {
      const queryId = table.dataPreviewQueryId;
      if (queryId && nextProps.queries[queryId] && table.queryEditorId === nextActiveQeId) {
        dataPreviewQueries.push(nextProps.queries[queryId]);
      }
    });
    if (!areArraysShallowEqual(dataPreviewQueries, stateRef.current.dataPreviewQueries)) {
      updateState({
        dataPreviewQueries
      });
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
    const query = URI(window.location).search(true);
    if (query.id || query.sql || query.savedQueryId) {
      if (query.id) {
        propsRef.current.actions.popStoredQuery(query.id);
      } else if (query.savedQueryId) {
        propsRef.current.actions.popSavedQuery(query.savedQueryId);
      } else if (query.sql) {
        let dbId = query.dbid;
        if (dbId) {
          dbId = parseInt(dbId, 10);
        } else {
          const databases = propsRef.current.databases;
          const dbName = query.dbname;
          if (dbName) {
            Object.keys(databases).forEach(db => {
              if (databases[db].database_name === dbName) {
                dbId = databases[db].id;
              }
            });
          }
        }
        const newQueryEditor = {
          title: query.title,
          dbId,
          schema: query.schema,
          autorun: query.autorun,
          sql: query.sql
        };
        propsRef.current.actions.addQueryEditor(newQueryEditor);
      }
      popNewTab();
    }
  }, []);
  const editors = propsRef.current.queryEditors.map((qe, i) => {
    const isSelected = qe.id === activeQueryEditor().id;
    let latestQuery;
    if (qe.latestQueryId) {
      latestQuery = propsRef.current.queries[qe.latestQueryId];
    }
    let database;
    if (qe.dbId) {
      database = propsRef.current.databases[qe.dbId];
    }
    const state = latestQuery ? latestQuery.state : '';
    const tabTitle = <div>
          <TabStatusIcon onClose={removeQueryEditor.bind(undefined, qe)} tabState={state} /> {qe.title} {' '}
          <Dropdown as="span" onClick={event => event.stopPropagation()}>
            <Dropdown.Toggle as="span" className="query-tab-dropdown-toggle" id={'ddbtn-tab-' + i} role="button" tabIndex={0} />
            <Dropdown.Menu>
            <DropdownItem as="span" eventKey="1" onClick={removeQueryEditor.bind(undefined, qe)}>
              <i className="fa fa-close" /> {t('close tab')}
            </DropdownItem>
            <DropdownItem as="span" eventKey="2" onClick={renameTab.bind(undefined, qe)}>
              <i className="fa fa-i-cursor" /> {t('rename tab')}
            </DropdownItem>
            {qe && <CopyQueryTabUrl queryEditor={qe} />}
            <DropdownItem as="span" eventKey="4" onClick={toggleLeftBar.bind(undefined)}>
              <i className="fa fa-cogs" />
              &nbsp;
              {stateRef.current.hideLeftBar ? t('expand tool bar') : t('hide tool bar')}
            </DropdownItem>
            </Dropdown.Menu>
          </Dropdown>
        </div>;
    return <Tab key={qe.id} title={tabTitle} eventKey={qe.id}>
          <Card>
            <Card.Body>
              {isSelected && <SqlEditor getHeight={propsRef.current.getHeight} tables={propsRef.current.tables.filter(xt => xt.queryEditorId === qe.id)} queryEditor={qe} editorQueries={stateRef.current.queriesArray} dataPreviewQueries={stateRef.current.dataPreviewQueries} latestQuery={latestQuery} database={database} actions={propsRef.current.actions} hideLeftBar={stateRef.current.hideLeftBar} />}
            </Card.Body>
          </Card>
        </Tab>;
  });
  return <Tabs variant="tabs" activeKey={propsRef.current.tabHistory[propsRef.current.tabHistory.length - 1]} onSelect={handleSelect.bind(undefined)} id="a11y-query-editor-tabs">
        {editors}
        <Tab title={<div>
              <i className="fa fa-plus-circle" />&nbsp;
            </div>} eventKey="add_tab" />
      </Tabs>;
}


TabbedSqlEditors.propTypes = propTypes;
TabbedSqlEditors.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {
    databases: state.databases,
    queryEditors: state.queryEditors,
    queries: state.queries,
    tabHistory: state.tabHistory,
    tables: state.tables,
    defaultDbId: state.defaultDbId,
  };
}
function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}

export { TabbedSqlEditors };
export default connect(mapStateToProps, mapDispatchToProps)(TabbedSqlEditors);
