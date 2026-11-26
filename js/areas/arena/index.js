// Arena area: Julian vs. Uygar, live over Firebase. The views read an
// in-memory model that the subscriptions fill; the connection stays open
// while the app runs, so the Heute tile can show the last known score.
import { ds, dayIdx } from '../../core/dates.js';
import { TASKS, PLAYERS } from './data.js';
import { cleanConn, cleanTasks, berlinDay, plusDays, mondayOf, weekDays, isoWeek, editable, dayPoints, weekSums, history, totalsSince, suggest, randomId, parseConfig, encodeInvite, decodeInvite } from './logic.js';
import { firebaseNet } from './net.js';
import { emptyView, loadingView, offlineView, deniedView, configView, todayView, weekView, historyView, inviteView } from './view.js';
import { hoursInBed } from '../recovery/logic.js';
import { summary as foodSummary } from '../food/index.js';
import { DEF } from '../training/plan-default.js';
import { totals } from '../training/logic.js';

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const isDay = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const safe = fn => { try { return fn(); } catch (e) { return null; } };
const RETRY_MS = 5000;
const MSG = { offline: 'Gerade kein Netz – wird gesendet, sobald du online bist.', denied: 'Speichern abgelehnt – Einladung prüfen.', config: 'Die Firebase-Konfiguration passt nicht.' };

export const conn = ctx => cleanConn(ctx.store.get('arena.conn'));
const today = ctx => berlinDay(ctx.now());

// ---------------- connection and model ----------------
let factory = firebaseNet, net = null, netId = null, model = null, readyP = null;
export function setNetFactory(fn) { factory = fn; disconnect(); }
function disconnect() {
  if (net) net.close();
  net = null; netId = null; model = null; readyP = null;
}

function saveCache(ctx) {
  const t = today(ctx), s = { day: t, julian: 0, uygar: 0 };
  for (const d of model.days) if (d.date === t && isNum(d.total)) s[d.player] += d.total;
  ctx.store.set('arena.cache', s);
}
export function cacheSummary(ctx) {
  const c = ctx.store.get('arena.cache');
  return isObj(c) && isDay(c.day) && isNum(c.julian) && isNum(c.uygar) ? { day: c.day, julian: c.julian, uygar: c.uygar } : null;
}

function connect(ctx) {
  const c = conn(ctx);
  if (!c) { disconnect(); return null; }
  const id = c.code + ':' + c.player;
  // A failed first start tries again after a pause (or at once via the button).
  if (net && netId === id && !(model.error && !model.loaded && +ctx.now() - model.failedAt >= RETRY_MS)) return model;
  disconnect();
  const n = factory(c), m = { tasks: [], days: [], start: null, loaded: false, error: null };
  net = n; netId = id; model = m;
  const live = () => n === net;
  readyP = n.ready.then(() => n.info()).then(info => {
    if (!live()) return;
    m.start = info.start;
    n.watchTasks(t => { if (!live()) return; m.tasks = cleanTasks(t); m.loaded = true; saveCache(ctx); ctx.rerender(); });
    n.watchDays(mondayOf(info.start), '9999-12-31', d => { if (!live()) return; m.days = (Array.isArray(d) ? d : []).filter(x => isObj(x) && x.player in PLAYERS && isDay(x.date)); saveCache(ctx); ctx.rerender(); });
  }).catch(e => { if (live()) { m.error = (e && e.message) || 'offline'; m.failedAt = +ctx.now(); ctx.rerender(); } });
  return m;
}
// Tests and the setup flow wait for the connection; errors stay in the model.
export const ready = ctx => { connect(ctx); return readyP ? readyP.catch(() => {}) : Promise.resolve(); };

