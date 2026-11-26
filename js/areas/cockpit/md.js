// Markdown as Obsidian writes it: front matter, tags, [[links]] that resolve the
// way Obsidian resolves them, and a view that escapes everything it shows.
import { esc, slug } from '../../core/html.js';

export const norm = v => String(v ?? '').toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '');
const lf = s => String(s ?? '').replace(/\r\n?/g, '\n');

// ---- front matter ----
export function splitFrontmatter(text) {
  const s = lf(text).replace(/^﻿/, ''), m = /^---\n(?:([\s\S]*?)\n)?(?:---|\.\.\.)[ \t]*(?:\n|$)/.exec(s);
  return m ? { fm: m[1] || '', body: s.slice(m[0].length) } : { fm: '', body: s };
}
const unquote = v => {
  const s = v.trim();
  if (/^"[\s\S]*"$/.test(s)) return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  if (/^'[\s\S]*'$/.test(s)) return s.slice(1, -1).replace(/''/g, "'");
  return s;
};
// The YAML that notes really use: scalars, [a, b], "- item" lists, | and > blocks.
// Anything deeper is kept as text, so nothing is lost and nothing throws.
export function parseProps(fm) {
  const lines = lf(fm).split('\n'), out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^([\p{L}\p{N}_][^:]*?)\s*:(?:[ \t]+(.*?))?[ \t]*$/u.exec(lines[i]);
    if (!m) continue;
    const k = m[1].trim(), v = (m[2] || '').trim(), sub = [];
    while (i + 1 < lines.length && (/^\s+\S/.test(lines[i + 1]) || /^-\s/.test(lines[i + 1]) || (!lines[i + 1].trim() && /^[|>]/.test(v)))) sub.push(lines[++i]);
    if (/^[|>][+-]?$/.test(v)) out.push({ k, v: sub.map(l => l.trim()).join(v[0] === '|' ? '\n' : ' ').trim() });
    else if (v) out.push({ k, v: /^\[.*\]$/.test(v) ? v.slice(1, -1).split(',').map(unquote).filter(Boolean) : unquote(v) });
    else if (sub.length && sub.every(l => /^\s*-(\s|$)/.test(l))) out.push({ k, v: sub.map(l => unquote(l.replace(/^\s*-\s?/, ''))).filter(Boolean) });
    else out.push({ k, v: sub.map(l => l.trim()).join('\n') });
  }
  return out;
}
const uniq = arr => arr.filter((t, i) => arr.findIndex(x => norm(x) === norm(t)) === i);
export function propValues(props, ...keys) {
  const ks = keys.map(k => k.toLowerCase()), tag = ks.includes('tags') || ks.includes('tag'), out = [];
  for (const p of props) {
    if (!ks.includes(p.k.toLowerCase())) continue;
    for (const x of Array.isArray(p.v) ? p.v : String(p.v).split(tag ? /[,\s]+/ : /,/)) {
      const v = tag ? String(x).trim().replace(/^#+/, '') : String(x).trim();
      if (v) out.push(v);
    }
  }
  return uniq(out);
}

// ---- tags and links (never inside code) ----
function dropCode(s) {
  const out = [];
  let fence = null;
  for (const line of lf(s).split('\n')) {
    const m = /^\s*(`{3,}|~{3,})/.exec(line);
    if (fence) { if (m && m[1][0] === fence[0] && m[1].length >= fence.length) fence = null; out.push(''); continue; }
    if (m) { fence = m[1]; out.push(''); continue; }
    out.push(line.replace(/`[^`]*`/g, ' '));
  }
  return out.join('\n');
}
const TAG = /(^|[\s(,;])#((?=[\p{L}\p{N}_/-]*[\p{L}_])[\p{L}\p{N}_/-]+)/gu;
export const inlineTags = body => uniq([...dropCode(body).matchAll(TAG)].map(m => m[2].replace(/\/+$/, '')));

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const decode = u => { try { return decodeURI(u); } catch (e) { return u; } };
function wikiParts(inner) {
  const bar = inner.indexOf('|'), raw = bar < 0 ? inner : inner.slice(0, bar), h = raw.indexOf('#');
  return { t: (h < 0 ? raw : raw.slice(0, h)).trim(), sub: h < 0 ? '' : raw.slice(h + 1).replace(/^\^/, '').trim(), alias: bar < 0 ? '' : inner.slice(bar + 1).trim() };
}
const LINK = /(!?)\[\[([^\]\n]+?)\]\]|(!?)\[([^\]\n]*)\]\(([^)\s]+)(?:\s+"[^"\n]*")?\)/g;
export function linkTargets(body) {
  const out = [], seen = new Set();
  for (const m of dropCode(body).matchAll(LINK)) {
    let t, sub, embed;
    if (m[2] !== undefined) ({ t, sub } = wikiParts(m[2])), embed = !!m[1];
    else {
      if (SCHEME.test(m[5])) continue;
      const u = decode(m[5]), h = u.indexOf('#');
      t = (h < 0 ? u : u.slice(0, h)).trim(); sub = h < 0 ? '' : u.slice(h + 1); embed = !!m[3];
    }
    const key = (embed ? '!' : '') + norm(t);
    if (!t || seen.has(key)) continue;
    seen.add(key);
    out.push({ t, embed, sub });
  }
  return out;
}

