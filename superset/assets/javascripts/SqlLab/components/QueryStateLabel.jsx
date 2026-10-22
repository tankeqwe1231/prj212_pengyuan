import React from 'react';
import PropTypes from 'prop-types';
import { Badge } from 'react-bootstrap';

import { STATE_BSSTYLE_MAP } from '../constants';

const propTypes = {
  query: PropTypes.object.isRequired,
};

export default function QueryStateLabel({ query }) {
  const variant = STATE_BSSTYLE_MAP[query.state];
  return (
    <Badge className="m-r-3" bg={variant}>
      {query.state}
    </Badge>
  );
}
QueryStateLabel.propTypes = propTypes;
