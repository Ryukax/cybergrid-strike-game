/**
 * Deploy CyberGridToken + CyberGridLeaderboard to Base Sepolia.
 *
 * Prerequisites:
 *   1. Set BLOCKCHAIN_PRIVATE_KEY secret (the deployer wallet private key).
 *   2. Fund the deployer wallet with Base Sepolia ETH:
 *      https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet
 *   3. Run:  pnpm --filter @workspace/api-server run deploy
 *
 * After deployment, set two more secrets:
 *   CGRD_TOKEN_ADDRESS       = <printed below>
 *   LEADERBOARD_ADDRESS = <printed below>
 */

import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { TOKEN_BYTECODE, LEADERBOARD_BYTECODE } from '../src/blockchain/abi.js';

const RPC_URL     = 'https://sepolia.base.org';
const EXPLORER    = 'https://sepolia.basescan.org';

const rawKey = process.env.BLOCKCHAIN_PRIVATE_KEY;
if (!rawKey) {
  console.error('ERROR: BLOCKCHAIN_PRIVATE_KEY secret is not set.');
  process.exit(1);
}

const key     = rawKey.startsWith('0x') ? rawKey as `0x${string}` : `0x${rawKey}` as `0x${string}`;
const account = privateKeyToAccount(key);

const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(RPC_URL) });
const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });

async function deploy(name: string, bytecode: `0x${string}`): Promise<`0x${string}`> {
  console.log(`\nDeploying ${name}...`);
  const hash = await walletClient.deployContract({ abi: [], bytecode, account });
  console.log(`  tx: ${EXPLORER}/tx/${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) throw new Error(`${name} deployment failed — no contract address`);
  console.log(`  address: ${receipt.contractAddress}`);
  return receipt.contractAddress;
}

(async () => {
  console.log(`Deployer: ${account.address}`);
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Balance:  ${Number(balance) / 1e18} ETH`);
  if (balance < 1_000_000_000_000_000n) {
    console.warn('WARNING: Low balance — fund at https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet');
  }

  const tokenAddr       = await deploy('CyberGridToken',       TOKEN_BYTECODE);
  const leaderboardAddr = await deploy('CyberGridLeaderboard', LEADERBOARD_BYTECODE);

  console.log('\n✅ Deployment complete. Set these secrets:\n');
  console.log(`  CGRD_TOKEN_ADDRESS       = ${tokenAddr}`);
  console.log(`  LEADERBOARD_ADDRESS = ${leaderboardAddr}`);
  console.log('\nThen restart the API Server workflow.');
})().catch(err => { console.error(err); process.exit(1); });
