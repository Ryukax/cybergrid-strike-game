import { equal, strictEqual } from "node:assert/strict";
import { test } from "node:test";

import {
  LORD_ALPHA_NINJATO_SLICE_DASH_END_MS,
  LORD_ALPHA_NINJATO_SLICE_DASH_START_MS,
  LORD_ALPHA_NINJATO_SLICE_DURATION_MS,
  LORD_ALPHA_NINJATO_SLICE_IMPACT_MS,
  LORD_ALPHA_NINJATO_SLICE_RETURN_MS,
  beginLordAlphaNinjatoSlice,
  isLordAlphaNinjatoSliceEvasive,
  markLordAlphaNinjatoSliceHit,
  resolveLordAlphaNinjatoSlicePose,
} from "./lord-alpha-ninjato-slice";

const start = 1_000;
const slice = () => beginLordAlphaNinjatoSlice(
  { col: 1, row: 1 },
  { col: 4, row: 0 },
  { col: 4.8, row: 0 },
  start,
);

test("phase slice reaches the locked target exactly at the impact beat", () => {
  const before = resolveLordAlphaNinjatoSlicePose(
    slice(),
    start + LORD_ALPHA_NINJATO_SLICE_DASH_START_MS,
  );
  const impact = resolveLordAlphaNinjatoSlicePose(
    slice(),
    start + LORD_ALPHA_NINJATO_SLICE_IMPACT_MS,
  );
  const farSide = resolveLordAlphaNinjatoSlicePose(
    slice(),
    start + LORD_ALPHA_NINJATO_SLICE_DASH_END_MS,
  );

  equal(before?.col, 1);
  equal(before?.row, 1);
  equal(impact?.col, 4);
  equal(impact?.row, 0);
  equal(impact?.shouldApplyHit, true);
  equal(farSide?.col, 4.8);
  equal(farSide?.row, 0);
});

test("impact is an exact-once gate", () => {
  const initial = slice();
  const marked = markLordAlphaNinjatoSliceHit(initial);
  const repeated = markLordAlphaNinjatoSliceHit(marked);
  const afterImpact = resolveLordAlphaNinjatoSlicePose(
    marked,
    start + LORD_ALPHA_NINJATO_SLICE_IMPACT_MS + 20,
  );

  equal(initial.hitApplied, false);
  equal(marked.hitApplied, true);
  equal(afterImpact?.shouldApplyHit, false);
  strictEqual(repeated, marked);
});

test("return is a trail-free teleport to the unchanged logical origin", () => {
  const hidden = resolveLordAlphaNinjatoSlicePose(
    slice(),
    start + LORD_ALPHA_NINJATO_SLICE_RETURN_MS - 1,
  );
  const returned = resolveLordAlphaNinjatoSlicePose(
    slice(),
    start + LORD_ALPHA_NINJATO_SLICE_RETURN_MS,
  );
  const complete = resolveLordAlphaNinjatoSlicePose(
    slice(),
    start + LORD_ALPHA_NINJATO_SLICE_DURATION_MS,
  );

  equal(hidden?.phase, "teleport");
  equal(hidden?.opacity, 0);
  equal(returned?.phase, "recover");
  equal(returned?.col, 1);
  equal(returned?.row, 1);
  equal(complete?.complete, true);
  equal(complete?.col, 1);
  equal(complete?.row, 1);
});

test("only the pass-through interval is evasive", () => {
  equal(isLordAlphaNinjatoSliceEvasive(slice(), start + 509), false);
  equal(isLordAlphaNinjatoSliceEvasive(slice(), start + 510), true);
  equal(isLordAlphaNinjatoSliceEvasive(slice(), start + 669), true);
  equal(isLordAlphaNinjatoSliceEvasive(slice(), start + 670), false);
});

test("reduced motion keeps the body anchored without changing hit timing", () => {
  const pose = resolveLordAlphaNinjatoSlicePose(
    slice(),
    start + LORD_ALPHA_NINJATO_SLICE_IMPACT_MS,
    true,
  );

  equal(pose?.col, 1);
  equal(pose?.row, 1);
  equal(pose?.shouldApplyHit, true);
});
