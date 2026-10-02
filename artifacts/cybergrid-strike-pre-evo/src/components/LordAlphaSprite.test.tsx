import { strictEqual, ok } from 'node:assert/strict';
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
import { LordAlphaSprite } from './LordAlphaSprite';

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
    ...Object.values(LORD_ALPHA_ASSETS.skillSequences).map(({ suffix }) => suffix),
    ...Object.values(LORD_ALPHA_ASSETS.effects),
  ];

  for (const suffix of suffixes) {
    ok(existsSync(path.join(publicRoot, suffix)), `missing public asset: ${suffix}`);
  }
});

test('generated skill strips contain four native 240x160 RGBA frames', () => {
  const publicRoot = path.resolve(import.meta.dirname, '../../public');
  for (const asset of Object.values(LORD_ALPHA_ASSETS.skillSequences)) {
    const png = readFileSync(path.join(publicRoot, asset.suffix));
    strictEqual(png.subarray(1, 4).toString('ascii'), 'PNG');
    strictEqual(png.readUInt32BE(16), asset.frameWidth * asset.frameCount, `${asset.suffix} width`);
    strictEqual(png.readUInt32BE(20), asset.frameHeight, `${asset.suffix} height`);
    strictEqual(png[25], 6, `${asset.suffix} must be RGBA`);
  }
});

test('body-motion and major-event pulses remain independently addressable', () => {
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
  ok(markup.includes('data-part="equip-construction"'));
  ok(markup.includes('skins/lord-alpha/supreme-idle.png'));
  ok(!markup.includes('data-part="skill-sequence"'));
});

test('semantic skill events select distinct generated frame sequences', () => {
  const cases = [
    ['web', 'web-chain', 'web-shot', 840],
    ['web', 'web-pull', 'grapple', 960],
    ['move', 'roc-stun', 'roc-stun', 840],
    ['wormhole', 'dimensional-net', 'dimensional-net', 1_120],
    ['wormhole', 'wormhole-cast', 'wormhole-step', 960],
    ['clone', 'clone-symmetry', 'shadow-clone', 1_120],
    ['tharthareon', 'tharthareon-emerge', 'tharthareon', 1_240],
    ['dragon', 'ultimate-landing', 'millennium-dragon', 1_280],
  ] as const;

  for (const [kind, subtype, assetId, durationMs] of cases) {
    const markup = renderToStaticMarkup(
      <LordAlphaSprite
        baseUrl="/"
        form="supreme"
        facing="right"
        motion="skill"
        pulse={3}
        eventPulse={7}
        comboBeat="roc"
        event={createLordAlphaPresentationEvent(kind, 0, { subtype })}
      />,
    );
    ok(markup.includes(`data-skill-sprite="${assetId}"`));
    ok(markup.includes(`skins/lord-alpha/skill-sequences/${assetId}.png`));
    ok(markup.includes('data-part="skill-sequence"'));
    ok(markup.includes('data-part="skill-sequence-sheet"'));
    ok(markup.includes('data-frame-count="4"'));
    ok(markup.includes('data-frame-width="240"'));
    ok(markup.includes('data-frame-height="160"'));
    ok(markup.includes(`--lord-alpha-skill-sequence-duration:${durationMs}ms`));
    strictEqual((markup.match(/data-part="roc-wing"/g) ?? []).length, 1);
    ok(!markup.includes('data-part="combo-geometry"'));
    ok(!markup.includes('data-part="web-slinger"'));
    ok(markup.includes('data-wing-mode="deploy"'));
  }
});

test('skill strips advance through all four cells with a discrete held final frame', () => {
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

  ok(markup.includes('@keyframes lord-alpha-skill-sequence-frames'));
  ok(markup.includes('25% { transform: translate3d(-25%, -50%, 0); }'));
  ok(markup.includes('50% { transform: translate3d(-50%, -50%, 0); }'));
  ok(markup.includes('75%, 100% { transform: translate3d(-75%, -50%, 0); }'));
  ok(markup.includes('steps(1, end) both'));
  ok(markup.includes('@media (prefers-reduced-motion: reduce)'));
  ok(markup.includes('animation: none !important;'));
  ok(markup.includes('transform: translate3d(-75%, -50%, 0);'));
  strictEqual((markup.match(/data-part="skill-sequence-sheet"/g) ?? []).length, 1);
  strictEqual((markup.match(/scaleX\(-1\)/g) ?? []).length, 1);
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
  ok(!markup.includes('skins/lord-alpha/skill-sequences/web-shot.png'));
});
