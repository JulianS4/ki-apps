// One description per kind of entry: drives the forms, the parsing of what was
// typed and the defensive reading of what is stored.
import { parseMoney, parseDur, isDay, norm } from './logic.js';
import { ACC_TYPES, CURS, CAT_KINDS, EVERY, SUB_STATUS, PREP, PROJ_STATUS, AGENT_STATUS, TOPICS } from './data.js';

const F = (k, label, t, o = {}) => ({ k, label, t, ...o });
const REQ = { req: 1 };
export const SCHEMAS = {
  account: { key: 'accounts', title: 'Konto', fields: [F('name', 'Name', 'text', { req: 1, full: 1 }), F('type', 'Art', 'select', { opts: ACC_TYPES }), F('cur', 'Währung', 'select', { opts: CURS }), F('bal', 'Kontostand', 'money', REQ), F('asOf', 'Stand vom', 'date', { req: 1, today: 1 })] },
  // 'dir' only lives in the form: Ausgabe stores a negative amount, Einnahme a positive one.
  tx: { key: 'tx', title: 'Buchung', fields: [F('dir', 'Art', 'select', { opts: [['aus', 'Ausgabe'], ['ein', 'Einnahme']], virtual: 1 }), F('amt', 'Betrag in €', 'money', { req: 1, posIn: 1 }), F('d', 'Datum', 'date', { req: 1, today: 1 }), F('acc', 'Konto', 'ref', { ref: 'account', req: 1, grp: 'Zuordnung' }), F('cat', 'Kategorie', 'ref', { ref: 'cat' }), F('payee', 'Empfänger / Zahler', 'text', { full: 1 }), F('note', 'Notiz', 'text', { full: 1 })] },
  cat: { key: 'cats', title: 'Kategorie', fields: [F('name', 'Name', 'text', REQ), F('kind', 'Art', 'select', { opts: CAT_KINDS })] },
  sub: { key: 'subs', title: 'Abo', fields: [F('name', 'Dienst', 'text', { req: 1, full: 1 }), F('amt', 'Betrag', 'money', { req: 1, pos: 1 }), F('cur', 'Währung', 'select', { opts: CURS }), F('every', 'Abrechnung', 'select', { opts: EVERY }), F('next', 'Nächste Abbuchung', 'date', REQ), F('pay', 'Konto / Zahlungsmittel', 'text', { grp: 'Zuordnung' }), F('cat', 'Kategorie', 'ref', { ref: 'cat' }), F('status', 'Status', 'select', { opts: SUB_STATUS })] },
  dept: { key: 'depts', title: 'Abteilung', fields: [F('name', 'Abteilung', 'text', { req: 1, full: 1 }), F('from', 'Von', 'date', REQ), F('to', 'Bis', 'date'), F('note', 'Notiz', 'text', { full: 1 })] },
  exam: { key: 'exams', title: 'Klassenarbeit', fields: [F('subj', 'Fach', 'text', REQ), F('d', 'Datum', 'date', REQ), F('time', 'Uhrzeit', 'time'), F('place', 'Ort', 'text'), F('prep', 'Vorbereitung', 'select', { opts: PREP, grp: 'Vorbereitung und Note' }), F('grade', 'Note', 'grade'), F('note', 'Notiz', 'text', { full: 1 })] },
  stask: { key: 'stasks', title: 'Aufgabe', fields: [F('subj', 'Fach', 'text', REQ), F('text', 'Aufgabe', 'text', { req: 1, full: 1 }), F('due', 'Fällig am', 'date'), F('done', 'Erledigt', 'bool')] },
  project: { key: 'projects', title: 'Projekt', fields: [F('name', 'Name', 'text', REQ), F('status', 'Status', 'select', { opts: PROJ_STATUS }), F('goal', 'Nächstes Ziel', 'text', { full: 1 }), F('prog', 'Fortschritt in %', 'int', { min: 0, max: 100, def: 0 }), F('notes', 'Notizen', 'long', { full: 1, grp: 'Notizen und Links' }), F('links', 'Wichtige Links', 'links', { full: 1, hint: 'Einer pro Zeile: Name https://…' })] },
  ptask: { key: 'ptasks', title: 'Aufgabe', fields: [F('proj', 'Projekt', 'ref', { ref: 'project', req: 1 }), F('text', 'Aufgabe', 'text', { req: 1, full: 1 }), F('due', 'Fällig am', 'date'), F('done', 'Erledigt', 'bool')] },
  log: { key: 'log', title: 'Log-Eintrag', fields: [F('d', 'Datum', 'date', { req: 1, today: 1 }), F('proj', 'Projekt', 'ref', { ref: 'project', req: 1 }), F('text', 'Aktivität', 'text', { req: 1, full: 1 }), F('min', 'Dauer', 'dur', { hint: 'z. B. 1:30 oder 45 (Minuten)', def: 0, grp: 'Zeit und Geld' }), F('inc', 'Einnahmen', 'money', { pos: 1, def: 0 }), F('exp', 'Ausgaben', 'money', { pos: 1, def: 0 })] },
  agent: { key: 'agents', title: 'Agent', fields: [F('name', 'Name', 'text', REQ), F('job', 'Aufgabe', 'text', { full: 1 }), F('status', 'Status', 'select', { opts: AGENT_STATUS, grp: 'Status' }), F('asOf', 'Status vom', 'date', { today: 1 }), F('last', 'Letzter Lauf', 'text', { hint: 'z. B. 25.11. 07:00' }), F('next', 'Nächster Lauf', 'text'), F('result', 'Letztes Ergebnis', 'text', { full: 1 }), F('issues', 'Fehler / offene Aufgaben', 'long', { full: 1 }), F('runtime', 'Laufzeit', 'text', { grp: 'Aufwand' }), F('cost', 'Kosten', 'money', { pos: 1 })] },
  note: { key: 'notes', title: 'Notiz', fields: [F('title', 'Titel', 'text', { req: 1, full: 1 }), F('topic', 'Bereich', 'select', { opts: TOPICS }), F('tags', 'Tags', 'tags', { hint: 'mit Komma trennen' }), F('projects', 'Projekte', 'refs', { ref: 'project', full: 1 }), F('body', 'Inhalt', 'long', { full: 1, rows: 10, hint: '[[Titel]] verknüpft eine andere Notiz' })] },
  import: { key: 'imports', title: 'Import', fields: [F('kind', 'Art', 'select', { opts: [['csv', 'CSV'], ['json', 'Cockpit-Datei']] }), F('file', 'Datei', 'text'), F('at', 'Am', 'date', REQ), F('n', 'Einträge', 'int', { min: 0, max: 1e7, def: 0 }), F('acc', 'Konto', 'text')] },
};
export const SOURCES = ['manuell', 'csv', 'import', 'beispiel'];
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const MAX = { text: 300, long: 20000 };
const ID = /^[\w-]{1,64}$/; // ids land in attributes and links
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const isUrl = s => typeof s === 'string' && /^https?:\/\/[^\s]+$/i.test(s);
const def = f => (f.t === 'select' ? f.opts[0][0] : f.t === 'bool' ? false : ['tags', 'refs', 'links'].includes(f.t) ? [] : ['text', 'long', 'ref'].includes(f.t) ? '' : f.def ?? null);
const uniq = arr => arr.filter((t, i) => t && arr.findIndex(x => norm(x) === norm(t)) === i);

