export interface PresenceSnapshot {
  activePlayers: number;
  coreUnits: number;
  coreDelta: number;
  sampledAt: string;
}

interface MatchMetricSample {
  integrityWork: number;
  nodeIntegrity: number;
  wave: number;
}

const SESSION_KEY = 'cgs_presence_session_v1';

function presenceApiBase(): string | null {
  const configured = import.meta.env.VITE_ECOSYSTEM_API as string | undefined;
  return configured?.replace(/\/$/, '') ?? null;
}

function sessionId(): string {
  const existing = sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  sessionStorage.setItem(SESSION_KEY, created);
  return created;
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
  return response.json() as Promise<PresenceSnapshot>;
}

export async function leavePresence(): Promise<void> {
  const base = presenceApiBase();
  const id = sessionStorage.getItem(SESSION_KEY);
  if (!base || !id) return;
  await fetch(`${base}/ecosystem/presence/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    keepalive: true,
  });
}
