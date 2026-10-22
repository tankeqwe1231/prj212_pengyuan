import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Row, Col, FormControl, FormCheck, OverlayTrigger, Popover,
} from 'react-bootstrap';
import Select from 'react-select';

import InfoTooltipWithTrigger from '../../../components/InfoTooltipWithTrigger';
import BoundsControl from './BoundsControl';
import { normalizeSelectValue } from '../../../components/selectUtils';

const propTypes = {
  onChange: PropTypes.func,
};

const defaultProps = {
  onChange: () => {},
};

const comparisonTypeOptions = [
  { value: 'value', label: 'Actual value' },
  { value: 'diff', label: 'Difference' },
  { value: 'perc', label: 'Percentage' },
  { value: 'perc_change', label: 'Percentage Change' },
];

const colTypeOptions = [
  { value: 'time', label: 'Time Comparison' },
  { value: 'contrib', label: 'Contribution' },
  { value: 'spark', label: 'Sparkline' },
  { value: 'bar', label: 'BarSeries' },
  { value: 'avg', label: 'Period Average' },
  { value: 'sum', label: 'Period Sum' },
  { value: 'max', label: 'Period Max' },
  { value: 'min', label: 'Period Min' },
  { value: 'period_volatility', label: 'Period Volatility' },
  { value: 'volatility_line', label: 'Volatility Line' },
  { value: 'period_volatility_quantile', label: 'Period Volatility Quantile' },
  { value: 'period_volatility_quantile_change', label: 'Period Volatility Quantile Change' },
  { value: 'quantile', label: 'Period Quantile' },
  { value: 'quantile_change', label: 'Period Quantile Change' },
  { value: 'period_position', label: 'Period Position' },
  { value: 'position_change', label: 'Period Position Change' },
];

const dataUiColType = ['spark', 'bar', 'volatility_line'];

