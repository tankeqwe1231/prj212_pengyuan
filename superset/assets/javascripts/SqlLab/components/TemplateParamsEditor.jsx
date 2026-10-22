import React, { useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Badge } from 'react-bootstrap';

import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/mode-sql';
import 'ace-builds/src-noconflict/mode-json';
import 'ace-builds/src-noconflict/mode-html';
import 'ace-builds/src-noconflict/mode-markdown';
import 'ace-builds/src-noconflict/theme-textmate';
import 'ace-builds/src-noconflict/ext-language_tools';

import ModalTrigger from '../../components/ModalTrigger';
import InfoTooltipWithTrigger from '../../components/InfoTooltipWithTrigger';
import Button from '../../components/Button';
import { t } from '../../locales';

const propTypes = {
  onChange: PropTypes.func,
  code: PropTypes.string,
  language: PropTypes.oneOf(['yaml', 'json']),
};

const defaultProps = {
  label: null,
  description: null,
  onChange: () => {},
  code: '{}',
};

function TemplateParamsEditor(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(TemplateParamsEditor.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = TemplateParamsEditor.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => (() => {
    const codeText = props.code || '{}';
    return {
      codeText,
      parsedJSON: null,
      isValid: true
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
  function onChange(value) {
    const codeText = value;
    let isValid;
    let parsedJSON = {};
    try {
      parsedJSON = JSON.parse(value);
      isValid = true;
    } catch (e) {
      isValid = false;
    }
    updateState({
      parsedJSON,
      isValid,
      codeText
    });
    if (isValid) {
      propsRef.current.onChange(codeText);
    } else {
      propsRef.current.onChange('{}');
    }
  }
  function renderDoc() {
    return <p>
        Assign a set of parameters as <code>JSON</code> below
        (example: <code>{'{"my_table": "foo"}'}</code>),
        and they become available
        in your SQL (example: <code>SELECT * FROM {'{{ my_table }}'} </code>)
        by using
        <a href="http://superset.apache.org/sqllab.html#templating-with-jinja" target="_blank" rel="noopener noreferrer">
          Jinja templating
        </a> syntax.
      </p>;
  }
  function renderModalBody() {
    return <div>
        {renderDoc()}
        <AceEditor mode={propsRef.current.language} theme="textmate" style={{
        border: '1px solid #CCC'
      }} minLines={25} maxLines={50} onChange={onChange} width="100%" editorProps={{
        $blockScrolling: true
      }} enableLiveAutocompletion setOptions={{
        useWorker: false
      }} value={stateRef.current.codeText} />
      </div>;
  }
  propsRef.current = props;
  useLayoutEffect(() => {
    onChange(stateRef.current.codeText);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const paramCount = stateRef.current.parsedJSON ? Object.keys(stateRef.current.parsedJSON).length : 0;
  return <ModalTrigger modalTitle={t('Template Parameters')} triggerNode={<Button className="m-r-5" tooltip={t('Edit template parameters')}>
            {`${t('parameters')} `}
            {paramCount > 0 && <Badge>{paramCount}</Badge>}
            {!stateRef.current.isValid && <InfoTooltipWithTrigger icon="exclamation-triangle" variant="danger" tooltip={t('Invalid JSON')} label="invalid-json" />}
          </Button>} modalBody={renderModalBody(true)} />;
}


export default TemplateParamsEditor;

TemplateParamsEditor.propTypes = propTypes;
TemplateParamsEditor.defaultProps = defaultProps;
