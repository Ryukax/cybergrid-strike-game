/**
 * ChainPanel — blockchain reward HUD for CyberGrid Strike.
 *
 * In-game: small badge showing accumulating CGRD reward.
 * Game-over: expanded card with wallet connect + claim flow.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { KillRecord } from '@/blockchain/rewards';
import {
  isWalletAvailable,
  connectWallet,
  getConnectedAddress,
  getCGRDBalance,
} from '@/blockchain/wallet';
import {
  getBlockchainConfig,
  claimRewards,
  submitScore,
  type BlockchainConfig,
  type ClaimResult,
} from '@/blockchain/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  /** Running kill list (updated throughout the game). */
  kills:      KillRecord[];
  /** Total pending CGRD (display units). */
  totalCGRD:  number;
  /** True when the game has ended. */
  gameOver:   boolean;
  /** Final score and wave (used for leaderboard submission). */
  finalScore: number;
  finalWave:  number;
}

type ClaimPhase =
  | 'idle'
  | 'connecting'
  | 'claiming'
  | 'submitting'
  | 'done'
  | 'error';

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ChainPanel({ kills, totalCGRD, gameOver, finalScore, finalWave }: Props) {
  const [config,      setConfig]      = useState<BlockchainConfig | null>(null);
  const [address,     setAddress]     = useState<string | null>(null);
  const [balance,     setBalance]     = useState<string>('—');
  const [phase,       setPhase]       = useState<ClaimPhase>('idle');
  const [result,      setResult]      = useState<ClaimResult | null>(null);
  const [errMsg,      setErrMsg]      = useState('');
  const [scoreSubmit, setScoreSubmit] = useState<'idle' | 'done' | 'error'>('idle');
  const pulseRef = useRef(0); // animation frame for CGRD pulse

  // Load config on mount
  useEffect(() => {
    getBlockchainConfig().then(setConfig).catch(() => setConfig(null));
  }, []);

  // Auto-detect already-connected wallet
  useEffect(() => {
    getConnectedAddress().then(addr => { if (addr) setAddress(addr); });
  }, []);

  // Refresh CGRD balance when address or config changes
  useEffect(() => {
    if (!address || !config?.contracts.token) return;
    getCGRDBalance(config.contracts.token, address).then(setBalance);
  }, [address, config]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleConnect = useCallback(async () => {
    setPhase('connecting');
    setErrMsg('');
    try {
      const addr = await connectWallet();
      setAddress(addr);
      setPhase('idle');
    } catch (err: any) {
      setErrMsg(err.message ?? 'Connection failed');
      setPhase('error');
    }
  }, []);

  const handleClaim = useCallback(async () => {
    if (!address || kills.length === 0) return;
    setPhase('claiming');
    setErrMsg('');
    try {
      const res = await claimRewards(address, kills);
      setResult(res);

      // Auto-submit score to leaderboard
      if (finalScore > 0) {
        setPhase('submitting');
        setScoreSubmit('idle');
        try {
          await submitScore(address, finalScore, finalWave);
          setScoreSubmit('done');
        } catch {
          setScoreSubmit('error');
        }
      }
      setPhase('done');

      // Refresh balance
      if (config?.contracts.token) {
        getCGRDBalance(config.contracts.token, address).then(setBalance);
      }
    } catch (err: any) {
      setErrMsg(err.message ?? 'Claim failed');
      setPhase('error');
    }
  }, [address, kills, finalScore, finalWave, config]);

  // ── In-game badge (always visible during play) ───────────────────────────

  if (!gameOver) {
    return (
      <div style={{
        position:   'fixed',
        top:        10,
        right:      10,
        zIndex:     200,
        display:    'flex',
        alignItems: 'center',
        gap:        6,
        background: 'rgba(0,0,0,0.55)',
        border:     '1px solid rgba(34,211,238,0.35)',
        borderRadius: 8,
        padding:    '4px 10px',
        fontFamily: '"Share Tech Mono", monospace',
        fontSize:   13,
        color:      '#22d3ee',
        pointerEvents: 'none',
        backdropFilter: 'blur(4px)',
      }}>
        <span style={{ fontSize: 15, lineHeight: 1 }}>◈</span>
        <span>{totalCGRD} CGRD</span>
      </div>
    );
  }

  // ── Game-over claim card ──────────────────────────────────────────────────

  return (
    <div style={{
      marginTop:  20,
      padding:    '16px 20px',
      background: 'rgba(0,10,30,0.80)',
      border:     '1px solid rgba(34,211,238,0.40)',
      borderRadius: 12,
      fontFamily: '"Share Tech Mono", monospace',
      color:      '#e2e8f0',
      minWidth:   260,
      backdropFilter: 'blur(6px)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18, color: '#22d3ee' }}>◈</span>
        <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.08em', color: '#22d3ee' }}>
          CGRD REWARDS
        </span>
        {config && !config.configured && (
          <span style={{ marginLeft: 'auto', fontSize: 10, color: '#94a3b8', border: '1px solid #334155', borderRadius: 4, padding: '1px 5px' }}>
            TESTNET
          </span>
        )}
      </div>

      {/* Earned this session */}
      <div style={{ marginBottom: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#22d3ee', lineHeight: 1 }}>
          {totalCGRD}
        </div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
          CGRD earned from {kills.length} virus{kills.length !== 1 ? 'es' : ''} eliminated
        </div>
      </div>

      {/* Wallet state */}
      {address ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 12, color: '#94a3b8' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
          <span>{shortAddr(address)}</span>
          {balance !== '—' && (
            <span style={{ marginLeft: 'auto', color: '#22d3ee' }}>
              {balance} CGRD on-chain
            </span>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>
          Connect a wallet to claim your CGRD on Base Sepolia.
        </div>
      )}

      {/* Action buttons */}
      {phase !== 'done' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!address && (
            <button
              onClick={handleConnect}
              disabled={phase === 'connecting' || !isWalletAvailable()}
              style={btnStyle('#22d3ee', phase === 'connecting')}
            >
              {!isWalletAvailable()
                ? '⚠ Install MetaMask / Coinbase Wallet'
                : phase === 'connecting' ? 'Connecting…' : '⬡ Connect Wallet'}
            </button>
          )}

          {address && (
            <button
              onClick={handleClaim}
              disabled={phase === 'claiming' || phase === 'submitting' || kills.length === 0}
              style={btnStyle('#a78bfa', phase === 'claiming' || phase === 'submitting')}
            >
              {phase === 'claiming'   ? 'Minting CGRD…'
               : phase === 'submitting' ? 'Writing score…'
               : `◈ Claim ${totalCGRD} CGRD + submit score`}
            </button>
          )}
        </div>
      )}

      {/* Success state */}
      {phase === 'done' && result && (
        <div style={{ fontSize: 12, color: '#4ade80' }}>
          <div style={{ marginBottom: 4 }}>
            ✓ {result.mock ? 'Simulated' : 'Minted'} {result.cgrdAmount} CGRD
          </div>
          {result.txHash && (
            <a
              href={result.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#22d3ee', textDecoration: 'none', fontSize: 11 }}
            >
              ↗ View on Basescan
            </a>
          )}
          {result.mock && (
            <div style={{ marginTop: 4, fontSize: 10, color: '#64748b' }}>
              {result.message}
            </div>
          )}
          {scoreSubmit === 'done' && (
            <div style={{ marginTop: 6, color: '#a78bfa' }}>✓ Score recorded on-chain</div>
          )}
        </div>
      )}

      {/* Error */}
      {phase === 'error' && (
        <div style={{ fontSize: 11, color: '#f87171', marginTop: 4 }}>
          ✗ {errMsg}
          <button
            onClick={() => { setPhase('idle'); setErrMsg(''); }}
            style={{ marginLeft: 8, background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 11 }}
          >
            retry
          </button>
        </div>
      )}

      {/* CGRD value legend */}
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.07)', fontSize: 10, color: '#475569', lineHeight: 1.6 }}>
        <div>◈ Prime viruses → 3× reward</div>
        <div>◈ Power-of-2 → 2.5×  ·  Perfect square → 2×</div>
        <div>◈ More lobes & spikes → higher refinement value</div>
      </div>
    </div>
  );
}

// ── Style helpers ─────────────────────────────────────────────────────────────

function btnStyle(color: string, disabled: boolean): React.CSSProperties {
  return {
    background:    disabled ? 'rgba(255,255,255,0.04)' : `rgba(${hexToRgb(color)},0.12)`,
    border:        `1px solid ${disabled ? 'rgba(255,255,255,0.10)' : color}`,
    borderRadius:  8,
    color:         disabled ? '#475569' : color,
    cursor:        disabled ? 'not-allowed' : 'pointer',
    fontFamily:    '"Share Tech Mono", monospace',
    fontSize:      13,
    fontWeight:    600,
    padding:       '9px 14px',
    letterSpacing: '0.05em',
    transition:    'all 0.15s ease',
    width:         '100%',
  };
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r},${g},${b}`;
}
