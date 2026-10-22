import React from 'react';
import PropTypes from 'prop-types';
import { Tooltip, OverlayTrigger } from 'react-bootstrap';
import { slugify } from '../modules/utils';

const propTypes = {
  label: PropTypes.string.isRequired,
  tooltip: PropTypes.string,
  icon: PropTypes.string,
  className: PropTypes.string,
  onClick: PropTypes.func,
  placement: PropTypes.string,
  variant: PropTypes.string,
};
const tooltipStyle = { wordWrap: 'break-word' };

const InfoTooltipWithTrigger = React.forwardRef(({
    label, tooltip, icon = 'info-circle', className = 'text-muted', onClick,
    placement = 'right', variant }, ref) => {
  const iconClass = `fa fa-${icon} ${className} ${variant ? `text-${variant}` : ''}`;
  const iconEl = (
    <i
      ref={ref}
      className={iconClass}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : null }}
    />
  );
  if (!tooltip) {
    return iconEl;
  }
  return (
    <OverlayTrigger
      placement={placement}
      overlay={
        <Tooltip id={`${slugify(label)}-tooltip`} style={tooltipStyle}>
          {tooltip}
        </Tooltip>
      }
    >
      {iconEl}
    </OverlayTrigger>
  );
});

InfoTooltipWithTrigger.displayName = 'InfoTooltipWithTrigger';

InfoTooltipWithTrigger.propTypes = propTypes;

export default InfoTooltipWithTrigger;
