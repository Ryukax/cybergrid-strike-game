import { randomUUID } from "node:crypto";
import { Router } from "express";
import {
  addSpecimen,
  applyIntegrityWork,
  applyNeglect,
  createEmptyInventory,
  deriveGenome,
  integrityWorkForGenome,
  meritRank,
  type Genome,
  type IntegrityState,
  type IntegrityWork,
  type Inventory,
  type WorkKind,
} from "@workspace/ecosystem";

const router = Router();
const ENCOUNTER_TTL_MS = 15 * 60_000;
const MAX_ENCOUNTER_ACTIONS = 500;

interface EncounterVirus {
  id: string;
  genome: Genome;
  remainingVitality: number;
  neutralized: boolean;
}

interface Encounter {
  id: string;
  playerId: string;
  sectorId: string;
  nodeId: string;
  issuedAt: number;
  expiresAt: number;
  actions: number;
  viruses: Map<string, EncounterVirus>;
}

interface PlayerRecord {
  verifiedWork: number;
  work: IntegrityWork[];
  inventory: Inventory;
}

const encounters = new Map<string, Encounter>();
const players = new Map<string, PlayerRecord>();
const PRESENCE_TTL_MS = 30_000;
const CORE_MIN = 0;
const CORE_MAX = 1_000;
interface PresenceRecord {
  lastSeen: number;
  integrityWork: number;
  nodeIntegrity: number;
}
const presence = new Map<string, PresenceRecord>();
let coreUnits = 540;
let integrity: IntegrityState = {
  global: 62,
  sectors: {},
  nodes: {},
};

const cleanPresence = (now = Date.now()) => {
  for (const [sessionId, record] of presence) {
    if (now - record.lastSeen > PRESENCE_TTL_MS) presence.delete(sessionId);
  }
};

const presenceSnapshot = (coreDelta = 0) => {
  cleanPresence();
  return {
    activePlayers: presence.size,
    coreUnits,
    coreDelta,
    sampledAt: new Date().toISOString(),
  };
};

const playerRecord = (playerId: string): PlayerRecord => {
  const existing = players.get(playerId);
  if (existing) return existing;
  const created = { verifiedWork: 0, work: [], inventory: createEmptyInventory() };
  players.set(playerId, created);
  return created;
};

const publicGenome = (genome: Genome) => ({
  ...genome,
  seed: undefined,
});

router.get("/ecosystem/integrity", (_req, res) => {
  res.json({ integrity });
});

router.get("/ecosystem/presence", (_req, res) => {
  res.json(presenceSnapshot());
});

router.post("/ecosystem/presence/heartbeat", (req, res) => {
  const { sessionId, metrics } = req.body as {
    sessionId?: string;
    metrics?: { integrityWork?: number; nodeIntegrity?: number; wave?: number };
  };
  if (!sessionId || sessionId.length > 128 || !metrics) {
    res.status(400).json({ error: "A valid sessionId and metrics sample are required" });
    return;
  }
  const integrityWork = Number(metrics.integrityWork);
  const nodeIntegrity = Number(metrics.nodeIntegrity);
  const wave = Number(metrics.wave);
  if (
    !Number.isFinite(integrityWork) || integrityWork < 0
    || !Number.isFinite(nodeIntegrity) || nodeIntegrity < 0 || nodeIntegrity > 100
    || !Number.isFinite(wave) || wave < 1
  ) {
    res.status(400).json({ error: "Presence metrics are outside the accepted envelope" });
    return;
  }

  const now = Date.now();
  cleanPresence(now);
  const previous = presence.get(sessionId);
  let coreDelta = 0;
  if (previous) {
    // A heartbeat can only move the shared artifact by a small bounded amount.
    // Positive verified work adds cells; lost node integrity removes them.
    const workGain = Math.max(0, Math.min(250, integrityWork - previous.integrityWork));
    const integrityChange = Math.max(-10, Math.min(10, nodeIntegrity - previous.nodeIntegrity));
    coreDelta = Math.max(-16, Math.min(16, Math.floor(workGain / 25) + Math.round(integrityChange * 1.5)));
    coreUnits = Math.max(CORE_MIN, Math.min(CORE_MAX, coreUnits + coreDelta));
  }
  presence.set(sessionId, { lastSeen: now, integrityWork, nodeIntegrity });
  res.json(presenceSnapshot(coreDelta));
});

router.delete("/ecosystem/presence/:sessionId", (req, res) => {
  presence.delete(req.params.sessionId);
  res.json(presenceSnapshot());
});

