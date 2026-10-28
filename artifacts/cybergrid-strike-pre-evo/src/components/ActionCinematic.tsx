import { useEffect, useRef, type ReactNode } from 'react';
import { drawCampaignSkinProjectile } from '../game/renderer';
import { resolveCampaignBiome } from '../game/campaign-scenery';
import { resolveGameplayCanvasDpr } from '../game/canvas-performance';
import {
  CAMPAIGN_BOSSES_PER_STAGE,
  CAMPAIGN_PROVINCES,
  resolveCampaignBossStageIndex,
  terrainHeightAt,
} from '../game/campaign-terrain';
import type {
  CampaignRouteBossEncounter,
  CampaignRouteDirection,
  CampaignRouteLane,
} from '../game/campaign-route-director';

type Props = {
  work: number;
  global: number;
  sector: number;
  node: number;
  species: number;
  mutations: number;
  fusions: number;
  helpers: number;
  scene: number;
  wave: number;
  routeSegment: number;
  completedBosses: number;
  routeTraversal: {
    fromSegment: number;
    toSegment: number;
    direction: CampaignRouteDirection;
    lane: CampaignRouteLane;
    revision: number;
  } | null;
  playerSkin: string;
  npcSkin: string;
  getPlayerFrame: () => HTMLCanvasElement | null;
  playerOverlay?: ReactNode;
  getNpcFrame: () => HTMLCanvasElement | null;
  getEnemyFrame: () => HTMLCanvasElement | null;
  getRouteBossFrame: () => HTMLCanvasElement | null;
  routeBoss: CampaignRouteBossEncounter | null;
  getCombat: () => { versus: boolean; playerCol: number; playerRow: number; npcCol: number; npcRow: number; playerHp: number; npcHp: number; shots: Array<{ x: number; row: number; enemy: boolean; skin?: string }> };
};

const COST = 2100;
const ACTION_FIGHTER_COLUMN_STEP = 0.055;
const ACTION_CINEMATIC_FRAME_MS = 1000 / 30;
const REFERENCE_FRAME_MS = 1000 / 60;
const FRAME_ALPHA_PROBE_INTERVAL_MS = 250;
const FRAME_ALPHA_PROBE_LIMIT = 8;

type CachedFighterFrame = {
  canvas: HTMLCanvasElement;
  source: HTMLCanvasElement | null;
  sourceKey: string;
  sourceWidth: number;
  sourceHeight: number;
  visibleBottom: number;
  alphaProbeResolved: boolean;
  alphaProbeAttempts: number;
  lastAlphaProbeAt: number;
  hasFrame: boolean;
};

function frameAdjustedBlend(blendAt60Fps: number, frameScale: number): number {
  return 1 - Math.pow(1 - blendAt60Fps, Math.max(0, frameScale));
}

/**
 * Maps a fighter's local 3-column grid position into the persistent world
 * view. The center positions stay near the original composition, while the
 * edge positions are far enough apart to make horizontal tactics readable.
 */
export function resolveActionFighterX(
  side: 'player' | 'npc',
  column: number,
): number {
  const boundedColumn = Math.max(0, Math.min(2, Math.round(column)));
  const origin = side === 'player' ? 0.23 : 0.66;
  return origin + boundedColumn * ACTION_FIGHTER_COLUMN_STEP;
}

