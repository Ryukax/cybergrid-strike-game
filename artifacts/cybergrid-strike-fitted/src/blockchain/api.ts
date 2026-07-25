/**
 * Fetch helpers for the blockchain API routes exposed by the API Server artifact.
 */

import type { KillRecord } from './rewards';

// The API server is a separate Replit artifact. In the proxied dev environment
// it lives at the same origin under /api-server. Set VITE_BLOCKCHAIN_API to
// override (e.g. when testing with a standalone backend).
function apiBase(): string {
  return (import.meta.env.VITE_BLOCKCHAIN_API as string | undefined)
    ?? `${typeof window !== 'undefined' ? window.location.origin : ''}/api-server/api`;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface BlockchainConfig {
  configured:    boolean;
  chainId:       number;
  chainName:     string;
  explorer:      string;
  contracts:     { token: string | null; leaderboard: string | null };
  tokenSymbol:   string;
  tokenDecimals: number;
}

export interface ClaimResult {
  mock:        boolean;
  cgrdAmount:  number;
  txHash:      string | null;
  explorerUrl?: string;
  message?:    string;
}

export interface ScoreResult {
  mock:        boolean;
  txHash:      string | null;
  explorerUrl?: string;
}

export interface LeaderboardEntry {
  player:    string;
  score:     number;
  wave:      number;
  timestamp: number;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function getBlockchainConfig(): Promise<BlockchainConfig> {
  return get('/blockchain/config');
}

export async function fetchLeaderboard(): Promise<{ entries: LeaderboardEntry[]; configured: boolean }> {
  return get('/blockchain/leaderboard');
}

/** Sends kill list to backend; backend mints CGRD to the player's address. */
export async function claimRewards(
  address: string,
  kills: KillRecord[],
): Promise<ClaimResult> {
  return post('/blockchain/claim', { address, kills });
}

/** Submits a final score to the on-chain leaderboard. */
export async function submitScore(
  address: string,
  score:   number,
  wave:    number,
): Promise<ScoreResult> {
  return post('/blockchain/score', { address, score, wave });
}
