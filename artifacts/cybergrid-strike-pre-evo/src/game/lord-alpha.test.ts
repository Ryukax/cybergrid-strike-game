import { deepStrictEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { ABILITY_LOOKUP } from "./constants";
import {
  LORD_ALPHA_ASSETS,
  LORD_ALPHA_ANIMATION_PROFILES,
  LORD_ALPHA_ASSET_REVISION,
  LORD_ALPHA_ATTACK_SEQUENCE_ASSETS,
  LORD_ALPHA_ARCHIVED_SKILL_ACTIONS,
  LORD_ALPHA_CARD_PRESENTATIONS,
  LORD_ALPHA_COMBO_ASSET_SUFFIXES,
  LORD_ALPHA_COMBO_BEATS,
  LORD_ALPHA_COMBO_PRESENTATIONS,
  LORD_ALPHA_COMBO_RESET_MS,
  LORD_ALPHA_COMBO_TIMINGS_MS,
  LORD_ALPHA_DIRECT_GAMEPAD_ACTIONS,
  LORD_ALPHA_EVENT_TIMINGS_MS,
  LORD_ALPHA_EFFECT_SEQUENCE_ASSETS,
  LORD_ALPHA_EFFECT_SEQUENCE_IDS,
  LORD_ALPHA_FORM_IDS,
  LORD_ALPHA_GAMEPLAY_BALANCE_CHANGES,
  LORD_ALPHA_GRAPPLE_ATTACH_DELAY_SECONDS,
  LORD_ALPHA_GRAPPLE_PULL_DURATION_SECONDS,
  LORD_ALPHA_HITBOX_CHANGES,
  LORD_ALPHA_PRESENTATION_EVENT_KINDS,
  LORD_ALPHA_PRESENTATION_TIMINGS_MS,
  LORD_ALPHA_PROCEDURAL_EFFECTS,
  LORD_ALPHA_ROC_CHARGE_DURATION_MS,
  LORD_ALPHA_ROC_CHARGE_PHASES,
  LORD_ALPHA_ROC_BRANCH_SPIN_DURATION_MS,
  LORD_ALPHA_ROC_WING_SPIN_SEQUENCE,
  LORD_ALPHA_ROC_WING_THRUST_SEQUENCE,
  LORD_ALPHA_L2_TAP_WINDOW_MS,
  LORD_ALPHA_R2_TAP_WINDOW_MS,
  LORD_ALPHA_THARTHAREON_FIREBALL_RELEASE_MS,
  LORD_ALPHA_SKILL_BANKS,
  LORD_ALPHA_SKILL_BINDINGS,
  LORD_ALPHA_SKILL_PREVIEW_ACTIONS,
  LORD_ALPHA_SKILL_SEQUENCE_ASSETS,
  LORD_ALPHA_SKILL_SEQUENCE_FRAME_COUNT,
  LORD_ALPHA_SKILL_SEQUENCE_FRAME_HEIGHT,
  LORD_ALPHA_SKILL_SEQUENCE_FRAME_WIDTH,
  LORD_ALPHA_SKILL_SEQUENCE_IDS,
  LORD_ALPHA_SKIN_ID,
  LORD_ALPHA_TOPOLOGY_LIMITS,
  LORD_ALPHA_TOPOLOGY_STAGES,
  LORD_ALPHA_TOPOLOGY_VOCABULARY,
  LORD_ALPHA_VFX_TIMINGS_MS,
  advanceLordAlphaCombo,
  advanceLordAlphaGrapplePullMotion,
  anatomicalLeftScreenSide,
  branchLordAlphaRocChargeCells,
  buildLordAlphaRocChargeCells,
  canArmLordAlphaRocBranch,
  canQueueLordAlphaRocBranchLane,
  clampTopologyProgress,
  createLordAlphaComboState,
  createLordAlphaDimensionalNetMorph,
  createLordAlphaGrapplePullMotion,
  createLordAlphaPresentationEvent,
  createLordAlphaTopologyMorph,
  generateLordAlphaTopology,
  getLordAlphaCardPresentation,
  hasLordAlphaRocReachedBranchPane,
  isLordAlphaCollisionOwnedTharthareon,
  isLordAlphaRocBranchImpactContact,
  isLordAlphaSkillsPreviewSearch,
  lordAlphaSkillControlsOwnGamepad,
  lordAlphaSignatureUsesCooldown,
  lordAlphaRocBranchCandidateRows,
  lordAlphaTopologyMorphWeights,
  resetLordAlphaCombo,
  resolveLordAlphaAnimationProfile,
  resolveLordAlphaGrapplePullColumn,
  resolveLordAlphaHeldTargetVisualPolicy,
  resolveLordAlphaRocBranchHighlightCell,
  resolveLordAlphaRocChargePose,
  resolveLordAlphaAttackSequence,
  resolveLordAlphaDirectGamepadBinding,
  resolveLordAlphaEffectSequence,
  resolveLordAlphaSkillAction,
  resolveLordAlphaSkillActionById,
  resolveLordAlphaSkillSequence,
  resolveLordAlphaL2TapCommand,
  resolveLordAlphaR2TapCommand,
  resolveLordAlphaRocR2TapCommand,
  resolveLordAlphaTharthareonPresentationSubtype,
  shouldResolveLordAlphaRocBranchImpact,
  resolveLordAlphaVfxMode,
  rocWingPlacement,
  sampleLordAlphaTopologyMorph,
  topologyStage,
  wrapLordAlphaSkillBank,
} from "./lord-alpha";

test("direct Tharthareon owns a collision carrier without changing Nuke or NPC summons", () => {
  const genericSubtype = resolveLordAlphaTharthareonPresentationSubtype(
    false,
    "tharthareon-emerge",
  );
  const biteSubtype = resolveLordAlphaTharthareonPresentationSubtype(
    true,
    "tharthareon-emerge",
  );
  const fireballSubtype = resolveLordAlphaTharthareonPresentationSubtype(
    "fireball",
    "tharthareon-emerge",
  );

  equal(genericSubtype, "tharthareon-emerge");
  equal(biteSubtype, "tharthareon-bite-lunge");
  equal(fireballSubtype, "tharthareon-fireball");
  equal(isLordAlphaCollisionOwnedTharthareon(createLordAlphaPresentationEvent(
    "tharthareon",
    0,
    { subtype: genericSubtype },
  )), false);
  equal(isLordAlphaCollisionOwnedTharthareon(createLordAlphaPresentationEvent(
    "tharthareon",
    0,
    { subtype: biteSubtype },
  )), true);
  equal(isLordAlphaCollisionOwnedTharthareon(createLordAlphaPresentationEvent(
    "tharthareon",
    0,
    { subtype: fireballSubtype },
  )), true);
  equal(isLordAlphaCollisionOwnedTharthareon(null), false);
});

test("Lord Alpha grapple attaches, then pulls exactly one cell toward its caster", () => {
  ok(Math.abs(resolveLordAlphaGrapplePullColumn(4.4, 1, 0, 5.8) - 3.4) < 1e-9);
  equal(resolveLordAlphaGrapplePullColumn(0, 2, 0, 2), 1);
  equal(resolveLordAlphaGrapplePullColumn(1.4, 1, 0, 5.8), 1);
  equal(resolveLordAlphaGrapplePullColumn(3, 0, 3, 5), 3);

  const created = createLordAlphaGrapplePullMotion(4, 1, 0, 5.8);
  ok(created);
  equal(created.startColumn, 4);
  equal(created.endColumn, 3);
  equal(created.delay, LORD_ALPHA_GRAPPLE_ATTACH_DELAY_SECONDS);
  equal(created.duration, LORD_ALPHA_GRAPPLE_PULL_DURATION_SECONDS);

  const waiting = advanceLordAlphaGrapplePullMotion(created, created.delay * 0.5);
  equal(waiting.column, 4);
  ok(waiting.motion);
  const completed = advanceLordAlphaGrapplePullMotion(
    waiting.motion,
    created.delay + created.duration,
  );
  equal(completed.column, 3);
  equal(completed.motion, null);
});

test("Roc Stun traverses every cell to its target and retraces the route home", () => {
  const horizontal = buildLordAlphaRocChargeCells(
    { col: 0, row: 1 },
    { col: 5, row: 1 },
  );
  deepStrictEqual(horizontal, [
    { col: 0, row: 1 },
    { col: 1, row: 1 },
    { col: 2, row: 1 },
    { col: 3, row: 1 },
    { col: 4, row: 1 },
    { col: 5, row: 1 },
    { col: 4, row: 1 },
    { col: 3, row: 1 },
    { col: 2, row: 1 },
    { col: 1, row: 1 },
    { col: 0, row: 1 },
  ]);

  const bent = buildLordAlphaRocChargeCells(
    { col: 1, row: 2 },
    { col: 4, row: 0 },
  );
  deepStrictEqual(bent, [
    { col: 1, row: 2 },
    { col: 1, row: 1 },
    { col: 1, row: 0 },
    { col: 2, row: 0 },
    { col: 3, row: 0 },
    { col: 4, row: 0 },
    { col: 3, row: 0 },
    { col: 2, row: 0 },
    { col: 1, row: 0 },
    { col: 1, row: 1 },
    { col: 1, row: 2 },
  ]);
  for (let index = 1; index < bent.length; index += 1) {
    const previous = bent[index - 1];
    const current = bent[index];
    equal(
      Math.abs(current.col - previous.col) + Math.abs(current.row - previous.row),
      1,
      `route segment ${index} must cross exactly one adjacent cell`,
    );
  }

  deepStrictEqual(
    buildLordAlphaRocChargeCells({ col: 2, row: 0 }, { col: 0, row: 0 }),
    [
      { col: 2, row: 0 },
      { col: 1, row: 0 },
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 2, row: 0 },
    ],
  );
  deepStrictEqual(
    buildLordAlphaRocChargeCells({ col: 3, row: 2 }, { col: 3, row: 2 }),
    [{ col: 3, row: 2 }],
  );
});

