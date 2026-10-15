import { COMPETITIVE_RULESET } from './competitive-balance';
import {
  VERSUS_ABILITY_LIMITS,
  type VersusStatusId,
  type VersusStatusIntent,
} from './versus-ability-resolver';

/**
 * Timers that already exist on GameState.  The adapter exposes max-values for
 * these keys so the UI/runtime can apply them with `Math.max(current, next)`.
 */
export const EXISTING_VERSUS_TIMER_FIELDS = [
  'adaptiveAmmoTimer',
  'berserkTimer',
  'critTimer',
  'drainTimer',
  'echoTimer',
  'ghostTimer',
  'overclockTimer',
  'overdriveTimer',
  'overloadTimer',
  'pulseTimer',
  'regenTimer',
  'signalJamTimer',
  'stasisGateTimer',
  'turretTimer',
  'voltageTimer',
] as const;

export type ExistingVersusTimerField = (typeof EXISTING_VERSUS_TIMER_FIELDS)[number];

/** Persistent caster mechanics whose magnitude matters in addition to time. */
export type CasterRuntimeWindowId =
  | 'barrier'
  | 'criticalChance'
  | 'damageMultiplier'
  | 'echo'
  | 'fireRateMultiplier'
  | 'integrityMultiplier'
  | 'invulnerability'
  | 'leech'
  | 'overload'
  | 'pierce'
  | 'regeneration'
  | 'turret'
  | 'voltage';

/** Persistent opponent mechanics not represented by NpcAgent today. */
export type OpponentRuntimeWindowId =
  | 'cardDisruption'
  | 'fireDisruption'
  | 'fireRateMultiplier'
  | 'moveDisruption'
  | 'rewardMultiplier'
  | 'vulnerability';

export interface VersusRuntimeWindow {
  duration: number;
  magnitude: number;
  stacks: number;
  /** Traceability is intentional: a status can never disappear anonymously. */
  sources: readonly VersusStatusId[];
}

export interface VersusStatusRuntimePatch {
  /** Max timer values compatible with the current GameState timer fields. */
  timers: Partial<Record<ExistingVersusTimerField, number>>;
  caster: {
    windows: Partial<Record<CasterRuntimeWindowId, VersusRuntimeWindow>>;
    barrierCharges: number;
    pierceCharges: number;
    refreshHand: boolean;
  };
  opponent: {
    windows: Partial<Record<OpponentRuntimeWindowId, VersusRuntimeWindow>>;
    /**
     * Semantic flags/marks kept by source ID.  These preserve anatomy,
     * affinity, reveal, formation and delayed-payoff information instead of
     * collapsing every specialist ability into a generic slow.
     */
    traits: Partial<Record<VersusStatusId, VersusRuntimeWindow>>;
  };
  appliedStatusIds: readonly VersusStatusId[];
}

export const VERSUS_STATUS_RUNTIME_LIMITS = Object.freeze({
  maxDuration: VERSUS_ABILITY_LIMITS.maxStatusDuration,
  maxMagnitude: 4,
  maxStacks: 3,
  maxBarrierCharges: COMPETITIVE_RULESET.maxShields,
  maxPierceCharges: 3,
  maxCriticalChance: 0.75,
  maxDisruption: 1,
  maxVulnerability: 2,
});

type MutableRuntimeWindow = Omit<VersusRuntimeWindow, 'sources'> & {
  sources: VersusStatusId[];
};

type MutableStatusRuntimePatch = {
  timers: Partial<Record<ExistingVersusTimerField, number>>;
  caster: {
    windows: Partial<Record<CasterRuntimeWindowId, MutableRuntimeWindow>>;
    barrierCharges: number;
    pierceCharges: number;
    refreshHand: boolean;
  };
  opponent: {
    windows: Partial<Record<OpponentRuntimeWindowId, MutableRuntimeWindow>>;
    traits: Partial<Record<VersusStatusId, MutableRuntimeWindow>>;
  };
  appliedStatusIds: VersusStatusId[];
};

type StatusAdapter = (patch: MutableStatusRuntimePatch, intent: VersusStatusIntent) => void;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, Number.isFinite(value) ? value : minimum));

const boundedDuration = (duration: number) =>
  clamp(duration, 0, VERSUS_STATUS_RUNTIME_LIMITS.maxDuration);

