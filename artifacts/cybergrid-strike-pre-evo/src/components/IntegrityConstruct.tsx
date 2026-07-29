import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

interface IntegrityConstructProps {
  integrityWork: number;
  integrity: { global: number; sector: number; node: number };
  discoveries: number;
  mutations: number;
  fusions: number;
  pressure: 'steady' | 'critical' | 'recovery';
  activePlayers: number | null;
  coreUnits: number;
  coreDelta: number;
}

const CELLS = (() => {
  const spatial = Array.from({ length: 1_000 }, (_, index) => {
  const gx = index % 10;
  const gy = Math.floor(index / 10) % 10;
  const gz = Math.floor(index / 100);
  return { gx, gy, gz };
  }).sort((a, b) => {
    const distance = (cell: { gx: number; gy: number; gz: number }) =>
      Math.max(Math.abs(cell.gx - 4.5), Math.abs(cell.gy - 4.5), Math.abs(cell.gz - 4.5));
    return distance(a) - distance(b)
      || a.gy - b.gy
      || a.gz - b.gz
      || a.gx - b.gx;
  });
  const byCoordinate = new Map(
    spatial.map((cell) => [`${cell.gx}:${cell.gy}:${cell.gz}`, cell]),
  );
  const ordered: typeof spatial = [];
  const used = new Set<string>();
  for (const cell of spatial) {
    const key = `${cell.gx}:${cell.gy}:${cell.gz}`;
    if (used.has(key)) continue;
    const mirrorKey = `${9 - cell.gx}:${9 - cell.gy}:${9 - cell.gz}`;
    ordered.push(cell);
    used.add(key);
    const mirror = byCoordinate.get(mirrorKey);
    if (mirror && !used.has(mirrorKey)) {
      ordered.push(mirror);
      used.add(mirrorKey);
    }
  }
  return ordered.map((cell, id) => ({
    ...cell,
    id,
    coreX: 150 + (cell.gx - cell.gz) * 4.3,
    coreY: 137 + (cell.gx + cell.gz) * 2.1 - cell.gy * 4.15,
  }));
})();

const HELPER_PATHS = ['helperTrackA', 'helperTrackB', 'helperTrackC', 'helperTrackD'];

