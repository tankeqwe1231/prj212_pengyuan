import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import echarts from 'echarts';
import { buildSeasonOption, buildSeriesOption } from '../utils/chartUtils';

export default function IndexDataChart({
  timeSeriesData,
  chartType,
  isStacked,
  chartIndexConfigs,
  chartRows,
  resizeToken,
}) {
  const domRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    chartRef.current = echarts.init(domRef.current);
    const handleResize = () => chartRef.current && chartRef.current.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chartRef.current.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !timeSeriesData) return;
    const option = chartType === 'season'
      ? buildSeasonOption(timeSeriesData, chartRows, chartIndexConfigs)
      : buildSeriesOption(timeSeriesData, chartRows, chartIndexConfigs, chartType, isStacked);
    chart.clear();
    if (option) {
      chart.setOption(option);
    }
  }, [timeSeriesData, chartType, isStacked, chartIndexConfigs, chartRows]);

  useEffect(() => {
    if (chartRef.current) chartRef.current.resize();
  }, [resizeToken]);

  return <div ref={domRef} className="index-data-chart" />;
}

IndexDataChart.propTypes = {
  timeSeriesData: PropTypes.object,
  chartType: PropTypes.string,
  isStacked: PropTypes.bool,
  chartIndexConfigs: PropTypes.object,
  chartRows: PropTypes.array,
  resizeToken: PropTypes.any,
};

IndexDataChart.defaultProps = {
  timeSeriesData: null,
  chartType: 'line',
  isStacked: false,
  chartIndexConfigs: {},
  chartRows: [],
  resizeToken: null,
};