// ---- resolving: path, same folder, shortest path, then title and aliases ----
const P = s => norm(s).replace(/\\/g, '/').replace(/^(\.\/)+/, '').replace(/^\/+/, '');
const noMd = s => s.replace(/\.md$/, '');
const dirOf = p => p.slice(0, Math.max(0, p.lastIndexOf('/')));
export const baseOf = p => String(p).slice(String(p).lastIndexOf('/') + 1);
function join(dir, rel) {
  const parts = dir ? dir.split('/') : [];
  for (const seg of rel.split('/')) { if (seg === '..') parts.pop(); else if (seg && seg !== '.') parts.push(seg); }
  return parts.join('/');
}
export const FILE_EXT = /\.(png|jpe?g|gif|webp|svg|avif|bmp|pdf|mp3|m4a|wav|ogg|webm|mp4|mov|canvas|docx?|xlsx?|pptx?|zip|csv|txt)$/i;
export const IMG_EXT = /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i;

export function makeResolver(notes, atts = []) {
  const byPath = new Map(), byBase = new Map(), byTitle = new Map(), byAlias = new Map(), aPath = new Map(), aBase = new Map();
  const add = (m, k, v) => { if (!k) return; const l = m.get(k); if (l) l.push(v); else m.set(k, [v]); };
  for (const n of notes) {
    if (n.path) { const p = noMd(P(n.path)); byPath.set(p, n); add(byBase, baseOf(p), n); }
    add(byTitle, norm(n.title).trim(), n);
    for (const a of n.aliases || []) add(byAlias, norm(a).trim(), n);
  }
  for (const a of atts) { const p = P(a); aPath.set(p, a); add(aBase, baseOf(p), a); }
  const key = x => (typeof x === 'string' ? P(x) : x.path ? noMd(P(x.path)) : '');
  const pick = (list, from) => {
    if (!list || !list.length) return null;
    if (list.length === 1) return list[0];
    if (from != null) { const d = dirOf(P(from)), same = list.find(x => dirOf(key(x)) === d); if (same) return same; }
    return [...list].sort((a, b) => key(a).length - key(b).length || (key(a) < key(b) ? -1 : 1))[0];
  };
  const suffix = (map, k, from) => pick([...map.entries()].filter(([p]) => p.endsWith('/' + k)).map(e => e[1]), from);
  return {
    note(target, from) {
      const t = wikiParts(String(target ?? '')).t;
      if (!t) return null;
      const k = noMd(P(t));
      if (k.includes('/')) return byPath.get(k) || (from ? byPath.get(join(dirOf(P(from)), k)) : null) || suffix(byPath, k, from);
      return pick(byBase.get(k), from) || pick(byTitle.get(norm(t)), from) || pick(byAlias.get(norm(t)), from);
    },
    att(target, from) {
      const t = wikiParts(String(target ?? '')).t;
      if (!t) return null;
      const k = P(t);
      return aPath.get(k) || (from ? aPath.get(join(dirOf(P(from)), k)) : null) || (k.includes('/') ? suffix(aPath, k, from) : pick(aBase.get(k), from)) || null;
    },
  };
}

// Links out (to notes, missing ones by name) and the notes that link here.
export function noteLinks(note, notes, r = makeResolver(notes)) {
  const out = [], seen = new Set();
  for (const l of linkTargets(note.body)) {
    const n = r.note(l.t, note.path);
    if (!n && (l.embed || FILE_EXT.test(l.t))) continue;
    const k = n ? n.id : norm(l.t);
    if (seen.has(k) || (n && n.id === note.id)) continue;
    seen.add(k);
    out.push({ title: l.t, id: n ? n.id : null });
  }
  const back = notes.filter(n => n.id !== note.id && linkTargets(n.body).some(l => { const x = r.note(l.t, n.path); return x && x.id === note.id; }));
  return { out, back };
}

// ---- the view: escaped first, then marked up ----
const ext = (url, label) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
const attBtn = (a, label) => `<button class="wl" type="button" data-a="attopen" data-p="${esc(a)}">${esc(label || baseOf(a))} öffnen</button>`;
const img = (a, alt) => `<img class="natt" data-att="${esc(a)}" alt="${esc(alt || baseOf(a))}" loading="lazy">`;
const missing = t => `<span class="wl miss">Anhang fehlt: ${esc(t)}</span>`;
const noteHref = (n, sub) => `#wissen/n-${esc(n.id)}${sub ? '?h=' + slug(sub) : ''}`;

