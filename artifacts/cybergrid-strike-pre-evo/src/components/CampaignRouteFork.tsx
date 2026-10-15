import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  resolveCampaignRouteDestinations,
  resolveCampaignRouteSelection,
  type CampaignRouteAvailability,
  type CampaignRouteBossEncounter,
  type CampaignRouteDirection,
} from '../game/campaign-route-director';

export interface CampaignRouteEnemyVisual {
  id: string;
  label: string;
  sprite: HTMLCanvasElement | null;
  row?: number;
  confirmedHits?: number;
  requiredHits?: number;
}

interface CampaignRouteForkProps {
  enabled: boolean;
  selectable: boolean;
  available: CampaignRouteAvailability;
  wave: number;
  startWave: number;
  securedSegments: number;
  completedBosses?: number;
  bossForkReady: boolean;
  bossEncounter: CampaignRouteBossEncounter | null;
  routeSegment: number;
  lastTraversal: {
    direction: CampaignRouteDirection;
    lane: 'top' | 'middle' | 'bottom';
    toSegment: number;
  } | null;
  onSelect?: (row: number, direction: CampaignRouteDirection) => void;
  getPlayerPosition: () => { row: number; col: number };
  getRouteEnemies: () => Record<CampaignRouteDirection, CampaignRouteEnemyVisual>;
}

const emptyPosition = { row: 1, col: 1 };

function drawEnemyPortrait(canvas: HTMLCanvasElement | null, source: HTMLCanvasElement | null): void {
  if (!canvas) return;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!source) return;
  context.imageSmoothingEnabled = false;
  const scale = Math.min(canvas.width / source.width, canvas.height / source.height) * 0.92;
  const width = source.width * scale;
  const height = source.height * scale;
  context.drawImage(source, (canvas.width - width) / 2, canvas.height - height, width, height);
}

