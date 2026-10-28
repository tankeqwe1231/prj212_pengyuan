import $ from 'jquery';

function getErrorMessage(xhr, fallback) {
  const payload = xhr && xhr.responseJSON;
  if (payload && payload.error) {
    return payload.error;
  }
  return fallback;
}

// 页面 POST 到自身 URL，由后端按 action 分发
export function postAction(action, payload = {}) {
  return new Promise((resolve, reject) => {
    $.ajax({
      url: '',
      type: 'POST',
      contentType: 'application/json',
      dataType: 'json',
      data: JSON.stringify({ ...payload, action }),
      success: (response) => {
        if (response && response.error) {
          reject(new Error(response.error));
          return;
        }
        resolve(response);
      },
      error: (xhr, status, error) => {
        reject(new Error(getErrorMessage(xhr, error || '请求失败')));
      },
    });
  });
}

export function fetchMyDashboards(userId) {
  return new Promise((resolve, reject) => {
    $.ajax({
      url: `/dashboardmodelviewasync/api/read?_flt_0_owners=${encodeURIComponent(userId)}`,
      type: 'GET',
      dataType: 'json',
      success: (response) => {
        const pks = (response && response.pks) || [];
        const result = (response && response.result) || [];
        resolve(pks.map((pk, i) => ({
          value: pk,
          label: (result[i] && result[i].dashboard_title) || String(pk),
        })));
      },
      error: (xhr, status, error) => {
        reject(new Error(getErrorMessage(xhr, error || '获取页面列表失败')));
      },
    });
  });
}