test("Roc Stun holds charge and impact, then recovers at its logical origin", () => {
  const origin = Object.freeze({ col: 0, row: 1 });
  const target = Object.freeze({ col: 5, row: 1 });
  const cells = buildLordAlphaRocChargeCells(origin, target);
  const turnIndex = Math.floor(cells.length / 2);

  deepStrictEqual(resolveLordAlphaRocChargePose(cells, 0), {
    ...origin,
    phase: "charge",
    cellIndex: 0,
  });
  deepStrictEqual(resolveLordAlphaRocChargePose(cells, LORD_ALPHA_ROC_CHARGE_PHASES.outboundEnd), {
    ...target,
    phase: "outbound",
    cellIndex: turnIndex,
  });
  deepStrictEqual(resolveLordAlphaRocChargePose(cells, 0.55), {
    ...target,
    phase: "impact",
    cellIndex: turnIndex,
  });
  deepStrictEqual(resolveLordAlphaRocChargePose(cells, LORD_ALPHA_ROC_CHARGE_PHASES.returnEnd), {
    ...origin,
    phase: "recovered",
    cellIndex: cells.length - 1,
  });
  deepStrictEqual(resolveLordAlphaRocChargePose(cells, 1), {
    ...origin,
    phase: "recovered",
    cellIndex: cells.length - 1,
  });
  deepStrictEqual(origin, { col: 0, row: 1 });
  deepStrictEqual(target, { col: 5, row: 1 });

  for (let index = 0; index <= turnIndex; index += 1) {
    const progress = LORD_ALPHA_ROC_CHARGE_PHASES.chargeEnd
      + (LORD_ALPHA_ROC_CHARGE_PHASES.outboundEnd - LORD_ALPHA_ROC_CHARGE_PHASES.chargeEnd)
        * (index / turnIndex);
    const pose = resolveLordAlphaRocChargePose(cells, progress);
    equal(pose.col, cells[index].col);
    equal(pose.row, cells[index].row);
  }
  for (let index = turnIndex; index < cells.length; index += 1) {
    const progress = LORD_ALPHA_ROC_CHARGE_PHASES.impactEnd
      + (LORD_ALPHA_ROC_CHARGE_PHASES.returnEnd - LORD_ALPHA_ROC_CHARGE_PHASES.impactEnd)
        * ((index - turnIndex) / (cells.length - 1 - turnIndex));
    const pose = resolveLordAlphaRocChargePose(cells, progress);
    equal(pose.col, cells[index].col);
    equal(pose.row, cells[index].row);
  }
});

test("Roc Wing spin exposes only legal adjacent red-lane candidates", () => {
  deepStrictEqual(lordAlphaRocBranchCandidateRows(0), [1]);
  deepStrictEqual(lordAlphaRocBranchCandidateRows(1), [0, 2]);
  deepStrictEqual(lordAlphaRocBranchCandidateRows(2), [1]);
  deepStrictEqual(lordAlphaRocBranchCandidateRows(Number.NaN), [1]);

  equal(canArmLordAlphaRocBranch(0), true);
  equal(canArmLordAlphaRocBranch(LORD_ALPHA_ROC_CHARGE_PHASES.outboundEnd), true);
  equal(canArmLordAlphaRocBranch(LORD_ALPHA_ROC_CHARGE_PHASES.outboundEnd + 0.001), false);
  equal(canQueueLordAlphaRocBranchLane(LORD_ALPHA_ROC_CHARGE_PHASES.impactEnd), true);
  equal(canQueueLordAlphaRocBranchLane(LORD_ALPHA_ROC_CHARGE_PHASES.impactEnd + 0.001), false);
});

test("Roc Wing resolves an apex impact only for a confirmed single R2", () => {
  const apex = { col: 5, row: 1 };

  equal(
    shouldResolveLordAlphaRocBranchImpact(
      false,
      true,
      false,
      LORD_ALPHA_ROC_CHARGE_PHASES.outboundEnd,
    ),
    false,
    "base R1 remains the non-damaging Roc Stun",
  );
  equal(
    shouldResolveLordAlphaRocBranchImpact(
      true,
      false,
      false,
      LORD_ALPHA_ROC_CHARGE_PHASES.outboundEnd,
    ),
    false,
    "double/triple R2 movement remains armed without queuing an extra Roc attack",
  );
  equal(
    shouldResolveLordAlphaRocBranchImpact(
      true,
      true,
      false,
      LORD_ALPHA_ROC_CHARGE_PHASES.outboundEnd - 0.001,
    ),
    false,
    "the branch cannot hit before reaching its forward apex",
  );
  equal(
    shouldResolveLordAlphaRocBranchImpact(
      true,
      true,
      false,
      LORD_ALPHA_ROC_CHARGE_PHASES.outboundEnd,
    ),
    true,
    "the first apex sample resolves the combo impact",
  );
  equal(
    shouldResolveLordAlphaRocBranchImpact(true, true, true, 1),
    false,
    "the held apex and return leg cannot repeat damage",
  );

  equal(isLordAlphaRocBranchImpactContact(apex, { col: 4.4, row: 1 }), true);
  equal(isLordAlphaRocBranchImpactContact(apex, { col: 4.39, row: 1 }), false);
  equal(
    isLordAlphaRocBranchImpactContact(apex, { col: 5, row: 0 }),
    false,
    "the selected recovery lane does not replace the original impact row",
  );
});

