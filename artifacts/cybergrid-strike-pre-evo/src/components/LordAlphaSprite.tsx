import React, { useEffect, useId, type CSSProperties } from 'react';
import {
  LORD_ALPHA_ATTACK_SEQUENCE_ASSETS,
  LORD_ALPHA_ASSETS,
  LORD_ALPHA_COMBO_ASSET_SUFFIXES,
  anatomicalLeftScreenSide,
  lordAlphaAssetUrl,
  resolveLordAlphaAttackSequence,
  resolveLordAlphaSkillSequence,
  rocWingPlacement,
  type LordAlphaComboBeat,
  type LordAlphaFacing,
  type LordAlphaFrameSequenceAssetManifest,
  type LordAlphaForm,
  type LordAlphaPresentationEvent,
} from '../game/lord-alpha.ts';

export type LordAlphaMotion =
  | 'idle'
  | 'move'
  | 'attack'
  | 'hit'
  | 'skill'
  | 'victory'
  | 'death';

export interface LordAlphaSpriteProps {
  baseUrl?: string;
  form: LordAlphaForm;
  facing: LordAlphaFacing;
  motion: LordAlphaMotion;
  /** Increment this value to restart body motion without changing gameplay state. */
  pulse: number;
  /** Major-event clock, kept separate so movement and auto-fire cannot restart equip/summon visuals. */
  eventPulse?: number;
  event?: LordAlphaPresentationEvent | null;
  /** Presentation-only attack beat. It never changes damage, hitboxes, or recovery. */
  comboBeat?: LordAlphaComboBeat | null;
  /** Civilian form visible beneath an equip construction into the Supreme runtime form. */
  equipSourceForm?: LordAlphaForm | null;
  compact?: boolean;
  /** Explicit animation-lab override; production still honors reduced motion. */
  forceMotion?: boolean;
  className?: string;
  /** Optional placement/size overrides; the default root is layout-neutral and centered. */
  style?: CSSProperties;
}

const featherPath = (
  rootX: number,
  direction: -1 | 1,
  rootY: number,
  reach: number,
  tipY: number,
  width: number,
) => {
  const tipX = rootX + direction * reach;
  const shoulderX = rootX + direction * reach * 0.4;
  const returnX = rootX + direction * reach * 0.72;
  return [
    `M ${rootX} ${rootY}`,
    `C ${shoulderX} ${rootY - width}, ${tipX - direction * width} ${tipY + width}, ${tipX} ${tipY}`,
    `C ${tipX - direction * width * 0.25} ${tipY + width * 1.55}, ${returnX} ${rootY - width * 0.08}, ${rootX} ${rootY + width * 0.7}`,
    'Z',
  ].join(' ');
};

const skillSequenceAnimationName = (id: string) =>
  `lord-alpha-skill-sequence-frames-${id}`;

const skillSequenceFrameOffset = (frameIndex: number, frameCount: number) =>
  -100 * frameIndex / frameCount;

const formatCssNumber = (value: number) =>
  Number(value.toFixed(6)).toString();

/** Build one discrete, variable-hold strip animation from manifest timing. */
export function buildLordAlphaSkillSequenceKeyframes(
  sequence: LordAlphaFrameSequenceAssetManifest,
): string {
  const { frameCount, frameHoldMs, reducedMotionFrame, durationMs } = sequence;
  if (!Number.isInteger(frameCount) || frameCount <= 0 || frameHoldMs.length !== frameCount) {
    throw new Error(`Invalid Lord Alpha frame count for ${sequence.id}`);
  }
  if (frameHoldMs.some((hold) => !Number.isFinite(hold) || hold <= 0)) {
    throw new Error(`Invalid Lord Alpha frame hold for ${sequence.id}`);
  }
  if (!Number.isInteger(reducedMotionFrame)
    || reducedMotionFrame < 0
    || reducedMotionFrame >= frameCount) {
    throw new Error(`Invalid Lord Alpha reduced-motion frame for ${sequence.id}`);
  }
  const authoredDuration = frameHoldMs.reduce((sum, hold) => sum + hold, 0);
  if (authoredDuration !== durationMs) {
    throw new Error(`Lord Alpha frame holds do not match duration for ${sequence.id}`);
  }

  let elapsed = 0;
  const stops = frameHoldMs.map((hold, frameIndex) => {
    const progress = formatCssNumber(elapsed / durationMs * 100);
    const offset = formatCssNumber(skillSequenceFrameOffset(frameIndex, frameCount));
    elapsed += hold;
    return `    ${progress}% { transform: translate3d(${offset}%, -50%, 0); }`;
  });
  const finalOffset = formatCssNumber(skillSequenceFrameOffset(frameCount - 1, frameCount));
  stops.push(`    100% { transform: translate3d(${finalOffset}%, -50%, 0); }`);
  return `@keyframes ${skillSequenceAnimationName(sequence.id)} {\n${stops.join('\n')}\n  }`;
}

