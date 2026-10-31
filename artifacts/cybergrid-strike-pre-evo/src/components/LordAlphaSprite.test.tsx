import { strictEqual, ok, throws } from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  LORD_ALPHA_ASSETS,
  LORD_ALPHA_FORM_IDS,
  createLordAlphaPresentationEvent,
} from '../game/lord-alpha';
import {
  LORD_ALPHA_SPRITE_CSS,
  LordAlphaSprite,
  buildLordAlphaFrameScaleKeyframes,
  buildLordAlphaSkillSequenceKeyframes,
} from './LordAlphaSprite';

function renderFacing(facing: 'left' | 'right'): string {
  return renderToStaticMarkup(
    <LordAlphaSprite
      baseUrl="/"
      form="supreme"
      facing={facing}
      motion="idle"
      pulse={0}
    />,
  );
}

test('rendering contains exactly one anatomical-left Roc Wing for either facing', () => {
  const right = renderFacing('right');
  const left = renderFacing('left');

  for (const markup of [right, left]) {
    strictEqual((markup.match(/data-part="roc-wing"/g) ?? []).length, 1);
    strictEqual((markup.match(/data-anatomical-side="left"/g) ?? []).length, 1);
    strictEqual((markup.match(/data-part="body"/g) ?? []).length, 1);
    strictEqual((markup.match(/data-part="web-slinger"/g) ?? []).length, 1);
  }

  ok(right.includes('data-screen-side="screen-left"'));
  ok(left.includes('data-screen-side="screen-right"'));
  ok(!right.includes('scaleX(-1)'));
  strictEqual((left.match(/scaleX\(-1\)/g) ?? []).length, 1);
});

test('every declared binary Lord Alpha asset exists in public', () => {
  const publicRoot = path.resolve(import.meta.dirname, '../../public');
  const suffixes = [
    ...LORD_ALPHA_FORM_IDS.flatMap((form) => [
      LORD_ALPHA_ASSETS.forms[form].idleSuffix,
      LORD_ALPHA_ASSETS.forms[form].attackSuffix,
    ]),
    ...Object.values(LORD_ALPHA_ASSETS.attackSequences).map(({ suffix }) => suffix),
    ...Object.values(LORD_ALPHA_ASSETS.skillSequences).map(({ suffix }) => suffix),
    LORD_ALPHA_ASSETS.rocWingSpinSequence.suffix,
    LORD_ALPHA_ASSETS.rocWingThrustSequence.suffix,
    ...Object.values(LORD_ALPHA_ASSETS.effectSequences).map(({ suffix }) => suffix),
    ...Object.values(LORD_ALPHA_ASSETS.effects),
  ];

  for (const suffix of suffixes) {
    ok(existsSync(path.join(publicRoot, suffix)), `missing public asset: ${suffix}`);
  }
});

test('generated attack, skill, and arena-effect strips match their declared native RGBA frames', () => {
  const publicRoot = path.resolve(import.meta.dirname, '../../public');
  for (const asset of [
    ...Object.values(LORD_ALPHA_ASSETS.attackSequences),
    ...Object.values(LORD_ALPHA_ASSETS.skillSequences),
    LORD_ALPHA_ASSETS.rocWingSpinSequence,
    LORD_ALPHA_ASSETS.rocWingThrustSequence,
    ...Object.values(LORD_ALPHA_ASSETS.effectSequences),
  ]) {
    const png = readFileSync(path.join(publicRoot, asset.suffix));
    strictEqual(png.subarray(1, 4).toString('ascii'), 'PNG');
    strictEqual(png.readUInt32BE(16), asset.frameWidth * asset.frameCount, `${asset.suffix} width`);
    strictEqual(png.readUInt32BE(20), asset.frameHeight, `${asset.suffix} height`);
    strictEqual(png[25], 6, `${asset.suffix} must be RGBA`);
  }
});