test("Roc Wing locks its red pane beside the tile occupied when direction is pressed", () => {
  const cells = buildLordAlphaRocChargeCells(
    { col: 0, row: 1 },
    { col: 5, row: 1 },
  );
  const turnIndex = Math.floor(cells.length / 2);
  const atColumnThree = LORD_ALPHA_ROC_CHARGE_PHASES.chargeEnd
    + (LORD_ALPHA_ROC_CHARGE_PHASES.outboundEnd - LORD_ALPHA_ROC_CHARGE_PHASES.chargeEnd)
      * (3 / turnIndex);

  const upperHighlight = resolveLordAlphaRocBranchHighlightCell(
    cells,
    atColumnThree,
    turnIndex,
    -1,
  );
  deepStrictEqual(upperHighlight, { col: 3, row: 0 });
  ok(upperHighlight);
  const routeToUpperHighlight = branchLordAlphaRocChargeCells(cells, upperHighlight);
  ok(
    routeToUpperHighlight.cells.some(
      (cell) => cell.col === upperHighlight.col && cell.row === upperHighlight.row,
    ),
    "the return route must enter the captured red pane",
  );
  deepStrictEqual(
    routeToUpperHighlight.cells[routeToUpperHighlight.cells.length - 1],
    { col: 0, row: upperHighlight.row },
    "after turning into the pane LASI returns home in that lane",
  );
  deepStrictEqual(
    resolveLordAlphaRocBranchHighlightCell(cells, atColumnThree, turnIndex, 1),
    { col: 3, row: 2 },
  );
  equal(resolveLordAlphaRocBranchHighlightCell(cells, atColumnThree, turnIndex, 0), null);

  const topLane = buildLordAlphaRocChargeCells(
    { col: 0, row: 0 },
    { col: 5, row: 0 },
  );
  equal(
    resolveLordAlphaRocBranchHighlightCell(
      topLane,
      atColumnThree,
      Math.floor(topLane.length / 2),
      -1,
    ),
    null,
    "an edge press cannot create an off-grid persistent marker",
  );
});

test("Roc Wing lands on player-side highlights and returns from enemy-side highlights", () => {
  const baseCells = buildLordAlphaRocChargeCells(
    { col: 0, row: 1 },
    { col: 5, row: 1 },
  );
  const playerSideRoute = branchLordAlphaRocChargeCells(baseCells, { col: 2, row: 0 });
  deepStrictEqual(
    playerSideRoute.cells[playerSideRoute.cells.length - 1],
    { col: 2, row: 0 },
    "a highlighted pane on LASI's half becomes his landing cell",
  );
  deepStrictEqual(
    resolveLordAlphaRocChargePose(playerSideRoute.cells, 1, playerSideRoute.turnIndex),
    {
      col: 2,
      row: 0,
      phase: "recovered",
      cellIndex: playerSideRoute.cells.length - 1,
    },
  );
  equal(
    hasLordAlphaRocReachedBranchPane(
      playerSideRoute.cells,
      1,
      playerSideRoute.turnIndex,
      { col: 2, row: 0 },
    ),
    true,
    "the player-side marker resolves at the exact committed landing pane",
  );
  for (let index = 1; index < playerSideRoute.cells.length; index++) {
    const previous = playerSideRoute.cells[index - 1];
    const current = playerSideRoute.cells[index];
    equal(
      Math.abs(current.col - previous.col) + Math.abs(current.row - previous.row),
      1,
      `player-side branch segment ${index} must remain cell-adjacent`,
    );
  }

  const route = branchLordAlphaRocChargeCells(baseCells, { col: 3, row: 0 });
  deepStrictEqual(
    route.cells.slice(0, route.turnIndex + 1),
    baseCells.slice(0, Math.floor(baseCells.length / 2) + 1),
  );
  deepStrictEqual(
    route.cells.slice(route.turnIndex),
    [
      { col: 5, row: 1 },
      { col: 4, row: 1 },
      { col: 3, row: 1 },
      { col: 3, row: 0 },
      { col: 2, row: 0 },
      { col: 1, row: 0 },
      { col: 0, row: 0 },
    ],
    "LASI returns to the pane's column, turns into it, then carries that lane home",
  );
  for (let index = 1; index < route.cells.length; index += 1) {
    const previous = route.cells[index - 1];
    const current = route.cells[index];
    equal(
      Math.abs(current.col - previous.col) + Math.abs(current.row - previous.row),
      1,
      `branched route segment ${index} must remain cell-adjacent`,
    );
  }
  const recovered = resolveLordAlphaRocChargePose(route.cells, 1, route.turnIndex);
  deepStrictEqual(recovered, {
    col: 0,
    row: 0,
    phase: "recovered",
    cellIndex: route.cells.length - 1,
  }, "column 3 is enemy-side, so LASI still returns to a legal player cell");

  const unchanged = branchLordAlphaRocChargeCells(baseCells, { col: 0, row: 1 });
  deepStrictEqual(unchanged.cells, baseCells);

  const mixedRowBase = buildLordAlphaRocChargeCells(
    { col: 0, row: 0 },
    { col: 5, row: 1 },
  );
  const mixedRowRoute = branchLordAlphaRocChargeCells(
    mixedRowBase,
    { col: 4, row: 2 },
  );
  deepStrictEqual(
    mixedRowRoute.cells[mixedRowRoute.turnIndex],
    { col: 5, row: 1 },
    "branch origin is the farthest Roc Wing landing pane",
  );
  deepStrictEqual(
    mixedRowRoute.cells[mixedRowRoute.turnIndex + 1],
    { col: 4, row: 1 },
    "LASI first returns in the original lane to the selected column",
  );
  deepStrictEqual(
    mixedRowRoute.cells[mixedRowRoute.cells.length - 1],
    { col: 0, row: 2 },
    "LASI continues home through the selected lane after the turn",
  );

  const crossApexRoute = branchLordAlphaRocChargeCells(
    mixedRowBase,
    { col: 3, row: 0 },
  );
  deepStrictEqual(
    crossApexRoute.cells.slice(crossApexRoute.turnIndex),
    [
      { col: 5, row: 1 },
      { col: 4, row: 1 },
      { col: 3, row: 1 },
      { col: 3, row: 0 },
      { col: 2, row: 0 },
      { col: 1, row: 0 },
      { col: 0, row: 0 },
    ],
    "the press-relative pane remains the exact turn point after the apex",
  );

  equal(
    hasLordAlphaRocReachedBranchPane(
      route.cells,
      LORD_ALPHA_ROC_CHARGE_PHASES.impactEnd,
      route.turnIndex,
      { col: 3, row: 0 },
    ),
    false,
    "the marker remains while LASI has not yet reached the pane",
  );
  const atTurnPane = LORD_ALPHA_ROC_CHARGE_PHASES.impactEnd
    + (LORD_ALPHA_ROC_CHARGE_PHASES.returnEnd - LORD_ALPHA_ROC_CHARGE_PHASES.impactEnd) * 0.5;
  equal(
    hasLordAlphaRocReachedBranchPane(
      route.cells,
      atTurnPane,
      route.turnIndex,
      { col: 3, row: 0 },
    ),
    true,
    "the marker clears when LASI enters the highlighted pane",
  );
  equal(
    hasLordAlphaRocReachedBranchPane(
      route.cells,
      1,
      route.turnIndex,
      { col: 3, row: 0 },
    ),
    true,
    "a skipped frame after the turn still clears the marker",
  );
});

