/* eslint no-unused-vars: 0 */
import React, { useLayoutEffect, useRef } from 'react';
import echarts from 'echarts';
import PropTypes from 'prop-types';
import { ensureArray } from '../utils';

function TreeMapChart(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(TreeMapChart.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = TreeMapChart.defaultProps[key];
  });
  const propsRef = useRef(props);
  const chartInstancesRef = useRef({});
  const resizeHandlersRef = useRef({});
  const renderTimersRef = useRef(new Set());
  function getColorByPercent(percent) {
    if (percent === 0) {
      return '#999999';
    }
    const threshold = 4;

    // 边界控制在 -4% ~ 4%
    const boundedPercent = Math.max(-threshold, Math.min(threshold, percent));
    const absPercent = Math.abs(boundedPercent);
    if (percent > 0) {
      // 红色系：从浅红到深红
      // 0% -> #ffcccc (浅红)
      // 6% -> #cc0000 (深红)
      const intensity = Math.floor(absPercent / threshold * 255);
      const red = 255;
      const green = 255 - intensity;
      const blue = 255 - intensity;
      return `rgb(${red}, ${green}, ${blue})`;
    } else {
      // 绿色系：从浅绿到深绿
      // 0% -> #ccffcc (浅绿)
      // -6% -> #00aa00 (深绿)
      const intensity = Math.floor(absPercent / threshold * 170);
      const red = 204 - intensity;
      const green = 255 - Math.floor(absPercent / threshold * 85);
      const blue = 204 - intensity;
      return `rgb(${red}, ${green}, ${blue})`;
    }
  }
  function getLabelColorByPercent(percent) {
    return '#000000';
  }
  function calculateChange(last, prev, formula) {
    if (!prev || prev === 0) return 0;
    return last / prev * 100 - 100;
  }
  function generateTreeMapData(snapshotData, mode) {
    const rows = ensureArray(snapshotData);
    if (rows.length === 0) {
      return [];
    }
    const formula = mode.includes('结算价') ? 'settlement' : 'close';
    return rows.map(item => {
      const last = item.last || 0;
      const prev = formula === 'settlement' ? item.prev_settlement || 0 : item.prev_close || 0;
      const changePercent = calculateChange(last, prev, formula);
      const color = getColorByPercent(changePercent);
      const labelColor = getLabelColorByPercent(changePercent);
      const name = `${item.underlying_name || ''}\n${item.order_book_id || ''}\n${last}\n${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
      return {
        name: name,
        value: item.volume || 0,
        itemStyle: {
          color: color
        },
        label: {
          color: labelColor,
          fontWeight: 'bold'
        }
      };
    });
  }
  function generateTreeMapByExchange(snapshotData, mode) {
    const rows = ensureArray(snapshotData);
    if (rows.length === 0) {
      return [];
    }
    const formula = mode.includes('结算价') ? 'settlement' : 'close';
    const groupedData = {};
    rows.forEach(item => {
      const exchange = item.exchange || '未知交易所';
      if (!groupedData[exchange]) {
        groupedData[exchange] = [];
      }
      const last = item.last || 0;
      const prev = formula === 'settlement' ? item.prev_settlement || 0 : item.prev_close || 0;
      const changePercent = calculateChange(last, prev, formula);
      const color = getColorByPercent(changePercent);
      const labelColor = getLabelColorByPercent(changePercent);
      const name = `${item.underlying_name || ''}\n${item.order_book_id || ''}\n${last}\n${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
      groupedData[exchange].push({
        name: name,
        value: item.volume || 0,
        itemStyle: {
          color: color
        },
        label: {
          color: labelColor,
          fontWeight: 'bold'
        }
      });
    });
    return Object.keys(groupedData).map(exchange => ({
      exchange: exchange,
      data: groupedData[exchange]
    }));
  }
  function generateTreeMapByArea(snapshotData) {
    const rows = ensureArray(snapshotData);
    if (rows.length === 0) {
      return {
        settlement: [],
        close: []
      };
    }
    const areaDataSettlement = {};
    const areaDataClose = {};
    rows.forEach(item => {
      const area = item.underlying_area || '未分类';
      const last = item.last || 0;
      const prevSettlement = item.prev_settlement || 0;
      const prevClose = item.prev_close || 0;
      const volume = item.volume || 0;
      if (!areaDataSettlement[area]) {
        areaDataSettlement[area] = {
          totalChange: 0,
          count: 0,
          totalVolume: 0
        };
      }
      if (!areaDataClose[area]) {
        areaDataClose[area] = {
          totalChange: 0,
          count: 0,
          totalVolume: 0
        };
      }
      if (prevSettlement !== 0) {
        const changePercent = calculateChange(last, prevSettlement);
        areaDataSettlement[area].totalChange += changePercent;
        areaDataSettlement[area].count += 1;
      }
      areaDataSettlement[area].totalVolume += volume;
      if (prevClose !== 0) {
        const changePercent = calculateChange(last, prevClose);
        areaDataClose[area].totalChange += changePercent;
        areaDataClose[area].count += 1;
      }
      areaDataClose[area].totalVolume += volume;
    });
    const settlementData = Object.keys(areaDataSettlement).map(area => {
      const avgChange = areaDataSettlement[area].count > 0 ? areaDataSettlement[area].totalChange / areaDataSettlement[area].count : 0;
      const color = getColorByPercent(avgChange);
      const labelColor = getLabelColorByPercent(avgChange);
      return {
        name: `${area}\n${avgChange >= 0 ? '+' : ''}${avgChange.toFixed(2)}%`,
        value: areaDataSettlement[area].totalVolume,
        itemStyle: {
          color: color
        },
        label: {
          color: labelColor,
          fontWeight: 'bold'
        }
      };
    });
    const closeData = Object.keys(areaDataClose).map(area => {
      const avgChange = areaDataClose[area].count > 0 ? areaDataClose[area].totalChange / areaDataClose[area].count : 0;
      const color = getColorByPercent(avgChange);
      const labelColor = getLabelColorByPercent(avgChange);
      return {
        name: `${area}\n${avgChange >= 0 ? '+' : ''}${avgChange.toFixed(2)}%`,
        value: areaDataClose[area].totalVolume,
        itemStyle: {
          color: color
        },
        label: {
          color: labelColor,
          fontWeight: 'bold'
        }
      };
    });
    return {
      settlement: settlementData,
      close: closeData
    };
  }
  function renderTreeMap(data, title, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.warn(`容器 ${containerId} 未找到`);
      return;
    }

    // 复用已有图表实例，避免闪烁
    let chart = chartInstancesRef.current[containerId];
    if (!chart) {
      chart = echarts.init(container);
      chartInstancesRef.current[containerId] = chart;

      // 响应式调整
      const resizeHandler = () => {
        if (chart && !chart.isDisposed()) {
          chart.resize();
        }
      };
      window.addEventListener('resize', resizeHandler);

      // 保存清理函数
      resizeHandlersRef.current[containerId] = resizeHandler;
    } else {
      // 如果图表已存在但容器可能被重新创建，需要检查
      if (chart.isDisposed()) {
        chart = echarts.init(container);
        chartInstancesRef.current[containerId] = chart;
      }
    }
    const option = {
      title: {
        text: title,
        left: 'center',
        top: 10,
        textStyle: {
          fontSize: 14
        }
      },
      tooltip: {
        formatter: info => {
          const value = info.value;
          const name = info.name.replace(/\n/g, '<br/>');
          return `${name}`;
        }
      },
      series: [{
        type: 'treemap',
        width: '100%',
        height: '100%',
        top: 40,
        roam: false,
        nodeClick: false,
        breadcrumb: {
          show: false
        },
        squareRatio: 0.8,
        label: {
          show: true,
          formatter: '{b}',
          fontSize: 12
        },
        data: data
      }]
    };

    // 使用notMerge: false 来平滑更新
    chart.setOption(option, false);
    return containerId;
  }
  function clearAllCharts() {
    renderTimersRef.current.forEach(timer => clearTimeout(timer));
    renderTimersRef.current.clear();
    // 清理所有图表实例
    Object.keys(chartInstancesRef.current).forEach(key => {
      const chart = chartInstancesRef.current[key];
      if (chart && !chart.isDisposed()) {
        chart.dispose();
      }
    });

    // 清理resize事件监听器
    Object.keys(resizeHandlersRef.current).forEach(key => {
      window.removeEventListener('resize', resizeHandlersRef.current[key]);
    });
    chartInstancesRef.current = {};
    resizeHandlersRef.current = {};
  }
  function renderCharts() {
    const {
      snapshotData,
      mode
    } = propsRef.current;

    // 等待DOM渲染
    const timer = setTimeout(() => {
      renderTimersRef.current.delete(timer);
      if (mode === '热力图(结算价)' || mode === '热力图(收盘价)') {
        const data = generateTreeMapData(snapshotData, mode);
        renderTreeMap(data, mode, 'treemap-single');
      } else if (mode === '交易所热力图(结算价)' || mode === '交易所热力图(收盘价)') {
        const groupedData = generateTreeMapByExchange(snapshotData, mode);
        groupedData.forEach((group, index) => {
          renderTreeMap(group.data, `${group.exchange}`, `treemap-exchange-${index}`);
        });
      } else if (mode === '热力图(板块)') {
        const areaData = generateTreeMapByArea(snapshotData);
        renderTreeMap(areaData.settlement, '板块热力图-结算价', 'treemap-area-settlement');
        renderTreeMap(areaData.close, '板块热力图-收盘价', 'treemap-area-close');
      }
    }, 100);
    renderTimersRef.current.add(timer);
  }
  propsRef.current = props;
  useLayoutEffect(() => {
    renderCharts();
    return () => {
      clearAllCharts();
    };
    // Initialize the chart collection once; updates are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const previousCommitRef = useRef();
  useLayoutEffect(() => {
    if (previousCommitRef.current) {
      const {
        props: prevProps
      } = previousCommitRef.current;
      // 如果模式改变，需要清理所有旧的图表实例
      if (prevProps.mode !== propsRef.current.mode) {
        clearAllCharts();
      }
      if (prevProps.snapshotData !== propsRef.current.snapshotData || prevProps.mode !== propsRef.current.mode) {
        renderCharts();
      }
    }
    previousCommitRef.current = {
      props: props,
      state: null
    };
  });
  const {
    mode,
    snapshotData
  } = propsRef.current;
  if (mode === '热力图(结算价)' || mode === '热力图(收盘价)') {
    return <div className="treemap-container" key="single">
          <div id="treemap-single" style={{
        width: '100%',
        height: '720px'
      }} />
        </div>;
  } else if (mode === '交易所热力图(结算价)' || mode === '交易所热力图(收盘价)') {
    const groupedData = generateTreeMapByExchange(snapshotData, mode);
    return <div className="treemap-container" key="exchange">
          {groupedData.map((group, index) => <div key={`${group.exchange}-${index}`} style={{
        marginBottom: '0px'
      }}>
              <div id={`treemap-exchange-${index}`} style={{
          width: '100%',
          height: '360px'
        }} />
            </div>)}
        </div>;
  } else if (mode === '热力图(板块)') {
    return <div className="treemap-container" key="area">
          <div style={{
        marginBottom: '0px'
      }}>
            <div id="treemap-area-settlement" style={{
          width: '100%',
          height: '360px'
        }} />
          </div>
          <div style={{
        marginBottom: '0px'
      }}>
            <div id="treemap-area-close" style={{
          width: '100%',
          height: '360px'
        }} />
          </div>
        </div>;
  }
  return <div key="empty">请选择热力图类型</div>;
}



TreeMapChart.propTypes = {
  snapshotData: PropTypes.array.isRequired,
  mode: PropTypes.oneOf([
    '热力图(结算价)',
    '热力图(收盘价)',
    '交易所热力图(结算价)',
    '交易所热力图(收盘价)',
    '热力图(板块)',
  ]).isRequired,
};

export default TreeMapChart;