function wiki(inner, embed, o) {
  const { t, sub, alias } = wikiParts(inner);
  if (!t) return esc(alias || sub);
  if (embed) {
    const a = o.r.att(t, o.from);
    if (a) return IMG_EXT.test(a) ? img(a, /^\d+(x\d+)?$/.test(alias) ? '' : alias) : attBtn(a, alias);
    const n = o.r.note(t, o.from);
    return n ? `<a class="wl emb" href="${noteHref(n, sub)}">↳ ${esc(n.title)}</a>` : missing(t);
  }
  const n = o.r.note(t, o.from);
  if (n) return `<a class="wl" href="${noteHref(n, sub)}">${esc(alias || (sub ? `${t} › ${sub}` : t))}</a>`;
  const a = o.r.att(t, o.from);
  if (a) return attBtn(a, alias);
  return `<button class="wl miss" type="button" data-a="mknote" data-t="${esc(t)}" title="Notiz anlegen">${esc(alias || t)} ＋</button>`;
}
function mdLink(text, url, isImg, o) {
  if (/^(https?:|mailto:)/i.test(url)) return ext(url, isImg ? `Bild im Web: ${text || url}` : text || url);
  if (SCHEME.test(url)) return esc(text);
  const u = decode(url), h = u.indexOf('#'), t = (h < 0 ? u : u.slice(0, h)).trim(), sub = h < 0 ? '' : u.slice(h + 1);
  if (isImg) { const a = o.r.att(t, o.from); return a ? img(a, text) : missing(t); }
  if (!t) return esc(text);
  const n = o.r.note(t, o.from);
  if (n) return `<a class="wl" href="${noteHref(n, sub)}">${esc(text || n.title)}</a>`;
  const a = o.r.att(t, o.from);
  return a ? attBtn(a, text) : `<span class="wl miss">${esc(text || t)}</span>`;
}
function inline(src, o) {
  const keep = [], k = h => `\u0000${keep.push(h) - 1}\u0000`;
  let s = src.replace(/`([^`]+)`/g, (m, c) => k(`<code>${esc(c)}</code>`))
    .replace(/(!?)\[\[([^\]\n]+?)\]\]/g, (m, b, inner) => k(wiki(inner, !!b, o)))
    .replace(/(!?)\[([^\]\n]*)\]\(([^)\s]+)(?:\s+"[^"\n]*")?\)/g, (m, b, text, url) => k(mdLink(text, url, !!b, o)))
    .replace(/(^|[\s(])(https?:\/\/[^\s<>()"']*[^\s<>()"'.,;:!?])/g, (m, pre, url) => pre + k(ext(url, url)));
  s = esc(s)
    .replace(/\*\*(?=\S)([^*]*?\S)\*\*/g, '<strong>$1</strong>').replace(/__(?=\S)([^_]*?\S)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*(?=\S)([^*]*?\S)\*(?!\*)/g, '$1<em>$2</em>').replace(/(^|[^_\w])_(?=\S)([^_]*?\S)_(?![_\w])/g, '$1<em>$2</em>')
    .replace(/~~(?=\S)(.*?\S)~~/g, '<s>$1</s>').replace(/==(?=\S)(.*?\S)==/g, '<mark>$1</mark>')
    .replace(TAG, (m, pre, t) => `${pre}<a class="tagl" href="#wissen" data-a="tagq" data-v="${t}">#${t}</a>`);
  return s.replace(/\u0000(\d+)\u0000/g, (m, n) => keep[+n]);
}