test("Lord Alpha campaign signatures do not inherit card cooldowns", () => {
  equal(lordAlphaSignatureUsesCooldown("classic", false), false);
  equal(lordAlphaSignatureUsesCooldown("classic", true), false);
  equal(lordAlphaSignatureUsesCooldown("vs", true), false);
  equal(lordAlphaSignatureUsesCooldown("vs", false, true), false);
  equal(lordAlphaSignatureUsesCooldown("vs", false), true);
});

test("Lord Alpha skill preview is explicit and covers each deterministic presentation", () => {
  equal(isLordAlphaSkillsPreviewSearch("?lordAlphaSkills=1"), true);
  equal(isLordAlphaSkillsPreviewSearch("mode=local&lordAlphaSkills=1"), true);
  equal(isLordAlphaSkillsPreviewSearch("?lordAlphaSkills=0"), false);
  equal(isLordAlphaSkillsPreviewSearch(""), false);
  deepStrictEqual(
    LORD_ALPHA_SKILL_PREVIEW_ACTIONS.map(({ id }) => id),
    [
      "web-shot",
      "grapple",
      "roc-stun",
      "dimensional-net",
      "afterimage-step",
      "shadow-clone",
      "tharthareon",
      "millennium-dragon",
      "equip",
    ],
  );
  for (const action of LORD_ALPHA_SKILL_PREVIEW_ACTIONS) {
    ok(action.label.length > 0);
    ok(action.presentation.durationMs > 0);
  }
  const equipLatency = LORD_ALPHA_SKILL_PREVIEW_ACTIONS.find(({ id }) => id === "equip");
  equal(equipLatency?.label, "Equip Latency");
  equal(equipLatency?.presentation.subtype, "equip-assembly");
  equal(equipLatency?.presentation.durationMs, LORD_ALPHA_EVENT_TIMINGS_MS.equip);

  deepStrictEqual(
    LORD_ALPHA_ARCHIVED_SKILL_ACTIONS.map(({ id, mechanicId }) => [id, mechanicId]),
    [["wormhole-step", "warpback"]],
  );
  equal(
    LORD_ALPHA_SKILL_PREVIEW_ACTIONS.some(({ id }) => id === "wormhole-step"),
    false,
  );
  equal(LORD_ALPHA_SKILL_SEQUENCE_ASSETS["wormhole-step"].id, "wormhole-step");
  equal(LORD_ALPHA_CARD_PRESENTATIONS.warpback.subtype, "wormhole-cast");
});

test("Lord Alpha animations default to solid sizing on every route", () => {
  deepStrictEqual(LORD_ALPHA_ANIMATION_PROFILES, ["legacy", "solid"]);
  equal(
    resolveLordAlphaAnimationProfile(
      "?lordAlphaSkills=1&lordAlphaAnimation=solid",
    ),
    "solid",
  );
  equal(
    resolveLordAlphaAnimationProfile(
      "lordAlphaAnimation=solid&lordAlphaSkills=1",
    ),
    "solid",
  );
  equal(resolveLordAlphaAnimationProfile("?lordAlphaAnimation=solid"), "solid");
  equal(resolveLordAlphaAnimationProfile("?lordAlphaSkills=1"), "solid");
  equal(
    resolveLordAlphaAnimationProfile("?lordAlphaSkills=1&lordAlphaAnimation=legacy"),
    "legacy",
  );
  equal(
    resolveLordAlphaAnimationProfile(
      "?lordAlphaSkills=0&lordAlphaAnimation=solid",
    ),
    "solid",
  );
  equal(
    resolveLordAlphaAnimationProfile(
      "?lordAlphaSkills=1&lordAlphaAnimation=SOLID",
    ),
    "solid",
  );
  equal(resolveLordAlphaAnimationProfile(""), "solid");
});

test("Lord Alpha held-target visual policy keeps solid targets full-size", () => {
  deepStrictEqual(resolveLordAlphaHeldTargetVisualPolicy("legacy"), {
    canvasScale: 0.56,
    overlayScale: 0.52,
    overlayClipPath: "ellipse(46% 42% at 50% 50%)",
  });
  deepStrictEqual(resolveLordAlphaHeldTargetVisualPolicy("solid"), {
    canvasScale: 1,
    overlayScale: 1,
    overlayClipPath: null,
  });
});

test("Lord Alpha signature banks expose stable live-mechanic and input mappings", () => {
  deepStrictEqual(LORD_ALPHA_SKILL_BINDINGS, [
    { slot: 0, gamepad: "X", keyboard: "Z" },
    { slot: 1, gamepad: "Y", keyboard: "X" },
    { slot: 2, gamepad: "B", keyboard: "C" },
  ]);
  deepStrictEqual(LORD_ALPHA_DIRECT_GAMEPAD_ACTIONS, {
    X: "tharthareon",
    B: "web-shot",
    R1: "roc-stun",
    R2: "afterimage-step",
  });
  equal(resolveLordAlphaDirectGamepadBinding("tharthareon"), "X");
  equal(resolveLordAlphaDirectGamepadBinding("web-shot"), "B");
  equal(resolveLordAlphaDirectGamepadBinding("roc-stun"), "R1");
  equal(resolveLordAlphaDirectGamepadBinding("afterimage-step"), "R2");
  equal(resolveLordAlphaDirectGamepadBinding("grapple"), null);
  deepStrictEqual(
    LORD_ALPHA_SKILL_BANKS.map(({ id, actionIds }) => ({ id, actionIds })),
    [
      { id: "web", actionIds: ["roc-stun", "grapple", "web-shot"] },
      { id: "mobility", actionIds: ["dimensional-net", "afterimage-step", "shadow-clone"] },
      { id: "summon-form", actionIds: ["tharthareon", "millennium-dragon", "equip"] },
    ],
  );
  deepStrictEqual(
    LORD_ALPHA_SKILL_PREVIEW_ACTIONS.map(({ id, mechanicId }) => [id, mechanicId]),
    [
      ["web-shot", "arcweb"],
      ["grapple", "gravity"],
      ["roc-stun", "freeze"],
      ["dimensional-net", "stasisgate"],
      ["afterimage-step", "backdash"],
      ["shadow-clone", null],
      ["tharthareon", "nuke"],
      ["millennium-dragon", "megabomb"],
      ["equip", null],
    ],
  );
  for (const action of LORD_ALPHA_SKILL_PREVIEW_ACTIONS) {
    if (action.mechanicId) ok(ABILITY_LOOKUP[action.mechanicId]);
  }

  equal(wrapLordAlphaSkillBank(-1), 2);
  equal(wrapLordAlphaSkillBank(3), 0);
  equal(resolveLordAlphaSkillAction(0, 0)?.id, "roc-stun");
  equal(resolveLordAlphaSkillAction(0, 2)?.id, "web-shot");
  equal(resolveLordAlphaSkillAction(1, 0)?.id, "dimensional-net");
  equal(resolveLordAlphaSkillAction(1, 2)?.id, "shadow-clone");
  equal(resolveLordAlphaSkillAction(2, 1)?.id, "millennium-dragon");
  equal(resolveLordAlphaSkillAction(20, -1), null);
  equal(resolveLordAlphaSkillAction(20, 3), null);
  equal(resolveLordAlphaSkillActionById("tharthareon")?.mechanicId, "nuke");
});

test("LASI direct controls yield to abilities and Evolution when the skill panel is closed", () => {
  equal(lordAlphaSkillControlsOwnGamepad({
    isLordAlpha: true,
    skillPanelOpen: false,
  }), false);
  equal(lordAlphaSkillControlsOwnGamepad({
    isLordAlpha: true,
    skillPanelOpen: true,
  }), true);
  equal(lordAlphaSkillControlsOwnGamepad({
    isLordAlpha: true,
    skillPanelOpen: true,
    evolutionSelectionActive: true,
  }), false);
  equal(lordAlphaSkillControlsOwnGamepad({
    isLordAlpha: true,
    skillPanelOpen: true,
    npcVsNpcActive: true,
  }), false);
  equal(lordAlphaSkillControlsOwnGamepad({
    isLordAlpha: false,
    skillPanelOpen: true,
  }), false);
});