test('effect-heavy skills keep the actor and board VFX in separate atlases', () => {
  for (const id of [
    'wormhole-step',
    'shadow-clone',
    'tharthareon',
    'millennium-dragon',
  ] as const) {
    const expectedVersion = id === 'tharthareon' ? '-v13.png' : '-v11.png';
    ok(
      LORD_ALPHA_ASSETS.skillSequences[id].suffix.endsWith(expectedVersion),
      `${id} must use its actor-focused strip`,
    );
    ok(
      LORD_ALPHA_ASSETS.effectSequences[id].suffix.startsWith('effects/lord-alpha/sequences/'),
      `${id} must keep its effect in the VFX renderer`,
    );
  }
  ok(
    LORD_ALPHA_ASSETS.skillSequences['tharthareon-fireball'].suffix
      .endsWith('tharthareon-fireball-v15.png'),
    'tap Fireball must own the stabilized LASI recoil strip',
  );
});

test('stable authored strips use a rigid full-height 3:2 actor stage', () => {
  const attack = renderToStaticMarkup(
    <LordAlphaSprite
      baseUrl="/"
      form="supreme"
      facing="left"
      motion="attack"
      pulse={1}
      comboBeat="quick"
    />,
  );
  const rocStun = renderToStaticMarkup(
    <LordAlphaSprite
      baseUrl="/"
      form="supreme"
      facing="right"
      motion="skill"
      pulse={2}
      event={createLordAlphaPresentationEvent('move', 0, { subtype: 'roc-stun' })}
    />,
  );

  for (const markup of [attack, rocStun]) {
    ok(/height:\s*100%/.test(markup));
  }
  ok(/\.lordAlphaSprite__skillSequenceViewport\s*\{[^}]*left:\s*50%/s.test(LORD_ALPHA_SPRITE_CSS));
  ok(/\.lordAlphaSprite__skillSequenceViewport\s*\{[^}]*width:\s*auto/s.test(LORD_ALPHA_SPRITE_CSS));
  ok(/\.lordAlphaSprite__skillSequenceViewport\s*\{[^}]*aspect-ratio:\s*3 \/ 2/s.test(LORD_ALPHA_SPRITE_CSS));
  ok(attack.includes('transform:translateX(-50%) scaleX(-1)'));
  ok(rocStun.includes('left:-63%'));
  ok(rocStun.includes('aspect-ratio:3 / 2'));
  ok(LORD_ALPHA_SPRITE_CSS.includes('.lordAlphaSprite__motion[data-attack-sprite]'));
});

test('Supreme attacks use the authored frame strip while retaining combo presentation', () => {
  const markup = renderToStaticMarkup(
    <LordAlphaSprite
      baseUrl="/"
      form="supreme"
      facing="right"
      motion="attack"
      pulse={11}
      comboBeat="roc"
    />,
  );

  ok(markup.includes('data-attack-sprite="supreme-combo-roc"'));
  ok(markup.includes('data-attack-frame-count="8"'));
  ok(!markup.includes('data-skill-frame-count='));
  ok(markup.includes('data-part="attack-sequence"'));
  ok(markup.includes('data-part="attack-sequence-sheet"'));
  ok(markup.includes('skins/lord-alpha/attack-sequences/supreme-combo-roc-v11.png'));
  ok(markup.includes('animation-name:lord-alpha-skill-sequence-frames-supreme-combo-roc'));
  ok(markup.includes('--lord-alpha-skill-sequence-duration:330ms'));
  ok(markup.includes('data-combo-beat="roc"'));
  ok(!markup.includes('data-part="combo-geometry"'));
  strictEqual((markup.match(/data-part="sequence-motion-trail"/g) ?? []).length, 1);
  ok(markup.includes('data-wing-mode="boost"'));
  strictEqual((markup.match(/data-part="roc-wing"/g) ?? []).length, 1);
  ok(!markup.includes('data-part="web-slinger"'));
  ok(!markup.includes('supreme-combo-v10.png'));
});

