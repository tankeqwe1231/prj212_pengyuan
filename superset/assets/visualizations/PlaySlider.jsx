import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Row, Col } from 'react-bootstrap';
import Mousetrap from 'mousetrap';

import './PlaySlider.css';
import { t } from '../javascripts/locales';

function PlaySlider({
  disabled = false,
  end,
  loopDuration = 15000,
  maxFrames = 100,
  onChange = () => {},
  orientation = 'horizontal',
  reversed = false,
  start,
  step,
  values,
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef(null);
  const timing = useMemo(() => {
    const range = end - start;
    const frames = Math.max(1, Math.min(maxFrames, range / step));
    const width = range / frames;
    return {
      increment: width < step ? step : width - (width % step),
      intervalMilliseconds: loopDuration / frames,
    };
  }, [end, loopDuration, maxFrames, start, step]);

  const pause = useCallback(() => {
    if (intervalRef.current != null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPlaying(false);
  }, []);
  const advance = useCallback(() => {
    if (disabled) {
      return;
    }
    let nextValues = values.map(value => value + timing.increment);
    if (nextValues[1] > end) {
      const correction = nextValues[0] - start;
      nextValues = nextValues.map(value => value - correction);
    }
    onChange(nextValues);
  }, [disabled, end, onChange, start, timing.increment, values]);
  const play = useCallback(() => {
    if (disabled) {
      return;
    }
    if (intervalRef.current != null) {
      pause();
    } else {
      intervalRef.current = setInterval(advance, timing.intervalMilliseconds);
      setIsPlaying(true);
    }
  }, [advance, disabled, pause, timing.intervalMilliseconds]);

  useEffect(() => {
    Mousetrap.bind(['space'], play);
    return () => {
      Mousetrap.unbind(['space']);
      pause();
    };
  }, [pause, play]);

  const changeHandle = (handleIndex, event) => {
    const nextValues = values.slice();
    nextValues[handleIndex] = Number(event.target.value);
    if (nextValues[0] > nextValues[1]) {
      nextValues[handleIndex === 0 ? 1 : 0] = nextValues[handleIndex];
    }
    onChange(nextValues);
    pause();
  };
  const title = disabled
    ? t('Data has no time steps')
    : values.map(value => (new Date(value)).toUTCString()).join(' : ');

  return (
    <Row className="play-slider">
      <Col className="padded" md={1}>
        <i className={`${isPlaying ? 'fa-pause' : 'fa-play'} fa fa-lg slider-button`} onClick={play} />
        <i className="fa fa-step-forward fa-lg slider-button" onClick={advance} />
      </Col>
      <Col className="padded" md={11}>
        <div className={`native-range-slider ${orientation} ${reversed ? 'reversed' : ''}`} title={title}>
          {[0, 1].map(index => (
            <input
              disabled={disabled}
              key={index}
              max={end}
              min={start}
              onChange={event => changeHandle(index, event)}
              step={step}
              type="range"
              value={values[index]}
            />
          ))}
        </div>
      </Col>
    </Row>
  );
}

PlaySlider.propTypes = {
  start: PropTypes.number.isRequired,
  step: PropTypes.number.isRequired,
  end: PropTypes.number.isRequired,
  values: PropTypes.array.isRequired,
  onChange: PropTypes.func,
  loopDuration: PropTypes.number,
  maxFrames: PropTypes.number,
  orientation: PropTypes.oneOf(['horizontal', 'vertical']),
  reversed: PropTypes.bool,
  disabled: PropTypes.bool,
};

export default PlaySlider;