test("Lord Alpha L2 tap counts separate panel and bank commands", () => {
  equal(LORD_ALPHA_L2_TAP_WINDOW_MS, 260);
  equal(resolveLordAlphaL2TapCommand(1), "toggle-skill-panel");
  equal(resolveLordAlphaL2TapCommand(2), "cycle-forward");
  equal(resolveLordAlphaL2TapCommand(3), "cycle-back");
  equal(resolveLordAlphaL2TapCommand(0), null);
  equal(resolveLordAlphaL2TapCommand(4), null);
  equal(resolveLordAlphaL2TapCommand(Number.NaN), null);
});

test("Lord Alpha R2 tap count preserves Step and adds Slice and Back Thrust", () => {
  equal(LORD_ALPHA_R2_TAP_WINDOW_MS, 260);
  equal(resolveLordAlphaR2TapCommand(1), "afterimage-step");
  equal(resolveLordAlphaR2TapCommand(2), "ninjato-phase-slice");
  equal(resolveLordAlphaR2TapCommand(3), "ninjato-back-thrust");
  equal(resolveLordAlphaR2TapCommand(0), null);
  equal(resolveLordAlphaR2TapCommand(4), null);
  equal(resolveLordAlphaR2TapCommand(Number.NaN), null);
});

test("Roc Wing keeps its first R2 spin while double and triple taps retain their sword moves", () => {
  equal(resolveLordAlphaRocR2TapCommand(1), "roc-wing-spin");
  equal(resolveLordAlphaRocR2TapCommand(2), "ninjato-phase-slice");
  equal(resolveLordAlphaRocR2TapCommand(3), "ninjato-back-thrust");
  equal(resolveLordAlphaRocR2TapCommand(0), null);
  equal(resolveLordAlphaRocR2TapCommand(4), null);
  equal(resolveLordAlphaRocR2TapCommand(Number.NaN), null);
});

test("Lord Alpha skill events resolve to their ImageGen-authored frame sequences", () => {
  deepStrictEqual(Object.keys(LORD_ALPHA_SKILL_SEQUENCE_ASSETS), [
    ...LORD_ALPHA_SKILL_SEQUENCE_IDS,
  ]);
  for (const asset of Object.values(LORD_ALPHA_SKILL_SEQUENCE_ASSETS)) {
    ok(asset.suffix.startsWith("skins/lord-alpha/skill-sequences/"));
    ok(asset.suffix.endsWith(".png"));
    const expectedFrameCount = asset.id === "tharthareon-fireball" || asset.id === "tharthareon"
      ? 7
      : asset.id === "ninjato-phase-slice"
        ? 10
        : LORD_ALPHA_SKILL_SEQUENCE_FRAME_COUNT;
    equal(asset.frameCount, expectedFrameCount);
    equal(asset.frameWidth, LORD_ALPHA_SKILL_SEQUENCE_FRAME_WIDTH);
    equal(asset.frameHeight, LORD_ALPHA_SKILL_SEQUENCE_FRAME_HEIGHT);
    equal(asset.frameWidth * asset.frameCount, asset.frameWidth * expectedFrameCount);
    equal(asset.frameHoldMs.length, asset.frameCount);
    ok(asset.frameHoldMs.every((hold) => Number.isFinite(hold) && hold > 0));
    equal(asset.frameHoldMs.reduce((sum, hold) => sum + hold, 0), asset.durationMs);
    ok(Number.isInteger(asset.reducedMotionFrame));
    ok(asset.reducedMotionFrame >= 0);
    ok(asset.reducedMotionFrame < asset.frameCount);
    ok(asset.durationMs > 0);
    ok(Number.isFinite(asset.actorScale));
    ok(asset.actorScale >= 1 && asset.actorScale <= 1.5);
    ok(Number.isFinite(asset.actorRootY));
    ok(asset.actorRootY > 0 && asset.actorRootY < asset.frameHeight);
    if ("frameScales" in asset) {
      equal(asset.frameScales.length, asset.frameCount);
      ok(asset.frameScales.every((scale) => Number.isFinite(scale) && scale >= 0.5 && scale <= 2));
    }
    for (const forbiddenKey of ["damage", "power", "range", "cooldown", "status"]) {
      ok(!(forbiddenKey in asset));
    }
  }
  deepStrictEqual(
    Object.fromEntries(Object.values(LORD_ALPHA_SKILL_SEQUENCE_ASSETS)
      .map(({ id, durationMs }) => [id, durationMs])),
    {
      "web-shot": 640,
      grapple: 700,
      "roc-stun": LORD_ALPHA_ROC_CHARGE_DURATION_MS,
      "dimensional-net": 800,
      "wormhole-step": 760,
      "shadow-clone": 960,
      "ninjato-phase-slice": 1_420,
      "ninjato-back-thrust": 660,
      tharthareon: 980,
      "tharthareon-fireball": 2_020,
      "millennium-dragon": 1_100,
      equip: 720,
    },
  );
  deepStrictEqual(
    Object.fromEntries(Object.values(LORD_ALPHA_SKILL_SEQUENCE_ASSETS)
      .map(({ id, frameHoldMs, reducedMotionFrame }) => [id, {
        frameHoldMs: [...frameHoldMs],
        reducedMotionFrame,
      }])),
    {
      "web-shot": {
        frameHoldMs: [70, 70, 60, 60, 70, 90, 100, 120],
        reducedMotionFrame: 3,
      },
      grapple: {
        frameHoldMs: [80, 70, 70, 80, 110, 110, 90, 90],
        reducedMotionFrame: 4,
      },
      "roc-stun": {
        frameHoldMs: [140, 130, 140, 180, 420, 420, 210, 160],
        reducedMotionFrame: 3,
      },
      "dimensional-net": {
        frameHoldMs: [90, 90, 90, 100, 120, 120, 90, 100],
        reducedMotionFrame: 5,
      },
      "wormhole-step": {
        frameHoldMs: [80, 80, 90, 100, 90, 100, 100, 120],
        reducedMotionFrame: 5,
      },
      "shadow-clone": {
        frameHoldMs: [90, 100, 110, 120, 140, 160, 120, 120],
        reducedMotionFrame: 6,
      },
      "ninjato-phase-slice": {
        frameHoldMs: [240, 90, 180, 50, 50, 60, 280, 60, 90, 320],
        reducedMotionFrame: 6,
      },
      "ninjato-back-thrust": {
        frameHoldMs: [90, 60, 55, 55, 100, 140, 70, 90],
        reducedMotionFrame: 5,
      },
      tharthareon: {
        frameHoldMs: [150, 130, 140, 160, 140, 130, 130],
        reducedMotionFrame: 3,
      },
      "tharthareon-fireball": {
        frameHoldMs: [550, 160, 180, 240, 180, 160, 550],
        reducedMotionFrame: 3,
      },
      "millennium-dragon": {
        frameHoldMs: [110, 120, 130, 150, 170, 180, 110, 130],
        reducedMotionFrame: 6,
      },
      equip: {
        frameHoldMs: [70, 70, 80, 90, 100, 110, 90, 110],
        reducedMotionFrame: 7,
      },
    },
  );
  equal(
    LORD_ALPHA_THARTHAREON_FIREBALL_RELEASE_MS,
    LORD_ALPHA_SKILL_SEQUENCE_ASSETS["tharthareon-fireball"].frameHoldMs
      .slice(0, 3)
      .reduce((sum, hold) => sum + hold, 0),
  );

  for (const action of LORD_ALPHA_SKILL_PREVIEW_ACTIONS) {
    const sequence = resolveLordAlphaSkillSequence(createLordAlphaPresentationEvent(
      action.presentation.kind,
      0,
      { subtype: action.presentation.subtype },
    ));
    ok(sequence);
    ok(action.presentation.durationMs >= sequence.durationMs);
  }

  const cases = [
    ["web", "web-chain", "web-shot"],
    ["web", "web-pull", "grapple"],
    ["move", "roc-stun", "roc-stun"],
    ["wormhole", "dimensional-net", "dimensional-net"],
    ["wormhole", "wormhole-cast", "wormhole-step"],
    ["clone", "clone-symmetry", "shadow-clone"],
    ["move", "ninjato-phase-slice", "ninjato-phase-slice"],
    ["move", "ninjato-back-thrust", "ninjato-back-thrust"],
    ["tharthareon", "tharthareon-emerge", "tharthareon"],
    ["tharthareon", "tharthareon-fireball", "tharthareon-fireball"],
    ["tharthareon", "tharthareon-bite-lunge", "tharthareon"],
    ["dragon", "ultimate-landing", "millennium-dragon"],
    ["equip", "equip-assembly", "equip"],
  ] as const;

  for (const [kind, subtype, expected] of cases) {
    equal(resolveLordAlphaSkillSequence(
      createLordAlphaPresentationEvent(kind, 0, { subtype }),
    )?.id, expected);
  }
  equal(resolveLordAlphaSkillSequence(null), null);
  equal(resolveLordAlphaSkillSequence(createLordAlphaPresentationEvent("move", 0, {
    subtype: "step",
  })), null);
  equal(resolveLordAlphaSkillSequence(createLordAlphaPresentationEvent("equip", 0, {
    subtype: "equip-assembly",
  }))?.id, "equip");
});

