import React from 'react';
import PropTypes from 'prop-types';
import { FormLabel, OverlayTrigger, Tooltip } from 'react-bootstrap';
import InfoTooltipWithTrigger from '../../components/InfoTooltipWithTrigger';
import { t } from '../../locales';

const propTypes = {
  label: PropTypes.string,
  description: PropTypes.string,
  validationErrors: PropTypes.array,
  renderTrigger: PropTypes.bool,
  rightNode: PropTypes.node,
  leftNode: PropTypes.node,
  onClick: PropTypes.func,
  hovered: PropTypes.bool,
  tooltipOnClick: PropTypes.func,
  warning: PropTypes.string,
  danger: PropTypes.string,
};

function ControlHeader({ label, description, validationErrors = [], renderTrigger = false, rightNode, leftNode, onClick, hovered = false, tooltipOnClick, warning, danger }) {
  const renderOptionalIcons = () => {
    if (hovered) {
      return <span>
          {description && <span>
              <InfoTooltipWithTrigger label={t('description')} tooltip={description} placement="top" onClick={tooltipOnClick} />
              {' '}
            </span>}
          {renderTrigger && <span>
              <InfoTooltipWithTrigger label={t('bolt')} tooltip={t('Changing this control takes effect instantly')} placement="top" icon="bolt" />
              {' '}
            </span>}
        </span>;
    }
    return null;
  };
    if (!label) {
      return null;
    }
    const labelClass = validationErrors.length > 0 ? 'text-danger' : '';
    return <div className="ControlHeader">
        <div className="float-start">
          <FormLabel>
            {leftNode && <span>{leftNode}</span>}
            <span onClick={onClick} className={labelClass} style={{
            cursor: onClick ? 'pointer' : ''
          }}>
              {label}
            </span>
            {' '}
            {warning && <span>
                <OverlayTrigger placement="top" overlay={<Tooltip id={'error-tooltip'}>{warning}</Tooltip>}>
                  <i className="fa fa-exclamation-circle text-warning" />
                </OverlayTrigger>
                {' '}
              </span>}
            {danger && <span>
                <OverlayTrigger placement="top" overlay={<Tooltip id={'error-tooltip'}>{danger}</Tooltip>}>
                  <i className="fa fa-exclamation-circle text-danger" />
                </OverlayTrigger>
                {' '}
              </span>}
            {validationErrors.length > 0 && <span>
                <OverlayTrigger placement="top" overlay={<Tooltip id={'error-tooltip'}>
                      {validationErrors.join(' ')}
                    </Tooltip>}>
                  <i className="fa fa-exclamation-circle text-danger" />
                </OverlayTrigger>
                {' '}
              </span>}
            {renderOptionalIcons()}
          </FormLabel>
        </div>
        {rightNode && <div className="float-end">
            {rightNode}
          </div>}
        <div className="clearfix" />
      </div>;
}
export default ControlHeader;

ControlHeader.propTypes = propTypes;
