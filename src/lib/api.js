const API_BASE = '/api';

class ApiError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);

  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type') || '';
  let payload = null;

  if (contentType.includes('application/json')) {
    try {
      payload = await response.json();
    } catch (error) {
      payload = null;
    }
  } else {
    const text = await response.text();
    payload = text ? { error: text } : null;
  }

  if (!response.ok) {
    throw new ApiError(
      payload?.error || 'Request failed',
      payload?.code || 'UNKNOWN',
      response.status,
    );
  }

  return payload || { data: null };
}

export const api = {
  get: (endpoint) => request(endpoint, { method: 'GET' }),
  post: (endpoint, body) => request(endpoint, { method: 'POST', body }),
  put: (endpoint, body) => request(endpoint, { method: 'PUT', body }),
  delete: (endpoint, body) => request(endpoint, { method: 'DELETE', body }),
};

export { ApiError };

export function extractRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}
