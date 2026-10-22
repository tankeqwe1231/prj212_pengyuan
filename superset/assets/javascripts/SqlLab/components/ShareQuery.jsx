import React from 'react';
import PropTypes from 'prop-types';

import CopyToClipboard from '../../components/CopyToClipboard';
import Button from '../../components/Button';
import { storeQuery } from '../../utils/common';
import { t } from '../../locales';

function ShareQueryBtn({ queryEditor }) {
  const getUrl = (callback) => {
    const sharedQuery = {
      dbId: queryEditor.dbId,
      title: queryEditor.title,
      schema: queryEditor.schema,
      autorun: queryEditor.autorun,
      sql: queryEditor.sql,
    };
    storeQuery(sharedQuery, callback);
  };

  return (
    <CopyToClipboard
      copyNode={(
        <Button size="sm" className="toggleSave">
          <i className="fa fa-clipboard" /> {t('Share Query')}
        </Button>
      )}
      tooltipText={t('copy URL to clipboard')}
      shouldShowText={false}
      getText={getUrl}
    />
  );
}

ShareQueryBtn.propTypes = {
  queryEditor: PropTypes.object.isRequired,
};

export default ShareQueryBtn;
