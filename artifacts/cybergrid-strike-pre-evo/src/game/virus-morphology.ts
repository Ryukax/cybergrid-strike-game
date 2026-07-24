/**
 * CyberGrid Strike — Entity Morphology v8 — LIVING ECOSYSTEM
 *
 * Six evolutionary phyla replace the sixteen isolated topologies.
 * Every entity belongs to a lineage with inherited anatomy,
 * four developmental stages, and stateless time-based animation.
 *
 * Phyla:
 *   0  CEPHALOPODA   soft bilateral — mantle, tentacles, chromatophores, siphon
 *   1  ARTHROPODA    segmented exoskeletal — jointed gait, compound eye, chelicerae
 *   2  FUNGI         colonial mycelial — hyphae network, fruiting bodies, spores
 *   3  VASCULAR      motile plant-like — trunk, fronds, traps, energy circulation
 *   4  CRYSTALLINE   inorganic mineralizing — facets, resonance, dissolution scars
 *   5  CHIMERA       cross-phylum hybrid — legible anatomical seam
 *
 * Clades (4 per phylum): evolutionary branches that share core anatomy.
 * Stages: 0=juvenile  1=subadult  2=adult  3=ancient
 * All animation: stateless, seeded by n, driven by performance.now().
 *
 * External API (all signatures backward compatible):
 *   drawVirus(ctx, cx, cy, n, cell, flash, green?, t?, ectx?)
 *   getVirusColors, getTopology, getMorphSig, pickDiverseSeed, etc.
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
  hpFrac:     number;  // 0–1; 1 = full health
  row:        number;  // grid row 0–2
  colPos:     number;  // current column position (may be fractional)
  playerRow:  number;  // player row
  playerDist: number;  // column distance to player (cells, 0 = same)
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

// Legacy class colors — getVirusColors signature preserved
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
// PHYLUM  0=Cephalopoda 1=Arthropoda 2=Fungi 3=Vascular 4=Crystalline 5=Chimera
// CLADE   0–3, evolutionary branch within phylum
// STAGE   0=juvenile 1=subadult 2=adult 3=ancient (biased by n, jittered)
// MICRO   0–2, fine variant within clade
export const PHYLUM = (n: number): number => Math.floor(nh(n, 0xF00D) * 6);
export const CLADE  = (n: number): number => Math.floor(nh(n, 0xC1AD) * 4);
export const STAGE  = (n: number): number => {
  const base = Math.min(3, Math.floor(n / 64));          // 0–3 from n quartile
  const jitter = Math.floor(nh(n, 0x5715) * 2.99) - 1;  // ±1 jitter
  return Math.max(0, Math.min(3, base + jitter));
};
export const MICRO  = (n: number): number => Math.floor(nh(n, 0xBABE) * 3);

// getTopology: backward compat — maps phylum×clade to 0–23
const N_TOPO = 24;
export function getTopology(n: number): number { return Math.min(N_TOPO-1, PHYLUM(n)*4+CLADE(n)); }

// ═══════════════════════════════════════════════════════════
// §3  LINEAGE COLOR SYSTEM
// ═══════════════════════════════════════════════════════════
// Each phylum owns a hue range; clade shifts within it; stage adjusts saturation+lightness.
const PH_HUE  = [285,  38, 205, 120, 183,   0]; // base hue per phylum (deg)
const PH_SAT  = [ 72,  68,  58,  70,  55,  65]; // base saturation %
const PH_LIT  = [ 60,  50,  65,  45,  63,  58]; // base lightness %
const CL_HUE_S = [-18, -6,   6,  18];           // clade hue shift (deg)
const ST_SAT_M = [0.70, 0.85, 1.00, 0.92];      // stage saturation multiplier
const ST_LIT_M = [1.14, 1.05, 1.00, 0.88];      // stage lightness multiplier

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
// §4  ANIMATION UTILITIES
// All stateless: phase seeded by n to prevent entity synchrony.
// ═══════════════════════════════════════════════════════════
function wave(t: number, n: number, freq: number, amp: number): number {
  return Math.sin(t * 0.001 * freq * Math.PI * 2 + nh(n, 0xA1A1) * Math.PI * 2) * amp;
}
function pulse(t: number, n: number, freq: number): number {
  return (Math.sin(t * 0.001 * freq * Math.PI * 2 + nh(n, 0xB2B2) * Math.PI * 2) + 1) * 0.5;
}
function stepGait(t: number, n: number, leg: number, totalLegs: number, freq: number): number {
  const phase = nh(n, 0xC3C3) * Math.PI * 2 + (leg / totalLegs) * Math.PI * 2;
  return Math.max(0, Math.sin(t * 0.001 * freq * Math.PI * 2 + phase));
}
function alertLean(colPos: number, playerDist: number): number {
  return Math.max(0, 1 - playerDist / 3) * 0.18;
}
function damageShake(t: number, hpFrac: number): number {
  if (hpFrac > 0.6) return 0;
  return Math.sin(t * 0.035) * ((0.6 - hpFrac) / 0.6) * 4;
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
function frect(ctx:Ctx,x:number,y:number,w:number,h:number,f:string,g:string,a:number,blur=5): void {
  ctx.save(); ctx.globalAlpha=a; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=blur;
  ctx.fillRect(x,y,w,h); ctx.shadowBlur=0;
  ctx.strokeStyle='rgba(255,255,255,0.14)'; ctx.lineWidth=0.7; ctx.strokeRect(x,y,w,h); ctx.restore();
}
function sline(ctx:Ctx,x1:number,y1:number,x2:number,y2:number,col:string,a:number,lw=1.2): void {
  ctx.save(); ctx.globalAlpha=a; ctx.strokeStyle=col; ctx.lineWidth=lw;
  ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); ctx.restore();
}
function sarc(ctx:Ctx,cx:number,cy:number,r:number,a0:number,a1:number,col:string,a:number,lw:number,blur=0): void {
  ctx.save(); ctx.globalAlpha=a; ctx.strokeStyle=col; ctx.lineWidth=lw; ctx.shadowColor=col; ctx.shadowBlur=blur;
  ctx.beginPath(); ctx.arc(cx,cy,Math.max(r,0.5),a0,a1); ctx.stroke(); ctx.restore();
}
function oblob(ctx:Ctx,cx:number,cy:number,rx:number,ry:number,f:string,g:string,a:number,n:number,salt:number): void {
  const nV=10; const pts:P2[]=[];
  for (let i=0;i<nV;i++) {
    const ang=(i/nV)*Math.PI*2;
    pts.push([cx+Math.cos(ang)*rx*(1+(nh(n,salt+i)-0.5)*0.28),cy+Math.sin(ang)*ry*(1+(nh(n,salt+i+nV)-0.5)*0.28)]);
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
function cshard(ctx:Ctx,bx:number,by:number,angle:number,len:number,w:number,f:string,g:string,a:number): void {
  const tx=bx+Math.cos(angle)*len, ty=by+Math.sin(angle)*len;
  const px=-Math.sin(angle)*w, py=Math.cos(angle)*w;
  fpoly(ctx,[[bx+px,by+py],[bx-px,by-py],[tx,ty]],f,g,a,5);
  ctx.save(); ctx.globalAlpha=a*0.40; ctx.strokeStyle='rgba(255,255,255,0.82)'; ctx.lineWidth=0.8;
  ctx.beginPath(); ctx.moveTo(bx+px,by+py); ctx.lineTo(tx,ty); ctx.stroke(); ctx.restore();
}

// ═══════════════════════════════════════════════════════════
// §6  BIOLOGICAL ANATOMICAL COMPONENT LIBRARY
// ═══════════════════════════════════════════════════════════

// ── Soft mantle body (cephalopod) — breathing scale animation ──
function mantleBody(ctx:Ctx,cx:number,cy:number,rx:number,ry:number,n:number,t:number,f:string,g:string,A:number): void {
  const br = pulse(t, n, 2.4) * 0.08;
  oblob(ctx, cx, cy, rx*(1+br), ry*(1+br*0.5), f, g, A, n, 10);
}

// ── Tentacle arm with sucker rings and animated curl ──
function tentacleArm(ctx:Ctx,ax:number,ay:number,tipX:number,tipY:number,w:number,suckers:boolean,baseCurl:number,t:number,n:number,salt:number,f:string,g:string,A:number): void {
  const curl = baseCurl + wave(t, n+salt, 0.7 + nh(n,salt+50)*0.5, w*1.6);
  const mx = (ax+tipX)/2 + curl;
  const my = (ay+tipY)/2 + wave(t, n+salt+1, 0.5, w*0.5);
  ctx.save(); ctx.globalAlpha=A; ctx.strokeStyle=f; ctx.lineWidth=w*2.2; ctx.shadowColor=g; ctx.shadowBlur=3;
  ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(ax,ay); ctx.quadraticCurveTo(mx,my,tipX,tipY); ctx.stroke();
  ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=0.55;
  ctx.beginPath(); ctx.moveTo(ax,ay); ctx.quadraticCurveTo(mx,my,tipX,tipY); ctx.stroke();
  ctx.restore();
  if (suckers) {
    for (let i=1;i<=4;i++) {
      const sp=i/5;
      // Approximate point on quadratic bezier
      const bx=(1-sp)*(1-sp)*ax+2*(1-sp)*sp*mx+sp*sp*tipX;
      const by=(1-sp)*(1-sp)*ay+2*(1-sp)*sp*my+sp*sp*tipY;
      sarc(ctx,bx,by,w*0.55,0,Math.PI*2,f,A-0.28,0.65);
    }
  }
}

// ── Lateral eye with iris + tracking pupil ──
function cephEye(ctx:Ctx,ex:number,ey:number,R:number,targetX:number,targetY:number,f:string,g:string,A:number): void {
  const eR=R*0.14;
  fcirc(ctx,ex,ey,eR,'rgba(240,235,218,0.92)',g,A-0.02,4);
  fcirc(ctx,ex,ey,eR*0.72,f,g,A-0.04,3);
  const dx=targetX-ex, dy=targetY-ey, dist=Math.hypot(dx,dy)||1;
  const pOff=eR*0.30;
  const px=ex+dx/dist*pOff, py=ey+dy/dist*pOff;
  ctx.save(); ctx.globalAlpha=A; ctx.fillStyle='rgba(5,4,8,0.96)';
  ctx.beginPath(); ctx.ellipse(px,py,eR*0.46,eR*0.28,Math.atan2(dy,dx),0,Math.PI*2); ctx.fill(); ctx.restore();
  fcirc(ctx,ex-eR*0.26,ey-eR*0.26,eR*0.17,'rgba(255,255,255,0.70)',g,A-0.12,0);
}

// ── Chromatophore patches (cephalopod pigment cells) ──
function chromatophores(ctx:Ctx,cx:number,cy:number,R:number,n:number,t:number,acc:string,A:number): void {
  const nP=6+Math.floor(nh(n,0xCC10)*4);
  for (let i=0;i<nP;i++) {
    const px=cx+(nh(n,200+i)-0.5)*R*1.5, py=cy+(nh(n,210+i)-0.5)*R*0.85;
    const pr=R*(0.06+nh(n,220+i)*0.07);
    const al=A*(0.48+pulse(t,n+i*7,1.8+nh(n,230+i)*1.2)*0.48);
    fcirc(ctx,px,py,pr*pulse(t,n+i*3,2.5+nh(n,240+i)),acc,acc,al,3);
  }
}

// ── Siphon (jet propulsion organ) ──
function siphon(ctx:Ctx,sx:number,sy:number,angle:number,len:number,R:number,t:number,n:number,f:string,g:string,A:number): void {
  const ex2=sx+Math.cos(angle)*len, ey2=sy+Math.sin(angle)*len;
  const lw=R*(0.10+pulse(t,n,2.6)*0.04);
  ctx.save(); ctx.globalAlpha=A-0.06; ctx.strokeStyle=f; ctx.lineWidth=lw*2; ctx.shadowColor=g; ctx.shadowBlur=4;
  ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(ex2,ey2); ctx.stroke(); ctx.restore();
  sarc(ctx,ex2,ey2,lw*0.90,angle+Math.PI*0.65,angle+Math.PI*1.35,f,A-0.18,lw*0.55,3);
}

// ── Ammonite shell (armored cephalopod) ──
function ammoniteShell(ctx:Ctx,cx:number,cy:number,R:number,n:number,f:string,g:string,A:number): void {
  const nSegs=4+Math.floor(nh(n,0xA440)*2);
  for (let i=0;i<nSegs;i++) {
    const r1=R*(0.26+i*0.19), r2=R*(0.44+i*0.19);
    const a0=Math.PI*0.28, a1=Math.PI*1.72;
    ctx.save(); ctx.globalAlpha=A*(0.90-i*0.14); ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=5-i;
    ctx.beginPath(); ctx.arc(cx,cy,r2,a0,a1); ctx.arc(cx,cy,r1,a1,a0,true); ctx.closePath(); ctx.fill();
    ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=0.7; ctx.stroke(); ctx.restore();
    ctx.save(); ctx.globalAlpha=A-0.30; ctx.strokeStyle='rgba(0,0,0,0.52)'; ctx.lineWidth=0.8;
    ctx.beginPath(); ctx.arc(cx,cy,r1,a0,a1); ctx.stroke(); ctx.restore();
  }
}

// ── Gill slits (open/close with breathing) ──
function gillSlits(ctx:Ctx,x:number,y:number,w:number,R:number,count:number,t:number,n:number,f:string,A:number): void {
  const open = 0.50 + pulse(t, n, 2.3) * 0.50;
  for (let i=0;i<count;i++) {
    const gx=x+i*(w/(count-1));
    const gh=R*0.11*open;
    ctx.save(); ctx.globalAlpha=A-0.22; ctx.strokeStyle=f; ctx.lineWidth=1.1; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(gx,y-gh); ctx.lineTo(gx,y+gh); ctx.stroke(); ctx.restore();
  }
}

// ── Compound eye (arthropod) — faceted cluster ──
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

// ── Chelicera pair (arthropod mouthparts) ──
function chelicera(ctx:Ctx,cx:number,cy:number,R:number,openFrac:number,f:string,g:string,A:number): void {
  const gap = Math.PI*0.15 + openFrac*Math.PI*0.30;
  for (const s of [-1,1] as const) {
    const a0 = s > 0 ? gap : Math.PI-gap;
    const a1 = s > 0 ? Math.PI*0.80 : Math.PI*0.20;
    ctx.save(); ctx.globalAlpha=A-0.05; ctx.strokeStyle=f; ctx.lineWidth=R*0.10; ctx.shadowColor=g; ctx.shadowBlur=4;
    ctx.lineCap='round';
    ctx.beginPath(); ctx.arc(cx,cy+s*R*0.04,R*0.26,Math.min(a0,a1),Math.max(a0,a1),s<0); ctx.stroke(); ctx.restore();
    const tipX=cx+Math.cos(a0)*R*0.26, tipY=cy+s*R*0.04+Math.sin(a0)*R*0.26;
    fcirc(ctx,tipX,tipY,R*0.036,f,g,A,3);
  }
}

// ── Arthropod jointed leg — femur + tibia + knee ──
function arthLeg(ctx:Ctx,hx:number,hy:number,angle:number,femLen:number,tibLen:number,lift:number,f:string,g:string,A:number): void {
  const kX=hx+Math.cos(angle)*femLen, kY=hy+Math.sin(angle)*femLen-lift*femLen*0.45;
  const tibAngle=angle+Math.PI*0.30*(1+lift*0.38);
  const tX=kX+Math.cos(tibAngle)*tibLen, tY=kY+Math.sin(tibAngle)*tibLen+lift*tibLen*0.30;
  sline(ctx,hx,hy,kX,kY,f,A-0.07,femLen*0.11);
  sline(ctx,kX,kY,tX,tY,f,A-0.12,tibLen*0.085);
  fcirc(ctx,kX,kY,femLen*0.080,f,g,A-0.14,3);
}

// ── Segmentation suture (arthropod body joints) ──
function segSuture(ctx:Ctx,x:number,y0:number,y1:number,A:number): void {
  ctx.save(); ctx.globalAlpha=A-0.32; ctx.strokeStyle='rgba(0,0,0,0.58)'; ctx.lineWidth=1.0;
  ctx.beginPath(); ctx.moveTo(x,y0); ctx.lineTo(x,y1); ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,0.20)'; ctx.lineWidth=0.5;
  ctx.beginPath(); ctx.moveTo(x+0.6,y0); ctx.lineTo(x+0.6,y1); ctx.stroke(); ctx.restore();
}

// ── Spiracle (breathing pore on arthropod segment) ──
function spiracle(ctx:Ctx,x:number,y:number,R:number,A:number): void {
  sarc(ctx,x,y,R*0.038,0,Math.PI*2,'rgba(0,0,0,0.68)',A-0.24,0.75);
}

// ── Fungal hypha (recursive branching thread) ──
function hypha(ctx:Ctx,x0:number,y0:number,angle:number,len:number,w:number,depth:number,t:number,n:number,salt:number,f:string,A:number): void {
  if (depth<=0||len<2) return;
  const sway=wave(t,n+salt,0.4+nh(n,salt)*0.3,len*0.07);
  const x1=x0+Math.cos(angle)*len+sway, y1=y0+Math.sin(angle)*len;
  ctx.save(); ctx.globalAlpha=A; ctx.strokeStyle=f; ctx.lineWidth=w; ctx.lineCap='round';
  ctx.shadowColor=f; ctx.shadowBlur=depth*1.2;
  ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke(); ctx.restore();
  if (depth>1) {
    hypha(ctx,x1,y1,angle-0.55+nh(n,salt+10)*0.42,len*0.65,w*0.68,depth-1,t,n,salt+20,f,A-0.06);
    if (w>0.65) hypha(ctx,x1,y1,angle+0.55-nh(n,salt+11)*0.42,len*0.52,w*0.57,depth-1,t,n,salt+30,f,A-0.10);
  }
}

// ── Fungal cap + stalk ──
function fruitingBody(ctx:Ctx,sx:number,sy:number,R:number,st:number,t:number,n:number,f:string,g:string,A:number): void {
  const stH=R*(0.46+nh(n,0xFF10)*0.22);
  const capR=R*(0.36+nh(n,0xFF11)*0.14);
  const droop=wave(t,n,0.7,stH*0.04);
  sline(ctx,sx,sy,sx+nh(n,0xFF12)*R*0.10,sy-stH,f,A-0.12,R*0.085);
  const cX=sx+nh(n,0xFF12)*R*0.10+droop, cY=sy-stH;
  ctx.save(); ctx.globalAlpha=A; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=5;
  ctx.beginPath(); ctx.ellipse(cX,cY,capR,capR*0.44,0,Math.PI,0,true); ctx.closePath(); ctx.fill();
  ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,0.14)'; ctx.lineWidth=0.65; ctx.stroke(); ctx.restore();
  if (st>=1) {
    const nG=7+Math.floor(nh(n,0xFF13)*5);
    for (let i=0;i<nG;i++) {
      const ga=(i/(nG-1)-0.5)*Math.PI*0.86;
      const gx2=cX+Math.sin(ga)*capR;
      sline(ctx,gx2,cY,gx2+(nh(n,0xFF14+i)-0.5)*R*0.04,cY+capR*0.40,f,A-0.30,0.52);
    }
  }
  if (st>=2) sarc(ctx,sx+nh(n,0xFF12)*R*0.10,sy-stH*0.40,R*0.095,0,Math.PI*2,f,A-0.22,R*0.055,3);
}

// ── Spore puff (discrete timed event) ──
function sporePuff(ctx:Ctx,cx:number,cy:number,R:number,t:number,n:number,f:string,A:number): void {
  const cycle=(t*0.001*0.75+nh(n,0x5010))%1.0;
  const sz=R*0.25*cycle;
  const al=A*(1-cycle)*0.50;
  if (al<0.02) return;
  fcirc(ctx,cx+(nh(n,0x5011)-0.5)*R*0.55,cy-(R*0.18+sz),sz,f,f,al,sz*0.5);
}

// ── Vascular trunk with animated flow pulse ──
function vascTrunk(ctx:Ctx,x0:number,y0:number,x1:number,y1:number,w:number,t:number,n:number,f:string,acc:string,A:number): void {
  ctx.save(); ctx.globalAlpha=A; ctx.strokeStyle=f; ctx.lineWidth=w; ctx.lineCap='round';
  ctx.shadowColor=f; ctx.shadowBlur=3;
  ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke(); ctx.restore();
  const pt=(t*0.001*1.5+nh(n,0x7A10))%1.0;
  const px2=x0+(x1-x0)*pt, py2=y0+(y1-y0)*pt;
  fcirc(ctx,px2,py2,w*0.55,acc,acc,A*0.62*(1-Math.abs(pt-0.5)*1.8),4);
}

// ── Crystal face with specular highlight edge ──
function crystFace(ctx:Ctx,pts:P2[],f:string,g:string,A:number): void {
  fpoly(ctx,pts,f,g,A,5);
  if (pts.length>=2) {
    ctx.save(); ctx.globalAlpha=A*0.48; ctx.strokeStyle='rgba(255,255,255,0.82)'; ctx.lineWidth=0.88;
    ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]); ctx.lineTo(pts[1][0],pts[1][1]); ctx.stroke(); ctx.restore();
  }
}

// ── Healed scar tissue ──
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

// ── Small parasite organism with its own slow pulse ──
function drawParasite(ctx:Ctx,px:number,py:number,R:number,n:number,salt:number,t:number,A:number): void {
  const pr=R*(0.056+nh(n,salt)*0.034);
  const pbob=wave(t,n+salt,1.4,pr*0.24);
  fcirc(ctx,px,py+pbob,pr,'rgba(175,115,52,0.88)','rgba(95,48,0,0.55)',A-0.08,3);
  ctx.save(); ctx.globalAlpha=A-0.22; ctx.strokeStyle='rgba(145,82,28,0.82)'; ctx.lineWidth=0.65;
  ctx.beginPath(); ctx.arc(px+pr*0.78,py+pbob,pr*0.46,-Math.PI*0.5,Math.PI*0.45); ctx.stroke(); ctx.restore();
}

// ── Brood pouch with visible eggs ──
function drawBroodPouch(ctx:Ctx,bx:number,by:number,R:number,n:number,t:number,f:string,g:string,A:number): void {
  const br=R*(0.20+nh(n,0xBB10)*0.10);
  ctx.save(); ctx.globalAlpha=A*0.35; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=4;
  ctx.beginPath(); ctx.ellipse(bx,by,br,br*0.70,0,0,Math.PI*2); ctx.fill(); ctx.restore();
  const nE=3+Math.floor(nh(n,0xBB11)*3);
  for (let i=0;i<nE;i++) {
    const ex3=bx+(nh(n,0xBB12+i)-0.5)*br*0.72, ey3=by+(nh(n,0xBB13+i)-0.5)*br*0.48;
    fcirc(ctx,ex3,ey3,R*0.044,'rgba(255,242,175,0.85)',g,A-0.12,2);
  }
}

// ═══════════════════════════════════════════════════════════
// §7  PHYLUM RENDERERS
// ═══════════════════════════════════════════════════════════

// ── PHYLUM 0: CEPHALOPODA ─────────────────────────────────────────────────
// Clades: 0=Pelagic  1=Benthic  2=Armored  3=Parasitic
function drawCephalopoda(ctx:Ctx,cx:number,cy:number,R:number,n:number,cl:number,st:number,mi:number,t:number,ectx:EntityDrawContext|null,f:string,g:string,acc:string,A:number): void {
  const lean  = alertLean(ectx?.colPos??3, ectx?.playerDist??3);
  const shk   = damageShake(t, ectx?.hpFrac??1);
  const stageSz = [0.55, 0.72, 1.00, 1.08][st];

  // Mantle proportions per clade
  const MRX_F = [1.05, 1.32, 0.98, 0.70];
  const MRY_F = [0.54, 0.66, 0.50, 0.40];
  const mrx = R * MRX_F[cl] * stageSz;
  const mry = R * MRY_F[cl] * stageSz;
  const offX = -lean * R * 0.22 + shk;

  // ── Clade pre-mantle structures (behind mantle) ──
  if (cl === 2) { // ARMORED: ammonite shell at rear
    ammoniteShell(ctx, cx + offX + mrx*0.32, cy, R*stageSz*0.86, n, f, g, A-0.08);
  }
  if (cl === 3) { // PARASITIC: host mass being grasped
    oblob(ctx, cx+offX+mrx*0.58, cy, R*stageSz*0.75, R*stageSz*0.58,
          'rgba(55,38,28,0.58)', 'rgba(28,18,8,0.38)', A-0.32, n, 60);
  }

  // ── Mantle body ──
  mantleBody(ctx, cx+offX, cy, mrx, mry, n, t, f, g, A);

  // ── Siphon ──
  const sipA = cl===1 ? Math.PI*0.10 : -Math.PI*0.07;
  siphon(ctx, cx+offX+mrx*0.60, cy+mry*0.36, sipA, R*stageSz*0.55, R*stageSz, t, n, f, g, A-0.07);

  // ── Tentacles ──
  const nArms = st===0 ? 4 : 8;
  const armBaseLen = R * stageSz * [1.35, 1.08, 0.92, 0.68][cl];
  const armLongLen = R * stageSz * [2.15, 1.55, 1.35, 1.05][cl];
  const aX = cx + offX + mrx * [0.38, -0.08, 0.12, 0.22][cl];
  const aY = cy;

  for (let i=0; i<nArms; i++) {
    const isLong = (cl===0||cl===1) && (i===3||i===4);
    const aLen = isLong ? armLongLen : armBaseLen;
    let angle: number;
    if (cl===0)      angle = Math.PI*0.55 + (i/(nArms-1)-0.5)*Math.PI*0.58;
    else if (cl===1) angle = Math.PI*0.40 + (i/nArms)*Math.PI*0.88;
    else if (cl===2) angle = -Math.PI*0.30 + (i/(nArms-1)-0.5)*Math.PI*0.70;
    else             angle = -Math.PI*0.10 + (i/(nArms-1)-0.5)*Math.PI*0.52;
    angle -= lean * 0.32;
    const tipX = aX + Math.cos(angle)*aLen;
    const tipY = aY + Math.sin(angle)*aLen;
    const baseCurl = (nh(n,100+i)-0.5)*R*stageSz*0.52;
    tentacleArm(ctx, aX, aY, tipX, tipY, R*stageSz*0.062, st>=1, baseCurl, t, n, i*17, f, g, A-0.04);
    if (st>=2 && i%2===0) {
      const mx2=(aX+tipX)/2, my2=(aY+tipY)/2;
      sarc(ctx,mx2,my2,R*stageSz*0.046,0,Math.PI*2,acc,A-0.30,0.7,2);
    }
  }

  // ── Eye (stage 1+) ──
  if (st>=1) {
    const eX = cx+offX - mrx*0.36 - lean*R*0.08;
    const eY = cy - mry*0.30;
    const targX = ectx ? cx - (ectx.playerDist||3)*R*0.82 : cx - R*2;
    cephEye(ctx, eX, eY, R*stageSz, targX, eY, f, g, A);
  }

  // ── Gill slits (stage 1+) ──
  if (st>=1) {
    gillSlits(ctx, cx+offX-mrx*0.06, cy+mry*0.50, mrx*0.52, R*stageSz, 4, t, n, f, A);
  }

  // ── Chromatophores (stage 2+) ──
  if (st>=2) chromatophores(ctx, cx+offX, cy, mrx, n, t, acc, A);

  // ── Parasitic hooks ──
  if (cl===3) {
    for (let i=0; i<3+mi; i++) {
      const ha = -Math.PI*0.17 + (i/(2+mi)-0.5)*Math.PI*0.48;
      ctx.save(); ctx.globalAlpha=A-0.05; ctx.strokeStyle=f; ctx.lineWidth=R*stageSz*0.088;
      ctx.lineCap='round';
      ctx.beginPath();
      ctx.arc(cx+offX-mrx*0.52, cy+Math.sin(ha)*mry*0.48, R*stageSz*0.40, ha-Math.PI*0.52, ha+Math.PI*0.52);
      ctx.stroke(); ctx.restore();
    }
  }

  // ── Stage 3: ancient features ──
  if (st===3) {
    drawScar(ctx, cx+offX, cy, R, n, 0x5C01);
    drawBroodPouch(ctx, cx+offX+mrx*0.25, cy+mry*0.70, R, n, t, f, g, A);
    drawParasite(ctx, cx+offX-mrx*0.58, cy-mry*0.52, R, n, 0x5C02, t, A);
    // Shortened vestigial arm
    const vX = aX + Math.cos(Math.PI*0.60)*armBaseLen*0.42;
    const vY = aY + Math.sin(Math.PI*0.60)*armBaseLen*0.42;
    tentacleArm(ctx, aX, aY, vX, vY, R*stageSz*0.038, false, 0, t, n, 77, f, g, A-0.30);
  }
}

// ── PHYLUM 1: ARTHROPODA ──────────────────────────────────────────────────
// Clades: 0=Arachnoid  1=Crustacea  2=Myriapod  3=Barnacle
function drawArthropoda(ctx:Ctx,cx:number,cy:number,R:number,n:number,cl:number,st:number,mi:number,t:number,ectx:EntityDrawContext|null,f:string,g:string,acc:string,A:number): void {
  const lean    = alertLean(ectx?.colPos??3, ectx?.playerDist??3);
  const shk     = damageShake(t, ectx?.hpFrac??1);
  const stageSz = [0.52, 0.70, 1.00, 1.10][st];
  const offX    = -lean*R*0.18 + shk;

  if (cl===3) { // BARNACLE: sessile, filter plates
    drawBarnacle(ctx, cx+offX, cy, R, n, st, mi, t, A, f, g, acc); return;
  }

  // Body proportions per clade
  const BW_F = [1.02, 1.35, 2.72, 0];
  const BH_F = [0.56, 0.46, 0.33, 0];
  const NS_A = [2, 1, 5+mi, 0];
  const NL_A = [8, 6, 6+mi*2, 0];

  const BW = R * BW_F[cl] * stageSz;
  const BH = R * BH_F[cl] * stageSz;
  const NS = NS_A[cl];
  const NL = st===0 ? Math.floor(NL_A[cl]/2) : NL_A[cl];

  // ── Head capsule ──
  const hX = cx + offX - BW - R*stageSz*0.20;
  const hY = cy;
  const hR = R*stageSz*(cl===0?0.28:cl===1?0.38:0.20);
  fcirc(ctx, hX, hY, hR, f, g, A, 6);
  compoundEye(ctx, hX-hR*0.36, hY-hR*0.26, hR*0.36, hR*0.25, n, f, g, A);
  const openFrac = lean*4.5 + pulse(t,n,0.9)*0.18;
  chelicera(ctx, hX-hR, hY, hR*0.62, Math.min(1,openFrac), f, g, A);

  // ── Trunk segments ──
  const segW = (BW*2) / NS;
  for (let i=0; i<NS; i++) {
    const sx2 = cx + offX - BW + i*segW;
    frect(ctx, sx2, cy-BH, segW*0.96, BH*2, f, g, A, 5);
    if (i>0) segSuture(ctx, sx2, cy-BH, cy+BH, A);
    if (st>=1) {
      spiracle(ctx, sx2+segW*0.5, cy-BH*0.58, R*stageSz, A);
      spiracle(ctx, sx2+segW*0.5, cy+BH*0.58, R*stageSz, A);
    }
  }

  // ── Arachnoid: abdomen + stinger ──
  if (cl===0) {
    const abdR = R*stageSz*(0.36+mi*0.06);
    oblob(ctx, cx+offX+BW*0.50, cy, abdR, abdR*1.08, f, g, A-0.04, n, 70);
    const stL = R*stageSz*0.50;
    fpoly(ctx, [[cx+offX+BW*0.50+abdR,cy-R*stageSz*0.07],[cx+offX+BW*0.50+abdR+stL,cy],[cx+offX+BW*0.50+abdR,cy+R*stageSz*0.07]], f, g, A, 5);
  }

  // ── Crustacea: large claw pair ──
  if (cl===1) {
    for (const s of [-1,1] as const) {
      const cOpen = 0.28 + lean*0.68 + pulse(t,n+s*11,0.72)*0.18;
      const cX2 = cx+offX-BW-hR*1.15, cY2 = cy + s*BH*1.45;
      ctx.save(); ctx.globalAlpha=A-0.05; ctx.strokeStyle=f; ctx.lineWidth=R*stageSz*0.12;
      ctx.shadowColor=g; ctx.shadowBlur=4; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(cX2,cY2);
      ctx.arc(cX2, cY2, R*stageSz*0.42, -Math.PI*0.5*s, (-Math.PI*0.5+cOpen*Math.PI*0.62)*s, s<0);
      ctx.stroke(); ctx.restore();
      ctx.save(); ctx.globalAlpha=A-0.08; ctx.strokeStyle=f; ctx.lineWidth=R*stageSz*0.095; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(cX2,cY2);
      ctx.arc(cX2, cY2, R*stageSz*0.36, (-Math.PI*0.5+cOpen*Math.PI*0.52)*s, Math.PI*0.28*s, false);
      ctx.stroke(); ctx.restore();
    }
  }

  // ── Legs (gait cycle) ──
  const freq = cl===2 ? 3.5 : 2.0;
  for (let i=0; i<NL; i++) {
    const side = i%2===0 ? -1 : 1;
    const pair = Math.floor(i/2);
    const pairs = Math.floor(NL/2);
    const legX = cx + offX - BW*0.70 + pair*(BW*1.40/(pairs-1||1));
    const legY = cy + side*BH;
    const lift = stepGait(t, n, i, NL, freq)*R*stageSz*0.20;
    const femL = R*stageSz*0.52, tibL = R*stageSz*0.45;
    const legA = side>0 ? Math.PI*0.54 : Math.PI*0.46;
    arthLeg(ctx, legX, legY, legA, femL, tibL, lift, f, g, A);
  }

  // ── Myriapod: additional wave-gait legs ──
  if (cl===2) {
    const extraL = 4+mi*2;
    for (let i=0; i<extraL; i++) {
      const s=(i%2===0)?-1:1;
      const ex4=cx+offX-BW+i*(BW*2/(extraL-1||1));
      const lift2=stepGait(t,n,NL+i,NL+extraL,3.5)*R*stageSz*0.18;
      arthLeg(ctx, ex4, cy+s*BH, s>0?Math.PI*0.57:Math.PI*0.43, R*stageSz*0.40, R*stageSz*0.36, lift2, f, g, A-0.10);
    }
  }

  // ── Damage: cracked sclerite ──
  if ((ectx?.hpFrac??1) < 0.50) {
    ctx.save(); ctx.globalAlpha=0.42; ctx.strokeStyle='rgba(218,198,158,0.80)'; ctx.lineWidth=0.64;
    ctx.beginPath(); ctx.moveTo(cx+offX-R*0.11,cy-BH); ctx.lineTo(cx+offX+R*0.07,cy+R*0.18); ctx.lineTo(cx+offX+R*0.17,cy+R*0.09); ctx.stroke(); ctx.restore();
  }

  // ── Stage 3: ancient ──
  if (st===3) {
    drawScar(ctx, cx+offX-BW*0.28, cy, R, n, 0x5A01);
    drawParasite(ctx, cx+offX+BW*0.58, cy-BH*1.05, R, n, 0x5A02, t, A);
    sline(ctx,cx+offX-BW*0.42,cy-BH,cx+offX-BW*0.42-R*0.20,cy-BH-R*0.26,f,A-0.26,R*0.042);
    fcirc(ctx,cx+offX-BW*0.42-R*0.20,cy-BH-R*0.26,R*0.038,f,g,A-0.28,2);
  }
}

function drawBarnacle(ctx:Ctx,cx:number,cy:number,R:number,n:number,st:number,mi:number,t:number,A:number,f:string,g:string,acc:string): void {
  const sz=[0.52,0.70,1.00,1.10][st];
  const nP=6+mi;
  for (let i=0; i<nP; i++) {
    const a0=(i/nP)*Math.PI*2, a1=((i+0.82)/nP)*Math.PI*2;
    const r1=R*sz*0.28, r2=R*sz*0.70;
    ctx.save(); ctx.globalAlpha=A*(0.90-i*0.03); ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=4;
    ctx.beginPath(); ctx.arc(cx,cy,r2,a0,a1); ctx.arc(cx,cy,r1,a1,a0,true); ctx.closePath(); ctx.fill();
    ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,0.14)'; ctx.lineWidth=0.65; ctx.stroke(); ctx.restore();
  }
  fcirc(ctx,cx,cy,R*sz*0.22,g,g,A-0.14,5);
  const fanOpen=0.38+pulse(t,n,1.2)*0.62;
  if (st>=1) {
    for (let i=0; i<4+mi; i++) {
      const fa=-Math.PI*0.5+(i/(3+mi)-0.5)*Math.PI*0.58;
      rtend(ctx,cx,cy,fa,R*sz*(0.30+nh(n,500+i)*0.16)*fanOpen,R*sz*0.040,acc,g,A-0.20,n,500+i*4);
    }
  }
  for (let i=0; i<3; i++) {
    const ha=Math.PI*(0.62+i*0.38);
    sline(ctx,cx,cy,cx+Math.cos(ha)*R*sz*0.85,cy+Math.sin(ha)*R*sz*0.85,f,A-0.24,R*sz*0.058);
    fcirc(ctx,cx+Math.cos(ha)*R*sz*0.85,cy+Math.sin(ha)*R*sz*0.85,R*sz*0.052,f,g,A-0.26,2);
  }
}

// ── PHYLUM 2: FUNGI ───────────────────────────────────────────────────────
// Clades: 0=Basidiomycete  1=Cordyceps  2=SlimeMold  3=BiolumNet
function drawFungi(ctx:Ctx,cx:number,cy:number,R:number,n:number,cl:number,st:number,mi:number,t:number,ectx:EntityDrawContext|null,f:string,g:string,acc:string,A:number): void {
  const lean    = alertLean(ectx?.colPos??3, ectx?.playerDist??3);
  const stageSz = [0.50, 0.68, 1.00, 1.12][st];
  const offX    = -lean*R*0.10;

  if (cl===2) { drawSlimeMold(ctx,cx+offX,cy,R,n,st,mi,t,lean,f,g,acc,A); return; }
  if (cl===3) { drawBioLumNet(ctx,cx+offX,cy,R,n,st,mi,t,f,g,acc,A); return; }

  // ── Central mycelial stroma ──
  const stromaR=R*stageSz*0.28;
  oblob(ctx,cx+offX,cy,stromaR,stromaR*0.80,f,g,A-0.04,n,20);

  // ── Radiating hyphae ──
  const nH=[3,5,8,12][Math.min(3,st)];
  const hLen=R*stageSz*(1.05+nh(n,0x4410)*0.42);
  const hDep=[1,2,3,4][Math.min(3,st)];
  for (let i=0; i<nH; i++) {
    const ha=(i/nH)*Math.PI*2+wave(t,n+i,0.3,0.14);
    const alertD=i<nH/2 ? -lean*0.38 : lean*0.09;
    hypha(ctx, cx+offX+Math.cos(ha)*stromaR, cy+Math.sin(ha)*stromaR,
          ha+alertD, hLen, R*stageSz*0.058, hDep, t, n, i*31, f, A-0.08);
  }

  // ── Rhizomorphs (thick anchor cords) ──
  if (st>=1) {
    for (let i=0; i<3+mi; i++) {
      const ra=Math.PI*0.46+(i/(2+mi)-0.5)*Math.PI*0.52;
      rtend(ctx,cx+offX,cy,ra,R*stageSz*0.62,R*stageSz*0.076,f,g,A-0.20,n,600+i*5);
    }
  }

  // ── Fruiting body (stage 1+) ──
  if (st>=1) {
    if (cl===0) { // BASIDIOMYCETE
      fruitingBody(ctx, cx+offX-R*stageSz*0.20, cy-stromaR-R*stageSz*0.10, R*stageSz, st, t, n, f, g, A);
      if (st>=2) fruitingBody(ctx, cx+offX+R*stageSz*0.36, cy-stromaR, R*stageSz*0.62, st-1, t, n+7, f, g, A-0.16);
      if (st>=2) sporePuff(ctx, cx+offX-R*stageSz*0.20, cy-stromaR-R*stageSz*0.78, R*stageSz, t, n, f, A-0.06);
    } else { // CORDYCEPS
      oblob(ctx, cx+offX+R*stageSz*0.30, cy+R*stageSz*0.16, R*stageSz*0.60, R*stageSz*0.46,
            'rgba(38,28,20,0.62)', 'rgba(18,13,8,0.32)', A-0.30, n, 80);
      const nStr=3+mi;
      for (let i=0; i<nStr; i++) {
        const sOff=(i/(nStr-1)-0.5)*R*stageSz*0.50;
        const sLen=R*stageSz*(0.52+nh(n,700+i)*0.32);
        const tilt=wave(t,n+i,0.5,sLen*0.04);
        sline(ctx, cx+offX+R*stageSz*0.30+sOff, cy, cx+offX+R*stageSz*0.16+sOff+tilt, cy-sLen, f, A-0.07, R*stageSz*0.076);
        fcirc(ctx, cx+offX+R*stageSz*0.16+sOff+tilt, cy-sLen, R*stageSz*0.11, f, g, A-0.02, 5);
      }
      if (st>=2) sporePuff(ctx, cx+offX, cy-R*stageSz*0.58, R*stageSz, t, n, f, A-0.06);
    }
  }

  // ── Stage 3: ancient (old cap + new growth + parasitized pocket) ──
  if (st===3) {
    ctx.save(); ctx.globalAlpha=0.32; ctx.fillStyle='rgba(178,168,148,0.72)';
    ctx.beginPath(); ctx.ellipse(cx+offX+R*0.52, cy-stromaR*0.52, R*0.28, R*0.17, -0.28, Math.PI, 0, true); ctx.closePath(); ctx.fill(); ctx.restore();
    fruitingBody(ctx, cx+offX-R*0.28, cy-stromaR-R*0.07, R*0.68, 2, t, n+13, f, g, A-0.14);
    if (cl===0) fcirc(ctx, cx+offX+R*0.07, cy-stromaR-R*0.60, R*0.11, 'rgba(28,18,13,0.88)', g, A-0.10, 2);
  }
}

function drawSlimeMold(ctx:Ctx,cx:number,cy:number,R:number,n:number,st:number,mi:number,t:number,lean:number,f:string,g:string,acc:string,A:number): void {
  const sz=[0.50,0.68,1.00,1.12][st];
  const nL=2+mi+st;
  for (let i=0; i<nL; i++) {
    const flow=pulse(t,n+i*7,0.4+nh(n,800+i)*0.28);
    const lX=cx+(nh(n,800+i)-0.5)*R*sz*1.50*flow;
    const lY=cy+(nh(n,810+i)-0.5)*R*sz*0.72;
    const lr=R*sz*(0.26+nh(n,820+i)*0.17);
    const lA=i===0 ? A : A*(0.68+flow*0.24);
    oblob(ctx,lX-lean*R*0.14,lY,lr,lr*0.70,f,g,lA,n,830+i*10);
    if (i===0) {
      ctx.save(); ctx.globalAlpha=A*0.38; ctx.strokeStyle=acc; ctx.lineWidth=1.2; ctx.shadowColor=acc; ctx.shadowBlur=8;
      ctx.beginPath(); ctx.arc(lX-lean*R*0.14,lY,lr*0.86,-Math.PI*0.58,Math.PI*0.58); ctx.stroke(); ctx.restore();
    }
  }
  if (st>=2) sporePuff(ctx,cx,cy-R*sz*0.58,R*sz,t,n,f,A-0.10);
}

function drawBioLumNet(ctx:Ctx,cx:number,cy:number,R:number,n:number,st:number,mi:number,t:number,f:string,g:string,acc:string,A:number): void {
  const sz=[0.50,0.68,1.00,1.12][st];
  const dep=[2,3,4,5][st];
  const nM=4+mi*2;
  for (let i=0; i<nM; i++) {
    const ha=(i/nM)*Math.PI*2;
    hypha(ctx,cx,cy,ha,R*sz*(0.82+nh(n,900+i)*0.43),R*sz*0.042,dep,t,n,900+i*20,acc,A-0.06);
  }
  if (st>=2) {
    for (let i=0; i<5+mi; i++) {
      const nx2=cx+(nh(n,950+i)-0.5)*R*sz*1.38, ny2=cy+(nh(n,960+i)-0.5)*R*sz*1.38;
      const nr2=R*sz*(0.038+pulse(t,n+i*11,1.2+nh(n,970+i))*0.038);
      fcirc(ctx,nx2,ny2,nr2,acc,acc,A*(0.52+pulse(t,n+i*5,0.8)*0.34),6);
    }
  }
  const hubR2=R*sz*(0.13+pulse(t,n,1.0)*0.055);
  fcirc(ctx,cx,cy,hubR2,acc,acc,A*0.78,8);
}

// ── PHYLUM 3: VASCULAR ────────────────────────────────────────────────────
// Clades: 0=Predatory  1=Ambulatory  2=Colonial  3=Epiphytic
function drawVascular(ctx:Ctx,cx:number,cy:number,R:number,n:number,cl:number,st:number,mi:number,t:number,ectx:EntityDrawContext|null,f:string,g:string,acc:string,A:number): void {
  const lean    = alertLean(ectx?.colPos??3, ectx?.playerDist??3);
  const stageSz = [0.52, 0.70, 1.00, 1.10][st];
  const offX    = -lean*R*0.13;

  if (cl===2) { drawColonialVasc(ctx,cx+offX,cy,R,n,st,mi,t,lean,f,g,acc,A); return; }

  // ── Root / anchor system ──
  const rootY = cy + R*stageSz*0.52;
  const nRoot = 3+mi;
  if (cl===1) { // AMBULATORY: roots as jointed legs
    const nRL = nRoot*2;
    for (let i=0; i<nRL; i++) {
      const s=(i%2===0)?-1:1;
      const pi=Math.floor(i/2);
      const lX=cx+offX+(pi-(nRoot-1)/2)*R*stageSz*0.40;
      const lift=stepGait(t,n,i,nRL,2.2)*R*stageSz*0.25;
      arthLeg(ctx,lX,rootY-R*stageSz*0.08,Math.PI*0.60+s*0.10,R*stageSz*0.40,R*stageSz*0.33,lift,f,g,A-0.12);
    }
  } else {
    for (let i=0; i<nRoot; i++) {
      const ra=Math.PI*0.40+(i/(nRoot-1))*Math.PI*0.20;
      rtend(ctx,cx+offX,rootY,ra,R*stageSz*0.50,R*stageSz*0.068,f,g,A-0.24,n,400+i*5);
    }
  }

  // ── Main vascular trunk ──
  const tH=R*stageSz*(cl===0?0.92:cl===3?0.68:1.08);
  const tLean=wave(t,n,0.5,tH*0.024);
  const tTopX=cx+offX+tLean-lean*R*0.09, tTopY=cy-tH;
  vascTrunk(ctx, cx+offX, rootY, tTopX, tTopY, R*stageSz*(0.095+st*0.020), t, n, f, acc, A);

  // Bark texture (stage 1+)
  if (st>=1) {
    ctx.save(); ctx.globalAlpha=A-0.32; ctx.strokeStyle='rgba(255,255,255,0.22)'; ctx.lineWidth=0.50;
    for (let i=0; i<3+mi; i++) {
      const bY=rootY-tH*(0.22+i*0.22);
      const bX=cx+offX+(nh(n,1000+i)-0.5)*R*stageSz*0.10;
      ctx.beginPath(); ctx.moveTo(bX-R*stageSz*0.055,bY); ctx.bezierCurveTo(bX,bY-R*0.055,bX+R*0.045,bY+R*0.045,bX+R*stageSz*0.065,bY+R*0.018); ctx.stroke();
    }
    ctx.restore();
  }

  // ── Branches + fronds ──
  const nBr=[1,2,3,4][st];
  for (let i=0; i<nBr; i++) {
    const bF=0.24+(i/nBr)*0.64;
    const bBX=cx+offX+tLean*bF, bBY=cy-tH*bF;
    const bS=(nh(n,1100+i)>0.5?1:-1);
    const bLen=R*stageSz*(0.36+nh(n,1110+i)*0.26);
    const bA=bS>0 ? Math.PI*0.34 : -Math.PI*0.34;
    const bTX=bBX+Math.cos(bA)*bLen+tLean*0.38, bTY=bBY+Math.sin(bA)*bLen;
    vascTrunk(ctx,bBX,bBY,bTX,bTY,R*stageSz*0.055,t,n+i*7,f,acc,A-0.09);
    fell(ctx,bTX,bTY,R*stageSz*(0.20+nh(n,1120+i)*0.09),R*stageSz*0.28+wave(t,n+i,0.80,R*stageSz*0.038),f,g,A-0.12,4);
    if (st>=1) {
      ctx.save(); ctx.globalAlpha=A-0.34; ctx.fillStyle='rgba(0,0,0,0.52)';
      for (let j=0; j<3; j++) { ctx.beginPath(); ctx.arc(bTX+(nh(n,1130+i*10+j)-0.5)*R*stageSz*0.16,bTY+(nh(n,1140+i*10+j)-0.5)*R*stageSz*0.20,R*stageSz*0.016,0,Math.PI*2); ctx.fill(); }
      ctx.restore();
    }
  }
  fcirc(ctx,tTopX,tTopY,R*stageSz*0.068,acc,acc,A*0.78,5);

  // ── Clade-specific ──
  if (cl===0) { // PREDATORY: snap-jaw trap
    const trapOpen=lean*0.78+pulse(t,n,0.55)*0.24;
    const tpX=cx+offX-R*stageSz*0.52, tpY=cy-R*stageSz*0.16;
    for (const s of [-1,1] as const) {
      ctx.save(); ctx.globalAlpha=A-0.05; ctx.strokeStyle=acc; ctx.lineWidth=R*stageSz*0.086;
      ctx.shadowColor=acc; ctx.shadowBlur=4; ctx.lineCap='round';
      ctx.beginPath(); ctx.arc(tpX,tpY,R*stageSz*0.36,s*(Math.PI*0.18+trapOpen*Math.PI*0.44),s*Math.PI*0.76,s<0); ctx.stroke(); ctx.restore();
      if (st>=2) {
        for (let i=0; i<3; i++) {
          const ha=s*(Math.PI*0.26+i*0.14);
          sline(ctx,tpX+Math.cos(ha)*R*stageSz*0.33,tpY+Math.sin(ha)*R*stageSz*0.33,
                    tpX+Math.cos(ha)*R*stageSz*0.52,tpY+Math.sin(ha)*R*stageSz*0.52,acc,A-0.22,0.62);
        }
      }
    }
    if (st>=2) {
      for (let i=0; i<3+mi; i++) {
        const gX=tpX+(nh(n,1200+i)-0.5)*R*stageSz*0.42, gY=tpY+(nh(n,1210+i)-0.5)*R*stageSz*0.28;
        fcirc(ctx,gX,gY,R*stageSz*0.038,acc,g,A*(0.52+pulse(t,n+i*7,1.8)*0.34),3);
      }
    }
  } else if (cl===3) { // EPIPHYTIC: grappling tendrils
    for (let i=0; i<3+mi; i++) {
      const ta=Math.PI*(0.68+i*0.34)+lean*0.38;
      rtend(ctx,cx+offX,cy,ta,R*stageSz*(0.62+nh(n,1300+i)*0.36),R*stageSz*0.046,acc,g,A-0.20,n,1300+i*5);
      const cEnd=[cx+offX+Math.cos(ta)*R*stageSz*0.78, cy+Math.sin(ta)*R*stageSz*0.78];
      ctx.save(); ctx.globalAlpha=A*(0.33+pulse(t,n+i,1.2)*0.28); ctx.strokeStyle=acc; ctx.lineWidth=0.72; ctx.shadowColor=acc; ctx.shadowBlur=6;
      ctx.beginPath(); ctx.moveTo(cx+offX,cy); ctx.lineTo(cEnd[0],cEnd[1]); ctx.stroke(); ctx.restore();
    }
  }

  // ── Stage 3: ancient ──
  if (st===3) {
    drawScar(ctx, cx+offX+R*0.18, cy-R*0.40, R, n, 0x5701);
    for (let i=0; i<3+mi; i++) {
      const gY2=rootY-tH*(0.28+nh(n,1400+i)*0.52);
      const gX2=cx+offX+(nh(n,1410+i)-0.5)*R*stageSz*0.18;
      fcirc(ctx,gX2,gY2,R*stageSz*(0.076+nh(n,1420+i)*0.055),f,g,A-0.20,3);
    }
    ctx.save(); ctx.globalAlpha=A-0.34; ctx.strokeStyle='rgba(0,0,0,0.52)'; ctx.lineWidth=0.58;
    for (let i=0; i<3; i++) {
      const cY2=rootY-tH*(0.18+i*0.27);
      ctx.beginPath(); ctx.moveTo(cx+offX-R*stageSz*0.076,cY2); ctx.lineTo(cx+offX+R*stageSz*(nh(n,1430+i)-0.5)*0.16,cY2+R*stageSz*0.11); ctx.stroke();
    }
    ctx.restore();
  }
}

function drawColonialVasc(ctx:Ctx,cx:number,cy:number,R:number,n:number,st:number,mi:number,t:number,lean:number,f:string,g:string,acc:string,A:number): void {
  const sz=[0.52,0.70,1.00,1.10][st];
  const nT=2+mi;
  for (let i=0; i<nT; i++) {
    const tOff=(i/(nT-1)-0.5)*R*sz*1.28;
    const rootY2=cy+R*sz*0.48;
    const tH2=R*sz*(0.88+nh(n,1500+i)*0.24);
    const tTX=cx+tOff+wave(t,n+i,0.5,tH2*0.020)-lean*R*0.07;
    const tTY=cy-tH2;
    sline(ctx,cx+tOff,rootY2,cx,rootY2+R*sz*0.13,f,A-0.24,R*sz*0.062);
    vascTrunk(ctx,cx+tOff,rootY2,tTX,tTY,R*sz*0.090,t,n+i*11,f,acc,A);
    fell(ctx,tTX,tTY,R*sz*(0.20+nh(n,1510+i)*0.11),R*sz*0.26+wave(t,n+i,0.80,R*sz*0.038),f,g,A-0.12,4);
    fcirc(ctx,tTX,tTY,R*sz*0.062,acc,acc,A*0.74,5);
  }
  oblob(ctx,cx,cy+R*sz*0.56,R*sz*0.52,R*sz*0.17,f,g,A-0.20,n,1520);
}

// ── PHYLUM 4: CRYSTALLINE ─────────────────────────────────────────────────
// Clades: 0=Prismatic  1=Geode  2=LiquidCrystal  3=Ceramic
function drawCrystalline(ctx:Ctx,cx:number,cy:number,R:number,n:number,cl:number,st:number,mi:number,t:number,ectx:EntityDrawContext|null,f:string,g:string,acc:string,A:number): void {
  const lean     = alertLean(ectx?.colPos??3, ectx?.playerDist??3);
  const shk      = damageShake(t, ectx?.hpFrac??1);
  const stageSz  = [0.50, 0.68, 1.00, 1.12][st];
  const offX     = -lean*R*0.10 + shk;
  const hpFrac   = ectx?.hpFrac??1;
  const resPulse = pulse(t, n, 0.85);

  if (cl===0) { // PRISMATIC: elongated crystal array
    const nS=[2,3,5,7][st];
    const mLen=R*stageSz*(1.45+nh(n,2000)*0.48);
    for (let i=0; i<nS; i++) {
      const fr=(i/(nS-1||1)-0.5);
      const sLen=mLen*(1-Math.abs(fr)*0.50);
      const sOff=fr*R*stageSz*0.75;
      const sA2=-Math.PI*0.5+fr*Math.PI*0.14+wave(t,n+i,0.4,0.048)+lean*0.32;
      const sw=R*stageSz*(0.092-Math.abs(fr)*0.032);
      const sAlpha=A*(0.84+resPulse*0.16*(1-Math.abs(fr)));
      cshard(ctx, cx+offX+sOff, cy, sA2, sLen, sw, f, g, sAlpha);
      if (st>=2) {
        fcirc(ctx, cx+offX+sOff+Math.cos(sA2)*sLen, cy+Math.sin(sA2)*sLen,
              sw*(0.58+resPulse*0.38), acc, acc, sAlpha*0.62, 5);
      }
    }
    if (st>=1) {
      ctx.save(); ctx.globalAlpha=A-0.30; ctx.strokeStyle=acc; ctx.lineWidth=0.58;
      for (let i=1; i<3; i++) {
        const bY2=cy+Math.sin(-Math.PI*0.5)*mLen*(i/4);
        ctx.beginPath(); ctx.moveTo(cx+offX-mLen*0.38,bY2); ctx.lineTo(cx+offX+mLen*0.38,bY2); ctx.stroke();
      }
      ctx.restore();
    }

  } else if (cl===1) { // GEODE: hollow shell with interior crystals
    const shellR=R*stageSz*1.02;
    const apert=(0.52+resPulse*0.17)*Math.PI;
    ctx.save(); ctx.globalAlpha=A; ctx.fillStyle=f; ctx.shadowColor=g; ctx.shadowBlur=7;
    ctx.beginPath();
    ctx.arc(cx+offX,cy,shellR,-apert/2+Math.PI*0.5,apert/2+Math.PI*0.5);
    ctx.lineTo(cx+offX,cy); ctx.closePath(); ctx.fill();
    ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,0.14)'; ctx.lineWidth=0.70; ctx.stroke(); ctx.restore();
    const nInt=4+mi*2+st;
    for (let i=0; i<nInt; i++) {
      const ia=(i/nInt-0.5)*apert*0.80+Math.PI*0.5;
      const iR=shellR*(0.26+nh(n,2100+i)*0.50);
      const iLen=shellR*(0.28+nh(n,2110+i)*0.36);
      cshard(ctx, cx+offX+Math.cos(ia)*iR*0.58, cy+Math.sin(ia)*iR*0.58, ia, iLen, R*stageSz*0.062, acc, acc, A*(0.68+resPulse*0.32));
    }
    if (st>=1) {
      for (let i=0; i<3+mi; i++) {
        const mia=nh(n,2120+i)*Math.PI*2;
        fcirc(ctx,cx+offX+Math.cos(mia)*shellR*0.80,cy+Math.sin(mia)*shellR*0.80,R*stageSz*0.052,'rgba(18,13,8,0.78)',g,A-0.16,2);
      }
    }

  } else if (cl===2) { // LIQUID CRYSTAL: iridescent membrane over scaffold
    const scR=R*stageSz*0.65;
    for (let i=0; i<4+mi; i++) {
      const sa=(i/(3+mi))*Math.PI*2;
      sline(ctx,cx+offX,cy,cx+offX+Math.cos(sa)*scR,cy+Math.sin(sa)*scR,f,A-0.30,R*stageSz*0.062);
    }
    sarc(ctx,cx+offX,cy,scR,0,Math.PI*2,f,A-0.34,R*stageSz*0.052);
    const mp=t*0.001*0.35;
    ctx.save(); ctx.globalAlpha=A*0.28; ctx.shadowColor=acc; ctx.shadowBlur=6;
    const grad=ctx.createRadialGradient(cx+offX,cy,scR*0.38,cx+offX,cy,scR*1.14);
    grad.addColorStop(0,`hsla(${(200+Math.sin(mp)*42).toFixed(0)},78%,74%,0.0)`);
    grad.addColorStop(0.62,`hsla(${(200+Math.cos(mp*1.3)*52).toFixed(0)},84%,68%,0.6)`);
    grad.addColorStop(1.0,`hsla(${(200+Math.sin(mp*0.7)*32).toFixed(0)},88%,78%,0.0)`);
    ctx.fillStyle=grad;
    ctx.beginPath(); ctx.arc(cx+offX,cy,scR*1.14,0,Math.PI*2); ctx.fill(); ctx.restore();
    if (st>=1) {
      for (let i=0; i<4+mi; i++) {
        const sa=(i/(3+mi))*Math.PI*2;
        cshard(ctx,cx+offX+Math.cos(sa)*scR,cy+Math.sin(sa)*scR,sa,R*stageSz*(0.20+resPulse*0.076),R*stageSz*0.055,acc,acc,A*(0.72+resPulse*0.28));
      }
    }

  } else { // CERAMIC: bone-like struts and plates
    const nStr=3+mi;
    for (let i=0; i<nStr; i++) {
      const sa=(i/nStr)*Math.PI*2+wave(t,n+i,0.22,0.038);
      const sLen=R*stageSz*(0.60+nh(n,2200+i)*0.40);
      sline(ctx,cx+offX,cy,cx+offX+Math.cos(sa)*sLen,cy+Math.sin(sa)*sLen,f,A-0.05,R*stageSz*0.11);
      const pX=cx+offX+Math.cos(sa)*sLen*0.68, pY=cy+Math.sin(sa)*sLen*0.68;
      const pSz=R*stageSz*(0.22+nh(n,2210+i)*0.11);
      fpoly(ctx,[[pX-Math.sin(sa)*pSz,pY+Math.cos(sa)*pSz],[pX+Math.sin(sa)*pSz,pY-Math.cos(sa)*pSz],[pX+Math.cos(sa)*pSz,pY+Math.sin(sa)*pSz]],f,g,A-0.07,4);
      if (st>=1) {
        const fX=cx+offX+Math.cos(sa)*sLen*0.40, fY=cy+Math.sin(sa)*sLen*0.40;
        ctx.save(); ctx.globalAlpha=A-0.32; ctx.strokeStyle='rgba(198,188,172,0.52)'; ctx.lineWidth=0.54;
        ctx.beginPath(); ctx.moveTo(fX-Math.sin(sa)*R*0.048,fY+Math.cos(sa)*R*0.048); ctx.lineTo(fX+Math.sin(sa)*R*0.048,fY-Math.cos(sa)*R*0.048); ctx.stroke(); ctx.restore();
      }
    }
    fcirc(ctx,cx+offX,cy,R*stageSz*0.20,f,g,A,6);
  }

  // Dissolution scar on damaged entities
  if (hpFrac < 0.5) {
    const dH=(parseFloat(acc.match(/\d+/)?.[0]||'185')+60)%360;
    fcirc(ctx,cx+offX+R*stageSz*0.26,cy-R*stageSz*0.20,R*stageSz*(0.13+nh(n,2300)*0.09),
          `hsl(${dH},52%,48%)`,`hsl(${dH},68%,38%)`,A*(0.58-hpFrac)*0.9,4);
  }

  // Stage 3: ancient (second growth axis + extra dissolution)
  if (st===3) {
    const sgA=-Math.PI*0.34+lean*0.38;
    cshard(ctx,cx+offX+R*0.30,cy,sgA,R*0.88,R*0.095,acc,acc,A-0.14);
    drawScar(ctx,cx+offX-R*0.22,cy+R*0.18,R,n,0x5801);
  }
}

// ── PHYLUM 5: CHIMERA ─────────────────────────────────────────────────────
// Cross-phylum hybrids with legible anatomical seam.
// Clades: 0=Ceph×Arth  1=Fungi×Vasc  2=Xtal×Ceph  3=Arth×Xtal
function drawChimera(ctx:Ctx,cx:number,cy:number,R:number,n:number,cl:number,st:number,mi:number,t:number,ectx:EntityDrawContext|null,f:string,g:string,acc:string,A:number): void {
  const stageSz = [0.55, 0.72, 1.00, 1.10][st];
  const seamX   = cx + R*stageSz*0.04;
  // Color for each parent phylum
  const col1 = lineageColors(n, false, false);
  // Shifted n to get the second phylum's color family
  const col2 = lineageColors((n + 128) % 255 + 1, false, false);

  if (cl===0) { // CEPH × ARTH
    ctx.save(); ctx.beginPath(); ctx.rect(cx-R*3.5,cy-R*3.5,R*3.5+seamX-cx,R*7); ctx.clip();
    drawCephalopoda(ctx,cx,cy,R,n,0,st,mi,t,ectx,col1.f,col1.g,col1.acc,A);
    ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(seamX,cy-R*3.5,R*3.5,R*7); ctx.clip();
    drawArthropoda(ctx,cx,cy,R,n,0,st,mi,t,ectx,col2.f,col2.g,col2.acc,A);
    ctx.restore();
    drawChimeraSeam(ctx,seamX,cy,R*stageSz,n,t,col1.f,col2.f,A);

  } else if (cl===1) { // FUNGI × VASC
    ctx.save(); ctx.beginPath(); ctx.rect(cx-R*3.5,cy-R*3.5,R*3.5+seamX-cx,R*7); ctx.clip();
    drawFungi(ctx,cx,cy,R,n,0,st,mi,t,ectx,col1.f,col1.g,col1.acc,A);
    ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(seamX,cy-R*3.5,R*3.5,R*7); ctx.clip();
    drawVascular(ctx,cx,cy,R,n,0,st,mi,t,ectx,col2.f,col2.g,col2.acc,A);
    ctx.restore();
    drawChimeraSeam(ctx,seamX,cy,R*stageSz,n,t,col1.f,col2.f,A);

  } else if (cl===2) { // XTAL × CEPH
    drawCrystalline(ctx,cx,cy,R,n,0,st,mi,t,ectx,col1.f,col1.g,col1.acc,A-0.09);
    ctx.save(); ctx.beginPath(); ctx.rect(cx-R*3.5,cy-R*3.5,R*3.5+seamX-cx,R*7); ctx.clip();
    drawCephalopoda(ctx,cx,cy,R,n,0,st,mi,t,ectx,col2.f,col2.g,col2.acc,A*0.78);
    ctx.restore();
    drawChimeraSeam(ctx,seamX,cy,R*stageSz,n,t,col2.f,col1.f,A);

  } else { // ARTH × XTAL
    ctx.save(); ctx.beginPath(); ctx.rect(cx-R*3.5,cy-R*3.5,R*3.5+seamX-cx,R*7); ctx.clip();
    drawArthropoda(ctx,cx,cy,R,n,0,st,mi,t,ectx,col1.f,col1.g,col1.acc,A);
    ctx.restore();
    const nCr=3+mi+st;
    for (let i=0; i<nCr; i++) {
      const cx3=cx+(i/(nCr-1||1)-0.5)*R*stageSz*1.55+seamX-cx;
      cshard(ctx,cx3,cy-R*stageSz*0.40,-Math.PI*0.5+wave(t,n+i,0.4,0.09),R*stageSz*(0.28+nh(n,3000+i)*0.28),R*stageSz*0.068,col2.f,col2.g,A-0.07);
    }
    drawChimeraSeam(ctx,seamX,cy,R*stageSz,n,t,col1.f,col2.f,A);
  }
}

function drawChimeraSeam(ctx:Ctx,x:number,cy:number,R:number,n:number,t:number,f1:string,f2:string,A:number): void {
  const nJ=6+Math.floor(nh(n,3100)*4);
  const sH=R*2.2;
  const pts:P2[]=[[x,cy-sH]];
  for (let i=1;i<nJ;i++) {
    pts.push([x+(nh(n,3110+i)-0.5)*R*0.20, cy-sH+i*(sH*2/nJ)]);
  }
  pts.push([x,cy+sH]);
  ctx.save(); ctx.globalAlpha=A*0.38; ctx.strokeStyle='rgba(255,255,220,0.70)'; ctx.lineWidth=1.2;
  ctx.shadowColor='rgba(255,255,200,0.50)'; ctx.shadowBlur=5; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]);
  for (let i=1; i<pts.length; i++) ctx.lineTo(pts[i][0],pts[i][1]);
  ctx.stroke(); ctx.restore();
  // Growth-ring transition zone
  ctx.save(); ctx.globalAlpha=A*0.16; ctx.strokeStyle=f2; ctx.lineWidth=2.8; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]);
  for (let i=1; i<pts.length; i++) ctx.lineTo(pts[i][0],pts[i][1]);
  ctx.stroke(); ctx.restore();
}

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
  topology:    number;   // phylum×4+clade, 0–23 (getTopology compat)
  bodyPlan:    number;   // clade 0–3
  detailLevel: number;   // stage 0–3
  variant:     number;   // micro 0–2
  cls:         number;   // VirusClass index
  role:        MorphRole;
  domain:      number;   // phylum index 0–5
  aspectGroup: number;   // rough shape group (clade)
  massCenter:  number;   // 0=front 1=center 2=rear 3=distributed
  hybrid:      boolean;  // clade 3 (parasitic/barnacle variants)
  innovation:  boolean;  // phylum 5 (chimera)
  phylum:      number;
  clade:       number;
  stage:       number;
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
  };
}

export function morphDistance(a: MorphSig, b: MorphSig): number {
  let d=0;
  d += (a.phylum!==b.phylum  ? 1:0)*0.38;
  d += (a.clade!==b.clade    ? 1:0)*0.22;
  d += (a.stage!==b.stage    ? 1:0)*0.16;
  d += (a.role!==b.role      ? 1:0)*0.14;
  d += (a.domain!==b.domain  ? 1:0)*0.06;
  d += (a.massCenter!==b.massCenter ? 1:0)*0.04;
  return d;
}

const SPAWN_WIN=20, MAX_SAME_PHYLUM=2, MAX_SAME_CLADE=4;
const _hist: MorphSig[]=[];

export function registerSpawn(sig: MorphSig): void { _hist.push(sig); if (_hist.length>SPAWN_WIN) _hist.shift(); }
export function clearSpawnHistory(): void { _hist.length=0; }

export function pickDiverseSeed(): number {
  let best=-1, bestScore=-Infinity;
  for (let i=0; i<72; i++) {
    const seed=1+((i*97+Math.floor(Math.random()*41))%255);
    const sig=getMorphSig(seed);
    const phC=_hist.filter(s=>s.phylum===sig.phylum).length;
    const clC=_hist.filter(s=>s.clade===sig.clade).length;
    const stC=_hist.filter(s=>s.stage===sig.stage).length;
    if (phC>=MAX_SAME_PHYLUM||clC>=MAX_SAME_CLADE) continue;
    let minD=1.0; for (const s of _hist) { const d=morphDistance(sig,s); if (d<minD) minD=d; }
    const score=minD*Math.pow(0.44,phC)*Math.pow(0.64,clC)*Math.pow(0.90,stC)+(sig.phylum===5?0.11:0);
    if (score>bestScore) { bestScore=score; best=seed; }
  }
  return best>0 ? best : 1+Math.floor(Math.random()*255);
}

export function selectDiverseSeed(waveSigs: MorphSig[], crossHistory: MorphSig[]): number {
  const all=[...crossHistory.slice(-8),...waveSigs];
  let best=-1, bestScore=-1;
  for (let attempt=0; attempt<60; attempt++) {
    const seed=Math.floor(Math.random()*255)+1, sig=getMorphSig(seed);
    let wMin=1.0; for (const ws of all) { const d=morphDistance(sig,ws); if (d<wMin) wMin=d; }
    const phS=all.filter(ws=>ws.phylum===sig.phylum).length;
    const score=wMin*Math.pow(0.48,phS);
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
  console.log('[Morphology v8] Distribution check:');
  console.log('  Phyla:',pc.map((c,i)=>PH_N[i]+':'+c).join(' '));
  console.log('  Clades:',cc,'  Stages:',sc);
  console.log(' ',passed?'✓ PASS':'✗ FAIL',{maxPhylumFrac:maxPF.toFixed(3),allPh,allCl,allSt});
  return {phylumCounts:pc,cladeCounts:cc,stageCounts:sc,passed};
}

export function runSilhouetteDiversityTest(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle='#06101e'; ctx.fillRect(0,0,w,h);
  const cols=6, rows=4, cell=Math.min(w/cols,h/rows)*0.90;
  // One seed per phylum×clade (24 total, show first 24)
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
