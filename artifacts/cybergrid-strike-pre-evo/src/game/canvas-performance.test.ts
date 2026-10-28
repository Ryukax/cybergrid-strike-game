import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GAME_CANVAS_DPR_CAP,
  GAMEPLAY_CANVAS_COMPACT_DPR_CAP,
  GAMEPLAY_CANVAS_DESKTOP_DPR_CAP,
  GAMEPLAY_RENDER_FRAME_INTERVAL_MS,
  GAMEPLAY_RENDER_HZ,
  GAMEPLAY_SIMULATION_FRAME_INTERVAL_MS,
  GAMEPLAY_SIMULATION_HZ,
  isGameplayFrameDue,
  resolveGameplayFrameStep,
  resolveGameCanvasDpr,
  resolveGameplayCanvasDpr,
} from './canvas-performance.ts';

test('caps fullscreen gameplay canvases below expensive DPR-2 backing stores', () => {
  assert.equal(resolveGameCanvasDpr(3), GAME_CANVAS_DPR_CAP);
  assert.equal(resolveGameCanvasDpr(2), GAME_CANVAS_DPR_CAP);
});

test('preserves ordinary density and sanitizes invalid values', () => {
  assert.equal(resolveGameCanvasDpr(1), 1);
  assert.equal(resolveGameCanvasDpr(1.25), 1.25);
  assert.equal(resolveGameCanvasDpr(0), 1);
  assert.equal(resolveGameCanvasDpr(Number.NaN), 1);
  assert.equal(resolveGameCanvasDpr(undefined), 1);
});

test('uses a 1:1 main gameplay backing store on compact or coarse devices', () => {
  assert.equal(resolveGameplayCanvasDpr(3, true), GAMEPLAY_CANVAS_COMPACT_DPR_CAP);
  assert.equal(resolveGameplayCanvasDpr(2, true), GAMEPLAY_CANVAS_COMPACT_DPR_CAP);
  assert.equal(resolveGameplayCanvasDpr(1, true), 1);
});

test('keeps modest supersampling for the desktop gameplay canvas', () => {
  assert.equal(resolveGameplayCanvasDpr(3, false), GAMEPLAY_CANVAS_DESKTOP_DPR_CAP);
  assert.equal(resolveGameplayCanvasDpr(1.25, false), 1.25);
  assert.equal(resolveGameplayCanvasDpr(1, false), 1);
});

test('runs input and simulation twice as often as expensive board rendering', () => {
  assert.equal(GAMEPLAY_SIMULATION_HZ, 60);
  assert.equal(GAMEPLAY_RENDER_HZ, 30);
  assert.equal(
    GAMEPLAY_RENDER_FRAME_INTERVAL_MS,
    GAMEPLAY_SIMULATION_FRAME_INTERVAL_MS * 2,
  );
});

test('recognizes due frames with fractional timestamp tolerance', () => {
  assert.equal(isGameplayFrameDue(16.2, GAMEPLAY_SIMULATION_FRAME_INTERVAL_MS), true);
  assert.equal(isGameplayFrameDue(15, GAMEPLAY_SIMULATION_FRAME_INTERVAL_MS), false);
  assert.equal(isGameplayFrameDue(33, GAMEPLAY_RENDER_FRAME_INTERVAL_MS), true);
  assert.equal(isGameplayFrameDue(Number.NaN, GAMEPLAY_RENDER_FRAME_INTERVAL_MS), false);
  assert.equal(isGameplayFrameDue(20, 0), false);
});

test('retains high-refresh timing remainder instead of quantizing below 60 Hz', () => {
  const first144HzStep = resolveGameplayFrameStep(
    3 * (1000 / 144),
    GAMEPLAY_SIMULATION_FRAME_INTERVAL_MS,
  );
  assert.ok(Math.abs(first144HzStep.elapsedMs - GAMEPLAY_SIMULATION_FRAME_INTERVAL_MS) < 0.001);
  assert.ok(Math.abs(first144HzStep.remainderMs - (1000 / 240)) < 0.001);

  const thirtyHzStep = resolveGameplayFrameStep(
    1000 / 30,
    GAMEPLAY_SIMULATION_FRAME_INTERVAL_MS,
  );
  assert.ok(Math.abs(thirtyHzStep.elapsedMs - (1000 / 30)) < 0.001);
  assert.ok(thirtyHzStep.remainderMs < 0.001);
});