const SKILL_SEQUENCE_KEYFRAMES = [
  ...Object.values(LORD_ALPHA_ATTACK_SEQUENCE_ASSETS),
  ...Object.values(LORD_ALPHA_ASSETS.skillSequences),
]
  .map(buildLordAlphaSkillSequenceKeyframes)
  .join('\n');

const SKILL_SEQUENCE_PRELOADS = new Map<string, HTMLImageElement>();

function preloadLordAlphaSkillSequences(baseUrl: string): void {
  if (typeof Image === 'undefined') return;
  for (const sequence of [
    ...Object.values(LORD_ALPHA_ATTACK_SEQUENCE_ASSETS),
    ...Object.values(LORD_ALPHA_ASSETS.skillSequences),
  ]) {
    const url = lordAlphaAssetUrl(baseUrl, sequence.suffix);
    if (SKILL_SEQUENCE_PRELOADS.has(url)) continue;
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    SKILL_SEQUENCE_PRELOADS.set(url, image);
  }
}

const SPRITE_CSS = `
  @keyframes lord-alpha-idle-float {
    0%, 100% { transform: translate3d(0, 0, 0); }
    50% { transform: translate3d(0, -2.5%, 0); }
  }
  @keyframes lord-alpha-move-drive {
    0%, 100% { transform: translate3d(-1.5%, 0, 0); }
    50% { transform: translate3d(2%, -2%, 0); }
  }
  @keyframes lord-alpha-attack-cut {
    0%, 100% { transform: translate3d(0, 0, 0); }
    42% { transform: translate3d(5%, -1%, 0); }
  }
  @keyframes lord-alpha-combo-quick {
    0%, 100% { transform: translate3d(0, 0, 0); }
    48% { transform: translate3d(var(--lord-alpha-quick-x), -.5%, 0); }
  }
  @keyframes lord-alpha-combo-web {
    0%, 100% { transform: translate3d(0, 0, 0) rotate(0); }
    45% { transform: translate3d(var(--lord-alpha-web-x), -1%, 0) rotate(var(--lord-alpha-web-rotate)); }
  }
  @keyframes lord-alpha-combo-power {
    0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
    38% { transform: translate3d(var(--lord-alpha-power-windup-x), 1%, 0) scale(.98, 1.02); }
    64% { transform: translate3d(var(--lord-alpha-power-impact-x), -1%, 0) scale(1.035, .98); }
  }
  @keyframes lord-alpha-combo-roc {
    0%, 100% { transform: translate3d(0, 0, 0); }
    42% { transform: translate3d(var(--lord-alpha-roc-x), -4%, 0); }
  }
  @keyframes lord-alpha-combo-finisher {
    0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
    48% { transform: translate3d(var(--lord-alpha-finisher-x), -1%, 0) scale(1.025); }
  }
  @keyframes lord-alpha-gesture-build {
    0% { opacity: 0; transform: scale(.2) rotate(-18deg); }
    38% { opacity: 1; transform: scale(1.08) rotate(3deg); }
    100% { opacity: 0; transform: scale(.82) rotate(10deg); }
  }
  @keyframes lord-alpha-aperture-open {
    0% { opacity: 0; stroke-dashoffset: 34; transform: scale(.2) rotate(-45deg); }
    30%, 72% { opacity: 1; stroke-dashoffset: 0; transform: scale(1) rotate(30deg); }
    100% { opacity: .35; stroke-dashoffset: -34; transform: scale(.45) rotate(70deg); }
  }
  @keyframes lord-alpha-hit-check {
    0%, 100% { transform: translate3d(0, 0, 0); filter: none; }
    35% { transform: translate3d(-3%, 1%, 0); filter: brightness(1.9) saturate(.35); }
  }
  @keyframes lord-alpha-skill-rise {
    0%, 100% { transform: translate3d(0, 0, 0); }
    45% { transform: translate3d(0, -4%, 0); }
  }
  @keyframes lord-alpha-skill-web-shot {
    0% { transform: translate3d(-4%, 2%, 0) rotate(-2deg) scale(.96); }
    24% { transform: translate3d(-1%, 0, 0) rotate(-.6deg) scale(.985); }
    48%, 70% { transform: translate3d(4%, -1%, 0) rotate(.8deg) scale(1.025); }
    100% { transform: translate3d(0, 0, 0) rotate(0) scale(1); }
  }
  @keyframes lord-alpha-skill-grapple {
    0% { transform: translate3d(4%, -1%, 0) rotate(1.4deg) scale(1.02, .98); }
    24% { transform: translate3d(1%, 1.5%, 0) rotate(.2deg) scale(.985, 1.02); }
    48%, 72% { transform: translate3d(-5%, 2%, 0) rotate(-2deg) scale(1.025, .985); }
    100% { transform: translate3d(0, 0, 0) rotate(0) scale(1); }
  }
  @keyframes lord-alpha-skill-roc-stun {
    0% { transform: translate3d(-1%, 4%, 0) rotate(-1.5deg) scale(.97, 1.035); }
    26% { transform: translate3d(0, 1%, 0) rotate(-.4deg) scale(.99, 1.01); }
    48%, 66% { transform: translate3d(3%, -7%, 0) rotate(2deg) scale(1.04, .97); }
    100% { transform: translate3d(0, 0, 0) rotate(0) scale(1); }
  }
  @keyframes lord-alpha-skill-net {
    0% { transform: translate3d(-2%, 2%, 0) rotate(-1.6deg) scale(.965); }
    25% { transform: translate3d(0, 0, 0) rotate(.7deg) scale(.99); }
    46% { transform: translate3d(2%, -1%, 0) rotate(-.5deg) scale(1.015); }
    68% { transform: translate3d(3%, -1.5%, 0) rotate(.8deg) scale(1.025); }
    100% { transform: translate3d(0, 0, 0) rotate(0) scale(1); }
  }
  @keyframes lord-alpha-skill-wormhole {
    0% { transform: translate3d(-8%, 3%, 0) rotate(-2deg) scale(.94, 1.03); }
    28% { transform: translate3d(-2%, 1%, 0) rotate(-.7deg) scale(.98, 1.01); }
    54%, 72% { transform: translate3d(8%, -2%, 0) rotate(1.4deg) scale(1.035, .98); }
    100% { transform: translate3d(0, 0, 0) rotate(0) scale(1); }
  }
  @keyframes lord-alpha-skill-clone {
    0% { transform: translate3d(0, 1%, 0) rotate(-2deg) scale(.97); }
    20% { transform: translate3d(-2%, -1%, 0) rotate(1.6deg) scale(1.01); }
    38% { transform: translate3d(2%, -1%, 0) rotate(-1.2deg) scale(.99); }
    58%, 76% { transform: translate3d(0, -3%, 0) rotate(0) scale(1.035); }
    100% { transform: translate3d(0, 0, 0) rotate(0) scale(1); }
  }
  @keyframes lord-alpha-skill-summon {
    0% { transform: translate3d(0, 5%, 0) scale(.96, 1.04); }
    24% { transform: translate3d(0, 2%, 0) scale(.985, 1.015); }
    48%, 76% { transform: translate3d(0, 0, 0) scale(1.02, .99); }
    100% { transform: translate3d(0, 0, 0) scale(1); }
  }
  @keyframes lord-alpha-skill-dragon {
    0% { transform: translate3d(2%, -2%, 0) rotate(1.2deg) scale(1.025, .98); }
    30% { transform: translate3d(0, 3%, 0) rotate(0) scale(.98, 1.035); }
    50%, 72% { transform: translate3d(-2%, 4%, 0) rotate(-1deg) scale(1.035, .975); }
    100% { transform: translate3d(0, 0, 0) rotate(0) scale(1); }
  }
  ${SKILL_SEQUENCE_KEYFRAMES}
  @keyframes lord-alpha-victory-rise {
    0%, 100% { transform: translate3d(0, 0, 0); }
    50% { transform: translate3d(0, -5%, 0); }
  }
  @keyframes lord-alpha-death-settle {
    from { transform: translate3d(0, -2%, 0) rotate(0deg); }
    to { transform: translate3d(0, 9%, 0) rotate(7deg); }
  }
  @keyframes lord-alpha-plate-build {
    0%, 18% { opacity: 0; stroke-dashoffset: 22; }
    19%, 100% { opacity: 1; stroke-dashoffset: 0; }
  }
  @keyframes lord-alpha-wing-rudder {
    0%, 100% { transform: rotate(-1.5deg) scaleY(.98); }
    50% { transform: rotate(2deg) scaleY(1.015); }
  }
  @keyframes lord-alpha-wing-latent {
    0%, 100% { transform: scale(.16, .32) rotate(-3deg); opacity: .18; }
    50% { transform: scale(.2, .4) rotate(1deg); opacity: .32; }
  }
  @keyframes lord-alpha-wing-boost {
    0% { transform: scale(.76, .88); filter: brightness(.85); }
    28% { transform: scale(1.09, 1.04); filter: brightness(1.45); }
    100% { transform: scale(1, 1); filter: brightness(1); }
  }
  @keyframes lord-alpha-wing-deploy {
    0% { transform: scale(.48, .3); opacity: .38; }
    45% { transform: scale(1.08, 1.05); opacity: 1; }
    100% { transform: scale(1, 1); opacity: 1; }
  }
  @keyframes lord-alpha-wing-glide {
    0%, 100% { transform: rotate(-2deg) scale(1.02); }
    50% { transform: rotate(2deg) scale(1.07); }
  }
  .lordAlphaSprite__motion[data-motion="idle"] { animation: lord-alpha-idle-float 1.65s ease-in-out infinite; }
  .lordAlphaSprite__motion[data-motion="move"] { animation: lord-alpha-move-drive .32s ease-in-out infinite; }
  .lordAlphaSprite__motion[data-motion="attack"] { animation: lord-alpha-attack-cut .2s ease-out 1; }
  .lordAlphaSprite__motion[data-combo-beat="quick"] { animation: lord-alpha-combo-quick var(--lord-alpha-skill-sequence-duration) ease-out 1; }
  .lordAlphaSprite__motion[data-combo-beat="web"] { animation: lord-alpha-combo-web var(--lord-alpha-skill-sequence-duration) ease-out 1; }
  .lordAlphaSprite__motion[data-combo-beat="power"] { animation: lord-alpha-combo-power var(--lord-alpha-skill-sequence-duration) ease-out 1; }
  .lordAlphaSprite__motion[data-combo-beat="roc"] { animation: lord-alpha-combo-roc var(--lord-alpha-skill-sequence-duration) ease-out 1; }
  .lordAlphaSprite__motion[data-combo-beat="finisher"] { animation: lord-alpha-combo-finisher var(--lord-alpha-skill-sequence-duration) ease-out 1; }
  .lordAlphaSprite__motion[data-motion="hit"] { animation: lord-alpha-hit-check .22s steps(2, end) 1; }
  .lordAlphaSprite__motion[data-motion="skill"] { animation: lord-alpha-skill-rise .38s ease-out 1; }
  .lordAlphaSprite__motion[data-skill-sprite="web-shot"] { animation: lord-alpha-skill-web-shot var(--lord-alpha-skill-sequence-duration) cubic-bezier(.2,.72,.2,1) both; }
  .lordAlphaSprite__motion[data-skill-sprite="grapple"] { animation: lord-alpha-skill-grapple var(--lord-alpha-skill-sequence-duration) cubic-bezier(.2,.7,.18,1) both; }
  .lordAlphaSprite__motion[data-skill-sprite="roc-stun"] { animation: lord-alpha-skill-roc-stun var(--lord-alpha-skill-sequence-duration) cubic-bezier(.16,.8,.2,1) both; }
  .lordAlphaSprite__motion[data-skill-sprite="dimensional-net"] { animation: lord-alpha-skill-net var(--lord-alpha-skill-sequence-duration) cubic-bezier(.22,.7,.16,1) both; }
  .lordAlphaSprite__motion[data-skill-sprite="wormhole-step"] { animation: lord-alpha-skill-wormhole var(--lord-alpha-skill-sequence-duration) cubic-bezier(.16,.86,.2,1) both; }
  .lordAlphaSprite__motion[data-skill-sprite="shadow-clone"] { animation: lord-alpha-skill-clone var(--lord-alpha-skill-sequence-duration) cubic-bezier(.2,.72,.2,1) both; }
  .lordAlphaSprite__motion[data-skill-sprite="tharthareon"] { animation: lord-alpha-skill-summon var(--lord-alpha-skill-sequence-duration) cubic-bezier(.2,.7,.2,1) both; }
  .lordAlphaSprite__motion[data-skill-sprite="millennium-dragon"] { animation: lord-alpha-skill-dragon var(--lord-alpha-skill-sequence-duration) cubic-bezier(.18,.78,.18,1) both; }
  .lordAlphaSprite__motion[data-imagegen-skill-sequence="true"] {
    animation: none;
    transform: none;
    scale: 1;
  }
  .lordAlphaSprite__skillSequenceViewport {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    pointer-events: none;
  }
  .lordAlphaSprite__skillSequenceSheet {
    position: absolute;
    left: 0;
    top: 50%;
    display: block;
    width: var(--lord-alpha-skill-sequence-sheet-width);
    height: auto;
    max-width: none;
    image-rendering: pixelated;
    animation-duration: var(--lord-alpha-skill-sequence-duration);
    animation-timing-function: steps(1, end);
    animation-fill-mode: both;
    animation-iteration-count: 1;
  }
  .lordAlphaSprite__skillSequenceSheet--trail {
    opacity: .16;
    filter: blur(.32px) brightness(1.18) saturate(1.08);
    mix-blend-mode: screen;
    animation-delay: 18ms;
  }
  .lordAlphaSprite__motion[data-motion="victory"] { animation: lord-alpha-victory-rise .75s ease-in-out infinite; }
  .lordAlphaSprite__motion[data-motion="death"] { animation: lord-alpha-death-settle .46s ease-in forwards; }
  .lordAlphaSprite__plateStep {
    animation: lord-alpha-plate-build .52s steps(1, end) both;
    stroke-dasharray: 22;
  }
  .lordAlphaSprite__gesture { animation: lord-alpha-gesture-build .28s ease-out both; }
  .lordAlphaSprite__aperture { animation: lord-alpha-aperture-open .66s ease-out both; transform-origin: 50px 31px; stroke-dasharray: 34; }
  .lordAlphaSprite__wing[data-wing-mode="latent"] { animation: lord-alpha-wing-latent 1.8s ease-in-out infinite; }
  .lordAlphaSprite__wing[data-wing-mode="rudder"] { animation: lord-alpha-wing-rudder 1.55s ease-in-out infinite; }
  .lordAlphaSprite__wing[data-wing-mode="boost"] { animation: lord-alpha-wing-boost .32s ease-out 1; }
  .lordAlphaSprite__wing[data-wing-mode="deploy"] { animation: lord-alpha-wing-deploy .42s ease-out 1; }
  .lordAlphaSprite__wing[data-wing-mode="glide"] { animation: lord-alpha-wing-glide 1.1s ease-in-out infinite; }
  @media (prefers-reduced-motion: reduce) {
    .lordAlphaSprite:not([data-force-motion="true"]) .lordAlphaSprite__motion,
    .lordAlphaSprite:not([data-force-motion="true"]) .lordAlphaSprite__plateStep,
    .lordAlphaSprite:not([data-force-motion="true"]) .lordAlphaSprite__wing,
    .lordAlphaSprite:not([data-force-motion="true"]) .lordAlphaSprite__gesture,
    .lordAlphaSprite:not([data-force-motion="true"]) .lordAlphaSprite__aperture { animation: none !important; }
    .lordAlphaSprite:not([data-force-motion="true"]) .lordAlphaSprite__skillSequenceSheet {
      animation: none !important;
      transform: translate3d(var(--lord-alpha-skill-sequence-reduced-offset), -50%, 0);
    }
    .lordAlphaSprite:not([data-force-motion="true"]) .lordAlphaSprite__skillSequenceSheet--trail { display: none; }
    .lordAlphaSprite:not([data-force-motion="true"]) .lordAlphaSprite__plateStep { opacity: 1; stroke-dashoffset: 0; }
    .lordAlphaSprite:not([data-force-motion="true"]) .lordAlphaSprite__gesture,
    .lordAlphaSprite:not([data-force-motion="true"]) .lordAlphaSprite__aperture { opacity: 1; }
  }
`;

