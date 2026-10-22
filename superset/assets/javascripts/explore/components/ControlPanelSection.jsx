import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Card, Collapse } from 'react-bootstrap';
import InfoTooltipWithTrigger from '../../components/InfoTooltipWithTrigger';

const propTypes = {
  label: PropTypes.string,
  description: PropTypes.string,
  children: PropTypes.node.isRequired,
  startExpanded: PropTypes.bool,
  hasErrors: PropTypes.bool,
};

const defaultProps = {
  label: null,
  description: null,
  startExpanded: false,
  hasErrors: false,
};

function ControlPanelSection(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(ControlPanelSection.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = ControlPanelSection.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    expanded: propsRef.current.startExpanded
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
  function toggleExpand() {
    updateState({
      expanded: !stateRef.current.expanded
    });
  }
  function renderHeader() {
    const {
      label,
      hasErrors
    } = propsRef.current;
    return label && <div className="control-panel-section-titlebar" onClick={toggleExpand}>
          <span className="control-panel-section-label">{label}</span>
          {hasErrors && <span onClick={event => event.stopPropagation()}>
            <InfoTooltipWithTrigger label="validation-errors" variant="danger" tooltip="This section contains validation errors" />
          </span>}
          <span className="control-panel-section-rule" aria-hidden="true" />
          <i
            className={`expander fa fa-angle-right${stateRef.current.expanded ? ' expanded' : ' collapsed'}`}
            aria-expanded={stateRef.current.expanded}
          />
        </div>;
  }
  propsRef.current = props;
  return <Card className="control-panel-section">
        <Card.Header className="control-panel-section-header">{renderHeader()}</Card.Header>
        <Collapse in={stateRef.current.expanded}>
          <div><Card.Body>{propsRef.current.children}</Card.Body></div>
        </Collapse>
      </Card>;
}


export default ControlPanelSection;

ControlPanelSection.propTypes = propTypes;
ControlPanelSection.defaultProps = defaultProps;
