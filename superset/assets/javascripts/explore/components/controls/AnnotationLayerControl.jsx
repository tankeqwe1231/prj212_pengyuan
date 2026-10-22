import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { OverlayTrigger, Popover, ListGroup, ListGroupItem } from 'react-bootstrap';
import { connect } from 'react-redux';
import { getChartKey } from '../../exploreUtils';
import { runAnnotationQuery } from '../../../chart/chartAction';
import InfoTooltipWithTrigger from '../../../components/InfoTooltipWithTrigger';


import AnnotationLayer from './AnnotationLayer';
import { t } from '../../../locales';


const propTypes = {
  colorScheme: PropTypes.string.isRequired,
  annotationError: PropTypes.object,
  annotationQuery: PropTypes.object,
  vizType: PropTypes.string,

  validationErrors: PropTypes.array,
  name: PropTypes.string.isRequired,
  actions: PropTypes.object,
  value: PropTypes.arrayOf(PropTypes.object),
  onChange: PropTypes.func,
  refreshAnnotationData: PropTypes.func,
};

const defaultProps = {
  vizType: '',
  value: [],
  annotationError: {},
  annotationQuery: {},
  onChange: () => {},
};

function AnnotationLayerControl(incomingProps) {
  const props = { ...incomingProps };
  Object.keys(AnnotationLayerControl.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = AnnotationLayerControl.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    openPopover: null
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
  function addAnnotationLayer(annotationLayer) {
    const annotation = annotationLayer;
    let annotations = propsRef.current.value.slice();
    const i = annotations.findIndex(x => x.name === (annotation.oldName || annotation.name));
    delete annotation.oldName;
    if (i > -1) {
      annotations[i] = annotation;
    } else {
      annotations = annotations.concat(annotation);
    }
    propsRef.current.refreshAnnotationData(annotation);
    propsRef.current.onChange(annotations);
  }
  function removeAnnotationLayer(annotation) {
    const annotations = propsRef.current.value.slice().filter(x => x.name !== annotation.oldName);
    propsRef.current.onChange(annotations);
  }
  function renderPopover(popoverKey, annotation, error) {
    const id = !annotation ? '_new' : annotation.name;
    return <Popover style={{
      maxWidth: 'none'
    }} id={`annotation-pop-${id}`}>
        <Popover.Header as="h3">{annotation ? 'Edit Annotation Layer' : 'Add Annotation Layer'}</Popover.Header>
        <Popover.Body>
          <AnnotationLayer {...annotation} error={error} colorScheme={propsRef.current.colorScheme} vizType={propsRef.current.vizType} addAnnotationLayer={addAnnotationLayer} removeAnnotationLayer={removeAnnotationLayer} close={() => updateState({
          openPopover: null
        })} />
        </Popover.Body>
      </Popover>;
  }
  function renderInfo(anno) {
    const {
      annotationError,
      annotationQuery
    } = propsRef.current;
    if (annotationQuery[anno.name]) {
      return <i className="fa fa-refresh" style={{
        color: 'orange'
      }} aria-hidden />;
    }
    if (annotationError[anno.name]) {
      return <InfoTooltipWithTrigger label="validation-errors" variant="danger" tooltip={annotationError[anno.name]} />;
    }
    if (!anno.show) {
      return <span style={{
        color: 'red'
      }}> Hidden </span>;
    }
    return '';
  }
  function receiveProps(nextProps) {
    const {
      name,
      annotationError,
      validationErrors,
      value
    } = nextProps;
    if (Object.keys(annotationError).length && !validationErrors.length) {
      propsRef.current.actions.setControlValue(name, value, Object.keys(annotationError));
    }
    if (!Object.keys(annotationError).length && validationErrors.length) {
      propsRef.current.actions.setControlValue(name, value, []);
    }
  }
  const previousIncomingPropsRef = useRef(incomingProps);
  const incomingKeys = Object.keys(incomingProps);
  const previousIncomingProps = previousIncomingPropsRef.current;
  const incomingPropsChanged = incomingKeys.length !== Object.keys(previousIncomingProps).length || incomingKeys.some(key => incomingProps[key] !== previousIncomingProps[key]);
  if (incomingPropsChanged) {
    receiveProps(props);
    previousIncomingPropsRef.current = incomingProps;
  }
  propsRef.current = props;
  const annotations = propsRef.current.value.map((anno, i) => {
    const popoverKey = `overlay-${i}`;
    return <OverlayTrigger key={popoverKey} trigger="click" rootClose placement="right" show={stateRef.current.openPopover === popoverKey} onToggle={show => updateState({
      openPopover: show ? popoverKey : null
    })} overlay={renderPopover(popoverKey, anno, propsRef.current.annotationError[anno.name])}>
        <ListGroupItem>
          <span>{anno.name}</span>
          <span style={{
          float: 'right'
        }}>
            {renderInfo(anno)}
          </span>
        </ListGroupItem>
      </OverlayTrigger>;
  });
  return <div>
        <ListGroup>
          {annotations}
          <OverlayTrigger trigger="click" rootClose placement="right" show={stateRef.current.openPopover === 'overlay-new'} onToggle={show => updateState({
        openPopover: show ? 'overlay-new' : null
      })} overlay={renderPopover('overlay-new')}>
            <ListGroupItem>
              <i className="fa fa-plus" /> &nbsp; {t('Add Annotation Layer')}
            </ListGroupItem>
          </OverlayTrigger>
        </ListGroup>
      </div>;
}



AnnotationLayerControl.propTypes = propTypes;
AnnotationLayerControl.defaultProps = defaultProps;

// Tried to hook this up through stores/control.jsx instead of using redux
// directly, could not figure out how to get access to the color_scheme
function mapStateToProps({ charts, explore }) {
  const chartKey = getChartKey(explore);
  return {
    colorScheme: (explore.controls || {}).color_scheme.value,
    annotationError: charts[chartKey].annotationError,
    annotationQuery: charts[chartKey].annotationQuery,
    vizType: explore.controls.viz_type.value,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    refreshAnnotationData: annotationLayer => dispatch(runAnnotationQuery(annotationLayer)),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(AnnotationLayerControl);