export function LordAlphaSprite({
  baseUrl = import.meta.env.BASE_URL,
  form,
  facing,
  motion,
  pulse,
  eventPulse = pulse,
  event = null,
  comboBeat = null,
  equipSourceForm = null,
  compact = false,
  forceMotion = false,
  className,
  style,
}: LordAlphaSpriteProps) {
  const svgId = useId().replace(/:/g, '');
  useEffect(() => {
    if (form === 'supreme') preloadLordAlphaSkillSequences(baseUrl);
  }, [baseUrl, form]);
  const formAssets = LORD_ALPHA_ASSETS.forms[form];
  const eventKind = event?.kind ?? null;
  const eventSubtype = event?.subtype ?? null;
  const skillSequence = form === 'supreme' && motion === 'skill'
    ? resolveLordAlphaSkillSequence(event)
    : null;
  const activeComboBeat = motion === 'attack' ? comboBeat : null;
  const attackSequence = form === 'supreme' && motion === 'attack'
    ? resolveLordAlphaAttackSequence(activeComboBeat)
    : null;
  const frameSequence = skillSequence ?? attackSequence;
  const skillSpriteId = skillSequence?.id ?? null;
  const attackSpriteId = attackSequence?.id ?? null;
  const comboSuffix = form === 'supreme' && activeComboBeat && !attackSequence
    ? LORD_ALPHA_COMBO_ASSET_SUFFIXES[activeComboBeat]
    : null;
  const bodySuffix = comboSuffix ?? (motion === 'attack' || motion === 'skill'
    ? formAssets.attackSuffix
    : formAssets.idleSuffix);
  const equipping = eventKind === 'equip';
  const equipBaseForm = equipSourceForm ?? (form === 'supreme' ? 'relaxed' : form);
  const bodyUrl = lordAlphaAssetUrl(
    baseUrl,
    equipping ? LORD_ALPHA_ASSETS.forms[equipBaseForm].idleSuffix : bodySuffix,
  );
  const equippedBodyUrl = lordAlphaAssetUrl(
    baseUrl,
    LORD_ALPHA_ASSETS.forms.supreme.idleSuffix,
  );
  const anatomicalSide = anatomicalLeftScreenSide(facing);
  const [wing] = rocWingPlacement(facing);
  const wingOnLeft = anatomicalSide === 'screen-left';
  const wingDirection: -1 | 1 = wingOnLeft ? -1 : 1;
  const wingRootX = wingOnLeft ? 70 : 10;
  const wingMode = activeComboBeat === 'roc'
    ? 'boost'
    : eventSubtype === 'roc-stun'
      ? 'deploy'
      : eventSubtype === 'web-pull' || eventSubtype === 'wormhole-cast' || motion === 'move'
        ? 'rudder'
      : motion === 'victory'
        ? 'glide'
        : 'latent';
  const wrapperStyle: CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
    display: 'block',
    overflow: 'visible',
    pointerEvents: 'none',
    userSelect: 'none',
    isolation: 'isolate',
    ...style,
  };
  const wingStyle: CSSProperties = {
    position: 'absolute',
    zIndex: 0,
    top: '-16.5%',
    left: wing.anchorX < 0 ? '-56%' : '45%',
    width: '104%',
    height: '126%',
    overflow: 'visible',
    pointerEvents: 'none',
    filter: 'drop-shadow(0 0 4px rgba(125, 211, 252, .72))',
    transformOrigin: wingOnLeft ? '88% 86%' : '12% 86%',
  };
  const slingerStyle: CSSProperties = {
    position: 'absolute',
    zIndex: 3,
    top: '60%',
    left: wingOnLeft ? '11%' : '57%',
    width: '22%',
    height: '14%',
    overflow: 'visible',
    pointerEvents: 'none',
    filter: 'drop-shadow(0 0 2px rgba(103, 232, 249, .9))',
  };
  const platePairs = [
    ['M48 28 L34 31 L27 42 L43 45 Z', 'M52 28 L66 31 L73 42 L57 45 Z'],
    ['M43 47 L26 45 L22 57 L41 60 Z', 'M57 47 L74 45 L78 57 L59 60 Z'],
    ['M41 62 L25 61 L24 74 L42 73 Z', 'M59 62 L75 61 L76 74 L58 73 Z'],
    ['M43 76 L29 78 L33 91 L47 84 Z', 'M57 76 L71 78 L67 91 L53 84 Z'],
  ] as const;

  return (
    <span
      className={['lordAlphaSprite', className].filter(Boolean).join(' ')}
      style={wrapperStyle}
      data-form={form}
      data-facing={facing}
      data-motion={motion}
      data-pulse={pulse}
      data-event-pulse={eventPulse}
      data-combo-beat={activeComboBeat ?? undefined}
      data-skill-sprite={skillSpriteId ?? undefined}
      data-attack-sprite={attackSpriteId ?? undefined}
      data-skill-frame-count={skillSequence?.frameCount}
      data-attack-frame-count={attackSequence?.frameCount}
      data-compact={compact || undefined}
      data-force-motion={forceMotion || undefined}
      role="img"
      aria-label={`Lord Alpha ${form} form`}
    >
      <style>{SPRITE_CSS}</style>
      <span
        key={`motion-${motion}-${frameSequence?.id ?? 'base'}-${pulse}-${eventPulse}`}
        className="lordAlphaSprite__motion"
        data-motion={motion}
        data-combo-beat={activeComboBeat ?? undefined}
        data-skill-sprite={skillSpriteId ?? undefined}
        data-attack-sprite={attackSpriteId ?? undefined}
        data-imagegen-skill-sequence={skillSequence ? true : undefined}
        style={{
          position: 'absolute',
          zIndex: 1,
          inset: 0,
          transformOrigin: '50% 88%',
          ...(frameSequence
            ? {
              '--lord-alpha-skill-sequence-duration': `${frameSequence.durationMs}ms`,
              '--lord-alpha-quick-x': facing === 'left' ? '-4.5%' : '4.5%',
              '--lord-alpha-web-x': facing === 'left' ? '-2.5%' : '2.5%',
              '--lord-alpha-web-rotate': facing === 'left' ? '1.2deg' : '-1.2deg',
              '--lord-alpha-power-windup-x': facing === 'left' ? '1%' : '-1%',
              '--lord-alpha-power-impact-x': facing === 'left' ? '-5.5%' : '5.5%',
              '--lord-alpha-roc-x': facing === 'left' ? '-3.5%' : '3.5%',
              '--lord-alpha-finisher-x': facing === 'left' ? '-3%' : '3%',
            }
            : {}),
        } as CSSProperties}
        aria-hidden="true"
      >

      {/* One Roc Wing only. It is independently placed on anatomical-left and never mirrored. */}
      <svg
        className="lordAlphaSprite__wing"
        data-part="roc-wing"
        data-wing-mode={wingMode}
        data-anatomical-side={wing.anatomicalSide}
        data-screen-side={wing.screenSide}
        viewBox="0 0 80 112"
        style={wingStyle}
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id={`${svgId}-feather`}
            x1={wingOnLeft ? '100%' : '0%'}
            y1="80%"
            x2={wingOnLeft ? '0%' : '100%'}
            y2="0%"
          >
            <stop offset="0" stopColor="#fffdf2" />
            <stop offset=".48" stopColor="#fff7c2" />
            <stop offset="1" stopColor="#b9e6ff" />
          </linearGradient>
          <linearGradient id={`${svgId}-quill`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#e7c760" />
            <stop offset="1" stopColor="#e0f2fe" />
          </linearGradient>
        </defs>
        <g fill={`url(#${svgId}-feather)`} stroke="#f8e9a1" strokeWidth="1.05" strokeLinejoin="round">
          <path d={featherPath(wingRootX, wingDirection, 83, 59, 5, 10)} />
          <path d={featherPath(wingRootX, wingDirection, 87, 55, 24, 9)} />
          <path d={featherPath(wingRootX, wingDirection, 91, 48, 43, 8)} />
          <path d={featherPath(wingRootX, wingDirection, 94, 39, 60, 7)} />
          <path d={featherPath(wingRootX, wingDirection, 97, 29, 75, 6)} />
        </g>
        <path
          d={`M ${wingRootX} 101 C ${wingRootX + wingDirection * 7} 78, ${wingRootX + wingDirection * 20} 45, ${wingRootX + wingDirection * 52} 8`}
          fill="none"
          stroke={`url(#${svgId}-quill)`}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d={`M ${wingRootX - wingDirection * 2} 102 Q ${wingRootX + wingDirection * 8} 82 ${wingRootX + wingDirection * 13} 68`}
          fill="none"
          stroke="#7dd3fc"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
      </svg>

      <span
        className="lordAlphaSprite__body"
        style={{ position: 'absolute', zIndex: 2, inset: 0 }}
      >
        {frameSequence ? (
          <span
            key={`frame-sequence-${frameSequence.id}-${pulse}-${eventPulse}`}
            className="lordAlphaSprite__skillSequenceViewport"
            data-part={skillSequence ? 'skill-sequence' : 'attack-sequence'}
            data-skill-sprite={skillSequence?.id}
            data-attack-sprite={attackSequence?.id}
            data-facing={facing}
            data-frame-count={frameSequence.frameCount}
            data-frame-width={frameSequence.frameWidth}
            data-frame-height={frameSequence.frameHeight}
            style={{ transform: facing === 'left' ? 'scaleX(-1)' : undefined }}
          >
            <img
              className="lordAlphaSprite__skillSequenceSheet"
              data-part={skillSequence ? 'skill-sequence-sheet' : 'attack-sequence-sheet'}
              data-skill-sprite={skillSequence?.id}
              data-attack-sprite={attackSequence?.id}
              src={lordAlphaAssetUrl(baseUrl, frameSequence.suffix)}
              alt=""
              draggable={false}
              style={{
                animationName: skillSequenceAnimationName(frameSequence.id),
                '--lord-alpha-skill-sequence-sheet-width': `${frameSequence.frameCount * 100}%`,
                '--lord-alpha-skill-sequence-reduced-offset': `${skillSequenceFrameOffset(
                  frameSequence.reducedMotionFrame,
                  frameSequence.frameCount,
                )}%`,
              } as CSSProperties}
            />
            {!skillSequence && (
              <img
                className="lordAlphaSprite__skillSequenceSheet lordAlphaSprite__skillSequenceSheet--trail"
                data-part="sequence-motion-trail"
                data-attack-sprite={attackSequence?.id}
                src={lordAlphaAssetUrl(baseUrl, frameSequence.suffix)}
                alt=""
                draggable={false}
                aria-hidden="true"
                style={{
                  animationName: skillSequenceAnimationName(frameSequence.id),
                  '--lord-alpha-skill-sequence-sheet-width': `${frameSequence.frameCount * 100}%`,
                  '--lord-alpha-skill-sequence-reduced-offset': `${skillSequenceFrameOffset(
                    frameSequence.reducedMotionFrame,
                    frameSequence.frameCount,
                  )}%`,
                } as CSSProperties}
              />
            )}
          </span>
        ) : (
          <img
            data-part="body"
            src={bodyUrl}
            alt=""
            draggable={false}
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              // Combo poses use the full 3:2 frame for extended limbs and
              // geometry, so contain them without changing the gameplay box.
              // Other body frames retain their calibrated transparent-gutter crop.
              objectFit: comboSuffix ? 'contain' : 'cover',
              objectPosition: comboSuffix
                ? '50% 50%'
                : motion === 'attack' || motion === 'skill' ? '52% 50%' : '57% 50%',
              imageRendering: 'pixelated',
              transform: facing === 'left' ? 'scaleX(-1)' : undefined,
              transformOrigin: '50% 50%',
            }}
          />
        )}
      </span>

      {/* Generated skill sequences include their compact wrist hardware; base poses retain the independent overlay. */}
      {!frameSequence && (
        <svg data-part="web-slinger" viewBox="0 0 24 16" style={slingerStyle} aria-hidden="true">
          <path d="M2 5 L7 2 L20 4 L22 11 L17 14 L5 12 Z" fill="#0f172a" stroke="#c7f9ff" strokeWidth="1.2" />
          <path d="M7 3 L8 12 M13 3 L13 13 M19 5 L17 13 M3 6 L21 10 M4 10 L19 5" fill="none" stroke="#67e8f9" strokeWidth=".75" />
          <circle cx="13" cy="8" r="2.15" fill="#fff7c2" stroke="#38bdf8" strokeWidth=".8" />
        </svg>
      )}

      {activeComboBeat && !attackSequence && (
        <svg
          key={`gesture-${activeComboBeat}-${pulse}`}
          className="lordAlphaSprite__gesture"
          data-part="combo-geometry"
          data-combo-beat={activeComboBeat}
          viewBox="0 0 42 42"
          style={{
            position: 'absolute',
            zIndex: 4,
            top: activeComboBeat === 'roc' ? '19%' : '43%',
            left: facing === 'right' ? '61%' : '5%',
            width: activeComboBeat === 'finisher' ? '38%' : '27%',
            height: activeComboBeat === 'finisher' ? '38%' : '27%',
            overflow: 'visible',
            transformOrigin: '50% 50%',
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        >
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            {activeComboBeat === 'quick' && <path d="M5 22 H35" stroke="#dff8ff" strokeWidth="2.1" />}
            {activeComboBeat === 'web' && (
              <>
                <circle cx="12" cy="21" r="2.4" fill="#fff8c8" stroke="#67e8f9" />
                <path d="M14 21 L35 9 M14 21 L38 21 M14 21 L35 33" stroke="#8de7ff" strokeWidth="1.5" />
              </>
            )}
            {activeComboBeat === 'power' && (
              <>
                <path d="M8 11 L32 8 L37 22 L27 35 L9 30 Z" stroke="#79d8ff" strokeWidth="1.8" />
                <path d="M8 11 L27 35 M32 8 L9 30" stroke="#f3d878" strokeWidth="1.1" />
              </>
            )}
            {activeComboBeat === 'roc' && (
              <>
                <path d="M5 31 Q20 2 37 8 Q25 16 13 37" stroke="#fff5b8" strokeWidth="2.3" />
                <path d="M9 34 Q22 12 34 11" stroke="#7dd3fc" strokeWidth="1.2" />
              </>
            )}
            {activeComboBeat === 'finisher' && (
              <>
                <circle cx="21" cy="21" r="15" stroke="#8be9ff" strokeWidth="1.35" />
                <circle cx="21" cy="21" r="7" stroke="#f5dc82" strokeWidth="1.2" />
                <path d="M6 21 H36 M21 6 V36 M10 10 L32 32 M32 10 L10 32" stroke="#caf7ff" strokeWidth=".8" />
              </>
            )}
          </g>
        </svg>
      )}
      </span>

      {equipping && !skillSequence && (
        <svg
          key={`equip-${eventPulse}`}
          data-part="equip-construction"
          viewBox="0 0 100 120"
          preserveAspectRatio="none"
          style={{
            position: 'absolute',
            zIndex: 4,
            inset: compact ? '-2px -1px' : '-3px -2px',
            width: 'calc(100% + 4px)',
            height: 'calc(100% + 6px)',
            overflow: 'visible',
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={`${svgId}-armor`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#effcff" />
              <stop offset=".45" stopColor="#79d8ff" />
              <stop offset="1" stopColor="#d9b957" />
            </linearGradient>
            <mask id={`${svgId}-plate-mask`} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="120">
              <rect width="100" height="120" fill="black" />
              {platePairs.flatMap((pair, pairIndex) => pair.map((path, sideIndex) => (
                <path
                  key={`${pairIndex}-${sideIndex}`}
                  className="lordAlphaSprite__plateStep"
                  d={path}
                  fill="white"
                  stroke="white"
                  strokeWidth="2"
                  style={{ animationDelay: `${pairIndex * 90}ms` }}
                />
              )))}
            </mask>
          </defs>
          <g data-part="pauldron-aperture" className="lordAlphaSprite__aperture" fill="none">
            <circle cx="50" cy="31" r="9" stroke="#dffaff" strokeWidth="1.8" />
            <circle cx="50" cy="31" r="5.5" stroke="#e8cb6b" strokeWidth="1.25" />
            <path d="M50 22 L34 38 M50 22 L66 38 M42 35 L30 55 M58 35 L70 55" stroke="#6ee7ff" strokeWidth="1.05" />
          </g>
          <image
            href={equippedBodyUrl}
            x="0"
            y="0"
            width="100"
            height="120"
            preserveAspectRatio="xMidYMid slice"
            mask={`url(#${svgId}-plate-mask)`}
            transform={facing === 'left' ? 'translate(100 0) scale(-1 1)' : undefined}
          />
          {platePairs.flatMap((pair, pairIndex) => pair.map((path, sideIndex) => (
            <path
              key={`edge-${pairIndex}-${sideIndex}`}
              className="lordAlphaSprite__plateStep"
              d={path}
              fill="none"
              stroke={pairIndex % 2 === 0 ? '#e8fbff' : '#f6df85'}
              strokeWidth="1.2"
              strokeLinejoin="round"
              style={{ animationDelay: `${pairIndex * 90}ms` }}
            />
          )))}
        </svg>
      )}
    </span>
  );
}
