// "Aus deinem Wissen": the other areas look things up in the notes. A result is a
// passage from a note with its source; nothing is generated, and when no note
// covers a question the box says so instead of guessing.
import { esc, slug } from '../../core/html.js';
import { dfmt } from '../../core/dates.js';
import * as db from './db.js';
import { norm, plainText } from './md.js';
import { newBtn } from './ui.js';

const STOP = new Set(('der die das den dem des ein eine einer eines einem einen und oder aber auch als am an auf aus bei bin bis bist da dann dass '
  + 'du er es ich ihr im in ist ja kann man mein meine meiner meinen meinem mit nach nicht noch nur ob sie sind so um uns von vor war was wie wir '
  + 'wird zu zum zur über unter für ohne mehr sehr hat habe haben sein mich mir dir dich wo wann warum welche welcher welches wer wen wem weiß '
  + 'gibt geht soll sollte muss gut viel etwas alle hier dort heute denn doch wenn weil sich diese dieser dieses the a an and or of to in on for '
  + 'is are was with what how why when where which who it this that').split(' ').map(norm));
const words = s => norm(s).split(/[^\p{L}\p{N}]+/u).filter(t => t.length > 1 && !STOP.has(t));
export const stem = t => (t.length > 5 ? t.replace(/(ungen|ung|en|er|es|e|n|s)$/, '') : t.length > 4 ? t.replace(/(en|er|e|s)$/, '') : t);

// Notes in passages: one per section (heading), long sections in paragraphs.
function chunks(text) {
  const out = [];
  let cur = '';
  for (const p of text.split(/\n\s*\n/).map(x => x.trim()).filter(Boolean)) {
    let rest = p;
    while (rest.length > 900) {
      let cut = rest.lastIndexOf('. ', 700);
      if (cut < 200) cut = 700;
      if (cur) { out.push(cur); cur = ''; }
      out.push(rest.slice(0, cut + 1).trim());
      rest = rest.slice(cut + 1).trim();
    }
    if (cur && cur.length + rest.length > 600) { out.push(cur); cur = rest; } else cur = cur ? `${cur}\n\n${rest}` : rest;
  }
  if (cur) out.push(cur);
  return out;
}
function sections(n) {
  const out = [];
  let heading = '', buf = [], fence = false;
  const push = () => { for (const t of chunks(buf.join('\n'))) out.push({ note: n, heading, text: t }); buf = []; };
  for (const line of String(n.body || '').replace(/\r\n?/g, '\n').split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    const m = !fence && /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (m) { push(); heading = m[2].trim(); } else buf.push(line);
  }
  push();
  if (!out.length) out.push({ note: n, heading: '', text: '' });
  return out;
}

// The index is rebuilt whenever a note is added, changed or removed.
let memo = { key: null, idx: null };
function index(notes) {
  const key = notes.map(n => `${n.id}:${n.upd || ''}:${n.title}:${n.body.length}:${(n.tags || []).join(',')}`).join('|');
  if (memo.key === key) return memo.idx;
  const ps = [], df = new Map();
  for (const n of notes) {
    const about = [n.title, ...(n.tags || []), ...(n.aliases || [])].join(' ');
    for (const s of sections(n)) {
      const tf = new Map();
      for (const w of words(`${about} ${s.heading} ${plainText(s.text)}`)) { const st = stem(w); tf.set(st, (tf.get(st) || 0) + 1); }
      let len = 0;
      for (const c of tf.values()) len += c;
      ps.push({ ...s, tf, len });
      for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1);
    }
  }
  memo = { key, idx: { ps, df, avg: ps.reduce((a, p) => a + p.len, 0) / (ps.length || 1), vocab: [...df.keys()] } };
  return memo.idx;
}

function excerpt(p, vars) {
  const text = plainText(p.text);
  if (!text) return '';
  const isHit = w => { const st = stem(norm(w)); return vars.some(v => v.m.has(st)); };
  const parts = text.split(/(\s+)/), marks = [];
  const html = parts.map((w, i) => {
    if (i % 2) return w;
    const m = /^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u.exec(w);
    if (m[2] && isHit(m[2])) { marks.push(i); return `${esc(m[1])}<mark>${esc(m[2])}</mark>${esc(m[3])}`; }
    return esc(w);
  });
  let s = Math.max(0, (marks[0] || 0) - 24), e = s, len = 0;
  if (s % 2) s--;
  for (e = s; e < parts.length && len < 320; e++) len += parts[e].length;
  return `${s > 0 ? '… ' : ''}${html.slice(s, e).join('').trim()}${e < parts.length ? ' …' : ''}`;
}

