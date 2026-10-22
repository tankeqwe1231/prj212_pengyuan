/* eslint no-unused-vars: 0 */
import React, { useLayoutEffect, useRef } from 'react';
import echarts from 'echarts';
import PropTypes from 'prop-types';

function SimpleChart(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(SimpleChart.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = SimpleChart.defaultProps[key];
  });
  const propsRef = useRef(props);
  const chartRefRef = useRef(null);
  const chartRef = useRef(null);
  function setChartRef(element) {
    chartRefRef.current = element;
  }
  function initChart() {
    if (chartRefRef.current && !chartRef.current) {
      chartRef.current = echarts.init(chartRefRef.current);
      updateChart();

      // 响应式尺寸调整
      window.addEventListener('resize', handleResize);
    }
  }
  function handleResize() {
    if (chartRef.current) {
      chartRef.current.resize();
    }
  }
  function updateChart() {
    if (!chartRef.current || !propsRef.current.data || propsRef.current.data.length === 0) {
      return;
    }
    const {
      data,
      type,
      color,
      title
    } = propsRef.current;
    const xData = data.map(item => item.x);
    const yData = data.map(item => item.y);
    const option = {
      tooltip: {
        trigger: 'axis',
        formatter: params => {
          if (params && params.length > 0) {
            const param = params[0];
            const time = param.name; // x轴时间 (HH:mm格式)
            const value = param.value; // 对应的值
            return `${time}<br/>${value}`;
          }
          return '';
        },
        backgroundColor: 'rgba(50, 50, 50, 0.9)',
        borderColor: '#333',
        borderWidth: 1,
        textStyle: {
          color: '#fff',
          fontSize: 12
        },
        padding: 8
      },
      grid: {
        left: 5,
        right: 5,
        top: 5,
        bottom: 5,
        containLabel: false
      },
      xAxis: {
        type: 'category',
        data: xData,
        show: false,
        boundaryGap: type === 'bar'
      },
      yAxis: {
        type: 'value',
        show: false
      },
      series: [{
        data: yData,
        type: type || 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: {
          color: color || '#5470c6',
          width: 2
        },
        itemStyle: {
          color: color || '#5470c6'
        },
        areaStyle: type === 'line' ? {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [{
              offset: 0,
              color: color ? `${color}80` : 'rgba(84, 112, 198, 0.5)'
            }, {
              offset: 1,
              color: color ? `${color}20` : 'rgba(84, 112, 198, 0.1)'
            }]
          }
        } : null
      }]
    };

    // 如果有标题，显示标题
    if (title) {
      option.title = {
        text: title,
        left: 10,
        top: 5,
        textStyle: {
          fontSize: 14,
          fontWeight: 'normal'
        }
      };
    }
    chartRef.current.setOption(option);
  }
  propsRef.current = props;
  useLayoutEffect(() => {
    initChart();
    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.dispose();
        chartRef.current = null;
      }
    };
    // Initialize the chart once; callbacks read current props through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const previousCommitRef = useRef();
  useLayoutEffect(() => {
    if (previousCommitRef.current) {
      const {
        props: prevProps
      } = previousCommitRef.current;
      if (prevProps.data !== propsRef.current.data || prevProps.type !== propsRef.current.type || prevProps.color !== propsRef.current.color) {
        updateChart();
      }
    }
    previousCommitRef.current = {
      props: props,
      state: null
    };
  });
  return <div ref={setChartRef} style={{
    width: '100%',
    height: '100%'
  }} />;
}



SimpleChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.shape({
    x: PropTypes.string.isRequired,
    y: PropTypes.number.isRequired,
  })).isRequired,
  type: PropTypes.oneOf(['line', 'bar']),
  color: PropTypes.string,
  title: PropTypes.string,
};

SimpleChart.defaultProps = {
  type: 'line',
  color: '#5470c6',
  title: '',
};

export default SimpleChart;
