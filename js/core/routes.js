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
const ARENA_VIEWS = { woche: 'week', verlauf: 'history' };
function arenaRoute(sub) {
  const [p, q] = sub.split('?');
  if (p === 'einladung') return { area: 'arena', view: 'invite', token: q || '' };
  return { area: 'arena', view: ARENA_VIEWS[p] || 'today' };
}
const BODY_VIEWS = { verlauf: 'history', fotos: 'photos', messung: 'entry' };
function bodyRoute(sub) {
  const [p, q] = sub.split('?'), view = BODY_VIEWS[p] || 'overview';
  return view === 'entry' ? { area: 'body', view, date: /^\d{4}-\d{2}-\d{2}$/.test(q || '') ? q : null } : { area: 'body', view };
}

// Cockpit: one area per section, sub-pages as views.
const FIN_VIEWS = { konten: 'accounts', buchungen: 'tx', ausgaben: 'costs', kosten: 'costs', budget: 'budget', abos: 'subs' };
function sub(h, base) { return h === base ? '' : h.startsWith(base + '/') ? h.slice(base.length + 1) : null; }
function cockpitRoute(h) {
  let s;
  if (h === 'cockpit' || h === 'uebersicht' || h === '') return { area: 'cockpit' };
  if (h === 'heute') return { area: 'heute' };
  if (h === 'business-log') return { area: 'projects', view: 'log' };
  if (h === 'agents') return { area: 'agents' };
  if (h === 'integrationen') return { area: 'settings' };
  if ((s = sub(h, 'finanzen')) !== null) return { area: 'finance', view: FIN_VIEWS[s] || 'overview' };
  if ((s = sub(h, 'ausbildung')) !== null) {
    const [p, q] = s.split('?');
    let subj = '';
    try { subj = decodeURIComponent(q || '').trim(); } catch (e) { subj = ''; }
    return p === 'fach' && subj ? { area: 'school', view: 'subject', subj } : { area: 'school', view: 'overview' };
  }
  if ((s = sub(h, 'projekte')) !== null) {
    if (s === 'log') return { area: 'projects', view: 'log' };
    return s.startsWith('p-') && s.length > 2 ? { area: 'projects', view: 'project', id: s.slice(2) } : { area: 'projects', view: 'list' };
  }
  if ((s = sub(h, 'wissen')) !== null) return s.startsWith('n-') && s.length > 2 ? { area: 'notes', view: 'note', id: s.slice(2) } : { area: 'notes', view: 'list' };
  return null;
}

export function parseRoute(hash) {
  const h = String(hash || '').replace(/^#/, '');
  if (h === 'einstellungen') return { area: 'settings' };
  const cx = cockpitRoute(h);
  if (cx) return cx;
  if (h === 'recovery' || h.startsWith('recovery/')) return recoveryRoute(h.slice('recovery/'.length));
  if (h === 'routinen' || h.startsWith('routinen/')) return { area: 'routines', view: ROUT_VIEWS[h.slice('routinen/'.length)] || 'today' };
  if (h === 'arena' || h.startsWith('arena/')) return arenaRoute(h.slice('arena/'.length));
  if (h === 'koerper' || h.startsWith('koerper/')) return bodyRoute(h.slice('koerper/'.length));
  if (h === 'ernaehrung' || h.startsWith('ernaehrung/')) return { area: 'food', view: FOOD_VIEWS[h.slice('ernaehrung/'.length)] || 'today' };
  if (h === 'training' || h.startsWith('training/')) return trainingRoute(h.slice('training/'.length));
  if (DAYS.includes(h) || h === 'verlauf' || (h.startsWith('x-') && h.length > 2)) return trainingRoute(h);
  return { area: 'cockpit' };
}
