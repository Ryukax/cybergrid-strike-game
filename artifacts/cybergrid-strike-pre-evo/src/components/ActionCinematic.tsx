import { useEffect, useRef } from 'react';
import { drawCampaignSkinProjectile } from '../game/renderer';
import { resolveCampaignBiome } from '../game/campaign-scenery';
import { CAMPAIGN_PROVINCES, terrainHeightAt } from '../game/campaign-terrain';
import { ENCOUNTERS_PER_OPERATION, OPERATIONS_PER_ACT, resolveCampaignProgress } from '../game/campaign-director';

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
  playerSkin: string;
  npcSkin: string;
  getPlayerFrame: () => HTMLCanvasElement | null;
  getNpcFrame: () => HTMLCanvasElement | null;
  getEnemyFrame: () => HTMLCanvasElement | null;
  getCombat: () => { versus: boolean; playerCol: number; playerRow: number; npcCol: number; npcRow: number; playerHp: number; npcHp: number; shots: Array<{ x: number; row: number; enemy: boolean; skin?: string }> };
};

const COST = 2100;

export function ActionCinematic(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
    let provinceEnteredAt = performance.now();
    let cameraTravel = 0;
    let waveTravelEnergy = 0;
    const playerCache = document.createElement('canvas');
    const npcCache = document.createElement('canvas');
    const enemyCache = document.createElement('canvas');
    const provincePlates = CAMPAIGN_PROVINCES.map((province) => {
      const image = new Image();
      image.src = `${import.meta.env.BASE_URL}action-window/${province.image}`;
      return image;
    });

    const line = (points: number[][], color: string, width = 1) => {
      ctx.beginPath();
      points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
    };
    const cacheValidFrame = (source: HTMLCanvasElement | null, cache: HTMLCanvasElement) => {
      if (!source || !source.width || !source.height) return;
      const sourceCtx = source.getContext('2d', { willReadFrequently: true });
      if (!sourceCtx) return;
      // The battle renderer clears before drawing. Do not replace a good frame
      // with that transient blank state.
      const pixels = sourceCtx.getImageData(0, 0, source.width, source.height).data;
      let occupied = false;
      for (let i = 3; i < pixels.length; i += 32) {
        if (pixels[i] > 8) { occupied = true; break; }
      }
      if (!occupied) return;
      if (cache.width !== source.width || cache.height !== source.height) {
        cache.width = source.width; cache.height = source.height;
      }
      const cacheCtx = cache.getContext('2d');
      cacheCtx?.clearRect(0, 0, cache.width, cache.height);
      cacheCtx?.drawImage(source, 0, 0);
    };
    const draw = (now: number) => {
      const p = stateRef.current;
      cacheValidFrame(p.getPlayerFrame(), playerCache);
      cacheValidFrame(p.getNpcFrame(), npcCache);
      cacheValidFrame(p.getEnemyFrame(), enemyCache);
      if (p.scene !== lastScene) {
        if (p.scene === 1 || p.scene === 2) {
          impactEnergy = 1;
        }
        lastScene = p.scene;
      }
      if (p.wave !== observedWave) {
        const previousOperation = Math.floor((Math.max(1, observedWave) - 1) / ENCOUNTERS_PER_OPERATION);
        const nextOperation = Math.floor((Math.max(1, p.wave) - 1) / ENCOUNTERS_PER_OPERATION);
        if (previousOperation !== nextOperation) {
          cameraTravel = 0;
          provinceEnteredAt = performance.now();
        }
        observedWave = p.wave;
        waveTravelEnergy = 1;
      }
      waveTravelEnergy *= .992;
      impactEnergy *= .982;
      shownWork += (p.work - shownWork) * .035;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, devicePixelRatio || 1);
      const w = Math.max(1, Math.round(rect.width * dpr)), h = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      ctx.setTransform(dpr,0,0,dpr,0,0); const W=rect.width, H=rect.height;
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
      const combat = p.getCombat();
      const biome = resolveCampaignBiome(p.global, p.wave);
      const campaign = resolveCampaignProgress(p.wave);
      const operationAbsolute = campaign.actIndex * OPERATIONS_PER_ACT + campaign.operationIndex;
      const provinceIndex = operationAbsolute % CAMPAIGN_PROVINCES.length;
      const province = CAMPAIGN_PROVINCES[provinceIndex];
      const provincePlate = provincePlates[provinceIndex];
      if (provincePlate.complete && provincePlate.naturalWidth) {
        const elapsed = now - provinceEnteredAt;
        const introLinear = Math.max(0, Math.min(1, (elapsed - 900) / 3600));
        const intro = introLinear * introLinear * (3 - 2 * introLinear);
        // Every operation owns an entire location and traverses it in ten
        // readable beats. The next operation cuts to a fresh establishing shot
        // instead of spending a whole act parked on one cropped screen.
        const encounterBeat = Math.floor(campaign.encounterIndex / 2) / 10;
        const operationTravel = encounterBeat + progress * .1;
        const integritySetback = Math.min(.055, (100 - p.node) / 100 * .055);
        const impactRecoil = impactEnergy * .018;
        const provinceProgress = Math.max(0, Math.min(1,
          operationTravel - integritySetback - impactRecoil));
        cameraTravel += (provinceProgress - cameraTravel) * (impactEnergy > .08 ? .16 : .09);
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
        const drawFighter = (source: HTMLCanvasElement | null, x: number, y: number, flip: boolean) => {
          if (!source || !source.width || !source.height) return;
          const sourceCtx = source.getContext('2d', { willReadFrequently: true });
          let visibleBottom = source.height;
          if (sourceCtx) {
            const pixels = sourceCtx.getImageData(0, 0, source.width, source.height).data;
            outer: for (let py = source.height - 1; py >= 0; py -= 1) {
              for (let px = 0; px < source.width; px += 2) {
                if (pixels[(py * source.width + px) * 4 + 3] > 18) {
                  visibleBottom = py + 1;
                  break outer;
                }
              }
            }
          }
          const scale = fighterH / source.height;
          const fw = source.width * scale;
          ctx.save(); ctx.translate(x, y); ctx.scale(flip ? -1 : 1, 1);
          ctx.shadowColor = 'rgba(0,0,0,.85)'; ctx.shadowBlur = 8;
          // Align the lowest opaque sprite pixel to the authored terrain curve;
          // transparent padding in animation canvases no longer creates hover.
          ctx.drawImage(source, -fw / 2, -visibleBottom * scale, fw, fighterH); ctx.restore();
        };
        const playerX = W * (.28 + combat.playerCol / 3 * .035);
        const npcX = W * (.70 + combat.npcCol / 3 * .035);
        const screenToWorldX = (screenX: number) => viewX + (screenX / W) * viewW;
        const groundToScreenY = (worldX: number) =>
          ((terrainHeightAt(province, worldX) - viewY) / viewH) * H;
        const playerGround = groundToScreenY(screenToWorldX(playerX));
        const npcGround = groundToScreenY(screenToWorldX(npcX));
        const actorReveal = Math.max(0, Math.min(1, (intro - .58) / .32));
        ctx.globalAlpha = actorReveal * (1 - waveTravelEnergy * .38);
        drawFighter(playerCache, playerX, playerGround, false);
        const opponentFrame = combat.versus ? npcCache : enemyCache;
        // Both opponent sources already retain their live-battle orientation:
        // procedural enemies face left, and the Versus NPC canvas is mirrored
        // before it is cached here. A second flip would make the NPC face away.
        drawFighter(opponentFrame, npcX, npcGround, false);
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
      }
      // First draw the entire campaign as unresolved/corrupted territory, then reveal
      // the fully restored version behind the metric-driven frontier. This makes
      // progression a material world-state change rather than an imperceptible pan.
      if (waveTravelEnergy > .04) {
        ctx.globalAlpha=Math.min(1,waveTravelEnergy*1.8);ctx.fillStyle='rgba(240,255,252,.96)';ctx.font='700 9px system-ui';ctx.textAlign='center';
        ctx.fillText(`WAVE ${p.wave} · ${biome.label}`,W*.5,H*.22);ctx.globalAlpha=1;
      }
      // Damage changes the atmosphere without drawing unexplained marks over actors.
      if(damage>1){ctx.fillStyle=`rgba(255,55,101,${.025*damage})`;ctx.fillRect(0,0,W,H);}
      raf=requestAnimationFrame(draw);
    };
    raf=requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} className="actionCinematicCanvas" aria-label="Living System Integrity cinematic" />;
}
