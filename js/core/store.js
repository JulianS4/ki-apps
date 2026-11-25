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
