import { equal, strictEqual } from "node:assert/strict";
import { test } from "node:test";

import {
  LORD_ALPHA_NINJATO_THRUST_CONTACT_END_MS,
  LORD_ALPHA_NINJATO_THRUST_DURATION_MS,
  LORD_ALPHA_NINJATO_THRUST_FOLLOWUP_WINDOW_MS,
  LORD_ALPHA_NINJATO_THRUST_IMPACT_MS,
  LORD_ALPHA_NINJATO_THRUST_RETURN_MS,
  beginLordAlphaNinjatoThrust,
  isLordAlphaNinjatoThrustFollowupOpen,
  markLordAlphaNinjatoThrustHit,
  openLordAlphaNinjatoThrustFollowupWindow,
  resolveLordAlphaNinjatoFrontSide,
  resolveLordAlphaNinjatoThrustPose,
} from "./lord-alpha-ninjato-thrust";

const start = 2_000;
const thrust = () => beginLordAlphaNinjatoThrust(
  { col: 1, row: 1 },
  { col: 2.1, row: 0 },
  { col: 3.2, row: 0 },
  { col: 4, row: 0 },
  start,
);

test("back thrust approaches the opponent from its front side", () => {
  const entry = resolveLordAlphaNinjatoThrustPose(thrust(), start);
  const contact = resolveLordAlphaNinjatoThrustPose(
    thrust(),
    start + LORD_ALPHA_NINJATO_THRUST_IMPACT_MS,
  );

  equal(entry?.col, 2.1);
  equal(entry?.row, 0);
  equal(contact?.col, 3.2);
  equal(contact?.row, 0);
  equal(contact?.phase, "contact");
  equal(contact?.shouldApplyHit, true);
  equal((contact?.col ?? 0) < thrust().target.col, true);
});

test("front-side geometry stays west of the opponent on its row", () => {
  const target = { col: 4, row: 1 };
  const geometry = resolveLordAlphaNinjatoFrontSide(target);
  equal(geometry.contact.col < target.col, true);
  equal(geometry.entry.col < geometry.contact.col, true);
  equal(geometry.entry.row, target.row);
  equal(geometry.contact.row, target.row);
});

test("back thrust impact can resolve only once", () => {
  const initial = thrust();
  const marked = markLordAlphaNinjatoThrustHit(initial);
  const repeated = markLordAlphaNinjatoThrustHit(marked);
  equal(initial.hitApplied, false);
  equal(marked.hitApplied, true);
  equal(resolveLordAlphaNinjatoThrustPose(
    marked,
    start + LORD_ALPHA_NINJATO_THRUST_IMPACT_MS + 20,
  )?.shouldApplyHit, false);
  strictEqual(repeated, marked);
});

test("contact holds, then return teleports without a travel trail", () => {
  equal(resolveLordAlphaNinjatoThrustPose(
    thrust(),
    start + LORD_ALPHA_NINJATO_THRUST_CONTACT_END_MS - 1,
  )?.phase, "contact");
  const hidden = resolveLordAlphaNinjatoThrustPose(
    thrust(),
    start + LORD_ALPHA_NINJATO_THRUST_RETURN_MS - 1,
  );
  const returned = resolveLordAlphaNinjatoThrustPose(
    thrust(),
    start + LORD_ALPHA_NINJATO_THRUST_RETURN_MS,
  );
  const complete = resolveLordAlphaNinjatoThrustPose(
    thrust(),
    start + LORD_ALPHA_NINJATO_THRUST_DURATION_MS,
  );
  equal(hidden?.phase, "teleport");
  equal(hidden?.opacity, 0);
  equal(returned?.col, 1);
  equal(returned?.row, 1);
  equal(complete?.complete, true);
});

test("post-slice follow-up window is bounded", () => {
  const window = openLordAlphaNinjatoThrustFollowupWindow(start);
  equal(window.expiresAtMs, start + LORD_ALPHA_NINJATO_THRUST_FOLLOWUP_WINDOW_MS);
  equal(isLordAlphaNinjatoThrustFollowupOpen(window, start), true);
  equal(isLordAlphaNinjatoThrustFollowupOpen(window, window.expiresAtMs - 1), true);
  equal(isLordAlphaNinjatoThrustFollowupOpen(window, window.expiresAtMs), false);
});

test("reduced motion remains at the logical origin but preserves impact", () => {
  const pose = resolveLordAlphaNinjatoThrustPose(
    thrust(),
    start + LORD_ALPHA_NINJATO_THRUST_IMPACT_MS,
    true,
  );
  equal(pose?.col, 1);
  equal(pose?.row, 1);
  equal(pose?.shouldApplyHit, true);
});
