// Notes as Markdown files in a plain (uncompressed) ZIP, readable by Obsidian and any unzip tool.
import { label, TOPICS } from './data.js';

const TABLE = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
export function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function zip(files) {
  const enc = new TextEncoder(), parts = [], central = [];
  let off = 0;
  const DATE = 33, TIME = 0; // 1.1.1980: file times say nothing here
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data), size = f.data.length;
    const lh = new DataView(new ArrayBuffer(30));
    [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, TIME, 2], [12, DATE, 2], [14, crc, 4], [18, size, 4], [22, size, 4], [26, name.length, 2], [28, 0, 2]]
      .forEach(([o, v, n]) => (n === 4 ? lh.setUint32(o, v, true) : lh.setUint16(o, v, true)));
    const ch = new DataView(new ArrayBuffer(46));
    [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, TIME, 2], [14, DATE, 2], [16, crc, 4], [20, size, 4], [24, size, 4], [28, name.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, off, 4]]
      .forEach(([o, v, n]) => (n === 4 ? ch.setUint32(o, v, true) : ch.setUint16(o, v, true)));
    parts.push(new Uint8Array(lh.buffer), name, f.data);
    central.push(new Uint8Array(ch.buffer), name);
    off += 30 + name.length + size;
  }
  const cdSize = central.reduce((s, p) => s + p.length, 0), end = new DataView(new ArrayBuffer(22));
  [[0, 0x06054b50, 4], [4, 0, 2], [6, 0, 2], [8, files.length, 2], [10, files.length, 2], [12, cdSize, 4], [16, off, 4], [20, 0, 2]]
    .forEach(([o, v, n]) => (n === 4 ? end.setUint32(o, v, true) : end.setUint16(o, v, true)));
  const all = [...parts, ...central, new Uint8Array(end.buffer)], out = new Uint8Array(all.reduce((s, p) => s + p.length, 0));
  let p = 0;
  for (const a of all) { out.set(a, p); p += a.length; }
  return out;
}

// One file per note, named after its title so [[links]] keep working in Obsidian.
// Notes from a vault go back to their own path, front matter and text as imported.
export function notesMarkdown(notes, projects) {
  const enc = new TextEncoder(), used = new Set(notes.filter(n => n.path).map(n => n.path.toLowerCase()));
  return [...notes.filter(n => n.path), ...notes.filter(n => !n.path)].map(n => {
    if (n.path) return { name: n.path, data: enc.encode(`${n.fm ? `---\n${n.fm}\n---\n` : ''}${n.body}`) };
    const base = n.title.replace(/[\\/:*?"<>|#^[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Notiz';
    let name = base + '.md';
    for (let i = 2; used.has(name.toLowerCase()); i++) name = `${base} (${i}).md`;
    used.add(name.toLowerCase());
    const pn = n.projects.map(id => (projects.find(p => p.id === id) || { name: id }).name);
    const head = ['---', `title: ${JSON.stringify(n.title)}`, `tags: [${n.tags.join(', ')}]`, `bereich: ${label(TOPICS, n.topic)}`, `projekte: [${pn.join(', ')}]`,
      n.created ? `erstellt: ${n.created}` : '', n.upd ? `geaendert: ${n.upd}` : '', '---'].filter(Boolean).join('\n');
    return { name, data: enc.encode(`${head}\n\n${n.body}\n`) };
  });
}