const boundedMagnitude = (magnitude: number) =>
  clamp(
    magnitude,
    -VERSUS_STATUS_RUNTIME_LIMITS.maxMagnitude,
    VERSUS_STATUS_RUNTIME_LIMITS.maxMagnitude,
  );

const boundedStacks = (stacks = 1) =>
  Math.round(clamp(stacks, 1, VERSUS_STATUS_RUNTIME_LIMITS.maxStacks));

function emptyMutablePatch(): MutableStatusRuntimePatch {
  return {
    timers: {},
    caster: {
      windows: {},
      barrierCharges: 0,
      pierceCharges: 0,
      refreshHand: false,
    },
    opponent: { windows: {}, traits: {} },
    appliedStatusIds: [],
  };
}

function clonePatch(base: VersusStatusRuntimePatch): MutableStatusRuntimePatch {
  const cloneWindows = <K extends string>(
    windows: Partial<Record<K, VersusRuntimeWindow>>,
  ): Partial<Record<K, MutableRuntimeWindow>> => {
    const cloned: Partial<Record<K, MutableRuntimeWindow>> = {};
    for (const key of Object.keys(windows) as K[]) {
      const value = windows[key];
      if (value) cloned[key] = { ...value, sources: [...value.sources] };
    }
    return cloned;
  };

  return {
    timers: { ...base.timers },
    caster: {
      windows: cloneWindows(base.caster.windows),
      barrierCharges: base.caster.barrierCharges,
      pierceCharges: base.caster.pierceCharges,
      refreshHand: base.caster.refreshHand,
    },
    opponent: {
      windows: cloneWindows(base.opponent.windows),
      traits: cloneWindows(base.opponent.traits),
    },
    appliedStatusIds: [...base.appliedStatusIds],
  };
}

function freezePatch(patch: MutableStatusRuntimePatch): VersusStatusRuntimePatch {
  return {
    timers: { ...patch.timers },
    caster: {
      windows: { ...patch.caster.windows },
      barrierCharges: patch.caster.barrierCharges,
      pierceCharges: patch.caster.pierceCharges,
      refreshHand: patch.caster.refreshHand,
    },
    opponent: {
      windows: { ...patch.opponent.windows },
      traits: { ...patch.opponent.traits },
    },
    appliedStatusIds: [...patch.appliedStatusIds],
  };
}

export function createEmptyVersusStatusRuntimePatch(): VersusStatusRuntimePatch {
  return freezePatch(emptyMutablePatch());
}

function requireTarget(intent: VersusStatusIntent, expected: VersusStatusIntent['target']) {
  if (intent.target !== expected) {
    throw new Error(
      `Status ${intent.id} expected target ${expected}, received ${intent.target}`,
    );
  }
}

function normalizedWindow(
  intent: VersusStatusIntent,
  magnitude = intent.magnitude,
  stacks = intent.stacks,
): MutableRuntimeWindow {
  return {
    duration: boundedDuration(intent.duration),
    magnitude: boundedMagnitude(magnitude),
    stacks: boundedStacks(stacks),
    sources: [intent.id],
  };
}

function mergeWindow(
  current: MutableRuntimeWindow | undefined,
  incoming: MutableRuntimeWindow,
): MutableRuntimeWindow {
  if (!current) return incoming;
  const incomingIsStronger = Math.abs(incoming.magnitude) > Math.abs(current.magnitude);
  return {
    duration: Math.max(current.duration, incoming.duration),
    magnitude: incomingIsStronger ? incoming.magnitude : current.magnitude,
    stacks: Math.max(current.stacks, incoming.stacks),
    sources: [...new Set([...current.sources, ...incoming.sources])],
  };
}

function setTimer(
  patch: MutableStatusRuntimePatch,
  key: ExistingVersusTimerField,
  duration: number,
) {
  patch.timers[key] = Math.max(patch.timers[key] ?? 0, boundedDuration(duration));
}

function setCasterWindow(
  patch: MutableStatusRuntimePatch,
  key: CasterRuntimeWindowId,
  intent: VersusStatusIntent,
  magnitude = intent.magnitude,
  stacks = intent.stacks,
) {
  patch.caster.windows[key] = mergeWindow(
    patch.caster.windows[key],
    normalizedWindow(intent, magnitude, stacks),
  );
}

