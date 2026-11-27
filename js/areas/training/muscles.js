// The muscle figure: an own vector body, front and back, whose muscle groups light up in the
// accent colour by how many of this week's planned sets for them are done.
import { addDays } from '../../core/dates.js';
import { esc } from '../../core/html.js';

export const MUSCLES = [['shoulders', 'Schultern'], ['chest', 'Brust'], ['biceps', 'Bizeps'], ['triceps', 'Trizeps'], ['forearms', 'Unterarme'], ['abs', 'Bauch'],
  ['obliques', 'Seitliche Bauchmuskeln'], ['traps', 'Nacken'], ['lats', 'Latissimus'], ['lowerback', 'Unterer Rücken'], ['glutes', 'Gesäß'], ['quads', 'Quadrizeps'],
  ['hamstrings', 'Beinbeuger'], ['calves', 'Waden'], ['tibialis', 'Schienbein']];
// Exercise categories of the plan → the muscle groups they train.
export const CAT_MUSCLES = {
  push: ['chest', 'triceps', 'shoulders'], pull: ['lats', 'biceps', 'traps', 'forearms'], sch: ['shoulders', 'traps'], quad: ['quads', 'glutes'],
  hk: ['hamstrings', 'glutes', 'lowerback'], ws: ['calves', 'tibialis'], core: ['abs', 'obliques'], ath: ['quads', 'hamstrings', 'calves'], prep: [],
};
const NAME = Object.fromEntries(MUSCLES);

// Done sets against planned sets per group, for the week starting on `mon` (YYYY-MM-DD).
export function weekLoad(plan, sess, mon) {
  const sun = addDays(mon, 6), exs = new Map();
  const groups = Object.fromEntries(MUSCLES.map(([k]) => [k, { done: 0, plan: 0, load: 0 }]));
  const total = { done: 0, plan: 0 };
  for (const day of (plan && plan.days) || []) for (const b of day.blocks || []) for (const ex of b.ex || []) {
    if (!exs.has(ex.id)) exs.set(ex.id, ex);
    const n = +ex.sets || 0;
    total.plan += n;
    for (const m of CAT_MUSCLES[ex.cat] || []) groups[m].plan += n;
  }
  for (const s of Object.values(sess || {})) {
    if (!s || !s.date || s.date < mon || s.date > sun || !s.sets) continue;
    for (const [id, arr] of Object.entries(s.sets)) {
      const ex = exs.get(id);
      if (!ex || !Array.isArray(arr)) continue;
      const n = arr.slice(0, +ex.sets || arr.length).filter(x => x && x.ok).length;
      total.done += n;
      for (const m of CAT_MUSCLES[ex.cat] || []) groups[m].done += n;
    }
  }
  for (const g of Object.values(groups)) g.load = g.plan ? Math.min(1, g.done / g.plan) : g.done ? 1 : 0;
  return { groups, total };
}

// Right half of the body (x ≥ 100); the left half is the same, mirrored.
const SIL = 'M100 56 C104 56 107 60 107 66 L108 70 C114 72 122 72 128 74 C138 77 144 84 146 96 L149 124 C150 132 151 140 151 146 L153 170 L152 196 C153 204 154 210 150 216 C146 218 143 214 143 208 L141 196 L138 172 L135 146 C132 136 129 122 127 108 C125 118 123 136 120 156 C122 170 125 182 126 196 C130 214 130 238 126 260 C125 268 125 276 124 284 C127 300 127 320 123 342 L121 368 C123 376 126 382 124 388 L106 388 C105 380 106 374 106 368 L104 340 C102 320 103 300 104 286 L103 262 C102 246 101 228 100 210 Z';
const FRONT = {
  shoulders: 'M124 74 C138 76 145 84 146 98 C140 104 132 104 127 100 C125 92 124 84 124 74 Z',
  chest: 'M101 78 L124 76 C129 88 128 100 123 108 C114 114 106 114 101 111 Z',
  biceps: 'M128 104 C136 103 143 108 146 118 C148 128 146 138 140 142 C134 136 130 122 128 104 Z',
  forearms: 'M138 146 C146 148 151 156 152 168 C152 182 150 192 146 196 C142 184 139 166 138 146 Z',
  abs: 'M101 116 L113 115 L113 132 L101 133 Z M101 136 L113 135 L113 151 L101 152 Z M101 155 L113 154 L113 172 C109 176 105 178 101 178 Z',
  obliques: 'M115 116 C121 122 123 134 121 150 C119 162 117 170 115 174 Z',
  quads: 'M102 208 C110 201 119 197 126 197 C129 216 129 240 124 262 C122 272 118 280 112 282 C106 278 104 268 103 252 C102 236 101 222 102 208 Z',
  tibialis: 'M107 292 C113 290 119 292 122 300 C122 322 119 344 114 364 C110 358 108 344 107 326 Z',
};
const BACK = {
  traps: 'M100 58 C108 62 118 68 126 74 C120 84 112 98 104 112 L100 114 Z',
  shoulders: FRONT.shoulders,
  lats: 'M104 114 C112 104 120 100 127 106 C127 124 124 142 119 158 C112 160 106 158 102 152 C102 138 102 124 104 114 Z',
  triceps: FRONT.biceps,
  forearms: FRONT.forearms,
  lowerback: 'M101 152 C106 158 112 160 118 158 C119 168 119 178 117 186 L101 186 Z',
  glutes: 'M101 188 L118 188 C124 190 127 198 126 208 C125 218 117 222 109 220 C104 218 101 212 101 206 Z',
  hamstrings: 'M103 224 C110 221 119 220 126 223 C128 242 126 262 121 278 C116 284 110 284 106 280 C103 264 102 244 103 224 Z',
  calves: 'M105 290 C112 286 120 288 124 298 C126 314 123 332 117 346 C111 346 107 338 106 326 C104 314 104 300 105 290 Z',
};

