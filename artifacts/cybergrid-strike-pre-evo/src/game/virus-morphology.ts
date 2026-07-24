/**
 * CyberGrid Strike — Entity Morphology v6 — OPEN EVOLUTIONARY DESIGN SPACE
 *
 * THREE EVOLUTIONARY PATHWAYS
 *   LINEAGE EVOLUTION  (BP 0-2) — pure substrate construction grammars
 *   CROSS HYBRIDIZATION (BP 3) — two substrates integrated into one anatomy
 *   DE NOVO INNOVATION  (BP 4) — novel architectures that replace old assumptions
 *
 * 14 substrate families × 5 body plans × 3 variants = 210 distinct anatomies
 * across n ∈ [1,255]. Hybrids integrate primary frame + secondary-substrate
 * features at anatomically plausible attachment points — not floating mashups.
 * Innovations break substrate categories to occupy genuinely new niches.
 *
 * Spawn diversity tracks topology + body-plan + hybrid-key + full morphological
 * fingerprint across a rolling 20-spawn window. Pressure is applied per-domain,
 * per-body-plan, and per-fingerprint bucket to prevent any combination from
 * dominating without rigid cycling.
 *
 * All legacy exports preserved with identical call signatures.
 */

export type VirusClass =
  | 'prime' | 'power-of-two' | 'perfect-square' | 'even-composite' | 'odd-composite';
export type VirusArchetype =
  | 'biological' | 'humanoid' | 'animal' | 'insectoid' | 'mechanical'
  | 'armored' | 'crystalline' | 'mineral' | 'plant' | 'synthetic'
  | 'robotic' | 'amorphous' | 'geometric' | 'energy' | 'cybernetic'
  | 'skeletal' | 'fluid';
export interface VirusModelProfile {
  primaryArchetype: VirusArchetype; secondaryArchetype: VirusArchetype;
  primaryWeight: number; secondaryWeight: number;
  structureLevel: number; symmetryLevel: number; armorLevel: number;
  organicLevel: number; mechanicalLevel: number; crystallineLevel: number; energyLevel: number;
}
export interface VirusVisualModel {
  id: string; archetypes: VirusArchetype[];
  compatibleFeatures: { minLobes?: number; maxLobes?: number; symmetryRange?: [number,number]; armorRange?: [number,number]; };
}

// §1  Deterministic hash
function nh(n: number, salt: number): number {
  const x = Math.sin(n * 12.9898 + salt * 78.233 + salt * salt * 0.00371) * 43758.5453;
  return x - Math.floor(x);
}

// §2  Number theory
export function isPrime(n: number): boolean {
  if (n < 2) return false; if (n === 2) return true; if (n % 2 === 0) return false;
  for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return false; return true;
}
export function isPerfectSquare(n: number): boolean { const s = Math.round(Math.sqrt(n)); return s*s===n; }
export function isPowerOfTwo(n: number): boolean { return n > 0 && (n & (n-1)) === 0; }
export function getVirusClass(n: number): VirusClass {
  if (isPrime(n)) return 'prime'; if (isPowerOfTwo(n)) return 'power-of-two';
  if (isPerfectSquare(n)) return 'perfect-square'; if (n%2===0) return 'even-composite'; return 'odd-composite';
}
export function getVirusLobes(n: number): number { return 3 + (n % 6); }
export function getVirusSpikes(n: number): boolean[] { return Array.from({length:8},(_,i)=>Boolean((n>>i)&1)); }

// §3  Colours
const FILL_C: Record<VirusClass,string> = {
  prime:'#e879f9','power-of-two':'#22d3ee','perfect-square':'#fbbf24','even-composite':'#fb7185','odd-composite':'#fb923c',
};
const FLASH_C: Record<VirusClass,string> = {
  prime:'#fae8ff','power-of-two':'#ecfeff','perfect-square':'#fef9c3','even-composite':'#fff1f2','odd-composite':'#fff7ed',
};
const GLOW_C: Record<VirusClass,string> = {
  prime:'rgba(232,121,249,0.55)','power-of-two':'rgba(34,211,238,0.55)','perfect-square':'rgba(251,191,36,0.55)',
  'even-composite':'rgba(251,113,133,0.45)','odd-composite':'rgba(251,146,60,0.50)',
};
export function getVirusColors(n: number, flash: boolean): {fill:string;glow:string} {
  const cls = getVirusClass(n); return { fill: flash ? FLASH_C[cls] : FILL_C[cls], glow: GLOW_C[cls] };
}

// §4  Topology + body-plan selectors
const N_TOPO = 14;
export function getTopology(n: number): number { return Math.min(N_TOPO-1, Math.floor(nh(n,0xBEEF)*N_TOPO)); }
const BP = (n: number) => Math.floor(nh(n,0xD00D)*5);   // 0-4: 3 pure + 1 hybrid + 1 innovation
const TV = (n: number) => Math.floor(nh(n,0xCAFE)*3);   // 0-2: fine variant
const nhr = (n: number, s: number, lo: number, hi: number) => lo + nh(n,s)*(hi-lo);  // continuous range
const nhi = (n: number, s: number, max: number) => Math.floor(nh(n,s)*max);          // integer range

// §5  Drawing primitives
type Ctx = CanvasRenderingContext2D; type P2 = [number,number];

function fpoly(ctx:Ctx, pts:P2[], f:string, g:string, a:number, blur=6): void {
  if (pts.length<2) return;
  ctx.save(); ctx.globalAlpha=a; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=blur;
  ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]);
  for (let i=1;i<pts.length;i++) ctx.lineTo(pts[i][0],pts[i][1]);
  ctx.closePath(); ctx.fill(); ctx.shadowBlur=0;
  ctx.strokeStyle='rgba(255,255,255,0.16)'; ctx.lineWidth=0.75; ctx.stroke(); ctx.restore();
}
function fell(ctx:Ctx,x:number,y:number,rx:number,ry:number,f:string,g:string,a:number,blur=5): void {
  ctx.save(); ctx.globalAlpha=a; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=blur;
  ctx.beginPath(); ctx.ellipse(x,y,Math.max(rx,0.5),Math.max(ry,0.5),0,0,Math.PI*2);
  ctx.fill(); ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,0.16)'; ctx.lineWidth=0.75; ctx.stroke(); ctx.restore();
}
function fcirc(ctx:Ctx,x:number,y:number,r:number,f:string,g:string,a:number): void { fell(ctx,x,y,r,r,f,g,a); }
function frect(ctx:Ctx,x:number,y:number,w:number,h:number,f:string,g:string,a:number): void {
  ctx.save(); ctx.globalAlpha=a; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=5;
  ctx.fillRect(x,y,w,h); ctx.shadowBlur=0;
  ctx.strokeStyle='rgba(255,255,255,0.16)'; ctx.lineWidth=0.75; ctx.strokeRect(x,y,w,h); ctx.restore();
}
function sline(ctx:Ctx,x1:number,y1:number,x2:number,y2:number,col:string,a:number,lw=1.2): void {
  ctx.save(); ctx.globalAlpha=a; ctx.strokeStyle=col; ctx.lineWidth=lw;
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); ctx.restore();
}
function gun(ctx:Ctx,bx:number,by:number,len:number,thick:number,f:string,g:string,a:number): void {
  frect(ctx,bx-len,by-thick,len,thick*2,f,g,a+0.04); fcirc(ctx,bx-len,by,thick*0.8,f,g,a+0.06);
}
function stinger(ctx:Ctx,bx:number,by:number,len:number,bW:number,f:string,g:string,a:number): void {
  fpoly(ctx,[[bx,by-bW],[bx-len,by],[bx,by+bW]],f,g,a+0.05,6);
}

// §6  Shared substrate component functions
function drawSpine(ctx:Ctx,x0:number,y0:number,x1:number,y1:number,w:number,f:string,g:string,A:number): void {
  ctx.save(); ctx.globalAlpha=A-0.05; ctx.strokeStyle=f; ctx.lineWidth=w; ctx.shadowColor=g; ctx.shadowBlur=5;
  ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke(); ctx.restore();
}
function organicArm(ctx:Ctx,x0:number,y0:number,x1:number,y1:number,w:number,curl:number,f:string,g:string,A:number): void {
  const mx=(x0+x1)/2+curl, my=(y0+y1)/2;
  ctx.save(); ctx.globalAlpha=A; ctx.strokeStyle=f; ctx.lineWidth=w*2; ctx.shadowColor=g; ctx.shadowBlur=3;
  ctx.beginPath(); ctx.moveTo(x0,y0); ctx.quadraticCurveTo(mx,my,x1,y1); ctx.stroke();
  ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,0.14)'; ctx.lineWidth=0.6;
  ctx.beginPath(); ctx.moveTo(x0,y0); ctx.quadraticCurveTo(mx,my,x1,y1); ctx.stroke(); ctx.restore();
}
function crystalShard(ctx:Ctx,bx:number,by:number,angle:number,len:number,w:number,f:string,g:string,A:number): void {
  const tx=bx+Math.cos(angle)*len, ty=by+Math.sin(angle)*len;
  const px=-Math.sin(angle)*w, py=Math.cos(angle)*w;
  fpoly(ctx,[[bx+px,by+py],[bx-px,by-py],[tx-px*0.1,ty-py*0.1],[tx,ty],[tx+px*0.1,ty+py*0.1]],f,g,A,5);
  fpoly(ctx,[[bx+px*0.4,by+py*0.4],[tx,ty],[bx,by]],'rgba(255,255,255,0.22)',g,A-0.28,2);
}
function energyTendril(ctx:Ctx,x0:number,y0:number,x1:number,y1:number,f:string,g:string,A:number,n:number,salt:number): void {
  const dx=x1-x0, dy=y1-y0, len=Math.hypot(dx,dy);
  const mx=x0+dx*0.5+(nh(n,salt)-0.5)*len*0.4, my=y0+dy*0.5+(nh(n,salt+1)-0.5)*len*0.4;
  ctx.save(); ctx.globalAlpha=A; ctx.strokeStyle=f; ctx.lineWidth=len*0.028; ctx.shadowColor=g; ctx.shadowBlur=8;
  ctx.beginPath(); ctx.moveTo(x0,y0); ctx.quadraticCurveTo(mx,my,x1,y1); ctx.stroke(); ctx.restore();
}
function mechArmor(ctx:Ctx,cx:number,cy:number,angle:number,R:number,f:string,g:string,A:number): void {
  const px=cx+Math.cos(angle)*R*0.72, py=cy+Math.sin(angle)*R*0.72;
  ctx.save(); ctx.translate(px,py); ctx.rotate(angle+Math.PI/2);
  const pw=R*0.28, ph=R*0.12;
  frect(ctx,-pw/2,-ph/2,pw,ph,f,g,A-0.04);
  ctx.globalAlpha=A-0.35; ctx.strokeStyle='rgba(255,255,255,0.7)'; ctx.lineWidth=0.65;
  for (const bx of [-pw*0.32,pw*0.32]) { ctx.beginPath(); ctx.arc(bx,0,R*0.038,0,Math.PI*2); ctx.stroke(); }
  ctx.restore();
}
function rootTendril(ctx:Ctx,x0:number,y0:number,angle:number,len:number,w:number,f:string,g:string,A:number,n:number,salt:number): void {
  const c1x=x0+Math.cos(angle)*len*0.38+(nh(n,salt)-0.5)*len*0.25;
  const c1y=y0+Math.sin(angle)*len*0.38;
  const c2x=x0+Math.cos(angle)*len*0.72+(nh(n,salt+1)-0.5)*len*0.18;
  const c2y=y0+Math.sin(angle)*len*0.72;
  const ex=x0+Math.cos(angle)*len, ey=y0+Math.sin(angle)*len;
  ctx.save(); ctx.globalAlpha=A; ctx.strokeStyle=f; ctx.lineWidth=w; ctx.shadowColor=g; ctx.shadowBlur=4;
  ctx.beginPath(); ctx.moveTo(x0,y0); ctx.bezierCurveTo(c1x,c1y,c2x,c2y,ex,ey); ctx.stroke(); ctx.restore();
}
// Graft: mechanical gun arm attached at point
function graftGun(ctx:Ctx,x:number,y:number,R:number,f:string,g:string,A:number): void {
  fcirc(ctx,x,y,R*0.12,f,g,A-0.08);
  gun(ctx,x,y,R*0.85,R*0.062,f,g,A);
}
// Graft: energy field halo overlaid on existing body center
function graftEnergyField(ctx:Ctx,cx:number,cy:number,R:number,n:number,f:string,g:string,A:number): void {
  ctx.save(); ctx.globalAlpha=A-0.28; ctx.strokeStyle=f; ctx.lineWidth=R*0.08; ctx.shadowColor=g; ctx.shadowBlur=12;
  ctx.beginPath(); ctx.arc(cx,cy,R*0.90,nh(n,0xE1)*Math.PI*2,nh(n,0xE1)*Math.PI*2+Math.PI*1.4); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx,cy,R*1.20,nh(n,0xE2)*Math.PI*2,nh(n,0xE2)*Math.PI*2+Math.PI*0.90); ctx.stroke();
  ctx.restore();
  fcirc(ctx,cx,cy,R*0.14,'rgba(255,255,255,0.75)',g,A-0.12);
}
// Graft: crystal dorsal growth
function graftCrystalDorsal(ctx:Ctx,cx:number,cy:number,R:number,n:number,f:string,g:string,A:number): void {
  for (let i=0;i<3;i++) {
    const x=cx+nhr(n,0xC0+i,-R*0.55,R*0.35);
    const len=R*(0.32+nh(n,0xC8+i)*0.28);
    crystalShard(ctx,x,cy,Math.PI*1.5,len,R*0.06,f,g,A-0.10);
  }
}

// ═══════════════════════════════════════════════════════════
// §7  14 TOPOLOGY DRAWERS — each with 5 body plans
// ═══════════════════════════════════════════════════════════

// ── T0  MONOCOQUE ─────────────────────────────────────────
function drawT0(ctx:Ctx,cx:number,cy:number,R:number,n:number,f:string,g:string,A:number): void {
  const bp=BP(n), v=TV(n);
  if (bp===1) { // Barge deck — wide/flat, amidship turret
    const W=R*[2.20,2.40,2.0][v], H=R*[0.30,0.36,0.26][v];
    fpoly(ctx,[[cx-W,cy-H],[cx+W,cy-H],[cx+W*0.85,cy+H],[cx-W*0.85,cy+H]],f,g,A);
    frect(ctx,cx-R*0.55,cy-H-R*0.38,R*1.1,R*0.38,f,g,A+0.04);
    ctx.save(); ctx.globalAlpha=0.24; ctx.strokeStyle='rgba(255,255,255,0.85)'; ctx.lineWidth=0.6;
    for (let i=1;i<=5;i++) { const rx=cx-W+i*W*2/6; ctx.beginPath(); ctx.moveTo(rx,cy-H); ctx.lineTo(rx,cy+H); ctx.stroke(); }
    ctx.restore();
    gun(ctx,cx-R*0.55,cy-H-R*0.20,R*1.0,R*0.07,f,g,A);
    for (const s of [-1,1] as const) fell(ctx,cx+W*0.55,cy,R*0.16,H*0.60,f,g,A-0.20);
  } else if (bp===2) { // Wedge craft — delta cross-section, forward taper
    const L=R*[2.0,1.75,2.25][v], H=R*[0.52,0.64,0.44][v];
    ctx.save(); ctx.globalAlpha=A; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=7;
    ctx.beginPath();
    ctx.moveTo(cx-L,cy); ctx.lineTo(cx-L*0.5,cy-H); ctx.lineTo(cx+L,cy-H*0.22);
    ctx.lineTo(cx+L,cy+H*0.22); ctx.lineTo(cx-L*0.5,cy+H); ctx.closePath();
    ctx.fill(); ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,0.20)'; ctx.lineWidth=0.85; ctx.stroke(); ctx.restore();
    gun(ctx,cx-L,cy,R*0.70,R*0.060,f,g,A);
    ctx.save(); ctx.globalAlpha=0.20; ctx.strokeStyle='rgba(255,255,255,0.9)'; ctx.lineWidth=0.55;
    for (let i=1;i<=3;i++) { ctx.beginPath(); ctx.moveTo(cx-L+i*L*2/4,cy-H*(1-i/5)); ctx.lineTo(cx-L+i*L*2/4,cy+H*(1-i/5)); ctx.stroke(); }
    ctx.restore();
  } else if (bp===3) { // HYBRID: Monocoque + Plant — bio-encrusted hull
    const L=R*[2.10,1.85,2.35][v], H=R*[0.42,0.52,0.36][v];
    ctx.save(); ctx.globalAlpha=A; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=8;
    ctx.beginPath();
    ctx.moveTo(cx-L,cy); ctx.bezierCurveTo(cx-L,cy-H*0.5,cx-H*1.5,cy-H,cx,cy-H);
    ctx.bezierCurveTo(cx+H*2,cy-H,cx+L*0.88,cy-H*0.35,cx+L,cy);
    ctx.bezierCurveTo(cx+L*0.88,cy+H*0.35,cx+H*2,cy+H,cx,cy+H);
    ctx.bezierCurveTo(cx-H*1.5,cy+H,cx-L,cy+H*0.5,cx-L,cy);
    ctx.closePath(); ctx.fill(); ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,0.18)'; ctx.lineWidth=0.85; ctx.stroke(); ctx.restore();
    // Plant graft: barnacle-cap growths on dorsal surface
    for (let i=0;i<3+v;i++) {
      const bx=cx-L*0.55+i*L*0.42, bW=R*(0.18+nh(n,30+i)*0.10), bH=R*(0.14+nh(n,40+i)*0.08);
      ctx.save(); ctx.globalAlpha=A-0.08; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=4;
      ctx.beginPath(); ctx.moveTo(bx-bW,cy-H); ctx.bezierCurveTo(bx-bW,cy-H-bH*1.5,bx+bW,cy-H-bH*1.5,bx+bW,cy-H); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    // Vine tendrils trailing from stern
    for (let i=0;i<3;i++) { rootTendril(ctx,cx+L,cy+(i-1)*H*0.6,0,R*(0.55+nh(n,50+i)*0.35),R*0.055,f,g,A-0.22,n,60+i*5); }
    gun(ctx,cx-L,cy,R*0.62,R*0.062,f,g,A);
  } else if (bp===4) { // INNOVATION: Recursive panel hull — nested panel structure
    const L=R*2.0, H=R*0.46;
    for (let level=0;level<3;level++) {
      const s=1-level*0.28, lA=A-level*0.16;
      ctx.save(); ctx.globalAlpha=lA; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=7-level*2;
      ctx.beginPath();
      ctx.moveTo(cx-L*s,cy); ctx.bezierCurveTo(cx-L*s,cy-H*s*0.5,cx-H*s*1.5,cy-H*s,cx,cy-H*s);
      ctx.bezierCurveTo(cx+H*s*2,cy-H*s,cx+L*s*0.88,cy-H*s*0.35,cx+L*s,cy);
      ctx.bezierCurveTo(cx+L*s*0.88,cy+H*s*0.35,cx+H*s*2,cy+H*s,cx,cy+H*s);
      ctx.bezierCurveTo(cx-H*s*1.5,cy+H*s,cx-L*s,cy+H*s*0.5,cx-L*s,cy);
      ctx.closePath(); if (level>0) { ctx.globalCompositeOperation='source-atop'; } ctx.fill();
      ctx.shadowBlur=0; ctx.strokeStyle=`rgba(255,255,255,${0.14+level*0.06})`; ctx.lineWidth=0.75; ctx.stroke();
      ctx.globalCompositeOperation='source-over'; ctx.restore();
    }
    gun(ctx,cx-L,cy,R*0.75,R*0.062,f,g,A);
  } else { // BP0: Torpedo hull — long, tapered, classic
    const L=R*[2.20,1.85,2.55][v], H=R*[0.44,0.56,0.36][v];
    ctx.save(); ctx.globalAlpha=A; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=8;
    ctx.beginPath();
    ctx.moveTo(cx-L,cy); ctx.bezierCurveTo(cx-L,cy-H*0.5,cx-H*1.5,cy-H,cx,cy-H);
    ctx.bezierCurveTo(cx+H*2,cy-H,cx+L*0.88,cy-H*0.35,cx+L,cy);
    ctx.bezierCurveTo(cx+L*0.88,cy+H*0.35,cx+H*2,cy+H,cx,cy+H);
    ctx.bezierCurveTo(cx-H*1.5,cy+H,cx-L,cy+H*0.5,cx-L,cy);
    ctx.closePath(); ctx.fill(); ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,0.20)'; ctx.lineWidth=0.9; ctx.stroke(); ctx.restore();
    ctx.save(); ctx.globalAlpha=0.22; ctx.strokeStyle='rgba(255,255,255,0.9)'; ctx.lineWidth=0.6;
    for (let i=1;i<=4;i++) { const rx=cx-L+i*L*2/5; const hx=H*(1-Math.abs(rx-cx)/(L))*0.95; ctx.beginPath(); ctx.moveTo(rx,cy-hx); ctx.lineTo(rx,cy+hx); ctx.stroke(); }
    ctx.restore();
    gun(ctx,cx-L,cy,R*(0.50+nh(n,7)*0.35),R*0.065,f,g,A);
    const nN=v===1?3:2;
    for (let i=0;i<nN;i++) { const ny=cy+(i-(nN-1)/2)*R*0.28; fpoly(ctx,[[cx+L,ny-R*0.07],[cx+L+R*0.28,ny-R*0.12],[cx+L+R*0.28,ny+R*0.12],[cx+L,ny+R*0.07]],f,g,A-0.16,3); }
  }
}

