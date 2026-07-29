import { useEffect, useMemo, useRef, type CSSProperties } from 'react';

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

const CELLS = Array.from({ length: 48 }, (_, index) => ({
  x: index % 8,
  y: Math.floor(index / 8),
}));

const HELPER_PATHS = ['helperTrackA', 'helperTrackB', 'helperTrackC', 'helperTrackD'];
const HELPER_ROLES = ['restoration', 'defense', 'discovery', 'assist'];

function metricHash(value: number) {
  let hash = value | 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  return (hash ^ (hash >>> 16)) >>> 0;
}

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
  const localCompletion = Math.max(0, Math.min(1, (
    integrity.node * 0.52 + integrity.sector * 0.3 + integrity.global * 0.18
  ) / 100));
  const completion = activePlayers === null ? localCompletion : Math.max(0, Math.min(1, coreUnits / 1_000));
  const activeCells = Math.max(3, Math.round(CELLS.length * completion));
  const helperTotal = activePlayers ?? 0;
  const visibleHelpers = Math.min(24, helperTotal);
  const workPulse = integrityWork % 12;
  const constructStyle = {
    '--integrity': completion,
    '--work-speed': `${Math.max(2.4, 6.2 - Math.min(3.2, Math.log10(integrityWork + 1)))}s`,
  } as CSSProperties;

  const topologySeed = Math.round(
    integrityWork * 17
    + discoveries * 43
    + mutations * 59
    + fusions * 71
    + Math.floor(integrityWork / 500) * 89,
  );
  const activated = useMemo(() => {
    // Quantity follows live integrity; research milestones alter the structure's
    // growth path. Nothing moves unless real telemetry changes.
    const ordered = CELLS
      .map((cell, index) => ({
        cell,
        rank: metricHash(topologySeed + index * 7919),
      }))
      .sort((a, b) => a.rank - b.rank);
    return new Set(ordered.slice(0, activeCells).map(({ cell }) => `${cell.x}:${cell.y}`));
  }, [activeCells, topologySeed]);
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

        <g className="matrixCells" transform="translate(93 39) skewY(-7)">
          {CELLS.map((cell, index) => {
            const cellId = `${cell.x}:${cell.y}`;
            const active = activated.has(cellId);
            const wasActive = previousActive.has(cellId);
            if (!active && !wasActive) return null;
            const transition = active && !wasActive ? 'adding' : !active && wasActive ? 'subtracting' : '';
            return (
              <rect
                key={index}
                className={`${active ? 'cell active' : 'cell exiting'} ${transition}`}
                x={cell.x * 15}
                y={(5 - cell.y) * 20}
                width="12"
                height="16"
                rx="1.5"
                style={{ animationDelay: `${((index + workPulse) % 11) * -0.17}s` }}
              />
            );
          })}
        </g>

        <g className="dataPackets" filter="url(#constructGlow)">
          <circle r="3"><animateMotion dur="2.8s" repeatCount="indefinite"><mpath href="#helperTrackA" /></animateMotion></circle>
          <rect width="6" height="6" rx="1"><animateMotion dur="3.7s" begin="-1.4s" repeatCount="indefinite"><mpath href="#helperTrackB" /></animateMotion></rect>
          <circle r="2.5"><animateMotion dur="3.2s" begin="-2.2s" repeatCount="indefinite"><mpath href="#helperTrackC" /></animateMotion></circle>
        </g>

        <g className="helpers">
          {Array.from({ length: visibleHelpers }, (_, index) => {
            const path = HELPER_PATHS[index % HELPER_PATHS.length];
            const role = HELPER_ROLES[index % HELPER_ROLES.length];
            const delay = `${-(index * 0.63 + 0.4)}s`;
            return (
            <g key={index} className={`helper ${role}`} style={{ animationDelay: delay, opacity: Math.max(.35, 1 - Math.floor(index / 4) * .08) }}>
              <animateMotion dur="var(--work-speed)" begin={delay} repeatCount="indefinite" rotate="auto">
                <mpath href={`#${path}`} />
              </animateMotion>
              <circle cx="0" cy="-5" r="3.2" />
              <path d="M0 -1 L0 7 M-5 2 L5 2 M0 7 L-4 12 M0 7 L5 11" />
              <rect className="helperBlock" x="6" y="-1" width="8" height="8" rx="1" />
            </g>
          )})}
        </g>

        <g className="foundation">
          <path d="M54 178 L150 198 L255 170 L157 151 Z" />
          <path d="M54 178 L54 185 L150 207 L150 198 Z M150 198 L255 170 L255 177 L150 207 Z" />
        </g>
      </svg>

      <div className="constructTelemetry">
        <span><i className="telemetryFlow repair" />WORK <b>{integrityWork}</b></span>
        <span className={activePlayers === null ? 'presenceOffline' : ''}>
          <i className="telemetryFlow assist" />HELPERS <b>{activePlayers ?? 'OFFLINE'}</b>
        </span>
        <span><i className="telemetryFlow research" />RESEARCH <b>{discoveries + mutations}</b></span>
      </div>
      {coreDelta !== 0 && <div className="coreDelta">{coreDelta > 0 ? '+' : ''}{coreDelta} CELLS</div>}
    </aside>
  );
}