function setOpponentWindow(
  patch: MutableStatusRuntimePatch,
  key: OpponentRuntimeWindowId,
  intent: VersusStatusIntent,
  magnitude = intent.magnitude,
  stacks = intent.stacks,
) {
  patch.opponent.windows[key] = mergeWindow(
    patch.opponent.windows[key],
    normalizedWindow(intent, magnitude, stacks),
  );
}

function setOpponentTrait(
  patch: MutableStatusRuntimePatch,
  intent: VersusStatusIntent,
  magnitude = intent.magnitude,
) {
  requireTarget(intent, 'opponent');
  patch.opponent.traits[intent.id] = mergeWindow(
    patch.opponent.traits[intent.id],
    normalizedWindow(intent, magnitude),
  );
}

function addOpponentDisruption(
  patch: MutableStatusRuntimePatch,
  intent: VersusStatusIntent,
  channels: readonly OpponentRuntimeWindowId[],
  strength: number,
) {
  requireTarget(intent, 'opponent');
  const bounded = clamp(strength, 0, VERSUS_STATUS_RUNTIME_LIMITS.maxDisruption);
  for (const channel of channels) setOpponentWindow(patch, channel, intent, bounded);
  setOpponentTrait(patch, intent);
}

function addVulnerability(
  patch: MutableStatusRuntimePatch,
  intent: VersusStatusIntent,
  multiplier = intent.magnitude,
) {
  requireTarget(intent, 'opponent');
  setOpponentWindow(
    patch,
    'vulnerability',
    intent,
    clamp(multiplier, 1, VERSUS_STATUS_RUNTIME_LIMITS.maxVulnerability),
  );
  setOpponentTrait(patch, intent);
}

