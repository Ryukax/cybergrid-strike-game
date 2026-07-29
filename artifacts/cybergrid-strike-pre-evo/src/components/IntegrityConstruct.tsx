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

const CELLS = Array.from({ length: 48 }, (_, index) => {
  const layer = Math.floor(index / 8);
  const spoke = index % 8;
  const angle = spoke * Math.PI / 4 + layer * 0.39;
  const radiusX = 9 + layer * 18;
  const radiusY = 5 + layer * 11;
  return {
    id: index,
    x: 151 + Math.cos(angle) * radiusX,
    y: 111 + Math.sin(angle) * radiusY + layer * 1.8,
    scale: 0.62 + layer * 0.07,
    rotation: (spoke % 2 ? -4 : 4) + layer * 1.5,
  };
});

const HELPER_PATHS = ['helperTrackA', 'helperTrackB', 'helperTrackC', 'helperTrackD'];
const HELPER_ROLES = ['restoration', 'defense', 'discovery', 'assist'];

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
  const completion = activePlayers === null ? localCompletion : Math.max(0, Math.min(1, coreUnits / 1_000));
  const activeCells = Math.max(3, Math.round(CELLS.length * completion));
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
  const restorationFlow = Math.min(5, Math.max(1, helperTotal + (coreDelta > 0 ? Math.ceil(coreDelta / 4) : 0)));
  const corruptionFlow = Math.min(5, Math.max(
    pressure === 'critical' ? 2 : 1,
    coreDelta < 0 ? Math.ceil(Math.abs(coreDelta) / 3) : Math.ceil((100 - integrity.node) / 34),
  ));
  const constructStyle = {
    '--integrity': completion,
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
          <path id="restorationFeed" d="M8 142 C48 146 79 137 111 121 S137 111 151 111" />
          <path id="corruptionFeed" d="M151 111 C183 103 204 91 232 74 S269 62 296 67" />
        </defs>

        <g className="constructOrbits">
          <ellipse cx="154" cy="110" rx="116" ry="62" />
          <ellipse cx="154" cy="110" rx="78" ry="96" transform="rotate(58 154 110)" />
        </g>

        <g className="matrixCells">
          {CELLS.map((cell, index) => {
            const cellId = String(cell.id);
            const active = activated.has(cellId);
            const wasActive = previousActive.has(cellId) || retiringCells.has(cellId);
            if (!active && !wasActive) return null;
            const transition = active && !wasActive ? 'adding' : !active && wasActive ? 'subtracting' : '';
            return (
              <g
                key={index}
                className="constructBlockPosition"
                style={{
                  transform: `translate(${cell.x}px, ${cell.y}px) rotate(${cell.rotation}deg) scale(${cell.scale})`,
                }}
              >
                <g
                  className={`cell ${active ? 'active' : 'exiting'} ${transition}`}
                  style={{ animationDelay: `${((index + workPulse) % 7) * 0.035}s` }}
                >
                  <path className="blockTop" d="M0 -9 L12 -3 L0 3 L-12 -3 Z" />
                  <path className="blockLeft" d="M-12 -3 L0 3 L0 14 L-12 8 Z" />
                  <path className="blockRight" d="M0 3 L12 -3 L12 8 L0 14 Z" />
                </g>
              </g>
            );
          })}
        </g>

        <g className="materialFlows" filter="url(#constructGlow)">
          {Array.from({ length: restorationFlow }, (_, index) => (
            <g key={`restore-${index}`} className="materialTransit restore">
              <animateMotion
                dur={`${Math.max(1.25, 3.1 - restorationFlow * .24)}s`}
                begin={`${index * -.47}s`}
                repeatCount="indefinite"
                rotate="auto"
              >
                <mpath href="#restorationFeed" />
              </animateMotion>
              <path d="M0 -5 L7 -1 L0 3 L-7 -1 Z M-7 -1 L0 3 L0 9 L-7 5 Z M0 3 L7 -1 L7 5 L0 9 Z" />
            </g>
          ))}
          {Array.from({ length: corruptionFlow }, (_, index) => (
            <g key={`corrupt-${index}`} className="materialTransit corrupt">
              <animateMotion
                dur={`${Math.max(1.1, 3.5 - corruptionFlow * .3)}s`}
                begin={`${index * -.61}s`}
                repeatCount="indefinite"
                rotate="auto"
              >
                <mpath href="#corruptionFeed" />
              </animateMotion>
              <path d="M0 -5 L7 -1 L0 3 L-7 -1 Z M-7 -1 L0 3 L0 9 L-7 5 Z M0 3 L7 -1 L7 5 L0 9 Z" />
            </g>
          ))}
          <text className="flowLabel restoreLabel" x="9" y="158">RESTORATION</text>
          <text className="flowLabel corruptLabel" x="244" y="57">CORRUPTION</text>
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
          <path d="M126 166 L151 181 L179 165 L153 151 Z" />
          <path d="M126 166 L126 172 L151 187 L151 181 Z M151 181 L179 165 L179 171 L151 187 Z" />
        </g>
      </svg>

      <div className="constructTelemetry">
        <span><i className="telemetryFlow repair" />WORK <b>{integrityWork}</b></span>
        <span className={activePlayers === null ? 'presenceOffline' : ''}>
          <i className="telemetryFlow assist" />HELPERS <b>{activePlayers ?? 'OFFLINE'}</b>
        </span>
        <span><i className="telemetryFlow research" />RESEARCH <b>{discoveries + mutations + fusions}</b></span>
      </div>
      {coreDelta !== 0 && <div className="coreDelta">{coreDelta > 0 ? '+' : ''}{coreDelta} CELLS</div>}
    </aside>
  );
}
