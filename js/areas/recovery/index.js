// Recovery area: morning check, mobility, breathing, recovery blocks,
// week check and deload cycle. All state lives in the store (rec.*).
import { ds, DAYS, dayIdx, addDays } from '../../core/dates.js';
import { BLOCKS, CYCLE_ANCHOR, MOBILITY, RIR } from './data.js';
import {
  checkSum, ampel, plannedBed, cycleInfo, mobilityFor, deloadTriggers, sundayOf,
  timerState, clockStart, clockElapsed, clockPause, clockResume,
} from './logic.js';
import { todayView, mobilityView, breathView, mobilityFields, breathFields, weekView, cycleView } from './view.js';

const SCORES = ['schlaf', 'energie', 'muskeln'];
const WEEKLY = ['schlaf', 'energie', 'gelenke', 'ziel'];
const isNum = v => typeof v === 'number' && Number.isFinite(v);

const day = ctx => ds(ctx.now());
const map = (ctx, k) => ctx.store.get(k, {}) || {};
function put(ctx, k, v) {
  if (!ctx.store.set(k, v)) ctx.setStatus('Speichern nicht möglich – privater Modus?');
}
export const anchor = ctx => (ctx.store.get('rec.cycle') || {}).anchor || CYCLE_ANCHOR;
const inputs = ctx => ({ morning: map(ctx, 'rec.morning'), complaints: ctx.store.get('rec.complaints', []) || [], flags: map(ctx, 'rec.flags') });

// Today's morning entry, with bed and wake times taken from the Week Routine
// until the person changes them.
const entryFor = (ctx, d) => ({ ...plannedBed(d), puls: null, ...map(ctx, 'rec.morning')[d] });
function setMorning(ctx, patch) {
  const d = day(ctx), m = map(ctx, 'rec.morning');
  m[d] = { ...entryFor(ctx, d), ...patch };
  put(ctx, 'rec.morning', m);
}
function setDone(ctx, key, d, on) {
  const m = map(ctx, key);
  if (on) m[d] = { done: true }; else delete m[d];
  put(ctx, key, m);
}

// The week check always belongs to the Sunday that ends the current week.
function setWeekly(ctx, patch) {
  const sun = sundayOf(day(ctx)), m = map(ctx, 'rec.weekly');
  m[sun] = { gut: '', next: '', ...m[sun], ...patch };
  put(ctx, 'rec.weekly', m);
}

// Screen-only state: deload confirmation and the complaint being typed.
let confirmDeload = false, cerr = '';
let draft = { place: '', level: null, note: '' };

function weekVM(ctx) {
  const d = day(ctx), sunday = sundayOf(d), weekly = map(ctx, 'rec.weekly'), morning = map(ctx, 'rec.morning');
  const list = [];
  for (let i = 0; i < 14; i++) {
    const k = addDays(d, -i), e = morning[k];
    if (e) { const sum = checkSum(e); list.push({ day: k, sum, amp: ampel(sum), bed: e.bed, wake: e.wake, puls: e.puls }); }
  }
  const past = Object.keys(weekly).filter(k => k < sunday).sort().reverse().map(k => ({ sunday: k, w: weekly[k] || {} }));
  return { sunday, w: weekly[sunday], morning: list, past };
}

function cycleVM(ctx) {
  const d = day(ctx), c = cycleInfo(d, anchor(ctx)), first = addDays(c.start, -(c.week - 1) * 7);
  const all = (ctx.store.get('rec.complaints', []) || []).filter(x => x && x.id);
  return {
    c, rows: RIR.map(r => ({ ...r, start: addDays(first, (r.week - 1) * 7) })), confirm: confirmDeload,
    trig: deloadTriggers(inputs(ctx), d), open: all.filter(x => !x.resolved), done: all.filter(x => x.resolved),
    draft, cerr, today: d,
  };
}

export const weeklyDone = (ctx, d) => {
  const w = map(ctx, 'rec.weekly')[sundayOf(d)];
  return !!w && WEEKLY.every(k => isNum(w[k]));
};

// Recovery state for any date; Training uses it for the day it shows.
export function recoveryFor(ctx, d) {
  const sum = checkSum(map(ctx, 'rec.morning')[d]), m = mobilityFor(d);
  return {
    ampel: ampel(sum), sum,
    mobility: { routine: m.routine, name: m.name, minutes: m.minutes, done: !!map(ctx, 'rec.mobility')[d] },
    cycle: cycleInfo(d, anchor(ctx)),
    weeklyDone: weeklyDone(ctx, d),
  };
}

export function summary(ctx) {
  const d = day(ctx), r = recoveryFor(ctx, d);
  return { ampel: r.ampel, sum: r.sum, mobility: r.mobility, cycle: r.cycle, suggest: deloadTriggers(inputs(ctx), d).suggest };
}

/* Guided timers. One runner at a time; its time always comes from Date.now(),
   so a timer that was in the background shows the right step on return. */