// ── T1  CHASSIS_FRAME ────────────────────────────────────
function drawT1(ctx:Ctx,cx:number,cy:number,R:number,n:number,f:string,g:string,A:number): void {
  const bp=BP(n), v=TV(n);
  if (bp===1) { // Tripod chassis — 3-way radial, weapon at forward apex
    const rLen=R*[1.65,1.85,1.45][v], armW=R*0.10;
    const angles=[Math.PI,Math.PI*0.38,Math.PI*1.62];
    for (let i=0;i<3;i++) {
      const ax=cx+Math.cos(angles[i])*rLen, ay=cy+Math.sin(angles[i])*rLen;
      sline(ctx,cx,cy,ax,ay,f,A-0.10,armW*2);
      fcirc(ctx,ax,ay,armW*1.6,f,g,A-0.08);
    }
    fpoly(ctx,[[cx-R*0.28,cy-R*0.22],[cx-R*0.28,cy+R*0.22],[cx+R*0.32,cy]],f,g,A+0.02);
    gun(ctx,cx+Math.cos(Math.PI)*rLen,cy,R*0.72,R*0.062,f,g,A);
  } else if (bp===2) { // H-frame — two short rails connected by wide center beam
    const rW=R*[1.20,1.40,1.05][v], sep=R*[0.52,0.66,0.42][v], rH=R*0.10;
    for (const s of [-1,1] as const) {
      frect(ctx,cx-rW,cy+s*sep-rH,rW*2,rH*2,f,g,A);
      gun(ctx,cx-rW,cy+s*sep,R*0.55,R*0.055,f,g,A-0.04);
    }
    frect(ctx,cx-R*0.20,cy-sep,R*0.40,sep*2,f,g,A-0.06);
    frect(ctx,cx-R*0.50,cy-R*0.14,R*1.0,R*0.28,f,g,A-0.10);
    for (let i=0;i<3;i++) { const wx=cx-rW*0.65+i*rW*0.65; for (const s of [-1,1] as const) fcirc(ctx,wx,cy+s*(sep+R*0.28),R*0.18,f,g,A-0.18); }
  } else if (bp===3) { // HYBRID: Frame + Biological — rails wrapped in organic muscle
    const rW=R*2.0, sep=R*[0.48,0.62,0.38][v], rH=R*0.10;
    frect(ctx,cx-rW,cy-sep-rH,rW*2,rH*2,f,g,A-0.08);
    frect(ctx,cx-rW,cy+sep-rH,rW*2,rH*2,f,g,A-0.08);
    // Organic muscle tissue over-wrapping the rails
    for (let i=0;i<=4;i++) {
      const rx=cx-rW+i*(rW*2/4);
      const musH=sep*(0.38+nh(n,10+i)*0.24);
      ctx.save(); ctx.globalAlpha=A-0.18; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=4;
      ctx.beginPath(); ctx.ellipse(rx,cy,R*0.14,musH,0,0,Math.PI*2); ctx.fill(); ctx.restore();
    }
    stinger(ctx,cx-rW-R*0.18,cy,R*0.68,R*0.09,f,g,A); // organic fang weapon
    fpoly(ctx,[[cx+rW,cy-sep*1.3],[cx+rW+R*0.40,cy-sep*0.85],[cx+rW+R*0.40,cy+sep*0.85],[cx+rW,cy+sep*1.3]],f,g,A-0.06);
  } else if (bp===4) { // INNOVATION: Spaceframe — triangulated strut lattice
    const rW=R*1.85, H=R*[0.55,0.65,0.45][v];
    const nodes:P2[] = [[cx-rW,cy-H],[cx-rW,cy+H],[cx-rW*0.3,cy-H*0.5],[cx-rW*0.3,cy+H*0.5],[cx+rW*0.4,cy-H*0.4],[cx+rW*0.4,cy+H*0.4],[cx+rW,cy]];
    const edges=[[0,1],[0,2],[1,3],[2,3],[2,4],[3,5],[4,5],[4,6],[5,6],[0,3],[1,2]];
    for (const [a,b] of edges) sline(ctx,nodes[a][0],nodes[a][1],nodes[b][0],nodes[b][1],f,A-0.12,R*0.09);
    for (const [x,y] of nodes) fcirc(ctx,x,y,R*0.09,f,g,A-0.10);
    gun(ctx,cx-rW,cy,R*0.72,R*0.060,f,g,A);
  } else { // BP0: Long rectangular frame with rails + cross-members
    const rW=R*2.0, sep=R*[0.48,0.62,0.38][v], rH=R*0.10, nX=[4,5,3][v];
    frect(ctx,cx-rW,cy-sep-rH,rW*2,rH*2,f,g,A); frect(ctx,cx-rW,cy+sep-rH,rW*2,rH*2,f,g,A);
    for (let i=0;i<=nX;i++) { const rx=cx-rW+i*(rW*2/nX); frect(ctx,rx-R*0.055,cy-sep,R*0.11,sep*2,f,g,A-0.12); }
    fpoly(ctx,[[cx-rW,cy-sep*1.1],[cx-rW,cy+sep*1.1],[cx-rW-R*0.22,cy+sep*0.6],[cx-rW-R*0.22,cy-sep*0.6]],f,g,A+0.04);
    gun(ctx,cx-rW-R*0.22,cy,R*0.80,R*0.065,f,g,A);
    fpoly(ctx,[[cx+rW,cy-sep*1.3],[cx+rW+R*0.40,cy-sep*0.85],[cx+rW+R*0.40,cy+sep*0.85],[cx+rW,cy+sep*1.3]],f,g,A-0.06);
    for (let i=0;i<3;i++) { const wx=cx-rW*0.68+i*rW*0.68; fcirc(ctx,wx,cy+sep+R*0.26,R*0.21,f,g,A-0.16); fcirc(ctx,wx,cy-sep-R*0.26,R*0.21,f,g,A-0.16); }
  }
}

// ── T2  CEPHALOPOD ───────────────────────────────────────
function drawT2(ctx:Ctx,cx:number,cy:number,R:number,n:number,f:string,g:string,A:number): void {
  const bp=BP(n), v=TV(n);
  if (bp===1) { // Medusa jellyfish — hemispherical bell + trailing filaments
    const bR=R*[0.82,0.96,0.70][v];
    ctx.save(); ctx.globalAlpha=A; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=9;
    ctx.beginPath(); ctx.arc(cx,cy-bR*0.25,bR,Math.PI,0); ctx.closePath();
    ctx.fill(); ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,0.16)'; ctx.lineWidth=0.85; ctx.stroke(); ctx.restore();
    // Oral arms (4 short, stiff)
    for (let i=0;i<4;i++) { const ox=cx-bR*0.65+i*bR*0.44; const oLen=R*(0.42+nh(n,10+i)*0.22); organicArm(ctx,ox,cy-bR*0.25+bR*0.05,ox+(nh(n,20+i)-0.5)*R*0.22,cy-bR*0.25+bR*0.05+oLen,R*0.055,0,f,g,A-0.12); }
    // Trailing filaments (thin, long)
    const nF=6+v*2;
    for (let i=0;i<nF;i++) { const fx=cx-bR*0.80+i*(bR*1.60/(nF-1)); const fLen=R*(0.85+nh(n,30+i)*1.10); const curl=(nh(n,40+i)-0.5)*R*0.55; organicArm(ctx,fx,cy-bR*0.25+bR*0.05,fx+curl,cy-bR*0.25+bR*0.05+fLen,R*0.025,0,f,g,A-0.22); }
    // Weapon: rim sting (left-most)
    stinger(ctx,cx-bR,cy-bR*0.25,R*0.35,R*0.07,f,g,A);
    // Radial ribs
    ctx.save(); ctx.globalAlpha=A-0.30; ctx.strokeStyle='rgba(255,255,255,0.7)'; ctx.lineWidth=0.6;
    for (let i=0;i<6;i++) { const a=Math.PI*(1-i/5); ctx.beginPath(); ctx.moveTo(cx,cy-bR*0.25); ctx.lineTo(cx+Math.cos(a)*bR,cy-bR*0.25+Math.sin(a)*bR); ctx.stroke(); }
    ctx.restore();
  } else if (bp===2) { // Octopus — round body, 8 thick radial arms
    const bR=R*[0.55,0.64,0.48][v], nArm=6+v*2;
    fell(ctx,cx,cy,bR,bR*0.80,f,g,A);
    for (const s of [-1,1] as const) { fcirc(ctx,cx-bR*0.28,cy+s*bR*0.32,R*0.12,'rgba(255,255,255,0.72)',g,A-0.04); fcirc(ctx,cx-bR*0.28,cy+s*bR*0.32,R*0.06,'#111',g,A+0.04); }
    for (let i=0;i<nArm;i++) {
      const a=(i/nArm)*Math.PI*2-Math.PI/2;
      const aLen=R*(0.62+nh(n,10+i)*0.55);
      const ex=cx+Math.cos(a)*(bR+aLen), ey=cy+Math.sin(a)*(bR+aLen)*0.80;
      const curl=(nh(n,20+i)-0.5)*R*0.40;
      organicArm(ctx,cx+Math.cos(a)*bR*0.82,cy+Math.sin(a)*bR*0.70,ex,ey,R*0.072,curl,f,g,A-0.10);
      fcirc(ctx,ex,ey,R*0.06,f,g,A-0.22);
    }
    stinger(ctx,cx-bR,cy,R*0.36,R*0.085,f,g,A);
  } else if (bp===3) { // HYBRID: Cephalopod + Energy — plasma tentacles, energy mantle
    const mL=R*[1.10,1.22,0.96][v], mH=R*[0.74,0.82,0.66][v];
    ctx.save(); ctx.globalAlpha=A; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=9;
    ctx.beginPath();
    ctx.moveTo(cx-mL,cy); ctx.bezierCurveTo(cx-mL*0.52,cy-mH*0.58,cx,cy-mH,cx+mL*0.48,cy-mH);
    ctx.bezierCurveTo(cx+mL*0.82,cy-mH,cx+mL,cy-mH*0.42,cx+mL,cy);
    ctx.bezierCurveTo(cx+mL,cy+mH*0.42,cx+mL*0.82,cy+mH,cx+mL*0.48,cy+mH);
    ctx.bezierCurveTo(cx,cy+mH,cx-mL*0.52,cy+mH*0.58,cx-mL,cy);
    ctx.closePath(); ctx.fill(); ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,0.16)'; ctx.lineWidth=0.85; ctx.stroke(); ctx.restore();
    // Energy tentacles instead of organic (glowing)
    const nT=6+v;
    for (let i=0;i<nT;i++) {
      const t=nT>1?i/(nT-1):0.5, ty=cy+(t-0.5)*mH*1.85;
      energyTendril(ctx,cx+mL*0.38,ty,cx+mL*0.38+R*(0.80+nh(n,10+i)*0.90),ty+(nh(n,20+i)-0.5)*R*0.60,f,g,A-0.16,n,30+i*3);
    }
    // Energy field overlay
    graftEnergyField(ctx,cx+mL*0.10,cy,mH*0.55,n,f,g,A);
    // Energy beam weapon (replaces beak)
    const beamLen=R*(0.68+nh(n,5)*0.38);
    ctx.save(); ctx.globalAlpha=A-0.10; ctx.strokeStyle=f; ctx.lineWidth=R*0.048; ctx.shadowColor=g; ctx.shadowBlur=12;
    ctx.beginPath(); ctx.moveTo(cx-mL,cy); ctx.lineTo(cx-mL-beamLen,cy); ctx.stroke(); ctx.restore();
    fcirc(ctx,cx-mL-beamLen,cy,R*0.10,'rgba(255,255,255,0.88)',g,A);
  } else if (bp===4) { // INNOVATION: Giant neuron — soma body + dendrites + axon
    const sR=R*[0.62,0.72,0.54][v];
    fell(ctx,cx+R*0.15,cy,sR,sR*0.88,f,g,A); // soma
    fcirc(ctx,cx+R*0.28,cy-sR*0.30,R*0.14,'rgba(255,255,255,0.72)',g,A-0.04); // nucleus
    // Dendrites (branching, shorter, multiply)
    const nD=5+v*2;
    for (let i=0;i<nD;i++) {
      const a=(i/nD)*Math.PI*2*0.85+Math.PI*0.10;
      const dLen=R*(0.55+nh(n,10+i)*0.60);
      const dx=cx+R*0.15+Math.cos(a)*(sR+dLen), dy=cy+Math.sin(a)*(sR+dLen)*0.85;
      organicArm(ctx,cx+R*0.15+Math.cos(a)*sR*0.85,cy+Math.sin(a)*sR*0.75,dx,dy,R*0.048,(nh(n,20+i)-0.5)*R*0.30,f,g,A-0.14);
      if (nh(n,30+i)>0.5) { // branch tip
        const b2x=dx+Math.cos(a+0.6)*R*0.30, b2y=dy+Math.sin(a+0.6)*R*0.25;
        organicArm(ctx,dx,dy,b2x,b2y,R*0.030,0,f,g,A-0.24);
      }
    }
    // Axon (long, straight, leftward — the weapon delivery)
    const axLen=R*(1.35+nh(n,7)*0.45);
    ctx.save(); ctx.globalAlpha=A-0.08; ctx.strokeStyle=f; ctx.lineWidth=R*0.075; ctx.shadowColor=g; ctx.shadowBlur=6;
    ctx.beginPath(); ctx.moveTo(cx+R*0.15-sR,cy); ctx.lineTo(cx+R*0.15-sR-axLen,cy); ctx.stroke(); ctx.restore();
    fcirc(ctx,cx+R*0.15-sR-axLen,cy,R*0.12,f,g,A+0.02); // synaptic terminal (weapon)
  } else { // BP0: Elongated squid
    const mL=R*[1.10,1.22,0.96][v], mH=R*[0.74,0.82,0.66][v];
    const tentBase=cx+mL*0.38, nT=[7,6,8][v];
    for (let i=0;i<nT;i++) {
      const t=nT>1?i/(nT-1):0.5, ty=cy+(t-0.5)*mH*1.85;
      const curl=(nh(n,40+i)-0.5)*R*0.58;
      organicArm(ctx,tentBase,ty,tentBase+R*(0.80+nh(n,20+i)*0.95),ty+curl*0.65,R*Math.max(0.035,0.085-i*0.006),curl,f,g,A-0.14);
    }
    ctx.save(); ctx.globalAlpha=A; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=9;
    ctx.beginPath();
    ctx.moveTo(cx-mL,cy); ctx.bezierCurveTo(cx-mL*0.52,cy-mH*0.58,cx,cy-mH,cx+mL*0.48,cy-mH);
    ctx.bezierCurveTo(cx+mL*0.82,cy-mH,cx+mL,cy-mH*0.42,cx+mL,cy);
    ctx.bezierCurveTo(cx+mL,cy+mH*0.42,cx+mL*0.82,cy+mH,cx+mL*0.48,cy+mH);
    ctx.bezierCurveTo(cx,cy+mH,cx-mL*0.52,cy+mH*0.58,cx-mL,cy);
    ctx.closePath(); ctx.fill(); ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,0.16)'; ctx.lineWidth=0.85; ctx.stroke(); ctx.restore();
    for (const s of [-1,1] as const) { fcirc(ctx,cx-mL*0.05,cy+s*mH*0.48,R*0.14,'rgba(255,255,255,0.72)',g,A-0.04); fcirc(ctx,cx-mL*0.05,cy+s*mH*0.48,R*0.07,'#111',g,A+0.05); }
    stinger(ctx,cx-mL,cy,R*0.34,R*0.095,f,g,A);
    for (const s of [-1,1] as const) fpoly(ctx,[[cx+mL,cy+s*mH*0.20],[cx+mL+R*0.28,cy+s*mH*0.62],[cx+mL+R*0.12,cy+s*mH*0.66]],f,g,A-0.22,3);
  }
}

