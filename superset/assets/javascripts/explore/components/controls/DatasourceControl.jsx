/* global notify */
import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Badge, Card, Col, Collapse, FormControl, Modal,
  OverlayTrigger, Row, Tooltip,
} from 'react-bootstrap';

import ControlHeader from '../ControlHeader';
import { t } from '../../../locales';
import ColumnOption from '../../../components/ColumnOption';
import MetricOption from '../../../components/MetricOption';
import AppTable from '../../../components/AppTable/AppTable';

const propTypes = {
  description: PropTypes.string,
  label: PropTypes.string,
  name: PropTypes.string.isRequired,
  onChange: PropTypes.func,
  value: PropTypes.string.isRequired,
  datasource: PropTypes.object.isRequired,
};

const defaultProps = {
  onChange: () => {},
};

function DatasourceControl(incomingProps) {
  const props = { ...incomingProps };
  Object.keys(DatasourceControl.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = DatasourceControl.defaultProps[key];
  });
  const propsRef = useRef(props);
  propsRef.current = props;
  const [state, setState] = useState(() => ({
    showModal: false,
    filter: '',
    loading: true,
    showDatasource: false
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
  const searchRefRef = useRef(undefined);
  function onEnterModal() {
    if (searchRefRef.current) {
      searchRefRef.current.focus();
    }
    const url = '/superset/datasources/';
    if (!stateRef.current.datasources) {
      $.ajax({
        type: 'GET',
        url,
        success: data => {
          const datasources = data.map(ds => ({
            rawName: ds.name,
            connection: ds.connection,
            creator: ds.creator,
            schema: ds.schema,
            name: <a href="#" onClick={selectDatasource.bind(undefined, ds.uid)} className="datasource-link">
                {ds.name}
              </a>,
            type: ds.type
          }));
          updateState({
            loading: false,
            datasources
          });
        },
        error() {
          updateState({
            loading: false
          });
          notify.error(t('Something went wrong while fetching the datasource list'));
        }
      });
    }
  }
  function setSearchRef(searchRef) {
    searchRefRef.current = searchRef;
  }
  function toggleShowDatasource() {
    updateState({
      showDatasource: !stateRef.current.showDatasource
    });
  }
  function toggleModal() {
    updateState({
      showModal: !stateRef.current.showModal
    });
  }
  function changeSearch(event) {
    updateState({
      filter: event.target.value
    });
  }
  function selectDatasource(datasourceId) {
    updateState({
      showModal: false
    });
    propsRef.current.onChange(datasourceId);
  }
  function renderModal() {
    const columns = [{
      accessorFn: row => row.rawName,
      cell: info => info.row.original.name,
      enableGlobalFilter: true,
      header: 'name',
      id: 'name'
    }, ...['type', 'schema', 'connection', 'creator'].map(column => ({
      accessorKey: column,
      enableGlobalFilter: true,
      header: column
    }))];
    return <Modal show={stateRef.current.showModal} onHide={toggleModal} onEnter={onEnterModal} onExit={setSearchRef} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{t('Select a datasource')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div>
            <FormControl id="formControlsText" ref={ref => {
            setSearchRef(ref);
          }} type="text" size="sm" value={stateRef.current.filter} placeholder={t('Search / Filter')} onChange={changeSearch} />
          </div>
          {stateRef.current.loading && <img className="loading" alt="Loading..." src="/static/assets/images/loading.gif" />}
          {stateRef.current.datasources && <AppTable columns={columns} className="table table-sm" data={stateRef.current.datasources} globalFilter={stateRef.current.filter} pageSize={20} />}
        </Modal.Body>
      </Modal>;
  }
  function renderDatasource() {
    const datasource = propsRef.current.datasource;
    return <div className="m-t-10">
        <Card className="m-t-0 bg-light"><Card.Body>
          <div className="m-b-10">
            <Badge>
              <i className="fa fa-database" /> {datasource.database.backend}
            </Badge>
            {` ${datasource.database.name} `}
          </div>
          <Row className="datasource-container">
            <Col md={6}>
              <strong>Columns</strong>
              {datasource.columns.map(col => <div key={col.column_name}><ColumnOption showType column={col} /></div>)}
            </Col>
            <Col md={6}>
              <strong>Metrics</strong>
              {datasource.metrics.map(m => <div key={m.metric_name}><MetricOption metric={m} showType /></div>)}
            </Col>
          </Row>
        </Card.Body></Card>
      </div>;
  }
  return <div>
        <ControlHeader {...propsRef.current} />
        <OverlayTrigger placement="right" overlay={<Tooltip id={'error-tooltip'}>{t('Click to point to another datasource')}</Tooltip>}>
          <Badge onClick={toggleModal} style={{
        cursor: 'pointer'
      }} className="m-r-5 bg-secondary">
            {propsRef.current.datasource.name}
          </Badge>
        </OverlayTrigger>
        <OverlayTrigger placement="right" overlay={<Tooltip id={'edit-datasource-tooltip'}>
              {t('Edit the datasource\'s configuration')}
            </Tooltip>}>
          <a href={propsRef.current.datasource.edit_url}>
            <i className="fa fa-edit m-r-5" />
          </a>
        </OverlayTrigger>
        <OverlayTrigger placement="right" overlay={<Tooltip id={'toggle-datasource-tooltip'}>
              {t('Show datasource configuration')}
            </Tooltip>}>
          <a href="#">
            <i className={`fa fa-${stateRef.current.showDatasource ? 'minus' : 'plus'}-square m-r-5`} onClick={toggleShowDatasource} />
          </a>
        </OverlayTrigger>
        <Collapse in={stateRef.current.showDatasource}>
          {renderDatasource()}
        </Collapse>
        {renderModal()}
      </div>;
}


export default DatasourceControl;

DatasourceControl.propTypes = propTypes;
DatasourceControl.defaultProps = defaultProps;
