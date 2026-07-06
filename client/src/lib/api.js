// Thin fetch wrapper. All calls are same-origin (Vite proxies /api → :3001).
const BASE = '/api';

async function errorOf(res) {
  let msg = `HTTP ${res.status}`;
  try {
    const body = await res.json();
    msg = body.error || msg;
  } catch {
    /* non-JSON error body */
  }
  return new Error(msg);
}

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw await errorOf(res);
  if (res.status === 204) return null;
  return res.json();
}

// POST that saves the response as a file (docx/xlsx exports from server templates)
async function download(path, body, filename) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) throw await errorOf(res);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const api = {
  get:      (p)       => request(p),
  post:     (p, body) => request(p, { method: 'POST',  body: JSON.stringify(body) }),
  put:      (p, body) => request(p, { method: 'PUT',   body: JSON.stringify(body) }),
  patch:    (p, body) => request(p, { method: 'PATCH', body: JSON.stringify(body) }),
  del:      (p)       => request(p, { method: 'DELETE' }),
  download,
};
