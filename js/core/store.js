// In-memory stand-in used when the real storage is blocked (data lasts until the app closes).
export function memoryBackend() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); },
    key: i => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
}

// Use localStorage when it can be read and written, else memory; `persistent`
// tells the shell whether to warn that nothing will survive a restart.
export function pickBackend(getLocal) {
  try {
    const b = getLocal();
    if (b) {
      b.getItem('ki.probe');
      b.setItem('ki.probe', '1');
      b.removeItem('ki.probe');
      return { backend: b, persistent: true };
    }
  } catch (e) { /* blocked or full */ }
  return { backend: memoryBackend(), persistent: false };
}

// JSON key/value store on top of a localStorage-like backend.
// Keys are given without prefix; every failure is swallowed so a full or
// blocked storage never crashes the app (set() reports it via false).
export function createStore(backend, prefix = 'ki.') {
  return {
    get(key, fallback = null) {
      try {
        const raw = backend.getItem(prefix + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { backend.setItem(prefix + key, JSON.stringify(value)); return true; } catch (e) { return false; }
    },
    remove(key) {
      try { backend.removeItem(prefix + key); } catch (e) { /* ignore */ }
    },
    keys() {
      const out = [];
      try {
        for (let i = 0; i < backend.length; i++) {
          const k = backend.key(i);
          if (k && k.startsWith(prefix)) out.push(k.slice(prefix.length));
        }
      } catch (e) { /* ignore */ }
      return out;
    },
  };
}
