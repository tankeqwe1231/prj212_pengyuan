/* global notify */
import moment from 'moment';
import React, { useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { Alert, Button, Col, Modal } from 'react-bootstrap';

import Select from 'react-select';
import shortid from 'shortid';
import { exportChart } from '../../explore/exploreUtils';
import * as actions from '../actions';
import { VISUALIZE_VALIDATION_ERRORS } from '../constants';
import visTypes from '../../explore/stores/visTypes';
import { t } from '../../locales';
import AppTable from '../../components/AppTable/AppTable';
import { normalizeSelectValue } from '../../components/selectUtils';

const CHART_TYPES = Object.keys(visTypes)
  .filter(typeName => !!visTypes[typeName].showOnExplore)
  .map((typeName) => {
    const vis = visTypes[typeName];
    return {
      value: typeName,
      label: vis.label,
      requiresTime: !!vis.requiresTime,
    };
  });

const AGGREGATE_OPTIONS = [{
  value: 'sum',
  label: 'SUM(x)'
}, {
  value: 'min',
  label: 'MIN(x)'
}, {
  value: 'max',
  label: 'MAX(x)'
}, {
  value: 'avg',
  label: 'AVG(x)'
}, {
  value: 'count_distinct',
  label: 'COUNT(DISTINCT x)'
}];

const propTypes = {
  actions: PropTypes.object.isRequired,
  onHide: PropTypes.func,
  query: PropTypes.object,
  show: PropTypes.bool,
  schema: PropTypes.string,
  datasource: PropTypes.string,
  errorMessage: PropTypes.string,
  timeout: PropTypes.number,
};
const defaultProps = {
  show: false,
  query: {},
  onHide: () => {},
};

const tableColumns = [
  { accessorKey: 'column', header: 'column' },
  { accessorKey: 'is_dimension', header: 'is_dimension' },
  { accessorKey: 'is_date', header: 'is_date' },
  { accessorKey: 'agg_func', header: 'agg_func' },
];

function VisualizeModal(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(VisualizeModal.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = VisualizeModal.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    chartType: CHART_TYPES[0],
    datasourceName: datasourceName(),
    columns: getColumnFromProps(),
    schema: props.query ? props.query.schema : null,
    hints: []
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
  function getColumnFromProps() {
    const props = propsRef.current;
    if (!props || !props.query || !props.query.results || !props.query.results.columns) {
      return {};
    }
    const columns = {};
    props.query.results.columns.forEach(col => {
      columns[col.name] = col;
    });
    return columns;
  }
  function datasourceName() {
    const {
      query
    } = propsRef.current;
    const uniqueId = shortid.generate();
    let datasourceName = uniqueId;
    if (query) {
      datasourceName = query.user ? `${query.user}-` : '';
      datasourceName += query.db ? `${query.db}-` : '';
      datasourceName += `${query.tab}-${uniqueId}`;
    }
    return datasourceName;
  }
  function validate() {
    const hints = [];
    const cols = mergedColumns();
    const re = /^\w+$/;
    Object.keys(cols).forEach(colName => {
      if (!re.test(colName)) {
        hints.push(<div>
            {t('%s is not right as a column name, please alias it ' + '(as in SELECT count(*) ', colName)} <strong>{t('AS my_alias')}</strong>) {t('using only ' + 'alphanumeric characters and underscores')}
          </div>);
      }
    });
    if (stateRef.current.chartType === null) {
      hints.push(VISUALIZE_VALIDATION_ERRORS.REQUIRE_CHART_TYPE);
    } else if (stateRef.current.chartType.requiresTime) {
      let hasTime = false;
      for (const colName in cols) {
        const col = cols[colName];
        if (col.hasOwnProperty('is_date') && col.is_date) {
          hasTime = true;
        }
      }
      if (!hasTime) {
        hints.push(VISUALIZE_VALIDATION_ERRORS.REQUIRE_TIME);
      }
    }
    updateState({
      hints
    });
  }
  function changeChartType(option) {
    updateState({
      chartType: option
    }, validate);
  }
  function mergedColumns() {
    const columns = Object.assign({}, stateRef.current.columns);
    if (propsRef.current.query && propsRef.current.query.results && propsRef.current.query.results.columns) {
      propsRef.current.query.results.columns.forEach(col => {
        if (columns[col.name] === undefined) {
          columns[col.name] = col;
        }
      });
    }
    return columns;
  }
  function buildVizOptions() {
    return {
      chartType: stateRef.current.chartType.value,
      schema: stateRef.current.schema,
      datasourceName: stateRef.current.datasourceName,
      columns: stateRef.current.columns,
      sql: propsRef.current.query.sql,
      dbId: propsRef.current.query.dbId
    };
  }
  function buildVisualizeAdvise() {
    let advise;
    const timeout = propsRef.current.timeout;
    const queryDuration = moment.duration(propsRef.current.query.endDttm - propsRef.current.query.startDttm);
    if (Math.round(queryDuration.asMilliseconds()) > timeout * 1000) {
      advise = <Alert variant="warning">
          This query took {Math.round(queryDuration.asSeconds())} seconds to run,
          and the explore view times out at {timeout} seconds,
          following this flow will most likely lead to your query timing out.
          We recommend your summarize your data further before following that flow.
          If activated you can use the <strong>CREATE TABLE AS</strong> feature
          to store a summarized data set that you can then explore.
        </Alert>;
    }
    return advise;
  }
  function visualize() {
    propsRef.current.actions.createDatasource(buildVizOptions(), undefined).done(resp => {
      const columns = Object.keys(stateRef.current.columns).map(k => stateRef.current.columns[k]);
      const data = JSON.parse(resp);
      const mainGroupBy = columns.filter(d => d.is_dim)[0];
      const formData = {
        datasource: `${data.table_id}__table`,
        viz_type: stateRef.current.chartType.value,
        since: '100 years ago',
        limit: '0'
      };
      if (mainGroupBy) {
        formData.groupby = [mainGroupBy.name];
      }
      notify.info(t('Creating a data source and popping a new tab'));

      // open new window for data visualization
      exportChart(formData);
    }).fail(() => {
      notify.error(propsRef.current.errorMessage);
    });
  }
  function changeDatasourceName(event) {
    updateState({
      datasourceName: event.target.value
    }, validate);
  }
  function changeCheckbox(attr, columnName, event) {
    let columns = mergedColumns();
    const column = Object.assign({}, columns[columnName], {
      [attr]: event.target.checked
    });
    columns = Object.assign({}, columns, {
      [columnName]: column
    });
    updateState({
      columns
    }, validate);
  }
  function changeAggFunction(columnName, option) {
    let columns = mergedColumns();
    const val = option ? option.value : null;
    const column = Object.assign({}, columns[columnName], {
      agg: val
    });
    columns = Object.assign({}, columns, {
      [columnName]: column
    });
    updateState({
      columns
    }, validate);
  }
  propsRef.current = props;
  useLayoutEffect(() => {
    validate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!propsRef.current.query || !propsRef.current.query.results || !propsRef.current.query.results.columns) {
    return <div className="VisualizeModal">
          <Modal show={propsRef.current.show} onHide={propsRef.current.onHide}>
            <Modal.Body>
              {t('No results available for this query')}
            </Modal.Body>
          </Modal>
        </div>;
  }
  const tableData = propsRef.current.query.results.columns.map(col => ({
    column: col.name,
    is_dimension: <input type="checkbox" onChange={changeCheckbox.bind(undefined, 'is_dim', col.name)} checked={stateRef.current.columns[col.name] ? stateRef.current.columns[col.name].is_dim : false} className="form-control" />,
    is_date: <input type="checkbox" className="form-control" onChange={changeCheckbox.bind(undefined, 'is_date', col.name)} checked={stateRef.current.columns[col.name] ? stateRef.current.columns[col.name].is_date : false} />,
    agg_func: <Select classNamePrefix="Select" options={AGGREGATE_OPTIONS} onChange={changeAggFunction.bind(undefined, col.name)} value={normalizeSelectValue(stateRef.current.columns[col.name] ? stateRef.current.columns[col.name].agg : null, AGGREGATE_OPTIONS)} />
  }));
  const alerts = stateRef.current.hints.map((hint, i) => <Alert variant="warning" key={i}>{hint}</Alert>);
  const modal = <div className="VisualizeModal">
        <Modal show={propsRef.current.show} onHide={propsRef.current.onHide}>
          <Modal.Header closeButton>
            <Modal.Title>{t('Visualize')}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {alerts}
            {buildVisualizeAdvise()}
            <div className="row">
              <Col md={6}>
                {t('Chart Type')}
                <Select classNamePrefix="Select" name="select-chart-type" placeholder={t('[Chart Type]')} options={CHART_TYPES} value={stateRef.current.chartType} onChange={changeChartType.bind(undefined)} />
              </Col>
              <Col md={6}>
                {t('Datasource Name')}
                <input id="visualize-datasource-name" name="visualize-datasource-name" type="text" className="form-control form-control-sm" placeholder={t('datasource name')} onChange={changeDatasourceName.bind(undefined)} value={stateRef.current.datasourceName} />
              </Col>
            </div>
            <hr />
            <AppTable className="table table-sm" columns={tableColumns} data={tableData} />
            <Button onClick={visualize.bind(undefined)} variant="primary" disabled={stateRef.current.hints.length > 0}>
              {t('Visualize')}
            </Button>
          </Modal.Body>
        </Modal>
      </div>;
  return modal;
}


VisualizeModal.propTypes = propTypes;
VisualizeModal.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {
    datasource: state.datasource,
    errorMessage: state.errorMessage,
    timeout: state.common ? state.common.conf.SUPERSET_WEBSERVER_TIMEOUT : null,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export { VisualizeModal };
export default connect(mapStateToProps, mapDispatchToProps)(VisualizeModal);
