// KI-Agents: a hand-kept list. Nothing here is live; every status says when it was noted.
import { esc } from '../../core/html.js';
import * as db from './db.js';
import { fmtMoney } from './logic.js';
import { AGENT_STATUS, label } from './data.js';
import { banner, hero, srcLine, empty, newBtn, editBtn, formIf, common, target, edInput, onNavigateCommon, mountCommon } from './ui.js';
import { knowledgeBox, kbInput } from './knowledge.js';

const CLS = { bereit: 'ok', beschaeftigt: 'hot', fehlgeschlagen: 'late', pausiert: 'mute', unbekannt: 'mute' };
export function render(route, ctx) {
  const ags = db.list(ctx, 'agent'), order = ['fehlgeschlagen', 'beschaeftigt', 'bereit', 'pausiert', 'unbekannt'];
  ags.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  const row = (k, v) => (v ? `<div><span>${k}</span><b>${esc(v)}</b></div>` : '');
  const cards = ags.map(a => `<section class="ccard"><div class="ch"><h2>${esc(a.name)}</h2><span class="pill ${CLS[a.status]}">${esc(label(AGENT_STATUS, a.status))}</span></div>
  ${a.job ? `<p class="note">${esc(a.job)}</p>` : ''}
  <div class="kv2">${row('Letzter Lauf', a.last)}${row('Nächster Lauf', a.next)}${row('Laufzeit', a.runtime)}${a.cost != null ? row('Kosten', fmtMoney(a.cost)) : ''}</div>
  ${a.result ? `<p class="note">Ergebnis: ${esc(a.result)}</p>` : ''}${a.issues ? `<p class="note err pre">${esc(a.issues)}</p>` : ''}
  <p class="foot"><span class="src">nicht verbunden · Status manuell</span> ${srcLine(a.src, a.asOf, ctx, { warnDays: 7 })}</p>${editBtn('agent', a.id)}</section>`).join('');
  return `${banner(ctx)}${hero('', 'KI-Agents', 'Status, letzte Läufe und offene Fehler – von dir gepflegt, kein System verbunden.')}
  <div class="pact">${newBtn('agent', 'Agent hinzufügen', null, 'btn pri')}</div>
  <div class="ex info"><p>Noch ist kein Agent-System angebunden. Was hier steht, trägst du selbst ein – mit Datum, damit klar ist, wie aktuell der Status ist. Sobald ein System eine Schnittstelle bietet, kann es hier andocken.</p></div>
  <section class="blk">${formIf(ctx, 'agent')}
  ${ags.length ? `<div class="cgrid">${cards}</div>` : empty('Noch keine Agents eingetragen.')}</section>
  ${formIf(ctx, 'note')}${knowledgeBox(ctx, {
    id: 'agents', about: ags.length ? 'deine Agents' : 'KI-Agents', mode: 'any',
    q: ags.length ? ags.map(a => `${a.name} ${a.job || ''}`).join(' ') : 'agent agents automatisierung ki',
    prefer: db.list(ctx, 'note').filter(n => n.topic === 'ki').map(n => n.id), preset: { topic: 'ki' },
  })}`;
}
export function onClick(e, route, ctx) { const t = target(e); if (t) common(t, ctx); }
export function onInput(e, route, ctx) { if (!kbInput(e.target, ctx)) edInput(e.target); }
export function onChange(e) { edInput(e.target); }
export function onNavigate() { onNavigateCommon(); }
export function mount() { mountCommon(); }
