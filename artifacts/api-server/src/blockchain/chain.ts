import { createPublicClient, createWalletClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

export const CHAIN        = baseSepolia;
export const CHAIN_ID     = baseSepolia.id;
export const RPC_URL      = 'https://sepolia.base.org';
export const EXPLORER_URL = 'https://sepolia.basescan.org';

// ── Public read client (no key needed) ───────────────────────────────────────
export const publicClient = createPublicClient({
  chain:     CHAIN,
  transport: http(RPC_URL),
});

// ── Wallet client (requires BLOCKCHAIN_PRIVATE_KEY secret) ───────────────────
function toHex(key: string): `0x${string}` {
  return key.startsWith('0x') ? key as `0x${string}` : `0x${key}`;
}

export function getWalletClient() {
  const raw = process.env.BLOCKCHAIN_PRIVATE_KEY;
  if (!raw) throw new Error('BLOCKCHAIN_PRIVATE_KEY secret is not set');
  const account = privateKeyToAccount(toHex(raw));
  return { client: createWalletClient({ account, chain: CHAIN, transport: http(RPC_URL) }), account };
}

// ── Contract addresses (populated after deploy) ───────────────────────────────
export const ADDRESSES = {
  token:       (process.env.CGRD_TOKEN_ADDRESS       ?? '') as `0x${string}`,
  leaderboard: (process.env.LEADERBOARD_ADDRESS ?? '') as `0x${string}`,
};

export const isConfigured = (): boolean =>
  !!process.env.BLOCKCHAIN_PRIVATE_KEY &&
  !!process.env.CGRD_TOKEN_ADDRESS &&
  !!process.env.LEADERBOARD_ADDRESS;
