import test from 'node:test';
import assert from 'node:assert/strict';

const listeners = new Map();
const storage = new Map();
globalThis.window = {
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  addEventListener: (name, callback) => listeners.set(name, callback)
};
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value)
};
const { platformInfo, invitationDue, readHistory, dismissalKey, installPrompt, installed } = await import('../src/install.js');

test('installation offers wait 30 days and stop after two dismissals', () => {
  const now = 100 * 86400000;
  assert.equal(invitationDue({ count: 0, at: 0 }, now), true);
  assert.equal(invitationDue({ count: 1, at: now - 29 * 86400000 }, now), false);
  assert.equal(invitationDue({ count: 1, at: now - 30 * 86400000 }, now), true);
  assert.equal(invitationDue({ count: 2, at: 0 }, now), false);
});

test('platform detection includes iPad desktop mode and embedded browsers', () => {
  const ipad = platformInfo({ userAgent: 'Mozilla/5.0 Macintosh AppleWebKit/605 Safari/604', platform: 'MacIntel', maxTouchPoints: 5 });
  assert.equal(ipad.ios, true);
  assert.equal(ipad.embedded, false);
  assert.equal(platformInfo({ userAgent: 'iPhone AppleWebKit Instagram', platform: 'iPhone' }).embedded, true);
  assert.equal(platformInfo({ userAgent: 'Android; wv) AppleWebKit Chrome Mobile Safari' }).embedded, true);
  assert.equal(platformInfo({ userAgent: 'Android Chrome Mobile Safari' }).android, true);
  assert.equal(platformInfo({ userAgent: 'iPhone AppleWebKit CriOS Mobile' }).embedded, false);
});

test('invalid storage is ignored and native confirmation persists suppression', () => {
  storage.set(dismissalKey, '{invalid');
  assert.deepEqual(readHistory(), { count: 0, at: 0 });
  storage.set(dismissalKey, JSON.stringify({ count: 1, at: 123 }));
  assert.deepEqual(readHistory(), { count: 1, at: 123 });
  let prevented = false;
  const prompt = { preventDefault() { prevented = true; } };
  listeners.get('beforeinstallprompt')(prompt);
  assert.equal(prevented, true);
  assert.equal(installPrompt.value, prompt);
  listeners.get('appinstalled')();
  assert.equal(installed.value, true);
  assert.equal(installPrompt.value, null);
  assert.equal(storage.get('lago.installed'), '1');
});
