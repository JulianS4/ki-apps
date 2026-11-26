// Guided timers shared by the areas (Recovery mobility and breathing, the
// Chinese Grandpa routine). One run at a time; its time always comes from
// Date.now(), so a timer that was in the background is right on return.
import { esc } from './html.js';

// Where a step routine stands `t` seconds after its start.
export function timerState(steps, end, t) {
  if (t >= end) return { index: steps.length - 1, step: steps[steps.length - 1], left: 0, total: 0, done: true };
  let index = 0;
  while (index + 1 < steps.length && steps[index + 1].at <= t) index++;
  const until = index + 1 < steps.length ? steps[index + 1].at : end;
  return { index, step: steps[index], left: until - t, total: end - t, done: false };
}

// Wall-clock based timer clock: pausing freezes it, background time counts.
export const clockStart = now => ({ startedAt: now, pausedAt: null, pausedTotal: 0 });
export const clockElapsed = (c, now) => ((c.pausedAt ?? now) - c.startedAt - c.pausedTotal) / 1000;
export const clockPause = (c, now) => (c.pausedAt == null ? { ...c, pausedAt: now } : c);
export const clockResume = (c, now) => (c.pausedAt == null ? c : { ...c, pausedTotal: c.pausedTotal + now - c.pausedAt, pausedAt: null });

export const mss = sec => { const s = Math.max(0, Math.ceil(sec)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

/* ---------- runner ---------- */
let run = null, actx = null;

const beep = () => {
  try {
    if (!actx) return;
    [0, .25].forEach(o => { const os = actx.createOscillator(), g = actx.createGain(); os.frequency.value = 880; g.gain.value = .15; os.connect(g).connect(actx.destination); os.start(actx.currentTime + o); os.stop(actx.currentTime + o + .15); });
  } catch (e) { /* no audio */ }
  try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) { /* no vibration */ }
};

// iOS only plays audio created during a tap; call this from the start tap.
export function unlockAudio() {
  try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); } catch (e) { /* no audio */ }
}

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

const elapsed = r => clockElapsed(r.clock, Date.now());

// def: { kind, key, end, steps?, fields?(t), onDone?(ctx) }. Step timers get
// stepFields for free and beep at every step change.
export function startRun(def) {
  stopRun();
  run = { ...def, last: -1, clock: clockStart(Date.now()), status: 'running', int: null, lock: null, ctx: null };
}

export function toggleRun() {
  if (!run) return;
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
}

export function stopRun() {
  if (!run) return;
  clearInterval(run.int);
  unlockScreen();
  run = null;
}

export const activeRun = () => (run ? { kind: run.kind, key: run.key } : null);

export function runOf(kind, key) {
  if (!run || run.kind !== kind || (key !== undefined && run.key !== key)) return null;
  return { status: run.status, t: Math.min(elapsed(run), run.end), def: run };
}

function paint(f) {
  if (typeof document === 'undefined' || !f) return;
  for (const [id, txt] of Object.entries(f.text)) { const el = document.getElementById(id); if (el && el.textContent !== txt) el.textContent = txt; }
  const bar = document.getElementById('rtBar'), orb = document.getElementById('rtOrb');
  if (bar && f.bar != null) bar.style.width = f.bar + '%';
  if (orb && f.orb != null) orb.classList.toggle('big', f.orb);
}

function finish() {
  const r = run;
  clearInterval(r.int);
  r.int = null;
  unlockScreen();
  r.status = 'done';
  if (r.onDone) r.onDone(r.ctx);
  beep();
  if (r.ctx) r.ctx.rerender();
}

function tick() {
  if (!run || run.status !== 'running') return;
  const r = run, t = elapsed(r);
  if (t >= r.end) { finish(); return; }
  if (r.steps) {
    const s = timerState(r.steps, r.end, t);
    if (s.index !== r.last) { if (r.last >= 0) beep(); r.last = s.index; }
    paint(r.fields ? r.fields(t) : stepFields(r.steps, s, r.end));
  } else if (r.fields) paint(r.fields(t));
}

// After every render of the timer's view: keep it ticking and the screen on
// (the browser drops the wake lock whenever the app goes to the background).
export function mountRun(kind, ctx) {
  if (!run || run.status !== 'running' || run.kind !== kind) return;
  run.ctx = ctx;
  if (!run.int) run.int = setInterval(tick, 250);
  lockScreen();
  tick();
}

/* ---------- keep the screen on without a timer (phone-holder mode) ---------- */
let hold = null, holding = false;
export function keepAwake(on) {
  holding = on;
  if (!on) { if (hold) { hold.release().catch(() => {}); hold = null; } return; }
  try {
    if (hold || typeof navigator === 'undefined' || !navigator.wakeLock) return;
    navigator.wakeLock.request('screen').then(l => {
      if (!holding || hold) { l.release().catch(() => {}); return; }
      hold = l;
      l.addEventListener('release', () => { if (hold === l) hold = null; });
    }).catch(() => {});
  } catch (e) { /* no wake lock */ }
}

/* ---------- views ---------- */
// The *Fields helpers feed both the first render and the in-place updates of
// the running timer, so both always show the same.
export function stepFields(steps, s, end) {
  const next = steps[s.index + 1];
  return {
    text: {
      rtStep: `Übung ${s.index + 1} von ${steps.length}`, rtTitle: s.step.title, rtHint: s.step.hint || ' ',
      rtLeft: mss(s.left), rtNext: next ? 'Als Nächstes: ' + next.title : 'Letzte Übung', rtTotal: mss(s.total),
    },
    bar: Math.min(100, (1 - s.total / end) * 100),
  };
}

export const timerButtons = status => status === 'idle'
  ? '<button class="btn pri" data-a="tstart" type="button">Start</button>'
  : `<button class="btn pri" data-a="tpause" type="button">${status === 'paused' ? 'Weiter' : 'Pause'}</button><button class="btn" data-a="tstop" type="button">Beenden</button>`;

export const doneBox = (msg, area, back) => `<div class="timer"><p class="k">${esc(area)}</p><h1>${msg}</h1><div class="tools"><a class="btn pri" href="${esc(back)}">‹ ${esc(area)}</a></div></div>`;

// v: { label, steps, end, state, status, area, back, doneTitle, doneNote, doneToday? }
export function stepTimerView(v) {
  if (v.status === 'done') return doneBox(v.doneTitle, v.area, v.back) + (v.doneNote ? `<p class="note" style="text-align:center">${esc(v.doneNote)}</p>` : '');
  const f = stepFields(v.steps, v.state, v.end), x = f.text;
  return `<div class="timer"><p class="k">${esc(v.label)} · <span id="rtStep">${x.rtStep}</span></p>
  <h1 id="rtTitle">${esc(x.rtTitle)}</h1><p class="hint" id="rtHint">${esc(x.rtHint)}</p>
  <div class="big" id="rtLeft" aria-live="off">${x.rtLeft}</div><p class="note" id="rtNext">${esc(x.rtNext)}</p>
  <div class="prog" aria-hidden="true"><i id="rtBar" style="width:${f.bar}%"></i></div>
  <p class="note"><span id="rtTotal">${x.rtTotal}</span> übrig von ${mss(v.end)}${v.doneToday && v.status === 'idle' ? ' · heute schon erledigt ✓' : ''}</p>
  <div class="tools">${timerButtons(v.status)}</div></div>`;
}