const STATUS_ADAPTERS = {
  'adaptive-damage': (patch, intent) => {
    requireTarget(intent, 'caster');
    setCasterWindow(patch, 'damageMultiplier', intent, clamp(intent.magnitude, 1, 3));
    setTimer(patch, 'adaptiveAmmoTimer', intent.duration);
  },
  'affinity-exposed': (patch, intent) => addVulnerability(patch, intent),
  'affinity-rotated': (patch, intent) => setOpponentTrait(patch, intent),
  'airborne-grounded': (patch, intent) =>
    addOpponentDisruption(patch, intent, ['moveDisruption'], 0.45),
  'armor-broken': (patch, intent) =>
    addVulnerability(patch, intent, 1 + Math.abs(intent.magnitude) * 0.25),
  barrier: (patch, intent) => {
    requireTarget(intent, 'caster');
    setCasterWindow(patch, 'barrier', intent, 1);
    patch.caster.barrierCharges = Math.min(
      VERSUS_STATUS_RUNTIME_LIMITS.maxBarrierCharges,
      patch.caster.barrierCharges + boundedStacks(intent.stacks),
    );
  },
  bind: (patch, intent) =>
    addOpponentDisruption(patch, intent, ['moveDisruption'], 0.8),
  'card-refresh': (patch, intent) => {
    requireTarget(intent, 'caster');
    patch.caster.refreshHand = true;
  },
  'catalyst-mark': (patch, intent) => {
    requireTarget(intent, 'opponent');
    setOpponentWindow(patch, 'rewardMultiplier', intent, clamp(intent.magnitude, 1, 3));
    setOpponentTrait(patch, intent);
  },
  'chain-mark': (patch, intent) => addVulnerability(patch, intent, 1.15),
  'clone-mark': (patch, intent) => addVulnerability(patch, intent, 1.2),
  'critical-chance': (patch, intent) => {
    requireTarget(intent, 'caster');
    setCasterWindow(
      patch,
      'criticalChance',
      intent,
      clamp(intent.magnitude, 0, VERSUS_STATUS_RUNTIME_LIMITS.maxCriticalChance),
    );
    setTimer(patch, 'critTimer', intent.duration);
  },
  devolved: (patch, intent) => {
    addVulnerability(patch, intent, 1.2);
    setOpponentWindow(patch, 'fireDisruption', intent, 0.2);
  },
  'echo-shot': (patch, intent) => {
    requireTarget(intent, 'caster');
    setCasterWindow(patch, 'echo', intent, clamp(intent.magnitude, 0.25, 1));
    setTimer(patch, 'echoTimer', intent.duration);
  },
  'emp-disabled': (patch, intent) =>
    addOpponentDisruption(patch, intent, ['fireDisruption', 'cardDisruption'], 0.8),
  'fire-rate': (patch, intent) => {
    if (intent.target === 'caster') {
      setCasterWindow(patch, 'fireRateMultiplier', intent, clamp(intent.magnitude, 1, 4));
      setTimer(patch, intent.magnitude >= 3 ? 'berserkTimer' : 'overclockTimer', intent.duration);
      return;
    }
    setOpponentWindow(
      patch,
      'fireRateMultiplier',
      intent,
      clamp(intent.magnitude, 0.25, 4),
    );
    setOpponentTrait(patch, intent);
  },
  'formation-broken': (patch, intent) =>
    addOpponentDisruption(patch, intent, ['moveDisruption', 'cardDisruption'], 0.35),
  'fusion-separated': (patch, intent) =>
    addVulnerability(patch, intent, 1 + boundedStacks(intent.stacks) * 0.1),
  ghost: (patch, intent) => {
    requireTarget(intent, 'caster');
    setCasterWindow(patch, 'invulnerability', intent, 1);
    setTimer(patch, 'ghostTimer', intent.duration);
  },
  'gravity-well': (patch, intent) => {
    requireTarget(intent, 'opponent');
    setOpponentWindow(patch, 'moveDisruption', intent, 0.65);
    setOpponentTrait(patch, intent); // Keeps pull/repel sign in the trait magnitude.
  },
  'heavy-anchored': (patch, intent) =>
    addOpponentDisruption(patch, intent, ['moveDisruption'], 0.7),
  'integrity-surge': (patch, intent) => {
    requireTarget(intent, 'caster');
    setCasterWindow(patch, 'integrityMultiplier', intent, clamp(intent.magnitude, 1, 3));
    setTimer(patch, 'overdriveTimer', intent.duration);
  },
  'lane-scrambled': (patch, intent) =>
    addOpponentDisruption(patch, intent, ['moveDisruption', 'cardDisruption'], 0.35),
  leech: (patch, intent) => {
    requireTarget(intent, 'caster');
    setCasterWindow(patch, 'leech', intent, clamp(intent.magnitude, 0, 1));
    setTimer(patch, 'drainTimer', intent.duration);
  },
  'mutation-locked': (patch, intent) =>
    addOpponentDisruption(patch, intent, ['fireDisruption', 'cardDisruption'], 0.7),
  'oil-slick': (patch, intent) =>
    addOpponentDisruption(patch, intent, ['moveDisruption'], 0.6),
  'overload-shot': (patch, intent) => {
    requireTarget(intent, 'caster');
    setCasterWindow(patch, 'overload', intent, 1);
    setTimer(patch, 'overloadTimer', intent.duration);
  },
  pierce: (patch, intent) => {
    requireTarget(intent, 'caster');
    setCasterWindow(patch, 'pierce', intent, 1);
    patch.caster.pierceCharges = Math.min(
      VERSUS_STATUS_RUNTIME_LIMITS.maxPierceCharges,
      patch.caster.pierceCharges + boundedStacks(intent.stacks),
    );
  },
  'pulse-field': (patch, intent) => {
    addOpponentDisruption(
      patch,
      intent,
      ['fireDisruption', 'moveDisruption'],
      clamp(intent.magnitude, 0, 1),
    );
    setTimer(patch, 'pulseTimer', intent.duration);
  },
  quarantined: (patch, intent) =>
    addOpponentDisruption(patch, intent, ['moveDisruption', 'cardDisruption'], 0.65),
  regeneration: (patch, intent) => {
    requireTarget(intent, 'caster');
    setCasterWindow(patch, 'regeneration', intent, clamp(intent.magnitude, 0, 3));
    setTimer(patch, 'regenTimer', intent.duration);
  },
  revealed: (patch, intent) => addVulnerability(patch, intent, 1.15),
  rooted: (patch, intent) =>
    addOpponentDisruption(patch, intent, ['moveDisruption'], 1),
  'signal-jammed': (patch, intent) => {
    addOpponentDisruption(
      patch,
      intent,
      ['fireDisruption', 'moveDisruption', 'cardDisruption'],
      0.75,
    );
    setTimer(patch, 'signalJamTimer', intent.duration);
  },
  staggered: (patch, intent) =>
    addOpponentDisruption(patch, intent, ['fireDisruption', 'moveDisruption'], 0.55),
  'stasis-gate': (patch, intent) => {
    addOpponentDisruption(patch, intent, ['moveDisruption'], 0.5);
    setTimer(patch, 'stasisGateTimer', intent.duration);
  },
  'tail-clamped': (patch, intent) =>
    addOpponentDisruption(patch, intent, ['moveDisruption'], 0.75),
  'thermal-fracture': (patch, intent) => addVulnerability(patch, intent),
  'time-slow': (patch, intent) => {
    const strength = 1 - clamp(intent.magnitude, 0, 1);
    addOpponentDisruption(
      patch,
      intent,
      ['fireDisruption', 'moveDisruption', 'cardDisruption'],
      strength,
    );
  },
  'trait-stolen': (patch, intent) =>
    addOpponentDisruption(patch, intent, ['fireDisruption', 'cardDisruption'], 0.5),
  'turret-fire': (patch, intent) => {
    requireTarget(intent, 'caster');
    setCasterWindow(patch, 'turret', intent, clamp(intent.magnitude, 0, 2));
    setTimer(patch, 'turretTimer', intent.duration);
  },
  vulnerable: (patch, intent) => addVulnerability(patch, intent),
  'weapon-voltage': (patch, intent) => {
    requireTarget(intent, 'caster');
    setCasterWindow(patch, 'voltage', intent, clamp(intent.magnitude, 0, 3));
    setTimer(patch, 'voltageTimer', intent.duration);
  },
} satisfies Record<VersusStatusId, StatusAdapter>;

