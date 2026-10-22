import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Badge } from 'react-bootstrap';
import moment from 'moment';
import TooltipWrapper from './TooltipWrapper';
import { t } from '../locales';

const propTypes = {
  onClick: PropTypes.func,
  cachedTimestamp: PropTypes.string,
  className: PropTypes.string,
};

function CacheLabel({ onClick, cachedTimestamp, className }) {
  const [tooltipContent, setTooltipContent] = useState('');
  const [hovered, setHovered] = useState(false);
  const updateTooltipContent = () => {
    const cachedText = cachedTimestamp ? <span>
        {t('Loaded data cached')}
        <b> {moment.utc(cachedTimestamp).fromNow()}</b>
      </span> : t('Loaded from cache');
    const nextTooltipContent = <span>
        {cachedText}. {t('Click to force-refresh')}
      </span>;
    setTooltipContent(nextTooltipContent);
  };
  const mouseOver = () => {
    updateTooltipContent();
    setHovered(true);
  };
  const mouseOut = () => setHovered(false);
  const labelStyle = hovered ? 'primary' : 'secondary';
  return <TooltipWrapper tooltip={tooltipContent} label="cache-desc">
        <Badge className={className} bg={labelStyle} style={{
        fontSize: '10px',
        marginRight: '5px',
        cursor: 'pointer'
      }} onClick={onClick} onMouseOver={mouseOver} onMouseOut={mouseOut}>
          cached <i className="fa fa-refresh" />
        </Badge>
      </TooltipWrapper>;
}
CacheLabel.propTypes = propTypes;

export default CacheLabel;
