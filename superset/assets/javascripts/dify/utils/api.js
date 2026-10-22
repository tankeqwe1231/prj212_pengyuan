/**
 * API辅助函数，用于处理与Dify API的通信
 */

/**
 * 获取CSRF令牌
 * @returns {string|null} CSRF令牌
 */
export function getCSRFToken() {
  const token = document.querySelector('input#csrf_token');
  return token ? token.value : null;
}

/**
 * 封装的GET请求
 * @param {string} url - 请求URL
 * @param {Object} options - 请求选项
 * @returns {Promise} - fetch请求的Promise
 */
export function fetchGet(url, options = {}) {
  return fetch(url, {
    ...options,
    method: 'GET',
  });
}

/**
 * 封装的POST请求，自动添加CSRF令牌
 * @param {string} url - 请求URL
 * @param {Object} data - 请求体数据
 * @param {Object} options - 其他请求选项
 * @returns {Promise} - fetch请求的Promise
 */
export function fetchPost(url, data, options = {}) {
  const token = getCSRFToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  // 添加CSRF令牌
  if (token) {
    headers['X-CSRFToken'] = token;
  }

  return fetch(url, {
    ...options,
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
}

/**
 * 封装的流式POST请求，自动添加CSRF令牌
 * @param {string} url - 请求URL
 * @param {Object} data - 请求体数据
 * @param {Object} options - 其他请求选项
 * @returns {Promise} - fetch请求的Promise
 */
export function fetchStreamPost(url, data, options = {}) {
  const token = getCSRFToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  // 添加CSRF令牌
  if (token) {
    headers['X-CSRFToken'] = token;
  }

  return fetch(url, {
    ...options,
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
}