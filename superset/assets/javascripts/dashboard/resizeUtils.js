const DASHBOARD_RESIZE_SUPPRESSION_CLASS = 'dashboard-resize-suppressed';

export function suppressDashboardResize() {
  document.documentElement.classList.add(DASHBOARD_RESIZE_SUPPRESSION_CLASS);
}

export function resumeDashboardResize() {
  document.documentElement.classList.remove(DASHBOARD_RESIZE_SUPPRESSION_CLASS);
}

export function isDashboardResizeSuppressed() {
  return document.documentElement.classList.contains(DASHBOARD_RESIZE_SUPPRESSION_CLASS);
}
