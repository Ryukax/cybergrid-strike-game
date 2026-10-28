import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MANUAL_BUSTER_BUFFER_MS,
  MANUAL_BUSTER_BUFFER_SECONDS,
  queueManualBusterInput,
  resolveManualBusterInput,
} from './responsive-input.ts';

test('queues a manual Buster press made just before cooldown completion', () => {
  const nowMs = 1_000;

  assert.equal(
    queueManualBusterInput(MANUAL_BUSTER_BUFFER_SECONDS, nowMs),
    nowMs + MANUAL_BUSTER_BUFFER_MS,
  );
  assert.equal(
    queueManualBusterInput(0.001, nowMs),
    nowMs + MANUAL_BUSTER_BUFFER_MS,
  );
});

test('does not queue a press made too early or while already ready', () => {
  assert.equal(queueManualBusterInput(MANUAL_BUSTER_BUFFER_SECONDS + 0.001, 1_000), 0);
  assert.equal(queueManualBusterInput(0, 1_000), 0);
  assert.equal(queueManualBusterInput(-0.1, 1_000), 0);
});

test('waits for readiness and fires once the buffered cooldown completes', () => {
  const expiresAtMs = 1_120;

  assert.equal(resolveManualBusterInput(expiresAtMs, 1_040, 0.04), 'waiting');
  assert.equal(resolveManualBusterInput(expiresAtMs, 1_100, 0), 'fire');
  assert.equal(resolveManualBusterInput(expiresAtMs, 1_100, -0.01), 'fire');
});

test('expires a buffered press instead of firing it late', () => {
  assert.equal(resolveManualBusterInput(1_120, 1_121, 0), 'none');
});

test('rejects non-finite and invalid timing values safely', () => {
  assert.equal(queueManualBusterInput(Number.NaN, 1_000), 0);
  assert.equal(queueManualBusterInput(0.05, Number.POSITIVE_INFINITY), 0);
  assert.equal(queueManualBusterInput(0.05, -1), 0);

  assert.equal(resolveManualBusterInput(Number.NaN, 1_000, 0), 'none');
  assert.equal(resolveManualBusterInput(1_120, Number.NaN, 0), 'none');
  assert.equal(resolveManualBusterInput(1_120, 1_000, Number.POSITIVE_INFINITY), 'none');
  assert.equal(resolveManualBusterInput(1_120, -1, 0), 'none');
});
