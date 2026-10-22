import React, { useRef, useState } from 'react';
import { OverlayTrigger, Popover } from 'react-bootstrap';
import OnPasteSelect from '../../components/OnPasteSelect';
import WindowedMenuList from '../../components/WindowedMenuList';


function SearchSlicesSelect(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(SearchSlicesSelect.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = SearchSlicesSelect.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    selectedValue: null,
    inputValue: '',
    options: [],
    isLoading: false
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
  function handleSelectChange(option) {
    updateState({
      selectedValue: option
    });
    console.log('选择的值：', option);
    if (option && option.value) {
      const [sliceId, dashboardId] = option.value.split('-');
      if (sliceId && dashboardId) {
        window.open(`/superset/dashboard/${dashboardId}/?slice_id=${sliceId}`, '_blank');
      }
    }
  }
  function loadUserSlicesData() {
    if (stateRef.current.options.length === 0 && !stateRef.current.isLoading) {
      updateState({
        isLoading: true
      });
      $.ajax({
        url: '/superset/user_slices_with_dashboards',
        type: 'GET',
        success: data => {
          const formattedOptions = data.map(item => ({
            id: item.slice_id,
            label: `${item.slice_name} 【页面：${item.dashboard_title}】`,
            value: `${item.slice_id}-${item.dashboard_id}`
          }));
          updateState({
            options: formattedOptions,
            isLoading: false
          });
        },
        error: xhr => {
          console.error('获取图表数据失败:', xhr.responseText);
          updateState({
            isLoading: false
          });
        }
      });
    }
  }
  function renderPopover() {
    const filterOption = (candidate, inputValue) => {
      if (!inputValue) return true;
      const keywords = inputValue.toLowerCase().split(/\s+/).filter(k => k);
      const label = candidate.data.label.toLowerCase();
      return keywords.every(keyword => label.includes(keyword));
    };
    return <Popover id="pop-search-slices">
        <Popover.Body style={{
        width: 400,
        height: 300
      }}>
          <OnPasteSelect placeholder="输入关键字(多个以空格分隔)，选中或按回车跳转..." options={stateRef.current.options} value={stateRef.current.selectedValue} onChange={handleSelectChange} isMulti={false} maxMenuHeight={275} isLoading={stateRef.current.isLoading} closeMenuOnSelect={false} inputValue={stateRef.current.inputValue} onInputChange={(inputValue, actionMeta) => {
          if (actionMeta.action === 'input-change') {
            updateState({
              inputValue
            });
          }
          return inputValue;
        }} filterOption={filterOption} components={{
          MenuList: WindowedMenuList
        }} />
        </Popover.Body>
      </Popover>;
  }
  propsRef.current = props;
  return <OverlayTrigger trigger="click" placement="bottom" overlay={renderPopover()} rootClose onEnter={loadUserSlicesData}>
        <button className="nav-link" type="button" title="图表搜索">
          <i className="fa fa-search" />
        </button>
      </OverlayTrigger>;
}



export default SearchSlicesSelect;
