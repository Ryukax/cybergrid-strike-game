/**
 * CyberGrid Strike — Entity Morphology v4
 *
 * TOPOLOGY-FIRST design: topology selected from n before any other property.
 * 14 topology families — each has its own construction grammar.
 *
 *   T0  MONOCOQUE        — single smooth pressure hull
 *   T1  CHASSIS_FRAME    — exposed rails + cross-members, no skin
 *   T2  MULTI_HULL       — two separate hulls + bridge
 *   T3  POD_CLUSTER      — 4-5 pods, no center mass
 *   T4  SEGMENTED_CHAIN  — beaded capsule spine
 *   T5  EXOSKELETON      — ribs extend beyond soft inner body
 *   T6  WALKER_FRAME     — legs first, body elevated
 *   T7  CRAWLER_BED      — wide tracks >> hull
 *   T8  RING_STRUCTURE   — annular form, hollow center
 *   T9  BOOM_FRAME       — tiny body, long booms
 *   T10 SHELL_CORE       — polygonal shell + mismatched inner core
 *   T11 DISTRIBUTED_NODE — equal-weight node network
 *   T12 WING_BODY        — wings are primary mass
 *   T13 ASYMMETRIC       — deliberate imbalance, no symmetry axis
 *
 * All legacy exports preserved with identical signatures.
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
  compatibleFeatures: {
    minLobes?: number; maxLobes?: number;
    symmetryRange?: [number, number]; armorRange?: [number, number];
  };
}

// §1  Deterministic hash
function nh(n: number, salt: number): number {
  const x = Math.sin(n * 12.9898 + salt * 78.233 + salt * salt * 0.00371) * 43758.5453;
  return x - Math.floor(x);
}

// §2  Number theory
export function isPrime(n: number): boolean {
  if (n < 2) return false; if (n === 2) return true; if (n % 2 === 0) return false;
  for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return false;
  return true;
}
export function isPerfectSquare(n: number): boolean { const s = Math.round(Math.sqrt(n)); return s * s === n; }
export function isPowerOfTwo(n: number): boolean { return n > 0 && (n & (n - 1)) === 0; }
export function getVirusClass(n: number): VirusClass {
  if (isPrime(n)) return 'prime';
  if (isPowerOfTwo(n)) return 'power-of-two';
  if (isPerfectSquare(n)) return 'perfect-square';
  if (n % 2 === 0) return 'even-composite';
  return 'odd-composite';
}
export function getVirusLobes(n: number): number { return 3 + (n % 6); }
export function getVirusSpikes(n: number): boolean[] {
  return Array.from({ length: 8 }, (_, i) => Boolean((n >> i) & 1));
}

// §3  Colours
const FILL_C: Record<VirusClass, string> = {
  prime: '#e879f9', 'power-of-two': '#22d3ee', 'perfect-square': '#fbbf24',
  'even-composite': '#fb7185', 'odd-composite': '#fb923c',
};
const FLASH_C: Record<VirusClass, string> = {
  prime: '#fae8ff', 'power-of-two': '#ecfeff', 'perfect-square': '#fef9c3',
  'even-composite': '#fff1f2', 'odd-composite': '#fff7ed',
};
const GLOW_C: Record<VirusClass, string> = {
  prime: 'rgba(232,121,249,0.55)', 'power-of-two': 'rgba(34,211,238,0.55)',
  'perfect-square': 'rgba(251,191,36,0.55)', 'even-composite': 'rgba(251,113,133,0.45)',
  'odd-composite': 'rgba(251,146,60,0.50)',
};
export function getVirusColors(n: number, flash: boolean): { fill: string; glow: string } {
  const cls = getVirusClass(n);
  return { fill: flash ? FLASH_C[cls] : FILL_C[cls], glow: GLOW_C[cls] };
}

// §4  Topology
const N_TOPO = 14;
export function getTopology(n: number): number {
  return Math.min(N_TOPO - 1, Math.floor(nh(n, 0xBEEF) * N_TOPO));
}
const TV = (n: number) => Math.floor(nh(n, 0xCAFE) * 3);

// §5  Drawing primitives
type Ctx = CanvasRenderingContext2D;
type P2 = [number, number];

function fpoly(ctx: Ctx, pts: P2[], f: string, g: string, a: number, blur = 6): void {
  if (pts.length < 2) return;
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = f; ctx.shadowColor = g; ctx.shadowBlur = blur;
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 0.75; ctx.stroke(); ctx.restore();
}
function fell(ctx: Ctx, x: number, y: number, rx: number, ry: number, f: string, g: string, a: number, blur = 5): void {
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = f; ctx.shadowColor = g; ctx.shadowBlur = blur;
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(rx, 0.5), Math.max(ry, 0.5), 0, 0, Math.PI * 2);
  ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 0.75; ctx.stroke(); ctx.restore();
}
function fcirc(ctx: Ctx, x: number, y: number, r: number, f: string, g: string, a: number): void {
  fell(ctx, x, y, r, r, f, g, a);
}
function frect(ctx: Ctx, x: number, y: number, w: number, h: number, f: string, g: string, a: number): void {
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = f; ctx.shadowColor = g; ctx.shadowBlur = 5;
  ctx.fillRect(x, y, w, h); ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 0.75; ctx.strokeRect(x, y, w, h); ctx.restore();
}
function sline(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, col: string, a: number, lw = 1.2): void {
  ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
}
function gun(ctx: Ctx, bx: number, by: number, len: number, thick: number, f: string, g: string, a: number): void {
  frect(ctx, bx - len, by - thick, len, thick * 2, f, g, a + 0.04);
  fcirc(ctx, bx - len, by, thick * 0.8, f, g, a + 0.06);
}

// §6  14 topology drawers

// T0 MONOCOQUE
function drawT0(ctx: Ctx, cx: number, cy: number, R: number, n: number, f: string, g: string, A: number): void {
  const v = TV(n), L = [2.20,1.85,2.55][v], H = [0.44,0.56,0.36][v];
  ctx.save(); ctx.globalAlpha=A; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=8;
  ctx.beginPath();
  ctx.moveTo(cx-L*R,cy);
  ctx.bezierCurveTo(cx-L*R,cy-H*R*0.5,cx-H*R*1.5,cy-H*R,cx,cy-H*R);
  ctx.bezierCurveTo(cx+H*R*2.0,cy-H*R,cx+L*R*0.88,cy-H*R*0.35,cx+L*R,cy);
  ctx.bezierCurveTo(cx+L*R*0.88,cy+H*R*0.35,cx+H*R*2.0,cy+H*R,cx,cy+H*R);
  ctx.bezierCurveTo(cx-H*R*1.5,cy+H*R,cx-L*R,cy+H*R*0.5,cx-L*R,cy);
  ctx.closePath(); ctx.fill(); ctx.shadowBlur=0;
  ctx.strokeStyle='rgba(255,255,255,0.20)'; ctx.lineWidth=0.9; ctx.stroke(); ctx.restore();
  ctx.save(); ctx.globalAlpha=0.22; ctx.strokeStyle='rgba(255,255,255,0.9)'; ctx.lineWidth=0.6;
  for (let i=1;i<=4;i++){const rx=cx-L*R+i*(L*2*R/5);const hx=H*R*(1-Math.abs(rx-cx)/(L*R))*0.95;ctx.beginPath();ctx.moveTo(rx,cy-hx);ctx.lineTo(rx,cy+hx);ctx.stroke();}
  ctx.restore();
  gun(ctx,cx-L*R,cy,R*(0.50+nh(n,7)*0.35),R*0.065,f,g,A);
  const nN=v===1?3:2;
  for (let i=0;i<nN;i++){const ny=cy+(i-(nN-1)/2)*R*0.28;fpoly(ctx,[[cx+L*R,ny-R*0.07],[cx+L*R+R*0.28,ny-R*0.12],[cx+L*R+R*0.28,ny+R*0.12],[cx+L*R,ny+R*0.07]],f,g,A-0.16,3);}
}

// T1 CHASSIS_FRAME
function drawT1(ctx: Ctx, cx: number, cy: number, R: number, n: number, f: string, g: string, A: number): void {
  const v=TV(n),rW=R*2.0,sep=R*[0.48,0.62,0.38][v],rH=R*0.10,nX=[4,5,3][v];
  frect(ctx,cx-rW,cy-sep-rH,rW*2,rH*2,f,g,A);
  frect(ctx,cx-rW,cy+sep-rH,rW*2,rH*2,f,g,A);
  for (let i=0;i<=nX;i++){const rx=cx-rW+i*(rW*2/nX);frect(ctx,rx-R*0.055,cy-sep,R*0.11,sep*2,f,g,A-0.12);}
  fpoly(ctx,[[cx-rW,cy-sep*1.1],[cx-rW,cy+sep*1.1],[cx-rW-R*0.22,cy+sep*0.6],[cx-rW-R*0.22,cy-sep*0.6]],f,g,A+0.04);
  gun(ctx,cx-rW-R*0.22,cy,R*0.80,R*0.065,f,g,A);
  fpoly(ctx,[[cx+rW,cy-sep*1.3],[cx+rW+R*0.40,cy-sep*0.85],[cx+rW+R*0.40,cy+sep*0.85],[cx+rW,cy+sep*1.3]],f,g,A-0.06);
  const nM=v===2?1:2;
  for (let i=0;i<nM;i++){const bx=cx-rW*0.50+i*rW*0.70;const bh=sep*(0.50+nh(n,8+i)*0.30);frect(ctx,bx-R*0.17,cy-bh,R*0.34,bh*2,f,g,A-0.14);}
  for (let i=0;i<3;i++){const wx=cx-rW*0.68+i*rW*0.68;fcirc(ctx,wx,cy+sep+R*0.26,R*0.21,f,g,A-0.16);fcirc(ctx,wx,cy-sep-R*0.26,R*0.21,f,g,A-0.16);}
}

// T2 MULTI_HULL
function drawT2(ctx: Ctx, cx: number, cy: number, R: number, n: number, f: string, g: string, A: number): void {
  const v=TV(n),sep=R*[0.80,1.05,0.62][v],hL=R*[1.80,1.55,2.0][v],hH=R*[0.28,0.38,0.24][v];
  for (const s of [-1,1] as const){
    const hy=cy+s*sep;
    ctx.save();ctx.globalAlpha=A;ctx.fillStyle=f;ctx.shadowColor=g;ctx.shadowBlur=6;
    ctx.beginPath();ctx.moveTo(cx-hL,hy);
    ctx.bezierCurveTo(cx-hL,hy-hH*0.55,cx-hH*1.6,hy-hH,cx,hy-hH);
    ctx.bezierCurveTo(cx+hH*1.8,hy-hH,cx+hL*0.9,hy-hH*0.38,cx+hL,hy);
    ctx.bezierCurveTo(cx+hL*0.9,hy+hH*0.38,cx+hH*1.8,hy+hH,cx,hy+hH);
    ctx.bezierCurveTo(cx-hH*1.6,hy+hH,cx-hL,hy+hH*0.55,cx-hL,hy);
    ctx.closePath();ctx.fill();ctx.shadowBlur=0;
    ctx.strokeStyle='rgba(255,255,255,0.20)';ctx.lineWidth=0.85;ctx.stroke();ctx.restore();
    gun(ctx,cx-hL,hy,R*0.58,R*0.055,f,g,A);
    ctx.save();ctx.globalAlpha=0.18;ctx.strokeStyle='rgba(255,255,255,0.9)';ctx.lineWidth=0.55;
    for (let i=1;i<=3;i++){const rx=cx-hL+i*(hL*2/4);ctx.beginPath();ctx.moveTo(rx,hy-hH*0.9);ctx.lineTo(rx,hy+hH*0.9);ctx.stroke();}
    ctx.restore();
  }
  const bW=R*[0.18,0.24,0.15][v];
  frect(ctx,cx-bW,cy-sep+hH,bW*2,(sep-hH)*2,f,g,A-0.24);
  fpoly(ctx,[[cx-bW*2.5,cy-R*0.20],[cx-bW*2.5,cy+R*0.20],[cx-bW*4.0,cy]],f,g,A-0.10);
}

// T3 POD_CLUSTER
function drawT3(ctx: Ctx, cx: number, cy: number, R: number, n: number, f: string, g: string, A: number): void {
  const v=TV(n),nP=[4,5,4][v];
  const formations:P2[][]=[
    [[-1.0,0],[-0.1,-0.85],[-0.1,0.85],[0.9,0]],
    [[-1.0,0],[-0.25,-0.90],[-0.25,0.90],[0.65,-0.48],[0.65,0.48]],
    [[-1.0,0],[0.0,-0.95],[0.0,0.95],[1.0,0]],
  ];
  const form=formations[v],sizes=[0.38,0.27,0.27,0.23,0.22];
  for (let i=1;i<nP;i++){const px=cx+form[i][0]*R*1.85,py=cy+form[i][1]*R*1.85;sline(ctx,cx,cy,px,py,f,A-0.38,R*0.075);}
  if (nP>=4) sline(ctx,cx+form[1][0]*R*1.85,cy+form[1][1]*R*1.85,cx+form[2][0]*R*1.85,cy+form[2][1]*R*1.85,f,A-0.46,R*0.055);
  for (let i=0;i<nP;i++){
    const px=cx+form[i][0]*R*1.85,py=cy+form[i][1]*R*1.85;
    const pr=R*(sizes[i]||0.22)*(1+nh(n,10+i)*0.20);
    fell(ctx,px,py,pr*1.30,pr*(v===2?0.60:0.80),f,g,A-i*0.04);
    if (i===0) gun(ctx,px-pr*1.30,py,R*0.58,R*0.055,f,g,A);
  }
}

// T4 SEGMENTED_CHAIN
function drawT4(ctx: Ctx, cx: number, cy: number, R: number, n: number, f: string, g: string, A: number): void {
  const v=TV(n),nSeg=[5,6,4][v],pitch=R*[0.92,0.80,1.02][v];
  const totalW=pitch*(nSeg-1),startX=cx+totalW/2;
  const segScale=[0.52,0.46,0.42,0.38,0.34,0.30];
  for (let i=0;i<nSeg;i++){
    const sx=startX-i*pitch;
    const sRx=R*(segScale[i]||0.28)*(i===0?1.12:1.0),sRy=R*(segScale[i]||0.28);
    fell(ctx,sx,cy,sRx,sRy,f,g,A-i*0.05);
    if (i<nSeg-1){const nRx=R*(segScale[i+1]||0.28);frect(ctx,sx-pitch+nRx*0.88,cy-R*0.06,pitch-sRx*0.88-nRx*0.88,R*0.12,f,g,A-0.36);}
    if (i===0) gun(ctx,sx+sRx,cy,R*0.68,R*0.065,f,g,A);
    if (i===nSeg-1) fpoly(ctx,[[sx-sRx,cy-sRy*0.55],[sx-sRx-R*0.30,cy-sRy*0.80],[sx-sRx-R*0.30,cy+sRy*0.80],[sx-sRx,cy+sRy*0.55]],f,g,A-0.16,3);
  }
}

// T5 EXOSKELETON
function drawT5(ctx: Ctx, cx: number, cy: number, R: number, n: number, f: string, g: string, A: number): void {
  const v=TV(n),nRib=[6,5,7][v],innW=R*[0.60,0.70,0.55][v],innH=R*[0.44,0.52,0.40][v];
  const ribExt=R*[0.68,0.58,0.75][v],ribW=R*0.075;
  fell(ctx,cx,cy,innW,innH,f,g,A-0.10);
  for (let i=0;i<nRib;i++){
    const a=(i/nRib)*Math.PI*2-Math.PI/2;
    const bx=cx+innW*Math.cos(a),by=cy+innH*Math.sin(a);
    const ex=cx+(innW+ribExt)*Math.cos(a),ey=cy+(innH+ribExt)*Math.sin(a);
    ctx.save();ctx.globalAlpha=A;ctx.strokeStyle=f;ctx.lineWidth=ribW*2;ctx.shadowColor=g;ctx.shadowBlur=5;
    ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(ex,ey);ctx.stroke();ctx.shadowBlur=0;
    ctx.strokeStyle='rgba(255,255,255,0.20)';ctx.lineWidth=0.7;
    ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(ex,ey);ctx.stroke();ctx.restore();
    fcirc(ctx,ex,ey,ribW*1.2,f,g,A-0.12);
  }
  gun(ctx,cx-innW,cy,R*0.78,R*0.065,f,g,A);
}

// T6 WALKER_FRAME
function drawT6(ctx: Ctx, cx: number, cy: number, R: number, n: number, f: string, g: string, A: number): void {
  const v=TV(n),nPair=[3,4,2][v],legSpan=R*[1.42,1.70,1.20][v];
  const bodyW=R*[0.72,0.65,0.90][v],bodyH=R*0.38,bodyY=cy-R*0.65;
  for (let i=0;i<nPair;i++){
    const t=nPair>1?i/(nPair-1):0.5,lx=cx-legSpan+t*legSpan*2;
    for (const s of [-1,1] as const){
      const kx=lx+s*R*0.20,ky=bodyY+bodyH+R*0.58;
      const fx=lx+s*R*0.38,fy=ky+R*(0.52+nh(n,12+i)*0.28);
      fpoly(ctx,[[lx-R*0.06,bodyY+bodyH],[lx+R*0.06,bodyY+bodyH],[kx+R*0.07,ky],[kx-R*0.07,ky]],f,g,A-0.13);
      fcirc(ctx,kx,ky,R*0.09,f,g,A-0.10);
      fpoly(ctx,[[kx-R*0.06,ky],[kx+R*0.06,ky],[fx+R*0.06,fy],[fx-R*0.06,fy]],f,g,A-0.17);
      fpoly(ctx,[[fx-R*0.20,fy],[fx+R*0.20,fy],[fx+R*0.17,fy+R*0.13],[fx-R*0.17,fy+R*0.13]],f,g,A-0.22);
    }
  }
  frect(ctx,cx-bodyW,bodyY,bodyW*2,bodyH*2,f,g,A);
  gun(ctx,cx-bodyW,bodyY+bodyH,R*0.72,R*0.065,f,g,A);
  fell(ctx,cx,bodyY-R*0.12,R*0.26,R*0.17,f,g,A-0.10);
}

// T7 CRAWLER_BED
function drawT7(ctx: Ctx, cx: number, cy: number, R: number, n: number, f: string, g: string, A: number): void {
  const v=TV(n),trkW=R*[2.35,2.60,2.10][v],trkH=R*[0.32,0.40,0.28][v];
  const hullW=R*[0.75,0.85,0.65][v],hullH=R*[0.50,0.58,0.42][v];
  fpoly(ctx,[[cx-trkW-R*0.12,cy-trkH],[cx+trkW+R*0.12,cy-trkH],[cx+trkW,cy+trkH],[cx-trkW,cy+trkH]],f,g,A-0.04);
  ctx.save();ctx.globalAlpha=0.28;ctx.strokeStyle='rgba(255,255,255,0.8)';ctx.lineWidth=R*0.08;
  for (let i=0;i<=14;i++){const tx=cx-trkW+i*(trkW*2/14);ctx.beginPath();ctx.moveTo(tx,cy-trkH+R*0.03);ctx.lineTo(tx,cy+trkH-R*0.03);ctx.stroke();}
  ctx.restore();
  fcirc(ctx,cx-trkW,cy,trkH*0.60,f,g,A-0.06);fcirc(ctx,cx+trkW,cy,trkH*0.60,f,g,A-0.06);
  for (const dx of [cx-trkW*0.50,cx,cx+trkW*0.50]) fcirc(ctx,dx,cy,trkH*0.35,f,g,A-0.20);
  frect(ctx,cx-hullW,cy-trkH-hullH,hullW*2,hullH,f,g,A+0.04);
  fell(ctx,cx-hullW*0.28,cy-trkH-hullH-R*0.22,R*0.30,R*0.20,f,g,A-0.06);
  gun(ctx,cx-hullW*0.28-R*0.30,cy-trkH-hullH-R*0.22,R*0.92,R*0.065,f,g,A);
}

// T8 RING_STRUCTURE
function drawT8(ctx: Ctx, cx: number, cy: number, R: number, n: number, f: string, g: string, A: number): void {
  const v=TV(n),oR=R*[1.28,1.48,1.12][v],ringW=R*[0.20,0.18,0.24][v],iR=oR-ringW*2.2,nSpk=[4,6,3][v];
  ctx.save();ctx.globalAlpha=A;ctx.strokeStyle=f;ctx.lineWidth=ringW*2.2;ctx.shadowColor=g;ctx.shadowBlur=10;
  ctx.beginPath();ctx.arc(cx,cy,oR-ringW,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;
  ctx.strokeStyle='rgba(255,255,255,0.22)';ctx.lineWidth=0.85;
  ctx.beginPath();ctx.arc(cx,cy,oR,0,Math.PI*2);ctx.stroke();
  ctx.beginPath();ctx.arc(cx,cy,iR,0,Math.PI*2);ctx.stroke();ctx.restore();
  for (let i=0;i<nSpk;i++){
    const a=(i/nSpk)*Math.PI*2;
    ctx.save();ctx.globalAlpha=A-0.14;ctx.strokeStyle=f;ctx.lineWidth=R*0.11;ctx.shadowColor=g;ctx.shadowBlur=4;
    ctx.beginPath();ctx.moveTo(cx+iR*0.22*Math.cos(a),cy+iR*0.22*Math.sin(a));ctx.lineTo(cx+iR*Math.cos(a),cy+iR*Math.sin(a));ctx.stroke();ctx.shadowBlur=0;
    ctx.strokeStyle='rgba(255,255,255,0.16)';ctx.lineWidth=0.7;
    ctx.beginPath();ctx.moveTo(cx+iR*0.22*Math.cos(a),cy+iR*0.22*Math.sin(a));ctx.lineTo(cx+iR*Math.cos(a),cy+iR*Math.sin(a));ctx.stroke();ctx.restore();
  }
  fcirc(ctx,cx,cy,iR*0.26,f,g,A-0.12);
  gun(ctx,cx-oR,cy,R*0.72,R*0.065,f,g,A);
  for (const s of [-1,1] as const){const ta=s*0.40;fell(ctx,cx+oR*Math.cos(ta)+R*0.16,cy+oR*Math.sin(ta),R*0.20,R*0.10,f,g,A-0.18);}
}

// T9 BOOM_FRAME
function drawT9(ctx: Ctx, cx: number, cy: number, R: number, n: number, f: string, g: string, A: number): void {
  const v=TV(n),boomL=R*[2.20,1.85,2.55][v],boomW=R*0.085,bodyHW=R*0.35;
  const boomDefs:[number,boolean][]=v===2
    ?[[Math.PI,true],[0,false],[-Math.PI/2,false],[Math.PI/2,false]]
    :[[Math.PI,true],[0,false],[-Math.PI/2,false],...(v===0?[]:[[Math.PI/2,false]] as [number,boolean][])];
  for (const [angle,isWeapon] of boomDefs){
    const bx=cx+bodyHW*Math.cos(angle),by=cy+bodyHW*Math.sin(angle);
    const ex=cx+boomL*Math.cos(angle),ey=cy+boomL*Math.sin(angle);
    ctx.save();ctx.globalAlpha=A-0.10;ctx.strokeStyle=f;ctx.lineWidth=boomW*2.2;ctx.shadowColor=g;ctx.shadowBlur=5;
    ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(ex,ey);ctx.stroke();ctx.shadowBlur=0;
    ctx.strokeStyle='rgba(255,255,255,0.16)';ctx.lineWidth=0.7;
    ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(ex,ey);ctx.stroke();ctx.restore();
    if (isWeapon) gun(ctx,ex,ey,R*0.65,R*0.065,f,g,A);
    else fcirc(ctx,ex,ey,R*0.16,f,g,A-0.14);
  }
  frect(ctx,cx-bodyHW,cy-bodyHW*0.72,bodyHW*2,bodyHW*1.44,f,g,A+0.02);
}

// T10 SHELL_CORE
function drawT10(ctx: Ctx, cx: number, cy: number, R: number, n: number, f: string, g: string, A: number): void {
  const v=TV(n),oR=R*[1.15,1.28,1.05][v],nSides=[6,8,5][v];
  const pts:P2[]=[];
  for (let i=0;i<nSides;i++){const a=(i/nSides)*Math.PI*2-Math.PI/2;pts.push([cx+oR*Math.cos(a),cy+oR*Math.sin(a)]);}
  ctx.save();ctx.globalAlpha=A-0.20;ctx.strokeStyle=f;ctx.lineWidth=R*0.15;ctx.shadowColor=g;ctx.shadowBlur=7;
  ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);for (let i=1;i<pts.length;i++) ctx.lineTo(pts[i][0],pts[i][1]);ctx.closePath();ctx.stroke();ctx.shadowBlur=0;
  ctx.strokeStyle='rgba(255,255,255,0.22)';ctx.lineWidth=0.85;
  ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);for (let i=1;i<pts.length;i++) ctx.lineTo(pts[i][0],pts[i][1]);ctx.closePath();ctx.stroke();ctx.restore();
  const cR=oR*0.52;
  if (v===0) fpoly(ctx,[[cx-cR,cy],[cx,cy-cR*0.75],[cx+cR,cy],[cx,cy+cR*0.75]],f,g,A);
  else if (v===1) fcirc(ctx,cx,cy,cR,f,g,A);
  else frect(ctx,cx-cR*0.88,cy-cR*0.65,cR*1.76,cR*1.30,f,g,A);
  ctx.save();ctx.globalAlpha=A-0.32;ctx.strokeStyle=f;ctx.lineWidth=R*0.065;
  for (let i=1;i<nSides;i+=2){const a=(i/nSides)*Math.PI*2-Math.PI/2;ctx.beginPath();ctx.moveTo(cx+cR*Math.cos(a),cy+cR*Math.sin(a));ctx.lineTo(cx+oR*0.90*Math.cos(a),cy+oR*0.90*Math.sin(a));ctx.stroke();}
  ctx.restore();
  gun(ctx,cx-oR,cy,R*0.80,R*0.065,f,g,A);
}

// T11 DISTRIBUTED_NODE
function drawT11(ctx: Ctx, cx: number, cy: number, R: number, n: number, f: string, g: string, A: number): void {
  const v=TV(n),nN=[6,7,5][v];
  const nodes:P2[]=[];
  for (let i=0;i<nN;i++){const a=(i/nN)*Math.PI*2+nh(n,30+i)*0.5-0.25;const d=R*(0.82+nh(n,50+i)*0.68);nodes.push([cx+d*Math.cos(a),cy+d*Math.sin(a)]);}
  for (let i=0;i<nN;i++){const ni=(i+1)%nN;sline(ctx,nodes[i][0],nodes[i][1],nodes[ni][0],nodes[ni][1],f,A-0.30,R*0.082);}
  for (let i=0;i<Math.floor(nN/2);i++){const ni=(i+2)%nN;sline(ctx,nodes[i][0],nodes[i][1],nodes[ni][0],nodes[ni][1],f,A-0.44,R*0.060);}
  const nSizes=[0.28,0.24,0.22,0.20,0.20,0.18,0.18];
  for (let i=0;i<nN;i++){const nr=R*(nSizes[i]||0.16)*(1+nh(n,70+i)*0.22);fell(ctx,nodes[i][0],nodes[i][1],nr,nr*[0.90,0.70,0.85][v],f,g,A-i*0.04);}
  let li=0;for (let i=1;i<nN;i++) if (nodes[i][0]<nodes[li][0]) li=i;
  gun(ctx,nodes[li][0]-R*(nSizes[li]||0.20),nodes[li][1],R*0.55,R*0.055,f,g,A);
}

// T12 WING_BODY
function drawT12(ctx: Ctx, cx: number, cy: number, R: number, n: number, f: string, g: string, A: number): void {
  const v=TV(n),span=R*[2.10,2.55,1.80][v],swp=[0.55,0.28,0.78][v],fL=R*0.58,fH=R*0.13;
  for (const s of [-1,1] as const){
    fpoly(ctx,[[cx-fL,cy+s*fH],[cx-fL*swp,cy+s*span],[cx+fL*0.62,cy+s*span*0.52],[cx+fL,cy+s*fH]],f,g,A-0.06);
    fell(ctx,cx-fL*swp+R*0.10,cy+s*span,R*0.17,R*0.10,f,g,A-0.18);
    ctx.save();ctx.globalAlpha=A-0.22;ctx.strokeStyle='rgba(255,255,255,0.65)';ctx.lineWidth=0.8;
    ctx.beginPath();ctx.moveTo(cx-fL,cy+s*fH);ctx.lineTo(cx-fL*swp,cy+s*span);ctx.stroke();ctx.restore();
  }
  ctx.save();ctx.globalAlpha=A;ctx.fillStyle=f;ctx.shadowColor=g;ctx.shadowBlur=6;
  ctx.beginPath();
  ctx.moveTo(cx-fL*1.22,cy);
  ctx.bezierCurveTo(cx-fL*1.22,cy-fH*0.88,cx-fH,cy-fH,cx,cy-fH);
  ctx.bezierCurveTo(cx+fH*1.5,cy-fH,cx+fL*1.05,cy-fH*0.38,cx+fL*1.18,cy);
  ctx.bezierCurveTo(cx+fL*1.05,cy+fH*0.38,cx+fH*1.5,cy+fH,cx,cy+fH);
  ctx.bezierCurveTo(cx-fH,cy+fH,cx-fL*1.22,cy+fH*0.88,cx-fL*1.22,cy);
  ctx.closePath();ctx.fill();ctx.shadowBlur=0;
  ctx.strokeStyle='rgba(255,255,255,0.22)';ctx.lineWidth=0.85;ctx.stroke();ctx.restore();
  gun(ctx,cx-fL*1.22,cy,R*0.68,R*0.055,f,g,A);
  for (const s of [-1,1] as const) fell(ctx,cx+fL*0.55,cy+s*fH*2.4,R*0.26,R*0.11,f,g,A-0.15);
}

// T13 ASYMMETRIC
function drawT13(ctx: Ctx, cx: number, cy: number, R: number, n: number, f: string, g: string, A: number): void {
  const v=TV(n),side=nh(n,0x5A)<0.5?-1:1,bigY=cy+side*R*0.62,smY=cy-side*R*0.72;
  ctx.save();ctx.globalAlpha=A;ctx.fillStyle=f;ctx.shadowColor=g;ctx.shadowBlur=8;
  ctx.beginPath();
  ctx.moveTo(cx-R*1.55,bigY);
  ctx.bezierCurveTo(cx-R*1.55,bigY-R*0.68,cx-R*0.18,bigY-R*0.72,cx+R*0.88,bigY-R*0.55);
  ctx.lineTo(cx+R*1.10,bigY-R*0.20);ctx.lineTo(cx+R*1.10,bigY+R*0.55);
  ctx.bezierCurveTo(cx+R*0.22,bigY+R*0.70,cx-R*1.55,bigY+R*0.62,cx-R*1.55,bigY);
  ctx.closePath();ctx.fill();ctx.shadowBlur=0;
  ctx.strokeStyle='rgba(255,255,255,0.20)';ctx.lineWidth=0.85;ctx.stroke();ctx.restore();
  if (v===1) fell(ctx,cx-R*0.32,smY,R*0.62,R*0.30,f,g,A-0.14);
  else fpoly(ctx,[[cx-R*0.90,smY-R*0.28],[cx+R*0.34,smY-R*0.24],[cx+R*0.52,smY+R*0.28],[cx-R*0.72,smY+R*0.28]],f,g,A-0.14);
  fpoly(ctx,[[cx-R*0.82,bigY-side*R*0.46],[cx-R*0.56,bigY-side*R*0.46],[cx-R*0.20,smY+side*R*0.26],[cx-R*0.46,smY+side*R*0.26]],f,g,A-0.30);
  gun(ctx,cx-R*1.55,bigY,R*0.78,R*0.065,f,g,A);
  fpoly(ctx,[[cx+R*0.88,bigY+side*R*0.32],[cx+R*1.10,bigY+side*R*0.32],[cx+R*1.28,bigY+side*R*0.75],[cx+R*0.75,bigY+side*R*0.75]],f,g,A-0.12);
}

// §7  Class mark overlay
function drawClassMark(ctx: Ctx, cx: number, cy: number, R: number, cls: VirusClass): void {
  ctx.save();ctx.globalAlpha=0.28;ctx.strokeStyle='rgba(255,255,255,0.85)';ctx.lineWidth=0.75;ctx.shadowBlur=0;
  switch (cls){
    case 'prime':
      for (let i=0;i<6;i++){const a=(i/6)*Math.PI*2;ctx.beginPath();ctx.moveTo(cx+R*0.12*Math.cos(a),cy+R*0.12*Math.sin(a));ctx.lineTo(cx+R*0.28*Math.cos(a),cy+R*0.28*Math.sin(a));ctx.stroke();}
      break;
    case 'power-of-two': ctx.strokeRect(cx-R*0.16,cy-R*0.16,R*0.32,R*0.32); break;
    case 'perfect-square': ctx.beginPath();ctx.arc(cx,cy,R*0.22,0,Math.PI*2);ctx.stroke(); break;
    case 'even-composite':
      ctx.beginPath();ctx.moveTo(cx-R*0.24,cy-R*0.10);ctx.lineTo(cx+R*0.24,cy-R*0.10);ctx.stroke();
      ctx.beginPath();ctx.moveTo(cx-R*0.24,cy+R*0.10);ctx.lineTo(cx+R*0.24,cy+R*0.10);ctx.stroke(); break;
    case 'odd-composite':{const t=R*0.20;ctx.beginPath();ctx.moveTo(cx,cy-t);ctx.lineTo(cx+t*0.87,cy+t*0.5);ctx.lineTo(cx-t*0.87,cy+t*0.5);ctx.closePath();ctx.stroke();break;}
  }
  ctx.restore();
}

// §8  Main draw entry point — signature unchanged
const TOPO_DRAW = [drawT0,drawT1,drawT2,drawT3,drawT4,drawT5,drawT6,drawT7,drawT8,drawT9,drawT10,drawT11,drawT12,drawT13];

export function drawVirus(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  n: number, cell: number,
  flash: boolean,
  green = false,
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

// §9  Silhouette validation
export function drawVirusSilhouette(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, n: number, cell: number,
): void {
  const R = cell * 0.22 + cell * 0.016 * Math.log2(n + 1);
  ctx.save();
  TOPO_DRAW[getTopology(n)](ctx, cx, cy, R, n, '#000000', '#000000', 1.0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = '#000000';
  ctx.fillRect(cx - R * 3.5, cy - R * 3.5, R * 7, R * 7);
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

export function runSilhouetteDiversityTest(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const seeds=[37,14,25,63,47,18,71,40,53,29,89,56,100,172,121,94,200,160,213,177];
  const C=5,cW=w/C,cH=h/4,cell=Math.min(cW,cH)*0.52;
  const names=['MONO','FRAME','MHULL','PODS','CHAIN','EXO','WALK','CRAWL','RING','BOOM','SHELL','NODES','WING','ASYM'];
  ctx.fillStyle='#f0f4f8';ctx.fillRect(0,0,w,h);
  ctx.fillStyle='#1e293b';ctx.font=`${Math.round(cell*0.10)}px monospace`;ctx.textAlign='center';
  ctx.fillText('SILHOUETTE DIVERSITY TEST',w/2,cell*0.09);
  const topoSet=new Set<number>();
  for (let i=0;i<seeds.length;i++){
    const seed=seeds[i],col=i%C,row=Math.floor(i/C);
    const ex=cW*(col+0.5),ey=cH*(row+0.5)+cell*0.08;
    const t=getTopology(seed);topoSet.add(t);
    drawVirusSilhouette(ctx,ex,ey,seed,cell);
    ctx.fillStyle='#334155';ctx.font=`${Math.round(cell*0.085)}px monospace`;ctx.textAlign='center';
    ctx.fillText(`T${t} ${names[t]}`,ex,ey+cell*0.35);
  }
  const passed=topoSet.size>=10;
  ctx.font=`${Math.round(cell*0.095)}px monospace`;ctx.textAlign='center';
  ctx.fillStyle=passed?'#064e3b':'#7f1d1d';
  ctx.fillText(`${passed?'PASS':'FAIL'} -- ${topoSet.size}/14 topologies: ${[...topoSet].map(t=>names[t]).join(' ')}`,w/2,h-cell*0.12);
  console.log('[SilhouetteTest]',passed?'PASS':'FAIL',[...topoSet].map(t=>names[t]));
}

// §10  MorphSig + diversity helpers
export interface MorphSig {
  topology: number; variant: number; cls: number; aspectGroup: number; massCenter: number;
}
const TOPO_META:[number,number][]=[
  [2,0],[2,1],[2,1],[4,2],[2,0],[4,1],[0,2],[2,1],[4,2],[4,2],[4,1],[4,2],[1,0],[1,3],
];
const VC_O:VirusClass[]=['prime','power-of-two','perfect-square','even-composite','odd-composite'];

export function getMorphSig(n: number): MorphSig {
  const t=getTopology(n);
  return {topology:t,variant:TV(n),cls:VC_O.indexOf(getVirusClass(n)),aspectGroup:TOPO_META[t][0],massCenter:TOPO_META[t][1]};
}
export function morphDistance(a: MorphSig, b: MorphSig): number {
  let d=0;
  d+=(a.topology!==b.topology?1:0)*0.55;d+=(a.aspectGroup!==b.aspectGroup?1:0)*0.18;
  d+=(a.massCenter!==b.massCenter?1:0)*0.12;d+=(a.cls!==b.cls?1:0)*0.10;d+=(a.variant!==b.variant?1:0)*0.05;
  return d;
}
export function selectDiverseSeed(waveSigs: MorphSig[], crossHistory: MorphSig[]): number {
  const all=[...crossHistory.slice(-6),...waveSigs];let best=-1,bestScore=-1;
  for (let attempt=0;attempt<32;attempt++){
    const seed=Math.floor(Math.random()*255)+1,sig=getMorphSig(seed);
    let wMin=1.0;for (const ws of all){const d=morphDistance(sig,ws);if (d<wMin) wMin=d;}
    const sharedTopo=all.filter(ws=>ws.topology===sig.topology).length;
    const score=wMin*Math.pow(0.55,sharedTopo);
    if (score>bestScore){bestScore=score;best=seed;}
  }
  return best>0?best:Math.floor(Math.random()*255)+1;
}

const SPAWN_WIN=12,MIN_DIST=0.18,MAX_SAME_T=3;
const _hist:MorphSig[]=[];
export function registerSpawn(sig: MorphSig): void {_hist.push(sig);if (_hist.length>SPAWN_WIN) _hist.shift();}
export function clearSpawnHistory(): void {_hist.length=0;}
export function pickDiverseSeed(): number {
  let best=-1,bestScore=-Infinity;
  for (let i=0;i<40;i++){
    const seed=1+((i*97+Math.floor(Math.random()*22))%255),sig=getMorphSig(seed);
    const tC=_hist.filter(s=>s.topology===sig.topology).length;
    if (tC>=MAX_SAME_T) continue;
    let minD=1.0;for (const s of _hist){const d=morphDistance(sig,s);if (d<minD) minD=d;}
    if (minD<MIN_DIST) continue;
    const sc=minD*Math.pow(0.50,tC);if (sc>bestScore){bestScore=sc;best=seed;}
  }
  return best>0?best:1+Math.floor(Math.random()*255);
}

// §11  Distribution validator
export function validateDistribution(sampleSize=256):{topoCounts:number[];maxTopoFrac:number;uniqueTopologies:number;passed:boolean;} {
  const tc=new Array(N_TOPO).fill(0);
  for (let i=0;i<sampleSize;i++) tc[getTopology(Math.floor(Math.random()*255)+1)]++;
  const maxTC=Math.max(...tc),maxFrac=maxTC/sampleSize,unique=tc.filter(c=>c>0).length;
  const passed=maxFrac<=0.14&&unique>=12;
  if (!passed) console.warn('[Morphology] FAIL',{maxFrac:maxFrac.toFixed(3),tc});
  else console.log('[Morphology] OK -- unique:',unique,'maxFrac:',maxFrac.toFixed(3));
  return {topoCounts:tc,maxTopoFrac:maxFrac,uniqueTopologies:unique,passed};
}

// §12  Legacy shims
export function getVirusRadius(n: number, R0: number, k: number): number {return R0+k*Math.log2(n+1);}

const ARCHS:VirusArchetype[]=[
  'biological','humanoid','animal','insectoid','mechanical','armored','crystalline',
  'mineral','plant','synthetic','robotic','amorphous','geometric','energy','cybernetic','skeletal','fluid',
];
export function getVirusModelProfile(value: number): VirusModelProfile {
  const pi=Math.floor(nh(value,1)*ARCHS.length);
  let si=Math.floor(nh(value,2)*ARCHS.length);if (si===pi) si=(si+1)%ARCHS.length;
  const pw=0.6+nh(value,3)*0.4;
  return {
    primaryArchetype:ARCHS[pi],secondaryArchetype:ARCHS[si],primaryWeight:pw,secondaryWeight:1-pw,
    structureLevel:nh(value,4),symmetryLevel:nh(value,5),armorLevel:nh(value,6),
    organicLevel:nh(value,7),mechanicalLevel:nh(value,8),crystallineLevel:nh(value,9),energyLevel:nh(value,10),
  };
}
export function getCompatibilityScore(profile: VirusModelProfile, model: VirusVisualModel, lobes: number, symmetryLevel: number): number {
  const am=model.archetypes.includes(profile.primaryArchetype)?1:model.archetypes.includes(profile.secondaryArchetype)?0.5:0;
  const minL=model.compatibleFeatures.minLobes??3,maxL=model.compatibleFeatures.maxLobes??8;
  const [sMin,sMax]=model.compatibleFeatures.symmetryRange??[0,1];
  return am*0.40+(lobes>=minL&&lobes<=maxL?1:0)*0.25+(symmetryLevel>=sMin&&symmetryLevel<=sMax?1:0)*0.15;
}
