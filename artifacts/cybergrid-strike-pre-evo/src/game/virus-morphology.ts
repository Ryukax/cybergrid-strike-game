/**
 * CyberGrid Strike — Entity Morphology v9 — STRUCTURAL COHERENCE
 *
 * 24 distinct silhouette families (6 phyla × 4 clades).
 * Every body is a coherent whole: parts anchor to computed surface points,
 * animations are typed to locomotion, no fish-heads, no rectangular torsos.
 *
 * Phyla:
 *   0  CEPHALOPODA   0=Bell Medusa  1=Flat Disc  2=Ammonite Coil  3=Hook Parasite
 *   1  ARTHROPODA    0=Bilobate Spider  1=Shield Crab  2=Chain Centipede  3=Barnacle
 *   2  FUNGI         0=Mushroom  1=Zombie Burst  2=Directional Amoeba  3=Node Web
 *   3  VASCULAR      0=Snap Trap  1=Root Walker  2=Polyp Colony  3=Tendril Star
 *   4  CRYSTALLINE   0=Spire Cluster  1=Geode Bowl  2=Lattice Bubble  3=Bone Cage
 *   5  CHIMERA       0=Tentacle-Legged  1=Fungal Root-Ball  2=Crystal-Wrapped Ceph  3=Armored Crystal Growth
 */

// ═══════════════════════════════════════════════════════════
// §0  EXPORTED LEGACY TYPES (unchanged signatures)
// ═══════════════════════════════════════════════════════════
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

/** Passed from renderer each frame — all fields optional for backward compat. */
export interface EntityDrawContext {
  hpFrac:     number;
  row:        number;
  colPos:     number;
  playerRow:  number;
  playerDist: number;
}

// ═══════════════════════════════════════════════════════════
// §1  HASH + MATH UTILITIES
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

// ═══════════════════════════════════════════════════════════
// §2  LINEAGE SELECTORS
// ═══════════════════════════════════════════════════════════
export const PHYLUM = (n: number): number => Math.floor(nh(n, 0xF00D) * 6);
export const CLADE  = (n: number): number => Math.floor(nh(n, 0xC1AD) * 4);
export const STAGE  = (n: number): number => {
  const base = Math.min(3, Math.floor(n / 64));
  const jitter = Math.floor(nh(n, 0x5715) * 2.99) - 1;
  return Math.max(0, Math.min(3, base + jitter));
};
export const MICRO  = (n: number): number => Math.floor(nh(n, 0xBABE) * 3);
const N_TOPO = 24;
export function getTopology(n: number): number { return Math.min(N_TOPO-1, PHYLUM(n)*4+CLADE(n)); }

// Silhouette family (0-15) — used for substrate-avoidance
export function getSilhouetteFamily(n: number): number {
  return PHYLUM(n) * 4 + CLADE(n);
}

// ═══════════════════════════════════════════════════════════
// §3  LINEAGE COLOR SYSTEM
// ═══════════════════════════════════════════════════════════
const PH_HUE  = [285,  38, 205, 120, 183,   0];
const PH_SAT  = [ 72,  68,  58,  70,  55,  65];
const PH_LIT  = [ 60,  50,  65,  45,  63,  58];
const CL_HUE_S = [-18, -6,   6,  18];
const ST_SAT_M = [0.70, 0.85, 1.00, 0.92];
const ST_LIT_M = [1.14, 1.05, 1.00, 0.88];

type LColor = { f: string; g: string; acc: string };

function lineageColors(n: number, flash: boolean, green?: boolean): LColor {
  if (flash) return { f:'rgba(255,255,255,0.95)', g:'rgba(255,255,255,0.85)', acc:'rgba(255,255,255,0.70)' };
  if (green) return { f:'#22c55e', g:'rgba(34,197,94,0.60)', acc:'#86efac' };
  const ph = PHYLUM(n), cl = CLADE(n), st = STAGE(n);
  let h: number;
  if (ph === 5) {
    const p1 = Math.floor(nh(n, 0xC1A1) * 5);
    const p2 = (p1 + 1 + Math.floor(nh(n, 0xC1A2) * 4)) % 5;
    h = ((PH_HUE[p1] + PH_HUE[p2]) / 2 + 360) % 360;
  } else {
    h = (PH_HUE[ph] + CL_HUE_S[cl] + 360) % 360;
  }
  const pIdx = ph < 5 ? ph : 2;
  const s = PH_SAT[pIdx] * ST_SAT_M[st];
  const l = PH_LIT[pIdx] * ST_LIT_M[st];
  const f   = `hsl(${h.toFixed(0)},${s.toFixed(0)}%,${l.toFixed(0)}%)`;
  const g   = `hsla(${h.toFixed(0)},${Math.min(100,s+10).toFixed(0)}%,${Math.max(10,l-22).toFixed(0)}%,0.62)`;
  const acc = `hsl(${((h+45)%360).toFixed(0)},${s.toFixed(0)}%,${Math.min(88,l+22).toFixed(0)}%)`;
  return { f, g, acc };
}

// ═══════════════════════════════════════════════════════════
// §4  ANIMATION UTILITIES — locomotion-typed
// ═══════════════════════════════════════════════════════════
function wave(t: number, n: number, freq: number, amp: number): number {
  return Math.sin(t * 0.001 * freq * Math.PI * 2 + nh(n, 0xA1A1) * Math.PI * 2) * amp;
}
function pulse(t: number, n: number, freq: number): number {
  return (Math.sin(t * 0.001 * freq * Math.PI * 2 + nh(n, 0xB2B2) * Math.PI * 2) + 1) * 0.5;
}
// Gait: returns 0-1 lift for a given leg index
function stepGait(t: number, n: number, leg: number, totalLegs: number, freq: number): number {
  const phase = nh(n, 0xC3C3) * Math.PI * 2 + (leg / totalLegs) * Math.PI * 2;
  return Math.max(0, Math.sin(t * 0.001 * freq * Math.PI * 2 + phase));
}
// Serpentine wave angle for segment i of total at time t
function serpentAngle(t: number, n: number, segI: number, total: number, amp: number): number {
  const phase = (segI / total) * Math.PI * 2;
  return Math.sin(t * 0.001 * 2.2 * Math.PI * 2 - phase + nh(n, 0xD4D4) * Math.PI * 2) * amp;
}
// Bell contraction (medusa jet pulse): 0=relaxed, 1=max contract
function bellContract(t: number, n: number): number {
  return Math.max(0, Math.sin(t * 0.001 * 1.6 * Math.PI * 2 + nh(n, 0xE5E5) * Math.PI * 2));
}
// Alert: lean toward player proportional to proximity
function alertLean(playerDist: number): number {
  return Math.max(0, 1 - playerDist / 3) * 0.20;
}
// Damage shake: erratic jitter at low HP
function damageShake(t: number, hpFrac: number): number {
  if (hpFrac > 0.55) return 0;
  return Math.sin(t * 0.038 + nh(Math.floor(t * 0.01), 0xF6F6) * 9) * ((0.55 - hpFrac) / 0.55) * 5;
}
// Trap snap: open when far, snap shut when player close
function trapOpen(playerDist: number, t: number, n: number): number {
  const base = Math.min(1, playerDist / 2);          // 0=player here, 1=far
  const flutter = pulse(t, n, 0.35) * 0.12 * base;  // subtle idle flutter
  return Math.max(0.04, base - 0.08 + flutter);
}

// ═══════════════════════════════════════════════════════════
// §5  DRAWING PRIMITIVES
// ═══════════════════════════════════════════════════════════
type Ctx = CanvasRenderingContext2D; type P2 = [number,number];

function fpoly(ctx:Ctx,pts:P2[],f:string,g:string,a:number,blur=6): void {
  if (pts.length<2) return;
  ctx.save(); ctx.globalAlpha=a; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=blur;
  ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]);
  for (let i=1;i<pts.length;i++) ctx.lineTo(pts[i][0],pts[i][1]);
  ctx.closePath(); ctx.fill(); ctx.shadowBlur=0;
  ctx.strokeStyle='rgba(255,255,255,0.14)'; ctx.lineWidth=0.7; ctx.stroke(); ctx.restore();
}
function fell(ctx:Ctx,x:number,y:number,rx:number,ry:number,f:string,g:string,a:number,blur=5): void {
  ctx.save(); ctx.globalAlpha=a; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=blur;
  ctx.beginPath(); ctx.ellipse(x,y,Math.max(rx,0.5),Math.max(ry,0.5),0,0,Math.PI*2);
  ctx.fill(); ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,0.14)'; ctx.lineWidth=0.7; ctx.stroke(); ctx.restore();
}
function fcirc(ctx:Ctx,x:number,y:number,r:number,f:string,g:string,a:number,blur=5): void { fell(ctx,x,y,r,r,f,g,a,blur); }
function sline(ctx:Ctx,x1:number,y1:number,x2:number,y2:number,col:string,a:number,lw=1.2): void {
  ctx.save(); ctx.globalAlpha=a; ctx.strokeStyle=col; ctx.lineWidth=lw;
  ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); ctx.restore();
}
function sarc(ctx:Ctx,cx:number,cy:number,r:number,a0:number,a1:number,col:string,a:number,lw:number,blur=0): void {
  ctx.save(); ctx.globalAlpha=a; ctx.strokeStyle=col; ctx.lineWidth=lw; ctx.shadowColor=col; ctx.shadowBlur=blur;
  ctx.beginPath(); ctx.arc(cx,cy,Math.max(r,0.5),a0,a1); ctx.stroke(); ctx.restore();
}
// Organic blob with per-vertex noise
function oblob(ctx:Ctx,cx:number,cy:number,rx:number,ry:number,f:string,g:string,a:number,n:number,salt:number): void {
  const nV=12; const pts:P2[]=[];
  for (let i=0;i<nV;i++) {
    const ang=(i/nV)*Math.PI*2;
    pts.push([cx+Math.cos(ang)*rx*(1+(nh(n,salt+i)-0.5)*0.24),cy+Math.sin(ang)*ry*(1+(nh(n,salt+i+nV)-0.5)*0.24)]);
  }
  ctx.save(); ctx.globalAlpha=a; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=7;
  ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]);
  for (let i=0;i<nV;i++) {
    const ni=(i+1)%nV;
    ctx.quadraticCurveTo(pts[i][0],pts[i][1],(pts[i][0]+pts[ni][0])/2,(pts[i][1]+pts[ni][1])/2);
  }
  ctx.closePath(); ctx.fill(); ctx.shadowBlur=0;
  ctx.strokeStyle='rgba(255,255,255,0.14)'; ctx.lineWidth=0.75; ctx.stroke(); ctx.restore();
}
// Bezier tendril from (x0,y0) at angle, curling
function rtend(ctx:Ctx,x0:number,y0:number,angle:number,len:number,w:number,f:string,g:string,a:number,n:number,salt:number): void {
  const c1x=x0+Math.cos(angle)*len*0.38+(nh(n,salt)-0.5)*len*0.28;
  const c1y=y0+Math.sin(angle)*len*0.38+(nh(n,salt+1)-0.5)*len*0.10;
  const c2x=x0+Math.cos(angle)*len*0.72+(nh(n,salt+2)-0.5)*len*0.20;
  const c2y=y0+Math.sin(angle)*len*0.72+(nh(n,salt+3)-0.5)*len*0.08;
  const ex=x0+Math.cos(angle)*len, ey=y0+Math.sin(angle)*len;
  ctx.save(); ctx.globalAlpha=a; ctx.strokeStyle=f; ctx.lineWidth=w; ctx.shadowColor=g; ctx.shadowBlur=4;
  ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(x0,y0); ctx.bezierCurveTo(c1x,c1y,c2x,c2y,ex,ey); ctx.stroke(); ctx.restore();
}
// Crystal shard
function cshard(ctx:Ctx,bx:number,by:number,angle:number,len:number,w:number,f:string,g:string,a:number): void {
  const tx=bx+Math.cos(angle)*len, ty=by+Math.sin(angle)*len;
  const px=-Math.sin(angle)*w, py=Math.cos(angle)*w;
  fpoly(ctx,[[bx+px,by+py],[bx-px,by-py],[tx,ty]],f,g,a,5);
  ctx.save(); ctx.globalAlpha=a*0.40; ctx.strokeStyle='rgba(255,255,255,0.82)'; ctx.lineWidth=0.8;
  ctx.beginPath(); ctx.moveTo(bx+px,by+py); ctx.lineTo(tx,ty); ctx.stroke(); ctx.restore();
}
// Crystal face (filled polygon + specular edge)
function crystFace(ctx:Ctx,pts:P2[],f:string,g:string,A:number): void {
  fpoly(ctx,pts,f,g,A,5);
  if (pts.length>=2) {
    ctx.save(); ctx.globalAlpha=A*0.48; ctx.strokeStyle='rgba(255,255,255,0.82)'; ctx.lineWidth=0.88;
    ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]); ctx.lineTo(pts[1][0],pts[1][1]); ctx.stroke(); ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════
// §6  ANATOMICAL COMPONENT LIBRARY
// ═══════════════════════════════════════════════════════════

// ── Bell dome (for medusa): dome arc + flared margin ──
function bellDome(ctx:Ctx,cx:number,cy:number,bW:number,bH:number,f:string,g:string,A:number,contract:number): void {
  const cW=bW*(1-contract*0.28), cH=bH*(1+contract*0.38);
  ctx.save(); ctx.globalAlpha=A; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=8;
  ctx.beginPath();
  ctx.moveTo(cx-cW,cy);
  ctx.bezierCurveTo(cx-cW,cy-cH*1.10, cx+cW,cy-cH*1.10, cx+cW,cy);
  ctx.bezierCurveTo(cx+cW*1.14,cy+cH*0.18, cx-cW*1.14,cy+cH*0.18, cx-cW,cy);
  ctx.closePath(); ctx.fill(); ctx.shadowBlur=0;
  ctx.strokeStyle='rgba(255,255,255,0.18)'; ctx.lineWidth=0.8; ctx.stroke(); ctx.restore();
  // Subsurface sheen
  ctx.save(); ctx.globalAlpha=A*0.22; ctx.strokeStyle='rgba(255,255,255,0.60)'; ctx.lineWidth=1.2;
  ctx.beginPath();
  ctx.ellipse(cx-cW*0.08,cy-cH*0.42,cW*0.52,cH*0.24,0,Math.PI*1.08,Math.PI*1.92); ctx.stroke(); ctx.restore();
}