/** Runtime-readable list, generated from the compile-time exhaustive adapter. */
export const VERSUS_RUNTIME_STATUS_IDS = Object.freeze(
  Object.keys(STATUS_ADAPTERS) as VersusStatusId[],
);

/**
 * Convert status intents into a bounded, serializable runtime patch.
 *
 * Supplying `base` makes repeated applications practical: timers use max,
 * charges are capped, windows keep the strongest magnitude/longest duration,
 * and source IDs remain auditable. The input patch is never mutated.
 */
export function applyVersusStatusIntents(
  intents: readonly VersusStatusIntent[],
  base: VersusStatusRuntimePatch = createEmptyVersusStatusRuntimePatch(),
): VersusStatusRuntimePatch {
  const patch = clonePatch(base);
  for (const intent of intents) {
    const adapter: StatusAdapter | undefined = STATUS_ADAPTERS[intent.id];
    if (!adapter) throw new Error(`No runtime adapter registered for status: ${intent.id}`);
    adapter(patch, intent);
    if (!patch.appliedStatusIds.includes(intent.id)) patch.appliedStatusIds.push(intent.id);
  }
  return freezePatch(patch);
}

/** Advance only persistent windows. One-shot charges are intentionally reset. */
export function advanceVersusStatusRuntime(
  current: VersusStatusRuntimePatch,
  deltaSeconds: number,
): VersusStatusRuntimePatch {
  const delta = Math.max(0, Number.isFinite(deltaSeconds) ? deltaSeconds : 0);
  const decayWindows = <K extends string>(
    windows: Partial<Record<K, VersusRuntimeWindow>>,
  ): Partial<Record<K, VersusRuntimeWindow>> => {
    const next: Partial<Record<K, VersusRuntimeWindow>> = {};
    for (const key of Object.keys(windows) as K[]) {
      const window = windows[key];
      if (!window) continue;
      const duration = Math.max(0, window.duration - delta);
      if (duration > 0) next[key] = { ...window, duration };
    }
    return next;
  };

  return {
    timers: {},
    caster: {
      windows: decayWindows(current.caster.windows),
      barrierCharges: 0,
      pierceCharges: 0,
      refreshHand: false,
    },
    opponent: {
      windows: decayWindows(current.opponent.windows),
      traits: decayWindows(current.opponent.traits),
    },
    appliedStatusIds: current.appliedStatusIds,
  };
}

/** Used by focused tests and runtime diagnostics to reject trace-only no-ops. */
export function hasExecutableVersusStatusPatch(patch: VersusStatusRuntimePatch): boolean {
  return Object.keys(patch.timers).length > 0
    || Object.keys(patch.caster.windows).length > 0
    || patch.caster.barrierCharges > 0
    || patch.caster.pierceCharges > 0
    || patch.caster.refreshHand
    || Object.keys(patch.opponent.windows).length > 0
    || Object.keys(patch.opponent.traits).length > 0;
}
