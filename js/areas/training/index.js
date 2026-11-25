// Training area: state, events, rest timer, plan editing, Apple Health.
// Ported from hybrid-training@90dc751. No DOM access at import time.
import { DEF, CATS, E } from './plan-default.js';
import { computePRs, prOf, prText, lastFor, totals } from './logic.js';
import { dayView, histView, exDetail, getDay, cur, dateFor, keyFor, todayId, clock } from './view.js';
import { bindChart } from './chart.js';
import { setTrainingSummary } from '../heute.js';
import { recoveryFor } from '../recovery/index.js';
import { dfmt } from '../../core/dates.js';

const SC_NAME = 'Training loggen';
const HTYPE = { kraft: 'Krafttraining', athletik: 'Functional Training', cardio: 'Laufen' };
const clone = o => JSON.parse(JSON.stringify(o));
const st = { plan: clone(DEF), sess: {}, selD: {}, edit: false, exM: {}, allEx: false, PR: new Map(), CH: null, editing: null };

export function reload(ctx) {
  const p = ctx.store.get('train.plan');
  st.plan = p && Array.isArray(p.days) && p.days.length === 7 ? p : clone(DEF);
  st.sess = ctx.store.get('train.sess', {}) || {};
  // Foreign or hand-edited backups may carry sessions without sets; never crash on them.
  for (const s of Object.values(st.sess)) if (s && (typeof s.sets !== 'object' || s.sets === null)) s.sets = {};
}

function save(ctx) {
  const ok = ctx.store.set('train.sess', st.sess) && ctx.store.set('train.plan', st.plan);
  if (!ok) ctx.setStatus('Speichern nicht möglich – privater Modus?');
}

export function todaySummary(ctx) {
  const id = todayId(ctx), d = getDay(st, id), { t, o } = totals(d, cur(st, id, ctx));
  return { name: d.name, type: d.type, done: o, total: t };
}

const dayOf = (route, ctx) => route.day || todayId(ctx);
function ensure(id, ctx) {
  const k = keyFor(st, id, ctx);
  if (!st.sess[k]) st.sess[k] = { date: dateFor(st, id, ctx), day: id, sets: {}, n: {}, warm: {} };
  const s = st.sess[k];
  s.sets = s.sets || {}; s.n = s.n || {}; s.warm = s.warm || {};
  return s;
}

/* Picking another date moves the shown session there; if that date already has one, show it instead. */
let statusT = null;
function setDate(id, nd, ctx) {
  const od = dateFor(st, id, ctx);
  if (nd === od) return;
  const ok = 's_' + od + '_' + id, nk = 's_' + nd + '_' + id, s = st.sess[ok];
  let msg = '';
  if (s && st.sess[nk]) msg = 'Am ' + dfmt(nd) + ' gibt es diese Einheit schon – sie wird angezeigt';
  else if (s) { delete st.sess[ok]; s.date = nd; st.sess[nk] = s; save(ctx); msg = 'Einheit auf ' + dfmt(nd) + ' verschoben'; }
  st.selD[id] = nd;
  ctx.rerender();
  if (msg) {
    ctx.setStatus(msg);
    clearTimeout(statusT);
    statusT = setTimeout(() => ctx.setStatus('Gespeichert auf diesem Gerät'), 4000);
  }
}

const mainWidth = () => (typeof document !== 'undefined' && document.getElementById('main') && document.getElementById('main').clientWidth) || 600;

export function render(route, ctx) {
  st.PR = computePRs(st.sess, st.plan);
  st.CH = null;
  if (route.view === 'hist') return histView(st, ctx);
  if (route.view === 'ex') return exDetail(st, route.ex, mainWidth());
  return dayView(st, dayOf(route, ctx), ctx);
}

export const header = route =>
  `<nav class="tabs"><a href="#training" class="${route.view === 'day' ? 'on' : ''}">Woche</a><a href="#training/verlauf" class="${route.view !== 'day' ? 'on' : ''}">Verlauf</a></nav>`;

export const mount = root => bindChart(root, st.CH);
export const onNavigate = () => { st.edit = false; };
export const redrawOnResize = route => route.view === 'ex';

