export type CampaignObjective = 'restore' | 'discover' | 'survive' | 'purge' | 'stabilize' | 'boss';

export interface CampaignOperation {
  title: string;
  briefing: string;
  objective: CampaignObjective;
}

export interface CampaignAct {
  title: string;
  provinceId: string;
  operations: readonly CampaignOperation[];
}

const op = (title: string, briefing: string, objective: CampaignObjective): CampaignOperation =>
  ({ title, briefing, objective });

export const CAMPAIGN_ACTS: readonly CampaignAct[] = [
  { title: 'ACT I · THE FIRST SIGNAL', provinceId: 'lattice-frontier', operations: [
    op('Awaken the Causeway','Reach the frontier and restore its dormant transit spine.','restore'),
    op('Uncatalogued Motion','Study the organisms nesting beneath the gate.','discover'),
    op('Broken Relay','Hold the causeway while its synchronization returns.','survive'),
    op('The Violet March','Remove the corruption advancing from the eastern road.','purge'),
    op('Gate of Two States','Stabilize restored and corrupted halves of the province.','stabilize'),
    op('Custodian at the Breach','Defeat the organism governing the frontier incursion.','boss'),
  ]},
  { title: 'ACT II · RESONANCE ABOVE', provinceId: 'resonance-highlands', operations: [
    op('Ascent Protocol','Open the mountain transit line and establish a foothold.','restore'),
    op('Crystal Voices','Catalogue organisms communicating through the terraces.','discover'),
    op('Storm Rail','Defend the exposed crossing through the signal storm.','survive'),
    op('Fault Choir','Break the coordinated formations corrupting the highlands.','purge'),
    op('Observatory Alignment','Synchronize the province’s fractured relay towers.','stabilize'),
    op('The Resonant Crown','Confront the entity conducting the mountain network.','boss'),
  ]},
  { title: 'ACT III · THE DROWNED RELAY', provinceId: 'relay-delta', operations: [
    op('Floodgate Zero','Restore the delta’s first defensive lock.','restore'),
    op('Life in the Channels','Discover the organisms adapting to living data-water.','discover'),
    op('High-Water Siege','Protect the quay during a cascading pressure event.','survive'),
    op('Refinery Fever','Purge the infection feeding on thermal infrastructure.','purge'),
    op('Tidal Consensus','Bring the canal districts into synchronized operation.','stabilize'),
    op('Leviathan Process','Eliminate the intelligence controlling the delta current.','boss'),
  ]},
  { title: 'ACT IV · MEMORY HAS ROOTS', provinceId: 'archive-grove', operations: [
    op('The Sealed Archive','Recover access to the grove’s buried memory vault.','restore'),
    op('An Ecology of Records','Research organisms born from abandoned histories.','discover'),
    op('Canopy Blackout','Hold the sanctuary through a total signal eclipse.','survive'),
    op('Rot in the Index','Remove mutations rewriting the archive lineage.','purge'),
    op('Living Catalogue','Reconcile memory growth with the restored network.','stabilize'),
    op('Keeper of Forgotten Forms','Defeat the archive’s self-appointed curator.','boss'),
  ]},
  { title: 'ACT V · MACHINE CIVIL WAR', provinceId: 'thread-foundry', operations: [
    op('Cold Start','Restart fabrication without feeding the entropy furnace.','restore'),
    op('Workers Without Makers','Study the foundry’s independently evolved machines.','discover'),
    op('Assembly Lockdown','Survive the factory’s automated containment cycle.','survive'),
    op('Saboteur Threads','Purge hostile instructions from the production lines.','purge'),
    op('The Viable Machine','Stabilize a manufacturing ecology that can govern itself.','stabilize'),
    op('Forge Sovereign','Defeat the process consuming every manufactured lineage.','boss'),
  ]},
  { title: 'ACT VI · SOVEREIGN NULL', provinceId: 'null-expanse', operations: [
    op('Threshold of Nothing','Establish the last restoration route into the Expanse.','restore'),
    op('Shelters in the Void','Find and catalogue life surviving outside the network.','discover'),
    op('The Long Silence','Endure the sovereign core’s attempt to erase all signals.','survive'),
    op('March of Abhorrence','Purge the accumulated failures guarding the citadel.','purge'),
    op('Civilization Equation','Synchronize every restored province into one system.','stabilize'),
    op('The Sovereign Core','Resolve whether the living network can govern its own future.','boss'),
  ]},
];

// Five verified eliminations currently constitute one combat wave. Twenty
// encounter waves per operation gives each story objective room to develop,
// escalate and culminate instead of disappearing after a few attacks.
export const ENCOUNTERS_PER_OPERATION = 20;
export const OPERATIONS_PER_ACT = 6;
export const TOTAL_CAMPAIGN_ENCOUNTERS =
  CAMPAIGN_ACTS.length * OPERATIONS_PER_ACT * ENCOUNTERS_PER_OPERATION;

export interface CampaignProgress {
  actIndex: number;
  operationIndex: number;
  encounterIndex: number;
  act: CampaignAct;
  operation: CampaignOperation;
  provinceIndex: number;
  complete: boolean;
  overallProgress: number;
}

export function resolveCampaignProgress(wave: number): CampaignProgress {
  const encounter = Math.max(0, wave - 1);
  const complete = encounter >= TOTAL_CAMPAIGN_ENCOUNTERS;
  const bounded = Math.min(TOTAL_CAMPAIGN_ENCOUNTERS - 1, encounter);
  const operationAbsolute = Math.floor(bounded / ENCOUNTERS_PER_OPERATION);
  const actIndex = Math.floor(operationAbsolute / OPERATIONS_PER_ACT);
  const operationIndex = operationAbsolute % OPERATIONS_PER_ACT;
  return {
    actIndex,
    operationIndex,
    encounterIndex: bounded % ENCOUNTERS_PER_OPERATION,
    act: CAMPAIGN_ACTS[actIndex],
    operation: CAMPAIGN_ACTS[actIndex].operations[operationIndex],
    provinceIndex: actIndex,
    complete,
    overallProgress: Math.min(1, encounter / TOTAL_CAMPAIGN_ENCOUNTERS),
  };
}
