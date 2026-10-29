/**
 * Panopticon HTTP Testing Client
 * Handles requests against Console Proxy (:8787) and Backend (:8788)
 */

async function request(url, options = {}) {
  const method = options.method || 'GET';
  const headers = Object.assign({}, options.headers || {});
  let body = options.body;

  if (body && typeof body === 'object' && !(body instanceof Buffer)) {
    body = JSON.stringify(body);
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
  }

  const timeoutMs = options.timeoutMs || 5000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
    });
    clearTimeout(timer);

    const status = res.status;
    const resHeaders = {};
    for (const [k, v] of res.headers.entries()) {
      resHeaders[k.toLowerCase()] = v;
    }

    let json = null;
    let text = '';
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        json = await res.json();
      } catch (err) {
        text = await res.text();
      }
    } else {
      text = await res.text();
    }

    return {
      status,
      ok: res.ok,
      headers: resHeaders,
      json,
      text,
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      status: 0,
      ok: false,
      headers: {},
      json: null,
      text: '',
      error: err.message,
    };
  }
}

async function get(url, headers = {}) {
  return request(url, { method: 'GET', headers });
}

async function post(url, body, headers = {}) {
  return request(url, { method: 'POST', body, headers });
}

module.exports = {
  request,
  get,
  post,
};