/* rest timer */
let tEnd = 0, tInt = null, actx = null;
const $ = s => document.querySelector(s);
const beep = () => {
  try {
    if (!actx) return;
    [0, .25].forEach(o => { const os = actx.createOscillator(), g = actx.createGain(); os.frequency.value = 880; g.gain.value = .15; os.connect(g).connect(actx.destination); os.start(actx.currentTime + o); os.stop(actx.currentTime + o + .15); });
  } catch (e) { /* no audio */ }
  try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) { /* no vibration */ }
};
function tick() {
  const left = Math.round((tEnd - Date.now()) / 1000), bar = $('#bar');
  if (left <= 0) { $('#barT').innerHTML = '<small>Pause vorbei</small>Los!'; bar.classList.add('end'); beep(); clearInterval(tInt); tInt = setTimeout(stopT, 4000); return; }
  $('#barT').innerHTML = `<small>Pause</small>${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
}
function startT(sec) { if (!sec) return; clearInterval(tInt); clearTimeout(tInt); tEnd = Date.now() + sec * 1000; $('#bar').className = 'on'; tick(); tInt = setInterval(tick, 250); }
function stopT() { clearInterval(tInt); clearTimeout(tInt); $('#bar').className = ''; }

/* edit sheet */
function openSheet(dayId, bi, ei) {
  const d = getDay(st, dayId), b = d.blocks[bi], ex = ei >= 0 ? b.ex[ei] : E('x' + Date.now().toString(36), '', 'core', 3, 8, 12);
  st.editing = { dayId, bi, ei, id: ex.id };
  $('#fTitle').textContent = ei >= 0 ? 'Übung ändern' : 'Neue Übung in ' + b.label;
  $('#fName').value = ex.name; $('#fCat').value = ex.cat; $('#fUnit').value = ex.unit; $('#fSets').value = ex.sets; $('#fLoad').value = ex.load;
  $('#fMin').value = ex.min; $('#fMax').value = ex.max; $('#fPer').value = ex.per; $('#fRest').value = ex.rest || ''; $('#fEq').value = ex.eq; $('#fNote').value = ex.note;
  $('#fDel').style.display = ei >= 0 ? '' : 'none';
  $('#sheet').classList.add('on');
  $('#fName').focus();
}
const closeSheet = () => { $('#sheet').classList.remove('on'); st.editing = null; };

export function init(ctx) {
  reload(ctx);
  setTrainingSummary(() => todaySummary(ctx));
  $('#bPlus').addEventListener('click', () => { if ($('#bar').classList.contains('end')) { startT(15); return; } tEnd += 15000; tick(); });
  $('#bSkip').addEventListener('click', stopT);
  $('#fCat').innerHTML = Object.entries(CATS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  $('#fCancel').addEventListener('click', closeSheet);
  $('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet') closeSheet(); });
  $('#fDel').addEventListener('click', () => {
    const { dayId, bi, ei } = st.editing;
    getDay(st, dayId).blocks[bi].ex.splice(ei, 1);
    save(ctx); closeSheet(); ctx.rerender();
  });
  $('#form').addEventListener('submit', e => {
    e.preventDefault();
    const { dayId, bi, ei, id } = st.editing, b = getDay(st, dayId).blocks[bi];
    const n = v => Math.max(0, parseInt(v, 10) || 0), mn = n($('#fMin').value), mx = Math.max(mn, n($('#fMax').value));
    const ex = { id, name: $('#fName').value.trim() || 'Übung', cat: $('#fCat').value, sets: Math.min(10, Math.max(1, n($('#fSets').value) || 1)), min: mn, max: mx, unit: $('#fUnit').value, load: $('#fLoad').value, per: $('#fPer').value, eq: $('#fEq').value.trim(), note: $('#fNote').value.trim(), rest: n($('#fRest').value) || null };
    if (ei >= 0) b.ex[ei] = ex; else b.ex.push(ex);
    save(ctx); closeSheet(); ctx.rerender();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && st.editing) closeSheet(); });
}

export function onInput(e, route, ctx) {
  const t = e.target;
  if (route.view !== 'day') return;
  const id = dayOf(route, ctx);
  // A screen left open overnight can show yesterday's exercises; don't write them into today.
  if (t.dataset.f && !findEx(getDay(st, id), t.dataset.e).ex) { ctx.rerender(); return; }
  if (t.dataset.f) {
    const s = ensure(id, ctx), a = s.sets[t.dataset.e] || (s.sets[t.dataset.e] = []), i = +t.dataset.i;
    a[i] = Object.assign({}, a[i] || {}, { [t.dataset.f]: t.value.replace(',', '.') });
    save(ctx);
  }
}

export function onChange(e, route, ctx) {
  const t = e.target;
  if (route.view !== 'day') return;
  const id = dayOf(route, ctx);
  if (t.dataset.a === 'warm') { const s = ensure(id, ctx); s.warm[t.dataset.i] = t.checked; save(ctx); ctx.rerender(); }
  if (t.dataset.a === 'date') setDate(id, t.value, ctx);
}

const findEx = (d, id) => { for (const b of d.blocks) for (const ex of b.ex) if (ex.id === id) return { ex, b }; return {}; };

export function onClick(e, route, ctx) {
  const t = e.target.closest('[data-a]');
  if (!t) return;
  const a = t.dataset.a, id = route.view === 'day' ? dayOf(route, ctx) : null, d = id && getDay(st, id);
  if (a === 'chk' && !findEx(d, t.dataset.e).ex) { ctx.rerender(); return; }
  if (a === 'chk') {
    try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); } catch (er) { /* no audio */ }
    const s = ensure(id, ctx), { ex } = findEx(d, t.dataset.e), arr = s.sets[ex.id] || (s.sets[ex.id] = []), i = +t.dataset.i, x = Object.assign({}, arr[i] || {});
    x.ok = !x.ok;
    if (x.ok) {
      x.t = Date.now();
      const lx = (lastFor(st.sess, ex.id, s.date) || [])[i] || {};
      if (!x.v && ex.unit !== 'check') x.v = String(lx.v || ex.max);
      if (!x.w && ex.load && lx.w) x.w = lx.w;
      s.n[ex.id] = ex.name;
      startT(ex.rest || d.blocks[t.dataset.b].rest);
    }
    arr[i] = x;
    save(ctx);
    ctx.rerender();
    if (x.ok) {
      st.PR = computePRs(st.sess, st.plan);
      const f = prOf(st.PR, s, ex.id)[i];
      // No record hunting in the deload week: no toast, no buzz.
      if (f && !recoveryFor(ctx, s.date).cycle.deload) {
        ctx.toast(f === 'w' ? 'Neues Höchstgewicht' : 'Neuer Rekord', ex.name + ' · ' + prText(ex, x));
        try { if (navigator.vibrate) navigator.vibrate([40, 60, 40, 60, 120]); } catch (er) { /* no vibration */ }
      }
    }
  }
  if (a === 'back') { if (ctx.prevHash !== null) history.back(); else ctx.go('training/verlauf'); }
  if (a === 'metric') { st.exM[route.ex] = t.dataset.m; ctx.rerender(); }
  if (a === 'exall') { st.allEx = !st.allEx; ctx.rerender(); }
  if (a === 'health' && dateFor(st, id, ctx) === clock(ctx).td) {
    const s = ensure(id, ctx), ts = Object.values(s.sets).flat().filter(x => x && x.ok && x.t).map(x => x.t), now = Date.now();
    const warm = d.warm && d.warm.length ? (d.type === 'athletik' ? 10 : d.warm.length > 5 ? 8 : 5) : 0;
    const start = new Date((ts.length ? Math.min(...ts) : now - 3600000) - warm * 60000);
    const mins = Math.max(5, Math.round((now - start) / 60000));
    const p = n => String(n).padStart(2, '0'), stt = `${start.getFullYear()}-${p(start.getMonth() + 1)}-${p(start.getDate())} ${p(start.getHours())}:${p(start.getMinutes())}`;
    const body = JSON.stringify({ typ: HTYPE[d.type] || 'Krafttraining', start: stt, min: mins, name: d.name });
    s.health = `${mins} min · ${stt.slice(11)} Uhr`;
    save(ctx);
    ctx.rerender();
    location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(SC_NAME)}&input=text&text=${encodeURIComponent(body)}`;
  }
  if (a === 'edit') { st.edit = !st.edit; ctx.rerender(); }
  if (a === 'exedit') openSheet(id, +t.dataset.b, +t.dataset.x);
  if (a === 'add') openSheet(id, +t.dataset.b, -1);
  if (a === 'reset') {
    if (t.dataset.sure) { st.plan = clone(DEF); st.edit = false; save(ctx); ctx.rerender(); }
    else { t.dataset.sure = '1'; t.textContent = 'Sicher? Nochmal tippen zum Zurücksetzen'; }
  }
}