test("each Lord Alpha combo beat resolves to a distinct authored attack strip", () => {
  deepStrictEqual(Object.keys(LORD_ALPHA_ATTACK_SEQUENCE_ASSETS), [
    ...LORD_ALPHA_COMBO_BEATS,
  ]);
  const suffixes = new Set<string>();
  const ids = new Set<string>();
  for (const beat of LORD_ALPHA_COMBO_BEATS) {
    const asset = resolveLordAlphaAttackSequence(beat);
    equal(asset, LORD_ALPHA_ATTACK_SEQUENCE_ASSETS[beat]);
    equal(asset.frameCount, 8);
    equal(asset.frameWidth, 240);
    equal(asset.frameHeight, 160);
    equal(asset.frameHoldMs.reduce((sum, hold) => sum + hold, 0), asset.durationMs);
    ok(Number.isFinite(asset.actorScale));
    ok(asset.actorScale >= 1 && asset.actorScale <= 1.5);
    ok(Number.isFinite(asset.actorRootY));
    ok(asset.actorRootY > 0 && asset.actorRootY < asset.frameHeight);
    ok(asset.durationMs <= 330);
    ok(new RegExp(`supreme-combo-${beat}-v\\d+\\.png$`).test(asset.suffix));
    suffixes.add(asset.suffix);
    ids.add(asset.id);
  }
  equal(suffixes.size, LORD_ALPHA_COMBO_BEATS.length);
  equal(ids.size, LORD_ALPHA_COMBO_BEATS.length);
  equal(resolveLordAlphaAttackSequence(null), LORD_ALPHA_ATTACK_SEQUENCE_ASSETS.quick);
});

test("each active Lord Alpha skill resolves to an independent board-space effect strip", () => {
  deepStrictEqual(Object.keys(LORD_ALPHA_EFFECT_SEQUENCE_ASSETS), [
    ...LORD_ALPHA_EFFECT_SEQUENCE_IDS,
  ]);
  const cases = [
    ["web", "web-chain", "web-shot", "travel"],
    ["web", "web-restraint", "web-shot", "travel"],
    ["web", "web-pull", "grapple", "travel"],
    ["move", "roc-stun", "roc-stun", "target"],
    ["wormhole", "dimensional-net", "dimensional-net", "target"],
    ["wormhole", "wormhole-cast", "wormhole-step", "dual"],
    ["clone", "clone-symmetry", "shadow-clone", "origin"],
    ["tharthareon", "tharthareon-emerge", "tharthareon", "origin"],
    ["dragon", "ultimate-landing", "millennium-dragon", "board"],
    ["equip", "equip-assembly", "equip-latency", "origin"],
  ] as const;
  const suffixes = new Set<string>();

  for (const [kind, subtype, expected, placement] of cases) {
    const asset = resolveLordAlphaEffectSequence(
      createLordAlphaPresentationEvent(kind, 0, { subtype }),
    );
    equal(asset?.id, expected);
    equal(asset?.frameCount, 8);
    equal(asset?.frameWidth, 240);
    equal(asset?.frameHeight, 160);
    equal(asset?.placement, placement);
    ok(asset?.suffix.startsWith("effects/lord-alpha/sequences/"));
    ok(Number.isInteger(asset?.reducedMotionFrame));
    ok((asset?.reducedMotionFrame ?? -1) >= 0);
    ok((asset?.reducedMotionFrame ?? 8) < (asset?.frameCount ?? 0));
    ok((asset?.spanScale ?? 0) > 0);
    if (asset) suffixes.add(asset.suffix);
  }
  const grappleOrb = LORD_ALPHA_EFFECT_SEQUENCE_ASSETS["grapple-orb"];
  equal(grappleOrb.placement, "target");
  equal(grappleOrb.frameCount, 8);
  equal(grappleOrb.frameWidth, 240);
  equal(grappleOrb.frameHeight, 160);
  ok(grappleOrb.suffix.endsWith("grapple-orb-v18.png"));
  suffixes.add(grappleOrb.suffix);
  equal(
    LORD_ALPHA_EFFECT_SEQUENCE_ASSETS.tharthareon.suffix,
    "effects/lord-alpha/sequences/tharthareon-fixed-portal-v19.png",
  );
  equal(suffixes.size, LORD_ALPHA_EFFECT_SEQUENCE_IDS.length);

  equal(resolveLordAlphaEffectSequence(null), null);
  equal(resolveLordAlphaEffectSequence(createLordAlphaPresentationEvent("move", 0, {
    subtype: "step",
  })), null);
});