let run = null, actx = null;
const beep = () => {
  try {
    if (!actx) return;
    [0, .25].forEach(o => { const os = actx.createOscillator(), g = actx.createGain(); os.frequency.value = 880; g.gain.value = .15; os.connect(g).connect(actx.destination); os.start(actx.currentTime + o); os.stop(actx.currentTime + o + .15); });
  } catch (e) { /* no audio */ }
  try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) { /* no vibration */ }
};
function lockScreen() {
  try {
    if (!run || run.lock || run.locking || typeof navigator === 'undefined' || !navigator.wakeLock) return;
    const r = run;
    r.locking = true;
    navigator.wakeLock.request('screen').then(l => {
      r.locking = false;
      if (run !== r || r.status !== 'running') { l.release().catch(() => {}); return; }
      r.lock = l;
      l.addEventListener('release', () => { if (r.lock === l) r.lock = null; });
    }).catch(() => { r.locking = false; });
  } catch (e) { /* no wake lock */ }
}
function unlockScreen() {
  if (run && run.lock) { run.lock.release().catch(() => {}); run.lock = null; }
}
function stopRun() {
  if (!run) return;
  clearInterval(run.int);
  unlockScreen();
  run = null;
}
const mine = kind => (run && run.kind === kind ? run : null);
const elapsed = r => clockElapsed(r.clock, Date.now());

function paint(f) {
  if (typeof document === 'undefined') return;
  for (const [id, txt] of Object.entries(f.text)) { const el = document.getElementById(id); if (el && el.textContent !== txt) el.textContent = txt; }
  const bar = document.getElementById('rtBar'), orb = document.getElementById('rtOrb');
  if (bar && f.bar != null) bar.style.width = f.bar + '%';
  if (orb && f.orb != null) orb.classList.toggle('big', f.orb);
}

function finish(ctx) {
  if (run.kind === 'mobility') setDone(ctx, 'rec.mobility', run.day, true);
  clearInterval(run.int);
  run.int = null;
  unlockScreen();
  run.status = 'done';
  beep();
  ctx.rerender();
}

function tick(ctx) {
  if (!run || run.status !== 'running') return;
  const t = elapsed(run);
  if (run.kind === 'mobility') {
    const s = timerState(run.steps, run.end, t);
    if (s.done) { finish(ctx); return; }
    if (s.index !== run.last) { if (run.last >= 0) beep(); run.last = s.index; }
    paint(mobilityFields(run.steps, s, run.end));
  } else {
    if (t >= run.dur) { finish(ctx); return; }
    paint(breathFields(t, run.dur, false));
  }
}

function startRun(route, ctx) {
  stopRun();
  if (route.view === 'mobility') {
    const d = day(ctx), m = mobilityFor(d);
    run = { kind: 'mobility', day: d, routine: m.routine, steps: MOBILITY[m.routine].steps, end: m.end, last: -1 };
  } else if (route.view === 'breath') {
    run = { kind: 'breath', min: route.min, dur: route.min * 60 };
  } else return;
  Object.assign(run, { clock: clockStart(Date.now()), status: 'running', int: null, lock: null });
}

function mobilityVM(ctx) {
  const r = mine('mobility'), d = r ? r.day : day(ctx), m = mobilityFor(d), steps = MOBILITY[m.routine].steps;
  const status = r ? r.status : 'idle';
  return { ...m, steps, status, state: timerState(steps, m.end, r ? Math.min(elapsed(r), m.end - 0.001) : 0), doneToday: !!map(ctx, 'rec.mobility')[d] };
}
function breathVM(route) {
  const r = run && run.kind === 'breath' && run.min === route.min ? run : null, dur = route.min * 60;
  return { min: route.min, dur, status: r ? r.status : 'idle', t: r ? Math.min(elapsed(r), dur) : 0 };
}

export function reload() { /* state is read from the store on every render */ }

export function header(route) {
  const v = route.view, tab = (h, l, on) => `<a href="${h}"${on ? ' class="on"' : ''}>${l}</a>`;
  return `<nav class="tabs">${tab('#recovery', 'Tag', !['week', 'cycle'].includes(v))}${tab('#recovery/woche', 'Woche', v === 'week')}${tab('#recovery/zyklus', 'Zyklus', v === 'cycle')}</nav>`;
}

export function render(route, ctx) {
  if (route.view === 'mobility') return mobilityView(mobilityVM(ctx));
  if (route.view === 'breath') return breathView(breathVM(route));
  if (route.view === 'week') return weekView(weekVM(ctx));
  if (route.view === 'cycle') return cycleView(cycleVM(ctx));
  const d = day(ctx), s = summary(ctx), entry = entryFor(ctx, d), wd = DAYS[dayIdx(new Date(d + 'T12:00:00'))];
  return todayView({
    day: d, entry, planned: plannedBed(d), sum: s.sum, amp: s.ampel,
    mob: { ...mobilityFor(d), done: s.mobility.done }, sat: wd === 'sa',
    blocks: BLOCKS[wd] || null, blockDone: map(ctx, 'rec.blocks')[d] || {}, weeklyDone: weeklyDone(ctx, d),
    cycle: s.cycle, trig: deloadTriggers(inputs(ctx), d),
  });
}

