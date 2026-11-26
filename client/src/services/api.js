const TOKEN_KEY = 'hostelhub_token';
export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

async function request(method, url, body) {
  const headers = {};
  const t = tokenStore.get();
  if (t) headers.Authorization = `Bearer ${t}`;
  const isForm = body instanceof FormData;
  if (body && !isForm) headers['Content-Type'] = 'application/json';
  let res;
  try { res = await fetch(`/api${url}`, { method, headers, body: body ? (isForm ? body : JSON.stringify(body)) : undefined }); }
  catch { throw new Error('Cannot reach the server. Is the backend running?'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && t && !url.startsWith('/auth/')) onUnauthorized();
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}
export const api = {
  get: (u) => request('GET', u), post: (u, b) => request('POST', u, b || {}),
  put: (u, b) => request('PUT', u, b), del: (u) => request('DELETE', u),
};
export const qs = (obj) => {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => { if (v !== '' && v !== undefined && v !== null && v !== false) p.set(k, v); });
  const s = p.toString();
  return s ? `?${s}` : '';
};
