import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Card, Col, Row, Tabs, Tab } from 'react-bootstrap';
import Favorites from './Favorites';
import UserInfo from './UserInfo';
import PPTTaskManage from './PPTTaskManage';
// import Security from './Security';
// import RecentActivity from './RecentActivity';
// import CreatedContent from './CreatedContent';
import { t } from '../../locales';

const propTypes = {
  user: PropTypes.object.isRequired,
};

function App(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(App.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = App.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    activeTab: 1 // 默认选中第一个tab
  }));
  const stateRef = useRef(state);
  stateRef.current = state;
  const updateState = (update, callback) => {
    const previous = stateRef.current;
    const partial = typeof update === 'function' ? update(previous, propsRef.current) : update;
    if (partial == null) return;
    const next = {
      ...previous,
      ...partial
    };
    stateRef.current = next;
    setState(next);
    if (typeof callback === 'function') callback();
  };
  function handleTabSelect(activeTab) {
    updateState({
      // React-Bootstrap normalizes event keys to strings before invoking
      // onSelect, while the profile tabs use numeric keys. Keep the state
      // numeric so conditional tab content (for example the PPT manager)
      // continues to render after a tab is selected.
      activeTab: Number(activeTab)
    });
  }
  propsRef.current = props;
  const {
    user
  } = propsRef.current;
  const {
    activeTab
  } = stateRef.current;
  return <div className="container app">
        <Row>
          <Col md={12}>
            <Tabs id="options" activeKey={activeTab} onSelect={handleTabSelect}>
              <Tab eventKey={1} title={<div><i className="fa fa-user-o" /> {t('用户信息')}</div>}>
                <Card><Card.Body><UserInfo user={user} /></Card.Body></Card>
              </Tab>
              <Tab eventKey={2} title={<div><i className="fa fa-star" /> {t('Favorites')}</div>}>
                <Card><Card.Body><Favorites user={user} /></Card.Body></Card>
              </Tab>
              <Tab eventKey={3} title={<div><i className="fa fa-file-powerpoint-o" /> {t('生成PPT')}</div>}>
                <Card><Card.Body>
                  {activeTab === 3 && <PPTTaskManage user={user} />}
                </Card.Body></Card>
              </Tab>
            </Tabs>
          </Col>
        </Row>
      </div>;
}


export default App;

App.propTypes = propTypes;