function TimeSeriesColumnControl(incomingProps) {
  const props = { ...incomingProps };
  Object.keys(TimeSeriesColumnControl.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = TimeSeriesColumnControl.defaultProps[key];
  });
  const propsRef = useRef(props);
  propsRef.current = props;
  const [state, setState] = useState(() => {
    const initialState = { ...props };
    delete initialState.onChange;
    return initialState;
  });
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
  function onChange() {
    propsRef.current.onChange(stateRef.current);
  }
  function onSelectChange(attr, opt) {
    updateState({
      [attr]: opt.value
    }, onChange);
  }
  function onCheckChange(attr, event) {
    updateState({
      [attr]: event.target.checked
    }, onChange);
  }
  function onTextInputChange(attr, event) {
    updateState({
      [attr]: event.target.value
    }, onChange);
  }
  function onBoundsChange(bounds) {
    updateState({
      bounds
    }, onChange);
  }
  function onBarBoundsChange(attr, bounds) {
    updateState({
      [attr]: bounds
    }, onChange);
  }
  function textSummary() {
    return `${stateRef.current.label}`;
  }
  function edit() {}
  function formRow(label, tooltip, ttLabel, control) {
    return <Row style={{
      marginTop: '5px'
    }}>
        <Col md={5}>
          {`${label} `}
          <InfoTooltipWithTrigger placement="top" tooltip={tooltip} label={ttLabel} />
        </Col>
        <Col md={7}>{control}</Col>
      </Row>;
  }
  function renderPopover() {
    return <Popover id="ts-col-popo">
        <Popover.Header as="h3">Column Configuration</Popover.Header>
        <Popover.Body style={{
        width: 370
      }}>
          {formRow('Label', 'The column header label', 'time-lag', <FormControl value={stateRef.current.label} onChange={onTextInputChange.bind(undefined, 'label')} size="sm" placeholder="Label" />)}
          {formRow('Tooltip', 'Column header tooltip', 'col-tooltip', <FormControl value={stateRef.current.tooltip} onChange={onTextInputChange.bind(undefined, 'tooltip')} size="sm" placeholder="Tooltip" />)}
          {formRow('Type', 'Type of comparison, value difference or percentage', 'col-type', <Select classNamePrefix="Select" value={normalizeSelectValue(stateRef.current.colType, colTypeOptions)} isClearable={false} onChange={onSelectChange.bind(undefined, 'colType')} options={colTypeOptions} />)}
          <hr />
          {formRow('Width', 'Width of the column', 'column-width', <FormControl value={stateRef.current.width} onChange={onTextInputChange.bind(undefined, 'width')} size="sm" placeholder="Width" />)}
          {dataUiColType.includes(stateRef.current.colType) && formRow('Height', 'Height of the column', 'spark-height', <FormControl value={stateRef.current.height} onChange={onTextInputChange.bind(undefined, 'height')} size="sm" placeholder="height" />)}
          {['time', 'avg', 'sum', 'max', 'min', 'quantile', 'period_volatility', 'volatility_line', 'quantile_change', 'period_position', 'period_volatility_quantile', 'period_volatility_quantile_change', 'position_change'].indexOf(stateRef.current.colType) >= 0 && formRow('Time Lag', 'Number of periods to compare against', 'time-lag', <FormControl value={stateRef.current.timeLag} onChange={onTextInputChange.bind(undefined, 'timeLag')} size="sm" placeholder="Time Lag" />)}
          {['period_volatility_quantile', 'volatility_line', 'period_volatility_quantile_change'].indexOf(stateRef.current.colType) >= 0 && formRow('Rolling Periods', 'Size of the moving window', 'rolling-periods', <FormControl value={stateRef.current.rollingPeriods} onChange={onTextInputChange.bind(undefined, 'rollingPeriods')} size="sm" placeholder="Rolling Periods" />)}
          {['quantile_change', 'position_change', 'period_volatility_quantile_change'].indexOf(stateRef.current.colType) >= 0 && formRow('Change Lag', 'Number of periods to compare against', 'change-lag', <FormControl value={stateRef.current.changeLag} onChange={onTextInputChange.bind(undefined, 'changeLag')} size="sm" placeholder="Change Lag" />)}
          {dataUiColType.includes(stateRef.current.colType) && stateRef.current.colType !== 'volatility_line' && formRow('Time Ratio', 'Number of periods to ratio against', 'time-ratio', <FormControl value={stateRef.current.timeRatio} onChange={onTextInputChange.bind(undefined, 'timeRatio')} size="sm" placeholder="Time Ratio" />)}
          {stateRef.current.colType === 'time' && formRow('Type', 'Type of comparison, value difference or percentage', 'comp-type', <Select classNamePrefix="Select" value={normalizeSelectValue(stateRef.current.comparisonType, comparisonTypeOptions)} isClearable={false} onChange={onSelectChange.bind(undefined, 'comparisonType')} options={comparisonTypeOptions} />)}
          {stateRef.current.colType === 'time' && formRow('Lable显示为日期', 'Lable显示为日期', 'lable-isdate', <FormCheck.Input type="checkbox" checked={!!stateRef.current.lableisdate} onChange={onCheckChange.bind(undefined, 'lableisdate')} />)}
          {stateRef.current.colType === 'time' && formRow('Lable日期格式', 'Lable日期格式，例如：%Y-%m-%d', 'lable-dateformat', <FormControl value={stateRef.current.lableDateFormat} onChange={onTextInputChange.bind(undefined, 'lableDateFormat')} size="sm" placeholder="Lable日期格式" />)}
          {stateRef.current.colType === 'bar' && formRow('Bar颜色分界值', 'Bar颜色分界值，数字类型', 'barSplitNum', <FormControl value={stateRef.current.barSplitNum} onChange={onTextInputChange.bind(undefined, 'barSplitNum')} size="sm" placeholder="Bar颜色分界值" />)}
          {stateRef.current.colType === 'bar' && formRow('yAxis边界值', '自定义y轴最小值及最大值', 'yAxisMinMax', <BoundsControl value={stateRef.current.yAxisMinMax} onChange={onBarBoundsChange.bind(undefined, 'yAxisMinMax')} />)}
          {!dataUiColType.includes(stateRef.current.colType) && formRow('Color bounds', `Number bounds used for color encoding from red to blue.
              Reverse the numbers for blue to red. To get pure red or blue,
              you can enter either only min or max.`, 'bounds', <BoundsControl value={stateRef.current.bounds} onChange={onBoundsChange.bind(undefined)} />)}
          {formRow('Number format', 'Optional d3 number format string', 'd3-format', <FormControl value={stateRef.current.d3format} onChange={onTextInputChange.bind(undefined, 'd3format')} size="sm" placeholder="Number format string" />)}
          {dataUiColType.includes(stateRef.current.colType) && formRow('Date format', 'Optional d3 date format string', 'date-format', <FormControl value={stateRef.current.dateFormat} onChange={onTextInputChange.bind(undefined, 'dateFormat')} size="sm" placeholder="Date format string" />)}
        </Popover.Body>
      </Popover>;
  }
  return <span>
        {textSummary()}{' '}
        <OverlayTrigger container={document.body} trigger="click" rootClose placement="right" overlay={renderPopover()}>
          <InfoTooltipWithTrigger icon="edit" className="text-primary" onClick={edit.bind(undefined)} label="edit-ts-column" />
        </OverlayTrigger>
      </span>;
}


export default TimeSeriesColumnControl;

TimeSeriesColumnControl.propTypes = propTypes;
TimeSeriesColumnControl.defaultProps = defaultProps;