export function IntegrityConstruct({
  integrityWork,
  integrity,
  discoveries,
  mutations,
  fusions,
  pressure,
  activePlayers,
  coreUnits,
  coreDelta,
}: IntegrityConstructProps) {
  const previousActiveRef = useRef<Set<string>>(new Set());
  const previousCellCountRef = useRef(0);
  const [retiringCells, setRetiringCells] = useState<Set<string>>(new Set());
  const localCompletion = Math.max(0, Math.min(1, (
    integrity.node * 0.52 + integrity.sector * 0.3 + integrity.global * 0.18
  ) / 100));
  const activeCells = Math.max(0, Math.min(
    CELLS.length,
    activePlayers === null ? Math.round(localCompletion * 1_000) : Math.round(coreUnits),
  ));
  const completion = activeCells / CELLS.length;
  useEffect(() => {
    const previousCount = previousCellCountRef.current;
    previousCellCountRef.current = activeCells;
    if (previousCount <= activeCells) return;
    const retiring = new Set(
      CELLS.slice(activeCells, previousCount).map((cell) => String(cell.id)),
    );
    setRetiringCells(retiring);
    const timer = window.setTimeout(() => setRetiringCells(new Set()), 900);
    return () => window.clearTimeout(timer);
  }, [activeCells]);
  const helperTotal = activePlayers ?? 0;
  const visibleHelpers = Math.min(24, helperTotal);
  const workPulse = integrityWork % 12;
  const integritySpread = Math.max(integrity.global, integrity.sector, integrity.node)
    - Math.min(integrity.global, integrity.sector, integrity.node);
  const researchCoherence = Math.min(5, Math.log2(discoveries + mutations + fusions + 1));
  const chemistry = Math.max(0, Math.min(1, (
    100 - integritySpread * 1.35
    + Math.min(12, Math.max(0, helperTotal - 1) * 3)
    + researchCoherence
    + Math.max(-12, Math.min(12, coreDelta))
  ) / 100));
  const constructStyle = {
    '--integrity': completion,
    '--chemistry': chemistry,
    '--work-speed': `${Math.max(2.4, 6.2 - Math.min(3.2, Math.log10(integrityWork + 1)))}s`,
  } as CSSProperties;

  const activated = useMemo(() => {
    // The core grows outward in stable architectural rings. Existing material
    // never shuffles; telemetry can only add new blocks or remove edge blocks.
    return new Set(CELLS.slice(0, activeCells).map((cell) => String(cell.id)));
  }, [activeCells]);
  const previousActive = previousActiveRef.current;
  useEffect(() => {
    previousActiveRef.current = activated;
  }, [activated]);

  return (
    <aside
      id="integrityConstruct"
      className={`integrityConstruct ${pressure} ${coreDelta > 0 ? 'core-growing' : coreDelta < 0 ? 'core-eroding' : ''}`}
      style={constructStyle}
      aria-label={`Living System Integrity construct, ${Math.round(completion * 100)} percent assembled`}
    >
      <div className="constructHeading">
        <span>
          <b>INTEGRITY CONSTRUCT</b>
          <small>LIVE MATCH SCAFFOLD</small>
        </span>
        <strong>{Math.round(completion * 100)}%</strong>
      </div>

      <svg className="constructStage" viewBox="0 0 300 210" role="img" aria-hidden="true">
        <defs>
          <linearGradient id="constructCell" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ecfeff" />
            <stop offset=".45" stopColor="#22d3ee" />
            <stop offset="1" stopColor="#2563eb" />
          </linearGradient>
          <linearGradient id="constructCorrupt" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fb7185" />
            <stop offset="1" stopColor="#581c87" />
          </linearGradient>
          <filter id="constructGlow">
            <feGaussianBlur stdDeviation="2.6" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <path id="helperTrackA" d="M16 176 C62 174 80 144 122 132 S178 112 210 76 S252 40 286 46" />
          <path id="helperTrackB" d="M8 80 C48 82 68 108 104 100 S158 60 194 72 S246 126 290 112" />
          <path id="helperTrackC" d="M42 204 C56 160 92 156 126 164 S194 196 228 156 S260 126 296 138" />
          <path id="helperTrackD" d="M36 30 C70 48 82 68 114 66 S172 32 206 44 S250 72 284 22" />
        </defs>

        <g className="constructOrbits">
          <ellipse cx="154" cy="110" rx="116" ry="62" />
          <ellipse cx="154" cy="110" rx="78" ry="96" transform="rotate(58 154 110)" />
        </g>

        <g className="coreGeometryTarget">
          <path d="M151 67 L205 96 L151 126 L97 96 Z" />
          <path d="M97 96 L151 126 L151 166 L97 136 Z" />
          <path d="M151 126 L205 96 L205 136 L151 166 Z" />
          <path d="M124 82 L178 111 M178 82 L124 111 M124 111 L178 140" />
          <text x="151" y="61" textAnchor="middle">SYNCHRONIZATION TARGET</text>
        </g>

        <g className="matrixCells">
          {CELLS.map((cell, index) => {
            const cellId = String(cell.id);
            const active = activated.has(cellId);
            const wasActive = previousActive.has(cellId) || retiringCells.has(cellId);
            if (!active && !wasActive) return null;
            const transition = active && !wasActive ? 'adding' : !active && wasActive ? 'subtracting' : '';
            const disorder = 1 - chemistry;
            const positionX = cell.coreX + Math.sin(cell.id * 12.9898) * 34 * disorder;
            const positionY = cell.coreY + Math.cos(cell.id * 7.233) * 25 * disorder;
            return (
              <g
                key={index}
                className="constructBlockPosition"
                style={{
                  transform: `translate(${positionX}px, ${positionY}px)`,
                }}
              >
                <g
                  className={`cell microVoxel ${active ? 'active' : 'exiting'} ${transition}`}
                  style={{
                    animationDelay: `${
                      ((Math.floor(index / 2) + workPulse)
                        % Math.max(1, Math.ceil(Math.abs(coreDelta) / 2))) * 0.056
                    }s`,
                  }}
                >
                  <path className="blockTop" d="M0 -3 L4 -1 L0 1 L-4 -1 Z" />
                  <path className="blockLeft" d="M-4 -1 L0 1 L0 5 L-4 3 Z" />
                  <path className="blockRight" d="M0 1 L4 -1 L4 3 L0 5 Z" />
                </g>
              </g>
            );
          })}
        </g>

        <g className="dataPackets" filter="url(#constructGlow)">
          <circle r="3"><animateMotion dur="2.8s" repeatCount="indefinite"><mpath href="#helperTrackA" /></animateMotion></circle>
          <rect width="6" height="6" rx="1"><animateMotion dur="3.7s" begin="-1.4s" repeatCount="indefinite"><mpath href="#helperTrackB" /></animateMotion></rect>
          <circle r="2.5"><animateMotion dur="3.2s" begin="-2.2s" repeatCount="indefinite"><mpath href="#helperTrackC" /></animateMotion></circle>
        </g>

        <g className="synchronizationSignals">
          {Array.from({ length: visibleHelpers }, (_, index) => {
            const path = HELPER_PATHS[index % HELPER_PATHS.length];
            const delay = `${-(index * 0.63 + 0.4)}s`;
            return (
              <g key={index} className="syncSignal">
                <animateMotion dur="var(--work-speed)" begin={delay} repeatCount="indefinite">
                  <mpath href={`#${path}`} />
                </animateMotion>
                <circle r="2.5" />
                <circle className="syncSignalRing" r="5" />
              </g>
            );
          })}
        </g>
      </svg>

      <div className="constructTelemetry">
        <span><i className="telemetryFlow repair" />WORK <b>{integrityWork}</b></span>
        <span className={activePlayers === null ? 'presenceOffline' : ''}>
          <i className="telemetryFlow assist" />HELPERS <b>{activePlayers ?? 'OFFLINE'}</b>
        </span>
        <span><i className="telemetryFlow research" />CHEMISTRY <b>{Math.round(chemistry * 100)}%</b></span>
      </div>
      {coreDelta !== 0 && <div className="coreDelta">{coreDelta > 0 ? '+' : ''}{coreDelta} CELLS</div>}
    </aside>
  );
}