// Stored value → valid value or undefined.
function cleanVal(f, v) {
  switch (f.t) {
    case 'text': case 'long': return typeof v === 'string' ? v.slice(0, MAX[f.t]) : undefined;
    case 'ref': return typeof v === 'string' && v ? v : undefined;
    case 'money': return Number.isInteger(v) && (!f.pos || v >= 0) ? v : undefined;
    case 'int': return Number.isInteger(v) && v >= f.min && v <= f.max ? v : undefined;
    case 'dur': return Number.isInteger(v) && v >= 0 ? v : undefined;
    case 'grade': return typeof v === 'number' && v >= 1 && v <= 6 ? v : undefined;
    case 'date': return isDay(v) ? v : undefined;
    case 'time': return typeof v === 'string' && TIME.test(v) ? v : undefined;
    case 'select': return f.opts.some(o => o[0] === v) ? v : undefined;
    case 'bool': return typeof v === 'boolean' ? v : undefined;
    case 'tags': return Array.isArray(v) ? uniq(v.filter(t => typeof t === 'string').map(t => t.trim())) : undefined;
    case 'refs': return Array.isArray(v) ? [...new Set(v.filter(t => typeof t === 'string' && t))] : undefined;
    case 'links': return Array.isArray(v) ? v.filter(l => isObj(l) && typeof l.label === 'string' && isUrl(l.url)).map(l => ({ label: l.label, url: l.url })) : undefined;
    default: return undefined;
  }
}

export function cleanItem(name, raw) {
  const s = SCHEMAS[name];
  if (!s || !isObj(raw) || typeof raw.id !== 'string' || !ID.test(raw.id)) return null;
  const out = { id: raw.id };
  for (const f of s.fields) {
    if (f.virtual) continue;
    const v = cleanVal(f, raw[f.k]);
    if (v === undefined && f.req) return null;
    const d = v === undefined ? def(f) : v;
    if (d !== null) out[f.k] = d;
  }
  out.src = SOURCES.includes(raw.src) ? raw.src : 'manuell';
  for (const k of ['upd', 'created']) if (typeof raw[k] === 'string') out[k] = raw[k];
  if (name === 'account') {
    const h = (Array.isArray(raw.hist) ? raw.hist : []).filter(p => isObj(p) && isDay(p.d) && Number.isInteger(p.c)).map(p => ({ d: p.d, c: p.c }));
    out.hist = h.length ? h.sort((a, b) => (a.d < b.d ? -1 : 1)) : [{ d: out.asOf, c: out.bal }];
  }
  return out;
}

