import React, { useLayoutEffect, useRef, useState } from 'react';
import $ from 'jquery';
import '../../../stylesheets/search-global.css';
import { fetchPost } from '../../dify/utils/api';

function SearchGlobal(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(SearchGlobal.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = SearchGlobal.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    isVisible: false,
    filteredSliceData: [],
    dataQueryDashboards: [],
    isLoading: false,
    searchKeyword: '',
    currentPage: 1,
    pageSize: 10,
    workflowResults: null,
    isWorkflowLoading: false
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
  const titleMapRef = useRef({});
  const modalContainerRef = useRef(undefined);
  function showModal() {
    if (stateRef.current.isVisible) {
      return;
    }
    updateState({
      isVisible: true
    });
  }
  function hideModal() {
    updateState({
      isVisible: false
    });
    const searchInput = modalContainerRef.current.querySelector('.search-input');
    if (searchInput) {
      searchInput.value = '';
    }
    const chartListContainer = modalContainerRef.current.querySelector('.chart-list-container');
    if (chartListContainer) {
      chartListContainer.innerHTML = '<div class="no-data">请输入关键字进行搜索</div>';
    }
    const paginationContainer = modalContainerRef.current.querySelector('.pagination-container');
    if (paginationContainer) {
      paginationContainer.innerHTML = '';
    }
    const placeholderContents = modalContainerRef.current.querySelectorAll('.placeholder-content');
    placeholderContents.forEach(content => {
      content.innerHTML = '...';
    });
    updateState({
      searchKeyword: '',
      filteredSliceData: [],
      dataQueryDashboards: [],
      currentPage: 1,
      workflowResults: null,
      isWorkflowLoading: false
    });
  }
  function handleSearch() {
    const searchInput = modalContainerRef.current ? modalContainerRef.current.querySelector('.search-input') : null;
    const searchKeyword = searchInput ? searchInput.value : '';
    if (!searchKeyword.trim() || searchKeyword === stateRef.current.searchKeyword) {
      return;
    }
    updateState({
      searchKeyword,
      currentPage: 1,
      isLoading: true,
      isWorkflowLoading: true
    });
    $.ajax({
      url: '/superset/user_slices_with_dashboards',
      type: 'GET',
      data: {
        keyword: searchKeyword
      },
      success: data => {
        updateState({
          filteredSliceData: data.slices_dashboards || [],
          dataQueryDashboards: data.data_query_dashboards || [],
          isLoading: false
        });
      },
      error: () => {
        notify.error('图表数据获取失败');
        updateState({
          isLoading: false
        });
      }
    });

    // 调用工作流API
    callWorkflowAPI(searchKeyword);
  }
  function callWorkflowAPI(query) {
    // 使用fetchPost来实现请求
    fetchPost('/superset/api/dify/workflows/run', {
      inputs: {
        query
      },
      response_mode: 'blocking',
      app_index: 'slices-search'
    }).then(response => {
      if (!response.ok) {
        throw new Error(`HTTP状态码: ${response.status}`);
      }
      return response.json();
    }).then(data => {
      titleMapRef.current = data.titleMap;
      updateState({
        workflowResults: data,
        isWorkflowLoading: false
      });
    }).catch(error => {
      console.error('工作流请求失败:', error);
      updateState({
        isWorkflowLoading: false,
        workflowResults: null
      });
    });
  }
  function handlePageChange(page) {
    updateState({
      currentPage: page
    });
  }
  function handleItemClick(item) {
    window.open(`/superset/dashboard/${item.dashboard_id}/?slice_id=${item.slice_id}`, '_blank');
  }
  function createModalStructure() {
    if (!modalContainerRef.current) return;
    modalContainerRef.current.innerHTML = `
      <div class="search-global-modal" style="display: none;">
        <div class="modal-content">
          <div class="modal-body">
            <button class="close-btn">
              <i class="fa fa-times"></i>
            </button>
            <div class="search-section">
              <div class="search-input-group">
                <input
                  type="text"
                  class="search-input"
                  placeholder="输入关键字(多个以空格分隔)..."
                />
                <button class="search-btn">搜索</button>
              </div>
            </div>
            <div class="content-section">
              <div class="left-panel">
                <h5 class="section-title">相关图表列表</h5>
                <div class="chart-list-container">
                  <div class="no-data">请输入关键字进行搜索</div>
                </div>
                <div class="pagination-container"></div>
              </div>
              <div class="right-panel">
                <div class="panel-section">
                  <h5 class="section-title">猜你喜欢</h5>
                  <div class="placeholder-content">暂无数据</div>
                </div>
                <div class="panel-section">
                  <h5 class="section-title">数据直达</h5>
                  <div class="placeholder-content">暂无数据</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    bindFixedEvents();
  }
  function bindFixedEvents() {
    if (!modalContainerRef.current) return;
    const closeBtn = modalContainerRef.current.querySelector('.close-btn');
    const searchInput = modalContainerRef.current.querySelector('.search-input');
    const searchBtn = modalContainerRef.current.querySelector('.search-btn');
    if (closeBtn) {
      closeBtn.onclick = () => hideModal();
    }
    if (searchInput) {
      searchInput.onkeypress = e => {
        if (e.key === 'Enter') {
          handleSearch();
        }
      };
    }
    if (searchBtn) {
      searchBtn.onclick = () => handleSearch();
    }
  }
  function toggleModal(show) {
    if (!modalContainerRef.current) return;
    const modal = modalContainerRef.current.querySelector('.search-global-modal');
    if (modal) {
      modal.style.display = show ? 'flex' : 'none';
    }
  }
  function updateDynamicContent() {
    if (!modalContainerRef.current) return;
    if (stateRef.current.searchKeyword === '') {
      return;
    }

    // 更新图表列表
    const chartListContainer = modalContainerRef.current.querySelector('.chart-list-container');
    if (chartListContainer) {
      chartListContainer.innerHTML = renderChartListHtml();
      const chartItems = chartListContainer.querySelectorAll('.chart-item');
      chartItems.forEach((item, index) => {
        const {
          filteredSliceData,
          currentPage,
          pageSize
        } = stateRef.current;
        const startIndex = (currentPage - 1) * pageSize;
        const dataItem = filteredSliceData[startIndex + index];
        if (dataItem) {
          item.onclick = () => handleItemClick(dataItem);
        }
      });
    }

    // 更新分页
    const paginationContainer = modalContainerRef.current.querySelector('.pagination-container');
    if (paginationContainer) {
      paginationContainer.innerHTML = renderPaginationHtml();
      // 重新绑定分页按钮事件
      const pageButtons = paginationContainer.querySelectorAll('.page-btn');
      pageButtons.forEach(btn => {
        const page = btn.getAttribute('data-page');
        const action = btn.getAttribute('data-action');
        if (page) {
          // 数字页码按钮
          btn.onclick = () => handlePageChange(parseInt(page));
        } else if (action) {
          // 控制按钮
          const totalPages = Math.ceil(stateRef.current.filteredSliceData.length / stateRef.current.pageSize);
          switch (action) {
            case 'first':
              btn.onclick = () => handlePageChange(1);
              break;
            case 'prev':
              btn.onclick = () => handlePageChange(Math.max(1, stateRef.current.currentPage - 1));
              break;
            case 'next':
              btn.onclick = () => handlePageChange(Math.min(totalPages, stateRef.current.currentPage + 1));
              break;
            case 'last':
              btn.onclick = () => handlePageChange(totalPages);
              break;
          }
        }
      });
    }

    // 更新数据直达部分
    updateDataDirectAccess();
    // 更新猜你喜欢部分
    updateGuessYouLike();
  }
  function updateDataDirectAccess() {
    if (!modalContainerRef.current) return;
    const dataDirectContainer = modalContainerRef.current.querySelector('.panel-section:last-child .placeholder-content');
    if (!dataDirectContainer) return;
    const {
      dataQueryDashboards
    } = stateRef.current;
    if (dataQueryDashboards.length === 0) {
      dataDirectContainer.innerHTML = '暂无数据';
      return;
    }
    const dataDirectHtml = dataQueryDashboards.map((item, index) => `<div class="data-direct-item" data-dashboard-id="${item.dashboard_id}">
        ${index + 1}. ${item.dashboard_title}
      </div>`).join('');
    dataDirectContainer.innerHTML = dataDirectHtml;
    const dataDirectItems = dataDirectContainer.querySelectorAll('.data-direct-item');
    dataDirectItems.forEach((item, index) => {
      item.onclick = () => {
        const dashboardItem = dataQueryDashboards[index];
        if (dashboardItem) {
          window.open(`/superset/dashboard/${dashboardItem.dashboard_id}/`, '_blank');
        }
      };
    });
  }
  function updateGuessYouLike() {
    if (!modalContainerRef.current) return;
    const guessYouLikeContainer = modalContainerRef.current.querySelector('.panel-section:first-child .placeholder-content');
    if (!guessYouLikeContainer) return;
    const {
      workflowResults,
      isWorkflowLoading
    } = stateRef.current;
    if (isWorkflowLoading) {
      guessYouLikeContainer.innerHTML = '<div class="loading-text">正在搜索相关内容...</div>';
      return;
    }
    if (!workflowResults || !workflowResults.outputs) {
      guessYouLikeContainer.innerHTML = '暂无数据';
      return;
    }
    const {
      result_slices = [],
      result_index = []
    } = workflowResults.outputs;
    if (result_slices.length === 0 && result_index.length === 0) {
      guessYouLikeContainer.innerHTML = '暂无相关推荐';
      return;
    }
    let contentHtml = '';

    // 展示result_slices
    if (result_slices.length > 0) {
      result_slices.forEach((sliceInfo, index) => {
        contentHtml += `
          <div class="guess-slice-item" data-slice-id="${sliceInfo.sliceid}" data-dash-id="${sliceInfo.dashid}">
            <div class="guess-slice-number">${index + 1}.</div>
            <div class="guess-slice-content">
              <div class="guess-slice-name">${sliceInfo.slicename || '未知图表'}</div>
              <div class="guess-slice-dashboard">页面：${sliceInfo.topcategory || ''}-${sliceInfo.secondcategory || ''}-${sliceInfo.dashtitle || ''}</div>
            </div>
          </div>
        `;
      });
    }

    // 展示result_index
    if (result_index.length > 0) {
      const uniqueResults = [];
      const seenKeys = new Set();
      result_index.forEach(item => {
        const key = `${item['指标名'] || ''}|${item.title || ''}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          uniqueResults.push(item);
        }
      });
      uniqueResults.forEach((item, index) => {
        const indicatorName = item['指标名'];
        const displayName = indicatorName ? `指标名：${indicatorName}` : '未知指标';
        let clickHandler = '';
        let isClickable = false;
        if (item.title && indicatorName) {
          const titleParts = item.title.split('-');
          if (titleParts.length > 0) {
            const firstPart = titleParts[0];
            const titleMapItem = titleMapRef.current[firstPart];
            if (titleMapItem && titleMapItem.dashid && titleMapItem.filterSliceId) {
              const dashId = titleMapItem.dashid;
              const filterSliceId = titleMapItem.filterSliceId;
              const preselectFilters = {};
              preselectFilters[filterSliceId] = {
                指标名: [indicatorName]
              };
              const encodedFilters = encodeURIComponent(JSON.stringify(preselectFilters));
              const targetUrl = `/superset/dashboard/${dashId}/?preselect_filters=${encodedFilters}`;
              clickHandler = `data-url="${targetUrl}"`;
              isClickable = true;
            }
          }
        }
        contentHtml += `
          <div class="guess-index-item ${isClickable ? 'clickable' : ''}" ${clickHandler}>
            <div class="guess-index-number">${result_slices.length + index + 1}.</div>
            <div class="guess-index-content">
              <div class="guess-index-name">${displayName}</div>
            </div>
          </div>
        `;
      });
    }
    guessYouLikeContainer.innerHTML = contentHtml;

    // 绑定slice点击事件
    const sliceItems = guessYouLikeContainer.querySelectorAll('.guess-slice-item');
    sliceItems.forEach(item => {
      item.onclick = () => {
        const sliceId = item.getAttribute('data-slice-id');
        const dashId = item.getAttribute('data-dash-id');
        if (sliceId && dashId) {
          window.open(`/superset/dashboard/${dashId}/?slice_id=${sliceId}`, '_blank');
        }
      };
    });

    // 绑定index点击事件
    const indexItems = guessYouLikeContainer.querySelectorAll('.guess-index-item.clickable');
    indexItems.forEach(item => {
      item.onclick = () => {
        const url = item.getAttribute('data-url');
        if (url) {
          window.open(url, '_blank');
        }
      };
    });
  }
  function renderChartListHtml() {
    const {
      filteredSliceData,
      currentPage,
      pageSize,
      isLoading
    } = stateRef.current;
    if (isLoading) {
      return '<div class="loading">数据加载中...</div>';
    }
    if (filteredSliceData.length === 0) {
      return '<div class="no-data">暂无数据</div>';
    }
    const startIndex = (currentPage - 1) * pageSize;
    const currentData = filteredSliceData.slice(startIndex, startIndex + pageSize);
    const chartItemsHtml = currentData.map((item, index) => `
      <div class="chart-item">
        <div class="chart-number">${startIndex + index + 1}.</div>
        <div class="chart-content">
          <div class="chart-name">${item.slice_name}</div>
          <div class="chart-dashboard">页面：${item.top_category_name}-${item.second_category_name}-${item.dashboard_title}</div>
        </div>
      </div>
    `).join('');
    return `<div class="chart-list">${chartItemsHtml}</div>`;
  }
  function renderPaginationHtml() {
    const {
      filteredSliceData,
      currentPage,
      pageSize
    } = stateRef.current;
    const totalPages = Math.ceil(filteredSliceData.length / pageSize);
    if (totalPages <= 1) return '';
    let pages = [];
    if (totalPages <= 10) {
      // 总页数<=10时，显示全部页码
      for (let i = 1; i <= totalPages; i++) {
        pages.push(`<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`);
      }
    } else {
      // 总页数>10时，智能显示页码
      const delta = 2; // 当前页前后显示的页数
      const range = [];
      const rangeWithDots = [];
      // 始终显示第一页
      range.push(1);
      // 计算当前页周围的页码范围
      for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
        range.push(i);
      }
      if (totalPages > 1) {
        range.push(totalPages);
      }
      let l;
      for (let i of range) {
        if (l) {
          if (i - l === 2) {
            rangeWithDots.push(l + 1);
          } else if (i - l !== 1) {
            rangeWithDots.push('...');
          }
        }
        rangeWithDots.push(i);
        l = i;
      }
      pages = rangeWithDots.map(page => {
        if (page === '...') {
          return '<span class="page-ellipsis">...</span>';
        }
        return `<button class="page-btn ${page === currentPage ? 'active' : ''}" data-page="${page}">${page}</button>`;
      });
    }
    return `
      <div class="pagination">
        <button class="page-btn page-first" ${currentPage === 1 ? 'disabled' : ''} data-action="first">
          <i class="fa fa-angle-double-left"></i>
        </button>
        <button class="page-btn page-prev" ${currentPage === 1 ? 'disabled' : ''} data-action="prev">
          <i class="fa fa-angle-left"></i>
        </button>
        ${pages.join('')}
        <button class="page-btn page-next" ${currentPage === totalPages ? 'disabled' : ''} data-action="next">
          <i class="fa fa-angle-right"></i>
        </button>
        <button class="page-btn page-last" ${currentPage === totalPages ? 'disabled' : ''} data-action="last">
          <i class="fa fa-angle-double-right"></i>
        </button>
      </div>
    `;
  }
  propsRef.current = props;
  useLayoutEffect(() => {
    modalContainerRef.current = document.createElement('div');
    document.body.appendChild(modalContainerRef.current);
    createModalStructure();
    return () => {
      if (modalContainerRef.current) {
        document.body.removeChild(modalContainerRef.current);
      }
    };
    // The modal structure is created once and its handlers use current refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const previousCommitRef = useRef();
  useLayoutEffect(() => {
    if (previousCommitRef.current) {
      const {
        state: prevState
      } = previousCommitRef.current;
      const {
        isVisible,
        filteredSliceData,
        dataQueryDashboards,
        currentPage,
        isLoading,
        workflowResults,
        isWorkflowLoading
      } = stateRef.current;
      if (prevState.isVisible !== isVisible) {
        toggleModal(isVisible);
        if (isVisible && !prevState.isVisible) {
          setTimeout(() => {
            const searchInput = modalContainerRef.current.querySelector('.search-input');
            if (searchInput) {
              searchInput.focus();
            }
          }, 100);
        }
      }
      if (isVisible && (prevState.filteredSliceData !== filteredSliceData || prevState.dataQueryDashboards !== dataQueryDashboards || prevState.currentPage !== currentPage || prevState.isLoading !== isLoading || prevState.workflowResults !== workflowResults || prevState.isWorkflowLoading !== isWorkflowLoading)) {
        updateDynamicContent();
      }
    }
    previousCommitRef.current = {
      props: props,
      state: state
    };
  });
  return <button className="nav-link" type="button" title="全局搜索" onClick={showModal}>
        <i className="fa fa-search" />
      </button>;
}



export default SearchGlobal;

