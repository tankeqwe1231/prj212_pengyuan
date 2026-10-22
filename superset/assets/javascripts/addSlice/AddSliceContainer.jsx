import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Button, Card, Container, Row, Col } from 'react-bootstrap';
import Select from 'react-select';
import visTypes from '../explore/stores/visTypes';
import { t } from '../locales';
import { normalizeSelectValue } from '../components/selectUtils';
import WindowedMenuList from '../components/WindowedMenuList';

const windowedComponents = { MenuList: WindowedMenuList };
const vizTypeOptions = Object.keys(visTypes).map(vt => ({
  label: visTypes[vt].label,
  value: vt,
}));

const propTypes = {
  datasources: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string.isRequired,
    value: PropTypes.string.isRequired,
  })).isRequired,
};

function AddSliceContainer(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(AddSliceContainer.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = AddSliceContainer.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    visType: 'table'
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
  function exploreUrl() {
    const formData = encodeURIComponent(JSON.stringify({
      viz_type: stateRef.current.visType,
      datasource: stateRef.current.datasourceValue
    }));
    return `/superset/explore/?form_data=${formData}`;
  }
  function gotoSlice() {
    window.location.href = exploreUrl();
  }
  function changeDatasource(e) {
    updateState({
      datasourceValue: e.value,
      datasourceId: e.value.split('__')[0],
      datasourceType: e.value.split('__')[1]
    });
  }
  function changeVisType(e) {
    updateState({
      visType: e.value
    });
  }
  function isBtnDisabled() {
    return !(stateRef.current.datasourceId && stateRef.current.visType);
  }
  propsRef.current = props;
  return <div className="container">
        <Card>
          <Card.Header><h3>{t('Create a new slice')}</h3></Card.Header>
          <Card.Body>
          <Container>
            <Row>
              <Col xs={12} sm={6}>
                <div>
                  <p>{t('Choose a datasource')}</p>
                  <Select isClearable={false} classNamePrefix="Select" components={windowedComponents} name="select-datasource" onChange={changeDatasource.bind(undefined)} options={propsRef.current.datasources} placeholder={t('Choose a datasource')} value={normalizeSelectValue(stateRef.current.datasourceValue, propsRef.current.datasources)} />
                </div>
                <br />
                <div>
                  <p>{t('Choose a visualization type')}</p>
                  <Select isClearable={false} classNamePrefix="Select" components={windowedComponents} name="select-vis-type" onChange={changeVisType} options={vizTypeOptions} placeholder={t('Choose a visualization type')} value={normalizeSelectValue(stateRef.current.visType, vizTypeOptions)} />
                </div>
                <br />
                <Button variant="primary" disabled={isBtnDisabled()} onClick={gotoSlice.bind(undefined)}>
                  {t('Create new slice')}
                </Button>
                <br /><br />
              </Col>
            </Row>
          </Container>
          </Card.Body>
        </Card>
      </div>;
}


export default AddSliceContainer;

AddSliceContainer.propTypes = propTypes;
