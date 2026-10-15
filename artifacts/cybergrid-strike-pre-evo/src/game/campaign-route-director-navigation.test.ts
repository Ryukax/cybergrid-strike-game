import { deepStrictEqual } from 'node:assert/strict';
import { test } from 'node:test';

import { resolveCampaignRouteTraversal } from './campaign-route-director';

test('a first route choice starts from the current combat wave', () => {
  deepStrictEqual(
    resolveCampaignRouteTraversal(null, 8, 'next', 'top'),
    {
      fromSegment: 8,
      toSegment: 9,
      direction: 'next',
      lane: 'top',
    },
  );

  deepStrictEqual(
    resolveCampaignRouteTraversal(null, 8, 'last', 'bottom'),
    {
      fromSegment: 8,
      toSegment: 7,
      direction: 'last',
      lane: 'bottom',
    },
  );
});

test('LAST never traverses below world segment one', () => {
  deepStrictEqual(
    resolveCampaignRouteTraversal(null, 1, 'last', 'middle'),
    {
      fromSegment: 1,
      toSegment: 1,
      direction: 'last',
      lane: 'middle',
    },
  );

  deepStrictEqual(
    resolveCampaignRouteTraversal(1, 99, 'last', 'top'),
    {
      fromSegment: 1,
      toSegment: 1,
      direction: 'last',
      lane: 'top',
    },
  );
});

test('subsequent choices advance from the previous route segment despite combat-wave drift', () => {
  const forward = resolveCampaignRouteTraversal(4, 40, 'next', 'bottom');
  deepStrictEqual(forward, {
    fromSegment: 4,
    toSegment: 5,
    direction: 'next',
    lane: 'bottom',
  });

  deepStrictEqual(
    resolveCampaignRouteTraversal(forward.toSegment, 91, 'last', 'middle'),
    {
      fromSegment: 5,
      toSegment: 4,
      direction: 'last',
      lane: 'middle',
    },
  );
});