router.get("/ecosystem/player/:playerId", (req, res) => {
  const player = playerRecord(req.params.playerId);
  res.json({
    verifiedWork: player.verifiedWork,
    merit: meritRank(player.verifiedWork),
    inventory: player.inventory,
  });
});

router.post("/ecosystem/encounters", (req, res) => {
  const { playerId, sectorId, nodeId, count = 6 } = req.body as {
    playerId?: string;
    sectorId?: string;
    nodeId?: string;
    count?: number;
  };
  if (!playerId || !sectorId || !nodeId) {
    res.status(400).json({ error: "playerId, sectorId, and nodeId are required" });
    return;
  }

  const safeCount = Math.max(1, Math.min(24, Math.floor(count)));
  const id = randomUUID();
  const issuedAt = Date.now();
  const viruses = new Map<string, EncounterVirus>();
  for (let index = 0; index < safeCount; index += 1) {
    const virusId = randomUUID();
    const genome = deriveGenome(`${id}:${sectorId}:${nodeId}:${index}`);
    viruses.set(virusId, {
      id: virusId,
      genome,
      remainingVitality: genome.constitution.vitality,
      neutralized: false,
    });
  }
  const encounter: Encounter = {
    id,
    playerId,
    sectorId,
    nodeId,
    issuedAt,
    expiresAt: issuedAt + ENCOUNTER_TTL_MS,
    actions: 0,
    viruses,
  };
  encounters.set(id, encounter);
  res.status(201).json({
    encounterId: id,
    sectorId,
    nodeId,
    expiresAt: new Date(encounter.expiresAt).toISOString(),
    viruses: [...viruses.values()].map((virus) => ({
      id: virus.id,
      genome: publicGenome(virus.genome),
      vitality: virus.remainingVitality,
    })),
  });
});

router.post("/ecosystem/encounters/:encounterId/actions", (req, res) => {
  const encounter = encounters.get(req.params.encounterId);
  if (!encounter || encounter.expiresAt < Date.now()) {
    res.status(404).json({ error: "Encounter not found or expired" });
    return;
  }
  if (encounter.actions >= MAX_ENCOUNTER_ACTIONS) {
    res.status(429).json({ error: "Encounter action limit reached" });
    return;
  }

  const { playerId, virusId, damage, kind = "corruption_removed" } = req.body as {
    playerId?: string;
    virusId?: string;
    damage?: number;
    kind?: WorkKind;
  };
  const virus = virusId ? encounter.viruses.get(virusId) : undefined;
  if (playerId !== encounter.playerId || !virus || virus.neutralized) {
    res.status(400).json({ error: "Invalid player or virus" });
    return;
  }
  if (!Number.isFinite(damage) || damage! <= 0 || damage! > 12) {
    res.status(400).json({ error: "Damage is outside the authoritative action envelope" });
    return;
  }

  encounter.actions += 1;
  const appliedDamage = Math.min(virus.remainingVitality, Math.floor(damage!));
  virus.remainingVitality -= appliedDamage;
  if (virus.remainingVitality > 0) {
    res.json({ verified: true, neutralized: false, remainingVitality: virus.remainingVitality });
    return;
  }

  virus.neutralized = true;
  const quality = Math.max(0.25, 1 - encounter.actions / MAX_ENCOUNTER_ACTIONS);
  const amount = integrityWorkForGenome(virus.genome, quality);
  const work: IntegrityWork = {
    id: randomUUID(),
    playerId,
    encounterId: encounter.id,
    kind,
    amount,
    quality,
    sectorId: encounter.sectorId,
    nodeId: encounter.nodeId,
    recordedAt: new Date().toISOString(),
  };
  const player = playerRecord(playerId);
  player.verifiedWork += amount;
  player.work.push(work);
  player.inventory = addSpecimen(player.inventory, virus.genome, work.recordedAt);
  integrity = applyIntegrityWork(integrity, work);

  res.json({
    verified: true,
    neutralized: true,
    integrityWork: work,
    integrity,
    merit: meritRank(player.verifiedWork),
    classification: virus.genome.classification,
    classificationShards: 1,
    researchAdded: 1 + virus.genome.mutation.depth,
  });
});

router.post("/ecosystem/encounters/:encounterId/expire", (req, res) => {
  const encounter = encounters.get(req.params.encounterId);
  if (!encounter) {
    res.status(404).json({ error: "Encounter not found" });
    return;
  }
  for (const virus of encounter.viruses.values()) {
    if (!virus.neutralized) {
      integrity = applyNeglect(
        integrity,
        encounter.sectorId,
        encounter.nodeId,
        virus.genome.metrics.corruptionPotential,
      );
    }
  }
  encounters.delete(encounter.id);
  res.json({ integrity });
});

export default router;
