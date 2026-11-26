// Hash routes. Old Hybrid-Training links (#mo, #verlauf, #x-id) still land in Training.
import { DAYS } from './dates.js';

function trainingRoute(sub) {
  if (sub === 'verlauf') return { area: 'training', view: 'hist' };
  if (sub && sub.startsWith('x-') && sub.length > 2) return { area: 'training', view: 'ex', ex: sub.slice(2) };
  return { area: 'training', view: 'day', day: DAYS.includes(sub) ? sub : null };
}

const REC_VIEWS = { woche: 'week', zyklus: 'cycle', mobility: 'mobility' };
function recoveryRoute(sub) {
  const [p, q] = sub.split('?');
  if (p === 'atmung') {
    const n = parseInt(q, 10);
    return { area: 'recovery', view: 'breath', min: n >= 1 && n <= 30 ? n : 2 };
  }
  return { area: 'recovery', view: REC_VIEWS[p] || 'today' };
}

const FOOD_VIEWS = { gerichte: 'dishes', einkauf: 'shop' };
const ROUT_VIEWS = { grandpa: 'grandpa', halterung: 'holder' };
const BODY_VIEWS = { verlauf: 'history', fotos: 'photos', messung: 'entry' };
function bodyRoute(sub) {
  const [p, q] = sub.split('?'), view = BODY_VIEWS[p] || 'overview';
  return view === 'entry' ? { area: 'body', view, date: /^\d{4}-\d{2}-\d{2}$/.test(q || '') ? q : null } : { area: 'body', view };
}

export function parseRoute(hash) {
  const h = String(hash || '').replace(/^#/, '');
  if (h === 'einstellungen') return { area: 'settings' };
  if (h === 'recovery' || h.startsWith('recovery/')) return recoveryRoute(h.slice('recovery/'.length));
  if (h === 'routinen' || h.startsWith('routinen/')) return { area: 'routines', view: ROUT_VIEWS[h.slice('routinen/'.length)] || 'today' };
  if (h === 'koerper' || h.startsWith('koerper/')) return bodyRoute(h.slice('koerper/'.length));
  if (h === 'ernaehrung' || h.startsWith('ernaehrung/')) return { area: 'food', view: FOOD_VIEWS[h.slice('ernaehrung/'.length)] || 'today' };
  if (h === 'training' || h.startsWith('training/')) return trainingRoute(h.slice('training/'.length));
  if (DAYS.includes(h) || h === 'verlauf' || (h.startsWith('x-') && h.length > 2)) return trainingRoute(h);
  return { area: 'heute' };
}