test("Lord Alpha manifest has stable ids and BASE_URL-relative suffixes", () => {
  equal(LORD_ALPHA_SKIN_ID, "lord-alpha");
  deepStrictEqual(LORD_ALPHA_FORM_IDS, ["relaxed", "afro", "supreme"]);
  deepStrictEqual(LORD_ALPHA_PRESENTATION_EVENT_KINDS, [
    "move",
    "web",
    "wormhole",
    "tharthareon",
    "dragon",
    "equip",
    "clone",
  ]);

  for (const form of LORD_ALPHA_FORM_IDS) {
    const entry = LORD_ALPHA_ASSETS.forms[form];
    equal(entry.id, form);
    ok(entry.label.length > 0);
    ok(entry.idleSuffix.startsWith("skins/lord-alpha/"));
    ok(entry.attackSuffix.startsWith("skins/lord-alpha/"));
    ok(!entry.idleSuffix.startsWith("/"));
    ok(!entry.attackSuffix.startsWith("/"));
  }
  for (const suffix of Object.values(LORD_ALPHA_ASSETS.effects)) {
    ok(suffix.startsWith("effects/lord-alpha/"));
    ok(!suffix.startsWith("/"));
  }
  deepStrictEqual(Object.keys(LORD_ALPHA_ASSETS.effects), ["tharthareon"]);
  deepStrictEqual(LORD_ALPHA_ASSETS.combo, LORD_ALPHA_COMBO_ASSET_SUFFIXES);
  deepStrictEqual(LORD_ALPHA_ASSETS.attackSequences, LORD_ALPHA_ATTACK_SEQUENCE_ASSETS);
  deepStrictEqual(LORD_ALPHA_ASSETS.skillSequences, LORD_ALPHA_SKILL_SEQUENCE_ASSETS);
  deepStrictEqual(LORD_ALPHA_ASSETS.rocWingThrustSequence, LORD_ALPHA_ROC_WING_THRUST_SEQUENCE);
  deepStrictEqual(LORD_ALPHA_ASSETS.rocWingSpinSequence, LORD_ALPHA_ROC_WING_SPIN_SEQUENCE);
  deepStrictEqual(LORD_ALPHA_ASSETS.effectSequences, LORD_ALPHA_EFFECT_SEQUENCE_ASSETS);
  deepStrictEqual(LORD_ALPHA_COMBO_ASSET_SUFFIXES, {
    quick: "skins/lord-alpha/supreme-combo-quick.png",
    web: "skins/lord-alpha/supreme-combo-web.png",
    power: "skins/lord-alpha/supreme-combo-power.png",
    roc: "skins/lord-alpha/supreme-combo-roc.png",
    finisher: "skins/lord-alpha/supreme-combo-finisher.png",
  });
  for (const suffix of Object.values(LORD_ALPHA_COMBO_ASSET_SUFFIXES)) {
    ok(suffix.startsWith("skins/lord-alpha/supreme-combo-"));
    ok(!suffix.startsWith("/"));
  }
  deepStrictEqual(LORD_ALPHA_PROCEDURAL_EFFECTS, [
    "move",
  ]);
  equal(LORD_ALPHA_ROC_WING_THRUST_SEQUENCE.suffix, "skins/lord-alpha/attachments/roc-wing-thrust-v19.png");
  equal(LORD_ALPHA_ROC_WING_THRUST_SEQUENCE.durationMs, LORD_ALPHA_ROC_CHARGE_DURATION_MS);
  equal(LORD_ALPHA_ROC_WING_SPIN_SEQUENCE.durationMs, LORD_ALPHA_ROC_BRANCH_SPIN_DURATION_MS);
  equal(LORD_ALPHA_VFX_TIMINGS_MS["roc-stun"], LORD_ALPHA_ROC_CHARGE_DURATION_MS);
  equal(LORD_ALPHA_SKILL_SEQUENCE_ASSETS["roc-stun"].durationMs, LORD_ALPHA_ROC_CHARGE_DURATION_MS);
  equal(LORD_ALPHA_ASSET_REVISION, "2026-10-27-frame-normalization-v1");
  equal(LORD_ALPHA_GAMEPLAY_BALANCE_CHANGES, false);
  equal(LORD_ALPHA_HITBOX_CHANGES, false);
});

test("one Roc wing stays on anatomical left for both facings", () => {
  equal(anatomicalLeftScreenSide("right"), "screen-left");
  equal(anatomicalLeftScreenSide("left"), "screen-right");

  for (const [facing, expectedSide, expectedAnchor] of [
    ["right", "screen-left", -1],
    ["left", "screen-right", 1],
  ] as const) {
    const attachments = rocWingPlacement(facing);
    equal(attachments.length, 1);
    deepStrictEqual(attachments[0], {
      kind: "roc-wing",
      anatomicalSide: "left",
      screenSide: expectedSide,
      anchorX: expectedAnchor,
    });
  }
});

test("presentation combo advances through five stable beats and wraps", () => {
  deepStrictEqual(LORD_ALPHA_COMBO_BEATS, [
    "quick",
    "web",
    "power",
    "roc",
    "finisher",
  ]);

  let state = createLordAlphaComboState();
  const results = LORD_ALPHA_COMBO_BEATS.map((_, index) => {
    const result = advanceLordAlphaCombo(state, index * 100);
    state = result.state;
    return result;
  });

  deepStrictEqual(
    results.map(({ beat }) => beat),
    LORD_ALPHA_COMBO_BEATS,
  );
  deepStrictEqual(
    results.map(({ completedCycle }) => completedCycle),
    [false, false, false, false, true],
  );
  equal(state.nextBeatIndex, 0);
  equal(state.completedCycles, 1);

  const wrapped = advanceLordAlphaCombo(state, 500);
  equal(wrapped.beat, "quick");
  equal(wrapped.restarted, false);
  equal(wrapped.state.completedCycles, 1);
});

test("presentation combo resets only after its timing window", () => {
  const first = advanceLordAlphaCombo(createLordAlphaComboState(), 100);
  equal(first.beat, "quick");

  const boundary = advanceLordAlphaCombo(
    first.state,
    100 + LORD_ALPHA_COMBO_RESET_MS,
  );
  equal(boundary.beat, "web");
  equal(boundary.restarted, false);

  const expired = advanceLordAlphaCombo(
    boundary.state,
    100 + LORD_ALPHA_COMBO_RESET_MS * 2 + 1,
  );
  equal(expired.beat, "quick");
  equal(expired.restarted, true);

  const backwards = advanceLordAlphaCombo(expired.state, 0);
  equal(backwards.beat, "quick");
  equal(backwards.restarted, true);

  const reset = resetLordAlphaCombo({
    nextBeatIndex: 4,
    lastTriggerAt: 500,
    completedCycles: 3,
  });
  deepStrictEqual(reset, {
    nextBeatIndex: 0,
    lastTriggerAt: null,
    completedCycles: 3,
  });
});

test("all presentation timings are centralized, positive, and visual-only", () => {
  equal(
    LORD_ALPHA_PRESENTATION_TIMINGS_MS.comboReset,
    LORD_ALPHA_COMBO_RESET_MS,
  );
  deepStrictEqual(
    LORD_ALPHA_PRESENTATION_TIMINGS_MS.combo,
    LORD_ALPHA_COMBO_TIMINGS_MS,
  );
  deepStrictEqual(
    LORD_ALPHA_PRESENTATION_TIMINGS_MS.event,
    LORD_ALPHA_EVENT_TIMINGS_MS,
  );

  for (const beat of LORD_ALPHA_COMBO_BEATS) {
    ok(LORD_ALPHA_COMBO_TIMINGS_MS[beat] > 0);
    equal(LORD_ALPHA_COMBO_PRESENTATIONS[beat].beat, beat);
    equal(
      LORD_ALPHA_COMBO_PRESENTATIONS[beat].durationMs,
      LORD_ALPHA_COMBO_TIMINGS_MS[beat],
    );
  }
  for (const kind of LORD_ALPHA_PRESENTATION_EVENT_KINDS) {
    ok(LORD_ALPHA_EVENT_TIMINGS_MS[kind] > 0);
  }
});

test("presentation events preserve old calls and normalize optional anchors", () => {
  deepStrictEqual(createLordAlphaPresentationEvent("web", 0.5), {
    kind: "web",
    progress: 0.5,
  });
  deepStrictEqual(
    createLordAlphaPresentationEvent("wormhole", 2, {
      subtype: "wormhole-arrival",
      origin: { x: -0.25, y: 0.4 },
      target: { x: 1.5, y: 0.75 },
      destination: { x: 0.7, y: 2 },
    }),
    {
      kind: "wormhole",
      progress: 1,
      subtype: "wormhole-arrival",
      origin: { x: 0, y: 0.4 },
      target: { x: 1, y: 0.75 },
      destination: { x: 0.7, y: 1 },
    },
  );
  deepStrictEqual(
    createLordAlphaPresentationEvent("move", Number.NaN, {
      origin: { x: Number.NaN, y: 0.5 },
    }),
    { kind: "move", progress: 0 },
  );
});

