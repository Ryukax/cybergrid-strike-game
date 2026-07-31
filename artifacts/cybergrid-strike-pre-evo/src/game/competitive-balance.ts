import type { Ability } from './types';

/**
 * One versioned ruleset is shared by the local NPC simulation and the future
 * network authority. Keep competitive numbers here so a client, replay
 * verifier, or server can execute the same match contract.
 */
export const COMPETITIVE_RULESET = Object.freeze({
  id: 'cgs-versus-1.0.0',
  maxHp: 100,
  maxShields: 2,
  playerAutoFireInterval: 0.34,
  playerManualFireInterval: 0.25,
  npcFireInterval: 0.48,
  npcMoveInterval: 0.72,
  npcAbilityInterval: 12,
  npcSkillInterval: 20,
  signatureSkillCooldown: 14,
  maxProjectileDamage: 4,
  maxAbilityDamage: 5,
  maxSignatureDamage: 3,
  maxFireDisruption: 1.15,
  maxMoveDisruption: 0.7,
  midMatchUpgrades: false,
});

const DIRECT_ABILITY_IDS = new Set([
  'bomb', 'nuke', 'purge', 'megabomb', 'emp', 'chain', 'cluster',
  'arcweb', 'seeker', 'shattershot', 'marksman', 'returnfire',
  'thermalshock', 'circuitarc', 'acidetch', 'radiantmark',
  'voidaperture', 'kineticram', 'clonebreak', 'hybridtax',
]);

export function competitiveAbilityDamage(
  ability: Ability,
  generated = false,
): number {
  if (!generated && !DIRECT_ABILITY_IDS.has(ability.id)) return 0;
  // Competitive impact derives from the opportunity cost of the cooldown.
  return Math.min(
    COMPETITIVE_RULESET.maxAbilityDamage,
    Math.max(2, Math.round(ability.cooldown / 4)),
  );
}

export function competitiveProjectileDamage(power = 1): number {
  return Math.min(
    COMPETITIVE_RULESET.maxProjectileDamage,
    Math.max(1, Math.round(power)),
  );
}

export function boundedRecovery(
  currentHp: number,
  requested: number,
  maxHp = COMPETITIVE_RULESET.maxHp,
): number {
  const missing = Math.max(0, maxHp - currentHp);
  if (missing === 0) return currentHp;
  // Recovery remains useful but cannot erase a large earned lead at once.
  const recoveryBudget = Math.max(1, Math.ceil(missing * 0.2));
  return Math.min(maxHp, currentHp + Math.min(requested, recoveryBudget));
}

export function clampCompetitiveResources(hp: number, shields: number) {
  return {
    hp: Math.min(COMPETITIVE_RULESET.maxHp, Math.max(0, hp)),
    shields: Math.min(COMPETITIVE_RULESET.maxShields, Math.max(0, shields)),
  };
}

/** Deterministic PRNG step suitable for simulation, replay and server checks. */
export function competitiveRandom(seed: number): { value: number; seed: number } {
  let next = seed >>> 0;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  next >>>= 0;
  return { value: next / 0x1_0000_0000, seed: next || 0x6d2b79f5 };
}
