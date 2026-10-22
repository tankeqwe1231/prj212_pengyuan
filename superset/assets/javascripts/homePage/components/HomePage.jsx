/* eslint no-unused-vars: 0 */
import React, { useLayoutEffect, useRef, useState } from 'react';
import axios from 'axios';
// import echarts from 'echarts';
import AlertsWrapper from '../../components/AlertsWrapper';
import SimpleChart from './SimpleChart';
import TreeMapChart from './TreeMapChart';
// import PDFModal from './PDFModal';
import ReportsDataShowPDFModal from '../../reportsData/components/ReportsDataShowPDFModal';
import VideoModal from './VideoModal';
import './HomePage.css';
import '../../reportsData/components/reports_data_show_pdf.css';
import './HomePageVideo.css';
import { ensureArray } from '../utils';


function HomePage(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(HomePage.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = HomePage.defaultProps[key];
  });
  const propsRef = useRef(props);
  const mountedRef = useRef(true);
  const [state, setState] = useState(() => ({
    riseFallData: [],
    snapshotData: [],
    currentTime: new Date().toLocaleString('zh-CN'),
    selectedTreemapType: '热力图(结算价)',
    riseChartData: [],
    fallChartData: [],
    diffChartData: [],
    warnData: [],
    reportsData: {
      pdf: [],
      mp4: []
    },
    moodIndexData: 0,
    showPDFModal: false,
    showVideoModal: false,
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
  const timerRef = useRef(null);
  const timeTimerRef = useRef(null);
  function fetchData() {
    axios.post('/superset/home_page/', {
      action: 'get_risefallcount_treemap_data'
    }).then(res => {
      // axios 会自动解析 JSON，res.data 已经是对象
      const data = res.data;
      const riseFallData = ensureArray(data.riseFallData);
      const snapshotData = ensureArray(data.snapshotData);

      // 处理涨跌数据
      processRiseFallData(riseFallData);

      // 更新状态（不再更新currentTime，由单独的定时器处理）
      updateState({
        riseFallData: riseFallData,
        snapshotData: snapshotData
      });
    }).catch(err => {
      console.error('获取数据失败:', err);
    });
  }
  function fetchExtraData() {
    axios.post('/superset/home_page/', {
      action: 'get_home_extradata'
    }).then(res => {
      const data = res.data;
      updateState({
        warnData: data.warnData || [],
        reportsData: data.reportsData || {
          pdf: [],
          mp4: []
        },
        moodIndexData: data.moodIndexData || 0
      });
    }).catch(err => {
      console.error('获取额外数据失败:', err);
    });
  }
  function sampleData(dataArray) {
    if (dataArray.length <= 2) return dataArray;
    const result = [dataArray[0]]; // 第1条

    // 间隔4条取值（即取第5、10、15...）
    for (let i = 5; i < dataArray.length - 1; i += 5) {
      result.push(dataArray[i]);
    }
    result.push(dataArray[dataArray.length - 1]); // 最后1条

    return result;
  }
  function processRiseFallData(data) {
    if (!data || data.length === 0) {
      return;
    }

    // 采样数据
    const sampledData = sampleData(data);

    // 处理上涨品种数据
    const riseChartData = sampledData.map(item => ({
      x: formatTime(item.trade_time),
      y: item.rise_count_presettle || 0
    }));

    // 处理下跌品种数据
    const fallChartData = sampledData.map(item => ({
      x: formatTime(item.trade_time),
      y: item.fall_count_presettle || 0
    }));

    // 处理涨跌差数据
    const diffChartData = sampledData.map(item => ({
      x: formatTime(item.trade_time),
      y: (item.rise_count_presettle || 0) - (item.fall_count_presettle || 0)
    }));
    updateState({
      riseChartData: riseChartData,
      fallChartData: fallChartData,
      diffChartData: diffChartData
    });
  }
  function formatTime(timeStr) {
    if (!timeStr) return '';
    // 格式化时间为 HH:mm
    const date = new Date(timeStr);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  function handleTreemapTypeChange(e) {
    updateState({
      selectedTreemapType: e.target.value
    });
  }
  function handleAlertClick(warn) {
    const {
      dashboard_id,
      slice_id
    } = warn;
    window.open(`/superset/dashboard/${dashboard_id}/?slice_id=${slice_id}`, '_blank');
  }
  function getLatestRiseCount() {
    const {
      riseFallData
    } = stateRef.current;
    if (riseFallData.length === 0) return 0;
    const latest = riseFallData[riseFallData.length - 1];
    return latest.rise_count_presettle || 0;
  }
  function getLatestFallCount() {
    const {
      riseFallData
    } = stateRef.current;
    if (riseFallData.length === 0) return 0;
    const latest = riseFallData[riseFallData.length - 1];
    return latest.fall_count_presettle || 0;
  }
  function getLatestDiff() {
    const {
      riseFallData
    } = stateRef.current;
    if (riseFallData.length === 0) return 0;
    const latest = riseFallData[riseFallData.length - 1];
    return (latest.rise_count_presettle || 0) - (latest.fall_count_presettle || 0);
  }
  function getTimeAgo(sendTime) {
    if (!sendTime) return '';
    const now = new Date();
    const send = new Date(sendTime);
    const diff = Math.floor((now - send) / 60000);
    if (diff < 1) return '刚刚';
    if (diff < 60) return `${diff}分钟前`;
    const hours = Math.floor(diff / 60);
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    return `${days}天前`;
  }
  function getWarnDescription(condition, value, maxDate) {
    if (!condition || value === undefined || value === null) return '';
    switch (condition) {
      case '>':
        return `突破 ${value}`;
      case '<':
        return `跌破 ${value}`;
      case 'update':
        return `已更新：${maxDate || ''}：${value}`;
      default:
        return '';
    }
  }
  function handleReportClick(report) {
    updateState({
      showPDFModal: true,
      currentReport: report,
      aiDescription: '',
      loadingAI: false
    }, () => {
      fetchAIDescription(report.id);
    });
  }
  function handleVideoClick(video) {
    updateState({
      showVideoModal: true,
      currentReport: video
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
  function closeVideoModal() {
    updateState({
      showVideoModal: false,
      currentReport: null
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
  function getSentimentScore() {
    const {
      moodIndexData
    } = stateRef.current;
    const latestDiff = getLatestDiff();
    const score = (moodIndexData * 30 + latestDiff) / 2.52;
    return Math.round(score); // 四舍五入取整
  }
  function getSentimentLabel(score) {
    if (score < -70) {
      return '市场温度寒冷';
    } else if (score >= -70 && score < -30) {
      return '市场温度略微冷';
    } else if (score >= -30 && score < 0) {
      return '市场有点凉意';
    } else if (score >= 0 && score < 30) {
      return '市场温和回暖';
    } else if (score >= 30 && score < 70) {
      return '市场温度略偏热';
    } else {
      return '市场热度较高';
    }
  }
  propsRef.current = props;
  useLayoutEffect(() => {
    // 初始加载数据
    fetchData();
    fetchExtraData();

    // 设置定时器，每30秒刷新一次数据
    timerRef.current = setInterval(() => {
      fetchData();
    }, 30000);

    // 设置定时器，每1秒更新一次时间显示
    timeTimerRef.current = setInterval(() => {
      updateState({
        currentTime: new Date().toLocaleString('zh-CN')
      });
    }, 1000);
    return () => {
      mountedRef.current = false;
      // 清理数据刷新定时器
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // 清理时间更新定时器
      if (timeTimerRef.current) {
        clearInterval(timeTimerRef.current);
        timeTimerRef.current = null;
      }
    };
    // Preserve the legacy mount-only fetches and timers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const {
    riseChartData,
    fallChartData,
    diffChartData,
    currentTime,
    snapshotData,
    selectedTreemapType,
    warnData,
    reportsData,
    showPDFModal,
    showVideoModal,
    currentReport,
    aiDescription,
    loadingAI
  } = stateRef.current;
  return <div className="home-page-container">
        <AlertsWrapper initMessages={propsRef.current.initMessages} />
        
        {/* 第一行：上涨品种、下跌品种、涨跌差、当前时间 */}
        <div className="top-row">
          <div className="chart-card rise-card">
            <div className="card-header">
              <span className="card-title">上涨品种</span>
              <span className="card-value">{getLatestRiseCount()}</span>
            </div>
            <div className="card-chart">
              <SimpleChart data={riseChartData} type="line" color="#ef5350" />
            </div>
          </div>
          
          <div className="chart-card fall-card">
            <div className="card-header">
              <span className="card-title">下跌品种</span>
              <span className="card-value">{getLatestFallCount()}</span>
            </div>
            <div className="card-chart">
              <SimpleChart data={fallChartData} type="line" color="#66bb6a" />
            </div>
          </div>
          
          <div className="chart-card diff-card">
            <div className="card-header">
              <span className="card-title">涨跌差</span>
              <span className="card-value">{getLatestDiff()}</span>
            </div>
            <div className="card-chart">
              <SimpleChart data={diffChartData} type="bar" color="#42a5f5" />
            </div>
          </div>
          
          <div className="time-card">
            <div className="time-label">当前时间</div>
            <div className="time-value">{currentTime}</div>
          </div>
        </div>
        
        {/* 第二行：左右布局 */}
        <div className="main-content">
          {/* 左侧 65% */}
          <div className="left-section">
            {/* 核心品种观点 */}
            <div className="section-card core-views-card">
              <div className="section-header">
                <i className="fa-solid fa-lightbulb section-icon" style={{
              color: '#eab308'
            }}></i>
                {/* <span className="">💡</span> */}
                <span className="section-title">核心品种观点</span>
                <a href="/reportsdatamanage/show/pdf" className="view-more" target="_blank">查看更多 →</a>
              </div>
              <div className="section-content">
                {reportsData.pdf && reportsData.pdf.length > 0 ? reportsData.pdf.slice(0, 6).map((report, index) => <div key={index} className="view-item" onClick={() => handleReportClick(report)}>
                      <div className="view-header">
                        <span className="view-tag">{report.report_title}</span>
                      </div>
                      <div className="view-date">
                        <span className="view-variety">{report.variety}</span>
                        <span className="view-public-date">{report.report_public_date}</span>
                      </div>
                    </div>) : <div className="view-item-empty">暂无数据</div>}
              </div>
            </div>
            
            {/* 品种涨跌热力图 */}
            <div className="section-card treemap-card">
              <div className="section-header">
                <span className="section-icon">📊</span>
                <span className="section-title">品种涨跌热力图</span>
                <select className="treemap-select" value={selectedTreemapType} onChange={handleTreemapTypeChange}>
                  <option value="热力图(结算价)">热力图(结算价)</option>
                  <option value="热力图(收盘价)">热力图(收盘价)</option>
                  <option value="交易所热力图(结算价)">交易所热力图(结算价)</option>
                  <option value="交易所热力图(收盘价)">交易所热力图(收盘价)</option>
                  <option value="热力图(板块)">热力图(板块)</option>
                </select>
              </div>
              <div className="section-content treemap-content">
                <TreeMapChart snapshotData={snapshotData} mode={selectedTreemapType} />
              </div>
            </div>
          </div>
          
          {/* 右侧 35% */}
          <div className="right-section">
            {/* 预警指标 */}
            <div className="section-card alert-card">
              <div className="section-header">
                <i className="fa-solid fa-bell section-icon" style={{
              color: '#ef4444'
            }}></i>
                {/* <span className="section-icon">🔔</span> */}
                <span className="section-title">预警指标</span>
                <span className="warn-count">{warnData.length}个活跃</span>
              </div>
              <div className="section-content">
                {warnData && warnData.length > 0 ? warnData.map((warn, index) => <div key={index} className="alert-item" onClick={() => handleAlertClick(warn)}>
                      <div className="alert-label">
                        <span className="alert-index">{warn.warn_index}</span>
                        <span className="alert-time">{getTimeAgo(warn.send_time)}</span>
                      </div>
                      <div className="alert-desc">
                        {getWarnDescription(warn.warn_condition, warn.warn_value, warn.index_max_date)}
                      </div>
                    </div>) : <div className="alert-item-empty">暂无预警</div>}
              </div>
            </div>
            
            {/* 新发布路演 */}
            {/* <div className="section-card roadshow-card">
              <div className="section-header">
                <span className="section-icon">📺</span>
                <span className="section-title">新发布路演</span>
                <a href="/reportsdatamanage/show/video" className="view-more" target="_blank">查看更多 →</a>
              </div>
              <div className="section-content">
                {reportsData.mp4 && reportsData.mp4.length > 0 ? reportsData.mp4.slice(0, 8).map((video, index) => <div key={index} className="roadshow-item" onClick={() => handleVideoClick(video)}>
                      <div className="roadshow-tag">{video.report_title}</div>
                      <div className="roadshow-date">
                        <span className="view-variety">{video.variety}</span>
                        <span className="view-public-date">{video.report_public_date}</span>
                      </div>
                    </div>) : <div className="roadshow-item-empty">暂无视频</div>}
              </div>
            </div> */}
            
            {/* 市场情绪 */}
            <div className="section-card sentiment-card">
              <div className="section-header">
                <i className="fa-solid fa-smile section-icon" style={{
              color: '#22c55e'
            }}></i>
                <span className="section-title">市场情绪</span>
              </div>
              <div className="section-content sentiment-content">
                <div className="sentiment-score" style={{
              color: getSentimentScore() > 0 ? '#f44336' : '#4caf50'
            }}>
                  {getSentimentScore()}
                </div>
                <div className="sentiment-bar">
                  <div className="sentiment-progress" style={{
                width: '72%'
              }} />
                </div>
                <div className="sentiment-label">{getSentimentLabel(getSentimentScore())}</div>
              </div>
            </div>
          </div>
        </div>

        {/* PDF弹出层 */}
        {showPDFModal && <ReportsDataShowPDFModal report={currentReport} loadingAI={loadingAI} aiDescription={aiDescription} onClose={closePDFModal} />}

        {/* 视频弹出层 */}
        {showVideoModal && <VideoModal video={currentReport} onClose={closeVideoModal} />}
      </div>;
}



export default HomePage;
