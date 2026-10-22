import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';

import SyntaxHighlighter, { registerLanguage } from 'react-syntax-highlighter/dist/light';
import sql from 'react-syntax-highlighter/dist/languages/sql';
import github from 'react-syntax-highlighter/dist/styles/github';

import ModalTrigger from '../../components/ModalTrigger';
import { t } from '../../locales';

registerLanguage('sql', sql);

const defaultProps = {
  maxWidth: 50,
  maxLines: 5,
  shrink: false,
};

const propTypes = {
  sql: PropTypes.string.isRequired,
  rawSql: PropTypes.string,
  maxWidth: PropTypes.number,
  maxLines: PropTypes.number,
  shrink: PropTypes.bool,
};

function HighlightedSql(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(HighlightedSql.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = HighlightedSql.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    modalBody: null
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
  function shrinkSql() {
    const ssql = propsRef.current.sql || '';
    let lines = ssql.split('\n');
    if (lines.length >= propsRef.current.maxLines) {
      lines = lines.slice(0, propsRef.current.maxLines);
      lines.push('{...}');
    }
    return lines.map(line => {
      if (line.length > propsRef.current.maxWidth) {
        return line.slice(0, propsRef.current.maxWidth) + '{...}';
      }
      return line;
    }).join('\n');
  }
  function triggerNode() {
    const shownSql = propsRef.current.shrink ? shrinkSql(propsRef.current.sql) : propsRef.current.sql;
    return <SyntaxHighlighter language="sql" style={github}>
        {shownSql}
      </SyntaxHighlighter>;
  }
  function generateModal() {
    let rawSql;
    if (propsRef.current.rawSql && propsRef.current.rawSql !== propsRef.current.sql) {
      rawSql = <div>
          <h4>{t('Raw SQL')}</h4>
          <SyntaxHighlighter language="sql" style={github}>
            {propsRef.current.rawSql}
          </SyntaxHighlighter>
        </div>;
    }
    updateState({
      modalBody: <div>
          <h4>{t('Source SQL')}</h4>
          <SyntaxHighlighter language="sql" style={github}>
            {propsRef.current.sql}
          </SyntaxHighlighter>
          {rawSql}
        </div>
    });
  }
  propsRef.current = props;
  return <ModalTrigger modalTitle={t('SQL')} triggerNode={triggerNode()} modalBody={stateRef.current.modalBody} beforeOpen={generateModal.bind(undefined)} />;
}


HighlightedSql.propTypes = propTypes;
HighlightedSql.defaultProps = defaultProps;

export default HighlightedSql;
