import React, { useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import AceEditor from 'react-ace';
import ace from 'ace-builds/src-noconflict/ace';
import 'ace-builds/src-noconflict/mode-sql';
import 'ace-builds/src-noconflict/theme-github';
import 'ace-builds/src-noconflict/ext-language_tools';
import { areArraysShallowEqual } from '../../reduxUtils';

const langTools = ace.require('ace/ext/language_tools');

const keywords = (
  'SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|AND|OR|GROUP|BY|ORDER|LIMIT|OFFSET|HAVING|AS|CASE|' +
  'WHEN|ELSE|END|TYPE|LEFT|RIGHT|JOIN|ON|OUTER|DESC|ASC|UNION|CREATE|TABLE|PRIMARY|KEY|IF|' +
  'FOREIGN|NOT|REFERENCES|DEFAULT|NULL|INNER|CROSS|NATURAL|DATABASE|DROP|GRANT'
);

const dataTypes = (
  'INT|NUMERIC|DECIMAL|DATE|VARCHAR|CHAR|BIGINT|FLOAT|DOUBLE|BIT|BINARY|TEXT|SET|TIMESTAMP|' +
  'MONEY|REAL|NUMBER|INTEGER'
);

const sqlKeywords = [].concat(keywords.split('|'), dataTypes.split('|'));
const sqlWords = sqlKeywords.map(s => ({
  name: s, value: s, score: 60, meta: 'sql',
}));

const propTypes = {
  actions: PropTypes.object.isRequired,
  onBlur: PropTypes.func,
  sql: PropTypes.string.isRequired,
  tables: PropTypes.array,
  queryEditor: PropTypes.object.isRequired,
  height: PropTypes.string,
  hotkeys: PropTypes.arrayOf(PropTypes.shape({
    key: PropTypes.string.isRequired,
    descr: PropTypes.string.isRequired,
    func: PropTypes.func.isRequired,
  })),
  onChange: PropTypes.func,
};

const defaultProps = {
  onBlur: () => {},
  onChange: () => {},
  tables: [],
};

function AceEditorWrapper(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(AceEditorWrapper.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = AceEditorWrapper.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    sql: props.sql,
    selectedText: ''
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
  function onBlur() {
    propsRef.current.onBlur(stateRef.current.sql);
  }
  function onAltEnter() {
    propsRef.current.onBlur(stateRef.current.sql);
  }
  function onEditorLoad(editor) {
    editor.commands.addCommand({
      name: 'runQuery',
      bindKey: {
        win: 'Alt-enter',
        mac: 'Alt-enter'
      },
      exec: () => {
        onAltEnter();
      }
    });
    propsRef.current.hotkeys.forEach(keyConfig => {
      editor.commands.addCommand({
        name: keyConfig.name,
        bindKey: {
          win: keyConfig.key,
          mac: keyConfig.key
        },
        exec: keyConfig.func
      });
    });
    editor.$blockScrolling = Infinity; // eslint-disable-line no-param-reassign
    editor.selection.on('changeSelection', () => {
      const selectedText = editor.getSelectedText();
      // Backspace trigger 1 character selection, ignoring
      if (selectedText !== stateRef.current.selectedText && selectedText.length !== 1) {
        updateState({
          selectedText
        });
        propsRef.current.actions.queryEditorSetSelectedText(propsRef.current.queryEditor, selectedText);
      }
    });
  }
  function onChange(text) {
    updateState({
      sql: text
    });
    propsRef.current.onChange(text);
  }
  function getCompletions(aceEditor, session, pos, prefix, callback) {
    callback(null, stateRef.current.words);
  }
  function setAutoCompleter(props) {
    // Loading table and column names as auto-completable words
    let words = [];
    const columns = {};
    const tables = props.tables || [];
    tables.forEach(t => {
      words.push({
        name: t.name,
        value: t.name,
        score: 55,
        meta: 'table'
      });
      const cols = t.columns || [];
      cols.forEach(col => {
        columns[col.name] = null; // using an object as a unique set
      });
    });
    words = words.concat(Object.keys(columns).map(col => ({
      name: col,
      value: col,
      score: 50,
      meta: 'column'
    })), sqlWords);
    updateState({
      words
    }, () => {
      const completer = {
        getCompletions: getCompletions.bind(undefined)
      };
      if (langTools) {
        langTools.setCompleters([completer]);
      }
    });
  }
  function receiveProps(nextProps) {
    if (!areArraysShallowEqual(propsRef.current.tables, nextProps.tables)) {
      setAutoCompleter(nextProps);
    }
    if (nextProps.sql !== propsRef.current.sql) {
      updateState({
        sql: nextProps.sql
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
    // Making sure no text is selected from previous mount
    propsRef.current.actions.queryEditorSetSelectedText(propsRef.current.queryEditor, null);
    setAutoCompleter(propsRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <AceEditor mode="sql" theme="github" onLoad={onEditorLoad.bind(undefined)} onBlur={onBlur.bind(undefined)} height={propsRef.current.height} onChange={onChange} width="100%" editorProps={{
    $blockScrolling: true
  }} enableLiveAutocompletion setOptions={{
    useWorker: false
  }} value={stateRef.current.sql} />;
}


AceEditorWrapper.defaultProps = defaultProps;
AceEditorWrapper.propTypes = propTypes;

export default AceEditorWrapper;
