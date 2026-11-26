import test from 'node:test';
import assert from 'node:assert/strict';
import { zip } from '../js/areas/cockpit/zip.js';
import { mkzip } from './helpers.js';
import { listZip, readEntry, CP437 } from '../js/areas/cockpit/unzip.js';

const enc = s => new TextEncoder().encode(s);
const dec = b => new TextDecoder().decode(b);

test('reads back what the app itself zips', async () => {
  const z = zip([{ name: 'Ordner/Notiz.md', data: enc('# Hallo') }, { name: 'b.md', data: enc('') }]);
  const { entries, problems } = listZip(z);
  assert.deepEqual(problems, []);
  assert.deepEqual(entries.map(e => e.name), ['Ordner/Notiz.md', 'b.md']);
  assert.equal(dec(await readEntry(z, entries[0])), '# Hallo');
  assert.equal((await readEntry(z, entries[1])).length, 0);
});

test('unpacks deflated entries with UTF-8 names', async () => {
  const text = 'Prüfung am Montag\n'.repeat(50);
  const z = mkzip([{ name: 'Schule/Prüfung.md', data: enc(text), deflate: true, utf8: true }]);
  const { entries } = listZip(z);
  assert.equal(entries[0].name, 'Schule/Prüfung.md');
  assert.equal(dec(await readEntry(z, entries[0])), text);
});

test('names without the UTF-8 flag: UTF-8 when valid, else the old DOS code page', () => {
  assert.equal(CP437.length, 128);
  const z = mkzip([
    { nameBytes: enc('Bücher.md'), data: enc('a') },
    { nameBytes: new Uint8Array([0x42, 0x81, 0x63, 0x68, 0x2e, 0x6d, 0x64]), data: enc('b') },
  ]);
  assert.deepEqual(listZip(z).entries.map(e => e.name), ['Bücher.md', 'Büch.md']);
});

test('folders are left out; locked or unknown entries are named, not thrown', () => {
  const z = mkzip([
    { name: 'Ordner/', data: new Uint8Array() },
    { name: 'geheim.md', data: enc('x'), encrypted: true },
    { name: 'neu.md', data: enc('x'), method: 14 },
    { name: 'ok.md', data: enc('x') },
  ]);
  const { entries, problems } = listZip(z);
  assert.deepEqual(entries.map(e => e.name), ['ok.md']);
  assert.deepEqual(problems, [{ path: 'geheim.md', why: 'passwortgeschützt' }, { path: 'neu.md', why: 'unbekannte Komprimierung' }]);
});

test('anything that is not a ZIP says so', () => {
  assert.throws(() => listZip(enc('kein zip')), /Keine ZIP-Datei/);
  assert.throws(() => listZip(new Uint8Array()), /Keine ZIP-Datei/);
});