// ── T3  FUNGAL_COLONY ────────────────────────────────────
function drawT3(ctx:Ctx,cx:number,cy:number,R:number,n:number,f:string,g:string,A:number): void {
  const bp=BP(n), v=TV(n), stemX=cx+R*[0.22,0.10,0.32][v];
  const drawCap=(capX:number,capY:number,capW:number,capH:number,alpha:number)=>{
    ctx.save(); ctx.globalAlpha=alpha; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=6;
    ctx.beginPath(); ctx.moveTo(capX-capW,capY); ctx.bezierCurveTo(capX-capW,capY-capH*1.65,capX+capW,capY-capH*1.65,capX+capW,capY); ctx.closePath(); ctx.fill();
    ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,0.18)'; ctx.lineWidth=0.7; ctx.stroke(); ctx.restore();
    ctx.save(); ctx.globalAlpha=alpha-0.22; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=2;
    ctx.beginPath(); ctx.ellipse(capX,capY,capW,capH*0.32,0,0,Math.PI); ctx.fill(); ctx.restore();
  };
  if (bp===1) { // Shelf bracket — 3-4 horizontal layered caps on vertical base
    const nShelf=3+v, baseH=R*[1.10,0.95,1.25][v];
    ctx.save(); ctx.globalAlpha=A-0.10; ctx.strokeStyle=f; ctx.lineWidth=R*0.16; ctx.shadowColor=g; ctx.shadowBlur=5;
    ctx.beginPath(); ctx.moveTo(stemX,cy+baseH*0.35); ctx.lineTo(stemX,cy-baseH); ctx.stroke(); ctx.restore();
    for (let i=0;i<nShelf;i++) {
      const sy=cy-baseH*0.15-i*(baseH*0.75/nShelf);
      const sW=R*(0.62-i*0.06+nh(n,10+i)*0.08), sH=R*(0.18-i*0.015);
      drawCap(stemX+sW*0.5,sy,sW,sH,A-i*0.06);
    }
    gun(ctx,stemX-R*0.22,cy-baseH*0.15,R*0.72,R*0.060,f,g,A);
  } else if (bp===2) { // Coral fungi — branching cylinders with bulbous tips
    const nBranch=4+v, trunkH=R*[0.55,0.50,0.62][v];
    ctx.save(); ctx.globalAlpha=A-0.08; ctx.strokeStyle=f; ctx.lineWidth=R*0.16; ctx.shadowColor=g; ctx.shadowBlur=5;
    ctx.beginPath(); ctx.moveTo(stemX,cy+trunkH*0.30); ctx.lineTo(stemX,cy-trunkH*0.40); ctx.stroke(); ctx.restore();
    for (let i=0;i<nBranch;i++) {
      const a=Math.PI*(1.15+i*(0.70/(nBranch-1))), bLen=R*(0.52+nh(n,10+i)*0.42);
      const bx=stemX+Math.cos(a)*bLen, by=cy-trunkH*0.32+Math.sin(a)*bLen;
      ctx.save(); ctx.globalAlpha=A-0.12; ctx.strokeStyle=f; ctx.lineWidth=R*0.10; ctx.shadowColor=g; ctx.shadowBlur=4;
      ctx.beginPath(); ctx.moveTo(stemX,cy-trunkH*0.32); ctx.lineTo(bx,by); ctx.stroke(); ctx.restore();
      fcirc(ctx,bx,by,R*(0.16+nh(n,20+i)*0.10),f,g,A-0.08);
    }
    gun(ctx,stemX-R*0.55,cy,R*0.62,R*0.060,f,g,A);
  } else if (bp===3) { // HYBRID: Fungal + Mechanical — metal armature with organic caps
    const stemH=R*[0.65,0.55,0.72][v];
    // Mechanical armature (rectangular rails as spine)
    frect(ctx,stemX-R*0.065,cy-stemH*0.90,R*0.13,stemH*1.10,f,g,A-0.06);
    frect(ctx,stemX-R*0.40,cy-stemH*0.40,R*0.80,R*0.10,f,g,A-0.10);
    for (let i=0;i<2+v;i++) { mechArmor(ctx,stemX,cy-stemH*(0.30+i*0.30),Math.PI*0.5,R*0.62,f,g,A-0.08); }
    // Organic caps still growing from mechanical nodes
    drawCap(stemX,cy-stemH*0.90,R*0.50,R*0.26,A-0.04);
    drawCap(stemX-R*0.38,cy-stemH*0.48,R*0.35,R*0.18,A-0.12);
    // Mechanical gun weapon
    gun(ctx,stemX-R*0.55,cy,R*0.75,R*0.065,f,g,A);
  } else if (bp===4) { // INNOVATION: Rhizomorphic neural mat — flat brain-like tissue
    const matW=R*[1.55,1.72,1.38][v], matH=R*[0.55,0.62,0.48][v];
    // Main flat mat
    ctx.save(); ctx.globalAlpha=A; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=8;
    ctx.beginPath();
    ctx.moveTo(cx-matW,cy+matH*0.20);
    ctx.bezierCurveTo(cx-matW,cy-matH,cx+matW,cy-matH,cx+matW,cy+matH*0.20);
    ctx.bezierCurveTo(cx+matW,cy+matH,cx-matW,cy+matH,cx-matW,cy+matH*0.20);
    ctx.closePath(); ctx.fill(); ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,0.16)'; ctx.lineWidth=0.8; ctx.stroke(); ctx.restore();
    // Convoluted folds (gyri/sulci pattern)
    ctx.save(); ctx.globalAlpha=A-0.30; ctx.strokeStyle='rgba(255,255,255,0.65)'; ctx.lineWidth=0.7;
    for (let i=0;i<5+v;i++) {
      const sx=cx-matW*0.75+i*matW*0.38, sy=cy-matH*0.50+nh(n,10+i)*matH*0.60;
      ctx.beginPath(); ctx.moveTo(sx,sy); ctx.quadraticCurveTo(sx+R*(nh(n,20+i)-0.5)*0.45,sy+R*0.28,sx+R*0.35,sy+R*(0.10+nh(n,30+i)*0.22)); ctx.stroke();
    }
    ctx.restore();
    // Ganglia swellings
    for (let i=0;i<4;i++) { fcirc(ctx,cx-matW*0.55+i*matW*0.38,cy-matH*0.15+nh(n,40+i)*matH*0.20,R*(0.10+nh(n,50+i)*0.07),f,g,A-0.16); }
    // Weapon: ejector tube from left edge
    gun(ctx,cx-matW,cy,R*0.68,R*0.060,f,g,A);
  } else { // BP0: Parasol cap + stalk + mycelium
    const stemH=R*[0.65,0.55,0.72][v];
    const nThread=9+v*2;
    for (let i=0;i<nThread;i++) {
      const a=(i/nThread)*Math.PI*2+nh(n,60+i)*0.50;
      const tLen=R*(0.58+nh(n,70+i)*1.20);
      const mx=stemX+Math.cos(a)*tLen*0.55+(nh(n,80+i)-0.5)*R*0.28, my=cy+Math.sin(a)*tLen*0.55+(nh(n,90+i)-0.5)*R*0.28;
      ctx.save(); ctx.globalAlpha=A-0.36; ctx.strokeStyle=f; ctx.lineWidth=R*0.028; ctx.shadowColor=g; ctx.shadowBlur=2;
      ctx.beginPath(); ctx.moveTo(stemX,cy); ctx.quadraticCurveTo(mx,my,stemX+Math.cos(a)*tLen,cy+Math.sin(a)*tLen); ctx.stroke(); ctx.restore();
      fcirc(ctx,stemX+Math.cos(a)*tLen,cy+Math.sin(a)*tLen,R*0.042,f,g,A-0.40);
    }
    ctx.save(); ctx.globalAlpha=A-0.10; ctx.strokeStyle=f; ctx.lineWidth=R*0.13; ctx.shadowColor=g; ctx.shadowBlur=5;
    ctx.beginPath(); ctx.moveTo(stemX,cy+stemH); ctx.lineTo(stemX,cy-stemH*0.40); ctx.stroke(); ctx.restore();
    drawCap(stemX,cy-stemH*0.90,R*(0.54+nh(n,100)*0.10),R*0.27,A);
    drawCap(stemX-R*0.52*0.55,cy-stemH*0.52,R*(0.44-0.055),R*(0.27-0.025),A-0.06);
    drawCap(stemX+R*0.52*0.55,cy-stemH*0.52,R*(0.44-0.055),R*(0.27-0.025),A-0.06);
    const tubeLen=R*(0.62+nh(n,7)*0.42);
    ctx.save(); ctx.globalAlpha=A-0.05; ctx.strokeStyle=f; ctx.lineWidth=R*0.13; ctx.shadowColor=g; ctx.shadowBlur=5;
    ctx.beginPath(); ctx.moveTo(cx-R*0.55,cy); ctx.lineTo(cx-R*0.55-tubeLen,cy); ctx.stroke(); ctx.restore();
    fcirc(ctx,cx-R*0.55-tubeLen,cy,R*0.12,f,g,A); fcirc(ctx,cx-R*0.55-tubeLen-R*0.10,cy,R*0.055,'rgba(255,255,255,0.72)',g,A);
  }
}

// ── T4  VERTEBRATE ───────────────────────────────────────
function drawT4(ctx:Ctx,cx:number,cy:number,R:number,n:number,f:string,g:string,A:number): void {
  const bp=BP(n), v=TV(n);
  const drawSkullRibs=(spL:number,nRib:number)=>{
    drawSpine(ctx,cx-spL,cy,cx+spL*0.55,cy,R*0.11,f,g,A);
    for (let i=0;i<nRib;i++) {
      const rx=cx-spL*0.60+i*(spL*0.78/Math.max(nRib-1,1));
      const rH=R*(0.55+nh(n,10+i)*0.30)*(1-Math.abs(rx-cx)/(spL*0.92)*0.32);
      for (const s of [-1,1] as const) {
        ctx.save(); ctx.globalAlpha=A-0.10; ctx.strokeStyle=f; ctx.lineWidth=R*0.07; ctx.shadowColor=g; ctx.shadowBlur=3;
        ctx.beginPath(); ctx.moveTo(rx,cy); ctx.bezierCurveTo(rx+R*0.12,cy+s*rH*0.48,rx+R*0.20,cy+s*rH*0.86,rx+R*0.06,cy+s*rH); ctx.stroke(); ctx.restore();
      }
    }
  };
  if (bp===1) { // Aquatic swimmer — fusiform, paired fins, forked tail
    const bL=R*[1.72,1.55,1.90][v], bH=R*[0.38,0.44,0.34][v];
    ctx.save(); ctx.globalAlpha=A; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=8;
    ctx.beginPath();
    ctx.moveTo(cx-bL,cy); ctx.bezierCurveTo(cx-bL,cy-bH,cx+bL*0.30,cy-bH,cx+bL*0.65,cy-bH*0.38);
    ctx.lineTo(cx+bL,cy); ctx.lineTo(cx+bL*0.65,cy+bH*0.38);
    ctx.bezierCurveTo(cx+bL*0.30,cy+bH,cx-bL,cy+bH,cx-bL,cy);
    ctx.closePath(); ctx.fill(); ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,0.18)'; ctx.lineWidth=0.85; ctx.stroke(); ctx.restore();
    // Dorsal fin
    fpoly(ctx,[[cx-bL*0.10,cy-bH],[cx-bL*0.35,cy-bH-R*0.42],[cx-bL*0.62,cy-bH-R*0.38],[cx-bL*0.68,cy-bH]],f,g,A-0.10,4);
    // Paired pectoral fins
    for (const s of [-1,1] as const) fpoly(ctx,[[cx-bL*0.08,cy+s*bH*0.30],[cx-bL*0.08,cy+s*bH],[cx+bL*0.20,cy+s*bH*0.65],[cx+bL*0.25,cy+s*bH*0.25]],f,g,A-0.14,4);
    // Forked tail
    for (const s of [-1,1] as const) fpoly(ctx,[[cx+bL,cy+s*bH*0.08],[cx+bL+R*0.55,cy+s*R*0.52],[cx+bL+R*0.42,cy+s*R*0.58]],f,g,A-0.18,3);
    // Eye + stinger weapon
    fcirc(ctx,cx-bL+R*0.55,cy-bH*0.25,R*0.11,'rgba(255,255,255,0.80)',g,A); fcirc(ctx,cx-bL+R*0.55,cy-bH*0.25,R*0.055,'#111',g,1.0);
    stinger(ctx,cx-bL,cy,R*0.40,R*0.080,f,g,A);
  } else if (bp===2) { // Serpentine — S-curve spine, no ribcage, fang at tip
    const sLen=R*[2.30,2.10,2.55][v], nSeg=5+v;
    // Draw S-curve spine segments
    for (let i=0;i<nSeg;i++) {
      const t=i/(nSeg-1), t2=(i+1)/(nSeg-1);
      const wave=Math.sin(t*Math.PI)*R*[0.52,0.62,0.44][v];
      const wave2=Math.sin(t2*Math.PI)*R*[0.52,0.62,0.44][v];
      const x1=cx-sLen+t*sLen*1.55, x2=cx-sLen+t2*sLen*1.55;
      const r=R*(0.28-t*0.10);
      fell(ctx,x1,cy+wave,r*1.15,r,f,g,A-i*0.05);
      if (i<nSeg-1) sline(ctx,x1,cy+wave,x2,cy+wave2,f,A-0.28,r*1.8);
    }
    // Head (leftmost)
    fell(ctx,cx-sLen,cy,R*0.32,R*0.24,f,g,A);
    fcirc(ctx,cx-sLen+R*0.10,cy-R*0.12,R*0.10,'rgba(255,255,255,0.80)',g,A);
    stinger(ctx,cx-sLen-R*0.32,cy,R*0.42,R*0.085,f,g,A);
    // Tail tip (rightmost)
    fpoly(ctx,[[cx+R*0.55*1.55,cy+Math.sin(Math.PI)*R*0.52],[cx+R*0.55*1.55+R*0.30,cy+Math.sin(Math.PI)*R*0.52+R*0.05],[cx+R*0.55*1.55+R*0.20,cy+Math.sin(Math.PI)*R*0.52-R*0.05]],f,g,A-0.22,3);
  } else if (bp===3) { // HYBRID: Vertebrate + Mechanical — cyborg predator
    const spL=R*[1.95,1.75,2.15][v];
    drawSkullRibs(spL,4+v);
    // Skull (organic)
    const hW=R*[0.55,0.62,0.50][v], hH=R*[0.38,0.44,0.34][v];
    ctx.save(); ctx.globalAlpha=A; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=8;
    ctx.beginPath();
    ctx.moveTo(cx-spL-hW*0.50,cy); ctx.bezierCurveTo(cx-spL-hW*0.50,cy-hH,cx-spL+hW*0.80,cy-hH,cx-spL+hW,cy-hH*0.28);
    ctx.lineTo(cx-spL+hW,cy+hH*0.28); ctx.bezierCurveTo(cx-spL+hW*0.80,cy+hH,cx-spL-hW*0.50,cy+hH,cx-spL-hW*0.50,cy);
    ctx.closePath(); ctx.fill(); ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,0.18)'; ctx.lineWidth=0.85; ctx.stroke(); ctx.restore();
    // Mechanical sensor replaces eye
    frect(ctx,cx-spL-R*0.05,cy-hH*0.32,R*0.38,R*0.14,f,g,A-0.04); fcirc(ctx,cx-spL+R*0.22,cy-hH*0.25,R*0.07,'rgba(255,255,255,0.88)',g,A);
    // Mechanical gun replaces fang
    graftGun(ctx,cx-spL-hW*0.50,cy,R,f,g,A);
    // Mechanical armor plates along spine
    for (let i=0;i<3;i++) { const px=cx-spL*0.55+i*spL*0.45; frect(ctx,px-R*0.065,cy-R*0.45-R*0.16,R*0.13,R*0.16,f,g,A-0.06); }
    fell(ctx,cx+spL*0.35,cy,R*0.44,R*0.32,f,g,A-0.12);
    fpoly(ctx,[[cx+spL*0.55,cy-R*0.08],[cx+spL+R*0.28,cy],[cx+spL*0.55,cy+R*0.08]],f,g,A-0.18,3);
  } else if (bp===4) { // INNOVATION: Leviathan — massive whale-like, tiny forward weapon
    const bL=R*[2.10,1.90,2.35][v], bH=R*[0.72,0.82,0.64][v];
    ctx.save(); ctx.globalAlpha=A; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=10;
    ctx.beginPath();
    ctx.moveTo(cx-bL,cy); ctx.bezierCurveTo(cx-bL,cy-bH*0.55,cx-bL*0.20,cy-bH,cx+bL*0.38,cy-bH*0.90);
    ctx.bezierCurveTo(cx+bL*0.72,cy-bH*0.68,cx+bL,cy-bH*0.30,cx+bL,cy);
    ctx.bezierCurveTo(cx+bL,cy+bH*0.30,cx+bL*0.72,cy+bH*0.68,cx+bL*0.38,cy+bH*0.90);
    ctx.bezierCurveTo(cx-bL*0.20,cy+bH,cx-bL,cy+bH*0.55,cx-bL,cy);
    ctx.closePath(); ctx.fill(); ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,0.18)'; ctx.lineWidth=0.9; ctx.stroke(); ctx.restore();
    // Belly stripes
    ctx.save(); ctx.globalAlpha=A-0.28; ctx.strokeStyle='rgba(255,255,255,0.6)'; ctx.lineWidth=0.65;
    for (let i=1;i<=4;i++) { const sx=cx-bL*0.55+i*bL*0.25; const sh=bH*0.88*Math.sqrt(Math.max(0,1-Math.pow((sx-cx+bL*0.10)/(bL*0.88),2))); ctx.beginPath(); ctx.moveTo(sx,cy-sh); ctx.lineTo(sx,cy+sh); ctx.stroke(); }
    ctx.restore();
    // Pectoral fins
    for (const s of [-1,1] as const) fpoly(ctx,[[cx-bL*0.10,cy+s*bH*0.72],[cx+bL*0.25,cy+s*bH],[cx+bL*0.45,cy+s*bH*0.60],[cx+bL*0.38,cy+s*bH*0.40]],f,g,A-0.16,4);
    // Tail flukes
    for (const s of [-1,1] as const) fpoly(ctx,[[cx+bL,cy+s*bH*0.15],[cx+bL+R*0.65,cy+s*bH*0.72],[cx+bL+R*0.50,cy+s*bH*0.80]],f,g,A-0.20,3);
    stinger(ctx,cx-bL,cy,R*0.38,R*0.075,f,g,A);
  } else { // BP0: Theropod (skull + spine + ribs + haunches)
    const spL=R*[2.10,1.90,2.30][v];
    drawSkullRibs(spL,[5,6,4][v]);
    const hW=R*[0.55,0.62,0.50][v], hH=R*[0.38,0.44,0.34][v];
    ctx.save(); ctx.globalAlpha=A; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=8;
    ctx.beginPath();
    ctx.moveTo(cx-spL-hW*0.50,cy); ctx.bezierCurveTo(cx-spL-hW*0.50,cy-hH,cx-spL+hW*0.80,cy-hH,cx-spL+hW,cy-hH*0.28);
    ctx.lineTo(cx-spL+hW,cy+hH*0.28); ctx.bezierCurveTo(cx-spL+hW*0.80,cy+hH,cx-spL-hW*0.50,cy+hH,cx-spL-hW*0.50,cy);
    ctx.closePath(); ctx.fill(); ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,0.20)'; ctx.lineWidth=0.85; ctx.stroke(); ctx.restore();
    stinger(ctx,cx-spL-hW*0.50,cy,R*0.42,R*0.10,f,g,A);
    fcirc(ctx,cx-spL-hW*0.12,cy-hH*0.28,R*0.12,'rgba(255,255,255,0.80)',g,A); fcirc(ctx,cx-spL-hW*0.12,cy-hH*0.28,R*0.06,'#111',g,1.0);
    fell(ctx,cx+spL*0.35,cy,R*0.44,R*0.32,f,g,A-0.12);
    fpoly(ctx,[[cx+spL*0.55,cy-R*0.08],[cx+spL+R*0.32,cy],[cx+spL*0.55,cy+R*0.08]],f,g,A-0.18,3);
  }
}

