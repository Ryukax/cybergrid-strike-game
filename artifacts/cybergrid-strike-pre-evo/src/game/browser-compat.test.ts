import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cloneBrowserValue,
  createSafeStorage,
  readBrowserViewport,
  subscribeMediaQueryChange,
  tryReleasePointerCapture,
  trySetPointerCapture,
} from './browser-compat';

test('safe storage survives Safari storage exceptions with a session fallback', () => {
  const storage = createSafeStorage(() => ({
    getItem() { throw new DOMException('blocked', 'SecurityError'); },
    setItem() { throw new DOMException('blocked', 'SecurityError'); },
    removeItem() { throw new DOMException('blocked', 'SecurityError'); },
  }));

  assert.equal(storage.getItem('mode'), null);
  storage.setItem('mode', 'campaign');
  assert.equal(storage.getItem('mode'), 'campaign');
  storage.removeItem('mode');
  assert.equal(storage.getItem('mode'), null);
});

test('media query subscription supports the legacy Safari API', () => {
  let subscribed: ((event: unknown) => void) | undefined;
  const query = {
    matches: false,
    addListener(listener: (event: unknown) => void) { subscribed = listener; },
    removeListener(listener: (event: unknown) => void) {
      if (subscribed === listener) subscribed = undefined;
    },
  };
  let changes = 0;
  const unsubscribe = subscribeMediaQueryChange(query, () => { changes += 1; });
  subscribed?.({});
  assert.equal(changes, 1);
  unsubscribe();
  assert.equal(subscribed, undefined);
});

test('pointer capture failures are contained', () => {
  const target = {
    setPointerCapture() { throw new Error('not active'); },
    hasPointerCapture() { throw new Error('lost'); },
    releasePointerCapture() { throw new Error('lost'); },
  };
  assert.equal(trySetPointerCapture(target, 4), false);
  assert.doesNotThrow(() => tryReleasePointerCapture(target, 4));
});

test('visual viewport dimensions win when Safari browser chrome changes', () => {
  assert.deepEqual(readBrowserViewport({
    innerWidth: 844,
    innerHeight: 390,
    visualViewport: { width: 812.4, height: 354.6 },
  }), { width: 812, height: 355 });
});

test('clone fallback retains independent plain game state', () => {
  const source = { player: { hp: 5 }, lanes: [0, 1, 2] };
  const result = cloneBrowserValue(source);
  result.player.hp = 1;
  assert.equal(source.player.hp, 5);
});
