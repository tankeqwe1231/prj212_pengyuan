// JS
import d3 from 'd3';
import React, { useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { renderReact } from '../javascripts/modules/reactRoot';
import Tree from '../javascripts/components/Tree';
import TreebeardStyles from '../javascripts/components/treeStyles';
import * as Treebeardfilters from '../javascripts/components/treeFilter';

import CreatableSelect from 'react-select/creatable';

import debounce from 'lodash.debounce';
import { Button } from 'react-bootstrap';

import DateFilterControl from '../javascripts/explore/components/controls/DateFilterControl';
import ControlRow from '../javascripts/explore/components/ControlRow';
import Control from '../javascripts/explore/components/Control';
import controls from '../javascripts/explore/stores/controls';
import OnPasteSelect from '../javascripts/components/OnPasteSelect';
import WindowedMenuList from '../javascripts/components/WindowedMenuList';
import { normalizeSelectValue } from '../javascripts/components/selectUtils';
import './filter_box.css';
import { t } from '../javascripts/locales';

const formatFilterOptionLabel = option => <div style={option.style}>{option.label}</div>;

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
};

let treeData = {
// const treeData = {
//     name: '目录',
//     toggled: true,
//     children: [
        // {
        //     name: 'parent',
        //     children: [
        //         { name: 'child1' },
        //         { name: 'child2' }
        //     ]
        // },
        // {
        //     name: 'loading parent',
        //     loading: true,
        //     children: []
        // },
        // {
        //     name: 'parent',
        //     children: [
        //         {
        //             name: 'nested parent',
        //             children: [
        //                 { name: 'nested child 1' },
        //                 { name: 'nested child 2' }
        //             ]
        //         }
        //     ]
        // }
    // ]
};

