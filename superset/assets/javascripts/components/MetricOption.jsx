import React from 'react';
import PropTypes from 'prop-types';

import ColumnTypeLabel from './ColumnTypeLabel';
import InfoTooltipWithTrigger from './InfoTooltipWithTrigger';
import { OverlayTrigger } from 'react-bootstrap';

const propTypes = {
  metric: PropTypes.object.isRequired,
  openInNewWindow: PropTypes.bool,
  showFormula: PropTypes.bool,
  showType: PropTypes.bool,
  url: PropTypes.string,
  show_modal_chart: PropTypes.bool,
  showPopoverChart: PropTypes.func,
  popoverChart: PropTypes.node,
};
export default function MetricOption({
  metric,
  openInNewWindow,
  showFormula = true,
  showType = false,
  url,
  show_modal_chart,
  showPopoverChart,
  popoverChart,
}) {
  const verbose = metric.verbose_name || metric.metric_name;
  let link = url ? (
    <a
      href={url}
      rel={openInNewWindow ? 'noopener noreferrer' : undefined}
      target={openInNewWindow ? '_blank' : undefined}
    >
      {verbose}
    </a>
  ) : verbose;
  if (show_modal_chart) {
    link = (
      <OverlayTrigger
        overlay={popoverChart}
        placement="right"
        rootClose
        trigger="click"
      >
        <span
          onClick={event => showPopoverChart(event, verbose)}
          style={{ color: '#00A699', cursor: 'pointer' }}
        >
          {verbose}
        </span>
      </OverlayTrigger>
    );
  }
  return (
    <div>
      {showType && <ColumnTypeLabel type="expression" />}
      <span className="m-r-5 option-label">{link}</span>
      {metric.description &&
        <InfoTooltipWithTrigger
          className="m-r-5 text-muted"
          icon="info"
          tooltip={metric.description}
          label={`descr-${metric.metric_name}`}
        />
      }
      {showFormula &&
        <InfoTooltipWithTrigger
          className="m-r-5 text-muted"
          icon="question-circle-o"
          tooltip={metric.expression}
          label={`expr-${metric.metric_name}`}
        />
      }
      {metric.warning_text &&
        <InfoTooltipWithTrigger
          className="m-r-5 text-danger"
          icon="warning"
          tooltip={metric.warning_text}
          label={`warn-${metric.metric_name}`}
        />
      }
    </div>);
}
MetricOption.propTypes = propTypes;
