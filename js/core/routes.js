// Hash routes. Old Hybrid-Training links (#mo, #verlauf, #x-id) still land in Training.
import { DAYS } from './dates.js';

function trainingRoute(sub) {
  if (sub === 'verlauf') return { area: 'training', view: 'hist' };
  if (sub && sub.startsWith('x-') && sub.length > 2) return { area: 'training', view: 'ex', ex: sub.slice(2) };
  return { area: 'training', view: 'day', day: DAYS.includes(sub) ? sub : null };
}

export function parseRoute(hash) {
  const h = String(hash || '').replace(/^#/, '');
  if (h === 'einstellungen') return { area: 'settings' };
  if (h === 'training' || h.startsWith('training/')) return trainingRoute(h.slice('training/'.length));
  if (DAYS.includes(h) || h === 'verlauf' || (h.startsWith('x-') && h.length > 2)) return trainingRoute(h);
  return { area: 'heute' };
}