test('undersized atlases keep a canonical root and opt into discrete frame normalization', () => {
  const cases = [
    ['attack', 'roc', null, '1.18', '153', 'height:118%', 'bottom:2.3375%', true],
    ['attack', 'finisher', null, '1.08', '153', 'height:108%', 'bottom:2.775%'],
    ['skill', null, ['tharthareon', 'tharthareon-fireball'], '1.39', '153', 'height:139%', 'bottom:1.41875%'],
    ['skill', null, ['dragon', 'ultimate-landing'], '1.35', '153', 'height:135%', 'bottom:1.59375%', true],
  ] as const;

  for (const [motion, comboBeat, skill, scale, rootY, height, bottom] of cases) {
    const markup = renderToStaticMarkup(
      <LordAlphaSprite
        baseUrl="/"
        form="supreme"
        facing="right"
        motion={motion}
        pulse={1}
        comboBeat={comboBeat}
        event={skill
          ? createLordAlphaPresentationEvent(skill[0], 0, { subtype: skill[1] })
          : null}
      />,
    );
    ok(markup.includes(`data-actor-scale="${scale}"`));
    ok(markup.includes(`data-actor-root-y="${rootY}"`));
    ok(markup.includes(height));
    ok(markup.includes(bottom));
    ok(markup.includes('data-frame-scale-correction="false"'));
  }
  ok(!LORD_ALPHA_SPRITE_CSS.includes('@keyframes lord-alpha-frame-scale-supreme-combo-roc'));
  ok(!LORD_ALPHA_SPRITE_CSS.includes('@keyframes lord-alpha-frame-scale-roc-wing-spin'));
});

test('Supreme equip uses the authored transformation strip without the legacy overlay', () => {
  const markup = renderToStaticMarkup(
    <LordAlphaSprite
      baseUrl="/"
      form="supreme"
      facing="right"
      motion="skill"
      pulse={4}
      eventPulse={9}
      event={createLordAlphaPresentationEvent('equip', 0)}
    />,
  );

  ok(markup.includes('data-pulse="4"'));
  ok(markup.includes('data-event-pulse="9"'));
  ok(!markup.includes('data-part="equip-construction"'));
  ok(markup.includes(LORD_ALPHA_ASSETS.skillSequences.equip.suffix));
  ok(markup.includes('data-part="skill-sequence"'));
});

test('non-Supreme equip retains the procedural construction fallback', () => {
  const markup = renderToStaticMarkup(
    <LordAlphaSprite
      baseUrl="/"
      form="relaxed"
      facing="right"
      motion="skill"
      pulse={4}
      eventPulse={9}
      event={createLordAlphaPresentationEvent('equip', 0)}
    />,
  );

  ok(markup.includes('data-part="equip-construction"'));
  ok(markup.includes('skins/lord-alpha/relaxed-idle.png'));
  ok(!markup.includes('data-part="skill-sequence"'));
});

