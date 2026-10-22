import echarts from 'echarts';
import { t } from '../locales';

// Chart's "rendered" status precedes D3 transitions and ECharts canvas animation.
// Observe only the grid, so the export dialog's spinner cannot delay capture.
export function waitForDashboardRender(grid, getSlices, getCharts, signal, timeout = 120000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    let stableSince = Date.now();
    let previousCharts = [];
    let interval;
    const renderers = new Set();
    const markChanged = () => { stableSince = Date.now(); };
    const observer = new MutationObserver(markChanged);

    function cleanup() {
      clearInterval(interval);
      observer.disconnect();
      renderers.forEach(chart => chart.off('rendered', markChanged));
      signal.removeEventListener('abort', abort);
    }

    function fail(message) {
      cleanup();
      reject(new Error(message));
    }

    function abort() {
      cleanup();
      reject(new DOMException('Screenshot cancelled', 'AbortError'));
    }

    function check() {
      if (!grid.isConnected) {
        fail(t('页面内容已关闭，请重新打开页面后重试'));
        return;
      }
      if (Date.now() - startedAt >= timeout) {
        fail(t('等待图表绘制超时，请确认所有图表加载完成后重试'));
        return;
      }

      const slices = getSlices();
      const charts = getCharts();
      const currentCharts = slices.map(slice => charts[`slice_${slice.slice_id}`]);
      if (currentCharts.length !== previousCharts.length ||
          currentCharts.some((chart, index) => chart !== previousCharts[index])) {
        markChanged();
        previousCharts = currentCharts;
      }
      // A failed/timed-out or stopped request is terminal too: export the
      // current error/empty state of that slice without blocking other slices.
      const chartsReady = currentCharts.every((chart, index) => (
        chart && ['rendered', 'failed', 'stopped'].includes(chart.chartStatus) && !chart.triggerQuery &&
        Object.keys(chart.annotationQuery || {}).length === 0 &&
        grid.querySelector(`[data-slice-id="${slices[index].slice_id}"] .chart-container`)
      ));

      let animating = false;
      grid.querySelectorAll('[_echarts_instance_]').forEach(element => {
        const chart = echarts.getInstanceByDom(element);
        if (!chart || chart.isDisposed()) return;
        if (!renderers.has(chart)) {
          renderers.add(chart);
          chart.on('rendered', markChanged);
          markChanged();
        }
        // Canvas updates do not produce DOM mutations. The rendered listener
        // also catches progressive rendering after the animation has ended.
        if (!chart.getZr().animation.isFinished()) animating = true;
      });
      const imagesReady = Array.from(grid.querySelectorAll('img')).every(img => img.complete);
      const fontsReady = !document.fonts || document.fonts.status !== 'loading';
      if (!chartsReady || animating || !imagesReady || !fontsReady) {
        markChanged();
        return;
      }
      if (Date.now() - stableSince >= 300) {
        cleanup();
        resolve(grid);
      }
    }

    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    observer.observe(grid, { subtree: true, childList: true, attributes: true, characterData: true });
    interval = setInterval(check, 100);
    check();
  });
}

export function downloadDashboardPng(blob, dashboardTitle) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${dashboardTitle}.png`;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    // Give the browser time to consume the URL before releasing the PNG.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
