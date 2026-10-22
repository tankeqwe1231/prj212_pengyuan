import React from 'react';
import PropTypes from 'prop-types';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';

const propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  href: PropTypes.string,
  onClick: PropTypes.func,
  placement: PropTypes.string,
  style: PropTypes.object,
  tooltip: PropTypes.string,
};
function Link({ children, className = '', href = '#', onClick = () => {}, placement = 'top', style = {}, tooltip = null }) {
    const tooltipNode = <Tooltip id="tooltip">
        {tooltip}
      </Tooltip>;
    const link = <a href={href} onClick={onClick} style={style} className={'Link ' + className}>
        {children}
      </a>;
    if (tooltip) {
      return <OverlayTrigger overlay={tooltipNode} placement={placement} delay={{ show: 300, hide: 150 }}>
          {link}
        </OverlayTrigger>;
    }
    return link;
}
Link.propTypes = propTypes;

export default Link;
