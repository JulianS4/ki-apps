// Moves the mobility ticks (s.mob) and Sunday week checks (s.week) that the
// training area used to store into Recovery. Safe to run any number of times:
// existing Recovery entries always win, and moved fields leave the session.
const has = o => o && typeof o === 'object' && Object.keys(o).length > 0;
const filled = v => v != null && v !== '';

// Anything the person typed or ticked besides the moved fields.
function holdsData(s) {
  const sets = Object.values(s.sets || {}).some(a => Array.isArray(a) && a.some(x => x && (x.ok || filled(x.v) || filled(x.w))));
  const warm = Object.values(s.warm || {}).some(Boolean);
  const notes = Object.values(s.n || {}).some(filled);
  return sets || warm || notes || !!s.health;
}

export function migrateToRecovery(sess, rec) {
  const out = structuredClone(sess || {});
  const mobility = { ...(rec && rec.mobility) }, weekly = { ...(rec && rec.weekly) };
  let moved = 0;
  for (const [k, s] of Object.entries(out)) {
    if (!s || typeof s !== 'object') continue;
    const date = s.date || k.slice(2, 12);
    const mob = s.mob === true, week = s.day === 'so' && has(s.week);
    if (!mob && !week) continue;
    if (mob && !mobility[date]) mobility[date] = { done: true };
    if (week && !weekly[date]) {
      const w = s.week, e = {};
      for (const f of ['schlaf', 'energie', 'gelenke', 'ziel']) if (w[f] != null) e[f] = w[f];
      weekly[date] = { ...e, gut: w.note || '', next: '' };
    }
    delete s.mob;
    if (week) delete s.week;
    if (!holdsData(s)) delete out[k];
    moved++;
  }
  return { sess: out, rec: { mobility, weekly }, moved };
}

export function runMigrations(store) {
  const r = migrateToRecovery(store.get('train.sess', {}), { mobility: store.get('rec.mobility', {}), weekly: store.get('rec.weekly', {}) });
  if (r.moved > 0) {
    store.set('rec.mobility', r.rec.mobility);
    store.set('rec.weekly', r.rec.weekly);
    store.set('train.sess', r.sess);
  }
  return r.moved;
}
