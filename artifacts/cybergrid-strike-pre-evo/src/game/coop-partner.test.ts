import { equal, throws } from 'node:assert/strict';
import { test } from 'node:test';

import {
  COOP_PARTNER_PAIR_OFFSET_CELLS,
  COOP_PARTNER_SKIN_KEY,
  resolveCoopPartnerVisualCell,
  resolveStoredCoopPartnerSkin,
} from './coop-partner';

const skins = ['default', 'lord-alpha', 'chrono'] as const;

test('co-op partner choice owns a separate stable persistence key', () => {
  equal(COOP_PARTNER_SKIN_KEY, 'cgs_coop_partner_skin');
});

test('a valid saved co-op partner remains selected', () => {
  equal(resolveStoredCoopPartnerSkin('chrono', skins, 'default'), 'chrono');
  equal(resolveStoredCoopPartnerSkin('lord-alpha', skins, 'default'), 'lord-alpha');
});

test('missing, empty, or stale partner values use the explicit fallback', () => {
  equal(resolveStoredCoopPartnerSkin(null, skins, 'default'), 'default');
  equal(resolveStoredCoopPartnerSkin(undefined, skins, 'default'), 'default');
  equal(resolveStoredCoopPartnerSkin('', skins, 'default'), 'default');
  equal(resolveStoredCoopPartnerSkin('retired-skin', skins, 'default'), 'default');
});

test('an invalid fallback fails loudly instead of creating an unavailable partner', () => {
  throws(
    () => resolveStoredCoopPartnerSkin('chrono', skins, 'missing' as never),
    /fallback must exist/i,
  );
});

test('shared-cell partner placement mirrors the player offset without changing scale', () => {
  equal(COOP_PARTNER_PAIR_OFFSET_CELLS, 0.13);
  const placed = resolveCoopPartnerVisualCell(
    { col: 1, row: 1 },
    { playerX: -1, playerY: 1 },
  );
  equal(placed.col, 1.13);
  equal(placed.row, 0.87);
  const unpaired = resolveCoopPartnerVisualCell({ col: 2, row: 0 }, null);
  equal(unpaired.col, 2);
  equal(unpaired.row, 0);
});
