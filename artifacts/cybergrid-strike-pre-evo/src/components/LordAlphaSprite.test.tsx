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
  LordAlphaSprite,
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
    ...Object.values(LORD_ALPHA_ASSETS.effectSequences).map(({ suffix }) => suffix),
    ...Object.values(LORD_ALPHA_ASSETS.effects),
  ];

  for (const suffix of suffixes) {
    ok(existsSync(path.join(publicRoot, suffix)), `missing public asset: ${suffix}`);
  }
});

test('generated attack, skill, and arena-effect strips contain eight native 240x160 RGBA frames', () => {
  const publicRoot = path.resolve(import.meta.dirname, '../../public');
  for (const asset of [
    ...Object.values(LORD_ALPHA_ASSETS.attackSequences),
    ...Object.values(LORD_ALPHA_ASSETS.skillSequences),
    ...Object.values(LORD_ALPHA_ASSETS.effectSequences),
  ]) {
    const png = readFileSync(path.join(publicRoot, asset.suffix));
    strictEqual(png.subarray(1, 4).toString('ascii'), 'PNG');
    strictEqual(png.readUInt32BE(16), asset.frameWidth * asset.frameCount, `${asset.suffix} width`);
    strictEqual(png.readUInt32BE(20), asset.frameHeight, `${asset.suffix} height`);
    strictEqual(png[25], 6, `${asset.suffix} must be RGBA`);
  }
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
    ['move', 'roc-stun', 'roc-stun', 700, -37.5, 'deploy'],
    ['wormhole', 'dimensional-net', 'dimensional-net', 800, -62.5, 'latent'],
    ['wormhole', 'wormhole-cast', 'wormhole-step', 760, -62.5, 'rudder'],
    ['clone', 'clone-symmetry', 'shadow-clone', 960, -75, 'latent'],
    ['tharthareon', 'tharthareon-emerge', 'tharthareon', 980, -75, 'latent'],
    ['dragon', 'ultimate-landing', 'millennium-dragon', 1_100, -75, 'latent'],
    ['equip', 'equip-assembly', 'equip', 720, -87.5, 'latent'],
  ] as const;

  for (const [kind, subtype, assetId, durationMs, reducedOffset, wingMode] of cases) {
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
    ok(markup.includes('data-frame-count="8"'));
    ok(markup.includes('data-frame-width="240"'));
    ok(markup.includes('data-frame-height="160"'));
    ok(markup.includes(`--lord-alpha-skill-sequence-duration:${durationMs}ms`));
    ok(markup.includes('--lord-alpha-skill-sequence-sheet-width:800%'));
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

  ok(markup.includes('@keyframes lord-alpha-skill-sequence-frames-web-shot'));
  ok(markup.includes('10.9375% { transform: translate3d(-12.5%, -50%, 0); }'));
  ok(markup.includes('81.25% { transform: translate3d(-87.5%, -50%, 0); }'));
  ok(markup.includes('100% { transform: translate3d(-87.5%, -50%, 0); }'));
  ok(markup.includes('animation-timing-function: steps(1, end)'));
  ok(markup.includes('animation-fill-mode: both'));
  ok(markup.includes('@media (prefers-reduced-motion: reduce)'));
  ok(markup.includes('animation: none !important;'));
  ok(markup.includes('--lord-alpha-skill-sequence-reduced-offset:-37.5%'));
  ok(markup.includes('transform: translate3d(var(--lord-alpha-skill-sequence-reduced-offset), -50%, 0);'));
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
