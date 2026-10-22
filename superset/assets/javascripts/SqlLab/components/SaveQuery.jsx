import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Col, FormControl, FormGroup, FormLabel, Row } from 'react-bootstrap';

import Button from '../../components/Button';
import ModalTrigger from '../../components/ModalTrigger';
import { t } from '../../locales';

const propTypes = {
  defaultLabel: PropTypes.string,
  sql: PropTypes.string,
  schema: PropTypes.string,
  dbId: PropTypes.number,
  animation: PropTypes.bool,
  onSave: PropTypes.func,
};
const defaultProps = {
  defaultLabel: t('Undefined'),
  animation: true,
  onSave: () => {},
};

function SaveQuery(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(SaveQuery.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = SaveQuery.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    description: '',
    label: props.defaultLabel,
    showSave: false
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
  const saveModalRef = useRef(undefined);
  function onSave() {
    const query = {
      label: stateRef.current.label,
      description: stateRef.current.description,
      db_id: propsRef.current.dbId,
      schema: propsRef.current.schema,
      sql: propsRef.current.sql
    };
    propsRef.current.onSave(query);
    saveModalRef.current.close();
  }
  function onCancel() {
    saveModalRef.current.close();
  }
  function onLabelChange(e) {
    updateState({
      label: e.target.value
    });
  }
  function onDescriptionChange(e) {
    updateState({
      description: e.target.value
    });
  }
  function toggleSave(e) {
    updateState({
      target: e.target,
      showSave: !stateRef.current.showSave
    });
  }
  function renderModalBody() {
    return <FormGroup>
        <Row>
          <Col md={12}>
            <small>
              <FormLabel htmlFor="save-query-label">
                {t('Label')}
              </FormLabel>
            </small>
            <FormControl id="save-query-label" name="save-query-label" type="text" placeholder={t('Label for your query')} value={stateRef.current.label} onChange={onLabelChange} />
          </Col>
        </Row>
        <br />
        <Row>
          <Col md={12}>
            <small>
              <FormLabel htmlFor="save-query-description">{t('Description')}</FormLabel>
            </small>
            <FormControl id="save-query-description" name="save-query-description" as="textarea" placeholder={t('Write a description for your query')} value={stateRef.current.description} onChange={onDescriptionChange} />
          </Col>
        </Row>
        <br />
        <Row>
          <Col md={12}>
            <Button variant="primary" onClick={onSave} className="m-r-3">
              {t('Save')}
            </Button>
            <Button onClick={onCancel} className="cancelQuery">
              {t('Cancel')}
            </Button>
          </Col>
        </Row>
      </FormGroup>;
  }
  propsRef.current = props;
  return <span className="SaveQuery">
        <ModalTrigger ref={ref => {
      saveModalRef.current = ref;
    }} modalTitle={t('Save Query')} modalBody={renderModalBody()} triggerNode={<Button size="sm" className="toggleSave" onClick={toggleSave}>
              <i className="fa fa-save" /> {t('Save Query')}
            </Button>} size="sm" />
      </span>;
}


SaveQuery.propTypes = propTypes;
SaveQuery.defaultProps = defaultProps;

export default SaveQuery;
