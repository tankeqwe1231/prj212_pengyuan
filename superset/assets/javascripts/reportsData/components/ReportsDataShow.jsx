import React, { useLayoutEffect, useRef, useState } from 'react';
import { Pagination } from 'react-bootstrap';
import axios from 'axios';
import AlertsWrapper from '../../components/AlertsWrapper';
import './reports_data_show.css';
import './reports_data_show_pdf.css';
import ReportsDataShowPDFModal from './ReportsDataShowPDFModal';

const baseUrl = '/reportsdatamanage';
const initDataDict = JSON.parse(document.getElementById('row-main-container').getAttribute('init-data-dict'));
const varietySections = Object.keys(initDataDict.variety_sections);
const reportTypes = initDataDict.report_types;

// 获取所有品种
function getAllVarieties() {
  const allVarieties = [];
  Object.keys(initDataDict.variety_sections).forEach(function(section) {
    const varieties = initDataDict.variety_sections[section];
    varieties.forEach(function(variety) {
      if (allVarieties.indexOf(variety) === -1) {
        allVarieties.push(variety);
      }
    });
  });
  return allVarieties;
}

const allVarieties = getAllVarieties();

function ReportsDataShow(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(ReportsDataShow.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = ReportsDataShow.defaultProps[key];
  });
  const propsRef = useRef(props);
  const mountedRef = useRef(true);
  const [state, setState] = useState(() => ({
    // 所有报告数据
    allReportsData: [],
    // 过滤后的报告数据
    filteredReportsData: [],
    // 当前页报告数据
    currentPageData: [],
    // 筛选条件
    selectedType: '全部',
    selectedSection: '全部',
    selectedVariety: '全部',
    // 品种选项（根据板块动态变化）
    varietyOptions: allVarieties,
    // 分页
    currentPage: 1,
    pageSize: 12,
    totalPages: 1,
    // 关键字搜索
    keywordInput: '',
    keywordSearch: '',
    // 悬停弹层
    hoverCardId: null,
    hoverPosition: null,
    // 卡片的边界信息
    hoverDescription: '',
    // 异步获取的描述内容
    hoverDescriptionLoading: false,
    // 描述加载中状态
    // 视频播放弹层
    showVideoModal: false,
    currentVideoUrl: '',
    // PDF弹出层
    showPDFModal: false,
    currentReport: null,
    aiDescription: '',
    loadingAI: false
  }));
  const stateRef = useRef(state);
  stateRef.current = state;
  const updateState = (update, callback) => {
    if (!mountedRef.current) return;
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
  const autoCloseTimerRef = useRef(null);
  const autoCloseTimeoutRef = useRef(50);
  const pendingRequestIdRef = useRef(undefined);
  function fetchReportsData() {
    const fileType = window.location.pathname.split('/').pop();
    axios.post(`${baseUrl}/show/${fileType}`, {
      action: 'get_reports'
    }).then(response => {
      if (response.data && response.data.reports_data) {
        updateState({
          allReportsData: response.data.reports_data
        }, () => {
          filterReportsData();
        });
      }
    }).catch(error => {
      console.error('获取报告数据失败:', error);
      notify.error('获取报告数据失败');
    });
  }
  function handleTypeChange(e) {
    updateState({
      selectedType: e.target.value,
      selectedSection: '全部',
      selectedVariety: '全部',
      varietyOptions: allVarieties,
      currentPage: 1
    }, () => {
      filterReportsData();
    });
  }
  function handleSectionChange(e) {
    const section = e.target.value;
    let newVarietyOptions = allVarieties;
    if (section !== '全部') {
      newVarietyOptions = initDataDict.variety_sections[section] || [];
    }
    updateState({
      selectedSection: section,
      selectedVariety: '全部',
      varietyOptions: newVarietyOptions,
      currentPage: 1
    }, () => {
      filterReportsData();
    });
  }
  function handleVarietyChange(e) {
    updateState({
      selectedVariety: e.target.value,
      currentPage: 1
    }, () => {
      filterReportsData();
    });
  }
  function handleKeywordInputChange(e) {
    updateState({
      keywordInput: e.target.value
    });
  }
  function handleKeywordInputKeyDown(e) {
    if (e.key === 'Enter') {
      updateState({
        keywordSearch: stateRef.current.keywordInput,
        currentPage: 1
      }, () => {
        filterReportsData();
      });
    }
  }
  function filterReportsData() {
    const {
      allReportsData,
      selectedType,
      selectedSection,
      selectedVariety,
      keywordSearch,
      pageSize,
      hoverCardId
    } = stateRef.current;
    if (hoverCardId) {
      closeHoverTooltip();
    }
    let filtered = allReportsData.slice();
    // 按类型筛选
    if (selectedType !== '全部') {
      filtered = filtered.filter(function (item) {
        return item.report_type === selectedType;
      });
    }
    // 按板块筛选
    if (selectedSection !== '全部') {
      filtered = filtered.filter(function (item) {
        return item.variety_section === selectedSection;
      });
    }
    // 按品种筛选
    if (selectedVariety !== '全部') {
      filtered = filtered.filter(function (item) {
        return item.variety === selectedVariety;
      });
    }
    // 按关键字筛选 report_title
    if (keywordSearch) {
      const kw = keywordSearch.toLowerCase();
      filtered = filtered.filter(function (item) {
        return item.report_title && item.report_title.toLowerCase().indexOf(kw) !== -1;
      });
    }
    const totalPages = filtered.length > 0 ? Math.ceil(filtered.length / pageSize) : 1;
    updateState({
      filteredReportsData: filtered,
      totalPages
    }, () => {
      updateCurrentPageData();
    });
  }
  function updateCurrentPageData() {
    const {
      filteredReportsData,
      currentPage,
      pageSize
    } = stateRef.current;
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const currentPageData = filteredReportsData.slice(startIndex, endIndex);
    updateState({
      currentPageData
    });
  }
  function handlePageChange(page) {
    updateState({
      currentPage: page
    }, function () {
      updateCurrentPageData();
    });
  }
  function handleCardMouseEnter(report, e) {
    // 清除待处理的关闭定时器（防止快速移动时tooltip被意外关闭）
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    const {
      hoverCardId
    } = stateRef.current;
    // 如果已经在显示同一个卡片的tooltip，不需要重新请求
    if (hoverCardId === report.id) {
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    // 生成唯一请求标识，用于处理快速切换时的竞态条件
    const requestId = report.id + '_' + Date.now();
    pendingRequestIdRef.current = requestId;

    // 保存卡片的完整边界信息
    updateState({
      hoverCardId: report.id,
      hoverPosition: {
        cardTop: rect.top,
        cardBottom: rect.bottom,
        cardLeft: rect.left,
        cardRight: rect.right,
        cardHeight: rect.height,
        cardWidth: rect.width
      },
      hoverDescription: '',
      hoverDescriptionLoading: true
    });

    // 异步请求获取 description
    const fileType = window.location.pathname.split('/').pop();
    axios.post(baseUrl + '/show/' + fileType, {
      action: 'get_description_by_id',
      id: report.id
    }).then(function (response) {
      // 只有当这是最新的请求时才更新状态
      if (pendingRequestIdRef.current === requestId && response.data) {
        updateState({
          hoverDescription: response.data.description || '',
          hoverDescriptionLoading: false
        });
      }
    }).catch(function (error) {
      console.error('获取报告描述失败:', error);
      if (pendingRequestIdRef.current === requestId) {
        updateState({
          hoverDescription: '',
          hoverDescriptionLoading: false
        });
      }
    });
  }
  function closeHoverTooltip() {
    // 清除待处理的请求标识，防止旧请求更新状态
    pendingRequestIdRef.current = null;
    updateState({
      hoverCardId: null,
      hoverDescription: '',
      hoverDescriptionLoading: false
    });
  }
  function handleCardMouseLeave() {
    // 使用短暂延迟关闭，给 mouseEnter 事件一个机会先触发（处理快速切换卡片的情况）
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
    }
    autoCloseTimerRef.current = setTimeout(() => {
      closeHoverTooltip();
    }, autoCloseTimeoutRef.current);
  }
  function handleTooltipMouseEnter() {
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
  }
  function handleTooltipMouseLeave() {
    // 清除之前的定时器
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
    }
    // autoCloseTimeout秒后自动关闭悬停层
    autoCloseTimerRef.current = setTimeout(() => {
      closeHoverTooltip();
    }, autoCloseTimeoutRef.current);
  }
  function handleDownload(reportId) {
    window.open(`${baseUrl}/show/download?report_id=${reportId}`, '_blank');
  }
  function handleRead(reportId) {
    closeHoverTooltip();
    const {
      currentPageData
    } = stateRef.current;
    const report = currentPageData.find(item => item.id === reportId);
    if (!report) return;
    updateState({
      showPDFModal: true,
      currentReport: report,
      aiDescription: '',
      loadingAI: false
    }, () => {
      fetchAIDescription(reportId);
    });
  }
  function handlePlayVideo(reportId) {
    closeHoverTooltip();
    const videoUrl = `${baseUrl}/show/content?report_id=${reportId}`;
    updateState({
      showVideoModal: true,
      currentVideoUrl: videoUrl
    });
  }
  function closeVideoModal() {
    updateState({
      showVideoModal: false,
      currentVideoUrl: ''
    });
  }
  function closePDFModal() {
    updateState({
      showPDFModal: false,
      currentReport: null,
      aiDescription: '',
      loadingAI: false
    });
  }
  function fetchAIDescription(reportId) {
    updateState({
      loadingAI: true
    });
    axios.post('/reportsdatamanage/show/pdf', {
      action: 'get_ai_description_by_id',
      id: reportId
    }).then(res => {
      const data = res.data;
      updateState({
        aiDescription: data.description_ai || '暂无AI摘要',
        loadingAI: false
      });
    }).catch(err => {
      console.error('获取AI描述失败:', err);
      updateState({
        aiDescription: 'AI摘要生成失败',
        loadingAI: false
      });
    });
  }
  function renderFilters() {
    const {
      selectedType,
      selectedSection,
      selectedVariety,
      varietyOptions,
      allReportsData,
      keywordInput
    } = stateRef.current;

    // 从 allReportsData 中提取实际存在的类型（按 reportTypes 顺序）
    const existingTypesSet = [];
    allReportsData.forEach(function (item) {
      if (item.report_type && existingTypesSet.indexOf(item.report_type) === -1) {
        existingTypesSet.push(item.report_type);
      }
    });
    const existingTypes = reportTypes.filter(function (type) {
      return existingTypesSet.indexOf(type) !== -1;
    });

    // 先根据 selectedType 过滤数据
    let typeFilteredData = allReportsData;
    if (selectedType !== '全部') {
      typeFilteredData = allReportsData.filter(function (item) {
        return item.report_type === selectedType;
      });
    }

    // 从 typeFilteredData 中提取实际存在的板块（按 varietySections 顺序）
    const existingSectionsSet = [];
    typeFilteredData.forEach(function (item) {
      if (item.variety_section && existingSectionsSet.indexOf(item.variety_section) === -1) {
        existingSectionsSet.push(item.variety_section);
      }
    });
    const existingSections = varietySections.filter(function (section) {
      return existingSectionsSet.indexOf(section) !== -1;
    });

    // 再根据 selectedSection 进一步过滤数据（用于品种选项）
    let sectionFilteredData = typeFilteredData;
    if (selectedSection !== '全部') {
      sectionFilteredData = typeFilteredData.filter(function (item) {
        return item.variety_section === selectedSection;
      });
    }

    // 从 sectionFilteredData 中提取实际存在的品种
    const existingVarieties = [];
    sectionFilteredData.forEach(function (item) {
      if (item.variety && existingVarieties.indexOf(item.variety) === -1) {
        existingVarieties.push(item.variety);
      }
    });

    // 当前显示的品种选项
    const displayVarietyOptions = varietyOptions.filter(function (variety) {
      return existingVarieties.indexOf(variety) !== -1;
    });

    // 辅助函数：计算指定类型下的所有品种
    const getTypeVarieties = type => {
      let filtered = allReportsData;
      if (type !== '全部') {
        filtered = allReportsData.filter(function (item) {
          return item.report_type === type;
        });
      }
      const varieties = [];
      filtered.forEach(function (item) {
        if (item.variety && varieties.indexOf(item.variety) === -1) {
          varieties.push(item.variety);
        }
      });
      return varieties;
    };
    return <div className="rds-filters">
        <div className="rds-filter-row">
          <label className="rds-filter-label">类型</label>
          <div className="rds-filter-options">
            <span className={selectedType === '全部' ? 'rds-filter-option rds-filter-option-active' : 'rds-filter-option'} onClick={() => {
            if (selectedType === '全部') return;
            const newVarieties = getTypeVarieties('全部');
            updateState({
              selectedType: '全部',
              selectedSection: '全部',
              selectedVariety: '全部',
              varietyOptions: newVarieties,
              currentPage: 1,
              keywordInput: '',
              keywordSearch: ''
            }, () => {
              filterReportsData();
            });
          }}>
              全部
            </span>
            {existingTypes.map(type => {
            return <span key={type} className={selectedType === type ? 'rds-filter-option rds-filter-option-active' : 'rds-filter-option'} onClick={() => {
              if (selectedType === type) return;
              const newVarieties = getTypeVarieties(type);
              updateState({
                selectedType: type,
                selectedSection: '全部',
                selectedVariety: '全部',
                varietyOptions: newVarieties,
                currentPage: 1,
                keywordInput: '',
                keywordSearch: ''
              }, () => {
                filterReportsData();
              });
            }}>
                  {type}
                </span>;
          })}
          </div>
          <input className="rds-keyword-search" type="text" placeholder="关键字搜索，回车确认" value={keywordInput} onChange={handleKeywordInputChange} onKeyDown={handleKeywordInputKeyDown} />
        </div>

        <div className="rds-filter-row">
          <label className="rds-filter-label">板块</label>
          <div className="rds-filter-options">
            <span className={selectedSection === '全部' ? 'rds-filter-option rds-filter-option-active' : 'rds-filter-option'} onClick={() => {
            if (selectedSection === '全部') return;
            // 板块重置为全部时，品种选项基于当前类型过滤
            const typeVarieties = [];
            typeFilteredData.forEach(function (item) {
              if (item.variety && typeVarieties.indexOf(item.variety) === -1) {
                typeVarieties.push(item.variety);
              }
            });
            updateState({
              selectedSection: '全部',
              selectedVariety: '全部',
              varietyOptions: typeVarieties,
              currentPage: 1,
              keywordInput: '',
              keywordSearch: ''
            }, () => {
              filterReportsData();
            });
          }}>
              全部
            </span>
            {existingSections.map(section => {
            return <span key={section} className={selectedSection === section ? 'rds-filter-option rds-filter-option-active' : 'rds-filter-option'} onClick={() => {
              if (selectedSection === section) return;
              // 获取当前类型且该板块下实际存在的品种
              const sectionVarieties = [];
              typeFilteredData.forEach(function (item) {
                if (item.variety_section === section && item.variety && sectionVarieties.indexOf(item.variety) === -1) {
                  sectionVarieties.push(item.variety);
                }
              });
              updateState({
                selectedSection: section,
                selectedVariety: '全部',
                varietyOptions: sectionVarieties,
                currentPage: 1,
                keywordInput: '',
                keywordSearch: ''
              }, () => {
                filterReportsData();
              });
            }}>
                  {section}
                </span>;
          })}
          </div>
        </div>

        <div className="rds-filter-row">
          <label className="rds-filter-label">品种</label>
          <div className="rds-filter-options">
            <span className={selectedVariety === '全部' ? 'rds-filter-option rds-filter-option-active' : 'rds-filter-option'} onClick={() => {
            if (selectedVariety === '全部') return;
            updateState({
              selectedVariety: '全部',
              currentPage: 1,
              keywordInput: '',
              keywordSearch: ''
            }, () => {
              filterReportsData();
            });
          }}>
              全部
            </span>
            {displayVarietyOptions.map(variety => {
            return <span key={variety} className={selectedVariety === variety ? 'rds-filter-option rds-filter-option-active' : 'rds-filter-option'} onClick={() => {
              if (selectedVariety === variety) return;
              updateState({
                selectedVariety: variety,
                currentPage: 1,
                keywordInput: '',
                keywordSearch: ''
              }, () => {
                filterReportsData();
              });
            }}>
                  {variety}
                </span>;
          })}
          </div>
        </div>
      </div>;
  }
  function renderReportCard(report) {
    const fileType = window.location.pathname.split('/').pop();
    const isVideo = fileType === 'video';
    // const actionButtonText = isVideo ? '播放' : '阅读';
    const formatDate = function (dateStr) {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return year + '/' + month + '/' + day;
    };
    return <div key={report.id} className="rds-card" data-report-id={report.id} onClick={() => isVideo ? handlePlayVideo(report.id) : handleRead(report.id)}
    // 如果 report report_file_suffix属性是mp4，则不显示悬停弹层
    onMouseEnter={e => report.report_file_suffix !== 'mp4' ? handleCardMouseEnter(report, e) : null} onMouseLeave={e => report.report_file_suffix !== 'mp4' ? handleCardMouseLeave(report, e) : null}>
        <figure className="rds-card-figure">
          <img src={report.cover_img_url} alt={report.report_title} />
          <figcaption className="rds-card-caption">
            <span className="rds-card-title" title={report.report_title}>{report.report_title}</span>
            <span className="rds-card-date">{formatDate(report.report_public_date)}</span>
          </figcaption>
        </figure>
      </div>;
  }
  function renderHoverTooltip() {
    const {
      hoverCardId,
      hoverPosition,
      currentPageData,
      hoverDescription,
      hoverDescriptionLoading
    } = stateRef.current;
    if (!hoverCardId || !hoverPosition) return null;
    const report = currentPageData.find(function (item) {
      return item.id === hoverCardId;
    });
    if (!report) return null;

    // 弹出层固定宽度和最大高度
    const tooltipWidth = 500;
    const tooltipMaxHeight = 600;
    const gap = 10; // 与卡片的间距

    // 计算弹出层位置
    const {
      cardTop,
      cardBottom,
      cardLeft,
      cardRight,
      cardHeight
    } = hoverPosition;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // 计算右侧和左侧可用空间
    const spaceRight = viewportWidth - cardRight;
    const spaceLeft = cardLeft;

    // 默认显示在右侧，如果右侧空间不够则显示在左侧
    let leftPos;
    if (spaceRight >= tooltipWidth + gap) {
      // 显示在右侧
      leftPos = cardRight + gap;
    } else {
      // 显示在左侧
      leftPos = cardLeft - gap - tooltipWidth;
    }

    // 计算垂直位置：相对于卡片居中，同时确保不超出视窗
    const cardCenterY = cardTop + cardHeight / 2;

    // 计算卡片中心到视窗上下边缘的可用空间
    const spaceAbove = cardCenterY - gap;
    const spaceBelow = viewportHeight - gap - cardCenterY;
    const halfMaxHeight = tooltipMaxHeight / 2;

    // 计算视窗可用的最大高度
    const availableHeight = viewportHeight - 2 * gap;
    const dynamicMaxHeight = Math.min(tooltipMaxHeight, availableHeight);
    let topPos;
    let transformValue;
    if (spaceAbove >= halfMaxHeight && spaceBelow >= halfMaxHeight) {
      // 上下都有足够空间，使用 transform 居中
      topPos = cardCenterY;
      transformValue = 'translateY(-50%)';
    } else if (spaceAbove < halfMaxHeight) {
      // 卡片靠近顶部，弹出层从顶部向下展开
      topPos = gap;
      transformValue = undefined;
    } else {
      // 卡片靠近底部，弹出层从底部向上展开
      topPos = viewportHeight - gap;
      transformValue = 'translateY(-100%)';
    }
    const tooltipStyle = {
      left: leftPos + 'px',
      top: topPos + 'px',
      transform: transformValue,
      maxHeight: dynamicMaxHeight + 'px'
    };

    // 渲染 description 内容（支持 HTML）
    const renderDescription = function () {
      if (hoverDescriptionLoading) {
        return <p className="rds-card-tooltip-description">加载中...</p>;
      }
      if (!hoverDescription) {
        return <p className="rds-card-tooltip-description">暂无描述</p>;
      }
      // 判断是否包含 HTML 标签
      const isHtml = /<[^>]+>/.test(hoverDescription);
      if (isHtml) {
        return <div className="rds-card-tooltip-description" dangerouslySetInnerHTML={{
          __html: hoverDescription
        }} />;
      }
      return <p className="rds-card-tooltip-description">{hoverDescription}</p>;
    };
    return <div className="rds-card-tooltip" style={tooltipStyle}
    // onMouseEnter={this.handleTooltipMouseEnter}
    // onMouseLeave={this.handleTooltipMouseLeave}
    >
        <button className="rds-card-tooltip-close" onClick={closeHoverTooltip}>×</button>
        <div className="rds-card-tooltip-header">
          <h4 className="rds-card-tooltip-title">{report.report_title}</h4>
          <p className="rds-card-tooltip-subtitle">{report.report_subtitle}</p>
        </div>
        <div className="rds-card-tooltip-divider" />
        <div className="rds-card-tooltip-body">
          {renderDescription()}
        </div>
      </div>;
  }
  function renderVideoModal() {
    const {
      showVideoModal,
      currentVideoUrl
    } = stateRef.current;
    if (!showVideoModal) return null;
    return <div className="rds-video-modal-overlay">
        <div className="rds-video-modal-content">
          <button className="rds-video-modal-close" onClick={closeVideoModal}>
            ×
          </button>
          <video className="rds-video-player" src={currentVideoUrl} controls preload="metadata" autoPlay>
            您的浏览器不支持视频播放
          </video>
        </div>
      </div>;
  }
  function renderPagination() {
    const {
      currentPage,
      totalPages
    } = stateRef.current;
    if (totalPages <= 1) return null;
    const maxButtons = 7;
    const startPage = Math.max(1, Math.min(currentPage - Math.floor(maxButtons / 2), totalPages - maxButtons + 1));
    const endPage = Math.min(totalPages, startPage + maxButtons - 1);
    const pages = [];
    for (let page = startPage; page <= endPage; page += 1) {
      pages.push(page);
    }
    return <div className="rds-pagination-wrapper">
        <Pagination>
          <Pagination.First disabled={currentPage === 1} onClick={() => handlePageChange(1)} />
          <Pagination.Prev disabled={currentPage === 1} onClick={() => handlePageChange(currentPage - 1)} />
          {startPage > 1 && <Pagination.Ellipsis disabled />}
          {pages.map(page => <Pagination.Item key={page} active={page === currentPage} onClick={() => handlePageChange(page)}>{page}</Pagination.Item>)}
          {endPage < totalPages && <Pagination.Ellipsis disabled />}
          <Pagination.Next disabled={currentPage === totalPages} onClick={() => handlePageChange(currentPage + 1)} />
          <Pagination.Last disabled={currentPage === totalPages} onClick={() => handlePageChange(totalPages)} />
        </Pagination>
      </div>;
  }
  propsRef.current = props;
  useLayoutEffect(() => {
    fetchReportsData();
    return () => {
      mountedRef.current = false;
      pendingRequestIdRef.current = null;
      if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    };
    // Preserve the legacy mount-only initial request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const {
    currentPageData,
    showPDFModal,
    currentReport,
    aiDescription,
    loadingAI
  } = stateRef.current;
  return <div className="rds-container">
        <AlertsWrapper />
        {renderFilters()}
        <div className="rds-cards-grid">
          {currentPageData.length > 0 ? currentPageData.map(report => renderReportCard(report)) : <div className="rds-empty-message">暂无报告数据</div>}
        </div>
        {renderPagination()}
        {renderHoverTooltip()}
        {renderVideoModal()}
        
        {/* PDF弹出层 */}
        {showPDFModal && <ReportsDataShowPDFModal report={currentReport} loadingAI={loadingAI} aiDescription={aiDescription} onClose={closePDFModal} />}
      </div>;
}



export default ReportsDataShow;
