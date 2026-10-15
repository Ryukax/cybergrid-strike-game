import { equal, ok } from 'node:assert/strict';
import { test } from 'node:test';

import { resolveActionFighterX } from './ActionCinematic';

test('Action Window preserves three visibly distinct columns per fighter', () => {
  const player = [0, 1, 2].map((column) => resolveActionFighterX('player', column));
  const npc = [0, 1, 2].map((column) => resolveActionFighterX('npc', column));

  ok(player[1] - player[0] >= 0.05);
  ok(player[2] - player[1] >= 0.05);
  ok(npc[1] - npc[0] >= 0.05);
  ok(npc[2] - npc[1] >= 0.05);
  ok(player[2] < npc[0], 'the two grid halves must remain visually separated');
});

test('Action Window fighter columns clamp to their local three-column grid', () => {
  equal(resolveActionFighterX('player', -9), resolveActionFighterX('player', 0));
  equal(resolveActionFighterX('npc', 9), resolveActionFighterX('npc', 2));
});
