import { useRef, useEffect, useLayoutEffect, useState, useCallback, type MutableRefObject } from 'react';
import { ChainPanel } from './ChainPanel';
import { IntegrityConstruct } from './IntegrityConstruct';
import { heartbeatPresence, leavePresence, type PresenceSnapshot } from '../ecosystem/presence';
import { RewardAccumulator, type KillRecord } from '@/blockchain/rewards';

// Static one-time render of a GIF's first frame with white-background removed.
// The img is never added to the DOM — no element shows through transparent pixels —
// so the canvas background is genuinely transparent over the button.
function SkinPreviewCanvas({ src }: { src: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      let frame: CanvasImageSource = img;
      let disposable: ImageBitmap | undefined;
      if (src.includes('/skins/skill-') || src.includes('skins/skill-')) {
        let bitmap = await createImageBitmap(img);
        // These three authored sheets contain extra artwork connected to the
        // primary alpha island. Crop to their intentional subject window
        // before connected-component cleanup so the debris cannot win or
        // survive the island analysis.
        const subjectWindows: Record<string, [number, number, number, number]> = {
          override: [34, 20, 154, 140],
          apex: [27, 20, 194, 140],
          hijack: [4, 24, 188, 120],
        };
        const skinMatch = src.match(/skill-([a-z]+)-idle/i);
        const subject = skinMatch ? subjectWindows[skinMatch[1]] : undefined;
        if (subject) {
          const scaleX = bitmap.width / 240;
          const scaleY = bitmap.height / 160;
          const cropped = await createImageBitmap(
            bitmap,
            Math.round(subject[0] * scaleX),
            Math.round(subject[1] * scaleY),
            Math.round(subject[2] * scaleX),
            Math.round(subject[3] * scaleY),
          );
          bitmap.close();
          bitmap = cropped;
        }
        disposable = await sanitizeRivalSkinFrame(bitmap, true);
        frame = disposable;
      }
      if (cancelled) {
        disposable?.close();
        return;
      }
      ctx.clearRect(0, 0, 48, 48);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(frame, 0, 0, 48, 48);
      const id = ctx.getImageData(0, 0, 48, 48);
      const d  = id.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] > 210 && d[i + 1] > 210 && d[i + 2] > 210) d[i + 3] = 0;
      }
      ctx.putImageData(id, 0, 0);
      disposable?.close();
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);
  return (
    <canvas ref={canvasRef} width={48} height={48}
      style={{ display: 'block', imageRendering: 'pixelated', width: 48, height: 48 }} />
  );
}
import type { GameState, GameMode, EnemyGenome, EnemyAbility, Ability, Bullet } from '../game/types';
import {
  ABILITY_POOL, ABILITY_LOOKUP, CARD_CHARGE_TIME,
  ENEMY_ABILITY_FIRST_CAST_MIN, ENEMY_ABILITY_FIRST_CAST_RANGE, ENEMY_ABILITY_WINDUP,
  NPC_HP, NPC_FIRE_INTERVAL, NPC_MOVE_INTERVAL,
} from '../game/constants';
import { draw, getBoardMetrics } from '../game/renderer';
import {
  ensureAudio, startMusic, stopMusic,
  playShot, playHit, playScore, playGameOver, setSystemIntegrityAudio,
  playMove, playAutoToggle, playCardReady, playAbility,
} from '../game/audio';
import { pickDiverseSeed, registerSpawn, getMorphSig } from '../game/virus-morphology';
import { canFuse, createGenome, fuseGenomes, selectAdaptiveRow } from '../game/evolution';
import { getEnemyMovementClass, getProceduralVirusSprite, type EnemyMovementClass } from '../game/procedural-virus';
import { ELEMENT_DOMAIN } from '../game/element-matrix';

const ALL_ABILITY_IDS = new Set(ABILITY_POOL.map((a) => a.id));
const ABILITY_PRESETS_KEY = 'cgs_ability_presets_v1';
const ACTIVE_ABILITY_PRESET_KEY = 'cgs_active_ability_preset_v1';
const AUTO_ROTATE_PRESETS_KEY = 'cgs_auto_rotate_ability_presets_v1';
const ABILITY_PRESET_NAMES = [
  'BALANCED', 'ASSAULT', 'CONTROL', 'SURVIVAL',
  'CONSTITUTION', 'PLAYSTYLE', 'CUSTOM',
] as const;
const ABILITY_PRESET_COUNT = ABILITY_PRESET_NAMES.length;
const OFFENSE_ABILITY_IDS = new Set([
  'shotgun', 'pierce', 'bomb', 'mirror', 'nuke', 'barrage', 'purge', 'surge',
  'megabomb', 'double', 'voltage', 'snipe', 'chain', 'cluster', 'flak',
  'groundwire', 'interceptor', 'adaptive', 'ricochet', 'rearguard', 'arcweb',
  'splitter', 'seeker', 'shattershot', 'marksman', 'returnfire', 'thermalshock',
  'circuitarc', 'acidetch', 'radiantmark', 'kineticram',
]);
const CONTROL_ABILITY_IDS = new Set([
  'time', 'shield', 'scramble', 'warpback', 'armor', 'backdash', 'freeze',
  'blizzard', 'regen', 'ghost', 'pulse', 'magnet', 'signaljam', 'undertow',
  'stasisgate', 'oilslick', 'rootsnare', 'sonicnet', 'depthcharge',
  'anchorfield', 'tailclamp', 'tanglewire', 'trafficjam', 'bloombind',
  'voidaperture', 'quarantine',
]);
type AbilityCategory = 'offense' | 'control' | 'wildcard';
const abilityBags: Record<AbilityCategory, string[]> = {
  offense: [],
  control: [],
  wildcard: [],
};
let previousAbilityHand: string[] = [];
const AIR_CLASSES = new Set<EnemyMovementClass>(['flier', 'hover', 'spectral']);
const FLUID_CLASSES = new Set<EnemyMovementClass>(['aquatic', 'serpentine', 'tentacled']);
const GROUNDED_CLASSES = new Set<EnemyMovementClass>(['biped', 'quadruped', 'arthropod', 'burrower', 'vehicle', 'fortress']);
const HEAVY_CLASSES = new Set<EnemyMovementClass>(['fortress', 'vehicle', 'rooted']);
const CYBER_BASES = new Set([
  'robot', 'drone', 'vehicle', 'cyborg', 'mech', 'nanite',
  'data-wraith', 'turret', 'fish', 'mole',
]);
const BESTIARY_KEY = 'cgs_bestiary_v1';
const VIRTUAL_DPAD_KEY = 'cgs_virtual_dpad_v1';
const LEARNED_ABILITIES_KEY = 'cgs_learned_abilities_v1';
const PLAYSTYLE_SIGNALS_KEY = 'cgs_playstyle_signals_v1';
const ENABLED_ABILITIES_KEY = 'cgs_enabled_abilities_v1';
const GENERATED_ABILITIES_KEY = 'cgs_generated_abilities_v1';
const AVATAR_COMPONENTS_KEY = 'cgs_avatar_components_v1';
const EQUIPPED_COMPONENTS_KEY = 'cgs_equipped_components_v1';
const ASSEMBLY_SKILL_KEY = 'cgs_assembly_skill_v1';
const CONSTITUTION_MATRIX_KEY = 'cgs_constitution_matrix_v2';
const SYNCHRONY_THRESHOLD = 3;

type AvatarSlot = 'head' | 'torso' | 'arms' | 'legs' | 'core' | 'accent' | 'weapon';
interface AvatarComponentDrop {
  id: string;
  slot: AvatarSlot;
  name: string;
  color: string;
  variant: number;
  source: string;
  baseElement: string;
  element: string;
  entityType: string;
  enemyClass: string;
  niche: string;
  mutations: string[];
  generation: number;
  fusionLevel: number;
  fusionElement?: string;
  fusionAffinity?: string;
}
type EquippedAvatarComponents = Partial<Record<AvatarSlot, string>>;
const BODY_AVATAR_SLOTS: AvatarSlot[] = ['head', 'torso', 'arms', 'legs', 'core', 'accent'];
const AVATAR_SLOTS: AvatarSlot[] = [...BODY_AVATAR_SLOTS, 'weapon'];

interface AssemblyFitProfile {
  build: 'agile' | 'balanced' | 'heavy' | 'fluid';
  locomotion: 'biped' | 'wheeled' | 'serpentine' | 'tentacled' | 'hover' | 'quadruped';
  armature: 'standard' | 'tool' | 'claw' | 'wing' | 'tendril';
  headProfile: 'compact' | 'standard' | 'broad' | 'sensor';
  cohesion: number;
  torsoWidth: number;
  shoulderSpan: number;
  hipWidth: number;
  headScale: number;
  dominantColor: string;
  description: string;
}

function analyzeAssemblyFit(parts: AvatarComponentDrop[]): AssemblyFitProfile {
  // Weapons are presentation-only and never distort anatomy or fit scoring.
  parts = parts.filter((part) => part.slot !== 'weapon');
  const score = (predicate: (part: AvatarComponentDrop) => boolean) =>
    parts.filter(predicate).length;
  const heavy = score((part) =>
    part.enemyClass === 'guardian'
    || part.entityType === 'lithic'
    || part.mutations.includes('gigantic')
    || ['golem', 'mech', 'turret'].includes(part.baseElement));
  const agile = score((part) =>
    part.niche === 'scout'
    || part.enemyClass === 'skirmisher'
    || part.mutations.includes('miniature')
    || ['avian', 'fox', 'data-wraith'].includes(part.baseElement));
  const fluid = score((part) =>
    part.entityType === 'fluidic'
    || ['cephalopod', 'fish', 'nanite'].includes(part.baseElement));
  const legs = parts.find((part) => part.slot === 'legs');
  const locomotion: AssemblyFitProfile['locomotion'] =
    legs && ['vehicle', 'turret'].includes(legs.baseElement) ? 'wheeled'
      : legs && ['serpent', 'fish'].includes(legs.baseElement) ? 'serpentine'
        : legs && (legs.baseElement === 'cephalopod' || legs.entityType === 'fluidic')
          ? 'tentacled'
          : legs && ['drone', 'data-wraith', 'nanite'].includes(legs.baseElement) ? 'hover'
            : legs && ['beast', 'fox', 'crab'].includes(legs.baseElement) ? 'quadruped'
              : 'biped';
  const arms = parts.find((part) => part.slot === 'arms');
  const armature: AssemblyFitProfile['armature'] =
    arms && ['avian', 'owl'].includes(arms.baseElement) ? 'wing'
      : arms && (arms.baseElement === 'cephalopod' || arms.entityType === 'fluidic') ? 'tendril'
        : arms && ['beast', 'fox', 'insect', 'crab'].includes(arms.baseElement) ? 'claw'
          : arms && ['mechanical', 'synthetic'].includes(arms.entityType) ? 'tool'
            : 'standard';
  const head = parts.find((part) => part.slot === 'head');
  const headProfile: AssemblyFitProfile['headProfile'] =
    head && ['fungus', 'avian', 'owl', 'crystal'].includes(head.baseElement) ? 'broad'
      : head && ['drone', 'turret', 'nanite', 'data-wraith'].includes(head.baseElement) ? 'sensor'
        : head && (head.mutations.includes('miniature') || head.niche === 'scout') ? 'compact'
          : 'standard';
  const build: AssemblyFitProfile['build'] =
    fluid >= 2 ? 'fluid' : heavy > agile ? 'heavy' : agile > heavy ? 'agile' : 'balanced';
  const familyKeys = parts.map((part) => `${part.entityType}:${part.enemyClass}:${part.niche}`);
  const dominantFamilyCount = familyKeys.length
    ? Math.max(...familyKeys.map((key) => familyKeys.filter((candidate) => candidate === key).length))
    : 0;
  const compatiblePairs = parts.reduce((total, part, index) =>
    total + parts.slice(index + 1).filter((other) =>
      part.entityType === other.entityType
      || part.enemyClass === other.enemyClass
      || part.niche === other.niche
      || part.element === other.element).length, 0);
  const pairCount = Math.max(1, (parts.length * (parts.length - 1)) / 2);
  const cohesion = parts.length <= 1
    ? 1
    : Math.min(1, (dominantFamilyCount / parts.length) * 0.45 + (compatiblePairs / pairCount) * 0.55);
  const dominantColor = parts.find((part) => part.slot === 'torso')?.color
    ?? parts.find((part) => part.slot === 'core')?.color
    ?? parts[0]?.color
    ?? '#7dd3fc';
  const torsoWidth = build === 'heavy' ? 48 : build === 'agile' ? 35 : build === 'fluid' ? 39 : 41;
  const shoulderSpan = armature === 'wing' ? 88
    : armature === 'tendril' ? 82
      : build === 'heavy' ? 84 : build === 'agile' ? 70 : 77;
  const hipWidth = locomotion === 'wheeled' ? 49
    : locomotion === 'quadruped' ? 58
      : locomotion === 'hover' ? 42
        : build === 'heavy' ? 40 : 34;
  const headScale = headProfile === 'broad' ? 0.96
    : headProfile === 'compact' ? 0.76
      : headProfile === 'sensor' ? 0.82
        : build === 'heavy' ? 0.92 : build === 'agile' ? 0.84 : 0.88;
  return {
    build,
    locomotion,
    armature,
    headProfile,
    cohesion,
    torsoWidth,
    shoulderSpan,
    hipWidth,
    headScale,
    dominantColor,
    description: `${build} ${locomotion} ${armature} fit · ${Math.round(cohesion * 100)}% cohesion · ${parts.length}/6 sockets`,
  };
}

function avatarComponentFromGenome(genome: EnemyGenome): AvatarComponentDrop {
  const signature = [
    genome.baseElement, genome.element, genome.entityType, genome.enemyClass,
    genome.niche, genome.generation, genome.fusionLevel,
    genome.fusionElement ?? '', genome.fusionAffinity ?? '',
    ...genome.mutations.slice().sort(),
  ].join(':');
  const hash = [...signature].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 17);
  const slot = BODY_AVATAR_SLOTS[hash % BODY_AVATAR_SLOTS.length];
  const colors: Record<string, string> = {
    kinetic: '#fbbf24', thermal: '#fb7185', cryo: '#67e8f9', voltaic: '#a78bfa',
    corrosive: '#a3e635', radiant: '#fde68a', void: '#c084fc', bloom: '#4ade80',
  };
  return {
    id: `avatar-${slot}-${hash.toString(36)}-${genome.baseElement}-${genome.element}`,
    slot,
    name: `${genome.element} ${genome.baseElement} ${slot}`,
    color: colors[genome.element] ?? '#93c5fd',
    variant: hash % 4,
    source: `${genome.entityType} · ${genome.enemyClass} · ${genome.niche}`,
    baseElement: genome.baseElement,
    element: genome.element,
    entityType: genome.entityType,
    enemyClass: genome.enemyClass,
    niche: genome.niche,
    mutations: [...genome.mutations],
    generation: genome.generation,
    fusionLevel: genome.fusionLevel,
    fusionElement: genome.fusionElement,
    fusionAffinity: genome.fusionAffinity,
  };
}

function weaponComponentFromGenome(
  genome: EnemyGenome,
  playstyle: PlaystyleSignal | 'balanced',
): AvatarComponentDrop {
  const signature = [
    genome.baseElement, genome.element, genome.entityType, genome.enemyClass,
    genome.niche, playstyle, genome.fusionElement ?? '', genome.fusionAffinity ?? '',
  ].join(':');
  const hash = [...signature].reduce((sum, char) => (sum * 37 + char.charCodeAt(0)) >>> 0, 23);
  const styleNouns: Record<PlaystyleSignal | 'balanced', string> = {
    manualFire: 'precision arm',
    autoOffFire: 'duelist arm',
    movement: 'pursuit arm',
    abilityUse: 'channeling arm',
    rotation: 'adaptive arm',
    cloneDefense: 'guard arm',
    cloneAutofire: 'sentry arm',
    balanced: 'field arm',
  };
  const colors: Record<string, string> = {
    kinetic: '#fbbf24', thermal: '#fb7185', cryo: '#67e8f9', voltaic: '#a78bfa',
    corrosive: '#a3e635', radiant: '#fde68a', void: '#c084fc', bloom: '#4ade80',
  };
  return {
    id: `avatar-weapon-${hash.toString(36)}-${genome.baseElement}-${playstyle}`,
    slot: 'weapon',
    name: `${genome.element} ${genome.baseElement} ${styleNouns[playstyle]}`,
    color: colors[genome.element] ?? '#93c5fd',
    variant: hash % 4,
    source: `${genome.entityType} · ${genome.enemyClass} · ${playstyle}`,
    baseElement: genome.baseElement,
    element: genome.element,
    entityType: genome.entityType,
    enemyClass: genome.enemyClass,
    niche: genome.niche,
    mutations: [...genome.mutations],
    generation: genome.generation,
    fusionLevel: genome.fusionLevel,
    fusionElement: genome.fusionElement,
    fusionAffinity: genome.fusionAffinity,
  };
}

function normalizedAvatarComponent(component: AvatarComponentDrop): AvatarComponentDrop {
  const nameWords = String(component.name ?? '').split(/\s+/);
  const sourceParts = String(component.source ?? '').split('·').map((value) => value.trim());
  return {
    ...component,
    baseElement: component.baseElement || nameWords.slice(1, -1).join(' ') || 'beast',
    element: component.element || nameWords[0] || 'kinetic',
    entityType: component.entityType || sourceParts[0] || 'organic',
    enemyClass: component.enemyClass || sourceParts[1] || 'skirmisher',
    niche: component.niche || sourceParts[2] || 'hunter',
    mutations: Array.isArray(component.mutations) ? component.mutations : [],
    generation: Number(component.generation) || 0,
    fusionLevel: Number(component.fusionLevel) || 0,
    fusionElement: component.fusionElement,
    fusionAffinity: component.fusionAffinity,
  };
}

interface ComponentFamilySpec {
  id: string;
  label: string;
  baseElement: EnemyGenome['baseElement'];
  element: EnemyGenome['element'];
  entityType: EnemyGenome['entityType'];
  enemyClass: EnemyGenome['enemyClass'];
  niche: EnemyGenome['niche'];
  mutations: EnemyGenome['mutations'];
  nouns: Record<AvatarSlot, string>;
}

const SIGNATURE_COMPONENT_FAMILIES: ComponentFamilySpec[] = [
  {
    id: 'modular', label: 'Modular', baseElement: 'cyborg', element: 'kinetic',
    entityType: 'mechanical', enemyClass: 'scavenger', niche: 'opportunist',
    mutations: ['resilient'],
    nouns: { head: 'optic', torso: 'harness', arms: 'tool-rig', legs: 'strider', core: 'coupler', accent: 'hardpoint', weapon: 'pulse-tool' },
  },
  {
    id: 'suppressor', label: 'Suppressor', baseElement: 'data-wraith', element: 'void',
    entityType: 'spectral', enemyClass: 'infiltrator', niche: 'phase',
    mutations: ['resilient'],
    nouns: { head: 'mask', torso: 'mantle', arms: 'nullifier', legs: 'phase-step', core: 'silencer', accent: 'null-ring', weapon: 'phase-scythe' },
  },
  {
    id: 'polar', label: 'Polar', baseElement: 'drone', element: 'voltaic',
    entityType: 'synthetic', enemyClass: 'support', niche: 'symbiote',
    mutations: ['accelerated'],
    nouns: { head: 'conductor', torso: 'yoke', arms: 'inductor', legs: 'flux-step', core: 'dipole', accent: 'node-crown', weapon: 'arc-projector' },
  },
  {
    id: 'siege', label: 'Siege', baseElement: 'mech', element: 'cryo',
    entityType: 'mechanical', enemyClass: 'guardian', niche: 'bulwark',
    mutations: ['armored', 'gigantic'],
    nouns: { head: 'cockpit', torso: 'carapace', arms: 'bastion-rig', legs: 'pile-driver', core: 'reactor', accent: 'plate-array', weapon: 'siege-lance' },
  },
  {
    id: 'pursuit', label: 'Pursuit', baseElement: 'fox', element: 'thermal',
    entityType: 'synthetic', enemyClass: 'predator', niche: 'hunter',
    mutations: ['accelerated'],
    nouns: { head: 'tracker', torso: 'stalker-frame', arms: 'talon', legs: 'pouncer', core: 'prey-sense', accent: 'target-vane', weapon: 'claw-gauntlet' },
  },
  {
    id: 'designation', label: 'Designation', baseElement: 'turret', element: 'radiant',
    entityType: 'mechanical', enemyClass: 'support', niche: 'scout',
    mutations: ['resilient'],
    nouns: { head: 'rangefinder', torso: 'command-rig', arms: 'designator', legs: 'stabilizer', core: 'uplink', accent: 'beacon', weapon: 'beam-designator' },
  },
  {
    id: 'signal', label: 'Signal', baseElement: 'nanite', element: 'voltaic',
    entityType: 'synthetic', enemyClass: 'infiltrator', niche: 'swarm',
    mutations: ['miniature', 'volatile'],
    nouns: { head: 'receiver', torso: 'relay-coat', arms: 'broadcast-rig', legs: 'carrier', core: 'decoder', accent: 'antenna', weapon: 'swarm-caster' },
  },
  {
    id: 'regal', label: 'Regal', baseElement: 'golem', element: 'radiant',
    entityType: 'lithic', enemyClass: 'guardian', niche: 'opportunist',
    mutations: ['armored', 'resilient'],
    nouns: { head: 'crest', torso: 'cuirass', arms: 'authority-blade', legs: 'marcher', core: 'sovereign-seal', accent: 'crown-shard', weapon: 'prism-greatblade' },
  },
];

function signatureComponentLibrary(): AvatarComponentDrop[] {
  const colors: Record<string, string> = {
    kinetic: '#fbbf24', thermal: '#fb7185', cryo: '#67e8f9', voltaic: '#a78bfa',
    corrosive: '#a3e635', radiant: '#fde68a', void: '#c084fc', bloom: '#4ade80',
  };
  return SIGNATURE_COMPONENT_FAMILIES.flatMap((family, familyIndex) =>
    AVATAR_SLOTS.map((slot, slotIndex) => ({
      id: `family-${family.id}-${slot}`,
      slot,
      name: `${family.label} ${family.nouns[slot]}`,
      color: colors[family.element] ?? '#93c5fd',
      variant: (familyIndex + slotIndex) % 4,
      source: `${family.entityType} · ${family.enemyClass} · ${family.niche}`,
      baseElement: family.baseElement,
      element: family.element,
      entityType: family.entityType,
      enemyClass: family.enemyClass,
      niche: family.niche,
      mutations: [...family.mutations],
      generation: 2 + (familyIndex % 3),
      fusionLevel: familyIndex % 2,
    })));
}

interface BestiaryEntry {
  signature: string;
  seed: number;
  genome: EnemyGenome;
  discoveredAt: number;
  observations?: number;
  synchronizedAbilityId?: string;
}

function avatarComponentsRecoveredFromBestiary(): AvatarComponentDrop[] {
  try {
    const stored = JSON.parse(localStorage.getItem(BESTIARY_KEY) ?? '[]');
    if (!Array.isArray(stored)) return [];
    const recovered = stored
      .filter((entry: BestiaryEntry) =>
        entry?.genome?.baseElement
        && entry.genome.element
        && entry.genome.entityType
        && entry.genome.enemyClass
        && entry.genome.niche)
      .flatMap((entry: BestiaryEntry) => {
        const genome = {
          ...entry.genome,
          mutations: Array.isArray(entry.genome.mutations) ? entry.genome.mutations : [],
          generation: Number(entry.genome.generation) || 0,
          fusionLevel: Number(entry.genome.fusionLevel) || 0,
        };
        return [
          avatarComponentFromGenome(genome),
          weaponComponentFromGenome(genome, 'balanced'),
        ];
      });
    return [...new Map(recovered.map((component) => [component.id, component])).values()]
      .slice(0, 480);
  } catch {
    return [];
  }
}

interface AbilityBlueprint {
  abilityId: string;
  delivery: string;
  function: string;
  medium: string;
}

interface GeneratedAbility extends Ability, AbilityBlueprint {
  constitutionSignature: string;
  manifestedAt: number;
}

function generatedAbilityDescription(ability: GeneratedAbility, rank = 1): string {
  const target = ability.medium === 'signal' ? 'cyber and mechanical enemies'
    : ability.medium === 'thermal' ? 'thermal and cryo enemies'
      : ability.medium === 'phase' ? 'void, radiant, and spectral enemies'
        : ability.medium === 'fluid' ? 'fluid, corrosive, and aquatic enemies'
          : ability.medium === 'organic' ? 'bloom, organic, and botanical enemies'
            : 'all enemies';
  const scope = ability.delivery === 'projector'
    ? `Targets ${target} in your row; if none are present, targets the leading enemy.`
    : ability.delivery === 'pulse'
      ? `Targets up to ${1 + rank} ${target}; if none are present, targets any enemies.`
      : `Targets all ${target}; if none are present, targets all enemies.`;
  const effect = ability.function === 'rupture'
    ? `Deals ${1 + rank} damage to each target.`
    : ability.function === 'inhibit'
      ? `Permanently reduces target speed and delays constitution abilities for ${2 + rank}s.`
      : ability.function === 'impulse'
        ? `Pushes each target ${(0.65 + rank * 0.28).toFixed(2)} cells toward the edge.`
        : ability.function === 'ward'
          ? `Grants ${1 + Math.floor(rank / 2)} shield charge${1 + Math.floor(rank / 2) === 1 ? '' : 's'}.`
          : ability.function === 'restore'
            ? `Restores ${1 + Math.ceil(rank / 2)} HP.`
            : ability.function === 'reveal'
              ? `Delays target constitution abilities for ${2 + rank}s and pushes targets ${(0.35 * rank).toFixed(2)} cells.`
              : 'Moves targets to another lane and permanently reduces their speed by 20%.';
  return ability.function === 'ward' || ability.function === 'restore'
    ? effect
    : `${scope} ${effect}`;
}

let generatedAbilityRegistry: Record<string, GeneratedAbility> = {};

function runtimeAbilityById(id: string): Ability | undefined {
  return ABILITY_LOOKUP[id] ?? generatedAbilityRegistry[id];
}

function runtimeAbilityPool(): Ability[] {
  return [...ABILITY_POOL, ...Object.values(generatedAbilityRegistry)];
}

interface LearnedAbility {
  id: string;
  source: 'foundation' | 'constitution' | 'playstyle';
  reason: string;
  learnedAt: number;
  resonance: number;
  rank: number;
}

const MAX_ABILITY_RANK = 5;
const ABILITY_RANK_THRESHOLDS = [0, 1, 3, 6, 10, 15];
const PRESTIGE_RESONANCE_STEP = 4;
const ESSENTIAL_ABILITY_IDS = new Set(['shotgun', 'heal', 'scramble']);
const FOUNDATION_ABILITIES: LearnedAbility[] = [
  { id: 'shotgun', source: 'foundation', reason: 'Essential spread offense.', learnedAt: 0, resonance: 1, rank: 1 },
  { id: 'heal', source: 'foundation', reason: 'Essential recovery protocol.', learnedAt: 0, resonance: 1, rank: 1 },
  { id: 'scramble', source: 'foundation', reason: 'Essential formation control.', learnedAt: 0, resonance: 1, rank: 1 },
];

function abilityRank(resonance: number): number {
  let rank = 1;
  for (let candidate = 2; candidate <= MAX_ABILITY_RANK; candidate++) {
    if (resonance >= ABILITY_RANK_THRESHOLDS[candidate]) rank = candidate;
  }
  return rank;
}

function architecturePrestige(abilities: LearnedAbility[]): number {
  const earnedResonance = abilities
    .filter((ability) => !ESSENTIAL_ABILITY_IDS.has(ability.id))
    .reduce((total, ability) => total + Math.max(1, ability.resonance), 0);
  return Math.floor(earnedResonance / PRESTIGE_RESONANCE_STEP);
}

function abilityPrestigeRequirement(id: string): number {
  if (ESSENTIAL_ABILITY_IDS.has(id)) return 0;
  // Manifested abilities have already paid their progression cost through
  // observed enemy components or playstyle resonance. Do not lock the result
  // behind a second prestige gate after it is learned.
  if (id.startsWith('manifest-')) return 0;
  const index = Math.max(0, ABILITY_POOL.findIndex((ability) => ability.id === id));
  return Math.min(5, 1 + Math.floor(index / 18));
}

function abilityIsUnlocked(ability: LearnedAbility | undefined, abilities: LearnedAbility[]): boolean {
  if (!ability) return false;
  return ESSENTIAL_ABILITY_IDS.has(ability.id)
    || architecturePrestige(abilities) >= abilityPrestigeRequirement(ability.id);
}

type PlaystyleSignal =
  | 'manualFire'
  | 'autoOffFire'
  | 'movement'
  | 'abilityUse'
  | 'rotation'
  | 'cloneDefense'
  | 'cloneAutofire';

function dominantPlaystyleSignal(
  signals: Partial<Record<PlaystyleSignal, number>>,
): PlaystyleSignal | 'balanced' {
  const ranked = (Object.entries(signals) as Array<[PlaystyleSignal, number]>)
    .filter(([, value]) => value > 0)
    .sort((left, right) => right[1] - left[1]);
  return ranked[0]?.[0] ?? 'balanced';
}

const PLAYSTYLE_MANIFESTATIONS: Record<PlaystyleSignal, {
  threshold: number;
  abilityId: string;
  reason: string;
}> = {
  manualFire: { threshold: 18, abilityId: 'snipe', reason: 'Deliberate manual firing manifested precision.' },
  autoOffFire: { threshold: 10, abilityId: 'marksman', reason: 'Fighting without Auto manifested disciplined aim.' },
  movement: { threshold: 30, abilityId: 'backdash', reason: 'Sustained repositioning manifested evasive momentum.' },
  abilityUse: { threshold: 15, abilityId: 'adaptive', reason: 'Frequent card use manifested adaptive ammunition.' },
  rotation: { threshold: 8, abilityId: 'elementswap', reason: 'Repeated hand rotation manifested affinity control.' },
  cloneDefense: { threshold: 5, abilityId: 'shield', reason: 'Clone guarding manifested a portable ward.' },
  cloneAutofire: { threshold: 4, abilityId: 'turret', reason: 'Persistent clone fire manifested autonomous coverage.' },
};

function manifestedPlaystyleAbility(signal: PlaystyleSignal): GeneratedAbility {
  const manifestation = PLAYSTYLE_MANIFESTATIONS[signal];
  const counterpart = ABILITY_LOOKUP[manifestation.abilityId];
  const components = playerAbilityComponents(counterpart);
  const manifestationNames: Record<PlaystyleSignal, string> = {
    manualFire: 'DEADEYE PROTOCOL',
    autoOffFire: 'QUIET VECTOR',
    movement: 'SLIPSTREAM DRIVE',
    abilityUse: 'PATTERN WEAVER',
    rotation: 'AFFINITY GYRE',
    cloneDefense: 'ECHO BASTION',
    cloneAutofire: 'SENTRY CHORUS',
  };
  const generated: GeneratedAbility = {
    id: `manifest-style-${signal}`,
    name: manifestationNames[signal],
    desc: '',
    cooldown: counterpart.cooldown,
    abilityId: `manifest-style-${signal}`,
    ...components,
    constitutionSignature: `playstyle:${signal}`,
    manifestedAt: Date.now(),
  };
  return { ...generated, desc: generatedAbilityDescription(generated) };
}

function normalizedGeneratedAbility(ability: GeneratedAbility): GeneratedAbility {
  if (ability.id.startsWith('manifest-style-')) {
    const signal = ability.id.slice('manifest-style-'.length) as PlaystyleSignal;
    if (Object.prototype.hasOwnProperty.call(PLAYSTYLE_MANIFESTATIONS, signal)) {
      const canonical = manifestedPlaystyleAbility(signal);
      const normalized = { ...ability, name: canonical.name };
      return { ...normalized, desc: generatedAbilityDescription(normalized) };
    }
  }
  const words = ability.name.trim().split(/\s+/);
  const deduplicated = words.filter((word, index) =>
    index === 0 || word.toLowerCase() !== words[index - 1].toLowerCase());
  const normalized = { ...ability, name: deduplicated.join(' ') };
  return { ...normalized, desc: generatedAbilityDescription(normalized) };
}

interface RunUpgrade {
  id: string;
  name: string;
  desc: string;
  maxLevel: number;
}

const RUN_UPGRADES: RunUpgrade[] = [
  { id: 'capacitor', name: 'CAPACITOR', desc: 'Ability hands recharge 15% faster per level.', maxLevel: 3 },
  { id: 'rapidBuster', name: 'RAPID BUSTER', desc: 'Player fires 10% faster per level.', maxLevel: 3 },
  { id: 'phaseRounds', name: 'PHASE ROUNDS', desc: 'Every fifth shot pierces; higher levels trigger sooner.', maxLevel: 3 },
  { id: 'denseCharge', name: 'DENSE CHARGE', desc: 'Every fourth shot gains +1 damage per level.', maxLevel: 3 },
  { id: 'repairWeave', name: 'REPAIR WEAVE', desc: 'Restore 2 HP now and 1 HP after each recovery window.', maxLevel: 2 },
  { id: 'barrierArray', name: 'BARRIER ARRAY', desc: 'Gain 2 shield charges immediately.', maxLevel: 3 },
  { id: 'shockVent', name: 'SHOCK VENT', desc: 'Entering critical pressure pushes every enemy backward.', maxLevel: 2 },
  { id: 'hybridHunter', name: 'HYBRID HUNTER', desc: 'Shots deal +1 damage to fused enemies per level.', maxLevel: 2 },
];
const UPGRADE_PROMPT_TIME = 10;
const UPGRADE_RETRY_WAVES = 2;
const UPGRADE_INTERVAL_WAVES = 5;

function chooseUpgradeOptions(levels: Record<string, number>): string[] {
  return shuffleIds(RUN_UPGRADES
    .filter((upgrade) => (levels[upgrade.id] ?? 0) < upgrade.maxLevel)
    .map((upgrade) => upgrade.id)).slice(0, 3);
}

function BestiarySprite({ seed, genome }: { seed: number; genome: EnemyGenome }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const sprite = getProceduralVirusSprite(seed, genome);
    const redraw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.imageSmoothingEnabled = false;
      context.clearRect(0, 0, 240, 160);
      context.drawImage(sprite, 0, 0, 240, 160);
    };
    redraw();
    // Component images load asynchronously and re-render the cached source
    // canvas. Refresh at a few widening intervals so the Bestiary receives the
    // completed composite instead of preserving the initial empty frame.
    const timers = [100, 300, 700, 1500, 3000].map((delay) =>
      window.setTimeout(redraw, delay));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [seed, genome]);
  return <canvas ref={canvasRef} className="bestiarySprite" width={240} height={160} />;
}

function AvatarComponentCanvas({ part, thumbnail = false }: { part: AvatarComponentDrop; thumbnail?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, 64, 64);
    ctx.imageSmoothingEnabled = false;
    const color = part.color;
    const ink = '#111827';
    const light = '#f8fafc';
    const metal = '#64748b';
    const mechanical = ['robot', 'drone', 'vehicle', 'cyborg', 'mech', 'nanite', 'turret', 'data-wraith']
      .includes(part.baseElement) || part.entityType === 'mechanical' || part.entityType === 'synthetic';
    const polygon = (points: Array<[number, number]>, fill: string) => {
      ctx.beginPath();
      points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 3;
      ctx.stroke();
    };
    const block = (x: number, y: number, w: number, h: number, fill = color) => {
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, w, h);
    };
    const line = (x1: number, y1: number, x2: number, y2: number, width = 5, stroke = color) => {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.lineCap = 'square';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };

    if (part.slot === 'head') {
      if (part.baseElement === 'skeleton') {
        block(15, 13, 34, 31, '#e5e7eb');
        block(20, 39, 24, 12, '#d1d5db');
        block(21, 24, 7, 8, ink); block(36, 24, 7, 8, ink);
        line(28, 43, 28, 49, 3, ink); line(36, 43, 36, 49, 3, ink);
      } else if (part.baseElement === 'insect' || part.entityType === 'chitinous') {
        polygon([[16, 18], [32, 8], [48, 18], [44, 48], [32, 55], [20, 48]], color);
        line(22, 16, 11, 4, 4); line(42, 16, 53, 4, 4);
        block(20, 26, 8, 8, light); block(36, 26, 8, 8, light);
        polygon([[22, 47], [12, 58], [30, 52]], metal); polygon([[42, 47], [52, 58], [34, 52]], metal);
      } else if (part.baseElement === 'avian' || part.baseElement === 'owl') {
        polygon([[13, 20], [32, 7], [51, 20], [44, 48], [32, 55], [20, 48]], color);
        block(19, 24, 10, 10, light); block(35, 24, 10, 10, light);
        polygon([[25, 37], [39, 37], [32, 50]], '#f59e0b');
      } else if (part.baseElement === 'fungus') {
        polygon([[7, 28], [14, 13], [32, 6], [50, 13], [57, 28]], color);
        block(23, 27, 18, 25, '#e2e8f0');
        block(16, 19, 7, 5, light); block(37, 13, 8, 6, light);
      } else if (part.baseElement === 'crystal') {
        polygon([[10, 44], [18, 13], [27, 22], [34, 4], [41, 22], [51, 12], [55, 45], [32, 57]], color);
        polygon([[18, 18], [34, 4], [31, 45]], light);
      } else if (mechanical) {
        block(11, 14, 42, 38, metal);
        block(15, 19, 34, 19, color);
        block(19, 25, 26, 7, '#67e8f9');
        line(32, 14, 32, 4, 4, metal); block(28, 1, 8, 7, color);
        block(20, 44, 6, 5, ink); block(29, 44, 6, 5, ink); block(38, 44, 6, 5, ink);
      } else {
        block(14, 15, 36, 38, color);
        polygon([[14, 20], [4, 8], [23, 15]], color);
        polygon([[50, 20], [60, 8], [41, 15]], color);
        block(20, 27, 7, 7, light); block(37, 27, 7, 7, light);
      }
    } else if (part.slot === 'torso') {
      if (part.baseElement === 'skeleton') {
        line(32, 5, 32, 59, 6, '#e5e7eb');
        [16, 27, 38].forEach((y) => { line(32, y, 10, y + 8, 4, '#e5e7eb'); line(32, y, 54, y + 8, 4, '#e5e7eb'); });
      } else if (part.baseElement === 'plant' || part.entityType === 'botanical') {
        block(20, 7, 24, 50, '#713f12');
        polygon([[20, 20], [2, 6], [10, 34]], color); polygon([[44, 20], [62, 6], [54, 34]], color);
        line(32, 8, 32, 56, 4, '#a3e635');
      } else if (part.baseElement === 'crystal' || part.entityType === 'lithic') {
        polygon([[32, 2], [57, 20], [48, 59], [16, 59], [7, 20]], color);
        polygon([[32, 2], [32, 57], [12, 22]], light);
      } else if (mechanical) {
        polygon([[11, 10], [53, 10], [59, 49], [44, 61], [20, 61], [5, 49]], metal);
        block(16, 17, 32, 29, color);
        block(23, 23, 18, 12, '#0f172a');
        line(10, 50, 54, 50, 4, '#94a3b8');
      } else {
        polygon([[12, 8], [52, 8], [58, 48], [43, 60], [21, 60], [6, 48]], color);
        line(16, 20, 48, 20, 4, light); line(20, 35, 44, 35, 4, ink);
      }
    } else if (part.slot === 'arms') {
      if (part.baseElement === 'avian' || part.baseElement === 'owl') {
        polygon([[30, 20], [3, 4], [12, 38], [30, 49]], color);
        polygon([[34, 20], [61, 4], [52, 38], [34, 49]], color);
        line(9, 16, 26, 31, 3, light); line(55, 16, 38, 31, 3, light);
      } else if (part.baseElement === 'cephalopod' || part.entityType === 'fluidic') {
        [8, 18, 46, 56].forEach((x, index) => {
          ctx.strokeStyle = color; ctx.lineWidth = 6; ctx.beginPath();
          ctx.moveTo(30 + (index < 2 ? -1 : 1) * 4, 18);
          ctx.quadraticCurveTo(x, 34, x + (index % 2 ? 5 : -5), 58); ctx.stroke();
        });
      } else if (mechanical) {
        block(3, 18, 24, 15, metal); block(37, 18, 24, 15, metal);
        block(7, 21, 13, 9, color); block(44, 21, 13, 9, color);
        block(0, 36, 18, 10, '#334155'); block(46, 36, 18, 10, '#334155');
      } else {
        line(29, 19, 8, 42, 10); line(35, 19, 56, 42, 10);
        polygon([[3, 38], [15, 37], [12, 57]], color); polygon([[61, 38], [49, 37], [52, 57]], color);
      }
    } else if (part.slot === 'legs') {
      if (part.baseElement === 'vehicle' || part.baseElement === 'turret') {
        block(10, 10, 44, 20, metal);
        [14, 34].forEach((x) => {
          ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(x, 45, 11, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, 45, 5, 0, Math.PI * 2); ctx.fill();
        });
      } else if (part.baseElement === 'serpent' || part.baseElement === 'fish') {
        ctx.strokeStyle = color; ctx.lineWidth = 13; ctx.beginPath();
        ctx.moveTo(27, 4); ctx.bezierCurveTo(53, 18, 9, 36, 40, 57); ctx.stroke();
        polygon([[40, 57], [55, 49], [51, 63]], color);
      } else if (part.baseElement === 'cephalopod' || part.entityType === 'fluidic') {
        [18, 28, 38, 48].forEach((x, index) => line(31, 6, x, 59, 7, index % 2 ? color : light));
      } else if (mechanical) {
        block(13, 3, 16, 44, metal); block(35, 3, 16, 44, metal);
        block(8, 43, 22, 14, color); block(34, 43, 22, 14, color);
        line(21, 11, 21, 39, 4, '#cbd5e1'); line(43, 11, 43, 39, 4, '#cbd5e1');
      } else {
        line(26, 5, 18, 48, 11); line(38, 5, 46, 48, 11);
        polygon([[8, 47], [28, 45], [26, 59], [5, 59]], color);
        polygon([[56, 47], [36, 45], [38, 59], [59, 59]], color);
      }
    } else if (part.slot === 'core') {
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(32, 32, 21, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = ink; ctx.lineWidth = 5; ctx.stroke();
      ctx.fillStyle = mechanical ? '#67e8f9' : light; ctx.beginPath(); ctx.arc(32, 32, 9, 0, Math.PI * 2); ctx.fill();
      if (part.niche === 'phase') { ctx.strokeStyle = '#c084fc'; ctx.lineWidth = 3; ctx.strokeRect(5, 5, 54, 54); }
    } else {
      const armored = part.mutations.includes('armored') || part.enemyClass === 'guardian';
      if (armored) {
        polygon([[4, 52], [13, 9], [24, 27], [32, 2], [40, 27], [51, 9], [60, 52], [32, 61]], color);
      } else if (part.niche === 'phase' || part.entityType === 'spectral') {
        for (let ring = 0; ring < 3; ring++) {
          ctx.strokeStyle = ring % 2 ? color : light; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(32, 32, 12 + ring * 8, 0.3 * ring, Math.PI * (1.2 + ring * 0.25)); ctx.stroke();
        }
      } else {
        polygon([[5, 45], [20, 31], [10, 8], [32, 21], [54, 8], [44, 31], [59, 45], [38, 43], [32, 61], [26, 43]], color);
      }
    }

    // Preserve the source creature's actual visual language inside the
    // humanoid-compatible silhouette instead of reducing it to a flat icon.
    // The procedural source may finish loading image-backed layers later, so
    // refresh it at widening intervals just like the Bestiary preview.
    const signature = [
      part.baseElement, part.element, part.entityType, part.enemyClass,
      part.niche, part.variant, part.generation, part.fusionLevel,
      part.fusionElement ?? '', part.fusionAffinity ?? '', ...part.mutations,
    ].join(':');
    const seed = [...signature].reduce(
      (sum, character) => (sum * 33 + character.charCodeAt(0)) >>> 0,
      5381,
    );
    const sourceGenome: EnemyGenome = {
      baseElement: part.baseElement as EnemyGenome['baseElement'],
      element: part.element as EnemyGenome['element'],
      entityType: part.entityType as EnemyGenome['entityType'],
      enemyClass: part.enemyClass as EnemyGenome['enemyClass'],
      niche: part.niche as EnemyGenome['niche'],
      generation: Math.max(part.generation, 2 + part.variant),
      mutations: part.mutations as EnemyGenome['mutations'],
      speedScale: 1,
      hpBonus: part.enemyClass === 'guardian' ? 2 : 0,
      sizeScale: part.mutations.includes('gigantic') ? 1.2
        : part.mutations.includes('miniature') ? 0.82 : 1,
      regeneration: part.niche === 'regenerator' ? 0.2 : 0,
      phaseChance: part.niche === 'phase' ? 0.25 : 0,
      fusionLevel: part.fusionLevel,
      fusionElement: part.fusionElement as EnemyGenome['fusionElement'],
      fusionAffinity: part.fusionAffinity as EnemyGenome['fusionAffinity'],
    };
    const sourceSprite = getProceduralVirusSprite(seed, sourceGenome);
    const humanoidMask = ctx.getImageData(0, 0, 64, 64);
    const applySourceDetail = () => {
      ctx.putImageData(humanoidMask, 0, 0);
      const sourceContext = sourceSprite.getContext('2d');
      let cropX = 48;
      let cropY = 8;
      let cropWidth = 144;
      let cropHeight = 144;
      if (sourceContext) {
        const pixels = sourceContext.getImageData(0, 0, sourceSprite.width, sourceSprite.height);
        let minX = sourceSprite.width;
        let minY = sourceSprite.height;
        let maxX = -1;
        let maxY = -1;
        for (let y = 0; y < sourceSprite.height; y += 2) {
          for (let x = 0; x < sourceSprite.width; x += 2) {
            if (pixels.data[(y * sourceSprite.width + x) * 4 + 3] < 18) continue;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
        if (maxX >= minX && maxY >= minY) {
          const padding = 4;
          cropX = Math.max(0, minX - padding);
          cropY = Math.max(0, minY - padding);
          cropWidth = Math.min(sourceSprite.width - cropX, maxX - minX + padding * 2);
          cropHeight = Math.min(sourceSprite.height - cropY, maxY - minY + padding * 2);
        }
      }
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = thumbnail ? 0.92 : 1;
      // Fit the complete visible source entity into the humanoid socket. This
      // carries its actual anatomy, surface detail and fusion crossover rather
      // than sampling an often-empty fixed rectangle.
      ctx.drawImage(
        sourceSprite,
        cropX, cropY, cropWidth, cropHeight,
        part.slot === 'arms' ? -4 : 0,
        part.slot === 'head' ? -2 : 0,
        part.slot === 'arms' ? 72 : 64,
        part.slot === 'legs' ? 70 : 64,
      );
      ctx.restore();

      // Reassert readable pixel-volume after the source texture is clipped.
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(7, 6, 12, 46);
      ctx.fillStyle = 'rgba(2,6,23,0.18)';
      ctx.fillRect(45, 12, 12, 44);
      ctx.restore();
    };
    applySourceDetail();
    const timers = [100, 300, 700, 1500].map((delay) =>
      window.setTimeout(applySourceDetail, delay));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [part]);
  return (
    <canvas
      ref={canvasRef}
      width={64}
      height={64}
      className={`avatarPart avatarPart-${part.slot} variant-${part.variant}${thumbnail ? ' avatarPartThumbnail' : ''}`}
    />
  );
}

function assemblyAtlasColumn(part: AvatarComponentDrop): number {
  const base = part.baseElement;
  if (['robot', 'drone', 'vehicle', 'cyborg', 'mech', 'nanite', 'turret'].includes(base)
    || part.entityType === 'mechanical' || part.entityType === 'synthetic') return 0;
  if (['insect', 'crab'].includes(base) || part.entityType === 'chitinous') return 1;
  if (['crystal', 'golem'].includes(base) || part.entityType === 'lithic') return 2;
  if (['plant', 'fungus'].includes(base) || part.entityType === 'botanical') return 3;
  if (['cephalopod', 'fish'].includes(base) || part.entityType === 'fluidic') return 4;
  if (base === 'data-wraith' || part.entityType === 'spectral' || part.niche === 'phase') return 5;
  if (['avian', 'owl'].includes(base)) return 7;
  return 6;
}

type AssemblyArchetype = 'baseline' | 'agile' | 'armored' | 'evolved';

function assemblyArchetype(part: AvatarComponentDrop): AssemblyArchetype {
  if (part.fusionLevel > 0 || part.generation >= 4 || part.mutations.length >= 2
    || ['replicator', 'mender'].includes(part.enemyClass)) return 'evolved';
  if (part.enemyClass === 'guardian' || part.niche === 'bulwark'
    || part.mutations.some((mutation) => ['armored', 'gigantic', 'resilient'].includes(mutation))) {
    return 'armored';
  }
  if (['skirmisher', 'predator', 'infiltrator'].includes(part.enemyClass)
    || ['scout', 'hunter', 'phase'].includes(part.niche)
    || part.mutations.some((mutation) => ['accelerated', 'miniature'].includes(mutation))) {
    return 'agile';
  }
  if (part.slot === 'weapon') {
    if (/cloneDefense/.test(part.source)) return 'armored';
    if (/manualFire|autoOffFire|movement/.test(part.source)) return 'agile';
    if (/abilityUse|rotation|cloneAutofire/.test(part.source)) return 'evolved';
  }
  return 'baseline';
}

function assemblyVisualSignature(part: AvatarComponentDrop): string {
  return [
    part.slot,
    assemblyAtlasColumn(part),
    assemblyArchetype(part),
  ].join(':');
}

const sharedAssemblyAtlases = new Map<string, HTMLImageElement>();
function getAssemblyAtlas(part: AvatarComponentDrop): HTMLImageElement {
  const archetype = assemblyArchetype(part);
  const filename = part.slot === 'weapon'
    ? archetype === 'baseline'
      ? 'assembly-weapon-atlas-v1.png'
      : `assembly-weapon-atlas-${archetype}-v2.png`
    : archetype === 'baseline'
      ? 'assembly-component-atlas-v1.png?v=2'
      : `assembly-component-atlas-${archetype}-v1.png`;
  let atlas = sharedAssemblyAtlases.get(filename);
  if (!atlas) {
    atlas = new Image();
    atlas.decoding = 'async';
    atlas.src = `${import.meta.env.BASE_URL}skins/${filename}`;
    sharedAssemblyAtlases.set(filename, atlas);
  }
  return atlas;
}

function removeAssemblySpriteIslands(
  ctx: CanvasRenderingContext2D,
  slot: AvatarSlot,
): void {
  const image = ctx.getImageData(0, 0, 64, 64);
  const visited = new Uint8Array(64 * 64);
  const components: number[][] = [];
  for (let start = 0; start < 64 * 64; start++) {
    if (visited[start] || image.data[start * 4 + 3] < 14) continue;
    const pixels: number[] = [];
    const queue = [start];
    visited[start] = 1;
    while (queue.length) {
      const current = queue.pop()!;
      pixels.push(current);
      const x = current % 64;
      const y = Math.floor(current / 64);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if ((!dx && !dy) || x + dx < 0 || x + dx >= 64 || y + dy < 0 || y + dy >= 64) continue;
          const next = (y + dy) * 64 + x + dx;
          if (visited[next] || image.data[next * 4 + 3] < 14) continue;
          visited[next] = 1;
          queue.push(next);
        }
      }
    }
    components.push(pixels);
  }
  components.sort((left, right) => right.length - left.length);
  const retainedCount = slot === 'arms' || slot === 'legs' ? 2 : 1;
  const retained = new Set(components.slice(0, retainedCount).flat());
  for (let pixel = 0; pixel < 64 * 64; pixel++) {
    if (!retained.has(pixel)) image.data[pixel * 4 + 3] = 0;
  }
  ctx.putImageData(image, 0, 0);
}

function buildAssemblyPartSprite(
  part: AvatarComponentDrop,
  atlas: HTMLImageElement,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  if (atlas.complete && atlas.naturalWidth > 0) {
    const archetype = assemblyArchetype(part);
    const column = assemblyAtlasColumn(part);
    const row = part.slot === 'weapon' ? 0 : BODY_AVATAR_SLOTS.indexOf(part.slot);
    // Image-generated subjects do not land on perfectly equal mathematical
    // columns. These measured gutters prevent a crop from borrowing detached
    // pixels from the family immediately before or after it.
    const bodyRowBounds: Record<Exclude<AssemblyArchetype, 'baseline'>, number[]> = {
      agile: [0, 233, 444, 640, 831, 1010, 1254],
      armored: [0, 211, 438, 656, 862, 1024, 1254],
      evolved: [0, 211, 433, 651, 870, 1028, 1254],
    };
    const bodyColumnBounds: Record<
      Exclude<AssemblyArchetype, 'baseline'>,
      number[][]
    > = {
      agile: [
        [0, 155, 319, 467, 625, 774, 921, 1076, 1254],
        [0, 161, 318, 470, 627, 776, 927, 1072, 1254],
        [0, 167, 323, 477, 634, 782, 931, 1076, 1254],
        [0, 159, 311, 468, 629, 778, 927, 1082, 1254],
        [0, 156, 308, 467, 620, 775, 927, 1070, 1254],
        [0, 145, 316, 469, 623, 777, 925, 1073, 1254],
      ],
      armored: [
        [0, 153, 317, 477, 628, 788, 933, 1081, 1254],
        [0, 171, 337, 490, 649, 801, 949, 1091, 1254],
        [0, 169, 331, 486, 642, 801, 950, 1093, 1254],
        [0, 163, 328, 478, 637, 795, 953, 1094, 1254],
        [0, 155, 316, 472, 629, 786, 931, 1083, 1254],
        [0, 156, 321, 471, 625, 787, 939, 1087, 1254],
      ],
      evolved: [
        [0, 148, 309, 463, 638, 790, 958, 1105, 1254],
        [0, 152, 308, 468, 638, 794, 949, 1092, 1254],
        [0, 161, 327, 480, 651, 744, 900, 1100, 1254],
        [0, 162, 330, 477, 647, 744, 900, 1103, 1254],
        [0, 146, 311, 474, 635, 804, 950, 1092, 1254],
        [0, 150, 323, 474, 639, 796, 944, 1095, 1254],
      ],
    };
    const weaponColumnBounds: Record<Exclude<AssemblyArchetype, 'baseline'>, number[]> = {
      agile: [0, 251, 484, 690, 899, 1137, 1339, 1551, 1774],
      armored: [0, 262, 473, 689, 896, 1143, 1338, 1567, 1774],
      evolved: [0, 262, 457, 700, 885, 1149, 1339, 1542, 1774],
    };
    const customGutters = archetype === 'baseline';
    const columnBounds = customGutters
      ? part.slot === 'weapon'
        ? [0, 365, 645, 890, 1125, 1360, 1610, 1885, 2172]
        : [0, 180, 347, 502, 676, 826, 976, 1115, 1254]
      : part.slot === 'weapon'
        ? weaponColumnBounds[archetype]
        : bodyColumnBounds[archetype][row];
    const atlasScale = atlas.naturalWidth / columnBounds[columnBounds.length - 1];
    const sourceLeft = Math.round(columnBounds[column] * atlasScale);
    const sourceRight = Math.round(columnBounds[column + 1] * atlasScale);
    const cellWidth = sourceRight - sourceLeft;
    const rowBounds = customGutters
      ? part.slot === 'weapon'
        ? [0, atlas.naturalHeight]
        : [0, 230, 446, 663, 879, 1030, 1254]
      : part.slot === 'weapon'
        ? [0, atlas.naturalHeight]
        : bodyRowBounds[archetype];
    const rowScale = atlas.naturalHeight / rowBounds[rowBounds.length - 1];
    const sourceTop = Math.round(rowBounds[row] * rowScale);
    const sourceBottom = Math.round(rowBounds[row + 1] * rowScale);
    const cellHeight = sourceBottom - sourceTop;
    const variantScale = 0.92 + (part.variant % 4) * 0.025;
    const offset = (1 - variantScale) * 32;
    ctx.save();
    ctx.filter = `hue-rotate(${(part.variant * 9 + part.generation * 3) % 24 - 12}deg) saturate(${1 + Math.min(0.28, part.fusionLevel * 0.06)})`;
    ctx.drawImage(
      atlas,
      sourceLeft,
      sourceTop,
      cellWidth,
      cellHeight,
      offset,
      offset,
      64 * variantScale,
      64 * variantScale,
    );
    ctx.restore();
    removeAssemblySpriteIslands(ctx, part.slot);
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = 0.08 + Math.min(0.12, part.fusionLevel * 0.025);
    ctx.fillStyle = part.color;
    ctx.fillRect(0, 0, 64, 64);
    ctx.restore();
    return canvas;
  }
  // Never expose the legacy geometric renderer while the detailed component
  // atlas is loading or unavailable. A transparent socket is preferable to a
  // one-frame primitive that misrepresents the equipped component.
  return canvas;
  /* c8 ignore start -- retained temporarily for migration reference only */
  const color = part.color;
  const dark = '#111827';
  const light = '#e2e8f0';
  const mechanical = ['robot', 'drone', 'vehicle', 'cyborg', 'mech', 'nanite', 'turret', 'data-wraith']
    .includes(part.baseElement) || part.entityType === 'mechanical' || part.entityType === 'synthetic';
  const lithic = part.baseElement === 'crystal' || part.entityType === 'lithic';
  const fluid = part.baseElement === 'cephalopod' || part.entityType === 'fluidic';
  const botanical = part.baseElement === 'plant' || part.entityType === 'botanical';
  const polygon = (points: Array<[number, number]>, fill = color) => {
    ctx.beginPath();
    points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = 3;
    ctx.stroke();
  };
  const block = (x: number, y: number, w: number, h: number, fill = color) => {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = dark;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
  };
  const line = (x1: number, y1: number, x2: number, y2: number, width = 5, stroke = color) => {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.lineCap = fluid ? 'round' : 'square';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };

  if (part.slot === 'head') {
    if (lithic) polygon([[8, 47], [17, 13], [27, 21], [34, 3], [43, 23], [54, 12], [57, 47], [32, 59]]);
    else if (botanical) {
      block(21, 25, 22, 30, '#713f12');
      polygon([[5, 30], [15, 10], [31, 22], [43, 6], [59, 29], [32, 39]]);
    } else if (mechanical) {
      polygon([[9, 18], [18, 9], [49, 12], [56, 23], [51, 52], [15, 52], [8, 41]], '#475569');
      block(15, 20, 35, 20);
      block(20, 26, 9, 7, '#67e8f9');
      block(37, 24, 8, 10, '#f8fafc');
      line(32, 12, 38, 3, 3, '#94a3b8');
    } else {
      polygon([[13, 16], [32, 7], [51, 18], [48, 48], [32, 57], [16, 48]]);
      block(20, 26, 7, 7, light);
      block(37, 26, 7, 7, light);
      if (part.baseElement === 'insect') {
        line(21, 16, 10, 3, 3);
        line(43, 16, 54, 3, 3);
      }
    }
  } else if (part.slot === 'torso') {
    if (lithic) polygon([[32, 2], [58, 19], [49, 60], [15, 60], [6, 19]]);
    else if (botanical) {
      block(22, 5, 20, 54, '#713f12');
      polygon([[22, 18], [2, 7], [11, 38]], color);
      polygon([[42, 18], [62, 7], [53, 38]], color);
    } else if (fluid) {
      polygon([[17, 8], [47, 8], [56, 29], [48, 58], [16, 58], [8, 29]]);
      ctx.fillStyle = 'rgba(255,255,255,.38)';
      ctx.fillRect(18, 15, 9, 34);
    } else if (mechanical) {
      polygon([[8, 13], [17, 5], [48, 8], [58, 20], [53, 52], [42, 61], [18, 58], [5, 44]], '#475569');
      block(15, 17, 35, 29);
      block(22, 24, 20, 12, '#0f172a');
      line(12, 50, 51, 50, 4, '#94a3b8');
    } else {
      polygon([[11, 9], [51, 7], [59, 46], [43, 60], [20, 58], [5, 45]]);
      line(16, 21, 48, 20, 4, light);
    }
  } else if (part.slot === 'arms') {
    if (fluid) {
      [[29, 15, 7, 59], [30, 18, 19, 60], [35, 16, 45, 60], [36, 15, 58, 57]]
        .forEach(([x1, y1, x2, y2]) => line(x1, y1, x2, y2, 7));
    } else if (part.baseElement === 'avian' || part.baseElement === 'owl') {
      polygon([[29, 19], [2, 3], [12, 42], [29, 51]]);
      polygon([[35, 19], [62, 3], [52, 42], [35, 51]]);
      line(9, 16, 25, 32, 3, light);
      line(55, 16, 39, 32, 3, light);
    } else if (mechanical) {
      block(2, 16, 25, 17, '#475569');
      block(37, 16, 25, 17, '#475569');
      block(0, 35, 19, 13);
      block(45, 35, 19, 13);
      line(16, 25, 8, 42, 5, '#94a3b8');
      line(48, 25, 56, 42, 5, '#94a3b8');
    } else {
      line(29, 17, 8, 44, 11);
      line(35, 17, 56, 44, 11);
      polygon([[2, 40], [16, 38], [12, 59]]);
      polygon([[62, 40], [48, 38], [52, 59]]);
    }
  } else if (part.slot === 'legs') {
    if (part.baseElement === 'vehicle' || part.baseElement === 'turret') {
      block(7, 8, 50, 22, '#475569');
      [17, 47].forEach((x) => {
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.arc(x, 47, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, 47, 5, 0, Math.PI * 2);
        ctx.fill();
      });
    } else if (part.baseElement === 'serpent' || part.baseElement === 'fish') {
      ctx.strokeStyle = color;
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(25, 4);
      ctx.bezierCurveTo(55, 17, 9, 37, 42, 58);
      ctx.stroke();
      polygon([[39, 58], [57, 48], [52, 63]]);
    } else if (fluid) {
      [15, 27, 39, 51].forEach((x, index) => line(31, 5, x, 61, 8, index % 2 ? color : light));
    } else if (mechanical) {
      block(10, 3, 19, 45, '#475569');
      block(35, 3, 19, 45, '#475569');
      block(5, 44, 25, 15);
      block(34, 44, 25, 15);
    } else {
      line(26, 4, 17, 49, 12);
      line(38, 4, 47, 49, 12);
      polygon([[5, 48], [28, 45], [26, 61], [3, 61]]);
      polygon([[59, 48], [36, 45], [38, 61], [61, 61]]);
    }
  } else if (part.slot === 'core') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(32, 32, 23, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = mechanical ? '#67e8f9' : light;
    ctx.beginPath();
    ctx.arc(32, 32, 10, 0, Math.PI * 2);
    ctx.fill();
  } else {
    if (part.niche === 'phase' || part.entityType === 'spectral') {
      [13, 21, 29].forEach((radius, index) => {
        ctx.strokeStyle = index % 2 ? light : color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(32, 32, radius, index * 0.4, Math.PI * (1.3 + index * 0.18));
        ctx.stroke();
      });
    } else {
      polygon([[4, 44], [19, 31], [9, 8], [32, 21], [55, 8], [45, 31], [60, 44], [39, 43], [32, 61], [25, 43]]);
    }
  }

  // Constitution detail remains local to the selected part rather than
  // importing another complete creature silhouette.
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = light;
  const detailStep = 7 + (part.variant % 3) * 2;
  for (let offset = -32; offset < 72; offset += detailStep) {
    ctx.fillRect(offset, (offset * 3 + part.generation * 5) % 64, detailStep, 2);
  }
  ctx.restore();

  const componentMask = ctx.getImageData(0, 0, 64, 64);
  const signature = [
    part.baseElement, part.element, part.entityType, part.enemyClass,
    part.niche, part.variant, part.generation, part.fusionLevel,
    part.fusionElement ?? '', part.fusionAffinity ?? '', ...part.mutations,
  ].join(':');
  const seed = [...signature].reduce(
    (sum, character) => (sum * 33 + character.charCodeAt(0)) >>> 0,
    5381,
  );
  const sourceGenome: EnemyGenome = {
    baseElement: part.baseElement as EnemyGenome['baseElement'],
    element: part.element as EnemyGenome['element'],
    entityType: part.entityType as EnemyGenome['entityType'],
    enemyClass: part.enemyClass as EnemyGenome['enemyClass'],
    niche: part.niche as EnemyGenome['niche'],
    generation: Math.max(part.generation, 2 + part.variant),
    mutations: part.mutations as EnemyGenome['mutations'],
    speedScale: 1,
    hpBonus: part.enemyClass === 'guardian' ? 2 : 0,
    sizeScale: part.mutations.includes('gigantic') ? 1.2
      : part.mutations.includes('miniature') ? 0.82 : 1,
    regeneration: part.niche === 'regenerator' ? 0.2 : 0,
    phaseChance: part.niche === 'phase' ? 0.25 : 0,
    fusionLevel: part.fusionLevel,
    fusionElement: part.fusionElement as EnemyGenome['fusionElement'],
    fusionAffinity: part.fusionAffinity as EnemyGenome['fusionAffinity'],
  };
  const sourceSprite = getProceduralVirusSprite(seed, sourceGenome);
  const sourceContext = sourceSprite.getContext('2d')!;
  if (sourceContext) {
    const pixels = sourceContext.getImageData(0, 0, sourceSprite.width, sourceSprite.height);
    let minX = sourceSprite.width;
    let minY = sourceSprite.height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < sourceSprite.height; y += 2) {
      for (let x = 0; x < sourceSprite.width; x += 2) {
        if (pixels.data[(y * sourceSprite.width + x) * 4 + 3] < 18) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    if (maxX >= minX && maxY >= minY) {
      ctx.putImageData(componentMask, 0, 0);
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = 0.86;
      ctx.drawImage(
        sourceSprite,
        Math.max(0, minX - 4),
        Math.max(0, minY - 4),
        Math.min(sourceSprite.width - Math.max(0, minX - 4), maxX - minX + 8),
        Math.min(sourceSprite.height - Math.max(0, minY - 4), maxY - minY + 8),
        0, 0, 64, 64,
      );
      ctx.restore();
      // Restore a restrained outline so texture never erases the part's
      // intended anatomy or socket boundary.
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = part.color;
      ctx.fillRect(0, 0, 64, 64);
      ctx.restore();
    }
  }
  return canvas;
  /* c8 ignore stop */
}

function AvatarAssembly({
  components,
  equipped,
  className = '',
  animation = 'static',
  attackPulse = 0,
}: {
  components: AvatarComponentDrop[];
  equipped: EquippedAvatarComponents;
  className?: string;
  animation?: 'static' | 'idle' | 'showcase';
  attackPulse?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selected = AVATAR_SLOTS
    .map((slot) => components.find((component) => component.id === equipped[slot]))
    .filter((part): part is AvatarComponentDrop => Boolean(part));
  const fit = analyzeAssemblyFit(selected);
  const assemblyCanvasKey = AVATAR_SLOTS
    .map((slot) => equipped[slot] ?? 'none')
    .join(':');

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const sprites = new Map<string, HTMLCanvasElement>();
    const atlasFor = (part: AvatarComponentDrop) => getAssemblyAtlas(part);
    const atlases = [...new Set(selected.map(atlasFor))];
    const readyAtlases = new Set(atlases.filter((atlas) =>
      atlas.complete && atlas.naturalWidth > 0));
    const atlasReadyFor = (part: AvatarComponentDrop) => readyAtlases.has(atlasFor(part));
    const spriteBounds = new Map<string, { x: number; y: number; width: number; height: number }>();
    for (const part of selected) {
      if (atlasReadyFor(part)) sprites.set(part.id, buildAssemblyPartSprite(part, atlasFor(part)));
    }
    const atlasLoadHandlers = new Map<HTMLImageElement, () => void>();
    for (const atlas of atlases) {
      if (readyAtlases.has(atlas)) continue;
      const hydrateAtlasSprites = () => {
        readyAtlases.add(atlas);
        for (const part of selected.filter((candidate) => atlasFor(candidate) === atlas)) {
          sprites.set(part.id, buildAssemblyPartSprite(part, atlas));
        }
        refreshBounds();
        redraw();
      };
      atlasLoadHandlers.set(atlas, hydrateAtlasSprites);
      atlas.addEventListener('load', hydrateAtlasSprites);
    }

    const boundsOf = (sprite: HTMLCanvasElement) => {
      const source = sprite.getContext('2d');
      if (!source) return { x: 48, y: 8, width: 144, height: 144 };
      const pixels = source.getImageData(0, 0, sprite.width, sprite.height);
      let minX = sprite.width; let minY = sprite.height; let maxX = -1; let maxY = -1;
      for (let y = 0; y < sprite.height; y += 2) {
        for (let x = 0; x < sprite.width; x += 2) {
          if (pixels.data[(y * sprite.width + x) * 4 + 3] < 18) continue;
          minX = Math.min(minX, x); minY = Math.min(minY, y);
          maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        }
      }
      if (maxX < minX || maxY < minY) return { x: 48, y: 8, width: 144, height: 144 };
      return {
        x: Math.max(0, minX - 4),
        y: Math.max(0, minY - 4),
        width: Math.min(sprite.width - Math.max(0, minX - 4), maxX - minX + 8),
        height: Math.min(sprite.height - Math.max(0, minY - 4), maxY - minY + 8),
      };
    };
    const refreshBounds = () => {
      for (const [id, sprite] of sprites) spriteBounds.set(id, boundsOf(sprite));
    };
    refreshBounds();
    const drawOrder: AvatarSlot[] = ['accent', 'legs', 'torso', 'arms', 'weapon', 'head', 'core'];
    const drawFragment = (
      sprite: HTMLCanvasElement,
      bounds: { x: number; y: number; width: number; height: number },
      sourceX: number,
      sourceY: number,
      sourceWidth: number,
      sourceHeight: number,
      targetX: number,
      targetY: number,
      targetWidth: number,
      targetHeight: number,
    ) => {
      ctx.drawImage(
        sprite,
        bounds.x + bounds.width * sourceX,
        bounds.y + bounds.height * sourceY,
        Math.max(1, bounds.width * sourceWidth),
        Math.max(1, bounds.height * sourceHeight),
        targetX, targetY, targetWidth, targetHeight,
      );
    };
    const partFragments = (slot: AvatarSlot, part: AvatarComponentDrop, attack: number): Array<
      [number, number, number, number, number, number, number, number]
    > => {
      if (slot === 'weapon' && atlasReadyFor(part)) {
        const reach = attack * 13;
        return [[0, 0, 1, 1, 48 + attack * 2, 31 - attack * 5, 46 + reach, 57]];
      }
      if (slot !== 'weapon' && atlasReadyFor(part)) {
        if (slot === 'head') {
          const width = (fit.headProfile === 'broad' ? 47 : fit.headProfile === 'sensor' ? 39 : 43)
            * fit.headScale;
          return [[0, 0, 1, 1, 48 - width / 2 + attack * 2, 1 - attack * 2, width, 42]];
        }
        if (slot === 'torso') {
          const width = Math.max(44, fit.torsoWidth + 8);
          return [[0, 0, 1, 1, 48 - width / 2 + attack * 2, 27, width, fit.build === 'heavy' ? 55 : 51]];
        }
        if (slot === 'arms') {
          const width = Math.min(92, Math.max(72, fit.shoulderSpan + 31) + attack * 8);
          return [[0, 0, 1, 1, 48 - width / 2 + attack * 3, 28 - attack * 5, width, 58 + attack * 2]];
        }
        if (slot === 'legs') {
          const width = fit.locomotion === 'tentacled' || fit.locomotion === 'serpentine'
            ? 64 : Math.max(48, fit.hipWidth + 22);
          return [[0, 0, 1, 1, 48 - width / 2 - attack * 2, 69, width + attack * 4, 59]];
        }
        if (slot === 'core') {
          return [[0, 0, 1, 1, 37 + attack * 2, 43, 22, 22]];
        }
        return [[0, 0, 1, 1, 18 + attack * 2, 13, 60, 55]];
      }
      if (slot === 'head') {
        const width = (fit.headProfile === 'broad' ? 44
          : fit.headProfile === 'sensor' ? 34 : 36) * fit.headScale;
        const height = fit.headProfile === 'sensor' ? 25 : 29;
        return [[0.08, 0, 0.84, 0.56, 48 - width / 2 + attack * 3, 7 - height / 10 - attack * 2, width, height]];
      }
      if (slot === 'torso') {
        return [[
          0.08, 0.15, 0.84, 0.72,
          48 - fit.torsoWidth / 2 + attack * 2,
          34,
          fit.torsoWidth,
          fit.build === 'heavy' ? 43 : 39,
        ]];
      }
      if (slot === 'arms') {
        const winged = fit.armature === 'wing';
        const fluidArms = fit.armature === 'tendril';
        const armWidth = winged ? 27 : fluidArms ? 22 : 20;
        const armHeight = fluidArms ? 45 : winged ? 39 : 36;
        const leftX = Math.max(0, 48 - fit.shoulderSpan / 2 - attack * 4);
        const rightX = Math.min(75, 48 + fit.shoulderSpan / 2 - armWidth + attack * 10);
        const leftY = 39 + attack * 5;
        const rightY = 39 - attack * 10;
        if (['avian', 'owl'].includes(part.baseElement)) {
          return [
            [0, 0.08, 0.48, 0.78, leftX, leftY, armWidth, armHeight],
            [0.52, 0.08, 0.48, 0.78, rightX, rightY, armWidth + attack * 5, armHeight],
          ];
        }
        if (fluidArms) {
          return [
            [0, 0.12, 0.48, 0.82, leftX, leftY, armWidth, armHeight],
            [0.52, 0.12, 0.48, 0.82, rightX, rightY, armWidth + attack * 6, armHeight],
          ];
        }
        if (fit.armature === 'tool') {
          return [
            [0, 0.12, 0.48, 0.76, leftX, leftY, armWidth + 2, armHeight],
            [0.48, 0.08, 0.52, 0.8, rightX - attack * 2, rightY, armWidth + 5 + attack * 10, armHeight - attack * 2],
          ];
        }
        if (fit.armature === 'claw') {
          return [
            [0, 0.08, 0.5, 0.84, leftX - 2, leftY + attack * 2, armWidth + 4, armHeight + 3],
            [0.5, 0.08, 0.5, 0.84, rightX, rightY, armWidth + 5 + attack * 8, armHeight + 3],
          ];
        }
        return [
          [0, 0.12, 0.48, 0.76, leftX, leftY, armWidth, armHeight],
          [0.52, 0.12, 0.48, 0.76, rightX, rightY, armWidth + attack * 7, armHeight - attack * 3],
        ];
      }
      if (slot === 'legs') {
        if (fit.locomotion === 'wheeled') {
          return [[0, 0.42, 1, 0.58, 48 - fit.hipWidth / 2 - attack * 2, 78, fit.hipWidth + attack * 4, 44]];
        }
        if (fit.locomotion === 'serpentine') {
          return [[0.06, 0.4, 0.88, 0.6, 25 - attack * 3, 75, 46 + attack * 6, 51]];
        }
        if (fit.locomotion === 'tentacled') {
          return [[0.03, 0.34, 0.94, 0.66, 24 - attack * 3, 75, 48 + attack * 6, 52]];
        }
        if (fit.locomotion === 'hover') {
          return [[0.04, 0.4, 0.92, 0.58, 27 - attack * 2, 78, 42 + attack * 4, 35]];
        }
        if (fit.locomotion === 'quadruped') {
          return [
            [0, 0.42, 0.48, 0.58, 48 - fit.hipWidth / 2 - attack * 4, 77, 28, 43],
            [0.52, 0.42, 0.48, 0.58, 48 + fit.hipWidth / 2 - 28 + attack * 5, 77, 28, 43],
          ];
        }
        const brace = attack * 4;
        return [
          [0.04, 0.44, 0.46, 0.56, 48 - fit.hipWidth / 2 - brace, 76, 17, 49],
          [0.5, 0.44, 0.46, 0.56, 48 + fit.hipWidth / 2 - 17 + brace, 76, 17, 49],
        ];
      }
      if (slot === 'core') return [[0.26, 0.26, 0.48, 0.48, 40 + attack * 2, 49, 16, 16]];
      return [[0, 0, 1, 1, 25 + attack * 2, 24, 46, 46]];
    };
    let active = true;
    let frame = 0;
    const animationStarted = performance.now();
    const redraw = (now = performance.now()) => {
      if (!active) return;
      ctx.clearRect(0, 0, 96, 128);
      ctx.imageSmoothingEnabled = false;
      const idle = animation === 'static' ? 0 : Math.sin(now / 260);
      const showcaseTime = (now - animationStarted) % 3200;
      const attackElapsed = now - animationStarted;
      const attackDuration = 760;
      const attackEnvelope = (elapsed: number, duration: number) => {
        const linear = Math.max(0, Math.min(1, elapsed / duration));
        const eased = linear * linear * (3 - 2 * linear);
        return Math.sin(eased * Math.PI);
      };
      const attack = animation === 'showcase'
        ? (showcaseTime > 1900 && showcaseTime < 2550
          ? attackEnvelope(showcaseTime - 1900, 650) : 0)
        : attackPulse > 0 && attackElapsed < attackDuration
          ? attackEnvelope(attackElapsed, attackDuration)
          : 0;
      const attackProgress = attackPulse > 0
        ? Math.max(0, Math.min(1, attackElapsed / attackDuration))
        : 0;
      const anticipation = attackProgress < 0.2
        ? Math.sin((attackProgress / 0.2) * Math.PI)
        : 0;
      ctx.save();
      // Preserve sub-pixel motion so the assembled body accelerates and
      // recovers continuously instead of snapping between integer positions.
      ctx.translate(attack * 2.2 - anticipation * 1.4, idle * 1.5 - attack * 1.2 + anticipation * 0.6);
      ctx.scale(1 + attack * 0.025 - anticipation * 0.02, 1 - attack * 0.018 + anticipation * 0.025);
      // Components must remain the readable body, even when the fit score is
      // low. Cohesion now affects placement, never their visibility.
      ctx.globalAlpha = 1;
      for (const slot of drawOrder) {
        const part = selected.find((candidate) => candidate.slot === slot);
        const sprite = part ? sprites.get(part.id) : undefined;
        if (!part || !sprite) continue;
        const bounds = spriteBounds.get(part.id) ?? boundsOf(sprite);
        for (const fragment of partFragments(slot, part, attack)) {
          drawFragment(sprite, bounds, ...fragment);
        }
      }
      ctx.globalAlpha = 1;
      if (attack > 0.15) {
        ctx.globalAlpha = attack * 0.84;
        ctx.strokeStyle = fit.dominantColor;
        ctx.lineWidth = 2 + attack * 2;
        ctx.beginPath();
        ctx.moveTo(68 + attack * 7, 40);
        ctx.lineTo(95, 31 - attack * 4);
        ctx.moveTo(70 + attack * 6, 46);
        ctx.lineTo(95, 45);
        ctx.moveTo(68 + attack * 7, 52);
        ctx.lineTo(94, 59 + attack * 3);
        ctx.stroke();
      }
      if (attackProgress > 0.34 && attackProgress < 0.72) {
        const impact = Math.sin(((attackProgress - 0.34) / 0.38) * Math.PI);
        ctx.globalAlpha = impact * 0.9;
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(91, 45, 4 + impact * 10, -Math.PI * 0.65, Math.PI * 0.65);
        ctx.stroke();
        ctx.fillStyle = fit.dominantColor;
        for (let spark = 0; spark < 4; spark++) {
          const angle = -0.9 + spark * 0.6;
          ctx.fillRect(
            90 + Math.cos(angle) * (8 + impact * 13),
            45 + Math.sin(angle) * (8 + impact * 13),
            2, 2,
          );
        }
      }
      ctx.restore();
      if (animation !== 'static' || attackPulse > 0) frame = requestAnimationFrame(redraw);
    };
    redraw();
    const timers = [100, 300, 700, 1500, 3000].map((delay) =>
      window.setTimeout(() => {
        for (const part of selected) {
          if (atlasReadyFor(part)) {
            sprites.set(part.id, buildAssemblyPartSprite(part, atlasFor(part)));
          }
        }
        refreshBounds();
        if (animation === 'static') redraw();
      }, delay));
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      for (const [atlas, handler] of atlasLoadHandlers) {
        atlas.removeEventListener('load', handler);
      }
      timers.forEach((timer) => window.clearTimeout(timer));
      ctx.clearRect(0, 0, 96, 128);
    };
  }, [components, equipped, animation, attackPulse, fit.armature, fit.build, fit.cohesion,
    fit.dominantColor, fit.headProfile, fit.headScale, fit.hipWidth, fit.locomotion,
    fit.shoulderSpan, fit.torsoWidth]);

  return (
    <div
      className={`avatarAssembly ${className}`}
      aria-label={`Pragmatic Assembly: ${fit.description}`}
      data-fit={fit.build}
      data-locomotion={fit.locomotion}
    >
      <canvas
        key={assemblyCanvasKey}
        ref={canvasRef}
        width={96}
        height={128}
        className="avatarAssemblyCanvas"
      />
    </div>
  );
}

async function sanitizeRivalSkinFrame(
  bitmap: ImageBitmap,
  previewOnly = false,
): Promise<ImageBitmap> {
  const source = document.createElement('canvas');
  source.width = bitmap.width;
  source.height = bitmap.height;
  const sourceCtx = source.getContext('2d', { willReadFrequently: true });
  if (!sourceCtx) return bitmap;
  sourceCtx.drawImage(bitmap, 0, 0);
  const image = sourceCtx.getImageData(0, 0, source.width, source.height);
  const visited = new Uint8Array(source.width * source.height);
  type Island = {
    pixels: number[];
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  const islands: Island[] = [];
  for (let start = 0; start < visited.length; start++) {
    if (visited[start] || image.data[start * 4 + 3] < 18) continue;
    const queue = [start];
    const pixels: number[] = [];
    visited[start] = 1;
    let minX = source.width;
    let minY = source.height;
    let maxX = -1;
    let maxY = -1;
    while (queue.length) {
      const pixel = queue.pop()!;
      pixels.push(pixel);
      const x = pixel % source.width;
      const y = Math.floor(pixel / source.width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if ((!dx && !dy) || nx < 0 || nx >= source.width || ny < 0 || ny >= source.height) continue;
          const next = ny * source.width + nx;
          if (visited[next] || image.data[next * 4 + 3] < 18) continue;
          visited[next] = 1;
          queue.push(next);
        }
      }
    }
    islands.push({ pixels, minX, minY, maxX, maxY });
  }
  if (islands.length === 0) return bitmap;
  islands.sort((left, right) => right.pixels.length - left.pixels.length);
  const primary = islands[0];
  const gapFromPrimary = (island: Island) => {
    const gapX = Math.max(0, primary.minX - island.maxX, island.minX - primary.maxX);
    const gapY = Math.max(0, primary.minY - island.maxY, island.minY - primary.maxY);
    return Math.hypot(gapX, gapY);
  };
  // Gameplay may retain nearby weapon/effect islands. A menu thumbnail must
  // show one unambiguous subject: keeping even a second large island is what
  // produced the duplicated weapons, partial bodies, and afterimages visible
  // beside every rival in Customization.
  const retained = previewOnly
    ? [primary]
    : islands.filter((island, index) =>
        index === 0
        || island.pixels.length >= primary.pixels.length * 0.18
        || (island.pixels.length >= 20 && gapFromPrimary(island) <= 28));
  const retainedPixels = new Set(retained.flatMap((island) => island.pixels));
  for (let pixel = 0; pixel < visited.length; pixel++) {
    if (!retainedPixels.has(pixel)) image.data[pixel * 4 + 3] = 0;
  }
  sourceCtx.putImageData(image, 0, 0);
  const minX = Math.min(...retained.map((island) => island.minX));
  const minY = Math.min(...retained.map((island) => island.minY));
  const maxX = Math.max(...retained.map((island) => island.maxX));
  const maxY = Math.max(...retained.map((island) => island.maxY));
  const cropWidth = Math.max(1, maxX - minX + 1);
  const cropHeight = Math.max(1, maxY - minY + 1);
  const output = document.createElement('canvas');
  output.width = bitmap.width;
  output.height = bitmap.height;
  const outputCtx = output.getContext('2d');
  if (!outputCtx) return bitmap;
  outputCtx.imageSmoothingEnabled = false;
  const scale = Math.min(
    output.width * 0.82 / cropWidth,
    output.height * 0.9 / cropHeight,
  );
  const drawWidth = Math.round(cropWidth * scale);
  const drawHeight = Math.round(cropHeight * scale);
  outputCtx.drawImage(
    source,
    minX, minY, cropWidth, cropHeight,
    Math.round((output.width - drawWidth) / 2),
    Math.round((output.height - drawHeight) / 2),
    drawWidth, drawHeight,
  );
  const cleaned = await createImageBitmap(output);
  bitmap.close();
  return cleaned;
}

async function sanitizeRivalSkinPair(
  idleBitmap: ImageBitmap,
  attackBitmap: ImageBitmap,
): Promise<{ idle: ImageBitmap; attack: ImageBitmap }> {
  type Island = {
    pixels: number[];
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  const inspect = (bitmap: ImageBitmap) => {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(bitmap, 0, 0);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const visited = new Uint8Array(canvas.width * canvas.height);
    const islands: Island[] = [];
    for (let start = 0; start < visited.length; start++) {
      if (visited[start] || image.data[start * 4 + 3] < 18) continue;
      const queue = [start];
      const pixels: number[] = [];
      visited[start] = 1;
      let minX = canvas.width;
      let minY = canvas.height;
      let maxX = -1;
      let maxY = -1;
      while (queue.length) {
        const pixel = queue.pop()!;
        pixels.push(pixel);
        const x = pixel % canvas.width;
        const y = Math.floor(pixel / canvas.width);
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if ((!dx && !dy) || nx < 0 || nx >= canvas.width || ny < 0 || ny >= canvas.height) continue;
            const next = ny * canvas.width + nx;
            if (visited[next] || image.data[next * 4 + 3] < 18) continue;
            visited[next] = 1;
            queue.push(next);
          }
        }
      }
      islands.push({ pixels, minX, minY, maxX, maxY });
    }
    islands.sort((left, right) => right.pixels.length - left.pixels.length);
    return { canvas, ctx, image, islands };
  };
  const idle = inspect(idleBitmap);
  const attack = inspect(attackBitmap);
  if (idle.islands.length === 0 || attack.islands.length === 0) {
    return { idle: idleBitmap, attack: attackBitmap };
  }
  const idleBody = idle.islands[0];
  const idleWidth = idleBody.maxX - idleBody.minX + 1;
  const idleHeight = idleBody.maxY - idleBody.minY + 1;
  const attackLargest = attack.islands[0].pixels.length;
  const attackBodyIsland = attack.islands
    .filter((island) => island.pixels.length >= attackLargest * 0.24)
    .sort((left, right) => left.minX - right.minX)[0] ?? attack.islands[0];
  let attackBody = attackBodyIsland;
  const attackBodyWidth = attackBody.maxX - attackBody.minX + 1;
  if (attackBodyWidth > idleWidth * 1.55) {
    const cutoff = Math.min(
      attack.canvas.width - 1,
      attackBody.minX + Math.ceil(idleWidth * 1.28),
    );
    const bodyPixels = attackBody.pixels.filter((pixel) => pixel % attack.canvas.width <= cutoff);
    if (bodyPixels.length > 0) {
      attackBody = {
        pixels: bodyPixels,
        minX: Math.min(...bodyPixels.map((pixel) => pixel % attack.canvas.width)),
        minY: Math.min(...bodyPixels.map((pixel) => Math.floor(pixel / attack.canvas.width))),
        maxX: Math.max(...bodyPixels.map((pixel) => pixel % attack.canvas.width)),
        maxY: Math.max(...bodyPixels.map((pixel) => Math.floor(pixel / attack.canvas.width))),
      };
    }
  }
  const gap = (body: Island, island: Island) => {
    const gapX = Math.max(0, body.minX - island.maxX, island.minX - body.maxX);
    const gapY = Math.max(0, body.minY - island.maxY, island.minY - body.maxY);
    return Math.hypot(gapX, gapY);
  };
  const retainIdle = idle.islands.filter((island, index) =>
    index === 0
    || (
      island.pixels.length >= 18
      && gap(idleBody, island) <= 14
      && island.minY > 8
      && island.maxY < idle.canvas.height - 8
    ));
  const retainAttack = attack.islands.filter((island) =>
    (
      island === attackBodyIsland
      || island.pixels.length >= attackLargest * 0.012
      || gap(attackBody, island) <= 24
    )
    && island.minY > 9
    && island.maxY < attack.canvas.height - 9);

  const clean = (
    inspected: ReturnType<typeof inspect>,
    retained: Island[],
    body: Island,
  ) => {
    const keep = new Set(retained.flatMap((island) => island.pixels));
    for (let pixel = 0; pixel < inspected.canvas.width * inspected.canvas.height; pixel++) {
      if (!keep.has(pixel)) inspected.image.data[pixel * 4 + 3] = 0;
    }
    inspected.ctx.putImageData(inspected.image, 0, 0);
    const output = document.createElement('canvas');
    output.width = 160;
    output.height = 160;
    const outputCtx = output.getContext('2d')!;
    outputCtx.imageSmoothingEnabled = false;
    const scale = Math.min(112 / idleWidth, 126 / idleHeight);
    const bodyCenterX = (body.minX + body.maxX + 1) / 2;
    const bodyCenterY = (body.minY + body.maxY + 1) / 2;
    outputCtx.drawImage(
      inspected.canvas,
      Math.round(67 - bodyCenterX * scale),
      Math.round(82 - bodyCenterY * scale),
      Math.round(inspected.canvas.width * scale),
      Math.round(inspected.canvas.height * scale),
    );
    return createImageBitmap(output);
  };
  const [cleanIdle, cleanAttack] = await Promise.all([
    clean(idle, retainIdle, idleBody),
    clean(attack, retainAttack, attackBody),
  ]);
  idleBitmap.close();
  attackBitmap.close();
  return { idle: cleanIdle, attack: cleanAttack };
}

function movementClassOf(enemy: GameState['enemies'][number]): EnemyMovementClass | undefined {
  return enemy.genome ? getEnemyMovementClass(enemy.genome.baseElement) : undefined;
}

function isCyberEnemy(enemy: GameState['enemies'][number]): boolean {
  return Boolean(enemy.genome && CYBER_BASES.has(enemy.genome.baseElement));
}

function enemyAbilityFor(genome: EnemyGenome): EnemyAbility | undefined {
  const mature = genome.fusionLevel > 0 || (genome.generation >= 2 && genome.mutations.length >= 2);
  if (!mature) return undefined;
  const movement = getEnemyMovementClass(genome.baseElement);
  if (movement === 'vehicle' && (genome.element === 'kinetic' || genome.mutations.includes('armored'))) {
    return 'momentumCharge';
  }
  if ((movement === 'spectral' || genome.niche === 'phase') && genome.element === 'void') {
    return 'phaseLeap';
  }
  if (genome.niche === 'regenerator' || genome.enemyClass === 'mender') return 'mendingPulse';
  if (AIR_CLASSES.has(movement) && (genome.niche === 'swarm' || genome.niche === 'scout')) return 'laneShift';
  if (genome.entityType === 'mechanical' && genome.element === 'voltaic') return 'arcArmor';
  return undefined;
}

function playerAbilityComponents(ability: (typeof ABILITY_POOL)[number]): Omit<AbilityBlueprint, 'abilityId'> {
  const text = `${ability?.name ?? ''} ${ability?.desc ?? ''}`.toLowerCase();
  const delivery = /bullet|shot|fire|ammo/.test(text) ? 'projector'
    : /grid|every|all|field|wave/.test(text) ? 'field'
      : /shield|armor|invincible/.test(text) ? 'shell'
        : /restore|regen|leech|heal/.test(text) ? 'weave'
          : /teleport|warp|banish|phase/.test(text) ? 'aperture'
            : 'pulse';
  const fn = /push|repel|recoil|drive|warp back/.test(text) ? 'impulse'
    : /slow|freeze|cripple|stagger|trap/.test(text) ? 'inhibit'
      : /destroy|damage|power|blast|strike/.test(text) ? 'rupture'
        : /shield|armor|invincible|block/.test(text) ? 'ward'
          : /restore|regen|leech|heal/.test(text) ? 'restore'
            : /reveal|expose|mark/.test(text) ? 'reveal'
              : 'adapt';
  const medium = /cyber|machine|circuit|signal|voltage/.test(text) ? 'signal'
    : /thermal|cryo|freeze|blizzard/.test(text) ? 'thermal'
      : /void|ghost|phase|radiant/.test(text) ? 'phase'
        : /fluid|undertow|acid|corrosive/.test(text) ? 'fluid'
          : /root|bloom|tangle/.test(text) ? 'organic'
            : 'kinetic';
  return { delivery, function: fn, medium };
}

const PLAYER_ABILITY_MATRIX: AbilityBlueprint[] = ABILITY_POOL.map((ability) => ({
  abilityId: ability.id,
  ...playerAbilityComponents(ability),
}));

function constitutionComponents(genome: EnemyGenome): Omit<AbilityBlueprint, 'abilityId'> {
  const constitution = enemyAbilityFor(genome);
  const movement = getEnemyMovementClass(genome.baseElement);
  const delivery = constitution === 'phaseLeap' || genome.niche === 'phase' ? 'aperture'
    : constitution === 'mendingPulse' || genome.niche === 'regenerator' ? 'weave'
      : constitution === 'arcArmor' || genome.mutations.includes('armored') ? 'shell'
        : constitution === 'laneShift' || genome.niche === 'swarm' ? 'field'
          : genome.entityType === 'mechanical' || AIR_CLASSES.has(movement) ? 'projector'
            : 'pulse';
  const fn = constitution === 'mendingPulse' || genome.niche === 'regenerator' || genome.enemyClass === 'mender'
    ? 'restore'
    : constitution === 'arcArmor' || genome.mutations.includes('armored') ? 'ward'
      : constitution === 'momentumCharge' || movement === 'vehicle' ? 'impulse'
        : constitution === 'laneShift' || genome.niche === 'scout' ? 'adapt'
          : constitution === 'phaseLeap' || genome.niche === 'phase' ? 'reveal'
            : genome.mutations.includes('resilient') ? 'inhibit'
              : 'rupture';
  const mediumByElement: Record<string, string> = {
    voltaic: 'signal',
    thermal: 'thermal',
    cryo: 'thermal',
    void: 'phase',
    radiant: 'phase',
    fluidic: 'fluid',
    corrosive: 'fluid',
    botanical: 'organic',
    kinetic: 'kinetic',
  };
  const medium = genome.entityType === 'mechanical'
    ? 'signal'
    : mediumByElement[genome.element] ?? 'kinetic';
  return { delivery, function: fn, medium };
}

function abilityBlueprintFor(genome: EnemyGenome): AbilityBlueprint {
  const components = constitutionComponents(genome);
  const signature = `${genome.baseElement}:${genome.element}:${genome.entityType}:${genome.enemyClass}:${genome.niche}`;
  const hash = [...signature].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 0);
  let bestScore = -1;
  let matches: AbilityBlueprint[] = [];
  for (const candidate of PLAYER_ABILITY_MATRIX) {
    const score = (candidate.medium === components.medium ? 5 : 0)
      + (candidate.function === components.function ? 4 : 0)
      + (candidate.delivery === components.delivery ? 3 : 0);
    if (score > bestScore) {
      bestScore = score;
      matches = [candidate];
    } else if (score === bestScore) {
      matches.push(candidate);
    }
  }
  const matched = matches[hash % Math.max(1, matches.length)] ?? PLAYER_ABILITY_MATRIX[0];
  return { abilityId: matched.abilityId, ...components };
}

function linkedPlayerAbility(genome: EnemyGenome): string {
  return abilityBlueprintFor(genome).abilityId;
}

function constitutionMatrixSignature(genome: EnemyGenome): string {
  const blueprint = abilityBlueprintFor(genome);
  return `${blueprint.medium}:${blueprint.function}:${blueprint.delivery}`;
}

function manifestedAbilityFor(genome: EnemyGenome): GeneratedAbility {
  const blueprint = abilityBlueprintFor(genome);
  const signature = constitutionMatrixSignature(genome);
  const hash = [...signature].reduce((sum, char) => (sum * 33 + char.charCodeAt(0)) >>> 0, 5381);
  const mediumNames: Record<string, string> = {
    signal: 'Cipher', thermal: 'Thermal', phase: 'Phase',
    fluid: 'Tidal', organic: 'Verdant', kinetic: 'Kinetic',
  };
  const functionNames: Record<string, string> = {
    rupture: 'Rupture', inhibit: 'Snare', impulse: 'Drive', ward: 'Aegis',
    restore: 'Weave', reveal: 'Beacon', adapt: 'Shift',
  };
  const deliveryNames: Record<string, string> = {
    projector: 'Lance', field: 'Field', shell: 'Shell',
    weave: 'Thread', aperture: 'Gate', pulse: 'Pulse',
  };
  const id = `manifest-${blueprint.medium}-${blueprint.function}-${blueprint.delivery}`;
  const generated: GeneratedAbility = {
    id,
    name: `${mediumNames[blueprint.medium] ?? blueprint.medium} ${functionNames[blueprint.function] ?? blueprint.function} ${deliveryNames[blueprint.delivery] ?? blueprint.delivery}`.toUpperCase(),
    desc: '',
    cooldown: 9 + (hash % 7),
    ...blueprint,
    abilityId: id,
    constitutionSignature: signature,
    manifestedAt: Date.now(),
  };
  return { ...generated, desc: generatedAbilityDescription(generated) };
}

function enemyCounterpartFor(genome: EnemyGenome): EnemyAbility | undefined {
  const mature = genome.fusionLevel > 0 || (genome.generation >= 2 && genome.mutations.length >= 2);
  if (!mature) return undefined;
  const intrinsic = enemyAbilityFor(genome);
  if (intrinsic) return intrinsic;
  const { function: fn } = abilityBlueprintFor(genome);
  if (fn === 'restore') return 'mendingPulse';
  if (fn === 'ward') return 'arcArmor';
  if (fn === 'adapt' || fn === 'inhibit') return 'laneShift';
  if (fn === 'reveal') return 'phaseLeap';
  return 'momentumCharge';
}

function genomeSignature(enemy: GameState['enemies'][number]): string | undefined {
  const genome = enemy.genome;
  if (!genome) return undefined;
  return [
    genome.baseElement,
    genome.element,
    genome.entityType,
    genome.enemyClass,
    genome.fusionElement ?? 'pure',
    genome.niche,
    [...genome.mutations].sort().join('+') || 'baseline',
    `fusion-${genome.fusionLevel}`,
  ].join(':');
}

function shuffleIds(ids: string[]): string[] {
  const shuffled = [...ids];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return shuffled;
}

function relevantAbilityIds(enemies: GameState['enemies'], hp: number): string[] {
  const living = enemies.filter((enemy) => enemy.colPos >= -1);
  const relevant = new Set<string>();
  const add = (...ids: string[]) => ids.forEach((id) => {
    if (ABILITY_LOOKUP[id]) relevant.add(id);
  });

  if (living.length >= 4) add('bomb', 'megabomb', 'nuke', 'surge', 'chain', 'pulse', 'blizzard', 'backdash');
  if (living.some((enemy) => enemy.colPos <= 2.35)) {
    add('backdash', 'scramble', 'freeze', 'ghost', 'shield', 'pulse', 'stasisgate', 'returnfire');
  }
  if (living.some((enemy) => (enemy.genome?.fusionLevel ?? 0) > 0)) {
    add('separate', 'hybridtax', 'devolve', 'quarantine');
  }
  if (living.some((enemy) =>
    enemy.genome?.mutations.includes('armored') || enemy.genome?.mutations.includes('resilient'))) {
    add('shattershot', 'acidetch', 'adaptive', 'mutationlock');
  }
  if (living.some((enemy) => {
    const movement = movementClassOf(enemy);
    return movement && AIR_CLASSES.has(movement);
  })) add('time', 'flak', 'sonicnet', 'freeze');
  if (living.some(isCyberEnemy)) add('signaljam', 'circuitarc', 'trafficjam', 'magnet');
  if (hp <= 2) add('heal', 'armor', 'shield', 'ghost', 'regen', 'drain');
  if (relevant.size === 0) add('pierce', 'double', 'time', 'backdash', 'shield');
  return [...relevant];
}

function randomAbilityOptions(
  exclude?: string[],
  enabledIds?: Set<string>,
  cooldowns?: Record<string, number>,
  enemies: GameState['enemies'] = [],
  hp = 5,
  synchronizedIds?: Set<string>,
): string[] {
  const availableAbilities = runtimeAbilityPool();
  const source = enabledIds
    ? availableAbilities.filter((a) => enabledIds.has(a.id))
    : availableAbilities;
  const pool = [...(source.length > 0 ? source : availableAbilities)];
  const categoryIds: Record<AbilityCategory, string[]> = {
    offense: pool.filter((ability) => OFFENSE_ABILITY_IDS.has(ability.id)).map((ability) => ability.id),
    control: pool.filter((ability) => CONTROL_ABILITY_IDS.has(ability.id)).map((ability) => ability.id),
    wildcard: pool.filter((ability) =>
      !OFFENSE_ABILITY_IDS.has(ability.id) && !CONTROL_ABILITY_IDS.has(ability.id)).map((ability) => ability.id),
  };
  const used = new Set<string>();
  const previous = new Set(exclude ?? previousAbilityHand);
  const opts: string[] = [];

  const draw = (category: AbilityCategory) => {
    const eligible = categoryIds[category].length > 0
      ? categoryIds[category]
      : pool.map((ability) => ability.id);
    const eligibleSet = new Set(eligible);
    abilityBags[category] = abilityBags[category]
      .filter((id) => eligibleSet.has(id) && !used.has(id));
    if (abilityBags[category].length === 0) {
      abilityBags[category] = shuffleIds(eligible.filter((id) => !used.has(id)));
    }

    const ready = (id: string) => (cooldowns?.[id] ?? 0) <= 0;
    let index = abilityBags[category].findIndex((id) =>
      !used.has(id) && !previous.has(id) && ready(id));
    if (index < 0) index = abilityBags[category].findIndex((id) => !used.has(id) && ready(id));
    if (index < 0) index = abilityBags[category].findIndex((id) => !used.has(id) && !previous.has(id));
    if (index < 0) index = abilityBags[category].findIndex((id) => !used.has(id));
    if (index >= 0) {
      const [selected] = abilityBags[category].splice(index, 1);
      used.add(selected);
      opts.push(selected);
    }
  };

  draw('offense');
  draw('control');
  draw('wildcard');
  const synchronized = [...(synchronizedIds ?? [])].filter((id) =>
    pool.some((ability) => ability.id === id)
    && !used.has(id)
    && (cooldowns?.[id] ?? 0) <= 0);
  if (synchronized.length > 0 && opts.length > 0) {
    const prioritized = synchronized[Math.floor(Math.random() * synchronized.length)];
    used.delete(opts[opts.length - 1]);
    opts[opts.length - 1] = prioritized;
    used.add(prioritized);
  }
  while (opts.length < Math.min(3, pool.length)) {
    const fallback = pool.find((ability) =>
      !used.has(ability.id) && (cooldowns?.[ability.id] ?? 0) <= 0)
      ?? pool.find((ability) => !used.has(ability.id));
    if (!fallback) break;
    used.add(fallback.id);
    opts.push(fallback.id);
  }

  const relevant = relevantAbilityIds(enemies, hp).filter((id) =>
    pool.some((ability) => ability.id === id) && (cooldowns?.[id] ?? 0) <= 0);
  if (relevant.length > 0 && !opts.some((id) => relevant.includes(id))) {
    const replacement = relevant.find((id) => !used.has(id) && !previous.has(id))
      ?? relevant.find((id) => !used.has(id))
      ?? relevant[0];
    if (replacement) opts[Math.min(2, opts.length - 1)] = replacement;
  }
  previousAbilityHand = [...opts];
  return opts;
}

function makeInitialState(enabledIds?: Set<string>, mode: GameMode = 'classic'): GameState {
  return {
    running: true,
    score: 0,
    integrityWork: 0,
    systemIntegrity: {
      global: 62,
      sector: 58,
      node: 54,
    },
    wave: 1,
    hp: mode === 'vs' ? NPC_HP : 5,
    timer: 0,
    enemySpawnTimer: 0.4,
    directorRecoveryTimer: 0,
    directorCritical: false,
    nextUpgradeWave: 5,
    upgradePromptOpen: false,
    upgradePromptTimer: 0,
    upgradeRetryWave: 0,
    upgradeSelectionOpen: false,
    upgradeOptions: [],
    runUpgrades: {},
    shotsFired: 0,
    enemyFormationId: 0,
    lanePressure: [0, 0, 0],
    ecosystemStats: {
      entitySignatures: [],
      mutationDiscoveries: 0,
      maxGeneration: 0,
      totalFusions: 0,
    },
    recentBaseElements: [],
    recentBodyClasses: [],
    recentElementDomains: [],
    moveFlash: 0,
    slowTimer: 0,
    overclockTimer: 0,
    freezeTimer: 0,
    blizzardTimer: 0,
    doubleTimer: 0,
    multishotTimer: 0,
    regenTimer: 0,
    regenTick: 0,
    drainTimer: 0,
    voltageTimer: 0,
    ghostTimer: 0,
    turretTimer: 0,
    echoTimer: 0,
    overdriveTimer: 0,
    pulseTimer: 0,
    pulseTick: 1.5,
    overloadTimer: 0,
    magnetTimer: 0,
    berserkTimer: 0,
    critTimer: 0,
    signalJamTimer: 0,
    stasisGateTimer: 0,
    adaptiveAmmoTimer: 0,
    cardTimer: 0,
    cardsReady: false,
    cardSelectionOpen: false,
    rotateUsedThisHand: false,
    usedInHand: [],
    player: { col: 1, row: 1, fireCooldown: 0 },
    bullets: [],
    enemies: [],
    particles: [],
    autoBuster: true,
    shieldCharges: 0,
    pierceShots: 0,
    abilityCooldowns: Object.fromEntries(runtimeAbilityPool().map((a) => [a.id, 0])),
    currentCardOptions: randomAbilityOptions(undefined, enabledIds),
    // VS mode
    gameMode: mode,
    npc: { col: 1, row: 1, fireCooldown: 0, moveCooldown: 0, hp: NPC_HP, shieldCharges: 0 },
    npcBullets: [],
    npcEnemies: [],
    playerWon: false,
  };
}

interface HudData {
  hp: number;
  integrityWork: number;
  systemIntegrity: {
    global: number;
    sector: number;
    node: number;
  };
  wave: number;
  autoBuster: boolean;
  shieldCharges: number;
  cardsReady: boolean;
  cardSelectionOpen: boolean;
  rotateUsedThisHand: boolean;
  cardTimer: number;
  cardOptions: string[];
  usedInHand: string[];
  abilityCooldowns: Record<string, number>;
  running: boolean;
  message: string;
  // VS mode
  gameMode: GameMode;
  npcHp: number;
  npcShieldCharges: number;
  playerWon: boolean;
  pressureState: 'steady' | 'critical' | 'recovery';
  upgradePromptOpen: boolean;
  upgradePromptTimer: number;
  upgradeSelectionOpen: boolean;
  upgradeOptions: string[];
  runUpgrades: Record<string, number>;
  ecosystem: { species: number; mutations: number; generation: number; fusions: number };
}

function clampIntegrity(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/**
 * Migrates legacy combat pacing into the ecosystem economy. Existing ability
 * code may still increment score internally, but only this reconciliation
 * creates Integrity Work and repairs the three authoritative visual scopes.
 */
function reconcileIntegrityWork(state: GameState): void {
  const newlyVerified = Math.max(0, state.score - state.integrityWork);
  if (newlyVerified <= 0) return;
  state.integrityWork += newlyVerified;
  const restoration = Math.sqrt(newlyVerified);
  state.systemIntegrity.node = clampIntegrity(state.systemIntegrity.node + restoration * 0.34);
  state.systemIntegrity.sector = clampIntegrity(state.systemIntegrity.sector + restoration * 0.13);
  state.systemIntegrity.global = clampIntegrity(state.systemIntegrity.global + restoration * 0.045);
}

function applyIntegrityBreach(state: GameState, severity = 1): void {
  state.systemIntegrity.node = clampIntegrity(state.systemIntegrity.node - severity * 5);
  state.systemIntegrity.sector = clampIntegrity(state.systemIntegrity.sector - severity * 1.7);
  state.systemIntegrity.global = clampIntegrity(state.systemIntegrity.global - severity * 0.45);
}

type CloneDirection = 'north' | 'south';
type CloneStatus = 'idle' | 'attacking' | 'autofiring' | 'defending' | 'defendingHeld' | 'dispersing' | 'gone';
interface CloneView {
  visible: boolean;
  revealed: boolean;
  inputActive: boolean;
  playerLocked: boolean;
  controlled: CloneDirection;
  turn: 0 | 1;
  statuses: Record<CloneDirection, CloneStatus>;
  rows: Record<CloneDirection, number | null>;
  cols: Record<CloneDirection, number | null>;
}

type RivalSkillId =
  | 'chrono' | 'singularity' | 'override' | 'architect'
  | 'apex' | 'counter' | 'phase' | 'phoenix'
  | 'rift' | 'vector' | 'gridshift' | 'resonance'
  | 'exchange' | 'causality' | 'arsenal'
  | 'assimilation' | 'null' | 'polarity' | 'colossus'
  | 'predator' | 'orbital' | 'hijack' | 'sovereign';
interface RivalSkillView {
  active: boolean;
  id: RivalSkillId | null;
  actionTick: number;
  lastAction: 'activate' | 'primary' | 'alternate' | 'defend' | null;
  mode: number;
  charges: number;
  placements: number[];
  chronoPositions: Array<{ col: number; row: number }>;
  chronoPositionIndex: number;
  expiresAt: number;
  origin: { col: number; row: number; hp: number };
}
const emptyRivalSkillView = (): RivalSkillView => ({
  active: false,
  id: null,
  actionTick: 0,
  lastAction: null,
  mode: 0,
  charges: 0,
  placements: [],
  chronoPositions: [],
  chronoPositionIndex: 0,
  expiresAt: 0,
  origin: { col: 1, row: 1, hp: 5 },
});
const RIVAL_SKILL_LABELS: Record<RivalSkillId, string> = {
  chrono: 'Chrono Break',
  singularity: 'Singularity Engine',
  override: 'Neural Override',
  architect: 'Grid Architect',
  apex: 'Apex Adaptation',
  counter: 'Counter Matrix',
  phase: 'Phase Hunt',
  phoenix: 'Phoenix Circuit',
  rift: 'Rift Circuit',
  vector: 'Vector Dominion',
  gridshift: 'Grid Shift',
  resonance: 'Resonance Array',
  exchange: 'Code Exchange',
  causality: 'Causality Lock',
  arsenal: 'Living Arsenal',
  assimilation: 'Arsenal Assimilation',
  null: 'Null Domain',
  polarity: 'Polarity Crown',
  colossus: 'Aegis Colossus',
  predator: 'Predator Protocol',
  orbital: 'Orbital Command',
  hijack: 'Command Hijack',
  sovereign: 'Last Sovereign',
};
const RIVAL_SKILL_IDS = Object.keys(RIVAL_SKILL_LABELS) as RivalSkillId[];
const REGISTERED_RIVAL_FRAME_FIXES = new Set<RivalSkillId>([
  'override', 'architect', 'apex', 'counter', 'phase', 'vector',
  'gridshift', 'resonance', 'exchange', 'causality', 'arsenal',
  'null', 'polarity', 'colossus', 'predator', 'orbital', 'hijack',
  'sovereign',
]);
type AssemblySkillId = 'shadow' | RivalSkillId;
const RIVAL_SKILL_COMMANDS: Record<RivalSkillId, [string, string, string]> = {
  chrono: ['QUEUE', 'STEP', 'REWIND'],
  singularity: ['COLLAPSE', 'POLARITY', 'GUARD'],
  override: ['NATIVE', 'TRANSFER', 'SACRIFICE'],
  architect: ['CANNON', 'RELAY', 'BARRIER'],
  apex: ['TECHNIQUE', 'FORM', 'ADAPT'],
  counter: ['RETURN', 'REDIRECT', 'CONVERT'],
  phase: ['STRIKE', 'TARGET', 'BREAK'],
  phoenix: ['VENT', 'ANCHOR', 'RESTORE'],
  rift: ['TRAVERSE', 'PORTAL', 'REFLECT'],
  vector: ['REDIRECT', 'ACCELERATE', 'ARREST'],
  gridshift: ['SHIFT', 'OPERATION', 'REVERSE'],
  resonance: ['MARK', 'MOVE MARK', 'ACTIVATE'],
  exchange: ['PROPERTY', 'EXCHANGE', 'REVERSE'],
  causality: ['LOCK', 'EVENT', 'REPEAT'],
  arsenal: ['STRIKE', 'GUARD', 'DRIVE'],
  assimilation: ['HARVEST', 'ASSEMBLE', 'DEPLOY'],
  null: ['SUPPRESS', 'FOCUS', 'ANCHOR'],
  polarity: ['MARK', 'REVERSE', 'COLLIDE'],
  colossus: ['SIEGE', 'TRAMPLE', 'BULWARK'],
  predator: ['HUNT', 'TARGET', 'COUNTER'],
  orbital: ['DESIGNATE', 'ORDNANCE', 'DROP'],
  hijack: ['ORDER', 'COMMAND', 'BREAK'],
  sovereign: ['ASSERT', 'GAMBIT', 'ENDURE'],
};

interface RivalSkillGuide {
  summary: string;
  commands: [string, string, string];
}

const RIVAL_SKILL_GUIDE: Record<RivalSkillId, RivalSkillGuide> = {
  chrono: {
    summary: 'Slow time, record attacks and visited cells, then resolve the plan when the Skill ends.',
    commands: [
      'QUEUE — stores an attack in the current lane; queued attacks fire together when time resumes.',
      'STEP — cycles instantly through cells you visited during Chrono Break.',
      'REWIND — returns to the activation cell and restores the HP recorded at activation.',
    ],
  },
  singularity: {
    summary: 'Deploy a gravity core. Polarity governs what Collapse and Guard do to nearby pressure.',
    commands: [
      'COLLAPSE — attracts enemies into the core, compresses them, and destroys the captured formation.',
      'POLARITY — toggles ATTRACT (pull inward) and REPEL (push outward); it changes subsequent core behavior.',
      'GUARD — captures nearby enemy pressure into the core instead of dealing damage immediately.',
    ],
  },
  override: {
    summary: 'Appropriate an eligible living enemy host and use its constitution as a temporary weapon.',
    commands: [
      'NATIVE — performs the possessed host’s native attack; requires an eligible host.',
      'TRANSFER — moves control to another eligible host; nothing happens when no other host exists.',
      'SACRIFICE — expends the host to intercept pressure, then returns control to Player.',
    ],
  },
  architect: {
    summary: 'Place a three-node battlefield network; the fourth placement executes or replaces the network.',
    commands: [
      'CANNON — places an autonomous lane-firing node.',
      'RELAY — places a linked jump node; paired relays transfer Player between their cells.',
      'BARRIER — places a blocking node that absorbs an enemy advance.',
    ],
  },
  apex: {
    summary: 'Scan the current formation and cycle a counter-form tailored to its strongest constitution.',
    commands: [
      'TECHNIQUE — uses the active form’s offensive countermeasure.',
      'FORM — cycles Breaker (armor), Reflector (projectiles), and Nullifier (special traits).',
      'ADAPT — performs the active form’s defensive response and stabilizes it briefly.',
    ],
  },
  counter: {
    summary: 'Intercept enemy pressure before spending it; an empty matrix cannot Return, Redirect, or Convert.',
    commands: [
      'RETURN — fires captured pressure back at its source.',
      'REDIRECT — cycles the return lane between lanes 1, 2, and 3.',
      'CONVERT — turns captured pressure into protection or recovery.',
    ],
  },
  phase: {
    summary: 'Mark priority prey and perform invulnerable chained strikes against the selected target.',
    commands: [
      'STRIKE — phase-strikes the currently marked target.',
      'TARGET — changes priority target; requires at least one marked enemy.',
      'BREAK — ends the chain safely while retaining unused marks.',
    ],
  },
  phoenix: {
    summary: 'Record a restoration anchor and convert damage accumulated as heat into offense or recovery.',
    commands: [
      'VENT — releases accumulated heat as an attack; retained heat is shown after venting.',
      'ANCHOR — moves the recorded restoration position and state.',
      'RESTORE — returns to the anchor and restores its recorded state.',
    ],
  },
  rift: {
    summary: 'Anchor two linked portals before traversing or reflecting attacks through the circuit.',
    commands: [
      'TRAVERSE — jumps through the linked portal pair; both portals must exist.',
      'PORTAL — anchors Portal 1, then Portal 2; further uses reposition the pair.',
      'REFLECT — arms the rift to return the next compatible incoming attack.',
    ],
  },
  vector: {
    summary: 'Manipulate active trajectories; commands require a projectile or moving target in the lane.',
    commands: [
      'REDIRECT — turns an eligible vector toward a new target.',
      'ACCELERATE — increases the speed and impact of all active trajectories.',
      'ARREST — suspends a vector in place for later release.',
    ],
  },
  gridshift: {
    summary: 'Change board geometry by choosing a row, column, or lock operation and its direction.',
    commands: [
      'SHIFT — executes the selected operation in its forward/right direction.',
      'OPERATION — cycles ROW, COLUMN, and LOCK.',
      'REVERSE — executes the selected operation in its reverse/left direction.',
    ],
  },
  resonance: {
    summary: 'Place three marks; their geometry determines the completed array’s battlefield effect.',
    commands: [
      'MARK — places the next resonance mark (1/3 through 3/3).',
      'MOVE MARK — repositions the most recent mark; place one first.',
      'ACTIVATE — resolves the array only after all three marks exist.',
    ],
  },
  exchange: {
    summary: 'Choose SPEED, ARMOR, or REGENERATION and exchange that property with the selected enemy.',
    commands: [
      'PROPERTY — cycles the property to be exchanged.',
      'EXCHANGE — swaps the selected property between Player and target.',
      'REVERSE — returns the borrowed strength and reapplies the weakness to the target.',
    ],
  },
  causality: {
    summary: 'Choose POSITION, ATTACK, or HEALTH, lock its current event, then reproduce it.',
    commands: [
      'LOCK — records the selected event as the current causal lock.',
      'EVENT — cycles POSITION, ATTACK, and HEALTH.',
      'REPEAT — repeats the recorded event; a lock must exist first.',
    ],
  },
  arsenal: {
    summary: 'A behavior-driven weapon evolves according to whether Player strikes, guards, or drives.',
    commands: [
      'STRIKE — grows the weapon toward a piercing rail-lance.',
      'GUARD — grows the weapon toward a shield-cannon.',
      'DRIVE — grows the weapon toward a propulsion blade.',
    ],
  },
  assimilation: {
    summary: 'Harvest enemy weapon constitutions and assemble them into one temporary hybrid chassis.',
    commands: [
      'HARVEST — captures a component from an eligible enemy.',
      'ASSEMBLE — cycles PIERCE ARRAY, REGEN FRAME, and RAM CANNON builds.',
      'DEPLOY — manifests the selected completed chassis.',
    ],
  },
  null: {
    summary: 'Suppress constitution abilities within a movable field; direct damage is intentionally modest.',
    commands: [
      'SUPPRESS — disables constitutions in the field or reports when none are present.',
      'FOCUS — toggles a narrow stronger field and a wider weaker field.',
      'ANCHOR — fixes the suppression field to the current cell.',
    ],
  },
  polarity: {
    summary: 'Assign opposing charges, reverse them globally, then force opposite targets to collide.',
    commands: [
      'MARK — alternates negative and positive polarity on selected targets.',
      'REVERSE — swaps every assigned polarity.',
      'COLLIDE — pulls oppositely charged targets together.',
    ],
  },
  colossus: {
    summary: 'Pilot a multi-cell combat frame specialized for siege, movement pressure, and broad defense.',
    commands: [
      'SIEGE — anchors and fires the Colossus lane cannon.',
      'TRAMPLE — advances through and displaces smaller enemies.',
      'BULWARK — protects Player and adjacent cells.',
    ],
  },
  predator: {
    summary: 'Study one priority prey through five adaptation stages, then exploit its revealed weakness.',
    commands: [
      'HUNT — advances prey adaptation from 1/5 toward full analysis.',
      'TARGET — changes priority prey and may reset adaptation progress.',
      'COUNTER — executes the learned response to the prey’s attack pattern.',
    ],
  },
  orbital: {
    summary: 'Designate up to five ordered strike locations, choose ordnance, then release the payload.',
    commands: [
      'DESIGNATE — adds the next strike marker (1/5 through 5/5).',
      'ORDNANCE — cycles EMP, SUPPLY, and PRECISION payloads.',
      'DROP — executes all designated orbital actions in order.',
    ],
  },
  hijack: {
    summary: 'Broadcast formation-level orders rather than possessing an individual enemy.',
    commands: [
      'ORDER — repeats the current broadcast.',
      'COMMAND — cycles HOLD, BREAK FORMATION, and RETREAT.',
      'BREAK — severs hostile formation command and returns units to independent behavior.',
    ],
  },
  sovereign: {
    summary: 'Convert low health and lost space into authority; greater risk produces a stronger release.',
    commands: [
      'ASSERT — releases accumulated authority as power.',
      'GAMBIT — wagers vitality to increase authority.',
      'ENDURE — preserves the scarcity state and converts it into defense.',
    ],
  },
};

function SkillGuidePanel({ id }: { id: RivalSkillId }) {
  const guide = RIVAL_SKILL_GUIDE[id];
  return (
    <section className="skillGuidePanel" aria-label={`${RIVAL_SKILL_LABELS[id]} guide`}>
      <header>
        <strong>{RIVAL_SKILL_LABELS[id]} — How to use</strong>
        <span>V / L2 activates · X, Y, B execute commands</span>
      </header>
      <p>{guide.summary}</p>
      <div className="skillGuideCommands">
        {guide.commands.map((command, index) => (
          <div key={command}>
            <kbd>{(['X', 'Y', 'B'] as const)[index]}</kbd>
            <span>{command}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

const SIGNATURE_SKILL_COLORS: Record<RivalSkillId, [string, string]> = {
  chrono: ['#93c5fd', '#e9d5ff'], singularity: ['#a78bfa', '#111827'],
  override: ['#c084fc', '#22d3ee'], architect: ['#60a5fa', '#f8fafc'],
  apex: ['#84cc16', '#f0abfc'], counter: ['#f0abfc', '#f8fafc'],
  phase: ['#818cf8', '#e9d5ff'], phoenix: ['#fb923c', '#fde047'],
  rift: ['#22d3ee', '#8b5cf6'], vector: ['#5eead4', '#f8fafc'],
  gridshift: ['#38bdf8', '#a7f3d0'], resonance: ['#f0abfc', '#67e8f9'],
  exchange: ['#4ade80', '#f472b6'], causality: ['#c4b5fd', '#f8fafc'],
  arsenal: ['#f59e0b', '#f8fafc'], assimilation: ['#34d399', '#fb923c'],
  null: ['#6366f1', '#030712'], polarity: ['#38bdf8', '#fb7185'],
  colossus: ['#fbbf24', '#94a3b8'], predator: ['#fb7185', '#f8fafc'],
  orbital: ['#fde047', '#60a5fa'], hijack: ['#c084fc', '#2dd4bf'],
  sovereign: ['#f43f5e', '#fde047'],
};

type SkillExecutionMotif =
  | 'time' | 'gravity' | 'command' | 'construct' | 'morph' | 'reflect'
  | 'dash' | 'restore' | 'portal' | 'vector' | 'grid' | 'resonance'
  | 'exchange' | 'lock' | 'weapon' | 'harvest' | 'suppress' | 'polarity'
  | 'colossus' | 'target' | 'orbital' | 'sovereign';

const SKILL_EXECUTION_MOTIFS: Record<RivalSkillId, [SkillExecutionMotif, SkillExecutionMotif, SkillExecutionMotif]> = {
  chrono: ['time', 'portal', 'restore'],
  singularity: ['gravity', 'polarity', 'reflect'],
  override: ['command', 'portal', 'harvest'],
  architect: ['construct', 'portal', 'reflect'],
  apex: ['morph', 'morph', 'morph'],
  counter: ['reflect', 'vector', 'restore'],
  phase: ['dash', 'target', 'restore'],
  phoenix: ['weapon', 'construct', 'restore'],
  rift: ['portal', 'construct', 'reflect'],
  vector: ['vector', 'vector', 'lock'],
  gridshift: ['grid', 'grid', 'grid'],
  resonance: ['resonance', 'resonance', 'resonance'],
  exchange: ['target', 'exchange', 'exchange'],
  causality: ['lock', 'target', 'time'],
  arsenal: ['weapon', 'reflect', 'dash'],
  assimilation: ['harvest', 'morph', 'weapon'],
  null: ['suppress', 'target', 'construct'],
  polarity: ['polarity', 'polarity', 'gravity'],
  colossus: ['weapon', 'dash', 'colossus'],
  predator: ['dash', 'target', 'reflect'],
  orbital: ['target', 'morph', 'orbital'],
  hijack: ['command', 'target', 'suppress'],
  sovereign: ['sovereign', 'exchange', 'restore'],
};

const SKILL_VFX_SEQUENCE: Record<SkillExecutionMotif, { sheet: 'a' | 'b' | 'c'; row: number }> = {
  time: { sheet: 'a', row: 0 },
  gravity: { sheet: 'a', row: 1 },
  command: { sheet: 'c', row: 1 },
  construct: { sheet: 'c', row: 3 },
  grid: { sheet: 'a', row: 3 },
  resonance: { sheet: 'a', row: 3 },
  orbital: { sheet: 'a', row: 3 },
  morph: { sheet: 'c', row: 3 },
  harvest: { sheet: 'b', row: 0 },
  suppress: { sheet: 'b', row: 0 },
  colossus: { sheet: 'c', row: 3 },
  sovereign: { sheet: 'c', row: 3 },
  reflect: { sheet: 'c', row: 2 },
  lock: { sheet: 'c', row: 1 },
  polarity: { sheet: 'b', row: 1 },
  dash: { sheet: 'b', row: 2 },
  weapon: { sheet: 'c', row: 0 },
  portal: { sheet: 'b', row: 2 },
  target: { sheet: 'b', row: 2 },
  vector: { sheet: 'b', row: 2 },
  exchange: { sheet: 'c', row: 1 },
  restore: { sheet: 'c', row: 2 },
};

// The signature sheets are authored, textured animations. Earlier revisions
// also painted generic circles, arrows, boxes and polygon sigils over them.
// That diagnostic-style layer made every discipline look like the same basic
// geometry, so it is deliberately disabled in the shipped presentation.
const SHOW_PRIMITIVE_SKILL_DIAGRAMS = false;

function SignatureSkillFx({
  id,
  stateRef,
  actionTick,
  lastAction,
}: {
  id: RivalSkillId;
  stateRef: MutableRefObject<GameState>;
  actionTick: number;
  lastAction: RivalSkillView['lastAction'];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sequenceRefs = useRef<{
    a: HTMLImageElement | null;
    b: HTMLImageElement | null;
    c: HTMLImageElement | null;
  }>({
    a: null,
    b: null,
    c: null,
  });
  const executionRef = useRef({ tick: actionTick, action: lastAction, startedAt: performance.now() });

  useEffect(() => {
    const sequenceA = new Image();
    const sequenceB = new Image();
    const sequenceC = new Image();
    sequenceA.src = `${import.meta.env.BASE_URL}effects/signature-skill-sequences-a.png?alpha=v2`;
    sequenceB.src = `${import.meta.env.BASE_URL}effects/signature-skill-sequences-b.png?alpha=v2`;
    sequenceC.src = `${import.meta.env.BASE_URL}effects/signature-skill-sequences-c-transparent.png?alpha=v2`;
    sequenceRefs.current = { a: sequenceA, b: sequenceB, c: sequenceC };
    return () => {
      sequenceRefs.current = { a: null, b: null, c: null };
    };
  }, []);

  useEffect(() => {
    executionRef.current = { tick: actionTick, action: lastAction, startedAt: performance.now() };
  }, [actionTick, lastAction]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const startedAt = performance.now();
    let frame = 0;

    const render = (now: number) => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const state = stateRef.current;
      const board = getBoardMetrics(width, height);
      const center = (col: number, row: number) => ({
        x: board.x + (col + 0.5) * board.cell,
        y: board.y + (row + 0.5) * board.cell,
      });
      const player = center(state.player.col, state.player.row);
      const enemies = state.enemies.map((enemy) => center(enemy.colPos, enemy.row));
      const [primary, accent] = SIGNATURE_SKILL_COLORS[id];
      const t = (now - startedAt) / 1000;
      const pulse = (Math.sin(t * 6) + 1) * 0.5;
      const intro = Math.min(1, (now - startedAt) / 420);
      const execution = executionRef.current;
      const executionAge = (now - execution.startedAt) / 1000;
      const executionProgress = Math.min(1, executionAge / 1.05);
      const executing = execution.action !== null && executionAge < 1.05;

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const ring = (x: number, y: number, radius: number, color = primary, alpha = 0.72) => {
        ctx.globalAlpha = alpha * intro;
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1.5, board.cell * 0.035);
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.stroke();
      };
      const line = (a: { x: number; y: number }, b: { x: number; y: number }, color = primary, alpha = 0.6) => {
        ctx.globalAlpha = alpha * intro;
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1.5, board.cell * 0.03);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      };
      const node = (x: number, y: number, color = accent, radius = board.cell * 0.07) => {
        ctx.globalAlpha = 0.85 * intro;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      };
      const arrow = (a: { x: number; y: number }, b: { x: number; y: number }, color = primary) => {
        line(a, b, color, 0.65);
        const angle = Math.atan2(b.y - a.y, b.x - a.x);
        ctx.globalAlpha = 0.75 * intro;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - board.cell * 0.12 * Math.cos(angle - 0.55), b.y - board.cell * 0.12 * Math.sin(angle - 0.55));
        ctx.lineTo(b.x - board.cell * 0.12 * Math.cos(angle + 0.55), b.y - board.cell * 0.12 * Math.sin(angle + 0.55));
        ctx.closePath();
        ctx.fill();
      };
      const reticle = (p: { x: number; y: number }, color = primary) => {
        const r = board.cell * (0.22 + pulse * 0.04);
        ring(p.x, p.y, r, color, 0.8);
        for (let i = 0; i < 4; i++) {
          const a = i * Math.PI / 2;
          line(
            { x: p.x + Math.cos(a) * r * 0.72, y: p.y + Math.sin(a) * r * 0.72 },
            { x: p.x + Math.cos(a) * r * 1.35, y: p.y + Math.sin(a) * r * 1.35 },
            color,
            0.8,
          );
        }
      };

      // A command first reads as a physical performance by the character, then
      // blooms into the persistent battlefield diagram below. Primary commands
      // project outward, alternate commands reconfigure, and defensive commands
      // visibly brace and close around the user.
      if (executing) {
        const easeOut = 1 - Math.pow(1 - executionProgress, 3);
        const fade = Math.sin(executionProgress * Math.PI);
        const target = enemies[0] ?? center(4, state.player.row);
        const actionIndex = execution.action === 'primary' ? 0 : execution.action === 'alternate' ? 1 : 2;
        const motif = execution.action === 'activate' ? null : SKILL_EXECUTION_MOTIFS[id][actionIndex];
        ctx.save();
        ctx.globalAlpha = Math.max(0, fade) * 0.92;
        ctx.shadowBlur = board.cell * 0.18;
        ctx.shadowColor = execution.action === 'defend' ? accent : primary;

        if (SHOW_PRIMITIVE_SKILL_DIAGRAMS && execution.action === 'activate') {
          const rise = board.cell * (0.42 - easeOut * 0.42);
          // Energy gathers at the feet, climbs through the body, and opens as
          // the discipline's colored sigil before its board effect appears.
          for (let echo = 0; echo < 4; echo++) {
            const y = player.y + rise + echo * board.cell * 0.08;
            ring(player.x, y, board.cell * (0.09 + echo * 0.045 + easeOut * 0.04), echo % 2 ? accent : primary, 0.68 - echo * 0.09);
          }
          ctx.strokeStyle = primary;
          ctx.lineWidth = board.cell * 0.045;
          ctx.beginPath();
          for (let point = 0; point <= 8; point++) {
            const angle = point / 8 * Math.PI * 2 - Math.PI / 2;
            const radius = board.cell * (point % 2 ? 0.25 : 0.37) * easeOut;
            const x = player.x + Math.cos(angle) * radius;
            const y = player.y + Math.sin(angle) * radius;
            if (point === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
        } else if (SHOW_PRIMITIVE_SKILL_DIAGRAMS && execution.action === 'primary') {
          const dx = target.x - player.x;
          const dy = target.y - player.y;
          const length = Math.max(1, Math.hypot(dx, dy));
          const ux = dx / length;
          const uy = dy / length;
          // Three coherent afterimages show the character committing its weight
          // toward the technique rather than leaving a detached ambient flash.
          for (let echo = 0; echo < 3; echo++) {
            const travel = board.cell * easeOut * (0.16 + echo * 0.11);
            ring(
              player.x + ux * travel,
              player.y + uy * travel,
              board.cell * (0.17 - echo * 0.025),
              echo === 2 ? accent : primary,
              0.55 - echo * 0.1,
            );
          }
          const reach = {
            x: player.x + dx * Math.min(1, easeOut * 1.18),
            y: player.y + dy * Math.min(1, easeOut * 1.18),
          };
          if (id === 'singularity' || id === 'null' || id === 'polarity') {
            for (let wave = 0; wave < 3; wave++) {
              ring(player.x, player.y, board.cell * (0.2 + easeOut * (0.22 + wave * 0.16)), wave % 2 ? accent : primary, 0.6 - wave * 0.12);
            }
          } else if (id === 'phase' || id === 'predator' || id === 'colossus' || id === 'arsenal') {
            line(
              { x: reach.x - uy * board.cell * 0.16, y: reach.y + ux * board.cell * 0.16 },
              { x: reach.x + uy * board.cell * 0.16, y: reach.y - ux * board.cell * 0.16 },
              accent,
              0.8,
            );
          } else {
            ring(reach.x, reach.y, board.cell * (0.08 + easeOut * 0.18), accent, 0.75);
          }
        } else if (SHOW_PRIMITIVE_SKILL_DIAGRAMS && execution.action === 'alternate') {
          for (let arc = 0; arc < 3; arc++) {
            ctx.strokeStyle = arc % 2 ? accent : primary;
            ctx.lineWidth = board.cell * (0.025 + arc * 0.012);
            ctx.beginPath();
            ctx.arc(
              player.x,
              player.y,
              board.cell * (0.22 + arc * 0.1),
              -Math.PI * 0.8 + easeOut * Math.PI * 1.6,
              Math.PI * 0.8 + easeOut * Math.PI * 1.6,
            );
            ctx.stroke();
          }
          if (id === 'rift') {
            ring(player.x - board.cell * 0.42, player.y, board.cell * 0.18, primary, 0.8);
            ring(player.x + board.cell * 0.42, player.y, board.cell * 0.18, accent, 0.8);
            arrow(
              { x: player.x - board.cell * 0.25, y: player.y },
              { x: player.x + board.cell * 0.25, y: player.y },
              '#f8fafc',
            );
          } else if (id === 'gridshift' || id === 'architect' || id === 'resonance') {
            arrow(
              { x: board.x + board.cell * 0.25, y: player.y },
              { x: board.x + board.boardW - board.cell * 0.25, y: player.y },
              accent,
            );
          }
        } else if (SHOW_PRIMITIVE_SKILL_DIAGRAMS) {
          const close = 1 - easeOut;
          ctx.fillStyle = primary;
          ctx.globalAlpha = 0.09 + fade * 0.18;
          ctx.beginPath();
          ctx.arc(player.x, player.y, board.cell * (0.48 - close * 0.2), Math.PI, 0);
          ctx.lineTo(player.x + board.cell * 0.3, player.y + board.cell * 0.3);
          ctx.lineTo(player.x - board.cell * 0.3, player.y + board.cell * 0.3);
          ctx.closePath();
          ctx.fill();
          for (let brace = 0; brace < 3; brace++) {
            ring(player.x, player.y, board.cell * (0.18 + brace * 0.1 - close * 0.06), brace === 1 ? accent : primary, 0.72 - brace * 0.12);
          }
        }

        const sequenceMotif = motif ?? SKILL_EXECUTION_MOTIFS[id][0];
        const sequence = SKILL_VFX_SEQUENCE[sequenceMotif];
        const sheet = sequenceRefs.current[sequence.sheet];
        if (sheet?.complete && sheet.naturalWidth > 0) {
          const sequenceFrame = Math.min(3, Math.floor(executionProgress * 4));
          const sourceWidth = sheet.naturalWidth / 4;
          const sourceHeight = sheet.naturalHeight / 4;
          const vfxTarget = motif === 'gravity' || motif === 'reflect' || motif === 'target' || motif === 'orbital'
            ? target
            : motif === 'dash' || motif === 'weapon'
              ? {
                  x: player.x + (target.x - player.x) * Math.min(0.72, easeOut),
                  y: player.y + (target.y - player.y) * Math.min(0.72, easeOut),
                }
              : player;
          const baseSize = board.cell * (motif === 'grid' || motif === 'construct' || motif === 'orbital' ? 1.55 : 1.18);
          const revealScale = 0.55 + easeOut * 0.55;
          const drawWidth = baseSize * revealScale;
          const drawHeight = drawWidth * (sourceHeight / sourceWidth);
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = Math.min(0.96, fade * 1.35);
          ctx.imageSmoothingEnabled = false;
          ctx.translate(vfxTarget.x, vfxTarget.y);
          if (motif === 'time') ctx.rotate(-easeOut * Math.PI * 0.28);
          if (motif === 'reflect') ctx.scale(execution.action === 'primary' ? -1 : 1, 1);
          ctx.drawImage(
            sheet,
            sequenceFrame * sourceWidth,
            sequence.row * sourceHeight,
            sourceWidth,
            sourceHeight,
            -drawWidth / 2,
            -drawHeight / 2,
            drawWidth,
            drawHeight,
          );
          ctx.restore();
        }

        // The command's constitution is drawn over the body motion. This is
        // deliberately semantic: Restore flows back into the user, Sacrifice
        // collapses a host, Drop descends from orbit, Rewind reverses a clock,
        // and so on, rather than every B command looking like the same shield.
        if (SHOW_PRIMITIVE_SKILL_DIAGRAMS && motif === 'time') {
          ctx.strokeStyle = accent;
          ctx.lineWidth = board.cell * 0.045;
          ctx.beginPath();
          ctx.arc(player.x, player.y, board.cell * 0.38, Math.PI * 0.2, Math.PI * (1.85 - easeOut * 1.45), true);
          ctx.stroke();
          arrow(
            { x: player.x + board.cell * 0.29, y: player.y - board.cell * 0.12 },
            { x: player.x + board.cell * 0.2, y: player.y - board.cell * 0.28 },
            accent,
          );
        } else if (SHOW_PRIMITIVE_SKILL_DIAGRAMS && motif === 'gravity') {
          const core = { x: (player.x + target.x) / 2, y: (player.y + target.y) / 2 };
          enemies.slice(0, 4).forEach((enemy) => arrow(enemy, core, primary));
          ring(core.x, core.y, board.cell * (0.08 + easeOut * 0.16), accent, 0.88);
        } else if (SHOW_PRIMITIVE_SKILL_DIAGRAMS && motif === 'command') {
          enemies.slice(0, 4).forEach((enemy, index) => {
            node(enemy.x, enemy.y, accent, board.cell * 0.045);
            ring(enemy.x, enemy.y, board.cell * (0.1 + easeOut * 0.08), index % 2 ? accent : primary, 0.65);
          });
        } else if (SHOW_PRIMITIVE_SKILL_DIAGRAMS && motif === 'construct') {
          const cellX = board.x + Math.round((player.x - board.x) / board.cell) * board.cell;
          const cellY = board.y + state.player.row * board.cell;
          ctx.strokeStyle = primary;
          ctx.lineWidth = board.cell * 0.05;
          ctx.strokeRect(
            cellX + board.cell * (0.5 - easeOut * 0.44),
            cellY + board.cell * (0.5 - easeOut * 0.44),
            board.cell * easeOut * 0.88,
            board.cell * easeOut * 0.88,
          );
          node(cellX + board.cell * 0.5, cellY + board.cell * 0.5, accent, board.cell * 0.08 * easeOut);
        } else if (SHOW_PRIMITIVE_SKILL_DIAGRAMS && motif === 'morph') {
          for (let layer = 0; layer < 3; layer++) {
            ctx.strokeStyle = layer % 2 ? accent : primary;
            ctx.lineWidth = board.cell * 0.035;
            ctx.beginPath();
            for (let point = 0; point <= 6; point++) {
              const angle = point / 6 * Math.PI * 2 + t * (layer % 2 ? -1 : 1);
              const radius = board.cell * (0.2 + layer * 0.09) * easeOut;
              const x = player.x + Math.cos(angle) * radius;
              const y = player.y + Math.sin(angle) * radius;
              if (point === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();
          }
        } else if (SHOW_PRIMITIVE_SKILL_DIAGRAMS && motif === 'reflect') {
          const impact = {
            x: player.x + (target.x - player.x) * 0.42,
            y: player.y + (target.y - player.y) * 0.42,
          };
          arrow(target, impact, accent);
          arrow(impact, target, primary);
          ring(impact.x, impact.y, board.cell * (0.1 + easeOut * 0.14), '#f8fafc', 0.88);
        } else if (SHOW_PRIMITIVE_SKILL_DIAGRAMS && motif === 'dash') {
          const strike = {
            x: player.x + (target.x - player.x) * easeOut,
            y: player.y + (target.y - player.y) * easeOut,
          };
          line(
            { x: strike.x - board.cell * 0.16, y: strike.y - board.cell * 0.2 },
            { x: strike.x + board.cell * 0.16, y: strike.y + board.cell * 0.2 },
            accent,
            0.9,
          );
        } else if (SHOW_PRIMITIVE_SKILL_DIAGRAMS && motif === 'restore') {
          for (let particle = 0; particle < 7; particle++) {
            const angle = particle / 7 * Math.PI * 2;
            const radius = board.cell * (0.46 * (1 - easeOut));
            node(
              player.x + Math.cos(angle) * radius,
              player.y + Math.sin(angle) * radius,
              particle % 2 ? accent : primary,
              board.cell * 0.035,
            );
          }
          ring(player.x, player.y, board.cell * (0.15 + easeOut * 0.17), accent, 0.85);
        } else if (SHOW_PRIMITIVE_SKILL_DIAGRAMS && motif === 'portal') {
          const destination = center(state.player.col, (state.player.row + 1) % 3);
          ring(player.x, player.y, board.cell * (0.12 + easeOut * 0.16), primary, 0.9);
          ring(destination.x, destination.y, board.cell * (0.12 + easeOut * 0.16), accent, 0.9);
          arrow(player, destination, '#f8fafc');
        } else if (SHOW_PRIMITIVE_SKILL_DIAGRAMS && motif === 'vector') {
          enemies.slice(0, 5).forEach((enemy, index) => arrow(
            enemy,
            { x: enemy.x + board.cell * (index % 2 ? -0.48 : 0.48) * easeOut, y: enemy.y },
            index % 2 ? accent : primary,
          ));
        } else if (SHOW_PRIMITIVE_SKILL_DIAGRAMS && motif === 'grid') {
          const rowY = board.y + (state.player.row + 0.5) * board.cell;
          ctx.strokeStyle = primary;
          ctx.lineWidth = board.cell * 0.045;
          ctx.strokeRect(board.x + board.cell * 0.04, rowY - board.cell * 0.42, board.boardW - board.cell * 0.08, board.cell * 0.84);
          arrow(
            { x: board.x + board.cell * 0.3, y: rowY },
            { x: board.x + board.boardW - board.cell * 0.3, y: rowY },
            accent,
          );
        } else if (SHOW_PRIMITIVE_SKILL_DIAGRAMS && motif === 'resonance') {
          const marks = [center(0, 0), center(2, 1), center(1, 2)];
          marks.forEach((mark, index) => {
            line(mark, marks[(index + 1) % marks.length], index % 2 ? accent : primary, 0.85);
            node(mark.x, mark.y, index % 2 ? accent : primary, board.cell * 0.07 * easeOut);
          });
        } else if (SHOW_PRIMITIVE_SKILL_DIAGRAMS && motif === 'exchange') {
          ring(player.x, player.y, board.cell * (0.12 + easeOut * 0.08), primary, 0.72);
          ring(target.x, target.y, board.cell * (0.12 + easeOut * 0.08), accent, 0.72);
          node((player.x + target.x) / 2, (player.y + target.y) / 2, '#f8fafc', board.cell * 0.055);
        } else if (SHOW_PRIMITIVE_SKILL_DIAGRAMS && motif === 'lock') {
          ring(target.x, target.y, board.cell * (0.18 + easeOut * 0.08), primary, 0.88);
          ctx.strokeStyle = accent;
          ctx.lineWidth = board.cell * 0.06;
          ctx.strokeRect(target.x - board.cell * 0.12, target.y - board.cell * 0.03, board.cell * 0.24, board.cell * 0.2);
          ctx.beginPath();
          ctx.arc(target.x, target.y - board.cell * 0.03, board.cell * 0.1, Math.PI, 0);
          ctx.stroke();
        } else if (SHOW_PRIMITIVE_SKILL_DIAGRAMS && motif === 'weapon') {
          const tip = { x: player.x + board.cell * (0.28 + easeOut * 0.38), y: player.y - board.cell * 0.08 };
          ctx.lineWidth = board.cell * 0.1;
          line(player, tip, primary, 0.9);
          ring(tip.x, tip.y, board.cell * (0.06 + easeOut * 0.1), accent, 0.85);
        } else if (SHOW_PRIMITIVE_SKILL_DIAGRAMS && motif === 'harvest') {
          enemies.slice(0, 3).forEach((enemy, index) => {
            const progress = (easeOut + index * 0.13) % 1;
            const part = {
              x: enemy.x + (player.x - enemy.x) * progress,
              y: enemy.y + (player.y - enemy.y) * progress,
            };
            node(part.x, part.y, index % 2 ? accent : primary, board.cell * 0.045);
          });
        } else if (SHOW_PRIMITIVE_SKILL_DIAGRAMS && motif === 'suppress') {
          enemies.slice(0, 5).forEach((enemy) => {
            ring(enemy.x, enemy.y, board.cell * (0.14 + easeOut * 0.07), primary, 0.72);
            line(
              { x: enemy.x - board.cell * 0.11, y: enemy.y - board.cell * 0.11 },
              { x: enemy.x + board.cell * 0.11, y: enemy.y + board.cell * 0.11 },
              accent,
              0.9,
            );
          });
        } else if (SHOW_PRIMITIVE_SKILL_DIAGRAMS && motif === 'polarity') {
          enemies.slice(0, 4).forEach((enemy, index) => {
            ring(enemy.x, enemy.y, board.cell * 0.18, index % 2 ? accent : primary, 0.8);
          });
        } else if (SHOW_PRIMITIVE_SKILL_DIAGRAMS && motif === 'colossus') {
          ctx.strokeStyle = primary;
          ctx.lineWidth = board.cell * 0.065;
          ctx.strokeRect(player.x - board.cell * 0.38, player.y - board.cell * 0.58, board.cell * 0.76, board.cell * 1.12);
          ctx.fillStyle = accent;
          ctx.globalAlpha = 0.22 + fade * 0.2;
          ctx.fillRect(player.x - board.cell * 0.7, player.y - board.cell * 0.25, board.cell * 1.4, board.cell * 0.62);
        } else if (SHOW_PRIMITIVE_SKILL_DIAGRAMS && motif === 'target') {
          reticle(target, accent);
        } else if (SHOW_PRIMITIVE_SKILL_DIAGRAMS && motif === 'orbital') {
          reticle(target, primary);
          const sky = { x: target.x, y: board.y - board.cell * 0.5 };
          ctx.lineWidth = board.cell * (0.05 + easeOut * 0.12);
          line(sky, target, accent, 0.92);
          ring(target.x, target.y, board.cell * easeOut * 0.3, primary, 0.82);
        } else if (SHOW_PRIMITIVE_SKILL_DIAGRAMS && motif === 'sovereign') {
          for (let ray = 0; ray < 7; ray++) {
            const angle = -Math.PI + ray / 6 * Math.PI;
            line(
              { x: player.x + Math.cos(angle) * board.cell * 0.2, y: player.y + Math.sin(angle) * board.cell * 0.2 },
              { x: player.x + Math.cos(angle) * board.cell * (0.32 + easeOut * 0.2), y: player.y + Math.sin(angle) * board.cell * (0.32 + easeOut * 0.2) },
              ray % 2 ? accent : primary,
              0.86,
            );
          }
        }

        ctx.shadowBlur = 0;
        ctx.globalAlpha = Math.max(0, fade) * 0.95;
        ctx.fillStyle = '#f8fafc';
        ctx.font = `800 ${Math.max(10, board.cell * 0.13)}px system-ui`;
        ctx.textAlign = 'center';
        const commandIndex = execution.action === 'primary' ? 0 : execution.action === 'alternate' ? 1 : 2;
        ctx.fillText(
          execution.action === 'activate' ? RIVAL_SKILL_LABELS[id] : RIVAL_SKILL_COMMANDS[id][commandIndex],
          player.x,
          player.y - board.cell * (0.5 + easeOut * 0.13),
        );
        ctx.restore();
      }

      if (!SHOW_PRIMITIVE_SKILL_DIAGRAMS) {
        // The authored execution sequence above is the complete visible VFX.
      } else if (id === 'chrono' || id === 'causality') {
        ring(player.x, player.y, board.cell * (0.35 + pulse * 0.06));
        ctx.globalAlpha = 0.75 * intro;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(player.x, player.y);
        ctx.lineTo(player.x + Math.cos(t * 2.4) * board.cell * 0.24, player.y + Math.sin(t * 2.4) * board.cell * 0.24);
        ctx.moveTo(player.x, player.y);
        ctx.lineTo(player.x + Math.cos(-t * 0.8) * board.cell * 0.17, player.y + Math.sin(-t * 0.8) * board.cell * 0.17);
        ctx.stroke();
        enemies.forEach((enemy) => ring(enemy.x, enemy.y, board.cell * 0.16, primary, 0.32));
      } else if (id === 'singularity') {
        const core = { x: board.x + board.boardW * 0.5, y: board.y + board.boardH * 0.5 };
        for (let i = 0; i < 3; i++) ring(core.x, core.y, board.cell * (0.14 + i * 0.13 + pulse * 0.035), i === 1 ? accent : primary, 0.5);
        enemies.forEach((enemy) => arrow(enemy, core, primary));
      } else if (id === 'rift') {
        const a = center(0, state.player.row);
        const b = center(5, 2 - state.player.row);
        ring(a.x, a.y, board.cell * (0.22 + pulse * 0.05), primary, 0.85);
        ring(b.x, b.y, board.cell * (0.22 + (1 - pulse) * 0.05), accent, 0.85);
        line(a, b, '#e9d5ff', 0.3);
      } else if (id === 'architect' || id === 'gridshift') {
        for (let row = 0; row < 3; row++) {
          const offset = id === 'gridshift' ? Math.sin(t * 3 + row) * board.cell * 0.08 : 0;
          ctx.globalAlpha = (row === Math.floor(t) % 3 ? 0.72 : 0.26) * intro;
          ctx.strokeStyle = row % 2 ? accent : primary;
          ctx.lineWidth = 2;
          ctx.strokeRect(board.x + offset + 3, board.y + row * board.cell + 3, board.boardW - 6, board.cell - 6);
          if (id === 'gridshift') arrow(
            { x: board.x + board.cell * 0.3, y: board.y + (row + 0.5) * board.cell },
            { x: board.x + board.cell * 0.65, y: board.y + (row + 0.5) * board.cell },
            row % 2 ? accent : primary,
          );
        }
      } else if (id === 'resonance') {
        const points = [center(0, 0), center(2, 1), center(1, 2)];
        points.forEach((point, index) => {
          line(point, points[(index + 1) % points.length], index === 1 ? accent : primary, 0.72);
          node(point.x, point.y, index === 1 ? accent : primary, board.cell * (0.08 + pulse * 0.025));
        });
      } else if (id === 'override' || id === 'hijack') {
        enemies.forEach((enemy, index) => {
          node(enemy.x, enemy.y, index % 2 ? primary : accent, board.cell * 0.045);
          ring(enemy.x, enemy.y, board.cell * (0.12 + pulse * 0.06), index % 2 ? primary : accent, 0.55);
        });
      } else if (id === 'exchange' || id === 'assimilation') {
        enemies.slice(0, 4).forEach((enemy, index) => arrow(
          index % 2 && id === 'exchange' ? player : enemy,
          index % 2 && id === 'exchange' ? enemy : player,
          index % 2 ? accent : primary,
        ));
        ring(player.x, player.y, board.cell * (0.2 + pulse * 0.08), accent, 0.72);
      } else if (id === 'vector' || id === 'polarity') {
        enemies.forEach((enemy, index) => {
          if (id === 'vector') arrow(enemy, { x: enemy.x - board.cell * 0.42, y: enemy.y }, index % 2 ? accent : primary);
          else {
            ring(enemy.x, enemy.y, board.cell * 0.18, index % 2 ? accent : primary, 0.6);
            ctx.globalAlpha = 0.85;
            ctx.fillStyle = index % 2 ? accent : primary;
            ctx.font = `700 ${Math.max(12, board.cell * 0.22)}px system-ui`;
            ctx.textAlign = 'center';
            ctx.fillText(index % 2 ? '−' : '+', enemy.x, enemy.y + board.cell * 0.07);
          }
        });
      } else if (id === 'counter') {
        ctx.globalAlpha = 0.7 * intro;
        ctx.strokeStyle = primary;
        ctx.lineWidth = board.cell * 0.055;
        ctx.beginPath();
        ctx.arc(player.x, player.y, board.cell * 0.34, -Math.PI * 0.72, Math.PI * 0.72);
        ctx.stroke();
      } else if (id === 'phase' || id === 'predator') {
        ctx.setLineDash([board.cell * 0.08, board.cell * 0.07]);
        enemies.slice(0, 4).forEach((enemy, index) => {
          reticle(enemy, index === 0 ? accent : primary);
          line(index === 0 ? player : enemies[index - 1], enemy, primary, 0.42);
        });
        ctx.setLineDash([]);
      } else if (id === 'phoenix' || id === 'sovereign') {
        for (let i = 0; i < 7; i++) {
          const angle = (i / 7) * Math.PI * 2 + t * 0.35;
          const inner = board.cell * 0.2;
          const outer = board.cell * (0.38 + pulse * 0.08);
          line(
            { x: player.x + Math.cos(angle) * inner, y: player.y + Math.sin(angle) * inner },
            { x: player.x + Math.cos(angle) * outer, y: player.y + Math.sin(angle) * outer },
            i % 2 ? accent : primary,
            0.72,
          );
        }
        ring(player.x, player.y, board.cell * 0.23, primary, 0.65);
      } else if (id === 'null') {
        ctx.globalAlpha = 0.22 * intro;
        ctx.fillStyle = primary;
        ctx.fillRect(board.x, board.y, board.boardW, board.boardH);
        enemies.forEach((enemy) => {
          ring(enemy.x, enemy.y, board.cell * 0.17, '#818cf8', 0.5);
          line({ x: enemy.x - board.cell * 0.11, y: enemy.y - board.cell * 0.11 }, { x: enemy.x + board.cell * 0.11, y: enemy.y + board.cell * 0.11 }, '#f8fafc', 0.55);
        });
      } else if (id === 'orbital') {
        enemies.slice(0, 4).forEach((enemy, index) => {
          reticle(enemy, index % 2 ? accent : primary);
          const top = { x: enemy.x, y: board.y - board.cell * (0.25 + pulse * 0.15) };
          line(top, enemy, index % 2 ? accent : primary, 0.45);
        });
      } else if (id === 'colossus') {
        const w = board.cell * 0.78;
        const h = board.cell * 1.45;
        ctx.globalAlpha = 0.55 * intro;
        ctx.strokeStyle = primary;
        ctx.lineWidth = board.cell * 0.045;
        ctx.strokeRect(player.x - w / 2, player.y - h / 2, w, h);
        ring(player.x, player.y - h * 0.28, board.cell * 0.2, accent, 0.65);
        line({ x: player.x - w / 2, y: player.y }, { x: player.x - w * 0.82, y: player.y + h * 0.2 }, accent, 0.7);
        line({ x: player.x + w / 2, y: player.y }, { x: player.x + w * 0.82, y: player.y + h * 0.2 }, accent, 0.7);
      } else {
        // Apex and the two Arsenal disciplines visibly build a changing combat form.
        const sides = id === 'apex' ? 6 : 8;
        ctx.globalAlpha = 0.7 * intro;
        ctx.strokeStyle = primary;
        ctx.lineWidth = board.cell * 0.045;
        ctx.beginPath();
        for (let i = 0; i <= sides; i++) {
          const angle = (i / sides) * Math.PI * 2 + t * 0.55;
          const radius = board.cell * (0.28 + (i % 2) * 0.08 + pulse * 0.025);
          const x = player.x + Math.cos(angle) * radius;
          const y = player.y + Math.sin(angle) * radius;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        for (let i = 0; i < 4; i++) {
          const angle = t * (i % 2 ? -1.4 : 1.4) + i * Math.PI / 2;
          node(player.x + Math.cos(angle) * board.cell * 0.36, player.y + Math.sin(angle) * board.cell * 0.36, i % 2 ? accent : primary);
        }
      }
      ctx.restore();
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [id, stateRef]);

  return <canvas ref={canvasRef} className="signatureSkillFx" aria-hidden="true" />;
}

const emptyCloneView = (): CloneView => ({
  visible: false,
  revealed: false,
  inputActive: false,
  playerLocked: false,
  controlled: 'north',
  turn: 0,
  statuses: { north: 'gone', south: 'gone' },
  rows: { north: null, south: null },
  cols: { north: null, south: null },
});

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(makeInitialState());
  const animRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Input state (refs — no re-render needed)
  const keyboardRef = useRef({ up: false, down: false, left: false, right: false });
  const touchDpadRef = useRef({ up: false, down: false, left: false, right: false });
  const gamepadRef = useRef({
    moveX: 0, moveY: 0, prevMoveX: 0,
    fire: false, prevFire: false,
    cardX: false, prevCardX: false,   // button 2 → card slot 0
    cardY: false, prevCardY: false,   // button 3 → card slot 1
    cardB: false, prevCardB: false,   // button 1 → card slot 2
    rotate: false, prevRotate: false, // button 8/17 → rotate hand
    start: false, prevStart: false,   // button 9 → pause
    l1: false, prevL1: false,         // button 4 → combo modifier
    skill: false, prevSkill: false,   // button 6 / L2 → skill animation
    r1: false, prevR1: false,         // button 5 → evolution prompt
    r2: false, prevR2: false,         // button 7 / R2 → cycle active control
    connected: false,
  });
  const controllerCooldownRef = useRef(0);
  const fireHeldRef = useRef(false);
  const r2TapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skillTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Message system
  const msgFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Throttle HUD updates: only push cooldown state once per second
  const hudTickRef = useRef<number>(0);
  // Direct DOM refs for smooth per-frame bar + label updates (no React setState)
  const cardBarFillRef = useRef<HTMLDivElement>(null);
  const cardLabelRef = useRef<HTMLDivElement>(null);
  const skillNorthFxRef = useRef<HTMLDivElement>(null);
  const skillSouthFxRef = useRef<HTMLDivElement>(null);
  const skillPlayerFxRef = useRef<HTMLDivElement>(null);
  const skillFxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloneNorthRef = useRef<HTMLDivElement>(null);
  const cloneSouthRef = useRef<HTMLDivElement>(null);
  const rivalAttackFxSheetRef = useRef<HTMLImageElement | null>(null);
  const cloneActionTimersRef = useRef<Record<CloneDirection, ReturnType<typeof setTimeout> | null>>({
    north: null,
    south: null,
  });
  const cloneExpiryTimersRef = useRef<Record<CloneDirection, ReturnType<typeof setTimeout> | null>>({
    north: null,
    south: null,
  });
  const cloneAutoFireTimersRef = useRef<Record<CloneDirection, ReturnType<typeof setInterval> | null>>({
    north: null,
    south: null,
  });
  const cloneOpeningWindowRef = useRef(0);
  const cloneSessionRef = useRef<CloneView>(emptyCloneView());

  const [phase, setPhase] = useState<'menu' | 'playing'>('menu');
  const phaseRef = useRef<'menu' | 'playing'>('menu');
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  type MenuScreen = 'main' | 'vs-select' | 'customization' | 'bestiary' | 'options';
  const [menuScreen, setMenuScreen] = useState<MenuScreen>('main');
  const menuScreenRef = useRef<MenuScreen>('main');
  const [menuSelection, setMenuSelection] = useState(0);
  const menuSelectionRef = useRef(0);
  const customizationSelectionRef = useRef(0);
  const vsSelectionRef = useRef(0);
  const [pauseSelection, setPauseSelection] = useState(0);
  const pauseSelectionRef = useRef(0);
  const [upgradeSelection, setUpgradeSelection] = useState(0);
  const upgradeSelectionRef = useRef(0);
  const [bestiarySelection, setBestiarySelection] = useState(0);
  const bestiarySelectionRef = useRef(0);
  const menuNavCooldownRef = useRef(0);
  const [pauseBestiary, setPauseBestiary] = useState(false);
  const pauseBestiaryRef = useRef(false);
  const [pauseOptions, setPauseOptions] = useState(false);
  const pauseOptionsRef = useRef(false);
  const [virtualDpadEnabled, setVirtualDpadEnabled] = useState(
    () => localStorage.getItem(VIRTUAL_DPAD_KEY) !== 'off',
  );
  const [skillFxRun, setSkillFxRun] = useState(0);
  const [skillPlayerFxActive, setSkillPlayerFxActive] = useState(false);
  const [skillFxActive, setSkillFxActive] = useState(false);
  const [cloneView, setCloneView] = useState<CloneView>(emptyCloneView);
  const [avatarComponents, setAvatarComponents] = useState<AvatarComponentDrop[]>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(AVATAR_COMPONENTS_KEY) ?? '[]');
      const normalized = Array.isArray(stored)
        ? stored.filter((component: AvatarComponentDrop) =>
          component?.id && AVATAR_SLOTS.includes(component.slot))
          .map((component: AvatarComponentDrop) => normalizedAvatarComponent(component))
        : [];
      const recovered = avatarComponentsRecoveredFromBestiary();
      const signatureFamilies = signatureComponentLibrary();
      const merged = [...new Map(
        [...signatureFamilies, ...normalized, ...recovered].map((component) => [component.id, component]),
      ).values()].slice(0, 480);
      localStorage.setItem(AVATAR_COMPONENTS_KEY, JSON.stringify(merged));
      return merged;
    } catch {
      const recovered = [...signatureComponentLibrary(), ...avatarComponentsRecoveredFromBestiary()];
      localStorage.setItem(AVATAR_COMPONENTS_KEY, JSON.stringify(recovered));
      return recovered;
    }
  });
  const avatarComponentsRef = useRef(avatarComponents);
  const [equippedAvatarComponents, setEquippedAvatarComponents] = useState<EquippedAvatarComponents>(() => {
    try {
      return JSON.parse(localStorage.getItem(EQUIPPED_COMPONENTS_KEY) ?? '{}');
    } catch {
      return {};
    }
  });
  const awardAvatarComponent = useCallback((
    genome: EnemyGenome,
    playstyle: PlaystyleSignal | 'balanced' = 'balanced',
  ) => {
    const component = avatarComponentFromGenome(genome);
    const weapon = weaponComponentFromGenome(genome, playstyle);
    const additions = [component, weapon].filter((candidate) =>
      !avatarComponentsRef.current.some((entry) => entry.id === candidate.id));
    if (additions.length === 0) return;
    const next = [...additions, ...avatarComponentsRef.current].slice(0, 480);
    avatarComponentsRef.current = next;
    localStorage.setItem(AVATAR_COMPONENTS_KEY, JSON.stringify(next));
    setAvatarComponents(next);
  }, []);
  const [generatedAbilities, setGeneratedAbilities] = useState<GeneratedAbility[]>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(GENERATED_ABILITIES_KEY) ?? '[]');
      const valid = (Array.isArray(stored)
        ? stored.filter((ability: GeneratedAbility) =>
          ability?.id?.startsWith('manifest-')
          && ability.name && ability.desc && ability.delivery && ability.function && ability.medium)
        : []).map((ability: GeneratedAbility) => normalizedGeneratedAbility(ability));
      localStorage.setItem(GENERATED_ABILITIES_KEY, JSON.stringify(valid));
      generatedAbilityRegistry = Object.fromEntries(valid.map((ability: GeneratedAbility) => [ability.id, ability]));
      return valid;
    } catch {
      generatedAbilityRegistry = {};
      return [];
    }
  });
  const generatedAbilitiesRef = useRef(generatedAbilities);
  const registerGeneratedAbility = useCallback((ability: GeneratedAbility) => {
    const normalized = normalizedGeneratedAbility(ability);
    if (generatedAbilityRegistry[normalized.id]) return generatedAbilityRegistry[normalized.id];
    const next = [normalized, ...generatedAbilitiesRef.current].slice(0, 240);
    generatedAbilitiesRef.current = next;
    generatedAbilityRegistry = Object.fromEntries(next.map((entry) => [entry.id, entry]));
    localStorage.setItem(GENERATED_ABILITIES_KEY, JSON.stringify(next));
    setGeneratedAbilities(next);
    return normalized;
  }, []);
  const [learnedAbilities, setLearnedAbilities] = useState<LearnedAbility[]>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(LEARNED_ABILITIES_KEY) ?? '[]');
      const learned = Array.isArray(stored)
        ? stored
          .filter((entry: LearnedAbility) => entry?.id && runtimeAbilityById(entry.id))
          .map((entry: LearnedAbility) => {
            const resonance = Math.max(1, Number(entry.resonance) || 1);
            return {
              ...entry,
              source: ESSENTIAL_ABILITY_IDS.has(entry.id)
                ? 'foundation' as const
                : entry.source === 'foundation' ? 'playstyle' as const : entry.source,
              resonance,
              rank: abilityRank(resonance),
            };
          })
        : [];
      const learnedIds = new Set(learned.map((entry: LearnedAbility) => entry.id));
      return [...learned, ...FOUNDATION_ABILITIES.filter((entry) => !learnedIds.has(entry.id))];
    } catch {
      return [...FOUNDATION_ABILITIES];
    }
  });
  const learnedAbilitiesRef = useRef(learnedAbilities);
  const playstyleSignalsRef = useRef<Record<PlaystyleSignal, number>>((() => {
    try {
      const stored = JSON.parse(localStorage.getItem(PLAYSTYLE_SIGNALS_KEY) ?? '{}');
      return {
        manualFire: Number(stored.manualFire) || 0,
        autoOffFire: Number(stored.autoOffFire) || 0,
        movement: Number(stored.movement) || 0,
        abilityUse: Number(stored.abilityUse) || 0,
        rotation: Number(stored.rotation) || 0,
        cloneDefense: Number(stored.cloneDefense) || 0,
        cloneAutofire: Number(stored.cloneAutofire) || 0,
      };
    } catch {
      return {
        manualFire: 0, autoOffFire: 0, movement: 0, abilityUse: 0,
        rotation: 0, cloneDefense: 0, cloneAutofire: 0,
      };
    }
  })());
  const learnAbility = useCallback((id: string, source: LearnedAbility['source'], reason: string) => {
    if (!runtimeAbilityById(id) || ESSENTIAL_ABILITY_IDS.has(id)) return;
    const previous = learnedAbilitiesRef.current;
    const existing = previous.find((entry) => entry.id === id);
    const resonance = Math.min(
      ABILITY_RANK_THRESHOLDS[MAX_ABILITY_RANK],
      (existing?.resonance ?? 0) + 1,
    );
    const learned: LearnedAbility = existing
      ? { ...existing, source, reason, resonance, rank: abilityRank(resonance) }
      : { id, source, reason, learnedAt: Date.now(), resonance, rank: abilityRank(resonance) };
    const nextLearned = existing
      ? previous.map((entry) => entry.id === id ? learned : entry)
      : [learned, ...previous];
    learnedAbilitiesRef.current = nextLearned;
    localStorage.setItem(LEARNED_ABILITIES_KEY, JSON.stringify(nextLearned));
    setLearnedAbilities(nextLearned);
    const enabled = new Set(enabledAbilitiesRef.current);
    for (const candidate of nextLearned) {
      if (abilityIsUnlocked(candidate, nextLearned)) enabled.add(candidate.id);
    }
    enabledAbilitiesRef.current = enabled;
    localStorage.setItem(ENABLED_ABILITIES_KEY, JSON.stringify([...enabled]));
    setEnabledAbilities(enabled);
  }, []);
  const registerPlaystyle = useCallback((signal: PlaystyleSignal) => {
    const next = (playstyleSignalsRef.current[signal] ?? 0) + 1;
    playstyleSignalsRef.current[signal] = next;
    localStorage.setItem(PLAYSTYLE_SIGNALS_KEY, JSON.stringify(playstyleSignalsRef.current));
    const manifestation = PLAYSTYLE_MANIFESTATIONS[signal];
    if (next >= manifestation.threshold && (next - manifestation.threshold) % manifestation.threshold === 0) {
      const generated = registerGeneratedAbility(manifestedPlaystyleAbility(signal));
      learnAbility(generated.id, 'playstyle', manifestation.reason);
    }
  }, [learnAbility, registerGeneratedAbility]);
  const [bestiaryEntries, setBestiaryEntries] = useState<BestiaryEntry[]>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(BESTIARY_KEY) ?? '[]');
      return Array.isArray(stored)
        ? stored.slice(0, 160).map((entry: BestiaryEntry) => ({
          ...entry,
          observations: Math.max(1, entry.observations ?? 1),
        }))
        : [];
    } catch {
      return [];
    }
  });
  const bestiaryRef = useRef<BestiaryEntry[]>(bestiaryEntries);
  const synchronizedAbilityIdsRef = useRef(new Set(
    bestiaryEntries
      .map((entry) => entry.synchronizedAbilityId)
      .filter((id): id is string => Boolean(id && runtimeAbilityById(id))),
  ));
  const constitutionMatrixRef = useRef<Record<string, number>>((() => {
    try {
      const stored = JSON.parse(localStorage.getItem(CONSTITUTION_MATRIX_KEY) ?? '{}');
      const observations: Record<string, number> = {};
      if (stored && typeof stored === 'object') {
        for (const [signature, value] of Object.entries(stored)) {
          observations[signature] = Math.max(0, Number(value) || 0);
        }
      }
      for (const entry of bestiaryEntries) {
        const signature = constitutionMatrixSignature(entry.genome);
        observations[signature] = Math.max(
          observations[signature] ?? 0,
          Math.max(1, entry.observations ?? 1),
        );
      }
      localStorage.setItem(CONSTITUTION_MATRIX_KEY, JSON.stringify(observations));
      return observations;
    } catch {
      return {};
    }
  })());
  const recordBestiary = useCallback((seed: number, genome: EnemyGenome) => {
    const manifested = registerGeneratedAbility(manifestedAbilityFor(genome));
    const matrixSignature = manifested.constitutionSignature;
    const matrixObservations = Math.min(
      999,
      (constitutionMatrixRef.current[matrixSignature] ?? 0) + 1,
    );
    constitutionMatrixRef.current[matrixSignature] = matrixObservations;
    localStorage.setItem(CONSTITUTION_MATRIX_KEY, JSON.stringify(constitutionMatrixRef.current));
    const synchronizedAbilityId = matrixObservations >= SYNCHRONY_THRESHOLD
      ? manifested.id
      : undefined;
    if (synchronizedAbilityId) {
      synchronizedAbilityIdsRef.current.add(synchronizedAbilityId);
      if (matrixObservations === SYNCHRONY_THRESHOLD
        || matrixObservations % SYNCHRONY_THRESHOLD === 0) {
        learnAbility(
          synchronizedAbilityId,
          'constitution',
          `${manifested.medium}/${manifested.function}/${manifested.delivery} enemy components translated.`,
        );
      }
    }
    const signature = [
      genome.baseElement, genome.element, genome.entityType, genome.enemyClass,
      genome.fusionElement ?? 'pure', genome.niche,
      [...genome.mutations].sort().join('+') || 'baseline',
      `fusion-${genome.fusionLevel}`,
    ].join(':');
    const existingIndex = bestiaryRef.current.findIndex((entry) => entry.signature === signature);
    if (existingIndex >= 0) {
      const existing = bestiaryRef.current[existingIndex];
      const observations = Math.min(SYNCHRONY_THRESHOLD, matrixObservations);
      const updated = {
        ...existing,
        observations,
        synchronizedAbilityId: synchronizedAbilityId ?? existing.synchronizedAbilityId,
      };
      bestiaryRef.current = [
        updated,
        ...bestiaryRef.current.filter((_, index) => index !== existingIndex),
      ];
      localStorage.setItem(BESTIARY_KEY, JSON.stringify(bestiaryRef.current));
      setBestiaryEntries(bestiaryRef.current);
      return;
    }
    const entry: BestiaryEntry = {
      signature,
      seed,
      genome: { ...genome, mutations: [...genome.mutations] },
      discoveredAt: Date.now(),
      observations: Math.min(SYNCHRONY_THRESHOLD, matrixObservations),
      synchronizedAbilityId,
    };
    bestiaryRef.current = [entry, ...bestiaryRef.current].slice(0, 160);
    localStorage.setItem(BESTIARY_KEY, JSON.stringify(bestiaryRef.current));
    setBestiaryEntries(bestiaryRef.current);
  }, [learnAbility, registerGeneratedAbility]);

  // Player skin
  type PlayerSkin =
    | 'default' | 'rocket' | 'dots' | 'gem' | 'assembly'
    | 'chrono' | 'singularity' | 'override' | 'architect'
    | 'apex' | 'counter' | 'phase' | 'phoenix'
    | 'rift' | 'vector' | 'gridshift' | 'resonance'
    | 'exchange' | 'causality' | 'arsenal'
    | 'assimilation' | 'null' | 'polarity' | 'colossus'
    | 'predator' | 'orbital' | 'hijack' | 'sovereign';
  const SKIN_KEY = 'cgs_player_skin';
  const savedSkin = (localStorage.getItem(SKIN_KEY) ?? 'default') as PlayerSkin;
  const [playerSkin, setPlayerSkin] = useState<PlayerSkin>(savedSkin);
  const playerSkinRef = useRef<PlayerSkin>(savedSkin);
  const [npcSkin, setNpcSkin] = useState<PlayerSkin>('default');
  const npcSkinRef = useRef<PlayerSkin>('default');
  const npcSpriteWrapRef = useRef<HTMLDivElement | null>(null);
  const npcSpriteCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const npcFrameRef = useRef<ImageBitmap | null>(null);
  const storedAssemblySkill = localStorage.getItem(ASSEMBLY_SKILL_KEY) ?? 'shadow';
  const savedAssemblySkill: AssemblySkillId = storedAssemblySkill === 'shadow'
    || RIVAL_SKILL_IDS.includes(storedAssemblySkill as RivalSkillId)
    ? storedAssemblySkill as AssemblySkillId
    : 'shadow';
  const [assemblySkill, setAssemblySkill] = useState<AssemblySkillId>(savedAssemblySkill);
  const assemblySkillRef = useRef<AssemblySkillId>(savedAssemblySkill);
  const [assemblyAttackPulse, setAssemblyAttackPulse] = useState(0);
  const rivalSkillRef = useRef<RivalSkillView>(emptyRivalSkillView());
  const [rivalSkillView, setRivalSkillView] = useState<RivalSkillView>(emptyRivalSkillView);
  // DOM sprite overlay refs (rocket skin in-game)
  const spriteWrapRef   = useRef<HTMLDivElement | null>(null);
  const spriteCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const skinOptions: { id: PlayerSkin; label: string; preview: string | null }[] = [
    { id: 'default', label: 'Default', preview: null },
    { id: 'rocket', label: 'Rocket', preview: `${import.meta.env.BASE_URL}skins/rocket.gif` },
    { id: 'dots', label: 'Dots', preview: `${import.meta.env.BASE_URL}skins/dots.gif` },
    { id: 'gem', label: 'Elo', preview: `${import.meta.env.BASE_URL}skins/gem_thumb.png` },
    { id: 'assembly', label: 'Assembly', preview: null },
    { id: 'chrono', label: 'Chrona', preview: `${import.meta.env.BASE_URL}skins/skill-chrono-idle.png` },
    { id: 'singularity', label: 'Gravitas', preview: `${import.meta.env.BASE_URL}skins/skill-singularity-idle.png` },
    { id: 'override', label: 'Cipher', preview: `${import.meta.env.BASE_URL}skins/skill-override-idle.png` },
    { id: 'architect', label: 'Artifex', preview: `${import.meta.env.BASE_URL}skins/skill-architect-idle.png` },
    { id: 'apex', label: 'Vesper', preview: `${import.meta.env.BASE_URL}skins/skill-apex-idle.png` },
    { id: 'counter', label: 'Aegis', preview: `${import.meta.env.BASE_URL}skins/skill-counter-idle.png` },
    { id: 'phase', label: 'Nyx', preview: `${import.meta.env.BASE_URL}skins/skill-phase-idle.png` },
    { id: 'phoenix', label: 'Ember', preview: `${import.meta.env.BASE_URL}skins/skill-phoenix-idle.png` },
    { id: 'rift', label: 'Meridian', preview: `${import.meta.env.BASE_URL}skins/skill-rift-idle.png` },
    { id: 'vector', label: 'Quiver', preview: `${import.meta.env.BASE_URL}skins/skill-vector-idle.png` },
    { id: 'gridshift', label: 'Tessera', preview: `${import.meta.env.BASE_URL}skins/skill-gridshift-idle.png` },
    { id: 'resonance', label: 'Chord', preview: `${import.meta.env.BASE_URL}skins/skill-resonance-idle.png` },
    { id: 'exchange', label: 'Proxy', preview: `${import.meta.env.BASE_URL}skins/skill-exchange-idle.png` },
    { id: 'causality', label: 'Axiom', preview: `${import.meta.env.BASE_URL}skins/skill-causality-idle.png` },
    { id: 'arsenal', label: 'Forge', preview: `${import.meta.env.BASE_URL}skins/skill-arsenal-idle.png` },
    { id: 'assimilation', label: 'Meld', preview: `${import.meta.env.BASE_URL}skins/skill-assimilation-idle.png` },
    { id: 'null', label: 'Quietus', preview: `${import.meta.env.BASE_URL}skins/skill-null-idle.png` },
    { id: 'polarity', label: 'Dipole', preview: `${import.meta.env.BASE_URL}skins/skill-polarity-idle.png` },
    { id: 'colossus', label: 'Bastion', preview: `${import.meta.env.BASE_URL}skins/skill-colossus-idle.png` },
    { id: 'predator', label: 'Talon', preview: `${import.meta.env.BASE_URL}skins/skill-predator-idle.png` },
    { id: 'orbital', label: 'Zenith', preview: `${import.meta.env.BASE_URL}skins/skill-orbital-idle.png` },
    { id: 'hijack', label: 'Usurper', preview: `${import.meta.env.BASE_URL}skins/skill-hijack-idle.png` },
    { id: 'sovereign', label: 'Regent', preview: `${import.meta.env.BASE_URL}skins/skill-sovereign-idle.png` },
  ];

  // Rocket skin frames (static pre-transparified PNGs):
  //   0 = idle  |  1 = shoot pose  |  2 = post-shoot A  |  3 = post-shoot B
  const gifFramesRef       = useRef<ImageBitmap[]>([]);
  const rocketFrameRef     = useRef(0);
  const rocketAnimTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Gem skin — separate attack frames; -1 = idle, 0–2 = attack sequence
  const gifAttackFramesRef = useRef<ImageBitmap[]>([]);
  const gemAttackFrameRef  = useRef(-1);
  const gemAttackTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rivalAttackStartedRef = useRef(-1);
  const RIVAL_ATTACK_DURATION = 720;

  // Gem skin — move frames; gemMoveStartRef = performance.now() timestamp when move began, -1 = idle
  const gifMoveFramesRef   = useRef<ImageBitmap[]>([]);
  const gemMoveStartRef    = useRef(-1);
  const gemMoveTimer       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const GEM_MOVE_FRAME_MS  = 75;  // ms per move frame
  // true = mirror sprite horizontally (left move, parallel to gun axis)
  const gemMoveMirrorRef   = useRef(true);
  const eloAttackDirectionRef = useRef<1 | -1>(1);

  // State machine driven entirely by timeouts — no React state, no re-renders.
  // rocketFrameRef: -1 = idle (show gifFramesRef[0]), 0–N = attack frame index into gifAttackFramesRef.
  // If already animating, ignore the new shot — let the current sequence finish.
  // Start at ROCKET_ATTACK_START to skip the opening frames that look identical to idle.
  const ROCKET_ATTACK_START = 3; // first visually distinct frame
  const rocketShootFlash = useCallback(() => {
    const attackFrames = gifAttackFramesRef.current;
    if (attackFrames.length < 1) return;
    if (rocketFrameRef.current >= 0) return;             // already animating, don't restart
    if (rocketAnimTimer.current) clearTimeout(rocketAnimTimer.current);
    const FRAME_MS = 100; // ms per attack frame
    const playFrom = (idx: number) => {
      rocketFrameRef.current = idx;
      if (idx < attackFrames.length - 1) {
        rocketAnimTimer.current = setTimeout(() => playFrom(idx + 1), FRAME_MS);
      } else {
        rocketAnimTimer.current = setTimeout(() => {
          rocketFrameRef.current = -1;                   // back to idle
        }, FRAME_MS);
      }
    };
    playFrom(ROCKET_ATTACK_START);
  }, []);

  // Gem move: plays all move frames once then returns to idle. Any new move restarts.
  const gemMoveFlash = useCallback(() => {
    if (gifMoveFramesRef.current.length < 1) return;
    gemMoveStartRef.current = performance.now();
    if (gemMoveTimer.current) clearTimeout(gemMoveTimer.current);
    const total = gifMoveFramesRef.current.length * GEM_MOVE_FRAME_MS;
    gemMoveTimer.current = setTimeout(() => {
      gemMoveStartRef.current = -1;
    }, total);
  }, []);

  // Gem attack: frame 0 → 1 → 2 → back to idle (-1). Any new shot restarts.
  const gemShootFlash = useCallback(() => {
    if (gifAttackFramesRef.current.length < 1) return;
    gemAttackFrameRef.current = 0;
    if (gemAttackTimer.current) clearTimeout(gemAttackTimer.current);
    gemAttackTimer.current = setTimeout(() => {
      gemAttackFrameRef.current = 1;
      gemAttackTimer.current = setTimeout(() => {
        gemAttackFrameRef.current = 2;
        gemAttackTimer.current = setTimeout(() => {
          gemAttackFrameRef.current = -1;               // back to idle
        }, 150);
      }, 150);
    }, 150);
  }, []);

  const rivalShootFlash = useCallback(() => {
    if (gifAttackFramesRef.current.length < 1) return;
    // Auto Fire can produce a new shot before the prior frame timeout ends.
    // Never restart an in-flight pulse or the rival remains permanently in
    // the attack pose.
    if (gemAttackFrameRef.current >= 0) return;
    gemAttackFrameRef.current = 0;
    rivalAttackStartedRef.current = performance.now();
    if (gemAttackTimer.current) clearTimeout(gemAttackTimer.current);
    gemAttackTimer.current = setTimeout(() => {
      gemAttackFrameRef.current = -1;
      rivalAttackStartedRef.current = -1;
      gemAttackTimer.current = null;
    }, RIVAL_ATTACK_DURATION);
  }, []);

  useEffect(() => () => {
    if (r2TapTimerRef.current) clearTimeout(r2TapTimerRef.current);
    if (skillTapTimerRef.current) clearTimeout(skillTapTimerRef.current);
  }, []);

  useEffect(() => {
    const sheet = new Image();
    sheet.src = `${import.meta.env.BASE_URL}effects/signature-skill-sequences-c-transparent.png?alpha=v2`;
    rivalAttackFxSheetRef.current = sheet;
    return () => {
      rivalAttackFxSheetRef.current = null;
    };
  }, []);

  // Load pre-transparified PNG frames when a sprite skin is selected.
  useEffect(() => {
    const rivalSkin = RIVAL_SKILL_IDS.includes(playerSkin as RivalSkillId);
    if (playerSkin !== 'rocket' && playerSkin !== 'dots' && playerSkin !== 'gem' && !rivalSkin) return;
    const base = import.meta.env.BASE_URL;
    const loadBmp = (url: string): Promise<ImageBitmap> =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload  = () => createImageBitmap(img)
          .then(resolve)
          .catch(reject);
        img.onerror = () => reject(new Error(`Failed to load ${url}`));
        img.src = url;
      });

    // Load rocket attack frames into gifAttackFramesRef
    if (playerSkin === 'rocket') {
      Promise.all(Array.from({ length: 13 }, (_, i) => loadBmp(`${base}skins/rocket_attack_frame_${i}.png?alpha=v2`)))
        .then(bitmaps => { gifAttackFramesRef.current = bitmaps; })
        .catch(err => console.error('[rocket attack] frame load error:', err));
    }

    // Also load gem attack + move frames whenever gem is selected
    if (playerSkin === 'gem') {
      Promise.all([0,1,2].map(i => loadBmp(`${base}skins/gem_attack_frame_${i}.png?alpha=v2`)))
        .then(bitmaps => { gifAttackFramesRef.current = bitmaps; })
        .catch(err => console.error('[gem attack] frame load error:', err));
      Promise.all(Array.from({ length: 18 }, (_, i) => loadBmp(`${base}skins/gem_move_frame_${i}.png`)))
        .then(bitmaps => { gifMoveFramesRef.current = bitmaps; })
        .catch(err => console.error('[gem move] frame load error:', err));
    }
    let cancelled = false;

    const loadBitmap = (url: string): Promise<ImageBitmap> =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload  = () => createImageBitmap(img)
          .then(resolve)
          .catch(reject);
        img.onerror = () => reject(new Error(`Failed to load ${url}`));
        img.src = url;
      });

    (async () => {
      try {
        const base = import.meta.env.BASE_URL;
        if (rivalSkin) {
          let [rawIdle, rawAttack] = await Promise.all([
            loadBitmap(`${base}skins/skill-${playerSkin}-idle.png?alpha=v2`),
            loadBitmap(`${base}skins/skill-${playerSkin}-attack.png?alpha=v2`),
          ]);
          if (playerSkin === 'hijack') {
            const idleCrop = await createImageBitmap(
              rawIdle,
              Math.round(rawIdle.width * 4 / 240),
              Math.round(rawIdle.height * 24 / 160),
              Math.round(rawIdle.width * 188 / 240),
              Math.round(rawIdle.height * 100 / 160),
            );
            const attackCrop = await createImageBitmap(
              rawAttack,
              0,
              Math.round(rawAttack.height * 18 / 160),
              Math.round(rawAttack.width * 142 / 240),
              Math.round(rawAttack.height * 82 / 160),
            );
            rawIdle.close();
            rawAttack.close();
            rawIdle = idleCrop;
            rawAttack = attackCrop;
          }
          let pair: { idle: ImageBitmap; attack: ImageBitmap };
          if (playerSkin === 'chrono') {
            // Chrono's attack is intentionally much wider than his body. The
            // generic island sanitizer interprets the clock-blade as peripheral
            // effect art and clips its outer arc. Normalize the complete authored
            // 3:2 frame into a square while preserving its aspect ratio.
            const chronoCanvas = document.createElement('canvas');
            chronoCanvas.width = 160;
            chronoCanvas.height = 160;
            const chronoCtx = chronoCanvas.getContext('2d')!;
            chronoCtx.imageSmoothingEnabled = false;
            chronoCtx.clearRect(0, 0, 160, 160);
            chronoCtx.drawImage(rawAttack, 2, 28, 156, 104);
            const [idle, attack] = await Promise.all([
              sanitizeRivalSkinFrame(rawIdle),
              createImageBitmap(chronoCanvas),
            ]);
            rawAttack.close();
            pair = { idle, attack };
          } else if (REGISTERED_RIVAL_FRAME_FIXES.has(playerSkin as RivalSkillId)) {
            pair = await sanitizeRivalSkinPair(rawIdle, rawAttack);
          } else {
            pair = {
              idle: await sanitizeRivalSkinFrame(rawIdle),
              attack: await sanitizeRivalSkinFrame(rawAttack),
            };
          }
          if (cancelled) {
            pair.idle.close();
            pair.attack.close();
            return;
          }
          gifFramesRef.current = [pair.idle];
          gifAttackFramesRef.current = [pair.attack];
          rocketFrameRef.current = -1;
          return;
        }
        const urls = playerSkin === 'rocket'
          ? [`${base}skins/rocket_idle.png`]
          : playerSkin === 'dots'
          ? [
              `${base}skins/dots_frame_0.png`,
              `${base}skins/dots_frame_1.png`,
              `${base}skins/dots_frame_2.png`,
              `${base}skins/dots_frame_3.png`,
              `${base}skins/dots_frame_4.png`,
            ]
          : playerSkin === 'gem'
          ? Array.from({ length: 12 }, (_, i) => `${base}skins/gem_frame_${i}.png`)
          : [`${base}skins/skill-${playerSkin}-idle.png`];
        const bitmaps = await Promise.all(urls.map(loadBitmap));
        if (cancelled) { bitmaps.forEach(b => b.close()); return; }
        gifFramesRef.current = bitmaps;
        rocketFrameRef.current = -1; // -1 = idle
      } catch (err) {
        console.error(`[${playerSkin} skin] frame load error:`, err);
      }
    })();

    return () => {
      cancelled = true;
      if (rocketAnimTimer.current) clearTimeout(rocketAnimTimer.current);
      if (gemAttackTimer.current) clearTimeout(gemAttackTimer.current);
      if (gemMoveTimer.current) clearTimeout(gemMoveTimer.current);
      gifFramesRef.current.forEach(b => b.close());
      gifFramesRef.current = [];
      gifAttackFramesRef.current.forEach(b => b.close());
      gifAttackFramesRef.current = [];
      gifMoveFramesRef.current.forEach(b => b.close());
      gifMoveFramesRef.current = [];
      rocketFrameRef.current = -1;
      gemAttackFrameRef.current = -1;
      rivalAttackStartedRef.current = -1;
      gemMoveStartRef.current = -1;
    };
  }, [playerSkin]);

  useEffect(() => {
    let cancelled = false;
    npcFrameRef.current?.close();
    npcFrameRef.current = null;
    if (npcSkin === 'default' || npcSkin === 'assembly') return;
    const base = import.meta.env.BASE_URL;
    const source = npcSkin === 'rocket'
      ? `${base}skins/rocket_idle.png`
      : npcSkin === 'dots'
      ? `${base}skins/dots_frame_0.png`
      : npcSkin === 'gem'
      ? `${base}skins/gem_frame_0.png`
      : `${base}skins/skill-${npcSkin}-idle.png`;
    const img = new Image();
    img.onload = async () => {
      let raw = await createImageBitmap(img);
      if (npcSkin === 'hijack') {
        const cropped = await createImageBitmap(
          raw,
          Math.round(raw.width * 4 / 240),
          Math.round(raw.height * 24 / 160),
          Math.round(raw.width * 188 / 240),
          Math.round(raw.height * 100 / 160),
        );
        raw.close();
        raw = cropped;
      }
      const frame = RIVAL_SKILL_IDS.includes(npcSkin as RivalSkillId)
        ? await sanitizeRivalSkinFrame(raw)
        : raw;
      if (frame !== raw) raw.close();
      if (cancelled) {
        frame.close();
        return;
      }
      npcFrameRef.current = frame;
    };
    img.onerror = () => console.error(`[${npcSkin} NPC skin] frame load error`);
    img.src = source;
    return () => {
      cancelled = true;
      npcFrameRef.current?.close();
      npcFrameRef.current = null;
    };
  }, [npcSkin]);

  // ── Blockchain reward state ───────────────────────────────────────────────
  const rewardAccRef = useRef<RewardAccumulator>(new RewardAccumulator());
  const [sessionCGRD, setSessionCGRD] = useState(0);
  const [gameKills,   setGameKills]   = useState<KillRecord[]>([]);

  const initialEnabledAbilities = (() => {
    const unlockedIds = new Set(learnedAbilities
      .filter((entry) => abilityIsUnlocked(entry, learnedAbilities))
      .map((entry) => entry.id));
    try {
      const stored = JSON.parse(localStorage.getItem(ENABLED_ABILITIES_KEY) ?? 'null');
      if (Array.isArray(stored)) {
        const valid = stored.filter((id): id is string =>
          typeof id === 'string' && Boolean(runtimeAbilityById(id)) && unlockedIds.has(id));
        if (valid.length > 0) return new Set(valid);
      }
    } catch {
      // Fall through to every ability currently available to this architecture.
    }
    return new Set(unlockedIds);
  })();
  const initialAbilityPresets = (() => {
    const unlocked = learnedAbilities
      .filter((entry) => abilityIsUnlocked(entry, learnedAbilities))
      .map((entry) => entry.id)
      .filter((id) => Boolean(runtimeAbilityById(id)));
    const essential = unlocked.filter((id) => ESSENTIAL_ABILITY_IDS.has(id));
    const learnedSource = (source: LearnedAbility['source']) => learnedAbilities
      .filter((entry) => entry.source === source && unlocked.includes(entry.id))
      .map((entry) => entry.id);
    const merge = (...groups: string[][]) => [...new Set([...essential, ...groups.flat()])];
    const suggested = [
      [...initialEnabledAbilities],
      merge(unlocked.filter((id) => OFFENSE_ABILITY_IDS.has(id))),
      merge(unlocked.filter((id) => CONTROL_ABILITY_IDS.has(id))),
      merge(unlocked.filter((id) =>
        ['shield', 'armor', 'regen', 'drain', 'recover', 'ghost', 'rearguard', 'counter'].includes(id))),
      merge(learnedSource('constitution')),
      merge(learnedSource('playstyle')),
      merge([]),
    ];
    try {
      const stored = JSON.parse(localStorage.getItem(ABILITY_PRESETS_KEY) ?? 'null');
      if (Array.isArray(stored) && stored.length === ABILITY_PRESET_COUNT) {
        return stored.map((ids: unknown, index: number) => {
          const valid = Array.isArray(ids)
            ? ids.filter((id): id is string => typeof id === 'string' && unlocked.includes(id))
            : [];
          return valid.length > 0 ? merge(valid) : suggested[index];
        });
      }
    } catch {
      // Use the six strategically suggested pools.
    }
    localStorage.setItem(ABILITY_PRESETS_KEY, JSON.stringify(suggested));
    return suggested;
  })();
  const savedPresetIndex = Math.max(
    0,
    Math.min(ABILITY_PRESET_COUNT - 1, Number(localStorage.getItem(ACTIVE_ABILITY_PRESET_KEY)) || 0),
  );
  const [abilityPresets, setAbilityPresets] = useState<string[][]>(initialAbilityPresets);
  const abilityPresetsRef = useRef<string[][]>(initialAbilityPresets);
  const [activeAbilityPreset, setActiveAbilityPreset] = useState(savedPresetIndex);
  const activeAbilityPresetRef = useRef(savedPresetIndex);
  const [autoRotateAbilityPresets, setAutoRotateAbilityPresets] = useState(
    () => localStorage.getItem(AUTO_ROTATE_PRESETS_KEY) === 'on',
  );
  const autoRotateAbilityPresetsRef = useRef(autoRotateAbilityPresets);
  const initialPresetAbilities = new Set(
    initialAbilityPresets[savedPresetIndex]?.length
      ? initialAbilityPresets[savedPresetIndex]
      : initialEnabledAbilities,
  );
  const [enabledAbilities, setEnabledAbilities] = useState<Set<string>>(initialPresetAbilities);
  const enabledAbilitiesRef = useRef<Set<string>>(initialPresetAbilities);

  const activateAbilityPreset = useCallback((index: number) => {
    const normalized = (index + ABILITY_PRESET_COUNT) % ABILITY_PRESET_COUNT;
    const next = new Set(abilityPresetsRef.current[normalized] ?? []);
    if (next.size === 0) return;
    activeAbilityPresetRef.current = normalized;
    setActiveAbilityPreset(normalized);
    localStorage.setItem(ACTIVE_ABILITY_PRESET_KEY, String(normalized));
    enabledAbilitiesRef.current = next;
    setEnabledAbilities(next);
    localStorage.setItem(ENABLED_ABILITIES_KEY, JSON.stringify([...next]));
  }, []);

  const [boardBottom, setBoardBottom] = useState(0);

  const [hud, setHud] = useState<HudData>({
    hp: 5,
    integrityWork: 0,
    systemIntegrity: { global: 62, sector: 58, node: 54 },
    wave: 1, autoBuster: true, shieldCharges: 0,
    cardsReady: false, cardSelectionOpen: false, rotateUsedThisHand: false, cardTimer: 0,
    cardOptions: [], usedInHand: [], abilityCooldowns: {}, running: true,
    message: 'Tap blue panels to move. Use BUSTER button to fire manually.',
    gameMode: 'classic', npcHp: NPC_HP, npcShieldCharges: 0, playerWon: false,
    pressureState: 'steady',
    upgradePromptOpen: false,
    upgradePromptTimer: 0,
    upgradeSelectionOpen: false,
    upgradeOptions: [],
    runUpgrades: {},
    ecosystem: { species: 0, mutations: 0, generation: 0, fusions: 0 },
  });
  const [presence, setPresence] = useState<PresenceSnapshot | null>(null);

  useEffect(() => {
    if (phase !== 'playing') {
      setPresence(null);
      void leavePresence();
      return;
    }
    let cancelled = false;
    const heartbeat = async () => {
      const state = stateRef.current;
      try {
        const snapshot = await heartbeatPresence({
          integrityWork: state.integrityWork,
          nodeIntegrity: state.systemIntegrity.node,
          wave: state.wave,
        });
        if (!cancelled) setPresence(snapshot);
      } catch {
        if (!cancelled) setPresence(null);
      }
    };
    void heartbeat();
    const timer = window.setInterval(heartbeat, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      void leavePresence();
    };
  }, [phase]);

  const updateHud = useCallback(() => {
    const s = stateRef.current;
    setHud((prev) => ({
      ...prev,
      hp: s.hp,
      integrityWork: s.integrityWork,
      systemIntegrity: { ...s.systemIntegrity },
      wave: s.wave,
      autoBuster: s.autoBuster,
      shieldCharges: s.shieldCharges,
      cardsReady: s.cardsReady,
      cardSelectionOpen: s.cardSelectionOpen,
      rotateUsedThisHand: s.rotateUsedThisHand,
      cardTimer: s.cardTimer,
      cardOptions: [...s.currentCardOptions],
      usedInHand: [...s.usedInHand],
      abilityCooldowns: { ...s.abilityCooldowns },
      running: s.running,
      gameMode: s.gameMode,
      npcHp: s.npc.hp,
      npcShieldCharges: s.npc.shieldCharges,
      playerWon: s.playerWon,
      pressureState: s.directorRecoveryTimer > 0
        ? 'recovery'
        : s.directorCritical ? 'critical' : 'steady',
      upgradePromptOpen: s.upgradePromptOpen,
      upgradePromptTimer: s.upgradePromptTimer,
      upgradeSelectionOpen: s.upgradeSelectionOpen,
      upgradeOptions: [...s.upgradeOptions],
      runUpgrades: { ...s.runUpgrades },
      ecosystem: {
        species: s.ecosystemStats.entitySignatures.length,
        mutations: s.ecosystemStats.mutationDiscoveries,
        generation: s.ecosystemStats.maxGeneration,
        fusions: s.ecosystemStats.totalFusions,
      },
    }));
  }, []);

  const showMessage = useCallback((text: string, duration: number | false = 2000) => {
    if (msgFadeTimerRef.current) clearTimeout(msgFadeTimerRef.current);
    setHud((prev) => ({ ...prev, message: text }));
    if (duration !== false) {
      msgFadeTimerRef.current = setTimeout(() => {
        setHud((prev) => ({ ...prev, message: '' }));
      }, duration);
    }
  }, []);

  const addParticles = useCallback((x: number, y: number, color: string) => {
    const s = stateRef.current;
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 30 + Math.random() * 90;
      s.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.35 + Math.random() * 0.25, maxLife: 0.6, color });
    }
  }, []);

  type AttackStyle = NonNullable<Bullet['attackStyle']>;
  const resolveAttackStyle = useCallback((skinOverride?: PlayerSkin): AttackStyle => {
    const skin = skinOverride ?? playerSkinRef.current;
    const skinAttackLanguage: Record<PlayerSkin, AttackStyle> = {
      default: 'physical',
      rocket: 'physical',
      dots: 'energy',
      gem: 'energy',
      assembly: 'adaptive',
      chrono: 'temporal',
      singularity: 'gravity',
      override: 'swarm',
      architect: 'grid',
      apex: 'adaptive',
      counter: 'reflective',
      phase: 'melee',
      phoenix: 'energy',
      rift: 'portal',
      vector: 'vector',
      gridshift: 'grid',
      resonance: 'resonance',
      exchange: 'adaptive',
      causality: 'temporal',
      arsenal: 'adaptive',
      assimilation: 'adaptive',
      null: 'suppression',
      polarity: 'polarity',
      colossus: 'physical',
      predator: 'melee',
      orbital: 'orbital',
      hijack: 'swarm',
      sovereign: 'energy',
    };
    if (skin !== 'assembly') return skinAttackLanguage[skin];
    try {
      const equipped = JSON.parse(localStorage.getItem(EQUIPPED_COMPONENTS_KEY) ?? '{}') as EquippedAvatarComponents;
      const weapon = avatarComponentsRef.current.find((part) =>
        part.slot === 'weapon' && part.id === equipped.weapon);
      const weaponLanguage = `${weapon?.name ?? ''} ${weapon?.id ?? ''}`.toLowerCase();
      return /blade|sword|scythe|claw|talon|gauntlet|axe/.test(weaponLanguage)
        ? 'melee'
        : /swarm|hive|drone|colony/.test(weaponLanguage) ? 'swarm'
          : /chrono|clock|causal|time/.test(weaponLanguage) ? 'temporal'
            : /gravity|mass|singularity/.test(weaponLanguage) ? 'gravity'
              : /rift|portal|gate/.test(weaponLanguage) ? 'portal'
                : /null|silence|suppress/.test(weaponLanguage) ? 'suppression'
                  : /polar|magnet/.test(weaponLanguage) ? 'polarity'
                    : /resonan|harmonic|chime/.test(weaponLanguage) ? 'resonance'
                      : /orbital|beacon|designator/.test(weaponLanguage) ? 'orbital'
                        : /reflect|mirror|counter/.test(weaponLanguage) ? 'reflective'
                          : /arc|beam|caster|phase|pulse|prism|energy|void|radiant/.test(weaponLanguage)
                            ? 'energy'
                            : 'physical';
    } catch {
      return 'physical';
    }
  }, []);

  const fireBullet = useCallback((rowOverride?: number, opts?: {
    power?: number;
    big?: boolean;
    pierce?: boolean;
    originCol?: number;
  }) => {
    const s = stateRef.current;
    const row = rowOverride !== undefined ? rowOverride : s.player.row;
    let power = opts?.power ?? 1;
    let big = opts?.big ?? false;
    let pierce = opts?.pierce ?? false;
    s.shotsFired++;
    const phaseLevel = s.runUpgrades.phaseRounds ?? 0;
    const phaseInterval = Math.max(3, 6 - phaseLevel);
    if (phaseLevel > 0 && s.shotsFired % phaseInterval === 0) pierce = true;
    const denseLevel = s.runUpgrades.denseCharge ?? 0;
    if (denseLevel > 0 && s.shotsFired % 4 === 0) power += denseLevel;
    if (s.voltageTimer > 0) { big = true; pierce = true; }
    if (s.doubleTimer > 0) power *= 2;
    if (!pierce && s.pierceShots > 0) {
      pierce = true;
      s.pierceShots = Math.max(0, s.pierceShots - 1);
    }
    if (s.critTimer > 0 && Math.random() < 0.4) power *= 3;
    const direction = playerSkinRef.current === 'gem' ? eloAttackDirectionRef.current : 1;
    const attackStyle = resolveAttackStyle();
    s.bullets.push({
      colPos: (opts?.originCol ?? s.player.col) + direction * 0.55,
      row,
      speed: direction * 8.5,
      power,
      big,
      pierce,
      attackStyle,
      effectSkin: playerSkinRef.current,
    });
    if (s.echoTimer > 0) {
      const echoRow = (row + 1) % 3;
      s.bullets.push({
        colPos: (opts?.originCol ?? s.player.col) + direction * 0.55,
        row: echoRow,
        speed: direction * 8.5,
        power: Math.max(1, power - 1),
        big: false,
        pierce: false,
        attackStyle,
        effectSkin: playerSkinRef.current,
      });
    }
    playShot();
    const playerOriginShot = opts?.originCol === undefined;
    if (playerOriginShot && playerSkinRef.current === 'rocket') rocketShootFlash();
    if (playerOriginShot && playerSkinRef.current === 'gem' && s.autoBuster) gemShootFlash();
    if (playerOriginShot && playerSkinRef.current === 'assembly') {
      setAssemblyAttackPulse((pulse) => pulse + 1);
    }
    if (playerOriginShot && RIVAL_SKILL_IDS.includes(playerSkinRef.current as RivalSkillId)) rivalShootFlash();
  }, [rocketShootFlash, gemShootFlash, rivalShootFlash, resolveAttackStyle]);

  const tryMoveTo = useCallback((col: number, row: number) => {
    const s = stateRef.current;
    if (!s.running) return;
    if (col < 0 || col > 2 || row < 0 || row > 2) return;
    // Player retains facing even while moving backward.
    s.player.col = col;
    s.player.row = row;
    const chrono = rivalSkillRef.current;
    if (chrono.active && chrono.id === 'chrono') {
      const positions = chrono.chronoPositions.filter((position) =>
        position.col !== col || position.row !== row);
      positions.push({ col, row });
      const recorded = positions.slice(-9);
      const updated = {
        ...chrono,
        chronoPositions: recorded,
        chronoPositionIndex: recorded.length - 1,
      };
      rivalSkillRef.current = updated;
      setRivalSkillView(updated);
    }
    registerPlaystyle('movement');
    s.moveFlash = 0.15;
    playMove();
    updateHud();
    if (playerSkinRef.current === 'gem') gemMoveFlash();
  }, [updateHud, gemMoveFlash, registerPlaystyle]);

  const manualBuster = useCallback(() => {
    const s = stateRef.current;
    if (!s.running) return;
    if (s.player.fireCooldown <= 0) {
      registerPlaystyle('manualFire');
      if (!s.autoBuster) registerPlaystyle('autoOffFire');
      fireBullet();
      if (s.multishotTimer > 0) fireBullet((s.player.row + 1) % 3);
      if (s.turretTimer > 0) {
        for (let r = 0; r < 3; r++) { if (r !== s.player.row) fireBullet(r); }
      }
      const rapidScale = 1 + (s.runUpgrades.rapidBuster ?? 0) * 0.1;
      s.player.fireCooldown = (s.berserkTimer > 0 ? 0.09 : s.overclockTimer > 0 ? 0.16 : 0.25) / rapidScale;
    }
  }, [fireBullet, registerPlaystyle]);

  const endGame = useCallback((won = false) => {
    const s = stateRef.current;
    if (!s.running) return;
    s.running = false;
    s.playerWon = won;
    stopMusic();
    if (won) {
      showMessage('SYSTEM OVERRIDE — NPC neutralised!', false);
    } else {
      playGameOver();
      showMessage('CONNECTION LOST — tap Play Again to restart.', false);
    }
    // Capture final kills for blockchain claim
    setGameKills([...rewardAccRef.current.killList]);
    updateHud();
  }, [showMessage, updateHud]);

  const useCard = useCallback((type: string) => {
    const s = stateRef.current;
    if (!s.running || !s.cardsReady) return;
    const ability = runtimeAbilityById(type);
    const generated = generatedAbilityRegistry[type];
    if (!ability) return;
    // Already used this hand or on cooldown — do nothing
    if (s.usedInHand.includes(type)) return;
    if ((s.abilityCooldowns[type] ?? 0) > 0) return;
    registerPlaystyle('abilityUse');

    const canvas = canvasRef.current;
    const m = canvas ? getBoardMetrics(canvas.offsetWidth, canvas.offsetHeight) : null;
    const living = () => s.enemies.filter((enemy) => enemy.colPos > -1);
    const strike = (
      predicate: (enemy: GameState['enemies'][number]) => boolean,
      damage: number,
      push = 0,
    ) => {
      let hits = 0;
      for (const enemy of living()) {
        if (!predicate(enemy)) continue;
        enemy.hp -= damage;
        enemy.colPos = Math.min(5.8, enemy.colPos + push);
        enemy.flash = 0.16;
        hits++;
        if (enemy.hp <= 0) {
          enemy.colPos = -9;
          s.score += 100;
        }
      }
      return hits;
    };

    // ── Existing ────────────────────────────────────────────────────────────
    if (generated) {
      const rank = learnedAbilitiesRef.current.find((entry) => entry.id === type)?.rank ?? 1;
      const mediumMatch = (enemy: GameState['enemies'][number]) => {
        const genome = enemy.genome;
        if (!genome) return generated.medium === 'kinetic';
        const movement = movementClassOf(enemy);
        if (generated.medium === 'signal') return genome.entityType === 'mechanical' || CYBER_BASES.has(genome.baseElement);
        if (generated.medium === 'thermal') return genome.element === 'thermal' || genome.element === 'cryo';
        if (generated.medium === 'phase') return genome.element === 'void' || genome.element === 'radiant' || movement === 'spectral';
        if (generated.medium === 'fluid') return genome.entityType === 'fluidic' || genome.element === 'corrosive' || movement === 'aquatic';
        if (generated.medium === 'organic') return genome.element === 'bloom' || genome.entityType === 'organic' || genome.entityType === 'botanical';
        return true;
      };
      let targets = living().filter(mediumMatch);
      if (targets.length === 0) targets = living();
      if (generated.delivery === 'projector') {
        const rowTargets = targets.filter((enemy) => enemy.row === s.player.row);
        targets = rowTargets.length > 0 ? rowTargets : targets.slice(0, 1);
      } else if (generated.delivery === 'pulse') {
        targets = targets.slice(0, Math.min(targets.length, 1 + rank));
      }
      if (generated.function === 'rupture') {
        strike((enemy) => targets.includes(enemy), 1 + rank);
      } else if (generated.function === 'inhibit') {
        for (const enemy of targets) { enemy.speed *= Math.max(0.28, 0.72 - rank * 0.06); enemy.abilityCooldown = Math.max(enemy.abilityCooldown ?? 0, 2 + rank); enemy.flash = 0.16; }
      } else if (generated.function === 'impulse') {
        for (const enemy of targets) { enemy.colPos = Math.min(5.8, enemy.colPos + 0.65 + rank * 0.28); enemy.flash = 0.16; }
      } else if (generated.function === 'ward') {
        s.shieldCharges = Math.min(9, s.shieldCharges + 1 + Math.floor(rank / 2));
      } else if (generated.function === 'restore') {
        s.hp += 1 + Math.ceil(rank / 2);
      } else if (generated.function === 'reveal') {
        for (const enemy of targets) {
          enemy.abilityCooldown = Math.max(enemy.abilityCooldown ?? 0, 2 + rank);
          enemy.colPos = Math.min(5.8, enemy.colPos + 0.35 * rank);
          enemy.flash = 0.16;
        }
      } else {
        for (const enemy of targets) {
          enemy.row = (enemy.row + 1 + (rank % 2)) % 3;
          enemy.speed *= 0.8;
          enemy.flash = 0.16;
        }
      }
      showMessage(`${generated.name} manifested at Rank ${rank}!`, 1500);
    } else if (type === 'shotgun') {
      for (let ro = -1; ro <= 1; ro++) {
        const tr = s.player.row + ro;
        if (tr >= 0 && tr < 3) fireBullet(tr, { power: 2, big: true });
      }
      showMessage('Shotgun blasted 3 rows!', 1500);
    } else if (type === 'heal') {
      s.hp = s.hp + 2;
      if (m) addParticles(m.x + (s.player.col + 0.5) * m.cell, m.y + (s.player.row + 0.5) * m.cell, '#86efac');
      showMessage('Recover restored 2 HP!', 1500);
    } else if (type === 'time') {
      s.slowTimer = 6;
      showMessage('Time Slow — viruses at 45% speed!', 1500);
    } else if (type === 'pierce') {
      s.pierceShots = Math.max(s.pierceShots, 1);
      showMessage('Pierce loaded — next shot punches through!', 1500);
    } else if (type === 'bomb') {
      const targetRow = s.player.row;
      let hits = 0;
      for (const enemy of s.enemies) {
        if (enemy.row === targetRow) {
          enemy.hp -= 2;
          enemy.flash = 0.12;
          if (enemy.hp <= 0 && m) {
            addParticles(m.x + (enemy.colPos + 0.5) * m.cell, m.y + (enemy.row + 0.5) * m.cell, '#fde047');
            enemy.colPos = -9;
            s.score += 100;
            if (s.drainTimer > 0) s.hp++;
            hits++;
          }
        }
      }
      if (hits > 0) { if (s.score % 500 === 0) s.wave++; playScore(); }
      showMessage('Grid Bomb detonated your row!', 1500);
    } else if (type === 'shield') {
      s.shieldCharges = Math.min(3, s.shieldCharges + 1);
      showMessage('Shield charged — next hit blocked!', 1500);
    } else if (type === 'overclock') {
      s.overclockTimer = 6;
      showMessage('Overclock — double fire rate for 6s!', 1500);
    } else if (type === 'mirror') {
      for (let row = 0; row < 3; row++) fireBullet(row, { power: 1, big: true });
      showMessage('Mirror — one big shot on every lane!', 1500);
    } else if (type === 'scramble') {
      for (const enemy of s.enemies) {
        const movement = movementClassOf(enemy);
        const push = movement && HEAVY_CLASSES.has(movement) ? 0.35 : movement && AIR_CLASSES.has(movement) ? 1.05 : 0.8;
        enemy.colPos = Math.min(5.8, enemy.colPos + push);
        enemy.formationId = undefined;
        enemy.flash = 0.1;
      }
      showMessage('Scramble knocked viruses back!', 1500);

    // ── Instant / no new state ──────────────────────────────────────────────
    } else if (type === 'nuke') {
      let kills = 0;
      for (const enemy of s.enemies) {
        if (m) addParticles(m.x + (enemy.colPos + 0.5) * m.cell, m.y + (enemy.row + 0.5) * m.cell, '#f87171');
        enemy.colPos = -9;
        s.score += 100;
        if (s.drainTimer > 0) s.hp++;
        kills++;
      }
      if (kills > 0) { if (s.score % 500 === 0) s.wave++; playScore(); updateHud(); }
      showMessage('NUKE — all viruses wiped!', 1500);
    } else if (type === 'barrage') {
      for (let i = 0; i < 3; i++) fireBullet(undefined, { power: 2, big: true, pierce: true });
      showMessage('Barrage — 3 piercing shots on your row!', 1500);
    } else if (type === 'warpback') {
      for (const enemy of s.enemies) { enemy.colPos = 5.6; enemy.flash = 0.15; }
      showMessage('Warp Back — all viruses sent to the edge!', 1500);
    } else if (type === 'purge') {
      let kills = 0;
      for (const enemy of s.enemies) {
        if (enemy.hp <= 1 || (enemy.genome?.fusionLevel ?? 0) > 0 || (enemy.genome?.mutations.length ?? 0) >= 4) {
          if (m) addParticles(m.x + (enemy.colPos + 0.5) * m.cell, m.y + (enemy.row + 0.5) * m.cell, '#c4b5fd');
          enemy.colPos = -9;
          s.score += 100;
          if (s.drainTimer > 0) s.hp++;
          kills++;
        }
      }
      if (kills > 0) { if (s.score % 500 === 0) s.wave++; playScore(); updateHud(); }
      showMessage(`Purge erased ${kills} weakened virus${kills !== 1 ? 'es' : ''}!`, 1500);
    } else if (type === 'armor') {
      s.shieldCharges = Math.min(s.shieldCharges + 3, 9);
      showMessage('Armor — 3 shield charges granted!', 1500);
    } else if (type === 'surge') {
      for (let row = 0; row < 3; row++) fireBullet(row, { power: 2, pierce: true });
      showMessage('Surge — piercing shot on all 3 lanes!', 1500);
    } else if (type === 'backdash') {
      for (const enemy of s.enemies) { enemy.colPos = Math.min(5.8, enemy.colPos + 2.0); enemy.flash = 0.1; }
      showMessage('Backdash pushed viruses back 2 cells!', 1500);
    } else if (type === 'megabomb') {
      let kills = 0;
      for (const enemy of s.enemies) {
        if (m) {
          addParticles(m.x + (enemy.colPos + 0.5) * m.cell, m.y + (enemy.row + 0.5) * m.cell, '#fde047');
          addParticles(m.x + (enemy.colPos + 0.5) * m.cell, m.y + (enemy.row + 0.5) * m.cell, '#fb923c');
        }
        enemy.colPos = -9;
        s.score += 200;
        if (s.drainTimer > 0) s.hp++;
        kills++;
      }
      if (kills > 0) { if (s.score % 500 === 0) s.wave++; playScore(); updateHud(); }
      showMessage(`MEGABOMB — ${kills} virus${kills !== 1 ? 'es' : ''} neutralized, double Integrity Work!`, 1800);
    } else if (type === 'cardflood') {
      // Give a brand-new hand immediately — reroll until at least one card is usable
      let nextOptions = randomAbilityOptions(
        s.currentCardOptions,
        enabledAbilitiesRef.current,
        s.abilityCooldowns,
        s.enemies,
        s.hp,
        synchronizedAbilityIdsRef.current,
      );
      for (let g = 0; g < 12 && nextOptions.every((id) => (s.abilityCooldowns[id] ?? 0) > 0); g++) {
        nextOptions = randomAbilityOptions(
          nextOptions,
          enabledAbilitiesRef.current,
          s.abilityCooldowns,
          s.enemies,
          s.hp,
          synchronizedAbilityIdsRef.current,
        );
      }
      s.currentCardOptions = nextOptions;
      s.usedInHand = [];
      s.cardsReady = true;
      s.cardSelectionOpen = true;
      s.rotateUsedThisHand = false;
      s.cardTimer = CARD_CHARGE_TIME;
      playAbility(type);
      s.abilityCooldowns[type] = ability.cooldown;
      updateHud();
      showMessage('Card Flood — new hand dealt instantly!', 1500);
      return; // skip standard mark-used below

    // ── Timer-based ─────────────────────────────────────────────────────────
    } else if (type === 'freeze') {
      s.freezeTimer = 4;
      showMessage('Freeze — all viruses reduced to a crawl for 4s!', 1500);
    } else if (type === 'blizzard') {
      s.blizzardTimer = 10;
      showMessage('Blizzard — extreme slowdown for 10s!', 1500);
    } else if (type === 'double') {
      s.doubleTimer = 6;
      showMessage('Doubletap — double damage for 6s!', 1500);
    } else if (type === 'multishot') {
      s.multishotTimer = 5;
      showMessage('Multishot — extra bullet per trigger for 5s!', 1500);
    } else if (type === 'regen') {
      s.regenTimer = 12;
      s.regenTick = 3;
      showMessage('Regen — restoring 1 HP every 3s for 12s!', 1500);
    } else if (type === 'drain') {
      s.drainTimer = 8;
      showMessage('Leech — kills restore HP for 8s!', 1500);
    } else if (type === 'voltage') {
      s.voltageTimer = 5;
      showMessage('Voltage — big piercing bullets for 5s!', 1500);

    // ── New instant abilities ──────────────────────────────────────────────
    } else if (type === 'emp') {
      let hit = 0;
      for (const e of s.enemies) {
        if (isCyberEnemy(e)) {
          e.hp = Math.max(1, e.hp - 3);
          e.flash = 0.12;
          hit++;
        }
      }
      s.signalJamTimer = Math.max(s.signalJamTimer, 4);
      showMessage(`EMP disabled ${hit} cyber entit${hit === 1 ? 'y' : 'ies'}!`, 1500);

    } else if (type === 'snipe') {
      s.bullets.push({
        colPos: s.player.col + 0.55,
        row: s.player.row,
        speed: 16,
        power: 5,
        big: true,
        pierce: true,
        attackStyle: resolveAttackStyle(),
        effectSkin: playerSkinRef.current,
      });
      playShot();
      showMessage('Sniper — power-5 mega-shot fired!', 1200);

    } else if (type === 'gravity') {
      for (const e of s.enemies) {
        const movement = movementClassOf(e);
        if (!movement || !HEAVY_CLASSES.has(movement)) e.row = s.player.row;
        if (movement && AIR_CLASSES.has(movement)) e.colPos = Math.min(5.8, e.colPos + 0.9);
        e.flash = 0.12;
      }
      showMessage('Gravity — all viruses pulled to your row!', 1500);

    } else if (type === 'chain') {
      const sorted = [...s.enemies].filter(e => e.colPos > -1).sort((a, b) => a.colPos - b.colPos);
      if (sorted.length > 0) {
        const chainHp = sorted[0].hp;
        let kills = 0;
        for (const e of s.enemies) {
          if (e.hp === chainHp && e.colPos > -1) {
            if (m) addParticles(m.x + (e.colPos + 0.5) * m.cell, m.y + (e.row + 0.5) * m.cell, '#fde047');
            e.colPos = -9;
            s.score += 100;
            if (s.drainTimer > 0) s.hp++;
            kills++;
          }
        }
        if (kills > 0) { if (s.score % 500 === 0) s.wave++; playScore(); updateHud(); }
        showMessage(`Chain Kill — ${kills} virus${kills !== 1 ? 'es' : ''} destroyed!`, 1500);
      } else {
        showMessage('No viruses to chain!', 1000);
      }

    } else if (type === 'cluster') {
      const targets = [...s.enemies].filter(e => e.colPos > -1).sort((a, b) => a.colPos - b.colPos).slice(0, 3);
      let kills = 0;
      for (const e of targets) {
        if (m) addParticles(m.x + (e.colPos + 0.5) * m.cell, m.y + (e.row + 0.5) * m.cell, '#fb923c');
        e.colPos = -9;
        s.score += 100;
        if (s.drainTimer > 0) s.hp++;
        kills++;
      }
      if (kills > 0) { if (s.score % 500 === 0) s.wave++; playScore(); updateHud(); }
      showMessage(`Cluster — ${kills} most-advanced virus${kills !== 1 ? 'es' : ''} eliminated!`, 1500);

    } else if (type === 'rowshuffle') {
      for (const e of s.enemies) {
        const movement = movementClassOf(e);
        if (movement !== 'rooted' && movement !== 'fortress') e.row = Math.floor(Math.random() * 3);
        e.flash = 0.1;
      }
      showMessage('Row Chaos — viruses scrambled to random rows!', 1500);

    // ── New timer-based abilities ──────────────────────────────────────────
    } else if (type === 'ghost') {
      s.ghostTimer = 4;
      if (m) addParticles(m.x + (s.player.col + 0.5) * m.cell, m.y + (s.player.row + 0.5) * m.cell, '#e0f2fe');
      showMessage('Ghost Mode — invincible for 4s!', 1500);

    } else if (type === 'turret') {
      s.turretTimer = 5;
      showMessage('Turret — auto-firing all 3 rows for 5s!', 1500);

    } else if (type === 'echo') {
      s.echoTimer = 5;
      showMessage('Echo Shot — each bullet clones to adjacent row for 5s!', 1500);

    } else if (type === 'overdrive') {
      s.overdriveTimer = 4;
      showMessage('Overdrive — 2.5× virus speed, 3× Integrity Work for 4s!', 1500);

    } else if (type === 'pulse') {
      s.pulseTimer = 7;
      s.pulseTick = 0.1; // fire first pulse almost immediately
      showMessage('Pulse Wave — repulse shockwaves every 1.5s for 7s!', 1500);

    } else if (type === 'overload') {
      s.overloadTimer = 6;
      showMessage('Overload — each kill fires a bullet in that row for 6s!', 1500);

    } else if (type === 'magnet') {
      s.magnetTimer = 6;
      showMessage('Magnet — pulling viruses away for 6s!', 1500);

    } else if (type === 'berserk') {
      s.berserkTimer = 4;
      showMessage('Berserk — extreme fire rate for 4s!', 1500);

    } else if (type === 'crit') {
      s.critTimer = 5;
      showMessage('Crit Boost — 40% chance of triple damage for 5s!', 1500);
    } else if (type === 'flak') {
      let hits = 0;
      for (const e of s.enemies) {
        const movement = movementClassOf(e);
        if (movement && AIR_CLASSES.has(movement)) {
          e.hp -= 2; e.colPos = Math.min(5.8, e.colPos + 0.75); e.flash = 0.14; hits++;
          if (e.hp <= 0) { e.colPos = -9; s.score += 100; }
        }
      }
      showMessage(`Flak Grid grounded ${hits} airborne entit${hits === 1 ? 'y' : 'ies'}!`, 1500);
    } else if (type === 'groundwire') {
      let hits = 0;
      for (const e of s.enemies) {
        const movement = movementClassOf(e);
        if (movement && GROUNDED_CLASSES.has(movement)) {
          e.hp -= HEAVY_CLASSES.has(movement) ? 1 : 2;
          e.colPos = Math.min(5.8, e.colPos + (HEAVY_CLASSES.has(movement) ? 0.35 : 0.7));
          e.flash = 0.14; hits++;
          if (e.hp <= 0) { e.colPos = -9; s.score += 100; }
        }
      }
      showMessage(`Groundwire shocked ${hits} grounded entit${hits === 1 ? 'y' : 'ies'}!`, 1500);
    } else if (type === 'signaljam') {
      s.signalJamTimer = 6;
      showMessage('Signal Jam disabled cyber traits and fusion for 6s!', 1500);
    } else if (type === 'undertow') {
      let hits = 0;
      for (const e of s.enemies) {
        const movement = movementClassOf(e);
        if (movement && FLUID_CLASSES.has(movement)) {
          e.row = s.player.row; e.colPos = Math.min(5.8, e.colPos + 1.25); e.flash = 0.14; hits++;
        }
      }
      showMessage(`Undertow redirected ${hits} fluid-bodied entit${hits === 1 ? 'y' : 'ies'}!`, 1500);
    } else if (type === 'separate') {
      let split = 0;
      for (const e of s.enemies) {
        if (!e.genome || e.genome.fusionLevel <= 0) continue;
        e.genome = {
          ...e.genome,
          fusionLevel: Math.max(0, e.genome.fusionLevel - 1),
          generation: Math.max(0, e.genome.generation - 1),
          mutations: e.genome.mutations.slice(0, Math.max(0, e.genome.mutations.length - 2)),
          hpBonus: Math.max(0, e.genome.hpBonus - 1),
          fusionElement: e.genome.fusionLevel <= 1 ? undefined : e.genome.fusionElement,
        };
        e.hp = Math.max(1, Math.ceil(e.hp * 0.55));
        e.maxHp = Math.max(e.hp, Math.ceil((e.maxHp ?? e.hp) * 0.65));
        e.flash = 0.16; split++;
      }
      showMessage(`Separation destabilized ${split} fusion${split === 1 ? '' : 's'}!`, 1500);
    } else if (type === 'interceptor') {
      const target = [...s.enemies].filter((e) => e.colPos > -1)
        .sort((a, b) => (a.colPos - b.colPos) || (b.speed - a.speed))[0];
      if (target) {
        target.hp -= 6; target.flash = 0.18;
        if (target.hp <= 0) { target.colPos = -9; s.score += 100; playScore(); }
        showMessage('Interceptor struck the leading threat!', 1500);
      } else {
        showMessage('Interceptor found no target.', 1000);
      }
    } else if (type === 'stasisgate') {
      s.stasisGateTimer = 7;
      for (const e of s.enemies) e.stasisTriggered = false;
      showMessage('Stasis Gate armed at the center boundary for 7s!', 1500);
    } else if (type === 'adaptive') {
      s.adaptiveAmmoTimer = 7;
      showMessage('Adaptive Ammo matched every target anatomy for 7s!', 1500);
    } else if (type === 'ricochet') {
      for (let row = 0; row < 3; row++) fireBullet(row, { power: 2, pierce: true });
      showMessage('Ricochet covered every lane!', 1200);
    } else if (type === 'rearguard') {
      const original = eloAttackDirectionRef.current;
      fireBullet(s.player.row, { power: 3, pierce: true });
      if (playerSkinRef.current === 'gem') {
        eloAttackDirectionRef.current = original === 1 ? -1 : 1;
        fireBullet(s.player.row, { power: 3, pierce: true });
        eloAttackDirectionRef.current = original;
      } else {
        s.bullets.push({
          colPos: s.player.col - 0.55,
          row: s.player.row,
          speed: -8.5,
          power: 3,
          big: false,
          pierce: true,
          attackStyle: resolveAttackStyle(),
          effectSkin: playerSkinRef.current,
        });
      }
      showMessage('Rearguard fired in both directions!', 1200);
    } else if (type === 'arcweb') {
      const targets = living().sort((a, b) => a.colPos - b.colPos).slice(0, 4);
      targets.forEach((enemy, index) => {
        enemy.hp -= Math.max(1, 4 - index); enemy.flash = 0.16;
        if (enemy.hp <= 0) { enemy.colPos = -9; s.score += 100; }
      });
      showMessage(`Arc Web chained through ${targets.length} targets!`, 1200);
    } else if (type === 'splitter') {
      for (let row = 0; row < 3; row++) {
        fireBullet(row, { power: 2, pierce: true });
        fireBullet(row, { power: 2, pierce: true });
      }
      showMessage('Splitter launched six projectiles!', 1200);
    } else if (type === 'seeker') {
      const target = living().sort((a, b) => (a.colPos - b.colPos) || (b.hp - a.hp))[0];
      if (target) strike((enemy) => enemy === target, 5);
      showMessage(target ? 'Seeker acquired the leading threat!' : 'Seeker found no target.', 1200);
    } else if (type === 'shattershot') {
      const hits = strike((enemy) =>
        Boolean(enemy.genome?.mutations.includes('armored') || enemy.genome?.mutations.includes('resilient')),
      4, 0.35);
      showMessage(`Shattershot broke ${hits} armored targets!`, 1200);
    } else if (type === 'marksman') {
      const target = living().sort((a, b) => b.colPos - a.colPos)[0];
      if (target) strike((enemy) => enemy === target, Math.max(3, Math.ceil(target.colPos)));
      showMessage(target ? 'Marksman converted range into damage!' : 'Marksman found no target.', 1200);
    } else if (type === 'returnfire') {
      const hits = strike((enemy) => enemy.colPos <= 3.1, 3, 0.7);
      showMessage(`Return Fire struck ${hits} boundary threats!`, 1200);
    } else if (type === 'oilslick') {
      const hits = strike((enemy) => movementClassOf(enemy) === 'vehicle', 1, 1.8);
      showMessage(`Oil Slick sent ${hits} vehicles skidding!`, 1200);
    } else if (type === 'rootsnare') {
      const hits = strike((enemy) => {
        const movement = movementClassOf(enemy);
        return Boolean(movement && GROUNDED_CLASSES.has(movement));
      }, 1, 0.9);
      showMessage(`Root Snare trapped ${hits} grounded movers!`, 1200);
    } else if (type === 'sonicnet') {
      const hits = strike((enemy) => Boolean(movementClassOf(enemy) && AIR_CLASSES.has(movementClassOf(enemy)!)), 3, 0.6);
      showMessage(`Sonic Net grounded ${hits} targets!`, 1200);
    } else if (type === 'depthcharge') {
      const hits = strike((enemy) => movementClassOf(enemy) === 'burrower', 5, 0.4);
      showMessage(`Depth Charge exposed ${hits} burrowers!`, 1200);
    } else if (type === 'anchorfield') {
      const hits = strike((enemy) => Boolean(movementClassOf(enemy) && HEAVY_CLASSES.has(movementClassOf(enemy)!)), 2, 0.25);
      for (const enemy of living()) if (!HEAVY_CLASSES.has(movementClassOf(enemy)!)) enemy.colPos = Math.min(5.8, enemy.colPos + 0.75);
      showMessage(`Anchor Field locked ${hits} heavy bodies!`, 1200);
    } else if (type === 'tailclamp') {
      const hits = strike((enemy) => ['serpentine', 'aquatic'].includes(movementClassOf(enemy) ?? ''), 3, 1);
      showMessage(`Tail Clamp crippled ${hits} movers!`, 1200);
    } else if (type === 'tanglewire') {
      const hits = strike((enemy) => ['rooted', 'tentacled'].includes(movementClassOf(enemy) ?? ''), 4, 0.4);
      showMessage(`Tanglewire caught ${hits} entities!`, 1200);
    } else if (type === 'trafficjam') {
      const hits = strike((enemy) => movementClassOf(enemy) === 'vehicle' || isCyberEnemy(enemy), 2, 1.15);
      showMessage(`Traffic Jam staggered ${hits} machines!`, 1200);
    } else if (type === 'thermalshock') {
      const hits = strike((enemy) => ['thermal', 'cryo'].includes(enemy.genome?.element ?? ''), 4, 0.5);
      showMessage(`Thermal Shock fractured ${hits} affinities!`, 1200);
    } else if (type === 'circuitarc') {
      const hits = strike((enemy) =>
        enemy.genome?.element === 'voltaic'
        || ['mechanical', 'fluidic'].includes(enemy.genome?.entityType ?? ''),
      3, 0.45);
      showMessage(`Circuit Arc crossed ${hits} entities!`, 1200);
    } else if (type === 'acidetch') {
      const hits = strike((enemy) =>
        enemy.genome?.element === 'corrosive' || enemy.genome?.mutations.includes('armored') === true,
      3);
      for (const enemy of living()) {
        if (enemy.genome?.mutations.includes('armored')) {
          enemy.genome.mutations = enemy.genome.mutations.filter((mutation) => mutation !== 'armored');
        }
      }
      showMessage(`Acid Etch stripped ${hits} targets!`, 1200);
    } else if (type === 'bloombind') {
      const hits = strike((enemy) => enemy.genome?.entityType === 'botanical', 3, 0.8);
      showMessage(`Bloom Bind linked ${hits} botanical forms!`, 1200);
    } else if (type === 'radiantmark') {
      const hits = strike((enemy) =>
        enemy.genome?.element === 'void' || enemy.genome?.entityType === 'spectral',
      4, 0.4);
      showMessage(`Radiant Mark revealed ${hits} phase forms!`, 1200);
    } else if (type === 'voidaperture') {
      const target = living().sort((a, b) => a.colPos - b.colPos)[0];
      if (target) { target.hp = Math.max(1, Math.ceil(target.hp / 2)); target.colPos = 5.8; target.flash = 0.2; }
      showMessage(target ? 'Void Aperture returned the leader weakened!' : 'The aperture found no target.', 1200);
    } else if (type === 'kineticram') {
      const row = s.player.row;
      const hits = strike((enemy) => enemy.row === row, 2, 1.5);
      showMessage(`Kinetic Ram drove ${hits} enemies backward!`, 1200);
    } else if (type === 'elementswap') {
      const cycle = ['kinetic', 'thermal', 'cryo', 'voltaic', 'corrosive', 'radiant', 'void', 'bloom'] as const;
      for (const enemy of living()) if (enemy.genome) {
        enemy.genome.element = cycle[(cycle.indexOf(enemy.genome.element) + 1) % cycle.length];
        enemy.flash = 0.12;
      }
      showMessage('Element Swap rotated every affinity!', 1200);
    } else if (type === 'devolve') {
      let hits = 0;
      for (const enemy of living()) if (enemy.genome) {
        enemy.genome.generation = Math.max(0, enemy.genome.generation - 1);
        enemy.genome.fusionLevel = Math.max(0, enemy.genome.fusionLevel - 1);
        enemy.genome.mutations = enemy.genome.mutations.slice(0, -1);
        enemy.hp = Math.max(1, enemy.hp - 2); enemy.flash = 0.16; hits++;
      }
      showMessage(`Devolve regressed ${hits} entities!`, 1200);
    } else if (type === 'mutationlock') {
      s.signalJamTimer = Math.max(s.signalJamTimer, 8);
      showMessage('Mutation Lock suppressed adaptive traits for 8s!', 1200);
    } else if (type === 'traittheft') {
      const target = living().sort((a, b) =>
        (b.genome?.mutations.length ?? 0) - (a.genome?.mutations.length ?? 0))[0];
      if (target) {
        const traits = target.genome?.mutations.length ?? 0;
        s.hp += Math.min(3, Math.max(1, traits));
        target.genome && (target.genome.mutations = target.genome.mutations.slice(0, -1));
        target.hp = Math.max(1, target.hp - 2);
      }
      showMessage(target ? 'Trait Theft converted adaptation into vitality!' : 'No traits available.', 1200);
    } else if (type === 'quarantine') {
      const row = s.player.row;
      let offset = 0;
      for (const enemy of living().filter((item) => item.row === row)) {
        enemy.colPos = Math.min(5.8, enemy.colPos + offset * 0.55);
        offset++;
      }
      s.signalJamTimer = Math.max(s.signalJamTimer, 4);
      showMessage('Quarantine separated the current lane!', 1200);
    } else if (type === 'clonebreak') {
      const counts = new Map<string, number>();
      for (const enemy of living()) {
        const base = enemy.genome?.baseElement;
        if (base) counts.set(base, (counts.get(base) ?? 0) + 1);
      }
      const species = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
      const hits = strike((enemy) => enemy.genome?.baseElement === species, 4);
      showMessage(`Clone Break struck ${hits} related entities!`, 1200);
    } else if (type === 'hybridtax') {
      let hits = 0;
      for (const enemy of living()) if ((enemy.genome?.fusionLevel ?? 0) > 0) {
        const level = enemy.genome!.fusionLevel;
        enemy.hp -= level * 2; enemy.speed *= 0.72; enemy.flash = 0.16; hits++;
        if (enemy.hp <= 0) { enemy.colPos = -9; s.score += 100; }
      }
      showMessage(`Hybrid Tax penalized ${hits} fusions!`, 1200);
    } else if (type === 'forcedmolt') {
      let hits = 0;
      for (const enemy of living()) if (enemy.genome && enemy.genome.mutations.length > 0) {
        enemy.genome.mutations = enemy.genome.mutations.filter((mutation) => mutation !== 'armored');
        enemy.genome.mutations = enemy.genome.mutations.slice(0, Math.max(0, enemy.genome.mutations.length - 1));
        enemy.speed *= 1.18; enemy.hp = Math.max(1, enemy.hp - 2); enemy.flash = 0.16; hits++;
      }
      showMessage(`Forced Molt stripped ${hits} entities!`, 1200);
    } else if (type === 'catalyst') {
      let marked = 0;
      for (const enemy of living()) if ((enemy.genome?.fusionLevel ?? 0) > 0) {
        enemy.hp += 2; enemy.maxHp = Math.max(enemy.maxHp ?? enemy.hp, enemy.hp);
        enemy.catalystMarked = true;
        enemy.flash = 0.18; marked++;
      }
      showMessage(`Catalyst empowered ${marked} fusions for greater rewards!`, 1200);
    }

    playAbility(type);
    s.abilityCooldowns[type] = ability.cooldown;

    // Mark this card as used in the current hand (cards stay visible, dimmed)
    s.usedInHand = [...s.usedInHand, type];

    updateHud();
  }, [fireBullet, addParticles, showMessage, updateHud, registerPlaystyle, resolveAttackStyle]);

  // Rotate hand: reset the bar timer so it charges up and deals a fresh hand when full
  const rotateHand = useCallback(() => {
    const s = stateRef.current;
    if (!s.running) return;
    if (s.rotateUsedThisHand) return;
    // Guard: disabled once all cards in the current hand have been used
    const allUsed = s.cardsReady && s.currentCardOptions.length > 0 &&
      s.currentCardOptions.every((id) => s.usedInHand.includes(id));
    if (allUsed) return;
    ensureAudio();
    registerPlaystyle('rotation');
    s.rotateUsedThisHand = true;
    s.cardsReady = false;
    s.cardSelectionOpen = false;
    s.cardTimer = 0;
    s.usedInHand = [];
    if (cardBarFillRef.current) cardBarFillRef.current.style.width = '0%';
    updateHud();
    showMessage('Timer reset — new hand incoming!', 1500);
  }, [showMessage, updateHud, registerPlaystyle]);

  const chooseRunUpgrade = useCallback((id: string) => {
    const s = stateRef.current;
    if (!s.upgradeSelectionOpen || !s.upgradeOptions.includes(id)) return;
    const upgrade = RUN_UPGRADES.find((candidate) => candidate.id === id);
    if (!upgrade) return;
    const nextLevel = Math.min(upgrade.maxLevel, (s.runUpgrades[id] ?? 0) + 1);
    s.runUpgrades[id] = nextLevel;
    if (id === 'repairWeave') s.hp += 2;
    if (id === 'barrierArray') s.shieldCharges += 2;
    s.upgradePromptOpen = false;
    s.upgradePromptTimer = 0;
    s.upgradeRetryWave = 0;
    s.nextUpgradeWave = Math.max(s.nextUpgradeWave, s.wave + UPGRADE_INTERVAL_WAVES);
    s.upgradeSelectionOpen = false;
    s.upgradeOptions = [];
    upgradeSelectionRef.current = 0;
    setUpgradeSelection(0);
    showMessage(`${upgrade.name} level ${nextLevel} installed!`, 1800);
    updateHud();
  }, [showMessage, updateHud]);

  const openUpgradeSelection = useCallback(() => {
    const s = stateRef.current;
    if (!s.upgradePromptOpen || s.upgradeOptions.length === 0) return;
    s.upgradePromptOpen = false;
    s.upgradePromptTimer = 0;
    s.upgradeSelectionOpen = true;
    upgradeSelectionRef.current = 0;
    setUpgradeSelection(0);
    menuNavCooldownRef.current = 0;
    updateHud();
  }, [updateHud]);

  const closeUpgradeSelection = useCallback(() => {
    const s = stateRef.current;
    if (!s.upgradeSelectionOpen) return;
    s.upgradeSelectionOpen = false;
    s.upgradePromptOpen = false;
    s.upgradePromptTimer = 0;
    s.upgradeRetryWave = s.wave + UPGRADE_RETRY_WAVES;
    showMessage(`Evolution deferred · returns at wave ${s.upgradeRetryWave}.`, 1500);
    updateHud();
  }, [showMessage, updateHud]);

  const moveBestiarySelection = useCallback((direction: number) => {
    const count = bestiaryRef.current.length;
    if (count <= 0) return;
    bestiarySelectionRef.current = (bestiarySelectionRef.current + direction + count) % count;
    setBestiarySelection(bestiarySelectionRef.current);
    document.getElementById(`bestiaryEntry-${bestiarySelectionRef.current}`)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, []);

  const scrollMenuTargetIntoView = useCallback((target: Element | null) => {
    const menu = document.getElementById('mainMenu');
    if (!menu || !target) return;
    const skinRow = target.closest<HTMLElement>('#skinPickerRow');
    if (skinRow && target instanceof HTMLElement) {
      // Safari can update the selected button without repainting an
      // overflow row moved during the controller frame. Reposition after
      // WebKit commits layout, then repeat once after its momentum layer.
      const centerSkin = () => {
        const skinRowRect = skinRow.getBoundingClientRect();
        const skinTargetRect = target.getBoundingClientRect();
        const targetLeft =
          skinRow.scrollLeft + skinTargetRect.left - skinRowRect.left;
        const centeredLeft =
          targetLeft - (skinRow.clientWidth - skinTargetRect.width) / 2;
        skinRow.scrollTo({
          left: Math.max(
            0,
            Math.min(centeredLeft, skinRow.scrollWidth - skinRow.clientWidth),
          ),
          behavior: 'auto',
        });
      };
      centerSkin();
      requestAnimationFrame(() => {
        centerSkin();
        requestAnimationFrame(centerSkin);
      });
    }
    let horizontalScroller: HTMLElement | null = target.parentElement;
    while (horizontalScroller && horizontalScroller !== menu) {
      if (horizontalScroller.scrollWidth > horizontalScroller.clientWidth + 1) break;
      horizontalScroller = horizontalScroller.parentElement;
    }
    if (horizontalScroller && horizontalScroller !== menu) {
      const scrollerRect = horizontalScroller.getBoundingClientRect();
      const horizontalTargetRect = target.getBoundingClientRect();
      const horizontalPadding = 12;
      if (horizontalTargetRect.right > scrollerRect.right - horizontalPadding) {
        horizontalScroller.scrollLeft +=
          horizontalTargetRect.right - scrollerRect.right + horizontalPadding;
      } else if (horizontalTargetRect.left < scrollerRect.left + horizontalPadding) {
        horizontalScroller.scrollLeft +=
          horizontalTargetRect.left - scrollerRect.left - horizontalPadding;
      }
    }
    const menuRect = menu.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const padding = 18;
    if (targetRect.bottom > menuRect.bottom - padding) {
      menu.scrollTop += targetRect.bottom - menuRect.bottom + padding;
    } else if (targetRect.top < menuRect.top + padding) {
      menu.scrollTop += targetRect.top - menuRect.top - padding;
    }
  }, []);

  const scrollMenuByDpad = useCallback((direction: number) => {
    const menu = document.getElementById('mainMenu');
    if (!menu) return;
    menu.scrollTop += direction * Math.max(96, menu.clientHeight * 0.55);
  }, []);

  const disperseClone = useCallback((direction: CloneDirection, returnControl: boolean) => {
    const expiryTimer = cloneExpiryTimersRef.current[direction];
    if (expiryTimer) clearTimeout(expiryTimer);
    cloneExpiryTimersRef.current[direction] = null;
    const autoFireTimer = cloneAutoFireTimersRef.current[direction];
    if (autoFireTimer) clearInterval(autoFireTimer);
    cloneAutoFireTimersRef.current[direction] = null;
    const current = cloneSessionRef.current;
    if (current.statuses[direction] === 'gone' || current.statuses[direction] === 'dispersing') return;
    const dispersing: CloneView = {
      ...current,
      inputActive: returnControl ? false : current.inputActive,
      statuses: { ...current.statuses, [direction]: 'dispersing' },
    };
    cloneSessionRef.current = dispersing;
    setCloneView(dispersing);
    const existing = cloneActionTimersRef.current[direction];
    if (existing) clearTimeout(existing);
    cloneActionTimersRef.current[direction] = setTimeout(() => {
      const latest = cloneSessionRef.current;
      const statuses = { ...latest.statuses, [direction]: 'gone' as CloneStatus };
      const visible = statuses.north !== 'gone' || statuses.south !== 'gone';
      const settled: CloneView = {
        ...latest,
        visible,
        playerLocked: returnControl ? false : latest.playerLocked,
        statuses,
      };
      cloneSessionRef.current = settled;
      setCloneView(settled);
      cloneActionTimersRef.current[direction] = null;
      if (returnControl) showMessage('Clone sequence complete — Player control restored.', 1100);
    }, 360);
  }, [showMessage]);

  const scheduleCloneExpiry = useCallback((direction: CloneDirection) => {
    const existing = cloneExpiryTimersRef.current[direction];
    if (existing) clearTimeout(existing);
    cloneExpiryTimersRef.current[direction] = setTimeout(() => {
      cloneExpiryTimersRef.current[direction] = null;
      const latest = cloneSessionRef.current;
      const other: CloneDirection = direction === 'north' ? 'south' : 'north';
      const otherAvailable = latest.rows[other] !== null
        && latest.statuses[other] !== 'gone'
        && latest.statuses[other] !== 'dispersing';
      disperseClone(direction, !otherAvailable);
    }, 3000);
  }, [disperseClone]);

  const advanceToSecondClone = useCallback((from: CloneDirection, expirePrevious = false) => {
    const next: CloneDirection = from === 'north' ? 'south' : 'north';
    const clone = cloneSessionRef.current;
    if (clone.rows[next] === null || clone.statuses[next] === 'gone') {
      if (expirePrevious) scheduleCloneExpiry(from);
      cloneSessionRef.current = { ...clone, inputActive: false, playerLocked: false };
      setCloneView(cloneSessionRef.current);
      showMessage('Player control restored.', 1000);
      return;
    }
    const nextExpiry = cloneExpiryTimersRef.current[next];
    if (nextExpiry) clearTimeout(nextExpiry);
    cloneExpiryTimersRef.current[next] = null;
    if (expirePrevious) scheduleCloneExpiry(from);
    const advanced: CloneView = {
      ...clone,
      inputActive: true,
      controlled: next,
      turn: 1,
      statuses: {
        ...clone.statuses,
        [from]: clone.statuses[from] === 'attacking' ? 'idle' : clone.statuses[from],
      },
    };
    cloneSessionRef.current = advanced;
    setCloneView(advanced);
    showMessage('Clone controlled · X Attack · B Defend', 1200);
  }, [scheduleCloneExpiry, showMessage]);

  const holdCloneDefenseFrame = useCallback((direction: CloneDirection) => {
    const existing = cloneActionTimersRef.current[direction];
    if (existing) clearTimeout(existing);
    cloneActionTimersRef.current[direction] = setTimeout(() => {
      const latest = cloneSessionRef.current;
      if (latest.statuses[direction] !== 'defending') {
        cloneActionTimersRef.current[direction] = null;
        return;
      }
      const held: CloneView = {
        ...latest,
        statuses: { ...latest.statuses, [direction]: 'defendingHeld' },
      };
      cloneSessionRef.current = held;
      setCloneView(held);
      cloneActionTimersRef.current[direction] = null;
    }, 800);
  }, []);

  const resolveCloneAction = useCallback((action: 'attack' | 'defend') => {
    const clone = cloneSessionRef.current;
    if (!clone.inputActive) return;
    const direction = clone.controlled;
    const row = clone.rows[direction];
    if (row === null) return;
    const persistentAutoFire = cloneAutoFireTimersRef.current[direction];
    if (persistentAutoFire) clearInterval(persistentAutoFire);
    cloneAutoFireTimersRef.current[direction] = null;
    const persistentDefense = cloneActionTimersRef.current[direction];
    if (persistentDefense) clearTimeout(persistentDefense);
    cloneActionTimersRef.current[direction] = null;
    const firstAction = clone.turn === 0;
    const other: CloneDirection = direction === 'north' ? 'south' : 'north';
    const openingBlock = action === 'attack'
      && firstAction
      && performance.now() <= cloneOpeningWindowRef.current
      && clone.rows[other] !== null
      && clone.statuses[other] !== 'gone'
      && clone.statuses[other] !== 'dispersing';
    const status: CloneStatus = action === 'attack' ? 'attacking' : 'defending';
    if (action === 'defend') registerPlaystyle('cloneDefense');
    const committed: CloneView = {
      ...clone,
      inputActive: false,
      statuses: {
        ...clone.statuses,
        [direction]: status,
        ...(openingBlock ? { [other]: 'defending' as CloneStatus } : {}),
      },
    };
    cloneSessionRef.current = committed;
    setCloneView(committed);
    if (openingBlock) holdCloneDefenseFrame(other);

    if (action === 'attack') {
      const activeExpiry = cloneExpiryTimersRef.current[direction];
      if (activeExpiry) clearTimeout(activeExpiry);
      cloneExpiryTimersRef.current[direction] = null;
      fireBullet(row, {
        power: 3,
        big: true,
        pierce: true,
        originCol: clone.cols[direction] ?? stateRef.current.player.col,
      });
      showMessage('Clone attacked.', 700);
      const existing = cloneActionTimersRef.current[direction];
      if (existing) clearTimeout(existing);
      cloneActionTimersRef.current[direction] = setTimeout(() => {
        cloneActionTimersRef.current[direction] = null;
        const latest = cloneSessionRef.current;
        const refreshed: CloneView = {
          ...latest,
          inputActive: true,
          controlled: direction,
          statuses: { ...latest.statuses, [direction]: 'idle' },
        };
        cloneSessionRef.current = refreshed;
        setCloneView(refreshed);
        scheduleCloneExpiry(direction);
      }, 520);
    } else if (firstAction) {
      holdCloneDefenseFrame(direction);
      showMessage('Clone defending until hit.', 850);
      advanceToSecondClone(direction);
    } else {
      holdCloneDefenseFrame(direction);
      const released: CloneView = {
        ...cloneSessionRef.current,
        inputActive: false,
        playerLocked: false,
      };
      cloneSessionRef.current = released;
      setCloneView(released);
      showMessage('Clone guarding — Player control restored.', 1200);
    }
  }, [advanceToSecondClone, fireBullet, holdCloneDefenseFrame, scheduleCloneExpiry, showMessage, registerPlaystyle]);

  const moveControlledClone = useCallback((dx: number, dy: number) => {
    let clone = cloneSessionRef.current;
    if (!clone.inputActive) return;
    const direction = clone.controlled;
    if (clone.statuses[direction] === 'autofiring'
      || clone.statuses[direction] === 'defending'
      || clone.statuses[direction] === 'defendingHeld') {
      const autoFireTimer = cloneAutoFireTimersRef.current[direction];
      if (autoFireTimer) clearInterval(autoFireTimer);
      cloneAutoFireTimersRef.current[direction] = null;
      const defenseTimer = cloneActionTimersRef.current[direction];
      if (defenseTimer) clearTimeout(defenseTimer);
      cloneActionTimersRef.current[direction] = null;
      clone = {
        ...clone,
        statuses: { ...clone.statuses, [direction]: 'idle' },
      };
      cloneSessionRef.current = clone;
      setCloneView(clone);
    }
    const row = clone.rows[direction];
    const col = clone.cols[direction];
    if (row === null || col === null || clone.statuses[direction] !== 'idle') return;
    const nextRow = Math.max(0, Math.min(2, row + dy));
    const nextCol = Math.max(0, Math.min(2, col + dx));
    if (nextRow === row && nextCol === col) return;
    const moved: CloneView = {
      ...clone,
      rows: { ...clone.rows, [direction]: nextRow },
      cols: { ...clone.cols, [direction]: nextCol },
    };
    cloneSessionRef.current = moved;
    setCloneView(moved);
    playMove();
  }, []);

  const moveControlledCloneTo = useCallback((col: number, row: number) => {
    let clone = cloneSessionRef.current;
    if (!clone.inputActive) return;
    const direction = clone.controlled;
    if (clone.statuses[direction] === 'autofiring'
      || clone.statuses[direction] === 'defending'
      || clone.statuses[direction] === 'defendingHeld') {
      const autoFireTimer = cloneAutoFireTimersRef.current[direction];
      if (autoFireTimer) clearInterval(autoFireTimer);
      cloneAutoFireTimersRef.current[direction] = null;
      const defenseTimer = cloneActionTimersRef.current[direction];
      if (defenseTimer) clearTimeout(defenseTimer);
      cloneActionTimersRef.current[direction] = null;
      clone = {
        ...clone,
        statuses: { ...clone.statuses, [direction]: 'idle' },
      };
      cloneSessionRef.current = clone;
      setCloneView(clone);
    }
    if (clone.rows[direction] === null || clone.cols[direction] === null
      || clone.statuses[direction] !== 'idle') return;
    const nextRow = Math.max(0, Math.min(2, row));
    const nextCol = Math.max(0, Math.min(2, col));
    if (clone.rows[direction] === nextRow && clone.cols[direction] === nextCol) return;
    const moved: CloneView = {
      ...clone,
      rows: { ...clone.rows, [direction]: nextRow },
      cols: { ...clone.cols, [direction]: nextCol },
    };
    cloneSessionRef.current = moved;
    setCloneView(moved);
    playMove();
  }, []);

  const switchCloneControl = useCallback(() => {
    const clone = cloneSessionRef.current;
    if (!clone.inputActive) return;
    const direction = clone.controlled;
    const next: CloneDirection = direction === 'north' ? 'south' : 'north';
    const nextIsDefending = clone.statuses[next] === 'defending'
      || clone.statuses[next] === 'defendingHeld';
    if (nextIsDefending) {
      const sourceExpiry = cloneExpiryTimersRef.current[direction];
      if (sourceExpiry) clearTimeout(sourceExpiry);
      cloneExpiryTimersRef.current[direction] = null;
      const nextExpiry = cloneExpiryTimersRef.current[next];
      if (nextExpiry) clearTimeout(nextExpiry);
      cloneExpiryTimersRef.current[next] = null;
      const switched: CloneView = {
        ...clone,
        controlled: next,
        inputActive: true,
        statuses: {
          ...clone.statuses,
          [direction]: 'defending',
          [next]: 'idle',
        },
      };
      cloneSessionRef.current = switched;
      setCloneView(switched);
      holdCloneDefenseFrame(direction);
      showMessage('Control switched · previous clone defending.', 1100);
      return;
    }
    advanceToSecondClone(direction, true);
  }, [advanceToSecondClone, holdCloneDefenseFrame, showMessage]);

  const cycleActiveControl = useCallback((direction: 1 | -1 = 1) => {
    const clone = cloneSessionRef.current;
    if (!clone.visible || !clone.revealed) return;
    const available = (direction: CloneDirection) =>
      clone.rows[direction] !== null
      && clone.statuses[direction] !== 'gone'
      && clone.statuses[direction] !== 'dispersing';
    const controls: Array<'player' | CloneDirection> = ['player'];
    if (available('north')) controls.push('north');
    if (available('south')) controls.push('south');
    if (controls.length <= 1) return;
    const current: 'player' | CloneDirection =
      clone.playerLocked && clone.inputActive ? clone.controlled : 'player';
    const currentIndex = Math.max(0, controls.indexOf(current));
    const target = controls[(currentIndex + direction + controls.length) % controls.length];
    const cycled: CloneView = target === 'player'
      ? { ...clone, inputActive: false, playerLocked: false }
      : { ...clone, controlled: target, inputActive: true, playerLocked: true };
    cloneSessionRef.current = cycled;
    setCloneView(cycled);
    showMessage(target === 'player' ? 'Player control active.' : 'Clone control active.', 800);
  }, [showMessage]);

  const queueR2ControlCycle = useCallback(() => {
    if (r2TapTimerRef.current) {
      clearTimeout(r2TapTimerRef.current);
      r2TapTimerRef.current = null;
      cycleActiveControl(-1);
      return;
    }
    r2TapTimerRef.current = setTimeout(() => {
      r2TapTimerRef.current = null;
      cycleActiveControl(1);
    }, 260);
  }, [cycleActiveControl]);

  const finishRivalSkill = useCallback((release = true) => {
    const active = rivalSkillRef.current;
    if (!active.active || !active.id) return;
    const s = stateRef.current;
    if (release) {
      if (active.id === 'chrono') {
        const queuedRows = active.placements.length > 0
          ? active.placements
          : [s.player.row];
        for (const row of queuedRows) {
          fireBullet(row, { power: 2, big: true, pierce: true });
        }
      } else if (active.id === 'singularity') {
        for (const enemy of s.enemies) {
          enemy.colPos = Math.min(5.8, enemy.colPos + 1.4);
          enemy.hp -= 3 + active.charges;
          enemy.flash = 0.2;
        }
        s.enemies = s.enemies.filter((enemy) => enemy.hp > 0);
      } else if (active.id === 'override') {
        const hosts = [...s.enemies].sort((a, b) => b.hp - a.hp);
        const host = hosts[active.mode % Math.max(1, hosts.length)];
        if (host) {
          for (let row = 0; row < 3; row++) {
            fireBullet(row, { power: Math.max(2, host.hp), big: true, pierce: true });
          }
          host.hp = 0;
          s.enemies = s.enemies.filter((enemy) => enemy.hp > 0);
        }
      } else if (active.id === 'architect') {
        const cannons = active.placements.filter((node) => node < 3).length;
        const relays = active.placements.filter((node) => node >= 3 && node < 6).length;
        const barriers = active.placements.filter((node) => node >= 6).length;
        if (cannons > 0) s.turretTimer = Math.max(s.turretTimer, 4 + cannons * 2);
        if (relays > 0) s.ghostTimer = Math.max(s.ghostTimer, 1 + relays);
        s.shieldCharges += barriers;
        if (active.placements.length === 0) s.shieldCharges++;
      } else if (active.id === 'apex') {
        const modes = ['breaker', 'reflector', 'nullifier'];
        const form = modes[active.mode % modes.length];
        if (form === 'breaker') s.pierceShots += 12;
        if (form === 'reflector') s.shieldCharges += 3;
        if (form === 'nullifier') s.signalJamTimer = Math.max(s.signalJamTimer, 8);
      } else if (active.id === 'counter') {
        if (active.charges > 0) {
          for (let row = 0; row < 3; row++) {
            fireBullet(row, { power: 2 + active.charges, big: true, pierce: true });
          }
        }
      } else if (active.id === 'phase') {
        const marked = [...s.enemies].sort((a, b) => b.hp - a.hp).slice(0, 3 + active.charges);
        const markedSet = new Set(marked);
        s.enemies = s.enemies.filter((enemy) => !markedSet.has(enemy));
        s.score += marked.length * 100;
      } else if (active.id === 'phoenix') {
        const heat = Math.max(1, active.charges);
        for (let row = 0; row < 3; row++) {
          fireBullet(row, { power: 2 + heat, big: true, pierce: heat >= 3 });
        }
      } else if (active.id === 'rift') {
        const rows = active.placements.length >= 2 ? active.placements.slice(0, 2) : [0, 2];
        for (const row of rows) fireBullet(row, { power: 4, big: true, pierce: true });
        for (const enemy of s.enemies) {
          if (rows.includes(enemy.row)) {
            enemy.hp -= 3;
            enemy.colPos = Math.min(5.8, enemy.colPos + 0.8);
          }
        }
        s.enemies = s.enemies.filter((enemy) => enemy.hp > 0);
      } else if (active.id === 'vector') {
        for (const enemy of s.enemies) {
          enemy.colPos = Math.min(5.8, enemy.colPos + 0.7 + active.charges * 0.18);
          enemy.speed = Math.max(enemy.speed, 0.38);
          enemy.flash = 0.18;
        }
      } else if (active.id === 'gridshift') {
        for (const enemy of s.enemies) enemy.speed = Math.max(enemy.speed, 0.35);
        s.pulseTimer = Math.max(s.pulseTimer, 2.5);
      } else if (active.id === 'resonance') {
        const marks = active.placements.slice(0, 3);
        const rows = marks.map((cell) => cell % 3);
        const cols = marks.map((cell) => Math.floor(cell / 3));
        if (marks.length === 3 && new Set(rows).size === 1) {
          for (let i = 0; i < 3; i++) fireBullet(rows[0], { power: 3, big: true, pierce: true });
        } else if (marks.length === 3 && new Set(cols).size === 1) {
          s.overclockTimer = Math.max(s.overclockTimer, 6);
        } else if (new Set(rows).size === 3) {
          for (let row = 0; row < 3; row++) fireBullet(row, { power: 3, big: true });
        } else {
          s.shieldCharges += Math.max(1, marks.length);
          s.pulseTimer = Math.max(s.pulseTimer, 3);
        }
      } else if (active.id === 'exchange') {
        if (active.mode === 0) s.overclockTimer = Math.max(s.overclockTimer, 6);
        else if (active.mode === 1) s.shieldCharges += 3;
        else s.regenTimer = Math.max(s.regenTimer, 7);
      } else if (active.id === 'causality') {
        if (active.mode === 0) s.hp = Math.max(s.hp, active.origin.hp);
        else if (active.mode === 1) {
          s.player.col = active.origin.col;
          s.player.row = active.origin.row;
        } else {
          for (let row = 0; row < 3; row++) fireBullet(row, { power: 3, big: true, pierce: true });
        }
      } else if (active.id === 'arsenal') {
        const counts = [0, 1, 2].map((branch) =>
          active.placements.filter((choice) => choice === branch).length);
        const branch = counts.indexOf(Math.max(...counts));
        if (branch === 0) s.pierceShots += 8 + counts[0] * 2;
        else if (branch === 1) {
          s.shieldCharges += 2 + counts[1];
          s.turretTimer = Math.max(s.turretTimer, 4);
        } else {
          s.overclockTimer = Math.max(s.overclockTimer, 5 + counts[2]);
          s.ghostTimer = Math.max(s.ghostTimer, 1.5);
        }
      } else if (active.id === 'assimilation') {
        const power = Math.max(2, active.charges);
        for (let row = 0; row < 3; row++) {
          fireBullet(row, { power, big: true, pierce: active.mode === 1 });
        }
        if (active.mode === 2) s.regenTimer = Math.max(s.regenTimer, 6);
      } else if (active.id === 'null') {
        for (const enemy of s.enemies) {
          enemy.abilityCooldown = Math.max(enemy.abilityCooldown ?? 0, 7);
          enemy.flash = 0.2;
        }
        s.signalJamTimer = Math.max(s.signalJamTimer, 7);
      } else if (active.id === 'polarity') {
        for (const enemy of s.enemies) {
          enemy.colPos = Math.min(5.8, enemy.colPos + 0.7);
          enemy.hp -= Math.max(1, active.charges);
        }
        s.enemies = s.enemies.filter((enemy) => enemy.hp > 0);
      } else if (active.id === 'colossus') {
        s.shieldCharges += 2 + active.charges;
        s.turretTimer = Math.max(s.turretTimer, 5);
        fireBullet(undefined, { power: 6, big: true, pierce: true });
      } else if (active.id === 'predator') {
        const prey = [...s.enemies].sort((a, b) => b.hp - a.hp)[0];
        if (prey) {
          s.score += 150;
          s.enemies = s.enemies.filter((enemy) => enemy !== prey);
        }
        s.pierceShots += 3 + active.charges;
      } else if (active.id === 'orbital') {
        const rows = active.placements.length ? active.placements : [0, 1, 2];
        for (const row of rows) fireBullet(row, { power: 5, big: true, pierce: true });
        s.pulseTimer = Math.max(s.pulseTimer, 4);
      } else if (active.id === 'hijack') {
        for (const enemy of s.enemies) {
          enemy.colPos = Math.min(5.8, enemy.colPos + 0.9);
          enemy.row = (enemy.row + active.mode + 1) % 3;
          enemy.flash = 0.2;
        }
      } else if (active.id === 'sovereign') {
        const missing = Math.max(0, 10 - s.hp);
        for (let row = 0; row < 3; row++) {
          fireBullet(row, { power: 3 + missing, big: true, pierce: true });
        }
        s.shieldCharges += Math.max(1, Math.floor(missing / 2));
      }
    }
    if (active.id === 'chrono') s.slowTimer = 0;
    if (active.id === 'phase') s.ghostTimer = 0;
    const cleared = emptyRivalSkillView();
    rivalSkillRef.current = cleared;
    setRivalSkillView(cleared);
    showMessage(`${RIVAL_SKILL_LABELS[active.id]} complete.`, 900);
    updateHud();
  }, [fireBullet, showMessage, updateHud]);

  const resolveRivalSkillAction = useCallback((action: 'primary' | 'alternate' | 'defend') => {
    const active = rivalSkillRef.current;
    if (!active.active || !active.id) return;
    const s = stateRef.current;
    let next = {
      ...active,
      actionTick: active.actionTick + 1,
      lastAction: action,
    };
    if (active.id === 'chrono') {
      if (action === 'primary') {
        if (next.placements.length < 5) next.placements = [...next.placements, s.player.row];
        next.charges = next.placements.length;
        showMessage(`Attack queued ×${next.charges}.`, 700);
      } else if (action === 'alternate') {
        if (next.chronoPositions.length < 2) {
          showMessage('Move first to record another Time Step.', 900);
        } else {
          const index = (next.chronoPositionIndex + 1) % next.chronoPositions.length;
          const destination = next.chronoPositions[index];
          s.player.col = destination.col;
          s.player.row = destination.row;
          s.moveFlash = 0.15;
          next.chronoPositionIndex = index;
          showMessage(`Time Step ${index + 1}/${next.chronoPositions.length}.`, 700);
        }
      } else {
        s.player.col = active.origin.col;
        s.player.row = active.origin.row;
        s.hp = Math.max(s.hp, active.origin.hp);
        showMessage('Timeline rewound.', 750);
      }
    } else if (active.id === 'singularity') {
      if (action === 'primary') {
        for (const enemy of s.enemies) {
          if (next.mode === 0) {
            enemy.row += Math.sign(s.player.row - enemy.row);
            enemy.colPos = Math.max(-0.4, enemy.colPos - 0.45);
          } else {
            if (enemy.row === s.player.row) enemy.row = enemy.row === 0 ? 1 : enemy.row - 1;
            enemy.colPos = Math.min(5.8, enemy.colPos + 0.9);
          }
          enemy.hp -= enemy.row === s.player.row ? 2 : 1;
          enemy.flash = 0.15;
        }
        s.enemies = s.enemies.filter((enemy) => enemy.hp > 0);
        next.charges++;
        showMessage(next.mode === 0 ? 'Gravity collapse.' : 'Repulsion burst.', 700);
      } else if (action === 'alternate') {
        next.mode = next.mode ? 0 : 1;
        showMessage(next.mode ? 'Polarity: REPEL' : 'Polarity: ATTRACT', 800);
      } else {
        s.shieldCharges++;
        next.charges++;
        showMessage('Event Guard captured pressure.', 800);
      }
    } else if (active.id === 'override') {
      const hosts = [...s.enemies].sort((a, b) => b.hp - a.hp);
      const host = hosts[active.mode % Math.max(1, hosts.length)];
      if (action === 'primary' && host) {
        if (host.ability === 'mendingPulse') {
          s.hp++;
          showMessage('Host mending pulse appropriated.', 800);
        } else if (host.ability === 'laneShift') {
          for (let row = 0; row < 3; row++) fireBullet(row, { power: 2, big: true });
          showMessage('Host lane attack appropriated.', 800);
        } else {
          fireBullet(host.row, {
            power: host.ability === 'momentumCharge' ? Math.max(4, Math.ceil(host.hp / 2)) : 2,
            big: host.ability === 'momentumCharge' || host.ability === 'arcArmor',
            pierce: host.ability === 'phaseLeap' || host.ability === 'arcArmor',
          });
          if (host.ability === 'arcArmor') s.shieldCharges++;
          showMessage(`${host.ability ? 'Constitution' : 'Native'} attack appropriated.`, 800);
        }
      } else if (action === 'alternate') {
        if (hosts.length === 0) showMessage('No eligible host to transfer into.', 800);
        else {
          next.mode = (next.mode + 1) % hosts.length;
          showMessage('Control transferred.', 700);
        }
      } else if (host) {
        s.shieldCharges++;
        s.enemies = s.enemies.filter((enemy) => enemy !== host);
        showMessage('Host sacrificed to intercept.', 850);
      } else {
        showMessage('No eligible host.', 700);
      }
    } else if (active.id === 'architect') {
      if (action === 'primary') {
        if (next.placements.length >= 3) showMessage('Network full · execute or expire.', 800);
        else {
          next.placements = [...next.placements, s.player.row];
          next.charges = next.placements.length;
          showMessage('Cannon node placed.', 700);
        }
      } else if (action === 'alternate') {
        if (next.placements.length >= 3) showMessage('Network full · execute or expire.', 800);
        else {
          next.placements = [...next.placements, 3 + s.player.row];
          next.charges = next.placements.length;
          s.player.row = (s.player.row + 1) % 3;
          showMessage('Relay node placed · linked jump.', 700);
        }
      } else {
        if (next.placements.length >= 3) showMessage('Network full · execute or expire.', 800);
        else {
          next.placements = [...next.placements, 6 + s.player.row];
          next.charges = next.placements.length;
          showMessage('Barrier node placed.', 700);
        }
      }
    } else if (active.id === 'apex') {
      if (action === 'alternate') {
        next.mode = (next.mode + 1) % 3;
        showMessage(`Counter-form: ${['BREAKER', 'REFLECTOR', 'NULLIFIER'][next.mode]}`, 900);
      } else if (action === 'primary') {
        if (next.mode === 0) fireBullet(undefined, { power: 5, big: true, pierce: true });
        else if (next.mode === 1) s.pulseTimer = Math.max(s.pulseTimer, 3);
        else s.signalJamTimer = Math.max(s.signalJamTimer, 4);
      } else {
        if (next.mode === 0) s.ghostTimer = Math.max(s.ghostTimer, 1.5);
        else if (next.mode === 1) s.shieldCharges += 2;
        else s.hp++;
        showMessage('Defensive adaptation expressed.', 800);
      }
    } else if (active.id === 'counter') {
      if (action === 'primary') {
        if (next.charges <= 0) showMessage('Matrix empty · intercept pressure first.', 800);
        else {
          fireBullet(next.mode, { power: 2 + next.charges, big: true, pierce: true });
          next.charges = 0;
          showMessage('Captured force returned.', 750);
        }
      } else if (action === 'alternate') {
        next.mode = (next.mode + 1) % 3;
        showMessage(`Return lane redirected to ${next.mode + 1}.`, 650);
      } else {
        if (next.charges <= 0) showMessage('No captured pressure to convert.', 800);
        else {
          s.shieldCharges += Math.ceil(next.charges / 2);
          if (next.charges >= 3) s.hp++;
          next.charges = 0;
          showMessage('Captured pressure converted.', 800);
        }
      }
    } else if (active.id === 'phase') {
      const targets = [...s.enemies].sort((a, b) => b.hp - a.hp);
      const target = targets[active.mode % Math.max(1, targets.length)];
      if (action === 'primary' && target) {
        s.player.row = target.row;
        target.hp -= 6;
        target.flash = 0.2;
        s.enemies = s.enemies.filter((enemy) => enemy.hp > 0);
        next.charges++;
        showMessage('Phase Strike.', 650);
      } else if (action === 'primary') {
        showMessage('No marked target.', 700);
      } else if (action === 'alternate') {
        if (targets.length === 0) showMessage('No marked target.', 700);
        else {
          next.mode = (next.mode + 1) % targets.length;
          showMessage('Priority target changed.', 700);
        }
      } else {
        s.player.col = active.origin.col;
        s.player.row = active.origin.row;
        showMessage('Chain broken; unused marks retained.', 800);
      }
    } else if (active.id === 'phoenix') {
      if (action === 'primary') {
        const heat = Math.max(1, next.charges);
        fireBullet(undefined, { power: 2 + heat, big: true, pierce: heat >= 3 });
        next.charges = Math.max(0, next.charges - 2);
        showMessage(`Heat vented · ${next.charges} retained.`, 800);
      } else if (action === 'alternate') {
        next.origin = { col: s.player.col, row: s.player.row, hp: s.hp };
        showMessage('Restoration anchor moved.', 750);
      } else {
        s.player.col = next.origin.col;
        s.player.row = next.origin.row;
        s.hp = Math.max(s.hp, next.origin.hp);
        next.charges = Math.max(0, next.charges - 1);
        showMessage('Recorded state restored.', 800);
      }
    } else if (active.id === 'rift') {
      if (action === 'primary') {
        if (next.placements.length < 2) showMessage('Place both portals first.', 750);
        else {
          const destination = next.placements[next.mode % 2];
          s.player.row = destination;
          next.mode = next.mode ? 0 : 1;
          fireBullet(next.placements[next.mode], { power: 3, big: true, pierce: true });
          showMessage('Portal traversed · shot redirected.', 800);
        }
      } else if (action === 'alternate') {
        if (next.placements.length < 2) next.placements = [...next.placements, s.player.row];
        else next.placements = next.placements.map((row, index) =>
          index === next.mode ? s.player.row : row);
        next.charges = next.placements.length;
        showMessage(`Portal ${Math.min(2, next.placements.length)} anchored.`, 700);
      } else {
        s.shieldCharges++;
        next.charges++;
        showMessage('Rift reflection armed.', 700);
      }
    } else if (active.id === 'vector') {
      if (action === 'primary') {
        const targets = s.enemies.filter((enemy) => enemy.row === s.player.row);
        for (const enemy of targets) {
          enemy.colPos = Math.min(5.8, enemy.colPos + 1);
          enemy.hp--;
          enemy.flash = 0.15;
        }
        s.enemies = s.enemies.filter((enemy) => enemy.hp > 0);
        next.charges += targets.length;
        showMessage(targets.length ? 'Vectors redirected.' : 'No vector in this lane.', 700);
      } else if (action === 'alternate') {
        for (const bullet of s.bullets) bullet.speed *= 1.5;
        next.charges++;
        showMessage('Allied trajectories accelerated.', 750);
      } else {
        const targets = s.enemies.filter((enemy) => enemy.row === s.player.row);
        for (const enemy of targets) enemy.speed = Math.min(enemy.speed, 0.04);
        next.placements = [...next.placements, ...targets.map((enemy) => enemy.row)].slice(-6);
        showMessage(targets.length ? 'Lane vectors arrested.' : 'No vector to arrest.', 750);
      }
    } else if (active.id === 'gridshift') {
      const modeNames = ['ROW', 'COLUMN', 'LOCK'];
      if (action === 'alternate') {
        next.mode = (next.mode + 1) % 3;
        showMessage(`Grid operation: ${modeNames[next.mode]}.`, 700);
      } else {
        const direction = action === 'primary' ? 1 : -1;
        if (next.mode === 0) {
          for (const enemy of s.enemies.filter((candidate) => candidate.row === s.player.row)) {
            enemy.colPos = Math.max(-0.4, Math.min(5.8, enemy.colPos + direction * 0.9));
          }
          showMessage(`Row shifted ${direction > 0 ? 'right' : 'left'}.`, 700);
        } else if (next.mode === 1) {
          for (const enemy of s.enemies) enemy.row = (enemy.row + direction + 3) % 3;
          showMessage(`Enemy column cycled ${direction > 0 ? 'down' : 'up'}.`, 700);
        } else {
          for (const enemy of s.enemies.filter((candidate) => candidate.row === s.player.row)) {
            enemy.speed = 0.03;
          }
          next.placements = [s.player.row];
          showMessage('Current row locked.', 750);
        }
        next.charges++;
      }
    } else if (active.id === 'resonance') {
      const cell = s.player.col * 3 + s.player.row;
      if (action === 'primary') {
        if (next.placements.length >= 3) showMessage('Three marks placed · activate array.', 750);
        else {
          next.placements = [...next.placements, cell];
          next.charges = next.placements.length;
          showMessage(`Resonance mark ${next.charges}/3 placed.`, 700);
        }
      } else if (action === 'alternate') {
        if (next.placements.length === 0) showMessage('Place a mark first.', 700);
        else {
          next.placements = [...next.placements.slice(0, -1), cell];
          showMessage('Last resonance mark repositioned.', 700);
        }
      } else {
        if (next.placements.length < 3) showMessage('Three marks are required.', 700);
        else finishRivalSkill(true);
        return;
      }
    } else if (active.id === 'exchange') {
      const target = [...s.enemies].sort((a, b) => b.hp - a.hp)[0];
      const propertyNames = ['SPEED', 'ARMOR', 'REGENERATION'];
      if (action === 'primary') {
        next.mode = (next.mode + 1) % 3;
        showMessage(`Exchange property: ${propertyNames[next.mode]}.`, 700);
      } else if (!target) {
        showMessage('No constitution available to exchange.', 750);
      } else if (action === 'alternate') {
        if (next.mode === 0) {
          s.overclockTimer = Math.max(s.overclockTimer, 5);
          target.speed *= 0.45;
        } else if (next.mode === 1) {
          s.shieldCharges += Math.max(1, Math.floor(target.hp / 2));
          target.hp = Math.max(1, Math.ceil(target.hp / 2));
        } else {
          s.regenTimer = Math.max(s.regenTimer, 6);
          if (target.genome) target.genome.regeneration = 0;
        }
        next.charges++;
        showMessage(`${propertyNames[next.mode]} exchanged.`, 750);
      } else {
        target.flash = 0.2;
        target.colPos = Math.min(5.8, target.colPos + 0.6);
        showMessage('Weakness returned to target.', 700);
      }
    } else if (active.id === 'causality') {
      const eventNames = ['HEALTH', 'POSITION', 'ATTACK'];
      if (action === 'alternate') {
        next.mode = (next.mode + 1) % 3;
        showMessage(`Causality event: ${eventNames[next.mode]}.`, 700);
      } else if (action === 'primary') {
        next.placements = [next.mode];
        if (next.mode === 0) next.origin.hp = s.hp;
        if (next.mode === 1) next.origin = { ...next.origin, col: s.player.col, row: s.player.row };
        next.charges++;
        showMessage(`${eventNames[next.mode]} locked.`, 750);
      } else {
        if (next.mode === 0) s.hp = Math.max(s.hp, next.origin.hp);
        else if (next.mode === 1) {
          s.player.col = next.origin.col;
          s.player.row = next.origin.row;
        } else fireBullet(undefined, { power: 4, big: true, pierce: true });
        showMessage(`${eventNames[next.mode]} repeated.`, 750);
      }
    } else if (active.id === 'arsenal') {
      if (action === 'primary') {
        next.placements = [...next.placements, 0];
        fireBullet(undefined, { power: 2 + Math.floor(next.placements.length / 3), big: true, pierce: true });
        showMessage('Weapon grows toward rail-lance.', 700);
      } else if (action === 'alternate') {
        next.placements = [...next.placements, 1];
        s.shieldCharges++;
        showMessage('Weapon grows toward shield-cannon.', 700);
      } else {
        next.placements = [...next.placements, 2];
        s.player.row = (s.player.row + 1) % 3;
        fireBullet(undefined, { power: 2, big: true });
        showMessage('Weapon grows toward propulsion blade.', 700);
      }
      next.charges = next.placements.length;
    } else if (active.id === 'assimilation') {
      const target = [...s.enemies].sort((a, b) => b.hp - a.hp)[0];
      if (action === 'primary') {
        if (!target) showMessage('No enemy weapon system to harvest.', 750);
        else {
          next.charges += Math.max(1, Math.ceil(target.hp / 2));
          target.hp = Math.max(1, target.hp - 2);
          showMessage('Enemy weapon component harvested.', 750);
        }
      } else if (action === 'alternate') {
        next.mode = (next.mode + 1) % 3;
        showMessage(`Hybrid chassis: ${['RAM CANNON', 'PIERCE ARRAY', 'REGEN FRAME'][next.mode]}.`, 850);
      } else {
        fireBullet(undefined, {
          power: 2 + Math.floor(next.charges / 2),
          big: true,
          pierce: next.mode === 1,
        });
        if (next.mode === 2) s.hp++;
        showMessage('Assimilated weapon deployed.', 700);
      }
    } else if (active.id === 'null') {
      if (action === 'primary') {
        const targets = s.enemies.filter((enemy) => enemy.row === s.player.row);
        for (const enemy of targets) {
          enemy.abilityCooldown = Math.max(enemy.abilityCooldown ?? 0, 6);
          if (enemy.genome) enemy.genome.regeneration = 0;
          enemy.flash = 0.18;
        }
        next.charges += targets.length;
        showMessage(targets.length ? 'Lane constitution suppressed.' : 'No constitution in field.', 750);
      } else if (action === 'alternate') {
        next.mode = next.mode ? 0 : 1;
        showMessage(next.mode ? 'Null field focused.' : 'Null field widened.', 700);
      } else {
        next.placements = [s.player.row];
        s.shieldCharges++;
        showMessage('Suppression field anchored.', 700);
      }
    } else if (active.id === 'polarity') {
      if (action === 'primary') {
        const targets = s.enemies.filter((enemy) => enemy.row === s.player.row);
        for (const enemy of targets) {
          enemy.colPos += next.mode === 0 ? -0.65 : 0.65;
          enemy.flash = 0.16;
        }
        next.charges += targets.length;
        showMessage(`${next.mode === 0 ? 'Negative' : 'Positive'} polarity assigned.`, 700);
      } else if (action === 'alternate') {
        next.mode = next.mode ? 0 : 1;
        showMessage('All polarities reversed.', 700);
      } else {
        const byRow = [0, 1, 2].map((row) => s.enemies.filter((enemy) => enemy.row === row));
        for (const lane of byRow) {
          if (lane.length > 1) for (const enemy of lane) enemy.hp -= 2 + next.charges;
        }
        s.enemies = s.enemies.filter((enemy) => enemy.hp > 0);
        showMessage('Opposed targets collided.', 750);
      }
    } else if (active.id === 'colossus') {
      if (action === 'primary') {
        fireBullet(undefined, { power: 6 + next.charges, big: true, pierce: true });
        next.charges++;
        showMessage('Colossus siege cannon fired.', 700);
      } else if (action === 'alternate') {
        const targets = s.enemies.filter((enemy) => enemy.row === s.player.row);
        for (const enemy of targets) {
          enemy.hp -= 3;
          enemy.colPos = Math.min(5.8, enemy.colPos + 1);
        }
        s.enemies = s.enemies.filter((enemy) => enemy.hp > 0);
        s.player.col = Math.min(2, s.player.col + 1);
        showMessage('Colossus trample.', 700);
      } else {
        s.shieldCharges += 2;
        next.charges++;
        showMessage('Bulwark covers adjacent cells.', 750);
      }
    } else if (active.id === 'predator') {
      const targets = [...s.enemies].sort((a, b) => b.hp - a.hp);
      const target = targets[next.mode % Math.max(1, targets.length)];
      if (action === 'primary') {
        if (!target) showMessage('No prey detected.', 700);
        else {
          s.player.row = target.row;
          target.hp -= 3 + next.charges;
          target.flash = 0.2;
          next.charges++;
          s.enemies = s.enemies.filter((enemy) => enemy.hp > 0);
          showMessage(`Prey adaptation ${Math.min(5, next.charges)}/5.`, 700);
        }
      } else if (action === 'alternate') {
        if (targets.length) next.mode = (next.mode + 1) % targets.length;
        showMessage(targets.length ? 'Priority prey changed.' : 'No prey detected.', 700);
      } else {
        s.shieldCharges++;
        s.ghostTimer = Math.max(s.ghostTimer, 1.25);
        showMessage('Prey attack pattern countered.', 750);
      }
    } else if (active.id === 'orbital') {
      if (action === 'primary') {
        if (next.placements.length >= 5) showMessage('Orbital queue full.', 650);
        else {
          next.placements = [...next.placements, s.player.row];
          next.charges = next.placements.length;
          showMessage(`Strike ${next.charges}/5 designated.`, 650);
        }
      } else if (action === 'alternate') {
        next.mode = (next.mode + 1) % 3;
        showMessage(`Ordnance: ${['PRECISION', 'EMP', 'SUPPLY'][next.mode]}.`, 700);
      } else {
        if (next.mode === 0) fireBullet(undefined, { power: 5, big: true, pierce: true });
        else if (next.mode === 1) s.signalJamTimer = Math.max(s.signalJamTimer, 5);
        else {
          s.hp++;
          s.shieldCharges++;
        }
        showMessage('Orbital payload dropped.', 700);
      }
    } else if (active.id === 'hijack') {
      const orders = ['RETREAT', 'HOLD', 'BREAK FORMATION'];
      if (action === 'alternate') {
        next.mode = (next.mode + 1) % 3;
        showMessage(`Intercepted order: ${orders[next.mode]}.`, 700);
      } else if (action === 'primary') {
        for (const enemy of s.enemies) {
          if (next.mode === 0) enemy.colPos = Math.min(5.8, enemy.colPos + 0.8);
          else if (next.mode === 1) enemy.speed = Math.min(enemy.speed, 0.03);
          else enemy.row = (enemy.row + 1) % 3;
          enemy.flash = 0.16;
        }
        next.charges++;
        showMessage(`${orders[next.mode]} broadcast.`, 700);
      } else {
        for (const enemy of s.enemies) {
          enemy.hp--;
          enemy.row = (enemy.row + 2) % 3;
        }
        s.enemies = s.enemies.filter((enemy) => enemy.hp > 0);
        showMessage('Hostile formation command broken.', 750);
      }
    } else if (active.id === 'sovereign') {
      const missing = Math.max(0, 10 - s.hp);
      if (action === 'primary') {
        fireBullet(undefined, { power: 2 + missing, big: true, pierce: missing >= 3 });
        next.charges++;
        showMessage(`Authority asserted · power ${2 + missing}.`, 700);
      } else if (action === 'alternate') {
        s.hp = Math.max(1, s.hp - 1);
        s.overclockTimer = Math.max(s.overclockTimer, 3 + missing);
        next.charges += 2;
        showMessage('Vitality wagered for authority.', 750);
      } else {
        s.shieldCharges += Math.max(1, Math.ceil(missing / 2));
        s.regenTimer = Math.max(s.regenTimer, 3);
        showMessage('Sovereign endures scarcity.', 750);
      }
    }
    rivalSkillRef.current = next;
    setRivalSkillView(next);
    updateHud();
  }, [finishRivalSkill, fireBullet, showMessage, updateHud]);

  const activateRivalSkill = useCallback((id: RivalSkillId) => {
    const current = rivalSkillRef.current;
    if (current.active) {
      finishRivalSkill(true);
      return;
    }
    const s = stateRef.current;
    if ((id === 'override' || id === 'phase' || id === 'exchange'
      || id === 'assimilation' || id === 'predator') && s.enemies.length === 0) {
      showMessage(id === 'override' ? 'Neural Override needs an eligible host.'
        : id === 'phase' ? 'Phase Hunt needs a priority target.'
          : id === 'exchange' ? 'Code Exchange needs an enemy constitution.'
            : id === 'assimilation' ? 'Arsenal Assimilation needs enemy technology.'
              : 'Predator Protocol needs eligible prey.', 1100);
      return;
    }
    let initialMode = 0;
    if (id === 'apex') {
      const armored = s.enemies.filter((enemy) =>
        (enemy.maxHp ?? enemy.hp) >= 4 || enemy.genome?.mutations.includes('armored')).length;
      const regenerative = s.enemies.filter((enemy) =>
        enemy.ability === 'mendingPulse' || enemy.genome?.niche === 'regenerator').length;
      const rangedPressure = s.enemies.filter((enemy) =>
        enemy.ability === 'laneShift' || enemy.ability === 'arcArmor').length;
      initialMode = regenerative > Math.max(armored, rangedPressure) ? 2
        : rangedPressure > armored ? 1 : 0;
    }
    const next: RivalSkillView = {
      active: true,
      id,
      actionTick: 0,
      lastAction: 'activate',
      mode: initialMode,
      charges: 0,
      placements: [],
      chronoPositions: id === 'chrono'
        ? [{ col: s.player.col, row: s.player.row }]
        : [],
      chronoPositionIndex: 0,
      expiresAt: performance.now() + 9000,
      origin: { col: s.player.col, row: s.player.row, hp: s.hp },
    };
    rivalSkillRef.current = next;
    setRivalSkillView(next);
    if (id === 'chrono') s.slowTimer = Math.max(s.slowTimer, 9);
    if (id === 'phase') s.ghostTimer = Math.max(s.ghostTimer, 9);
    const suffix = id === 'apex'
      ? ` · ${['BREAKER', 'REFLECTOR', 'NULLIFIER'][initialMode]} scan`
      : '';
    showMessage(`${RIVAL_SKILL_LABELS[id]}${suffix} · X technique · Y shift · B guard`, 1800);
  }, [finishRivalSkill, showMessage]);

  const playSkillAnimation = useCallback(() => {
    const s = stateRef.current;
    if (phaseRef.current !== 'playing' || !s.running || pausedRef.current) return;
    const selectedRival = playerSkinRef.current === 'assembly'
      && assemblySkillRef.current !== 'shadow'
      ? assemblySkillRef.current
      : RIVAL_SKILL_IDS.find((id) => id === playerSkinRef.current);
    if (selectedRival) {
      activateRivalSkill(selectedRival);
      return;
    }
    const activeClones = cloneSessionRef.current;
    if (activeClones.visible) {
      if (!activeClones.inputActive) return;
      const direction = activeClones.controlled;
      const next: CloneDirection = direction === 'north' ? 'south' : 'north';
      if (activeClones.rows[next] === null
        || activeClones.statuses[next] === 'gone'
        || activeClones.statuses[next] === 'dispersing') return;
      const sourceExpiry = cloneExpiryTimersRef.current[direction];
      if (sourceExpiry) clearTimeout(sourceExpiry);
      cloneExpiryTimersRef.current[direction] = null;
      const nextExpiry = cloneExpiryTimersRef.current[next];
      if (nextExpiry) clearTimeout(nextExpiry);
      cloneExpiryTimersRef.current[next] = null;
      const sustained: CloneView = {
        ...activeClones,
        controlled: next,
        inputActive: true,
        statuses: {
          ...activeClones.statuses,
          [direction]: 'autofiring',
          [next]: activeClones.statuses[next] === 'defending'
            || activeClones.statuses[next] === 'defendingHeld'
            ? 'idle'
            : activeClones.statuses[next],
        },
      };
      cloneSessionRef.current = sustained;
      setCloneView(sustained);
      const attackRow = activeClones.rows[direction];
      if (attackRow !== null) {
        fireBullet(attackRow, {
          power: 3,
          big: true,
          pierce: true,
          originCol: activeClones.cols[direction] ?? s.player.col,
        });
      }
      const existingAutoFire = cloneAutoFireTimersRef.current[direction];
      if (existingAutoFire) clearInterval(existingAutoFire);
      cloneAutoFireTimersRef.current[direction] = setInterval(() => {
        const latest = cloneSessionRef.current;
        const latestRow = latest.rows[direction];
        if (!latest.visible || latestRow === null || latest.statuses[direction] !== 'autofiring') {
          const timer = cloneAutoFireTimersRef.current[direction];
          if (timer) clearInterval(timer);
          cloneAutoFireTimersRef.current[direction] = null;
          return;
        }
        fireBullet(latestRow, {
          power: 3,
          big: true,
          pierce: true,
          originCol: latest.cols[direction] ?? stateRef.current.player.col,
        });
      }, 650);
      registerPlaystyle('cloneAutofire');
      showMessage('Clone autofiring · control switched.', 1200);
      return;
    }
    ensureAudio();
    const clockwiseOffsets = [
      { col: 0, row: -1 }, { col: 1, row: -1 },
      { col: 1, row: 0 }, { col: 1, row: 1 },
      { col: 0, row: 1 }, { col: -1, row: 1 },
      { col: -1, row: 0 }, { col: -1, row: -1 },
    ];
    const occupied = new Set<string>([`${s.player.col},${s.player.row}`]);
    for (const enemy of s.enemies) {
      const col = Math.round(enemy.colPos);
      if (enemy.colPos >= -0.45 && col >= 0 && col <= 2 && enemy.row >= 0 && enemy.row <= 2) {
        occupied.add(`${col},${enemy.row}`);
      }
    }
    const findClockwiseSpawn = (startIndex: number) => {
      for (let step = 0; step < clockwiseOffsets.length; step++) {
        const offset = clockwiseOffsets[(startIndex + step) % clockwiseOffsets.length];
        const col = s.player.col + offset.col;
        const row = s.player.row + offset.row;
        if (col < 0 || col > 2 || row < 0 || row > 2 || occupied.has(`${col},${row}`)) continue;
        occupied.add(`${col},${row}`);
        return { col, row };
      }
      return null;
    };
    const northSpawn = findClockwiseSpawn(0);
    const southSpawn = findClockwiseSpawn(4);
    const controlled: CloneDirection = northSpawn ? 'north' : 'south';
    const clones: CloneView = {
      visible: true,
      revealed: false,
      inputActive: false,
      playerLocked: true,
      controlled,
      turn: 0,
      statuses: {
        north: northSpawn === null ? 'gone' : 'idle',
        south: southSpawn === null ? 'gone' : 'idle',
      },
      rows: { north: northSpawn?.row ?? null, south: southSpawn?.row ?? null },
      cols: {
        north: northSpawn?.col ?? null,
        south: southSpawn?.col ?? null,
      },
    };
    cloneSessionRef.current = clones;
    setCloneView(clones);
    gemAttackFrameRef.current = -1;
    rocketFrameRef.current = -1;
    showMessage('Player channeling Skill…', 900);
    if (skillFxTimerRef.current) clearTimeout(skillFxTimerRef.current);
    setSkillFxRun((run) => run + 1);
    setSkillPlayerFxActive(true);
    setSkillFxActive(false);
    skillFxTimerRef.current = setTimeout(() => {
      setSkillPlayerFxActive(false);
      const current = cloneSessionRef.current;
      if (current.visible) {
        const revealed: CloneView = { ...current, revealed: true };
        cloneSessionRef.current = revealed;
        setCloneView(revealed);
        setSkillFxActive(true);
        showMessage('Clones materializing…', 1300);
      }
      skillFxTimerRef.current = setTimeout(() => {
        setSkillFxActive(false);
        const materialized = cloneSessionRef.current;
        if (materialized.visible) {
          const activated: CloneView = { ...materialized, inputActive: true };
          cloneSessionRef.current = activated;
          setCloneView(activated);
          cloneOpeningWindowRef.current = performance.now() + 2000;
          showMessage('Clone controlled · X Attack · Y Switch · B Defend', 1800);
        }
        skillFxTimerRef.current = null;
      }, 1530);
    }, 900);
  }, [activateRivalSkill, fireBullet, showMessage, registerPlaystyle]);

  const queueSkillTap = useCallback(() => {
    if (skillTapTimerRef.current) {
      clearTimeout(skillTapTimerRef.current);
      skillTapTimerRef.current = null;
      if (rivalSkillRef.current.active) finishRivalSkill(true);
      else cycleActiveControl(1);
      return;
    }
    skillTapTimerRef.current = setTimeout(() => {
      skillTapTimerRef.current = null;
      playSkillAnimation();
    }, 260);
  }, [cycleActiveControl, finishRivalSkill, playSkillAnimation]);

  const handleGamepad = useCallback(() => {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp: Gamepad | null = null;
    for (let i = 0; i < pads.length; i++) {
      if (pads[i]?.connected) { gp = pads[i]; break; }
    }
    const g = gamepadRef.current;
    if (!gp) {
      if (g.connected) {
        g.connected = false;
        g.moveX = 0; g.moveY = 0; g.prevMoveX = 0;
        g.fire = false; g.prevFire = false;
        g.cardX = false; g.prevCardX = false;
        g.cardY = false; g.prevCardY = false;
        g.cardB = false; g.prevCardB = false;
        g.rotate = false; g.prevRotate = false;
        g.start = false; g.prevStart = false;
        g.l1 = false; g.prevL1 = false;
        g.skill = false; g.prevSkill = false;
        g.r1 = false; g.prevR1 = false;
        g.r2 = false; g.prevR2 = false;
      }
      return;
    }
    const buttonPressed = (idx: number) => { const b = gp!.buttons[idx]; return !!(b && (b.pressed || b.value > 0.2)); };
    const deadzone = 0.18;
    let moveX = gp.axes[0] ?? 0, moveY = gp.axes[1] ?? 0;
    if (buttonPressed(14)) moveX = -1; else if (buttonPressed(15)) moveX = 1;
    if (buttonPressed(12)) moveY = -1; else if (buttonPressed(13)) moveY = 1;
    if (Math.abs(moveX) < deadzone) moveX = 0;
    if (Math.abs(moveY) < deadzone) moveY = 0;
    g.prevMoveX = g.moveX;
    g.prevFire = g.fire;
    g.fire = buttonPressed(0);            // A only
    g.prevCardX = g.cardX; g.cardX = buttonPressed(2);  // X → slot 0
    g.prevCardY = g.cardY; g.cardY = buttonPressed(3);  // Y → slot 1
    g.prevCardB = g.cardB; g.cardB = buttonPressed(1);  // B → slot 2
    g.prevRotate = g.rotate;
    g.rotate = buttonPressed(8) || buttonPressed(17);   // View / ellipsis / share
    g.prevStart = g.start; g.start = buttonPressed(9);  // Start → pause
    g.prevL1 = g.l1; g.l1 = buttonPressed(4);          // L1 modifier
    g.prevR2 = g.r2; g.r2 = buttonPressed(7);          // R2 → cycle active control
    g.prevSkill = g.skill; g.skill = buttonPressed(6); // L2 → skill animation
    g.prevR1 = g.r1; g.r1 = buttonPressed(5);          // R1 → evolution prompt
    g.moveX = moveX;
    g.moveY = moveY;
    g.connected = true;
  }, []);

  const update = useCallback((dt: number) => {
    const s = stateRef.current;
    if (!s.running) return;

    handleGamepad();

    if (!s.upgradePromptOpen && !s.upgradeSelectionOpen
      && s.upgradeRetryWave > 0 && s.wave >= s.upgradeRetryWave) {
      s.upgradePromptOpen = true;
      s.upgradePromptTimer = UPGRADE_PROMPT_TIME;
      s.upgradeRetryWave = 0;
      updateHud();
    } else if (!s.upgradePromptOpen && !s.upgradeSelectionOpen
      && s.upgradeOptions.length === 0 && s.wave >= s.nextUpgradeWave) {
      s.upgradeOptions = chooseUpgradeOptions(s.runUpgrades);
      s.nextUpgradeWave = Math.max(
        s.nextUpgradeWave + UPGRADE_INTERVAL_WAVES,
        s.wave + UPGRADE_INTERVAL_WAVES,
      );
      if (s.upgradeOptions.length > 0) {
        s.upgradePromptOpen = true;
        s.upgradePromptTimer = UPGRADE_PROMPT_TIME;
        upgradeSelectionRef.current = 0;
        setUpgradeSelection(0);
        updateHud();
      }
    }

    if (s.upgradePromptOpen) {
      s.upgradePromptTimer = Math.max(0, s.upgradePromptTimer - dt);
      if (s.upgradePromptTimer <= 0) {
        s.upgradePromptOpen = false;
        s.upgradeRetryWave = s.wave + UPGRADE_RETRY_WAVES;
        showMessage(`Evolution deferred — returns at wave ${s.upgradeRetryWave}.`, 1800);
        updateHud();
      }
    }

    const upgradeGamepad = gamepadRef.current;
    if (s.upgradePromptOpen && upgradeGamepad.r1 && !upgradeGamepad.prevR1) {
      openUpgradeSelection();
      return;
    }

    const slowMotionActive = s.upgradeSelectionOpen;
    if (s.upgradeSelectionOpen) {
      if (upgradeGamepad.cardB && !upgradeGamepad.prevCardB) {
        closeUpgradeSelection();
        return;
      }
      menuNavCooldownRef.current = Math.max(0, menuNavCooldownRef.current - dt);
      const axis = Math.abs(upgradeGamepad.moveX) > 0.15
        ? upgradeGamepad.moveX
        : upgradeGamepad.moveY;
      if (Math.abs(axis) > 0.15 && menuNavCooldownRef.current <= 0) {
        const direction = axis > 0 ? 1 : -1;
        upgradeSelectionRef.current =
          (upgradeSelectionRef.current + direction + s.upgradeOptions.length) % s.upgradeOptions.length;
        setUpgradeSelection(upgradeSelectionRef.current);
        menuNavCooldownRef.current = 0.22;
      }
      if (upgradeGamepad.fire && !upgradeGamepad.prevFire) {
        chooseRunUpgrade(s.upgradeOptions[upgradeSelectionRef.current]);
      }
      upgradeGamepad.moveX = 0;
      upgradeGamepad.moveY = 0;
      fireHeldRef.current = true;
      dt *= 0.08;
    }

    // Gamepad Start button → pause (rising edge)
    const gpForPause = gamepadRef.current;
    if (gpForPause.start && !gpForPause.prevStart) { togglePause(); return; }

    // Controller movement
    controllerCooldownRef.current = Math.max(0, controllerCooldownRef.current - dt);
    const kb = keyboardRef.current;
    const td = touchDpadRef.current;
    const gp = gamepadRef.current;
    if (gp.skill && !gp.prevSkill) queueSkillTap();
    if (gp.r2 && !gp.prevR2) queueR2ControlCycle();
    const rivalInputActive = rivalSkillRef.current.active;
    if (rivalInputActive) {
      if (gp.cardX && !gp.prevCardX) resolveRivalSkillAction('primary');
      else if (gp.cardY && !gp.prevCardY) resolveRivalSkillAction('alternate');
      else if (gp.cardB && !gp.prevCardB) resolveRivalSkillAction('defend');
    }
    const cloneInputActive = cloneSessionRef.current.inputActive;
    const cloneControlActive = cloneSessionRef.current.playerLocked;
    if (cloneInputActive) {
      if (gp.cardX && !gp.prevCardX) resolveCloneAction('attack');
      else if (gp.cardY && !gp.prevCardY) switchCloneControl();
      else if (gp.cardB && !gp.prevCardB) resolveCloneAction('defend');
    }
    const eloFlipCombo = !cloneControlActive
      && playerSkinRef.current === 'gem'
      && gp.moveX < -0.15
      && ((gp.prevMoveX >= -0.15 && gp.l1) || (gp.l1 && !gp.prevL1));
    if (eloFlipCombo) {
      eloAttackDirectionRef.current = eloAttackDirectionRef.current === 1 ? -1 : 1;
      gemMoveMirrorRef.current = eloAttackDirectionRef.current === -1;
      showMessage(
        eloAttackDirectionRef.current === 1 ? 'Player facing right' : 'Player facing left',
        900,
      );
    }
    let dx = 0, dy = 0;
    if (kb.left || td.left) dx = -1; else if (kb.right || td.right) dx = 1;
    if (kb.up || td.up) dy = -1; else if (kb.down || td.down) dy = 1;
    if (Math.abs(gp.moveX) > 0.15 && !eloFlipCombo) dx = gp.moveX > 0 ? 1 : -1;
    if (Math.abs(gp.moveY) > 0.15) dy = gp.moveY > 0 ? 1 : -1;

    if ((dx !== 0 || dy !== 0) && controllerCooldownRef.current <= 0) {
      if (cloneInputActive) {
        moveControlledClone(dx, dy);
        controllerCooldownRef.current = 0.16;
      } else if (!cloneControlActive) {
        const nc = Math.max(0, Math.min(2, s.player.col + dx));
        const nr = Math.max(0, Math.min(2, s.player.row + dy));
        if (nc !== s.player.col || nr !== s.player.row) {
          tryMoveTo(nc, nr);
          controllerCooldownRef.current = 0.16;
        }
      }
    }
    if (!cloneControlActive && gp.fire && !fireHeldRef.current) manualBuster();
    fireHeldRef.current = gp.fire;
    if (!cloneControlActive && gp.rotate && !gp.prevRotate) {
      if (gp.l1) {
        s.autoBuster = !s.autoBuster;
        playAutoToggle();
        updateHud();
        showMessage(`Auto Fire: ${s.autoBuster ? 'ON' : 'OFF'}`, 900);
      } else {
        rotateHand();
      }
    }

    // Gamepad X/Y/B → ability card slots 0/1/2 (rising edge only)
    if (!cloneControlActive && !rivalInputActive && !slowMotionActive && s.cardsReady && s.cardSelectionOpen) {
      if (gp.cardX && !gp.prevCardX && s.currentCardOptions[0]) useCard(s.currentCardOptions[0]);
      if (gp.cardY && !gp.prevCardY && s.currentCardOptions[1]) useCard(s.currentCardOptions[1]);
      if (gp.cardB && !gp.prevCardB && s.currentCardOptions[2]) useCard(s.currentCardOptions[2]);
    }

    s.timer += dt;
    s.moveFlash      = Math.max(0, s.moveFlash - dt);
    s.slowTimer      = Math.max(0, s.slowTimer - dt);
    s.overclockTimer = Math.max(0, s.overclockTimer - dt);
    s.freezeTimer    = Math.max(0, s.freezeTimer - dt);
    s.blizzardTimer  = Math.max(0, s.blizzardTimer - dt);
    s.doubleTimer    = Math.max(0, s.doubleTimer - dt);
    s.multishotTimer = Math.max(0, s.multishotTimer - dt);
    s.drainTimer     = Math.max(0, s.drainTimer - dt);
    s.voltageTimer   = Math.max(0, s.voltageTimer - dt);
    s.ghostTimer     = Math.max(0, s.ghostTimer - dt);
    s.turretTimer    = Math.max(0, s.turretTimer - dt);
    s.echoTimer      = Math.max(0, s.echoTimer - dt);
    s.overdriveTimer = Math.max(0, s.overdriveTimer - dt);
    s.overloadTimer  = Math.max(0, s.overloadTimer - dt);
    s.magnetTimer    = Math.max(0, s.magnetTimer - dt);
    s.berserkTimer   = Math.max(0, s.berserkTimer - dt);
    s.critTimer      = Math.max(0, s.critTimer - dt);
    s.signalJamTimer = Math.max(0, s.signalJamTimer - dt);
    s.stasisGateTimer = Math.max(0, s.stasisGateTimer - dt);
    s.adaptiveAmmoTimer = Math.max(0, s.adaptiveAmmoTimer - dt);
    const liveRivalSkill = rivalSkillRef.current;
    if (liveRivalSkill.active && liveRivalSkill.id === 'singularity') {
      const gravityVelocity = liveRivalSkill.mode === 0 ? -0.22 : 0.65;
      for (const enemy of s.enemies) {
        enemy.colPos = Math.max(-0.4, Math.min(5.8, enemy.colPos + gravityVelocity * dt));
      }
    }
    if (liveRivalSkill.active && liveRivalSkill.id === 'causality') {
      if (liveRivalSkill.placements.includes(0)) s.hp = Math.max(s.hp, liveRivalSkill.origin.hp);
      if (liveRivalSkill.placements.includes(1)) {
        s.player.col = liveRivalSkill.origin.col;
        s.player.row = liveRivalSkill.origin.row;
      }
    }
    if (liveRivalSkill.active && liveRivalSkill.id === 'gridshift'
      && liveRivalSkill.placements.length > 0) {
      for (const enemy of s.enemies.filter((candidate) =>
        liveRivalSkill.placements.includes(candidate.row))) enemy.speed = Math.min(enemy.speed, 0.03);
    }
    if (rivalSkillRef.current.active && performance.now() >= rivalSkillRef.current.expiresAt) {
      finishRivalSkill(true);
    }
    if (s.pulseTimer > 0) {
      s.pulseTimer = Math.max(0, s.pulseTimer - dt);
      s.pulseTick  = Math.max(0, s.pulseTick  - dt);
      if (s.pulseTick <= 0) {
        for (const e of s.enemies) {
          const movement = movementClassOf(e);
          const push = movement && HEAVY_CLASSES.has(movement) ? 0.18 : movement === 'spectral' ? 0.28 : 0.65;
          e.colPos = Math.min(5.8, e.colPos + push);
          e.flash = 0.06;
        }
        s.pulseTick = 1.5;
      }
    }
    if (s.magnetTimer > 0) {
      for (const e of s.enemies) {
        const pull = isCyberEnemy(e) ? 0.62 : e.genome?.fusionLevel ? 0.2 : 0.05;
        e.colPos = Math.min(5.8, e.colPos + pull * dt);
      }
    }
    if (s.regenTimer > 0) {
      s.regenTimer = Math.max(0, s.regenTimer - dt);
      s.regenTick  = Math.max(0, s.regenTick  - dt);
      if (s.regenTick <= 0) {
        s.hp++;
        s.regenTick = 3;
        updateHud();
      }
    }

    // Stable session metrics update twice per second; their values only increase.
    hudTickRef.current += dt;
    if (hudTickRef.current >= 0.5) {
      hudTickRef.current = 0;
      updateHud();
    }

    for (const a of runtimeAbilityPool()) {
      if (s.abilityCooldowns[a.id] > 0) {
        s.abilityCooldowns[a.id] = Math.max(0, s.abilityCooldowns[a.id] - dt);
      }
    }

    // ── Card system ──────────────────────────────────────────────────────────
    if (!s.cardsReady) {
      // Bar is filling — tick toward next hand
      const capacitorMultiplier = 1 + (s.runUpgrades.capacitor ?? 0) * 0.15;
      const assistedRecharge = (s.hp <= 2 || s.directorCritical ? 1.55 : 1) * capacitorMultiplier;
      s.cardTimer = Math.min(CARD_CHARGE_TIME, s.cardTimer + dt * assistedRecharge);
      const pct = (s.cardTimer / CARD_CHARGE_TIME) * 100;
      if (cardBarFillRef.current) cardBarFillRef.current.style.width = `${pct.toFixed(2)}%`;
      if (cardLabelRef.current) {
        const secs = Math.max(0, Math.ceil((CARD_CHARGE_TIME - s.cardTimer) / assistedRecharge));
        cardLabelRef.current.textContent = assistedRecharge > 1
          ? `Assisted hand in ${secs}s`
          : `New hand in ${secs}s`;
      }
      if (s.cardTimer >= CARD_CHARGE_TIME) {
        if (autoRotateAbilityPresetsRef.current) {
          activateAbilityPreset(activeAbilityPresetRef.current + 1);
        }
        s.currentCardOptions = randomAbilityOptions(
          s.currentCardOptions,
          enabledAbilitiesRef.current,
          s.abilityCooldowns,
          s.enemies,
          s.hp,
          synchronizedAbilityIdsRef.current,
        );
        s.cardsReady = true;
        s.cardSelectionOpen = true;
        s.rotateUsedThisHand = false;
        s.usedInHand = [];
        playCardReady();
        showMessage('Ability Cards loaded! Use them, then hand resets.', 2000);
        updateHud();
      }
    } else {
      // Hand is active — bar stays full
      if (cardBarFillRef.current) cardBarFillRef.current.style.width = '100%';

      const allUsed = s.currentCardOptions.every((id) => s.usedInHand.includes(id));
      const allCooldownsDone = s.currentCardOptions.every((id) => (s.abilityCooldowns[id] ?? 0) === 0);

      if (cardLabelRef.current) {
        if (allUsed) {
          const maxCd = Math.max(0, ...s.currentCardOptions.map((id) => s.abilityCooldowns[id] ?? 0));
          cardLabelRef.current.textContent = maxCd > 0
            ? `All used — cooling down ${Math.ceil(maxCd)}s`
            : '';
        } else {
          const remaining = s.currentCardOptions.filter((id) => !s.usedInHand.includes(id)).length;
          cardLabelRef.current.textContent = `${remaining} card${remaining !== 1 ? 's' : ''} remaining — ROTATE to reset timer`;
        }
      }

      // Once all used AND all cooldowns expired → reset for next hand
      if (allUsed && allCooldownsDone) {
        s.cardsReady = false;
        s.cardSelectionOpen = false;
        s.cardTimer = 0;
        s.usedInHand = [];
        updateHud();
      }
    }

    s.player.fireCooldown -= dt;
    if (s.autoBuster && s.player.fireCooldown <= 0) {
      const rapidScale = 1 + (s.runUpgrades.rapidBuster ?? 0) * 0.1;
      s.player.fireCooldown = (s.berserkTimer > 0 ? 0.09 : s.overclockTimer > 0 ? 0.16 : 0.34) / rapidScale;
      fireBullet();
      if (s.multishotTimer > 0) fireBullet((s.player.row + 1) % 3);
      if (s.turretTimer > 0) {
        for (let r = 0; r < 3; r++) { if (r !== s.player.row) fireBullet(r); }
      }
    }

    // Adaptive pressure director: dangerous boards stop receiving reinforcements,
    // and clearing a critical state earns a short recovery window.
    s.directorRecoveryTimer = Math.max(0, s.directorRecoveryTimer - dt);
    const directorLiving = s.enemies.filter((enemy) => enemy.colPos >= -1);
    const nearestThreat = directorLiving.reduce(
      (nearest, enemy) => Math.min(nearest, enemy.colPos),
      Number.POSITIVE_INFINITY,
    );
    const fusedThreats = directorLiving.filter((enemy) => (enemy.genome?.fusionLevel ?? 0) > 0).length;
    const directorCritical =
      directorLiving.length >= 7
      || (directorLiving.length >= 5 && nearestThreat <= 2.25)
      || (s.hp <= 2 && directorLiving.length >= 4);
    if (s.directorCritical && !directorCritical) {
      s.directorRecoveryTimer = Math.max(s.directorRecoveryTimer, 3.5);
      if ((s.runUpgrades.repairWeave ?? 0) > 0) s.hp++;
      showMessage('Pressure cleared — reinforcement pause!', 1400);
    }
    if (!s.directorCritical && directorCritical && (s.runUpgrades.shockVent ?? 0) > 0) {
      const knockback = 0.55 + (s.runUpgrades.shockVent - 1) * 0.3;
      for (const enemy of directorLiving) {
        enemy.colPos = Math.min(5.8, enemy.colPos + knockback);
        enemy.flash = 0.12;
      }
      showMessage('Shock Vent expelled the pressure front!', 1200);
    }
    s.directorCritical = directorCritical;

    // Spawn enemies
    s.enemySpawnTimer -= dt;
    const populationCap = s.hp <= 2 ? 5 : 7;
    if (s.gameMode !== 'vs'
      && s.enemySpawnTimer <= 0
      && s.directorRecoveryTimer <= 0
      && directorLiving.length < populationCap) {
      const value = pickDiverseSeed();
      const livingEnemies = s.enemies.filter((enemy) => enemy.colPos >= -1);
      const lanePopulation: [number, number, number] = [0, 0, 0];
      const population: Record<string, number> = {};
      const basePopulation: Record<string, number> = {};
      for (const enemy of livingEnemies) {
        lanePopulation[enemy.row]++;
        if (enemy.genome) {
          population[enemy.genome.niche] = (population[enemy.genome.niche] ?? 0) + 1;
          basePopulation[enemy.genome.baseElement] = (basePopulation[enemy.genome.baseElement] ?? 0) + 1;
        }
      }
      const genome = createGenome(value, s.wave, s.enemyFormationId, {
        playerRow: s.player.row,
        lanePressure: s.lanePressure,
        population,
        basePopulation,
        lanePopulation,
        recentBases: s.recentBaseElements,
        recentBodyClasses: s.recentBodyClasses,
        recentElementDomains: s.recentElementDomains,
      });
      const concurrentSignal =
        value + s.enemyFormationId * 7 + s.player.row * 13 +
        Math.round(s.lanePressure.reduce((sum, pressure) => sum + pressure, 0) * 11) +
        livingEnemies.length * 17;
      const candidateRow = Math.abs(concurrentSignal) % 3;
      const row = selectAdaptiveRow(
        genome,
        candidateRow,
        s.player.row,
        s.lanePressure,
        lanePopulation,
      );
      const speed = (1.15 + Math.min(0.55, (s.wave - 1) * 0.08)) * genome.speedScale;
      const hp = (Math.random() < 0.2 + Math.min(0.25, s.wave * 0.03) ? 2 : 1) + genome.hpBonus;
      const discoverySignature = [
        genome.baseElement,
        genome.fusionElement ?? 'pure',
        genome.niche,
        [...genome.mutations].sort().join('+') || 'baseline',
        `fusion-${genome.fusionLevel}`,
      ].join(':');
      if (!s.ecosystemStats.entitySignatures.includes(discoverySignature)) {
        s.ecosystemStats.entitySignatures.push(discoverySignature);
      }
      recordBestiary(value, genome);
      s.recentBaseElements.push(genome.baseElement);
      s.recentBodyClasses.push(getEnemyMovementClass(genome.baseElement));
      s.recentElementDomains.push(ELEMENT_DOMAIN[genome.baseElement]);
      if (s.recentBaseElements.length > 48) s.recentBaseElements.shift();
      if (s.recentBodyClasses.length > 24) s.recentBodyClasses.shift();
      if (s.recentElementDomains.length > 18) s.recentElementDomains.shift();
      s.ecosystemStats.mutationDiscoveries += genome.mutations.length;
      s.ecosystemStats.maxGeneration = Math.max(s.ecosystemStats.maxGeneration, genome.generation);
      if (genome.fusionLevel > 0) s.ecosystemStats.totalFusions++;
      registerSpawn(getMorphSig(value));
      const enemyAbility = enemyCounterpartFor(genome);
      s.enemies.push({
        colPos: 5.6,
        row,
        speed,
        hp,
        flash: 0,
        value,
        formationId: s.enemyFormationId,
        genome,
        maxHp: hp,
        regenerationCharge: 0,
        ability: enemyAbility,
        counterpartAbilityId: linkedPlayerAbility(genome),
        abilityCooldown: enemyAbility
          ? ENEMY_ABILITY_FIRST_CAST_MIN + Math.random() * ENEMY_ABILITY_FIRST_CAST_RANGE
          : 0,
        abilityWindup: 0,
      });

      s.enemyFormationId++;
      // Courteous escalation: waves increase pressure, while density, advanced
      // threats, proximity and low health create enough room to respond.
      const wavePressure = Math.min(0.34, (s.wave - 1) * 0.018);
      const densityBrake = Math.max(0, livingEnemies.length - 3) * 0.13;
      const advancedBrake = Math.min(0.34, fusedThreats * 0.12);
      const proximityBrake = nearestThreat <= 2.25 ? 0.28 : 0;
      const healthBrake = s.hp <= 2 ? 0.42 : s.hp === 3 ? 0.16 : 0;
      s.enemySpawnTimer = Math.max(
        0.62,
        1.18 - wavePressure + densityBrake + advancedBrake + proximityBrake + healthBrake,
      );
    } else if (s.enemySpawnTimer <= 0) {
      s.enemySpawnTimer = 0.35;
    }

    // Move bullets
    for (const b of s.bullets) b.colPos += b.speed * dt;
    s.bullets = s.bullets.filter((b) => b.colPos > -0.6 && b.colPos < 6.4);

    // Move enemies
    const canvas = canvasRef.current;
    const m = canvas ? getBoardMetrics(canvas.offsetWidth, canvas.offsetHeight) : null;
    for (const e of s.enemies) {
      if (!Number.isFinite(e.speed) || e.speed < 0.15) e.speed = 0.85;
      const movement = movementClassOf(e);
      const isFastMover = movement === 'flier' || movement === 'hover' || movement === 'quadruped'
        || movement === 'arthropod' || movement === 'aquatic';
      let speedScale = s.overdriveTimer > 0 ? 2.5 : 1;
      if (s.slowTimer > 0) speedScale = isFastMover ? 0.32 : 0.55;
      if (s.blizzardTimer > 0) {
        speedScale = movement === 'flier' || movement === 'aquatic'
          ? 0.1
          : movement === 'burrower' ? 0.42 : 0.2;
      }
      if (s.freezeTimer > 0) speedScale = 0.08;
      if (s.signalJamTimer > 0 && isCyberEnemy(e)) speedScale *= 0.32;

      const abilitySuppressed = s.freezeTimer > 0 || (s.signalJamTimer > 0 && isCyberEnemy(e));
      if (e.ability && !abilitySuppressed) {
        e.abilityCooldown = Math.max(0, (e.abilityCooldown ?? 0) - dt);
        if ((e.abilityWindup ?? 0) > 0) {
          e.abilityWindup = Math.max(0, (e.abilityWindup ?? 0) - dt);
          speedScale *= 0.12;
          if (e.abilityWindup <= 0) {
            const counterpart = PLAYER_ABILITY_MATRIX.find((entry) =>
              entry.abilityId === e.counterpartAbilityId);
            const counterpartFunction = counterpart?.function;
            if (counterpartFunction === 'impulse') {
              if (e.row === s.player.row) s.player.col = Math.max(0, s.player.col - 1);
              e.colPos -= 0.85;
            } else if (counterpartFunction === 'reveal') {
              e.colPos -= 0.65;
              e.flash = 0.12;
            } else if (counterpartFunction === 'restore') {
              for (const ally of s.enemies) {
                if (ally.colPos < -1 || ally.row !== e.row || Math.abs(ally.colPos - e.colPos) > 1.8) continue;
                ally.hp = Math.min(ally.maxHp ?? ally.hp, ally.hp + 1);
                ally.flash = 0.08;
              }
            } else if (counterpartFunction === 'adapt') {
              const laneCounts = [0, 1, 2].map((row) =>
                s.enemies.filter((ally) => ally.colPos >= -1 && ally.row === row).length);
              e.row = laneCounts.indexOf(Math.min(...laneCounts));
            } else if (counterpartFunction === 'ward') {
              e.maxHp = Math.min(9, (e.maxHp ?? e.hp) + 1);
              e.hp = Math.min(e.maxHp, e.hp + 1);
            } else if (counterpartFunction === 'inhibit') {
              s.player.fireCooldown = Math.max(s.player.fireCooldown, 0.7);
              s.cardTimer = Math.max(0, s.cardTimer - 0.7);
            } else {
              e.colPos -= counterpart?.delivery === 'projector' ? 0.7 : 0.45;
              e.flash = 0.14;
            }
            if (counterpart?.medium === 'signal') {
              s.cardTimer = Math.max(0, s.cardTimer - 0.35);
            } else if (counterpart?.medium === 'thermal') {
              s.player.fireCooldown = Math.max(s.player.fireCooldown, 0.4);
            }
            e.abilityCooldown = 6.5 + (e.value % 4);
          }
        } else if ((e.abilityCooldown ?? 0) <= 0 && e.colPos > 1.15 && e.colPos < 5.3) {
          e.abilityWindup = ENEMY_ABILITY_WINDUP;
        }
      }
      e.colPos -= e.speed * speedScale * dt;
      if (s.stasisGateTimer > 0 && !e.stasisTriggered && e.colPos <= 3.1) {
        e.stasisTriggered = true;
        e.hp -= e.speed >= 1.55 ? 3 : 1;
        e.colPos = Math.min(5.8, e.colPos + (e.speed >= 1.55 ? 0.9 : 0.35));
        e.flash = 0.16;
        if (e.hp <= 0) { e.colPos = -9; s.score += 100; }
      }
      e.flash = Math.max(0, e.flash - dt);
      if (e.genome?.regeneration && s.freezeTimer <= 0 && !(s.signalJamTimer > 0 && isCyberEnemy(e)) && e.hp < (e.maxHp ?? e.hp)) {
        e.regenerationCharge = (e.regenerationCharge ?? 0) + e.genome.regeneration * dt;
        if (e.regenerationCharge >= 1) {
          e.hp++;
          e.regenerationCharge -= 1;
          e.flash = 0.06;
        }
      }
      const clone = cloneSessionRef.current;
      const struckDefender = (['north', 'south'] as const).find((direction) =>
        (clone.statuses[direction] === 'defending' || clone.statuses[direction] === 'defendingHeld')
        && clone.rows[direction] === e.row
        && clone.cols[direction] !== null
        && Math.round(e.colPos) === clone.cols[direction]
        && e.colPos < (clone.cols[direction] as number) + 0.45);
      if (struckDefender) {
        e.colPos = -9;
        playHit();
        showMessage(`${struckDefender.toUpperCase()} clone absorbed the hit and dispersed.`, 1000);
        disperseClone(struckDefender, false);
      }
      if (Math.round(e.colPos) === s.player.col && e.row === s.player.row && e.colPos < s.player.col + 0.45) {
        const eloIsIntangible = playerSkinRef.current === 'gem' && !s.autoBuster;
        const counter = rivalSkillRef.current;
        if (counter.active && counter.id === 'counter') {
          const captured = { ...counter, charges: Math.min(5, counter.charges + 1) };
          rivalSkillRef.current = captured;
          setRivalSkillView(captured);
          e.colPos = -9;
          s.score += 50; // verified damage prevention work
          playHit();
          showMessage(`Pressure intercepted ×${captured.charges}.`, 800);
        } else if (eloIsIntangible) {
          // Player phases while automation is disabled. The enemy continues
          // through the occupied cell without damage or consuming a shield.
        } else if (s.shieldCharges > 0) {
          s.shieldCharges--;
          e.colPos = -9;
          s.score += 25; // verified infrastructure protection work
          showMessage('Shield absorbed a hit!', 1200);
        } else if (s.ghostTimer > 0) {
          // Ghost mode: enemy passes clean through, keep moving (don't remove it)
        } else {
          s.hp--;
          applyIntegrityBreach(
            s,
            1 + (e.genome ? Math.min(1, e.genome.mutations.length * 0.12 + e.genome.fusionLevel * 0.18) : 0),
          );
          const phoenix = rivalSkillRef.current;
          if (phoenix.active && phoenix.id === 'phoenix') {
            const heated = { ...phoenix, charges: Math.min(6, phoenix.charges + 1) };
            rivalSkillRef.current = heated;
            setRivalSkillView(heated);
            if (s.hp <= 0) {
              s.player.col = phoenix.origin.col;
              s.player.row = phoenix.origin.row;
              s.hp = Math.max(1, phoenix.origin.hp);
              showMessage('Phoenix Circuit restored the recorded state!', 1200);
            } else {
              showMessage(`Heat accumulated ×${heated.charges}.`, 800);
            }
          }
          e.colPos = -9;
          playHit();
          if (!(phoenix.active && phoenix.id === 'phoenix' && s.hp > 0)) {
            showMessage('Watch incoming viruses on your row!', 1200);
          }
          if (s.hp <= 0) { updateHud(); endGame(); return; }
        }
      }
    }

    // Compatible species that converge in one lane can fuse into a stronger hybrid.
    for (let i = 0; i < s.enemies.length; i++) {
      const a = s.enemies[i];
      if (a.colPos < -1 || !a.genome) continue;
      for (let j = i + 1; j < s.enemies.length; j++) {
        const b = s.enemies[j];
        if (b.colPos < -1 || !b.genome || a.row !== b.row) continue;
        if (Math.abs(a.colPos - b.colPos) > 0.28) continue;
        if (s.signalJamTimer > 0 && (isCyberEnemy(a) || isCyberEnemy(b))) continue;
        if (!canFuse(a.genome, b.genome, a.value + b.value + s.wave)) continue;
        a.genome = fuseGenomes(a.genome, b.genome);
        s.ecosystemStats.totalFusions++;
        s.ecosystemStats.maxGeneration = Math.max(s.ecosystemStats.maxGeneration, a.genome.generation);
        // Fusion creates a new procedural identity instead of collapsing back
        // into the old 1–255 catalog.
        a.value = (((a.value * 1664525) ^ (b.value * 1013904223) ^ (s.wave * 69069)) >>> 0) % 0x7ffffffe + 1;
        a.hp = Math.min(8, a.hp + b.hp);
        a.maxHp = a.hp;
        a.speed = (a.speed + b.speed) * 0.5;
        a.flash = 0.16;
        a.ability = enemyCounterpartFor(a.genome);
        a.counterpartAbilityId = linkedPlayerAbility(a.genome);
        a.abilityCooldown = Math.max(3.5, a.abilityCooldown ?? 5);
        a.abilityWindup = 0;
        b.colPos = -9;
        const fusedSignature = genomeSignature(a);
        if (fusedSignature && !s.ecosystemStats.entitySignatures.includes(fusedSignature)) {
          s.ecosystemStats.entitySignatures.push(fusedSignature);
        }
        if (a.genome) recordBestiary(a.value, a.genome);
        registerSpawn(getMorphSig(a.value));
        break;
      }
    }

    // Bullet–enemy collisions
    for (const b of s.bullets) {
      for (const e of s.enemies) {
        if (Math.abs(b.colPos - e.colPos) < (b.big ? 0.52 : 0.38) && b.row === e.row) {
          if (!b.pierce) b.colPos = 99;
          const movement = movementClassOf(e);
          let damage = b.power ?? 1;
          if ((e.genome?.fusionLevel ?? 0) > 0) damage += s.runUpgrades.hybridHunter ?? 0;
          if (s.adaptiveAmmoTimer > 0) {
            if (movement === 'fortress' || e.genome?.mutations.includes('armored')) damage += 2;
            else if (movement === 'spectral' || movement === 'colony' || isCyberEnemy(e)) damage += 1;
          }
          e.hp -= damage;
          const phaseSuppressed = s.freezeTimer > 0
            || (s.signalJamTimer > 0 && isCyberEnemy(e))
            || (s.adaptiveAmmoTimer > 0 && movement === 'spectral');
          if (!phaseSuppressed && e.genome?.phaseChance && Math.random() < e.genome.phaseChance) {
            e.hp += damage;
            e.flash = 0.04;
            continue;
          }
          e.flash = 0.08;
          if (e.hp <= 0) {
            if (m) addParticles(m.x + (e.colPos + 0.5) * m.cell, m.y + (e.row + 0.5) * m.cell, '#7dd3fc');
            e.colPos = -9;
            s.lanePressure[e.row] = Math.min(6, s.lanePressure[e.row] + 1);
            s.score += s.overdriveTimer > 0 || e.catalystMarked ? 300 : 100;
            if (s.score % 500 === 0) s.wave++;
            if (s.drainTimer > 0) { s.hp++; }
            if (s.overloadTimer > 0) {
              s.bullets.push({
                colPos: s.player.col + 0.55,
                row: e.row,
                speed: 8.5,
                power: 1,
                big: false,
                pierce: false,
                attackStyle: resolveAttackStyle(),
                effectSkin: playerSkinRef.current,
              });
            }
            // Record kill for CGRD reward
            rewardAccRef.current.recordKill(e.value ?? 1);
            setSessionCGRD(rewardAccRef.current.totalCGRD);
            playScore();
            updateHud();
          } else {
            playHit();
          }
        }
      }
    }

    for (const defeated of s.enemies) {
      if (defeated.colPos <= -1 && defeated.hp <= 0 && defeated.genome) {
        awardAvatarComponent(
          defeated.genome,
          dominantPlaystyleSignal(playstyleSignalsRef.current),
        );
      }
    }
    s.enemies = s.enemies.filter((e) => e.colPos > -1);
    for (let row = 0; row < 3; row++) {
      s.lanePressure[row] = Math.max(0, s.lanePressure[row] - dt * 0.09);
    }

    for (const p of s.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
    }
    s.particles = s.particles.filter((p) => p.life > 0);

    // ── VS mode: NPC AI ───────────────────────────────────────────────────────
    if (s.gameMode === 'vs') {
      const npc = s.npc;
      const npcCol = 3 + npc.col;

      // Move toward the most-advanced (rightmost) incoming green attack
      npc.moveCooldown -= dt;
      if (npc.moveCooldown <= 0) {
        npc.moveCooldown = NPC_MOVE_INTERVAL;
        if (Math.random() < 0.68) {
          if (npc.row < s.player.row) npc.row++;
          else if (npc.row > s.player.row) npc.row--;
        } else if (Math.random() < 0.2) {
          npc.row = Math.max(0, Math.min(2, npc.row + (Math.random() < 0.5 ? 1 : -1)));
        }
      }

      // Fire a left-moving bullet only when a green attack is in the NPC's row
      npc.fireCooldown -= dt;
      if (npc.fireCooldown <= 0) {
        s.npcBullets.push({
          colPos: npcCol - 0.55,
          row: npc.row,
          speed: -6.4,
          power: 1,
          big: false,
          pierce: false,
          attackStyle: resolveAttackStyle(npcSkinRef.current),
          effectSkin: npcSkinRef.current,
        });
        npc.fireCooldown = NPC_FIRE_INTERVAL;
      }

      // Move NPC bullets left; remove when they exit the active zone
      for (const b of s.npcBullets) b.colPos += b.speed * dt;
      s.npcBullets = s.npcBullets.filter((b) => b.colPos > -1);

      // Move green attacks right; score against NPC when they reach the right wall
      for (const e of s.npcEnemies) {
        e.colPos += e.speed * dt;
        e.flash = Math.max(0, e.flash - dt);
        if (e.colPos >= 5.55) {
          e.colPos = -9; // remove
          if (npc.shieldCharges > 0) {
            npc.shieldCharges--;
            showMessage('NPC shield blocked an attack!', 1000);
            updateHud();
          } else {
            npc.hp--;
            if (npc.hp <= 0) { updateHud(); endGame(true); return; }
            updateHud();
          }
        }
      }
      s.npcEnemies = s.npcEnemies.filter((e) => e.colPos > -1);

      // NPC bullet vs green attack collision
      for (const b of s.npcBullets) {
        for (const e of s.npcEnemies) {
          if (e.colPos < 0) continue;
          if (Math.abs(b.colPos - e.colPos) < 0.42 && b.row === e.row) {
            b.colPos = 2.0; // kill bullet (filtered < 2.4 next frame)
            e.hp -= b.power;
            e.flash = 0.08;
            if (e.hp <= 0) {
              if (m) addParticles(
                m.x + (e.colPos + 0.5) * m.cell,
                m.y + (e.row + 0.5) * m.cell,
                '#4ade80',
              );
              e.colPos = -9;
              // NPC heals on every intercept — no cap, can exceed base HP
              npc.hp++;
              showMessage('NPC intercepted an attack and healed!', 900);
              updateHud();
            }
            break;
          }
        }
      }

      // Direct duel collisions: Player shots cross the seam into the selected
      // NPC, while the NPC's return fire crosses back into the Player grid.
      for (const bullet of s.bullets) {
        if (bullet.colPos > 20 || bullet.row !== npc.row) continue;
        if (Math.abs(bullet.colPos - npcCol) < (bullet.big ? 0.52 : 0.38)) {
          if (!bullet.pierce) bullet.colPos = 99;
          if (npc.shieldCharges > 0) {
            npc.shieldCharges--;
          } else {
            npc.hp -= bullet.power ?? 1;
            s.score += 100;
            if (npc.hp <= 0) { updateHud(); endGame(true); return; }
          }
          playHit();
          updateHud();
        }
      }
      for (const bullet of s.npcBullets) {
        if (bullet.row !== s.player.row) continue;
        if (Math.abs(bullet.colPos - s.player.col) < (bullet.big ? 0.52 : 0.38)) {
          bullet.colPos = -9;
          if (s.shieldCharges > 0) {
            s.shieldCharges--;
          } else if (s.ghostTimer <= 0) {
            s.hp -= bullet.power ?? 1;
            if (s.hp <= 0) { updateHud(); endGame(false); return; }
          }
          playHit();
          updateHud();
        }
      }
      s.npcBullets = s.npcBullets.filter((bullet) => bullet.colPos > -1 && bullet.colPos < 7);
    }
  }, [handleGamepad, tryMoveTo, moveControlledClone, manualBuster, queueSkillTap, queueR2ControlCycle, resolveCloneAction, resolveRivalSkillAction, finishRivalSkill, switchCloneControl, disperseClone, rotateHand, fireBullet, resolveAttackStyle, addParticles, showMessage, updateHud, endGame, recordBestiary, awardAvatarComponent, chooseRunUpgrade, openUpgradeSelection, closeUpgradeSelection, activateAbilityPreset]);

  const loop = useCallback((ts: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = ts;
    const dt = Math.min(0.1, (ts - lastTimeRef.current) / 1000);
    lastTimeRef.current = ts;

    // Advance gameplay when active; otherwise keep polling controllers for
    // menus, pause, and game-over actions.
    if (phaseRef.current === 'playing' && !pausedRef.current && stateRef.current.running) {
      update(dt);
      reconcileIntegrityWork(stateRef.current);
      setSystemIntegrityAudio(stateRef.current.systemIntegrity.node);
    } else if (phaseRef.current === 'menu') {
      handleGamepad();
      const gp = gamepadRef.current;
      menuNavCooldownRef.current = Math.max(0, menuNavCooldownRef.current - dt);
      if (menuScreenRef.current === 'main') {
        if (Math.abs(gp.moveY) > 0.15 && menuNavCooldownRef.current <= 0) {
          const direction = gp.moveY > 0 ? 1 : -1;
          menuSelectionRef.current = (menuSelectionRef.current + direction + 5) % 5;
          setMenuSelection(menuSelectionRef.current);
          const ids = ['menuPlayBtn', 'menuVsBtn', 'menuCustomBtn', 'menuBestiaryBtn', 'menuOptionsBtn'];
          scrollMenuTargetIntoView(document.getElementById(ids[menuSelectionRef.current]));
          menuNavCooldownRef.current = 0.22;
        }
        if (gp.fire && !gp.prevFire) {
          const ids = ['menuPlayBtn', 'menuVsBtn', 'menuCustomBtn', 'menuBestiaryBtn', 'menuOptionsBtn'];
          document.getElementById(ids[menuSelectionRef.current])?.click();
        }
      } else if (menuScreenRef.current === 'vs-select') {
        const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.vs-skin-btn'));
        if (buttons.length > 0) {
          if (Math.abs(gp.moveX) > 0.15 && menuNavCooldownRef.current <= 0) {
            const direction = gp.moveX > 0 ? 1 : -1;
            vsSelectionRef.current = (vsSelectionRef.current + direction + buttons.length) % buttons.length;
            buttons.forEach((button, index) => {
              button.classList.toggle('gamepad-selected', index === vsSelectionRef.current);
            });
            scrollMenuTargetIntoView(buttons[vsSelectionRef.current]);
            menuNavCooldownRef.current = 0.18;
          }
          if (gp.fire && !gp.prevFire) buttons[vsSelectionRef.current]?.click();
        }
        if (gp.cardB && !gp.prevCardB) document.getElementById('menuBackBtn')?.click();
      } else if (menuScreenRef.current === 'bestiary') {
        const axis = Math.abs(gp.moveY) > 0.15 ? gp.moveY : gp.moveX;
        if (Math.abs(axis) > 0.15 && menuNavCooldownRef.current <= 0) {
          moveBestiarySelection(axis > 0 ? 1 : -1);
          menuNavCooldownRef.current = 0.22;
        }
        if (gp.cardB && !gp.prevCardB) document.getElementById('menuBackBtn')?.click();
      } else if (menuScreenRef.current === 'options') {
        if (Math.abs(gp.moveY) > 0.15 && menuNavCooldownRef.current <= 0) {
          scrollMenuByDpad(gp.moveY > 0 ? 1 : -1);
          menuNavCooldownRef.current = 0.22;
        }
        if (gp.fire && !gp.prevFire) document.getElementById('menuDpadToggleBtn')?.click();
        if (gp.cardB && !gp.prevCardB) document.getElementById('menuBackBtn')?.click();
      } else if (menuScreenRef.current === 'customization') {
        const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(
          '.customization-card button:not(:disabled)',
        ));
        if (buttons.length > 0) {
          customizationSelectionRef.current = Math.min(
            customizationSelectionRef.current,
            buttons.length - 1,
          );
          const horizontal = Math.abs(gp.moveX) > 0.15 ? Math.sign(gp.moveX) : 0;
          const vertical = Math.abs(gp.moveY) > 0.15 ? Math.sign(gp.moveY) : 0;
          if ((horizontal !== 0 || vertical !== 0) && menuNavCooldownRef.current <= 0) {
            buttons[customizationSelectionRef.current]?.classList.remove('gamepad-selected');
            const current = buttons[customizationSelectionRef.current];
            const currentRect = current.getBoundingClientRect();
            const currentX = currentRect.left + currentRect.width / 2;
            const currentY = currentRect.top + currentRect.height / 2;
            const useVertical = vertical !== 0 && (
              horizontal === 0 || Math.abs(gp.moveY) >= Math.abs(gp.moveX)
            );
            const direction = useVertical ? vertical : horizontal;
            let bestIndex = customizationSelectionRef.current;
            let bestScore = Number.POSITIVE_INFINITY;
            buttons.forEach((button, index) => {
              if (button === current) return;
              const rect = button.getBoundingClientRect();
              const deltaX = rect.left + rect.width / 2 - currentX;
              const deltaY = rect.top + rect.height / 2 - currentY;
              const primary = useVertical ? deltaY * direction : deltaX * direction;
              if (primary <= 3) return;
              const secondary = Math.abs(useVertical ? deltaX : deltaY);
              // Directional distance dominates, while alignment keeps Up/Down
              // in the same option column and Left/Right in the same row.
              const score = primary + secondary * 2.4;
              if (score < bestScore) {
                bestScore = score;
                bestIndex = index;
              }
            });
            customizationSelectionRef.current = bestIndex;
            buttons[customizationSelectionRef.current]?.classList.add('gamepad-selected');
            if (bestIndex === buttons.indexOf(current) && useVertical) {
              scrollMenuByDpad(vertical);
            } else {
              scrollMenuTargetIntoView(buttons[customizationSelectionRef.current]);
            }
            menuNavCooldownRef.current = 0.18;
          } else {
            buttons[customizationSelectionRef.current]?.classList.add('gamepad-selected');
          }
          if (gp.fire && !gp.prevFire) {
            buttons[customizationSelectionRef.current]?.click();
          }
        }
        if (gp.cardB && !gp.prevCardB) document.getElementById('menuBackBtn')?.click();
      }
    } else if (phaseRef.current === 'playing' && !pausedRef.current && !stateRef.current.running) {
      handleGamepad();
      const gp = gamepadRef.current;
      if (gp.fire && !gp.prevFire) document.getElementById('playAgainBtn')?.click();
    } else if (phaseRef.current === 'playing' && pausedRef.current) {
      handleGamepad();
      const gp = gamepadRef.current;
      if (pauseOptionsRef.current) {
        if (gp.fire && !gp.prevFire) document.getElementById('pauseDpadToggleBtn')?.click();
        if (gp.cardB && !gp.prevCardB) {
          pauseOptionsRef.current = false;
          setPauseOptions(false);
        }
        if (gp.start && !gp.prevStart) togglePause();
      } else if (pauseBestiaryRef.current) {
        menuNavCooldownRef.current = Math.max(0, menuNavCooldownRef.current - dt);
        const axis = Math.abs(gp.moveY) > 0.15 ? gp.moveY : gp.moveX;
        if (Math.abs(axis) > 0.15 && menuNavCooldownRef.current <= 0) {
          moveBestiarySelection(axis > 0 ? 1 : -1);
          menuNavCooldownRef.current = 0.22;
        }
        if (gp.cardB && !gp.prevCardB) {
          pauseBestiaryRef.current = false;
          setPauseBestiary(false);
        }
        if (gp.start && !gp.prevStart) togglePause();
      } else {
        menuNavCooldownRef.current = Math.max(0, menuNavCooldownRef.current - dt);
        if (Math.abs(gp.moveY) > 0.15 && menuNavCooldownRef.current <= 0) {
          const direction = gp.moveY > 0 ? 1 : -1;
          pauseSelectionRef.current = (pauseSelectionRef.current + direction + 4) % 4;
          setPauseSelection(pauseSelectionRef.current);
          menuNavCooldownRef.current = 0.22;
        }
        if (gp.fire && !gp.prevFire) {
          const ids = ['pauseResumeBtn', 'pauseBestiaryBtn', 'pauseOptionsBtn', 'pauseMenuBtn'];
          document.getElementById(ids[pauseSelectionRef.current])?.click();
        }
        if (gp.start && !gp.prevStart) togglePause();
      }
    }

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      // Pass hasOverlay flag — tells renderer to skip drawing the default robot body
      const skinHasOverlay = playerSkinRef.current === 'rocket'
        || playerSkinRef.current === 'dots'
        || playerSkinRef.current === 'gem'
        || playerSkinRef.current === 'assembly'
        || RIVAL_SKILL_IDS.includes(playerSkinRef.current as RivalSkillId);
      const npcHasOverlay = stateRef.current.gameMode === 'vs' && npcSkinRef.current !== 'default';
      if (ctx) draw(
        ctx,
        canvas.offsetWidth,
        canvas.offsetHeight,
        stateRef.current,
        skinHasOverlay,
        npcHasOverlay,
      );

      // Update DOM sprite overlay — position wrap, then blit pre-processed frame
      if (skinHasOverlay) {
        const wrap    = spriteWrapRef.current;
        const sCanvas = spriteCanvasRef.current;
        if (wrap && sCanvas) {
          const m  = getBoardMetrics(canvas.offsetWidth, canvas.offsetHeight);
          const px = m.x + (stateRef.current.player.col + 0.5) * m.cell;
          const py = m.y + (stateRef.current.player.row + 0.5) * m.cell;
          const rivalSkin = RIVAL_SKILL_IDS.includes(playerSkinRef.current as RivalSkillId);
          const szScale = playerSkinRef.current === 'dots' ? 1.0 : playerSkinRef.current === 'gem' ? 0.85 : rivalSkin ? 1.08 : 0.72;
          const sz = Math.round(m.cell * szScale);
          wrap.style.left   = `${px}px`;
          wrap.style.top    = `${py}px`;
          wrap.style.width  = `${sz}px`;
          wrap.style.height = `${sz}px`;

          const frames = gifFramesRef.current;
          if (playerSkinRef.current === 'assembly') {
            if (sCanvas.width !== sz || sCanvas.height !== sz) {
              sCanvas.width = sz;
              sCanvas.height = sz;
            }
            sCanvas.getContext('2d')?.clearRect(0, 0, sz, sz);
          } else if (frames.length > 0) {
            // Rocket: shoot-pose state machine via rocketFrameRef
            // Dots: auto-cycle walk animation via performance.now()
            // Gem idle: auto-cycle; Gem attack: use gifAttackFramesRef + gemAttackFrameRef
            let bitmap: ImageBitmap;
            let rivalAttackBitmap: ImageBitmap | undefined;
            let rivalAttackProgress = 0;
            if (playerSkinRef.current === 'rocket' && rocketFrameRef.current >= 0) {
              // Rocket attack — cycle through gifAttackFramesRef
              const aFrames = gifAttackFramesRef.current;
              bitmap = aFrames[Math.min(rocketFrameRef.current, aFrames.length - 1)];
            } else if (playerSkinRef.current === 'gem' && gemAttackFrameRef.current >= 0) {
              // Gem attack takes highest priority
              const aFrames = gifAttackFramesRef.current;
              bitmap = aFrames[gemAttackFrameRef.current % Math.max(1, aFrames.length)];
            } else if (rivalSkin && gemAttackFrameRef.current >= 0) {
              bitmap = frames[0];
              rivalAttackBitmap = gifAttackFramesRef.current[0];
              rivalAttackProgress = Math.max(0, Math.min(
                1,
                (performance.now() - rivalAttackStartedRef.current) / RIVAL_ATTACK_DURATION,
              ));
            } else if (playerSkinRef.current === 'gem' && gemMoveStartRef.current >= 0) {
              // Gem movement second priority
              const mFrames = gifMoveFramesRef.current;
              const elapsed = performance.now() - gemMoveStartRef.current;
              const mIdx = Math.min(Math.floor(elapsed / GEM_MOVE_FRAME_MS), mFrames.length - 1);
              bitmap = mFrames[mIdx % Math.max(1, mFrames.length)];
            } else if (playerSkinRef.current === 'dots' || playerSkinRef.current === 'gem') {
              // Idle auto-cycle
              bitmap = frames[Math.floor(performance.now() / 120) % frames.length];
            } else {
              // Rocket idle — frames[0] is the only idle frame
              bitmap = frames[0];
            }
            if (sCanvas.width !== sz || sCanvas.height !== sz) {
              sCanvas.width  = sz;
              sCanvas.height = sz;
            }
            const sctx = sCanvas.getContext('2d');
            if (sctx) {
              sctx.clearRect(0, 0, sz, sz);
              const mirror = playerSkinRef.current === 'gem' && gemMoveMirrorRef.current;
              if (mirror) {
                sctx.save();
                sctx.translate(sz, 0);
                sctx.scale(-1, 1);
                sctx.drawImage(bitmap, 0, 0, sz, sz);
                sctx.restore();
              } else if (rivalAttackBitmap) {
                // Never cross-fade the idle and attack bodies. Their different
                // silhouettes were being seen simultaneously as motion blur.
                const committed = rivalAttackProgress >= 0.16 && rivalAttackProgress <= 0.9;
                sctx.drawImage(committed ? rivalAttackBitmap : bitmap, 0, 0, sz, sz);

                // Advanced skins use the authored raster weapon sequence,
                // replacing the former circles, claw arcs and circuit lines.
                const sheet = rivalAttackFxSheetRef.current;
                if (committed && sheet?.complete && sheet.naturalWidth > 0) {
                  const effectProgress = Math.max(0, Math.min(1, (rivalAttackProgress - 0.2) / 0.62));
                  const effectFrame = Math.min(3, Math.floor(effectProgress * 4));
                  const sourceWidth = sheet.naturalWidth / 4;
                  const sourceHeight = sheet.naturalHeight / 4;
                  sctx.save();
                  sctx.globalCompositeOperation = 'screen';
                  sctx.globalAlpha = Math.sin(effectProgress * Math.PI) * 0.94;
                  sctx.imageSmoothingEnabled = false;
                  sctx.drawImage(
                    sheet,
                    effectFrame * sourceWidth,
                    0,
                    sourceWidth,
                    sourceHeight,
                    sz * 0.45,
                    sz * 0.13,
                    sz * 0.72,
                    sz * 0.72,
                  );
                  sctx.restore();
                }
              } else {
                sctx.drawImage(bitmap, 0, 0, sz, sz);
              }
            }
          }
        }
      }

      if (npcHasOverlay) {
        const wrap = npcSpriteWrapRef.current;
        const npcCanvas = npcSpriteCanvasRef.current;
        if (wrap && npcCanvas) {
          const m = getBoardMetrics(canvas.offsetWidth, canvas.offsetHeight);
          const npc = stateRef.current.npc;
          const px = m.x + (3 + npc.col + 0.5) * m.cell;
          const py = m.y + (npc.row + 0.5) * m.cell;
          const sz = Math.round(m.cell * 1.08);
          wrap.style.left = `${px}px`;
          wrap.style.top = `${py}px`;
          wrap.style.width = `${sz}px`;
          wrap.style.height = `${sz}px`;
          if (npcCanvas.width !== sz || npcCanvas.height !== sz) {
            npcCanvas.width = sz;
            npcCanvas.height = sz;
          }
          const npcCtx = npcCanvas.getContext('2d');
          npcCtx?.clearRect(0, 0, sz, sz);
          const frame = npcFrameRef.current;
          if (npcCtx && frame && npcSkinRef.current !== 'assembly') {
            npcCtx.imageSmoothingEnabled = false;
            npcCtx.save();
            npcCtx.translate(sz, 0);
            npcCtx.scale(-1, 1);
            npcCtx.drawImage(frame, 0, 0, sz, sz);
            npcCtx.restore();
          }
        }
      }

      const metrics = getBoardMetrics(canvas.offsetWidth, canvas.offsetHeight);
      const positionSkillEffect = (wrap: HTMLDivElement | null, direction: CloneDirection) => {
        if (!wrap) return;
        const targetRow = cloneSessionRef.current.rows[direction];
        const targetCol = cloneSessionRef.current.cols[direction];
        const onGrid = targetRow !== null && targetCol !== null;
        wrap.style.display = onGrid ? 'block' : 'none';
        if (!onGrid || targetRow === null || targetCol === null) return;
        const px = metrics.x + (targetCol + 0.5) * metrics.cell;
        const py = metrics.y + (targetRow + 0.5) * metrics.cell;
        const width = Math.round(metrics.cell * 1.55);
        wrap.style.left = `${px}px`;
        wrap.style.top = `${py}px`;
        wrap.style.width = `${width}px`;
        wrap.style.height = `${Math.round(width * 2 / 3)}px`;
      };
      positionSkillEffect(skillNorthFxRef.current, 'north');
      positionSkillEffect(skillSouthFxRef.current, 'south');
      const playerSkillFx = skillPlayerFxRef.current;
      if (playerSkillFx) {
        const px = metrics.x + (stateRef.current.player.col + 0.5) * metrics.cell;
        const py = metrics.y + (stateRef.current.player.row + 0.5) * metrics.cell;
        playerSkillFx.style.left = `${px}px`;
        playerSkillFx.style.top = `${py}px`;
        playerSkillFx.style.width = `${Math.round(metrics.cell * 0.78)}px`;
        playerSkillFx.style.height = `${Math.round(metrics.cell * 0.9)}px`;
      }

      const positionClone = (wrap: HTMLDivElement | null, direction: CloneDirection) => {
        if (!wrap) return;
        const row = cloneSessionRef.current.rows[direction];
        const col = cloneSessionRef.current.cols[direction];
        const onGrid = cloneSessionRef.current.visible && cloneSessionRef.current.revealed
          && row !== null && col !== null;
        wrap.style.display = onGrid ? 'block' : 'none';
        if (!onGrid || row === null || col === null) return;
        const px = metrics.x + (col + 0.5) * metrics.cell;
        const py = metrics.y + (row + 0.5) * metrics.cell;
        wrap.style.left = `${px}px`;
        wrap.style.top = `${py}px`;
        wrap.style.width = `${Math.round(metrics.cell * 0.82)}px`;
        wrap.style.height = `${Math.round(metrics.cell * 0.92)}px`;
      };
      positionClone(cloneNorthRef.current, 'north');
      positionClone(cloneSouthRef.current, 'south');
    }

    animRef.current = requestAnimationFrame(loop);
  }, [update, handleGamepad, moveBestiarySelection, scrollMenuByDpad, scrollMenuTargetIntoView]);

  // Resize canvas to match DPR
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const m = getBoardMetrics(window.innerWidth, window.innerHeight);
    setBoardBottom(m.y + m.boardH);
  }, []);

  const startGame = useCallback((mode: GameMode = 'classic') => {
    for (const direction of ['north', 'south'] as const) {
      const timer = cloneActionTimersRef.current[direction];
      if (timer) clearTimeout(timer);
      cloneActionTimersRef.current[direction] = null;
      const expiryTimer = cloneExpiryTimersRef.current[direction];
      if (expiryTimer) clearTimeout(expiryTimer);
      cloneExpiryTimersRef.current[direction] = null;
      const autoFireTimer = cloneAutoFireTimersRef.current[direction];
      if (autoFireTimer) clearInterval(autoFireTimer);
      cloneAutoFireTimersRef.current[direction] = null;
    }
    const clearedClones = emptyCloneView();
    cloneSessionRef.current = clearedClones;
    setCloneView(clearedClones);
    const clearedRivalSkill = emptyRivalSkillView();
    rivalSkillRef.current = clearedRivalSkill;
    setRivalSkillView(clearedRivalSkill);
    stateRef.current = makeInitialState(enabledAbilitiesRef.current, mode);
    eloAttackDirectionRef.current = 1;
    gemMoveMirrorRef.current = true;
    lastTimeRef.current = 0;
    hudTickRef.current = 0;
    phaseRef.current = 'playing';
    menuSelectionRef.current = 0;
    setMenuSelection(0);
    setPhase('playing');
    updateHud();
    if (mode === 'vs') {
      showMessage('DIRECT DUEL — move, fire, and reduce the opposing NPC to 0 HP!', 3000);
    } else {
      showMessage('Tap blue panels to move. Use BUSTER button to fire manually.', 2500);
    }
    startMusic(() => stateRef.current.running);
  }, [updateHud, showMessage]);

  const togglePause = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    const s = stateRef.current;
    if (!s.running) return;
    pausedRef.current = !pausedRef.current;
    if (pausedRef.current) {
      pauseSelectionRef.current = 0;
      setPauseSelection(0);
      menuNavCooldownRef.current = 0;
    } else {
      pauseBestiaryRef.current = false;
      setPauseBestiary(false);
      pauseOptionsRef.current = false;
      setPauseOptions(false);
    }
    lastTimeRef.current = 0; // reset so dt doesn't spike on resume
    setPaused(pausedRef.current);
  }, []);

  const restart = useCallback(() => {
    stopMusic();
    for (const direction of ['north', 'south'] as const) {
      const timer = cloneActionTimersRef.current[direction];
      if (timer) clearTimeout(timer);
      cloneActionTimersRef.current[direction] = null;
      const expiryTimer = cloneExpiryTimersRef.current[direction];
      if (expiryTimer) clearTimeout(expiryTimer);
      cloneExpiryTimersRef.current[direction] = null;
      const autoFireTimer = cloneAutoFireTimersRef.current[direction];
      if (autoFireTimer) clearInterval(autoFireTimer);
      cloneAutoFireTimersRef.current[direction] = null;
    }
    const clearedClones = emptyCloneView();
    cloneSessionRef.current = clearedClones;
    setCloneView(clearedClones);
    const clearedRivalSkill = emptyRivalSkillView();
    rivalSkillRef.current = clearedRivalSkill;
    setRivalSkillView(clearedRivalSkill);
    stateRef.current = makeInitialState(enabledAbilitiesRef.current);
    lastTimeRef.current = 0;
    hudTickRef.current = 0;
    phaseRef.current = 'menu';
    menuScreenRef.current = 'main';
    menuSelectionRef.current = 0;
    pauseSelectionRef.current = 0;
    pausedRef.current = false;
    pauseBestiaryRef.current = false;
    pauseOptionsRef.current = false;
    // Reset reward accumulator for new session
    rewardAccRef.current.reset();
    setSessionCGRD(0);
    setGameKills([]);
    setPaused(false);
    setPauseBestiary(false);
    setPauseOptions(false);
    setMenuScreen('main');
    setMenuSelection(0);
    setPauseSelection(0);
    setPhase('menu');
    updateHud();
  }, [updateHud]);

  // Pointer tap on board to move player
  const handleCanvasPointer = useCallback((ev: React.PointerEvent<HTMLCanvasElement>) => {
    ensureAudio();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    const m = getBoardMetrics(canvas.offsetWidth, canvas.offsetHeight);
    if (x < m.x || x > m.x + m.boardW || y < m.y || y > m.y + m.boardH) return;
    const col = Math.floor((x - m.x) / m.cell);
    const row = Math.floor((y - m.y) / m.cell);
    if (col > 2) return;
    if (cloneSessionRef.current.playerLocked) {
      moveControlledCloneTo(col, row);
    } else {
      tryMoveTo(col, row);
    }
  }, [moveControlledCloneTo, tryMoveTo]);

  // Dpad touch setup — stable handler refs so cleanup matches the originals
  const setupDpad = useCallback((dir: keyof typeof touchDpadRef.current, el: HTMLElement) => {
    const setTrue  = () => { touchDpadRef.current[dir] = true; };
    const setFalse = () => { touchDpadRef.current[dir] = false; };
    const onDown = (ev: PointerEvent) => {
      ev.preventDefault();
      ensureAudio();
      el.setPointerCapture(ev.pointerId);
      setTrue();
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', setFalse);
    el.addEventListener('pointercancel', setFalse);
    el.addEventListener('lostpointercapture', setFalse);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', setFalse);
      el.removeEventListener('pointercancel', setFalse);
      el.removeEventListener('lostpointercapture', setFalse);
    };
  }, []);


  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Keyboard
    const onKeyDown = (ev: KeyboardEvent) => {
      ensureAudio();
      // Start game from menu on Enter/Space
      if (phaseRef.current === 'menu') {
        if (ev.key === 'Enter' || ev.key === ' ') startGame();
        return;
      }
      if (ev.repeat) return;
      if (ev.key === 'Escape' || ev.key === 'Enter' || ev.key === 'p' || ev.key === 'P') {
        togglePause();
        return;
      }
      const s = stateRef.current;
      if (!s.running || pausedRef.current) return;
      if (s.upgradeSelectionOpen) {
        if (ev.key === 'Backspace') {
          ev.preventDefault();
          closeUpgradeSelection();
        } else if (ev.key === ' ') {
          ev.preventDefault();
          chooseRunUpgrade(s.upgradeOptions[upgradeSelectionRef.current]);
        } else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp'
          || ev.key === 'ArrowRight' || ev.key === 'ArrowDown') {
          ev.preventDefault();
          const direction = ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : 1;
          const count = s.upgradeOptions.length;
          if (count > 0) {
            upgradeSelectionRef.current =
              (upgradeSelectionRef.current + direction + count) % count;
            setUpgradeSelection(upgradeSelectionRef.current);
          }
        }
        return;
      }
      const k = keyboardRef.current;
      if (ev.key === 'ArrowUp' || ev.key === 'w') k.up = true;
      else if (ev.key === 'ArrowDown' || ev.key === 's') k.down = true;
      else if (ev.key === 'ArrowLeft' || ev.key === 'a') k.left = true;
      else if (ev.key === 'ArrowRight' || ev.key === 'd') k.right = true;
      else if (ev.key === ' ') manualBuster();
      else if ((ev.key === 'q' || ev.key === 'Q') && s.upgradePromptOpen) openUpgradeSelection();
      else if (rivalSkillRef.current.active && (ev.key === 'z' || ev.key === 'Z')) {
        resolveRivalSkillAction('primary');
      } else if (rivalSkillRef.current.active && (ev.key === 'x' || ev.key === 'X')) {
        resolveRivalSkillAction('alternate');
      } else if (rivalSkillRef.current.active && (ev.key === 'c' || ev.key === 'C')) {
        resolveRivalSkillAction('defend');
      } else if (cloneSessionRef.current.inputActive && (ev.key === 'z' || ev.key === 'Z')) {
        resolveCloneAction('attack');
      } else if (cloneSessionRef.current.inputActive && (ev.key === 'x' || ev.key === 'X')) {
        switchCloneControl();
      } else if (cloneSessionRef.current.inputActive && (ev.key === 'c' || ev.key === 'C')) {
        resolveCloneAction('defend');
      } else if ((ev.key === 'z' || ev.key === 'Z') && s.currentCardOptions[0]) useCard(s.currentCardOptions[0]);
      else if ((ev.key === 'x' || ev.key === 'X') && s.currentCardOptions[1]) useCard(s.currentCardOptions[1]);
      else if ((ev.key === 'c' || ev.key === 'C') && s.currentCardOptions[2]) useCard(s.currentCardOptions[2]);
      else if ((ev.key === 'v' || ev.key === 'V') && !ev.repeat) queueSkillTap();
      else if (ev.key === 'f' || ev.key === 'F') rotateHand();
    };
    const onKeyUp = (ev: KeyboardEvent) => {
      const k = keyboardRef.current;
      if (ev.key === 'ArrowUp' || ev.key === 'w') k.up = false;
      else if (ev.key === 'ArrowDown' || ev.key === 's') k.down = false;
      else if (ev.key === 'ArrowLeft' || ev.key === 'a') k.left = false;
      else if (ev.key === 'ArrowRight' || ev.key === 'd') k.right = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // D-pad
    const dpadMap: [string, keyof typeof touchDpadRef.current][] = [
      ['dpadUp', 'up'], ['dpadDown', 'down'], ['dpadLeft', 'left'], ['dpadRight', 'right'],
    ];
    const cleanups: (() => void)[] = [];
    for (const [id, dir] of dpadMap) {
      const el = document.getElementById(id);
      if (el) cleanups.push(setupDpad(dir, el));
    }

    // D-pad center = fire
    const center = document.getElementById('dpadCenter');
    if (center) {
      const onDown = (ev: PointerEvent) => { ev.preventDefault(); ensureAudio(); center.setPointerCapture(ev.pointerId); manualBuster(); };
      center.addEventListener('pointerdown', onDown);
      cleanups.push(() => center.removeEventListener('pointerdown', onDown));
    }

    // Start canvas render loop immediately (draws idle state behind menu)
    animRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animRef.current);
      stopMusic();
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      cleanups.forEach((c) => c());
    };
  }, [resizeCanvas, loop, manualBuster, openUpgradeSelection, closeUpgradeSelection, chooseRunUpgrade, queueSkillTap,
    resolveCloneAction, resolveRivalSkillAction, setupDpad, startGame, switchCloneControl, togglePause, rotateHand, useCard]);

  const toggleAuto = () => {
    ensureAudio();
    playAutoToggle();
    stateRef.current.autoBuster = !stateRef.current.autoBuster;
    updateHud();
  };

  const toggleVirtualDpad = () => {
    setVirtualDpadEnabled((enabled) => {
      const next = !enabled;
      localStorage.setItem(VIRTUAL_DPAD_KEY, next ? 'on' : 'off');
      return next;
    });
  };

  const cardProgress = Math.max(0, Math.min(1, hud.cardTimer / CARD_CHARGE_TIME));
  const equippedAssemblyParts = AVATAR_SLOTS
    .map((slot) => avatarComponents.find((component) => component.id === equippedAvatarComponents[slot]))
    .filter((part): part is AvatarComponentDrop => Boolean(part));
  const assemblyFit = analyzeAssemblyFit(equippedAssemblyParts);
  const bestiaryPanel = (onBack: () => void) => (
    <div id="bestiaryCard">
      <div id="bestiaryHeader">
        <div>
          <div id="bestiaryTitle">BESTIARY</div>
          <div id="bestiaryCount">{bestiaryEntries.length} stable discoveries</div>
          <div id="abilityMatrixCount">{PLAYER_ABILITY_MATRIX.length} constitution counterparts mapped</div>
        </div>
        <button id="menuBackBtn" className="bestiaryBackBtn" onClick={(ev) => { ev.stopPropagation(); onBack(); }}>← BACK</button>
      </div>
      <div id="bestiaryLegend">
        <span>CORE</span><span>ELEMENT</span><span>TYPE</span><span>CLASS</span><span>ABILITY COMPONENTS</span>
      </div>
      {bestiaryEntries.length === 0 ? (
        <div id="bestiaryEmpty">Encounter entities in play to record stable genome snapshots.</div>
      ) : (
        <div id="bestiaryGrid">
          {bestiaryEntries.map((entry, index) => {
            const genome = entry.genome;
            const constitutionAbility = enemyCounterpartFor(genome);
            const blueprint = abilityBlueprintFor(genome);
            const linkedAbility = entry.synchronizedAbilityId
              ? runtimeAbilityById(entry.synchronizedAbilityId)
              : manifestedAbilityFor(genome);
            const observations = Math.max(1, entry.observations ?? 1);
            const synchronized = Boolean(entry.synchronizedAbilityId);
            return (
              <article
                id={`bestiaryEntry-${index}`}
                className={`bestiaryEntry${bestiarySelection === index ? ' gamepad-selected' : ''}`}
                key={entry.signature}
              >
                <BestiarySprite seed={entry.seed} genome={genome} />
                <div className="bestiaryIdentity">
                  {genome.entityType.toUpperCase()} / {genome.element.toUpperCase()} / {genome.enemyClass.toUpperCase()}
                </div>
                <div className="bestiaryMeta">
                  <span>Core <b>{genome.baseElement}</b></span>
                  <span>Generation <b>{genome.generation}</b></span>
                  <span>Fusion <b>{genome.fusionLevel}</b></span>
                  <span>Niche <b>{genome.niche}</b></span>
                </div>
                <div className="bestiaryTraits">
                  {genome.mutations.length > 0 ? genome.mutations.join(' · ') : 'baseline'}
                  {constitutionAbility ? ` · ability: ${constitutionAbility}` : ''}
                </div>
                <div className="bestiaryComponents">
                  <span>{blueprint.delivery}</span>
                  <span>{blueprint.function}</span>
                  <span>{blueprint.medium}</span>
                </div>
                <div className={`bestiarySynchrony${synchronized ? ' synchronized' : ''}`}>
                  <strong>{synchronized ? 'SYNCHRONIZED' : `SYNCHRONY ${observations}/${SYNCHRONY_THRESHOLD}`}</strong>
                  <span>
                    {constitutionAbility
                      ? `constitution ${constitutionAbility} ⇒ ${linkedAbility?.name ?? blueprint.abilityId}`
                      : `latent constitution ⇒ ${linkedAbility?.name ?? blueprint.abilityId}`}
                  </span>
                </div>
                {genome.fusionElement && (
                  <div className="bestiaryLineage">
                    {genome.baseElement} + {genome.fusionElement}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );

  const optionsPanel = (onBack: () => void, pausedView = false) => (
    <div id="optionsCard">
      <div id="optionsTitle">OPTIONS</div>
      <button
        id={pausedView ? 'pauseDpadToggleBtn' : 'menuDpadToggleBtn'}
        className="optionToggleBtn gamepad-selected"
        aria-pressed={virtualDpadEnabled}
        onClick={(event) => {
          event.stopPropagation();
          toggleVirtualDpad();
        }}
      >
        <span>
          <strong>VIRTUAL D-PAD</strong>
          <small>Show the on-screen movement control</small>
        </span>
        <b>{virtualDpadEnabled ? 'ON' : 'OFF'}</b>
      </button>
      <button
        id="menuBackBtn"
        className="bestiaryBackBtn"
        onClick={(event) => {
          event.stopPropagation();
          onBack();
        }}
      >
        ← BACK
      </button>
    </div>
  );

  const integrityClass = hud.systemIntegrity.node < 25
    ? 'integrity-critical'
    : hud.systemIntegrity.node < 55 ? 'integrity-low' : 'integrity-stable';

  return (
    <div id="game" className={`${phase === 'menu' ? 'menu-open ' : ''}${integrityClass}`}>
      <canvas
        ref={canvasRef}
        id="canvas"
        onPointerDown={handleCanvasPointer}
      />

      {/* Sprite overlay — canvas only; no background so pixel-removed areas are
          transparent and reveal the game canvas beneath */}
      {phase === 'playing' && (playerSkin === 'rocket' || playerSkin === 'dots' || playerSkin === 'gem' || playerSkin === 'assembly'
        || RIVAL_SKILL_IDS.includes(playerSkin as RivalSkillId)) && (
        <div
          ref={spriteWrapRef}
          className={RIVAL_SKILL_IDS.includes(playerSkin as RivalSkillId) ? 'rivalPlayerSprite' : undefined}
          style={{
            position: 'absolute',
            pointerEvents: 'none',
            transform: 'translate(-50%,-50%)',
            opacity: skillPlayerFxActive ? 0 : playerSkin === 'gem' && !hud.autoBuster ? 0.52 : 1,
            filter: playerSkin === 'gem' && !hud.autoBuster ? 'drop-shadow(0 0 8px #a78bfa)' : 'none',
            transition: 'opacity 150ms ease, filter 150ms ease',
          }}
        >
          <canvas
            ref={spriteCanvasRef}
            style={{
              position: 'relative',
              display: playerSkin === 'assembly' ? 'none' : 'block',
              imageRendering: 'pixelated',
            }}
          />
          {playerSkin === 'assembly' && (
            <AvatarAssembly
              components={avatarComponents}
              equipped={equippedAvatarComponents}
              className="avatarAssemblyGameplay"
              animation="idle"
              attackPulse={assemblyAttackPulse}
            />
          )}
        </div>
      )}

      {phase === 'playing' && hud.gameMode === 'vs' && npcSkin !== 'default' && (
        <div
          ref={npcSpriteWrapRef}
          className="rivalPlayerSprite"
          style={{
            position: 'absolute',
            pointerEvents: 'none',
            transform: 'translate(-50%,-50%)',
          }}
        >
          <canvas
            ref={npcSpriteCanvasRef}
            style={{
              display: npcSkin === 'assembly' ? 'none' : 'block',
              imageRendering: 'pixelated',
            }}
          />
          {npcSkin === 'assembly' && (
            <AvatarAssembly
              components={avatarComponents}
              equipped={equippedAvatarComponents}
              className="avatarAssemblyGameplay"
              animation="idle"
            />
          )}
        </div>
      )}

      {phase === 'playing' && skillPlayerFxActive && (
          <div
            key={`player-${skillFxRun}`}
            ref={skillPlayerFxRef}
            className="skillPlayerFx"
            aria-hidden="true"
          >
            <img
              src={`${import.meta.env.BASE_URL}effects/player-skill.gif`}
              alt=""
            />
          </div>
      )}

      {phase === 'playing' && skillFxActive && (
        <>
          {(['north', 'south'] as const).map((direction) => (
            <div
              key={`${direction}-${skillFxRun}`}
              ref={direction === 'north' ? skillNorthFxRef : skillSouthFxRef}
              className="skillFxWrap"
              data-direction={direction}
              aria-hidden="true"
            >
              <img
                src={`${import.meta.env.BASE_URL}effects/smoke-reveal-combined.webp?run=${skillFxRun}-${direction}`}
                alt=""
              />
            </div>
          ))}
        </>
      )}

      {phase === 'playing' && cloneView.visible && cloneView.revealed && (
        <>
          {(['north', 'south'] as const).map((direction) => {
            const status = cloneView.statuses[direction];
            if (cloneView.rows[direction] === null || status === 'gone') return null;
            const controlled = cloneView.playerLocked && cloneView.controlled === direction;
            const defending = status === 'defending' || status === 'defendingHeld';
            const attacking = status === 'attacking';
            const autofiring = status === 'autofiring';
            return (
              <div
                key={direction}
                ref={direction === 'north' ? cloneNorthRef : cloneSouthRef}
                className={[
                  'cloneAvatar',
                  controlled ? 'controlled' : '',
                  defending ? 'defending' : '',
                  attacking ? 'attacking' : '',
                  autofiring ? 'autofiring' : '',
                  skillFxActive ? 'materializing' : '',
                  status === 'dispersing' ? 'dispersing' : '',
                ].filter(Boolean).join(' ')}
                data-direction={direction}
              >
                {!attacking && !autofiring && (
                  <img
                    className="cloneBaseFrame"
                    src={`${import.meta.env.BASE_URL}effects/${
                      status === 'defending'
                        ? 'clone-defense.gif'
                        : status === 'defendingHeld' ? 'clone-defense-hold.png' : 'clone-idle.gif'
                    }`}
                    alt=""
                  />
                )}
                {(attacking || autofiring) && (
                  <span className={`cloneAttackFrames${autofiring ? ' sustained' : ''}`} aria-hidden="true">
                    {[0, 1, 2].map((frame) => (
                      <img
                        key={frame}
                        src={`${import.meta.env.BASE_URL}skins/gem_attack_frame_${frame}.png?alpha=v2`}
                        alt=""
                      />
                    ))}
                  </span>
                )}
              </div>
            );
          })}
        </>
      )}

      {phase === 'playing' && rivalSkillView.active && rivalSkillView.id && (
        <SignatureSkillFx
          id={rivalSkillView.id}
          stateRef={stateRef}
          actionTick={rivalSkillView.actionTick}
          lastAction={rivalSkillView.lastAction}
        />
      )}

      {phase === 'playing' && rivalSkillView.active && rivalSkillView.id && (
        <div
          id="cloneActionControls"
          className={`rivalSkillControls skill-${rivalSkillView.id}`}
          style={{ top: boardBottom > 0 ? boardBottom + 12 : undefined }}
        >
          <div className="rivalSkillTitle">
            {RIVAL_SKILL_LABELS[rivalSkillView.id]}
            <small>{Math.max(0, Math.ceil((rivalSkillView.expiresAt - performance.now()) / 1000))}s</small>
          </div>
          <button className="cloneActionBtn attack" onPointerDown={(event) => {
            event.stopPropagation();
            resolveRivalSkillAction('primary');
          }}>
            <b>X</b>
            {RIVAL_SKILL_COMMANDS[rivalSkillView.id][0]}
          </button>
          <button className="cloneActionBtn switch" onPointerDown={(event) => {
            event.stopPropagation();
            resolveRivalSkillAction('alternate');
          }}>
            <b>Y</b>
            {RIVAL_SKILL_COMMANDS[rivalSkillView.id][1]}
          </button>
          <button className="cloneActionBtn defend" onPointerDown={(event) => {
            event.stopPropagation();
            resolveRivalSkillAction('defend');
          }}>
            <b>B</b>
            {RIVAL_SKILL_COMMANDS[rivalSkillView.id][2]}
          </button>
        </div>
      )}

      {phase === 'playing' && cloneView.inputActive && (
        <div
          id="cloneActionControls"
          style={{ top: boardBottom > 0 ? boardBottom + 12 : undefined }}
        >
          <button
            className="cloneActionBtn attack"
            onPointerDown={(event) => {
              event.stopPropagation();
              resolveCloneAction('attack');
            }}
          >
            <b>X</b>
            ATTACK
          </button>
          <button
            className="cloneActionBtn switch"
            disabled={cloneView.rows[cloneView.controlled === 'north' ? 'south' : 'north'] === null
              || cloneView.statuses[cloneView.controlled === 'north' ? 'south' : 'north'] === 'gone'
              || cloneView.statuses[cloneView.controlled === 'north' ? 'south' : 'north'] === 'dispersing'}
            onPointerDown={(event) => {
              event.stopPropagation();
              switchCloneControl();
            }}
          >
            <b>Y</b>
            SWITCH
          </button>
          <button
            className="cloneActionBtn defend"
            onPointerDown={(event) => {
              event.stopPropagation();
              resolveCloneAction('defend');
            }}
          >
            <b>B</b>
            DEFEND
          </button>
        </div>
      )}

      {/* HUD */}
      <div className="hud" id="hud">
        <div className="panel">
          HP {hud.hp}
          {hud.shieldCharges > 0 && (
            <span id="shieldChargesDisplay">
              {'🛡'.repeat(Math.min(hud.shieldCharges, 9))}
              {hud.shieldCharges > 9 ? ` ×${hud.shieldCharges}` : ''}
            </span>
          )}
        </div>
        <div className="panel integrityWorkPanel">Integrity Work {hud.integrityWork}</div>
        {hud.gameMode === 'vs' ? (
          <div className="panel" id="npcHpPanel" data-overheal={hud.npcHp > NPC_HP ? 'true' : 'false'}>
            NPC {hud.npcHp} HP{hud.npcHp > NPC_HP ? ' ▲' : ''}
            {hud.npcShieldCharges > 0 && (
              <span id="npcShieldDisplay">{'🛡'.repeat(Math.min(hud.npcShieldCharges, 9))}</span>
            )}
          </div>
        ) : (
          <div className="panel">Wave {hud.wave}</div>
        )}
      </div>

      {phase === 'playing' && (
        <div id="ecosystemHud">
          <span className="ecosystemTitle">SYSTEM INTEGRITY</span>
          <span className="integrityMetric global">
            GLOBAL <b>{Math.round(hud.systemIntegrity.global)}%</b>
          </span>
          <span className="integrityMetric sector">
            SECTOR <b>{Math.round(hud.systemIntegrity.sector)}%</b>
          </span>
          <span className="integrityMetric node">
            NODE <b>{Math.round(hud.systemIntegrity.node)}%</b>
          </span>
          <span>DISCOVERED <b>{hud.ecosystem.species}</b></span>
          <span>TRAITS <b>{hud.ecosystem.mutations}</b></span>
          <span>MAX GEN <b>{hud.ecosystem.generation}</b></span>
          <span className={hud.ecosystem.fusions > 0 ? 'fusionActive' : ''}>
            FUSIONS <b>{hud.ecosystem.fusions}</b>
          </span>
          <span className={`pressureState ${hud.pressureState}`}>
            {hud.pressureState === 'critical'
              ? 'PRESSURE'
              : hud.pressureState === 'recovery' ? 'RECOVERY' : 'STEADY'}
          </span>
        </div>
      )}

      {phase === 'playing' && (
        <IntegrityConstruct
          integrityWork={hud.integrityWork}
          integrity={hud.systemIntegrity}
          discoveries={hud.ecosystem.species}
          mutations={hud.ecosystem.mutations}
          fusions={hud.ecosystem.fusions}
          pressure={hud.pressureState}
          activePlayers={presence?.activePlayers ?? null}
          coreUnits={presence?.coreUnits ?? 540}
          coreDelta={presence?.coreDelta ?? 0}
        />
      )}

      {/* Card UI + rotate button — column, positioned just below the grid */}
      <div id="cardUiWrapper" style={{ top: boardBottom > 0 ? boardBottom + 12 : undefined }}>
        <div id="cardUi">
          <div id="cardCharge">
            <div id="cardChargeLabel" ref={cardLabelRef}>
              {hud.cardsReady ? 'Choose ability cards — ROTATE to reset timer' : ''}
            </div>
            <div id="cardBarTrack">
              <div id="cardBarFill" ref={cardBarFillRef} style={{ width: hud.cardsReady ? '100%' : `${cardProgress * 100}%` }} />
            </div>
          </div>

          {hud.cardsReady && (
            <div id="cardChoices">
              {hud.cardOptions.map((id) => {
                const ability = runtimeAbilityById(id);
                if (!ability) return null;
                const generated = generatedAbilityRegistry[id];
                const rank = learnedAbilities.find((entry) => entry.id === id)?.rank ?? 1;
                const description = generated
                  ? generatedAbilityDescription(generated, rank)
                  : ability.desc;
                const cd = Math.ceil(hud.abilityCooldowns[id] ?? 0);
                const used = hud.usedInHand.includes(id);
                const disabled = used || cd > 0;
                return (
                  <button
                    key={id}
                    className={`card-btn${used ? ' used' : ''}`}
                    disabled={disabled}
                    onPointerDown={(ev) => {
                      ev.stopPropagation();
                      ensureAudio();
                      useCard(id);
                    }}
                  >
                    {ability.name}<br />
                    <span>
                      {cd > 0 ? `Cooldown ${cd}s` : used ? 'Used' : description}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Rotate button — resets the bar timer; disabled once all cards are spent */}
        {phase === 'playing' && (
          <button
            id="rotateHandBtn"
            className="control-btn"
            disabled={hud.rotateUsedThisHand || (
              hud.cardsReady
              && hud.cardOptions.length > 0
              && hud.cardOptions.every((id) => hud.usedInHand.includes(id))
            )}
            onPointerDown={(ev) => {
              ev.stopPropagation();
              rotateHand();
            }}
          >
            {hud.rotateUsedThisHand ? 'ROTATE USED' : '↻ ROTATE'}
          </button>
        )}
      </div>

      {/* D-Pad */}
      <div id="dpad" style={{ display: virtualDpadEnabled ? undefined : 'none' }} aria-hidden={!virtualDpadEnabled}>
        <div className="dpad-btn" id="dpadUp" />
        <div className="dpad-btn" id="dpadDown" />
        <div className="dpad-btn" id="dpadLeft" />
        <div className="dpad-btn" id="dpadRight" />
        <div className="dpad-btn" id="dpadCenter" />
      </div>

      {/* Controls */}
      <div id="controls">
        {phase === 'playing' && (
          <button
            id="rotateLandscapeBtn"
            className="control-btn"
            disabled={hud.rotateUsedThisHand || (
              hud.cardsReady
              && hud.cardOptions.length > 0
              && hud.cardOptions.every((id) => hud.usedInHand.includes(id))
            )}
            onPointerDown={(ev) => {
              ev.stopPropagation();
              rotateHand();
            }}
          >
            {hud.rotateUsedThisHand ? 'ROTATE USED' : '↻ ROTATE'}
          </button>
        )}

        {phase === 'playing' && (
          <button
            id="skillBtn"
            className="control-btn"
            onPointerDown={(event) => {
              event.stopPropagation();
              queueSkillTap();
            }}
          >
            SKILL
            <small>V · L2</small>
          </button>
        )}

        <button
          id="autoToggle"
          className={`control-btn ${hud.autoBuster ? 'on' : 'off'}`}
          onPointerDown={(ev) => { ev.stopPropagation(); toggleAuto(); }}
        >
          Auto: {hud.autoBuster ? 'ON' : 'OFF'}
        </button>

        <button
          id="busterBtn"
          className="control-btn"
          onPointerDown={(ev) => { ev.stopPropagation(); ensureAudio(); manualBuster(); }}
        >
          BUSTER
        </button>
      </div>

      {/* Pause button — centered below the d-pad, separate from the controls row */}
      {phase === 'playing' && hud.running && (
        <button
          id="pauseBtn"
          className="control-btn"
          onPointerDown={(ev) => { ev.stopPropagation(); togglePause(); }}
        >
          {paused ? '▶ RESUME' : '⏸ PAUSE'}
        </button>
      )}

      {/* Main Menu overlay */}
      {phase === 'menu' && (
        <div id="mainMenu">
          {menuScreen === 'main' ? (
            <div id="menuCard">
              <div id="menuTitle">CYBERGRID<br />STRIKE</div>
              <div id="menuTagline">Restore the grid. Research emergent digital life.</div>
              <div id="preEvoLabel">⬡ PRE-EVOLUTION EDITION ⬡</div>
              <button
                id="menuPlayBtn"
                className={menuSelection === 0 ? 'gamepad-selected' : ''}
                onClick={(ev) => { ev.stopPropagation(); ensureAudio(); startGame('classic'); }}
              >
                ▶ PLAY
              </button>
              <button
                id="menuVsBtn"
                className={menuSelection === 1 ? 'gamepad-selected' : ''}
                onClick={(ev) => {
                  ev.stopPropagation();
                  menuScreenRef.current = 'vs-select';
                  vsSelectionRef.current = 0;
                  setMenuScreen('vs-select');
                }}
              >
                ⚔ VS NPC
              </button>
              <button
                id="menuCustomBtn"
                className={menuSelection === 2 ? 'gamepad-selected' : ''}
                onClick={(ev) => {
                  ev.stopPropagation();
                  menuScreenRef.current = 'customization';
                  customizationSelectionRef.current = 0;
                  setMenuScreen('customization');
                }}
              >
                ⚙ Customization
              </button>
              <button
                id="menuBestiaryBtn"
                className={menuSelection === 3 ? 'gamepad-selected' : ''}
                onClick={(ev) => {
                  ev.stopPropagation();
                  menuScreenRef.current = 'bestiary';
                  bestiarySelectionRef.current = 0;
                  setBestiarySelection(0);
                  setMenuScreen('bestiary');
                }}
              >
                ◈ Bestiary ({bestiaryEntries.length})
              </button>
              <button
                id="menuOptionsBtn"
                className={menuSelection === 4 ? 'gamepad-selected' : ''}
                onClick={(event) => {
                  event.stopPropagation();
                  menuScreenRef.current = 'options';
                  setMenuScreen('options');
                }}
              >
                ⚙ Options
              </button>
              <div id="menuControls">
                <div className="menu-control-row"><span>Move</span><span>Tap grid · D-pad · WASD</span></div>
                <div className="menu-control-row"><span>Fire</span><span>Auto or BUSTER · Space</span></div>
                <div className="menu-control-row"><span>Abilities</span><span>Use all 3 cards, then hand resets</span></div>
                <div className="menu-control-row"><span>Rotate</span><span>ROTATE button or R key — once per hand, then locked until the next deal</span></div>
              </div>
            </div>
          ) : menuScreen === 'vs-select' ? (
            <div id="menuCard" className="customization-card">
              <div id="menuTitle" style={{ fontSize: 'clamp(20px, 5vw, 28px)' }}>Select Opponent</div>
              <div id="customSubtitle">Choose one player skin to fight</div>
              <div id="skinPickerRow">
                {skinOptions.map((skin, index) => (
                  <button
                    key={skin.id}
                    className={`skin-btn vs-skin-btn ${index === 0 ? 'gamepad-selected' : ''}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      npcSkinRef.current = skin.id;
                      setNpcSkin(skin.id);
                      ensureAudio();
                      startGame('vs');
                    }}
                  >
                    {skin.id === 'assembly'
                      ? <AvatarAssembly
                          components={avatarComponents}
                          equipped={equippedAvatarComponents}
                          className="avatarAssemblySkinIcon"
                        />
                      : skin.preview
                      ? <SkinPreviewCanvas src={skin.preview} />
                      : <span className="skin-default-icon">🤖</span>}
                    <span className="skin-label">{skin.label}</span>
                    {(skin.id in RIVAL_SKILL_LABELS) && (
                      <small className="skin-skill-label">
                        {RIVAL_SKILL_LABELS[skin.id as RivalSkillId]}
                      </small>
                    )}
                  </button>
                ))}
              </div>
              <button
                id="menuBackBtn"
                className="bestiaryBackBtn"
                onClick={(event) => {
                  event.stopPropagation();
                  menuScreenRef.current = 'main';
                  menuSelectionRef.current = 1;
                  setMenuSelection(1);
                  setMenuScreen('main');
                }}
              >
                ← Back
              </button>
            </div>
          ) : menuScreen === 'customization' ? (
            <div id="menuCard" className="customization-card">
              <div id="menuTitle" style={{ fontSize: 'clamp(20px, 5vw, 28px)' }}>⚙ Customization</div>

              {/* Skin selector */}
              <div id="customSubtitle">Player skin</div>
              <div id="skinPickerRow">
                {skinOptions.map((skin) => (
                  <button
                    key={skin.id}
                    className={`skin-btn ${playerSkin === skin.id ? 'selected' : ''}`}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      playerSkinRef.current = skin.id;
                      setPlayerSkin(skin.id);
                      localStorage.setItem(SKIN_KEY, skin.id);
                    }}
                  >
                    {skin.id === 'assembly'
                      ? <AvatarAssembly
                          components={avatarComponents}
                          equipped={equippedAvatarComponents}
                          className="avatarAssemblySkinIcon"
                        />
                      : skin.preview
                      ? <SkinPreviewCanvas src={skin.preview} />
                      : <span className="skin-default-icon">🤖</span>}
                    <span className="skin-label">{skin.label}</span>
                    {(skin.id in RIVAL_SKILL_LABELS) && (
                      <small className="skin-skill-label">
                        {RIVAL_SKILL_LABELS[skin.id as RivalSkillId]}
                      </small>
                    )}
                  </button>
                ))}
              </div>

              {RIVAL_SKILL_IDS.includes(playerSkin as RivalSkillId) && (
                <SkillGuidePanel id={playerSkin as RivalSkillId} />
              )}

              {playerSkin === 'assembly' && (
                <>
                  <div id="customSubtitle" style={{ marginTop: '16px' }}>
                    Assembly Skill · {assemblySkill === 'shadow'
                      ? 'Shadow Clone'
                      : RIVAL_SKILL_LABELS[assemblySkill]}
                  </div>
                  <div
                    id="assemblySkillPicker"
                    style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '4px 0 10px' }}
                  >
                    {([
                      { id: 'shadow' as AssemblySkillId, label: 'Shadow Clone' },
                      ...RIVAL_SKILL_IDS.map((id) => ({
                        id: id as AssemblySkillId,
                        label: RIVAL_SKILL_LABELS[id],
                      })),
                    ]).map((skill) => (
                      <button
                        key={skill.id}
                        type="button"
                        className={`learned-ability-btn ${assemblySkill === skill.id ? 'enabled selected' : ''}`}
                        style={{ minWidth: '150px', flex: '0 0 auto' }}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          assemblySkillRef.current = skill.id;
                          setAssemblySkill(skill.id);
                          localStorage.setItem(ASSEMBLY_SKILL_KEY, skill.id);
                        }}
                      >
                        <strong>{skill.label}</strong>
                        <small>{skill.id === 'shadow'
                          ? 'Distributed clone command'
                          : RIVAL_SKILL_COMMANDS[skill.id as RivalSkillId].join(' · ')}</small>
                      </button>
                    ))}
                  </div>
                  {assemblySkill !== 'shadow' && (
                    <SkillGuidePanel id={assemblySkill} />
                  )}
                </>
              )}

              <div id="customSubtitle" style={{ marginTop: '16px' }}>
                Assembly Components · {avatarComponents.length} recovered
              </div>
              <div id="avatarWorkshop">
                <div id="avatarWorkshopPreview">
                  <AvatarAssembly
                    components={avatarComponents}
                    equipped={equippedAvatarComponents}
                    className="avatarAssemblyPreview"
                    animation="showcase"
                  />
                </div>
                <div id="avatarComponentSlots">
                  {AVATAR_SLOTS.map((slot) => {
                    const slotComponents = avatarComponents
                      .filter((component) => component.slot === slot);
                    const optionMap = new Map(
                      [...slotComponents].reverse()
                        .map((component) => [assemblyVisualSignature(component), component]),
                    );
                    const equippedOption = slotComponents.find((component) =>
                      component.id === equippedAvatarComponents[slot]);
                    if (equippedOption) {
                      optionMap.set(assemblyVisualSignature(equippedOption), equippedOption);
                    }
                    const options = [...optionMap.values()];
                    return (
                      <div className="avatarSlotRow" key={slot}>
                        <strong>{slot}</strong>
                        <button
                          className={!equippedAvatarComponents[slot] ? 'selected' : ''}
                          onClick={(event) => {
                            event.stopPropagation();
                            const next = { ...equippedAvatarComponents };
                            delete next[slot];
                            setEquippedAvatarComponents(next);
                            localStorage.setItem(EQUIPPED_COMPONENTS_KEY, JSON.stringify(next));
                          }}
                        >
                          NONE
                        </button>
                        {options.map((component) => (
                          <button
                            key={component.id}
                            className={equippedAvatarComponents[slot] === component.id ? 'selected' : ''}
                            title={`${component.name} · ${component.source}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              const next = { ...equippedAvatarComponents, [slot]: component.id };
                              setEquippedAvatarComponents(next);
                              localStorage.setItem(EQUIPPED_COMPONENTS_KEY, JSON.stringify(next));
                            }}
                          >
                            <AvatarAssembly
                              components={[component]}
                              equipped={{ [component.slot]: component.id }}
                              className="avatarAssemblyThumbnail"
                            />
                            {component.name}
                          </button>
                        ))}
                        {options.length === 0 && <span>Defeat compatible entities to recover this slot.</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div id="assemblyFitReadout">
                <b>PRAGMATIC FIT</b>
                <span>{assemblyFit.description}</span>
              </div>

              <div id="customSubtitle" style={{ marginTop: '16px' }}>
                Ability Architecture · Prestige {architecturePrestige(learnedAbilities)}
              </div>
              <div id="abilityArchitectureHelp">
                Essential protocols remain available. Enemy synchronization and playstyle resonance
                rank other abilities as they arise; prestige unlocks them for your presets.
              </div>
              <div id="abilityPresetControls">
                <div id="abilityPresetHeader">
                  <strong>ROTATING PRESETS</strong>
                  <button
                    className={autoRotateAbilityPresets ? 'enabled' : ''}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setAutoRotateAbilityPresets((previous) => {
                        const next = !previous;
                        autoRotateAbilityPresetsRef.current = next;
                        localStorage.setItem(AUTO_ROTATE_PRESETS_KEY, next ? 'on' : 'off');
                        return next;
                      });
                    }}
                  >
                    AUTO ROTATE: {autoRotateAbilityPresets ? 'ON' : 'OFF'}
                  </button>
                </div>
                <div id="abilityPresetPicker">
                  {ABILITY_PRESET_NAMES.map((name, index) => (
                    <button
                      key={name}
                      className={`${activeAbilityPreset === index ? 'selected' : ''} ${name === 'CUSTOM' ? 'custom' : ''}`}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        activateAbilityPreset(index);
                      }}
                    >
                      <b>{index + 1}</b>
                      <span>{name}</span>
                      <small>{abilityPresets[index]?.length ?? 0}</small>
                    </button>
                  ))}
                </div>
                <p>
                  Edit the selected pool below. Custom begins with essential abilities only.
                  Each hand still deals three cards; Auto Rotate advances to the next preset
                  whenever a fresh hand arrives.
                </p>
              </div>
              <div id="learnedLoadoutGrid">
                  {runtimeAbilityPool()
                    .filter((ability) =>
                      ESSENTIAL_ABILITY_IDS.has(ability.id)
                      || learnedAbilities.some((entry) => entry.id === ability.id))
                    .map((ability) => {
                    const learned = learnedAbilities.find((entry) => entry.id === ability.id);
                    const unlocked = abilityIsUnlocked(learned, learnedAbilities);
                    const requiredPrestige = abilityPrestigeRequirement(ability.id);
                    const on = enabledAbilities.has(ability.id);
                    const rank = learned?.rank ?? 0;
                    const generated = generatedAbilityRegistry[ability.id];
                    const description = generated
                      ? generatedAbilityDescription(generated, Math.max(1, rank))
                      : ability.desc;
                    const nextRankAt = rank > 0 && rank < MAX_ABILITY_RANK
                      ? ABILITY_RANK_THRESHOLDS[rank + 1]
                      : null;
                    return (
                      <button
                        key={ability.id}
                        className={`learned-ability-btn ${on ? 'enabled' : 'disabled'} ${unlocked ? '' : 'locked'}`}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          if (!unlocked || !learned) return;
                          setEnabledAbilities((previous) => {
                            const next = new Set(previous);
                            if (next.has(ability.id)) {
                              if (next.size > 1) next.delete(ability.id);
                            } else {
                              next.add(ability.id);
                            }
                            const updatedPresets = abilityPresetsRef.current.map((preset, index) =>
                              index === activeAbilityPresetRef.current ? [...next] : preset);
                            abilityPresetsRef.current = updatedPresets;
                            setAbilityPresets(updatedPresets);
                            localStorage.setItem(ABILITY_PRESETS_KEY, JSON.stringify(updatedPresets));
                            enabledAbilitiesRef.current = next;
                            localStorage.setItem(ENABLED_ABILITIES_KEY, JSON.stringify([...next]));
                            return next;
                          });
                        }}
                      >
                        <span className="learned-ability-source">{learned?.source ?? 'unmanifested'}</span>
                        <strong>{ability.name}</strong>
                        <span>{description}</span>
                        {learned?.reason && (
                          <span className="ability-origin">{learned.reason}</span>
                        )}
                        <span className="ability-rank">
                          {rank > 0
                            ? `RANK ${rank}/${MAX_ABILITY_RANK} · RESONANCE ${learned?.resonance}${nextRankAt ? `/${nextRankAt}` : ' MAX'}`
                            : 'RANK —'}
                        </span>
                        <b>
                          {!learned
                            ? `UNLEARNED · PRESTIGE ${requiredPrestige}`
                            : !unlocked
                              ? `LEARNED · LOCKED UNTIL PRESTIGE ${requiredPrestige}`
                              : on ? `IN ${ABILITY_PRESET_NAMES[activeAbilityPreset]}` : 'RESERVE'}
                        </b>
                      </button>
                    );
                  })}
              </div>
              <button
                id="menuBackBtn"
                onClick={(ev) => {
                  ev.stopPropagation();
                  menuScreenRef.current = 'main';
                  menuSelectionRef.current = 0;
                  setMenuSelection(0);
                  setMenuScreen('main');
                }}
              >
                ← Back
              </button>
            </div>
          ) : menuScreen === 'bestiary' ? (
            bestiaryPanel(() => {
              menuScreenRef.current = 'main';
              menuSelectionRef.current = 0;
              setMenuSelection(0);
              setMenuScreen('main');
            })
          ) : (
            optionsPanel(() => {
              menuScreenRef.current = 'main';
              menuSelectionRef.current = 0;
              setMenuSelection(0);
              setMenuScreen('main');
            })
          )}
        </div>
      )}

      {phase === 'playing' && hud.upgradePromptOpen && !hud.upgradeSelectionOpen && (
        <button
          id="upgradePrompt"
          onPointerDown={(event) => {
            event.stopPropagation();
            openUpgradeSelection();
          }}
        >
          <strong>EVOLUTION READY · {Math.max(0, Math.ceil(hud.upgradePromptTimer))}s</strong>
          <span>Tap or press Q / R1 to enter slow-time selection</span>
        </button>
      )}

      {phase === 'playing' && hud.upgradeSelectionOpen && (
        <div id="upgradeOverlay">
          <div id="upgradeCard">
            <button
              id="upgradeClose"
              aria-label="Close Evolve menu"
              onPointerDown={(event) => {
                event.stopPropagation();
                closeUpgradeSelection();
              }}
            >
              ×
            </button>
            <div id="upgradeEyebrow">WAVE {hud.wave} MILESTONE</div>
            <div id="upgradeTitle">EVOLVE</div>
            <div id="upgradeSubtitle">Combat remains active at 8% speed</div>
            <div id="upgradeChoices">
              {hud.upgradeOptions.map((id, index) => {
                const upgrade = RUN_UPGRADES.find((candidate) => candidate.id === id);
                if (!upgrade) return null;
                const currentLevel = hud.runUpgrades[id] ?? 0;
                return (
                  <button
                    id={`upgradeChoice${index}`}
                    key={id}
                    className={`upgradeChoice${upgradeSelection === index ? ' gamepad-selected' : ''}`}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      chooseRunUpgrade(id);
                    }}
                  >
                    <span className="upgradeLevel">LV {currentLevel} → {currentLevel + 1}</span>
                    <strong>{upgrade.name}</strong>
                    <span>{upgrade.desc}</span>
                  </button>
                );
              })}
            </div>
            <div id="upgradeHint">D-PAD / ARROWS to choose · A / SPACE to install · B / BACKSPACE to close</div>
          </div>
        </div>
      )}

      {/* Pause overlay */}
      {paused && phase === 'playing' && !pauseBestiary && !pauseOptions && (
        <div id="pauseOverlay">
          <div id="pauseCard">
            <div id="pauseTitle">PAUSED</div>
            <button
              id="pauseResumeBtn"
              className={pauseSelection === 0 ? 'gamepad-selected' : ''}
              onClick={(ev) => { ev.stopPropagation(); togglePause(); }}
            >
              ▶ RESUME
            </button>
            <button
              id="pauseBestiaryBtn"
              className={pauseSelection === 1 ? 'gamepad-selected' : ''}
              onClick={(ev) => {
                ev.stopPropagation();
                pauseBestiaryRef.current = true;
                bestiarySelectionRef.current = 0;
                setBestiarySelection(0);
                setPauseBestiary(true);
              }}
            >
              BESTIARY ({bestiaryEntries.length})
            </button>
            <button
              id="pauseOptionsBtn"
              className={pauseSelection === 2 ? 'gamepad-selected' : ''}
              onClick={(event) => {
                event.stopPropagation();
                pauseOptionsRef.current = true;
                setPauseOptions(true);
              }}
            >
              OPTIONS
            </button>
            <button
              id="pauseMenuBtn"
              className={pauseSelection === 3 ? 'gamepad-selected' : ''}
              onClick={(ev) => { ev.stopPropagation(); restart(); }}
            >
              MAIN MENU
            </button>
          </div>
        </div>
      )}

      {paused && phase === 'playing' && pauseBestiary && (
        <div id="pauseOverlay">
          {bestiaryPanel(() => {
            pauseBestiaryRef.current = false;
            setPauseBestiary(false);
          })}
        </div>
      )}

      {paused && phase === 'playing' && pauseOptions && (
        <div id="pauseOverlay">
          {optionsPanel(() => {
            pauseOptionsRef.current = false;
            setPauseOptions(false);
          }, true)}
        </div>
      )}

      {/* Game Over / Victory overlay */}
      {!hud.running && phase === 'playing' && (
        <div id="gameOverOverlay" className={hud.playerWon ? 'victory' : ''}>
          <div id="gameOverCard" className={hud.playerWon ? 'victory' : ''}>
            <div id="gameOverTitle">{hud.playerWon ? 'SYSTEM OVERRIDE' : 'CONNECTION LOST'}</div>
            {hud.playerWon
              ? <div id="gameOverScore">NPC neutralised — Integrity Work: {hud.integrityWork}</div>
              : <>
                  <div id="gameOverScore">Integrity Work: {hud.integrityWork}</div>
                  {hud.gameMode === 'classic' && <div id="gameOverWave">Wave: {hud.wave}</div>}
                </>
            }
            <ChainPanel
              kills={gameKills}
              totalCGRD={sessionCGRD}
              gameOver={true}
              finalScore={hud.integrityWork}
              finalWave={hud.wave}
            />
            <button
              id="playAgainBtn"
              className="gamepad-selected"
              onClick={(ev) => { ev.stopPropagation(); ensureAudio(); restart(); }}
            >
              PLAY AGAIN
            </button>
          </div>
        </div>
      )}

      {/* Status message */}
      {hud.message && (
        <div id="message">{hud.message}</div>
      )}
    </div>
  );
}
