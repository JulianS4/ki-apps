// The accent colour of Life OS: one choice colours buttons, rings, glows and the muscle
// figure (styles.css reads html[data-accent]). Stored per device under ui.accent.
export const ACCENTS = [['lime', 'Neon-Grün', '#B8F53C'], ['rot', 'Rot', '#FF5656'], ['orange', 'Orange', '#FF9C38'], ['tuerkis', 'Türkis', '#2EE6D6'], ['lila', 'Lila', '#AA7EFF'], ['pink', 'Pink', '#FF60B2']];
const known = v => ACCENTS.some(a => a[0] === v);
const page = () => (typeof document !== 'undefined' ? document : null);

export const accentOf = store => { const v = store.get('ui.accent'); return known(v) ? v : 'lime'; };
export function applyAccent(store, doc = page()) {
  const a = accentOf(store);
  if (doc && doc.documentElement) doc.documentElement.dataset.accent = a;
  return a;
}
export function setAccent(store, key, doc = page()) {
  store.set('ui.accent', known(key) ? key : 'lime');
  return applyAccent(store, doc);
}
// The accent as "r g b" for canvas drawings, read from the page (lime outside a browser).
export function accentRgb() {
  const doc = page(), v = doc && typeof getComputedStyle === 'function' ? getComputedStyle(doc.documentElement).getPropertyValue('--ac-rgb').trim() : '';
  return /^\d+ \d+ \d+$/.test(v) ? v.replace(/ /g, ',') : '184,245,60';
}
