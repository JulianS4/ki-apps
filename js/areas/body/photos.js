// Body photos live in IndexedDB as JPEG blobs under "YYYY-MM-DD:pose"; the
// index of which exist sits in localStorage (body.photos) so pages draw at once.
// A store has put/get/del/keys/size, all async; tests use memPhotos.
import { cleanPhotos } from './logic.js';
import { POSES } from './data.js';

const POSE_IDS = POSES.map(p => p.id);
function splitKey(k) {
  const m = /^(\d{4}-\d{2}-\d{2}):(\w+)$/.exec(String(k));
  return m && POSE_IDS.includes(m[2]) ? { day: m[1], pose: m[2] } : null;
}

export function memPhotos({ failKeys = [] } = {}) {
  const m = new Map();
  return {
    async put(k, blob) { if (failKeys.includes(k)) throw new Error('write failed'); m.set(k, blob); },
    async get(k) { return m.get(k) || null; },
    async del(k) { m.delete(k); },
    async keys() { return [...m.keys()]; },
    async size() { let n = 0; for (const b of m.values()) n += b.size; return n; },
  };
}

const req = r => new Promise((ok, no) => { r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });

// null when the browser has no IndexedDB; opening errors surface per call.
export function idbPhotos(idb = globalThis.indexedDB) {
  if (!idb) return null;
  let db = null;
  const open = () => db || (db = new Promise((ok, no) => {
    const r = idb.open('ki-apps-photos', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('photos');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => { db = null; no(r.error); };
    r.onblocked = () => { db = null; no(new Error('blocked')); };
  }));
  const run = async (mode, fn) => {
    const tx = (await open()).transaction('photos', mode);
    const done = mode === 'readwrite'
      ? new Promise((ok, no) => { tx.oncomplete = ok; tx.onerror = () => no(tx.error); tx.onabort = () => no(tx.error || new Error('abort')); })
      : null;
    const out = await req(fn(tx.objectStore('photos')));
    if (done) await done;
    return out;
  };
  return {
    put: (k, blob) => run('readwrite', s => s.put(blob, k)).then(() => undefined),
    get: k => run('readonly', s => s.get(k)).then(v => v || null),
    del: k => run('readwrite', s => s.delete(k)).then(() => undefined),
    keys: () => run('readonly', s => s.getAllKeys()).then(v => v.map(String)),
    size: () => run('readonly', s => s.getAll()).then(all => all.reduce((n, b) => n + ((b && b.size) || 0), 0)),
  };
}

// Base64 in 32 KB chunks: works in Node 22 and in the browser.
export async function blobToDataUrl(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return `data:${blob.type || 'image/jpeg'};base64,${btoa(s)}`;
}
export function dataUrlToBlob(url) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(typeof url === 'string' ? url : '');
  if (!m) return null;
  try {
    const s = atob(m[2]), b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return new Blob([b], { type: m[1] });
  } catch (e) { return null; }
}

export function mergeIndex(a, b) {
  const out = cleanPhotos(a);
  for (const [d, x] of Object.entries(cleanPhotos(b))) out[d] = { ...(out[d] || {}), ...x };
  return out;
}

// Backup: only images the store really has go out, and the index says so.
export async function exportPhotos(store, index) {
  const photos = {}, out = {};
  let missing = 0;
  for (const [d, x] of Object.entries(cleanPhotos(index))) {
    for (const pose of Object.keys(x)) {
      const k = `${d}:${pose}`;
      let blob = null;
      try { blob = await store.get(k); } catch (e) { blob = null; }
      if (!blob) { missing++; continue; }
      photos[k] = await blobToDataUrl(blob);
      (out[d] = out[d] || {})[pose] = true;
    }
  }
  return { photos, index: out, count: Object.keys(photos).length, missing };
}

// Loading keeps going past a bad image; the index lists only what was written.
export async function importPhotos(store, photos) {
  const index = {};
  let written = 0, failed = 0;
  if (!photos || typeof photos !== 'object' || Array.isArray(photos)) return { index, written, failed };
  for (const [k, url] of Object.entries(photos)) {
    const key = splitKey(k);
    if (!key) continue;
    const blob = dataUrlToBlob(url);
    if (!blob) { failed++; continue; }
    try {
      await store.put(k, blob);
      (index[key.day] = index[key.day] || {})[key.pose] = true;
      written++;
    } catch (e) { failed++; }
  }
  return { index, written, failed };
}

// Browser only: upright (EXIF), long side at most `max` px, JPEG.
function loadImg(file) {
  return new Promise((ok, no) => {
    const u = URL.createObjectURL(file), i = new Image();
    i.onload = () => { URL.revokeObjectURL(u); ok(i); };
    i.onerror = () => { URL.revokeObjectURL(u); no(new Error('Bild nicht lesbar')); };
    i.src = u;
  });
}
export async function resizeImage(file, max = 1080, quality = 0.85) {
  let src;
  try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { src = await loadImg(file); }
  const w = src.naturalWidth || src.width, h = src.naturalHeight || src.height, k = Math.min(1, max / Math.max(w, h));
  if (!w || !h) throw new Error('Bild nicht lesbar');
  const c = document.createElement('canvas');
  c.width = Math.round(w * k);
  c.height = Math.round(h * k);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  if (src.close) src.close();
  const blob = await new Promise(ok => c.toBlob(ok, 'image/jpeg', quality));
  if (!blob) throw new Error('Bild nicht lesbar');
  return blob;
}
