---
name: Blockchain architecture
description: CyberGrid Strike on-chain layer — contracts, deploy flow, secrets, API routes, frontend integration.
---

## Contracts (Base Sepolia testnet)
- `CyberGridToken.sol` — minimal ERC-20 (symbol: CGRD, 18 decimals). Only `minter` address can call `mint(to, amount)`.
- `CyberGridLeaderboard.sol` — top-10 sorted entries. Only `submitter` address may call `submit(player, score, wave)`.
- Compiled bytecode + ABI live in `artifacts/api-server/contracts/compiled.json` and `src/blockchain/abi.ts`.
- Deployer is the minter AND submitter (same key). Transfer roles via `setMinter` / `setSubmitter` if ever needed.

## Deploy flow
1. Faucet ETH to deployer wallet: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet
2. Set secret `BLOCKCHAIN_PRIVATE_KEY` (hex, with or without `0x`).
3. Run: `pnpm --filter @workspace/api-server run deploy`
4. Copy addresses printed; set secrets `CGRD_TOKEN_ADDRESS` and `LEADERBOARD_ADDRESS`.
5. Restart the API Server workflow.

## Secrets required
- `BLOCKCHAIN_PRIVATE_KEY` — operator wallet (minter + submitter)
- `CGRD_TOKEN_ADDRESS` — deployed token contract
- `LEADERBOARD_ADDRESS` — deployed leaderboard contract

## API routes (`artifacts/api-server/src/routes/blockchain.ts`)
- `GET  /api/blockchain/config`    — chain info + contract addresses
- `GET  /api/blockchain/leaderboard` — top-10 entries from chain
- `POST /api/blockchain/claim`     — body: `{address, kills:[{value}]}` → mints CGRD
- `POST /api/blockchain/score`     — body: `{address, score, wave}` → leaderboard submit
- `GET  /api/blockchain/value/:n`  — CGRD reward for a given virus integer

## Token value formula (mirrors backend & frontend)
`base(10) × classMultiplier × bitDensityMultiplier × lobeMultiplier`
- classMultiplier: prime=3, pow2=2.5, perfect-square=2, odd-composite=1.5, even-composite=1
- bitDensity: `1 + (popcount(n)/8) × 0.5`
- lobeMul: `1 + ((lobes-3)/5) × 0.3`
- Range: ~10–90 CGRD per kill

**Why:** Formula lives in two places (`token-value.ts` backend, `rewards.ts` frontend). Backend is authoritative for minting; frontend is display only. Keep them in sync if formula changes.

## Mock mode
When secrets are not set, all routes return `{mock: true}` responses instead of hitting chain. Game is fully playable without a wallet.

## Frontend files
- `src/blockchain/rewards.ts` — `RewardAccumulator` class + `getVirusTokenValue(n)`
- `src/blockchain/wallet.ts` — `connectWallet()`, `getCGRDBalance()`, Base Sepolia switch
- `src/blockchain/api.ts` — `claimRewards()`, `submitScore()`, `fetchLeaderboard()`
- `src/components/ChainPanel.tsx` — in-game CGRD badge + game-over claim UI

## API URL
Frontend uses `VITE_BLOCKCHAIN_API` env var; defaults to `{origin}/api-server/api`. Set this if the api-server is not at that path.

## GitHub
Repo: https://github.com/Ryukax/cybergrid-strike-game  
All files pushed.