function FilterBox(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(FilterBox.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = FilterBox.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    selectedValues: props.origSelectedValues,
    hasChanged: false,
    showDropdown: false,
    selectInputValues: {},
    // 控制下拉框显示的变量
    treeData,
    cursor: null
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
  const throttledOnFilterMouseUpRef = useRef(debounce(onFilterMouseUp, 350));
  const throttledHandleInputChangeRef = useRef(debounce(handleInputChange, 350));
  function onToggle(node, toggled) {
    // console.log(node, toggled, '2');
    const {
      cursor
    } = stateRef.current;
    if (cursor) {
      cursor.active = false;
    }
    node.active = true;
    if (node.children) {
      node.toggled = toggled;
    } else {
      handleNodeClick(node.name);
    }
    updateState({
      cursor: node
    });
  }
  function onFilterMouseUp() {
    // console.log(new Date().getTime(), e.key,e.target);
    // if (e.key !== 'Enter' || !e || !e.target) {
    //     return false;
    // }
    // const filter = e.target.value.trim();
    const filterInput = document.getElementById('n_search_id').value.trim();
    if (!filterInput) {
      return updateState({
        treeData
      });
    }
    // 支持多关键字检索，以空格分隔
    const keywords = filterInput.split(/\s+/).filter(keyword => keyword.length > 0);
    // 创建多关键字匹配器
    const multiKeywordMatcher = (filterText, node) => {
      return keywords.every(keyword => node.name.toLowerCase().includes(keyword.toLowerCase()));
    };
    let filtered = Treebeardfilters.filterTree(treeData, filterInput, multiKeywordMatcher);
    filtered = Treebeardfilters.expandFilteredNodes(filtered, filterInput, multiKeywordMatcher);
    updateState({
      treeData: filtered
    });
  }
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
  function clickApply() {
    const {
      selectedValues
    } = stateRef.current;
    Object.keys(selectedValues).forEach((fltr, i, arr) => {
      let refresh = false;
      if (i === arr.length - 1) {
        refresh = true;
      }
      propsRef.current.onChange(fltr, selectedValues[fltr], false, refresh);
    });
    updateState({
      hasChanged: false
    });
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
  function handleNodeClick(nodeName) {
    const selectLabel = Object.keys(propsRef.current.filtersChoices)[0];
    const selectedValues = Object.assign({}, stateRef.current.selectedValues);
    if (selectedValues[selectLabel] && selectedValues[selectLabel].length > 0) {
      // 复制selectedValues[selectLabel]为新数组
      const newSelectedValues = selectedValues[selectLabel].slice(0);
      if (newSelectedValues.indexOf(nodeName) === -1) {
        newSelectedValues.push(nodeName);
        selectedValues[selectLabel] = newSelectedValues;
        updateState({
          selectedValues,
          hasChanged: true
        });
      }
    } else {
      selectedValues[selectLabel] = [nodeName];
      updateState({
        selectedValues,
        hasChanged: true
      });
    }
  }
  function handleInputChange(value) {
    const filterInput = value.trim();
    if (!filterInput) {
      return updateState({
        treeData
      });
    }
    // 支持多关键字检索，以空格分隔
    const keywords = filterInput.split(/\s+/).filter(keyword => keyword.length > 0);
    // 创建多关键字匹配器
    const multiKeywordMatcher = (filterText, node) => {
      return keywords.every(keyword => node.name.toLowerCase().includes(keyword.toLowerCase()));
    };
    let filtered = Treebeardfilters.filterTree(treeData, filterInput, multiKeywordMatcher);
    filtered = Treebeardfilters.expandFilteredNodes(filtered, filterInput, multiKeywordMatcher);
    updateState({
      treeData: filtered
    });
    // return value;
  }
  function changeSelectInput(filter, value, actionMeta) {
    if (actionMeta.action === 'input-change') {
      updateState({
        selectInputValues: {
          ...stateRef.current.selectInputValues,
          [filter]: value
        }
      });
      throttledHandleInputChangeRef.current(value);
    }
    return value;
  }
  function renderTreeMenu() {
    const {
      treeData: stateData
    } = stateRef.current;
    return <div className="filter-box-tree">
        <div className="filter-box-tree-search" style={TreebeardStyles.searchBox}>
          <input className="Select-control" id="n_search_id" style={{
          cursor: 'text'
        }} onKeyUp={throttledOnFilterMouseUpRef.current} placeholder="输入关键字(多个以空格分隔)" type="text" />
        </div>
        <div className="filter-box-tree-scroll">
          <Tree data={stateData}
        // decorators={decorators}
        onToggle={onToggle} style={TreebeardStyles.treebeard_tree} />
        </div>
      </div>;
  }
  propsRef.current = props;
  useLayoutEffect(() => {
    const throttledOnFilterMouseUp = throttledOnFilterMouseUpRef.current;
    const throttledHandleInputChange = throttledHandleInputChangeRef.current;
    return () => {
      throttledOnFilterMouseUp.cancel();
      throttledHandleInputChange.cancel();
    };
  }, []);
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
  const filters = Object.keys(propsRef.current.filtersChoices).map(filter => {
    const data = propsRef.current.filtersChoices[filter];
    const maxes = {};
    maxes[filter] = d3.max(data, function (d) {
      return d.metric;
    });
    const filterOptions = data.map(opt => {
      const perc = Math.round(opt.metric / maxes[opt.filter] * 100);
      const backgroundImage = 'linear-gradient(to right, lightgrey, ' + `lightgrey ${perc}%, rgba(0,0,0,0) ${perc}%`;
      return {
        value: opt.id,
        label: opt.id,
        style: {
          backgroundImage,
          padding: '2px 5px'
        }
      };
    });
    return <div key={filter} className="m-b-5">
          {propsRef.current.datasource.verbose_map[filter] || filter}
          <OnPasteSelect className="filter-box-select" placeholder={t('Select [%s]', filter)} key={filter} isMulti value={normalizeSelectValue(stateRef.current.selectedValues[filter], filterOptions, 'value', 'label', true)} options={filterOptions} onChange={changeFilter.bind(undefined, filter)} SelectComponent={CreatableSelect} components={{
        MenuList: WindowedMenuList
      }} formatOptionLabel={formatFilterOptionLabel} {...propsRef.current.showTreeNode && {
        inputValue: stateRef.current.selectInputValues[filter] || '',
        onInputChange: changeSelectInput.bind(undefined, filter),
        maxMenuHeight: 0,
        placeholder: '输入关键字(多个以空格分隔)'
      }} />
        </div>;
  });
  const hasSelectedFilterValue = Object.keys(propsRef.current.filtersChoices).some((filter) => {
    const value = stateRef.current.selectedValues[filter];
    return Array.isArray(value) ? value.length > 0 : value !== null && typeof value !== 'undefined' && value !== '';
  });
  return <div className={`filter-box-layout${propsRef.current.showTreeNode ? ' has-tree' : ''}`}>
        <div className="filter-box-controls">
          {dateFilter}
          {datasourceFilters}
          {filters}
          {!propsRef.current.instantFiltering && <Button size="sm" variant="primary" onClick={clickApply.bind(undefined)} disabled={!stateRef.current.hasChanged || !hasSelectedFilterValue}>
              {t('Apply')}
            </Button>}
        </div>
        {propsRef.current.showTreeNode && renderTreeMenu()}
      </div>;
}


FilterBox.propTypes = propTypes;
FilterBox.defaultProps = defaultProps;
export { FilterBox };

function filterBox(slice, payload) {
    // console.log(slice.height(), '1');
    treeData = {};
  const d3token = d3.select(slice.selector);
  d3token.style('height', `${Math.max(slice.height(), 0)}px`);
  // renderReact 会缓存该容器上的 React root，清空容器的子节点会让后续
  // root.render() 只更新已脱离文档的节点，slice 内容随之全部消失。
  if (payload.data.tree_node_dict) {
      // treeData.children = payload.data.tree_node_dict;
      treeData = payload.data.tree_node_dict;
  }
  // filter box should ignore the dashboard's filters
  // const url = slice.jsonEndpoint({ extraFilters: false });
  const fd = slice.formData;
  const filtersChoices = {};
  // Making sure the ordering of the fields matches the setting in the
  // dropdown as it may have been shuffled while serialized to json
  fd.groupby.forEach((f) => {
    filtersChoices[f] = payload.data[f];
  });
  renderReact(
    <FilterBox
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
      showTreeNode={Object.keys(treeData).length > 0}
    />,
    document.getElementById(slice.containerId),
  );
}

export default filterBox;
