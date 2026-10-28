import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { ConstructTimelineEvent } from '../ecosystem/presence';

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
  serverTimeMs: number | null;
  receivedAtMs: number | null;
  timeline: ConstructTimelineEvent[];
  authoritativeSynchronization: number | null;
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

type ConstructCell = (typeof CELLS)[number];

// At gameplay scale a thousand independently animated SVG groups are visually
// indistinguishable from batched faces, but they are extremely expensive to
// reconcile and composite over the moving game canvas. Keep only the frontier
// cells independent so construction/deconstruction remains legible.
const MAX_ANIMATED_FRONTIER_CELLS = 24;

function cellPosition(cell: ConstructCell, chemistry: number) {
  const disorder = 1 - chemistry;
  return {
    x: Math.round((cell.coreX + Math.sin(cell.id * 12.9898) * 34 * disorder) * 10) / 10,
    y: Math.round((cell.coreY + Math.cos(cell.id * 7.233) * 25 * disorder) * 10) / 10,
  };
}

function buildBatchedCellFaces(cells: readonly ConstructCell[], chemistry: number) {
  const top: string[] = [];
  const left: string[] = [];
  const right: string[] = [];
  for (const cell of cells) {
    const { x, y } = cellPosition(cell, chemistry);
    top.push(`M${x} ${y - 3}L${x + 4} ${y - 1}L${x} ${y + 1}L${x - 4} ${y - 1}Z`);
    left.push(`M${x - 4} ${y - 1}L${x} ${y + 1}L${x} ${y + 5}L${x - 4} ${y + 3}Z`);
    right.push(`M${x} ${y + 1}L${x + 4} ${y - 1}L${x + 4} ${y + 3}L${x} ${y + 5}Z`);
  }
  return { top: top.join(''), left: left.join(''), right: right.join('') };
}

