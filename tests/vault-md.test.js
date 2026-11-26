import test from 'node:test';
import assert from 'node:assert/strict';
import { splitFrontmatter, parseProps, propValues, inlineTags, linkTargets, makeResolver, renderMd, plainText, noteLinks } from '../js/areas/cockpit/md.js';

test('front matter is split off as written; no or unclosed front matter leaves the text whole', () => {
  assert.deepEqual(splitFrontmatter('---\ntags: [a, b]\ntitle: "X"\n---\nText\n'), { fm: 'tags: [a, b]\ntitle: "X"', body: 'Text\n' });
  assert.deepEqual(splitFrontmatter('---\r\nalias: Y\r\n---\r\n\r\nZeile\r\n'), { fm: 'alias: Y', body: '\nZeile\n' });
  assert.deepEqual(splitFrontmatter('Nur Text'), { fm: '', body: 'Nur Text' });
  assert.deepEqual(splitFrontmatter('---\nkein Ende'), { fm: '', body: '---\nkein Ende' });
});

test('properties: plain values, quoted values, inline and block lists, nested blocks kept as text', () => {
  const p = parseProps('title: "Mein: Titel"\ntags: [lernen, "mathe"]\naliases:\n  - Erste\n  - \'Zweite\'\nstatus: offen\nort:\n  stadt: Neuffen\nleer:');
  assert.deepEqual(p, [
    { k: 'title', v: 'Mein: Titel' }, { k: 'tags', v: ['lernen', 'mathe'] }, { k: 'aliases', v: ['Erste', 'Zweite'] },
    { k: 'status', v: 'offen' }, { k: 'ort', v: 'stadt: Neuffen' }, { k: 'leer', v: '' },
  ]);
  assert.deepEqual(propValues(p, 'tags', 'tag'), ['lernen', 'mathe']);
  assert.deepEqual(propValues(parseProps('tags: a, #b c'), 'tags'), ['a', 'b', 'c']);
  assert.deepEqual(parseProps('kaputt\n: x\n'), []);
});

test('inline tags like Obsidian: not headings, code, links or plain numbers', () => {
  const body = '#lernen und #mathe/analysis, #Prüfung\n# Überschrift\n`#code` und https://x.de/#frag und #123\n```\n#imcode\n```\n(#klammer)';
  assert.deepEqual(inlineTags(body), ['lernen', 'mathe/analysis', 'Prüfung', 'klammer']);
});

test('link targets: wiki links with alias or section, embeds, Markdown links to files, never code or the web', () => {
  const body = '[[A]] [[B|Alias]] [[C#Teil]] ![[bild.png]] [md](Ordner/D.md) [web](https://x.de) ![x](img%20a.png) `[[code]]` [[#Nur Abschnitt]] [[A]]';
  assert.deepEqual(linkTargets(body), [
    { t: 'A', embed: false, sub: '' }, { t: 'B', embed: false, sub: '' }, { t: 'C', embed: false, sub: 'Teil' },
    { t: 'bild.png', embed: true, sub: '' }, { t: 'Ordner/D.md', embed: false, sub: '' }, { t: 'img a.png', embed: true, sub: '' },
  ]);
});

const VAULT = [
  { id: 'p1', title: 'Sensito', path: 'Projekte/Sensito.md', body: '', tags: [], aliases: [] },
  { id: 'a1', title: 'Sensito', path: 'Archiv/2025/Sensito.md', body: '', tags: [], aliases: [] },
  { id: 'i1', title: 'Ideen', path: 'Ideen.md', body: '', tags: [], aliases: ['Brainstorm'] },
  { id: 'm1', title: 'In der App', body: '', tags: [] },
];

test('links resolve like Obsidian: path, same folder, shortest path, title, alias', () => {
  const r = makeResolver(VAULT, ['Anhänge/bild.png', 'Projekte/bild.png', 'doc.pdf']);
  assert.equal(r.note('Sensito', 'Projekte/Plan.md').id, 'p1');
  assert.equal(r.note('Sensito', 'Archiv/2025/Alt.md').id, 'a1');
  assert.equal(r.note('Sensito', 'Ideen.md').id, 'p1');
  assert.equal(r.note('Archiv/2025/Sensito').id, 'a1');
  assert.equal(r.note('2025/Sensito.md').id, 'a1');
  assert.equal(r.note('../Ideen.md', 'Projekte/Plan.md').id, 'i1');
  assert.equal(r.note('brainstorm').id, 'i1');
  assert.equal(r.note('in der app').id, 'm1');
  assert.equal(r.note('Fehlt'), null);
  assert.equal(r.att('bild.png', 'Projekte/Plan.md'), 'Projekte/bild.png');
  assert.equal(r.att('BILD.png', 'Ideen.md'), 'Anhänge/bild.png');
  assert.equal(r.att('Anhänge/bild.png'), 'Anhänge/bild.png');
  assert.equal(r.att('fehlt.png'), null);
});