// ---------------- setup and access ----------------
// Uygar plays in the arena only, until he shows the other areas himself.
export function arenaOnly(store) {
  const c = cleanConn(store.get('arena.conn'));
  return !!c && c.player === 'uygar' && store.get('app.full') !== true;
}
const appUrl = () => (typeof location !== 'undefined' && location.origin ? location.origin + location.pathname : 'https://julians4.github.io/ki-apps/');
export function inviteLink(ctx, player) {
  const c = conn(ctx);
  if (!c || !c.keys || !(player in PLAYERS)) return null;
  return `${appUrl()}#arena/einladung?${encodeInvite({ cfg: c.cfg, code: c.code, player, key: c.keys[player] })}`;
}
const SETUP_ERR = {
  offline: 'Kein Netz – bitte online nochmal versuchen.',
  config: 'Firebase lehnt die Konfiguration ab – Schritte 2–4 der Anleitung prüfen.',
  denied: 'Firebase hat abgelehnt – sind die Regeln aus Schritt 5 veröffentlicht?',
};
// A new arena: long random code, one key per player, Notion's five tasks.
export async function setupArena(ctx, text) {
  const cfg = parseConfig(text);
  if (!cfg) return { ok: false, error: 'Konfiguration nicht erkannt' };
  const keys = { julian: randomId(24), uygar: randomId(24) }, c = { cfg, code: randomId(16), player: 'julian', key: keys.julian, keys };
  const n = factory(c);
  try {
    await n.create({ start: today(ctx), tasks: TASKS, keys });
  } catch (e) {
    n.close();
    return { ok: false, error: SETUP_ERR[e && e.message] || SETUP_ERR.denied };
  }
  n.close();
  ctx.store.set('arena.conn', c);
  ctx.store.remove('arena.cache');
  disconnect();
  return { ok: true };
}
// An invite for another arena or player never silently replaces the access
// on this device (with Julian's keys); that needs `force`.
export function joinArena(ctx, text, { force = false } = {}) {
  const c = decodeInvite(text);
  if (!c) return { ok: false };
  const cur = conn(ctx);
  if (cur && cur.code === c.code && cur.player === c.player) return { ok: true, player: c.player };
  if (cur && !force) return { ok: false, conflict: true, current: cur.player, player: c.player, dropsKeys: !!cur.keys };
  ctx.store.set('arena.conn', c);
  ctx.store.remove('arena.cache');
  disconnect();
  return { ok: true, player: c.player };
}
export function leaveArena(ctx) {
  ctx.store.remove('arena.conn');
  ctx.store.remove('arena.cache');
  disconnect();
}
const standalone = () => typeof navigator !== 'undefined' && (navigator.standalone === true
  || (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches));

// ---------------- screen state ----------------
let shown = null, openDay = null, edit = false, confirm = false, week = null, err = '', invite = null, joinDraft = '', joinMsg = '';
// A day opened from the week view survives the one navigation back to Heute.
export function onNavigate() { shown = openDay; openDay = null; edit = false; confirm = false; week = null; err = ''; invite = null; joinMsg = ''; }

export function header(route, ctx) {
  const v = route.view, tab = (h, l, on) => `<a href="${h}"${on ? ' class="on"' : ''}>${l}</a>`;
  const gear = ctx && arenaOnly(ctx.store) ? '<a href="#einstellungen" aria-label="Einstellungen">⚙</a>' : '';
  return `<nav class="tabs">${tab('#arena', 'Heute', v === 'today' || v === 'invite')}${tab('#arena/woche', 'Woche', v === 'week')}${tab('#arena/verlauf', 'Verlauf', v === 'history')}${gear}</nav>`;
}

const mine = (ctx, d) => model.days.find(x => x.player === conn(ctx).player && x.date === d);
const scoresOn = d => {
  const s = { julian: 0, uygar: 0 };
  for (const x of model.days) if (x.date === d && isNum(x.total)) s[x.player] += x.total;
  return s;
};
const shownDay = ctx => (isDay(shown) ? shown : today(ctx));

// Julian's suggestions read his own local data; nothing of it goes online.
function suggestions(ctx) {
  const now = ctx.now(), local = ds(now), m = (ctx.store.get('rec.morning') || {})[local];
  const sleepH = isObj(m) && HHMM.test(m.bed) && HHMM.test(m.wake) ? hoursInBed(m.bed, m.wake) : undefined;
  const f = safe(() => foodSummary(ctx)) || {};
  const sets = safe(() => {
    const plan = ctx.store.get('train.plan') || DEF, day = plan.days[dayIdx(now)];
    return totals(day, (ctx.store.get('train.sess') || {})['s_' + local + '_' + day.id]).o;
  });
  const s = suggest({ sleepH, clean: f.clean, water: f.water, sets });
  return { health: s.health ? `${String(Math.round(sleepH * 10) / 10).replace('.', ',')} h Schlaf, sauber, ${String(f.water / 1000).replace('.', ',')} L` : '', training: s.training ? 'Training eingetragen' : '' };
}

