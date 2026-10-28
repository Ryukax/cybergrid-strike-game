export interface PresenceSnapshot {
  activePlayers: number;
  coreUnits: number;
  coreDelta: number;
  sampledAt: string;
  serverTimeMs: number;
  timeline: ConstructTimelineEvent[];
  receivedAtMs: number;
  systemIntegrity: { global: number; sector: number; node: number };
  synchronization: number;
}

export interface ConstructTimelineEvent {
  sequence: number;
  startsAtMs: number;
  durationMs: number;
  fromUnits: number;
  toUnits: number;
  delta: number;
}

interface MatchMetricSample {
  integrityWork: number;
  globalIntegrity: number;
  sectorIntegrity: number;
  nodeIntegrity: number;
  wave: number;
}

const SESSION_KEY = 'cgs_presence_session_v1';
let memorySessionId: string | null = null;

function presenceApiBase(): string | null {
  const configured = import.meta.env.VITE_ECOSYSTEM_API as string | undefined;
  return configured?.replace(/\/$/, '') ?? null;
}

function readStoredSessionId(): string | null {
  try {
    return globalThis.sessionStorage?.getItem(SESSION_KEY) ?? null;
  } catch {
    return null;
  }
}

function storeSessionId(value: string): void {
  try {
    globalThis.sessionStorage?.setItem(SESSION_KEY, value);
  } catch {
    // Safari may deny storage in private, restricted, or standalone contexts.
  }
}

function createSessionId(): string {
  try {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    // randomUUID can be unavailable on a plain-HTTP LAN origin.
  }

  try {
    if (typeof globalThis.crypto?.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      globalThis.crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  } catch {
    // Fall through to a non-cryptographic, per-tab identifier.
  }

  return `cgs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function sessionId(): string {
  if (memorySessionId) return memorySessionId;
  const existing = readStoredSessionId();
  if (existing) {
    memorySessionId = existing;
    return existing;
  }
  memorySessionId = createSessionId();
  storeSessionId(memorySessionId);
  return memorySessionId;
}

export async function heartbeatPresence(metrics: MatchMetricSample): Promise<PresenceSnapshot | null> {
  const base = presenceApiBase();
  if (!base) return null;
  const response = await fetch(`${base}/ecosystem/presence/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: sessionId(), metrics }),
  });
  if (!response.ok) throw new Error(`Presence heartbeat failed: HTTP ${response.status}`);
  const snapshot = await response.json() as Omit<PresenceSnapshot, 'receivedAtMs'>;
  return { ...snapshot, receivedAtMs: Date.now() };
}

export async function readPresence(): Promise<PresenceSnapshot | null> {
  const base = presenceApiBase();
  if (!base) return null;
  const response = await fetch(`${base}/ecosystem/presence`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Presence read failed: HTTP ${response.status}`);
  const snapshot = await response.json() as Omit<PresenceSnapshot, 'receivedAtMs'>;
  return { ...snapshot, receivedAtMs: Date.now() };
}

export async function leavePresence(): Promise<void> {
  const base = presenceApiBase();
  const id = memorySessionId ?? readStoredSessionId();
  if (!base || !id) return;
  await fetch(`${base}/ecosystem/presence/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    keepalive: true,
  });
}