// ── Bell medusa tentacle (trailing, undulating) ──
function bellTentacle(ctx:Ctx,x0:number,y0:number,len:number,w:number,curl:number,t:number,n:number,salt:number,f:string,g:string,A:number): void {
  const c1x=x0+curl+wave(t,n+salt,0.4,w*3.5);
  const c1y=y0+len*0.42+wave(t,n+salt+1,0.6,len*0.08);
  const ex=x0+curl*0.6+wave(t,n+salt+2,0.5,w*2.0), ey=y0+len;
  ctx.save(); ctx.globalAlpha=A; ctx.strokeStyle=f; ctx.lineWidth=w; ctx.shadowColor=g; ctx.shadowBlur=3; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(x0,y0); ctx.quadraticCurveTo(c1x,c1y,ex,ey); ctx.stroke(); ctx.restore();
  // Nematocyst battery dots
  for (let i=1;i<=3;i++) {
    const sp=i*0.22;
    const bx=(1-sp)*(1-sp)*x0+2*(1-sp)*sp*c1x+sp*sp*ex;
    const by=(1-sp)*(1-sp)*y0+2*(1-sp)*sp*c1y+sp*sp*ey;
    sarc(ctx,bx,by,w*0.60,0,Math.PI*2,A<0.5?f:A+'',A-0.30,0.55);
  }
}

// ── Eyestalk + eye (for benthic disc) ──
function eyeStalk(ctx:Ctx,bx:number,by:number,stalkLen:number,eyeR:number,lean:number,t:number,n:number,salt:number,f:string,g:string,A:number): void {
  const sway=wave(t,n+salt,0.7,stalkLen*0.09);
  const ex=bx+sway+lean*stalkLen*0.25, ey=by-stalkLen;
  sline(ctx,bx,by,ex,ey,f,A-0.08,eyeR*0.30);
  fcirc(ctx,ex,ey,eyeR,'rgba(232,228,210,0.94)',g,A,4);
  fcirc(ctx,ex,ey,eyeR*0.60,f,g,A-0.04,3);
  fcirc(ctx,ex-eyeR*0.28,ey-eyeR*0.28,eyeR*0.20,'rgba(255,255,255,0.72)',g,A-0.12,0);
  ctx.save(); ctx.globalAlpha=A; ctx.fillStyle='rgba(5,4,8,0.95)';
  ctx.beginPath(); ctx.ellipse(ex+eyeR*0.16,ey,eyeR*0.34,eyeR*0.28,0,0,Math.PI*2); ctx.fill(); ctx.restore();
}

// ── Ammonite coil — filled spiral cross-section ──
function ammoniteCoil(ctx:Ctx,cx:number,cy:number,R:number,n:number,t:number,f:string,g:string,acc:string,A:number): void {
  const rot=t*0.001*0.18+nh(n,0xA201)*Math.PI*2;
  const nRings=3+Math.floor(nh(n,0xA202)*2);
  for (let ring=nRings;ring>=0;ring--) {
    const r0=R*(0.14+ring*0.17), r1=R*(0.28+ring*0.17);
    const alpha=A*(0.88-ring*0.10);
    const fillC=ring%2===0?f:g;
    ctx.save(); ctx.globalAlpha=alpha; ctx.fillStyle=fillC; ctx.shadowColor=g; ctx.shadowBlur=ring===0?6:2;
    ctx.beginPath();
    ctx.arc(cx,cy,r1,rot+Math.PI*0.18,rot+Math.PI*1.82);
    ctx.arc(cx,cy,r0,rot+Math.PI*1.82,rot+Math.PI*0.18,true);
    ctx.closePath(); ctx.fill(); ctx.shadowBlur=0;
    ctx.strokeStyle='rgba(255,255,255,0.18)'; ctx.lineWidth=0.55; ctx.stroke(); ctx.restore();
    // Suture line
    ctx.save(); ctx.globalAlpha=A-0.28; ctx.strokeStyle='rgba(0,0,0,0.52)'; ctx.lineWidth=0.7;
    ctx.beginPath();
    const sx=cx+Math.cos(rot+Math.PI*0.18)*r0*1.05, sy=cy+Math.sin(rot+Math.PI*0.18)*r0*1.05;
    ctx.moveTo(sx,sy); ctx.arc(cx,cy,(r0+r1)*0.5,rot+Math.PI*0.18,rot+Math.PI*0.26); ctx.stroke(); ctx.restore();
  }
  // Aperture highlight
  const aX=cx+Math.cos(rot+Math.PI)*R*0.62, aY=cy+Math.sin(rot+Math.PI)*R*0.62;
  sarc(ctx,aX,aY,R*0.11,rot+Math.PI*0.55,rot+Math.PI*1.45,acc,A-0.10,R*0.052,4);
}

// ── Tentacle arm (cephalopod) with sucker detail ──
function tentArm(ctx:Ctx,ax:number,ay:number,tipX:number,tipY:number,w:number,suckers:boolean,curl:number,t:number,n:number,salt:number,f:string,g:string,A:number): void {
  const mx=(ax+tipX)/2+curl+wave(t,n+salt,0.5,w*2.2);
  const my=(ay+tipY)/2+wave(t,n+salt+1,0.4,w*0.8);
  ctx.save(); ctx.globalAlpha=A; ctx.strokeStyle=f; ctx.lineWidth=w*2.0; ctx.shadowColor=g; ctx.shadowBlur=3; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(ax,ay); ctx.quadraticCurveTo(mx,my,tipX,tipY); ctx.stroke();
  ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=0.50;
  ctx.beginPath(); ctx.moveTo(ax,ay); ctx.quadraticCurveTo(mx,my,tipX,tipY); ctx.stroke(); ctx.restore();
  if (suckers) {
    for (let i=1;i<=4;i++) {
      const sp=i/5;
      const bx=(1-sp)*(1-sp)*ax+2*(1-sp)*sp*mx+sp*sp*tipX;
      const by=(1-sp)*(1-sp)*ay+2*(1-sp)*sp*my+sp*sp*tipY;
      sarc(ctx,bx,by,w*0.52,0,Math.PI*2,f,A-0.26,0.60);
    }
  }
}

// ── Hook body (C-shaped parasite grip) ──
function hookBody(ctx:Ctx,cx:number,cy:number,R:number,openFrac:number,f:string,g:string,A:number): void {
  // C-shape: arc from top-right clockwise to bottom-right
  const a0=-Math.PI*0.25, a1=Math.PI*1.25*(1-openFrac*0.18);
  ctx.save(); ctx.globalAlpha=A; ctx.strokeStyle=f; ctx.lineWidth=R*0.26; ctx.shadowColor=g; ctx.shadowBlur=7; ctx.lineCap='round';
  ctx.beginPath(); ctx.arc(cx,cy,R*0.68,a0,a1); ctx.stroke(); ctx.restore();
  // Inner edge (narrower arc for body thickness)
  ctx.save(); ctx.globalAlpha=A-0.18; ctx.strokeStyle=g; ctx.lineWidth=R*0.09; ctx.lineCap='round';
  ctx.beginPath(); ctx.arc(cx,cy,R*0.50,a0+0.14,a1-0.14); ctx.stroke(); ctx.restore();
  // Gripping spines at tips
  for (const tipA of [a0, a1]) {
    const tx=cx+Math.cos(tipA)*R*0.68, ty=cy+Math.sin(tipA)*R*0.68;
    const spA=tipA + (tipA===a0 ? -Math.PI*0.35 : Math.PI*0.35);
    cshard(ctx,tx,ty,spA,R*0.28,R*0.055,f,g,A-0.06);
  }
}

// ── Spider bilobate body: teardrop prosoma + round opisthosoma ──
function spiderBody(ctx:Ctx,cx:number,cy:number,proW:number,proH:number,opR:number,waistGap:number,n:number,f:string,g:string,A:number): void {
  // Opisthosoma (rear, round)
  const opX=cx+proW*0.48+waistGap+opR;
  oblob(ctx,opX,cy,opR,opR*0.94,f,g,A-0.02,n,70);
  // Pedicel (waist connector)
  ctx.save(); ctx.globalAlpha=A-0.12; ctx.strokeStyle=f; ctx.lineWidth=proW*0.10; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(cx+proW*0.48,cy); ctx.lineTo(opX-opR,cy); ctx.stroke(); ctx.restore();
  // Prosoma (front, teardrop: wider at front, tapers to rear)
  ctx.save(); ctx.globalAlpha=A; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=8;
  ctx.beginPath();
  ctx.moveTo(cx-proW,cy);  // front tip
  ctx.bezierCurveTo(cx-proW*0.92,cy-proH,cx+proW*0.38,cy-proH*0.72,cx+proW*0.48,cy);
  ctx.bezierCurveTo(cx+proW*0.38,cy+proH*0.72,cx-proW*0.92,cy+proH,cx-proW,cy);
  ctx.closePath(); ctx.fill(); ctx.shadowBlur=0;
  ctx.strokeStyle='rgba(255,255,255,0.14)'; ctx.lineWidth=0.7; ctx.stroke(); ctx.restore();
  // Carapace ridge
  ctx.save(); ctx.globalAlpha=A-0.28; ctx.strokeStyle='rgba(255,255,255,0.38)'; ctx.lineWidth=0.70;
  ctx.beginPath(); ctx.moveTo(cx-proW*0.68,cy); ctx.bezierCurveTo(cx-proW*0.20,cy-proH*0.44,cx+proW*0.18,cy-proH*0.28,cx+proW*0.40,cy); ctx.stroke(); ctx.restore();
}

// ── Spider jointed leg (femur+patella+tibia+tarsus) ──
function spiderLeg(ctx:Ctx,hx:number,hy:number,angle:number,R:number,lift:number,f:string,g:string,A:number): void {
  const femL=R*0.54, patL=R*0.12, tibL=R*0.50, tarL=R*0.28;
  const kAngle=angle+Math.PI*(0.20+lift*0.14);
  const kX=hx+Math.cos(angle)*femL, kY=hy+Math.sin(angle)*femL-lift*femL*0.55;
  const pX=kX+Math.cos(kAngle)*patL, pY=kY+Math.sin(kAngle)*patL;
  const tAngle=kAngle+Math.PI*(0.25-lift*0.10);
  const tX=pX+Math.cos(tAngle)*tibL, tY=pY+Math.sin(tAngle)*tibL+lift*tibL*0.22;
  const aX=tX+Math.cos(tAngle+Math.PI*0.15)*tarL, aY=tY+Math.sin(tAngle+Math.PI*0.15)*tarL;
  const lw=R*0.072;
  sline(ctx,hx,hy,kX,kY,f,A-0.06,lw);
  sline(ctx,kX,kY,pX,pY,f,A-0.08,lw*0.85);
  sline(ctx,pX,pY,tX,tY,f,A-0.10,lw*0.72);
  sline(ctx,tX,tY,aX,aY,f,A-0.16,lw*0.52);
  fcirc(ctx,kX,kY,lw*0.85,f,g,A-0.18,2);
  fcirc(ctx,pX,pY,lw*0.72,f,g,A-0.22,2);
}

// ── Crab wide hexagonal carapace ──
function crabCarapace(ctx:Ctx,cx:number,cy:number,cW:number,cH:number,n:number,f:string,g:string,A:number): void {
  const pts:P2[]=[
    [cx-cW*0.54,cy-cH*0.24],[cx-cW*0.20,cy-cH],
    [cx+cW*0.20,cy-cH],[cx+cW*0.54,cy-cH*0.24],
    [cx+cW*0.54,cy+cH*0.24],[cx+cW*0.20,cy+cH],
    [cx-cW*0.20,cy+cH],[cx-cW*0.54,cy+cH*0.24],
  ];
  fpoly(ctx,pts,f,g,A,7);
  // Scute lines
  ctx.save(); ctx.globalAlpha=A-0.26; ctx.strokeStyle='rgba(255,255,255,0.20)'; ctx.lineWidth=0.58;
  ctx.beginPath(); ctx.moveTo(cx,cy-cH); ctx.lineTo(cx,cy+cH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx-cW*0.52,cy); ctx.lineTo(cx+cW*0.52,cy); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx,cy,cW*0.30,cH*0.55,0,0,Math.PI*2); ctx.stroke(); ctx.restore();
  // Rostrum (front projection)
  fpoly(ctx,[[cx-cW*0.20,cy-cH],[cx,cy-cH*1.28],[cx+cW*0.20,cy-cH]],f,g,A-0.08,4);
  // Gastric groove marks
  for (let i=0;i<3;i++) {
    const gx=cx+(i-1)*cW*0.22, gy=cy-cH*0.28;
    ctx.save(); ctx.globalAlpha=A-0.36; ctx.strokeStyle='rgba(0,0,0,0.48)'; ctx.lineWidth=0.52;
    ctx.beginPath(); ctx.moveTo(gx,gy); ctx.bezierCurveTo(gx-cW*0.04,gy-cH*0.22,gx+cW*0.04,gy-cH*0.22,gx,gy-cH*0.42); ctx.stroke(); ctx.restore();
  }
}

