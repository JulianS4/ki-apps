import test from 'node:test';
import assert from 'node:assert/strict';
import { crc32, zip, notesMarkdown } from '../js/areas/cockpit/zip.js';

test('crc32 matches the known value', () => {
  assert.equal(crc32(new TextEncoder().encode('hello')), 0x3610a686);
});

test('zip writes stored entries with names and an end record', () => {
  const z = zip([{ name: 'a.md', data: new TextEncoder().encode('hallo') }, { name: 'ü.md', data: new Uint8Array() }]);
  const s = Buffer.from(z).toString('latin1');
  assert.equal(s.slice(0, 4), 'PK\x03\x04');
  assert.ok(s.includes('a.md') && s.includes('hallo'));
  assert.equal((s.match(/PK\x01\x02/g) || []).length, 2);
  const end = s.lastIndexOf('PK\x05\x06');
  assert.ok(end > 0);
  assert.equal(z[end + 10] | (z[end + 11] << 8), 2);
});

test('notes become Markdown files with front matter, unique and safe names', () => {
  const files = notesMarkdown([
    { title: 'Preise: Liste?', body: 'siehe [[Andere]]', tags: ['a', 'b'], topic: 'business', projects: ['p'], created: '2026-11-01', upd: '2026-11-02' },
    { title: 'Preise: Liste?', body: '', tags: [], topic: 'ki', projects: [], created: '2026-11-03' },
  ], [{ id: 'p', name: 'Sensito' }]);
  assert.deepEqual(files.map(f => f.name), ['Preise Liste.md', 'Preise Liste (2).md']);
  const text = new TextDecoder().decode(files[0].data);
  assert.match(text, /^---\ntitle: "Preise: Liste\?"\ntags: \[a, b\]\nbereich: Business & Projekte\nprojekte: \[Sensito\]\nerstellt: 2026-11-01\ngeaendert: 2026-11-02\n---\n\nsiehe \[\[Andere\]\]\n$/);
});