// What was typed → typed value, or an error message.
function parseVal(f, s) {
  const str = typeof s === 'string' ? s.trim() : s;
  const empty = str === '' || str == null || (Array.isArray(str) && !str.length);
  if (empty && f.req && f.t !== 'select' && f.t !== 'bool') return { err: f.t === 'ref' ? 'Bitte auswählen' : f.t === 'date' ? 'Datum wählen' : 'Bitte ausfüllen' };
  switch (f.t) {
    case 'text': case 'long': case 'ref': return { v: String(str ?? '').slice(0, MAX[f.t] || 300) };
    case 'select': return { v: f.opts.some(o => o[0] === str) ? str : f.opts[0][0] };
    case 'bool': return { v: !!s };
    case 'money': {
      if (empty) return { v: f.def ?? null };
      const c = parseMoney(str);
      if (c == null) return { err: 'Betrag wie 12,50 eingeben' };
      if (f.posIn && c < 0) return { err: 'Betrag ohne Minus eingeben – Ausgabe oder Einnahme wählst du oben' };
      return f.pos && c < 0 ? { err: 'Betrag ohne Minus eingeben' } : { v: c };
    }
    case 'int': {
      if (empty) return { v: f.def ?? null };
      return /^\d+$/.test(str) && +str >= f.min && +str <= f.max ? { v: +str } : { err: `Zahl von ${f.min} bis ${f.max}` };
    }
    case 'dur': {
      if (empty) return { v: f.def ?? 0 };
      const m = parseDur(str);
      return m == null ? { err: 'Dauer wie 1:30 oder 45 (Minuten)' } : { v: m };
    }
    case 'grade': {
      if (empty) return { v: null };
      const g = Number(String(str).replace(',', '.'));
      return /^\d([.,]\d{1,2})?$/.test(str) && g >= 1 && g <= 6 ? { v: g } : { err: 'Note von 1 bis 6, z. B. 2,3' };
    }
    case 'date': return empty ? { v: null } : isDay(str) ? { v: str } : { err: 'Datum wählen' };
    case 'time': return empty ? { v: null } : TIME.test(str) ? { v: str } : { err: 'Uhrzeit wie 08:15' };
    case 'tags': return { v: uniq(String(str ?? '').split(/[,\s]+/).map(t => t.replace(/^#+/, '').trim())) };
    case 'refs': return { v: Array.isArray(s) ? [...new Set(s.filter(Boolean))] : [] };
    case 'links': return {
      v: String(str ?? '').split('\n').map(l => {
        const m = l.match(/https?:\/\/\S+/i);
        if (!m) return null;
        const lab = l.replace(m[0], '').trim();
        return { label: lab || m[0].replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, ''), url: m[0] };
      }).filter(Boolean),
    };
    default: return { v: null };
  }
}

export function parseItem(name, draft) {
  const item = {}, errors = {};
  for (const f of SCHEMAS[name].fields) {
    const r = parseVal(f, draft[f.k]);
    if (r.err) errors[f.k] = r.err;
    else if (r.v !== null) item[f.k] = r.v;
  }
  if (name === 'tx') {
    if (item.amt != null && item.dir !== 'ein') item.amt = -item.amt || 0;
    delete item.dir;
  }
  return { ok: !Object.keys(errors).length, item, errors };
}

// Stored item → strings for the form fields.
const plain = c => (c < 0 ? '-' : '') + (Math.abs(c) / 100).toFixed(2).replace('.', ',');
export function toDraft(name, item = {}) {
  const d = {};
  for (const f of SCHEMAS[name].fields) {
    const v = item[f.k];
    if (f.t === 'money') d[f.k] = v == null ? '' : plain(v);
    else if (f.t === 'dur') d[f.k] = v ? `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}` : '';
    else if (f.t === 'grade') d[f.k] = v == null ? '' : String(v).replace('.', ',');
    else if (f.t === 'tags') d[f.k] = (v || []).join(', ');
    else if (f.t === 'links') d[f.k] = (v || []).map(l => `${l.label} ${l.url}`).join('\n');
    else if (f.t === 'refs') d[f.k] = [...(v || [])];
    else if (f.t === 'bool') d[f.k] = !!v;
    else d[f.k] = v == null ? '' : String(v);
  }
  if (name === 'tx') { d.dir = (item.amt ?? -1) < 0 ? 'aus' : 'ein'; if (item.amt != null) d.amt = plain(Math.abs(item.amt)); }
  return d;
}
