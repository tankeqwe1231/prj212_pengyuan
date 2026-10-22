import React from 'react';
import PropTypes from 'prop-types';
import { Badge } from 'react-bootstrap';

import { t } from '../../locales';
import { defaultNumberFormatter } from '../../modules/utils';
import TooltipWrapper from '../../components/TooltipWrapper';


const propTypes = {
  rowcount: PropTypes.number,
  limit: PropTypes.number,
};

export default function RowCountLabel({ rowcount, limit }) {
  const limitReached = rowcount === limit;
  const variant = (limitReached || rowcount === 0) ? 'warning' : 'secondary';
  const formattedRowCount = defaultNumberFormatter(rowcount);
  const tooltip = (
    <span>
      {limitReached &&
        <div>{t('Limit reached')}</div>}
      {rowcount}
    </span>
  );
  return (
    <TooltipWrapper label="tt-rowcount" tooltip={tooltip}>
      <Badge
        bg={variant}
        style={{ fontSize: '10px', marginRight: '5px', cursor: 'pointer' }}
      >
        {formattedRowCount} rows
      </Badge>
    </TooltipWrapper>
  );
}

RowCountLabel.propTypes = propTypes;
