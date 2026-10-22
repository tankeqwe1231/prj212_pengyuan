import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Badge, Row, Col, FormControl, Modal, OverlayTrigger,
  Tooltip } from 'react-bootstrap';
import visTypes from '../../stores/visTypes';
import ControlHeader from '../ControlHeader';
import { t } from '../../../locales';

const propTypes = {
  description: PropTypes.string,
  label: PropTypes.string,
  name: PropTypes.string.isRequired,
  onChange: PropTypes.func,
  value: PropTypes.string.isRequired,
};

const defaultProps = {
  onChange: () => {},
};
const visOrder = ['line', 'bar', 'echarts_combine', 'echarts_stat_line', 'echarts_stat_line_2',
  'echarts_season_lunar_calendar', 'echarts_multiple_y', 'echarts_bolling_bond', 'highcharts_candle_stick',
  'echarts_events', 'echarts_yoy_and_mom', 'box_plot', 'bubble', 'dual_line', 'time_pivot', 'compare',
  'echarts_correlation', 'echarts_category_line', 'echarts_bubble', 'echarts_radar', 'time_table', 'pivot_table',
  'table', 'ag_grid', 'dist_bar', 'echarts_dist_combine', 'histogram', 'iframe', 'markup', 'filter_box',
  'filter_box_min', 'ckeditor_slice', 'html_set'];

function VizTypeControl(incomingProps) {
  const props = { ...incomingProps };
  Object.keys(VizTypeControl.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = VizTypeControl.defaultProps[key];
  });
  const propsRef = useRef(props);
  propsRef.current = props;
  const [state, setState] = useState(() => ({
    showModal: false,
    filter: ''
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
  const searchRefRef = useRef(undefined);
  function onChange(vizType) {
    propsRef.current.onChange(vizType);
    updateState({
      showModal: false
    });
  }
  function setSearchRef(searchRef) {
    searchRefRef.current = searchRef;
  }
  function toggleModal() {
    updateState({
      showModal: !stateRef.current.showModal
    });
  }
  function changeSearch(event) {
    updateState({
      filter: event.target.value
    });
  }
  function focusSearch() {
    if (searchRefRef.current) {
      searchRefRef.current.focus();
    }
  }
  function renderVizType(vizType) {
    const vt = vizType;
    return <div className={`viztype-selector-container ${vt === propsRef.current.value ? 'selected' : ''}`} onClick={onChange.bind(undefined, vt)}>
        <img alt={`viz-type-${vt}`} width="100%" className={`viztype-selector ${propsRef.current.value === vt ? 'selected' : ''}`} src={`/static/assets/images/viz_thumbnails/${vt}.png`} />
        <div className="viztype-label">
          {visTypes[vt].label}
        </div>
      </div>;
  }
  const filter = stateRef.current.filter;
  const filteredVizTypes = Object.keys(visTypes).filter(vt => filter.length === 0 || visTypes[vt].label.toLowerCase().includes(filter));

  // 将filteredVizTypes按照visOrder排序，不在visOrder中的元素放在最后
  filteredVizTypes.sort((a, b) => {
    const aIndex = visOrder.indexOf(a);
    const bIndex = visOrder.indexOf(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });
  const imgPerRow = 6;
  const rows = [];
  for (let i = 0; i <= filteredVizTypes.length; i += imgPerRow) {
    rows.push(<Row key={`row-${i}`}>
          {filteredVizTypes.slice(i, i + imgPerRow).map(vt => <Col md={12 / imgPerRow} key={`grid-col-${vt}`}>
              {renderVizType(vt)}
            </Col>)}
        </Row>);
  }
  return <div>
        <ControlHeader {...propsRef.current} />
        <OverlayTrigger placement="right" overlay={<Tooltip id={'error-tooltip'}>Click to change visualization type</Tooltip>}>
          <Badge onClick={toggleModal} style={{
        cursor: 'pointer'
      }} className="bg-secondary">
            {visTypes[propsRef.current.value].label}
          </Badge>
        </OverlayTrigger>
        <Modal show={stateRef.current.showModal} onHide={toggleModal} onEnter={focusSearch} onExit={setSearchRef} size="lg">
          <Modal.Header closeButton>
            <Modal.Title>{t('Select a visualization type')}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div>
              <FormControl id="formControlsText" ref={ref => {
            setSearchRef(ref);
          }} type="text" size="sm" value={stateRef.current.filter} placeholder={t('Search / Filter')} onChange={changeSearch} />
            </div>
            {rows}
          </Modal.Body>
        </Modal>
      </div>;
}


export default VizTypeControl;

VizTypeControl.propTypes = propTypes;
VizTypeControl.defaultProps = defaultProps;