function IntegrityConstructComponent({
  integrityWork,
  integrity,
  discoveries,
  mutations,
  fusions,
  pressure,
  activePlayers,
  coreUnits,
  coreDelta,
  serverTimeMs,
  receivedAtMs,
  timeline,
  authoritativeSynchronization,
}: IntegrityConstructProps) {
  const previousActiveRef = useRef<Set<string>>(new Set());
  const previousCellCountRef = useRef(0);
  const [retiringCells, setRetiringCells] = useState<Set<string>>(new Set());
  const localCompletion = Math.max(0, Math.min(1, (
    integrity.node * 0.52 + integrity.sector * 0.3 + integrity.global * 0.18
  ) / 100));
  const targetCells = Math.max(0, Math.min(
    CELLS.length,
    activePlayers === null ? Math.round(localCompletion * 1_000) : Math.round(coreUnits),
  ));
  const [timelineNow, setTimelineNow] = useState(() => Date.now());
  const clockOffset = serverTimeMs === null || receivedAtMs === null
    ? 0
    : serverTimeMs - receivedAtMs;
  useEffect(() => {
    if (!timeline.length) return;
    const finalEvent = timeline[timeline.length - 1];
    let timer = 0;
    const tick = () => {
      const now = Date.now();
      setTimelineNow(now);
      const remaining = finalEvent.startsAtMs + finalEvent.durationMs - (now + clockOffset);
      if (remaining > 0) timer = window.setTimeout(tick, Math.min(100, remaining));
    };
    tick();
    return () => window.clearTimeout(timer);
  }, [timeline, clockOffset]);
  const authoritativeNow = timelineNow + clockOffset;
  const currentEvent = [...timeline].reverse().find((event) => authoritativeNow >= event.startsAtMs);
  const nextEvent = timeline.find((event) => authoritativeNow < event.startsAtMs);
  const eventProgress = currentEvent
    ? Math.max(0, Math.min(1, (authoritativeNow - currentEvent.startsAtMs) / currentEvent.durationMs))
    : 1;
  const activeCells = currentEvent
    ? eventProgress < 1
      ? Math.round(currentEvent.fromUnits + (currentEvent.toUnits - currentEvent.fromUnits) * eventProgress)
      : nextEvent ? currentEvent.toUnits : targetCells
    : nextEvent?.fromUnits ?? targetCells;
  const timelineDelta = currentEvent && eventProgress < 1 ? currentEvent.delta : 0;
  const visualDelta = timelineDelta || coreDelta;
  const completion = activeCells / CELLS.length;
  useEffect(() => {
    const previousCount = previousCellCountRef.current;
    previousCellCountRef.current = activeCells;
    if (previousCount <= activeCells) return;
    const retiring = new Set(
      CELLS.slice(activeCells, previousCount).map((cell) => String(cell.id)),
    );
    setRetiringCells(retiring);
    const timer = window.setTimeout(() => setRetiringCells(new Set()), 1900);
    return () => window.clearTimeout(timer);
  }, [activeCells]);
  const helperTotal = activePlayers ?? 0;
  const workPulse = integrityWork % 12;
  const integritySpread = Math.max(integrity.global, integrity.sector, integrity.node)
    - Math.min(integrity.global, integrity.sector, integrity.node);
  const researchCoherence = Math.min(5, Math.log2(discoveries + mutations + fusions + 1));
  const localChemistry = Math.max(0, Math.min(1, (
    100 - integritySpread * 1.35
    + Math.min(12, Math.max(0, helperTotal - 1) * 3)
    + researchCoherence
    + Math.max(-12, Math.min(12, coreDelta))
  ) / 100));
  const chemistry = authoritativeSynchronization === null
    ? localChemistry
    : Math.max(0, Math.min(1, authoritativeSynchronization / 100));
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

  const frontierCells = useMemo(() => {
    const changed = CELLS.filter((cell) => {
      const cellId = String(cell.id);
      const active = activated.has(cellId);
      const wasActive = previousActive.has(cellId) || retiringCells.has(cellId);
      return active !== wasActive;
    });
    return changed.slice(-MAX_ANIMATED_FRONTIER_CELLS);
  }, [activated, previousActive, retiringCells]);
  const frontierIds = useMemo(
    () => new Set(frontierCells.map((cell) => String(cell.id))),
    [frontierCells],
  );
  const batchedFaces = useMemo(() => buildBatchedCellFaces(
    CELLS.slice(0, activeCells).filter((cell) => !frontierIds.has(String(cell.id))),
    chemistry,
  ), [activeCells, chemistry, frontierIds]);

  return (
    <aside
      id="integrityConstruct"
      className={`integrityConstruct ${pressure} ${visualDelta > 0 ? 'core-growing' : visualDelta < 0 ? 'core-eroding' : ''}`}
      style={constructStyle}
      aria-label={`Living System Integrity construct, ${Math.round(chemistry * 100)} percent synchronized`}
    >
      <div className="constructHeading">
        <span>
          <b>INTEGRITY CONSTRUCT</b>
          <small>LIVE MATCH SCAFFOLD</small>
        </span>
        <strong title={`${activeCells} of 1000 material units`}>
          {Math.round(chemistry * 100)}% SYNC
        </strong>
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
        </defs>

        <g className="matrixCells">
          <g className="cell active constructCellBatch">
            <path className="blockTop" d={batchedFaces.top} />
            <path className="blockLeft" d={batchedFaces.left} />
            <path className="blockRight" d={batchedFaces.right} />
          </g>
          {frontierCells.map((cell, index) => {
            const cellId = String(cell.id);
            const active = activated.has(cellId);
            const wasActive = previousActive.has(cellId) || retiringCells.has(cellId);
            const transition = active && !wasActive ? 'adding' : !active && wasActive ? 'subtracting' : '';
            const { x: positionX, y: positionY } = cellPosition(cell, chemistry);
            return (
              <g
                key={cell.id}
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
                        % Math.max(1, Math.ceil(Math.abs(visualDelta) / 2))) * 0.056
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
      </svg>

      <div className="constructTelemetry">
        <span><i className="telemetryFlow repair" />WORK <b>{integrityWork}</b></span>
        <span className={activePlayers === null ? 'presenceOffline' : ''}>
          <i className="telemetryFlow assist" />HELPERS <b>{activePlayers ?? 'OFFLINE'}</b>
        </span>
        <span><i className="telemetryFlow research" />CHEMISTRY <b>{Math.round(chemistry * 100)}%</b></span>
      </div>
      {visualDelta !== 0 && <div className="coreDelta">{visualDelta > 0 ? '+' : ''}{visualDelta} CELLS</div>}
    </aside>
  );
}

function sameTimeline(a: readonly ConstructTimelineEvent[], b: readonly ConstructTimelineEvent[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((event, index) => {
    const other = b[index];
    return event.sequence === other.sequence
      && event.startsAtMs === other.startsAtMs
      && event.durationMs === other.durationMs
      && event.fromUnits === other.fromUnits
      && event.toUnits === other.toUnits
      && event.delta === other.delta;
  });
}

function sameIntegrityConstructProps(a: IntegrityConstructProps, b: IntegrityConstructProps) {
  return a.integrityWork === b.integrityWork
    && a.integrity.global === b.integrity.global
    && a.integrity.sector === b.integrity.sector
    && a.integrity.node === b.integrity.node
    && a.discoveries === b.discoveries
    && a.mutations === b.mutations
    && a.fusions === b.fusions
    && a.pressure === b.pressure
    && a.activePlayers === b.activePlayers
    && a.coreUnits === b.coreUnits
    && a.coreDelta === b.coreDelta
    && a.serverTimeMs === b.serverTimeMs
    && a.receivedAtMs === b.receivedAtMs
    && a.authoritativeSynchronization === b.authoritativeSynchronization
    && sameTimeline(a.timeline, b.timeline);
}

export const IntegrityConstruct = memo(IntegrityConstructComponent, sameIntegrityConstructProps);
