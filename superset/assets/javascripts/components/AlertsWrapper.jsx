/* global notify */
import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

function AlertsWrapper({ initMessages = [] }) {
  const [alerts, setAlerts] = useState([]);
  const nextId = useRef(0);

  useEffect(() => {
    const show = (message, options = {}) => {
      const type = options.type || 'info';
      nextId.current += 1;
      const id = nextId.current;
      setAlerts(current => current.concat([{ id, message, type }]));
      window.setTimeout(() => {
        setAlerts(current => current.filter(alert => alert.id !== id));
      }, options.time || 3000);
      return id;
    };
    const api = {
      error: message => show(message, { type: 'danger' }),
      info: message => show(message, { type: 'info' }),
      show,
      success: message => show(message, { type: 'success' }),
    };
    global.notify = api;
    initMessages.forEach(([type, message]) => {
      (api[type] || api.show)(message);
    });
    return () => {
      if (global.notify === api) {
        global.notify = { error() {}, info() {}, show() {}, success() {} };
      }
    };
  }, [initMessages]);

  return (
    <div style={{ position: 'fixed', right: 14, top: 14, zIndex: 1100 }}>
      {alerts.map(alert => (
        <div className={`alert alert-${alert.type}`} key={alert.id}>{alert.message}</div>
      ))}
    </div>
  );
}

AlertsWrapper.propTypes = {
  initMessages: PropTypes.array,
};

export default AlertsWrapper;