// Passages that answer a query. mode 'all': the passage must cover at least half
// of what the question asks (rare words weigh more); 'any': any of the words.
export function ask(notes, query, { mode = 'all', prefer = [], limit = 4 } = {}) {
  const terms = [...new Set(words(query).map(stem))];
  if (!terms.length || !notes.length) return { terms, hits: [] };
  const { ps, df, avg, vocab } = index(notes), N = ps.length, idf = d => Math.log(1 + (N - d + 0.5) / (d + 0.5));
  const vars = terms.map(q => {
    const m = new Map();
    if (df.has(q)) m.set(q, 1);
    if (q.length >= 4) for (const v of vocab) if (v !== q && v.includes(q)) m.set(v, 0.75);
    if (q.length >= 6) for (const v of vocab) if (v.length >= 5 && v !== q && q.includes(v) && !m.has(v)) m.set(v, 0.6);
    return { q, m, w: m.size ? Math.max(...[...m.keys()].map(v => idf(df.get(v)))) : idf(0) };
  });
  const total = vars.reduce((a, v) => a + v.w, 0), pref = new Set(prefer), scored = [];
  for (const p of ps) {
    let score = 0, cov = 0;
    for (const v of vars) {
      let best = 0, bw = 0;
      for (const [t, wt] of v.m) {
        const tf = p.tf.get(t);
        if (!tf) continue;
        const s = wt * idf(df.get(t)) * (tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * p.len / avg));
        if (s > best) { best = s; bw = wt; }
      }
      if (best) { score += best; cov += bw * v.w; }
    }
    if (!score || (mode === 'all' && cov / total < 0.5 - 1e-9)) continue;
    scored.push({ p, score: pref.has(p.note.id) ? score * 1.3 : score });
  }
  scored.sort((a, b) => b.score - a.score);
  const top = scored.length ? scored[0].score : 0, per = new Map(), hits = [];
  for (const { p, score } of scored) {
    if (score < top * 0.35 || hits.length >= limit) break;
    if ((per.get(p.note.id) || 0) >= 2) continue;
    per.set(p.note.id, (per.get(p.note.id) || 0) + 1);
    hits.push({ note: p.note, heading: p.heading, score, excerpt: excerpt(p, vars) });
  }
  return { terms, hits };
}

// ---- the box every area shows ----
const typed = new Map(), boxes = new Map();
export const kbReset = () => { typed.clear(); };
function results(notes, o) {
  if (!notes.length) return '<p class="note">Noch keine Notizen. <a href="#wissen">Vault importieren oder Notiz anlegen ›</a></p>';
  const tq = (typed.get(o.id) || '').trim(), q = tq || o.q || '', label = tq || o.about || q;
  if (!q.trim()) return '<p class="note">Stichwort oder Frage eingeben – die Antwort kommt aus deinen Notizen.</p>';
  const r = ask(notes, q, { mode: tq ? 'all' : o.mode || 'all', prefer: o.prefer || [] });
  if (!r.hits.length) {
    return `<p class="note none">Dein Wissen enthält nichts zu „${esc(label)}“.</p>${o.create === false ? '<a class="btn" href="#wissen">Zum Wissen</a>' : newBtn('note', `Notiz zu „${label}“ anlegen`, { title: label.slice(0, 120), ...(o.preset || {}) })}`;
  }
  const n = new Set(r.hits.map(h => h.note.id)).size;
  return `<p class="kbq">Zu „${esc(label)}“ · ${r.hits.length} ${r.hits.length === 1 ? 'Stelle' : 'Stellen'} aus ${n} ${n === 1 ? 'Notiz' : 'Notizen'}</p>
  <ul class="kbl">${r.hits.map(h => `<li><blockquote class="kx">${h.excerpt || '<i>Der Titel passt – die Notiz hat noch keinen Text.</i>'}</blockquote>
  <p class="kso"><a class="ksrc" href="#wissen/n-${esc(h.note.id)}${h.heading ? '?h=' + slug(h.heading) : ''}">Quelle: ${esc(h.note.title)}${h.heading ? ' › ' + esc(h.heading) : ''}</a><small>${[h.note.path, h.note.upd ? 'geändert ' + dfmt(h.note.upd) : ''].filter(Boolean).map(esc).join(' · ')}</small></p></li>`).join('')}</ul>`;
}
// o: { id, about (what the area asks about), q (the query), mode, prefer (note ids), preset (new note), create }
export function knowledgeBox(ctx, o) {
  boxes.set(o.id, o);
  const notes = db.list(ctx, 'note'), id = esc(o.id);
  return `<section class="blk kb" aria-labelledby="kbh-${id}"><div class="bh"><h2 id="kbh-${id}">Aus deinem Wissen</h2><p>${notes.length ? `${notes.length} ${notes.length === 1 ? 'Notiz' : 'Notizen'} durchsucht` : ''}</p></div>
  <input class="tx search" type="search" data-a="kq" data-kb="${id}" value="${esc(typed.get(o.id) || '')}" placeholder="Im Wissen nachsehen …" aria-label="In deinen Notizen nachsehen" aria-describedby="kbn-${id}" autocomplete="off">
  <div id="kb-${id}" class="kbr" aria-live="polite">${results(notes, o)}</div>
  <p class="src" id="kbn-${id}">Zeigt Stellen aus deinen Notizen mit Quelle – Life OS erfindet nichts dazu.</p></section>`;
}
// Typing redraws only the results, so the field keeps focus.
export function kbInput(t, ctx) {
  if (!t || !t.dataset || t.dataset.a !== 'kq') return false;
  const o = boxes.get(t.dataset.kb);
  typed.set(t.dataset.kb, t.value);
  const el = typeof document !== 'undefined' && document.getElementById('kb-' + t.dataset.kb);
  if (el && o) el.innerHTML = results(db.list(ctx, 'note'), o);
  return true;
}
