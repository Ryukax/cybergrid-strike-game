/**
 * Minimal wallet connection using window.ethereum (MetaMask / Coinbase Wallet).
 * No heavy library dependency — just the EIP-1193 provider API.
 */

import { createPublicClient, http, formatUnits } from 'viem';
import { baseSepolia } from 'viem/chains';

export const BASE_SEPOLIA_CHAIN_ID = baseSepolia.id; // 84532
export const BASE_SEPOLIA_HEX      = `0x${BASE_SEPOLIA_CHAIN_ID.toString(16)}`;

// ── Public read client (no wallet needed) ────────────────────────────────────
const publicClient = createPublicClient({
  chain:     baseSepolia,
  transport: http('https://sepolia.base.org'),
});

export type WalletState =
  | { status: 'disconnected' }
  | { status: 'connecting' }
  | { status: 'connected'; address: string }
  | { status: 'error'; message: string };

function getProvider(): any {
  if (typeof window === 'undefined') return null;
  return (window as any).ethereum ?? null;
}

/** Returns true when MetaMask / Coinbase Wallet is detected. */
export function isWalletAvailable(): boolean {
  return !!getProvider();
}

/** Switch the wallet to Base Sepolia, adding it if necessary. */
async function ensureBaseSepolia(): Promise<void> {
  const provider = getProvider();
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BASE_SEPOLIA_HEX }],
    });
  } catch (err: any) {
    if (err.code === 4902) {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId:         BASE_SEPOLIA_HEX,
          chainName:       'Base Sepolia',
          nativeCurrency:  { name: 'Ether', symbol: 'ETH', decimals: 18 },
          rpcUrls:         ['https://sepolia.base.org'],
          blockExplorerUrls: ['https://sepolia.basescan.org'],
        }],
      });
    } else {
      throw err;
    }
  }
}

/** Connect wallet and return the selected address. */
export async function connectWallet(): Promise<string> {
  const provider = getProvider();
  if (!provider) throw new Error('No wallet detected. Install MetaMask or Coinbase Wallet.');

  const accounts: string[] = await provider.request({ method: 'eth_requestAccounts' });
  if (!accounts.length) throw new Error('No accounts returned');

  await ensureBaseSepolia();
  return accounts[0];
}

/** Read the connected address without prompting (returns null if disconnected). */
export async function getConnectedAddress(): Promise<string | null> {
  const provider = getProvider();
  if (!provider) return null;
  try {
    const accounts: string[] = await provider.request({ method: 'eth_accounts' });
    return accounts[0] ?? null;
  } catch {
    return null;
  }
}

/** Read on-chain CGRD balance for an address. Returns display string like "42.00". */
export async function getCGRDBalance(
  tokenAddress: string,
  holderAddress: string,
): Promise<string> {
  if (!tokenAddress || tokenAddress === '0x0') return '0';
  try {
    const raw = await publicClient.readContract({
      address:      tokenAddress as `0x${string}`,
      abi:          [{ inputs: [{ name: '', type: 'address' }], name: 'balanceOf', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' }],
      functionName: 'balanceOf',
      args:         [holderAddress as `0x${string}`],
    }) as bigint;
    return parseFloat(formatUnits(raw, 18)).toFixed(2);
  } catch {
    return '—';
  }
}