function todayVM(ctx) {
  const c = conn(ctx), t = today(ctx), d = shownDay(ctx), doc = mine(ctx, d), values = doc && isObj(doc.values) ? doc.values : {};
  const sug = c.player === 'julian' && d === t ? suggestions(ctx) : {};
  const pts = dayPoints(model.tasks, values).points;
  return {
    day: d, isToday: d === t, isYesterday: d === plusDays(t, -1), switchTo: d === t ? plusDays(t, -1) : t, locked: !editable(d, t, model.start),
    scores: scoresOn(d), pending: net.status().pending, error: err, edit, confirm, other: c.player === 'julian' ? 'Uygar' : 'Julian',
    tasks: model.tasks.filter(x => !x.archived).map(x => ({ ...x, value: values[x.id], points: pts[x.id] || 0, suggest: values[x.id] === undefined ? sug[x.id] || '' : '' })),
  };
}
function weekVM(ctx) {
  const t = today(ctx), cur = mondayOf(t), m = isDay(week) && week <= cur ? week : cur;
  const by = {};
  for (const x of model.days) by[x.player + '_' + x.date] = x.total;
  return {
    start: model.start, today: t,
    kw: isoWeek(m).week, sums: weekSums(model.days, m), prev: plusDays(m, -7), next: m < cur ? plusDays(m, 7) : null,
    days: weekDays(m).map(date => ({ date, julian: by['julian_' + date], uygar: by['uygar_' + date], open: editable(date, t, model.start) })),
  };
}

export function render(route, ctx) {
  // An invite is taken over once; the address loses its data only afterwards (mount).
  if (route.view === 'invite') {
    if (!invite || invite.token !== route.token) {
      const link = typeof location !== 'undefined' && location.href ? location.href : `#arena/einladung?${route.token}`;
      invite = { token: route.token, link, ...joinArena(ctx, route.token) };
    }
    return inviteView({ ...invite, name: PLAYERS[invite.player], currentName: PLAYERS[invite.current], standalone: standalone() });
  }
  if (!conn(ctx)) return emptyView({ draft: joinDraft, msg: joinMsg });
  const m = connect(ctx);
  if (!m.loaded) return m.error === 'denied' ? deniedView() : m.error === 'config' ? configView() : m.error ? offlineView() : loadingView();
  if (route.view === 'week') return weekView(weekVM(ctx));
  if (route.view === 'history') {
    const t = today(ctx);
    return historyView({ weeks: history(m.days, m.start, t), totals: totalsSince(m.days, t), current: mondayOf(t) });
  }
  return todayView(todayVM(ctx));
}

export function mount(root, route) {
  // globalThis: `history` in this module is the arena's week history.
  const h = globalThis.history;
  if (route.view === 'invite' && invite && invite.ok && h && h.replaceState) h.replaceState(null, '', '#arena');
}

// The whole day is written each time, points included.
function setValue(ctx, id, value) {
  const c = conn(ctx), t = today(ctx), d = shownDay(ctx);
  if (!c || !model || !model.loaded || !editable(d, t, model.start)) return;
  const doc = mine(ctx, d), values = { ...(doc && isObj(doc.values) ? doc.values : {}) };
  if (value === null) delete values[id]; else values[id] = value;
  const { points, total } = dayPoints(model.tasks, values), next = { player: c.player, date: d, values, points, total };
  model.days = [...model.days.filter(x => !(x.player === c.player && x.date === d)), next];
  err = '';
  net.putDay({ date: d, values, points, total }).catch(e => { err = MSG[e && e.message] || MSG.offline; ctx.rerender(); });
  saveCache(ctx);
  ctx.rerender();
}
function putTask(ctx, task) {
  if (!net || !model || !model.loaded) return;
  model.tasks = cleanTasks([...model.tasks.filter(x => x.id !== task.id), task]);
  net.putTask(task).catch(e => { err = MSG[e && e.message] || MSG.offline; ctx.rerender(); });
}

