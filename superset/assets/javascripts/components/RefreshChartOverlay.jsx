import React from 'react';
import PropTypes from 'prop-types';
import Button from '../components/Button';
import { t } from '../locales';

const propTypes = {
  height: PropTypes.number.isRequired,
  width: PropTypes.number.isRequired,
  onQuery: PropTypes.func,
  onDismiss: PropTypes.func,
};

function RefreshChartOverlay({ height, width, onQuery, onDismiss }) {
    return <div style={{
      height,
      width
    }} className="explore-chart-overlay">
        <div>
          <Button className="refresh-overlay-btn" onClick={onQuery} variant="primary">
            {t('Run Query')}
          </Button>
          <Button className="dismiss-overlay-btn" onClick={onDismiss}>
            {t('Dismiss')}
          </Button>
        </div>
      </div>;
}

RefreshChartOverlay.propTypes = propTypes;

export default RefreshChartOverlay;
