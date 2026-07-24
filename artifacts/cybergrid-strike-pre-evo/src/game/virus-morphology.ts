/**
 * CyberGrid Strike — Entity Morphology v7 — EVOLUTIONARY DESIGN SPACE
 *
 * 16 silhouette niches — each reads as a unique solid cutout at gameplay scale.
 * No two topologies share aspect ratio, mass distribution, AND construction logic.
 *
 * DL(n) = floor(n/64) — bit-depth detail axis:
 *   DL0  n  1– 63  bare primitive silhouette
 *   DL1  n 64–127  secondary appendages, fins, pods, extra limb pairs
 *   DL2  n128–191  articulated subsystems, joint detail, visible mechanisms
 *   DL3  n192–255  surface microstructure, vascular routing, symbiotic features
 *
 * Body-plan axis BP(n) = floor(nh(n,0xD00D)*5):
 *   BP0–2  pure-substrate variants with different construction grammars
 *   BP3    cross-lineage hybrid — legible anatomical seam between two substrates
 *   BP4    de-novo innovation — breaks the topology's silhouette rule entirely
 *
 * Role taxonomy (one per topology, shapes every variant's anatomy):
 *   siege · fortress · interceptor · leviathan · predator · serpentine
 *   floater · colonial · geometric · swarm · walker · platform
 *   parasite · orbital · chimera · fungal
 *
 * All legacy export signatures unchanged.
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

// ═══════════════════════════════════════════════════════════
// §1  UTILITIES
// ═══════════════════════════════════════════════════════════

function nh(n: number, salt: number): number {
  const x = Math.sin(n * 12.9898 + salt * 78.233 + salt * salt * 0.00371) * 43758.5453;
  return x - Math.floor(x);
}
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

// §2  Evolutionary selectors
const N_TOPO = 16;
export function getTopology(n: number): number { return Math.min(N_TOPO-1, Math.floor(nh(n,0xBEEF)*N_TOPO)); }
const BP  = (n: number) => Math.floor(nh(n,0xD00D)*5);
const TV  = (n: number) => Math.floor(nh(n,0xCAFE)*3);
const DL  = (n: number) => Math.min(3, Math.floor(n / 64));  // detail level 0-3 from n quartile
const nhr = (n: number, s: number, lo: number, hi: number) => lo + nh(n,s)*(hi-lo);
const nhi = (n: number, s: number, max: number) => Math.floor(nh(n,s)*max);

// ═══════════════════════════════════════════════════════════
// §3  DRAWING PRIMITIVES
// ═══════════════════════════════════════════════════════════
type Ctx = CanvasRenderingContext2D; type P2 = [number,number];

function fpoly(ctx:Ctx,pts:P2[],f:string,g:string,a:number,blur=6): void {
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
function fcirc(ctx:Ctx,x:number,y:number,r:number,f:string,g:string,a:number,blur=5): void { fell(ctx,x,y,r,r,f,g,a,blur); }
function frect(ctx:Ctx,x:number,y:number,w:number,h:number,f:string,g:string,a:number,blur=5): void {
  ctx.save(); ctx.globalAlpha=a; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=blur;
  ctx.fillRect(x,y,w,h); ctx.shadowBlur=0;
  ctx.strokeStyle='rgba(255,255,255,0.16)'; ctx.lineWidth=0.75; ctx.strokeRect(x,y,w,h); ctx.restore();
}
function sline(ctx:Ctx,x1:number,y1:number,x2:number,y2:number,col:string,a:number,lw=1.2): void {
  ctx.save(); ctx.globalAlpha=a; ctx.strokeStyle=col; ctx.lineWidth=lw;
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); ctx.restore();
}
function sarc(ctx:Ctx,cx:number,cy:number,r:number,a0:number,a1:number,col:string,a:number,lw:number,blur=0): void {
  ctx.save(); ctx.globalAlpha=a; ctx.strokeStyle=col; ctx.lineWidth=lw; ctx.shadowColor=col; ctx.shadowBlur=blur;
  ctx.beginPath(); ctx.arc(cx,cy,r,a0,a1); ctx.stroke(); ctx.restore();
}
function gun(ctx:Ctx,bx:number,by:number,len:number,thick:number,f:string,g:string,a:number): void {
  frect(ctx,bx-len,by-thick,len,thick*2,f,g,a+0.04); fcirc(ctx,bx-len,by,thick*0.8,f,g,a+0.06);
}
function stinger(ctx:Ctx,bx:number,by:number,len:number,bW:number,f:string,g:string,a:number): void {
  fpoly(ctx,[[bx,by-bW],[bx-len,by],[bx,by+bW]],f,g,a+0.05,6);
}
// Dorsal turret — fires leftward from top of a body
function turret(ctx:Ctx,bx:number,by:number,R:number,f:string,g:string,a:number): void {
  fcirc(ctx,bx,by,R*0.16,f,g,a-0.04);
  frect(ctx,bx-R*0.70,by-R*0.055,R*0.70,R*0.11,f,g,a+0.04);
  fcirc(ctx,bx-R*0.70,by,R*0.065,f,g,a+0.06);
}
// Energy beam — direct stroke, no barrel
function ebeam(ctx:Ctx,x0:number,y0:number,x1:number,y1:number,f:string,g:string,a:number,w:number): void {
  ctx.save(); ctx.globalAlpha=a-0.10; ctx.strokeStyle=f; ctx.lineWidth=w; ctx.shadowColor=g; ctx.shadowBlur=14;
  ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke(); ctx.restore();
  fcirc(ctx,x1,y1,w*0.85,'rgba(255,255,255,0.88)',g,a);
}
// Organic arm (bezier curve limb)
function oarm(ctx:Ctx,x0:number,y0:number,x1:number,y1:number,w:number,curl:number,f:string,g:string,a:number): void {
  const mx=(x0+x1)/2+curl, my=(y0+y1)/2;
  ctx.save(); ctx.globalAlpha=a; ctx.strokeStyle=f; ctx.lineWidth=w*2; ctx.shadowColor=g; ctx.shadowBlur=3;
  ctx.beginPath(); ctx.moveTo(x0,y0); ctx.quadraticCurveTo(mx,my,x1,y1); ctx.stroke();
  ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,0.14)'; ctx.lineWidth=0.6;
  ctx.beginPath(); ctx.moveTo(x0,y0); ctx.quadraticCurveTo(mx,my,x1,y1); ctx.stroke(); ctx.restore();
}
// Mechanical leg (two straight segments with joint circle)
function mechleg(ctx:Ctx,hx:number,hy:number,kx:number,ky:number,fx:number,fy:number,w:number,f:string,g:string,a:number): void {
  sline(ctx,hx,hy,kx,ky,f,a-0.06,w*2); sline(ctx,kx,ky,fx,fy,f,a-0.06,w*2);
  fcirc(ctx,kx,ky,w*1.6,f,g,a-0.10); // knee joint
}
// Crystal shard
function cshard(ctx:Ctx,bx:number,by:number,angle:number,len:number,w:number,f:string,g:string,a:number): void {
  const tx=bx+Math.cos(angle)*len, ty=by+Math.sin(angle)*len;
  const px=-Math.sin(angle)*w, py=Math.cos(angle)*w;
  fpoly(ctx,[[bx+px,by+py],[bx-px,by-py],[tx,ty]],f,g,a,5);
  fpoly(ctx,[[bx+px*0.4,by+py*0.4],[tx,ty],[bx,by]],'rgba(255,255,255,0.22)',g,a-0.28,2);
}
// Organic blob (bezier-perturbed polygon)
function oblob(ctx:Ctx,cx:number,cy:number,rx:number,ry:number,f:string,g:string,a:number,n:number,salt:number): void {
  const nV=10; const pts:P2[]=[];
  for (let i=0;i<nV;i++) { const ang=(i/nV)*Math.PI*2; pts.push([cx+Math.cos(ang)*rx*(1+(nh(n,salt+i)-0.5)*0.30),cy+Math.sin(ang)*ry*(1+(nh(n,salt+i+nV)-0.5)*0.30)]); }
  ctx.save(); ctx.globalAlpha=a; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=7;
  ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]);
  for (let i=0;i<nV;i++) { const ni=(i+1)%nV; ctx.quadraticCurveTo(pts[i][0],pts[i][1],(pts[i][0]+pts[ni][0])/2,(pts[i][1]+pts[ni][1])/2); }
  ctx.closePath(); ctx.fill(); ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,0.14)'; ctx.lineWidth=0.75; ctx.stroke(); ctx.restore();
}
// Energy tendril (bent arc)
function etend(ctx:Ctx,x0:number,y0:number,x1:number,y1:number,f:string,g:string,a:number,n:number,salt:number): void {
  const dx=x1-x0,dy=y1-y0,len=Math.hypot(dx,dy);
  const mx=x0+dx*0.5+(nh(n,salt)-0.5)*len*0.42,my=y0+dy*0.5+(nh(n,salt+1)-0.5)*len*0.42;
  ctx.save(); ctx.globalAlpha=a; ctx.strokeStyle=f; ctx.lineWidth=len*0.030; ctx.shadowColor=g; ctx.shadowBlur=9;
  ctx.beginPath(); ctx.moveTo(x0,y0); ctx.quadraticCurveTo(mx,my,x1,y1); ctx.stroke(); ctx.restore();
}
// Root tendril (bezier with variation)
function rtend(ctx:Ctx,x0:number,y0:number,angle:number,len:number,w:number,f:string,g:string,a:number,n:number,salt:number): void {
  const c1x=x0+Math.cos(angle)*len*0.38+(nh(n,salt)-0.5)*len*0.28;
  const c1y=y0+Math.sin(angle)*len*0.38+(nh(n,salt+1)-0.5)*len*0.10;
  const c2x=x0+Math.cos(angle)*len*0.72+(nh(n,salt+2)-0.5)*len*0.20;
  const c2y=y0+Math.sin(angle)*len*0.72+(nh(n,salt+3)-0.5)*len*0.08;
  const ex=x0+Math.cos(angle)*len, ey=y0+Math.sin(angle)*len;
  ctx.save(); ctx.globalAlpha=a; ctx.strokeStyle=f; ctx.lineWidth=w; ctx.shadowColor=g; ctx.shadowBlur=4;
  ctx.beginPath(); ctx.moveTo(x0,y0); ctx.bezierCurveTo(c1x,c1y,c2x,c2y,ex,ey); ctx.stroke(); ctx.restore();
}
// Bolt row (DL detail)
function bolts(ctx:Ctx,x0:number,y:number,x1:number,f:string,g:string,a:number,pitch:number): void {
  ctx.save(); ctx.globalAlpha=a-0.30; ctx.strokeStyle='rgba(255,255,255,0.75)'; ctx.lineWidth=0.55;
  for (let x=x0+pitch/2;x<x1;x+=pitch) { ctx.beginPath(); ctx.arc(x,y,pitch*0.22,0,Math.PI*2); ctx.stroke(); }
  ctx.restore();
}
// Track bogie row (DL detail) — small circles representing road wheels
function bogies(ctx:Ctx,x0:number,x1:number,y:number,f:string,g:string,a:number,R:number): void {
  const nr=Math.max(2,Math.round((x1-x0)/(R*0.40)));
  for (let i=0;i<nr;i++) { const bx=x0+i*((x1-x0)/(nr-1)); sarc(ctx,bx,y,R*0.095,0,Math.PI*2,f,a-0.28,0.6); }
}
// Armor panel — thin overlay suggesting plate seams
function armorpanel(ctx:Ctx,x:number,y:number,w:number,h:number,f:string,g:string,a:number): void {
  frect(ctx,x,y,w,h,f,g,a-0.12);
  ctx.save(); ctx.globalAlpha=a-0.38; ctx.strokeStyle='rgba(255,255,255,0.65)'; ctx.lineWidth=0.5;
  ctx.strokeRect(x+w*0.12,y+h*0.20,w*0.76,h*0.60); ctx.restore();
}

// ═══════════════════════════════════════════════════════════
// §4  16 TOPOLOGY DRAWERS
// Each must occupy a UNIQUE silhouette niche.
// ═══════════════════════════════════════════════════════════

// ── T0  DREADNOUGHT ──────────────────────────────────────
// Silhouette: wide rectangle (≥3R each side) × shallow height (≤1.2R)
// Role: siege · Mass: center-front · Weapon: front gun battery
function drawT0(ctx:Ctx,cx:number,cy:number,R:number,n:number,f:string,g:string,A:number): void {
  const bp=BP(n),v=TV(n),dl=DL(n);
  const HW=[2.90,3.10,2.70][v], HH=[0.58,0.68,0.48][v];  // half-width / half-height
  if (bp===0) { // Standard siege hull — twin barrels, track skirt
    // Hull
    fpoly(ctx,[[cx-HW*R,cy-HH*R],[cx+HW*0.80*R,cy-HH*R],[cx+HW*R,cy-HH*0.55*R],[cx+HW*R,cy+HH*0.55*R],[cx+HW*0.80*R,cy+HH*R],[cx-HW*R,cy+HH*R]],f,g,A,8);
    // Track skirt below hull
    fpoly(ctx,[[cx-HW*R,cy+HH*R],[cx+HW*R,cy+HH*R],[cx+HW*R,cy+HH*1.42*R],[cx-HW*R,cy+HH*1.42*R]],f,g,A-0.22,3);
    // Front gun mantlet
    frect(ctx,cx-HW*R-R*0.20,cy-HH*0.65*R,R*0.20,HH*1.30*R,f,g,A+0.04);
    // Twin gun barrels (stacked)
    gun(ctx,cx-HW*R-R*0.20,cy-R*0.22,R*1.20,R*0.078,f,g,A);
    gun(ctx,cx-HW*R-R*0.20,cy+R*0.22,R*1.00,R*0.068,f,g,A);
    // Hull striping
    ctx.save(); ctx.globalAlpha=A-0.30; ctx.strokeStyle='rgba(255,255,255,0.70)'; ctx.lineWidth=0.6;
    for (let i=1;i<=4;i++) { const sx=cx-HW*R+i*(HW*2*R/5); ctx.beginPath(); ctx.moveTo(sx,cy-HH*R); ctx.lineTo(sx,cy+HH*R); ctx.stroke(); }
    ctx.restore();
  } else if (bp===1) { // Long-barrel artillery — single massive barrel, elevated
    fpoly(ctx,[[cx-HW*R,cy-HH*0.80*R],[cx+HW*R,cy-HH*0.80*R],[cx+HW*R,cy+HH*0.80*R],[cx-HW*R,cy+HH*0.80*R]],f,g,A-0.04,7);
    frect(ctx,cx-HW*R,cy+HH*0.80*R,HW*2*R,HH*0.55*R,f,g,A-0.22,3); // track skirt
    // Single very long barrel at angle
    const barAngle=-Math.PI*0.12;
    ctx.save(); ctx.translate(cx-HW*0.32*R,cy-HH*0.50*R); ctx.rotate(barAngle);
    frect(ctx,-R*1.80,-R*0.072,R*1.80,R*0.144,f,g,A+0.06); fcirc(ctx,-R*1.80,0,R*0.078,f,g,A+0.08);
    ctx.restore();
    frect(ctx,cx-HW*0.32*R-R*0.28,cy-HH*0.50*R-R*0.22,R*0.55,R*0.44,f,g,A-0.02); // mantlet
  } else if (bp===2) { // Bunker-tank — very wide, 3 front barrels, squat
    const W2=HW*1.18*R, H2=HH*0.72*R;
    fpoly(ctx,[[cx-W2,cy-H2],[cx+W2*0.92,cy-H2],[cx+W2,cy-H2*0.50],[cx+W2,cy+H2*0.50],[cx+W2*0.92,cy+H2],[cx-W2,cy+H2]],f,g,A,8);
    frect(ctx,cx-W2,cy+H2,W2*2,H2*0.55,f,g,A-0.24,3);
    frect(ctx,cx-W2-R*0.18,cy-H2*0.72,R*0.18,H2*1.44,f,g,A+0.04);
    for (const [dy,l] of [[-R*0.30,R*0.95],[0,R*1.15],[R*0.30,R*0.95]]) gun(ctx,cx-W2-R*0.18,cy+dy,l,R*0.062,f,g,A);
  } else if (bp===3) { // HYBRID: Siege hull + Organic — bio-armored dreadnought
    // Base hull (slightly reduced)
    fpoly(ctx,[[cx-HW*R,cy-HH*R],[cx+HW*0.80*R,cy-HH*R],[cx+HW*R,cy-HH*0.55*R],[cx+HW*R,cy+HH*0.55*R],[cx+HW*0.80*R,cy+HH*R],[cx-HW*R,cy+HH*R]],f,g,A-0.06,7);
    // Organic armor growths (barnacle domes) on hull surface
    for (let i=0;i<4+v;i++) {
      const bx=cx-HW*R*0.72+i*HW*R*0.45, bH=R*(0.20+nh(n,20+i)*0.12), bW=R*(0.26+nh(n,30+i)*0.10);
      ctx.save(); ctx.globalAlpha=A-0.06; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=5;
      ctx.beginPath(); ctx.moveTo(bx-bW,cy-HH*R); ctx.bezierCurveTo(bx-bW,cy-HH*R-bH*1.6,bx+bW,cy-HH*R-bH*1.6,bx+bW,cy-HH*R); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    // Root tendrils from track area
    for (let i=0;i<3;i++) rtend(ctx,cx+(i-1)*HW*R*0.55,cy+HH*R,Math.PI*0.5,R*(0.45+nh(n,40+i)*0.30),R*0.060,f,g,A-0.24,n,40+i*4);
    stinger(ctx,cx-HW*R,cy,R*0.85,R*0.09,f,g,A); // organic fang weapon
  } else { // BP4 INNOVATION: Hover fortress — anti-grav dreadnought, no tracks
    const W4=HW*1.08*R, H4=HH*0.90*R;
    fell(ctx,cx+W4*0.05,cy,W4*0.95,H4*0.82,f,g,A,8); // aerodynamic hull (oval)
    // Repulsor pods (4 corner ellipses) instead of tracks
    for (const [px,py] of [[cx-W4*0.70,cy+H4*0.92],[cx-W4*0.20,cy+H4*0.92],[cx+W4*0.30,cy+H4*0.92],[cx+W4*0.75,cy+H4*0.92]]) {
      fell(ctx,px,py,R*0.18,R*0.09,f,g,A-0.14,4);
      sarc(ctx,px,py,R*0.22,Math.PI,0,f,A-0.30,0.7,5);
    }
    // Weapons on BOTH front and top
    gun(ctx,cx-W4,cy,R*1.10,R*0.075,f,g,A);
    turret(ctx,cx-W4*0.28,cy-H4*0.82,R,f,g,A);
    turret(ctx,cx+W4*0.28,cy-H4*0.82,R,f,g,A);
  }
  // ── DL detail ──
  if (dl>=1) { // Fuel drums at rear
    for (const s of [-1,1] as const) fell(ctx,cx+HW*R*0.88,cy+s*HH*R*0.62,R*0.14,R*0.22,f,g,A-0.22,3);
  }
  if (dl>=2) { // Track bogie wheels visible
    bogies(ctx,cx-HW*R,cx+HW*R*0.72,cy+HH*1.20*R,f,g,A,R);
    // Hull vision ports
    for (let i=0;i<3;i++) { const vx=cx-HW*R*0.50+i*HW*R*0.45; sarc(ctx,vx,cy-HH*R*0.60,R*0.060,0,Math.PI*2,'rgba(255,255,255,0.55)',A-0.30,0.65); }
  }
  if (dl>=3) { // Bolt rows + secondary pintle mount
    bolts(ctx,cx-HW*R*0.90,cy-HH*R*0.96,cx+HW*R*0.80,f,g,A,R*0.28);
    turret(ctx,cx+HW*R*0.38,cy-HH*R,R*0.75,f,g,A-0.10);
    // Tow cable
    ctx.save(); ctx.globalAlpha=A-0.35; ctx.setLineDash([R*0.09,R*0.07]); ctx.strokeStyle=f; ctx.lineWidth=R*0.030;
    ctx.beginPath(); ctx.moveTo(cx+HW*R,cy+HH*R*0.70); ctx.lineTo(cx+HW*R+R*0.58,cy+HH*R*0.50); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
  }
}

// ── T1  TOWER ────────────────────────────────────────────
// Silhouette: TALL NARROW prism (H≥2.5R × W≤0.60R) — VERTICAL orientation
// Role: fortress · Mass: vertical-center · Weapon: rotating head at top
function drawT1(ctx:Ctx,cx:number,cy:number,R:number,n:number,f:string,g:string,A:number): void {
  const bp=BP(n),v=TV(n),dl=DL(n);
  const TH=[2.60,2.90,2.30][v]; // tower height (half)
  const TW=[0.30,0.26,0.34][v]; // tower half-width
  const top=cy-TH*R, bot=cy+TH*0.40*R;
  if (bp===0) { // Gun tower — prismatic column + rotating weapon head
    frect(ctx,cx-TW*R,bot,TW*2*R,TH*1.40*R,f,g,A,8); // main column
    // Wider base platform
    fpoly(ctx,[[cx-TW*2.2*R,bot],[cx+TW*2.2*R,bot],[cx+TW*1.80*R,bot+TH*0.38*R],[cx-TW*1.80*R,bot+TH*0.38*R]],f,g,A-0.08,5);
    // 3 anchor legs spreading down
    for (const [ax,ay] of [[cx-TW*3.0*R,cy+TH*0.88*R],[cx,cy+TH*0.78*R],[cx+TW*3.0*R,cy+TH*0.88*R]]) {
      sline(ctx,cx-TW*0.0*R,bot+TH*0.18*R,ax,ay,f,A-0.22,R*0.07);
      fcirc(ctx,ax,ay,R*0.10,f,g,A-0.25);
    }
    // Rotating weapon head at top
    fell(ctx,cx,top+TH*0.18*R,TW*1.55*R,TW*0.80*R,f,g,A+0.02,7);
    gun(ctx,cx-TW*R,top+TH*0.18*R,R*1.05,R*0.065,f,g,A);
  } else if (bp===1) { // Obelisk — tapered square column, beam weapon at apex
    fpoly(ctx,[[cx-TW*1.60*R,bot],[cx+TW*1.60*R,bot],[cx+TW*0.55*R,top],[cx-TW*0.55*R,top]],f,g,A,8);
    fpoly(ctx,[[cx-TW*2.4*R,bot],[cx+TW*2.4*R,bot],[cx+TW*1.60*R,bot+TH*0.30*R],[cx-TW*1.60*R,bot+TH*0.30*R]],f,g,A-0.10,5);
    ebeam(ctx,cx-TW*0.55*R,top,cx-TW*0.55*R-R*1.10,top,f,g,A,R*0.055);
    // Horizontal rings along shaft
    for (let i=1;i<=3;i++) { const ry=bot+(top-bot)*(i/4); frect(ctx,cx-TW*1.25*R,ry-R*0.040,TW*2.50*R,R*0.080,f,g,A-0.22); }
  } else if (bp===2) { // Drilling spire — helix shaft, drill bit at base, gun at top
    // Shaft (slightly tapered)
    fpoly(ctx,[[cx-TW*0.88*R,bot],[cx+TW*0.88*R,bot],[cx+TW*0.55*R,top],[cx-TW*0.55*R,top]],f,g,A,7);
    // Helix pattern (non-bezier stroke segments approximating helix)
    ctx.save(); ctx.globalAlpha=A-0.26; ctx.strokeStyle='rgba(255,255,255,0.70)'; ctx.lineWidth=0.65;
    for (let i=0;i<10;i++) {
      const t=i/10, t2=(i+1)/10;
      const y0=bot+(top-bot)*t, y1=bot+(top-bot)*t2;
      const x0=cx+TW*0.72*R*Math.cos(t*Math.PI*3.0), x1=cx+TW*0.72*R*Math.cos(t2*Math.PI*3.0);
      ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke();
    }
    ctx.restore();
    // Drill bit at base
    fpoly(ctx,[[cx-TW*1.10*R,bot],[cx+TW*1.10*R,bot],[cx,bot+TH*0.50*R]],f,g,A-0.06,6);
    gun(ctx,cx-TW*0.55*R,top,R*0.98,R*0.060,f,g,A);
  } else if (bp===3) { // HYBRID: Tower + Crystal — crystal growth at base + mechanical shaft
    frect(ctx,cx-TW*R,top,TW*2*R,TH*1.40*R,f,g,A,8);
    // Crystal cluster at base (replacing anchor legs)
    for (let i=0;i<4+v;i++) {
      const a=Math.PI*0.55+i*(Math.PI*0.88/(3+v));
      cshard(ctx,cx+TW*R*(Math.sin(a)*0.50),bot+TH*0.10*R,a,R*(0.45+nh(n,10+i)*0.38),R*0.068,f,g,A-0.06);
    }
    fell(ctx,cx,top+TH*0.18*R,TW*1.55*R,TW*0.80*R,f,g,A+0.02,7);
    gun(ctx,cx-TW*R,top+TH*0.18*R,R*1.05,R*0.065,f,g,A);
  } else { // BP4 INNOVATION: Floating monolith — same shape, no base, levitates above energy disk
    frect(ctx,cx-TW*R,top,TW*2*R,TH*1.20*R,f,g,A,8);
    // No anchor legs — energy disk below instead
    sarc(ctx,cx,bot+TH*0.22*R,TW*2.80*R,0,Math.PI*2,f,A-0.24,R*0.10,12);
    sarc(ctx,cx,bot+TH*0.22*R,TW*1.80*R,0,Math.PI*2,f,A-0.30,R*0.050,6);
    // Energy arcs from disk up to tower
    for (let i=0;i<3;i++) etend(ctx,cx+TW*(i-1)*2.4*R,bot+TH*0.22*R,cx+TW*(i-1)*0.55*R,bot,f,g,A-0.22,n,10+i*3);
    fell(ctx,cx,top+TH*0.18*R,TW*1.55*R,TW*0.80*R,f,g,A+0.02,7);
    gun(ctx,cx-TW*R,top+TH*0.18*R,R*1.05,R*0.065,f,g,A);
  }
  // ── DL detail ──
  if (dl>=1) { frect(ctx,cx-TW*1.80*R,cy-TH*0.10*R,TW*3.60*R,R*0.080,f,g,A-0.18); } // mid-height banding ring
  if (dl>=2) { // Cooling fins array
    for (let i=0;i<3;i++) {
      const fy=cy-TH*0.28*R+i*R*0.20;
      frect(ctx,cx-TW*1.40*R,fy,TW*2.80*R,R*0.060,f,g,A-0.22);
    }
  }
  if (dl>=3) { // Sensor dish
    sarc(ctx,cx+TW*0.80*R,top+TH*0.10*R,R*0.18,Math.PI*0.80,Math.PI*0.20+Math.PI,f,A-0.20,R*0.040);
    sline(ctx,cx+TW*0.80*R,top+TH*0.10*R,cx+TW*0.80*R,top+TH*0.30*R,f,A-0.25,R*0.038);
    bolts(ctx,cx-TW*R*0.90,bot+TH*0.06*R,cx+TW*R*0.90,f,g,A,R*0.20);
  }
}

// ── T2  NEEDLE ───────────────────────────────────────────
// Silhouette: EXTREME elongation ≥4.5R × ≤0.40R — nearly a horizontal line
// Role: interceptor · Mass: distributed · Weapon: sharp left tip
function drawT2(ctx:Ctx,cx:number,cy:number,R:number,n:number,f:string,g:string,A:number): void {
  const bp=BP(n),v=TV(n),dl=DL(n);
  const NL=[4.60,5.00,4.20][v]; // needle half-length
  const NH=[0.18,0.22,0.15][v]; // needle half-height
  if (bp===0) { // Pure needle — pointed both ends, widest at 40% from left
    fpoly(ctx,[[cx-NL*R,cy],[cx-NL*0.62*R,cy-NH*R],[cx+NL*0.32*R,cy-NH*0.75*R],[cx+NL*R,cy],[cx+NL*0.32*R,cy+NH*0.75*R],[cx-NL*0.62*R,cy+NH*R]],f,g,A,6);
    stinger(ctx,cx-NL*R,cy,R*0.38,NH*R,f,g,A);
    // Engine nozzle at right
    fpoly(ctx,[[cx+NL*R,cy-NH*0.55*R],[cx+NL*1.12*R,cy-NH*0.28*R],[cx+NL*1.12*R,cy+NH*0.28*R],[cx+NL*R,cy+NH*0.55*R]],f,g,A-0.18,3);
  } else if (bp===1) { // Twin-spar — two parallel needles joined by center connector
    const sep=NH*1.80*R;
    for (const s of [-1,1] as const) {
      fpoly(ctx,[[cx-NL*R,cy+s*sep],[cx-NL*0.62*R,cy+s*(sep-NH*R)],[cx+NL*0.32*R,cy+s*(sep-NH*0.72*R)],[cx+NL*R,cy+s*sep],[cx+NL*0.32*R,cy+s*(sep+NH*0.72*R)],[cx-NL*0.62*R,cy+s*(sep+NH*R)]],f,g,A,5);
      stinger(ctx,cx-NL*R,cy+s*sep,R*0.30,NH*R,f,g,A-0.04);
    }
    // Center strut
    frect(ctx,cx-NL*0.10*R,cy-sep,NL*0.20*R,sep*2,f,g,A-0.12);
  } else if (bp===2) { // Arrow with delta wings — needle + swept stabilizers
    fpoly(ctx,[[cx-NL*R,cy],[cx-NL*0.62*R,cy-NH*R],[cx+NL*0.32*R,cy-NH*0.72*R],[cx+NL*R,cy],[cx+NL*0.32*R,cy+NH*0.72*R],[cx-NL*0.62*R,cy+NH*R]],f,g,A,6);
    // Delta wings at center
    fpoly(ctx,[[cx-NL*0.10*R,cy-NH*R],[cx+NL*0.50*R,cy-NH*R],[cx+NL*0.50*R,cy-NH*2.60*R],[cx-NL*0.25*R,cy-NH*R]],f,g,A-0.12,5);
    fpoly(ctx,[[cx-NL*0.10*R,cy+NH*R],[cx+NL*0.50*R,cy+NH*R],[cx+NL*0.50*R,cy+NH*2.60*R],[cx-NL*0.25*R,cy+NH*R]],f,g,A-0.12,5);
    stinger(ctx,cx-NL*R,cy,R*0.38,NH*R,f,g,A);
  } else if (bp===3) { // HYBRID: Front organic + rear crystal — seam at center
    // Front third (left) — organic flesh
    const seam=cx-NL*0.25*R;
    ctx.save(); ctx.beginPath(); ctx.rect(cx-NL*R,cy-NH*3*R,seam-cx+NL*R,NH*6*R); ctx.clip();
    ctx.save(); ctx.globalAlpha=A; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=7;
    ctx.beginPath(); ctx.moveTo(cx-NL*R,cy); ctx.bezierCurveTo(cx-NL*R,cy-NH*R,seam,cy-NH*R,seam,cy-NH*R); ctx.lineTo(seam,cy+NH*R); ctx.bezierCurveTo(seam,cy+NH*R,cx-NL*R,cy+NH*R,cx-NL*R,cy); ctx.closePath(); ctx.fill(); ctx.restore(); ctx.restore();
    // Rear two-thirds (right) — crystal
    ctx.save(); ctx.beginPath(); ctx.rect(seam,cy-NH*3*R,NL*R*2,NH*6*R); ctx.clip();
    for (let i=0;i<4+v;i++) {
      const sx=seam+i*(NL*1.22*R-seam+cx)/(3+v), sh=NH*(1.1-i*0.08)*R;
      fpoly(ctx,[[sx,cy-sh],[sx+NL*0.28*R,cy-sh*0.60],[sx+NL*0.28*R,cy+sh*0.60],[sx,cy+sh]],f,g,A-0.04,5);
    }
    ctx.restore();
    stinger(ctx,cx-NL*R,cy,R*0.38,NH*R,f,g,A);
  } else { // BP4 INNOVATION: Broadhead — breaks needle rule entirely (wide cross)
    const BW=R*1.65, BH=R*1.10;
    fell(ctx,cx-R*0.28,cy,BW,BH*0.60,f,g,A,8); // wide central mass
    // Cross arms
    for (const s of [-1,1] as const) fell(ctx,cx-R*0.28,cy+s*BH*0.82,R*0.62,BH*0.28,f,g,A-0.10,5);
    gun(ctx,cx-BW-R*0.28,cy,R*0.88,R*0.075,f,g,A);
  }
  // ── DL detail ──
  if (dl>=1) { // Propulsion ring at rear
    sarc(ctx,cx+NL*0.72*R,cy,NH*1.60*R,0,Math.PI*2,f,A-0.22,R*0.065,5);
  }
  if (dl>=2) { // Mid-body sensor cluster
    fell(ctx,cx,cy-NH*R,R*0.10,R*0.050,f,g,A-0.25,3);
    sline(ctx,cx,cy-NH*R,cx+R*0.12,cy-NH*1.28*R,f,A-0.22,R*0.038); // antenna
  }
  if (dl>=3) { // Leading edge detail
    ctx.save(); ctx.globalAlpha=A-0.28; ctx.strokeStyle='rgba(255,255,255,0.60)'; ctx.lineWidth=0.55;
    for (let i=1;i<=4;i++) { const ix=cx-NL*R+i*(NL*R*0.50/5); ctx.beginPath(); ctx.moveTo(ix,cy-NH*R*0.55); ctx.lineTo(ix,cy+NH*R*0.55); ctx.stroke(); }
    ctx.restore();
  }
}

// ── T3  LEVIATHAN ────────────────────────────────────────
// Silhouette: MASSIVE smooth teardrop (2.5R wide × 1.8R tall) — biggest entity
// Role: leviathan · Mass: rear-heavy · Weapon: tiny stinger at snout
function drawT3(ctx:Ctx,cx:number,cy:number,R:number,n:number,f:string,g:string,A:number): void {
  const bp=BP(n),v=TV(n),dl=DL(n);
  const LW=[2.55,2.80,2.35][v]; // leviathan half-width (massive)
  const LH=[1.72,1.88,1.58][v]; // leviathan half-height
  if (bp===0) { // Great whale — teardrop, pectoral fins, tail flukes
    ctx.save(); ctx.globalAlpha=A; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=10;
    ctx.beginPath();
    ctx.moveTo(cx-LW*R,cy); ctx.bezierCurveTo(cx-LW*R,cy-LH*R*0.52,cx-LH*R*0.85,cy-LH*R,cx+LH*R*0.55,cy-LH*R);
    ctx.bezierCurveTo(cx+LW*R*0.70,cy-LH*R,cx+LW*R,cy-LH*R*0.35,cx+LW*R,cy);
    ctx.bezierCurveTo(cx+LW*R,cy+LH*R*0.35,cx+LW*R*0.70,cy+LH*R,cx+LH*R*0.55,cy+LH*R);
    ctx.bezierCurveTo(cx-LH*R*0.85,cy+LH*R,cx-LW*R,cy+LH*R*0.52,cx-LW*R,cy);
    ctx.closePath(); ctx.fill(); ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,0.16)'; ctx.lineWidth=0.9; ctx.stroke(); ctx.restore();
    // Pectoral fins (pair)
    for (const s of [-1,1] as const) fpoly(ctx,[[cx-LW*0.20*R,cy+s*LH*R*0.55],[cx+LW*0.30*R,cy+s*LH*R],[cx+LW*0.58*R,cy+s*LH*R*0.58],[cx+LW*0.42*R,cy+s*LH*R*0.28]],f,g,A-0.14,5);
    // Tail flukes
    for (const s of [-1,1] as const) fpoly(ctx,[[cx+LW*R,cy+s*LH*R*0.18],[cx+LW*R+R*0.72,cy+s*LH*R*0.88],[cx+LW*R+R*0.52,cy+s*LH*R*0.98]],f,g,A-0.18,4);
    stinger(ctx,cx-LW*R,cy,R*0.42,LH*R*0.14,f,g,A); // tiny snout weapon
    fcirc(ctx,cx-LW*0.60*R,cy-LH*R*0.52,R*0.14,'rgba(255,255,255,0.82)',g,A-0.02); // eye
    fcirc(ctx,cx-LW*0.60*R,cy-LH*R*0.52,R*0.070,'#0a0f1a',g,1.0);
  } else if (bp===1) { // Nautiloid — coiled shell (spiral), tentacles at opening
    const shellR=LW*R*0.82;
    // Spiral coil (approximated as concentric arcs)
    for (let i=0;i<4;i++) {
      const sR=shellR*(1-i*0.22);
      ctx.save(); ctx.globalAlpha=A-i*0.10; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=8-i*1.5;
      ctx.beginPath(); ctx.moveTo(cx+R*0.18,cy); ctx.arc(cx+R*0.18,cy,sR,Math.PI*0.40,Math.PI*1.60,false); ctx.closePath(); ctx.fill();
      ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,0.14)'; ctx.lineWidth=0.75; ctx.stroke(); ctx.restore();
    }
    // Tentacle cluster at shell opening (left side)
    const tentBase=[cx-shellR*0.75,cy+shellR*0.32];
    for (let i=0;i<5+v;i++) {
      const tLen=R*(0.62+nh(n,10+i)*0.58);
      const curl=(nh(n,20+i)-0.5)*R*0.40;
      oarm(ctx,tentBase[0],tentBase[1],tentBase[0]-tLen,tentBase[1]+(nh(n,30+i)-0.5)*R*0.55,R*0.060,curl,f,g,A-0.12);
    }
    stinger(ctx,tentBase[0]-R*0.62,tentBase[1],R*0.40,R*0.085,f,g,A);
  } else if (bp===2) { // Giant manta ray — flat diamond, very wide, long tail
    const MW=LW*1.18*R, MH=LH*0.52*R;
    // Main diamond body
    fpoly(ctx,[[cx-MW*0.42,cy],[cx-MW*0.20,cy-MH],[cx+MW,cy-MH*0.22],[cx+MW*1.05,cy],[cx+MW,cy+MH*0.22],[cx-MW*0.20,cy+MH]],f,g,A,9);
    // Wingtip details
    for (const s of [-1,1] as const) {
      fpoly(ctx,[[cx-MW*0.10,cy+s*MH*0.72],[cx-MW*0.40,cy+s*MH*1.18],[cx-MW*0.10,cy+s*MH*1.22]],f,g,A-0.20,4);
      fpoly(ctx,[[cx+MW*0.72,cy+s*MH*0.22],[cx+MW*0.88,cy+s*MH*0.60],[cx+MW*1.05,cy+s*MH*0.26]],f,g,A-0.22,4);
    }
    // Long tail spine
    fpoly(ctx,[[cx+MW*1.05,cy-MH*0.06],[cx+MW*1.05+R*1.30,cy],[cx+MW*1.05,cy+MH*0.06]],f,g,A-0.18,4);
    stinger(ctx,cx-MW*0.42,cy,R*0.40,MH*0.22,f,g,A);
  } else if (bp===3) { // HYBRID: Leviathan + Crystal — calcified armor on whale body
    // Base whale
    ctx.save(); ctx.globalAlpha=A-0.04; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=9;
    ctx.beginPath();
    ctx.moveTo(cx-LW*R,cy); ctx.bezierCurveTo(cx-LW*R,cy-LH*R*0.52,cx-LH*R*0.85,cy-LH*R,cx+LH*R*0.55,cy-LH*R);
    ctx.bezierCurveTo(cx+LW*R*0.70,cy-LH*R,cx+LW*R,cy-LH*R*0.35,cx+LW*R,cy);
    ctx.bezierCurveTo(cx+LW*R,cy+LH*R*0.35,cx+LW*R*0.70,cy+LH*R,cx+LH*R*0.55,cy+LH*R);
    ctx.bezierCurveTo(cx-LH*R*0.85,cy+LH*R,cx-LW*R,cy+LH*R*0.52,cx-LW*R,cy);
    ctx.closePath(); ctx.fill(); ctx.restore();
    // Crystal plate armor growing on dorsal surface
    for (let i=0;i<4+v;i++) {
      const px=cx-LW*R*0.55+i*LW*R*0.38, pLen=R*(0.40+nh(n,10+i)*0.28);
      cshard(ctx,px,cy-LH*R*(0.62+nh(n,20+i)*0.18),Math.PI*1.5,pLen,R*0.072,f,g,A-0.08);
    }
    stinger(ctx,cx-LW*R,cy,R*0.42,LH*R*0.14,f,g,A);
  } else { // BP4 INNOVATION: Gas-sac — balloon sphere, trailing gas tendrils, no skeleton
    const GR=LW*0.88*R;
    // Huge sphere body
    fell(ctx,cx+GR*0.15,cy,GR,GR*0.82,f,g,A,10);
    // Internal gas pocket (lighter inner region)
    fell(ctx,cx+GR*0.08,cy-GR*0.08,GR*0.58,GR*0.52,'rgba(255,255,255,0.10)',g,A-0.50,2);
    // Trailing gas tendrils below
    for (let i=0;i<6+v;i++) {
      const tx=cx-GR*0.72+i*GR*0.28, tLen=R*(0.90+nh(n,10+i)*1.10);
      oarm(ctx,tx,cy+GR*0.68,tx+(nh(n,20+i)-0.5)*R*0.40,cy+GR*0.68+tLen,R*0.040,0,f,g,A-0.22);
    }
    stinger(ctx,cx-GR,cy,R*0.38,GR*0.10,f,g,A);
  }
  // ── DL detail ──
  if (dl>=1) { // Barnacle patches
    for (let i=0;i<3+v;i++) {
      const bx=cx+LW*R*(nh(n,40+i)-0.50)*0.88, by=cy+LH*R*(nh(n,50+i)-0.50)*0.72;
      fcirc(ctx,bx,by,R*(0.068+nh(n,60+i)*0.040),'rgba(255,255,255,0.28)',g,A-0.45);
    }
  }
  if (dl>=2) { // Belly stripe pattern
    ctx.save(); ctx.globalAlpha=A-0.32; ctx.strokeStyle='rgba(255,255,255,0.55)'; ctx.lineWidth=0.70;
    for (let i=1;i<=4;i++) { const bx=cx-LW*R*0.45+i*LW*R*0.28; const bh=LH*R*0.72*Math.sqrt(Math.max(0,1-Math.pow((bx-cx)/(LW*R),2))); ctx.beginPath(); ctx.moveTo(bx,cy-bh); ctx.lineTo(bx,cy+bh); ctx.stroke(); }
    ctx.restore();
  }
  if (dl>=3) { // Parasite attached + blowhole
    fcirc(ctx,cx-LW*0.38*R,cy-LH*R*0.75,R*0.12,f,g,A-0.30);
    for (let i=0;i<4;i++) sline(ctx,cx-LW*0.38*R,cy-LH*R*0.75,cx-LW*0.38*R+R*(nh(n,70+i)-0.50)*0.25,cy-LH*R*0.75+R*(nh(n,80+i)-0.50)*0.25,f,A-0.40,R*0.028);
    fcirc(ctx,cx-LW*0.22*R,cy-LH*R,R*0.060,f,g,A-0.18); // blowhole
  }
}

// ── T4  ARACHNID ─────────────────────────────────────────
// Silhouette: compact body + 3-4 legs each side, total span 5R+, no torso mass
// Role: predator · Mass: front (weapon) · Weapon: chelicerae fang
function drawT4(ctx:Ctx,cx:number,cy:number,R:number,n:number,f:string,g:string,A:number): void {
  const bp=BP(n),v=TV(n),dl=DL(n);
  const legLen=R*[1.32,1.55,1.12][v], nLeg=3+v; // legs per side
  // Helper: draw one leg (hip → knee → foot)
  const leg=(hx:number,hy:number,kx:number,ky:number,fx:number,fy:number)=>{
    mechleg(ctx,hx,hy,kx,ky,fx,fy,R*0.040,f,g,A);
  };
  if (bp===0) { // Orb-weaver spider — round bodies, 4 legs per side diagonal
    const abR=R*0.68, thR=R*0.42;
    // Abdomen (rear)
    fell(ctx,cx+R*0.72,cy,abR,abR*0.85,f,g,A,7);
    // Thorax (front-center)
    fell(ctx,cx-R*0.22,cy,thR,thR*0.80,f,g,A-0.04,5);
    // Chelicerae
    for (const s of [-1,1] as const) {
      fpoly(ctx,[[cx-thR-R*0.10,cy+s*thR*0.32],[cx-thR-R*0.55,cy+s*thR*0.62],[cx-thR-R*0.55,cy+s*thR*0.10],[cx-thR-R*0.14,cy+s*thR*0.04]],f,g,A-0.06,4);
    }
    stinger(ctx,cx-thR-R*0.55,cy,R*0.42,thR*0.18,f,g,A);
    // 4 legs per side (from thorax)
    const angles=[[-0.62,-0.88,-1.10,-1.40],[0.62,0.88,1.10,1.40]];
    for (const [sa,sign] of [[angles[0],-1],[angles[1],1]] as [number[],number][]) {
      for (let i=0;i<Math.min(nLeg,sa.length);i++) {
        const a=sa[i]; const kx=cx-R*0.22+Math.cos(a)*legLen*0.52, ky=cy+sign*R*0.22+Math.sin(Math.abs(a))*legLen*0.52;
        const fx=cx-R*0.22+Math.cos(a)*legLen, fy=cy+sign*R*0.22+Math.sin(Math.abs(a))*legLen;
        leg(cx-R*0.22+Math.cos(a)*thR*0.82,cy+sign*thR*0.55,kx,ky,fx,fy);
      }
    }
  } else if (bp===1) { // Horseshoe crab — dome shield + trailing tail + fringe legs
    const shR=R*0.95, shH=R*0.48;
    // Horseshoe carapace
    ctx.save(); ctx.globalAlpha=A; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=8;
    ctx.beginPath(); ctx.moveTo(cx-shR,cy+shH); ctx.lineTo(cx-shR,cy-shH*0.40);
    ctx.bezierCurveTo(cx-shR,cy-shH,cx-R*0.10,cy-shH,cx+shR*0.72,cy-shH*0.60);
    ctx.lineTo(cx+shR*0.72,cy+shH); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.16)'; ctx.lineWidth=0.85; ctx.stroke(); ctx.restore();
    // Telson (tail spine)
    fpoly(ctx,[[cx+shR*0.72,cy-shH*0.12],[cx+shR*0.72+R*1.30,cy],[cx+shR*0.72,cy+shH*0.12]],f,g,A-0.18,4);
    // Fringe legs under edge
    for (let i=0;i<5+v;i++) {
      const lx=cx-shR*0.60+i*shR*0.28, lLen=R*(0.38+nh(n,10+i)*0.22);
      sline(ctx,lx,cy+shH,lx+(nh(n,20+i)-0.50)*R*0.12,cy+shH+lLen,f,A-0.22,R*0.058);
      fcirc(ctx,lx+(nh(n,20+i)-0.50)*R*0.12,cy+shH+lLen,R*0.040,f,g,A-0.30);
    }
    stinger(ctx,cx-shR,cy,R*0.52,shH*0.28,f,g,A);
  } else if (bp===2) { // Scorpion — segments + curved tail overhead + claws
    // Segmented abdomen (3 segments)
    for (let i=0;i<3;i++) { const sx=cx+R*0.28+i*R*0.68, sR=R*(0.38-i*0.05); fell(ctx,sx,cy,sR,sR*0.72,f,g,A-i*0.04,6); }
    // Pedipalps (claws)
    for (const s of [-1,1] as const) {
      fpoly(ctx,[[cx-R*0.28,cy+s*R*0.20],[cx-R*0.80,cy+s*R*0.52],[cx-R*0.80,cy+s*R*0.14],[cx-R*0.42,cy+s*R*0.06]],f,g,A-0.06,4);
      fpoly(ctx,[[cx-R*0.28,cy+s*R*0.20],[cx-R*0.72,cy-s*R*0.02],[cx-R*0.68,cy-s*R*0.34],[cx-R*0.32,cy-s*R*0.28]],f,g,A-0.10,4);
    }
    // Curved tail (over body)
    const nT=4+v;
    for (let i=0;i<nT;i++) {
      const t=(i+1)/(nT+1);
      const tx=cx+R*1.40+t*R*0.60, ty=cy-t*t*R*1.30;
      fell(ctx,tx,ty,R*(0.22-t*0.06),R*(0.18-t*0.05),f,g,A-i*0.04,5);
    }
    stinger(ctx,cx+R*1.40+R*0.62,cy-R*1.30,-R*0.38,R*0.072,f,g,A); // tail stinger (modified)
    stinger(ctx,cx-R*0.80,cy,R*0.42,R*0.080,f,g,A); // front weapon
    // Walking legs (3 pairs)
    for (let i=0;i<3;i++) { for (const s of [-1,1] as const) { const lx=cx+R*0.18+i*R*0.55; mechleg(ctx,lx,cy+s*R*0.28,lx+s*R*0.22,cy+s*R*0.72,lx+s*R*0.10,cy+s*R*1.05,R*0.038,f,g,A); } }
  } else if (bp===3) { // HYBRID: Arachnid + Crystal — mineral exoskeleton + crystal legs
    const abR=R*0.68, thR=R*0.42;
    fell(ctx,cx+R*0.72,cy,abR,abR*0.85,f,g,A,7);
    fell(ctx,cx-R*0.22,cy,thR,thR*0.80,f,g,A-0.04,5);
    // Crystal legs instead of organic
    for (const [sa,sign] of [[[-0.62,-1.0,-1.38],-1],[[ 0.62,1.0,1.38],1]] as [number[],number][]) {
      for (let i=0;i<Math.min(nLeg,sa.length);i++) {
        cshard(ctx,cx-R*0.22+Math.cos(sa[i])*thR*0.82,cy+sign*thR*0.55,sa[i]+(sign>0?0:Math.PI),legLen,R*0.065,f,g,A-0.08);
      }
    }
    stinger(ctx,cx-thR-R*0.55,cy,R*0.45,thR*0.18,f,g,A);
  } else { // BP4 INNOVATION: Mantis shrimp — asymmetric: one massive raptorial appendage
    const mR=R*0.62;
    fell(ctx,cx+R*0.28,cy,mR,mR*0.68,f,g,A,7); // compact body
    // ONE massive raptorial forearm (left, offset above midline)
    fpoly(ctx,[[cx-R*0.25,cy-mR*0.28],[cx-R*1.55,cy-mR*0.88],[cx-R*1.75,cy-mR*0.42],[cx-R*0.90,cy+mR*0.05]],f,g,A+0.02,7);
    fcirc(ctx,cx-R*1.75,cy-mR*0.42,R*0.10,f,g,A-0.04); // knuckle joint
    // Small vestigial claws on other side (different scale)
    fpoly(ctx,[[cx-R*0.25,cy+mR*0.35],[cx-R*0.72,cy+mR*0.72],[cx-R*0.72,cy+mR*0.18],[cx-R*0.32,cy+mR*0.12]],f,g,A-0.16,3);
    // Tail fan
    for (const s of [-1,1,0] as const) fpoly(ctx,[[cx+mR,cy+s*mR*0.25],[cx+mR+R*0.48,cy+s*mR*0.62],[cx+mR+R*0.36,cy+s*mR*0.72]],f,g,A-0.22,3);
    stinger(ctx,cx-R*1.75,cy-mR*0.42,R*0.50,R*0.078,f,g,A);
  }
  // ── DL detail ──
  if (dl>=1) { // Knee joint circles already added in mechleg; add eye cluster
    for (const s of [-1,1] as const) fcirc(ctx,cx-R*0.22-R*0.12,cy+s*R*0.18,R*0.062,'rgba(255,255,255,0.78)',g,A-0.05);
  }
  if (dl>=2) { // Leg hair bristles (short stubs)
    ctx.save(); ctx.globalAlpha=A-0.32; ctx.strokeStyle=f; ctx.lineWidth=R*0.025;
    for (let i=0;i<4;i++) { const bx=cx+R*0.55+i*R*0.35; for (const s of [-1,1] as const) { ctx.beginPath(); ctx.moveTo(bx,cy+s*R*0.10); ctx.lineTo(bx+R*0.08,cy+s*R*0.18); ctx.stroke(); } }
    ctx.restore();
  }
  if (dl>=3) { // Spinnerets + egg sac
    fcirc(ctx,cx+legLen*0.90,cy,R*0.10,f,g,A-0.25); // spinneret
    fcirc(ctx,cx+legLen*0.90+R*0.14,cy,R*0.050,'rgba(255,255,255,0.38)',g,A-0.40); // silk thread start
  }
}

// ── T5  SERPENT ──────────────────────────────────────────
// Silhouette: S-curve or Z-curve CHAIN — no central body mass
// Role: serpentine · Mass: distributed · Weapon: fanged head at left
function drawT5(ctx:Ctx,cx:number,cy:number,R:number,n:number,f:string,g:string,A:number): void {
  const bp=BP(n),v=TV(n),dl=DL(n);
  const nSeg=[7,8,6][v];
  // Head position at left
  const headX=cx-R*2.40, headY=cy;
  if (bp===0) { // Viper — oval segments in S-curve, triangular head, rattle
    const amp=R*[0.58,0.70,0.46][v];
    for (let i=0;i<nSeg;i++) {
      const t=i/(nSeg-1);
      const sx=headX+t*(R*4.80), sy=headY+Math.sin(t*Math.PI*1.85)*amp*(1-t*0.35);
      const sr=R*(0.33-t*0.085+nh(n,10+i)*0.04);
      fell(ctx,sx,sy,sr,sr*0.82,f,g,A-i*0.030,6-i*0.4);
    }
    // Head (triangular + eyes)
    fpoly(ctx,[[headX-R*0.42,headY],[headX,headY-R*0.30],[headX+R*0.35,headY-R*0.10],[headX+R*0.35,headY+R*0.10],[headX,headY+R*0.30]],f,g,A+0.02,7);
    fcirc(ctx,headX-R*0.18,headY-R*0.14,R*0.068,'rgba(255,255,255,0.82)',g,A); fcirc(ctx,headX-R*0.18,headY-R*0.14,R*0.035,'#0a0f1a',g,1.0);
    stinger(ctx,headX-R*0.42,headY,R*0.48,R*0.068,f,g,A);
    // Rattle at tail
    const tx=headX+R*4.80, ty=headY+Math.sin(Math.PI*1.85)*amp*(1-0.65);
    for (let i=0;i<3;i++) fcirc(ctx,tx+i*R*0.12,ty,R*(0.095-i*0.015),f,g,A-0.20-i*0.08);
  } else if (bp===1) { // Millipede — straight horizontal row + paired legs on each segment
    const segW=R*0.38, totalL=R*4.60;
    for (let i=0;i<nSeg;i++) {
      const sx=headX+i*(totalL/(nSeg-1));
      fell(ctx,sx,cy,segW*(1-i*0.03),segW*0.62*(1-i*0.03),f,g,A-i*0.025,5);
      // Paired leg stubs
      for (const s of [-1,1] as const) {
        const lLen=R*(0.30+nh(n,30+i)*0.12);
        sline(ctx,sx,cy+s*segW*0.52,sx,cy+s*(segW*0.52+lLen),f,A-0.20,R*0.058);
        fcirc(ctx,sx,cy+s*(segW*0.52+lLen),R*0.035,f,g,A-0.28);
      }
    }
    stinger(ctx,headX,cy,R*0.48,segW*0.58,f,g,A);
  } else if (bp===2) { // Sea eel — smooth sinuous, paired fins on segments
    const amp=R*[0.62,0.78,0.48][v];
    for (let i=0;i<nSeg;i++) {
      const t=i/(nSeg-1);
      const sx=headX+t*R*4.60, sy=headY+Math.sin(t*Math.PI*2.0)*amp;
      const sr=R*(0.30-t*0.070);
      // Draw segment as ellipse
      const angle=Math.atan2(amp*Math.PI*2.0/(R*4.60)*Math.cos(t*Math.PI*2.0),1);
      ctx.save(); ctx.translate(sx,sy); ctx.rotate(angle);
      fell(ctx,0,0,sr*1.45,sr,f,g,A-i*0.025,5);
      // Fin (dorsal)
      fpoly(ctx,[[0,-sr],[sr*0.20,-sr-R*0.22],[sr*0.40,-sr]],f,g,A-0.16,3);
      ctx.restore();
    }
    stinger(ctx,headX,headY+Math.sin(0)*amp,R*0.42,R*0.065,f,g,A);
  } else if (bp===3) { // HYBRID: Front mechanical + rear organic snake — seam at center
    const amp=R*0.55; const seam=headX+R*2.30;
    for (let i=0;i<nSeg;i++) {
      const t=i/(nSeg-1);
      const sx=headX+t*R*4.60, sy=headY+Math.sin(t*Math.PI*1.85)*amp*(1-t*0.30);
      const sr=R*(0.33-t*0.080);
      if (sx<seam) { // mechanical segment
        const a=Math.atan2(amp*Math.PI*1.85/(R*4.60)*Math.cos(t*Math.PI*1.85),1);
        ctx.save(); ctx.translate(sx,sy); ctx.rotate(a);
        frect(ctx,-sr*1.40,-sr*0.72,sr*2.80,sr*1.44,f,g,A-i*0.020);
        ctx.restore();
      } else { // organic segment
        fell(ctx,sx,sy,sr*1.20,sr,f,g,A-i*0.028,5);
      }
    }
    // Seam mark
    sline(ctx,seam,cy-R*0.40,seam,cy+R*0.40,'rgba(255,255,255,0.50)',A-0.20,0.90);
    stinger(ctx,headX-R*0.42,headY,R*0.50,R*0.068,f,g,A); // mechanical fang
  } else { // BP4 INNOVATION: Knot — figure-8 tangle, breaks linear form
    const kR=R*[1.02,1.18,0.88][v];
    // Figure-8 lemniscate
    ctx.save(); ctx.globalAlpha=A; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=8;
    ctx.beginPath();
    for (let i=0;i<=120;i++) { const t=(i/120)*Math.PI*2; const den=1+0.62*Math.sin(t)*Math.sin(t); const px=cx+kR*0.80*Math.cos(t)/den, py=cy+kR*0.60*Math.sin(t)*Math.cos(t)/den; if (i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py); }
    ctx.fill(); ctx.strokeStyle='rgba(255,255,255,0.20)'; ctx.lineWidth=0.85; ctx.stroke(); ctx.restore();
    fcirc(ctx,cx,cy,kR*0.14,f,g,A+0.02);
    stinger(ctx,cx-kR*0.80,cy,R*0.42,R*0.065,f,g,A);
  }
  // ── DL detail ──
  if (dl>=1) { // Scale band lines
    ctx.save(); ctx.globalAlpha=A-0.28; ctx.strokeStyle='rgba(255,255,255,0.58)'; ctx.lineWidth=0.55;
    for (let i=0;i<6;i++) { const sx=headX+R*0.45+i*R*0.65; ctx.beginPath(); ctx.arc(sx,cy,R*0.28,Math.PI*0.40,Math.PI*1.60,false); ctx.stroke(); }
    ctx.restore();
  }
  if (dl>=2) { // Heat pits on head + fang detail
    for (const [px,py] of [[headX-R*0.05,headY-R*0.20],[headX-R*0.05,headY+R*0.20]]) fcirc(ctx,px,py,R*0.042,'rgba(255,255,255,0.60)',g,A-0.28);
  }
  if (dl>=3) { // Forked tongue
    sline(ctx,headX-R*0.42,headY,headX-R*0.62,headY-R*0.08,f,A-0.20,R*0.028);
    sline(ctx,headX-R*0.42,headY,headX-R*0.62,headY+R*0.08,f,A-0.20,R*0.028);
  }
}

// ── T6  MEDUSA ───────────────────────────────────────────
// Silhouette: BELL AT TOP + filaments hanging DOWN — inverted mass distribution
// Role: floater · Mass: top-heavy · Weapon: stinger at longest filament tip
function drawT6(ctx:Ctx,cx:number,cy:number,R:number,n:number,f:string,g:string,A:number): void {
  const bp=BP(n),v=TV(n),dl=DL(n);
  // Bell is ABOVE cy (top), filaments hang BELOW
  const bellCenter=cy-R*[0.62,0.72,0.52][v];
  const bellR=R*[0.78,0.88,0.68][v];
  if (bp===0) { // True jellyfish — hemispherical bell, 8 filaments hanging down
    // Bell
    ctx.save(); ctx.globalAlpha=A; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=9;
    ctx.beginPath(); ctx.arc(cx,bellCenter,bellR,Math.PI,0); ctx.closePath();
    ctx.fill(); ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,0.16)'; ctx.lineWidth=0.85; ctx.stroke(); ctx.restore();
    // Sub-umbrella fringe
    ctx.save(); ctx.globalAlpha=A-0.14; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=4;
    ctx.beginPath(); ctx.ellipse(cx,bellCenter,bellR*0.88,bellR*0.28,0,0,Math.PI); ctx.fill(); ctx.restore();
    // Oral arms (4 thick, wavy)
    for (let i=0;i<4;i++) { const ox=cx-bellR*0.65+i*bellR*0.44; const oLen=R*(0.55+nh(n,10+i)*0.28); oarm(ctx,ox,bellCenter,(ox+(nh(n,20+i)-0.5)*R*0.22),bellCenter+oLen,R*0.058,0,f,g,A-0.12); }
    // Trailing filaments (8, varying length)
    const nF=6+v*2;
    for (let i=0;i<nF;i++) {
      const fx=cx-bellR*0.82+i*(bellR*1.64/(nF-1));
      const fLen=R*(1.05+nh(n,30+i)*1.25);
      const curl=(nh(n,40+i)-0.5)*R*0.62;
      oarm(ctx,fx,bellCenter,fx+curl,bellCenter+fLen,R*0.022,0,f,g,A-0.22);
    }
    // Weapon = tip of leftmost long filament
    const weapX=cx-bellR*0.82, weapLen=R*2.10;
    stinger(ctx,weapX+(nh(n,40)-0.5)*R*0.62,bellCenter+weapLen,R*0.35,R*0.065,f,g,A);
    // Radial ribs inside bell
    ctx.save(); ctx.globalAlpha=A-0.28; ctx.strokeStyle='rgba(255,255,255,0.65)'; ctx.lineWidth=0.60;
    for (let i=0;i<6;i++) { const a=Math.PI*(1-i/5); ctx.beginPath(); ctx.moveTo(cx,bellCenter); ctx.lineTo(cx+Math.cos(a)*bellR*0.92,bellCenter+Math.sin(a)*bellR*0.92); ctx.stroke(); }
    ctx.restore();
  } else if (bp===1) { // Man-o-war — irregular gas float, colonial polyps below
    // Gas float (irregular elongated blob)
    oblob(ctx,cx+R*0.18,bellCenter,bellR*1.28,bellR*0.58,f,g,A,n,10);
    // Colonial polyps hanging below
    const nP=5+v;
    for (let i=0;i<nP;i++) {
      const px=cx-bellR*0.80+i*bellR*0.42;
      const pLen=R*(0.70+nh(n,30+i)*1.10);
      oarm(ctx,px,bellCenter+bellR*0.40,px+(nh(n,40+i)-0.5)*R*0.35,bellCenter+bellR*0.40+pLen,R*0.040,0,f,g,A-0.18);
      fcirc(ctx,px+(nh(n,40+i)-0.5)*R*0.35,bellCenter+bellR*0.40+pLen,R*0.060,f,g,A-0.26);
    }
    stinger(ctx,cx-bellR*1.18,bellCenter+bellR*0.35,R*0.38,R*0.062,f,g,A);
  } else if (bp===2) { // Box jellyfish — cubic bell, 4 corner filament clusters
    const bW=bellR*0.88, bH=bellR*0.78;
    frect(ctx,cx-bW,bellCenter-bH,bW*2,bH,f,g,A,8); // cubic bell
    // 4 rhopalium sensory structures
    for (const [rx,ry] of [[cx-bW*0.62,bellCenter],[cx+bW*0.62,bellCenter],[cx-bW*0.62,bellCenter-bH*0.50],[cx+bW*0.62,bellCenter-bH*0.50]]) fcirc(ctx,rx,ry,R*0.060,'rgba(255,255,255,0.72)',g,A-0.08);
    // Corner filament clusters
    for (const [fx,fy] of [[cx-bW,bellCenter],[cx+bW,bellCenter],[cx-bW*0.50,bellCenter],[cx+bW*0.50,bellCenter]]) {
      for (let t=0;t<3;t++) { oarm(ctx,fx,fy,fx+(nh(n,50+t)-0.5)*R*0.28,fy+R*(0.88+nh(n,60+t)*0.82),R*0.025,0,f,g,A-0.24); }
    }
    stinger(ctx,cx-bW,bellCenter+R*0.90,R*0.35,R*0.055,f,g,A);
  } else if (bp===3) { // HYBRID: Medusa + Energy — plasma bell, electric tendrils
    // Plasma-filled bell (glowing)
    ctx.save(); ctx.globalAlpha=A-0.08; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=12;
    ctx.beginPath(); ctx.arc(cx,bellCenter,bellR,Math.PI,0); ctx.closePath();
    ctx.fill(); ctx.restore();
    // Inner energy glow
    ctx.save(); ctx.globalAlpha=A-0.24; ctx.fillStyle='rgba(255,255,255,0.40)';
    ctx.beginPath(); ctx.arc(cx,bellCenter,bellR*0.55,Math.PI,0); ctx.closePath(); ctx.fill(); ctx.restore();
    // Electric arc tendrils (not organic curves — jagged etend)
    const nT=7+v;
    for (let i=0;i<nT;i++) {
      const tx=cx-bellR*0.88+i*(bellR*1.76/(nT-1));
      const tLen=R*(0.88+nh(n,10+i)*1.18);
      etend(ctx,tx,bellCenter,tx+(nh(n,20+i)-0.5)*R*0.45,bellCenter+tLen,f,g,A-0.18,n,30+i*3);
    }
    ebeam(ctx,cx-bellR*0.88,bellCenter+R*1.05,cx-bellR-R*0.72,bellCenter+R*0.72,f,g,A,R*0.050);
  } else { // BP4 INNOVATION: Siphonophore — no bell at all, just a long vertical chain
    const chainLen=R*[2.80,3.20,2.40][v];
    const nUnit=8+v*2;
    for (let i=0;i<nUnit;i++) {
      const t=i/nUnit;
      const uy=bellCenter-bellR*0.20+t*chainLen;
      const ux=cx+(nh(n,10+i)-0.5)*R*0.30;
      const ur=R*(0.14-t*0.006+nh(n,20+i)*0.04);
      fell(ctx,ux,uy,ur*2.50,ur,f,g,A-i*0.030,4);
      // Nectophore gas bells at intervals
      if (i%3===0) {
        ctx.save(); ctx.globalAlpha=A-0.20; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=5;
        ctx.beginPath(); ctx.arc(ux,uy,ur*2.80,Math.PI,0); ctx.closePath(); ctx.fill(); ctx.restore();
      }
      // Trailing dactylozooid
      oarm(ctx,ux,uy,ux+(nh(n,30+i)-0.5)*R*0.22,uy+R*(0.40+nh(n,40+i)*0.38),R*0.022,0,f,g,A-0.26);
    }
    stinger(ctx,cx-R*0.52,bellCenter,R*0.42,R*0.060,f,g,A);
  }
  // ── DL detail ──
  if (dl>=1) { // Additional fine filaments between main ones
    const nExtra=4+v;
    for (let i=0;i<nExtra;i++) {
      const fx=cx-bellR*0.70+i*bellR*0.46;
      oarm(ctx,fx,bellCenter,fx+(nh(n,70+i)-0.5)*R*0.18,bellCenter+R*(0.58+nh(n,80+i)*0.52),R*0.014,0,f,g,A-0.32);
    }
  }
  if (dl>=2) { // Radial canals visible through bell
    ctx.save(); ctx.globalAlpha=A-0.30; ctx.strokeStyle='rgba(255,255,255,0.55)'; ctx.lineWidth=0.55;
    for (let i=0;i<4;i++) { const a=Math.PI*(0.95+i*0.36); ctx.beginPath(); ctx.moveTo(cx,bellCenter); ctx.lineTo(cx+Math.cos(a)*bellR*0.80,bellCenter+Math.sin(a)*bellR*0.80); ctx.stroke(); }
    ctx.restore();
  }
  if (dl>=3) { // Individual nematocysts along edge
    for (let i=0;i<5;i++) { const a=Math.PI*(1.10+i*0.18); fcirc(ctx,cx+Math.cos(a)*bellR,bellCenter+Math.sin(a)*bellR,R*0.032,'rgba(255,255,255,0.60)',g,A-0.35); }
  }
}

// ── T7  DENDRITE ──────────────────────────────────────────
// Silhouette: BRANCHING from single base node — tree/coral shape
// Role: colonial · Mass: distributed · Weapon: leftmost branch tip
function drawT7(ctx:Ctx,cx:number,cy:number,R:number,n:number,f:string,g:string,A:number): void {
  const bp=BP(n),v=TV(n),dl=DL(n);
  const base:[number,number]=[cx+R*0.52,cy+R*0.28]; // base attachment point
  // Recursive branch helper
  const branch=(x0:number,y0:number,a:number,len:number,w:number,depth:number)=>{
    if (depth<=0||len<R*0.10) return;
    const x1=x0+Math.cos(a)*len, y1=y0+Math.sin(a)*len;
    sline(ctx,x0,y0,x1,y1,f,A-0.04*(3-depth),w*2);
    fcirc(ctx,x1,y1,w*1.40,f,g,A-0.08*(3-depth));
    if (depth>1) {
      branch(x1,y1,a-0.55+nh(n,depth*7+Math.floor(a*5))*0.40,len*0.68,w*0.72,depth-1);
      branch(x1,y1,a+0.48+nh(n,depth*11+Math.floor(a*5))*0.40,len*0.62,w*0.65,depth-1);
    }
  };
  if (bp===0) { // Staghorn coral — irregular thick branches
    const mainBranches=[[Math.PI*1.25,R*1.20,R*0.14],[Math.PI*0.88,R*1.05,R*0.12],[Math.PI*1.55,R*0.98,R*0.11],[Math.PI*1.78,R*0.88,R*0.10]];
    frect(ctx,base[0]-R*0.16,base[1]-R*0.12,R*0.32,R*0.24,f,g,A-0.06); // holdfast
    for (const [a,l,w] of mainBranches) branch(base[0],base[1],a,l,w,2);
    // Weapon = leftmost tip (branch index 0)
    const wx=base[0]+Math.cos(Math.PI*1.25)*R*1.20, wy=base[1]+Math.sin(Math.PI*1.25)*R*1.20;
    stinger(ctx,wx,wy,R*0.38,R*0.052,f,g,A);
  } else if (bp===1) { // Fan coral — flat 2D spread, mesh pattern
    const fanW=R*1.45, fanH=R*1.10;
    // Fan base
    fpoly(ctx,[[base[0]-R*0.14,base[1]],[base[0]-fanW*0.88,base[1]-fanH],[base[0]+fanW*0.52,base[1]-fanH],[base[0]+R*0.14,base[1]]],f,g,A-0.06,5);
    // Mesh lines
    ctx.save(); ctx.globalAlpha=A-0.22; ctx.strokeStyle='rgba(255,255,255,0.58)'; ctx.lineWidth=0.55;
    for (let i=1;i<=5;i++) { const fy=base[1]-i*fanH*0.18; ctx.beginPath(); ctx.moveTo(base[0]-fanW*0.88*(i/5.5),fy); ctx.lineTo(base[0]+fanW*0.52*(i/5.5),fy); ctx.stroke(); }
    for (let i=-2;i<=2;i++) { ctx.beginPath(); ctx.moveTo(base[0]+i*fanW*0.24,base[1]); ctx.lineTo(base[0]+i*fanW*0.24-fanW*0.22,base[1]-fanH); ctx.stroke(); }
    ctx.restore();
    stinger(ctx,base[0]-fanW*0.88,base[1]-fanH,R*0.38,R*0.048,f,g,A);
  } else if (bp===2) { // Feather star — 10 pinnate arms from central holdfast
    const nArm=7+v, armLen=R*1.10;
    fcirc(ctx,base[0],base[1]-R*0.08,R*0.22,f,g,A-0.04); // central disc
    for (let i=0;i<nArm;i++) {
      const a=Math.PI*(0.72+i*(Math.PI*0.96/(nArm-1)));
      const ax=base[0]+Math.cos(a)*armLen, ay=base[1]+Math.sin(a)*armLen;
      sline(ctx,base[0],base[1]-R*0.08,ax,ay,f,A-0.06,R*0.11);
      // Pinnules (side branches)
      for (let j=1;j<=3;j++) {
        const px=base[0]+Math.cos(a)*armLen*(j/4), py=base[1]-R*0.08+Math.sin(a)*armLen*(j/4);
        const pa=a+Math.PI*0.5, pLen=R*(0.24-j*0.02);
        sline(ctx,px,py,px+Math.cos(pa)*pLen,py+Math.sin(pa)*pLen,f,A-0.14,R*0.050);
        sline(ctx,px,py,px-Math.cos(pa)*pLen,py-Math.sin(pa)*pLen,f,A-0.14,R*0.050);
      }
    }
    stinger(ctx,base[0]+Math.cos(Math.PI*1.55)*armLen,base[1]+Math.sin(Math.PI*1.55)*armLen,R*0.38,R*0.048,f,g,A);
  } else if (bp===3) { // HYBRID: Mechano-dendrite — mechanical armature + organic polyps
    // Mechanical armature
    const arms=[Math.PI*1.20,Math.PI*0.85,Math.PI*1.55];
    for (const a of arms) {
      const l=R*(0.88+nh(n,Math.floor(a*10))*0.40);
      sline(ctx,base[0],base[1],base[0]+Math.cos(a)*l,base[1]+Math.sin(a)*l,f,A-0.04,R*0.12);
      fcirc(ctx,base[0]+Math.cos(a)*l,base[1]+Math.sin(a)*l,R*0.10,f,g,A-0.08); // terminal node
      // Secondary arm from each
      const sa=a-0.55+nh(n,Math.floor(a*20))*0.30;
      const sl=l*0.65;
      sline(ctx,base[0]+Math.cos(a)*l,base[1]+Math.sin(a)*l,base[0]+Math.cos(a)*l+Math.cos(sa)*sl,base[1]+Math.sin(a)*l+Math.sin(sa)*sl,f,A-0.12,R*0.085);
      // Organic polyp growths at joints
      for (let j=0;j<=2;j++) {
        const jx=base[0]+Math.cos(a)*l*(j/2), jy=base[1]+Math.sin(a)*l*(j/2);
        fcirc(ctx,jx,jy,R*(0.072+nh(n,j*10+Math.floor(a*5))*0.042),f,g,A-0.14);
      }
    }
    frect(ctx,base[0]-R*0.14,base[1]-R*0.10,R*0.28,R*0.20,f,g,A-0.04);
    stinger(ctx,base[0]+Math.cos(Math.PI*1.55)*R*0.88+Math.cos(Math.PI*1.0)*R*0.58,base[1]+Math.sin(Math.PI*1.55)*R*0.88+Math.sin(Math.PI*1.0)*R*0.58,R*0.38,R*0.048,f,g,A);
  } else { // BP4 INNOVATION: Radiolarian — spherical crystal lattice (breaks branching)
    const rR=R*[1.08,1.22,0.95][v];
    // Outer lattice sphere (polygon approximation)
    ctx.save(); ctx.globalAlpha=A-0.10; ctx.strokeStyle=f; ctx.lineWidth=R*0.08; ctx.shadowColor=g; ctx.shadowBlur=7;
    ctx.beginPath(); for (let i=0;i<12;i++) { const a=(i/12)*Math.PI*2; if (i===0) ctx.moveTo(cx+rR*Math.cos(a),cy+rR*Math.sin(a)); else ctx.lineTo(cx+rR*Math.cos(a),cy+rR*Math.sin(a)); } ctx.closePath(); ctx.stroke(); ctx.restore();
    // Internal struts (icosahedron-like)
    for (let i=0;i<6;i++) { const a=(i/6)*Math.PI*2; sline(ctx,cx,cy,cx+rR*Math.cos(a),cy+rR*Math.sin(a),f,A-0.18,R*0.055); }
    fcirc(ctx,cx,cy,rR*0.22,f,g,A+0.02);
    // Spine radii
    for (let i=0;i<8;i++) { const a=(i/8)*Math.PI*2; cshard(ctx,cx+rR*Math.cos(a),cy+rR*Math.sin(a),a,R*0.35,R*0.040,f,g,A-0.14); }
    ebeam(ctx,cx-rR,cy,cx-rR-R*0.90,cy,f,g,A,R*0.050);
  }
  // ── DL detail ──
  if (dl>=1) { // Secondary polyp dots along branches
    for (let i=0;i<6;i++) { const a=Math.PI*(1.05+i*0.22); fcirc(ctx,base[0]+Math.cos(a)*R*(0.40+i*0.12),base[1]+Math.sin(a)*R*(0.40+i*0.12),R*0.038,f,g,A-0.28); }
  }
  if (dl>=2) { // Interconnection filaments
    ctx.save(); ctx.globalAlpha=A-0.38; ctx.strokeStyle=f; ctx.lineWidth=R*0.025;
    for (let i=0;i<4;i++) { const a1=Math.PI*(1.15+i*0.24), a2=Math.PI*(1.32+i*0.24), r=R*0.78; ctx.beginPath(); ctx.moveTo(base[0]+Math.cos(a1)*r,base[1]+Math.sin(a1)*r); ctx.lineTo(base[0]+Math.cos(a2)*r,base[1]+Math.sin(a2)*r); ctx.stroke(); }
    ctx.restore();
  }
  if (dl>=3) { // Spawning gamete dots
    for (let i=0;i<5;i++) { fcirc(ctx,base[0]+Math.cos(Math.PI*1.15+nh(n,90+i))*R*(0.55+nh(n,100+i)*0.38),base[1]+Math.sin(Math.PI*1.15+nh(n,90+i))*R*(0.55+nh(n,100+i)*0.38)+R*(0.05+nh(n,110+i)*0.08),R*0.022,'rgba(255,255,255,0.55)',g,A-0.40); }
  }
}

// ── T8  POLYHEDRON ───────────────────────────────────────
// Silhouette: PURELY ANGULAR — only straight edges, no curves at all
// Role: geometric · Mass: center · Weapon: one face opens to fire
function drawT8(ctx:Ctx,cx:number,cy:number,R:number,n:number,f:string,g:string,A:number): void {
  const bp=BP(n),v=TV(n),dl=DL(n);
  // Utility: draw a polygon with straight edges only (no bezier)
  const poly=(pts:P2[],alpha=A)=>{
    fpoly(ctx,pts,f,g,alpha,6);
    // Facet highlight (top faces are lighter)
    if (pts.length>=3) {
      const topHalf=pts.filter(p=>p[1]<cy);
      if (topHalf.length>=2) {
        ctx.save(); ctx.globalAlpha=alpha-0.28; ctx.fillStyle='rgba(255,255,255,0.28)';
        ctx.beginPath(); ctx.moveTo(topHalf[0][0],topHalf[0][1]);
        for (let i=1;i<topHalf.length;i++) ctx.lineTo(topHalf[i][0],topHalf[i][1]);
        ctx.closePath(); ctx.fill(); ctx.restore();
      }
    }
  };
  if (bp===0) { // Hexagonal prism (viewed from slight angle)
    const R6=R*[1.08,1.18,0.95][v];
    const pts6:P2[]=[];
    for (let i=0;i<6;i++) { const a=(i/6)*Math.PI*2-Math.PI/6; pts6.push([cx+R6*Math.cos(a),cy+R6*Math.sin(a)]); }
    poly(pts6);
    // Facet lines
    ctx.save(); ctx.globalAlpha=A-0.26; ctx.strokeStyle='rgba(255,255,255,0.65)'; ctx.lineWidth=0.6;
    for (let i=0;i<6;i++) { ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(pts6[i][0],pts6[i][1]); ctx.stroke(); }
    ctx.restore();
    // Weapon face (leftmost)
    const leftPt=pts6.reduce((m,p)=>p[0]<m[0]?p:m,pts6[0]);
    fpoly(ctx,[[leftPt[0],leftPt[1]-R*0.10],[leftPt[0]-R*0.72,leftPt[1]],[leftPt[0],leftPt[1]+R*0.10]],f,g,A+0.04,7);
  } else if (bp===1) { // Rhombohedron — 4 rhombus faces, taller than wide
    const RW=R*[0.78,0.88,0.68][v], RH=R*[1.22,1.35,1.08][v];
    const pts:P2[]=[[cx,cy-RH],[cx+RW,cy-RH*0.35],[cx+RW,cy+RH*0.35],[cx,cy+RH],[cx-RW,cy+RH*0.35],[cx-RW,cy-RH*0.35]];
    poly(pts);
    // Internal diamond seams
    ctx.save(); ctx.globalAlpha=A-0.24; ctx.strokeStyle='rgba(255,255,255,0.62)'; ctx.lineWidth=0.55;
    ctx.beginPath(); ctx.moveTo(cx-RW,cy-RH*0.35); ctx.lineTo(cx,cy); ctx.lineTo(cx+RW,cy-RH*0.35); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx-RW,cy+RH*0.35); ctx.lineTo(cx,cy); ctx.lineTo(cx+RW,cy+RH*0.35); ctx.stroke();
    ctx.restore();
    fpoly(ctx,[[cx-RW,cy-RH*0.18],[cx-RW-R*0.72,cy],[cx-RW,cy+RH*0.18]],f,g,A+0.02,7);
  } else if (bp===2) { // Fractured shard — irregular jagged 9-sided polygon
    const nSide=8+nhi(n,5,3);
    const pts:P2[]=[];
    for (let i=0;i<nSide;i++) {
      const a=(i/nSide)*Math.PI*2-Math.PI*0.10;
      const r=R*(0.72+nh(n,10+i)*0.52);
      pts.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r]);
    }
    poly(pts);
    // Fracture lines
    ctx.save(); ctx.globalAlpha=A-0.20; ctx.strokeStyle='rgba(255,255,255,0.70)'; ctx.lineWidth=0.65;
    for (let i=0;i<3;i++) { const fa=Math.PI*(0.80+i*0.55); ctx.beginPath(); ctx.moveTo(cx+Math.cos(fa)*R*0.20,cy+Math.sin(fa)*R*0.20); ctx.lineTo(cx+Math.cos(fa)*R*(0.68+nh(n,50+i)*0.32),cy+Math.sin(fa)*R*(0.68+nh(n,50+i)*0.32)); ctx.stroke(); }
    ctx.restore();
    const leftX=Math.min(...pts.map(p=>p[0])), leftPts=pts.filter(p=>p[0]===leftX);
    const leftY=leftPts.length?leftPts[0][1]:cy;
    fpoly(ctx,[[leftX,leftY-R*0.09],[leftX-R*0.62,leftY],[leftX,leftY+R*0.09]],f,g,A+0.02,7);
  } else if (bp===3) { // HYBRID: Plasma-crystal — polyhedron with energy inside
    const R6=R*[1.05,1.18,0.92][v];
    const pts6:P2[]=[];
    for (let i=0;i<6;i++) { const a=(i/6)*Math.PI*2-Math.PI/6; pts6.push([cx+R6*Math.cos(a),cy+R6*Math.sin(a)]); }
    poly(pts6,A-0.08);
    // Energy interior glow (partial transparency effect)
    ctx.save(); ctx.globalAlpha=A-0.38; ctx.fillStyle='rgba(255,255,255,0.20)';
    ctx.beginPath(); ctx.moveTo(pts6[0][0],pts6[0][1]); for (let i=1;i<6;i++) ctx.lineTo(pts6[i][0],pts6[i][1]); ctx.closePath(); ctx.fill(); ctx.restore();
    // Energy arcs inside
    for (let i=0;i<4;i++) etend(ctx,cx+(nh(n,10+i)-0.5)*R*0.55,cy+(nh(n,20+i)-0.5)*R*0.55,cx+Math.cos((i/4)*Math.PI*2)*R6*0.82,cy+Math.sin((i/4)*Math.PI*2)*R6*0.82,f,g,A-0.24,n,30+i*3);
    fcirc(ctx,cx,cy,R*0.18,f,g,A+0.04);
    ebeam(ctx,pts6[3][0],pts6[3][1],pts6[3][0]-R*0.88,pts6[3][1],f,g,A,R*0.055);
  } else { // BP4 INNOVATION: Penrose tiling — aperiodic 5-fold, breaks regular polygon
    const pR=R*[1.08,1.20,0.95][v];
    // 5-fold Penrose-inspired shape (kite + dart tiles)
    const phi=1.618; const ang=Math.PI*2/5;
    for (let i=0;i<5;i++) {
      const a=i*ang-Math.PI*0.10;
      const p0:[number,number]=[cx,cy];
      const p1:[number,number]=[cx+pR*Math.cos(a),cy+pR*Math.sin(a)];
      const p2:[number,number]=[cx+pR/phi*Math.cos(a+ang),cy+pR/phi*Math.sin(a+ang)];
      const p3:[number,number]=[cx+pR*Math.cos(a+ang),cy+pR*Math.sin(a+ang)];
      fpoly(ctx,[p0,p1,p2],f,g,A-i*0.04,5); // kite
      fpoly(ctx,[p2,p1,p3],'rgba(255,255,255,0.22)',g,A-0.28-i*0.03,2); // dart highlight
    }
    fcirc(ctx,cx,cy,pR*0.18,f,g,A+0.04);
    // Weapon from leftmost vertex
    const leftV=[cx-pR,cy];
    fpoly(ctx,[[leftV[0],leftV[1]-R*0.09],[leftV[0]-R*0.72,leftV[1]],[leftV[0],leftV[1]+R*0.09]],f,g,A+0.02,7);
  }
  // ── DL detail ──
  if (dl>=1) { // Face highlights already handled inside poly(); add corner dots
    ctx.save(); ctx.globalAlpha=A-0.32; ctx.strokeStyle='rgba(255,255,255,0.70)'; ctx.lineWidth=0.55;
    for (let i=0;i<6;i++) { const a=(i/6)*Math.PI*2-Math.PI/6; ctx.beginPath(); ctx.arc(cx+R*[1.08,1.18,0.95][v]*Math.cos(a),cy+R*[1.08,1.18,0.95][v]*Math.sin(a),R*0.048,0,Math.PI*2); ctx.stroke(); }
    ctx.restore();
  }
  if (dl>=2) { // Internal lattice structure lines
    ctx.save(); ctx.globalAlpha=A-0.26; ctx.strokeStyle='rgba(255,255,255,0.58)'; ctx.lineWidth=0.55;
    for (let i=0;i<3;i++) { const a1=Math.PI*0.65+i*0.90, a2=a1+Math.PI; ctx.beginPath(); ctx.moveTo(cx+R*0.32*Math.cos(a1),cy+R*0.32*Math.sin(a1)); ctx.lineTo(cx+R*0.32*Math.cos(a2),cy+R*0.32*Math.sin(a2)); ctx.stroke(); }
    ctx.restore();
  }
  if (dl>=3) { // Crystal growth on vertices
    for (let i=0;i<3;i++) { const a=Math.PI*(0.90+i*0.55); cshard(ctx,cx+R*[1.08,1.18,0.95][v]*Math.cos(a),cy+R*[1.08,1.18,0.95][v]*Math.sin(a),a,R*0.28,R*0.038,f,g,A-0.16); }
  }
}

// ── T9  SWARM ────────────────────────────────────────────
// Silhouette: 20-60 INDIVIDUAL UNITS — no solid central body
// Role: swarm · Mass: distributed · Weapon: leading edge concentration
function drawT9(ctx:Ctx,cx:number,cy:number,R:number,n:number,f:string,g:string,A:number): void {
  const bp=BP(n),v=TV(n),dl=DL(n);
  const swW=R*[1.62,1.80,1.42][v], swH=R*[0.88,1.02,0.75][v];
  const nUnit=[32,28,38][v];
  // Unit type based on DL: all same at DL0, differentiated at DL1+
  const unitR=(i:number,t:number)=>{
    const base=R*(0.045+t*0.040+nh(n,200+i)*0.028);
    return dl>=1?(i%5===0?base*1.90:i%3===0?base*1.40:base):base;
  };
  if (bp===0) { // Cloud — loose oval distribution
    const positions:[[number,number],number][]=[];
    for (let i=0;i<nUnit;i++) {
      const a=(i/nUnit)*Math.PI*2+nh(n,100+i)*0.95;
      const r=Math.sqrt(nh(n,200+i));
      const px=cx+Math.cos(a)*swW*r, py=cy+Math.sin(a)*swH*r;
      const t=1-(px-cx+swW)/(swW*2);
      positions.push([[px,py],t]);
    }
    // Draw connections at DL1+
    if (dl>=1) {
      ctx.save(); ctx.globalAlpha=A-0.44; ctx.strokeStyle=f; ctx.lineWidth=R*0.018;
      for (let i=0;i<nUnit;i++) { const ni=(i+1)%nUnit; const dx=positions[ni][0][0]-positions[i][0][0],dy=positions[ni][0][1]-positions[i][0][1]; if (dx*dx+dy*dy<(R*0.85)*(R*0.85)) { ctx.beginPath(); ctx.moveTo(positions[i][0][0],positions[i][0][1]); ctx.lineTo(positions[ni][0][0],positions[ni][0][1]); ctx.stroke(); } }
      ctx.restore();
    }
    for (let i=0;i<positions.length;i++) { const [[px,py],t]=positions[i]; fcirc(ctx,px,py,unitR(i,t),f,g,A-0.06-nh(n,300+i)*0.24); }
    // Leading edge weapon emphasis
    const leadX=cx-swW*0.78;
    for (let i=0;i<4+v;i++) { const lx=leadX+nh(n,500+i)*R*0.28-R*0.14, ly=cy+(nh(n,600+i)-0.5)*R*0.30; fcirc(ctx,lx,ly,R*(0.082+nh(n,700+i)*0.042),f,g,A-0.02); }
  } else if (bp===1) { // Column — narrow forward-moving column
    const nRow=Math.ceil(nUnit/3), colW=swH*0.42;
    for (let i=0;i<nUnit;i++) {
      const row=Math.floor(i/3), col=i%3;
      const px=cx+swW*0.72-row*(swW*1.44/nRow);
      const py=cy+(col-1)*colW*0.82+(nh(n,100+i)-0.5)*colW*0.28;
      const t=1-(px-cx+swW)/(swW*2);
      fcirc(ctx,px,py,unitR(i,t),f,g,A-0.06-nh(n,200+i)*0.20);
    }
  } else if (bp===2) { // Ring formation — units in a circle, weapon fires through gap
    const ringR=swW*0.78;
    const gapA=Math.PI; // gap on left (weapon fires through)
    for (let i=0;i<nUnit;i++) {
      const a=(i/nUnit)*Math.PI*2*0.88+Math.PI*0.05; // 88% of circle, gap at ~PI
      const px=cx+Math.cos(a)*ringR+(nh(n,100+i)-0.5)*R*0.10;
      const py=cy+Math.sin(a)*ringR*(swH/swW)+(nh(n,200+i)-0.5)*R*0.10;
      fcirc(ctx,px,py,unitR(i,0.5),f,g,A-0.06-nh(n,300+i)*0.16);
    }
    // Weapon fires through the gap
    stinger(ctx,cx-ringR,cy,R*0.42,R*0.065,f,g,A);
  } else if (bp===3) { // HYBRID: Crystal-swarm — triangular crystal shard units
    for (let i=0;i<nUnit;i++) {
      const a=(i/nUnit)*Math.PI*2+nh(n,100+i)*0.92;
      const r=Math.sqrt(nh(n,200+i))*swW;
      const px=cx+Math.cos(a)*r, py=cy+Math.sin(a)*(swH/swW)*r;
      const sa=nh(n,300+i)*Math.PI*2;
      cshard(ctx,px,py,sa,R*(0.075+nh(n,400+i)*0.055),R*(0.028+nh(n,500+i)*0.018),f,g,A-0.10-nh(n,600+i)*0.22);
    }
    stinger(ctx,cx-swW*0.75,cy,R*0.42,R*0.060,f,g,A);
  } else { // BP4 INNOVATION: Fractal swarm — hierarchical 3-tier grouping
    const leaders=3, followers=4, micro=3;
    for (let l=0;l<leaders;l++) {
      const la=(l/leaders)*Math.PI*2+Math.PI*0.88; const lr=swW*0.72;
      const lx=cx+Math.cos(la)*lr, ly=cy+Math.sin(la)*swH/swW*lr;
      fcirc(ctx,lx,ly,R*0.12,f,g,A-0.04); // leader (large)
      for (let m=0;m<followers;m++) {
        const ma=la+(m/followers)*Math.PI*2*0.38-Math.PI*0.19; const mr=R*0.42;
        const mx=lx+Math.cos(ma)*mr, my=ly+Math.sin(ma)*mr;
        fcirc(ctx,mx,my,R*0.068,f,g,A-0.12); // mid
        for (let s=0;s<micro;s++) {
          const sa=ma+(s/micro)*Math.PI*2*0.28; const sr=R*0.20;
          fcirc(ctx,mx+Math.cos(sa)*sr,my+Math.sin(sa)*sr,R*0.038,f,g,A-0.22); // small
        }
      }
    }
    const leadPt=[cx+Math.cos(Math.PI*0.88)*swW*0.72,cy+Math.sin(Math.PI*0.88)*swH/swW*swW*0.72];
    stinger(ctx,leadPt[0],leadPt[1],R*0.42,R*0.055,f,g,A);
  }
  // ── DL detail ──
  if (dl>=2) { // Pheromone trail dots from front leader to next row
    ctx.save(); ctx.globalAlpha=A-0.40; ctx.setLineDash([R*0.05,R*0.09]);
    ctx.strokeStyle=f; ctx.lineWidth=R*0.020;
    ctx.beginPath(); ctx.moveTo(cx-swW*0.78,cy); ctx.lineTo(cx-swW*0.35,cy); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
  }
  if (dl>=3) { // Compound eye dots on scout units (largest units)
    for (let i=0;i<3;i++) {
      const a=Math.PI*0.92+i*Math.PI*0.22; const r=swW*0.45;
      const ux=cx+Math.cos(a)*r, uy=cy+Math.sin(a)*swH/swW*r;
      fcirc(ctx,ux+R*0.04,uy-R*0.04,R*0.022,'rgba(255,255,255,0.75)',g,A-0.28);
    }
  }
}

// ── T10  STRIDER ─────────────────────────────────────────
// Silhouette: ARTICULATED WALKER — visible joints, limb-torso-limb form
// Role: walker · Mass: center · Weapon: shoulder or arm-mounted
function drawT10(ctx:Ctx,cx:number,cy:number,R:number,n:number,f:string,g:string,A:number): void {
  const bp=BP(n),v=TV(n),dl=DL(n);
  const tH=R*[0.52,0.58,0.44][v]; // torso half-height
  const tW=R*[0.38,0.44,0.32][v]; // torso half-width
  if (bp===0) { // Quadruped — 4 articulated legs, armored torso, shoulder gun
    // Torso
    fpoly(ctx,[[cx-tW,cy-tH],[cx+tW,cy-tH],[cx+tW*1.35,cy-tH*0.48],[cx+tW*1.35,cy+tH*0.48],[cx+tW,cy+tH],[cx-tW,cy+tH]],f,g,A,7);
    // 4 legs (hip→knee→foot)
    for (const [s,sx,dir] of [[-1,-1,1],[-1,1,-1],[1,-1,1],[1,1,-1]] as [number,number,number][]) {
      const hipX=cx+s*tW*0.68, hipY=cy+s*tH*0.88;
      const kneeX=hipX+dir*R*0.55, kneeY=hipY+R*0.68;
      const footX=kneeX+dir*R*0.22, footY=kneeY+R*0.58;
      mechleg(ctx,hipX,hipY,kneeX,kneeY,footX,footY,R*0.048,f,g,A);
    }
    // Shoulder gun
    turret(ctx,cx-tW*0.25,cy-tH,R,f,g,A);
    // Head sensor cluster
    fell(ctx,cx-tW*0.88,cy-tH*0.30,tW*0.58,tH*0.42,f,g,A-0.06,5);
    fcirc(ctx,cx-tW*0.88-tW*0.32,cy-tH*0.30,tH*0.20,'rgba(255,255,255,0.78)',g,A-0.02);
  } else if (bp===1) { // Biped — 2 long legs, upper body with arm-mounted gun
    // Torso + head
    frect(ctx,cx-tW,cy-tH*1.28,tW*2,tH*1.28,f,g,A,7);
    fell(ctx,cx-tW*0.28,cy-tH*1.52,tH*0.72,tH*0.62,f,g,A-0.04,5);
    fcirc(ctx,cx-tW*0.50,cy-tH*1.60,tH*0.22,'rgba(255,255,255,0.80)',g,A-0.02); // eye
    // Gun arm (left)
    frect(ctx,cx-tW-R*0.55,cy-tH*0.90,R*0.55,tH*0.28,f,g,A-0.04);
    gun(ctx,cx-tW-R*0.55,cy-tH*0.76,R*0.80,R*0.065,f,g,A);
    // 2 legs
    for (const s of [-1,1] as const) {
      const hipX=cx+s*tW*0.60, hipY=cy;
      const kneeX=hipX+s*R*0.28, kneeY=hipY+R*0.82;
      const footX=hipX+s*R*0.08, footY=kneeY+R*0.72;
      mechleg(ctx,hipX,hipY,kneeX,kneeY,footX,footY,R*0.058,f,g,A);
    }
  } else if (bp===2) { // Spider-tank — 8 mechanical legs in X pattern, top weapon pod
    // Central weapon pod
    fell(ctx,cx,cy-tH*0.28,tW*1.35,tH*0.88,f,g,A,7);
    turret(ctx,cx-tW*0.22,cy-tH,R,f,g,A);
    // 8 legs (4 each side, fanning out)
    const legAngles=[Math.PI*0.38,Math.PI*0.58,Math.PI*0.80,Math.PI*1.02];
    for (const [a,sign] of [[legAngles,1],[legAngles.map(x=>Math.PI*2-x),-1]] as [number[],number][]) {
      for (const la of a) {
        const hipX=cx+Math.cos(la)*tW*1.10, hipY=cy+sign*Math.sin(la)*tH*0.62;
        const kneeX=hipX+Math.cos(la)*R*0.72, kneeY=hipY+sign*R*0.50;
        const footX=kneeX+Math.cos(la)*R*0.58, footY=kneeY+sign*R*0.68;
        mechleg(ctx,hipX,hipY,kneeX,kneeY,footX,footY,R*0.038,f,g,A);
      }
    }
  } else if (bp===3) { // HYBRID: Flesh-walker — mech skeleton + organic muscle tissue
    // Mechanical skeleton legs (visible structure)
    for (const s of [-1,1] as const) {
      const hipX=cx+s*tW*0.62, hipY=cy+tH*0.90;
      const kneeX=hipX+s*R*0.45, kneeY=hipY+R*0.72;
      const footX=kneeX+s*R*0.18, footY=kneeY+R*0.62;
      mechleg(ctx,hipX,hipY,kneeX,kneeY,footX,footY,R*0.048,f,g,A);
    }
    // Organic muscle mass over torso
    oblob(ctx,cx,cy,tW*1.30,tH*1.18,f,g,A,n,10);
    turret(ctx,cx-tW*0.25,cy-tH,R,f,g,A);
    fell(ctx,cx-tW*0.88,cy-tH*0.30,tW*0.60,tH*0.40,f,g,A-0.06,5);
  } else { // BP4 INNOVATION: Gyro-walker — monostrut leg + gyroscopic ring
    // Single central leg (monostrut)
    frect(ctx,cx-R*0.065,cy+tH*0.88,R*0.13,R*1.10,f,g,A,7);
    fcirc(ctx,cx,cy+tH*0.88+R*1.10,R*0.22,f,g,A-0.10); // foot pad
    // Gyroscopic ring (body)
    sarc(ctx,cx,cy,tH*1.55,0,Math.PI*2,f,A-0.08,R*0.16,7);
    sarc(ctx,cx,cy,tH*1.55*0.68,0,Math.PI*2,f,A-0.14,R*0.090,4);
    // Inner body sphere
    fcirc(ctx,cx,cy,tH*0.55,f,g,A-0.04,7);
    gun(ctx,cx-tH*1.55,cy,R*0.88,R*0.065,f,g,A);
  }
  // ── DL detail ──
  if (dl>=1) { // Hip/shoulder socket details (extra circles at joints)
    for (const s of [-1,1] as const) fcirc(ctx,cx+s*tW*0.62,cy+tH*0.88,R*0.082,f,g,A-0.18);
  }
  if (dl>=2) { // Hydraulic piston visible on each leg
    ctx.save(); ctx.globalAlpha=A-0.24; ctx.strokeStyle='rgba(255,255,255,0.65)'; ctx.lineWidth=0.62;
    for (const s of [-1,1] as const) {
      const x0=cx+s*tW*0.68, y0=cy+tH*0.92, x1=cx+s*(tW*0.68+R*0.42), y1=y0+R*0.62;
      ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke();
    }
    ctx.restore();
    // Cockpit viewport on torso
    sarc(ctx,cx+tW*0.58,cy-tH*0.52,R*0.12,0,Math.PI*2,'rgba(255,255,255,0.55)',A-0.28,0.62);
  }
  if (dl>=3) { // Exhaust pipes + cable routing
    for (const s of [-1,1] as const) { frect(ctx,cx+s*tW*0.78,cy-tH*1.00,R*0.068,R*0.32,f,g,A-0.22); fcirc(ctx,cx+s*tW*0.78+R*0.034,cy-tH*1.00,R*0.048,f,g,A-0.30); }
    bolts(ctx,cx-tW*0.88,cy-tH*0.96,cx+tW*1.28,f,g,A,R*0.22);
  }
}

// ── T11  PLATFORM ────────────────────────────────────────
// Silhouette: ultra-wide (≥4R) × ultra-flat (≤0.50R) — extreme aspect ratio
// Role: platform · Mass: rear-center · Weapon: front-edge battery
function drawT11(ctx:Ctx,cx:number,cy:number,R:number,n:number,f:string,g:string,A:number): void {
  const bp=BP(n),v=TV(n),dl=DL(n);
  const PW=R*[4.40,4.80,4.00][v]; // platform half-width
  const PH=R*[0.28,0.32,0.24][v]; // platform half-height
  if (bp===0) { // Carrier deck — flat slab, 3 sub-units on deck, front gun
    // Main slab
    fpoly(ctx,[[cx-PW,cy-PH],[cx+PW,cy-PH],[cx+PW*0.90,cy+PH],[cx-PW,cy+PH]],f,g,A,7);
    // Island superstructure (offset to rear)
    frect(ctx,cx+PW*0.32,cy-PH-R*0.55,R*0.72,R*0.55,f,g,A+0.04);
    // Sub-unit silhouettes on deck (3)
    for (const [ux,uW] of [[cx-PW*0.55,R*0.38],[cx-PW*0.10,R*0.28],[cx+PW*0.12,R*0.32]]) {
      frect(ctx,ux-uW,cy-PH-R*0.24,uW*2,R*0.24,f,g,A-0.14);
    }
    // Front gun battery
    gun(ctx,cx-PW,cy-PH*0.20,R*0.92,R*0.062,f,g,A);
    gun(ctx,cx-PW,cy+PH*0.22,R*0.72,R*0.050,f,g,A);
  } else if (bp===1) { // Gun barge — slab with full weapon battery across front
    fpoly(ctx,[[cx-PW,cy-PH],[cx+PW,cy-PH],[cx+PW*0.90,cy+PH],[cx-PW,cy+PH]],f,g,A,7);
    // 5-gun battery at front
    for (let i=0;i<5;i++) {
      const gy=cy-PH+(i-(4/2))*PH*0.44;
      const gl=[R*1.10,R*0.88,R*1.00,R*0.88,R*1.10][i];
      gun(ctx,cx-PW,gy,gl,R*[0.058,0.048,0.052,0.048,0.058][i],f,g,A);
    }
    frect(ctx,cx+PW*0.35,cy-PH-R*0.32,R*0.55,R*0.32,f,g,A+0.02);
  } else if (bp===2) { // Hive-mother — slab with organic pod structures on top
    fpoly(ctx,[[cx-PW,cy-PH],[cx+PW,cy-PH],[cx+PW*0.90,cy+PH],[cx-PW,cy+PH]],f,g,A-0.04,7);
    // Organic pods on deck surface
    for (let i=0;i<4+v;i++) {
      const px=cx-PW*0.75+i*PW*0.40, pW=R*(0.28+nh(n,10+i)*0.14), pH=R*(0.32+nh(n,20+i)*0.18);
      ctx.save(); ctx.globalAlpha=A-0.06; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=5;
      ctx.beginPath(); ctx.moveTo(px-pW,cy-PH); ctx.bezierCurveTo(px-pW,cy-PH-pH*1.5,px+pW,cy-PH-pH*1.5,px+pW,cy-PH); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    stinger(ctx,cx-PW,cy,R*0.50,PH*0.80,f,g,A);
  } else if (bp===3) { // HYBRID: Mech-platform + Bio-bays — slab with organic launch bays
    fpoly(ctx,[[cx-PW,cy-PH],[cx+PW,cy-PH],[cx+PW*0.90,cy+PH],[cx-PW,cy+PH]],f,g,A-0.04,7);
    // Mechanical front structure
    frect(ctx,cx-PW,cy-PH-R*0.18,PW*0.45,R*0.18,f,g,A+0.02);
    // Organic bio-bays (bulging launch tubes) on rear portion
    for (let i=0;i<3;i++) {
      const bx=cx+PW*0.12+i*PW*0.36;
      ctx.save(); ctx.globalAlpha=A-0.10; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=4;
      ctx.beginPath(); ctx.ellipse(bx,cy-PH,R*0.22,R*0.40,0,Math.PI,0); ctx.fill(); ctx.restore();
      rtend(ctx,bx,cy+PH,Math.PI*0.5,R*0.28,R*0.055,f,g,A-0.26,n,10+i*4);
    }
    gun(ctx,cx-PW,cy-PH*0.20,R*0.88,R*0.058,f,g,A);
  } else { // BP4 INNOVATION: Inverted platform — upside down, anti-grav field below
    // Same wide slab but upside-down orientation suggestion (weapons hang from bottom)
    fpoly(ctx,[[cx-PW,cy+PH],[cx+PW,cy+PH],[cx+PW*0.90,cy-PH],[cx-PW,cy-PH]],f,g,A,7);
    // Anti-grav rings visible below
    for (let i=0;i<4;i++) { const gx=cx-PW*0.72+i*PW*0.48; sarc(ctx,gx,cy+PH+R*0.22,R*0.22,0,Math.PI*2,f,A-0.22,R*0.065,8); }
    // Downward-facing weapons (from bottom surface)
    for (const gy of [cy+PH*0.18,cy+PH*0.50]) {
      gun(ctx,cx-PW,gy,R*0.80,R*0.048,f,g,A);
    }
    // Superstructure now on bottom
    frect(ctx,cx+PW*0.32,cy+PH,R*0.72,R*0.42,f,g,A+0.02);
  }
  // ── DL detail ──
  if (dl>=1) { // Deck marking lines
    ctx.save(); ctx.globalAlpha=A-0.28; ctx.strokeStyle='rgba(255,255,255,0.58)'; ctx.lineWidth=0.55;
    for (let i=1;i<=7;i++) { const dx=cx-PW+i*PW*2/8; ctx.beginPath(); ctx.moveTo(dx,cy-PH); ctx.lineTo(dx,cy+PH); ctx.stroke(); }
    ctx.restore();
  }
  if (dl>=2) { // Radar arch on island + antenna
    sline(ctx,cx+PW*0.68,cy-PH-R*0.55,cx+PW*0.68,cy-PH-R*0.82,f,A-0.22,R*0.035);
    sarc(ctx,cx+PW*0.78,cy-PH-R*0.72,R*0.15,Math.PI*0.60,Math.PI*2.40,'rgba(255,255,255,0.55)',A-0.28,0.58);
  }
  if (dl>=3) { // Secondary gun positions + towed sub visible at rear
    turret(ctx,cx+PW*0.62,cy-PH,R*0.75,f,g,A-0.10);
    frect(ctx,cx+PW*1.08,cy-PH*0.65,R*0.48,PH*1.30,f,g,A-0.30); // towed sub
  }
}

// ── T12  PARASITE ────────────────────────────────────────
// Silhouette: ASYMMETRIC amorphous blob + 3-5 barbed appendages, no bilateral symmetry
// Role: parasite · Mass: front · Weapon: penetrating spike at left
function drawT12(ctx:Ctx,cx:number,cy:number,R:number,n:number,f:string,g:string,A:number): void {
  const bp=BP(n),v=TV(n),dl=DL(n);
  if (bp===0) { // Tick — swollen round body, 6 leg stubs, suction disc, asymmetric
    const bR=R*[0.82,0.92,0.72][v];
    // Swollen asymmetric body (not centered)
    oblob(ctx,cx+R*0.28,cy+R*0.12,bR,bR*0.88,f,g,A,n,10);
    // Suction disc at front (offset above midline — asymmetric)
    sarc(ctx,cx-bR*0.55,cy-bR*0.22,R*0.28,0,Math.PI*2,f,A-0.08,R*0.10,5);
    sarc(ctx,cx-bR*0.55,cy-bR*0.22,R*0.14,0,Math.PI*2,'rgba(255,255,255,0.60)',A-0.18,0.72);
    // 6 leg stubs (asymmetrically placed)
    const stubAngles=[Math.PI*0.30,Math.PI*0.58,Math.PI*0.82,Math.PI*1.18,Math.PI*1.42,Math.PI*1.70];
    for (const a of stubAngles) {
      const lLen=R*(0.30+nh(n,Math.floor(a*10))*0.18);
      sline(ctx,cx+R*0.28+Math.cos(a)*bR*0.82,cy+R*0.12+Math.sin(a)*bR*0.80,cx+R*0.28+Math.cos(a)*(bR*0.82+lLen),cy+R*0.12+Math.sin(a)*(bR*0.80+lLen),f,A-0.18,R*0.072);
      fcirc(ctx,cx+R*0.28+Math.cos(a)*(bR*0.82+lLen),cy+R*0.12+Math.sin(a)*(bR*0.80+lLen),R*0.045,f,g,A-0.26); // claw tip
    }
    stinger(ctx,cx-bR*0.55,cy-bR*0.22,R*0.45,R*0.062,f,g,A); // penetrating spike = weapon
  } else if (bp===1) { // Hook parasite — crescent shape with barbs at ends
    const cR=R*[1.05,1.18,0.92][v];
    // Crescent (partial arc filled)
    ctx.save(); ctx.globalAlpha=A; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=8;
    ctx.beginPath(); ctx.arc(cx+R*0.35,cy,cR,Math.PI*0.55,Math.PI*1.45);
    ctx.arc(cx+R*0.35,cy,cR*0.60,Math.PI*1.45,Math.PI*0.55,true); ctx.closePath();
    ctx.fill(); ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,0.16)'; ctx.lineWidth=0.85; ctx.stroke(); ctx.restore();
    // Barbed hooks at both crescent tips
    const tip1=[cx+R*0.35+Math.cos(Math.PI*0.55)*cR, cy+Math.sin(Math.PI*0.55)*cR];
    const tip2=[cx+R*0.35+Math.cos(Math.PI*1.45)*cR, cy+Math.sin(Math.PI*1.45)*cR];
    for (const [tx,ty] of [tip1,tip2]) {
      for (const ba of [0.38,-0.38]) {
        const ba2=Math.atan2(ty-cy-0,tx-cx-R*0.35)+Math.PI+ba;
        cshard(ctx,tx,ty,ba2,R*0.32,R*0.040,f,g,A-0.10);
      }
    }
    stinger(ctx,tip1[0],tip1[1],R*0.38,R*0.055,f,g,A);
  } else if (bp===2) { // Lamprey — circular sucker mouth, eel body trailing
    const suckerR=R*[0.52,0.60,0.44][v];
    // Circular sucker mouth (series of rings)
    for (let i=0;i<3;i++) { sarc(ctx,cx-R*0.38,cy,suckerR*(1-i*0.22),0,Math.PI*2,f,A-i*0.08,R*(0.14-i*0.030),7-i*2); }
    // Tooth ring (inner)
    ctx.save(); ctx.globalAlpha=A-0.18; ctx.strokeStyle='rgba(255,255,255,0.70)'; ctx.lineWidth=0.55;
    for (let i=0;i<10;i++) { const ta=(i/10)*Math.PI*2; ctx.beginPath(); ctx.moveTo(cx-R*0.38+Math.cos(ta)*suckerR*0.65,cy+Math.sin(ta)*suckerR*0.65); ctx.lineTo(cx-R*0.38+Math.cos(ta)*suckerR*0.38,cy+Math.sin(ta)*suckerR*0.38); ctx.stroke(); }
    ctx.restore();
    // Eel body trailing to right (tapering bezier)
    ctx.save(); ctx.globalAlpha=A-0.04; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=6;
    ctx.beginPath(); ctx.moveTo(cx-R*0.38,cy-suckerR*0.72); ctx.bezierCurveTo(cx+R*1.20,cy-suckerR*0.60,cx+R*2.10,cy-suckerR*0.25,cx+R*2.60,cy); ctx.bezierCurveTo(cx+R*2.10,cy+suckerR*0.25,cx+R*1.20,cy+suckerR*0.60,cx-R*0.38,cy+suckerR*0.72); ctx.closePath(); ctx.fill(); ctx.restore();
    stinger(ctx,cx-R*0.38-suckerR,cy,R*0.40,R*0.055,f,g,A); // spike from sucker
  } else if (bp===3) { // HYBRID: Crystal-parasite — organic mass + crystal penetrators
    // Organic absorption mass
    oblob(ctx,cx+R*0.25,cy,R*0.72,R*0.62,f,g,A-0.04,n,10);
    // Crystal penetrating spines in non-uniform directions
    const spineAngles=[Math.PI,Math.PI*1.28,Math.PI*0.75,Math.PI*1.52,Math.PI*0.88];
    for (let i=0;i<3+nhi(n,5,2);i++) {
      const sa=spineAngles[i]+(nh(n,30+i)-0.5)*0.40;
      cshard(ctx,cx+R*0.25+Math.cos(sa)*R*0.62,cy+Math.sin(sa)*R*0.52,sa,R*(0.42+nh(n,40+i)*0.30),R*0.055,f,g,A-0.06);
    }
    stinger(ctx,cx-R*0.47,cy,R*0.46,R*0.065,f,g,A);
  } else { // BP4 INNOVATION: Nano-cloud — cluster of microscopic hooks, no body
    const nHook=10+v*3;
    for (let i=0;i<nHook;i++) {
      const hx=cx-R*(0.20+nh(n,10+i)*0.88), hy=cy+(nh(n,20+i)-0.50)*R*0.80;
      const ha=nh(n,30+i)*Math.PI*2;
      cshard(ctx,hx,hy,ha,R*(0.10+nh(n,40+i)*0.12),R*0.025,f,g,A-0.12-nh(n,50+i)*0.25);
    }
    ebeam(ctx,cx-R*1.08,cy,cx-R*1.48,cy,f,g,A,R*0.045);
  }
  // ── DL detail ──
  if (dl>=1) { // Sucker/barb detail
    sarc(ctx,cx-R*0.55,cy-R*0.22,R*0.34,0,Math.PI*2,'rgba(255,255,255,0.52)',A-0.30,0.55);
  }
  if (dl>=2) { // Feeding tube extending from mass
    ctx.save(); ctx.globalAlpha=A-0.20; ctx.strokeStyle=f; ctx.lineWidth=R*0.065; ctx.shadowColor=g; ctx.shadowBlur=4;
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.bezierCurveTo(cx+R*0.35,cy-R*0.28,cx+R*0.62,cy-R*0.22,cx+R*0.72,cy-R*0.45); ctx.stroke(); ctx.restore();
    fcirc(ctx,cx+R*0.72,cy-R*0.45,R*0.068,f,g,A-0.22);
  }
  if (dl>=3) { // Egg sac cluster
    for (let i=0;i<4;i++) { fcirc(ctx,cx+R*0.55+nh(n,60+i)*R*0.40,cy+R*0.42+nh(n,70+i)*R*0.22,R*(0.048+nh(n,80+i)*0.032),'rgba(255,255,255,0.35)',g,A-0.38); }
  }
}

// ── T13  RING ────────────────────────────────────────────
// Silhouette: CLEAR TOROIDAL FORM — center is visibly empty
// Role: orbital · Mass: distributed on ring · Weapon: leftmost node
function drawT13(ctx:Ctx,cx:number,cy:number,R:number,n:number,f:string,g:string,A:number): void {
  const bp=BP(n),v=TV(n),dl=DL(n);
  const ringR=R*[1.12,1.28,0.96][v]; // ring radius
  const ringW=R*[0.16,0.18,0.14][v]; // ring tube width
  if (bp===0) { // Simple ring — 4 structural nodes, weapon at leftmost
    sarc(ctx,cx,cy,ringR,0,Math.PI*2,f,A-0.04,ringW*2,8); // ring tube (stroke)
    // 4 nodes (N/S/E/W)
    for (const [na] of [[0],[Math.PI*0.5],[Math.PI],[Math.PI*1.5]] as [number][]) {
      fcirc(ctx,cx+Math.cos(na)*ringR,cy+Math.sin(na)*ringR,ringW*1.80,f,g,A-0.06);
    }
    // Left node weapon
    gun(ctx,cx-ringR,cy,R*0.88,R*0.060,f,g,A);
  } else if (bp===1) { // Double ring — two concentric rings with radial struts
    const r1=ringR, r2=ringR*0.58;
    sarc(ctx,cx,cy,r1,0,Math.PI*2,f,A-0.04,ringW*2,8);
    sarc(ctx,cx,cy,r2,0,Math.PI*2,f,A-0.08,ringW*1.40,5);
    // Radial struts (6)
    for (let i=0;i<6;i++) { const sa=(i/6)*Math.PI*2; sline(ctx,cx+Math.cos(sa)*r2,cy+Math.sin(sa)*r2,cx+Math.cos(sa)*r1,cy+Math.sin(sa)*r1,f,A-0.18,ringW*1.40); }
    gun(ctx,cx-r1,cy,R*0.88,R*0.060,f,g,A);
  } else if (bp===2) { // Segmented ring — 6 visible segments with junction boxes
    const nSeg=5+v;
    for (let i=0;i<nSeg;i++) {
      const a0=(i/nSeg)*Math.PI*2-Math.PI*0.08, a1=((i+0.82)/nSeg)*Math.PI*2-Math.PI*0.08;
      sarc(ctx,cx,cy,ringR,a0,a1,f,A-0.04,ringW*2.20,7);
      // Junction box at segment end
      const jx=cx+Math.cos(a1)*ringR, jy=cy+Math.sin(a1)*ringR;
      fcirc(ctx,jx,jy,ringW*2.40,f,g,A-0.06);
    }
    // Find leftmost node for weapon
    const leftA=Math.PI*(1-1/nSeg*0.5);
    gun(ctx,cx+Math.cos(leftA)*ringR,cy+Math.sin(leftA)*ringR,R*0.88,R*0.060,f,g,A);
  } else if (bp===3) { // HYBRID: Bio-ring — ring structure threaded with organic tissue
    sarc(ctx,cx,cy,ringR,0,Math.PI*2,f,A-0.08,ringW*2,7);
    // Organic tissue threading between ring sections
    for (let i=0;i<8;i++) {
      const a1=(i/8)*Math.PI*2, a2=((i+3)/8)*Math.PI*2;
      ctx.save(); ctx.globalAlpha=A-0.22; ctx.strokeStyle=f; ctx.lineWidth=ringW*0.80; ctx.shadowColor=g; ctx.shadowBlur=4;
      ctx.beginPath(); ctx.arc(cx,cy,ringR*(0.78+nh(n,10+i)*0.18),a1,a2); ctx.stroke(); ctx.restore();
    }
    // 4 organic nodules on ring
    for (let i=0;i<4;i++) { const na=(i/4)*Math.PI*2+Math.PI*0.12; oblob(ctx,cx+Math.cos(na)*ringR,cy+Math.sin(na)*ringR,ringW*2.40,ringW*1.80,f,g,A-0.10,n,20+i*5); }
    stinger(ctx,cx-ringR,cy,R*0.42,R*0.060,f,g,A);
  } else { // BP4 INNOVATION: Partial arc — 270° arc with 90° gap, fires through gap
    const gapStart=Math.PI*0.75, gapEnd=Math.PI*1.25; // gap on upper-left
    sarc(ctx,cx,cy,ringR,gapEnd,gapStart+Math.PI*2,f,A-0.04,ringW*2.20,8); // 270° arc
    // End caps at gap
    for (const ea of [gapStart+Math.PI*2, gapEnd]) {
      fcirc(ctx,cx+Math.cos(ea)*ringR,cy+Math.sin(ea)*ringR,ringW*2.20,f,g,A-0.06);
    }
    // Weapon fires through gap
    const gapMid=(gapStart+Math.PI*2+gapEnd)/2;
    ebeam(ctx,cx+Math.cos(gapMid)*ringR*0.45,cy+Math.sin(gapMid)*ringR*0.45,cx+Math.cos(gapMid)*ringR*1.55,cy+Math.sin(gapMid)*ringR*1.55,f,g,A,R*0.055);
    stinger(ctx,cx-ringR,cy,R*0.42,R*0.060,f,g,A);
  }
  // ── DL detail ──
  if (dl>=1) { // Module housing at each node
    for (let i=0;i<4;i++) { const na=(i/4)*Math.PI*2+Math.PI*0.12; frect(ctx,cx+Math.cos(na)*ringR-ringW*1.50,cy+Math.sin(na)*ringR-ringW,ringW*3.0,ringW*2,f,g,A-0.18); }
  }
  if (dl>=2) { // Power conduit lines along ring
    ctx.save(); ctx.globalAlpha=A-0.26; ctx.strokeStyle='rgba(255,255,255,0.55)'; ctx.lineWidth=0.52;
    ctx.beginPath(); ctx.arc(cx,cy,ringR-ringW*0.75,0,Math.PI*2); ctx.stroke();
    ctx.restore();
  }
  if (dl>=3) { // Radiator fin panels
    for (let i=0;i<6;i++) { const na=(i/6)*Math.PI*2+0.26; const rx=cx+Math.cos(na)*ringR, ry=cy+Math.sin(na)*ringR; sline(ctx,rx,ry,rx+Math.cos(na)*ringW*1.80,ry+Math.sin(na)*ringW*1.80,f,A-0.28,ringW*0.72); }
  }
}

// ── T14  CHIMERA ─────────────────────────────────────────
// Silhouette: TWO DIFFERENT HALVES joined at seam — substrate contrast is the form
// Role: chimera · Mass: center · Weapon: from front (left) half
function drawT14(ctx:Ctx,cx:number,cy:number,R:number,n:number,f:string,g:string,A:number): void {
  const bp=BP(n),v=TV(n),dl=DL(n);
  const seam=cx; // visible seam at center
  // Seam line helper
  const seamLine=(seH:number)=>{
    sline(ctx,seam,cy-seH,seam,cy+seH,'rgba(255,255,255,0.62)',A-0.12,R*0.030);
    for (let i=0;i<4;i++) { sline(ctx,seam-R*0.06,cy-seH+i*seH*0.50,seam+R*0.06,cy-seH+i*seH*0.50,'rgba(255,255,255,0.40)',A-0.22,R*0.022); }
  };
  if (bp===0) { // Crab-front + Tank-rear
    // Front (left): crustacean claw + head
    const cR=R*0.52;
    fell(ctx,seam-R*0.55,cy,cR,cR*0.80,f,g,A-0.04,6);
    // Claw
    for (const s of [-1,1] as const) {
      fpoly(ctx,[[seam-R*0.55-cR*0.75,cy+s*cR*0.28],[seam-R*0.55-cR*1.48,cy+s*cR*0.62],[seam-R*0.55-cR*1.48,cy+s*cR*0.10],[seam-R*0.55-cR*0.85,cy+s*cR*0.04]],f,g,A-0.06,4);
    }
    stinger(ctx,seam-R*0.55-cR*1.48,cy,R*0.42,cR*0.20,f,g,A);
    fcirc(ctx,seam-R*0.55-cR*0.35,cy-cR*0.35,R*0.10,'rgba(255,255,255,0.80)',g,A-0.02);
    // Rear (right): tracked tank hull
    fpoly(ctx,[[seam,cy-R*0.60],[seam+R*1.85,cy-R*0.60],[seam+R*2.05,cy-R*0.32],[seam+R*2.05,cy+R*0.32],[seam+R*1.85,cy+R*0.60],[seam,cy+R*0.60]],f,g,A-0.04,6);
    frect(ctx,seam,cy+R*0.60,R*2.0,R*0.32,f,g,A-0.22,3); // track skirt
    seamLine(R*0.60);
  } else if (bp===1) { // Skull-front + Engine-rear
    // Front (left): skull/vertebrate head
    const sW=R*0.72, sH=R*0.48;
    ctx.save(); ctx.globalAlpha=A; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=8;
    ctx.beginPath(); ctx.moveTo(seam-sW*0.55,cy); ctx.bezierCurveTo(seam-sW*0.55,cy-sH,seam+sW*0.35,cy-sH,seam,cy-sH*0.30); ctx.lineTo(seam,cy+sH*0.30); ctx.bezierCurveTo(seam+sW*0.35,cy+sH,seam-sW*0.55,cy+sH,seam-sW*0.55,cy); ctx.closePath(); ctx.fill(); ctx.restore();
    // Skull bone lines
    ctx.save(); ctx.globalAlpha=A-0.28; ctx.strokeStyle='rgba(255,255,255,0.60)'; ctx.lineWidth=0.55;
    ctx.beginPath(); ctx.moveTo(seam-sW*0.35,cy-sH*0.90); ctx.lineTo(seam-sW*0.35,cy+sH*0.90); ctx.stroke();
    ctx.restore();
    fcirc(ctx,seam-sW*0.28,cy-sH*0.32,R*0.10,'rgba(255,255,255,0.70)',g,A-0.04); fcirc(ctx,seam-sW*0.28,cy-sH*0.32,R*0.048,'#0a0f1a',g,1.0); // eye socket
    stinger(ctx,seam-sW*0.55,cy,R*0.50,sH*0.22,f,g,A);
    // Rear (right): mechanical engine block
    frect(ctx,seam,cy-R*0.72,R*1.85,R*1.44,f,g,A-0.04,6);
    for (let i=1;i<=2;i++) { frect(ctx,seam+i*R*0.55,cy-R*0.72-R*0.28,R*0.30,R*0.28,f,g,A-0.18); } // exhaust stacks
    seamLine(R*0.72);
  } else if (bp===2) { // Wing-front + Crawler-rear
    // Front (left): membrane wing
    fpoly(ctx,[[seam,cy-R*0.20],[seam-R*1.65,cy-R*1.10],[seam-R*1.52,cy-R*1.20],[seam-R*0.28,cy-R*0.18]],f,g,A-0.06,6);
    fpoly(ctx,[[seam,cy+R*0.20],[seam-R*1.65,cy+R*1.10],[seam-R*1.52,cy+R*1.20],[seam-R*0.28,cy+R*0.18]],f,g,A-0.06,6);
    // Wing veins
    ctx.save(); ctx.globalAlpha=A-0.28; ctx.strokeStyle='rgba(255,255,255,0.55)'; ctx.lineWidth=0.55;
    for (const s of [-1,1] as const) { for (let i=1;i<=3;i++) { const t=i/4; ctx.beginPath(); ctx.moveTo(seam-R*0.08,cy+s*R*0.16); ctx.lineTo(seam-R*1.55*t,cy+s*R*1.08*t); ctx.stroke(); } }
    ctx.restore();
    stinger(ctx,seam-R*1.65,cy,R*0.38,R*0.058,f,g,A);
    // Rear (right): tracked crawler
    frect(ctx,seam,cy-R*0.52,R*1.78,R*1.04,f,g,A-0.04,6);
    frect(ctx,seam,cy+R*0.52,R*1.72,R*0.32,f,g,A-0.22,3);
    bogies(ctx,seam,seam+R*1.72,cy+R*0.64,f,g,A,R);
    seamLine(R*0.52);
  } else if (bp===3) { // Triple chimera — 3 segments, each different substrate
    const seg=R*1.38;
    // Segment 1 (left): organic blob
    oblob(ctx,seam-seg,cy,R*0.62,R*0.52,f,g,A,n,10);
    stinger(ctx,seam-seg-R*0.62,cy,R*0.44,R*0.062,f,g,A);
    // Segment 2 (center): crystal
    for (let i=0;i<5;i++) { const sa=(i/5)*Math.PI*2+Math.PI*0.10; cshard(ctx,seam,cy,sa,R*0.55,R*0.068,f,g,A-0.06); }
    fcirc(ctx,seam,cy,R*0.15,f,g,A+0.02);
    // Segment 3 (right): mechanical box
    frect(ctx,seam+seg-R*0.50,cy-R*0.45,R*1.00,R*0.90,f,g,A-0.04,6);
    // Two seams
    sline(ctx,seam-seg*0.5,cy-R*0.52,seam-seg*0.5,cy+R*0.52,'rgba(255,255,255,0.55)',A-0.14,0.88);
    sline(ctx,seam+seg*0.5,cy-R*0.52,seam+seg*0.5,cy+R*0.52,'rgba(255,255,255,0.55)',A-0.14,0.88);
  } else { // BP4 INNOVATION: Active-fusion — two substrates visibly MERGING
    // Organic half (left) — becoming mechanical
    oblob(ctx,seam-R*0.80,cy,R*0.88,R*0.72,f,g,A-0.04,n,10);
    // Mechanical half (right) — becoming organic (curved plates)
    fpoly(ctx,[[seam,cy-R*0.72],[seam+R*1.55,cy-R*0.58],[seam+R*1.80,cy],[seam+R*1.55,cy+R*0.58],[seam,cy+R*0.72]],f,g,A-0.04,7);
    // Interpenetrating seam zone (energy glow)
    ctx.save(); ctx.globalAlpha=A-0.28; ctx.fillStyle='rgba(255,255,255,0.22)'; ctx.shadowColor=g; ctx.shadowBlur=10;
    ctx.beginPath(); ctx.ellipse(seam,cy,R*0.22,R*0.72,0,0,Math.PI*2); ctx.fill(); ctx.restore();
    // Transition tendrils crossing the seam
    for (let i=0;i<4;i++) etend(ctx,seam-R*(0.10+nh(n,10+i)*0.30),cy+(nh(n,20+i)-0.50)*R*0.55,seam+R*(0.10+nh(n,30+i)*0.30),cy+(nh(n,40+i)-0.50)*R*0.55,f,g,A-0.22,n,50+i*3);
    stinger(ctx,seam-R*1.68,cy,R*0.44,R*0.062,f,g,A);
    seamLine(R*0.72);
  }
  // ── DL detail ──
  if (dl>=1) { // Bolts/stitches at seam
    for (let i=0;i<4;i++) { fcirc(ctx,seam,cy-R*0.45+i*R*0.28,R*0.040,'rgba(255,255,255,0.60)',g,A-0.28); }
  }
  if (dl>=2) { // More detailed anatomy on each half
    fcirc(ctx,seam-R*0.88,cy+R*0.22,R*0.058,'rgba(255,255,255,0.48)',g,A-0.32);
    frect(ctx,seam+R*0.55,cy-R*0.18,R*0.35,R*0.10,f,g,A-0.22);
  }
  if (dl>=3) { // Active integration zone glow + nerve/cable routing at seam
    ctx.save(); ctx.globalAlpha=A-0.32; ctx.strokeStyle='rgba(255,255,255,0.55)'; ctx.lineWidth=R*0.025;
    for (let i=0;i<3;i++) { ctx.beginPath(); ctx.moveTo(seam-R*0.20,cy-R*0.25+i*R*0.22); ctx.bezierCurveTo(seam,cy-R*0.25+i*R*0.22+R*0.08,seam,cy-R*0.25+i*R*0.22+R*0.08,seam+R*0.20,cy-R*0.25+i*R*0.22); ctx.stroke(); }
    ctx.restore();
  }
}

// ── T15  FUNGAL_MAT ──────────────────────────────────────
// Silhouette: wide flat pad (≥3.5R) + upright fruiting body caps
// Role: fungal · Mass: bottom/distributed · Weapon: leftmost cap = spore gun
function drawT15(ctx:Ctx,cx:number,cy:number,R:number,n:number,f:string,g:string,A:number): void {
  const bp=BP(n),v=TV(n),dl=DL(n);
  const matW=R*[3.60,4.00,3.20][v]; // pad half-width
  const matH=R*[0.24,0.28,0.20][v]; // pad half-height
  const nCap=4+v;
  // Cap drawing helper
  const drawCap=(capX:number,stemTop:number,cW:number,cH:number,alpha:number)=>{
    ctx.save(); ctx.globalAlpha=alpha; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=5;
    ctx.beginPath(); ctx.moveTo(capX-cW,stemTop); ctx.bezierCurveTo(capX-cW,stemTop-cH*1.65,capX+cW,stemTop-cH*1.65,capX+cW,stemTop); ctx.closePath(); ctx.fill();
    ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,0.16)'; ctx.lineWidth=0.72; ctx.stroke(); ctx.restore();
    ctx.save(); ctx.globalAlpha=alpha-0.22; ctx.fillStyle=f;
    ctx.beginPath(); ctx.ellipse(capX,stemTop,cW,cH*0.30,0,0,Math.PI); ctx.fill(); ctx.restore();
  };
  if (bp===0) { // Parasol colony — flat pad + 4-5 mushroom caps of varying heights
    // Main rhizome pad (flat)
    fpoly(ctx,[[cx-matW,cy+matH],[cx+matW,cy+matH],[cx+matW*0.85,cy-matH],[cx-matW*0.88,cy-matH]],f,g,A-0.04,6);
    // Mycelium thread network on pad surface (DL0 still shows basic threads)
    ctx.save(); ctx.globalAlpha=A-0.28; ctx.strokeStyle='rgba(255,255,255,0.45)'; ctx.lineWidth=0.50;
    for (let i=0;i<6;i++) { const tx=cx-matW*0.80+i*matW*0.32; ctx.beginPath(); ctx.moveTo(tx,cy-matH); ctx.lineTo(tx+(nh(n,10+i)-0.5)*R*0.40,cy+matH); ctx.stroke(); }
    ctx.restore();
    // Fruiting body caps (varying heights)
    const capPositions=[-0.78,-0.38,0.02,0.44,0.82].slice(0,nCap);
    for (let i=0;i<nCap;i++) {
      const cx2=cx+matW*capPositions[i];
      const stemH=R*(0.38+nh(n,20+i)*0.35), cW=R*(0.28+nh(n,30+i)*0.14), cH=R*(0.22+nh(n,40+i)*0.10);
      // Stem
      sline(ctx,cx2,cy-matH,cx2,cy-matH-stemH,f,A-0.10,R*0.075);
      drawCap(cx2,cy-matH-stemH,cW,cH,A-0.04-i*0.030);
    }
    // Weapon: leftmost cap = spore cannon
    gun(ctx,cx-matW*0.78,cy-matH-R*0.58,R*0.78,R*0.060,f,g,A);
  } else if (bp===1) { // Puffball array — round bulbous caps in a row
    fpoly(ctx,[[cx-matW,cy+matH],[cx+matW,cy+matH],[cx+matW*0.85,cy-matH],[cx-matW*0.88,cy-matH]],f,g,A-0.06,6);
    for (let i=0;i<nCap;i++) {
      const px=cx-matW*0.80+i*matW*0.44, pR=R*(0.32+nh(n,10+i)*0.16);
      sline(ctx,px,cy-matH,px+(nh(n,20+i)-0.5)*R*0.08,cy-matH-R*0.22,f,A-0.12,R*0.055);
      fcirc(ctx,px+(nh(n,20+i)-0.5)*R*0.08,cy-matH-R*0.22-pR*0.80,pR,f,g,A-i*0.030,5);
      // Pore opening at top
      fcirc(ctx,px+(nh(n,20+i)-0.5)*R*0.08,cy-matH-R*0.22-pR*1.62,pR*0.18,'rgba(255,255,255,0.50)',g,A-0.25);
    }
    gun(ctx,cx-matW*0.80,cy-matH-R*0.22-R*0.48*0.80,R*0.72,R*0.055,f,g,A);
  } else if (bp===2) { // Hyphal network — mostly flat pad with visible thread lattice, minimal caps
    // Thick flat pad
    fpoly(ctx,[[cx-matW,cy+matH*1.20],[cx+matW,cy+matH*1.20],[cx+matW*0.85,cy-matH*1.20],[cx-matW*0.88,cy-matH*1.20]],f,g,A-0.02,6);
    // Dense hyphal thread network
    ctx.save(); ctx.globalAlpha=A-0.18; ctx.strokeStyle='rgba(255,255,255,0.55)'; ctx.lineWidth=0.55;
    for (let i=0;i<10;i++) { const x0=cx-matW+i*matW*0.22, x1=cx-matW+(i+1)*matW*0.22; ctx.beginPath(); ctx.moveTo(x0,cy-matH*(0.5+nh(n,10+i)*0.60)); ctx.quadraticCurveTo(cx-matW+i*matW*0.22+matW*0.11,cy-(matH*0.20+nh(n,20+i)*matH*0.70),x1,cy-matH*(0.5+nh(n,30+i)*0.60)); ctx.stroke(); }
    ctx.restore();
    // Just 2 caps
    for (const [px,sw] of [[cx-matW*0.72,1],[cx+matW*0.18,-1]] as [number,number][]) {
      const stemH=R*0.28, cW=R*0.32;
      sline(ctx,px,cy-matH*1.20,px,cy-matH*1.20-stemH,f,A-0.10,R*0.065);
      drawCap(px,cy-matH*1.20-stemH,cW,R*0.18,A-0.06);
    }
    gun(ctx,cx-matW*0.72,cy-matH-R*0.28,R*0.68,R*0.055,f,g,A);
  } else if (bp===3) { // HYBRID: Cordyceps-mech — mechanical host body with fungal growth
    // Mechanical host body (visible frame)
    frect(ctx,cx-matW*0.62,cy-R*0.42,matW*1.24,R*0.84,f,g,A-0.08,6);
    // Legs/wheels of host
    for (let i=0;i<3;i++) { const lx=cx-matW*0.48+i*matW*0.48; sline(ctx,lx,cy+R*0.42,lx,cy+R*0.42+R*0.38,f,A-0.18,R*0.075); fcirc(ctx,lx,cy+R*0.42+R*0.38+R*0.10,R*0.10,f,g,A-0.22); }
    // Fungal growths emerging from host
    for (let i=0;i<3+v;i++) {
      const fx=cx-matW*0.52+i*matW*0.36;
      const stemH=R*(0.32+nh(n,10+i)*0.25), cW=R*(0.22+nh(n,20+i)*0.12);
      ctx.save(); ctx.globalAlpha=A-0.06; ctx.strokeStyle=f; ctx.lineWidth=R*0.065; ctx.shadowColor=g; ctx.shadowBlur=4;
      ctx.beginPath(); ctx.moveTo(fx,cy-R*0.42); ctx.lineTo(fx+(nh(n,30+i)-0.5)*R*0.10,cy-R*0.42-stemH); ctx.stroke(); ctx.restore();
      drawCap(fx+(nh(n,30+i)-0.5)*R*0.10,cy-R*0.42-stemH,cW,R*0.16,A-0.06-i*0.025);
    }
    gun(ctx,cx-matW*0.52,cy-R*0.42-R*0.45,R*0.72,R*0.055,f,g,A);
  } else { // BP4 INNOVATION: Slime mold — amorphous flowing form, pseudopod weapon
    const sW=matW*0.88, sH=R*[0.88,1.02,0.75][v];
    // Amorphous flowing mass (heavily perturbed blob)
    oblob(ctx,cx-R*0.25,cy,sW*0.75,sH*0.62,f,g,A,n,10);
    // Secondary pseudopods
    for (let i=0;i<3+v;i++) {
      const pa=Math.PI*(0.42+i*0.38)+nh(n,60+i)*0.55;
      rtend(ctx,cx-R*0.25,cy,pa,R*(0.48+nh(n,70+i)*0.42),R*(0.068-i*0.008),f,g,A-0.18,n,80+i*4);
    }
    // Leading pseudopod = weapon
    const wx=cx-R*0.25+Math.cos(Math.PI)*sW*0.75;
    stinger(ctx,wx,cy,R*0.48,R*0.065,f,g,A);
  }
  // ── DL detail ──
  if (dl>=1) { // Bioluminescent spots on pad
    for (let i=0;i<5;i++) { fcirc(ctx,cx-matW*0.70+i*matW*0.36,cy+(nh(n,90+i)-0.5)*matH*0.70,R*0.032,'rgba(255,255,255,0.55)',g,A-0.35); }
  }
  if (dl>=2) { // Individual spore release particles
    for (let i=0;i<4;i++) {
      const sx=cx-matW*0.58+i*matW*0.40, sy=cy-matH-R*(0.25+nh(n,100+i)*0.35);
      fcirc(ctx,sx+(nh(n,110+i)-0.5)*R*0.18,sy,R*0.025,'rgba(255,255,255,0.60)',g,A-0.38);
    }
  }
  if (dl>=3) { // Rhizomorph bundles visible under pad edge
    ctx.save(); ctx.globalAlpha=A-0.28; ctx.strokeStyle=f; ctx.lineWidth=R*0.040;
    for (let i=0;i<4;i++) { const rx=cx-matW*0.68+i*matW*0.45; rtend(ctx,rx,cy+matH,Math.PI*0.5,R*(0.22+nh(n,120+i)*0.14),R*0.040,f,g,A-0.28,n,130+i*4); }
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════
// §5  CLASS MARK + MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════════

function drawClassMark(ctx:Ctx,cx:number,cy:number,R:number,cls:VirusClass): void {
  ctx.save(); ctx.globalAlpha=0.26; ctx.strokeStyle='rgba(255,255,255,0.82)'; ctx.lineWidth=0.72; ctx.shadowBlur=0;
  switch (cls) {
    case 'prime': for (let i=0;i<6;i++) { const a=(i/6)*Math.PI*2; ctx.beginPath(); ctx.moveTo(cx+R*0.10*Math.cos(a),cy+R*0.10*Math.sin(a)); ctx.lineTo(cx+R*0.24*Math.cos(a),cy+R*0.24*Math.sin(a)); ctx.stroke(); } break;
    case 'power-of-two': ctx.strokeRect(cx-R*0.14,cy-R*0.14,R*0.28,R*0.28); break;
    case 'perfect-square': ctx.beginPath(); ctx.arc(cx,cy,R*0.20,0,Math.PI*2); ctx.stroke(); break;
    case 'even-composite': ctx.beginPath(); ctx.moveTo(cx-R*0.20,cy-R*0.08); ctx.lineTo(cx+R*0.20,cy-R*0.08); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx-R*0.20,cy+R*0.08); ctx.lineTo(cx+R*0.20,cy+R*0.08); ctx.stroke(); break;
    case 'odd-composite': { const t=R*0.18; ctx.beginPath(); ctx.moveTo(cx,cy-t); ctx.lineTo(cx+t*0.87,cy+t*0.5); ctx.lineTo(cx-t*0.87,cy+t*0.5); ctx.closePath(); ctx.stroke(); break; }
  }
  ctx.restore();
}

const TOPO_DRAW=[drawT0,drawT1,drawT2,drawT3,drawT4,drawT5,drawT6,drawT7,drawT8,drawT9,drawT10,drawT11,drawT12,drawT13,drawT14,drawT15];

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

export function drawVirusSilhouette(ctx:CanvasRenderingContext2D,cx:number,cy:number,n:number,cell:number): void {
  const R=cell*0.22+cell*0.016*Math.log2(n+1);
  ctx.save();
  TOPO_DRAW[getTopology(n)](ctx,cx,cy,R,n,'#000000','#000000',1.0);
  ctx.globalCompositeOperation='source-atop'; ctx.fillStyle='#000000';
  ctx.fillRect(cx-R*5.5,cy-R*3.5,R*11,R*7); ctx.globalCompositeOperation='source-over'; ctx.restore();
}

export function runSilhouetteDiversityTest(ctx:CanvasRenderingContext2D,w:number,h:number): void {
  const seeds=[37,14,25,63,47,18,71,40,53,29,89,56,100,172,121,94,200,160,213,177,8,32,128,200,73,149,211,67,143,251,97,181,42,118,193];
  const C=5,cW=w/C,cH=h/4,cell=Math.min(cW,cH)*0.48;
  const topoNames=['DREAD','TOWER','NEEDLE','LEVIA','ARACH','SERP','MEDU','DEND','POLY','SWRM','STRD','PLAT','PARA','RING','CHIM','FUNG'];
  const bpNames=['pur-A','pur-B','pur-C','hybrd','innov'];
  ctx.fillStyle='#0d1117'; ctx.fillRect(0,0,w,h);
  ctx.fillStyle='#c9d1d9'; ctx.font=`${Math.round(cell*0.10)}px monospace`; ctx.textAlign='center';
  ctx.fillText('MORPHOLOGY v7 — SILHOUETTE DIVERSITY TEST',w/2,cell*0.10);
  const topoSet=new Set<number>(), bpSet=new Set<string>(), dlSet=new Set<number>();
  for (let i=0;i<Math.min(seeds.length,20);i++) {
    const seed=seeds[i],col=i%C,row=Math.floor(i/C)+1;
    const ex=cW*(col+0.5),ey=cH*(row+0.50);
    const t=getTopology(seed), bp=BP(seed), dl=DL(seed);
    topoSet.add(t); bpSet.add(`${t}-${bp}`); dlSet.add(dl);
    drawVirusSilhouette(ctx,ex,ey,seed,cell);
    ctx.fillStyle='#8b949e'; ctx.font=`${Math.round(cell*0.076)}px monospace`; ctx.textAlign='center';
    ctx.fillText(`T${t} ${topoNames[t]}`,ex,ey+cell*0.38);
    ctx.fillText(`${bpNames[bp]} DL${dl}`,ex,ey+cell*0.50);
  }
  const passed=topoSet.size>=10;
  ctx.font=`${Math.round(cell*0.088)}px monospace`; ctx.textAlign='center';
  ctx.fillStyle=passed?'#3fb950':'#f85149';
  ctx.fillText(`${passed?'PASS':'FAIL'} — ${topoSet.size}/16 families · ${bpSet.size} body-plans · DL 0-3: ${dlSet.size} tiers`,w/2,h-cell*0.10);
  console.log('[Morphology v7]',passed?'PASS':'FAIL',{families:topoSet.size,bodyPlans:bpSet.size,dlTiers:dlSet.size});
}

// ═══════════════════════════════════════════════════════════
// §6  EXPANDED MorphSig WITH ROLE + DIVERSITY GATE
// ═══════════════════════════════════════════════════════════

export type MorphRole = 'siege'|'fortress'|'interceptor'|'leviathan'|'predator'|'serpentine'|'floater'|'colonial'|'geometric'|'swarm'|'walker'|'platform'|'parasite'|'orbital'|'chimera'|'fungal';

export interface MorphSig {
  topology:   number;     // 0-15 substrate family
  bodyPlan:   number;     // 0-4
  detailLevel: number;    // 0-3 DL tier
  variant:    number;     // 0-2 fine variant
  cls:        number;     // VirusClass index
  role:       MorphRole;  // combat role
  domain:     number;     // substrate domain
  aspectGroup: number;    // 0=round 1=vertical 2=horizontal 3=irregular 4=radial
  massCenter: number;     // 0=front 1=center 2=rear 3=distributed
  hybrid:     boolean;
  innovation: boolean;
}

const TOPO_ROLE: MorphRole[] = ['siege','fortress','interceptor','leviathan','predator','serpentine','floater','colonial','geometric','swarm','walker','platform','parasite','orbital','chimera','fungal'];
const TOPO_DOMAIN = [0,0,0,1,1,1,1,3,2,6,0,0,1,8,7,5]; // mech=0 bio=1 xtal=2 colonial=3 energy=4 plant=5 swarm=6 biomech=7 alien=8

// [topology][bodyPlan] → [aspectGroup, massCenter]
const TOPO_BP_META: [number,number][][] = [
  [[2,0],[2,1],[2,0],[2,0],[4,1]],  // T0 DREADNOUGHT
  [[1,1],[1,2],[1,1],[1,1],[4,1]],  // T1 TOWER
  [[2,3],[2,3],[2,3],[2,3],[0,1]],  // T2 NEEDLE
  [[0,2],[4,2],[2,2],[0,2],[0,3]],  // T3 LEVIATHAN
  [[4,0],[2,0],[2,0],[4,0],[2,0]],  // T4 ARACHNID
  [[2,3],[2,3],[2,3],[2,3],[3,1]],  // T5 SERPENT
  [[1,1],[3,1],[0,1],[4,1],[1,3]],  // T6 MEDUSA
  [[4,3],[2,3],[4,3],[4,3],[4,1]],  // T7 DENDRITE
  [[3,1],[3,1],[3,1],[4,1],[3,1]],  // T8 POLYHEDRON
  [[0,3],[2,3],[4,3],[2,3],[3,3]],  // T9 SWARM
  [[1,1],[1,0],[4,1],[1,1],[4,1]],  // T10 STRIDER
  [[2,2],[2,2],[2,2],[2,2],[2,2]],  // T11 PLATFORM
  [[3,0],[3,0],[2,0],[3,0],[3,3]],  // T12 PARASITE
  [[4,1],[4,1],[4,1],[4,1],[4,1]],  // T13 RING
  [[3,1],[3,1],[3,1],[3,3],[3,1]],  // T14 CHIMERA
  [[2,2],[2,2],[2,3],[2,1],[3,3]],  // T15 FUNGAL_MAT
];

const VC_O: VirusClass[] = ['prime','power-of-two','perfect-square','even-composite','odd-composite'];

export function getMorphSig(n: number): MorphSig {
  const t=getTopology(n), bp=BP(n), v=TV(n), dl=DL(n);
  const [ag,mc]=TOPO_BP_META[t][bp];
  return {
    topology:t, bodyPlan:bp, detailLevel:dl, variant:v, cls:VC_O.indexOf(getVirusClass(n)),
    role:TOPO_ROLE[t], domain:TOPO_DOMAIN[t], aspectGroup:ag, massCenter:mc,
    hybrid:bp===3, innovation:bp===4,
  };
}

export function morphDistance(a: MorphSig, b: MorphSig): number {
  let d=0;
  d += (a.topology!==b.topology?1:0)*0.35;
  d += (a.role!==b.role?1:0)*0.20;
  d += (a.bodyPlan!==b.bodyPlan?1:0)*0.18;
  d += (a.domain!==b.domain?1:0)*0.14;
  d += (a.aspectGroup!==b.aspectGroup?1:0)*0.08;
  d += (a.massCenter!==b.massCenter?1:0)*0.04;
  d += (a.hybrid!==b.hybrid?1:0)*0.01;
  return d;
}

// ═══════════════════════════════════════════════════════════
// §7  SPAWN DIVERSITY GATE
// Window: 20 entities. Caps per topology, per role, per domain.
// ═══════════════════════════════════════════════════════════
const SPAWN_WIN=20, MAX_SAME_TOPO=3, MAX_SAME_ROLE=2, MAX_SAME_DOMAIN=5;
const _hist: MorphSig[]=[];

export function registerSpawn(sig: MorphSig): void { _hist.push(sig); if (_hist.length>SPAWN_WIN) _hist.shift(); }
export function clearSpawnHistory(): void { _hist.length=0; }

export function pickDiverseSeed(): number {
  let best=-1, bestScore=-Infinity;
  for (let i=0;i<72;i++) {
    const seed=1+((i*97+Math.floor(Math.random()*41))%255);
    const sig=getMorphSig(seed);
    const topoC=_hist.filter(s=>s.topology===sig.topology).length;
    const roleC=_hist.filter(s=>s.role===sig.role).length;
    const domC=_hist.filter(s=>s.domain===sig.domain).length;
    // Hard limits
    if (topoC>=MAX_SAME_TOPO||roleC>=MAX_SAME_ROLE||domC>=MAX_SAME_DOMAIN) continue;
    // Soft score
    let minD=1.0; for (const s of _hist) { const d=morphDistance(sig,s); if (d<minD) minD=d; }
    const hybrBonus=sig.hybrid?0.14:sig.innovation?0.12:0;
    const dlBonus=sig.detailLevel>=2?0.04:0; // slight bonus for high-detail entities
    const score=minD*Math.pow(0.42,topoC)*Math.pow(0.60,roleC)*Math.pow(0.88,domC)+hybrBonus+dlBonus;
    if (score>bestScore) { bestScore=score; best=seed; }
  }
  return best>0?best:1+Math.floor(Math.random()*255);
}

export function selectDiverseSeed(waveSigs: MorphSig[], crossHistory: MorphSig[]): number {
  const all=[...crossHistory.slice(-8),...waveSigs];
  let best=-1, bestScore=-1;
  for (let attempt=0;attempt<60;attempt++) {
    const seed=Math.floor(Math.random()*255)+1, sig=getMorphSig(seed);
    let wMin=1.0; for (const ws of all) { const d=morphDistance(sig,ws); if (d<wMin) wMin=d; }
    const sharedTopo=all.filter(ws=>ws.topology===sig.topology).length;
    const sharedRole=all.filter(ws=>ws.role===sig.role).length;
    const score=wMin*Math.pow(0.48,sharedTopo)*Math.pow(0.62,sharedRole);
    if (score>bestScore) { bestScore=score; best=seed; }
  }
  return best>0?best:Math.floor(Math.random()*255)+1;
}

// ═══════════════════════════════════════════════════════════
// §8  DISTRIBUTION VALIDATION
// ═══════════════════════════════════════════════════════════

export function validateDistribution(sampleSize=256): {
  topoCounts:number[]; roleCounts:Record<MorphRole,number>; domainCounts:number[];
  bpCounts:number[]; dlCounts:number[]; maxTopoFrac:number; maxDomainFrac:number;
  uniqueBodyPlans:number; passed:boolean;
} {
  const tc=new Array(N_TOPO).fill(0), bpc=new Array(5).fill(0), dlc=new Array(4).fill(0);
  const dc=new Array(9).fill(0);
  const rc={} as Record<MorphRole,number>;
  for (const r of TOPO_ROLE) rc[r]=(rc[r]??0);
  for (let i=0;i<sampleSize;i++) {
    const n=Math.floor(Math.random()*255)+1;
    const sig=getMorphSig(n);
    tc[sig.topology]++; bpc[sig.bodyPlan]++; dlc[sig.detailLevel]++; dc[sig.domain]++;
    rc[sig.role]=(rc[sig.role]??0)+1;
  }
  const maxTC=Math.max(...tc), maxDC=Math.max(...dc);
  const maxTopoFrac=maxTC/sampleSize, maxDomainFrac=maxDC/sampleSize;
  const ubp=bpc.filter(c=>c>0).length;
  const passed=maxTopoFrac<=0.14&&maxDomainFrac<=0.25&&ubp>=4;
  console.log('[Morphology v7] Distribution check:');
  console.log('  Topologies:',tc.map((c,i)=>`T${i}(${TOPO_ROLE[i]}):${c}`).join(' '));
  console.log('  Roles:',Object.entries(rc).map(([r,c])=>`${r}:${c}`).join(' '));
  console.log('  Domains:',dc);
  console.log('  BP:',bpc,'DL:',dlc);
  console.log(`  maxTopoFrac:${maxTopoFrac.toFixed(3)} maxDomainFrac:${maxDomainFrac.toFixed(3)} uniqueBP:${ubp}`);
  console.log(' ',passed?'✓ PASS':'✗ FAIL');
  return {topoCounts:tc,roleCounts:rc,domainCounts:dc,bpCounts:bpc,dlCounts:dlc,maxTopoFrac,maxDomainFrac,uniqueBodyPlans:ubp,passed};
}

// ═══════════════════════════════════════════════════════════
// §9  LEGACY SHIMS — all call signatures unchanged
// ═══════════════════════════════════════════════════════════

export function getVirusRadius(n:number,R0:number,k:number): number { return R0+k*Math.log2(n+1); }
const ARCHS: VirusArchetype[]=['biological','humanoid','animal','insectoid','mechanical','armored','crystalline','mineral','plant','synthetic','robotic','amorphous','geometric','energy','cybernetic','skeletal','fluid'];
export function getVirusModelProfile(value:number): VirusModelProfile {
  const pi=Math.floor(nh(value,1)*ARCHS.length); let si=Math.floor(nh(value,2)*ARCHS.length); if (si===pi) si=(si+1)%ARCHS.length;
  const pw=0.6+nh(value,3)*0.4;
  return { primaryArchetype:ARCHS[pi],secondaryArchetype:ARCHS[si],primaryWeight:pw,secondaryWeight:1-pw,structureLevel:nh(value,4),symmetryLevel:nh(value,5),armorLevel:nh(value,6),organicLevel:nh(value,7),mechanicalLevel:nh(value,8),crystallineLevel:nh(value,9),energyLevel:nh(value,10) };
}
export function getCompatibilityScore(profile:VirusModelProfile,model:VirusVisualModel,lobes:number,symmetryLevel:number): number {
  const am=model.archetypes.includes(profile.primaryArchetype)?1:model.archetypes.includes(profile.secondaryArchetype)?0.5:0;
  const minL=model.compatibleFeatures.minLobes??3,maxL=model.compatibleFeatures.maxLobes??8;
  const [sMin,sMax]=model.compatibleFeatures.symmetryRange??[0,1];
  return am*0.40+(lobes>=minL&&lobes<=maxL?1:0)*0.25+(symmetryLevel>=sMin&&symmetryLevel<=sMax?1:0)*0.15;
}
