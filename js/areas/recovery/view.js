// Recovery views as HTML strings. Pure: everything comes in through `v`.
import { esc } from '../../core/html.js';
import { dfmt, dshort, addDays } from '../../core/dates.js';
import { SIGH, MOBILITY, DELOAD_RULES } from './data.js';
import { hoursInBed, boxPhase, daysBetween } from './logic.js';

const SCALES = [['schlaf', 'Schlaf'], ['energie', 'Energie'], ['muskeln', 'Muskeln & Gelenke']];
export const dec = n => String(Math.round(n * 100) / 100).replace('.', ',');

export const scale = (a, k, val, label) => `<div class="scale" role="group" aria-label="${esc(label)}">${[1, 2, 3, 4, 5].map(n =>
  `<button type="button" class="${val === n ? 'on' : ''}" data-a="${a}" data-k="${k}" data-n="${n}" aria-pressed="${val === n}">${n}</button>`).join('')}</div>`;

export const ampCard = (amp, sum) => `<div class="amp ${amp.key}" role="status"><p class="k"><i class="dot" aria-hidden="true"></i>${amp.label} · ${sum} von 15</p><b>${esc(amp.advice)}</b></div>`;

function morning(v) {
  const e = v.entry, own = e.bed !== v.planned.bed || e.wake !== v.planned.wake;
  return `<section class="blk"><div class="bh"><h2>Morgen-Check</h2><p>1 = schlecht, 5 = top</p></div>
  ${SCALES.map(([k, l]) => `<div class="ex"><h3 class="sq">${l}</h3>${scale('mc', k, e[k], l)}</div>`).join('')}
  <div class="ex"><div class="tm">
    <label>Ins Bett<input type="time" data-a="bed" value="${esc(e.bed)}"></label>
    <label>Aufstehen<input type="time" data-a="wake" value="${esc(e.wake)}"></label>
    <label>Ruhepuls<input type="number" inputmode="numeric" min="30" max="120" data-a="puls" value="${e.puls == null ? '' : e.puls}" placeholder="optional"></label>
  </div><p class="note">${dec(hoursInBed(e.bed, e.wake))} h im Bett${own ? '' : ' · aus deiner Week Routine'}</p></div>
  ${v.amp ? ampCard(v.amp, v.sum) : ''}</section>`;
}

function mobility(m) {
  const steps = MOBILITY[m.routine].steps;
  return `<section class="blk"><div class="bh"><h2>Mobility</h2><p>${m.done ? 'Erledigt ✓' : 'Heute dran'}</p></div>
  <div class="ex"><h3 class="sq">Routine ${m.routine} · ${m.name} · ${m.minutes} min</h3>
  <p class="note">${steps.slice(0, 3).map(s => esc(s.title)).join(', ')} und ${steps.length - 3} weitere</p>
  <div class="tools"><a class="btn pri" href="#recovery/mobility">Starten</a></div></div>
  <ul class="list"><li><label><input type="checkbox" data-a="mobdone" ${m.done ? 'checked' : ''}>Mobility erledigt</label></li></ul></section>`;
}

const breath = sat => `<section class="blk"><div class="bh"><h2>Atmung</h2><p>4 ein · 4 halten · 4 aus · 4 halten</p></div>
  <div class="tools" style="margin:0"><a class="btn${sat ? '' : ' pri'}" href="#recovery/atmung?2">Box-Breathing 2 min</a><a class="btn${sat ? ' pri' : ''}" href="#recovery/atmung?5">5 min</a></div>
  <details class="ses"><summary><b>Physiological Sigh</b><span>Kurzanleitung</span></summary><p class="sigh">${esc(SIGH)}</p></details></section>`;

const LINKS = { mobility: '#recovery/mobility', weekly: '#recovery/woche' };
function blocks(v) {
  let n = 0;
  const items = v.blocks.map((b, i) => {
    if (b.link) {
      const ok = b.link === 'mobility' ? v.mob.done : v.weeklyDone;
      if (ok) n++;
      return `<li><a class="go" href="${LINKS[b.link]}"><span class="ck${ok ? ' on' : ''}" aria-hidden="true">${ok ? '✓' : ''}</span><span class="t">${esc(b.t)}</span><span class="s">${ok ? 'erledigt' : 'öffnen ›'}</span></a></li>`;
    }
    const ok = !!v.blockDone[i];
    if (ok) n++;
    return `<li><label><input type="checkbox" data-a="blk" data-i="${i}" ${ok ? 'checked' : ''}>${esc(b.t)}</label></li>`;
  });
  return `<section class="blk"><div class="bh"><h2>Recovery-Block</h2><p>${n} von ${v.blocks.length} erledigt</p></div><ul class="list">${items.join('')}</ul></section>`;
}