const FENCE = /^\s*(`{3,}|~{3,})/, HEAD = /^(#{1,6})\s+(.*?)\s*#*\s*$/, HR = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/, QUOTE = /^\s*>/;
const LI = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/, SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const cells = l => l.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '').split(/(?<!\\)\|/).map(c => c.replace(/\\\|/g, '|').trim());
const isTable = (l, next) => l.includes('|') && next !== undefined && SEP.test(next) && next.includes('-');
const startsBlock = (l, next) => FENCE.test(l) || HEAD.test(l) || HR.test(l) || QUOTE.test(l) || LI.test(l) || isTable(l, next);
const indentOf = s => s.replace(/\t/g, '    ').length;

function listHtml(items, o) {
  let pos = 0;
  const li = it => {
    const t = /^\[([ xX/-])\]\s+(.*)$/.exec(it.text);
    if (!t) return `<li>${inline(it.text, o)}</li>`;
    const done = t[1] !== ' ' && t[1] !== '/';
    return `<li class="task${done ? ' done' : ''}"><span role="img" aria-label="${done ? 'erledigt' : 'offen'}">${done ? '☑' : '☐'}</span> ${inline(t[2], o)}</li>`;
  };
  const level = () => {
    const first = items[pos], ind = first.indent, tag = first.ordered ? 'ol' : 'ul';
    const start = first.ordered && first.n !== 1 ? ` start="${first.n}"` : '';
    let html = '';
    while (pos < items.length && items[pos].indent >= ind) {
      if (items[pos].indent > ind) { html = html.endsWith('</li>') ? html.slice(0, -5) + level() + '</li>' : html + level(); continue; }
      html += li(items[pos++]);
    }
    return `<${tag}${start}>${html}</${tag}>`;
  };
  let out = '';
  while (pos < items.length) out += level();
  return out;
}

function blocks(lines, o) {
  const out = [];
  let i = 0, m;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    if ((m = FENCE.exec(l))) {
      const f = m[1], code = [];
      i++;
      while (i < lines.length && !(FENCE.test(lines[i]) && FENCE.exec(lines[i])[1][0] === f[0] && FENCE.exec(lines[i])[1].length >= f.length)) code.push(lines[i++]);
      i++;
      out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
    } else if ((m = HEAD.exec(l))) {
      const lv = Math.min(6, m[1].length + 1);
      out.push(`<h${lv} id="h-${slug(m[2])}">${inline(m[2], o)}</h${lv}>`);
      i++;
    } else if (HR.test(l)) { out.push('<hr>'); i++; }
    else if (QUOTE.test(l)) {
      const q = [];
      while (i < lines.length && QUOTE.test(lines[i])) q.push(lines[i++].replace(/^\s*> ?/, ''));
      const c = /^\[!([\w-]+)\][+-]?\s*(.*)$/.exec(q[0]);
      out.push(c ? `<div class="callout"><p class="ct">${inline(c[2] || c[1].charAt(0).toUpperCase() + c[1].slice(1), o)}</p>${blocks(q.slice(1), o)}</div>` : `<blockquote>${blocks(q, o)}</blockquote>`);
    } else if (isTable(l, lines[i + 1])) {
      const head = cells(l), rows = [];
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(cells(lines[i++]));
      out.push(`<div class="mtbl"><table><thead><tr>${head.map(c => `<th>${inline(c, o)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${inline(c, o)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
    } else if (LI.test(l)) {
      const items = [];
      while (i < lines.length) {
        const x = LI.exec(lines[i]);
        // a switch between "-" and "1." on the top level starts a new list
        if (x && items.length && indentOf(x[1]) <= items[0].indent && /\d/.test(x[2]) !== items[0].ordered) break;
        if (x) { items.push({ indent: indentOf(x[1]), ordered: /\d/.test(x[2]), n: parseInt(x[2], 10), text: x[3] }); i++; }
        else if (lines[i].trim() && /^\s+/.test(lines[i]) && items.length) items[items.length - 1].text += ' ' + lines[i++].trim();
        else if (!lines[i].trim() && i + 1 < lines.length && LI.test(lines[i + 1])) i++;
        else break;
      }
      out.push(listHtml(items, o));
    } else {
      const p = [];
      while (i < lines.length && lines[i].trim() && (!p.length || !startsBlock(lines[i], lines[i + 1]))) p.push(lines[i++]);
      out.push(`<p>${p.map(x => inline(x.trim(), o)).join('<br>')}</p>`);
    }
  }
  return out.join('');
}
export const renderMd = (body, { resolve, from = '' } = {}) => blocks(lf(body).split('\n'), { r: resolve || makeResolver([]), from });

// Text without markup, for excerpts and search.
export function plainText(md) {
  return lf(md).replace(/^\s*(`{3,}|~{3,}).*$/gm, ' ').replace(/!\[\[[^\]\n]*\]\]/g, ' ').replace(/!\[[^\]\n]*\]\([^)\n]*\)/g, ' ')
    .replace(/\[\[([^\]\n|#]*)(?:#[^\]\n|]*)?(?:\|([^\]\n]*))?\]\]/g, (m, t, a) => a || t).replace(/\[([^\]\n]*)\]\([^)\n]*\)/g, '$1')
    .replace(/^\s*#{1,6}\s+/gm, '').replace(/^\s*>\s?(\[![\w-]+\][+-]?\s*)?/gm, '').replace(/^\s*([-*+]|\d+[.)])\s+(\[.\]\s+)?/gm, '')
    .replace(/^\s*([-*_])(\s*\1){2,}\s*$/gm, ' ').replace(/^\s*\|?\s*:?-{2,}.*$/gm, ' ').replace(/\|/g, ' ')
    .replace(/(\*\*|__|~~|==|`)/g, '').replace(/(^|\W)[*_](?=\S)([^*_\n]*?\S)[*_](?=\W|$)/g, '$1$2')
    .replace(/\s+/g, ' ').trim();
}