// ── T5  CRYSTAL_CLUSTER ───────────────────────────────────
function drawT5(ctx:Ctx,cx:number,cy:number,R:number,n:number,f:string,g:string,A:number): void {
  const bp=BP(n), v=TV(n);
  if (bp===1) { // Geode — circular shell with hollow, interior spikes
    const oR=R*[1.10,1.22,0.98][v], shellW=R*0.14;
    ctx.save(); ctx.globalAlpha=A-0.10; ctx.strokeStyle=f; ctx.lineWidth=shellW*2; ctx.shadowColor=g; ctx.shadowBlur=8;
    ctx.beginPath(); ctx.arc(cx,cy,oR-shellW,0,Math.PI*2); ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,0.20)'; ctx.lineWidth=0.8; ctx.stroke(); ctx.restore();
    // Interior crystal spikes pointing inward
    const iR=oR-shellW*2.5, nSpike=6+v*2;
    for (let i=0;i<nSpike;i++) {
      const a=(i/nSpike)*Math.PI*2;
      const tipX=cx+Math.cos(a)*iR*0.35, tipY=cy+Math.sin(a)*iR*0.35;
      crystalShard(ctx,cx+Math.cos(a)*iR,cy+Math.sin(a)*iR,a+Math.PI,iR*0.65,R*0.07,f,g,A-0.06);
    }
    fcirc(ctx,cx,cy,iR*0.20,f,g,A+0.04);
    gun(ctx,cx-oR,cy,R*0.72,R*0.062,f,g,A);
  } else if (bp===2) { // Spire formation — tall central crystal + flanking spires
    const spH=R*[1.55,1.80,1.32][v], spW=R*[0.22,0.26,0.18][v];
    // Main central spire
    fpoly(ctx,[[cx-spW,cy+spH*0.40],[cx+spW,cy+spH*0.40],[cx+spW*0.40,cy-spH],[cx-spW*0.40,cy-spH]],f,g,A,7);
    fpoly(ctx,[[cx+spW*0.40,cy+spH*0.40],[cx+spW*1.20,cy-spH*0.55],[cx+spW*0.40,cy-spH]],'rgba(255,255,255,0.24)',g,A-0.28,2);
    // Flanking spires
    for (const [sx,sc] of [[cx-R*0.72,0.62],[cx+R*0.72,0.58]] as [number,number][]) {
      fpoly(ctx,[[sx-spW*sc,cy+spH*0.20*sc],[sx+spW*sc,cy+spH*0.20*sc],[sx+spW*0.35*sc,cy-spH*sc],[sx-spW*0.35*sc,cy-spH*sc]],f,g,A-0.14,5);
    }
    gun(ctx,cx-spW,cy,R*0.90,R*0.062,f,g,A);
  } else if (bp===3) { // HYBRID: Crystal + Energy — plasma-charged crystal structure
    const coreR=R*[0.30,0.28,0.34][v], nShard=[6,7,5][v];
    for (let i=0;i<nShard;i++) {
      const baseA=(i/nShard)*Math.PI*2-Math.PI/8;
      const shardLen=R*(0.65+nh(n,10+i)*0.80);
      const midA=baseA+(nh(n,30+i)-0.5)*0.28;
      const tipX=cx+Math.cos(midA)*(coreR+shardLen), tipY=cy+Math.sin(midA)*(coreR+shardLen);
      const lbX=cx+Math.cos(baseA-0.25)*coreR, lbY=cy+Math.sin(baseA-0.25)*coreR;
      const rbX=cx+Math.cos(baseA+0.25)*coreR, rbY=cy+Math.sin(baseA+0.25)*coreR;
      fpoly(ctx,[[lbX,lbY],[rbX,rbY],[tipX,tipY]],f,g,A-0.04,6);
    }
    const corePts:P2[]=[];
    for (let i=0;i<[6,8,5][v];i++) { const a=(i/[6,8,5][v])*Math.PI*2; corePts.push([cx+coreR*Math.cos(a),cy+coreR*Math.sin(a)]); }
    fpoly(ctx,corePts,f,g,A+0.06,8);
    // Energy graft — plasma filling gaps between shards
    graftEnergyField(ctx,cx,cy,R*1.10,n,f,g,A);
    fpoly(ctx,[[cx-coreR,cy-R*0.08],[cx-coreR-R*(0.90+nh(n,5)*0.42),cy],[cx-coreR,cy+R*0.08]],f,g,A+0.02,7);
  } else if (bp===4) { // INNOVATION: Snowflake crystal — 6-fold symmetry, lacy branches
    const mainR=R*[0.85,1.0,0.72][v];
    for (let i=0;i<6;i++) {
      const a=(i/6)*Math.PI*2;
      // Main arm
      const eax=cx+Math.cos(a)*mainR, eay=cy+Math.sin(a)*mainR;
      sline(ctx,cx,cy,eax,eay,f,A-0.06,R*0.09);
      // Side branches
      for (let j=1;j<=2;j++) {
        const t=j/3, bx=cx+Math.cos(a)*mainR*t, by=cy+Math.sin(a)*mainR*t;
        const bLen=mainR*(0.28-j*0.06);
        for (const bs of [-1,1] as const) {
          const ba=a+Math.PI/2*bs;
          sline(ctx,bx,by,bx+Math.cos(ba)*bLen,by+Math.sin(ba)*bLen,f,A-0.14,R*0.055);
          fcirc(ctx,bx+Math.cos(ba)*bLen,by+Math.sin(ba)*bLen,R*0.050,f,g,A-0.22);
        }
      }
      fcirc(ctx,eax,eay,R*0.080,f,g,A-0.12);
    }
    fcirc(ctx,cx,cy,R*0.16,f,g,A+0.04);
    gun(ctx,cx-mainR,cy,R*0.72,R*0.055,f,g,A);
  } else { // BP0: Radiating shards + core polygon
    const nShard=[6,7,5][v], coreR=R*[0.30,0.28,0.34][v];
    for (let i=0;i<nShard;i++) {
      const baseA=(i/nShard)*Math.PI*2-Math.PI/8, shardLen=R*(0.65+nh(n,10+i)*0.80);
      const midA=baseA+(nh(n,30+i)-0.5)*0.28;
      const tipX=cx+Math.cos(midA)*(coreR+shardLen), tipY=cy+Math.sin(midA)*(coreR+shardLen);
      const lbX=cx+Math.cos(baseA-0.25)*coreR, lbY=cy+Math.sin(baseA-0.25)*coreR;
      const rbX=cx+Math.cos(baseA+0.25)*coreR, rbY=cy+Math.sin(baseA+0.25)*coreR;
      const px=-Math.sin(midA)*R*0.045, py=Math.cos(midA)*R*0.045;
      fpoly(ctx,[[lbX,lbY],[rbX,rbY],[tipX,tipY]],f,g,A-0.04,6);
      fpoly(ctx,[[rbX,rbY],[tipX,tipY],[tipX+px,tipY+py]],'rgba(255,255,255,0.32)',g,A-0.28,2);
    }
    const nCoreSides=[6,8,5][v], corePts:P2[]=[];
    for (let i=0;i<nCoreSides;i++) { const a=(i/nCoreSides)*Math.PI*2-Math.PI/6; corePts.push([cx+coreR*Math.cos(a),cy+coreR*Math.sin(a)]); }
    fpoly(ctx,corePts,f,g,A+0.06,8);
    const fLen=R*(0.90+nh(n,5)*0.42);
    fpoly(ctx,[[cx-coreR,cy-R*0.08],[cx-coreR-fLen,cy],[cx-coreR,cy+R*0.08]],f,g,A+0.02,7);
    fpoly(ctx,[[cx-coreR-R*0.10,cy-R*0.04],[cx-coreR-fLen-R*0.14,cy],[cx-coreR-R*0.10,cy+R*0.04]],'rgba(255,255,255,0.30)',g,A-0.24,3);
  }
}

// ── T6  ARTHROPOD ────────────────────────────────────────
function drawT6(ctx:Ctx,cx:number,cy:number,R:number,n:number,f:string,g:string,A:number): void {
  const bp=BP(n), v=TV(n);
  if (bp===1) { // Scorpion — elongated body, curved tail with stinger
    const bL=R*[1.55,1.42,1.72][v], tH=R*[0.28,0.34,0.24][v];
    // Segmented body (4 segments decreasing in size)
    for (let i=0;i<4;i++) {
      const sx=cx-bL*0.45+i*(bL*0.90/3);
      const sR=R*(0.32-i*0.04+nh(n,10+i)*0.06);
      fell(ctx,sx,cy,sR,sR*0.75,f,g,A-i*0.05);
    }
    // Claws (large pincers at front)
    for (const s of [-1,1] as const) {
      const cx2=cx-bL*0.45-R*0.20, cy2=cy+s*R*0.40;
      fpoly(ctx,[[cx2,cy2],[cx2-R*0.52,cy2+s*R*0.10],[cx2-R*0.52,cy2-s*R*0.22],[cx2-R*0.18,cy2-s*R*0.22]],f,g,A-0.08,4);
    }
    stinger(ctx,cx-bL*0.45-R*0.38,cy,R*0.52,R*0.08,f,g,A);
    // Tail curving over body
    const nTailSeg=4+v;
    for (let i=0;i<nTailSeg;i++) {
      const t=(i+1)/(nTailSeg+1);
      const tx=cx+bL*0.45+t*R*0.80, ty=cy-t*t*R*1.20;
      const tr=R*(0.20-t*0.08);
      fell(ctx,tx,ty,tr,tr,f,g,A-i*0.05);
    }
    // Tail stinger at tip
    const finalT=cx+bL*0.45+R*0.80, finalY=cy-R*1.20;
    stinger(ctx,finalT,finalY,-R*0.38,R*0.07,f,g,A);
    // Legs (3 pairs)
    for (let i=0;i<3;i++) { const lx=cx-bL*0.20+i*R*0.42; for (const s of [-1,1] as const) sline(ctx,lx,cy+s*R*0.28,lx+s*R*0.28,cy+s*R*0.72,f,A-0.22,R*0.055); }
  } else if (bp===2) { // Crab — very wide flat body, enormous front claws
    const bW=R*[1.02,1.18,0.88][v], bH=R*[0.36,0.42,0.30][v];
    fell(ctx,cx+R*0.20,cy,bW,bH,f,g,A); // wide flat carapace
    // Carapace patterning
    ctx.save(); ctx.globalAlpha=A-0.30; ctx.strokeStyle='rgba(255,255,255,0.65)'; ctx.lineWidth=0.65;
    for (let i=1;i<=3;i++) { const rx=cx+R*0.20-bW*0.6+i*bW*0.40; const rh=bH*0.85*Math.sqrt(Math.max(0,1-Math.pow((rx-cx-R*0.20)/bW,2))); ctx.beginPath(); ctx.moveTo(rx,cy-rh); ctx.lineTo(rx,cy+rh); ctx.stroke(); }
    ctx.restore();
    // Enormous front claws
    for (const s of [-1,1] as const) {
      const clawX=cx-bW-R*0.10;
      fpoly(ctx,[[clawX,cy+s*bH*0.20],[clawX-R*0.72,cy+s*R*0.42],[clawX-R*0.72,cy+s*R*0.08],[clawX-R*0.28,cy+s*R*0.02]],f,g,A-0.06,4);
      fpoly(ctx,[[clawX,cy+s*bH*0.20],[clawX-R*0.65,cy-s*R*0.02],[clawX-R*0.62,cy-s*R*0.32],[clawX-R*0.22,cy-s*R*0.26]],f,g,A-0.10,4);
    }
    // Short walking legs (4 pairs)
    for (let i=0;i<4;i++) { const lx=cx-bW*0.60+i*bW*0.40+R*0.20; for (const s of [-1,1] as const) sline(ctx,lx,cy+s*bH,lx+(s>0?R*0.14:-R*0.14),cy+s*(bH+R*0.42),f,A-0.24,R*0.052); }
    stinger(ctx,cx-bW-R*0.80,cy,R*0.45,R*0.07,f,g,A);
  } else if (bp===3) { // HYBRID: Arthropod + Crystal — crystal exoskeleton
    // Abdomen with crystal plating
    const abX=cx+R*[0.72,0.62,0.82][v], abW=R*[0.72,0.80,0.65][v], abH=R*[0.50,0.58,0.45][v];
    fell(ctx,abX,cy,abW,abH,f,g,A);
    // Crystal dorsal growth on abdomen
    graftCrystalDorsal(ctx,abX,cy,R,n,f,g,A);
    // Thorax
    fell(ctx,cx-R*0.18,cy,R*0.48,R*0.36,f,g,A-0.04);
    // Crystal legs (sharp mineral instead of chitin)
    const legRoots=[-R*0.36*0.55,0,R*0.36*0.55];
    for (let i=0;i<3;i++) {
      for (const s of [-1,1] as const) {
        const lby=cy+legRoots[i];
        crystalShard(ctx,cx-R*0.18,lby,s>0?Math.PI*0.38:Math.PI*0.62,R*0.72,R*0.060,f,g,A-0.14);
      }
    }
    // Crystal mandible weapon
    crystalShard(ctx,cx-R*0.80,cy,Math.PI,R*0.65,R*0.075,f,g,A);
    fell(ctx,cx-R*0.80,cy,R*0.30,R*0.28,f,g,A-0.06);
  } else if (bp===4) { // INNOVATION: Mantis — raptorial forelegs, triangular head
    const thoraxX=cx-R*0.10, thoraxW=R*[0.42,0.48,0.36][v], thoraxH=R*[0.32,0.38,0.28][v];
    // Elongated abdomen (rear)
    fell(ctx,cx+R*0.85,cy,R*0.72,R*0.30,f,g,A);
    ctx.save(); ctx.globalAlpha=A-0.28; ctx.strokeStyle='rgba(255,255,255,0.65)'; ctx.lineWidth=0.6;
    for (let i=1;i<=3;i++) { ctx.beginPath(); ctx.moveTo(cx+R*0.28+i*R*0.30,cy-R*0.24); ctx.lineTo(cx+R*0.28+i*R*0.30,cy+R*0.24); ctx.stroke(); }
    ctx.restore();
    // Thorax
    fell(ctx,thoraxX,cy,thoraxW,thoraxH,f,g,A-0.04);
    // Triangular head
    fpoly(ctx,[[cx-R*0.62,cy-R*0.22],[cx-R*0.62,cy+R*0.22],[cx-R*1.05,cy]],f,g,A);
    fcirc(ctx,cx-R*0.75,cy-R*0.12,R*0.11,'rgba(255,255,255,0.82)',g,A);
    // Raptorial forelegs (asymmetric, weapon-like)
    for (const s of [-1,1] as const) {
      fpoly(ctx,[[cx-R*0.62,cy+s*R*0.14],[cx-R*1.05+R*0.15,cy+s*R*0.55],[cx-R*1.05-R*0.18,cy+s*R*0.38],[cx-R*0.80,cy+s*R*0.08]],f,g,A-0.10,4);
      fcirc(ctx,cx-R*1.05-R*0.18,cy+s*R*0.38,R*0.06,f,g,A-0.18);
    }
    // Walking legs
    for (let i=0;i<2;i++) { const lx=thoraxX+R*0.10+i*thoraxW*0.65; for (const s of [-1,1] as const) sline(ctx,lx,cy+s*thoraxH,lx+s*R*0.20,cy+s*(thoraxH+R*0.42),f,A-0.22,R*0.050); }
    stinger(ctx,cx-R*1.05,cy,R*0.38,R*0.075,f,g,A);
  } else { // BP0: Spider — round abdomen, 8 legs, chelicerae
    const abX=cx+R*[0.72,0.62,0.82][v], abW=R*[0.72,0.80,0.65][v], abH=R*[0.50,0.58,0.45][v];
    fell(ctx,abX,cy,abW,abH,f,g,A);
    ctx.save(); ctx.globalAlpha=A-0.38; ctx.strokeStyle='rgba(255,255,255,0.7)'; ctx.lineWidth=0.65;
    for (let i=1;i<=3;i++) { const sx=abX-abW+i*(abW*2/4); const sh=abH*Math.sqrt(Math.max(0,1-Math.pow((sx-abX)/abW,2))); ctx.beginPath(); ctx.moveTo(sx,cy-sh); ctx.lineTo(sx,cy+sh); ctx.stroke(); }
    ctx.restore();
    fell(ctx,cx-R*0.18,cy,R*0.48,R*0.36,f,g,A-0.04);
    const legRoots=[-R*0.36*0.55,0,R*0.36*0.55];
    for (let i=0;i<3;i++) { for (const s of [-1,1] as const) { const lby=cy+legRoots[i]; const kx=cx-R*0.18+s*R*0.18, ky=lby+s*R*0.55; const fx=cx-R*0.18+s*R*0.42, fy=ky+s*R*0.36; fpoly(ctx,[[cx-R*0.18-R*0.05,lby],[cx-R*0.18+R*0.05,lby],[kx+R*0.05,ky],[kx-R*0.05,ky]],f,g,A-0.15); fcirc(ctx,kx,ky,R*0.07,f,g,A-0.12); fpoly(ctx,[[kx-R*0.04,ky],[kx+R*0.04,ky],[fx+R*0.04,fy],[fx-R*0.04,fy]],f,g,A-0.20); } }
    fell(ctx,cx-R*0.80,cy,R*0.30,R*0.28,f,g,A-0.06);
    fcirc(ctx,cx-R*0.80-R*0.22,cy-R*0.28*0.40,R*0.10,'rgba(255,255,255,0.80)',g,A);
    for (const s of [-1,1] as const) fpoly(ctx,[[cx-R*0.80-R*0.30*0.90,cy+s*R*0.04],[cx-R*0.80-R*0.30*0.90-R*0.38,cy+s*R*0.22],[cx-R*0.80-R*0.30*0.90-R*0.34,cy+s*R*0.07]],f,g,A-0.08,4);
  }
}

