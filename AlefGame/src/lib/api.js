// src/lib/api.js
const BASE = 'http://127.0.0.1:8000';  // Llamada directa al backend (sin proxy)

export async function postVideo(file, returnMode = 'both') {
  const url = `${BASE}/analyze/video?return_mode=${encodeURIComponent(returnMode)}&role=user`;
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(url, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Backend ${res.status}: ${text || res.statusText}`);
  }
  return res.json(); // samples + video_path temporal
}

export async function extractFrame(file, atSecond = 0) {
  const url = `${BASE}/frame/extract?at=${encodeURIComponent(atSecond)}`;
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(url, { method: 'POST', body: form });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Backend ${res.status}: ${text || res.statusText}`);
  }
  return res.blob(); // imagen (blob)
}
