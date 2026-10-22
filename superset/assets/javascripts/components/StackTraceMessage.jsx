/* eslint-disable react/no-danger */
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Alert, Collapse } from 'react-bootstrap';

const propTypes = {
  message: PropTypes.string,
  queryResponse: PropTypes.object,
  showStackTrace: PropTypes.bool,
};
function StackTraceMessage({ message, queryResponse, showStackTrace: initialShowStackTrace = false }) {
  const [showStackTrace, setShowStackTrace] = useState(initialShowStackTrace);
  const hasTrace = () => queryResponse && queryResponse.stacktrace;
  return <div className={`stack-trace-container${hasTrace() ? ' has-trace' : ''}`}>
        <Alert variant="warning" onClick={() => setShowStackTrace(value => !value)}>
          {message}
        </Alert>
        {hasTrace() && <Collapse in={showStackTrace}>
            <pre>
              {queryResponse.stacktrace}
            </pre>
          </Collapse>}
      </div>;
}

StackTraceMessage.propTypes = propTypes;

export default StackTraceMessage;