const pct = g => Math.round(g.load * 100);
const loadVar = g => (g.load ? g.load.toFixed(2) : '0');
function face(w, side, uid) {
  const parts = side === 'front' ? FRONT : BACK;
  const muscles = Object.entries(parts).map(([k, d]) => { const g = w.groups[k]; return `<path class="mg${g.load ? ' on' : ''}" data-m="${k}" style="--l:${loadVar(g)}" d="${d}"><title>${esc(NAME[k])}: ${g.done} von ${g.plan} Sätzen</title></path>`; }).join('');
  const half = `<path class="sil" d="${SIL}"/><g filter="url(#mglow-${uid})">${muscles}</g>`;
  return `<svg class="mface ${side}" viewBox="0 0 200 400" aria-hidden="true"><defs><filter id="mglow-${uid}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
  <ellipse class="sil" cx="100" cy="34" rx="17" ry="21"/>${half}<g transform="matrix(-1 0 0 1 200 0)">${half}</g></svg>`;
}

let uid = 0;
export function muscleFigure(w, { mini = false } = {}) {
  const trained = MUSCLES.filter(([k]) => w.groups[k].plan).map(([k, l]) => `${l} ${w.groups[k].done}/${w.groups[k].plan}`).join(', ');
  const id = ++uid;
  const label = `Muskeln diese Woche: ${trained || 'kein Plan'}`;
  if (mini) return `<div class="mfig mini" role="img" aria-label="${esc(label)}">${face(w, 'front', `m${id}f`)}${face(w, 'back', `m${id}b`)}</div>`;
  return `<div class="mfig" role="img" aria-label="${esc(label)}"><div class="mstage">${face(w, 'front', `m${id}f`)}${face(w, 'back', `m${id}b`)}</div>
  <div class="mctl"><button type="button" class="btn sm" data-a="mflip" aria-pressed="false">Drehen</button><span class="mside">Vorderseite</span></div></div>`;
}

// The groups of the plan, most trained first, as small bars.
export function muscleList(w) {
  const rows = MUSCLES.filter(([k]) => w.groups[k].plan).sort((a, b) => w.groups[b[0]].load - w.groups[a[0]].load);
  return `<ul class="mlist">${rows.map(([k, l]) => `<li><span>${esc(l)}</span><i style="--l:${loadVar(w.groups[k])}"></i><b>${pct(w.groups[k])} %</b></li>`).join('')}</ul>`;
}

// Turning: the button flips the figure; dragging sideways turns it and it settles on a side.
export function bindFigures(root) {
  if (!root || !root.querySelectorAll) return;
  for (const fig of root.querySelectorAll('.mfig:not(.mini)')) {
    const stage = fig.querySelector('.mstage'), side = fig.querySelector('.mside'), btn = fig.querySelector('[data-a="mflip"]');
    if (!stage) continue;
    const show = back => { fig.classList.toggle('flip', back); stage.style.removeProperty('--ry'); if (side) side.textContent = back ? 'Rückseite' : 'Vorderseite'; if (btn) btn.setAttribute('aria-pressed', String(back)); };
    if (btn) btn.addEventListener('click', e => { e.stopPropagation(); show(!fig.classList.contains('flip')); });
    let x0 = null, base = 0;
    stage.addEventListener('pointerdown', e => { x0 = e.clientX; base = fig.classList.contains('flip') ? 180 : 0; stage.classList.add('drag'); stage.setPointerCapture && stage.setPointerCapture(e.pointerId); });
    stage.addEventListener('pointermove', e => { if (x0 === null) return; stage.style.setProperty('--ry', `${base + (e.clientX - x0) * 0.9}deg`); });
    const end = e => { if (x0 === null) return; const a = (((base + (e.clientX - x0) * 0.9) % 360) + 360) % 360; x0 = null; stage.classList.remove('drag'); show(a > 90 && a < 270); };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
  }
}
