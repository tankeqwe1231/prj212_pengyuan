import React from 'react';
import PropTypes from 'prop-types';
import CopyToClipboard from '../../components/CopyToClipboard';
import { storeQuery } from '../../utils/common';
import { t } from '../../locales';

const propTypes = {
  queryEditor: PropTypes.object.isRequired,
};

function CopyQueryTabUrl({ queryEditor }) {
  const getUrl = callback => {
    const qe = queryEditor;
    const sharedQuery = {
      dbId: qe.dbId,
      title: qe.title,
      schema: qe.schema,
      autorun: qe.autorun,
      sql: qe.sql
    };
    storeQuery(sharedQuery, callback);
  };
    return <CopyToClipboard inMenu copyNode={<div>
            <i className="fa fa-clipboard" /> <span>{t('share query')}</span>
          </div>} tooltipText={t('copy URL to clipboard')} shouldShowText={false} getText={getUrl} />;
}
export default CopyQueryTabUrl;

CopyQueryTabUrl.propTypes = propTypes;
