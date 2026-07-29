import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveGenome,
  distributeTreasury,
  rewardWeight,
} from "./index.js";

test("the same seed always produces the same complete genome", () => {
  assert.deepEqual(deriveGenome("sector-7:node-3:spawn-42"), deriveGenome("sector-7:node-3:spawn-42"));
});

test("different seeds produce different identities", () => {
  assert.notEqual(deriveGenome("alpha").hash, deriveGenome("beta").hash);
});

test("treasury distribution conserves value and avoids winner-takes-all", () => {
  const rewards = distributeTreasury(1_000, [
    { id: "a", weight: rewardWeight(10_000, 1, 1, 1, 50) },
    { id: "b", weight: rewardWeight(2_500, 0.7, 0.8, 0.9, 50) },
  ]);
  assert.ok(rewards.every((entry) => entry.reward > 0));
  assert.ok(Math.abs(rewards.reduce((sum, entry) => sum + entry.reward, 0) - 1_000) < 0.0001);
});
