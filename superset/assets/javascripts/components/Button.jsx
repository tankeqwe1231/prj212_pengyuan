import React from 'react';
import PropTypes from 'prop-types';
import { Button as BootstrapButton, Tooltip, OverlayTrigger } from 'react-bootstrap';
import { slugify } from '../modules/utils';

const propTypes = {
  tooltip: PropTypes.node,
  placement: PropTypes.string,
};
export default function Button({ size = 'sm', placement = 'top', tooltip, ...buttonProps }) {
  let button = (
    <BootstrapButton {...buttonProps} size={size} />
  );
  if (tooltip) {
    button = (
      <OverlayTrigger
        placement={placement}
        overlay={<Tooltip id={`${slugify(tooltip)}-tooltip`}>{tooltip}</Tooltip>}
      >
        {button}
      </OverlayTrigger>
    );
  }
  return button;
}

Button.propTypes = propTypes;
