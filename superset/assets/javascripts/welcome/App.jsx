import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import { Card, Row, Col, Tabs, Tab } from 'react-bootstrap';
import RecentActivity from '../profile/components/RecentActivity';
import Favorites from '../profile/components/Favorites';
import { t } from '../locales';

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
  propsRef.current = props;
  return <div className="container welcome">
        <Tabs defaultActiveKey={2} id="uncontrolled-tab-example">
          <Tab eventKey={2} title={t('Recently Viewed')}>
            <Card><Card.Body>
              <Row>
                <Col md={8}><h2>{t('Recently Viewed')}</h2></Col>
              </Row>
              <hr />
              <RecentActivity user={propsRef.current.user} />
            </Card.Body></Card>
          </Tab>
          <Tab eventKey={3} title={t('Favorites')}>
            <Card><Card.Body>
              <Row>
                <Col md={8}><h2>{t('Favorites')}</h2></Col>
              </Row>
              <hr />
              <Favorites user={propsRef.current.user} />
            </Card.Body></Card>
          </Tab>
        </Tabs>
      </div>;
}


export default App;

App.propTypes = propTypes;
