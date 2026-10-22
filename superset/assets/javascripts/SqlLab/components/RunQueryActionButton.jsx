import React from 'react';
import PropTypes from 'prop-types';
import Button from '../../components/Button';
import { t } from '../../locales';

const propTypes = {
  allowAsync: PropTypes.bool.isRequired,
  dbId: PropTypes.number,
  queryState: PropTypes.string,
  runQuery: PropTypes.func.isRequired,
  selectedText: PropTypes.string,
  stopQuery: PropTypes.func.isRequired,
  sql: PropTypes.string.isRequired,
};
export default function RunQueryActionButton({
  allowAsync = false, dbId, queryState, runQuery, selectedText, sql = '', stopQuery,
}) {
  const runBtnText = selectedText ? t('Run Selected Query') : t('Run Query');
  const btnStyle = selectedText ? 'warning' : 'primary';
  const shouldShowStopBtn = ['running', 'pending'].indexOf(queryState) > -1;

  const commonBtnProps = {
    size: 'sm',
    variant: btnStyle,
    disabled: !dbId,
  };

  const syncBtn = (
    <Button
      {...commonBtnProps}
      onClick={() => runQuery(false)}
      key="run-btn"
      tooltip={t('Run query synchronously')}
      disabled={!sql.trim()}
    >
      <i className="fa fa-refresh" /> {runBtnText}
    </Button>
  );

  const asyncBtn = (
    <Button
      {...commonBtnProps}
      onClick={() => runQuery(true)}
      key="run-async-btn"
      tooltip={t('Run query asynchronously')}
      disabled={!sql.trim()}
    >
      <i className="fa fa-table" /> {runBtnText}
    </Button>
  );

  const stopBtn = (
    <Button
      {...commonBtnProps}
      onClick={stopQuery}
    >
      <i className="fa fa-stop" /> {t('Stop')}
    </Button>
  );

  let button;
  if (shouldShowStopBtn) {
    button = stopBtn;
  } else if (allowAsync) {
    button = asyncBtn;
  } else {
    button = syncBtn;
  }
  return button;
}

RunQueryActionButton.propTypes = propTypes;