export function onClick(e, route, ctx) {
  const t = e.target.closest('[data-a]');
  if (!t) return;
  if (t.dataset.a === 'acopy' && invite && typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(invite.link).then(() => ctx.toast('Link kopiert', 'Jetzt in der App unter Einstellungen einfügen.'), () => {});
    return;
  }
  if (t.dataset.a === 'agoto') { invite = null; ctx.go('#arena'); ctx.rerender(); return; }
  if (t.dataset.a === 'areplace' && invite) {
    invite = { ...invite, ...joinArena(ctx, invite.token, { force: true }), conflict: false };
    ctx.rerender();
    return;
  }
  if (t.dataset.a === 'ajoin') {
    const r = joinArena(ctx, joinDraft);
    if (r.ok) joinDraft = '';
    joinMsg = r.ok ? '' : 'Diese Einladung ist ungültig oder unvollständig.';
    ctx.rerender();
    return;
  }
  if (t.dataset.a === 'aretry') { disconnect(); ctx.rerender(); return; }
  if (!conn(ctx) || !model) return;
  const a = t.dataset.a, id = t.dataset.t, task = model.tasks.find(x => x.id === id);
  if ((a === 'yes' || a === 'no' || a === 'take') && task && task.kind === 'yes') setValue(ctx, id, a !== 'no');
  if (a === 'day' && isDay(t.dataset.d)) { shown = t.dataset.d; edit = false; ctx.rerender(); }
  if (a === 'wk' && isDay(t.dataset.d)) { week = mondayOf(t.dataset.d); ctx.rerender(); }
  if (a === 'open' && isDay(t.dataset.d) && model.loaded && editable(t.dataset.d, today(ctx), model.start)) { openDay = t.dataset.d; ctx.go('#arena'); }
  if (a === 'tedit') { edit = !edit; confirm = false; ctx.rerender(); }
  if (a === 'tadd') {
    putTask(ctx, { id: 't' + randomId(6), name: 'Neue Aufgabe', kind: 'yes', order: Math.max(0, ...model.tasks.map(x => x.order)) + 1, archived: false });
    ctx.rerender();
  }
  if (a === 'tarch' && task) { putTask(ctx, { ...task, archived: true }); ctx.rerender(); }
  if (a === 'treset') {
    // Two taps: the first only asks. Notion's five come back, the rest is archived.
    if (!confirm) { confirm = true; ctx.rerender(); return; }
    confirm = false;
    edit = false;
    for (const x of model.tasks) if (!TASKS.some(d => d.id === x.id) && !x.archived) putTask(ctx, { ...x, archived: true });
    for (const d of TASKS) putTask(ctx, { ...d });
    ctx.rerender();
  }
}

export function onChange(e, route, ctx) {
  const t = e.target, a = t.dataset && t.dataset.a;
  if (!conn(ctx) || !model) return;
  const task = model.tasks.find(x => x.id === t.dataset.t), s = String(t.value ?? '').trim().replace(',', '.');
  if (a === 'val' && task && task.kind === 'value') {
    if (s === '') setValue(ctx, task.id, null);
    else if (/^\d+(\.\d+)?$/.test(s)) setValue(ctx, task.id, +s);
    else ctx.rerender();
  }
  if (a === 'tn' && task && String(t.value).trim()) { putTask(ctx, { ...task, name: String(t.value).trim().slice(0, 60) }); ctx.rerender(); }
  if (a === 'tg' && task && task.kind === 'value' && /^\d+(\.\d+)?$/.test(s) && +s > 0) { putTask(ctx, { ...task, goal: +s }); ctx.rerender(); }
  if (a === 'tk' && task && (t.value === 'yes' || t.value === 'value') && t.value !== task.kind) {
    const { goal, unit, ...rest } = task;
    putTask(ctx, t.value === 'value' ? { ...rest, kind: 'value', goal: goal || 1, unit: unit || '' } : { ...rest, kind: 'yes' });
    ctx.rerender();
  }
  if (a === 'tu' && task && task.kind === 'value') { putTask(ctx, { ...task, unit: String(t.value ?? '').trim().slice(0, 10) }); ctx.rerender(); }
}

export function onInput(e) {
  const t = e.target;
  if (t.dataset && t.dataset.a === 'ainv') joinDraft = t.value;
}
