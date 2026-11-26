import test from 'node:test';
import assert from 'node:assert/strict';
import { memPhotos, idbPhotos, blobToDataUrl, dataUrlToBlob, exportPhotos, importPhotos, mergeIndex } from '../js/areas/body/photos.js';

const jpeg = (s = 'a') => new Blob([s], { type: 'image/jpeg' });

test('data urls round-trip a blob', async () => {
  const url = await blobToDataUrl(new Blob([new Uint8Array([1, 2, 3, 250])], { type: 'image/jpeg' }));
  assert.match(url, /^data:image\/jpeg;base64,/);
  assert.deepEqual([...new Uint8Array(await dataUrlToBlob(url).arrayBuffer())], [1, 2, 3, 250]);
  assert.equal(dataUrlToBlob('data:text/html;base64,PGI+'), null);
  assert.equal(dataUrlToBlob('nope'), null);
});

test('no IndexedDB means no photo store', () => {
  assert.equal(idbPhotos(undefined), null);
});

test('export skips images the store does not have', async () => {
  const s = memPhotos();
  await s.put('2026-11-02:vorne', jpeg());
  const r = await exportPhotos(s, { '2026-11-02': { vorne: true, hinten: true }, x: 5 });
  assert.deepEqual(Object.keys(r.photos), ['2026-11-02:vorne']);
  assert.deepEqual(r.index, { '2026-11-02': { vorne: true } });
  assert.deepEqual([r.count, r.missing], [1, 1]);
  assert.equal(await s.size(), 1);
});

test('import keeps going when one image fails', async () => {
  const s = memPhotos({ failKeys: ['2026-11-02:hinten'] }), url = await blobToDataUrl(jpeg());
  const r = await importPhotos(s, { '2026-11-02:vorne': url, '2026-11-02:hinten': url, '2026-11-03:vorne': 'kaputt', 'x:vorne': url, '2026-11-04:oben': url });
  assert.deepEqual(r.index, { '2026-11-02': { vorne: true } });
  assert.deepEqual([r.written, r.failed], [1, 2]);
  assert.ok(await s.get('2026-11-02:vorne'));
  assert.equal(await s.get('2026-11-02:hinten'), null);
});

test('mergeIndex joins poses per day', () => {
  assert.deepEqual(mergeIndex({ '2026-11-02': { vorne: true } }, { '2026-11-02': { hinten: true }, '2026-11-03': { seitlich: true }, x: 1 }),
    { '2026-11-02': { vorne: true, hinten: true }, '2026-11-03': { seitlich: true } });
});
