// Kalender & Routinen: the week at a glance – the week routine, the training day, exams,
// tasks due and subscription charges – plus what is on now and next.
import { esc } from '../../core/html.js';
import { DAYS, DN, dshort, addDays } from '../../core/dates.js';
import { WEEK_ROUTINE, nowNext } from '../../core/schedule.js';
import { DEF } from '../training/plan-default.js';
import * as db from './db.js';
import { taskGroups, nextBilling, fmtMoney } from './logic.js';
import { PREP, label } from './data.js';
import { banner, hero, today, common, target, onNavigateCommon, mountCommon } from './ui.js';

// The seven days of the week that holds `day`, Monday first.
export function weekDays(day) {
  const back = (new Date(day + 'T12:00:00').getDay() + 6) % 7, mon = addDays(day, -back);
  return DAYS.map((k, i) => ({ k, d: addDays(mon, i) }));
}

const tabs = `<nav class="csub" aria-label="Kalender &amp; Routinen"><a href="#kalender" class="on" aria-current="page">Kalender</a><a href="#routinen">Routinen</a></nav>`;
const ev = (cls, title, line, href) => `<li class="ev ${cls}">${href ? `<a href="${esc(href)}">` : ''}<b>${esc(title)}</b>${line ? `<small>${esc(line)}</small>` : ''}${href ? '</a>' : ''}</li>`;

function nowCards(ctx) {
  const now = ctx.now(), { now: cur, next } = nowNext(now);
  const when = (next.day === DAYS[(now.getDay() + 6) % 7] ? '' : DN[next.day] + ' ') + next.start;
  const holder = cur && /^(Morgen|Abend)routine$/.test(cur.title);
  return `<div class="cards">${cur ? `<${holder ? 'a href="#routinen/halterung"' : 'div'} class="card now"><p class="k">Jetzt</p><b>${esc(cur.title)}</b><span>bis ${cur.end}${holder ? ' · Halterungs-Modus ›' : ''}</span></${holder ? 'a' : 'div'}>` : ''}
  <div class="card"><p class="k">Als Nächstes</p><b>${esc(next.title)}</b><span>${when}</span></div></div>`;
}

export function render(route, ctx) {
  const t = today(ctx), days = weekDays(route.week || t), mon = days[0].d, sun = days[6].d, thisWeek = t >= mon && t <= sun;
  const plan = ctx.store.get('train.plan') || DEF;
  const exams = db.list(ctx, 'exam'), subs = db.list(ctx, 'sub').filter(s => s.status === 'aktiv');
  const open = taskGroups({ free: db.list(ctx, 'task'), ptasks: db.list(ctx, 'ptask'), stasks: db.list(ctx, 'stask'), projects: db.list(ctx, 'project') }, t).groups.flatMap(g => g.items);
  const billed = subs.map(s => ({ s, d: nextBilling(s, mon) })).filter(x => x.d && x.d <= sun);
  const cards = days.map(({ k, d }, i) => {
    const tr = plan.days && plan.days[i], rest = !tr || tr.type === 'ruhe';
    const items = [
      ...exams.filter(e => e.d === d).map(e => ev('ev-exam', `Klassenarbeit ${e.subj}`, [e.time, e.place, `Vorbereitung: ${label(PREP, e.prep)}`].filter(Boolean).join(' · '), '#ausbildung')),
      ...open.filter(x => x.due === d).map(x => ev('ev-task', x.text, x.where ? `Aufgabe · ${x.where}` : 'Aufgabe', x.href || '#aufgaben')),
      ...billed.filter(x => x.d === d).map(x => ev('ev-sub', x.s.name, `Abbuchung ${fmtMoney(x.s.amt, x.s.cur)}`, '#finanzen/abos')),
    ].join('');
    const blocks = WEEK_ROUTINE[k] || [];
    return `<section data-day="${d}" class="cday${d === t ? ' today' : ''}"><div class="ch"><h2>${DN[k]} ${dshort(d)}${d === t ? ' <span class="pill hot">heute</span>' : ''}</h2>
    <a class="pill${rest ? ' mute' : ''}" href="#training/${k}">${esc(rest ? 'Ruhetag' : tr.name)}</a></div>
    ${items ? `<ul class="cevents">${items}</ul>` : '<p class="note">Keine Termine.</p>'}
    ${blocks.length ? `<details class="crout"><summary>Tagesablauf · ${blocks.length} Blöcke</summary><ul>${blocks.map(b => `<li><span class="tm">${b.start}</span>${esc(b.title)}</li>`).join('')}</ul></details>` : ''}</section>`;
  }).join('');
  const go = (d, l, cls = 'btn sm') => `<a class="${cls}" href="#kalender${d ? '/' + d : ''}">${l}</a>`;
  return `${banner(ctx)}${hero('', 'Kalender &amp; Routinen', `Woche ${dshort(mon)}–${dshort(sun)} · Tagesablauf aus deiner Wochenroutine`)}${tabs}
  <div class="pact wnav">${go(addDays(mon, -7), '‹ Vorwoche')}${go('', 'Diese Woche', thisWeek ? 'btn sm on' : 'btn sm')}${go(addDays(mon, 7), 'Nächste Woche ›')}</div>
  ${thisWeek ? nowCards(ctx) : ''}
  <div class="cweek">${cards}</div>
  <p class="note">Klassenarbeiten, Aufgaben und Abos kommen aus Life OS; der Tagesablauf aus deiner Wochenroutine.</p>`;
}
export function onClick(e, route, ctx) { const t = target(e); if (t) common(t, ctx); }
export function onNavigate() { onNavigateCommon(); }
export function mount() { mountCommon(); }
