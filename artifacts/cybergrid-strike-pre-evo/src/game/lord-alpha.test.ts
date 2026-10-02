import { deepStrictEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { ABILITY_LOOKUP } from "./constants";
import {
  LORD_ALPHA_ASSETS,
  LORD_ALPHA_CARD_PRESENTATIONS,
  LORD_ALPHA_COMBO_ASSET_SUFFIXES,
  LORD_ALPHA_COMBO_BEATS,
  LORD_ALPHA_COMBO_PRESENTATIONS,
  LORD_ALPHA_COMBO_RESET_MS,
  LORD_ALPHA_COMBO_TIMINGS_MS,
  LORD_ALPHA_EVENT_TIMINGS_MS,
  LORD_ALPHA_FORM_IDS,
  LORD_ALPHA_GAMEPLAY_BALANCE_CHANGES,
  LORD_ALPHA_HITBOX_CHANGES,
  LORD_ALPHA_PRESENTATION_EVENT_KINDS,
  LORD_ALPHA_PRESENTATION_TIMINGS_MS,
  LORD_ALPHA_PROCEDURAL_EFFECTS,
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
  anatomicalLeftScreenSide,
  clampTopologyProgress,
  createLordAlphaComboState,
  createLordAlphaDimensionalNetMorph,
  createLordAlphaPresentationEvent,
  createLordAlphaTopologyMorph,
  generateLordAlphaTopology,
  getLordAlphaCardPresentation,
  isLordAlphaSkillsPreviewSearch,
  lordAlphaTopologyMorphWeights,
  resetLordAlphaCombo,
  resolveLordAlphaSkillAction,
  resolveLordAlphaSkillSequence,
  resolveLordAlphaVfxMode,
  rocWingPlacement,
  sampleLordAlphaTopologyMorph,
  topologyStage,
  wrapLordAlphaSkillBank,
} from "./lord-alpha";

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
      "wormhole-step",
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
});

test("Lord Alpha signature banks expose stable live-mechanic and input mappings", () => {
  deepStrictEqual(LORD_ALPHA_SKILL_BINDINGS, [
    { slot: 0, gamepad: "X", keyboard: "Z" },
    { slot: 1, gamepad: "Y", keyboard: "X" },
    { slot: 2, gamepad: "B", keyboard: "C" },
  ]);
  deepStrictEqual(
    LORD_ALPHA_SKILL_BANKS.map(({ id, actionIds }) => ({ id, actionIds })),
    [
      { id: "web", actionIds: ["web-shot", "grapple", "dimensional-net"] },
      { id: "mobility", actionIds: ["roc-stun", "wormhole-step", "shadow-clone"] },
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
      ["wormhole-step", "warpback"],
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
  equal(resolveLordAlphaSkillAction(0, 0)?.id, "web-shot");
  equal(resolveLordAlphaSkillAction(1, 2)?.id, "shadow-clone");
  equal(resolveLordAlphaSkillAction(2, 1)?.id, "millennium-dragon");
  equal(resolveLordAlphaSkillAction(20, -1), null);
  equal(resolveLordAlphaSkillAction(20, 3), null);
});

test("Lord Alpha skill events resolve to their ImageGen-authored frame sequences", () => {
  deepStrictEqual(Object.keys(LORD_ALPHA_SKILL_SEQUENCE_ASSETS), [
    ...LORD_ALPHA_SKILL_SEQUENCE_IDS,
  ]);
  for (const asset of Object.values(LORD_ALPHA_SKILL_SEQUENCE_ASSETS)) {
    ok(asset.suffix.startsWith("skins/lord-alpha/skill-sequences/"));
    ok(asset.suffix.endsWith(".png"));
    equal(asset.frameCount, LORD_ALPHA_SKILL_SEQUENCE_FRAME_COUNT);
    equal(asset.frameWidth, LORD_ALPHA_SKILL_SEQUENCE_FRAME_WIDTH);
    equal(asset.frameHeight, LORD_ALPHA_SKILL_SEQUENCE_FRAME_HEIGHT);
    equal(asset.frameWidth * asset.frameCount, 960);
    ok(asset.durationMs > 0);
    for (const forbiddenKey of ["damage", "power", "range", "cooldown", "status"]) {
      ok(!(forbiddenKey in asset));
    }
  }
  deepStrictEqual(
    Object.fromEntries(Object.values(LORD_ALPHA_SKILL_SEQUENCE_ASSETS)
      .map(({ id, durationMs }) => [id, durationMs])),
    {
      "web-shot": 840,
      grapple: 960,
      "roc-stun": 840,
      "dimensional-net": 1_120,
      "wormhole-step": 960,
      "shadow-clone": 1_120,
      tharthareon: 1_240,
      "millennium-dragon": 1_280,
    },
  );

  for (const action of LORD_ALPHA_SKILL_PREVIEW_ACTIONS) {
    if (action.id === "equip") continue;
    const sequence = resolveLordAlphaSkillSequence(createLordAlphaPresentationEvent(
      action.presentation.kind,
      0,
      { subtype: action.presentation.subtype },
    ));
    ok(sequence);
    ok(sequence.durationMs / sequence.frameCount >= 200);
    ok(action.presentation.durationMs >= sequence.durationMs + 200);
  }

  const cases = [
    ["web", "web-chain", "web-shot"],
    ["web", "web-pull", "grapple"],
    ["move", "roc-stun", "roc-stun"],
    ["wormhole", "dimensional-net", "dimensional-net"],
    ["wormhole", "wormhole-cast", "wormhole-step"],
    ["clone", "clone-symmetry", "shadow-clone"],
    ["tharthareon", "tharthareon-emerge", "tharthareon"],
    ["dragon", "ultimate-landing", "millennium-dragon"],
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
  deepStrictEqual(LORD_ALPHA_ASSETS.skillSequences, LORD_ALPHA_SKILL_SEQUENCE_ASSETS);
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
    "web",
    "wormhole",
    "dragon",
    "equip",
    "clone",
  ]);
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
    }),
    {
      kind: "wormhole",
      progress: 1,
      subtype: "wormhole-arrival",
      origin: { x: 0, y: 0.4 },
      target: { x: 1, y: 0.75 },
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