export function ActionCinematic(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerOverlayRef = useRef<HTMLSpanElement>(null);
  const stateRef = useRef(props);
  stateRef.current = props;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let shownWork = stateRef.current.work;
    const started = performance.now();
    let lastScene = stateRef.current.scene;
    let impactEnergy = 0;
    let observedWave = stateRef.current.wave;
    let observedRouteRevision = stateRef.current.routeTraversal?.revision ?? 0;
    let observedRouteSegment = stateRef.current.routeSegment;
    let observedBossStage = resolveCampaignBossStageIndex(stateRef.current.completedBosses);
    let provinceEnteredAt = performance.now();
    let cameraTravel = 0;
    let waveTravelEnergy = 0;
    let routeTravelEnergy = 0;
    let routeTravelDirection: CampaignRouteDirection | null = null;
    let routeTravelLane: CampaignRouteLane = 'middle';
    const createFrameCache = (): CachedFighterFrame => ({
      canvas: document.createElement('canvas'),
      source: null,
      sourceKey: '',
      sourceWidth: 0,
      sourceHeight: 0,
      visibleBottom: 0,
      alphaProbeResolved: false,
      alphaProbeAttempts: 0,
      lastAlphaProbeAt: Number.NEGATIVE_INFINITY,
      hasFrame: false,
    });
    const playerCache = createFrameCache();
    const npcCache = createFrameCache();
    const enemyCache = createFrameCache();
    const routeBossCache = createFrameCache();
    const provincePlates = new Map<number, HTMLImageElement>();
    const ensureProvincePlate = (index: number): HTMLImageElement | null => {
      if (index < 0 || index >= CAMPAIGN_PROVINCES.length) return null;
      const cached = provincePlates.get(index);
      if (cached) return cached;
      const image = new Image();
      image.decoding = 'async';
      image.src = `${import.meta.env.BASE_URL}action-window/${CAMPAIGN_PROVINCES[index].image}`;
      provincePlates.set(index, image);
      return image;
    };
    const ensureProvinceNeighborhood = (index: number) => {
      const retained = new Set([index - 1, index, index + 1]);
      for (const loadedIndex of provincePlates.keys()) {
        if (!retained.has(loadedIndex)) provincePlates.delete(loadedIndex);
      }
      for (const nearbyIndex of retained) ensureProvincePlate(nearbyIndex);
    };
    ensureProvinceNeighborhood(observedBossStage);

    let surfaceWidth = 1;
    let surfaceHeight = 1;
    const coarsePointer = window.matchMedia('(pointer: coarse)');
    let surfaceDpr = resolveGameplayCanvasDpr(
      window.devicePixelRatio,
      window.innerWidth <= 900 || coarsePointer.matches,
    );
    const resizeSurface = () => {
      const rect = canvas.getBoundingClientRect();
      surfaceWidth = Math.max(1, rect.width);
      surfaceHeight = Math.max(1, rect.height);
      surfaceDpr = resolveGameplayCanvasDpr(
        window.devicePixelRatio,
        window.innerWidth <= 900 || coarsePointer.matches,
      );
      const pixelWidth = Math.max(1, Math.round(surfaceWidth * surfaceDpr));
      const pixelHeight = Math.max(1, Math.round(surfaceHeight * surfaceDpr));
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
    };
    resizeSurface();
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(resizeSurface);
    resizeObserver?.observe(canvas);
    window.addEventListener('resize', resizeSurface);

    const line = (points: number[][], color: string, width = 1) => {
      ctx.beginPath();
      points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
    };
    const cacheValidFrame = (
      source: HTMLCanvasElement | null,
      cache: CachedFighterFrame,
      now: number,
      sourceKey: string,
    ) => {
      if (!source || !source.width || !source.height) return;
      const sourceChanged = cache.source !== source
        || cache.sourceKey !== sourceKey
        || cache.sourceWidth !== source.width
        || cache.sourceHeight !== source.height;
      if (sourceChanged) {
        cache.source = source;
        cache.sourceKey = sourceKey;
        cache.sourceWidth = source.width;
        cache.sourceHeight = source.height;
        cache.visibleBottom = source.height;
        cache.alphaProbeResolved = false;
        cache.alphaProbeAttempts = 0;
        cache.lastAlphaProbeAt = Number.NEGATIVE_INFINITY;
        cache.hasFrame = false;
        if (cache.canvas.width !== source.width || cache.canvas.height !== source.height) {
          cache.canvas.width = source.width;
          cache.canvas.height = source.height;
        }
      }

      // Finding the authored foot line requires a CPU read once per new source,
      // not once per paint. Blank startup frames retry at a deliberately low
      // rate, then fall back to the full source height.
      if (!cache.alphaProbeResolved
        && cache.alphaProbeAttempts < FRAME_ALPHA_PROBE_LIMIT
        && now - cache.lastAlphaProbeAt >= FRAME_ALPHA_PROBE_INTERVAL_MS) {
        cache.lastAlphaProbeAt = now;
        cache.alphaProbeAttempts++;
        const sourceCtx = source.getContext('2d');
        if (sourceCtx) {
          try {
            const pixels = sourceCtx.getImageData(0, 0, source.width, source.height).data;
            let visibleBottom = 0;
            outer: for (let py = source.height - 1; py >= 0; py -= 1) {
              for (let px = 0; px < source.width; px += 2) {
                if (pixels[(py * source.width + px) * 4 + 3] > 18) {
                  visibleBottom = py + 1;
                  break outer;
                }
              }
            }
            if (visibleBottom > 0) {
              cache.visibleBottom = visibleBottom;
              cache.alphaProbeResolved = true;
            }
          } catch {
            cache.alphaProbeResolved = true;
          }
        }
        if (cache.alphaProbeAttempts >= FRAME_ALPHA_PROBE_LIMIT) {
          cache.alphaProbeResolved = true;
        }
      }

      // Canvas-to-canvas copies stay on the rendering path. They preserve the
      // latest complete fighter frame without forcing a synchronous readback.
      const cacheCtx = cache.canvas.getContext('2d');
      if (!cacheCtx) return;
      cacheCtx.clearRect(0, 0, cache.canvas.width, cache.canvas.height);
      cacheCtx.drawImage(source, 0, 0);
      cache.hasFrame = true;
    };
    let lastPaintAt = 0;
    const draw = (now: number) => {
      const elapsedSincePaint = lastPaintAt > 0 ? now - lastPaintAt : REFERENCE_FRAME_MS;
      if (lastPaintAt > 0 && elapsedSincePaint < ACTION_CINEMATIC_FRAME_MS) {
        raf = requestAnimationFrame(draw);
        return;
      }
      lastPaintAt = now;
      const frameScale = elapsedSincePaint / REFERENCE_FRAME_MS;
      const p = stateRef.current;
      const playerOverlay = playerOverlayRef.current;
      const combat = p.getCombat();
      if (!p.playerOverlay) {
        cacheValidFrame(p.getPlayerFrame(), playerCache, now, `player:${p.playerSkin}`);
      }
      if (p.routeBoss) {
        cacheValidFrame(
          p.getRouteBossFrame?.() ?? null,
          routeBossCache,
          now,
          `boss:${p.routeBoss.destination.id}`,
        );
      } else if (combat.versus) {
        cacheValidFrame(p.getNpcFrame(), npcCache, now, `npc:${p.npcSkin}`);
      } else {
        cacheValidFrame(p.getEnemyFrame(), enemyCache, now, 'campaign-enemy');
      }
      if (p.scene !== lastScene) {
        if (p.scene === 1 || p.scene === 2) {
          impactEnergy = 1;
        }
        lastScene = p.scene;
      }
      if (p.wave !== observedWave) {
        observedWave = p.wave;
        waveTravelEnergy = 1;
      }
      const routeRevision = p.routeTraversal?.revision ?? 0;
      if (routeRevision !== observedRouteRevision || p.routeSegment !== observedRouteSegment) {
        observedRouteRevision = routeRevision;
        observedRouteSegment = p.routeSegment;
        routeTravelDirection = p.routeTraversal?.direction ?? null;
        routeTravelLane = p.routeTraversal?.lane ?? 'middle';
        routeTravelEnergy = 1;
      }
      const bossStage = resolveCampaignBossStageIndex(p.completedBosses);
      if (bossStage !== observedBossStage) {
        observedBossStage = bossStage;
        cameraTravel = 0;
        provinceEnteredAt = performance.now();
        ensureProvinceNeighborhood(bossStage);
      }
      waveTravelEnergy *= Math.pow(.992, frameScale);
      routeTravelEnergy *= Math.pow(.986, frameScale);
      impactEnergy *= Math.pow(.982, frameScale);
      shownWork += (p.work - shownWork) * frameAdjustedBlend(.035, frameScale);
      ctx.setTransform(surfaceDpr,0,0,surfaceDpr,0,0);
      const W = surfaceWidth, H = surfaceHeight;
      const completed=Math.floor(shownWork/COST), progress=(shownWork%COST)/COST;
      const damage=p.node>=80?0:p.node>=65?1:p.node>=50?2:p.node>=35?3:p.node>=20?4:5;
      const sky=ctx.createLinearGradient(0,0,0,H); sky.addColorStop(0,p.node<35?'#271226':'#09243b'); sky.addColorStop(1,'#020914'); ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);
      const campaignProgress = completed + progress;
      // The game awards Work in visible 100-point beats. Each beat owns one eighth
      // of the current scene so a single meaningful event cannot disappear as a
      // sub-pixel camera adjustment.
      const workBeat = Math.floor(shownWork / 100);
      const damagePenalty = p.node >= 70 ? 0 : p.node >= 50 ? 1 : p.node >= 30 ? 2 : 3;
      const restoredStage = Math.max(0, Math.min(8, workBeat - damagePenalty));
      const restoredDepth = restoredStage / 8;
      const frontierX = W * restoredDepth;
      const provinceIndex = bossStage;
      const biome = resolveCampaignBiome(p.global, provinceIndex * CAMPAIGN_BOSSES_PER_STAGE + 1);
      const province = CAMPAIGN_PROVINCES[provinceIndex];
      const provincePlate = ensureProvincePlate(provinceIndex);
      if (provincePlate?.complete && provincePlate.naturalWidth) {
        const elapsed = now - provinceEnteredAt;
        const introLinear = Math.max(0, Math.min(1, (elapsed - 900) / 3600));
        const intro = introLinear * introLinear * (3 - 2 * introLinear);
        // Every four defeated bosses own one authored province. Each victory
        // advances the camera by a readable quarter-stage beat, independently
        // of Last/Next navigation, which is intentionally reversible.
        const campaignCapacity = CAMPAIGN_PROVINCES.length * CAMPAIGN_BOSSES_PER_STAGE;
        const bossStageTravel = p.completedBosses >= campaignCapacity
          ? 1
          : (p.completedBosses % CAMPAIGN_BOSSES_PER_STAGE) / CAMPAIGN_BOSSES_PER_STAGE;
        const operationTravel = bossStageTravel + progress * .08;
        const integritySetback = Math.min(.055, (100 - p.node) / 100 * .055);
        const impactRecoil = impactEnergy * .018;
        const provinceProgress = Math.max(0, Math.min(1,
          operationTravel - integritySetback - impactRecoil));
        cameraTravel += (provinceProgress - cameraTravel) * frameAdjustedBlend(
          impactEnergy > .08 ? .16 : .09,
          frameScale,
        );
        const establish = province.camera.establish;
        const groundView = province.camera.ground;
        const maximumGroundX = 1 - groundView[2];
        const targetGroundX = maximumGroundX * cameraTravel;
        const viewX = establish[0] + (targetGroundX - establish[0]) * intro;
        const viewY = establish[1] + (groundView[1] - establish[1]) * intro;
        const viewW = establish[2] + (groundView[2] - establish[2]) * intro;
        const viewH = establish[3] + (groundView[3] - establish[3]) * intro;
        ctx.drawImage(
          provincePlate,
          viewX * provincePlate.naturalWidth,
          viewY * provincePlate.naturalHeight,
          viewW * provincePlate.naturalWidth,
          viewH * provincePlate.naturalHeight,
          0, 0, W, H,
        );
        const biomeVeil=ctx.createLinearGradient(0,0,0,H);
        biomeVeil.addColorStop(0,`${biome.sky}44`);biomeVeil.addColorStop(1,`${biome.ground}55`);
        ctx.fillStyle=biomeVeil;ctx.fillRect(0,0,W,H);
        if (waveTravelEnergy > .03) {
          const travelVeil=ctx.createLinearGradient(0,0,W,0);
          travelVeil.addColorStop(0,'rgba(42,202,213,0)');travelVeil.addColorStop(.5,`rgba(196,255,244,${waveTravelEnergy*.18})`);travelVeil.addColorStop(1,'rgba(117,61,170,0)');
          ctx.fillStyle=travelVeil;ctx.fillRect(0,0,W,H);
        }
        // Consume the already-normalized frame canvases used by the live battle.
        // This preserves alpha cleanup, cropping, authored timing, and frame blend.
        const fighterH = H * .58;
        const drawFighter = (source: CachedFighterFrame, x: number, y: number, flip: boolean) => {
          if (!source.hasFrame || !source.canvas.width || !source.canvas.height) return;
          const scale = fighterH / source.canvas.height;
          const fw = source.canvas.width * scale;
          ctx.save(); ctx.translate(x, y); ctx.scale(flip ? -1 : 1, 1);
          ctx.shadowColor = 'rgba(0,0,0,.85)'; ctx.shadowBlur = 8;
          // Align the lowest opaque sprite pixel to the authored terrain curve;
          // transparent padding in animation canvases no longer creates hover.
          ctx.drawImage(source.canvas, -fw / 2, -source.visibleBottom * scale, fw, fighterH);
          ctx.restore();
        };
        const playerX = W * resolveActionFighterX('player', combat.playerCol);
        const npcX = W * resolveActionFighterX('npc', combat.npcCol);
        const screenToWorldX = (screenX: number) => viewX + (screenX / W) * viewW;
        const groundToScreenY = (worldX: number) =>
          ((terrainHeightAt(province, worldX) - viewY) / viewH) * H;
        const playerGround = groundToScreenY(screenToWorldX(playerX));
        const npcGround = groundToScreenY(screenToWorldX(npcX));
        const actorReveal = Math.max(0, Math.min(1, (intro - .58) / .32));
        const actorOpacity = actorReveal * (1 - waveTravelEnergy * .38);
        ctx.globalAlpha = actorOpacity;
        if (p.playerOverlay && playerOverlay) {
          playerOverlay.style.display = 'block';
          playerOverlay.style.left = `${playerX}px`;
          playerOverlay.style.top = `${playerGround}px`;
          playerOverlay.style.width = `${fighterH}px`;
          playerOverlay.style.height = `${fighterH}px`;
          playerOverlay.style.opacity = `${actorOpacity}`;
        } else {
          if (playerOverlay) playerOverlay.style.display = 'none';
          drawFighter(playerCache, playerX, playerGround, false);
        }
        const opponentFrame = p.routeBoss ? routeBossCache : combat.versus ? npcCache : enemyCache;
        // Live opponent sources retain their battle orientation. Route bosses
        // come from player-authored idle art, so mirror that dedicated frame to
        // make the encountered NPC face back toward the player.
        drawFighter(opponentFrame, npcX, npcGround, Boolean(p.routeBoss));
        if (p.routeBoss) {
          const label = `BOSS CONTACT · ${p.routeBoss.destination.label} · ${p.routeBoss.destination.bearing}`;
          ctx.save();
          ctx.globalAlpha = actorReveal;
          ctx.font = '800 8px system-ui';
          ctx.textAlign = 'center';
          const labelWidth = Math.min(W - 20, ctx.measureText(label).width + 18);
          ctx.fillStyle = 'rgba(3, 12, 28, .86)';
          ctx.strokeStyle = 'rgba(255, 222, 105, .88)';
          ctx.lineWidth = 1;
          ctx.fillRect(W / 2 - labelWidth / 2, 6, labelWidth, 15);
          ctx.strokeRect(W / 2 - labelWidth / 2, 6, labelWidth, 15);
          ctx.fillStyle = '#fff0a5';
          ctx.fillText(label, W / 2, 17);
          ctx.restore();
        }
        // Tactical projectiles become spatial action within the persistent shot.
        for (const shot of combat.shots) {
          const sx = shot.enemy ? W * (.5 + shot.x / 6 * .34) : W * (.18 + shot.x / 6 * .34);
          const shotGround = groundToScreenY(screenToWorldX(sx));
          const sy = shotGround - fighterH * .42 + (shot.row - 1) * H * .025;
          const direction = shot.enemy ? -1 : 1;
          // Render the same sheet, tween frames, timing and orientation as the
          // live grid. The strip adds no replacement shell or generic tracer.
          drawCampaignSkinProjectile(
            ctx, sx, sy, Math.max(2.1, H * .024), direction, now,
            shot.skin ?? (shot.enemy ? p.npcSkin : p.playerSkin),
          );

          const targetX = shot.enemy ? playerX : npcX;
          if (Math.abs(sx - targetX) < W * .045) {
            const impact = Math.max(0, 1 - Math.abs(sx - targetX) / (W * .045));
            const bloom = ctx.createRadialGradient(targetX, sy, 0, targetX, sy, 15 + impact * 8);
            bloom.addColorStop(0, shot.enemy ? `rgba(255,119,157,${impact})` : `rgba(152,255,232,${impact})`);
            bloom.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = bloom; ctx.fillRect(targetX - 25, sy - 25, 50, 50);
          }
        }
        // Advantage changes staging without changing scenes.
        const advantage = Math.max(-1, Math.min(1, (combat.playerHp - combat.npcHp) / 12));
        ctx.fillStyle = advantage >= 0 ? `rgba(84,255,220,${advantage*.12})` : `rgba(255,66,130,${-advantage*.12})`;
        ctx.fillRect(0, H*.4, W, H*.5);
        if ((lastScene === 1 || lastScene === 2) && impactEnergy > .04) {
          const impactX=W*.5;const burst=ctx.createRadialGradient(impactX,H*.58,0,impactX,H*.58,W*.15);
          burst.addColorStop(0,lastScene===1?`rgba(117,255,230,${impactEnergy*.8})`:`rgba(255,64,147,${impactEnergy*.82})`);burst.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=burst;ctx.fillRect(0,0,W,H);
        }
        ctx.globalAlpha = 1;
      } else if (playerOverlay) {
        playerOverlay.style.display = 'none';
      }
      // First draw the entire campaign as unresolved/corrupted territory, then reveal
      // the fully restored version behind the metric-driven frontier. This makes
      // progression a material world-state change rather than an imperceptible pan.
      if (waveTravelEnergy > .04) {
        ctx.globalAlpha=Math.min(1,waveTravelEnergy*1.8);ctx.fillStyle='rgba(240,255,252,.96)';ctx.font='700 9px system-ui';ctx.textAlign='center';
        ctx.fillText(`WAVE ${p.wave} · ${province.label}`,W*.5,H*.22);ctx.globalAlpha=1;
      }
      if (routeTravelEnergy > .03 && routeTravelDirection) {
        const direction = routeTravelDirection === 'next' ? 1 : -1;
        const sweepX = direction > 0 ? W * (1 - routeTravelEnergy) : W * routeTravelEnergy;
        const routeSweep = ctx.createLinearGradient(sweepX - W * .28, 0, sweepX + W * .28, 0);
        routeSweep.addColorStop(0, 'rgba(37,219,255,0)');
        routeSweep.addColorStop(.5, `rgba(128,255,226,${routeTravelEnergy * .26})`);
        routeSweep.addColorStop(1, 'rgba(37,219,255,0)');
        ctx.fillStyle = routeSweep;
        ctx.fillRect(0, 0, W, H);
        ctx.save();
        ctx.globalAlpha = Math.min(1, routeTravelEnergy * 1.7);
        ctx.fillStyle = 'rgba(2,10,24,.82)';
        ctx.strokeStyle = 'rgba(128,255,226,.9)';
        ctx.lineWidth = 1;
        const routeLabel = `${routeTravelDirection === 'last' ? '\u25c0 LAST' : 'NEXT \u25b6'} · ${routeTravelLane.toUpperCase()} · PATH ${p.routeSegment}`;
        ctx.font = '800 9px system-ui';
        ctx.textAlign = 'center';
        const routeLabelWidth = Math.min(W - 18, ctx.measureText(routeLabel).width + 20);
        ctx.fillRect(W / 2 - routeLabelWidth / 2, H - 24, routeLabelWidth, 17);
        ctx.strokeRect(W / 2 - routeLabelWidth / 2, H - 24, routeLabelWidth, 17);
        ctx.fillStyle = '#c8fff0';
        ctx.fillText(routeLabel, W / 2, H - 12);
        ctx.restore();
      }
      // Damage changes the atmosphere without drawing unexplained marks over actors.
      if(damage>1){ctx.fillStyle=`rgba(255,55,101,${.025*damage})`;ctx.fillRect(0,0,W,H);}
      raf=requestAnimationFrame(draw);
    };
    raf=requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', resizeSurface);
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="actionCinematicCanvas"
        data-route-segment={props.routeSegment}
        aria-label={`Living System Integrity cinematic, route segment ${props.routeSegment}`} />
      {props.playerOverlay && (
        <span ref={playerOverlayRef} className="actionCinematicPlayerOverlay" aria-hidden="true">
          {props.playerOverlay}
        </span>
      )}
    </>
  );
}