test('outgoing links and backlinks follow the same rules', () => {
  const notes = [...VAULT, { id: 'x', title: 'Plan', path: 'Projekte/Plan.md', body: 'Siehe [[Sensito]], [[Brainstorm|Ideen]] und [[Neu]] ![[bild.png]]', tags: [], aliases: [] }];
  const { out, back } = noteLinks(notes[4], notes);
  assert.deepEqual(out, [{ title: 'Sensito', id: 'p1' }, { title: 'Brainstorm', id: 'i1' }, { title: 'Neu', id: null }]);
  assert.deepEqual(noteLinks(notes[0], notes).back.map(n => n.id), ['x']);
  assert.deepEqual(back, []);
});

const R = makeResolver(VAULT, ['Anhänge/bild.png', 'doc.pdf']);
const md = (s, from = 'Ideen.md') => renderMd(s, { resolve: R, from });

test('Markdown shows as headings, lists, tasks, quotes, tables and code, all escaped', () => {
  const html = md('# Titel\n\nText mit **fett**, *kursiv*, ==markiert== und ~~weg~~.\nZweite Zeile\n\n- eins\n  - unter\n- [x] erledigt\n- [ ] offen\n\n1. erste\n2. zweite\n\n> Zitat\n\n> [!tip] Merke\n> Inhalt\n\n| A | B |\n|---|---|\n| 1 | <b>2</b> |\n\n```js\nconst x = "<script>";\n```\n\n---');
  assert.match(html, /<h2 id="h-titel">Titel<\/h2>/);
  assert.match(html, /<strong>fett<\/strong>, <em>kursiv<\/em>, <mark>markiert<\/mark> und <s>weg<\/s>\.<br>Zweite Zeile/);
  assert.match(html, /<ul><li>eins<ul><li>unter<\/li><\/ul><\/li><li class="task done"><span role="img" aria-label="erledigt">☑<\/span> erledigt<\/li><li class="task"><span role="img" aria-label="offen">☐<\/span> offen<\/li><\/ul>/);
  assert.match(html, /<ol><li>erste<\/li><li>zweite<\/li><\/ol>/);
  assert.match(html, /<blockquote><p>Zitat<\/p><\/blockquote>/);
  assert.match(html, /<div class="callout"><p class="ct">Merke<\/p><p>Inhalt<\/p><\/div>/);
  assert.match(html, /<table><thead><tr><th>A<\/th><th>B<\/th><\/tr><\/thead><tbody><tr><td>1<\/td><td>&lt;b&gt;2&lt;\/b&gt;<\/td><\/tr><\/tbody><\/table>/);
  assert.match(html, /<pre><code>const x = &quot;&lt;script&gt;&quot;;<\/code><\/pre>/);
  assert.match(html, /<hr>/);
  assert.doesNotMatch(html, /<script|<b>/);
});

test('links: notes open in the app, missing ones offer a new note, the web opens outside, images stay local', () => {
  const html = md('[[Sensito|Projekt]] [[Ideen#Neue Ideen]] [[Fehlt]] [web](https://x.de) https://y.de/a. [bad](javascript:alert(1)) ![[bild.png]] ![[doc.pdf]] ![[weg.png]] ![ext](https://z.de/i.png) #tag <img src=x onerror=alert(1)>');
  assert.match(html, /<a class="wl" href="#wissen\/n-p1">Projekt<\/a>/);
  assert.match(html, /<a class="wl" href="#wissen\/n-i1\?h=neue-ideen">Ideen › Neue Ideen<\/a>/);
  assert.match(html, /<button class="wl miss" type="button" data-a="mknote" data-t="Fehlt" title="Notiz anlegen">Fehlt ＋<\/button>/);
  assert.match(html, /<a href="https:\/\/x\.de" target="_blank" rel="noopener noreferrer">web<\/a>/);
  assert.match(html, /<a href="https:\/\/y\.de\/a" target="_blank" rel="noopener noreferrer">https:\/\/y\.de\/a<\/a>\./);
  assert.doesNotMatch(html, /href="javascript/);
  assert.match(html, /<img class="natt" data-att="Anhänge\/bild\.png" alt="bild\.png" loading="lazy">/);
  assert.match(html, /<button class="wl" type="button" data-a="attopen" data-p="doc\.pdf">doc\.pdf öffnen<\/button>/);
  assert.match(html, /<span class="wl miss">Anhang fehlt: weg\.png<\/span>/);
  assert.match(html, /<a href="https:\/\/z\.de\/i\.png" target="_blank" rel="noopener noreferrer">Bild im Web: ext<\/a>/);
  assert.match(html, /<a class="tagl" href="#wissen" data-a="tagq" data-v="tag">#tag<\/a>/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('plain text for excerpts drops the markup', () => {
  assert.equal(plainText('## Kopf\n**Fett** und [[Ziel|Alias]], [Text](x.md), ![[b.png]] `code`\n- Punkt'), 'Kopf Fett und Alias, Text, code Punkt');
});