// ── T7  CRAWLER_BED ──────────────────────────────────────
function drawT7(ctx:Ctx,cx:number,cy:number,R:number,n:number,f:string,g:string,A:number): void {
  const bp=BP(n), v=TV(n);
  const drawTracks=(trkW:number,trkH:number)=>{
    fpoly(ctx,[[cx-trkW-R*0.12,cy-trkH],[cx+trkW+R*0.12,cy-trkH],[cx+trkW,cy+trkH],[cx-trkW,cy+trkH]],f,g,A-0.04);
    ctx.save(); ctx.globalAlpha=0.28; ctx.strokeStyle='rgba(255,255,255,0.8)'; ctx.lineWidth=trkH*0.52;
    for (let i=0;i<=12;i++) { const tx=cx-trkW+i*(trkW*2/12); ctx.beginPath(); ctx.moveTo(tx,cy-trkH+R*0.03); ctx.lineTo(tx,cy+trkH-R*0.03); ctx.stroke(); }
    ctx.restore();
    fcirc(ctx,cx-trkW,cy,trkH*0.60,f,g,A-0.06); fcirc(ctx,cx+trkW,cy,trkH*0.60,f,g,A-0.06);
  };
  if (bp===1) { // Artillery platform — narrow tracks, tall hull, angled barrel
    const trkW=R*[1.65,1.80,1.45][v], trkH=R*0.22, hullH=R*[0.75,0.85,0.65][v], hullW=R*0.62;
    drawTracks(trkW,trkH);
    frect(ctx,cx-hullW,cy-trkH-hullH,hullW*2,hullH,f,g,A+0.04);
    // Raised superstructure with angled barrel
    fell(ctx,cx-hullW*0.30,cy-trkH-hullH-R*0.28,R*0.35,R*0.24,f,g,A-0.06);
    // Angled long-range barrel
    const barAngle=-Math.PI*0.12;
    const bLen=R*(1.10+nh(n,7)*0.45);
    ctx.save(); ctx.globalAlpha=A; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=5;
    ctx.save(); ctx.translate(cx-hullW*0.30,cy-trkH-hullH-R*0.28); ctx.rotate(barAngle);
    frect(ctx,-bLen,-R*0.060,bLen,R*0.12,f,g,A+0.04); fcirc(ctx,-bLen,0,R*0.065,f,g,A+0.06);
    ctx.restore(); ctx.restore();
  } else if (bp===2) { // Multi-track — 3 separate track sections + wide spine
    const trackW=R*[0.62,0.72,0.55][v], trkH=R*0.20;
    for (const dx of [cx-R*[1.30,1.45,1.15][v],cx,cx+R*[1.30,1.45,1.15][v]]) {
      fpoly(ctx,[[dx-trackW-R*0.08,cy-trkH],[dx+trackW+R*0.08,cy-trkH],[dx+trackW,cy+trkH],[dx-trackW,cy+trkH]],f,g,A-0.04);
      ctx.save(); ctx.globalAlpha=0.25; ctx.strokeStyle='rgba(255,255,255,0.8)'; ctx.lineWidth=trkH*0.55;
      for (let i=0;i<=6;i++) { const tx=dx-trackW+i*(trackW*2/6); ctx.beginPath(); ctx.moveTo(tx,cy-trkH+R*0.02); ctx.lineTo(tx,cy+trkH-R*0.02); ctx.stroke(); }
      ctx.restore();
    }
    frect(ctx,cx-R*[1.30,1.45,1.15][v]-trackW,cy-trkH*0.30,R*[2.60,2.90,2.30][v]*2+trackW*2,trkH*0.60,f,g,A-0.12);
    fell(ctx,cx,cy-trkH-R*0.32,R*0.35,R*0.24,f,g,A-0.08);
    gun(ctx,cx-R*[1.30,1.45,1.15][v]-trackW,cy-trkH*0.10,R*0.95,R*0.062,f,g,A);
  } else if (bp===3) { // HYBRID: Crawler + Crystal — tracked chassis + crystal superstructure
    const trkW=R*[2.10,2.35,1.90][v], trkH=R*[0.28,0.36,0.24][v];
    drawTracks(trkW,trkH);
    // Crystal superstructure on top
    graftCrystalDorsal(ctx,cx,cy-trkH-R*0.10,R*1.10,n,f,g,A);
    const hullW=R*0.60;
    frect(ctx,cx-hullW,cy-trkH-R*0.36,hullW*2,R*0.36,f,g,A+0.02);
    // Crystal focusing cannon
    crystalShard(ctx,cx-hullW,cy-trkH-R*0.18,Math.PI,R*(0.95+nh(n,7)*0.40),R*0.065,f,g,A);
  } else if (bp===4) { // INNOVATION: Centipede crawler — 6 small track units in spine chain
    const nUnit=6, unitW=R*[0.45,0.52,0.40][v], unitH=R*0.18, pitch=unitW*2.20;
    const totalW=pitch*(nUnit-1), startX=cx+totalW/2;
    for (let i=0;i<nUnit;i++) {
      const ux=startX-i*pitch, uScale=1-i*0.04;
      fpoly(ctx,[[ux-unitW*uScale-R*0.06,cy-unitH],[ux+unitW*uScale+R*0.06,cy-unitH],[ux+unitW*uScale,cy+unitH],[ux-unitW*uScale,cy+unitH]],f,g,A-i*0.04);
      if (i<nUnit-1) sline(ctx,ux-unitW*uScale,cy,ux-pitch+unitW*(uScale-0.04),cy,f,A-0.30,R*0.10);
    }
    gun(ctx,startX-unitW-R*0.06,cy,R*0.70,R*0.058,f,g,A);
  } else { // BP0: Wide low-profile tank
    const trkW=R*[2.35,2.60,2.10][v], trkH=R*[0.32,0.40,0.28][v], hullW=R*[0.75,0.85,0.65][v], hullH=R*[0.50,0.58,0.42][v];
    drawTracks(trkW,trkH);
    for (const dx of [cx-trkW*0.50,cx,cx+trkW*0.50]) fcirc(ctx,dx,cy,trkH*0.35,f,g,A-0.20);
    frect(ctx,cx-hullW,cy-trkH-hullH,hullW*2,hullH,f,g,A+0.04);
    fell(ctx,cx-hullW*0.28,cy-trkH-hullH-R*0.22,R*0.30,R*0.20,f,g,A-0.06);
    gun(ctx,cx-hullW*0.28-R*0.30,cy-trkH-hullH-R*0.22,R*0.92,R*0.065,f,g,A);
  }
}

// ── T8  ENERGY_FIELD ─────────────────────────────────────
function drawT8(ctx:Ctx,cx:number,cy:number,R:number,n:number,f:string,g:string,A:number): void {
  const bp=BP(n), v=TV(n);
  if (bp===1) { // Lightning node — central sphere + jagged arc bolts
    fcirc(ctx,cx,cy,R*[0.30,0.36,0.26][v],f,g,A+0.04);
    fcirc(ctx,cx,cy,R*[0.16,0.19,0.13][v],'rgba(255,255,255,0.85)',g,A-0.04);
    const nBolt=5+v*2;
    for (let i=0;i<nBolt;i++) {
      const a=(i/nBolt)*Math.PI*2+nh(n,10+i)*0.5;
      const bLen=R*(0.80+nh(n,20+i)*0.80);
      const mid1X=cx+Math.cos(a)*bLen*0.35+(nh(n,30+i)-0.5)*R*0.42;
      const mid1Y=cy+Math.sin(a)*bLen*0.35+(nh(n,35+i)-0.5)*R*0.42;
      const mid2X=cx+Math.cos(a)*bLen*0.68+(nh(n,40+i)-0.5)*R*0.35;
      const mid2Y=cy+Math.sin(a)*bLen*0.68+(nh(n,45+i)-0.5)*R*0.35;
      const ex=cx+Math.cos(a)*bLen, ey=cy+Math.sin(a)*bLen;
      ctx.save(); ctx.globalAlpha=A-0.14; ctx.strokeStyle=f; ctx.lineWidth=R*0.042; ctx.shadowColor=g; ctx.shadowBlur=12;
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(mid1X,mid1Y); ctx.lineTo(mid2X,mid2Y); ctx.lineTo(ex,ey); ctx.stroke(); ctx.restore();
      fcirc(ctx,ex,ey,R*0.08,f,g,A-0.22);
    }
    const beamLen=R*(0.80+nh(n,7)*0.45);
    ctx.save(); ctx.globalAlpha=A-0.10; ctx.strokeStyle=f; ctx.lineWidth=R*0.058; ctx.shadowColor=g; ctx.shadowBlur=14;
    ctx.beginPath(); ctx.moveTo(cx-R*[0.30,0.36,0.26][v],cy); ctx.lineTo(cx-R*[0.30,0.36,0.26][v]-beamLen,cy); ctx.stroke(); ctx.restore();
    fcirc(ctx,cx-R*[0.30,0.36,0.26][v]-beamLen,cy,R*0.10,'rgba(255,255,255,0.90)',g,A);
  } else if (bp===2) { // Solar corona — bright core + eruption plumes
    const cR=R*[0.28,0.34,0.22][v];
    fcirc(ctx,cx,cy,cR,f,g,A+0.06);
    fcirc(ctx,cx,cy,cR*0.55,'rgba(255,255,255,0.90)',g,A-0.02);
    const nPlume=4+v;
    for (let i=0;i<nPlume;i++) {
      const a=(i/nPlume)*Math.PI*2+Math.PI*0.12;
      const pLen=R*(0.65+nh(n,10+i)*0.90);
      const pW=R*(0.18+nh(n,20+i)*0.12);
      ctx.save(); ctx.globalAlpha=A-0.14; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=10;
      ctx.beginPath();
      ctx.moveTo(cx+Math.cos(a-0.22)*cR,cy+Math.sin(a-0.22)*cR);
      ctx.bezierCurveTo(cx+Math.cos(a)*cR*1.4+Math.cos(a-Math.PI/2)*pW,cy+Math.sin(a)*cR*1.4+Math.sin(a-Math.PI/2)*pW,cx+Math.cos(a)*(cR+pLen*0.7),cy+Math.sin(a)*(cR+pLen*0.7),cx+Math.cos(a)*(cR+pLen),cy+Math.sin(a)*(cR+pLen));
      ctx.bezierCurveTo(cx+Math.cos(a)*(cR+pLen*0.7),cy+Math.sin(a)*(cR+pLen*0.7),cx+Math.cos(a)*cR*1.4+Math.cos(a+Math.PI/2)*pW,cy+Math.sin(a)*cR*1.4+Math.sin(a+Math.PI/2)*pW,cx+Math.cos(a+0.22)*cR,cy+Math.sin(a+0.22)*cR);
      ctx.closePath(); ctx.fill(); ctx.restore();
    }
    const beamLen=R*(0.80+nh(n,7)*0.45);
    ctx.save(); ctx.globalAlpha=A-0.10; ctx.strokeStyle=f; ctx.lineWidth=R*0.052; ctx.shadowColor=g; ctx.shadowBlur=14;
    ctx.beginPath(); ctx.moveTo(cx-cR,cy); ctx.lineTo(cx-cR-beamLen,cy); ctx.stroke(); ctx.restore();
    fcirc(ctx,cx-cR-beamLen,cy,R*0.10,'rgba(255,255,255,0.88)',g,A);
  } else if (bp===3) { // HYBRID: Energy + Biological — energy field encasing organic tissue core
    // Organic tissue nucleus
    const blobR=R*[0.38,0.44,0.32][v];
    const blobPts:P2[]=[];
    for (let i=0;i<8;i++) { const a=(i/8)*Math.PI*2; blobPts.push([cx+Math.cos(a)*blobR*(1+(nh(n,10+i)-0.5)*0.22),cy+Math.sin(a)*blobR*(1+(nh(n,20+i)-0.5)*0.22)]); }
    ctx.save(); ctx.globalAlpha=A; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=8;
    ctx.beginPath(); ctx.moveTo(blobPts[0][0],blobPts[0][1]);
    for (let i=0;i<8;i++) { const ni=(i+1)%8; ctx.quadraticCurveTo(blobPts[i][0],blobPts[i][1],(blobPts[i][0]+blobPts[ni][0])/2,(blobPts[i][1]+blobPts[ni][1])/2); }
    ctx.closePath(); ctx.fill(); ctx.restore();
    // Energy field overlay around organic core
    const nRing=3;
    for (let i=0;i<nRing;i++) {
      const ringR=blobR*(1.35+i*0.42);
      const startA=nh(n,40+i)*Math.PI*2;
      ctx.save(); ctx.globalAlpha=A-0.08-i*0.06; ctx.strokeStyle=f; ctx.lineWidth=R*(0.11-i*0.020); ctx.shadowColor=g; ctx.shadowBlur=10;
      ctx.beginPath(); ctx.arc(cx,cy,ringR,startA,startA+Math.PI*(1.35+nh(n,50+i)*0.50)); ctx.stroke(); ctx.restore();
    }
    // Energy arcs from organic to ring
    for (let i=0;i<5+v;i++) { energyTendril(ctx,cx+(nh(n,60+i)-0.5)*blobR,cy+(nh(n,70+i)-0.5)*blobR,cx+Math.cos(nh(n,80+i)*Math.PI*2)*blobR*1.85,cy+Math.sin(nh(n,80+i)*Math.PI*2)*blobR*1.85,f,g,A-0.28,n,90+i*3); }
    const beamLen=R*(0.80+nh(n,7)*0.45);
    ctx.save(); ctx.globalAlpha=A-0.10; ctx.strokeStyle=f; ctx.lineWidth=R*0.052; ctx.shadowColor=g; ctx.shadowBlur=14;
    ctx.beginPath(); ctx.moveTo(cx-blobR,cy); ctx.lineTo(cx-blobR-beamLen,cy); ctx.stroke(); ctx.restore();
    fcirc(ctx,cx-blobR-beamLen,cy,R*0.10,'rgba(255,255,255,0.88)',g,A);
  } else if (bp===4) { // INNOVATION: Energy lattice — nodes in geometric web
    const nNode=6+v*2, webR=R*[1.10,1.25,0.95][v];
    const nodes:P2[]=[[cx,cy]];
    for (let i=0;i<nNode;i++) { const a=(i/nNode)*Math.PI*2; nodes.push([cx+Math.cos(a)*webR,cy+Math.sin(a)*webR]); }
    // Web edges
    ctx.save(); ctx.globalAlpha=A-0.24; ctx.strokeStyle=f; ctx.lineWidth=R*0.035; ctx.shadowColor=g; ctx.shadowBlur=8;
    for (let i=1;i<=nNode;i++) {
      const ni=i%nNode+1;
      ctx.beginPath(); ctx.moveTo(nodes[i][0],nodes[i][1]); ctx.lineTo(nodes[ni][0],nodes[ni][1]); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(nodes[0][0],nodes[0][1]); ctx.lineTo(nodes[i][0],nodes[i][1]); ctx.stroke();
    }
    ctx.restore();
    // Nodes
    for (let i=0;i<nodes.length;i++) fcirc(ctx,nodes[i][0],nodes[i][1],R*(i===0?0.18:0.10),f,g,A-i*0.02);
    // Find leftmost node for weapon
    let leftI=1; for (let i=1;i<nodes.length;i++) if (nodes[i][0]<nodes[leftI][0]) leftI=i;
    gun(ctx,nodes[leftI][0],nodes[leftI][1],R*0.65,R*0.055,f,g,A);
  } else { // BP0: Plasma rings + arcing tendrils + nucleus
    const nRing=[3,4,2][v];
    for (let i=0;i<7+v*2;i++) {
      const a1=(i/(7+v*2))*Math.PI*2, a2=a1+(nh(n,10+i)-0.5)*1.80;
      const r1=R*(0.22+nh(n,20+i)*0.50), r2=R*(0.55+nh(n,30+i)*0.82);
      energyTendril(ctx,cx+Math.cos(a1)*r1,cy+Math.sin(a1)*r1,cx+Math.cos(a2)*r2,cy+Math.sin(a2)*r2,f,g,A-0.28,n,10+i);
    }
    for (let i=0;i<nRing;i++) {
      const ringR=R*(0.42+i*[0.40,0.32,0.54][v]), startA=nh(n,40+i)*Math.PI*0.80, endA=startA+Math.PI*(1.35+nh(n,50+i)*0.50);
      ctx.save(); ctx.globalAlpha=A-0.06*i; ctx.strokeStyle=f; ctx.lineWidth=R*(0.13-i*0.022); ctx.shadowColor=g; ctx.shadowBlur=10-i*2;
      ctx.beginPath(); ctx.arc(cx,cy,ringR,startA,endA); ctx.stroke(); ctx.shadowBlur=0;
      ctx.strokeStyle='rgba(255,255,255,0.22)'; ctx.lineWidth=0.70; ctx.beginPath(); ctx.arc(cx,cy,ringR,startA,endA); ctx.stroke(); ctx.restore();
    }
    fcirc(ctx,cx,cy,R*0.22,f,g,A+0.04); fcirc(ctx,cx,cy,R*0.12,'rgba(255,255,255,0.82)',g,A-0.04);
    const beamLen=R*(0.78+nh(n,7)*0.46);
    ctx.save(); ctx.globalAlpha=A-0.10; ctx.strokeStyle=f; ctx.lineWidth=R*0.052; ctx.shadowColor=g; ctx.shadowBlur=14;
    ctx.beginPath(); ctx.moveTo(cx-R*0.22,cy); ctx.lineTo(cx-R*0.22-beamLen,cy); ctx.stroke(); ctx.restore();
    fcirc(ctx,cx-R*0.22-beamLen,cy,R*0.10,'rgba(255,255,255,0.88)',g,A);
    fcirc(ctx,cx+Math.cos(nh(n,3)*Math.PI*2)*R*1.10,cy+Math.sin(nh(n,3)*Math.PI*2)*R*1.10,R*0.10,f,g,A-0.20);
  }
}

