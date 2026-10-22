import React, { useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Badge, OverlayTrigger } from 'react-bootstrap';

import AdhocMetricEditPopover from './AdhocMetricEditPopover';
import AdhocMetric from '../AdhocMetric';
import columnType from '../propTypes/columnType';

const propTypes = {
  adhocMetric: PropTypes.instanceOf(AdhocMetric),
  onMetricEdit: PropTypes.func.isRequired,
  columns: PropTypes.arrayOf(columnType),
  multi: PropTypes.bool,
  datasourceType: PropTypes.string,
};

const popperConfig = {
  strategy: 'fixed',
};

function AdhocMetricOption(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(AdhocMetricOption.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = AdhocMetricOption.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    showMetricEditor: false
  }));
  const stateRef = useRef(state);
  stateRef.current = state;
  const updateState = (update, callback) => {
    const previous = stateRef.current;
    const partial = typeof update === 'function' ? update(previous, propsRef.current) : update;
    if (partial == null) return;
    const next = {
      ...previous,
      ...partial
    };
    stateRef.current = next;
    setState(next);
    if (typeof callback === 'function') callback();
  };
  function closeMetricEditOverlay() {
    updateState({
      showMetricEditor: false
    });
  }
  propsRef.current = props;
  useLayoutEffect(() => {
    if (!propsRef.current.adhocMetric.fromFormData) {
      updateState({
        showMetricEditor: true
      });
    }
  }, []);
  const {
    adhocMetric
  } = propsRef.current;
  const overlay = <AdhocMetricEditPopover adhocMetric={adhocMetric} onChange={propsRef.current.onMetricEdit} onClose={closeMetricEditOverlay} columns={propsRef.current.columns} datasourceType={propsRef.current.datasourceType} />;
  return <OverlayTrigger placement="right" trigger="click" overlay={overlay} rootClose popperConfig={popperConfig} show={stateRef.current.showMetricEditor} onToggle={showMetricEditor => updateState({
    showMetricEditor
  })}>
        <Badge bg="secondary" style={{
      margin: propsRef.current.multi ? 0 : 3,
      cursor: 'pointer'
    }}>
          <div onMouseDownCapture={e => {
        e.stopPropagation();
      }}>
            <span className="m-r-5 option-label">
              {adhocMetric.label}
            </span>
          </div>
        </Badge>
      </OverlayTrigger>;
}


export default AdhocMetricOption;
AdhocMetricOption.propTypes = propTypes;