export const cycleCard = c => `<a class="card" href="#recovery/zyklus"><p class="k">Deload-Zyklus · Woche ${c.week} von 7</p><b>Woche ${c.week} · ${esc(c.goal)}</b><span>RIR ${c.main} Haupt / ${c.iso} Iso${c.deload ? ' · Deload-Regeln ansehen' : ' · Deload ab ' + dfmt(c.nextDeload)} ›</span></a>`;
export const suggestCard = t => `<a class="card warn" href="#recovery/zyklus"><b>Deload vorziehen?</b><span>${t.count} von 6 Anzeichen treffen zu · ansehen ›</span></a>`;

export function todayView(v) {
  return `<div class="hero" style="grid-template-columns:1fr"><div><p class="k">${dfmt(v.day)}</p><h1>Recovery</h1></div></div>
  ${morning(v)}${mobility(v.mob)}${breath(v.sat)}${v.blocks ? blocks(v) : ''}
  <section class="blk"><div class="bh"><h2>Zyklus</h2></div><div class="cards">${v.trig.suggest ? suggestCard(v.trig) : ''}${cycleCard(v.cycle)}</div></section>`;
}

// Guided timers. The *Fields helpers feed both the first render and the
// in-place updates of the running timer, so both always show the same.
export const mss = sec => { const s = Math.max(0, Math.ceil(sec)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

export function mobilityFields(steps, s, end) {
  const next = steps[s.index + 1];
  return {
    text: {
      rtStep: `Übung ${s.index + 1} von ${steps.length}`, rtTitle: s.step.title, rtHint: s.step.hint || ' ',
      rtLeft: mss(s.left), rtNext: next ? 'Als Nächstes: ' + next.title : 'Letzte Übung', rtTotal: mss(s.total),
    },
    bar: Math.min(100, (1 - s.total / end) * 100),
  };
}

export function breathFields(t, dur, idle) {
  const p = boxPhase(t);
  return { text: { rtPhase: idle ? 'Bereit' : p.phase, rtLeft: idle ? '4 · 4 · 4 · 4' : String(p.left), rtTotal: mss(dur - t) }, orb: !idle && p.n < 2 };
}

const btns = status => status === 'idle'
  ? '<button class="btn pri" data-a="tstart" type="button">Start</button>'
  : `<button class="btn pri" data-a="tpause" type="button">${status === 'paused' ? 'Weiter' : 'Pause'}</button><button class="btn" data-a="tstop" type="button">Beenden</button>`;
const doneBox = msg => `<div class="timer"><p class="k">Recovery</p><h1>${msg}</h1><div class="tools"><a class="btn pri" href="#recovery">‹ Recovery</a></div></div>`;

export function mobilityView(v) {
  if (v.status === 'done') return doneBox('Geschafft ✓') + '<p class="note" style="text-align:center">Mobility ist für heute abgehakt.</p>';
  const f = mobilityFields(v.steps, v.state, v.end), x = f.text;
  return `<div class="timer"><p class="k">Routine ${v.routine} · ${v.name} · <span id="rtStep">${x.rtStep}</span></p>
  <h1 id="rtTitle">${esc(x.rtTitle)}</h1><p class="hint" id="rtHint">${esc(x.rtHint)}</p>
  <div class="big" id="rtLeft" aria-live="off">${x.rtLeft}</div><p class="note" id="rtNext">${esc(x.rtNext)}</p>
  <div class="prog" aria-hidden="true"><i id="rtBar" style="width:${f.bar}%"></i></div>
  <p class="note"><span id="rtTotal">${x.rtTotal}</span> übrig von ${mss(v.end)}${v.doneToday && v.status === 'idle' ? ' · heute schon erledigt ✓' : ''}</p>
  <div class="tools">${btns(v.status)}</div></div>`;
}

export function breathView(v) {
  if (v.status === 'done') return doneBox('Fertig ✓');
  const f = breathFields(v.t, v.dur, v.status === 'idle'), x = f.text;
  return `<div class="timer"><p class="k">Box-Breathing · ${v.min} min</p>
  <div class="orb-wrap"><i class="orb${f.orb ? ' big' : ''}" id="rtOrb" aria-hidden="true"></i><div class="orb-t"><b id="rtPhase">${x.rtPhase}</b><span id="rtLeft">${x.rtLeft}</span></div></div>
  <p class="note"><span id="rtTotal">${x.rtTotal}</span> übrig · 4 s ein, 4 halten, 4 aus, 4 halten</p>
  <div class="tools">${btns(v.status)}</div></div>`;
}

const WQ = [['schlaf', 'Schlaf'], ['energie', 'Energie'], ['gelenke', 'Gelenke'], ['ziel', 'Fortschritt zum Ziel']];
const bedLine = m => (m.bed && m.wake ? `${esc(m.bed)}–${esc(m.wake)} · ${dec(hoursInBed(m.bed, m.wake))} h` : 'Bettzeit fehlt') + (m.puls ? ' · Puls ' + m.puls : '');

export function weekView(v) {
  const w = v.w || {};
  const rows = v.morning.map(m => `<li><i class="dot ${m.amp ? m.amp.key : ''}" aria-hidden="true"></i><span class="nm"><b>${dfmt(m.day)}</b><small>${bedLine(m)}</small></span><span class="val">${m.sum == null ? 'unvollständig' : `${m.sum} von 15 · ${m.amp.label}`}</span></li>`).join('');
  const past = v.past.map(p => `<details class="ses"><summary><b>${dfmt(p.sunday)}</b><span>${WQ.map(([k]) => p.w[k] ?? '–').join(' · ')}</span></summary><ul>${WQ.map(([k, l]) => `<li>${l}<span>${p.w[k] ?? '–'}/5</span></li>`).join('')}${p.w.gut ? `<li>Lief gut<span>${esc(p.w.gut)}</span></li>` : ''}${p.w.next ? `<li>Ziel<span>${esc(p.w.next)}</span></li>` : ''}</ul></details>`).join('');
  return `<div class="hero" style="grid-template-columns:1fr"><div><p class="k">Wochen-Check für ${dfmt(v.sunday)}</p><h1>Woche</h1></div></div>
  <section class="blk"><div class="bh"><h2>Wochen-Check</h2><p>1 = schlecht, 5 = top</p></div>
  ${WQ.map(([k, l]) => `<div class="ex"><h3 class="sq">${l}</h3>${scale('wk', k, w[k], l)}</div>`).join('')}
  <label class="note fl" for="wkGut">Was lief gut?</label><textarea id="wkGut" data-a="wkt" data-k="gut">${esc(w.gut || '')}</textarea>
  <label class="note fl" for="wkNext">Ziel nächste Woche</label><textarea id="wkNext" data-a="wkt" data-k="next">${esc(w.next || '')}</textarea></section>
  <section class="blk"><div class="bh"><h2>Morgen-Checks</h2><p>letzte 14 Tage</p></div>${rows ? `<ul class="rows">${rows}</ul>` : '<p class="empty">Noch keine Morgen-Checks. Trag ihn morgens unter „Tag“ ein.</p>'}</section>
  ${past ? `<section class="blk"><div class="bh"><h2>Frühere Wochen</h2></div><p class="note">Werte: Schlaf · Energie · Gelenke · Ziel</p>${past}</section>` : ''}`;
}

const since = n => (n <= 0 ? 'seit heute' : n === 1 ? 'seit 1 Tag' : `seit ${n} Tagen`);

function triggers(t) {
  const items = t.items.map(i => i.auto
    ? `<li><div class="li"><span class="ck${i.on ? ' on' : ''}" aria-hidden="true">${i.on ? '✓' : ''}</span><span class="t">${esc(i.label)}</span><span class="s">${i.on ? 'trifft zu' : 'nein'}</span></div></li>`
    : `<li><label><input type="checkbox" data-a="flag" data-k="${i.key}" ${i.on ? 'checked' : ''}>${esc(i.label)}<span class="s">diese Woche</span></label></li>`).join('');
  return `<section class="blk"><div class="bh"><h2>Deload vorziehen?</h2><p>${t.count} von 6${t.suggest ? ' · empfohlen' : ''}</p></div><ul class="list">${items}</ul>
  <p class="note">${t.suggest ? 'Zwei oder mehr Anzeichen treffen zu: Zieh den Deload vor.' : 'Ab zwei Anzeichen empfiehlt die App, den Deload vorzuziehen. Vier davon erkennt sie selbst.'}</p></section>`;
}

function complaints(v) {
  const d = v.draft;
  const open = v.open.map(c => `<li><span class="nm"><b>${esc(c.place)}</b><small>Stärke ${c.level} · ${since(daysBetween(c.start, v.today))}${c.note ? ' · ' + esc(c.note) : ''}</small></span><button class="btn" data-a="cres" data-id="${esc(c.id)}" type="button">Erledigt</button></li>`).join('');
  const done = v.done.length ? `<details class="ses"><summary><b>Erledigt</b><span>${v.done.length}</span></summary><ul>${v.done.map(c => `<li>${esc(c.place)}<span>${dshort(c.start)}–${dshort(c.resolved)}</span></li>`).join('')}</ul></details>` : '';
  return `<section class="blk"><div class="bh"><h2>Beschwerden</h2><p>${v.open.length} offen</p></div>
  <div class="ex"><label class="note fl" for="cPlace">Körperstelle</label><input id="cPlace" class="tx" data-a="cf" data-k="place" value="${esc(d.place)}" placeholder="z. B. Knie links" autocomplete="off">
  <p class="note fl">Stärke · 1 = leicht, 5 = stark</p>${scale('clv', 'level', d.level, 'Stärke')}
  <label class="note fl" for="cNote">Notiz</label><input id="cNote" class="tx" data-a="cf" data-k="note" value="${esc(d.note)}" placeholder="optional" autocomplete="off">
  ${v.cerr ? `<p class="note err" role="alert">${esc(v.cerr)}</p>` : ''}<div class="tools"><button class="btn pri" data-a="cadd" type="button">Hinzufügen</button></div></div>
  ${open ? `<ul class="rows">${open}</ul>` : ''}${done}</section>`;
}

export function cycleView(v) {
  const c = v.c;
  const rows = v.rows.map(r => `<tr${r.week === c.week ? ' class="on"' : ''}><td>${r.week}</td><td>${dshort(r.start)}</td><td>${r.main}</td><td>${r.iso}</td><td>${esc(r.goal)}</td></tr>`).join('');
  return `<div class="hero" style="grid-template-columns:1fr"><div><p class="k">Deload-Zyklus · 6 Wochen Aufbau + 1 Deload</p><h1>Woche ${c.week}</h1><p class="m">${c.deload ? 'Deload' : esc(c.goal)} · RIR ${c.main} Haupt / ${c.iso} Iso</p></div></div>
  ${c.deload ? `<section class="blk"><div class="bh"><h2>Deload-Regeln</h2><p>diese Woche</p></div><ul class="list rules">${DELOAD_RULES.map(r => `<li>${esc(r)}</li>`).join('')}</ul></section>` : ''}
  <section class="blk"><div class="bh"><h2>Zyklus</h2><p>${c.deload ? 'Nächster Deload ab ' + dfmt(c.nextDeload) : 'Deload ' + dfmt(c.nextDeload) + ' – ' + dfmt(addDays(c.nextDeload, 6))}</p></div>
  <table class="tbl"><thead><tr><th>Woche</th><th>ab</th><th>RIR Haupt</th><th>RIR Iso</th><th>Ziel</th></tr></thead><tbody>${rows}</tbody></table>
  ${c.deload ? '' : `<div class="tools"><button class="btn${v.confirm ? ' red' : ''}" data-a="deload" type="button">${v.confirm ? 'Sicher? Nochmal tippen' : 'Deload jetzt starten'}</button></div><p class="note">${v.confirm ? 'Diese Woche wird zur Deload-Woche, ab nächstem Montag beginnt ein neuer Aufbau.' : 'Macht diese Woche zur Deload-Woche. Ab nächstem Montag beginnt ein neuer Aufbau.'}</p>`}</section>
  ${triggers(v.trig)}${complaints(v)}`;
}
