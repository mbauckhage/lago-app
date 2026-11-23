import test from 'node:test';
import assert from 'node:assert/strict';
import { readPhoto } from '../src/photos.js';

test('photo conversion respects the upload limit and releases resources', async () => {
  const originals = Object.fromEntries(['FileReader', 'Image', 'document'].map(key => [key, globalThis[key]]));
  const create = URL.createObjectURL;
  const revoke = URL.revokeObjectURL;
  let released = false;
  let calls = [];
  let sizes = [];
  const canvas = {
    getContext: () => ({ drawImage() {} }),
    toBlob(callback, type, quality) {
      calls.push([this.width, this.height, quality]);
      callback({ size: sizes.shift() ?? 500_000, type });
    }
  };
  globalThis.FileReader = class {
    readAsDataURL(blob) { this.result = `data:${blob.type};base64,test`; this.onload(); }
  };
  globalThis.Image = class {
    naturalWidth = 4000;
    naturalHeight = 2000;
    set src(value) { this.onload(); }
  };
  globalThis.document = { createElement: () => canvas };
  URL.createObjectURL = () => 'blob:test';
  URL.revokeObjectURL = () => { released = true; };
  try {
    assert.equal(await readPhoto(undefined), undefined);
    await assert.rejects(readPhoto({ size: 100, type: 'image/gif' }));
    assert.match(await readPhoto({ size: 100, type: 'image/png' }), /^data:image\/png/);
    assert.equal(calls.length, 0);
    sizes = [2_000_000, 500_000];
    assert.match(await readPhoto({ size: 5_000_000, type: 'image/jpeg' }), /^data:image\/webp/);
    assert.deepEqual(calls, [[1920, 960, 0.88], [1920, 960, 0.75]]);
    assert.equal(released, true);
    calls = [];
    sizes = Array(4).fill(2_000_000);
    await readPhoto({ size: 5_000_000, type: 'image/png' });
    assert.deepEqual(calls[4], [1440, 720, 0.88]);
    assert.equal(canvas.width, 0);
  } finally {
    Object.assign(globalThis, originals);
    URL.createObjectURL = create;
    URL.revokeObjectURL = revoke;
  }
});
