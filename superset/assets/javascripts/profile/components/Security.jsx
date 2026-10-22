import React from 'react';
import PropTypes from 'prop-types';
import { Badge } from 'react-bootstrap';
import { t } from '../../locales';

const propTypes = {
  user: PropTypes.object.isRequired,
};
export default function Security({ user }) {
  return (
    <div>
      <div className="roles">
        <h4>
          {t('Roles')} <Badge bg="secondary">{Object.keys(user.roles).length}</Badge>
        </h4>
        {Object.keys(user.roles).map(role => <Badge bg="secondary" className="permission-badge" key={role}>{role}</Badge>)}
        <hr />
      </div>
      <div className="databases">
        {user.permissions.database_access &&
          <div>
            <h4>
              {t('Databases')} <Badge bg="secondary">{user.permissions.database_access.length}</Badge>
            </h4>
            {user.permissions.database_access.map(role => <Badge bg="secondary" className="permission-badge" key={role}>{role}</Badge>)}
            <hr />
          </div>
        }
      </div>
      <div className="datasources">
        {user.permissions.datasource_access &&
          <div>
            <h4>
              {t('Datasources')} <Badge bg="secondary">{user.permissions.datasource_access.length}</Badge>
            </h4>
            {user.permissions.datasource_access.map(role => <Badge bg="secondary" className="permission-badge" key={role}>{role}</Badge>)}
          </div>
        }
      </div>
    </div>
  );
}
Security.propTypes = propTypes;
