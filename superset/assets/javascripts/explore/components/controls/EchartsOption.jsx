import React from 'react';
import PropTypes from 'prop-types';
import { OverlayTrigger, Popover } from 'react-bootstrap';
import { connect } from 'react-redux';
import shortid from 'shortid';

import InfoTooltipWithTrigger from '../../../components/InfoTooltipWithTrigger';
import SortableList from '../../../components/SortableList';
import ControlHeader from '../ControlHeader';
import EchartsOptionEditor from './EchartsOptionEditor';
import { getChartKey } from '../../exploreUtils';
import { t } from '../../../locales';

function moveItem(items, oldIndex, newIndex) {
  const nextItems = items.slice();
  nextItems.splice(newIndex, 0, nextItems.splice(oldIndex, 1)[0]);
  return nextItems;
}

export function EchartsOption({
  onChange = () => {},
  seriesOptions = [],
  value = [],
  vizType = '',
  ...props
}) {
  const usedTypes = exceptIndex => value
    .filter((item, index) => index !== exceptIndex && item.type)
    .map(item => item.type);
  const changeItem = (index, item) => {
    const nextValue = value.slice();
    nextValue[index] = item;
    onChange(nextValue);
  };
  const renderPopover = (index, item) => (
    <Popover id={`echarts-option-pop-${item.key}`} style={{ maxWidth: 'none' }}>
      <Popover.Header as="h3">{t('配置项编辑')}</Popover.Header>
      <Popover.Body><EchartsOptionEditor
        item={item}
        onChange={nextItem => changeItem(index, nextItem)}
        seriesOptions={seriesOptions}
        usedTypes={usedTypes(index)}
        vizType={vizType}
      /></Popover.Body>
    </Popover>
  );

  return (
    <div className="echarts-option-control">
      <ControlHeader {...props} />
      {value.length === 0 ? <div className="text-muted">{t('暂无配置项')}</div> : (
        <SortableList
          items={value}
          keyAccessor={item => item.key}
          onMove={(oldIndex, newIndex) => onChange(moveItem(value, oldIndex, newIndex))}
        >
          {(item, index) => (
            <React.Fragment>
              <div className="float-start m-r-5">
                <i className="fa fa-bars text-primary" style={{ cursor: 'grab' }} />
              </div>
              <div className="float-start">
                <span>{item.label || t('未命名')}</span>{' '}
                <OverlayTrigger
                  container={document.body}
                  overlay={renderPopover(index, item)}
                  placement="right"
                  rootClose
                  trigger="click"
                >
                  <InfoTooltipWithTrigger className="text-primary" icon="edit" label="edit-echarts-option" />
                </OverlayTrigger>
              </div>
              <div className="float-end">
                <InfoTooltipWithTrigger
                  variant="primary"
                  icon="times"
                  label="remove-item"
                  onClick={() => onChange(value.filter((option, itemIndex) => index !== itemIndex))}
                  tooltip={t('删除')}
                />
              </div>
            </React.Fragment>
          )}
        </SortableList>
      )}
      <div className="echarts-option-add-item">
        <InfoTooltipWithTrigger
          variant="primary"
          className="fa-lg"
          icon="plus-circle"
          label="add-item"
          onClick={() => onChange(value.concat([{
            config: {},
            key: shortid.generate(),
            label: t('新配置项'),
            type: null,
          }]))}
          tooltip={t('新增配置项')}
        />
      </div>
    </div>
  );
}

EchartsOption.propTypes = {
  onChange: PropTypes.func,
  value: PropTypes.array,
  vizType: PropTypes.string,
  seriesOptions: PropTypes.array,
};

function mapStateToProps({ charts, explore }) {
  const chart = charts[getChartKey(explore)];
  const queryResponse = chart ? chart.queryResponse : null;
  const index = queryResponse && queryResponse.data && queryResponse.data.data
    ? queryResponse.data.data.index
    : null;
  return {
    seriesOptions: Array.isArray(index) ? index.map(name => ({ value: name, label: String(name) })) : [],
    vizType: explore.controls.viz_type.value,
  };
}

export default connect(mapStateToProps)(EchartsOption);