// ── Crab cheliped (large claw) ──
function crabClaw(ctx:Ctx,bx:number,by:number,R:number,openFrac:number,side:number,f:string,g:string,A:number): void {
  // Merus arm
  const mX=bx+side*R*0.62, mY=by;
  sline(ctx,bx,by,mX,mY,f,A-0.05,R*0.15);
  fcirc(ctx,mX,mY,R*0.11,f,g,A-0.08,3);
  // Fixed finger (propodus)
  const gapA=Math.PI*(0.14+openFrac*0.34);
  for (const s2 of [-1,1] as const) {
    const fA=s2>0?(Math.PI*0.5+gapA):(-Math.PI*0.5+gapA);
    ctx.save(); ctx.globalAlpha=A-0.06; ctx.strokeStyle=f; ctx.lineWidth=R*0.13; ctx.shadowColor=g; ctx.shadowBlur=4; ctx.lineCap='round';
    ctx.beginPath();
    ctx.moveTo(mX,mY);
    const tipA=side>0 ? -fA*s2 : Math.PI+fA*s2;
    ctx.arc(mX,mY,R*0.44,tipA-Math.PI*0.48*s2,tipA,s2<0); ctx.stroke(); ctx.restore();
    const tipX=mX+Math.cos(tipA)*R*0.44, tipY=mY+Math.sin(tipA)*R*0.44;
    cshard(ctx,tipX,tipY,tipA+(side>0?0:Math.PI),R*0.14,R*0.038,f,g,A-0.10);
  }
}

// ── Centipede oval segment ──
function centSeg(ctx:Ctx,cx:number,cy:number,rx:number,ry:number,n:number,salt:number,f:string,g:string,A:number): void {
  oblob(ctx,cx,cy,rx,ry,f,g,A,n,salt);
  // Tergal suture line
  sline(ctx,cx-rx*0.88,cy,cx+rx*0.88,cy,'rgba(0,0,0,0.35)',A-0.30,0.65);
  ctx.save(); ctx.globalAlpha=A-0.38; ctx.strokeStyle='rgba(255,255,255,0.22)'; ctx.lineWidth=0.48;
  ctx.beginPath(); ctx.moveTo(cx-rx*0.88,cy+0.6); ctx.lineTo(cx+rx*0.88,cy+0.6); ctx.stroke(); ctx.restore();
}

// ── Hypha (recursive branching fungal thread) ──
function hypha(ctx:Ctx,x0:number,y0:number,angle:number,len:number,w:number,depth:number,t:number,n:number,salt:number,f:string,A:number): void {
  if (depth<=0||len<1.8) return;
  const sway=wave(t,n+salt,0.35+nh(n,salt)*0.28,len*0.06);
  const x1=x0+Math.cos(angle)*len+sway, y1=y0+Math.sin(angle)*len;
  ctx.save(); ctx.globalAlpha=A; ctx.strokeStyle=f; ctx.lineWidth=w; ctx.lineCap='round';
  ctx.shadowColor=f; ctx.shadowBlur=depth*1.1;
  ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke(); ctx.restore();
  if (depth>1) {
    hypha(ctx,x1,y1,angle-0.52+nh(n,salt+10)*0.40,len*0.66,w*0.68,depth-1,t,n,salt+20,f,A-0.06);
    if (w>0.60) hypha(ctx,x1,y1,angle+0.52-nh(n,salt+11)*0.40,len*0.54,w*0.58,depth-1,t,n,salt+30,f,A-0.10);
  }
}

// ── Mushroom cap (flared, wider than stalk) ──
function mushCap(ctx:Ctx,cx:number,cy:number,capW:number,capH:number,st:number,n:number,t:number,f:string,g:string,A:number): void {
  const sway=wave(t,n,0.5,capW*0.03);
  // Cap upper surface (dome)
  ctx.save(); ctx.globalAlpha=A; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=7;
  ctx.beginPath();
  ctx.moveTo(cx-capW+sway,cy);
  ctx.bezierCurveTo(cx-capW*0.88+sway,cy-capH*1.05,cx+capW*0.88+sway,cy-capH*1.05,cx+capW+sway,cy);
  ctx.bezierCurveTo(cx+capW*1.08+sway,cy+capH*0.22,cx-capW*1.08+sway,cy+capH*0.22,cx-capW+sway,cy);
  ctx.closePath(); ctx.fill(); ctx.shadowBlur=0;
  ctx.strokeStyle='rgba(255,255,255,0.14)'; ctx.lineWidth=0.7; ctx.stroke(); ctx.restore();
  // Gills on underside (stage 1+)
  if (st>=1) {
    const nG=9+Math.floor(nh(n,0xF130)*6);
    ctx.save(); ctx.globalAlpha=A-0.24; ctx.strokeStyle=g; ctx.lineWidth=0.55;
    for (let i=0;i<nG;i++) {
      const ga=(i/(nG-1)-0.5)*Math.PI*0.92;
      const gx1=cx+sway+Math.sin(ga)*capW*0.92;
      const gx2=cx+sway+Math.sin(ga)*capW*(0.20+nh(n,0xF131+i)*0.28);
      sline(ctx,gx1,cy,gx2,cy+capH*0.32,g,A-0.26,0.48);
    }
    ctx.restore();
  }
}

// ── Vascular (flow) pulse on a trunk line ──
function vascTrunk(ctx:Ctx,x0:number,y0:number,x1:number,y1:number,w:number,t:number,n:number,f:string,acc:string,A:number): void {
  ctx.save(); ctx.globalAlpha=A; ctx.strokeStyle=f; ctx.lineWidth=w; ctx.lineCap='round';
  ctx.shadowColor=f; ctx.shadowBlur=3;
  ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke(); ctx.restore();
  const pt=(t*0.001*1.5+nh(n,0x7A10))%1.0;
  const px=x0+(x1-x0)*pt, py=y0+(y1-y0)*pt;
  fcirc(ctx,px,py,w*0.52,acc,acc,A*0.60*(1-Math.abs(pt-0.5)*2.0),4);
}

