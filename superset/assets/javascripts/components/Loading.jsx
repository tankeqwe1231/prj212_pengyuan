import React from 'react';
import PropTypes from 'prop-types';

const propTypes = {
  size: PropTypes.number,
};
export default function Loading({ size = 25 }) {
  return (
    <img
      className="loading"
      alt="Loading..."
      src="/static/assets/images/loading.gif"
      style={{
        width: size,
        height: size,
        padding: 0,
        margin: 0,
        position: 'absolute',
      }}
    />
  );
}
Loading.propTypes = propTypes;
