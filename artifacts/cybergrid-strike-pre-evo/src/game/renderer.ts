import type { GameState, BoardMetrics } from './types';
import { drawVirus } from './virus-morphology';
import type { EntityDrawContext } from './virus-morphology';

const NICHE_COLORS: Record<string, string> = {
  scout: '#67e8f9',
  bulwark: '#fbbf24',
  hunter: '#fb7185',
  swarm: '#a3e635',
  regenerator: '#4ade80',
  phase: '#c084fc',
  symbiote: '#f472b6',
  opportunist: '#fb923c',
};

function visualGene(seed: number, salt: number): number {
  const value = Math.sin(seed * 12.9898 + salt * 91.731) * 43758.5453;
  return value - Math.floor(value);
}

function drawGeneratedAppendages(
  ctx: CanvasRenderingContext2D,
  seed: number,
  radius: number,
  color: string,
): void {
  const count = 2 + Math.floor(visualGene(seed, 30) * 6);
  const mode = Math.floor(visualGene(seed, 31) * 4);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.72;
  ctx.lineCap = 'round';
  for (let index = 0; index < count; index++) {
    const baseAngle = (index / count) * Math.PI * 2;
    const angle = baseAngle + (visualGene(seed, 40 + index) - 0.5) * 0.38;
    const inner = radius * (0.2 + visualGene(seed, 60 + index) * 0.08);
    const length = radius * (0.18 + visualGene(seed, 80 + index) * 0.32);
    const x1 = Math.cos(angle) * inner;
    const y1 = Math.sin(angle) * inner;
    const x2 = Math.cos(angle) * (inner + length);
    const y2 = Math.sin(angle) * (inner + length);
    ctx.lineWidth = 1.2 + visualGene(seed, 100 + index) * 2.2;
    if (mode === 0) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(
        x1 + (visualGene(seed, 120 + index) - 0.5) * radius * 0.35,
        y1 + (visualGene(seed, 140 + index) - 0.5) * radius * 0.35,
        x2,
        y2,
      );
      ctx.stroke();
    } else if (mode === 1) {
      const wing = 2 + visualGene(seed, 160 + index) * 4;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2 - Math.sin(angle) * wing, y2 + Math.cos(angle) * wing);
      ctx.lineTo(x2 + Math.sin(angle) * wing, y2 - Math.cos(angle) * wing);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      if (mode === 3) {
        ctx.beginPath();
        ctx.arc(x2, y2, 1.5 + visualGene(seed, 180 + index) * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

function drawModularEntity(
  ctx: CanvasRenderingContext2D,
  seed: number,
  cell: number,
  accent: string,
  flash: boolean,
  now: number,
  hpFrac: number,
): void {
  const topology = Math.floor(visualGene(seed, 200) * 8);
  const complexity = 3 + Math.floor(visualGene(seed, 201) * 7);
  const radius = cell * (0.19 + visualGene(seed, 202) * 0.1);
  const pulse = 1 + Math.sin(now * (0.0014 + visualGene(seed, 203) * 0.0018) + seed) * 0.045;
  const hue = Math.floor(visualGene(seed, 204) * 360);
  const fill = flash ? '#fff' : `hsl(${hue} 72% ${42 + Math.floor(visualGene(seed, 205) * 24)}%)`;
  const secondary = `hsl(${(hue + 55 + Math.floor(visualGene(seed, 206) * 120)) % 360} 78% 64%)`;
  ctx.save();
  ctx.scale(pulse, pulse);
  ctx.shadowColor = accent;
  ctx.shadowBlur = 7 + visualGene(seed, 207) * 9;
  ctx.fillStyle = fill;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.2 + visualGene(seed, 208) * 1.8;

  if (topology === 0 || topology === 6) {
    ctx.beginPath();
    for (let point = 0; point < complexity; point++) {
      const angle = point / complexity * Math.PI * 2;
      const noise = topology === 6 ? 0.55 + visualGene(seed, 220 + point) * 0.75 : 0.82 + visualGene(seed, 220 + point) * 0.28;
      const x = Math.cos(angle) * radius * noise;
      const y = Math.sin(angle) * radius * noise;
      if (point === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (topology === 1) {
    const lobes = 2 + Math.floor(visualGene(seed, 240) * 6);
    for (let lobe = 0; lobe < lobes; lobe++) {
      const angle = lobe / lobes * Math.PI * 2;
      const distance = radius * (0.25 + visualGene(seed, 250 + lobe) * 0.3);
      const size = radius * (0.35 + visualGene(seed, 260 + lobe) * 0.35);
      ctx.beginPath();
      ctx.ellipse(Math.cos(angle) * distance, Math.sin(angle) * distance, size, size * (0.6 + visualGene(seed, 270 + lobe) * 0.6), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  } else if (topology === 2) {
    const segments = 3 + Math.floor(visualGene(seed, 280) * 5);
    for (let segment = 0; segment < segments; segment++) {
      const x = (segment - (segments - 1) / 2) * radius * 0.48;
      const y = Math.sin(segment * 1.7 + seed) * radius * 0.2;
      const size = radius * (0.34 + visualGene(seed, 290 + segment) * 0.2);
      ctx.beginPath();
      ctx.ellipse(x, y, size, size * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  } else if (topology === 3) {
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.arc(0, 0, radius * (0.35 + visualGene(seed, 310) * 0.28), 0, Math.PI * 2, true);
    ctx.fill('evenodd');
    ctx.stroke();
  } else if (topology === 4) {
    const shards = 3 + Math.floor(visualGene(seed, 320) * 6);
    for (let shard = 0; shard < shards; shard++) {
      const angle = shard / shards * Math.PI * 2;
      const length = radius * (0.65 + visualGene(seed, 330 + shard) * 0.8);
      const width = radius * (0.12 + visualGene(seed, 340 + shard) * 0.24);
      ctx.beginPath();
      ctx.moveTo(-Math.sin(angle) * width, Math.cos(angle) * width);
      ctx.lineTo(Math.cos(angle) * length, Math.sin(angle) * length);
      ctx.lineTo(Math.sin(angle) * width, -Math.cos(angle) * width);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  } else if (topology === 5) {
    const gap = radius * (0.24 + visualGene(seed, 350) * 0.3);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * gap, 0, radius * 0.62, radius * (0.55 + visualGene(seed, 351) * 0.5), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  } else {
    const arms = 3 + Math.floor(visualGene(seed, 360) * 6);
    for (let arm = 0; arm < arms; arm++) {
      const angle = arm / arms * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle - 0.22) * radius * 0.38, Math.sin(angle - 0.22) * radius * 0.38);
      ctx.lineTo(Math.cos(angle) * radius * (0.9 + visualGene(seed, 370 + arm) * 0.55), Math.sin(angle) * radius * (0.9 + visualGene(seed, 370 + arm) * 0.55));
      ctx.lineTo(Math.cos(angle + 0.22) * radius * 0.38, Math.sin(angle + 0.22) * radius * 0.38);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  ctx.shadowBlur = 0;
  const coreMode = Math.floor(visualGene(seed, 390) * 5);
  ctx.fillStyle = secondary;
  if (coreMode === 0) {
    ctx.beginPath(); ctx.arc(0, 0, radius * 0.3, 0, Math.PI * 2); ctx.fill();
  } else if (coreMode === 1) {
    ctx.fillRect(-radius * 0.26, -radius * 0.26, radius * 0.52, radius * 0.52);
  } else if (coreMode === 2) {
    ctx.beginPath();
    ctx.moveTo(0, -radius * 0.38); ctx.lineTo(radius * 0.34, radius * 0.28); ctx.lineTo(-radius * 0.34, radius * 0.28); ctx.closePath(); ctx.fill();
  } else if (coreMode === 3) {
    const eyes = 2 + Math.floor(visualGene(seed, 391) * 4);
    for (let eye = 0; eye < eyes; eye++) {
      const angle = eye / eyes * Math.PI * 2;
      ctx.beginPath(); ctx.arc(Math.cos(angle) * radius * 0.32, Math.sin(angle) * radius * 0.32, radius * 0.1, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    ctx.strokeStyle = secondary;
    ctx.lineWidth = radius * 0.12;
    ctx.beginPath(); ctx.arc(0, 0, radius * 0.28, 0, Math.PI * 1.5); ctx.stroke();
  }
  if (hpFrac < 0.5) {
    ctx.globalAlpha = 0.35 + hpFrac;
  }
  ctx.restore();
}

export function getBoardMetrics(w: number, h: number): BoardMetrics {
  const cell = Math.min(w / 6.8, h / 8.2);
  const boardW = cell * 6;
  const boardH = cell * 3;
  const x = (w - boardW) * 0.5;
  const y = Math.max(h * 0.24, 90);
  return { cell, boardW, boardH, x, y };
}

type Ctx2D = CanvasRenderingContext2D & {
  roundRect: (x: number, y: number, w: number, h: number, r: number) => void;
};


export function draw(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: GameState,
  hasOverlay?: boolean,
) {
  // Opaque base — covers any DOM elements behind the canvas (e.g. keeper img)
  ctx.fillStyle = '#06101e';
  ctx.fillRect(0, 0, w, h);

  const m = getBoardMetrics(w, h);
  const splitX = m.x + m.cell * 3;
  const vs = state.gameMode === 'vs';

  // Subtle frame overlay
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, 'rgba(8, 20, 40, 0.16)');
  bg.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Scanlines
  for (let i = 0; i < 28; i++) {
    const yy = (i * 47 + (performance.now() * 0.03)) % (h + 60) - 30;
    ctx.fillStyle = 'rgba(56,189,248,0.05)';
    ctx.fillRect(0, yy, w, 1);
  }

  // Grid cells
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 6; c++) {
      const cx = m.x + c * m.cell;
      const cy = m.y + r * m.cell;
      const playerSide = c < 3;
      const npcSide = !playerSide && vs;

      // Flash highlights
      const playerFlash = playerSide && c === state.player.col && r === state.player.row && state.moveFlash > 0;
      const npcFlash = npcSide && (3 + state.npc.col) === c && state.npc.row === r;

      if (playerFlash) {
        ctx.fillStyle = 'rgba(96,165,250,0.28)';
      } else if (playerSide) {
        ctx.fillStyle = 'rgba(59,130,246,0.12)';
      } else if (npcFlash) {
        ctx.fillStyle = 'rgba(52,211,153,0.28)';
      } else if (npcSide) {
        ctx.fillStyle = 'rgba(52,211,153,0.10)';
      } else {
        ctx.fillStyle = 'rgba(244,63,94,0.10)';
      }

      ctx.fillRect(cx + 2, cy + 2, m.cell - 4, m.cell - 4);

      if (playerSide) {
        ctx.strokeStyle = 'rgba(125,211,252,0.55)';
      } else if (npcSide) {
        ctx.strokeStyle = 'rgba(52,211,153,0.45)';
      } else {
        ctx.strokeStyle = 'rgba(251,113,133,0.45)';
      }
      ctx.lineWidth = 2;
      ctx.strokeRect(cx + 2, cy + 2, m.cell - 4, m.cell - 4);
    }
  }

  // Center divider
  ctx.strokeStyle = 'rgba(253,224,71,0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(splitX, m.y + 4);
  ctx.lineTo(splitX, m.y + m.boardH - 4);
  ctx.stroke();

  // Player ghost aura + shield ring
  const playerX = m.x + (state.player.col + 0.5) * m.cell;
  const playerY = m.y + (state.player.row + 0.5) * m.cell;

  if (state.ghostTimer > 0) {
    // Pulsing cyan ghost aura
    const pulse = 0.45 + 0.2 * Math.sin(performance.now() * 0.008);
    ctx.strokeStyle = `rgba(125,211,252,${pulse})`;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(playerX, playerY, m.cell * 0.42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (state.shieldCharges > 0) {
    ctx.strokeStyle = 'rgba(134,239,172,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(playerX, playerY, m.cell * 0.38, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Player body — skipped when a DOM sprite overlay is active
  if (!hasOverlay) {
    ctx.globalAlpha = state.ghostTimer > 0 ? 0.4 : 1.0;
    ctx.fillStyle = '#60a5fa';
    ctx.beginPath();
    (ctx as Ctx2D).roundRect(playerX - m.cell * 0.22, playerY - m.cell * 0.26, m.cell * 0.44, m.cell * 0.52, 10);
    ctx.fill();
    ctx.fillStyle = '#dbeafe';
    ctx.fillRect(playerX + m.cell * 0.05, playerY - m.cell * 0.06, m.cell * 0.18, m.cell * 0.12);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(playerX - m.cell * 0.12, playerY - m.cell * 0.16, m.cell * 0.18, m.cell * 0.08);
    ctx.globalAlpha = 1.0;
  }

  // NPC (VS mode only — faces left, green, at col 3+npc.col)
  if (vs) {
    const npcActualCol = 3 + state.npc.col;
    const npcX = m.x + (npcActualCol + 0.5) * m.cell;
    const npcY = m.y + (state.npc.row + 0.5) * m.cell;

    // NPC shield ring
    if (state.npc.shieldCharges > 0) {
      ctx.strokeStyle = 'rgba(134,239,172,0.7)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(npcX, npcY, m.cell * 0.38, 0, Math.PI * 2);
      ctx.stroke();
    }

    // NPC body (mirror of player, gun faces LEFT)
    ctx.fillStyle = '#34d399';
    ctx.beginPath();
    (ctx as Ctx2D).roundRect(npcX - m.cell * 0.22, npcY - m.cell * 0.26, m.cell * 0.44, m.cell * 0.52, 10);
    ctx.fill();
    ctx.fillStyle = '#dbeafe';
    ctx.fillRect(npcX - m.cell * 0.23, npcY - m.cell * 0.06, m.cell * 0.18, m.cell * 0.12); // gun LEFT
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(npcX - m.cell * 0.06, npcY - m.cell * 0.16, m.cell * 0.18, m.cell * 0.08);
  }

  // Player bullets
  for (const b of state.bullets) {
    const bx = m.x + b.colPos * m.cell;
    const by = m.y + (b.row + 0.5) * m.cell;
    const radius = b.big ? m.cell * 0.12 : m.cell * 0.08;
    ctx.fillStyle = b.pierce ? '#c084fc' : '#fde047';
    ctx.beginPath();
    ctx.arc(bx, by, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = b.pierce ? 'rgba(192,132,252,0.25)' : 'rgba(253,224,71,0.25)';
    ctx.beginPath();
    ctx.arc(bx - m.cell * 0.09, by, radius * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // NPC bullets (VS mode — cyan, moving left, trail on right side)
  if (vs) {
    for (const b of state.npcBullets) {
      const bx = m.x + b.colPos * m.cell;
      const by = m.y + (b.row + 0.5) * m.cell;
      const radius = m.cell * 0.08;
      ctx.fillStyle = '#67e8f9';
      ctx.beginPath();
      ctx.arc(bx, by, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(103,232,249,0.22)';
      ctx.beginPath();
      ctx.arc(bx + m.cell * 0.09, by, radius * 1.5, 0, Math.PI * 2); // trail on right
      ctx.fill();
    }
  }

  // Red enemies (classic + VS)
  const now = performance.now();

  // Formation links make coordinated squads legible without obscuring morphology.
  const formations = new Map<number, typeof state.enemies>();
  for (const enemy of state.enemies) {
    if (enemy.formationId === undefined || enemy.colPos < -1) continue;
    const members = formations.get(enemy.formationId) ?? [];
    members.push(enemy);
    formations.set(enemy.formationId, members);
  }
  for (const members of formations.values()) {
    if (members.length < 2) continue;
    members.sort((a, b) => a.colPos - b.colPos);
    ctx.save();
    ctx.strokeStyle = 'rgba(251,113,133,0.22)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    members.forEach((enemy, index) => {
      const x = m.x + (enemy.colPos + 0.5) * m.cell;
      const y = m.y + (enemy.row + 0.5) * m.cell;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
  }

  for (const e of state.enemies) {
    const ex = m.x + (e.colPos + 0.5) * m.cell;
    const ey = m.y + (e.row + 0.5) * m.cell;
    const ectx: EntityDrawContext = {
      hpFrac: Math.min(1, e.hp / 5),
      row: e.row,
      colPos: e.colPos,
      playerRow: state.player.row,
      playerDist: Math.abs(e.colPos - state.player.col),
    };
    const genome = e.genome;
    const drawCell = m.cell * (genome?.sizeScale ?? 1);
    if (genome) {
      const nicheColor = NICHE_COLORS[genome.niche] ?? '#fda4af';
      if (genome.fusionLevel > 0) {
        ctx.save();
        ctx.globalAlpha = 0.82;
        ctx.shadowColor = nicheColor;
        ctx.shadowBlur = 13;
        ctx.strokeStyle = nicheColor;
        ctx.lineWidth = 3 + genome.fusionLevel;
        ctx.setLineDash([7, 3]);
        ctx.beginPath();
        ctx.arc(ex, ey, drawCell * (0.38 + genome.fusionLevel * 0.04), now * 0.001, now * 0.001 + Math.PI * 1.65);
        ctx.stroke();
        ctx.restore();
      }
      genome.mutations.forEach((mutation, index) => {
        const angle = now * 0.0012 + (index / Math.max(1, genome.mutations.length)) * Math.PI * 2;
        const mx = ex + Math.cos(angle) * drawCell * 0.36;
        const my = ey + Math.sin(angle) * drawCell * 0.36;
        const markerSize = 2.5 + visualGene(e.value, index + 80) * 2.5;
        ctx.fillStyle = nicheColor;
        ctx.beginPath();
        if (mutation === 'armored' || mutation === 'gigantic') {
          ctx.rect(mx - markerSize, my - markerSize, markerSize * 2, markerSize * 2);
        } else if (mutation === 'volatile') {
          for (let point = 0; point < 8; point++) {
            const radius = point % 2 === 0 ? markerSize * 1.7 : markerSize * 0.65;
            const a = angle + point * Math.PI / 4;
            const px = mx + Math.cos(a) * radius;
            const py = my + Math.sin(a) * radius;
            if (point === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.closePath();
        } else {
          ctx.arc(mx, my, markerSize, 0, Math.PI * 2);
        }
        ctx.fill();
      });
    }
    // Bodies are assembled from independent procedural modules; no finite base
    // sprite or morphology catalog is used for hostile entities.
    const aspectX = 0.68 + visualGene(e.value, 21) * 0.72;
    const aspectY = 0.72 + visualGene(e.value, 22) * 0.62;
    ctx.save();
    ctx.translate(ex, ey);
    ctx.scale(aspectX, aspectY);
    drawGeneratedAppendages(ctx, e.value, drawCell, genome ? (NICHE_COLORS[genome.niche] ?? '#fda4af') : '#fb7185');
    drawModularEntity(
      ctx,
      e.value ?? 6,
      drawCell,
      genome ? (NICHE_COLORS[genome.niche] ?? '#fda4af') : '#fb7185',
      e.flash > 0,
      now,
      ectx.hpFrac,
    );
    ctx.restore();
    if (e.hp > 1) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(ex - 5, ey - m.cell * 0.32, 10, 3);
    }
  }

  // Green enemies (VS mode — moving right, threatening NPC)
  if (vs) {
    for (const e of state.npcEnemies) {
      const ex = m.x + (e.colPos + 0.5) * m.cell;
      const ey = m.y + (e.row + 0.5) * m.cell;
      const ectxG: EntityDrawContext = {
        hpFrac: Math.min(1, e.hp / 5),
        row: e.row,
        colPos: e.colPos,
        playerRow: state.player.row,
        playerDist: Math.abs(e.colPos - state.player.col),
      };
      drawVirus(ctx, ex, ey, e.value ?? 6, m.cell, e.flash > 0, true, now, ectxG);
      if (e.hp > 1) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(ex - 5, ey - m.cell * 0.32, 10, 3);
      }
    }
  }

  // Particles
  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 3, 3);
  }
  ctx.globalAlpha = 1;

  // Board border
  ctx.strokeStyle = 'rgba(125,211,252,0.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(m.x, m.y, m.boardW, m.boardH);
}