// ── T9  PLANT_SIEGE ──────────────────────────────────────
function drawT9(ctx:Ctx,cx:number,cy:number,R:number,n:number,f:string,g:string,A:number): void {
  const bp=BP(n), v=TV(n);
  if (bp===1) { // Vine crawler — horizontal spread, hanging pods
    const vineW=R*[1.62,1.80,1.42][v], nVine=3+v;
    for (let vi=0;vi<nVine;vi++) {
      const vy=cy+(vi-(nVine-1)/2)*R*[0.48,0.55,0.40][v];
      const vLen=vineW*(0.80+nh(n,10+vi)*0.40);
      organicArm(ctx,cx+vineW*0.20,vy,cx-vLen,vy+(nh(n,20+vi)-0.5)*R*0.22,R*0.08,(nh(n,30+vi)-0.5)*R*0.18,f,g,A-0.10);
      // Hanging pods
      const nPod=2+nhi(n,40+vi,2);
      for (let pi=0;pi<nPod;pi++) {
        const px=cx+vineW*0.10-pi*(vLen*0.42+nh(n,50+vi+pi)*vLen*0.18);
        const podY=vy+(nh(n,60+vi+pi)-0.4)*R*0.30+R*0.28;
        fell(ctx,px,podY,R*(0.16+nh(n,70+vi+pi)*0.10),R*(0.22+nh(n,80+vi+pi)*0.12),f,g,A-0.14);
        sline(ctx,px,vy,px,podY-R*0.10,f,A-0.28,R*0.035);
      }
    }
    gun(ctx,cx-vineW*0.80,cy,R*0.68,R*0.058,f,g,A);
  } else if (bp===2) { // Cactus cluster — columnar bodies with heavy spines
    const nCol=2+v, spacing=R*[0.88,1.0,0.72][v];
    for (let ci=0;ci<nCol;ci++) {
      const colX=cx-spacing*(nCol-1)/2+ci*spacing, colH=R*(0.75-ci%2*0.20+nh(n,10+ci)*0.22), colW=R*(0.28+nh(n,20+ci)*0.12);
      frect(ctx,colX-colW,cy-colH,colW*2,colH*1.80,f,g,A-ci*0.04);
      // Horizontal spine tiers
      for (let j=1;j<=3;j++) {
        const sy=cy-colH+j*(colH*0.55);
        for (const s of [-1,1] as const) sline(ctx,colX,sy,colX+s*(colW+R*(0.28+nh(n,30+ci+j)*0.18)),sy+(nh(n,40+ci+j)-0.5)*R*0.08,f,A-0.10,R*0.055);
      }
    }
    gun(ctx,cx-spacing*(nCol-1)/2-R*[0.28,0.28,0.28][v],cy,R*0.72,R*0.062,f,g,A);
  } else if (bp===3) { // HYBRID: Plant + Mechanical — organic trunk + mechanical weapon
    const stemH=R*[0.82,0.72,0.96][v];
    const nRoot=[4,5,3][v];
    for (let i=0;i<nRoot;i++) {
      const a=Math.PI*0.38+(i/Math.max(nRoot-1,1))*Math.PI*0.74;
      rootTendril(ctx,cx,cy,a,R*(0.72+nh(n,10+i)*0.58),R*(0.10-i*0.008),f,g,A-0.14,n,10+i);
    }
    ctx.save(); ctx.globalAlpha=A-0.04; ctx.strokeStyle=f; ctx.lineWidth=R*0.18; ctx.shadowColor=g; ctx.shadowBlur=6;
    ctx.beginPath(); ctx.moveTo(cx,cy+R*0.18); ctx.lineTo(cx,cy-stemH); ctx.stroke(); ctx.restore();
    // Leaf panels
    for (let i=0;i<2+v;i++) { const ly=cy-stemH*(0.22+i*0.28), lS=i%2===0?1:-1, lW=R*(0.50-i*0.04), lH=R*(0.17-i*0.012); fpoly(ctx,[[cx,ly],[cx+lS*lW*0.20,ly-lH*0.52],[cx+lS*lW,ly-lH*0.26],[cx+lS*lW*0.90,ly+lH*0.38],[cx,ly+lH*0.18]],f,g,A-0.08-i*0.04,4); }
    // GRAFT: Mechanical weapon system at crown (replaces organic spore pod)
    fell(ctx,cx,cy-stemH-R*0.24,R*0.30,R*0.22,f,g,A+0.02);
    // Mechanical barrel integrated at crown
    frect(ctx,cx-R*0.30-R*0.78,cy-stemH-R*0.24-R*0.06,R*0.78,R*0.12,f,g,A+0.02);
    fcirc(ctx,cx-R*0.30-R*0.78,cy-stemH-R*0.24,R*0.065,f,g,A+0.04);
  } else if (bp===4) { // INNOVATION: Carnivorous maw — snapping trap, no trunk
    const mW=R*[1.12,1.28,0.96][v], mH=R*[0.68,0.78,0.58][v];
    // Trap lobes (2 halves, hinged at right, open to left)
    for (const s of [-1,1] as const) {
      ctx.save(); ctx.globalAlpha=A; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=8;
      ctx.beginPath();
      ctx.moveTo(cx+mW*0.35,cy+s*R*0.05);
      ctx.bezierCurveTo(cx+mW*0.35,cy+s*mH*0.20,cx-mW*0.20,cy+s*mH,cx-mW,cy+s*mH*0.72);
      ctx.bezierCurveTo(cx-mW*1.10,cy+s*mH*0.40,cx-mW*0.85,cy+s*R*0.04,cx+mW*0.35,cy+s*R*0.05);
      ctx.closePath(); ctx.fill(); ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,0.16)'; ctx.lineWidth=0.8; ctx.stroke(); ctx.restore();
      // Trigger hairs along lobe inner edge
      for (let i=0;i<4;i++) { const hx=cx-mW*0.55+i*mW*0.30, hLen=R*(0.20+nh(n,10+i)*0.12); sline(ctx,hx,cy+s*R*0.05,hx+(nh(n,20+i)-0.5)*R*0.08,cy+s*(R*0.05+hLen),f,A-0.22,R*0.042); }
    }
    // Hinge
    fell(ctx,cx+mW*0.35,cy,R*0.12,R*0.12,f,g,A-0.04);
    // Root anchors
    for (const s of [-1,1] as const) rootTendril(ctx,cx+mW*0.35,cy+s*R*0.05,s>0?Math.PI*0.55:Math.PI*1.45,R*0.62,R*0.07,f,g,A-0.18,n,30+(s+1)*5);
    // The open mouth IS the weapon — weapon indicator at gap
    fcirc(ctx,cx-mW,cy,R*0.095,'rgba(255,255,255,0.75)',g,A);
  } else { // BP0: Root tree + trunk + leaves + spore cannon
    const nRoot=[4,5,3][v], stemH=R*[0.82,0.72,0.96][v];
    for (let i=0;i<nRoot;i++) { const a=Math.PI*0.38+(i/Math.max(nRoot-1,1))*Math.PI*0.74; rootTendril(ctx,cx,cy,a,R*(0.72+nh(n,10+i)*0.58),R*(0.10-i*0.008),f,g,A-0.14,n,10+i); }
    ctx.save(); ctx.globalAlpha=A-0.04; ctx.strokeStyle=f; ctx.lineWidth=R*0.18; ctx.shadowColor=g; ctx.shadowBlur=6;
    ctx.beginPath(); ctx.moveTo(cx,cy+R*0.18); ctx.lineTo(cx,cy-stemH); ctx.stroke(); ctx.restore();
    for (let i=0;i<[3,4,2][v];i++) { const ly=cy-stemH*(0.22+i*0.28), lS=i%2===0?1:-1, lW=R*(0.50-i*0.04), lH=R*(0.17-i*0.012); fpoly(ctx,[[cx,ly],[cx+lS*lW*0.20,ly-lH*0.52],[cx+lS*lW,ly-lH*0.26],[cx+lS*lW*0.90,ly+lH*0.38],[cx,ly+lH*0.18]],f,g,A-0.08-i*0.04,4); }
    fell(ctx,cx,cy-stemH-R*0.24,R*0.30,R*0.22,f,g,A+0.02);
    gun(ctx,cx-R*0.30,cy-stemH-R*0.24,R*0.72,R*0.062,f,g,A);
    for (const px of [cx-R*0.18,cx+R*0.18]) fcirc(ctx,px,cy-stemH-R*0.38,R*0.065,'rgba(255,255,255,0.55)',g,A-0.22);
  }
}

// ── T10  SWARM_COLLECTIVE ────────────────────────────────
function drawT10(ctx:Ctx,cx:number,cy:number,R:number,n:number,f:string,g:string,A:number): void {
  const bp=BP(n), v=TV(n);
  if (bp===1) { // Vortex spiral — units in inward-pulling spiral
    const nUnit=22+v*8, spiralR=R*[1.55,1.72,1.38][v];
    for (let i=0;i<nUnit;i++) {
      const t=i/nUnit;
      const a=t*Math.PI*4.5, r=spiralR*(1-t*0.78);
      const px=cx+Math.cos(a)*r, py=cy+Math.sin(a)*r*0.68;
      const ur=R*(0.042+t*0.038+nh(n,100+i)*0.024);
      fcirc(ctx,px,py,ur,f,g,A-0.08*(1-t));
    }
    // Hot center
    fcirc(ctx,cx,cy,R*0.16,f,g,A-0.18);
    // Weapon: concentrated front edge
    gun(ctx,cx-spiralR*0.88,cy,R*0.65,R*0.055,f,g,A);
  } else if (bp===2) { // Shoal formation — parallel rows of aligned units
    const nRow=3, nCol=5+v*2, colSep=R*[0.48,0.54,0.42][v], rowSep=R*[0.42,0.48,0.36][v];
    const totalW=nCol*colSep, totalH=nRow*rowSep;
    for (let r=0;r<nRow;r++) { for (let c=0;c<nCol;c++) {
      const px=cx-totalW/2+c*colSep+(r%2)*colSep*0.50;
      const py=cy-totalH/2+r*rowSep;
      const ur=R*(0.062+nh(n,r*20+c)*0.028);
      fcirc(ctx,px,py,ur,f,g,A-0.06*r);
    }}
    // Leading row weapon emphasis
    const leadX=cx-totalW/2;
    fcirc(ctx,leadX,cy-totalH/2,R*0.095,f,g,A-0.02);
    gun(ctx,leadX,cy,R*0.65,R*0.055,f,g,A);
  } else if (bp===3) { // HYBRID: Swarm + Crystal — crystal shard units
    const nUnit=[24,20,28][v], swW=R*[1.55,1.38,1.72][v], swH=R*[0.80,0.70,0.90][v];
    const positions:P2[]=[];
    for (let i=0;i<nUnit;i++) {
      const a=(i/nUnit)*Math.PI*2+nh(n,100+i)*0.90, r=swW*Math.sqrt(nh(n,200+i));
      positions.push([cx+Math.cos(a)*r,cy+Math.sin(a)*swH/swW*r]);
    }
    for (let i=0;i<nUnit;i++) {
      const [px,py]=positions[i];
      const a=nh(n,300+i)*Math.PI*2;
      const shardLen=R*(0.08+nh(n,400+i)*0.06);
      crystalShard(ctx,px,py,a,shardLen,shardLen*0.28,f,g,A-0.08-nh(n,500+i)*0.20);
    }
    fcirc(ctx,cx,cy,R*0.14,f,g,A-0.22);
    gun(ctx,cx-swW*0.72,cy,R*0.60,R*0.052,f,g,A);
  } else if (bp===4) { // INNOVATION: Needle filament — very elongated narrow column
    const nUnit=18+v*6, fileL=R*[2.10,2.40,1.80][v], fileH=R*0.25;
    for (let i=0;i<nUnit;i++) {
      const t=i/(nUnit-1);
      const px=cx+fileL*(1-2*t), py=cy+(nh(n,100+i)-0.5)*fileH*2*(1-Math.abs(t-0.5)*1.4);
      const ur=R*(0.048+nh(n,200+i)*0.030)*(1-Math.abs(t-0.35)*0.6);
      if (ur>0.01) fcirc(ctx,px,py,ur,f,g,A-0.06-nh(n,300+i)*0.20);
    }
    gun(ctx,cx-fileL,cy,R*0.62,R*0.052,f,g,A);
  } else { // BP0: Diffuse cloud
    const nUnit=[28,22,34][v], swW=R*[1.65,1.45,1.82][v], swH=R*[0.85,0.75,0.96][v];
    const positions:P2[]=[];
    for (let i=0;i<nUnit;i++) { const a=(i/nUnit)*Math.PI*2+nh(n,100+i)*0.92, r=Math.sqrt(nh(n,200+i)); positions.push([cx+Math.cos(a)*swW*r,cy+Math.sin(a)*swH*r]); }
    ctx.save(); ctx.globalAlpha=A-0.46; ctx.strokeStyle=f; ctx.lineWidth=R*0.024; ctx.shadowColor=g; ctx.shadowBlur=2;
    for (let i=0;i<nUnit;i++) { const ni=(i+1)%nUnit; const dx=positions[ni][0]-positions[i][0], dy=positions[ni][1]-positions[i][1]; if (dx*dx+dy*dy<(R*0.85)*(R*0.85)) { ctx.beginPath(); ctx.moveTo(positions[i][0],positions[i][1]); ctx.lineTo(positions[ni][0],positions[ni][1]); ctx.stroke(); } }
    ctx.restore();
    for (let i=0;i<nUnit;i++) { const [px,py]=positions[i]; const fb=1-(px-(cx-swW))/(swW*2.0); fcirc(ctx,px,py,R*(0.038+fb*0.032+nh(n,300+i)*0.026),f,g,A-0.06-nh(n,400+i)*0.24); }
    const frontX=cx-swW*0.72;
    for (let i=0;i<4+v;i++) { const fx=frontX+nh(n,500+i)*R*0.26-R*0.13, fy=cy+(nh(n,600+i)-0.5)*R*0.28; fcirc(ctx,fx,fy,R*(0.072+nh(n,700+i)*0.038),f,g,A-0.02); }
    fcirc(ctx,cx+R*0.10,cy,R*0.16,f,g,A-0.22);
  }
}

// ── T11  BIOMECH_HYBRID ──────────────────────────────────
function drawT11(ctx:Ctx,cx:number,cy:number,R:number,n:number,f:string,g:string,A:number): void {
  const bp=BP(n), v=TV(n);
  const drawOrgBlob=(bW:number,bH:number)=>{
    const nV=10; const pts:P2[]=[];
    for (let i=0;i<nV;i++) { const a=(i/nV)*Math.PI*2; pts.push([cx+Math.cos(a)*bW*(1+(nh(n,10+i)-0.5)*0.28),cy+Math.sin(a)*bH*(1+(nh(n,20+i)-0.5)*0.28)]); }
    ctx.save(); ctx.globalAlpha=A; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=9;
    ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]);
    for (let i=0;i<nV;i++) { const ni=(i+1)%nV; ctx.quadraticCurveTo(pts[i][0],pts[i][1],(pts[i][0]+pts[ni][0])/2,(pts[i][1]+pts[ni][1])/2); }
    ctx.closePath(); ctx.fill(); ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,0.14)'; ctx.lineWidth=0.8; ctx.stroke(); ctx.restore();
    ctx.save(); ctx.globalAlpha=A-0.36; ctx.strokeStyle='rgba(255,255,255,0.60)'; ctx.lineWidth=0.58;
    for (let i=0;i<4+v;i++) { const a=(i/(4+v))*Math.PI*2+nh(n,20+i); ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+Math.cos(a)*bW*0.62,cy+Math.sin(a)*bH*0.62); ctx.stroke(); }
    ctx.restore();
  };
  if (bp===1) { // Mechanical chassis + organic overflow — frame overgrown with flesh
    const rW=R*[1.45,1.62,1.28][v], sep=R*[0.45,0.55,0.35][v];
    frect(ctx,cx-rW,cy-sep-R*0.08,rW*2,R*0.16,f,g,A-0.10);
    frect(ctx,cx-rW,cy+sep-R*0.08,rW*2,R*0.16,f,g,A-0.10);
    for (let i=0;i<=4;i++) { const rx=cx-rW+i*(rW*2/4); frect(ctx,rx-R*0.05,cy-sep,R*0.10,sep*2,f,g,A-0.16); }
    // Organic mass growing over the frame
    for (let i=0;i<3+v;i++) {
      const ox=cx-rW*0.55+i*rW*0.55, oH=sep*(0.58+nh(n,30+i)*0.32);
      ctx.save(); ctx.globalAlpha=A-0.12; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=5;
      ctx.beginPath(); ctx.ellipse(ox,cy,R*(0.20+nh(n,40+i)*0.10),oH,0,0,Math.PI*2); ctx.fill(); ctx.restore();
    }
    gun(ctx,cx-rW-R*0.18,cy,R*0.75,R*0.060,f,g,A);
  } else if (bp===2) { // Organic torso + mechanical arms
    const bW=R*[0.72,0.80,0.62][v], bH=R*[0.55,0.62,0.48][v];
    drawOrgBlob(bW,bH);
    // Mechanical arms (3-4 rigid arm grafts)
    const nArm=3+nhi(n,30,2);
    const armAngles=[Math.PI,Math.PI*0.28,Math.PI*1.72,Math.PI*0.55,Math.PI*1.45];
    for (let i=0;i<nArm;i++) {
      const a=armAngles[i];
      const gr=bW*(0.85+nh(n,40+i)*0.15);
      const ax=cx+Math.cos(a)*gr, ay=cy+Math.sin(a)*bH/bW*gr;
      const aLen=R*(0.42+nh(n,50+i)*0.28), aW=R*0.10;
      frect(ctx,ax-aLen*0.5,ay-aW,aLen,aW*2,f,g,A-0.06);
      if (i===0) graftGun(ctx,ax-aLen*0.5,ay,R,f,g,A);
      else fcirc(ctx,ax-aLen*0.5,ay,aW*1.5,f,g,A-0.16);
    }
  } else if (bp===3) { // HYBRID: Biomech + Crystal — crystal grafts instead of metal plates
    const bW=R*[1.05,0.92,1.18][v], bH=R*[0.72,0.82,0.64][v];
    drawOrgBlob(bW,bH);
    // Crystal graft plates instead of metal
    const graftAngs=[Math.PI*0.90,Math.PI*0.15,Math.PI*1.55,Math.PI*0.55];
    for (let i=0;i<[3,4,2][v];i++) {
      const a=graftAngs[i]+nh(n,30+i)*0.20;
      const gr=bW*(0.72+nh(n,40+i)*0.20);
      const gx=cx+Math.cos(a)*gr, gy=cy+Math.sin(a)*bH/bW*gr;
      crystalShard(ctx,gx,gy,a,R*(0.32+nh(n,50+i)*0.22),R*0.065,f,g,A-0.06);
    }
    // Crystal weapon graft
    crystalShard(ctx,cx-bW,cy,Math.PI,R*(0.72+nh(n,7)*0.35),R*0.065,f,g,A);
    fcirc(ctx,cx-bW,cy,R*0.12,f,g,A-0.10);
  } else if (bp===4) { // INNOVATION: Exo-brain — mechanical sphere with organic interior
    const outerR=R*[0.68,0.78,0.58][v];
    // Outer mechanical shell (segmented sphere)
    const nSeg=[6,8,5][v];
    ctx.save(); ctx.globalAlpha=A-0.08; ctx.strokeStyle=f; ctx.lineWidth=R*0.13; ctx.shadowColor=g; ctx.shadowBlur=7;
    ctx.beginPath(); ctx.arc(cx,cy,outerR,0,Math.PI*2); ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,0.22)'; ctx.lineWidth=0.80; ctx.beginPath(); ctx.arc(cx,cy,outerR+R*0.06,0,Math.PI*2); ctx.stroke(); ctx.restore();
    // Panel gaps showing interior
    for (let i=0;i<nSeg;i++) {
      const a=(i/nSeg)*Math.PI*2, nextA=((i+1)/nSeg)*Math.PI*2;
      ctx.save(); ctx.globalAlpha=A; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=4;
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,outerR-R*0.04,a+0.18,nextA-0.18); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    // Organic brain interior (visible through gaps — convoluted surface)
    fcirc(ctx,cx,cy,outerR*0.68,f,g,A-0.04);
    ctx.save(); ctx.globalAlpha=A-0.26; ctx.strokeStyle='rgba(255,255,255,0.55)'; ctx.lineWidth=0.6;
    for (let i=0;i<5;i++) { const bx=cx-outerR*0.35+i*outerR*0.18, by=cy-outerR*(0.25+nh(n,30+i)*0.10); ctx.beginPath(); ctx.moveTo(bx,by); ctx.quadraticCurveTo(bx+R*0.14,by+R*0.22,bx+R*0.28,by+R*0.08); ctx.stroke(); }
    ctx.restore();
    // Mechanical sensor eye
    frect(ctx,cx-outerR*0.40,cy-outerR*0.38,outerR*0.48,outerR*0.20,f,g,A-0.04);
    fcirc(ctx,cx-outerR*0.16,cy-outerR*0.28,R*0.07,'rgba(255,255,255,0.90)',g,A);
    graftGun(ctx,cx-outerR,cy,R,f,g,A);
  } else { // BP0: Organic blob + metal graft plates + welded gun arm
    const bW=R*[1.05,0.92,1.18][v], bH=R*[0.72,0.82,0.64][v];
    drawOrgBlob(bW,bH);
    const graftAngs=[Math.PI*0.90,Math.PI*0.15,Math.PI*1.55,Math.PI*0.55];
    for (let i=0;i<[3,4,2][v];i++) {
      const a=graftAngs[i]+nh(n,30+i)*0.20, gr=bW*(0.72+nh(n,40+i)*0.20);
      mechArmor(ctx,cx+Math.cos(a)*gr,cy+Math.sin(a)*bH/bW*gr,a,R,f,g,A);
    }
    fcirc(ctx,cx-bW,cy,R*0.14,f,g,A-0.08);
    frect(ctx,cx-bW-R*(0.55+nh(n,7)*0.38),cy-R*0.062,R*(0.55+nh(n,7)*0.38),R*0.124,f,g,A+0.04);
    gun(ctx,cx-bW,cy,R*(0.55+nh(n,7)*0.38)+R*0.18,R*0.062,f,g,A);
  }
}

