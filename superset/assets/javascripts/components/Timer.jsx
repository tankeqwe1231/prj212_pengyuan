import React, { useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Badge } from 'react-bootstrap';
import { now, fDuration } from '../modules/dates';

const propTypes = {
  endTime: PropTypes.number,
  isRunning: PropTypes.bool.isRequired,
  startTime: PropTypes.number,
  status: PropTypes.string,
  style: PropTypes.object,
};

function Timer({ endTime = null, isRunning, startTime = null, status = 'success', style = null }) {
  const [clockStr, setClockStr] = useState('');
  const timerRef = useRef(null);
  useLayoutEffect(() => {
    const stopTimer = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
    const stopwatch = () => {
      if (!startTime) return;
      const endDttm = endTime || now();
      if (startTime < endDttm) setClockStr(fDuration(startTime, endDttm));
      if (!isRunning) stopTimer();
    };
    if (isRunning && !timerRef.current) timerRef.current = setInterval(stopwatch, 30);
    return stopTimer;
  }, [endTime, isRunning, startTime]);
  return <Badge className="inlineBlock m-r-5" bg={status} style={style}>{clockStr}</Badge>;
}
export default Timer;

Timer.propTypes = propTypes;
