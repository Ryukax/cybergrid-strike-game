import type { GameState, BoardMetrics } from './types';

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
  for (const e of state.enemies) {
    const ex = m.x + (e.colPos + 0.5) * m.cell;
    const ey = m.y + (e.row + 0.5) * m.cell;
    ctx.fillStyle = e.flash > 0 ? '#fff1f2' : '#fb7185';
    ctx.beginPath();
    (ctx as Ctx2D).roundRect(ex - m.cell * 0.2, ey - m.cell * 0.2, m.cell * 0.4, m.cell * 0.4, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(ex - m.cell * 0.12, ey - m.cell * 0.12, m.cell * 0.24, m.cell * 0.24);
    if (e.hp > 1) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(ex - 5, ey - m.cell * 0.3, 10, 3);
    }
  }

  // Green enemies (VS mode — moving right, threatening NPC)
  if (vs) {
    for (const e of state.npcEnemies) {
      const ex = m.x + (e.colPos + 0.5) * m.cell;
      const ey = m.y + (e.row + 0.5) * m.cell;
      ctx.fillStyle = e.flash > 0 ? '#f0fdf4' : '#4ade80';
      ctx.beginPath();
      (ctx as Ctx2D).roundRect(ex - m.cell * 0.2, ey - m.cell * 0.2, m.cell * 0.4, m.cell * 0.4, 12);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(ex - m.cell * 0.12, ey - m.cell * 0.12, m.cell * 0.24, m.cell * 0.24);
      if (e.hp > 1) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(ex - 5, ey - m.cell * 0.3, 10, 3);
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