test('semantic skill events select distinct generated frame sequences', () => {
  const cases = [
    ['web', 'web-chain', 'web-shot', 640, -37.5, 'latent'],
    ['web', 'web-pull', 'grapple', 700, -50, 'rudder'],
    ['move', 'roc-stun', 'roc-stun', 1_800, -37.5, 'thrust'],
    ['move', 'ninjato-phase-slice', 'ninjato-phase-slice', 1_420, -60, 'latent'],
    ['move', 'ninjato-back-thrust', 'ninjato-back-thrust', 660, -62.5, 'latent'],
    ['wormhole', 'dimensional-net', 'dimensional-net', 800, -62.5, 'latent'],
    ['wormhole', 'wormhole-cast', 'wormhole-step', 760, -62.5, 'rudder'],
    ['clone', 'clone-symmetry', 'shadow-clone', 960, -75, 'latent'],
    ['tharthareon', 'tharthareon-emerge', 'tharthareon', 980, -42.857142857142854, 'latent'],
    ['tharthareon', 'tharthareon-fireball', 'tharthareon-fireball', 2_020, -42.857142857142854, 'latent'],
    ['dragon', 'ultimate-landing', 'millennium-dragon', 1_100, -75, 'latent'],
    ['equip', 'equip-assembly', 'equip', 720, -87.5, 'latent'],
  ] as const;

  for (const [kind, subtype, assetId, durationMs, reducedOffset, wingMode] of cases) {
    const sequenceAsset = LORD_ALPHA_ASSETS.skillSequences[assetId];
    const markup = renderToStaticMarkup(
      <LordAlphaSprite
        baseUrl="/"
        form="supreme"
        facing="right"
        motion="skill"
        pulse={3}
        eventPulse={7}
        comboBeat="roc"
        forceMotion
        event={createLordAlphaPresentationEvent(kind, 0, { subtype })}
      />,
    );
    ok(markup.includes(`data-skill-sprite="${assetId}"`));
    ok(markup.includes(LORD_ALPHA_ASSETS.skillSequences[assetId].suffix));
    ok(markup.includes('data-part="skill-sequence"'));
    ok(markup.includes('data-part="skill-sequence-sheet"'));
    ok(markup.includes(`data-frame-count="${sequenceAsset.frameCount}"`));
    ok(markup.includes('data-frame-width="240"'));
    ok(markup.includes('data-frame-height="160"'));
    ok(markup.includes(`--lord-alpha-skill-sequence-duration:${durationMs}ms`));
    ok(markup.includes(`--lord-alpha-skill-sequence-sheet-width:${sequenceAsset.frameCount * 100}%`));
    ok(markup.includes(`--lord-alpha-skill-sequence-reduced-offset:${reducedOffset}%`));
    ok(markup.includes(`animation-name:lord-alpha-skill-sequence-frames-${assetId}`));
    ok(markup.includes('data-imagegen-skill-sequence="true"'));
    strictEqual((markup.match(/data-part="sequence-motion-trail"/g) ?? []).length, 0);
    strictEqual((markup.match(/data-part="roc-wing"/g) ?? []).length, 1);
    ok(!markup.includes('data-part="combo-geometry"'));
    ok(!markup.includes('data-part="web-slinger"'));
    ok(markup.includes(`data-wing-mode="${wingMode}"`));
    ok(markup.includes('data-force-motion="true"'));
  }
});

test('Roc Wing stays deployed on anatomical left during an in-flight Ninjatō follow-up', () => {
  const markup = renderToStaticMarkup(
    <LordAlphaSprite
      baseUrl="/"
      form="supreme"
      facing="right"
      motion="skill"
      pulse={11}
      eventPulse={19}
      rocWingActive
      event={createLordAlphaPresentationEvent('move', 0, {
        subtype: 'ninjato-phase-slice',
      })}
    />,
  );

  ok(markup.includes('data-skill-sprite="ninjato-phase-slice"'));
  strictEqual((markup.match(/data-part="roc-wing"/g) ?? []).length, 1);
  ok(markup.includes('data-wing-mode="boost"'));
  ok(markup.includes('data-anatomical-side="left"'));
  ok(markup.includes('data-screen-side="screen-left"'));
});

test('Ninjatō Back Thrust keeps its authored left-facing attack pose', () => {
  for (const facing of ['left', 'right'] as const) {
    const markup = renderToStaticMarkup(
      <LordAlphaSprite
        baseUrl="/"
        form="supreme"
        facing={facing}
        motion="skill"
        pulse={8}
        eventPulse={13}
        event={createLordAlphaPresentationEvent('move', 0, {
          subtype: 'ninjato-back-thrust',
        })}
      />,
    );
    const viewport = markup.match(
      /<span[^>]*data-part="skill-sequence"[^>]*data-skill-sprite="ninjato-back-thrust"[^>]*>/,
    )?.[0] ?? '';

    ok(viewport.includes('data-authored-facing="left"'));
    ok(viewport.includes('transform:translateX(-50%)'));
    ok(!viewport.includes('scaleX(-1)'));
  }
});