export function CampaignRouteFork({
  enabled,
  selectable,
  available,
  wave,
  startWave,
  securedSegments,
  completedBosses = 0,
  bossForkReady,
  bossEncounter,
  routeSegment,
  lastTraversal,
  onSelect,
  getPlayerPosition,
  getRouteEnemies,
}: CampaignRouteForkProps) {
  const lastCanvasRef = useRef<HTMLCanvasElement>(null);
  const nextCanvasRef = useRef<HTMLCanvasElement>(null);
  const [position, setPosition] = useState(emptyPosition);
  const enemies = getRouteEnemies();
  const bossDestinations = resolveCampaignRouteDestinations(completedBosses);

  // Portraits and labels now consume the same immutable pair snapshot. Draw
  // before paint so neither card can lag behind its label or the other card.
  useLayoutEffect(() => {
    if (!enabled) return;
    drawEnemyPortrait(lastCanvasRef.current, enemies.last.sprite);
    drawEnemyPortrait(nextCanvasRef.current, enemies.next.sprite);
  }, [enabled, enemies.last.id, enemies.last.sprite, enemies.next.id, enemies.next.sprite]);

  useEffect(() => {
    if (!enabled) return undefined;
    let frame = 0;
    let previousSample = 0;
    const render = (time: number) => {
      if (time - previousSample >= 90) {
        previousSample = time;
        const latestPosition = getPlayerPosition();
        setPosition((current) => current.row === latestPosition.row && current.col === latestPosition.col
          ? current : latestPosition);
      }
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [enabled, getPlayerPosition]);

  if (!enabled) return null;

  const unlocked = selectable;
  const selection = resolveCampaignRouteSelection(position.row, position.col);
  const displayedSelection = bossEncounter
    ? { lane: bossEncounter.lane, direction: bossEncounter.direction }
    : selection;
  const bossActive = bossEncounter !== null;
  const bossMapVisible = bossForkReady || bossActive;
  const displayedSegment = bossEncounter?.segment ?? securedSegments + 1;
  const anyAvailable = available.last || available.next;
  const quotaPending = anyAvailable && !unlocked && !bossActive;
  const pathForkVisible = anyAvailable || bossActive;
  const visibleSelection = displayedSelection.direction
    && (available[displayedSelection.direction] || bossActive)
    ? displayedSelection.direction
    : null;
  const isSelected = (lane: 'top' | 'middle' | 'bottom', direction: CampaignRouteDirection | null) => (
    (unlocked || bossActive) && (anyAvailable || bossActive)
    && displayedSelection.lane === lane && displayedSelection.direction === direction
    && (direction === null || available[direction] || bossEncounter?.direction === direction)
  );
  const routeIsAvailable = (direction: CampaignRouteDirection) => (
    available[direction] || bossEncounter?.direction === direction
  );
  const npcImage = (id: string) => `${import.meta.env?.BASE_URL ?? '/'}skins/skill-${id}-idle.png`;

  return (
    <section className={`campaignRouteFork${unlocked ? ' unlocked' : bossActive ? ' bossActive' : ' locked'}${quotaPending ? ' quotaPending' : ''}${bossForkReady ? ' bossForkReady' : ''}`}
      data-boss-fork={bossMapVisible ? 'true' : 'false'}
      aria-label="Live bidirectional campaign route">
      <div className="campaignRouteStatus" role="status" aria-live="polite">
        <strong>{bossActive
          ? 'NPC BOSS ENCOUNTER'
          : bossForkReady
            ? 'BOSS FORK READY \u2014 SELECT A LANE'
            : unlocked
              ? 'WAVE COMPLETE \u2014 CHOOSE A ROUTE'
              : quotaPending ? 'ROUTE QUOTA SECURED' : 'ROUTE TARGETS ACTIVE'}</strong>
        <span>{bossEncounter
          ? `${bossEncounter.destination.bearing} · ${bossEncounter.destination.label} · SEG ${bossEncounter.segment}`
          : bossForkReady
            ? 'TOP / BOTTOM BOSS · MIDDLE STRAIGHT'
          : unlocked
            ? `${displayedSelection.lane.toUpperCase()} · ${visibleSelection?.toUpperCase() ?? 'STRAIGHT'}`
            : quotaPending
              ? `WAVE ${wave} · FINISH CURRENT WAVE`
              : `WAVE ${wave} · QUOTAS PENDING${wave < startWave ? ` · OPENS W${startWave}` : ''}`}</span>
        {lastTraversal && !unlocked && !quotaPending && !bossActive && (
          <span className="campaignRouteArrival">
            PATH {routeSegment} · {lastTraversal.direction.toUpperCase()} {lastTraversal.lane.toUpperCase()} ARRIVAL
          </span>
        )}
      </div>

      {pathForkVisible && <div className={`campaignRouteMap ${bossMapVisible ? 'bossMap' : 'standardMap'}`}>
        {(bossMapVisible ? ['top', 'middle', 'bottom'] as const : ['middle'] as const).map((lane) => {
          if (lane === 'middle') {
            const lastSelected = isSelected(lane, 'last');
            const nextSelected = isSelected(lane, 'next');
            return (
              <div key={lane} className={`campaignRouteLane middle${isSelected(lane, null) ? ' selected' : ''}`}>
                <span className={`routeEndpoint last${routeIsAvailable('last') ? ' available' : ' unavailable'}${lastSelected ? ' selected' : ''}`}>LAST</span>
                <span className={`routeLine last${routeIsAvailable('last') ? ' available' : ' unavailable'}${lastSelected ? ' selected' : ''}`} />
                <span className="routeStraight">STRAIGHT · OPEN PASSAGE</span>
                <span className={`routeLine next${routeIsAvailable('next') ? ' available' : ' unavailable'}${nextSelected ? ' selected' : ''}`} />
                <span className={`routeEndpoint next${routeIsAvailable('next') ? ' available' : ' unavailable'}${nextSelected ? ' selected' : ''}`}>NEXT</span>
              </div>
            );
          }
          const destinations = bossDestinations[lane];
          const lastSelected = isSelected(lane, 'last');
          const nextSelected = isSelected(lane, 'next');
          return (
            <div key={lane} className={`campaignRouteLane ${lane}${(unlocked || bossActive) && (anyAvailable || bossActive) && displayedSelection.lane === lane ? ' selectedLane' : ''}`}>
              <button type="button"
                className={`routeNpc last${routeIsAvailable('last') ? ' available' : ' unavailable'}${lastSelected ? ' selected' : ''}`}
                disabled={!unlocked || !routeIsAvailable('last')}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onSelect?.(lane === 'top' ? 0 : 2, 'last');
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  // Preserve native keyboard/screen-reader activation. The
                  // live route gate rejects the pointer-up duplicate after
                  // pointer-down has already committed the route.
                  onSelect?.(lane === 'top' ? 0 : 2, 'last');
                }}
                aria-label={`${destinations.last.bearing} ${destinations.last.label} boss route`}>
                <img src={npcImage(destinations.last.id)} alt="" />
                <small>{destinations.last.bearing} · {destinations.last.label}</small>
              </button>
              <span className={`routeBranch last${routeIsAvailable('last') ? ' available' : ' unavailable'}${lastSelected ? ' selected' : ''}`} />
              <span className="routeJunction">{lane === 'top' ? 'TOP' : 'BOTTOM'}</span>
              <span className={`routeBranch next${routeIsAvailable('next') ? ' available' : ' unavailable'}${nextSelected ? ' selected' : ''}`} />
              <button type="button"
                className={`routeNpc next${routeIsAvailable('next') ? ' available' : ' unavailable'}${nextSelected ? ' selected' : ''}`}
                disabled={!unlocked || !routeIsAvailable('next')}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onSelect?.(lane === 'top' ? 0 : 2, 'next');
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect?.(lane === 'top' ? 0 : 2, 'next');
                }}
                aria-label={`${destinations.next.bearing} ${destinations.next.label} boss route`}>
                <img src={npcImage(destinations.next.id)} alt="" />
                <small>{destinations.next.bearing} · {destinations.next.label}</small>
              </button>
            </div>
          );
        })}
      </div>}

      <div className="campaignRouteContacts" role="list" aria-label="Persistent route combat objectives">
        {(['last', 'next'] as const).map((direction) => {
          const directionHasBoss = bossEncounter?.direction === direction;
          const directionQuotaMet = available[direction];
          const directionReady = (selectable && directionQuotaMet) || directionHasBoss;
          const targetLabel = directionHasBoss ? bossEncounter.destination.label : enemies[direction].label;
          const directionLabel = direction.toUpperCase();
          const targetAcquired = directionHasBoss || targetLabel !== 'ACQUIRING TARGET';
          const targetLane = enemies[direction].row === 0
            ? 'TOP'
            : enemies[direction].row === 2 ? 'BOTTOM' : 'MIDDLE';
          const requiredHits = Math.max(0, enemies[direction].requiredHits ?? 0);
          const confirmedHits = Math.min(
            requiredHits,
            Math.max(0, enemies[direction].confirmedHits ?? 0),
          );
          const hitProgress = requiredHits > 0
            ? ` · VALID HITS ${confirmedHits}/${requiredHits}`
            : '';
          const targetState = directionHasBoss
            ? `BOSS TARGET ACTIVE \u00b7 ${bossEncounter.destination.bearing}`
            : directionReady
              ? `SELECT ${directionLabel} NOW`
              : directionQuotaMet
                ? 'QUOTA MET \u2014 FINISH WAVE'
              : anyAvailable
                ? 'LOCKED \u2014 OTHER ROUTE SECURED'
              : targetAcquired
                ? `DEFEAT TO SECURE ${directionLabel} \u00b7 ${targetLane} LANE${hitProgress}`
                : `ACQUIRING ${directionLabel} TARGET`;
          const directionSelected = (unlocked || bossActive)
            && displayedSelection.direction === direction
            && directionReady;
          const contactState = directionReady
            ? 'ready'
            : directionQuotaMet
              ? 'quotaMet'
              : anyAvailable
                ? 'unavailable'
                : 'tracking';
          return (
            <div key={direction}
              role="listitem"
              className={`campaignRouteContact ${direction} ${contactState}${directionSelected ? ' selected' : ''}`}
              aria-current={directionSelected ? 'true' : undefined}
              aria-label={`${directionLabel} route target: ${targetLabel}. ${targetState}`}>
              <span className="routeContactHeading">
                <b><i aria-hidden="true">{direction === 'last' ? 'L' : 'N'}</i>{direction === 'last' ? '\u25c0 LAST' : 'NEXT \u25b6'}</b>
                <small>SEG {displayedSegment}</small>
              </span>
              {directionHasBoss
                ? <img className="routeBossPortrait" src={npcImage(bossEncounter.destination.id)} alt={`${bossEncounter.destination.label} boss`} />
                : <canvas ref={direction === 'last' ? lastCanvasRef : nextCanvasRef} width={62} height={50} />}
              <span className="routeContactIdentity">
                <strong title={targetLabel}>TARGET: {targetLabel}</strong>
                <small className="routeContactState">{targetState}</small>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
