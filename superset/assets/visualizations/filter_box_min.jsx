// JS
import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { renderReact } from '../javascripts/modules/reactRoot';
import { Badge, Tab, Tabs } from 'react-bootstrap';

import DateFilterControl from '../javascripts/explore/components/controls/DateFilterControl';
import ControlRow from '../javascripts/explore/components/ControlRow';
import Control from '../javascripts/explore/components/Control';
import controls from '../javascripts/explore/stores/controls';

import './filter_box_min.css';
import { t } from '../javascripts/locales';

// maps control names to their key in extra_filters
const timeFilterMap = {
  since: '__from',
  until: '__to',
  granularity_sqla: '__time_col',
  time_grain_sqla: '__time_grain',
  druid_time_origin: '__time_origin',
  granularity: '__granularity',
};
const propTypes = {
  origSelectedValues: PropTypes.object,
  instantFiltering: PropTypes.bool,
  filtersChoices: PropTypes.object,
  onChange: PropTypes.func,
  showDateFilter: PropTypes.bool,
  showSqlaTimeGrain: PropTypes.bool,
  showSqlaTimeColumn: PropTypes.bool,
  showDruidTimeGrain: PropTypes.bool,
  showDruidTimeOrigin: PropTypes.bool,
  datasource: PropTypes.object.isRequired,
  tabsGroup: PropTypes.object,
};
const defaultProps = {
  origSelectedValues: {},
  onChange: () => {},
  showDateFilter: false,
  showSqlaTimeGrain: false,
  showSqlaTimeColumn: false,
  showDruidTimeGrain: false,
  showDruidTimeOrigin: false,
  instantFiltering: true,
  tabsGroup: {},
  groupIsTabs: false,
};