test('Roc Stun uses one ImageGen thrust wing on anatomical left without loose overlays', () => {
  for (const [facing, screenSide] of [
    ['right', 'screen-left'],
    ['left', 'screen-right'],
  ] as const) {
    const markup = renderToStaticMarkup(
      <LordAlphaSprite
        baseUrl="/"
        form="supreme"
        facing={facing}
        motion="skill"
        pulse={4}
        eventPulse={12}
        event={createLordAlphaPresentationEvent('move', 0, { subtype: 'roc-stun' })}
      />,
    );
    strictEqual((markup.match(/data-part="roc-wing"/g) ?? []).length, 1);
    strictEqual((markup.match(/data-part="roc-wing-sequence-sheet"/g) ?? []).length, 1);
    ok(markup.includes('data-anatomical-side="left"'));
    ok(markup.includes(`data-screen-side="${screenSide}"`));
    ok(markup.includes('data-back-anchor="upper-left"'));
    ok(markup.includes(LORD_ALPHA_ASSETS.rocWingThrustSequence.suffix));
    ok(markup.includes('animation-name:lord-alpha-skill-sequence-frames-roc-wing-thrust'));
    ok(markup.includes('data-wing-mode="thrust"'));
    ok(markup.includes('top:-22%'));
    ok(markup.includes(facing === 'right' ? 'left:-63%' : 'right:-63%'));
    ok(!markup.includes('--lord-alpha-roc-thrust-x'));
  }
});

test('R2 Roc branch uses the twelve-frame spin body and one anatomical-left wing', () => {
  const markup = renderToStaticMarkup(
    <LordAlphaSprite
      baseUrl="/"
      form="supreme"
      facing="right"
      motion="skill"
      pulse={8}
      eventPulse={14}
      event={createLordAlphaPresentationEvent('move', 0, { subtype: 'roc-wing-spin' })}
    />,
  );
  strictEqual((markup.match(/data-part="roc-wing"/g) ?? []).length, 1);
  ok(markup.includes('data-skill-sprite="roc-wing-spin"'));
  ok(markup.includes('data-frame-count="12"'));
  ok(markup.includes(LORD_ALPHA_ASSETS.rocWingSpinSequence.suffix));
  ok(markup.includes('data-anatomical-side="left"'));
  ok(markup.includes('data-wing-mode="boost"'));
});

test('skill strips use per-frame holds, a discrete final frame, and an authored reduced-motion frame', () => {
  const markup = renderToStaticMarkup(
    <LordAlphaSprite
      baseUrl="/"
      form="supreme"
      facing="left"
      motion="skill"
      pulse={2}
      eventPulse={5}
      event={createLordAlphaPresentationEvent('web', 0, { subtype: 'web-chain' })}
    />,
  );
  const renderedPresentation = `${markup}${LORD_ALPHA_SPRITE_CSS}`;

  ok(renderedPresentation.includes('@keyframes lord-alpha-skill-sequence-frames-web-shot'));
  ok(renderedPresentation.includes('10.9375% { transform: translate3d(-12.5%, -50%, 0); }'));
  ok(renderedPresentation.includes('81.25% { transform: translate3d(-87.5%, -50%, 0); }'));
  ok(renderedPresentation.includes('100% { transform: translate3d(-87.5%, -50%, 0); }'));
  ok(renderedPresentation.includes('animation-timing-function: steps(1, end)'));
  ok(renderedPresentation.includes('animation-fill-mode: both'));
  ok(renderedPresentation.includes('@media (prefers-reduced-motion: reduce)'));
  ok(renderedPresentation.includes('animation: none !important;'));
  ok(markup.includes('--lord-alpha-skill-sequence-reduced-offset:-37.5%'));
  ok(renderedPresentation.includes('transform: translate3d(var(--lord-alpha-skill-sequence-reduced-offset), -50%, 0);'));
  strictEqual((markup.match(/data-part="skill-sequence-sheet"/g) ?? []).length, 1);
  strictEqual((markup.match(/data-part="sequence-motion-trail"/g) ?? []).length, 0);
  strictEqual((markup.match(/scaleX\(-1\)/g) ?? []).length, 1);
});

