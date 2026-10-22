import React from 'react';
import PropTypes from 'prop-types';

import './Legend.css';

const propTypes = {
  categories: PropTypes.object,
  toggleCategory: PropTypes.func,
  showSingleCategory: PropTypes.func,
  position: PropTypes.oneOf(['tl', 'tr', 'bl', 'br']),
};

function Legend({ categories = {}, toggleCategory = () => {}, showSingleCategory = () => {}, position = 'tr' }) {
    if (Object.keys(categories).length === 0) {
      return null;
    }
    const categoryNodes = Object.entries(categories).map(([k, v]) => {
      const style = {
        color: 'rgba(' + v.color.join(', ') + ')'
      };
      const icon = v.enabled ? '\u25CF' : '\u25CB';
      return <li key={k}>
          <a href="#" onClick={() => toggleCategory(k)} onDoubleClick={() => showSingleCategory(k)}>
            <span style={style}>{icon}</span> {k}
          </a>
        </li>;
    });
    const vertical = position.charAt(0) === 't' ? 'top' : 'bottom';
    const horizontal = position.charAt(1) === 'r' ? 'right' : 'left';
    const style = {
      [vertical]: '0px',
      [horizontal]: '10px'
    };
    return <div className={'legend'} style={style}>
        <ul className={'categories'}>{categoryNodes}</ul>
      </div>;
}
export default Legend;

Legend.propTypes = propTypes;