// ── T12  AVIAN_FLYER ─────────────────────────────────────
function drawT12(ctx:Ctx,cx:number,cy:number,R:number,n:number,f:string,g:string,A:number): void {
  const bp=BP(n), v=TV(n);
  const drawMembraneWing=(s:1|-1,span:number,sweep:number,fL:number,fH:number)=>{
    const wTipX=cx-R*sweep, wTipY=cy+s*span;
    const wTrailX=cx+R*0.70, wTrailY=cy+s*span*0.52;
    ctx.save(); ctx.globalAlpha=A-0.08; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=6;
    ctx.beginPath();
    ctx.moveTo(cx,cy+s*fH*0.28);
    ctx.bezierCurveTo(cx-R*0.22,cy+s*span*0.30,wTipX,cy+s*span*0.60,wTipX,wTipY);
    ctx.bezierCurveTo(cx-R*0.08,cy+s*span*0.88,wTrailX,wTrailY*1.0,wTrailX,wTrailY);
    ctx.bezierCurveTo(cx+R*0.55,cy+s*span*0.28,cx+R*0.35,cy+s*fH*0.40,cx,cy+s*fH*0.28);
    ctx.closePath(); ctx.fill(); ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,0.14)'; ctx.lineWidth=0.7; ctx.stroke(); ctx.restore();
    ctx.save(); ctx.globalAlpha=A-0.32; ctx.strokeStyle='rgba(255,255,255,0.75)'; ctx.lineWidth=0.55;
    for (let i=1;i<=3;i++) { const t=i/4; ctx.beginPath(); ctx.moveTo(cx-R*0.05,cy+s*fH*0.28); ctx.lineTo(wTipX+(cx-R*0.05-wTipX)*(1-t),wTipY*t+(cy+s*fH*0.28)*(1-t)); ctx.stroke(); }
    ctx.restore();
    fpoly(ctx,[[wTipX-R*0.05,wTipY],[wTipX+R*0.16,wTipY+s*R*0.20],[wTipX+R*0.22,wTipY]],f,g,A-0.22,3);
  };
  if (bp===1) { // Manta ray flyer — flat diamond body, no distinct head
    const mW=R*[1.80,2.10,1.55][v], mH=R*[0.55,0.65,0.46][v];
    for (const s of [-1,1] as const) {
      fpoly(ctx,[[cx,cy],[cx-mW*0.50,cy+s*mH],[cx+mW,cy+s*mH*0.28],[cx+mW*0.82,cy]],f,g,A-0.08,5);
      // Wingtip detail
      fpoly(ctx,[[cx-mW*0.50,cy+s*mH],[cx-mW*0.65,cy+s*mH*0.78],[cx-mW*0.30,cy+s*mH*1.05]],f,g,A-0.24,3);
    }
    fell(ctx,cx+mW*0.28,cy,R*0.40,mH*0.62,f,g,A); // central body lozenge
    stinger(ctx,cx,cy,R*0.45,mH*0.20,f,g,A); // frontal weapon
    // Trailing tail
    fpoly(ctx,[[cx+mW,cy-mH*0.10],[cx+mW+R*0.72,cy-R*0.05],[cx+mW+R*0.60,cy+R*0.05],[cx+mW,cy+mH*0.10]],f,g,A-0.20,3);
  } else if (bp===2) { // Dragonfly — 4 separate wings, segmented abdomen
    const fL=R*[0.75,0.85,0.65][v], fH=R*0.18;
    // 4 separate wings (2 pairs)
    for (const s of [-1,1] as const) {
      // Fore wings (larger)
      fpoly(ctx,[[cx-fL*0.20,cy+s*fH*0.5],[cx-fL*1.05,cy+s*R*1.45],[cx+fL*0.22,cy+s*R*1.28],[cx+fL*0.48,cy+s*fH*0.35]],f,g,A-0.10,5);
      // Hind wings (offset, shorter)
      fpoly(ctx,[[cx+fL*0.12,cy+s*fH*0.55],[cx-fL*0.55,cy+s*R*1.05],[cx+fL*0.60,cy+s*R*0.90],[cx+fL*0.82,cy+s*fH*0.38]],f,g,A-0.16,4);
    }
    // Segmented abdomen (5 segments)
    for (let i=0;i<5;i++) {
      const sx=cx-fL*0.55+i*(fL*1.60/4), sR=fL*(0.20-i*0.022+nh(n,10+i)*0.04);
      fell(ctx,sx,cy,sR,sR*0.72,f,g,A-i*0.04);
    }
    stinger(ctx,cx-fL*0.55-fL*0.20,cy,R*0.40,R*0.068,f,g,A);
    // Compound eyes
    for (const s of [-1,1] as const) fcirc(ctx,cx-fL*0.55+R*0.04,cy+s*fL*0.20*0.55,R*0.12,'rgba(255,255,255,0.80)',g,A-0.02);
  } else if (bp===3) { // HYBRID: Avian + Energy — lightning wing tips + energy beak
    const span=R*[1.95,2.40,1.65][v], fL=R*[0.92,0.85,1.02][v], fH=R*0.20;
    for (const s of [-1,1] as const) {
      drawMembraneWing(s,span,0.55,fL,fH);
      // Energy vein graft (glowing lines over membrane)
      ctx.save(); ctx.globalAlpha=A-0.22; ctx.strokeStyle='rgba(255,255,255,0.80)'; ctx.lineWidth=R*0.035; ctx.shadowColor=g; ctx.shadowBlur=10;
      for (let i=1;i<=3;i++) { const t=i/4; ctx.beginPath(); ctx.moveTo(cx-R*0.05,cy+s*fH*0.28); ctx.lineTo(cx-R*0.55+(cx-R*0.05-(cx-R*0.55))*(1-t),cy+s*span*t+(cy+s*fH*0.28)*(1-t)); ctx.stroke(); }
      ctx.restore();
      // Wing-tip energy nodes
      energyTendril(ctx,cx-R*0.55,cy+s*span,cx-R*0.55+R*(nh(n,10+s*3)-0.5)*0.55,cy+s*span+R*(nh(n,20+s*3)-0.5)*0.55,f,g,A-0.24,n,30+s*10);
    }
    ctx.save(); ctx.globalAlpha=A; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=7;
    ctx.beginPath(); ctx.moveTo(cx-fL,cy); ctx.bezierCurveTo(cx-fL*0.60,cy-fH,cx+fL*0.20,cy-fH,cx+fL*0.75,cy-fH*0.45); ctx.lineTo(cx+fL,cy); ctx.lineTo(cx+fL*0.75,cy+fH*0.45); ctx.bezierCurveTo(cx+fL*0.20,cy+fH,cx-fL*0.60,cy+fH,cx-fL,cy); ctx.closePath(); ctx.fill(); ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,0.20)'; ctx.lineWidth=0.85; ctx.stroke(); ctx.restore();
    // Energy beam weapon (replaces beak)
    const eBeam=R*(0.70+nh(n,7)*0.45);
    ctx.save(); ctx.globalAlpha=A-0.10; ctx.strokeStyle=f; ctx.lineWidth=R*0.048; ctx.shadowColor=g; ctx.shadowBlur=14;
    ctx.beginPath(); ctx.moveTo(cx-fL,cy); ctx.lineTo(cx-fL-eBeam,cy); ctx.stroke(); ctx.restore();
    fcirc(ctx,cx-fL-eBeam,cy,R*0.10,'rgba(255,255,255,0.90)',g,A);
  } else if (bp===4) { // INNOVATION: Stingray drifter — flat round, long tail, wave wings
    const bR=R*[0.68,0.78,0.58][v];
    // Round flat body
    fell(ctx,cx+R*0.12,cy,bR*1.35,bR,f,g,A);
    // Pectoral wing-tips
    for (const s of [-1,1] as const) fpoly(ctx,[[cx-R*0.20,cy+s*bR*0.62],[cx-R*0.65,cy+s*bR*1.45],[cx+R*0.12,cy+s*bR],[cx+R*0.80,cy+s*bR*0.55]],f,g,A-0.12,5);
    // Long whip tail
    organicArm(ctx,cx+bR*1.35+R*0.12,cy,cx+bR*1.35+R*0.12+R*1.62,cy+R*(0.45+nh(n,7)*0.35),R*0.045,(nh(n,8)-0.5)*R*0.25,f,g,A-0.16);
    // Tail spine tip
    fpoly(ctx,[[cx+bR*1.35+R*0.12+R*1.55,cy+R*0.55],[cx+bR*1.35+R*0.12+R*1.80,cy+R*0.68],[cx+bR*1.35+R*0.12+R*1.62,cy+R*0.40]],f,g,A-0.22,3);
    stinger(ctx,cx-R*0.20,cy,R*0.45,bR*0.18,f,g,A);
    fcirc(ctx,cx-R*0.08,cy-bR*0.28,R*0.085,'rgba(255,255,255,0.80)',g,A);
  } else { // BP0: Pterosaur membrane wings + beak
    const span=R*[1.95,2.40,1.65][v], fL=R*[0.92,0.85,1.02][v], fH=R*0.20;
    for (const s of [-1,1] as const) drawMembraneWing(s,span,0.55,fL,fH);
    ctx.save(); ctx.globalAlpha=A; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=7;
    ctx.beginPath(); ctx.moveTo(cx-fL,cy); ctx.bezierCurveTo(cx-fL*0.60,cy-fH,cx+fL*0.20,cy-fH,cx+fL*0.75,cy-fH*0.45); ctx.lineTo(cx+fL,cy); ctx.lineTo(cx+fL*0.75,cy+fH*0.45); ctx.bezierCurveTo(cx+fL*0.20,cy+fH,cx-fL*0.60,cy+fH,cx-fL,cy); ctx.closePath(); ctx.fill(); ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,0.20)'; ctx.lineWidth=0.85; ctx.stroke(); ctx.restore();
    stinger(ctx,cx-fL,cy,R*0.40,R*0.085,f,g,A);
    fcirc(ctx,cx-fL+R*0.28,cy-fH*0.45,R*0.09,'rgba(255,255,255,0.85)',g,A);
    for (let i=-1;i<=1;i++) fpoly(ctx,[[cx+fL,cy+i*R*0.12],[cx+fL+R*0.38,cy+i*R*0.30],[cx+fL+R*0.32,cy+i*R*0.36]],f,g,A-0.24,3);
  }
}

// ── T13  ALIEN_ARCH ──────────────────────────────────────
function drawT13(ctx:Ctx,cx:number,cy:number,R:number,n:number,f:string,g:string,A:number): void {
  const bp=BP(n), v=TV(n);
  if (bp===1) { // Recursive shell — logarithmic spiral within spiral
    const nShell=3, startR=R*[1.20,1.35,1.05][v];
    for (let sh=0;sh<nShell;sh++) {
      const shellR=startR*Math.pow(0.58,sh), offset=sh*Math.PI/nShell;
      ctx.save(); ctx.globalAlpha=A-sh*0.18; ctx.strokeStyle=f; ctx.lineWidth=R*(0.11-sh*0.025); ctx.shadowColor=g; ctx.shadowBlur=8-sh*2;
      ctx.beginPath();
      for (let i=0;i<=120;i++) { const t=(i/120)*Math.PI*2; const r=shellR*(1+0.28*Math.cos(3*(t+offset))); if (i===0) ctx.moveTo(cx+r*Math.cos(t),cy+r*Math.sin(t)); else ctx.lineTo(cx+r*Math.cos(t),cy+r*Math.sin(t)); }
      ctx.closePath(); ctx.stroke(); ctx.restore();
    }
    fcirc(ctx,cx,cy,startR*Math.pow(0.58,3)*0.60,f,g,A+0.02);
    const rfL=R*(0.65+nh(n,7)*0.46);
    fpoly(ctx,[[cx-startR,cy-R*0.10],[cx-startR-rfL,cy],[cx-startR,cy+R*0.10]],f,g,A+0.02,8);
  } else if (bp===2) { // Möbius-like self-intersecting loop
    const oR=R*[1.05,1.18,0.92][v];
    // Draw the figure-8 / lemniscate-like form
    ctx.save(); ctx.globalAlpha=A; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=8;
    ctx.beginPath();
    for (let i=0;i<=160;i++) {
      const t=(i/160)*Math.PI*2;
      const denom=1+0.62*Math.sin(t)*Math.sin(t);
      const x=cx+oR*Math.cos(t)/denom, y=cy+oR*Math.sin(t)*Math.cos(t)/denom;
      if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.fill(); ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,0.22)'; ctx.lineWidth=0.85; ctx.stroke(); ctx.restore();
    fcirc(ctx,cx,cy,R*0.14,f,g,A+0.04);
    const rfL=R*(0.55+nh(n,7)*0.40);
    fpoly(ctx,[[cx-oR,cy-R*0.09],[cx-oR-rfL,cy],[cx-oR,cy+R*0.09]],f,g,A+0.02,8);
  } else if (bp===3) { // HYBRID: Alien + Colonial — alien form composed of colony units
    const oR=R*[1.18,1.32,1.06][v];
    // Draw alien outer shell (trefoil)
    ctx.save(); ctx.globalAlpha=A-0.12; ctx.strokeStyle=f; ctx.lineWidth=R*0.11; ctx.shadowColor=g; ctx.shadowBlur=8;
    ctx.beginPath();
    for (let i=0;i<=120;i++) { const t=(i/120)*Math.PI*2; const r=oR*(1+0.28*Math.cos(3*t)); if (i===0) ctx.moveTo(cx+r*Math.cos(t),cy+r*Math.sin(t)); else ctx.lineTo(cx+r*Math.cos(t),cy+r*Math.sin(t)); }
    ctx.closePath(); ctx.stroke(); ctx.restore();
    // Colony units filling the interior — small organics in alien geometry
    const nColony=16+v*4;
    for (let i=0;i<nColony;i++) {
      const a=(i/nColony)*Math.PI*2+nh(n,10+i)*0.55;
      const r=oR*(0.72+nh(n,20+i)*0.22);
      const ux=cx+Math.cos(a)*r, uy=cy+Math.sin(a)*r;
      fell(ctx,ux,uy,R*(0.08+nh(n,30+i)*0.06),R*(0.06+nh(n,40+i)*0.04),f,g,A-0.16-i*0.01);
    }
    // Mycelium-like threads between colony units
    ctx.save(); ctx.globalAlpha=A-0.38; ctx.strokeStyle=f; ctx.lineWidth=R*0.022;
    for (let i=0;i<8;i++) { const a1=(i/8)*Math.PI*2, a2=((i+2)/8)*Math.PI*2; const r=oR*0.82; ctx.beginPath(); ctx.moveTo(cx+Math.cos(a1)*r,cy+Math.sin(a1)*r); ctx.lineTo(cx+Math.cos(a2)*r,cy+Math.sin(a2)*r); ctx.stroke(); }
    ctx.restore();
    fpoly(ctx,[[cx-oR,cy-R*0.10],[cx-oR-R*(0.65+nh(n,7)*0.46),cy],[cx-oR,cy+R*0.10]],f,g,A+0.02,8);
  } else if (bp===4) { // INNOVATION: Disconnected orbitals — no center body
    const oR=R*[1.10,1.25,0.95][v], nOrb=[6,7,5][v];
    // No central body — only orbiting pieces
    for (let i=0;i<nOrb;i++) {
      const a=(i/nOrb)*Math.PI*2+nh(n,10+i)*0.55;
      const od=oR*(0.85+nh(n,20+i)*0.30);
      const ox=cx+Math.cos(a)*od, oy=cy+Math.sin(a)*od;
      const orbR=R*(0.14+nh(n,30+i)*0.10);
      // Each orbital is its own distinct shape
      if (i%3===0) fell(ctx,ox,oy,orbR*1.5,orbR,f,g,A-0.12);
      else if (i%3===1) { const pts:P2[]=[]; for (let j=0;j<5;j++) { const ja=(j/5)*Math.PI*2; pts.push([ox+Math.cos(ja)*orbR,oy+Math.sin(ja)*orbR]); } fpoly(ctx,pts,f,g,A-0.16,5); }
      else crystalShard(ctx,ox,oy,a+Math.PI,orbR,orbR*0.30,f,g,A-0.14);
      // Phase lines connecting them
      const ni=(i+1)%nOrb, na=(ni/nOrb)*Math.PI*2+nh(n,10+ni)*0.55, nod=oR*(0.85+nh(n,20+ni)*0.30);
      ctx.save(); ctx.globalAlpha=A-0.45; ctx.setLineDash([R*0.06,R*0.10]); ctx.strokeStyle=f; ctx.lineWidth=R*0.028;
      ctx.beginPath(); ctx.moveTo(ox,oy); ctx.lineTo(cx+Math.cos(na)*nod,cy+Math.sin(na)*nod); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    }
    // Weapon: leftmost orbital fires
    let li=0; for (let i=1;i<nOrb;i++) { const a=(i/nOrb)*Math.PI*2+nh(n,10+i)*0.55, od=oR*(0.85+nh(n,20+i)*0.30); if (cx+Math.cos(a)*od < cx+Math.cos((li/nOrb)*Math.PI*2+nh(n,10+li)*0.55)*oR*(0.85+nh(n,20+li)*0.30)) li=i; }
    const la=(li/nOrb)*Math.PI*2+nh(n,10+li)*0.55, lod=oR*(0.85+nh(n,20+li)*0.30);
    gun(ctx,cx+Math.cos(la)*lod,cy+Math.sin(la)*lod,R*0.55,R*0.052,f,g,A);
  } else { // BP0: Trefoil outer + quadfoil inner + phase orbitals
    const oR=R*[1.18,1.32,1.06][v];
    for (let pass=0;pass<2;pass++) {
      const off=pass*R*0.07;
      ctx.save(); ctx.globalAlpha=A-pass*0.24; ctx.strokeStyle=f; ctx.lineWidth=R*(0.12-pass*0.040); ctx.shadowColor=g; ctx.shadowBlur=8-pass*3;
      ctx.beginPath();
      for (let i=0;i<=120;i++) { const t=(i/120)*Math.PI*2; const r=oR*(1+0.28*Math.cos(3*t))+off; if (i===0) ctx.moveTo(cx+r*Math.cos(t),cy+r*Math.sin(t)); else ctx.lineTo(cx+r*Math.cos(t),cy+r*Math.sin(t)); }
      ctx.closePath(); ctx.stroke(); ctx.restore();
    }
    ctx.save(); ctx.globalAlpha=A-0.06; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=7;
    ctx.beginPath();
    const is=[0.52,0.46,0.58][v];
    for (let i=0;i<=80;i++) { const t=(i/80)*Math.PI*2+Math.PI/5; const r=oR*is*(1+0.32*Math.cos(4*t+0.8)); if (i===0) ctx.moveTo(cx+r*Math.cos(t),cy+r*Math.sin(t)); else ctx.lineTo(cx+r*Math.cos(t),cy+r*Math.sin(t)); }
    ctx.closePath(); ctx.fill(); ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,0.20)'; ctx.lineWidth=0.75; ctx.stroke(); ctx.restore();
    const nOrb=[4,5,3][v];
    for (let i=0;i<nOrb;i++) {
      const oa=(i/nOrb)*Math.PI*2+nh(n,10+i)*0.70, od=oR*(0.72+nh(n,20+i)*0.38);
      fcirc(ctx,cx+Math.cos(oa)*od,cy+Math.sin(oa)*od,R*(0.10+nh(n,30+i)*0.07),f,g,A-0.18);
      ctx.save(); ctx.globalAlpha=A-0.44; ctx.setLineDash([R*0.06,R*0.10]); ctx.strokeStyle=f; ctx.lineWidth=R*0.028;
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+Math.cos(oa)*od,cy+Math.sin(oa)*od); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    }
    const nPts5:P2[]=[], nPts8:P2[]=[];
    for (let i=0;i<5;i++) { const a=(i/5)*Math.PI*2-Math.PI/2; nPts5.push([cx+R*0.22*Math.cos(a),cy+R*0.22*Math.sin(a)]); }
    for (let i=0;i<8;i++) { const a=(i/8)*Math.PI*2; nPts8.push([cx+R*0.13*Math.cos(a),cy+R*0.13*Math.sin(a)]); }
    fpoly(ctx,nPts5,f,g,A+0.02,6); fpoly(ctx,nPts8,'rgba(255,255,255,0.36)',g,A-0.24,3);
    const rfL=R*(0.65+nh(n,7)*0.46);
    fpoly(ctx,[[cx-oR,cy-R*0.10],[cx-oR-rfL,cy],[cx-oR,cy+R*0.10]],f,g,A+0.02,8);
    fpoly(ctx,[[cx-oR-R*0.10,cy-R*0.06],[cx-oR-rfL-R*0.14,cy],[cx-oR-R*0.10,cy+R*0.06]],'rgba(255,255,255,0.40)',g,A-0.22,4);
  }
}

