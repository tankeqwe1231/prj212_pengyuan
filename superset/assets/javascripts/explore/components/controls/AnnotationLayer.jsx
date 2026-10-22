import React, { useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { CompactPicker } from 'react-color';
import { Button } from 'react-bootstrap';

import $ from 'jquery';
import mathjs from 'mathjs';

import SelectControl from './SelectControl';
import TextControl from './TextControl';
import CheckboxControl from './CheckboxControl';

import AnnotationTypes, {
  ANNOTATION_SOURCE_TYPES,
  getAnnotationSourceTypeLabels,
  getAnnotationTypeLabel,
  getSupportedSourceTypes,
  getSupportedAnnotationTypes,
  requiresQuery,
} from '../../../modules/AnnotationTypes';

import { ALL_COLOR_SCHEMES } from '../../../modules/colors';
import PopoverSection from '../../../components/PopoverSection';
import ControlHeader from '../ControlHeader';
import { nonEmpty } from '../../validators';
import vizTypes from '../../stores/visTypes';

const AUTOMATIC_COLOR = '';

const propTypes = {
  name: PropTypes.string,
  annotationType: PropTypes.string,
  sourceType: PropTypes.string,
  color: PropTypes.string,
  opacity: PropTypes.string,
  style: PropTypes.string,
  width: PropTypes.number,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  overrides: PropTypes.object,
  show: PropTypes.bool,
  rightYAxis: PropTypes.bool,
  annotationShowTip: PropTypes.bool,
  customIndex: PropTypes.string,
  HorizontalLine: PropTypes.number,
  titleColumn: PropTypes.string,
  descriptionColumns: PropTypes.arrayOf(PropTypes.string),
  timeColumn: PropTypes.string,
  intervalEndColumn: PropTypes.string,
  vizType: PropTypes.string,

  error: PropTypes.string,
  colorScheme: PropTypes.string,

  addAnnotationLayer: PropTypes.func,
  removeAnnotationLayer: PropTypes.func,
  close: PropTypes.func,
};

const defaultProps = {
  name: '',
  sourceType: '',
  color: AUTOMATIC_COLOR,
  opacity: '',
  style: 'solid',
  width: 1,
  overrides: {},
  colorScheme: 'd3Category10',
  show: true,
  rightYAxis: false,
  annotationShowTip: false,
  customIndex: '',
  // HorizontalLine: '',
  titleColumn: '',
  descriptionColumns: [],
  timeColumn: '',
  intervalEndColumn: '',

  addAnnotationLayer: () => {},
  removeAnnotationLayer: () => {},
  close: () => {},
};

function AnnotationLayer(incomingProps) {
  const props = { ...incomingProps };
  Object.keys(AnnotationLayer.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = AnnotationLayer.defaultProps[key];
  });
  const propsRef = useRef(props);
  propsRef.current = props;
  const [state, setState] = useState(() => ({
    // base
    name: props.name,
    oldName: !props.name ? null : props.name,
    annotationType: props.annotationType,
    sourceType: props.sourceType,
    value: props.value,
    overrides: props.overrides,
    show: props.show,
    rightYAxis: props.rightYAxis,
    annotationShowTip: props.annotationShowTip,
    customIndex: props.customIndex,
    HorizontalLine: props.HorizontalLine,
    // slice
    titleColumn: props.titleColumn,
    descriptionColumns: props.descriptionColumns,
    timeColumn: props.timeColumn,
    intervalEndColumn: props.intervalEndColumn,
    // display
    color: props.color || AUTOMATIC_COLOR,
    opacity: props.opacity,
    style: props.style,
    width: props.width,
    // refData
    isNew: !propsRef.current.name,
    isLoadingOptions: true,
    valueOptions: [],
    validationErrors: {}
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
  function isValidFormula(value, annotationType) {
    if (annotationType === AnnotationTypes.FORMULA) {
      try {
        mathjs.parse(value).compile().eval({
          x: 0
        });
      } catch (err) {
        return true;
      }
    }
    return false;
  }
  function isValidForm() {
    const {
      name,
      annotationType,
      sourceType,
      value,
      timeColumn,
      intervalEndColumn
    } = stateRef.current;
    const errors = [nonEmpty(name), nonEmpty(annotationType), nonEmpty(value)];
    if (sourceType !== ANNOTATION_SOURCE_TYPES.NATIVE) {
      if (annotationType === AnnotationTypes.EVENT) {
        errors.push(nonEmpty(timeColumn));
      }
      if (annotationType === AnnotationTypes.INTERVAL) {
        errors.push(nonEmpty(timeColumn));
        errors.push(nonEmpty(intervalEndColumn));
      }
    }
    errors.push(isValidFormula(value, annotationType));
    return !errors.filter(x => x).length;
  }
  function handleAnnotationType(annotationType) {
    updateState({
      annotationType,
      sourceType: null,
      validationErrors: {},
      value: null
    });
  }
  function handleAnnotationSourceType(sourceType) {
    updateState({
      sourceType,
      isLoadingOptions: true,
      validationErrors: {},
      value: null
    });
  }
  function handleValue(value) {
    updateState({
      value,
      descriptionColumns: null,
      intervalEndColumn: null,
      timeColumn: null,
      titleColumn: null,
      overrides: {
        since: null,
        until: null
      }
    });
  }
  function fetchOptions(annotationType, sourceType, isLoadingOptions) {
    if (isLoadingOptions === true) {
      if (sourceType === ANNOTATION_SOURCE_TYPES.NATIVE) {
        $.ajax({
          type: 'GET',
          url: '/annotationlayermodelview/api/read?'
        }).then(data => {
          const layers = data ? data.result.map(layer => ({
            value: layer.id,
            label: layer.name
          })) : [];
          updateState({
            isLoadingOptions: false,
            valueOptions: layers
          });
        });
      } else if (requiresQuery(sourceType)) {
        $.ajax({
          type: 'GET',
          url: '/superset/user_slices'
        }).then(data => updateState({
          isLoadingOptions: false,
          valueOptions: data.filter(x => getSupportedSourceTypes(annotationType).find(v => v === x.viz_type)).map(x => ({
            value: x.id,
            label: x.title,
            slice: x
          }))
        }));
      } else {
        updateState({
          isLoadingOptions: false,
          valueOptions: []
        });
      }
    }
  }
  function deleteAnnotation() {
    propsRef.current.close();
    if (!stateRef.current.isNew) {
      propsRef.current.removeAnnotationLayer(stateRef.current);
    }
  }
  function applyAnnotation() {
    if (stateRef.current.name.length) {
      const annotation = {};
      Object.keys(stateRef.current).forEach(k => {
        if (stateRef.current[k] !== null) {
          annotation[k] = stateRef.current[k];
        }
      });
      delete annotation.isNew;
      delete annotation.valueOptions;
      delete annotation.isLoadingOptions;
      delete annotation.validationErrors;
      annotation.color = annotation.color === AUTOMATIC_COLOR ? null : annotation.color;
      propsRef.current.addAnnotationLayer(annotation);
      updateState({
        isNew: false,
        oldName: stateRef.current.name
      });
    }
  }
  function submitAnnotation() {
    applyAnnotation();
    propsRef.current.close();
  }
  function renderValueConfiguration() {
    const {
      annotationType,
      sourceType,
      value,
      valueOptions,
      isLoadingOptions
    } = stateRef.current;
    let label = '';
    let description = '';
    if (requiresQuery(sourceType)) {
      if (sourceType === ANNOTATION_SOURCE_TYPES.NATIVE) {
        label = 'Annotation Layer';
        description = 'Select the Annotation Layer you would like to use.';
      } else {
        label = 'Slice';
        description = `Use a pre defined Superset Slice as a source for annotations and overlays. 
        'your Slice must be one of these visualization types:
        '[${getSupportedSourceTypes(sourceType).map(x => vizTypes[x].label).join(', ')}]'`;
      }
    } else if (annotationType === AnnotationTypes.FORMULA) {
      label = 'Formula';
      description = `Expects a formula with depending time parameter 'x'
        in milliseconds since epoch. mathjs is used to evaluate the formulas.
        Example: '2x+5'`;
    }
    if (requiresQuery(sourceType)) {
      return <SelectControl name="annotation-layer-value" showHeader hovered description={description} label={label} placeholder="" options={valueOptions} isLoading={isLoadingOptions} value={value} onChange={handleValue} validationErrors={!value ? ['Mandatory'] : []} />;
    }
    if (annotationType === AnnotationTypes.FORMULA) {
      return <TextControl name="annotation-layer-value" hovered showHeader description={description} label={label} placeholder="" value={value} onChange={handleValue} validationErrors={isValidFormula(value, annotationType) ? ['Bad formula.'] : []} />;
    }
    //   if (annotationType === AnnotationTypes.CUSTOM) {
    //   return (
    //     <TextControl
    //       name="annotation-layer-custom-index"
    //       label="指标名"
    //       description="计算移动平均的指标名"
    //       placeholder=""
    //       value={value}
    //       onChange={this.handleValue}
    //       validationErrors={!value ? ['输入'] : []}
    //     />
    //   );
    // }
    //   if (annotationType === AnnotationTypes.HORIZONTAL_LINE) {
    //   return (
    //     <TextControl
    //       name="annotation-layer-horizontal-line"
    //       label="固定数字值"
    //       description="输入固定值，显示水平线"
    //       placeholder=""
    //       value={value}
    //       onChange={this.handleValue}
    //       validationErrors={!value ? ['Mandatory'] : []}
    //     />
    //   );
    // }

    return '';
  }
  function renderSliceConfiguration() {
    const {
      annotationType,
      sourceType,
      value,
      valueOptions,
      overrides,
      titleColumn,
      timeColumn,
      intervalEndColumn,
      descriptionColumns
    } = stateRef.current;
    const slice = (valueOptions.find(x => x.value === value) || {}).slice;
    if (sourceType !== ANNOTATION_SOURCE_TYPES.NATIVE && slice) {
      const columns = (slice.data.groupby || []).concat(slice.data.all_columns || []).map(x => ({
        value: x,
        label: x
      }));
      const timeColumnOptions = slice.data.include_time ? [{
        value: '__timestamp',
        label: '__timestamp'
      }].concat(columns) : columns;
      return <div style={{
        marginRight: '2rem'
      }}>
          <PopoverSection isSelected onSelect={() => {}} title="Annotation Slice Configuration" info={`This section allows you to configure how to use the slice
               to generate annotations.`}>
            {(annotationType === AnnotationTypes.EVENT || annotationType === AnnotationTypes.INTERVAL) && <SelectControl hovered name="annotation-layer-time-column" label={annotationType === AnnotationTypes.INTERVAL ? 'Interval Start column' : 'Event Time Column'} description={'This column must contain date/time information.'} validationErrors={!timeColumn ? ['Mandatory'] : []} clearable={false} options={timeColumnOptions} value={timeColumn} onChange={v => updateState({
            timeColumn: v
          })} />}
            {annotationType === AnnotationTypes.INTERVAL && <SelectControl hovered name="annotation-layer-intervalEnd" label="Interval End column" description={'This column must contain date/time information.'} validationErrors={!intervalEndColumn ? ['Mandatory'] : []} options={columns} value={intervalEndColumn} onChange={v => updateState({
            intervalEndColumn: v
          })} />}
            <SelectControl hovered name="annotation-layer-title" label="Title Column" description={'Pick a title for you annotation.'} options={[{
            value: '',
            label: 'None'
          }].concat(columns)} value={titleColumn} onChange={v => updateState({
            titleColumn: v
          })} />
            {annotationType !== AnnotationTypes.TIME_SERIES && <SelectControl hovered name="annotation-layer-title" label="Description Columns" description={`Pick one or more columns that should be shown in the
                  annotation. If you don't select a column all of them will be shown.`} multi options={columns} value={descriptionColumns} onChange={v => updateState({
            descriptionColumns: v
          })} />}
            <div style={{
            marginTop: '1rem'
          }}>
              <CheckboxControl hovered name="annotation-override-since" label="Override 'Since'" description={`This controls whether the "Since" field from the current
                  view should be passed down to the slice containing the annotation data.`} value={!!Object.keys(overrides).find(x => x === 'since')} onChange={v => {
              delete overrides.since;
              if (v) {
                updateState({
                  overrides: {
                    ...overrides,
                    since: null
                  }
                });
              } else {
                updateState({
                  overrides: {
                    ...overrides
                  }
                });
              }
            }} />
              <CheckboxControl hovered name="annotation-override-until" label="Override 'Until'" description={`This controls whether the "Until" field from the current
                  view should be passed down to the slice containing the annotation data.`} value={!!Object.keys(overrides).find(x => x === 'until')} onChange={v => {
              delete overrides.until;
              if (v) {
                updateState({
                  overrides: {
                    ...overrides,
                    until: null
                  }
                });
              } else {
                updateState({
                  overrides: {
                    ...overrides
                  }
                });
              }
            }} />
              <TextControl hovered name="annotation-layer-timeshift" label="Time Shift" description={`Time delta in natural language
                  (example:  24 hours, 7 days, 56 weeks, 365 days)`} placeholder="" value={overrides.time_shift} onChange={v => updateState({
              overrides: {
                ...overrides,
                time_shift: v
              }
            })} />
            </div>
          </PopoverSection>
        </div>;
    }
    return '';
  }
  function renderDisplayConfiguration() {
    const {
      color,
      opacity,
      style,
      width
    } = stateRef.current;
    const colorScheme = [...ALL_COLOR_SCHEMES[propsRef.current.colorScheme]];
    if (color && color !== AUTOMATIC_COLOR && !colorScheme.find(x => x.toLowerCase() === color.toLowerCase())) {
      colorScheme.push(color);
    }
    return <PopoverSection isSelected onSelect={() => {}} title="Display configuration" info="Configure your how you overlay is displayed here.">
        <SelectControl name="annotation-layer-stroke" label="Style"
      // see '../../../../visualizations/nvd3_vis.css'
      options={[{
        value: 'solid',
        label: 'Solid'
      }, {
        value: 'dashed',
        label: 'Dashed'
      }, {
        value: 'longDashed',
        label: 'Long Dashed'
      }, {
        value: 'dotted',
        label: 'Dotted'
      }]} value={style} onChange={v => updateState({
        style: v
      })} />
        <SelectControl name="annotation-layer-opacity" label="Opacity"
      // see '../../../../visualizations/nvd3_vis.css'
      options={[{
        value: '',
        label: 'Solid'
      }, {
        value: 'opacityLow',
        label: '0.2'
      }, {
        value: 'opacityMedium',
        label: '0.5'
      }, {
        value: 'opacityHigh',
        label: '0.8'
      }]} value={opacity} onChange={v => updateState({
        opacity: v
      })} />
        <div>
          <ControlHeader label="Color" />
          <div style={{
          display: 'flex',
          flexDirection: 'column'
        }}>
            <CompactPicker color={color} colors={colorScheme} onChangeComplete={v => updateState({
            color: v.hex
          })} />
            <Button style={{
            marginTop: '0.5rem',
            marginBottom: '0.5rem'
          }} variant={color === AUTOMATIC_COLOR ? 'success' : 'outline-secondary'} size="sm" onClick={() => updateState({
            color: AUTOMATIC_COLOR
          })}>
              Automatic Color
            </Button>
          </div>
        </div>
        <TextControl name="annotation-layer-stroke-width" label="Line Width" isInt value={width} onChange={v => updateState({
        width: v
      })} />
      </PopoverSection>;
  }
  // Lifecycle-equivalent mount effect intentionally runs once.
  useLayoutEffect(() => {
    const {
      annotationType,
      sourceType,
      isLoadingOptions
    } = stateRef.current;
    fetchOptions(annotationType, sourceType, isLoadingOptions);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const previousCommitRef = useRef();
  useLayoutEffect(() => {
    if (previousCommitRef.current) {
      const { state: prevState } = previousCommitRef.current;
      if (prevState.sourceType !== stateRef.current.sourceType) {
        fetchOptions(stateRef.current.annotationType, stateRef.current.sourceType, true);
      }
    }
    previousCommitRef.current = {
      props: props,
      state: state
    };
  });
  const {
    isNew,
    name,
    annotationType,
    sourceType,
    show,
    rightYAxis,
    annotationShowTip,
    customIndex,
    HorizontalLine
  } = stateRef.current;
  const isValid = isValidForm();
  return <div>
        {propsRef.current.error && <span style={{
      color: 'red'
    }}>
            ERROR: {propsRef.current.error}
          </span>}
        <div style={{
      display: 'flex',
      flexDirection: 'row'
    }}>
          <div style={{
        marginRight: '2rem'
      }}>
            <PopoverSection isSelected onSelect={() => {}} title="Layer Configuration" info="Configure the basics of your Annotation Layer.">
              <TextControl name="annotation-layer-name" label="Name" placeholder="" value={name} onChange={v => updateState({
            name: v
          })} validationErrors={!name ? ['Mandatory'] : []} />
              <CheckboxControl name="annotation-layer-hide" label="Hide Layer" value={!show} onChange={v => updateState({
            show: !v
          })} />
              {annotationType === AnnotationTypes.TIME_SERIES && <CheckboxControl name="annotation-right-y" label="右轴显示" value={rightYAxis} onChange={v => updateState({
            rightYAxis: v
          })} />}
              {annotationType === AnnotationTypes.EVENT && <CheckboxControl name="annotation-show-tip" label="显示全部事件详情" value={annotationShowTip} onChange={v => updateState({
            annotationShowTip: v
          })} />}
              <SelectControl hovered description="Choose the Annotation Layer Type" label="Annotation Layer Type" name="annotation-layer-type" options={getSupportedAnnotationTypes(propsRef.current.vizType).map(x => ({
            value: x,
            label: getAnnotationTypeLabel(x)
          }))} value={annotationType} onChange={handleAnnotationType} />
              {!!getSupportedSourceTypes(annotationType).length && <SelectControl hovered description="Choose the source of your annotations" label="Annotation Source" name="annotation-source-type" options={getSupportedSourceTypes(annotationType).map(x => ({
            value: x,
            label: getAnnotationSourceTypeLabels(x)
          }))} value={sourceType} onChange={handleAnnotationSourceType} />}
              {renderValueConfiguration()}

            </PopoverSection>
          </div>
          {renderSliceConfiguration()}
          {renderDisplayConfiguration()}
        </div>
        <div style={{
      display: 'flex',
      justifyContent: 'space-between'
    }}>
          <Button variant="outline-secondary" className="bg-transparent" size="sm" onClick={deleteAnnotation}>
            {!isNew ? 'Remove' : 'Cancel'}
          </Button>
          <div>
            <Button variant="outline-secondary" className="bg-transparent" size="sm" disabled={!isValid} onClick={applyAnnotation}>
              Apply
            </Button>

            <Button variant="outline-secondary" className="bg-transparent" size="sm" disabled={!isValid} onClick={submitAnnotation}>
              OK
            </Button>
          </div>
        </div>
      </div>;
}


export default AnnotationLayer;
AnnotationLayer.propTypes = propTypes;
AnnotationLayer.defaultProps = defaultProps;