// After every render: keep a running timer ticking and the screen awake
// (the browser drops the wake lock whenever the app goes to the background).
export function mount(root, route, ctx) {
  if (!run || run.status !== 'running' || route.view !== run.kind) return;
  if (!run.int) run.int = setInterval(() => tick(ctx), 250);
  lockScreen();
  tick(ctx);
}

// A timer belongs to its view: leaving the view ends it without marking it done.
export function onNavigate(next) {
  confirmDeload = false;
  cerr = '';
  if (run && !(next.area === 'recovery' && next.view === run.kind && (run.kind !== 'breath' || next.min === run.min))) stopRun();
}

export function onClick(e, route, ctx) {
  const t = e.target.closest('[data-a]');
  if (!t) return;
  const a = t.dataset.a, n = +t.dataset.n;
  if (a === 'mc' && SCORES.includes(t.dataset.k) && n >= 1 && n <= 5) { setMorning(ctx, { [t.dataset.k]: n }); ctx.rerender(); }
  if (a === 'tstart') {
    try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); } catch (er) { /* no audio */ }
    startRun(route, ctx);
    ctx.rerender();
  }
  if (a === 'tpause' && run) {
    if (run.status === 'running') {
      run.clock = clockPause(run.clock, Date.now());
      run.status = 'paused';
      clearInterval(run.int);
      run.int = null;
      unlockScreen();
    } else if (run.status === 'paused') {
      run.clock = clockResume(run.clock, Date.now());
      run.status = 'running';
    }
    ctx.rerender();
  }
  if (a === 'tstop') { stopRun(); ctx.go('#recovery'); }
  if (a === 'wk' && WEEKLY.includes(t.dataset.k) && n >= 1 && n <= 5) { setWeekly(ctx, { [t.dataset.k]: n }); ctx.rerender(); }
  if (a === 'deload') {
    // Two taps, like "Plan zurücksetzen": the first only asks.
    if (!confirmDeload) { confirmDeload = true; ctx.rerender(); return; }
    confirmDeload = false;
    put(ctx, 'rec.cycle', { anchor: addDays(cycleInfo(day(ctx), anchor(ctx)).start, 7) });
    ctx.rerender();
  }
  if (a === 'clv' && n >= 1 && n <= 5) { draft.level = n; cerr = ''; ctx.rerender(); }
  if (a === 'cadd') {
    const place = draft.place.trim();
    cerr = !place ? 'Bitte eine Körperstelle eintragen.' : !draft.level ? 'Bitte die Stärke wählen.' : '';
    if (!cerr) {
      const list = ctx.store.get('rec.complaints', []) || [];
      list.push({ id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), place, level: draft.level, start: day(ctx), note: draft.note.trim(), resolved: null });
      put(ctx, 'rec.complaints', list);
      draft = { place: '', level: null, note: '' };
    }
    ctx.rerender();
  }
  if (a === 'cres' && t.dataset.id) {
    const list = (ctx.store.get('rec.complaints', []) || []).map(c => (c && c.id === t.dataset.id ? { ...c, resolved: day(ctx) } : c));
    put(ctx, 'rec.complaints', list);
    ctx.rerender();
  }
}

// Typing: saved as you go, without redrawing (keeps the keyboard open).
export function onInput(e, route, ctx) {
  const t = e.target, a = t.dataset && t.dataset.a, k = t.dataset && t.dataset.k;
  if (a === 'wkt' && (k === 'gut' || k === 'next')) setWeekly(ctx, { [k]: t.value });
  if (a === 'cf' && (k === 'place' || k === 'note')) draft[k] = t.value;
}

export function onChange(e, route, ctx) {
  const t = e.target, a = t.dataset && t.dataset.a;
  if (a === 'bed' || a === 'wake') {
    if (/^\d\d:\d\d$/.test(t.value)) setMorning(ctx, { [a]: t.value });
    ctx.rerender();
  }
  if (a === 'puls') {
    const n = parseInt(t.value, 10);
    setMorning(ctx, { puls: n >= 25 && n <= 200 ? n : null });
    ctx.rerender();
  }
  if (a === 'mobdone') { setDone(ctx, 'rec.mobility', day(ctx), t.checked); ctx.rerender(); }
  if (a === 'flag' && ['leistung', 'stimmung'].includes(t.dataset.k)) {
    const w = cycleInfo(day(ctx)).start, m = map(ctx, 'rec.flags'), f = { ...m[w] };
    if (t.checked) f[t.dataset.k] = true; else delete f[t.dataset.k];
    if (Object.keys(f).length) m[w] = f; else delete m[w];
    put(ctx, 'rec.flags', m);
    ctx.rerender();
  }
  if (a === 'blk') {
    const d = day(ctx), m = map(ctx, 'rec.blocks'), b = { ...m[d] };
    if (t.checked) b[t.dataset.i] = true; else delete b[t.dataset.i];
    m[d] = b;
    put(ctx, 'rec.blocks', m);
    ctx.rerender();
  }
}
