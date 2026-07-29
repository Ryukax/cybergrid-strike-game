import { Router } from "express";
import {
  ADDRESSES,
  CHAIN,
  EXPLORER_URL,
  isConfigured,
  publicClient,
} from "../blockchain/chain.js";
import { LEADERBOARD_ABI } from "../blockchain/abi.js";
import { getVirusTokenValue } from "../blockchain/token-value.js";
import { logger } from "../lib/logger.js";

const router = Router();

router.get("/blockchain/config", (_req, res) => {
  res.json({
    configured: isConfigured(),
    chainId: CHAIN.id,
    chainName: CHAIN.name,
    explorer: EXPLORER_URL,
    contracts: {
      token: ADDRESSES.token || null,
      leaderboard: ADDRESSES.leaderboard || null,
    },
    tokenSymbol: "CGRD",
    tokenDecimals: 18,
    rewardAuthority: "verified-integrity-work",
  });
});

router.get("/blockchain/leaderboard", async (_req, res) => {
  if (!isConfigured() || !ADDRESSES.leaderboard) {
    res.json({ entries: [], configured: false });
    return;
  }
  try {
    const raw = await publicClient.readContract({
      address: ADDRESSES.leaderboard,
      abi: LEADERBOARD_ABI,
      functionName: "getLeaderboard",
    }) as readonly {
      player: string;
      score: bigint;
      wave: number;
      timestamp: number;
    }[];
    const entryCount = await publicClient.readContract({
      address: ADDRESSES.leaderboard,
      abi: LEADERBOARD_ABI,
      functionName: "entryCount",
    }) as bigint;
    const entries = Array.from(raw)
      .slice(0, Number(entryCount))
      .filter((entry) => entry.player !== "0x0000000000000000000000000000000000000000")
      .map((entry) => ({
        player: entry.player,
        verifiedWork: Number(entry.score),
        restorationCycle: Number(entry.wave),
        timestamp: Number(entry.timestamp),
      }));
    res.json({ entries, configured: true, metric: "verified-integrity-work" });
  } catch (error) {
    logger.error({ error }, "integrity leaderboard read failed");
    res.status(500).json({ error: "Failed to read integrity leaderboard" });
  }
});

router.post("/blockchain/claim", (_req, res) => {
  res.status(410).json({
    error: "Client-reported kill claims are disabled",
    replacement: "/api/ecosystem/encounters/:encounterId/actions",
  });
});

router.post("/blockchain/score", (_req, res) => {
  res.status(410).json({
    error: "Score submissions are disabled; rank derives from verified Integrity Work",
    replacement: "/api/ecosystem/player/:playerId",
  });
});

router.get("/blockchain/value/:n", (req, res) => {
  const value = Number.parseInt(req.params.n, 10);
  if (Number.isNaN(value) || value < 1 || value > 255) {
    res.status(400).json({ error: "n must be 1-255" });
    return;
  }
  res.json({
    legacyVirusValue: value,
    previewOnly: true,
    cgrdReward: getVirusTokenValue(value),
    note: "Rewards are distributed from verified Integrity Work, never direct kills.",
  });
});

export default router;
