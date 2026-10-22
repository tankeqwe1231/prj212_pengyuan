import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import SyntaxHighlighter, { registerLanguage } from 'react-syntax-highlighter/dist/light';
import html from 'react-syntax-highlighter/dist/languages/htmlbars';
import markdown from 'react-syntax-highlighter/dist/languages/markdown';
import sql from 'react-syntax-highlighter/dist/languages/sql';
import json from 'react-syntax-highlighter/dist/languages/json';
import github from 'react-syntax-highlighter/dist/styles/github';
import CopyToClipboard from './../../components/CopyToClipboard';
import { getExploreUrlAndPayload } from '../exploreUtils';

import ModalTrigger from './../../components/ModalTrigger';
import Button from '../../components/Button';
import { t } from '../../locales';

registerLanguage('markdown', markdown);
registerLanguage('html', html);
registerLanguage('sql', sql);
registerLanguage('json', json);

const $ = window.$ = require('jquery');

const propTypes = {
  animation: PropTypes.bool,
  queryResponse: PropTypes.object,
  chartStatus: PropTypes.string,
  latestQueryFormData: PropTypes.object.isRequired,
};
const defaultProps = {
  animation: true,
};

function DisplayQueryButton(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(DisplayQueryButton.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = DisplayQueryButton.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    language: null,
    query: null,
    isLoading: false,
    error: null
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
  function setStateFromQueryResponse() {
    const qr = propsRef.current.queryResponse;
    updateState({
      language: qr.language,
      query: qr.query,
      isLoading: false
    });
  }
  function fetchQuery() {
    updateState({
      isLoading: true
    });
    const {
      url,
      payload
    } = getExploreUrlAndPayload({
      formData: propsRef.current.latestQueryFormData,
      endpointType: 'query'
    });
    $.ajax({
      type: 'POST',
      url,
      data: {
        form_data: JSON.stringify(payload)
      },
      success: data => {
        updateState({
          language: data.language,
          query: data.query,
          isLoading: false,
          error: null
        });
      },
      error: data => {
        updateState({
          error: data.responseJSON ? data.responseJSON.error : t('Error...'),
          isLoading: false
        });
      }
    });
  }
  function beforeOpen() {
    if (['loading', null].indexOf(propsRef.current.chartStatus) >= 0 || !propsRef.current.queryResponse || !propsRef.current.queryResponse.query) {
      fetchQuery();
    } else {
      setStateFromQueryResponse();
    }
  }
  function renderModalBody() {
    if (stateRef.current.isLoading) {
      return <img className="loading" alt="Loading..." src="/static/assets/images/loading.gif" />;
    } else if (stateRef.current.error) {
      return <pre className="explore-query-modal__error">{stateRef.current.error}</pre>;
    } else if (stateRef.current.query) {
      return <div className="explore-query-modal__content">
          <div className="explore-query-modal__toolbar">
            <CopyToClipboard text={stateRef.current.query} shouldShowText={false} copyNode={<Button
              className="explore-query-modal__copy"
              variant="outline-secondary"
              aria-label={t('Copy to clipboard')}
            >
              <i className="fa fa-clipboard" aria-hidden="true" />
            </Button>} />
          </div>
          <SyntaxHighlighter
            language={stateRef.current.language}
            style={github}
            customStyle={{ background: 'transparent', margin: 0, padding: '16px' }}
          >
            {stateRef.current.query}
          </SyntaxHighlighter>
        </div>;
    }
    return null;
  }
  propsRef.current = props;
  return <ModalTrigger
    animation={propsRef.current.animation}
    triggerNode={<Button className="modal-trigger" variant="outline-secondary">{t('View Query')}</Button>}
    dialogClassName="explore-query-modal"
    modalTitle={<span className="explore-query-modal__title">
      <span className="explore-query-modal__title-icon" aria-hidden="true">
        <i className="fa fa-code" />
      </span>
      {t('Query')}
    </span>}
    size="lg"
    beforeOpen={beforeOpen}
    modalBody={renderModalBody()}
  />;
}


export default DisplayQueryButton;

DisplayQueryButton.propTypes = propTypes;
DisplayQueryButton.defaultProps = defaultProps;
