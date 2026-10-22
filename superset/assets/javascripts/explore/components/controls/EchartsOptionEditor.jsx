import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Row, Col, FormControl, Button } from 'react-bootstrap';
import Select from 'react-select';
import { SketchPicker } from 'react-color';

import { t } from '../../../locales';
import ECHARTS_OPTION_SCHEMA from './echartsOptionSchema';
import { normalizeSelectValue } from '../../../components/selectUtils';

const propTypes = {
  item: PropTypes.object.isRequired,
  vizType: PropTypes.string,
  seriesOptions: PropTypes.array,
  usedTypes: PropTypes.array,
  onChange: PropTypes.func,
};

const defaultProps = {
  vizType: '',
  seriesOptions: [],
  usedTypes: [],
  onChange: () => {},
};

function EchartsOptionEditor(incomingProps) {
  const props = { ...incomingProps };
  Object.keys(EchartsOptionEditor.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = EchartsOptionEditor.defaultProps[key];
  });
  const propsRef = useRef(props);
  propsRef.current = props;
  const {
    key,
    label,
    type,
    config
  } = props.item;
  const [state, setState] = useState(() => ({
    key,
    label: label || '',
    type: type || null,
    config: config || {},
    // 仅 UI 用, 不持久化(以 _ 开头)
    _activeSeries: null,
    _openColor: null
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
  function emit() {
    const {
      key,
      label,
      type,
      config
    } = stateRef.current;
    propsRef.current.onChange({
      key,
      label,
      type,
      config
    });
  }
  function onLabelChange(e) {
    updateState({
      label: e.target.value
    }, emit);
  }
  function onTypeChange(opt) {
    updateState({
      type: opt ? opt.value : null,
      config: {},
      _activeSeries: null,
      _openColor: null
    }, emit);
  }
  function onActiveSeriesChange(opt) {
    updateState({
      _activeSeries: opt ? opt.value : null,
      _openColor: null
    });
  }
  function removeSeries(name) {
    const config = Object.assign({}, stateRef.current.config);
    delete config[name];
    const next = {
      config
    };
    if (stateRef.current._activeSeries === name) {
      next._activeSeries = null;
      next._openColor = null;
    }
    updateState(next, emit);
  }
  function onFieldChange(fieldName, value) {
    const config = Object.assign({}, stateRef.current.config);
    if (value === undefined || value === '') {
      delete config[fieldName];
    } else {
      config[fieldName] = value;
    }
    updateState({
      config
    }, emit);
  }
  function onSeriesFieldChange(fieldName, value) {
    const active = stateRef.current._activeSeries;
    if (!active) {
      return;
    }
    const config = Object.assign({}, stateRef.current.config);
    const seriesCfg = Object.assign({}, config[active] || {});
    if (value === undefined || value === '') {
      delete seriesCfg[fieldName];
    } else {
      seriesCfg[fieldName] = value;
    }
    if (Object.keys(seriesCfg).length) {
      config[active] = seriesCfg;
    } else {
      delete config[active];
    }
    updateState({
      config
    }, emit);
  }
  function formRow(label, control, md_label = 5, md_control = 7) {
    return <Row style={{
      marginTop: '5px'
    }}>
        <Col md={md_label} style={{
        wordBreak: 'break-all'
      }}>{label}</Col>
        <Col md={md_control}>{control}</Col>
      </Row>;
  }
  function renderColorField(fieldName, value, onChange) {
    const open = stateRef.current._openColor === fieldName;
    return <div>
        <div style={{
        display: 'flex',
        alignItems: 'center'
      }}>
          <div role="button" tabIndex={0} onClick={() => updateState({
          _openColor: open ? null : fieldName
        })} style={{
          width: 24,
          height: 24,
          border: '1px solid #ccc',
          cursor: 'pointer',
          backgroundColor: value || '#fff'
        }} />
          <span style={{
          marginLeft: 8
        }}>{value || t('未选择')}</span>
          {value && <Button size="sm" style={{
          marginLeft: 8
        }} onClick={() => onChange(undefined)}>
              {t('清除')}
            </Button>}
        </div>
        {open && <div style={{
        marginTop: 5
      }}>
            <SketchPicker color={value || '#ffffff'} onChangeComplete={c => onChange(c.hex)} />
          </div>}
      </div>;
  }
  function renderField(field, valueObj, onChange) {
    const value = valueObj[field.name];
    switch (field.control) {
      case 'select':
        return <Select classNamePrefix="Select" value={normalizeSelectValue(value, field.options)} options={field.options} placeholder={field.placeholder || ''} isClearable={field.clearable !== false} onChange={opt => onChange(field.name, opt ? opt.value : undefined)} />;
      case 'checkbox':
        return <FormControl type="checkbox" checked={!!value} onChange={e => onChange(field.name, e.target.checked)} size="sm" />;
      case 'color':
        return renderColorField(field.name, value, v => onChange(field.name, v));
      case 'text':
      default:
        return <FormControl value={value === undefined ? '' : value} placeholder={field.placeholder || ''} onChange={e => onChange(field.name, e.target.value)} size="sm" />;
    }
  }
  function renderConfiguredSeries() {
    const names = Object.keys(stateRef.current.config);
    if (!names.length) {
      return <div className="text-muted">{t('暂无已配置项')}</div>;
    }
    return <div>
        {names.map(name => {
        const isActive = stateRef.current._activeSeries === name;
        return <div key={name} role="button" tabIndex={0} onClick={() => onActiveSeriesChange({
          value: name
        })} style={{
          position: 'relative',
          border: isActive ? '1px solid #00A699' : '1px solid #ccc',
          borderRadius: 3,
          padding: '4px 18px 4px 8px',
          marginBottom: 5,
          cursor: 'pointer',
          backgroundColor: isActive ? '#E6F7F5' : '#fff',
          wordBreak: 'break-all'
        }}>
              {name}
              <i className="fa fa-times" role="button" tabIndex={0} onClick={e => {
            e.stopPropagation();
            removeSeries(name);
          }} style={{
            position: 'absolute',
            top: 2,
            right: 4,
            color: '#999',
            cursor: 'pointer'
          }} />
            </div>;
      })}
      </div>;
  }
  function renderTypeFields(typeConfig) {
    if (typeConfig.perSeries) {
      const active = stateRef.current._activeSeries;
      const activeCfg = active && stateRef.current.config[active] || {};
      return <Row>
          <Col md={7}>
            {formRow(t('选择 series'), <Select classNamePrefix="Select" value={normalizeSelectValue(active, propsRef.current.seriesOptions)} options={propsRef.current.seriesOptions} placeholder={propsRef.current.seriesOptions.length ? t('请选择') : t('暂无数据(请先运行图表)')} onChange={opt => onActiveSeriesChange(opt)} />)}
            {active && typeConfig.items.map(field => <div key={field.name}>
                {formRow(field.label, renderField(field, activeCfg, onSeriesFieldChange.bind(undefined)))}
              </div>)}
          </Col>
          <Col md={5}>
            <div style={{
            fontWeight: 'bold',
            marginBottom: 5
          }}>{t('已配置 series')}</div>
            {renderConfiguredSeries()}
          </Col>
        </Row>;
    }
    return <div>
        {typeConfig.items.map(field => <div key={field.name}>
            {formRow(field.label, renderField(field, stateRef.current.config, onFieldChange.bind(undefined)))}
          </div>)}
      </div>;
  }
  const vizSchema = ECHARTS_OPTION_SCHEMA[propsRef.current.vizType];
  if (!vizSchema) {
    return <div style={{
      width: 320
    }} className="text-muted">
          {t('当前图表类型暂不支持该配置面板')}
        </div>;
  }
  // Type 下拉: 过滤掉其它条目已使用的 Type(但保留当前条目自身已选的 Type)
  const typeOptions = vizSchema.types.filter(o => o.value === stateRef.current.type || propsRef.current.usedTypes.indexOf(o.value) < 0);
  const typeConfig = stateRef.current.type ? vizSchema.fields[stateRef.current.type] : null;
  const width = typeConfig && typeConfig.perSeries ? 520 : 320;
  return <div style={{
    width
  }}>
        {formRow('Label', <FormControl value={stateRef.current.label} onChange={onLabelChange.bind(undefined)} size="sm" placeholder={t('自定义条目名称')} />, 3, 9)}
        {formRow('Type', <Select classNamePrefix="Select" value={normalizeSelectValue(stateRef.current.type, typeOptions)} options={typeOptions} placeholder={t('请选择')} onChange={onTypeChange.bind(undefined)} />, 3, 9)}
        {typeConfig && <div>
            <hr style={{
        margin: '8px 0'
      }} />
            {renderTypeFields(typeConfig)}
          </div>}
      </div>;
}


export default EchartsOptionEditor;

EchartsOptionEditor.propTypes = propTypes;
EchartsOptionEditor.defaultProps = defaultProps;