test("existing cards map to presentation language without balance data", () => {
  deepStrictEqual(getLordAlphaCardPresentation("arcweb"), {
    kind: "web",
    subtype: "web-chain",
    durationMs: LORD_ALPHA_EVENT_TIMINGS_MS.web,
  });
  equal(getLordAlphaCardPresentation("not-a-card"), null);

  for (const presentation of Object.values(LORD_ALPHA_CARD_PRESENTATIONS)) {
    deepStrictEqual(Object.keys(presentation).sort(), [
      "durationMs",
      "kind",
      "subtype",
    ]);
    ok(presentation.durationMs > 0);
    for (const forbiddenKey of [
      "damage",
      "power",
      "range",
      "cooldown",
      "status",
    ]) {
      ok(!(forbiddenKey in presentation));
    }
  }
});

test("card subtypes resolve to reachable render modes with canonical lifetimes", () => {
  const cases = [
    ["rootsnare", "web-impact"],
    ["gravity", "grapple"],
    ["freeze", "roc-stun"],
    ["stasisgate", "dimensional-net"],
    ["nuke", "tharthareon"],
    ["megabomb", "dragon"],
  ] as const;

  for (const [cardId, expectedMode] of cases) {
    const presentation = getLordAlphaCardPresentation(cardId);
    ok(presentation);
    const event = createLordAlphaPresentationEvent(presentation.kind, 0, {
      subtype: presentation.subtype,
    });
    equal(resolveLordAlphaVfxMode(event), expectedMode);
    equal(presentation.durationMs, LORD_ALPHA_VFX_TIMINGS_MS[expectedMode]);
  }

  equal(
    resolveLordAlphaVfxMode(createLordAlphaPresentationEvent("clone", 0, {
      subtype: "clone-symmetry",
    })),
    "clone",
  );
});

test("topology stages are ordered and selected from clamped progress", () => {
  deepStrictEqual(LORD_ALPHA_TOPOLOGY_STAGES, [
    "points",
    "connections",
    "structure",
    "effect",
  ]);
  equal(clampTopologyProgress(Number.NaN), 0);
  equal(clampTopologyProgress(-10), 0);
  equal(clampTopologyProgress(10), 1);

  deepStrictEqual([-1, 0.25, 0.5, 0.75, 2].map(topologyStage), [
    "points",
    "connections",
    "structure",
    "effect",
    "effect",
  ]);
  equal(topologyStage(0.249999), "points");
  equal(topologyStage(0.499999), "connections");
  equal(topologyStage(0.749999), "structure");
});

test("topology generation is deterministic and bounded for every vocabulary kind", () => {
  for (const kind of LORD_ALPHA_TOPOLOGY_VOCABULARY) {
    const options = { kind, seed: "alpha-seed", nodeCount: 24 } as const;
    const first = generateLordAlphaTopology(options);
    const second = generateLordAlphaTopology(options);
    deepStrictEqual(first, second);
    equal(first.kind, kind);
    equal(first.nodes.length, 24);
    ok(first.edges.length <= LORD_ALPHA_TOPOLOGY_LIMITS.maxEdges);

    const edgeKeys = new Set<string>();
    first.nodes.forEach((node, index) => {
      equal(node.id, index);
      ok(Number.isFinite(node.x));
      ok(Number.isFinite(node.y));
      ok(node.x >= LORD_ALPHA_TOPOLOGY_LIMITS.coordinateMin);
      ok(node.x <= LORD_ALPHA_TOPOLOGY_LIMITS.coordinateMax);
      ok(node.y >= LORD_ALPHA_TOPOLOGY_LIMITS.coordinateMin);
      ok(node.y <= LORD_ALPHA_TOPOLOGY_LIMITS.coordinateMax);
    });
    first.edges.forEach((edge) => {
      ok(edge.from >= 0 && edge.from < first.nodes.length);
      ok(edge.to >= 0 && edge.to < first.nodes.length);
      ok(edge.from !== edge.to);
      const key = `${Math.min(edge.from, edge.to)}:${Math.max(edge.from, edge.to)}`;
      ok(!edgeKeys.has(key));
      edgeKeys.add(key);
    });
  }

  equal(
    generateLordAlphaTopology({ kind: "net", seed: 1, nodeCount: -100 }).nodes
      .length,
    LORD_ALPHA_TOPOLOGY_LIMITS.minNodes,
  );
  equal(
    generateLordAlphaTopology({ kind: "torus", seed: 1, nodeCount: 100_000 })
      .nodes.length,
    LORD_ALPHA_TOPOLOGY_LIMITS.maxNodes,
  );
});

test("topology morphs preserve node identity and interpolate deterministically", () => {
  const morph = createLordAlphaTopologyMorph(
    {
      kind: "strand",
      nodes: [
        { id: 7, x: -1, y: 0 },
        { id: 2, x: 0, y: -1 },
      ],
      edges: [{ from: 7, to: 2 }],
    },
    {
      kind: "fold",
      nodes: [
        { id: 2, x: 0, y: 1 },
        { id: 9, x: 1, y: 0 },
      ],
      edges: [{ from: 2, to: 9 }],
    },
  );

  deepStrictEqual(
    morph.nodes.map(({ id }) => id),
    [2, 7, 9],
  );
  deepStrictEqual(sampleLordAlphaTopologyMorph(morph, 0), [
    { id: 2, x: 0, y: -1 },
    { id: 7, x: -1, y: 0 },
    { id: 9, x: 0, y: 0 },
  ]);
  deepStrictEqual(sampleLordAlphaTopologyMorph(morph, 0.5), [
    { id: 2, x: 0, y: 0 },
    { id: 7, x: -0.5, y: 0 },
    { id: 9, x: 0.5, y: 0 },
  ]);
  deepStrictEqual(sampleLordAlphaTopologyMorph(morph, 1), [
    { id: 2, x: 0, y: 1 },
    { id: 7, x: 0, y: 0 },
    { id: 9, x: 1, y: 0 },
  ]);
  deepStrictEqual(lordAlphaTopologyMorphWeights(0), { from: 1, to: 0 });
  deepStrictEqual(lordAlphaTopologyMorphWeights(0.5), {
    from: 0.5,
    to: 0.5,
  });
  deepStrictEqual(lordAlphaTopologyMorphWeights(1), { from: 0, to: 1 });
});

test("dimensional net morph is a stable bounded web-to-wormhole transform", () => {
  const first = createLordAlphaDimensionalNetMorph("calculus", 25);
  const second = createLordAlphaDimensionalNetMorph("calculus", 25);
  deepStrictEqual(first, second);
  equal(first.fromKind, "net");
  equal(first.toKind, "portal");
  equal(first.nodes.length, 25);
  deepStrictEqual(
    first.nodes.map(({ id }) => id),
    Array.from({ length: 25 }, (_, id) => id),
  );

  for (const node of sampleLordAlphaTopologyMorph(first, 0.37)) {
    ok(Number.isFinite(node.x));
    ok(Number.isFinite(node.y));
    ok(node.x >= LORD_ALPHA_TOPOLOGY_LIMITS.coordinateMin);
    ok(node.x <= LORD_ALPHA_TOPOLOGY_LIMITS.coordinateMax);
    ok(node.y >= LORD_ALPHA_TOPOLOGY_LIMITS.coordinateMin);
    ok(node.y <= LORD_ALPHA_TOPOLOGY_LIMITS.coordinateMax);
  }
});