// §8  Class mark overlay
function drawClassMark(ctx:Ctx,cx:number,cy:number,R:number,cls:VirusClass): void {
  ctx.save(); ctx.globalAlpha=0.28; ctx.strokeStyle='rgba(255,255,255,0.85)'; ctx.lineWidth=0.75; ctx.shadowBlur=0;
  switch (cls) {
    case 'prime': for (let i=0;i<6;i++) { const a=(i/6)*Math.PI*2; ctx.beginPath(); ctx.moveTo(cx+R*0.12*Math.cos(a),cy+R*0.12*Math.sin(a)); ctx.lineTo(cx+R*0.28*Math.cos(a),cy+R*0.28*Math.sin(a)); ctx.stroke(); } break;
    case 'power-of-two': ctx.strokeRect(cx-R*0.16,cy-R*0.16,R*0.32,R*0.32); break;
    case 'perfect-square': ctx.beginPath(); ctx.arc(cx,cy,R*0.22,0,Math.PI*2); ctx.stroke(); break;
    case 'even-composite': ctx.beginPath(); ctx.moveTo(cx-R*0.24,cy-R*0.10); ctx.lineTo(cx+R*0.24,cy-R*0.10); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx-R*0.24,cy+R*0.10); ctx.lineTo(cx+R*0.24,cy+R*0.10); ctx.stroke(); break;
    case 'odd-composite': { const t=R*0.20; ctx.beginPath(); ctx.moveTo(cx,cy-t); ctx.lineTo(cx+t*0.87,cy+t*0.5); ctx.lineTo(cx-t*0.87,cy+t*0.5); ctx.closePath(); ctx.stroke(); break; }
  }
  ctx.restore();
}

// §9  Main draw entry — signature UNCHANGED
const TOPO_DRAW=[drawT0,drawT1,drawT2,drawT3,drawT4,drawT5,drawT6,drawT7,drawT8,drawT9,drawT10,drawT11,drawT12,drawT13];

export function drawVirus(
  ctx: CanvasRenderingContext2D, cx: number, cy: number,
  n: number, cell: number, flash: boolean, green = false,
): void {
  const cls  = green ? 'even-composite' as VirusClass : getVirusClass(n);
  const fill = green ? (flash ? '#f0fdf4' : '#4ade80') : (flash ? FLASH_C[cls] : FILL_C[cls]);
  const glow = green ? 'rgba(74,222,128,0.50)' : GLOW_C[cls];
  const R    = cell * 0.22 + cell * 0.016 * Math.log2(n + 1);
  const topo = getTopology(n);
  const A    = flash ? 0.92 : 0.84;
  ctx.save();
  TOPO_DRAW[topo](ctx, cx, cy, R, n, fill, glow, A);
  if (!green && !flash) drawClassMark(ctx, cx, cy, R, cls);
  ctx.restore();
}

// §10  Silhouette validation
export function drawVirusSilhouette(ctx:CanvasRenderingContext2D,cx:number,cy:number,n:number,cell:number): void {
  const R=cell*0.22+cell*0.016*Math.log2(n+1);
  ctx.save();
  TOPO_DRAW[getTopology(n)](ctx,cx,cy,R,n,'#000000','#000000',1.0);
  ctx.globalCompositeOperation='source-atop'; ctx.fillStyle='#000000';
  ctx.fillRect(cx-R*3.5,cy-R*3.5,R*7,R*7); ctx.globalCompositeOperation='source-over'; ctx.restore();
}

export function runSilhouetteDiversityTest(ctx:CanvasRenderingContext2D,w:number,h:number): void {
  const seeds=[37,14,25,63,47,18,71,40,53,29,89,56,100,172,121,94,200,160,213,177];
  const C=5,cW=w/C,cH=h/4,cell=Math.min(cW,cH)*0.52;
  const names=['MONO','FRAME','CEPH','FUNG','VERT','CRYS','ARTH','CRAWL','ENRG','PLANT','SWRM','BIOM','AVIA','ALIE'];
  const bpNames=['pure-A','pure-B','pure-C','hybrid','innov'];
  ctx.fillStyle='#f0f4f8'; ctx.fillRect(0,0,w,h);
  ctx.fillStyle='#1e293b'; ctx.font=`${Math.round(cell*0.10)}px monospace`; ctx.textAlign='center';
  ctx.fillText('EVOLUTIONARY SPACE TEST v6',w/2,cell*0.09);
  const topoSet=new Set<number>(), bpSet=new Set<string>();
  for (let i=0;i<seeds.length;i++) {
    const seed=seeds[i],col=i%C,row=Math.floor(i/C);
    const ex=cW*(col+0.5),ey=cH*(row+0.5)+cell*0.08;
    const t=getTopology(seed), bp=BP(seed); topoSet.add(t); bpSet.add(`${t}-${bp}`);
    drawVirusSilhouette(ctx,ex,ey,seed,cell);
    ctx.fillStyle='#334155'; ctx.font=`${Math.round(cell*0.080)}px monospace`; ctx.textAlign='center';
    ctx.fillText(`T${t} ${names[t]} ${bpNames[bp]}`,ex,ey+cell*0.35);
  }
  const passed=topoSet.size>=10;
  ctx.font=`${Math.round(cell*0.090)}px monospace`; ctx.textAlign='center';
  ctx.fillStyle=passed?'#064e3b':'#7f1d1d';
  ctx.fillText(`${passed?'PASS':'FAIL'} — ${topoSet.size}/14 families, ${bpSet.size} unique body-plans`,w/2,h-cell*0.12);
  console.log('[EvoTest]',passed?'PASS':'FAIL','families:',topoSet.size,'body-plans:',bpSet.size);
}

// §11  Expanded MorphSig — topology + body-plan + hybrid key + fingerprint
export interface MorphSig {
  topology: number;    // 0-13 substrate family
  bodyPlan: number;    // 0-4 (0-2 pure, 3 hybrid, 4 innovation)
  variant: number;     // 0-2 fine variant
  cls: number;         // VirusClass index
  aspectGroup: number; // 0=round 1=vert 2=horiz 3=irregular 4=radial
  massCenter: number;  // 0=front 1=center 2=rear 3=distributed
  domain: number;      // coarse substrate domain (0=mech 1=bio 2=xtal 3=colonial 4=energy 5=plant 6=swarm 7=biomech 8=alien)
  hybrid: boolean;     // is this a cross-lineage hybrid (BP=3)?
  innovation: boolean; // is this a de novo innovation (BP=4)?
}

// [topology][bodyPlan] → [aspectGroup, massCenter]
const TOPO_BP_META: [number,number][][] = [
  [[2,0],[2,1],[2,0],[1,3],[3,0]],  // T0 MONO
  [[2,1],[4,2],[2,1],[0,0],[3,1]],  // T1 FRAME
  [[0,0],[0,3],[0,1],[4,0],[1,3]],  // T2 CEPH
  [[1,3],[1,3],[1,3],[2,1],[0,3]],  // T3 FUNG
  [[2,0],[2,0],[2,0],[2,0],[2,1]],  // T4 VERT
  [[4,1],[1,1],[4,1],[4,1],[1,1]],  // T5 CRYS
  [[2,2],[2,0],[2,2],[4,2],[2,0]],  // T6 ARTH
  [[2,1],[1,1],[2,1],[4,1],[2,1]],  // T7 CRAWL
  [[4,1],[4,3],[4,2],[0,1],[4,1]],  // T8 ENRG
  [[1,2],[2,2],[1,2],[1,2],[0,0]],  // T9 PLANT
  [[4,3],[4,3],[4,3],[4,3],[2,3]],  // T10 SWRM
  [[3,0],[2,0],[0,0],[3,0],[0,1]],  // T11 BIOM
  [[2,0],[2,1],[2,0],[2,0],[2,2]],  // T12 AVIA
  [[3,3],[3,3],[3,3],[3,3],[4,3]],  // T13 ALIE
];

const TOPO_DOMAIN=[0,0,1,3,1,2,1,0,4,5,6,7,1,8]; // substrate domain per topology
const VC_O: VirusClass[]=['prime','power-of-two','perfect-square','even-composite','odd-composite'];

export function getMorphSig(n: number): MorphSig {
  const t=getTopology(n), bp=BP(n), v=TV(n);
  const [ag,mc]=TOPO_BP_META[t][bp];
  return {
    topology:t, bodyPlan:bp, variant:v, cls:VC_O.indexOf(getVirusClass(n)),
    aspectGroup:ag, massCenter:mc, domain:TOPO_DOMAIN[t],
    hybrid:bp===3, innovation:bp===4,
  };
}

export function morphDistance(a: MorphSig, b: MorphSig): number {
  let d=0;
  d += (a.topology!==b.topology?1:0)*0.40;
  d += (a.bodyPlan!==b.bodyPlan?1:0)*0.22;
  d += (a.domain!==b.domain?1:0)*0.16;
  d += (a.aspectGroup!==b.aspectGroup?1:0)*0.10;
  d += (a.massCenter!==b.massCenter?1:0)*0.06;
  d += (a.cls!==b.cls?1:0)*0.04;
  d += (a.hybrid!==b.hybrid?1:0)*0.02;
  return d;
}

export function selectDiverseSeed(waveSigs: MorphSig[], crossHistory: MorphSig[]): number {
  const all=[...crossHistory.slice(-8),...waveSigs]; let best=-1, bestScore=-1;
  for (let attempt=0;attempt<48;attempt++) {
    const seed=Math.floor(Math.random()*255)+1, sig=getMorphSig(seed);
    let wMin=1.0; for (const ws of all) { const d=morphDistance(sig,ws); if (d<wMin) wMin=d; }
    const sharedTopo=all.filter(ws=>ws.topology===sig.topology).length;
    const sharedBP=all.filter(ws=>ws.topology===sig.topology&&ws.bodyPlan===sig.bodyPlan).length;
    const sharedDomain=all.filter(ws=>ws.domain===sig.domain).length;
    const score=wMin*Math.pow(0.50,sharedTopo)*Math.pow(0.70,sharedBP)*Math.pow(0.85,sharedDomain);
    if (score>bestScore) { bestScore=score; best=seed; }
  }
  return best>0?best:Math.floor(Math.random()*255)+1;
}

// §12  Expanded spawn diversity gate
// Window tracks topology, body-plan combo, domain, and hybrid/innovation flags
const SPAWN_WIN=20, MAX_SAME_TOPO=3, MAX_SAME_DOMAIN=5, MAX_SAME_BP=2;
const _hist: MorphSig[]=[];

export function registerSpawn(sig: MorphSig): void { _hist.push(sig); if (_hist.length>SPAWN_WIN) _hist.shift(); }
export function clearSpawnHistory(): void { _hist.length=0; }

export function pickDiverseSeed(): number {
  let best=-1, bestScore=-Infinity;
  // Try 60 candidates; use quasi-random spread across [1,255]
  for (let i=0;i<60;i++) {
    const seed=1+((i*97+Math.floor(Math.random()*31))%255);
    const sig=getMorphSig(seed);
    const topoC=_hist.filter(s=>s.topology===sig.topology).length;
    const domC=_hist.filter(s=>s.domain===sig.domain).length;
    const bpC=_hist.filter(s=>s.topology===sig.topology&&s.bodyPlan===sig.bodyPlan).length;
    // Hard limits
    if (topoC>=MAX_SAME_TOPO) continue;
    if (domC>=MAX_SAME_DOMAIN) continue;
    if (bpC>=MAX_SAME_BP) continue;
    // Soft score
    let minD=1.0; for (const s of _hist) { const d=morphDistance(sig,s); if (d<minD) minD=d; }
    // Bonus for hybrids and innovations (underrepresented in random selection)
    const hybrBonus=sig.hybrid?0.12:sig.innovation?0.10:0;
    const score=minD*Math.pow(0.45,topoC)*Math.pow(0.72,bpC)*Math.pow(0.88,domC)+hybrBonus;
    if (score>bestScore) { bestScore=score; best=seed; }
  }
  return best>0?best:1+Math.floor(Math.random()*255);
}

// §13  Distribution validator
export function validateDistribution(sampleSize=256): {topoCounts:number[];bpCounts:number[];maxTopoFrac:number;uniqueBodyPlans:number;passed:boolean;} {
  const tc=new Array(N_TOPO).fill(0), bpc=new Array(5).fill(0);
  for (let i=0;i<sampleSize;i++) { const n=Math.floor(Math.random()*255)+1; tc[getTopology(n)]++; bpc[BP(n)]++; }
  const maxTC=Math.max(...tc), maxFrac=maxTC/sampleSize, ubp=bpc.filter(c=>c>0).length;
  const passed=maxFrac<=0.14&&ubp>=4;
  if (!passed) console.warn('[Morphology] FAIL',{maxFrac:maxFrac.toFixed(3),tc,bpc});
  else console.log('[Morphology] OK — maxFrac:',maxFrac.toFixed(3),'bodyPlans:',ubp);
  return {topoCounts:tc,bpCounts:bpc,maxTopoFrac:maxFrac,uniqueBodyPlans:ubp,passed};
}

// §14  Legacy shims
export function getVirusRadius(n:number,R0:number,k:number): number { return R0+k*Math.log2(n+1); }
const ARCHS: VirusArchetype[]=['biological','humanoid','animal','insectoid','mechanical','armored','crystalline','mineral','plant','synthetic','robotic','amorphous','geometric','energy','cybernetic','skeletal','fluid'];
export function getVirusModelProfile(value:number): VirusModelProfile {
  const pi=Math.floor(nh(value,1)*ARCHS.length); let si=Math.floor(nh(value,2)*ARCHS.length); if (si===pi) si=(si+1)%ARCHS.length;
  const pw=0.6+nh(value,3)*0.4;
  return { primaryArchetype:ARCHS[pi],secondaryArchetype:ARCHS[si],primaryWeight:pw,secondaryWeight:1-pw, structureLevel:nh(value,4),symmetryLevel:nh(value,5),armorLevel:nh(value,6),organicLevel:nh(value,7),mechanicalLevel:nh(value,8),crystallineLevel:nh(value,9),energyLevel:nh(value,10) };
}
export function getCompatibilityScore(profile:VirusModelProfile,model:VirusVisualModel,lobes:number,symmetryLevel:number): number {
  const am=model.archetypes.includes(profile.primaryArchetype)?1:model.archetypes.includes(profile.secondaryArchetype)?0.5:0;
  const minL=model.compatibleFeatures.minLobes??3,maxL=model.compatibleFeatures.maxLobes??8;
  const [sMin,sMax]=model.compatibleFeatures.symmetryRange??[0,1];
  return am*0.40+(lobes>=minL&&lobes<=maxL?1:0)*0.25+(symmetryLevel>=sMin&&symmetryLevel<=sMax?1:0)*0.15;
}
