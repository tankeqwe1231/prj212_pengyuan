import React, { useId, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Badge,
  Button,
  ButtonGroup,
  FormControl,
  InputGroup,
  OverlayTrigger,
  Popover,
} from 'react-bootstrap';
import Select from 'react-select';
import Datetime from 'react-datetime';
import 'react-datetime/css/react-datetime.css';
import moment from 'moment';

import ControlHeader from '../ControlHeader';
import PopoverSection from '../../../components/PopoverSection';

const RELATIVE_TIME_OPTIONS = ['ago', 'from now'];
const TIME_GRAIN_OPTIONS = ['seconds', 'minutes', 'days', 'weeks', 'months', 'years'];

const propTypes = {
  animation: PropTypes.bool,
  name: PropTypes.string.isRequired,
  label: PropTypes.string,
  description: PropTypes.string,
  onChange: PropTypes.func,
  value: PropTypes.string,
  height: PropTypes.number,
};

const defaultProps = {
  animation: true,
  onChange: () => {},
  value: '',
};

function initialState(value) {
  const state = {
    num: '7',
    grain: 'days',
    rel: 'ago',
    dttm: '',
    type: 'free',
    free: '',
  };
  const words = value.split(' ');
  if (words.length >= 3 && RELATIVE_TIME_OPTIONS.indexOf(words[2]) >= 0) {
    return { ...state, num: words[0], grain: words[1], rel: words[2], type: 'rel' };
  }
  if (moment(value, moment.ISO_8601, true).isValid()) {
    return { ...state, dttm: value, type: 'fix' };
  }
  return { ...state, free: value };
}

export default function DateFilterControl(props) {
  const [state, setState] = useState(() => initialState(props.value || ''));
  const [show, setShow] = useState(false);
  const generatedId = useId().replace(/:/g, '');
  const inputPrefix = `${props.name || 'date-filter'}-${generatedId}`;
  const updateState = values => setState(current => ({ ...current, ...values }));

  const closeWithValue = (value) => {
    props.onChange(value);
    setShow(false);
  };

  const close = () => {
    if (state.type === 'rel') {
      closeWithValue(`${state.num} ${state.grain} ${state.rel}`);
    } else if (state.type === 'fix') {
      closeWithValue(state.dttm);
    } else {
      closeWithValue(state.free);
    }
  };

  const setValueAndClose = (value) => {
    updateState({ type: 'free', free: value });
    closeWithValue(value);
  };

  const popover = (
    <Popover id={`${inputPrefix}-popover`}>
      <Popover.Body>
        <div style={{ width: '250px' }}>
          <PopoverSection title="Fixed" isSelected={state.type === 'fix'} onSelect={() => updateState({ type: 'fix' })}>
            <InputGroup size="sm">
              <InputGroup.Text><i className="fa fa-calendar" aria-hidden="true" /></InputGroup.Text>
              <Datetime
                inputProps={{
                  className: 'form-control form-control-sm',
                  id: `${inputPrefix}-fixed`,
                  name: `${props.name}-fixed`,
                  onFocus: () => updateState({ type: 'fix' }),
                }}
                dateFormat="YYYY-MM-DD"
                value={state.dttm}
                onChange={(dttm) => {
                  if (dttm && typeof dttm.format === 'function') {
                    updateState({ dttm: dttm.format().substring(0, 19) });
                  }
                }}
                timeFormat="HH:mm:ss"
              />
            </InputGroup>
          </PopoverSection>
          <PopoverSection title="Relative" isSelected={state.type === 'rel'} onSelect={() => updateState({ type: 'rel' })}>
            <div className="clearfix">
              <div style={{ width: '50px' }} className="input-inline">
                <FormControl
                  id={`${inputPrefix}-number`}
                  name={`${props.name}-number`}
                  onFocus={() => updateState({ type: 'rel' })}
                  value={state.num}
                  onChange={event => updateState({ num: event.target.value })}
                  size="sm"
                />
              </div>
              <div style={{ width: '95px' }} className="input-inline">
                <Select
                  classNamePrefix="Select"
                  inputId={`${inputPrefix}-grain`}
                  name={`${props.name}-grain`}
                  onFocus={() => updateState({ type: 'rel' })}
                  value={{ value: state.grain, label: state.grain }}
                  isClearable={false}
                  options={TIME_GRAIN_OPTIONS.map(value => ({ label: value, value }))}
                  onChange={option => updateState({ grain: option.value })}
                />
              </div>
              <div style={{ width: '95px' }} className="input-inline">
                <Select
                  classNamePrefix="Select"
                  inputId={`${inputPrefix}-relation`}
                  name={`${props.name}-relation`}
                  value={{ value: state.rel, label: state.rel }}
                  onFocus={() => updateState({ type: 'rel' })}
                  isClearable={false}
                  options={RELATIVE_TIME_OPTIONS.map(value => ({ label: value, value }))}
                  onChange={option => updateState({ rel: option.value })}
                />
              </div>
            </div>
          </PopoverSection>
          <PopoverSection
            title="Free form"
            isSelected={state.type === 'free'}
            onSelect={() => updateState({ type: 'free' })}
            info={'Superset supports smart date parsing. Strings like `last sunday` or `last october` can be used.'}
          >
            <FormControl
              id={`${inputPrefix}-free`}
              name={`${props.name}-free`}
              onFocus={() => updateState({ type: 'free' })}
              value={state.free}
              onChange={event => updateState({ free: event.target.value })}
              size="sm"
            />
          </PopoverSection>
          <div className="clearfix">
            <Button size="sm" className="float-start ok" variant="primary" onClick={close}>Ok</Button>
            <ButtonGroup className="float-end">
              <Button size="sm" className="now" variant="outline-secondary" onClick={() => setValueAndClose('now')}>now</Button>
              <Button size="sm" className="clear" variant="outline-secondary" onClick={() => setValueAndClose('')}>clear</Button>
            </ButtonGroup>
          </div>
        </div>
      </Popover.Body>
    </Popover>
  );

  const value = props.value || '';
  return (
    <div>
      <ControlHeader {...props} />
      <OverlayTrigger
        animation={props.animation}
        container={document.body}
        trigger="click"
        rootClose
        show={show}
        onToggle={setShow}
        transition={props.animation ? undefined : false}
        placement="right"
        overlay={popover}
      >
        <Badge bg="secondary" style={{ cursor: 'pointer' }}>
          {value.replace('T00:00:00', '') || '∞'}
        </Badge>
      </OverlayTrigger>
    </div>
  );
}

DateFilterControl.propTypes = propTypes;
DateFilterControl.defaultProps = defaultProps;
