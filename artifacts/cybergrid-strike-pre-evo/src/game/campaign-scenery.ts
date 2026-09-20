export interface CampaignBiome {
  id: string;
  label: string;
  sky: string;
  ground: string;
  restored: string;
  corrupted: string;
  profile: 'wetland' | 'garden' | 'city' | 'range' | 'foundry' | 'void';
}

export const CAMPAIGN_BIOMES: CampaignBiome[] = [
  ['signal-wetland','SIGNAL WETLAND','#123f58','#092c3d','#58e6d2','#9b315c','wetland'],
  ['lattice-garden','LATTICE GARDEN','#173d4b','#12382f','#8df0bd','#8e315f','garden'],
  ['crystal-marsh','CRYSTAL MARSH','#253b61','#152e45','#7de5ff','#a13272','wetland'],
  ['relay-delta','RELAY DELTA','#16465a','#143845','#6ee7d5','#a53b62','wetland'],
  ['archive-grove','ARCHIVE GROVE','#254551','#163d32','#a7f3d0','#8b3569','garden'],
  ['cipher-orchard','CIPHER ORCHARD','#2a4250','#213d31','#c3f38b','#96395d','garden'],
  ['memory-steppe','MEMORY STEPPE','#4b5160','#303d43','#f1d78a','#a43e5c','range'],
  ['packet-canyon','PACKET CANYON','#504458','#342d3c','#f4b982','#a63560','range'],
  ['vector-highlands','VECTOR HIGHLANDS','#344f62','#263844','#9dd9ef','#9b3564','range'],
  ['resonance-range','RESONANCE RANGE','#3a4264','#292f4a','#c4b5fd','#a13b68','range'],
  ['protocol-quarter','PROTOCOL QUARTER','#243d56','#172a3b','#7dd3fc','#9c365f','city'],
  ['kernel-borough','KERNEL BOROUGH','#293d4b','#1d2b34','#93e9d3','#a13c5f','city'],
  ['checksum-citadel','CHECKSUM CITADEL','#2e3f57','#1a293b','#f6d889','#9b355f','city'],
  ['mirror-arcology','MIRROR ARCOLOGY','#30475e','#202f42','#a5e6ff','#a93c69','city'],
  ['thread-foundry','THREAD FOUNDRY','#4a3c48','#30272d','#ffbd75','#b23558','foundry'],
  ['hash-forge','HASH FORGE','#50383f','#32252a','#ff9f69','#ad3158','foundry'],
  ['compiler-works','COMPILER WORKS','#3e404b','#292b32','#f5c98c','#a9355d','foundry'],
  ['machine-nursery','MACHINE NURSERY','#354852','#24343a','#82e6ca','#a33864','foundry'],
  ['phase-shore','PHASE SHORE','#292f55','#171b3b','#a5b4fc','#a02f76','void'],
  ['entropy-basin','ENTROPY BASIN','#3b2745','#25162f','#d8b4fe','#bd2e68','void'],
  ['radiant-threshold','RADIANT THRESHOLD','#45466a','#292a47','#fde68a','#a93668','void'],
  ['null-expanse','NULL EXPANSE','#23243b','#11121f','#94a3b8','#c02b65','void'],
  ['breach-frontier','BREACH FRONTIER','#432c41','#241828','#f0a6d2','#d22962','void'],
  ['sovereign-core','SOVEREIGN CORE','#28465a','#162e3d','#7ff7d4','#a52e62','city'],
].map(([id,label,sky,ground,restored,corrupted,profile]) => ({
  id, label, sky, ground, restored, corrupted,
  profile: profile as CampaignBiome['profile'],
}));

export function resolveCampaignBiome(global: number, wave: number): CampaignBiome {
  const integrityBand = Math.max(0, Math.min(3, Math.floor(global / 25)));
  const progression = Math.max(0, wave - 1);
  const index = (progression * 5 + integrityBand * 7) % CAMPAIGN_BIOMES.length;
  return CAMPAIGN_BIOMES[index];
}