function FilterBoxMin(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(FilterBoxMin.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = FilterBoxMin.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    selectedValues: props.origSelectedValues,
    hasChanged: false
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
  function getControlData(controlName) {
    const control = Object.assign({}, controls[controlName]);
    const controlData = {
      name: controlName,
      key: `control-${controlName}`,
      value: stateRef.current.selectedValues[timeFilterMap[controlName]],
      actions: {
        setControlValue: changeFilter.bind(undefined)
      }
    };
    Object.assign(control, controlData);
    const mapFunc = control.mapStateToProps;
    if (mapFunc) {
      return Object.assign({}, control, mapFunc(propsRef.current));
    }
    return control;
  }
  function clickApply(filter, value) {
    // 检查是否点击了相同的值
    const currentValue = stateRef.current.selectedValues[filter];
    if (currentValue && currentValue[0] === value) {
      return;
    }

    // 保留现有的所有选择值，只更新当前点击的 filter 值
    const selectedValues = {
      ...stateRef.current.selectedValues,
      [filter]: [value]
    };
    updateState({
      selectedValues,
      hasChanged: true
    });
    propsRef.current.onChange(filter, [value], false, true);
    // 应用所有当前选中的过滤器，包括日期过滤器
    // Object.keys(selectedValues).forEach((fltr, i, arr) => {
    //   let refresh = false;
    //   if (i === arr.length - 1) {
    //     refresh = true;
    //   }
    //   this.props.onChange(fltr, selectedValues[fltr], false, refresh);
    // });
  }
  function changeFilter(filter, options) {
    const fltr = timeFilterMap[filter] || filter;
    let vals = null;
    if (options !== null) {
      if (Array.isArray(options)) {
        vals = options.map(opt => opt.value);
      } else if (options.value) {
        vals = options.value;
      } else {
        vals = options;
      }
    }
    const selectedValues = Object.assign({}, stateRef.current.selectedValues);
    selectedValues[fltr] = vals;
    updateState({
      selectedValues,
      hasChanged: true
    });
    if (propsRef.current.instantFiltering) {
      propsRef.current.onChange(fltr, vals, false, true);
    }
  }
  propsRef.current = props;
  let dateFilter;
  const since = '__from';
  const until = '__to';
  if (propsRef.current.showDateFilter) {
    dateFilter = <div className="row space-1">
          <div className="col-lg-6 col-xs-12">
            <DateFilterControl name={since} label={t('Since')} description={t('Select starting date')} onChange={changeFilter.bind(undefined, since)} value={stateRef.current.selectedValues[since]} />
          </div>
          <div className="col-lg-6 col-xs-12">
            <DateFilterControl name={until} label={t('Until')} description={t('Select end date')} onChange={changeFilter.bind(undefined, until)} value={stateRef.current.selectedValues[until]} />
          </div>
        </div>;
  }
  const datasourceFilters = [];
  const sqlaFilters = [];
  const druidFilters = [];
  if (propsRef.current.showSqlaTimeGrain) sqlaFilters.push('time_grain_sqla');
  if (propsRef.current.showSqlaTimeColumn) sqlaFilters.push('granularity_sqla');
  if (propsRef.current.showDruidTimeGrain) druidFilters.push('granularity');
  if (propsRef.current.showDruidTimeOrigin) druidFilters.push('druid_time_origin');
  if (sqlaFilters.length) {
    datasourceFilters.push(<ControlRow key="sqla-filters" className="control-row" controls={sqlaFilters.map(control => <Control {...getControlData(control)} />)} />);
  }
  if (druidFilters.length) {
    datasourceFilters.push(<ControlRow key="druid-filters" className="control-row" controls={druidFilters.map(control => <Control {...getControlData(control)} />)} />);
  }
  // Add created options to filtersChoices, even though it doesn't exist,
  // or these options will exist in query sql but invisible to end user.
  for (const filterKey in stateRef.current.selectedValues) {
    if (!stateRef.current.selectedValues.hasOwnProperty(filterKey) || !(filterKey in propsRef.current.filtersChoices)) {
      continue;
    }
    const existValues = propsRef.current.filtersChoices[filterKey].map(f => f.id);
    for (const v of stateRef.current.selectedValues[filterKey]) {
      if (existValues.indexOf(v) === -1) {
        const addChoice = {
          filter: filterKey,
          id: v,
          text: v,
          metric: 0
        };
        propsRef.current.filtersChoices[filterKey].unshift(addChoice);
      }
    }
  }
  const {
    tabsGroup,
    groupIsTabs
  } = propsRef.current;
  const groupKeys = Object.keys(tabsGroup);

  // 判断 tabsGroup 是否为空对象
  const isTabsGroupEmpty = Object.keys(tabsGroup).length === 0;
  if (isTabsGroupEmpty) {
    // 使用原来的方式直接展示
    const filters = Object.keys(propsRef.current.filtersChoices).map(filter => {
      const data = propsRef.current.filtersChoices[filter];
      const currentValue = stateRef.current.selectedValues[filter];
      return <div key={filter} className="m-b-5" style={{
        display: "flex",
        flexWrap: "wrap"
      }}>
            {data.map(opt => {
          const isCurrentValue = currentValue && currentValue[0] === opt.id;
          return <Badge key={opt.id} bg={null} onClick={() => clickApply(filter, opt.id)} style={{
            cursor: "pointer",
            margin: "2px",
            backgroundColor: isCurrentValue ? "#00A699" : "rgb(156,156,156)",
            color: "#fff",
            border: "1px solid",
            borderRadius: "5px",
            borderColor: isCurrentValue ? "#00A699" : "#ddd",
            padding: "3px 3px",
            fontWeight: isCurrentValue ? "bold" : "normal"
          }}>
                  {opt.id}
                </Badge>;
        })}
          </div>;
    });
    return <div className="scrollbar-container">
          <div className="scrollbar-content">
            {dateFilter}
            {datasourceFilters}
            {filters}
          </div>
        </div>;
  } else if (!groupIsTabs) {
    // 按分组展示过滤器
    const filtersByGroup = {};
    groupKeys.forEach(key => {
      filtersByGroup[key] = [];
    });
    Object.keys(propsRef.current.filtersChoices).map(filter => {
      const data = propsRef.current.filtersChoices[filter];
      const currentValue = stateRef.current.selectedValues[filter];
      data.forEach(opt => {
        const isCurrentValue = currentValue && currentValue[0] === opt.id;
        const foundGroup = groupKeys.find(key => key !== '其他' && tabsGroup[key].includes(opt.id));
        if (foundGroup) {
          filtersByGroup[foundGroup].push(<Badge key={opt.id} bg={null} onClick={() => clickApply(filter, opt.id)} style={{
            cursor: 'pointer',
            margin: '2px',
            backgroundColor: isCurrentValue ? '#00A699' : 'rgb(156,156,156)',
            color: '#fff',
            border: '1px solid',
            borderRadius: '5px',
            borderColor: isCurrentValue ? '#00A699' : '#ddd',
            padding: '3px 3px',
            fontWeight: isCurrentValue ? 'bold' : 'normal'
          }}>
                {opt.id}
              </Badge>);
        } else {
          if (groupKeys.includes('其他')) {
            filtersByGroup['其他'].push(<Badge key={opt.id} bg={null} onClick={() => clickApply(filter, opt.id)} style={{
              cursor: 'pointer',
              margin: '2px',
              backgroundColor: isCurrentValue ? '#00A699' : 'rgb(156,156,156)',
              color: '#fff',
              border: '1px solid',
              borderRadius: '5px',
              borderColor: isCurrentValue ? '#00A699' : '#ddd',
              padding: '3px 3px',
              fontWeight: isCurrentValue ? 'bold' : 'normal'
            }}>
                  {opt.id}
                </Badge>);
          }
        }
      });
      return null;
    });
    return <div className="scrollbar-container">
          <div className="scrollbar-content">
            {dateFilter}
            {datasourceFilters}
            {groupKeys.map(groupKey => <div key={groupKey}>
                {/* <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>{groupKey}:</div> */}
                <div className="m-b-5" style={{
            display: 'flex',
            flexWrap: 'wrap'
          }}>
                <span style={{
              fontWeight: 'bold',
              marginRight: '5px'
            }}>{groupKey}:</span>{filtersByGroup[groupKey]}
                </div>
              </div>)}
          </div>
        </div>;
  } else if (groupIsTabs) {
    // 使用 Tabs 方式展示
    const filtersByGroup = {};
    groupKeys.forEach(key => {
      filtersByGroup[key] = [];
    });
    let defaultActiveKey = groupKeys[0];
    Object.keys(propsRef.current.filtersChoices).map(filter => {
      const data = propsRef.current.filtersChoices[filter];
      const currentValue = stateRef.current.selectedValues[filter];
      data.forEach(opt => {
        const isCurrentValue = currentValue && currentValue[0] === opt.id;
        const foundGroup = groupKeys.find(key => key !== '其他' && tabsGroup[key].includes(opt.id));
        if (isCurrentValue) {
          defaultActiveKey = foundGroup || (groupKeys.includes('其他') ? '其他' : defaultActiveKey);
        }
        if (foundGroup) {
          filtersByGroup[foundGroup].push(<Badge key={opt.id} bg={null} onClick={() => clickApply(filter, opt.id)} style={{
            cursor: 'pointer',
            margin: '2px',
            backgroundColor: isCurrentValue ? '#00A699' : 'rgb(156,156,156)',
            color: '#fff',
            border: '1px solid',
            borderRadius: '5px',
            borderColor: isCurrentValue ? '#00A699' : '#ddd',
            padding: '3px 3px',
            fontWeight: isCurrentValue ? 'bold' : 'normal'
          }}>
                {opt.id}
              </Badge>);
        } else {
          if (groupKeys.includes('其他')) {
            filtersByGroup['其他'].push(<Badge key={opt.id} bg={null} onClick={() => clickApply(filter, opt.id)} style={{
              cursor: 'pointer',
              margin: '2px',
              backgroundColor: isCurrentValue ? '#00A699' : 'rgb(156,156,156)',
              color: '#fff',
              border: '1px solid',
              borderRadius: '5px',
              borderColor: isCurrentValue ? '#00A699' : '#ddd',
              padding: '3px 3px',
              fontWeight: isCurrentValue ? 'bold' : 'normal'
            }}>
                  {opt.id}
                </Badge>);
          }
        }
      });
      return null;
    });
    return <div className="scrollbar-container">
          <div className="scrollbar-content">
            {dateFilter}
            {datasourceFilters}
            <Tabs defaultActiveKey={defaultActiveKey} id="filter-tabs">
              {groupKeys.map(key => <Tab eventKey={key} title={key} key={key}>
                  <div className="m-b-5" style={{
              display: 'flex',
              flexWrap: 'wrap'
            }}>
                    {filtersByGroup[key]}
                  </div>
                </Tab>)}
            </Tabs>
          </div>
        </div>;
  }
}


FilterBoxMin.propTypes = propTypes;
FilterBoxMin.defaultProps = defaultProps;
export { FilterBoxMin };

function filterBoxMin(slice, payload) {
  // filter box should ignore the dashboard's filters
  // const url = slice.jsonEndpoint({ extraFilters: false });
  const fd = slice.formData;
  const tabsGroup = fd.tabs_group ? JSON.parse(fd.tabs_group) : {};
  const groupIsTabs = fd.group_is_tabs;
  const filtersChoices = {};
  // Making sure the ordering of the fields matches the setting in the
  // dropdown as it may have been shuffled while serialized to json
  fd.groupby.forEach((f) => {
    filtersChoices[f] = payload.data[f];
  });
  renderReact(
    <FilterBoxMin
      filtersChoices={filtersChoices}
      onChange={slice.addFilter}
      showDateFilter={fd.date_filter}
      showSqlaTimeGrain={fd.show_sqla_time_granularity}
      showSqlaTimeColumn={fd.show_sqla_time_column}
      showDruidTimeGrain={fd.show_druid_time_granularity}
      showDruidTimeOrigin={fd.show_druid_time_origin}
      datasource={slice.datasource}
      origSelectedValues={slice.getFilters() || {}}
      instantFiltering={fd.instant_filtering}
      tabsGroup={tabsGroup}
      groupIsTabs={groupIsTabs}
    />,
    document.getElementById(slice.containerId),
  );
}

export default filterBoxMin;
