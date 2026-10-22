import React, { useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import throttle from 'lodash.throttle';
import {
  Col,
  FormGroup,
  InputGroup,
  Form,
  FormControl,
  Badge,
  OverlayTrigger,
  Row,
  Tooltip,
  Collapse,
} from 'react-bootstrap';
import SplitPane from '../../components/SplitPane';

import Button from '../../components/Button';
import TemplateParamsEditor from './TemplateParamsEditor';
import SouthPane from './SouthPane';
import SaveQuery from './SaveQuery';
import ShareQuery from './ShareQuery';
import Timer from '../../components/Timer';
import Hotkeys from '../../components/Hotkeys';
import SqlEditorLeftBar from './SqlEditorLeftBar';
import AceEditorWrapper from './AceEditorWrapper';
import { STATE_BSSTYLE_MAP } from '../constants';
import RunQueryActionButton from './RunQueryActionButton';
import { t } from '../../locales';


const propTypes = {
  actions: PropTypes.object.isRequired,
  getHeight: PropTypes.func.isRequired,
  database: PropTypes.object,
  latestQuery: PropTypes.object,
  tables: PropTypes.array.isRequired,
  editorQueries: PropTypes.array.isRequired,
  dataPreviewQueries: PropTypes.array.isRequired,
  queryEditor: PropTypes.object.isRequired,
  hideLeftBar: PropTypes.bool,
};

const defaultProps = {
  database: null,
  latestQuery: null,
  hideLeftBar: false,
};

const DEFAULT_EDITOR_PANE_HEIGHT = 200;
const MIN_EDITOR_PANE_HEIGHT = 100;
const MIN_SOUTH_PANE_HEIGHT = 150;
const SPLIT_PANE_HANDLER_HEIGHT = 15;

function maximumEditorPaneHeight(totalHeight) {
  return Math.max(
    MIN_EDITOR_PANE_HEIGHT,
    totalHeight - MIN_SOUTH_PANE_HEIGHT - SPLIT_PANE_HANDLER_HEIGHT,
  );
}

export function getEditorPaneHeight(editorPaneHeight, totalHeight) {
  const parsedHeight = Number(editorPaneHeight);
  const requestedHeight = Number.isFinite(parsedHeight)
    ? parsedHeight
    : DEFAULT_EDITOR_PANE_HEIGHT;
  return Math.min(
    Math.max(requestedHeight, MIN_EDITOR_PANE_HEIGHT),
    maximumEditorPaneHeight(totalHeight),
  );
}

function SqlEditor(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(SqlEditor.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = SqlEditor.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    autorun: props.queryEditor.autorun,
    ctas: '',
    sql: props.queryEditor.sql
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
  const throttledResizeRef = useRef(throttle(onResize, 250));
  const aceRef = useRef(null);
  const southRef = useRef(null);
  const hasInitializedLayoutRef = useRef(false);
  function onResize(nextEditorPaneHeight) {
    const height = sqlEditorHeight();
    // Start each editor with the compact layout used by SQL Lab.  Older
    // persisted values may contain the full editor height from the previous
    // splitter implementation, which leaves no room for the results pane.
    const requestedEditorPaneHeight = typeof nextEditorPaneHeight === 'number'
      ? nextEditorPaneHeight
      : hasInitializedLayoutRef.current
        ? stateRef.current.editorPaneHeight
        : DEFAULT_EDITOR_PANE_HEIGHT;
    const editorPaneHeight = getEditorPaneHeight(requestedEditorPaneHeight, height);
    updateState({
      editorPaneHeight,
      southPaneHeight: Math.max(
        0,
        height - editorPaneHeight - SPLIT_PANE_HANDLER_HEIGHT,
      ),
      height
    });
    hasInitializedLayoutRef.current = true;
    if (propsRef.current.queryEditor.height !== editorPaneHeight) {
      propsRef.current.actions.persistEditorHeight(
        propsRef.current.queryEditor,
        editorPaneHeight,
      );
    }
  }
  function onSqlChanged(sql) {
    updateState({
      sql
    });
  }
  function getHotkeyConfig() {
    return [{
      name: 'runQuery',
      key: 'ctrl+r',
      descr: 'Run query',
      func: runQuery
    }, {
      name: 'newTab',
      key: 'ctrl+t',
      descr: 'New tab',
      func: () => {
        propsRef.current.actions.addQueryEditor({
          ...propsRef.current.queryEditor,
          title: t('Untitled Query'),
          sql: ''
        });
      }
    }, {
      name: 'stopQuery',
      key: 'ctrl+x',
      descr: 'Stop query',
      func: stopQuery
    }];
  }
  function setQueryEditorSql(sql) {
    propsRef.current.actions.queryEditorSetSql(propsRef.current.queryEditor, sql);
  }
  function runQuery() {
    startQuery(!propsRef.current.database.allow_run_sync);
  }
  function startQuery(runAsync = false, ctas = false) {
    const qe = propsRef.current.queryEditor;
    const query = {
      dbId: qe.dbId,
      sql: qe.selectedText ? qe.selectedText : stateRef.current.sql,
      sqlEditorId: qe.id,
      tab: qe.title,
      schema: qe.schema,
      tempTableName: ctas ? stateRef.current.ctas : '',
      templateParams: qe.templateParams,
      runAsync,
      ctas
    };
    propsRef.current.actions.runQuery(query);
    propsRef.current.actions.setActiveSouthPaneTab('Results');
  }
  function stopQuery() {
    if (propsRef.current.latestQuery && propsRef.current.latestQuery.state === 'running') {
      propsRef.current.actions.postStopQuery(propsRef.current.latestQuery);
    }
  }
  function createTableAs() {
    startQuery(true, true);
  }
  function ctasChanged(event) {
    updateState({
      ctas: event.target.value
    });
  }
  function sqlEditorHeight() {
    const horizontalScrollbarHeight = 25;
    return parseInt(propsRef.current.getHeight(), 10) - horizontalScrollbarHeight;
  }
  function renderEditorBottomBar(hotkeys) {
    let ctasControls;
    if (propsRef.current.database && propsRef.current.database.allow_ctas) {
      const ctasToolTip = t('Create table as with query results');
      ctasControls = <FormGroup>
          <InputGroup>
            <FormControl type="text" size="sm" placeholder={t('new table name')} onChange={ctasChanged.bind(undefined)} />
            <Button size="sm" disabled={stateRef.current.ctas.length === 0} onClick={createTableAs.bind(undefined)} tooltip={ctasToolTip}>
                <i className="fa fa-table" /> CTAS
            </Button>
          </InputGroup>
        </FormGroup>;
    }
    const qe = propsRef.current.queryEditor;
    let limitWarning = null;
    if (propsRef.current.latestQuery && propsRef.current.latestQuery.limit_reached) {
      const tooltip = <Tooltip id="tooltip">
          It appears that the number of rows in the query results displayed
          was limited on the server side to
          the {propsRef.current.latestQuery.rows} limit.
        </Tooltip>;
      limitWarning = <OverlayTrigger placement="left" overlay={tooltip}>
          <Badge bg="warning" className="m-r-5">LIMIT</Badge>
        </OverlayTrigger>;
    }
    return <div className="sql-toolbar clearfix" id="js-sql-toolbar">
        <div className="float-start">
          <Form className="d-flex align-items-center gap-2">
            <span className="m-r-5">
              <RunQueryActionButton allowAsync={propsRef.current.database ? propsRef.current.database.allow_run_async : false} dbId={qe.dbId} queryState={propsRef.current.latestQuery && propsRef.current.latestQuery.state} runQuery={runQuery} selectedText={qe.selectedText} stopQuery={stopQuery} sql={stateRef.current.sql} />
            </span>
            <span className="m-r-5">
              <SaveQuery defaultLabel={qe.title} sql={qe.sql} className="m-r-5" onSave={propsRef.current.actions.saveQuery} schema={qe.schema} dbId={qe.dbId} />
            </span>
            <span className="m-r-5">
              <ShareQuery queryEditor={qe} />
            </span>
            {ctasControls}
            <span className="m-l-5">
              <Hotkeys header="Hotkeys" hotkeys={hotkeys} />
            </span>
          </Form>
        </div>
        <div className="float-end">
          <TemplateParamsEditor language="json" onChange={params => {
          propsRef.current.actions.queryEditorSetTemplateParams(qe, params);
        }} code={qe.templateParams} />
          {limitWarning}
          {propsRef.current.latestQuery && <Timer startTime={propsRef.current.latestQuery.startDttm} endTime={propsRef.current.latestQuery.endDttm} state={STATE_BSSTYLE_MAP[propsRef.current.latestQuery.state]} isRunning={propsRef.current.latestQuery.state === 'running'} />}
        </div>
      </div>;
  }
  propsRef.current = props;
  useLayoutEffect(() => {
    const throttledResize = throttledResizeRef.current;
    if (stateRef.current.autorun) {
      updateState({
        autorun: false
      });
      propsRef.current.actions.queryEditorSetAutorun(propsRef.current.queryEditor, false);
      startQuery();
    }
    onResize();
    window.addEventListener('resize', throttledResize);
    return () => {
      window.removeEventListener('resize', throttledResize);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const height = sqlEditorHeight();
  const defaultNorthHeight = getEditorPaneHeight(
    DEFAULT_EDITOR_PANE_HEIGHT,
    height,
  );
  const maxNorthHeight = maximumEditorPaneHeight(height);
  const hotkeys = getHotkeyConfig();
  return <div className="SqlEditor" style={{
    height: height + 'px'
  }}>
        <Row>
          <Collapse in={!propsRef.current.hideLeftBar}>
            <Col xs={6} sm={5} md={4} lg={3}>
              <SqlEditorLeftBar height={height} database={propsRef.current.database} queryEditor={propsRef.current.queryEditor} tables={propsRef.current.tables} actions={propsRef.current.actions} />
            </Col>
          </Collapse>
          <Col xs={propsRef.current.hideLeftBar ? 12 : 6} sm={propsRef.current.hideLeftBar ? 12 : 7} md={propsRef.current.hideLeftBar ? 12 : 8} lg={propsRef.current.hideLeftBar ? 12 : 9} style={{
        height
      }}>
            <SplitPane split="horizontal" defaultSize={defaultNorthHeight} maxSize={maxNorthHeight} minSize={MIN_EDITOR_PANE_HEIGHT} onChange={onResize}>
              <div ref={ref => {
            aceRef.current = ref;
          }} style={{
            width: '100%'
          }}>
                <div>
                  <AceEditorWrapper actions={propsRef.current.actions} onBlur={setQueryEditorSql} onChange={onSqlChanged} queryEditor={propsRef.current.queryEditor} sql={propsRef.current.queryEditor.sql} tables={propsRef.current.tables} height={(stateRef.current.editorPaneHeight || defaultNorthHeight) - 50 + 'px'} hotkeys={hotkeys} />
                  {renderEditorBottomBar(hotkeys)}
                </div>
              </div>
              <div ref={ref => {
            southRef.current = ref;
          }}>
                <SouthPane editorQueries={propsRef.current.editorQueries} dataPreviewQueries={propsRef.current.dataPreviewQueries} actions={propsRef.current.actions} height={stateRef.current.southPaneHeight || 0} />
              </div>
            </SplitPane>
          </Col>
        </Row>
      </div>;
}


SqlEditor.defaultProps = defaultProps;
SqlEditor.propTypes = propTypes;

export default SqlEditor;