test('skill keyframe generation supports variable counts and rejects invalid timelines', () => {
  const keyframes = buildLordAlphaSkillSequenceKeyframes({
    id: 'web-shot',
    suffix: 'skins/lord-alpha/skill-sequences/web-shot.png',
    frameCount: 3,
    frameWidth: 240,
    frameHeight: 160,
    frameHoldMs: [100, 250, 150],
    reducedMotionFrame: 1,
    durationMs: 500,
  });

  ok(keyframes.includes('0% { transform: translate3d(0%, -50%, 0); }'));
  ok(keyframes.includes('20% { transform: translate3d(-33.333333%, -50%, 0); }'));
  ok(keyframes.includes('70% { transform: translate3d(-66.666667%, -50%, 0); }'));
  ok(keyframes.includes('100% { transform: translate3d(-66.666667%, -50%, 0); }'));

  throws(() => buildLordAlphaSkillSequenceKeyframes({
    id: 'web-shot',
    suffix: 'skins/lord-alpha/skill-sequences/web-shot.png',
    frameCount: 3,
    frameWidth: 240,
    frameHeight: 160,
    frameHoldMs: [100, 250],
    reducedMotionFrame: 1,
    durationMs: 350,
  }), /frame count/);
  throws(() => buildLordAlphaSkillSequenceKeyframes({
    id: 'web-shot',
    suffix: 'skins/lord-alpha/skill-sequences/web-shot.png',
    frameCount: 3,
    frameWidth: 240,
    frameHeight: 160,
    frameHoldMs: [100, 250, 150],
    reducedMotionFrame: 3,
    durationMs: 500,
  }), /reduced-motion frame/);
});

test('frame normalization is discrete, root-anchored, and rejects malformed scale tracks', () => {
  const manifest = {
    id: 'test-normalized',
    suffix: 'skins/lord-alpha/skill-sequences/web-shot.png',
    frameCount: 3,
    frameWidth: 240 as const,
    frameHeight: 160 as const,
    frameHoldMs: [100, 250, 150],
    reducedMotionFrame: 1,
    durationMs: 500,
    frameScales: [1, 1.2, 0.9],
  };
  const keyframes = buildLordAlphaFrameScaleKeyframes(manifest);

  ok(keyframes.includes('0% { transform: scale(1); }'));
  ok(keyframes.includes('20% { transform: scale(1.2); }'));
  ok(keyframes.includes('70% { transform: scale(0.9); }'));
  ok(keyframes.includes('100% { transform: scale(0.9); }'));
  ok(LORD_ALPHA_SPRITE_CSS.includes('transform-origin: 50% 100%'));

  throws(() => buildLordAlphaFrameScaleKeyframes({
    ...manifest,
    frameScales: [1, 1.2],
  }), /scale count/);
  throws(() => buildLordAlphaFrameScaleKeyframes({
    ...manifest,
    frameScales: [1, 2.1, 1],
  }), /frame scale/);
});

test('base forms keep their authored frames when a Supreme skill event fires', () => {
  const markup = renderToStaticMarkup(
    <LordAlphaSprite
      baseUrl="/"
      form="afro"
      facing="right"
      motion="skill"
      pulse={1}
      event={createLordAlphaPresentationEvent('web', 0, { subtype: 'web-chain' })}
    />,
  );
  const rootTag = markup.slice(0, markup.indexOf('>') + 1);
  ok(markup.includes('skins/lord-alpha/afro-attack.png'));
  ok(!rootTag.includes('data-skill-sprite='));
  ok(!markup.includes('skins/lord-alpha/skill-sequences/web-shot-v11.png'));
});
