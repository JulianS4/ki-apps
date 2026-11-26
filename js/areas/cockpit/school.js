// Ausbildung: department, exams (next three up front), tasks and study notes per subject.
import { esc } from '../../core/html.js';
import { dfmt } from '../../core/dates.js';
import * as db from './db.js';
import { nextExams, currentDept, gradeAvg, daysUntil, norm } from './logic.js';
import { PREP, label } from './data.js';
import { banner, hero, srcLine, empty, newBtn, editBtn, formIf, common, tick, target, today, edInput, onNavigateCommon, mountCommon } from './ui.js';
import { inDays, fmtGrade } from './home.js';

export const tagOf = subj => norm(subj).trim().replace(/\s+/g, '-');
const subjHref = s => `#ausbildung/fach?${encodeURIComponent(s)}`;
const prepSel = e => `<label class="dsel sm">Vorbereitung<select data-a="prep" data-id="${esc(e.id)}">${PREP.map(([v, l]) => `<option value="${v}"${v === e.prep ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`;
const examRow = (e, t, big) => `<li${big ? ' class="xb"' : ''}><div class="nm"><b>${esc(e.subj)}</b><small>${dfmt(e.d)}${e.time ? ' · ' + e.time + ' Uhr' : ''}${e.place ? ' · ' + esc(e.place) : ''}${e.note ? ' · ' + esc(e.note) : ''}</small></div>
  <div class="vr">${e.d >= t ? `<span class="pill${daysUntil(t, e.d) <= 3 ? ' hot' : ''}">${inDays(daysUntil(t, e.d))}</span>` : e.grade ? `<span class="pill mute">Note ${fmtGrade(e.grade)}</span>` : '<span class="pill mute">vorbei</span>'}</div>
  ${big ? prepSel(e) : ''}${editBtn('exam', e.id)}</li>`;
const taskRow = x => `<li class="li"><input type="checkbox" data-a="tick" data-s="stask" data-id="${esc(x.id)}"${x.done ? ' checked' : ''} aria-label="${esc(x.text)} erledigt"><span class="t${x.done ? ' done' : ''}">${esc(x.text)}<small>${esc(x.subj)}${x.due ? ' · fällig ' + dfmt(x.due) : ''}</small></span>${editBtn('stask', x.id)}</li>`;

function overview(ctx, t) {
  const exams = db.list(ctx, 'exam'), next = nextExams(exams, t), depts = db.list(ctx, 'dept').sort((a, b) => (a.from < b.from ? -1 : 1)), cur = currentDept(depts, t);
  const tasks = db.list(ctx, 'stask'), open = tasks.filter(x => !x.done).sort((a, b) => ((a.due || '9') < (b.due || '9') ? -1 : 1)), avg = gradeAvg(exams);
  const rest = exams.filter(e => !next.includes(e)).sort((a, b) => (a.d < b.d ? 1 : -1));
  const subjects = [...new Set([...exams.map(e => e.subj), ...tasks.map(x => x.subj)])].sort((a, b) => a.localeCompare(b, 'de'));
  return `${hero('', 'Ausbildung', cur ? `Aktuelle Abteilung: <b>${esc(cur.name)}</b> · seit ${dfmt(cur.from)}${cur.to ? ` · bis ${dfmt(cur.to)}` : ''}` : 'Keine aktuelle Abteilung eingetragen.')}
  <div class="pact">${newBtn('exam', 'Klassenarbeit hinzufügen', null, 'btn pri')}${newBtn('stask', 'Aufgabe hinzufügen')}${newBtn('dept', 'Abteilung hinzufügen')}</div>
  ${formIf(ctx, 'exam')}${formIf(ctx, 'stask')}${formIf(ctx, 'dept')}
  <section class="blk hl"><div class="bh"><h2>Nächste Klassenarbeiten</h2><p>${next.length ? srcLine(next[0].src, next.map(e => e.upd).filter(Boolean).sort().pop(), ctx, { label: 'aktualisiert' }) : ''}</p></div>
  ${next.length ? `<ul class="crows card-l">${next.map(e => examRow(e, t, true)).join('')}</ul>` : empty('Keine anstehenden Klassenarbeiten eingetragen.')}</section>
  <section class="blk"><div class="bh"><h2>Alle Klassenarbeiten</h2>${avg ? `<p>Schnitt <b>${fmtGrade(avg)}</b></p>` : ''}</div>
  ${rest.length ? `<ul class="crows card-l">${rest.map(e => examRow(e, t, false)).join('')}</ul>` : '<p class="note">Weitere und vergangene Klassenarbeiten erscheinen hier, mit Note.</p>'}</section>
  ${subjects.length ? `<section class="blk"><div class="bh"><h2>Fächer</h2><p>Aufgaben und Lernnotizen</p></div><div class="chips">${subjects.map(s => `<a class="chipb" href="${subjHref(s)}">${esc(s)}${open.some(x => x.subj === s) ? ` · ${open.filter(x => x.subj === s).length}` : ''}</a>`).join('')}</div></section>` : ''}
  <section class="blk"><div class="bh"><h2>Offene Aufgaben</h2><p>${open.length}</p></div>
  ${open.length ? `<ul class="list">${open.map(taskRow).join('')}</ul>` : '<p class="note">Keine offenen Aufgaben.</p>'}</section>
  <section class="blk"><div class="bh"><h2>Abteilungen</h2><p>Abschnitte der Ausbildung</p></div>
  ${depts.length ? `<ul class="crows card-l">${depts.map(d => `<li${d === cur ? ' class="now"' : ''}><div class="nm"><b>${esc(d.name)}${d === cur ? ' <span class="pill hot">jetzt</span>' : ''}</b><small>${dfmt(d.from)} – ${d.to ? dfmt(d.to) : 'offen'}${d.note ? ' · ' + esc(d.note) : ''}</small></div>${editBtn('dept', d.id)}</li>`).join('')}</ul>` : ''}</section>`;
}

function subject(ctx, t, subj) {
  const n = norm(subj), exams = db.list(ctx, 'exam').filter(e => norm(e.subj) === n).sort((a, b) => (a.d < b.d ? -1 : 1));
  const tasks = db.list(ctx, 'stask').filter(x => norm(x.subj) === n), notes = db.list(ctx, 'note').filter(x => x.tags.some(g => norm(g) === tagOf(subj)));
  return `<a class="back" href="#ausbildung">‹ Ausbildung</a>${hero('Fach', esc(subj), 'Klassenarbeiten, Aufgaben und Lernnotizen zu diesem Fach.')}
  <div class="pact">${newBtn('exam', 'Klassenarbeit hinzufügen', { subj }, 'btn pri')}${newBtn('stask', 'Aufgabe hinzufügen', { subj })}${newBtn('note', 'Lernnotiz anlegen', { topic: 'ausbildung', tags: tagOf(subj) })}</div>
  ${formIf(ctx, 'exam')}${formIf(ctx, 'stask')}${formIf(ctx, 'note')}
  <section class="blk"><div class="bh"><h2>Klassenarbeiten</h2></div>${exams.length ? `<ul class="crows card-l">${exams.map(e => examRow(e, t, e.d >= t)).join('')}</ul>` : '<p class="note">Keine Klassenarbeiten in diesem Fach.</p>'}</section>
  <section class="blk"><div class="bh"><h2>Aufgaben</h2></div>${tasks.length ? `<ul class="list">${tasks.map(taskRow).join('')}</ul>` : '<p class="note">Keine Aufgaben in diesem Fach.</p>'}</section>
  <section class="blk"><div class="bh"><h2>Lernnotizen</h2><p>Notizen mit Tag #${esc(tagOf(subj))}</p></div>
  ${notes.length ? `<ul class="crows card-l">${notes.map(x => `<li><a class="nm" href="#wissen/n-${esc(x.id)}"><b>${esc(x.title)}</b><small>${esc(x.body.slice(0, 90))}</small></a></li>`).join('')}</ul>` : ''}
  ${notes.length ? '' : '<p class="note">Noch keine Lernnotizen. Notizen mit diesem Tag erscheinen hier.</p>'}</section>`;
}

export function render(route, ctx) {
  const t = today(ctx);
  return banner(ctx) + (route.view === 'subject' ? subject(ctx, t, route.subj) : overview(ctx, t));
}
export function onClick(e, route, ctx) { const t = target(e); if (t) common(t, ctx); }
export function onInput(e) { edInput(e.target); }
export function onChange(e, route, ctx) {
  const t = e.target;
  if (edInput(t) || tick(t, ctx)) return;
  if (t.dataset && t.dataset.a === 'prep') {
    const x = db.find(ctx, 'exam', t.dataset.id);
    if (x) db.upsert(ctx, 'exam', { ...x, prep: t.value });
    ctx.rerender();
  }
}
export function onNavigate() { onNavigateCommon(); }
export function mount() { mountCommon(); }