// ── Snap-trap lobe (Venus flytrap jaw) ──
function snapLobe(ctx:Ctx,cx:number,cy:number,lobeR:number,openFrac:number,side:number,teeth:number,f:string,g:string,acc:string,A:number): void {
  // Each lobe is a semicircle, pivoting from center
  const pivotA = side>0 ? -Math.PI*0.5 : Math.PI*0.5;
  const swingA = side*openFrac*Math.PI*0.55;
  ctx.save();
  ctx.translate(cx,cy);
  ctx.rotate(swingA);
  // Lobe fill
  ctx.save(); ctx.globalAlpha=A; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=7;
  ctx.beginPath();
  ctx.arc(0,0,lobeR,pivotA-Math.PI*0.5,pivotA+Math.PI*0.5);
  ctx.lineTo(0,0); ctx.closePath(); ctx.fill(); ctx.shadowBlur=0;
  ctx.strokeStyle='rgba(255,255,255,0.14)'; ctx.lineWidth=0.7; ctx.stroke(); ctx.restore();
  // Trigger hairs on lobe face
  ctx.save(); ctx.globalAlpha=A-0.15; ctx.strokeStyle=acc; ctx.lineWidth=0.55; ctx.lineCap='round';
  for (let i=0;i<3+teeth;i++) {
    const ha=pivotA+(i/(2+teeth)-0.5)*Math.PI*0.72;
    const hr=lobeR*(0.34+nh(0,i*7)*0.28);
    ctx.beginPath(); ctx.moveTo(Math.cos(ha)*hr,Math.sin(ha)*hr);
    ctx.lineTo(Math.cos(ha)*(hr+lobeR*0.24),Math.sin(ha)*(hr+lobeR*0.24)); ctx.stroke();
  }
  ctx.restore();
  // Teeth on lobe margin
  ctx.save(); ctx.globalAlpha=A-0.06; ctx.fillStyle=acc;
  for (let i=0;i<5+teeth;i++) {
    const ta=pivotA-Math.PI*0.48+(i/(4+teeth))*Math.PI*0.96;
    const tr=lobeR*0.97;
    const tx=Math.cos(ta)*tr, ty=Math.sin(ta)*tr;
    ctx.beginPath();
    ctx.moveTo(tx,ty);
    ctx.lineTo(tx+Math.cos(ta)*lobeR*0.18,ty+Math.sin(ta)*lobeR*0.18);
    ctx.lineTo(tx+Math.cos(ta+0.25)*lobeR*0.04,ty+Math.sin(ta+0.25)*lobeR*0.04);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  ctx.restore();
}

// ── Scar tissue (healed damage) ──
function drawScar(ctx:Ctx,cx:number,cy:number,R:number,n:number,salt:number): void {
  const sx=cx+(nh(n,salt+0)-0.5)*R*0.95, sy=cy+(nh(n,salt+1)-0.5)*R*0.65;
  const sr=R*(0.09+nh(n,salt+2)*0.08);
  const rot=nh(n,salt+3)*Math.PI;
  ctx.save(); ctx.globalAlpha=0.28; ctx.fillStyle='rgba(200,195,178,0.62)';
  ctx.beginPath(); ctx.ellipse(sx,sy,sr,sr*0.50,rot,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=0.20; ctx.strokeStyle='rgba(255,250,218,0.72)'; ctx.lineWidth=0.58;
  ctx.beginPath(); ctx.moveTo(sx-sr*0.75,sy); ctx.lineTo(sx+sr*0.75,sy+(nh(n,salt+4)-0.5)*sr*0.48); ctx.stroke();
  ctx.restore();
}

// ── Small parasite with slow pulse ──
function drawParasite(ctx:Ctx,px:number,py:number,R:number,n:number,salt:number,t:number,A:number): void {
  const pr=R*(0.052+nh(n,salt)*0.032);
  const pbob=wave(t,n+salt,1.4,pr*0.22);
  fcirc(ctx,px,py+pbob,pr,'rgba(175,115,52,0.88)','rgba(95,48,0,0.55)',A-0.08,3);
  ctx.save(); ctx.globalAlpha=A-0.22; ctx.strokeStyle='rgba(145,82,28,0.82)'; ctx.lineWidth=0.65;
  ctx.beginPath(); ctx.arc(px+pr*0.78,py+pbob,pr*0.46,-Math.PI*0.5,Math.PI*0.45); ctx.stroke(); ctx.restore();
}

// ── Compound eye (arthropod faceted cluster) ──
function compoundEye(ctx:Ctx,ex:number,ey:number,ew:number,eh:number,n:number,f:string,g:string,A:number): void {
  fell(ctx,ex,ey,ew,eh,f,g,A-0.02,4);
  ctx.save(); ctx.globalAlpha=A-0.16; ctx.fillStyle='rgba(0,0,0,0.65)';
  for (let i=0;i<7;i++) {
    const fx=ex+(nh(n,300+i)-0.5)*ew*1.2, fy=ey+(nh(n,310+i)-0.5)*eh*1.2;
    ctx.beginPath(); ctx.arc(fx,fy,ew*0.18,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
  fcirc(ctx,ex-ew*0.28,ey-eh*0.28,ew*0.20,'rgba(255,255,255,0.30)',g,A-0.22,0);
}

// ═══════════════════════════════════════════════════════════
// §7  PHYLUM RENDERERS — 24 distinct silhouette families
// ═══════════════════════════════════════════════════════════

// ── PHYLUM 0: CEPHALOPODA ─────────────────────────────────
// Clade 0=Bell Medusa  1=Flat Disc  2=Ammonite Coil  3=Hook Parasite
function drawCephalopoda(ctx:Ctx,cx:number,cy:number,R:number,n:number,cl:number,st:number,mi:number,t:number,ectx:EntityDrawContext|null,f:string,g:string,acc:string,A:number): void {
  const sz=[0.55,0.72,1.00,1.08][st];
  const shk=damageShake(t,ectx?.hpFrac??1);
  const lean=alertLean(ectx?.playerDist??3);
  const offX=shk-lean*R*0.18;
  const hpFrac=ectx?.hpFrac??1;

  if (cl===0) {
    // ── BELL MEDUSA: dome + trailing tentacles ──
    const bW=R*sz*(0.72+mi*0.06);
    const bH=R*sz*0.52;
    const contract=bellContract(t,n)*0.82;
    // Position bell slightly above center
    const bellCY=cy-bH*0.15;
    bellDome(ctx,cx+offX,bellCY,bW,bH,f,g,A,contract);
    // Oral arms (4, shorter, fringed) from bell underside center
    if (st>=1) {
      for (let i=0;i<4+mi;i++) {
        const oa=(i/(3+mi)-0.5)*Math.PI*0.48;
        const oaL=R*sz*(0.55+nh(n,400+i)*0.28);
        rtend(ctx,cx+offX+(nh(n,401+i)-0.5)*bW*0.32,bellCY,Math.PI*0.5+oa,oaL,R*sz*0.058,acc,g,A-0.18,n,402+i*5);
        fcirc(ctx,cx+offX+(nh(n,401+i)-0.5)*bW*0.32+Math.cos(Math.PI*0.5+oa)*oaL,bellCY+Math.sin(Math.PI*0.5+oa)*oaL,R*sz*0.07,acc,g,A-0.20,3);
      }
    }
    // Trailing tentacles from bell margin
    const nT=6+mi*2+st;
    for (let i=0;i<nT;i++) {
      const ta=Math.PI*0.10+(i/(nT-1))*Math.PI*0.80;
      const tmx=cx+offX+Math.cos(ta)*bW*(0.88+contract*0.08);
      const tmy=bellCY+Math.sin(ta)*bH*(0.12+contract*0.05);
      const tLen=R*sz*(1.60+nh(n,500+i)*0.72);
      const curl=(nh(n,510+i)-0.5)*R*sz*0.42+lean*R*sz*0.28;
      const tW=R*sz*(0.040-i*0.001);
      bellTentacle(ctx,tmx,tmy,tLen,Math.max(0.8,tW),curl,t,n,i*13,f,g,A*(0.88-i*0.022));
    }
    // Radial canals on bell (stage 2+)
    if (st>=2) {
      const nC=4+mi;
      for (let i=0;i<nC;i++) {
        const ca=(i/(nC))*Math.PI+Math.PI*0.05;
        sarc(ctx,cx+offX,bellCY-bH*0.24,bH*0.52,Math.PI+ca-Math.PI*0.5,Math.PI+ca+Math.PI*0.5,acc,A*0.22,0.42);
      }
    }
    // Damage: bell tears
    if (hpFrac<0.5) {
      ctx.save(); ctx.globalAlpha=0.40; ctx.strokeStyle='rgba(220,200,160,0.72)'; ctx.lineWidth=0.60;
      ctx.beginPath(); ctx.moveTo(cx+offX+bW*0.28,bellCY-bH*0.62); ctx.lineTo(cx+offX+bW*0.44,bellCY-bH*0.10); ctx.stroke(); ctx.restore();
    }

  } else if (cl===1) {
    // ── FLAT DISC: wide oblate body + eyestalks + radiating arms ──
    const dW=R*sz*1.82, dH=R*sz*0.36;
    // Disc
    oblob(ctx,cx+offX,cy,dW,dH,f,g,A,n,10);
    // Pattern on top: mantle spots
    ctx.save(); ctx.globalAlpha=A-0.32; ctx.strokeStyle=acc; ctx.lineWidth=0.45;
    for (let i=0;i<5+mi;i++) {
      const sx=cx+offX+(nh(n,600+i)-0.5)*dW*1.20, sy=cy+(nh(n,610+i)-0.5)*dH*0.55;
      ctx.beginPath(); ctx.arc(sx,sy,dW*0.046,0,Math.PI*2); ctx.stroke();
    }
    ctx.restore();
    // Two eyestalks projecting upward
    const stalkLen=R*sz*(0.48+mi*0.08);
    const eyeR=R*sz*0.12;
    const e1x=cx+offX-dW*0.28, e2x=cx+offX+dW*0.28;
    eyeStalk(ctx,e1x,cy-dH,stalkLen,eyeR,lean,t,n,20,f,g,A);
    eyeStalk(ctx,e2x,cy-dH,stalkLen,eyeR,-lean,t,n,21,f,g,A);
    // 8 short arms radiating from disc perimeter
    const nA=8;
    for (let i=0;i<nA;i++) {
      const aa=(i/nA)*Math.PI*2;
      const armX=cx+offX+Math.cos(aa)*dW*0.86;
      const armY=cy+Math.sin(aa)*dH*0.78;
      const aLen=R*sz*(0.48+nh(n,700+i)*0.22);
      const tipX=armX+Math.cos(aa)*aLen;
      const tipY=armY+Math.sin(aa)*aLen*0.55;
      tentArm(ctx,armX,armY,tipX,tipY,R*sz*0.040,st>=1,(nh(n,701+i)-0.5)*R*sz*0.22,t,n,i*11,f,g,A-0.08);
    }
    // Ink cloud when badly damaged
    if (hpFrac<0.35) {
      ctx.save(); ctx.globalAlpha=(0.35-hpFrac)*0.8;
      const grad=ctx.createRadialGradient(cx+offX,cy,0,cx+offX,cy,R*sz*1.10);
      grad.addColorStop(0,'rgba(8,4,18,0.72)'); grad.addColorStop(1,'rgba(8,4,18,0)');
      ctx.fillStyle=grad; ctx.beginPath(); ctx.ellipse(cx+offX,cy,R*sz*1.10,R*sz*0.78,0,0,Math.PI*2); ctx.fill(); ctx.restore();
    }

  } else if (cl===2) {
    // ── AMMONITE COIL: the entire body is the spiral ──
    ammoniteCoil(ctx,cx+offX,cy,R*sz,n,t,f,g,acc,A);
    // Tentacles emerging from aperture (stage 1+)
    if (st>=1) {
      const rot=t*0.001*0.18+nh(n,0xA201)*Math.PI*2;
      const apertX=cx+offX+Math.cos(rot+Math.PI)*R*sz*0.62;
      const apertY=cy+Math.sin(rot+Math.PI)*R*sz*0.62;
      const nTA=4+mi;
      for (let i=0;i<nTA;i++) {
        const ta=rot+Math.PI+(i/(nTA-1)-0.5)*Math.PI*0.48;
        const tLen=R*sz*(0.62+nh(n,800+i)*0.40);
        const tipX=apertX+Math.cos(ta)*tLen;
        const tipY=apertY+Math.sin(ta)*tLen;
        tentArm(ctx,apertX,apertY,tipX,tipY,R*sz*0.046,true,(nh(n,801+i)-0.5)*R*sz*0.28,t,n,i*9,acc,g,A-0.06);
      }
    }
    if (st===3) drawScar(ctx,cx+offX+R*0.22,cy-R*0.28,R,n,0x5C01);

  } else {
    // ── HOOK PARASITE: C-shaped grip around a host mass ──
    // Host (dim background mass)
    oblob(ctx,cx+offX+R*sz*0.12,cy,R*sz*0.62,R*sz*0.54,'rgba(42,28,18,0.52)','rgba(18,10,4,0.30)',A-0.38,n,80);
    // Hook body
    const grip=1-lean*0.40;
    hookBody(ctx,cx+offX,cy,R*sz,grip,f,g,A);
    // Hooks at tips have suckers (stage 1+)
    if (st>=1) {
      const rot2=t*0.001*0.22;
      for (let i=0;i<3+mi;i++) {
        const ha=-Math.PI*0.22+(i/(2+mi))*Math.PI*1.50+rot2*0.05;
        const px2=cx+offX+Math.cos(ha)*R*sz*0.66, py2=cy+Math.sin(ha)*R*sz*0.66;
        sarc(ctx,px2,py2,R*sz*0.060,0,Math.PI*2,acc,A-0.24,0.65,2);
      }
    }
    if (st===3) drawParasite(ctx,cx+offX-R*sz*0.58,cy-R*sz*0.42,R,n,0x5C02,t,A);
  }
}

// ── PHYLUM 1: ARTHROPODA ─────────────────────────────────
// Clade 0=Bilobate Spider  1=Shield Crab  2=Chain Centipede  3=Barnacle
function drawArthropoda(ctx:Ctx,cx:number,cy:number,R:number,n:number,cl:number,st:number,mi:number,t:number,ectx:EntityDrawContext|null,f:string,g:string,acc:string,A:number): void {
  const sz=[0.52,0.70,1.00,1.10][st];
  const shk=damageShake(t,ectx?.hpFrac??1);
  const lean=alertLean(ectx?.playerDist??3);
  const offX=shk-lean*R*0.14;
  const hpFrac=ectx?.hpFrac??1;

  if (cl===0) {
    // ── BILOBATE SPIDER: teardrop prosoma + round opisthosoma ──
    const proW=R*sz*0.82, proH=R*sz*0.58;
    const opR=R*sz*(0.44+mi*0.04);
    const waistGap=R*sz*0.06;
    // Body bob animation
    const bob=wave(t,n,2.8,R*sz*0.028);
    spiderBody(ctx,cx+offX,cy+bob,proW,proH,opR,waistGap,n,f,g,A);
    // Spinneret at rear of opisthosoma
    const spX=cx+offX+proW*0.48+waistGap+opR*1.92;
    const spY=cy+bob;
    fcirc(ctx,spX,spY,opR*0.13,acc,g,A-0.10,3);
    if (st>=1) {
      // Silk thread
      ctx.save(); ctx.globalAlpha=A-0.36; ctx.strokeStyle='rgba(230,220,200,0.52)'; ctx.lineWidth=0.38; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(spX+opR*0.14,spY); ctx.lineTo(spX+R*sz*0.62,spY+R*sz*0.22); ctx.stroke(); ctx.restore();
    }
    // 8 legs from prosoma (4 per side)
    const freq=2.4+lean*1.8;
    for (let i=0;i<8;i++) {
      const side=i<4?-1:1;
      const pair=i%4;
      const lX=cx+offX-proW*0.62+pair*(proW*1.24/3);
      const lY=cy+bob+side*proH*0.72;
      const legBase=i<4?Math.PI*0.52:Math.PI*0.48;
      const lift=stepGait(t,n,i,8,freq)*R*sz*0.22;
      spiderLeg(ctx,lX,lY,legBase,R*sz,lift,f,g,A-0.06);
    }
    // Pedipalps at prosoma front
    for (const s of [-1,1] as const) {
      const ppX=cx+offX-proW*0.90, ppY=cy+bob+s*proH*0.28;
      rtend(ctx,ppX,ppY,-Math.PI*0.18*s-Math.PI*0.05,R*sz*0.36,R*sz*0.052,f,g,A-0.14,n,900+s*3);
      fcirc(ctx,ppX+Math.cos(-Math.PI*0.18*s-Math.PI*0.05)*R*sz*0.36,ppY+Math.sin(-Math.PI*0.18*s-Math.PI*0.05)*R*sz*0.36,R*sz*0.048,f,g,A-0.18,2);
    }
    // Eyes on prosoma front face
    if (st>=1) {
      const eyeRow=[{x:0.10,y:0.22},{x:-0.10,y:0.22},{x:0.26,y:0.08},{x:-0.26,y:0.08}];
      for (const ep of eyeRow.slice(0,st>=2?4:2)) {
        fcirc(ctx,cx+offX-proW*0.78+ep.x*R*sz,cy+bob+ep.y*R*sz,R*sz*0.062,'rgba(220,232,210,0.90)',g,A-0.04,2);
        fcirc(ctx,cx+offX-proW*0.78+ep.x*R*sz,cy+bob+ep.y*R*sz,R*sz*0.034,'rgba(5,4,8,0.95)',g,A,0);
      }
    }
    if (hpFrac<0.5) {
      ctx.save(); ctx.globalAlpha=0.40; ctx.strokeStyle='rgba(218,198,158,0.80)'; ctx.lineWidth=0.62;
      ctx.beginPath(); ctx.moveTo(cx+offX,cy+bob-proH*0.48); ctx.lineTo(cx+offX+R*0.14,cy+bob+R*0.16); ctx.stroke(); ctx.restore();
    }
    if (st===3) drawScar(ctx,cx+offX+proW*0.20,cy+bob,R,n,0x5A01);

  } else if (cl===1) {
    // ── SHIELD CRAB: wide carapace + lateral claws + fan tail ──
    const cW=R*sz*1.82, cH=R*sz*0.50;
    // Body sway (sideways shuffle)
    const shuffle=wave(t,n,1.8,R*sz*0.038)*lean;
    const cOffX=offX+shuffle;
    crabCarapace(ctx,cx+cOffX,cy,cW,cH,n,f,g,A);
    // Stalked eyes on top of carapace
    const eyeStalkL=R*sz*(0.22+mi*0.04);
    for (const s of [-1,1] as const) {
      const eX=cx+cOffX+s*cW*0.18, eY=cy-cH;
      sline(ctx,eX,eY,eX+s*eyeStalkL*0.18,eY-eyeStalkL,f,A-0.06,R*sz*0.052);
      fcirc(ctx,eX+s*eyeStalkL*0.18,eY-eyeStalkL,R*sz*0.08,f,g,A,3);
      fcirc(ctx,eX+s*eyeStalkL*0.18,eY-eyeStalkL,R*sz*0.046,'rgba(5,4,8,0.94)',g,A-0.02,0);
    }
    // Fan tail (uropods)
    for (let i=0;i<3+mi;i++) {
      const ta=Math.PI*0.36+(i/(2+mi))*Math.PI*0.28;
      rtend(ctx,cx+cOffX+cW*0.44,cy,ta,R*sz*(0.24+nh(n,1000+i)*0.14),R*sz*0.048,f,g,A-0.20,n,1001+i*4);
    }
    // Two large chelipeds (claws) on front-lateral
    const clawOpen=0.18+lean*0.88+pulse(t,n,0.80)*0.14;
    crabClaw(ctx,cx+cOffX-cW*0.56,cy-cH*0.05,R*sz,Math.min(1,clawOpen),-1,f,g,A);
    crabClaw(ctx,cx+cOffX+cW*0.56,cy-cH*0.05,R*sz,Math.min(1,clawOpen),1,f,g,A);
    // Walking legs (4 per side)
    for (let i=0;i<8;i++) {
      const side=i<4?-1:1;
      const pair=i%4;
      const lX=cx+cOffX+(side<0?-cW*0.48:cW*0.48);
      const lY=cy+cH*0.70+pair*cH*0.25;
      const lift=stepGait(t,n,i,8,1.6)*R*sz*0.14;
      const legA=side<0?Math.PI*0.68:Math.PI*0.32;
      const femL=R*sz*0.36, tibL=R*sz*0.30;
      const kX=lX+Math.cos(legA)*femL, kY=lY+Math.sin(legA)*femL-lift;
      sline(ctx,lX,lY,kX,kY,f,A-0.08,R*sz*0.058);
      sline(ctx,kX,kY,kX+Math.cos(legA+Math.PI*0.24)*tibL,kY+Math.sin(legA+Math.PI*0.24)*tibL+lift*0.44,f,A-0.14,R*sz*0.044);
      fcirc(ctx,kX,kY,R*sz*0.048,f,g,A-0.20,2);
    }
    if (hpFrac<0.5) drawScar(ctx,cx+cOffX,cy,R,n,0x5B01);

  } else if (cl===2) {
    // ── CHAIN CENTIPEDE: tapering oval segments with serpentine wave ──
    const nSeg=6+mi*2+(st>1?2:0);
    const segW=R*sz*(2.0/nSeg)*0.82;  // each segment width
    // Head slightly larger
    const headW=segW*1.28, headH=headW*0.68;
    // Serpentine: compute segment center positions
    const totalLen=segW*nSeg*1.08;
    const segPositions: {x:number,y:number,a:number}[]=[];
    let sx=cx+offX-totalLen*0.48;
    for (let i=0;i<nSeg;i++) {
      const segAngle=serpentAngle(t,n,i,nSeg,0.22);
      const sy=cy+segAngle*R*sz*1.20;
      segPositions.push({x:sx,y:sy,a:segAngle});
      sx+=segW*1.05;
    }
    // Draw segments back to front
    for (let i=nSeg-1;i>=0;i--) {
      const sp=segPositions[i];
      const isHead=i===0;
      const taper=(i/(nSeg-1));  // 0=head, 1=tail
      const sW=isHead?headW:segW*(1-taper*0.32);
      const sH=isHead?headH:sW*0.55*(1-taper*0.18);
      centSeg(ctx,sp.x,sp.y,sW,sH,n,i*12,f,g,A);
      // Legs (2 per segment, excluding head, from ventral edges)
      if (!isHead && st>0) {
        for (const s of [-1,1] as const) {
          const lift=stepGait(t,n,i*2+(s>0?1:0),nSeg*2,3.2)*R*sz*0.14;
          const lX=sp.x, lY=sp.y+s*sH;
          sline(ctx,lX,lY,lX+(s>0?R*sz*0.02:-R*sz*0.02),lY+s*R*sz*(0.26-lift),f,A-0.16,R*sz*0.038);
        }
      }
    }
    // Head features
    const hd=segPositions[0];
    // Antennae
    for (const s of [-1,1] as const) {
      rtend(ctx,hd.x-headW*0.88,hd.y+s*headH*0.38,-Math.PI*0.08+s*0.32,R*sz*0.68,R*sz*0.032,f,g,A-0.14,n,1100+s*5);
      fcirc(ctx,hd.x-headW*0.88+Math.cos(-Math.PI*0.08+s*0.32)*R*sz*0.68,hd.y+s*headH*0.38+Math.sin(-Math.PI*0.08+s*0.32)*R*sz*0.68,R*sz*0.038,acc,g,A-0.18,2);
    }
    compoundEye(ctx,hd.x-headW*0.60,hd.y-headH*0.28,headW*0.30,headH*0.22,n,f,g,A);
    // Cerci at tail
    const tail=segPositions[nSeg-1];
    for (const s of [-1,1] as const) {
      sline(ctx,tail.x+segW*0.88,tail.y+s*segW*0.22,tail.x+segW*0.88+R*sz*0.38,tail.y+s*R*sz*0.32,f,A-0.18,R*sz*0.038);
    }
    if (st===3) drawScar(ctx,hd.x,hd.y-headH*0.55,R,n,0x5C01);

  } else {
    // ── BARNACLE: cone of plates + filter cirri ──
    const bSz=[0.52,0.70,1.00,1.10][st];
    const nP=6+mi;
    for (let i=0;i<nP;i++) {
      const a0=(i/nP)*Math.PI*2, a1=((i+0.80)/nP)*Math.PI*2;
      const r1=R*bSz*0.25, r2=R*bSz*0.72;
      ctx.save(); ctx.globalAlpha=A*(0.90-i*0.03); ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=4;
      ctx.beginPath(); ctx.arc(cx+offX,cy,r2,a0,a1); ctx.arc(cx+offX,cy,r1,a1,a0,true); ctx.closePath(); ctx.fill();
      ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,0.14)'; ctx.lineWidth=0.65; ctx.stroke(); ctx.restore();
    }
    fcirc(ctx,cx+offX,cy,R*bSz*0.22,g,g,A-0.14,5);
    const fanOpen=0.38+pulse(t,n,1.2)*0.62;
    if (st>=1) {
      for (let i=0;i<4+mi;i++) {
        const fa=-Math.PI*0.5+(i/(3+mi)-0.5)*Math.PI*0.56;
        rtend(ctx,cx+offX,cy,fa,R*bSz*(0.30+nh(n,1200+i)*0.16)*fanOpen,R*bSz*0.038,acc,g,A-0.20,n,1200+i*4);
      }
    }
    for (let i=0;i<3;i++) {
      const ha=Math.PI*(0.60+i*0.38);
      sline(ctx,cx+offX,cy,cx+offX+Math.cos(ha)*R*bSz*0.88,cy+Math.sin(ha)*R*bSz*0.88,f,A-0.24,R*bSz*0.058);
    }
  }
}

// ── PHYLUM 2: FUNGI ──────────────────────────────────────
// Clade 0=Mushroom  1=Zombie Burst  2=Directional Amoeba  3=Node Web
function drawFungi(ctx:Ctx,cx:number,cy:number,R:number,n:number,cl:number,st:number,mi:number,t:number,ectx:EntityDrawContext|null,f:string,g:string,acc:string,A:number): void {
  const sz=[0.50,0.68,1.00,1.12][st];
  const lean=alertLean(ectx?.playerDist??3);
  const offX=-lean*R*0.10;

  if (cl===0) {
    // ── PROPER MUSHROOM: cap + gills + tapered stalk + mycelial mat ──
    const stalkH=R*sz*(0.72+nh(n,0xF120)*0.32);
    const stalkW=R*sz*(0.10+mi*0.02);
    const capW=R*sz*(0.82+nh(n,0xF121)*0.26);  // cap much wider than stalk
    const capH=R*sz*(0.38+nh(n,0xF122)*0.14);
    const sway=wave(t,n,0.45,stalkH*0.032);
    const stalkBaseX=cx+offX, stalkBaseY=cy+R*sz*0.38;
    const stalkTopX=stalkBaseX+sway, stalkTopY=stalkBaseY-stalkH;
    // Mycelial mat at base
    oblob(ctx,stalkBaseX,stalkBaseY+R*sz*0.08,R*sz*0.62,R*sz*0.14,g,g,A-0.28,n,20);
    // Stalk (tapered: wider at base, narrower at cap)
    ctx.save(); ctx.globalAlpha=A-0.06; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=3;
    const stW0=stalkW*1.6, stW1=stalkW;
    ctx.beginPath();
    ctx.moveTo(stalkBaseX-stW0,stalkBaseY);
    ctx.bezierCurveTo(stalkBaseX-stW0*0.85,stalkBaseY-stalkH*0.4,stalkTopX-stW1,stalkTopY+stalkH*0.4,stalkTopX-stW1,stalkTopY);
    ctx.lineTo(stalkTopX+stW1,stalkTopY);
    ctx.bezierCurveTo(stalkTopX+stW1,stalkTopY+stalkH*0.4,stalkBaseX+stW0*0.85,stalkBaseY-stalkH*0.4,stalkBaseX+stW0,stalkBaseY);
    ctx.closePath(); ctx.fill(); ctx.shadowBlur=0;
    ctx.strokeStyle='rgba(255,255,255,0.14)'; ctx.lineWidth=0.65; ctx.stroke(); ctx.restore();
    // Annulus ring (stage 2+)
    if (st>=2) {
      fell(ctx,stalkTopX,stalkTopY+stalkH*0.28,stW1*2.8,stW1*0.40,acc,g,A-0.18,2);
    }
    // Cap
    mushCap(ctx,stalkTopX,stalkTopY,capW,capH,st,n,t,f,g,A);
    // Spore puff from cap underside
    if (st>=1) {
      const pCycle=(t*0.001*0.62+nh(n,0xF123))%1.0;
      const pSz=R*sz*0.22*pCycle;
      const pA=A*(1-pCycle)*0.48;
      if (pA>0.02) fcirc(ctx,stalkTopX+(nh(n,0xF124)-0.5)*capW*0.44,stalkTopY+capH*0.18+pSz,pSz,acc,acc,pA,pSz*0.5);
    }

  } else if (cl===1) {
    // ── ZOMBIE BURST: lumpy host blob with erupting fungal stalks ──
    // Host body (irregular 5-lobe blob)
    const hR=R*sz*(0.64+mi*0.04);
    oblob(ctx,cx+offX,cy,hR,hR*0.88,'rgba(42,35,26,0.72)','rgba(22,16,8,0.42)',A-0.08,n,40);
    // Surface texture on host
    ctx.save(); ctx.globalAlpha=A-0.30;
    for (let i=0;i<6+mi;i++) {
      const tx=cx+offX+(nh(n,1300+i)-0.5)*hR*1.40, ty=cy+(nh(n,1310+i)-0.5)*hR*1.10;
      ctx.fillStyle=i%2===0?'rgba(58,44,28,0.65)':'rgba(28,20,10,0.55)';
      ctx.beginPath(); ctx.ellipse(tx,ty,hR*(0.12+nh(n,1320+i)*0.10),hR*(0.08+nh(n,1321+i)*0.08),nh(n,1322+i)*Math.PI,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
    // Erupting fungal stalks (main feature)
    const nSt=3+mi;
    for (let i=0;i<nSt;i++) {
      const sOff=(nh(n,1400+i)-0.5)*hR*1.10;
      const sBase=[cx+offX+sOff, cy+(nh(n,1401+i)-0.5)*hR*0.60] as [number,number];
      const sLen=R*sz*(0.54+nh(n,1402+i)*0.44);
      const tilt=wave(t,n+i,0.52,sLen*0.06);
      const stalkTopX2=sBase[0]+tilt, stalkTopY2=sBase[1]-sLen;
      sline(ctx,sBase[0],sBase[1],stalkTopX2,stalkTopY2,f,A-0.04,R*sz*0.068);
      // Sporangium (swollen tip)
      const spR=R*sz*(0.10+nh(n,1403+i)*0.08);
      fcirc(ctx,stalkTopX2,stalkTopY2,spR,f,g,A,6);
      // Burst hole at stalk base
      sarc(ctx,sBase[0],sBase[1],R*sz*0.072,0,Math.PI*2,'rgba(0,0,0,0.62)',A-0.20,0.58);
      // Spore release (stage 2+)
      if (st>=2) {
        const pC=(t*0.001*0.72+nh(n+i,0xF210))%1.0;
        const pSz2=spR*1.6*pC;
        if (pSz2>0.5) fcirc(ctx,stalkTopX2+(nh(n,1404+i)-0.5)*spR,stalkTopY2-pSz2,pSz2*0.6,acc,acc,A*(1-pC)*0.42,pSz2*0.4);
      }
    }

  } else if (cl===2) {
    // ── DIRECTIONAL AMOEBA: asymmetric pseudopod flow ──
    // Main mass (trailing side)
    const mR=R*sz*0.68;
    const flowPhase=t*0.001*0.48+nh(n,0xF300)*Math.PI*2;
    const massX=cx+offX+R*sz*0.22, massY=cy;  // mass slightly right (trailing)
    oblob(ctx,massX,massY,mR,mR*0.72,f,g,A-0.04,n,50);
    // Leading pseudopod toward left/player
    const pLen=R*sz*(0.80+nh(n,0xF301)*0.38)*(0.78+Math.sin(flowPhase)*0.22);
    const pTipX=massX-mR-pLen, pTipY=cy+wave(t,n,0.55,R*sz*0.18);
    ctx.save(); ctx.globalAlpha=A-0.08; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=5;
    ctx.beginPath();
    ctx.moveTo(massX-mR*0.68,massY-mR*0.28);
    ctx.bezierCurveTo(massX-mR*0.88-pLen*0.35,massY-R*sz*0.24,pTipX+pLen*0.22,pTipY-R*sz*0.16,pTipX,pTipY);
    ctx.bezierCurveTo(pTipX+pLen*0.22,pTipY+R*sz*0.16,massX-mR*0.88-pLen*0.35,massY+R*sz*0.24,massX-mR*0.68,massY+mR*0.28);
    ctx.closePath(); ctx.fill(); ctx.shadowBlur=0;
    ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=0.65; ctx.stroke(); ctx.restore();
    // Secondary smaller pseudopods (lobopods)
    for (let i=0;i<2+mi;i++) {
      const la=-Math.PI*0.28+(i/(1+mi))*Math.PI*0.56;
      const lLen=R*sz*(0.30+nh(n,1500+i)*0.22)*(0.68+Math.sin(flowPhase+i*1.4)*0.32);
      const lx=massX+Math.cos(la)*mR*(0.68+nh(n,1501+i)*0.22);
      const ly=massY+Math.sin(la)*mR*(0.58+nh(n,1502+i)*0.18);
      const ltX=lx+Math.cos(la)*lLen, ltY=ly+Math.sin(la)*lLen;
      ctx.save(); ctx.globalAlpha=A-0.14; ctx.fillStyle=g; ctx.beginPath();
      ctx.moveTo(lx-R*sz*0.10,ly); ctx.quadraticCurveTo(ltX,ltY,lx+R*sz*0.10,ly); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    // Trailing reticulopods (thin network behind)
    if (st>=1) {
      const nR2=3+mi;
      for (let i=0;i<nR2;i++) {
        const ra=Math.PI*0.82+(i/(nR2-1)-0.5)*Math.PI*0.48;
        hypha(ctx,massX+mR*0.60,massY,ra,R*sz*(0.38+nh(n,1600+i)*0.28),R*sz*0.028,2,t,n,1600+i*18,acc,A-0.20);
      }
    }
    // Contractile vacuole pulsing
    const cvR=R*sz*(0.066+pulse(t,n,1.4)*0.044);
    fcirc(ctx,massX+mR*0.18,massY-mR*0.24,cvR,acc,acc,A-0.24,5);

  } else {
    // ── NODE WEB: polygon of anchor nodes + bezier threads ──
    const nNodes=5+mi;
    const webR=R*sz*0.82;
    // Node positions (irregular polygon)
    const nodes:{x:number,y:number}[]=[];
    for (let i=0;i<nNodes;i++) {
      const na=(i/nNodes)*Math.PI*2+nh(n,1700+i)*0.42;
      const nr=webR*(0.68+nh(n,1701+i)*0.32);
      nodes.push({x:cx+offX+Math.cos(na)*nr, y:cy+Math.sin(na)*nr});
    }
    // Connecting threads (cubic bezier)
    for (let i=0;i<nNodes;i++) {
      for (let j=i+1;j<nNodes;j++) {
        if (nh(n,1800+i*nNodes+j)<0.62) {
          const ni=nodes[i], nj=nodes[j];
          const mx=(ni.x+nj.x)/2+(nh(n,1802+i*j)-0.5)*webR*0.32;
          const my=(ni.y+nj.y)/2+(nh(n,1803+i*j)-0.5)*webR*0.22;
          const pulseMul=0.58+pulse(t,n+i*7+j*3,0.85+nh(n,1804+i+j)*0.55)*0.42;
          ctx.save(); ctx.globalAlpha=A*pulseMul*0.60; ctx.strokeStyle=f; ctx.lineWidth=R*sz*0.030; ctx.lineCap='round';
          ctx.shadowColor=acc; ctx.shadowBlur=3;
          ctx.beginPath(); ctx.moveTo(ni.x,ni.y); ctx.quadraticCurveTo(mx,my,nj.x,nj.y); ctx.stroke(); ctx.restore();
        }
      }
    }
    // Glowing nodes
    for (let i=0;i<nNodes;i++) {
      const nd=nodes[i];
      const nr2=R*sz*(0.058+pulse(t,n+i*11,0.8+nh(n,1900+i))*0.048);
      fcirc(ctx,nd.x,nd.y,nr2,acc,acc,A*(0.68+pulse(t,n+i*5,0.72)*0.32),8);
      if (st>=1) sarc(ctx,nd.x,nd.y,nr2*1.8,0,Math.PI*2,f,A-0.32,0.42);
    }
    // Central hub (stage 2+)
    if (st>=2) {
      const hubR=R*sz*(0.12+pulse(t,n,1.0)*0.055);
      fcirc(ctx,cx+offX,cy,hubR,acc,acc,A*0.82,10);
    }
  }
}

// ── PHYLUM 3: VASCULAR ───────────────────────────────────
// Clade 0=Snap Trap  1=Root Walker  2=Polyp Colony  3=Tendril Star
function drawVascular(ctx:Ctx,cx:number,cy:number,R:number,n:number,cl:number,st:number,mi:number,t:number,ectx:EntityDrawContext|null,f:string,g:string,acc:string,A:number): void {
  const sz=[0.52,0.70,1.00,1.10][st];
  const lean=alertLean(ectx?.playerDist??3);
  const playerDist=ectx?.playerDist??3;
  const offX=-lean*R*0.08;
  const shk=damageShake(t,ectx?.hpFrac??1);

  if (cl===0) {
    // ── SNAP TRAP: two large jaws ARE the body ──
    const lobeR=R*sz*(0.68+mi*0.06);
    const open=trapOpen(playerDist,t,n);
    // Small supporting peduncle below
    const pedH=R*sz*0.30;
    const pedW=R*sz*0.10;
    // Root at very bottom
    for (let i=0;i<3+mi;i++) {
      const ra=Math.PI*(0.32+i*0.20)+lean*0.28;
      rtend(ctx,cx+offX+shk,cy+pedH+R*sz*0.10,ra,R*sz*(0.28+nh(n,2000+i)*0.18),R*sz*0.048,f,g,A-0.24,n,2000+i*5);
    }
    // Peduncle
    sline(ctx,cx+offX+shk,cy+pedH,cx+offX+shk,cy-R*sz*0.04,f,A-0.10,pedW*2);
    // Top and bottom lobe (above and below hinge)
    snapLobe(ctx,cx+offX+shk,cy,lobeR,open,-1,2+mi,f,g,acc,A);
    snapLobe(ctx,cx+offX+shk,cy,lobeR,open,1,2+mi,f,g,acc,A);
    // Nectary gland (glowing dot at hinge)
    fcirc(ctx,cx+offX+shk,cy,R*sz*0.072,acc,acc,A*(0.64+pulse(t,n,1.8)*0.36),6);
    // Captured prey indicator (stage 3)
    if (st===3) fcirc(ctx,cx+offX+shk,cy,R*sz*0.12,'rgba(55,35,18,0.78)',g,A*0.48*(1-open),3);

  } else if (cl===1) {
    // ── ROOT WALKER: round root-ball on root-stilt legs ──
    const ballR=R*sz*(0.54+mi*0.04);
    const bob=wave(t,n,2.0,R*sz*0.032);
    // Root-ball (lumpy, not smooth sphere)
    oblob(ctx,cx+offX+shk,cy+bob-R*sz*0.12,ballR,ballR*0.88,f,g,A,n,60);
    // Leaf/frond cluster at top of root-ball
    const nFrond=3+mi;
    for (let i=0;i<nFrond;i++) {
      const fa=-Math.PI*0.5+(i/(nFrond-1)-0.5)*Math.PI*0.72;
      const fLen=R*sz*(0.38+nh(n,2100+i)*0.24);
      const fSway=wave(t,n+i,0.6,fLen*0.06);
      const frX=cx+offX+shk+Math.cos(fa)*ballR*0.82, frY=cy+bob-R*sz*0.12+Math.sin(fa)*ballR*0.82;
      const ftX=frX+Math.cos(fa)*fLen+fSway, ftY=frY+Math.sin(fa)*fLen;
      vascTrunk(ctx,frX,frY,ftX,ftY,R*sz*0.042,t,n+i*7,f,acc,A-0.08);
      fell(ctx,ftX,ftY,R*sz*(0.14+nh(n,2101+i)*0.08),R*sz*(0.20+wave(t,n+i,0.72,R*sz*0.028)),f,g,A-0.14,3);
    }
    // Root-stilt legs (4-6 from underside of ball)
    const nRoots=4+mi*2;
    for (let i=0;i<nRoots;i++) {
      const ra=Math.PI*(0.28+i*(0.44/(nRoots-1)));
      const rlX=cx+offX+shk+Math.cos(ra)*ballR*0.72;
      const rlY=cy+bob-R*sz*0.12+Math.sin(ra)*ballR*0.72;
      const lift=stepGait(t,n,i,nRoots,2.0)*R*sz*0.18;
      // Thick root-leg going down to ground
      const groundY=cy+R*sz*0.52;
      const midX=rlX+(nh(n,2200+i)-0.5)*R*sz*0.22, midY=(rlY+groundY)*0.5-lift;
      ctx.save(); ctx.globalAlpha=A-0.08; ctx.strokeStyle=f; ctx.lineWidth=R*sz*(0.080-i*0.004); ctx.lineCap='round'; ctx.shadowColor=g; ctx.shadowBlur=2;
      ctx.beginPath(); ctx.moveTo(rlX,rlY); ctx.quadraticCurveTo(midX,midY,rlX+(nh(n,2201+i)-0.5)*R*sz*0.14,groundY); ctx.stroke(); ctx.restore();
      // Root tip (spreading fine rootlets)
      if (st>=1) {
        const tipX=rlX+(nh(n,2201+i)-0.5)*R*sz*0.14, tipY=groundY;
        for (let r=0;r<2+mi;r++) {
          const rta=Math.PI*(0.22+r*0.28);
          sline(ctx,tipX,tipY,tipX+Math.cos(rta)*R*sz*0.12,tipY+Math.sin(rta)*R*sz*0.10,f,A-0.28,R*sz*0.028);
        }
      }
    }
    if ((ectx?.hpFrac??1)<0.5) drawScar(ctx,cx+offX+shk,cy+bob,R,n,0x5701);

  } else if (cl===2) {
    // ── POLYP COLONY: flat mat + multiple stalks + polyp tips ──
    const matW=R*sz*(1.52+mi*0.14);
    // Rhizome mat at base
    oblob(ctx,cx+offX,cy+R*sz*0.44,matW,R*sz*0.18,g,g,A-0.22,n,80);
    // Stolon connections
    ctx.save(); ctx.globalAlpha=A-0.28; ctx.strokeStyle=g; ctx.lineWidth=R*sz*0.035; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(cx+offX-matW,cy+R*sz*0.44); ctx.lineTo(cx+offX+matW,cy+R*sz*0.44); ctx.stroke(); ctx.restore();
    // Stalks of varied heights from mat
    const nStalk=3+mi;
    for (let i=0;i<nStalk;i++) {
      const sOff=(i/(nStalk-1)-0.5)*matW*0.80;
      const sBaseX=cx+offX+sOff, sBaseY=cy+R*sz*0.38;
      const sH=R*sz*(0.58+nh(n,2300+i)*0.48);
      const sSway=wave(t,n+i,0.5+nh(n,2301+i)*0.3,sH*0.032);
      const sTX=sBaseX+sSway, sTY=sBaseY-sH;
      vascTrunk(ctx,sBaseX,sBaseY,sTX,sTY,R*sz*0.055,t,n+i*9,f,acc,A-0.06);
      // Polyp tip (open/close)
      const polyOpen=0.40+pulse(t,n+i*7,0.90+nh(n,2302+i)*0.40)*0.60;
      const polyR=R*sz*(0.10+nh(n,2303+i)*0.04);
      fcirc(ctx,sTX,sTY,polyR*polyOpen,acc,acc,A*(0.70+polyOpen*0.30),5);
      // Tentacles emerging from polyp (stage 1+)
      if (st>=1) {
        const nPT=4+mi;
        for (let j=0;j<nPT;j++) {
          const pta=(j/nPT)*Math.PI*2;
          const ptLen=polyR*(0.80+polyOpen*0.60);
          sline(ctx,sTX,sTY,sTX+Math.cos(pta)*ptLen,sTY+Math.sin(pta)*ptLen*0.68,acc,A-0.28,R*sz*0.022);
        }
      }
    }

  } else {
    // ── TENDRIL STAR: central node + radiating grappling tendrils ──
    const nodeR=R*sz*(0.18+mi*0.04);
    // Central node (small — tendrils dominate)
    oblob(ctx,cx+offX,cy,nodeR,nodeR*0.92,f,g,A,n,90);
    // Radiating grappling tendrils (4-7, varied lengths)
    const nTend=4+mi+st;
    for (let i=0;i<nTend;i++) {
      const ta=(i/nTend)*Math.PI*2+lean*0.28+nh(n,2400+i)*0.38;
      const tLen=R*sz*(0.72+nh(n,2401+i)*0.62);
      const alertCurl=(alertLean(playerDist)*6)*(i%2===0?1:-1);
      const animCurl=wave(t,n+i,0.45+nh(n,2402+i)*0.38,R*sz*0.20)+alertCurl;
      const c1x=cx+offX+Math.cos(ta)*tLen*0.38+animCurl;
      const c1y=cy+Math.sin(ta)*tLen*0.38;
      const c2x=cx+offX+Math.cos(ta)*tLen*0.72+(nh(n,2403+i)-0.5)*tLen*0.22;
      const c2y=cy+Math.sin(ta)*tLen*0.72+(nh(n,2404+i)-0.5)*tLen*0.14;
      const tx=cx+offX+Math.cos(ta)*tLen, ty=cy+Math.sin(ta)*tLen;
      ctx.save(); ctx.globalAlpha=A-0.06; ctx.strokeStyle=f; ctx.lineWidth=nodeR*(0.42-i*0.028); ctx.shadowColor=g; ctx.shadowBlur=3; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(cx+offX,cy); ctx.bezierCurveTo(c1x,c1y,c2x,c2y,tx,ty); ctx.stroke(); ctx.restore();
      // Curl tip (grappling hook)
      sarc(ctx,tx,ty,nodeR*(0.60-i*0.04),ta+Math.PI*0.55,ta+Math.PI*1.45,acc,A-0.16,R*sz*0.048,3);
      // Suckers along length (stage 1+)
      if (st>=1 && i%2===0) {
        for (let s=1;s<=3;s++) {
          const sp=s/4;
          const bx=(1-sp)*(1-sp)*(cx+offX)+2*(1-sp)*sp*c1x+sp*sp*tx;
          const by=(1-sp)*(1-sp)*cy+2*(1-sp)*sp*c1y+sp*sp*ty;
          sarc(ctx,bx,by,nodeR*0.28,0,Math.PI*2,acc,A-0.30,0.55);
        }
      }
    }
    if (st===3) drawScar(ctx,cx+offX+nodeR*0.88,cy-nodeR*0.62,R,n,0x5E01);
  }
}

// ── PHYLUM 4: CRYSTALLINE ────────────────────────────────
// Clade 0=Asymmetric Spire Cluster  1=Geode Bowl  2=Lattice Bubble  3=Bone Cage
function drawCrystalline(ctx:Ctx,cx:number,cy:number,R:number,n:number,cl:number,st:number,mi:number,t:number,ectx:EntityDrawContext|null,f:string,g:string,acc:string,A:number): void {
  const sz=[0.50,0.68,1.00,1.12][st];
  const lean=alertLean(ectx?.playerDist??3);
  const shk=damageShake(t,ectx?.hpFrac??1);
  const offX=-lean*R*0.08+shk;
  const hpFrac=ectx?.hpFrac??1;
  const resPulse=pulse(t,n,0.82);

  if (cl===0) {
    // ── ASYMMETRIC SPIRE CLUSTER: tallest center, declining sides + laminae ──
    const nS=[3,4,6,8][st];
    const maxLen=R*sz*(1.38+nh(n,0xE001)*0.44);
    // Base plate
    ctx.save(); ctx.globalAlpha=A-0.18; ctx.fillStyle=g; ctx.shadowColor=g; ctx.shadowBlur=4;
    ctx.beginPath(); ctx.ellipse(cx+offX,cy+R*sz*0.12,R*sz*(0.52+mi*0.08),R*sz*0.12,0,0,Math.PI*2); ctx.fill(); ctx.restore();
    for (let i=0;i<nS;i++) {
      const fr=(i/(nS-1)-0.5);
      // Asymmetric height distribution (not symmetric about center)
      const asym=nh(n,0xE002+i)*0.38-0.19;
      const sLen=maxLen*(1-Math.abs(fr+asym)*0.72)*(0.80+resPulse*0.20);
      const sOff=fr*R*sz*(0.82+mi*0.06)+(nh(n,0xE003+i)-0.5)*R*sz*0.12;
      const stilt=-Math.PI*0.5+(fr+asym)*Math.PI*0.22+wave(t,n+i,0.32,0.040)+lean*0.22;
      const sw=R*sz*(0.082-Math.abs(fr)*0.022);
      cshard(ctx,cx+offX+sOff,cy+R*sz*0.10,stilt,sLen,sw,f,g,A*(0.82+resPulse*0.18));
      if (st>=2) {
        fcirc(ctx,cx+offX+sOff+Math.cos(stilt)*sLen,cy+R*sz*0.10+Math.sin(stilt)*sLen,sw*(0.55+resPulse*0.38),acc,acc,A*0.62*(0.72+resPulse*0.28),5);
      }
    }
    // Horizontal laminae crossing cluster
    if (st>=1) {
      ctx.save(); ctx.globalAlpha=A-0.26; ctx.strokeStyle=acc; ctx.lineWidth=0.55;
      for (let i=0;i<2+mi;i++) {
        const lY=cy-maxLen*(0.26+i*0.24);
        ctx.beginPath(); ctx.moveTo(cx+offX-maxLen*0.44,lY); ctx.lineTo(cx+offX+maxLen*0.44,lY); ctx.stroke();
        // Facet reflection
        ctx.save(); ctx.globalAlpha*=0.40; ctx.strokeStyle='rgba(255,255,255,0.62)';
        ctx.beginPath(); ctx.moveTo(cx+offX-maxLen*0.32,lY+1.0); ctx.lineTo(cx+offX+maxLen*0.18,lY+1.0); ctx.stroke(); ctx.restore();
      }
      ctx.restore();
    }
    if (hpFrac<0.5) {
      fcirc(ctx,cx+offX+R*sz*0.20,cy-R*sz*0.24,R*sz*(0.11+nh(n,0xE004)*0.08),`hsl(${(parseInt(acc.match(/\d+/)?.[0]||'185')+60)%360},52%,48%)`,g,A*(0.55-hpFrac)*0.9,4);
    }

  } else if (cl===1) {
    // ── GEODE BOWL: hollow shell facing player direction ──
    const shellR=R*sz*0.96;
    // Bowl faces toward player (left by default, tracked)
    const faceAngle=Math.PI*(1.0+lean*0.18);
    const apert=(0.54+resPulse*0.14)*Math.PI;
    ctx.save(); ctx.globalAlpha=A; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=8;
    ctx.beginPath();
    ctx.arc(cx+offX,cy,shellR,faceAngle-apert/2,faceAngle+apert/2,true);
    ctx.lineTo(cx+offX,cy); ctx.closePath(); ctx.fill();
    ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,0.16)'; ctx.lineWidth=0.70; ctx.stroke(); ctx.restore();
    // Rough exterior texture
    if (st>=1) {
      for (let i=0;i<4+mi;i++) {
        const ba=faceAngle+Math.PI*0.52+i*(Math.PI*1.0/(3+mi));
        cshard(ctx,cx+offX+Math.cos(ba)*shellR*0.82,cy+Math.sin(ba)*shellR*0.82,ba,R*sz*(0.06+nh(n,0xE110+i)*0.06),R*sz*0.028,g,g,A-0.20);
      }
    }
    // Interior crystals
    const nInt=4+mi*2+st;
    for (let i=0;i<nInt;i++) {
      const ia=faceAngle-apert*0.42+(i/nInt)*apert*0.84;
      const iR=shellR*(0.22+nh(n,0xE111+i)*0.48);
      const iLen=shellR*(0.24+nh(n,0xE112+i)*0.32);
      cshard(ctx,cx+offX+Math.cos(ia)*iR*0.52,cy+Math.sin(ia)*iR*0.52,ia,iLen,R*sz*0.056,acc,acc,A*(0.68+resPulse*0.32));
    }
    // Druzy sparkle (stage 2+)
    if (st>=2) {
      for (let i=0;i<6+mi;i++) {
        const sa=faceAngle-apert*0.36+nh(n,0xE113+i)*apert*0.72;
        const sr=shellR*(0.38+nh(n,0xE114+i)*0.42);
        fcirc(ctx,cx+offX+Math.cos(sa)*sr,cy+Math.sin(sa)*sr,R*sz*0.026,acc,acc,A*(0.52+resPulse*0.38),4);
      }
    }

  } else if (cl===2) {
    // ── LATTICE BUBBLE: iridescent membrane + internal scaffold ──
    const scR=R*sz*(0.62+mi*0.04);
    // Internal scaffold ribs
    for (let i=0;i<4+mi;i++) {
      const sa=(i/(3+mi))*Math.PI*2;
      sline(ctx,cx+offX,cy,cx+offX+Math.cos(sa)*scR,cy+Math.sin(sa)*scR,f,A-0.28,R*sz*0.058);
    }
    sarc(ctx,cx+offX,cy,scR,0,Math.PI*2,f,A-0.30,R*sz*0.048);
    // Iridescent membrane (animated color gradient)
    const mp=t*0.001*0.32;
    ctx.save(); ctx.globalAlpha=A*0.32; ctx.shadowColor=acc; ctx.shadowBlur=7;
    const grad=ctx.createRadialGradient(cx+offX,cy,scR*0.32,cx+offX,cy,scR*1.12);
    grad.addColorStop(0,`hsla(${(200+Math.sin(mp)*44).toFixed(0)},80%,76%,0.0)`);
    grad.addColorStop(0.58,`hsla(${(200+Math.cos(mp*1.4)*54).toFixed(0)},86%,70%,0.65)`);
    grad.addColorStop(1.0,`hsla(${(200+Math.sin(mp*0.8)*34).toFixed(0)},90%,80%,0.0)`);
    ctx.fillStyle=grad;
    ctx.beginPath(); ctx.arc(cx+offX,cy,scR*1.12,0,Math.PI*2); ctx.fill(); ctx.restore();
    // Outer shard cluster
    if (st>=1) {
      for (let i=0;i<4+mi;i++) {
        const sa2=(i/(3+mi))*Math.PI*2+wave(t,n+i,0.28,0.14);
        cshard(ctx,cx+offX+Math.cos(sa2)*scR,cy+Math.sin(sa2)*scR,sa2,R*sz*(0.18+resPulse*0.072),R*sz*0.050,acc,acc,A*(0.70+resPulse*0.30));
      }
    }
    // Central resonance node
    fcirc(ctx,cx+offX,cy,R*sz*(0.072+resPulse*0.036),acc,acc,A*0.82,8);
    if (hpFrac<0.5) drawScar(ctx,cx+offX+R*sz*0.28,cy-R*sz*0.18,R,n,0x5801);

  } else {
    // ── BONE CAGE: curved rib struts forming an ovoid cage ──
    const cageW=R*sz*(0.78+mi*0.06), cageH=R*sz*(1.02+mi*0.04);
    const nRibs=4+mi;
    // Ribs (curved struts from top pole to bottom pole)
    for (let i=0;i<nRibs;i++) {
      const ra=(i/nRibs)*Math.PI*2+wave(t,n+i,0.22,0.036);
      const cpX=cx+offX+Math.cos(ra)*cageW*1.22;
      const cpY=cy;
      const topX=cx+offX+Math.cos(ra)*cageW*0.28, topY=cy-cageH;
      const botX=cx+offX+Math.cos(ra)*cageW*0.28, botY=cy+cageH;
      ctx.save(); ctx.globalAlpha=A-0.06; ctx.strokeStyle=f; ctx.lineWidth=R*sz*(0.068-i*0.006); ctx.shadowColor=g; ctx.shadowBlur=3; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(topX,topY); ctx.quadraticCurveTo(cpX,cpY,botX,botY); ctx.stroke(); ctx.restore();
      // Joint nodes at rib widest point
      fcirc(ctx,cpX,cpY,R*sz*0.052,f,g,A-0.14,3);
    }
    // Horizontal hoop rings
    if (st>=1) {
      for (let i=0;i<2+mi;i++) {
        const hy=cy-cageH*0.55+i*cageH*(1.1/(1+mi));
        const hr=cageW*(0.68+nh(n,0xE200+i)*0.22);
        sarc(ctx,cx+offX,hy,hr,0,Math.PI*2,acc,A-0.22,R*sz*0.042,2);
      }
    }
    // Hollow interior glowing core
    const coreR=R*sz*(0.14+resPulse*0.06);
    fcirc(ctx,cx+offX,cy,coreR,acc,acc,A*0.52*(0.62+resPulse*0.38),8);
    // Top and bottom poles
    fcirc(ctx,cx+offX,cy-cageH,R*sz*0.062,f,g,A-0.10,4);
    fcirc(ctx,cx+offX,cy+cageH,R*sz*0.062,f,g,A-0.10,4);
    if (st===3) drawScar(ctx,cx+offX+cageW*0.60,cy,R,n,0x5F01);
  }
}

// ── PHYLUM 5: CHIMERA ────────────────────────────────────
// Integrated composites — NOT clipped halves
// Clade 0=Tentacle-Legged  1=Fungal Root-Ball  2=Crystal-Wrapped Ceph  3=Armored Crystal Growth
function drawChimera(ctx:Ctx,cx:number,cy:number,R:number,n:number,cl:number,st:number,mi:number,t:number,ectx:EntityDrawContext|null,f:string,g:string,acc:string,A:number): void {
  const sz=[0.55,0.72,1.00,1.10][st];
  const lean=alertLean(ectx?.playerDist??3);
  const shk=damageShake(t,ectx?.hpFrac??1);
  const offX=shk-lean*R*0.14;
  // Dual colors from two parent phyla
  const col1=lineageColors(n,false,false);
  const col2=lineageColors(((n*97+113)%254)+1,false,false);

  if (cl===0) {
    // ── TENTACLE-LEGGED: arthropod bilobate body + tentacle limbs + compound eye on stalk ──
    const proW=R*sz*0.72, proH=R*sz*0.52;
    const opR=R*sz*0.40;
    // Prosoma (arthropod teardrop shape) in col1
    spiderBody(ctx,cx+offX,cy,proW,proH,opR,R*sz*0.06,n,col1.f,col1.g,A);
    // 6 tentacle limbs (cephalopod style, not jointed) from prosoma underside
    for (let i=0;i<6;i++) {
      const side=i<3?-1:1;
      const pair=i%3;
      const lX=cx+offX-proW*0.52+pair*(proW*1.04/2);
      const lY=cy+side*proH*0.72;
      const tLen=R*sz*(0.58+nh(n,3000+i)*0.28);
      const tipX=lX+Math.cos(side>0?Math.PI*0.58:Math.PI*0.42)*tLen;
      const tipY=lY+Math.sin(side>0?Math.PI*0.58:Math.PI*0.42)*tLen;
      tentArm(ctx,lX,lY,tipX,tipY,R*sz*0.052,true,(nh(n,3001+i)-0.5)*R*sz*0.20,t,n,i*11,col2.f,col2.g,A-0.06);
    }
    // Compound eye on short stalk at prosoma front
    const eSX=cx+offX-proW*0.80, eSY=cy;
    sline(ctx,eSX,eSY,eSX-R*sz*0.20,eSY-R*sz*0.24,col2.f,A-0.06,R*sz*0.055);
    compoundEye(ctx,eSX-R*sz*0.20,eSY-R*sz*0.24,R*sz*0.20,R*sz*0.14,n,col2.f,col2.g,A);

  } else if (cl===1) {
    // ── FUNGAL ROOT-BALL: vascular root-ball body + mushroom caps growing from it ──
    const ballR=R*sz*(0.52+mi*0.04);
    const bob=wave(t,n,1.8,R*sz*0.026);
    // Root-ball (vascular col1)
    oblob(ctx,cx+offX,cy+bob,ballR,ballR*0.88,col1.f,col1.g,A,n,60);
    // Root-stilt legs
    const nRL=4+mi;
    for (let i=0;i<nRL;i++) {
      const ra=Math.PI*(0.25+i*(0.50/(nRL-1)));
      const rlX=cx+offX+Math.cos(ra)*ballR*0.72, rlY=cy+bob+Math.sin(ra)*ballR*0.72;
      const lift=stepGait(t,n,i,nRL,2.0)*R*sz*0.18;
      ctx.save(); ctx.globalAlpha=A-0.10; ctx.strokeStyle=col1.f; ctx.lineWidth=R*sz*0.072; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(rlX,rlY); ctx.quadraticCurveTo(rlX+(nh(n,3100+i)-0.5)*R*sz*0.18,rlY+R*sz*0.30-lift,rlX+(nh(n,3101+i)-0.5)*R*sz*0.12,cy+bob+R*sz*0.54); ctx.stroke(); ctx.restore();
    }
    // Mushroom caps growing from ball top (fungal col2)
    const nCaps=2+mi;
    for (let i=0;i<nCaps;i++) {
      const capOff=(i/(nCaps-1)-0.5)*ballR*0.90;
      const capBaseX=cx+offX+capOff, capBaseY=cy+bob-ballR*(0.68+nh(n,3200+i)*0.18);
      const cW=R*sz*(0.28+nh(n,3201+i)*0.14), cH=R*sz*(0.15+nh(n,3202+i)*0.08);
      const stH=R*sz*(0.18+nh(n,3203+i)*0.10);
      sline(ctx,capBaseX,capBaseY,capBaseX,capBaseY-stH,col2.f,A-0.12,R*sz*0.038);
      mushCap(ctx,capBaseX,capBaseY-stH,cW,cH,st,n+i*7,t,col2.f,col2.g,A-0.06);
    }

  } else if (cl===2) {
    // ── CRYSTAL-WRAPPED CEPH: tall central spire + soft organic mantle wrapping lower half ──
    const spireLen=R*sz*(1.28+mi*0.10);
    const spireW=R*sz*(0.09+mi*0.02);
    // Central crystal spire (crystalline col1)
    cshard(ctx,cx+offX,cy+R*sz*0.14,-Math.PI*0.5,spireLen,spireW,col1.f,col1.g,A);
    if (st>=2) {
      // Flanking secondary spires
      for (const s of [-1,1] as const) {
        cshard(ctx,cx+offX+s*R*sz*0.22,cy+R*sz*0.10,-Math.PI*0.5+s*0.22,spireLen*0.62,spireW*0.68,col1.f,col1.g,A-0.12);
      }
    }
    // Organic mantle wrapping lower half (cephalopod col2)
    const mantleR=R*sz*0.52;
    const contract=bellContract(t,n)*0.52;
    ctx.save(); ctx.globalAlpha=A-0.12; ctx.fillStyle=col2.f; ctx.shadowColor=col2.g; ctx.shadowBlur=6;
    ctx.beginPath();
    ctx.moveTo(cx+offX-mantleR*(1-contract*0.20),cy);
    ctx.bezierCurveTo(cx+offX-mantleR,cy+R*sz*0.08,cx+offX-mantleR*0.58,cy+R*sz*0.44,cx+offX,cy+R*sz*0.42);
    ctx.bezierCurveTo(cx+offX+mantleR*0.58,cy+R*sz*0.44,cx+offX+mantleR,cy+R*sz*0.08,cx+offX+mantleR*(1-contract*0.20),cy);
    ctx.closePath(); ctx.fill(); ctx.shadowBlur=0;
    ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=0.65; ctx.stroke(); ctx.restore();
    // Tentacles from mantle base
    const nTA2=4+mi;
    for (let i=0;i<nTA2;i++) {
      const ta=-Math.PI*0.10+(i/(nTA2-1)-0.5)*Math.PI*0.72;
      const tLen=R*sz*(0.52+nh(n,3300+i)*0.32);
      tentArm(ctx,cx+offX+Math.cos(ta)*mantleR*0.78,cy+R*sz*0.32,cx+offX+Math.cos(ta)*tLen,cy+R*sz*0.32+Math.sin(ta)*tLen*0.62,R*sz*0.040,st>=2,(nh(n,3301+i)-0.5)*R*sz*0.22,t,n,i*9,col2.f,col2.g,A-0.10);
    }
    // Spire tip glow
    fcirc(ctx,cx+offX,cy+R*sz*0.14-spireLen,R*sz*0.044,col1.acc,col1.acc,A*0.84,8);

  } else {
    // ── ARMORED CRYSTAL GROWTH: wide crab carapace with crystal eruptions from joints ──
    const cW=R*sz*1.52, cH=R*sz*0.44;
    // Carapace (arthropod col1)
    crabCarapace(ctx,cx+offX,cy,cW,cH,n,col1.f,col1.g,A);
    // Crystal spires erupting from carapace surface (col2)
    const nSpires=3+mi+st;
    for (let i=0;i<nSpires;i++) {
      const sOff=(i/(nSpires-1)-0.5)*cW*0.88;
      const sLen=R*sz*(0.32+nh(n,3400+i)*0.44)*(0.80+resPulseLocal(t,n+i)*0.20);
      cshard(ctx,cx+offX+sOff,cy-cH*(0.60+nh(n,3401+i)*0.30),-Math.PI*0.5+(nh(n,3402+i)-0.5)*0.28,sLen,R*sz*0.055,col2.f,col2.g,A-0.06);
    }
    // Leg openings with semi-crystallized legs
    for (let i=0;i<4;i++) {
      const side=i<2?-1:1;
      const pair=i%2;
      const lX=cx+offX+(side<0?-cW*0.46:cW*0.46);
      const lY=cy+cH*0.62+pair*cH*0.30;
      // Upper segment: crystalline
      const legA=side<0?Math.PI*0.68:Math.PI*0.32;
      cshard(ctx,lX,lY,legA,R*sz*0.26,R*sz*0.052,col2.f,col2.g,A-0.14);
      // Lower segment: organic
      const kX=lX+Math.cos(legA)*R*sz*0.26, kY=lY+Math.sin(legA)*R*sz*0.26;
      sline(ctx,kX,kY,kX+Math.cos(legA+Math.PI*0.22)*R*sz*0.22,kY+Math.sin(legA+Math.PI*0.22)*R*sz*0.22,col1.f,A-0.18,R*sz*0.044);
    }
  }
}

function resPulseLocal(t:number,n:number):number { return (Math.sin(t*0.001*0.82*Math.PI*2+nh(n,0xB2B2)*Math.PI*2)+1)*0.5; }

// ═══════════════════════════════════════════════════════════
// §8  MAIN DISPATCH + drawVirus
// ═══════════════════════════════════════════════════════════
export function drawVirus(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  n: number, cell: number,
  flash: boolean,
  green?: boolean,
  t?: number,
  ectx?: EntityDrawContext,
): void {
  const R   = cell;
  const ts  = t ?? performance.now();
  const ph  = PHYLUM(n);
  const cl  = CLADE(n);
  const st  = STAGE(n);
  const mi  = MICRO(n);
  const col = lineageColors(n, flash, green);
  const A   = flash ? 0.94 : 0.91;
  const ec  = ectx ?? null;

  switch (ph) {
    case 0: drawCephalopoda(ctx,cx,cy,R,n,cl,st,mi,ts,ec,col.f,col.g,col.acc,A); break;
    case 1: drawArthropoda (ctx,cx,cy,R,n,cl,st,mi,ts,ec,col.f,col.g,col.acc,A); break;
    case 2: drawFungi      (ctx,cx,cy,R,n,cl,st,mi,ts,ec,col.f,col.g,col.acc,A); break;
    case 3: drawVascular   (ctx,cx,cy,R,n,cl,st,mi,ts,ec,col.f,col.g,col.acc,A); break;
    case 4: drawCrystalline(ctx,cx,cy,R,n,cl,st,mi,ts,ec,col.f,col.g,col.acc,A); break;
    default:drawChimera    (ctx,cx,cy,R,n,cl,st,mi,ts,ec,col.f,col.g,col.acc,A); break;
  }
}

export function drawVirusSilhouette(ctx: CanvasRenderingContext2D, cx: number, cy: number, n: number, cell: number): void {
  ctx.save(); ctx.globalAlpha=0.52;
  drawVirus(ctx, cx, cy, n, cell, false, false, performance.now());
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════
// §9  MORPH SIG + SPAWN DIVERSITY GATE
// ═══════════════════════════════════════════════════════════
export type MorphRole =
  | 'cephalopod' | 'arthropod' | 'fungal' | 'vascular' | 'crystalline' | 'chimera';

const PH_ROLES: MorphRole[] = ['cephalopod','arthropod','fungal','vascular','crystalline','chimera'];

export interface MorphSig {
  topology:        number;
  bodyPlan:        number;
  detailLevel:     number;
  variant:         number;
  cls:             number;
  role:            MorphRole;
  domain:          number;
  aspectGroup:     number;
  massCenter:      number;
  hybrid:          boolean;
  innovation:      boolean;
  phylum:          number;
  clade:           number;
  stage:           number;
  silhouetteFamily:number;  // 0-23 (ph*4+cl) — substrate-avoidance key
}

const VC_O: VirusClass[] = ['prime','power-of-two','perfect-square','even-composite','odd-composite'];

export function getMorphSig(n: number): MorphSig {
  const ph=PHYLUM(n), cl=CLADE(n), st=STAGE(n), mi=MICRO(n);
  const mc = cl===0?0:cl===1?1:cl===2?3:2;
  return {
    topology: ph*4+cl, bodyPlan: cl, detailLevel: st, variant: mi,
    cls: VC_O.indexOf(getVirusClass(n)),
    role: PH_ROLES[ph], domain: ph, aspectGroup: cl,
    massCenter: mc, hybrid: cl===3, innovation: ph===5,
    phylum: ph, clade: cl, stage: st,
    silhouetteFamily: ph*4+cl,
  };
}

export function morphDistance(a: MorphSig, b: MorphSig): number {
  let d=0;
  d += (a.phylum!==b.phylum            ? 1:0)*0.36;
  d += (a.silhouetteFamily!==b.silhouetteFamily ? 1:0)*0.28;
  d += (a.clade!==b.clade              ? 1:0)*0.18;
  d += (a.stage!==b.stage              ? 1:0)*0.12;
  d += (a.massCenter!==b.massCenter    ? 1:0)*0.06;
  return d;
}

const SPAWN_WIN=20, MAX_SAME_PHYLUM=2, MAX_SAME_SILO=1;
const _hist: MorphSig[]=[];

export function registerSpawn(sig: MorphSig): void { _hist.push(sig); if (_hist.length>SPAWN_WIN) _hist.shift(); }
export function clearSpawnHistory(): void { _hist.length=0; }

export function pickDiverseSeed(): number {
  let best=-1, bestScore=-Infinity;
  for (let i=0; i<88; i++) {
    const seed=1+((i*97+Math.floor(Math.random()*41))%255);
    const sig=getMorphSig(seed);
    const phC=_hist.filter(s=>s.phylum===sig.phylum).length;
    const sfC=_hist.filter(s=>s.silhouetteFamily===sig.silhouetteFamily).length;
    const stC=_hist.filter(s=>s.stage===sig.stage).length;
    // Hard exclusion: too many of same phylum OR same silhouette family recently
    if (phC>=MAX_SAME_PHYLUM||sfC>=MAX_SAME_SILO) continue;
    let minD=1.0; for (const s of _hist) { const d=morphDistance(sig,s); if (d<minD) minD=d; }
    const score=minD*Math.pow(0.42,phC)*Math.pow(0.55,sfC)*Math.pow(0.90,stC)+(sig.phylum===5?0.11:0);
    if (score>bestScore) { bestScore=score; best=seed; }
  }
  return best>0 ? best : 1+Math.floor(Math.random()*255);
}

export function selectDiverseSeed(waveSigs: MorphSig[], crossHistory: MorphSig[]): number {
  const all=[...crossHistory.slice(-8),...waveSigs];
  let best=-1, bestScore=-1;
  for (let attempt=0; attempt<72; attempt++) {
    const seed=Math.floor(Math.random()*255)+1, sig=getMorphSig(seed);
    let wMin=1.0; for (const ws of all) { const d=morphDistance(sig,ws); if (d<wMin) wMin=d; }
    const phS=all.filter(ws=>ws.phylum===sig.phylum).length;
    const sfS=all.filter(ws=>ws.silhouetteFamily===sig.silhouetteFamily).length;
    const score=wMin*Math.pow(0.48,phS)*Math.pow(0.60,sfS);
    if (score>bestScore) { bestScore=score; best=seed; }
  }
  return best>0 ? best : Math.floor(Math.random()*255)+1;
}

// ═══════════════════════════════════════════════════════════
// §10  DISTRIBUTION VALIDATION + CANVAS TEST
// ═══════════════════════════════════════════════════════════
export function validateDistribution(sampleSize=256): {
  phylumCounts:number[]; cladeCounts:number[]; stageCounts:number[]; passed:boolean;
} {
  const pc=new Array(6).fill(0), cc=new Array(4).fill(0), sc=new Array(4).fill(0);
  for (let i=0; i<sampleSize; i++) {
    const n=Math.floor(Math.random()*255)+1;
    const sig=getMorphSig(n);
    pc[sig.phylum]++; cc[sig.clade]++; sc[sig.stage]++;
  }
  const maxPF=Math.max(...pc)/sampleSize;
  const allPh=pc.every(c=>c>0), allCl=cc.every(c=>c>0), allSt=sc.every(c=>c>0);
  const passed=maxPF<=0.26&&allPh&&allCl&&allSt;
  const PH_N=['CEPH','ARTH','FUNG','VASC','XTAL','CHIM'];
  console.log('[Morphology v9] Distribution check:');
  console.log('  Phyla:',pc.map((c,i)=>PH_N[i]+':'+c).join(' '));
  console.log('  Clades:',cc,'  Stages:',sc);
  console.log(' ',passed?'✓ PASS':'✗ FAIL',{maxPhylumFrac:maxPF.toFixed(3),allPh,allCl,allSt});
  return {phylumCounts:pc,cladeCounts:cc,stageCounts:sc,passed};
}

export function runSilhouetteDiversityTest(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle='#06101e'; ctx.fillRect(0,0,w,h);
  const cols=6, rows=4, cell=Math.min(w/cols,h/rows)*0.90;
  const seeds=[3,19,37,53,7,23,41,59,11,29,43,61,13,31,47,67,17,33,51,71,5,25,45,65];
  const now2=performance.now();
  for (let i=0; i<Math.min(24,seeds.length); i++) {
    const col=i%cols, row=Math.floor(i/cols);
    const ex=w/cols*(col+0.5), ey=h/rows*(row+0.5);
    const seed=seeds[i];
    ctx.fillStyle='rgba(255,255,255,0.05)'; ctx.fillRect(ex-cell/2,ey-cell/2,cell,cell);
    drawVirus(ctx,ex,ey,seed,cell,false,false,now2);
    const sig=getMorphSig(seed);
    ctx.fillStyle='rgba(255,255,255,0.52)'; ctx.font=`${Math.round(cell*0.080)}px monospace`; ctx.textAlign='center';
    const PH_N2=['C','A','F','V','X','CH'];
    ctx.fillText(`${PH_N2[sig.phylum]}${sig.clade} S${sig.stage}`,ex,ey+cell*0.44);
  }
  const pc2=new Array(6).fill(0);
  for (const s of seeds.slice(0,24)) pc2[PHYLUM(s)]++;
  const passed2=pc2.filter(c=>c>0).length>=4;
  ctx.font=`${Math.round(cell*0.085)}px monospace`; ctx.textAlign='center';
  ctx.fillStyle=passed2?'#3fb950':'#f85149';
  ctx.fillText(`${passed2?'PASS':'FAIL'} — ${pc2.filter(c=>c>0).length}/6 phyla visible`,w/2,h-cell*0.10);
}

// ═══════════════════════════════════════════════════════════
// §11  LEGACY SHIMS (all call signatures unchanged)
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
