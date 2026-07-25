import { Router } from 'express';
import { publicClient, getWalletClient, ADDRESSES, CHAIN, EXPLORER_URL, isConfigured } from '../blockchain/chain.js';
import { CGRD_TOKEN_ABI, LEADERBOARD_ABI } from '../blockchain/abi.js';
import { totalTokens, toWei, getVirusTokenValue } from '../blockchain/token-value.js';
import { logger } from '../lib/logger.js';

const router = Router();

// ── GET /api/blockchain/config ─────────────────────────────────────────────
// Returns chain info and contract addresses for the frontend to use.
router.get('/blockchain/config', (_req, res) => {
  res.json({
    configured: isConfigured(),
    chainId:    CHAIN.id,
    chainName:  CHAIN.name,
    explorer:   EXPLORER_URL,
    contracts: {
      token:       ADDRESSES.token       || null,
      leaderboard: ADDRESSES.leaderboard || null,
    },
    tokenSymbol:   'CGRD',
    tokenDecimals: 18,
  });
});

// ── GET /api/blockchain/leaderboard ────────────────────────────────────────
// Reads top-10 entries from the on-chain leaderboard.
router.get('/blockchain/leaderboard', async (_req, res) => {
  if (!isConfigured() || !ADDRESSES.leaderboard) {
    res.json({ entries: [], configured: false });
    return;
  }
  try {
    const raw = await publicClient.readContract({
      address:  ADDRESSES.leaderboard,
      abi:      LEADERBOARD_ABI,
      functionName: 'getLeaderboard',
    }) as readonly { player: string; score: bigint; wave: number; timestamp: number }[];

    const entryCount = await publicClient.readContract({
      address: ADDRESSES.leaderboard,
      abi: LEADERBOARD_ABI,
      functionName: 'entryCount',
    }) as bigint;

    const filled = Number(entryCount);
    const entries = Array.from(raw)
      .slice(0, filled)
      .filter(e => e.player !== '0x0000000000000000000000000000000000000000')
      .map(e => ({
        player:    e.player,
        score:     Number(e.score),
        wave:      Number(e.wave),
        timestamp: Number(e.timestamp),
      }));

    res.json({ entries, configured: true });
  } catch (err) {
    logger.error({ err }, 'leaderboard read failed');
    res.status(500).json({ error: 'Failed to read leaderboard' });
  }
});

// ── POST /api/blockchain/claim ─────────────────────────────────────────────
// Mints CGRD to a player address based on their reported kills.
// Body: { address: string, kills: Array<{ value: number }> }
router.post('/blockchain/claim', async (req, res) => {
  const { address, kills } = req.body as { address?: string; kills?: { value: number }[] };

  if (!address || typeof address !== 'string' || !address.match(/^0x[0-9a-fA-F]{40}$/)) {
    res.status(400).json({ error: 'Invalid address' });
    return;
  }
  if (!Array.isArray(kills) || kills.length === 0) {
    res.status(400).json({ error: 'No kills provided' });
    return;
  }

  // Cap per-session claim to prevent abuse (testnet safeguard)
  const MAX_KILLS_PER_CLAIM = 500;
  const safeKills = kills.slice(0, MAX_KILLS_PER_CLAIM);
  const cgrdAmount = totalTokens(safeKills);

  if (!isConfigured() || !ADDRESSES.token) {
    // Mock mode: return what would have been minted without hitting chain
    res.json({
      mock:       true,
      cgrdAmount,
      txHash:     null,
      message:    'Blockchain not configured — run the deploy script to go live.',
    });
    return;
  }

  try {
    const { client, account } = getWalletClient();
    const amountWei = toWei(cgrdAmount);

    const hash = await client.writeContract({
      account,
      address:      ADDRESSES.token,
      abi:          CGRD_TOKEN_ABI,
      functionName: 'mint',
      args:         [address as `0x${string}`, amountWei],
    });

    logger.info({ address, cgrdAmount, hash }, 'CGRD minted');
    res.json({
      mock:       false,
      cgrdAmount,
      txHash:     hash,
      explorerUrl: `${EXPLORER_URL}/tx/${hash}`,
    });
  } catch (err) {
    logger.error({ err }, 'mint failed');
    res.status(500).json({ error: 'Mint transaction failed' });
  }
});

// ── POST /api/blockchain/score ─────────────────────────────────────────────
// Submits a score to the on-chain leaderboard.
// Body: { address: string, score: number, wave: number }
router.post('/blockchain/score', async (req, res) => {
  const { address, score, wave } = req.body as {
    address?: string; score?: number; wave?: number;
  };

  if (!address?.match(/^0x[0-9a-fA-F]{40}$/) || !score || !wave) {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }

  if (!isConfigured() || !ADDRESSES.leaderboard) {
    res.json({ mock: true, rank: -1, message: 'Blockchain not configured' });
    return;
  }

  try {
    const { client, account } = getWalletClient();

    const hash = await client.writeContract({
      account,
      address:      ADDRESSES.leaderboard,
      abi:          LEADERBOARD_ABI,
      functionName: 'submit',
      args:         [address as `0x${string}`, BigInt(score), wave],
    });

    logger.info({ address, score, wave, hash }, 'score submitted');
    res.json({ mock: false, txHash: hash, explorerUrl: `${EXPLORER_URL}/tx/${hash}` });
  } catch (err) {
    logger.error({ err }, 'score submit failed');
    res.status(500).json({ error: 'Score submission failed' });
  }
});

// ── GET /api/blockchain/value/:n ───────────────────────────────────────────
// Returns the CGRD value for a specific virus integer (for UI previews).
router.get('/blockchain/value/:n', (req, res) => {
  const n = parseInt(req.params.n, 10);
  if (isNaN(n) || n < 1 || n > 255) {
    res.status(400).json({ error: 'n must be 1–255' });
    return;
  }
  res.json({ virusValue: n, cgrdReward: getVirusTokenValue(n) });
});

export default router;
