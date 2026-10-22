import React, { cloneElement, isValidElement } from 'react';
import PropTypes from 'prop-types';
import { Tooltip, OverlayTrigger } from 'react-bootstrap';
import { slugify } from '../modules/utils';

const propTypes = {
  label: PropTypes.string.isRequired,
  tooltip: PropTypes.node.isRequired,
  children: PropTypes.node.isRequired,
  placement: PropTypes.string,
  onClick: PropTypes.func,
};

// Legacy pages without a doctype report the document height as clientHeight.
// Keep top/left anchoring so Popper does not use it for bottom/right offsets.
const popperConfig = {
  modifiers: [{ name: 'computeStyles', options: { adaptive: false } }],
};

export default function TooltipWrapper({ label, tooltip, children, placement = 'top', onClick }) {
  const trigger = onClick && isValidElement(children)
    ? cloneElement(children, {
      onClick: event => {
        if (children.props.onClick) {
          children.props.onClick(event);
        }
        if (!event.defaultPrevented) {
          onClick(event);
        }
      },
    })
    : children;

  return (
    <OverlayTrigger
      placement={placement}
      popperConfig={popperConfig}
      overlay={<Tooltip id={`${slugify(label)}-tooltip`}>{tooltip}</Tooltip>}
    >
      {trigger}
    </OverlayTrigger>
  );
}

TooltipWrapper.propTypes = propTypes;
