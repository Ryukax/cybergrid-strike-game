import type { KillRecord } from '@/blockchain/rewards';

interface Props {
  kills: KillRecord[];
  totalCGRD: number;
  gameOver: boolean;
  finalScore: number;
  finalWave: number;
}

function meritFor(work: number): string {
  if (work >= 250_000) return 'SOVEREIGN';
  if (work >= 80_000) return 'SENTINEL';
  if (work >= 25_000) return 'ARCHITECT';
  if (work >= 7_500) return 'GUARDIAN';
  if (work >= 1_500) return 'MAINTAINER';
  return 'INITIATE';
}

/**
 * Reward preview only. Distribution is deliberately absent from the client:
 * the server verifies work and a later treasury cycle determines rewards.
 */
export function ChainPanel({ kills, gameOver, finalScore, finalWave }: Props) {
  if (!gameOver) return null;
  const merit = meritFor(finalScore);

  return (
    <div style={{
      marginTop: 20,
      padding: '16px 20px',
      background: 'rgba(0,10,30,0.80)',
      border: '1px solid rgba(74,222,128,0.45)',
      borderRadius: 12,
      fontFamily: '"Share Tech Mono", monospace',
      color: '#e2e8f0',
      minWidth: 280,
      backdropFilter: 'blur(6px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18, color: '#4ade80' }}>◈</span>
        <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.08em', color: '#86efac' }}>
          INTEGRITY DISTRIBUTION
        </span>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#86efac', lineHeight: 1 }}>
          {finalScore}
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
          VERIFIED INTEGRITY WORK · CYCLE {finalWave}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
        <div style={{ padding: 8, border: '1px solid rgba(125,211,252,0.2)', borderRadius: 7 }}>
          MERIT<br /><b style={{ color: '#c4b5fd' }}>{merit}</b>
        </div>
        <div style={{ padding: 8, border: '1px solid rgba(125,211,252,0.2)', borderRadius: 7 }}>
          SPECIMENS<br /><b style={{ color: '#67e8f9' }}>{kills.length}</b>
        </div>
      </div>

      <div style={{
        marginTop: 12,
        paddingTop: 10,
        borderTop: '1px solid rgba(255,255,255,0.08)',
        fontSize: 10,
        color: '#64748b',
        lineHeight: 1.55,
      }}>
        Rewards are not paid per neutralization. The server validates contribution,
        restoration quality, sector importance, active merit, and current System
        Integrity before a diminishing-return treasury distribution.
      </div>
    </div>
  );
}
