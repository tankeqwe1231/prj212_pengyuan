import React from 'react';
import PropTypes from 'prop-types';
// import Gravatar from 'react-gravatar';
import moment from 'moment';
import { Card } from 'react-bootstrap';
import { t } from '../../locales';

const propTypes = {
  user: PropTypes.object.isRequired,
};
const agreeList = ['fengyun', 'localhost'];

const UserInfo = ({ user }) => {
  const urlStr = window.location.href.split('?')[0];
  const shouldShowAgreement = agreeList.some(target => urlStr.indexOf(target) > -1);

  return (
    <div>
      <Card><Card.Body>
        <h3>
          <strong>{user.firstName} {user.lastName}</strong>
        </h3>
        <h4 className="username">
          <i className="fa fa-user-o" /> {user.username}
        </h4>
        <hr />
        {/*<p>*/}
        {/*  <i className="fa fa-clock-o" /> {t('joined')} {moment(user.createdOn, 'YYYYMMDD').fromNow()}*/}
        {/*</p>*/}
        <p className="email">
          <i className="fa fa-envelope-o" /> {user.email}
        </p>
        {/*<p className="roles">*/}
        {/*  <i className="fa fa-lock" /> {Object.keys(user.roles).join(', ')}*/}
        {/*</p>*/}
        {/*<p>*/}
        {/*  <i className="fa fa-key" />&nbsp;*/}
        {/*  <span className="text-muted">{t('id:')}</span>&nbsp;*/}
        {/*  <span className="user-id">{user.userId}</span>*/}
        {/*</p>*/}
        {shouldShowAgreement && (
          <div>
            <hr />
            <p>服务协议同意时间：{user.agreeTime}</p>
            <p>
              <a href="/static/assets/html/exceptions.html" target="_blank" rel="noopener noreferrer">
                法律声明
              </a>
            </p>
            <p>
              <a href="/static/assets/html/privacy.html" target="_blank" rel="noopener noreferrer">
                隐私保护指引
              </a>
            </p>
            <p>
              <a href="/static/assets/html/service.html" target="_blank" rel="noopener noreferrer">
                用户服务协议
              </a>
            </p>
          </div>
        )}
      </Card.Body></Card>
    </div>
  );
};
UserInfo.propTypes = propTypes;
export default UserInfo;
