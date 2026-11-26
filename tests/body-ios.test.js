// iPhone paths the desktop preview cannot show: the camera returning after a
// redraw, images that fail to load, and the backup download within the tap.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as body from '../js/areas/body/index.js';
import * as settings from '../js/areas/settings.js';
import { memPhotos } from '../js/areas/body/photos.js';
import { createStore } from '../js/core/store.js';
import { memBackend } from './helpers.js';

const PH = { area: 'body', view: 'photos' }, SET = { area: 'settings' };
const mk = () => {
  const store = createStore(memBackend());
  const ctx = { store, now: () => new Date(2026, 10, 26, 9, 0), status: '', setStatus(t) { ctx.status = t; }, toast() {}, rerender() {}, go() {}, reloadAll() {}, prevHash: null };
  body.onNavigate(PH, ctx);
  return ctx;
};
// Minimal DOM stand-ins for mount().
const el = (dataset = {}) => ({
  dataset, isConnected: true, listeners: {},
  addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); },
  replaceWith(n) { this.replaced = n; },
});
const root = els => ({ querySelectorAll: sel => els.filter(e => (sel.includes('pfile') ? e.dataset.a === 'pfile' : sel.includes('data-photo') ? 'photo' in e.dataset : false)) });
const small = async () => new Blob(['small'], { type: 'image/jpeg' });

test('a camera photo arriving after a redraw is still saved', async () => {
  const ctx = mk(), s = memPhotos();
  body.setPhotoStore(s);
  body.setResizer(small);
  const input = el({ a: 'pfile', pose: 'vorne' });
  body.mount(root([input]), PH, ctx);
  input.isConnected = false; // the page was redrawn while the camera was open
  input.files = [new Blob(['big'])];
  await Promise.all(input.listeners.change.map(f => f({ target: input })));
  assert.deepEqual(ctx.store.get('body.photos'), { '2026-11-26': { vorne: true } });
  assert.equal(body.onChange({ target: { dataset: { a: 'pfile', pose: 'hinten' }, files: [new Blob(['x'])] } }, PH, ctx), undefined);
  assert.deepEqual(ctx.store.get('body.photos'), { '2026-11-26': { vorne: true } });
});

test('a photo that cannot be read says so; a missing one says it is not here', async () => {
  globalThis.document = { createElement: () => ({}) };
  const ctx = mk(), broken = { ...memPhotos(), get: async k => { if (k.endsWith('vorne')) throw new Error('lost'); return null; } };
  body.setPhotoStore(broken);
  const a = el({ photo: '2026-11-02:vorne' }), b = el({ photo: '2026-11-02:hinten' });
  body.mount(root([a, b]), PH, ctx);
  await new Promise(r => setTimeout(r, 10));
  assert.equal(a.replaced.textContent, 'Foto konnte nicht geladen werden');
  assert.equal(b.replaced.textContent, 'Foto nicht auf diesem Gerät');
});

function fakeDom() {
  const d = { clicked: 0, blob: null, msg: { textContent: '' } };
  globalThis.document = {
    getElementById: id => (id === 'impMsg' ? d.msg : null),
    createElement: () => ({ click() { d.clicked++; }, remove() {} }),
    body: { appendChild() {} },
  };
  d.restore = (orig => () => { URL.createObjectURL = orig; })(URL.createObjectURL);
  URL.createObjectURL = b => { d.blob = b; return 'blob:x'; };
  return d;
}
const tap = ctx => settings.onClick({ target: { closest: () => ({ textContent: '' }) } }, SET, ctx);

test('a backup with photos downloads within the tap', async () => {
  const ctx = mk(), s = memPhotos(), d = fakeDom();
  try {
    await s.put('2026-11-02:vorne', new Blob(['img'], { type: 'image/jpeg' }));
    ctx.store.set('body.photos', { '2026-11-02': { vorne: true }, '2026-11-03': { hinten: true } });
    body.setPhotoStore(s);
    settings.onNavigate(SET, ctx);
    await settings.onChange({ target: { id: 'withPhotos', checked: true } }, SET, ctx);
    tap(ctx);
    assert.equal(d.clicked, 1);
    const b = JSON.parse(await d.blob.text());
    assert.deepEqual(Object.keys(b.photos), ['2026-11-02:vorne']);
    assert.deepEqual(b.data['body.photos'], { '2026-11-02': { vorne: true } });
    assert.match(d.msg.textContent, /1 Foto \(1 fehlte auf diesem Gerät\)/);
  } finally { d.restore(); }
});

test('until the photos are ready the tap asks to try again', () => {
  const ctx = mk(), d = fakeDom();
  try {
    body.setPhotoStore(memPhotos());
    settings.onNavigate(SET, ctx);
    settings.onChange({ target: { id: 'withPhotos', checked: true } }, SET, ctx);
    tap(ctx);
    assert.equal(d.clicked, 0);
    assert.match(d.msg.textContent, /Fotos werden vorbereitet/);
    assert.equal(ctx.store.get('meta.lastBackup'), null);
  } finally { d.restore(); }
});
