import React from 'react';
import PropTypes from 'prop-types';

import { OverlayTrigger, Tooltip } from 'react-bootstrap';

const propTypes = {
  column: PropTypes.object.isRequired,
};

const iconMap = {
  pk: 'fa-key',
  fk: 'fa-link',
  index: 'fa-bookmark',
};
const tooltipTitleMap = {
  pk: 'Primary Key',
  fk: 'Foreign Key',
  index: 'Index',
};

export default function ColumnElement(props) {
  const col = props.column;
  let name = col.name;
  let icons;
  if (col.keys && col.keys.length > 0) {
    name = <strong>{col.name}</strong>;
    icons = col.keys.map((key, i) => (
      <span key={i} className="ColumnElement">
        <OverlayTrigger
          placement="right"
          overlay={
            <Tooltip id="idx-json" size="lg">
              <strong>{tooltipTitleMap[key.type]}</strong>
              <hr />
              <pre className="text-small">
                {JSON.stringify(key, null, '  ')}
              </pre>
            </Tooltip>
            }
        >
          <i className={`fa text-muted m-l-2 ${iconMap[key.type]}`} />
        </OverlayTrigger>
      </span>
    ));
  }
  return (
    <div className="clearfix table-column">
      <div className="float-start m-l-10 col-name">
        {name}{icons}
      </div>
      <div className="float-end text-muted">
        <small> {col.type}</small>
      </div>
    </div>);
}
ColumnElement.propTypes = propTypes;
