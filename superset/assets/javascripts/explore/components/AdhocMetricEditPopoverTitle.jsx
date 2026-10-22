import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { FormControl, OverlayTrigger, Tooltip } from 'react-bootstrap';

import AdhocMetric from '../AdhocMetric';

const propTypes = {
  adhocMetric: PropTypes.instanceOf(AdhocMetric),
  onChange: PropTypes.func.isRequired,
};

export default function AdhocMetricEditPopoverTitle({ adhocMetric, onChange }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditable, setIsEditable] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditable && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditable]);

  const editPrompt = <Tooltip id="edit-metric-label-tooltip">Click to edit label</Tooltip>;
  const trigger = isEditable ? (
    <FormControl
      ref={inputRef}
      id="metric-edit-popover-label"
      name="metric-edit-popover-label"
      className="metric-edit-popover-label-input"
      type="text"
      placeholder={adhocMetric.label}
      value={adhocMetric.hasCustomLabel ? adhocMetric.label : ''}
      onChange={onChange}
      onBlur={() => setIsEditable(false)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    />
  ) : (
    <span
      onClick={() => setIsEditable(true)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {adhocMetric.hasCustomLabel ? adhocMetric.label : 'My Metric'}
      &nbsp;
      <i
        className="fa fa-pencil"
        style={{ color: isHovered ? 'black' : 'grey' }}
      />
    </span>
  );

  return (
    <OverlayTrigger placement="top" overlay={editPrompt}>
      {trigger}
    </OverlayTrigger>
  );
}

AdhocMetricEditPopoverTitle.propTypes = propTypes;
