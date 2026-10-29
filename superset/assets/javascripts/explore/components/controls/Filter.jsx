import React from 'react';
import PropTypes from 'prop-types';
import Select from 'react-select';
import { Button, Row, Col } from 'react-bootstrap';
import SelectControl from './SelectControl';
import { t } from '../../../locales';
import { normalizeSelectValue } from '../../../components/selectUtils';

const operatorsArr = [
  { val: 'in', type: 'array', useSelect: true, multi: true },
  { val: 'not in', type: 'array', useSelect: true, multi: true },
  { val: '==', type: 'string', useSelect: true, multi: false, havingOnly: true },
  { val: '!=', type: 'string', useSelect: true, multi: false, havingOnly: true },
  { val: '>=', type: 'string', havingOnly: true },
  { val: '<=', type: 'string', havingOnly: true },
  { val: '>', type: 'string', havingOnly: true },
  { val: '<', type: 'string', havingOnly: true },
  { val: 'regex', type: 'string', datasourceTypes: ['druid'] },
  { val: 'LIKE', type: 'string', datasourceTypes: ['table'] },
];
const operators = {};
operatorsArr.forEach((op) => {
  operators[op.val] = op;
});

const propTypes = {
  changeFilter: PropTypes.func,
  removeFilter: PropTypes.func,
  filter: PropTypes.object.isRequired,
  datasource: PropTypes.object,
  having: PropTypes.bool,
  valuesLoading: PropTypes.bool,
  valueChoices: PropTypes.array,
  vizType: PropTypes.string,
};

function Filter({ changeFilter = () => {}, removeFilter = () => {}, filter, datasource = null, having = false, valuesLoading = false, valueChoices = [], vizType }) {
  const switchFilterValue = (prevOp, nextOp) => {
    if (operators[prevOp].type !== operators[nextOp].type) {
      // Switch from array to string or vice versa
      const val = filter.val;
      let newVal;
      if (operators[nextOp].type === 'string') {
        if (!val || !val.length) {
          newVal = '';
        } else {
          newVal = val[0];
        }
      } else if (operators[nextOp].type === 'array') {
        if (!val || !val.length) {
          newVal = [];
        } else {
          newVal = [val];
        }
      }
      changeFilter(['val', 'op'], [newVal, nextOp]);
    } else {
      // No value type change
      changeFilter('op', nextOp);
    }
  };
  const changeText = event => changeFilter('val', event.target.value);
  const changeSelect = value => changeFilter('val', value);
  const changeColumn = event => changeFilter('col', event.value);
  const changeOp = event => switchFilterValue(filter.op, event.value);
  const renderFilterFormControl = currentFilter => {
    const operator = operators[currentFilter.op];
    if (operator.useSelect && !having) {
      // TODO should use a simple Select, not a control here...
      const sortable = currentFilter.op === 'in' && (vizType === 'time_table' || vizType === 'pivot_table');
      return <SelectControl multi={operator.multi} sortable={sortable} freeForm name="filter-value" value={currentFilter.val} isLoading={valuesLoading} choices={valueChoices} onChange={changeSelect} showHeader={false} />;
    }
    return <input type="text" onChange={changeText} value={currentFilter.val || ''} className="form-control form-control-sm" placeholder={t('Filter value')} />;
  };
    const opsChoices = operatorsArr.filter(o => {
      if (having) {
        return !!o.havingOnly;
      }
      return !o.datasourceTypes || o.datasourceTypes.indexOf(datasource.type) >= 0;
    }).map(o => ({
      value: o.val,
      label: o.val
    }));
    let colChoices;
    if (datasource) {
      if (having) {
        colChoices = datasource.metrics_combo.map(c => ({
          value: c[0],
          label: c[1]
        }));
      } else {
        colChoices = datasource.filterable_cols.map(c => ({
          value: c[0],
          label: c[1]
        }));
      }
    }
    return <div className="filter-row">
        <Row className="space-1 filter-column-row">
          <Col md={12} className="filter-column-col">
            <Select classNamePrefix="Select" id="select-col" placeholder={having ? t('Select metric') : t('Select column')} isClearable={false} options={colChoices} value={normalizeSelectValue(filter.col, colChoices)} onChange={changeColumn} />
          </Col>
        </Row>
        <Row className="space-1 filter-value-row">
          <Col md={3} className="filter-operator-col">
            <Select classNamePrefix="Select" id="select-op" placeholder={t('Select operator')} options={opsChoices} isClearable={false} value={normalizeSelectValue(filter.op, opsChoices)} onChange={changeOp} />
          </Col>
          <Col md={7} className="filter-value-col">
            {renderFilterFormControl(filter)}
          </Col>
          <Col md={2} className="filter-remove-col">
            <Button id="remove-button" variant="outline-secondary" size="sm" onClick={() => removeFilter(filter)}>
              <i className="fa fa-minus" />
            </Button>
          </Col>
        </Row>
      </div>;
}
export default Filter;

Filter.propTypes = propTypes;
