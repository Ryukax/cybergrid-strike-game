import { useEffect, useRef, type CSSProperties } from 'react';
import {
  LORD_ALPHA_ASSETS,
  LORD_ALPHA_EFFECT_SEQUENCE_ASSETS,
  LORD_ALPHA_TOPOLOGY_STAGES,
  LORD_ALPHA_VFX_TIMINGS_MS,
  clampTopologyProgress,
  generateLordAlphaTopology,
  lordAlphaAssetUrl,
  resolveLordAlphaEffectSequence,
  resolveLordAlphaVfxMode,
  type LordAlphaEffectSequenceAssetManifest,
  topologyStage,
  type LordAlphaPresentationEvent,
  type LordAlphaTopology,
  type LordAlphaTopologyNode,
} from '../game/lord-alpha.ts';

export interface LordAlphaVfxProps {
  baseUrl?: string;
  event: LordAlphaPresentationEvent | null;
  /** Increment this value for consecutive events of the same kind. */
  pulse: number;
  className?: string;
}

type CanvasSize = { width: number; height: number };
type Point = { x: number; y: number };

type EventWithAnchors = LordAlphaPresentationEvent & {
  readonly seed?: number | string;
  /** Optional normalized (0..1) or canvas-pixel anchors. */
  readonly origin?: Point;
  readonly target?: Point;
  readonly destination?: Point;
};

type PreparedTopology = {
  readonly topology: LordAlphaTopology;
  readonly nodeById: ReadonlyMap<number, LordAlphaTopologyNode>;
};

type DrawTopologyOptions = {
  readonly center?: Point;
  readonly radius?: number;
  readonly aspectX?: number;
  readonly aspectY?: number;
  readonly rotation?: number;
  readonly alpha?: number;
  readonly lineWidth?: number;
  readonly nodeRadius?: number;
  readonly color?: string;
  readonly accent?: string;
  readonly curve?: number;
  readonly layout?: (node: LordAlphaTopologyNode) => Point;
};

const REDUCED_MOTION_PROGRESS: Readonly<Record<string, number>> = {
  move: 0.7,
  web: 0.72,
  'web-impact': 0.72,
  grapple: 0.7,
  'roc-stun': 0.58,
  'dimensional-net': 0.78,
  wormhole: 0.68,
  tharthareon: 0.82,
  dragon: 0.84,
  equip: 0.76,
  clone: 0.84,
};

const VFX_STYLE: CSSProperties = {
  position: 'absolute',
  zIndex: 20,
  inset: 0,
  display: 'block',
  width: '100%',
  height: '100%',
  overflow: 'visible',
  pointerEvents: 'none',
  userSelect: 'none',
};

const CREATURE_IMAGES = new Map<string, HTMLImageElement>();
const EFFECT_SEQUENCE_IMAGES = new Map<string, HTMLImageElement>();

const clamp = (value: number, minimum = 0, maximum = 1): number =>
  Math.min(maximum, Math.max(minimum, value));
const segment = (progress: number, start: number, end: number): number =>
  clamp((progress - start) / Math.max(0.0001, end - start));
const lerp = (from: number, to: number, progress: number): number =>
  from + (to - from) * progress;
const easeOutCubic = (value: number): number => 1 - (1 - clamp(value)) ** 3;
const easeInCubic = (value: number): number => clamp(value) ** 3;

function eventEnvelope(progress: number): number {
  if (progress < 0.06) return progress / 0.06;
  if (progress > 0.94) return Math.max(0, (1 - progress) / 0.06);
  return 1;
}

function prepareTopology(topology: LordAlphaTopology): PreparedTopology {
  return {
    topology,
    nodeById: new Map(topology.nodes.map((node) => [node.id, node])),
  };
}

function prepareCanvas(canvas: HTMLCanvasElement): {
  context: CanvasRenderingContext2D;
  size: CanvasSize;
} | null {
  const context = canvas.getContext('2d');
  if (!context) return null;
  const bounds = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(bounds.width || canvas.parentElement?.clientWidth || 320));
  const height = Math.max(1, Math.round(bounds.height || canvas.parentElement?.clientHeight || 220));
  const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.imageSmoothingEnabled = true;
  return { context, size: { width, height } };
}

function resolveAnchor(anchor: Point | undefined, size: CanvasSize, fallback: Point): Point {
  if (!anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) {
    return { x: fallback.x * size.width, y: fallback.y * size.height };
  }
  const normalized = Math.abs(anchor.x) <= 1.5 && Math.abs(anchor.y) <= 1.5;
  return normalized
    ? { x: anchor.x * size.width, y: anchor.y * size.height }
    : { x: clamp(anchor.x, 0, size.width), y: clamp(anchor.y, 0, size.height) };
}

function getEffectSequenceImage(
  baseUrl: string,
  sequence: LordAlphaEffectSequenceAssetManifest,
): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  const url = lordAlphaAssetUrl(baseUrl, sequence.suffix);
  const cached = EFFECT_SEQUENCE_IMAGES.get(url);
  if (cached) return cached;
  const image = new Image();
  image.decoding = 'async';
  image.addEventListener('error', () => EFFECT_SEQUENCE_IMAGES.delete(url), { once: true });
  image.src = url;
  EFFECT_SEQUENCE_IMAGES.set(url, image);
  return image;
}

function drawEffectSequenceFrameAt(
  context: CanvasRenderingContext2D,
  size: CanvasSize,
  image: HTMLImageElement,
  sequence: LordAlphaEffectSequenceAssetManifest,
  progress: number,
  center: Point,
  alpha: number,
  facing = 1,
  rotation = 0,
  forcedFrame?: number,
): boolean {
  if (!image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) return false;
  const frameIndex = Math.min(
    sequence.frameCount - 1,
    Math.max(
      0,
      forcedFrame ?? Math.floor(clamp(progress) * sequence.frameCount),
    ),
  );
  const sourceX = frameIndex * sequence.frameWidth;
  const requestedWidth = Math.min(size.width, size.height) * sequence.spanScale;
  const destinationWidth = Math.max(
    1,
    Math.min(requestedWidth, size.width * 0.88, size.height * 0.78 * 1.5),
  );
  const destinationHeight = destinationWidth / (sequence.frameWidth / sequence.frameHeight);

  context.save();
  context.globalAlpha = clamp(alpha);
  context.globalCompositeOperation = 'source-over';
  context.imageSmoothingEnabled = true;
  context.translate(center.x, center.y);
  context.rotate(rotation);
  context.scale(facing, 1);
  context.drawImage(
    image,
    sourceX,
    0,
    sequence.frameWidth,
    sequence.frameHeight,
    -destinationWidth * 0.5,
    -destinationHeight * 0.5,
    destinationWidth,
    destinationHeight,
  );
  context.restore();
  return true;
}

/** Draw one authored effect strip in board space, independent of player scale. */
function drawEffectSequence(
  context: CanvasRenderingContext2D,
  size: CanvasSize,
  image: HTMLImageElement,
  sequence: LordAlphaEffectSequenceAssetManifest,
  progress: number,
  event: EventWithAnchors,
  forcedFrame?: number,
): boolean {
  const origin = resolveAnchor(event.origin, size, { x: 0.36, y: 0.54 });
  const target = resolveAnchor(event.destination ?? event.target, size, { x: 0.69, y: 0.48 });
  const alpha = eventEnvelope(progress);
  const facing = target.x < origin.x ? -1 : 1;
  const travelRotation = Math.atan2(target.y - origin.y, Math.max(1, Math.abs(target.x - origin.x)));

  switch (sequence.placement) {
    case 'travel': {
      const travel = easeOutCubic(segment(progress, 0.03, 0.68));
      return drawEffectSequenceFrameAt(
        context,
        size,
        image,
        sequence,
        progress,
        { x: lerp(origin.x, target.x, travel), y: lerp(origin.y, target.y, travel) },
        alpha,
        facing,
        travelRotation,
        forcedFrame,
      );
    }
    case 'target':
      return drawEffectSequenceFrameAt(
        context,
        size,
        image,
        sequence,
        progress,
        target,
        alpha,
        facing,
        0,
        forcedFrame,
      );
    case 'origin':
      return drawEffectSequenceFrameAt(
        context,
        size,
        image,
        sequence,
        progress,
        origin,
        alpha,
        facing,
        0,
        forcedFrame,
      );
    case 'dual': {
      const departureProgress = segment(progress, 0, 0.7);
      const arrivalProgress = segment(progress, 0.22, 1);
      const departure = drawEffectSequenceFrameAt(
        context,
        size,
        image,
        sequence,
        departureProgress,
        origin,
        alpha * (1 - segment(progress, 0.58, 0.88)),
        facing,
        0,
        forcedFrame,
      );
      const arrival = progress < 0.18 ? false : drawEffectSequenceFrameAt(
        context,
        size,
        image,
        sequence,
        arrivalProgress,
        target,
        alpha * segment(progress, 0.18, 0.42),
        facing,
        0,
        forcedFrame,
      );
      return departure || arrival;
    }
    case 'board':
      return drawEffectSequenceFrameAt(
        context,
        size,
        image,
        sequence,
        progress,
        { x: size.width * 0.5, y: size.height * 0.52 },
        alpha,
        1,
        0,
        forcedFrame,
      );
  }
}

function topologyPoint(
  prepared: PreparedTopology,
  nodeId: number,
  size: CanvasSize,
  options: DrawTopologyOptions,
): Point | null {
  const node = prepared.nodeById.get(nodeId);
  if (!node) return null;
  const normalized = options.layout?.(node) ?? node;
  const center = options.center ?? { x: size.width * 0.5, y: size.height * 0.5 };
  const radius = options.radius ?? Math.min(size.width, size.height) * 0.39;
  const sourceX = normalized.x * (options.aspectX ?? 1);
  const sourceY = normalized.y * (options.aspectY ?? 1);
  const rotation = options.rotation ?? 0;
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  return {
    x: center.x + (sourceX * cosine - sourceY * sine) * radius,
    y: center.y + (sourceX * sine + sourceY * cosine) * radius,
  };
}

/** Draw a deterministic graph without performing node searches inside the RAF loop. */
function drawPreparedTopology(
  context: CanvasRenderingContext2D,
  size: CanvasSize,
  prepared: PreparedTopology,
  progress: number,
  options: DrawTopologyOptions = {},
): void {
  const bounded = clampTopologyProgress(progress);
  const stage = topologyStage(bounded);
  const stageIndex = LORD_ALPHA_TOPOLOGY_STAGES.indexOf(stage);
  const localProgress = Math.min(1, bounded * LORD_ALPHA_TOPOLOGY_STAGES.length - stageIndex);
  const nodes = prepared.topology.nodes;
  const edges = prepared.topology.edges;
  const visibleNodes = stageIndex === 0
    ? Math.max(1, Math.ceil(nodes.length * localProgress))
    : nodes.length;
  const visibleEdges = stageIndex < 1
    ? 0
    : stageIndex === 1
      ? Math.ceil(edges.length * localProgress)
      : edges.length;
  const alpha = options.alpha ?? 1;
  const color = options.color ?? '#8ff7ff';
  const accent = options.accent ?? '#fff2a8';

  context.save();
  context.globalCompositeOperation = 'lighter';
  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (let index = 0; index < visibleEdges; index += 1) {
    const edge = edges[index];
    const from = topologyPoint(prepared, edge.from, size, options);
    const to = topologyPoint(prepared, edge.to, size, options);
    if (!from || !to) continue;
    const gradient = context.createLinearGradient(from.x, from.y, to.x, to.y);
    gradient.addColorStop(0, 'rgba(125, 211, 252, .22)');
    gradient.addColorStop(0.5, color);
    gradient.addColorStop(1, 'rgba(253, 230, 138, .28)');
    context.strokeStyle = gradient;
    context.lineWidth = options.lineWidth ?? (stageIndex >= 2 ? 1.55 : 0.85);
    context.globalAlpha = alpha * (stageIndex >= 2 ? 0.78 : 0.5);
    context.beginPath();
    context.moveTo(from.x, from.y);
    const curve = options.curve ?? 0;
    if (curve !== 0) {
      const center = options.center ?? { x: size.width * 0.5, y: size.height * 0.5 };
      context.quadraticCurveTo(
        lerp((from.x + to.x) * 0.5, center.x, curve),
        lerp((from.y + to.y) * 0.5, center.y, curve),
        to.x,
        to.y,
      );
    } else {
      context.lineTo(to.x, to.y);
    }
    context.stroke();
  }

  for (let index = 0; index < visibleNodes; index += 1) {
    const node = nodes[index];
    const point = topologyPoint(prepared, node.id, size, options);
    if (!point) continue;
    context.globalAlpha = alpha * (stageIndex >= 2 ? 0.94 : 0.74);
    context.fillStyle = node.id % 3 === 0 ? accent : color;
    context.beginPath();
    context.arc(point.x, point.y, options.nodeRadius ?? (stageIndex >= 3 ? 2.7 : 1.8), 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawAperture(
  context: CanvasRenderingContext2D,
  center: Point,
  radius: number,
  progress: number,
  rotation: number,
  alpha = 1,
): void {
  const bounded = clamp(progress);
  context.save();
  context.globalCompositeOperation = 'lighter';
  context.globalAlpha = alpha;
  context.lineCap = 'round';
  for (let ring = 0; ring < 3; ring += 1) {
    const ringRadius = radius * (0.54 + ring * 0.2) * (0.45 + bounded * 0.55);
    const start = rotation * (ring % 2 === 0 ? 1 : -1) + ring * 0.7;
    context.strokeStyle = ring === 1 ? '#fde68a' : '#9ae6ff';
    context.lineWidth = Math.max(1, radius * (0.04 - ring * 0.006));
    context.beginPath();
    context.arc(center.x, center.y, ringRadius, start, start + Math.PI * (0.72 + bounded * 0.58));
    context.stroke();
  }
  context.fillStyle = '#effcff';
  context.beginPath();
  context.arc(center.x, center.y, Math.max(1.4, radius * 0.08), 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawWebShot(
  context: CanvasRenderingContext2D,
  size: CanvasSize,
  progress: number,
  topology: PreparedTopology,
  event: EventWithAnchors,
  impactOnly = false,
): void {
  const life = eventEnvelope(progress);
  const origin = resolveAnchor(event.origin, size, { x: 0.34, y: 0.56 });
  const target = resolveAnchor(event.target, size, { x: 0.64, y: 0.47 });
  const filament = impactOnly ? 1 : easeOutCubic(segment(progress, 0.08, 0.34));
  const construction = impactOnly
    ? segment(progress, 0.02, 0.62)
    : segment(progress, 0.27, 0.84);
  const span = Math.min(size.width, size.height);

  context.save();
  context.globalCompositeOperation = 'lighter';
  context.globalAlpha = life;
  if (!impactOnly) drawAperture(context, origin, span * 0.045, segment(progress, 0, 0.22), progress * 10, life);
  const filamentEnd = { x: lerp(origin.x, target.x, filament), y: lerp(origin.y, target.y, filament) };
  context.strokeStyle = '#dffcff';
  context.lineWidth = Math.max(1.15, span * 0.006);
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(origin.x, origin.y);
  context.quadraticCurveTo(
    lerp(origin.x, target.x, 0.48),
    lerp(origin.y, target.y, 0.48) - Math.sin(filament * Math.PI) * span * 0.035,
    filamentEnd.x,
    filamentEnd.y,
  );
  context.stroke();
  context.fillStyle = '#fff7c2';
  context.beginPath();
  context.arc(filamentEnd.x, filamentEnd.y, Math.max(1.4, span * 0.008), 0, Math.PI * 2);
  context.fill();
  context.restore();

  if (construction > 0) {
    const tighten = impactOnly ? easeInCubic(segment(progress, 0.58, 0.92)) : 0;
    drawPreparedTopology(context, size, topology, construction, {
      center: target,
      radius: span * lerp(impactOnly ? 0.18 : 0.13, 0.055, tighten),
      aspectY: 0.72,
      rotation: progress * 0.32,
      alpha: life * (0.94 - tighten * 0.22),
      color: '#8ff7ff',
      accent: '#fff2a8',
      curve: tighten * 0.42,
      nodeRadius: Math.max(1.25, span * 0.006),
    });
  }
}

function drawGrappleTension(
  context: CanvasRenderingContext2D,
  size: CanvasSize,
  progress: number,
  event: EventWithAnchors,
): void {
  const life = eventEnvelope(progress);
  const origin = resolveAnchor(event.origin, size, { x: 0.34, y: 0.58 });
  const target = resolveAnchor(event.target, size, { x: 0.73, y: 0.34 });
  const deploy = easeOutCubic(segment(progress, 0.06, 0.33));
  const tension = segment(progress, 0.3, 0.66);
  const acceleration = easeInCubic(segment(progress, 0.62, 0.9));
  const span = Math.min(size.width, size.height);
  const end = { x: lerp(origin.x, target.x, deploy), y: lerp(origin.y, target.y, deploy) };

  context.save();
  context.globalCompositeOperation = 'lighter';
  context.globalAlpha = life;
  context.lineCap = 'round';
  context.strokeStyle = '#f8fdff';
  context.lineWidth = Math.max(1.3, span * 0.006);
  context.beginPath();
  context.moveTo(origin.x, origin.y);
  context.quadraticCurveTo(
    lerp(origin.x, end.x, 0.5),
    lerp(origin.y, end.y, 0.5) + (1 - tension) * span * 0.08,
    end.x,
    end.y,
  );
  context.stroke();

  if (deploy >= 0.98) {
    context.translate(target.x, target.y);
    context.rotate(Math.PI * 0.25);
    context.strokeStyle = '#fde68a';
    context.lineWidth = Math.max(1, span * 0.005);
    context.strokeRect(-span * 0.018, -span * 0.018, span * 0.036, span * 0.036);
    context.rotate(-Math.PI * 0.25);
    context.translate(-target.x, -target.y);
  }

  if (tension > 0) {
    const normalX = target.y - origin.y;
    const normalY = -(target.x - origin.x);
    const normalLength = Math.max(1, Math.hypot(normalX, normalY));
    for (const offset of [-1, 1]) {
      const amount = offset * span * 0.012 * (1 - tension);
      context.globalAlpha = life * 0.55;
      context.strokeStyle = '#67e8f9';
      context.beginPath();
      context.moveTo(origin.x + normalX / normalLength * amount, origin.y + normalY / normalLength * amount);
      context.lineTo(target.x, target.y);
      context.stroke();
    }
  }

  if (acceleration > 0) {
    context.globalAlpha = life * (1 - acceleration) * 0.72;
    for (let index = 0; index < 5; index += 1) {
      const offset = (index - 2) * span * 0.018;
      context.strokeStyle = index % 2 === 0 ? '#fef3c7' : '#7dd3fc';
      context.beginPath();
      context.moveTo(origin.x - span * (0.08 + acceleration * 0.12), origin.y + offset);
      context.lineTo(origin.x - span * 0.01, origin.y + offset * 0.32);
      context.stroke();
    }
  }
  context.restore();
}

function drawRocStun(
  context: CanvasRenderingContext2D,
  size: CanvasSize,
  progress: number,
  event: EventWithAnchors,
): void {
  const life = eventEnvelope(progress);
  const source = resolveAnchor(event.origin, size, { x: 0.43, y: 0.53 });
  const target = resolveAnchor(event.target, size, { x: 0.7, y: 0.53 });
  const span = Math.min(size.width, size.height);
  const impulse = easeOutCubic(segment(progress, 0.08, 0.32));
  const distortion = segment(progress, 0.22, 0.82);
  const interference = segment(progress, 0.38, 0.78);

  context.save();
  context.globalCompositeOperation = 'lighter';
  context.lineCap = 'round';
  context.globalAlpha = life;
  context.strokeStyle = '#fff7c2';
  context.lineWidth = Math.max(1.4, span * 0.007);
  context.beginPath();
  context.arc(source.x, source.y, span * (0.035 + impulse * 0.09), -Math.PI * 0.88, Math.PI * 0.42);
  context.stroke();
  for (let ring = 0; ring < 3; ring += 1) {
    const ringProgress = clamp(distortion * 1.35 - ring * 0.18);
    if (ringProgress <= 0) continue;
    context.globalAlpha = life * (1 - ringProgress) * (0.78 - ring * 0.12);
    context.strokeStyle = ring === 1 ? '#fde68a' : '#8fe9ff';
    context.lineWidth = Math.max(1, span * 0.005);
    context.beginPath();
    context.ellipse(
      lerp(source.x, target.x, ringProgress),
      lerp(source.y, target.y, ringProgress),
      span * (0.045 + ringProgress * 0.34),
      span * (0.025 + ringProgress * 0.18),
      0,
      -Math.PI * 0.72,
      Math.PI * 0.72,
    );
    context.stroke();
  }
  if (interference > 0) {
    const centerX = target.x;
    const centerY = target.y;
    context.globalAlpha = life * Math.sin(interference * Math.PI) * 0.68;
    context.strokeStyle = '#c4b5fd';
    context.lineWidth = Math.max(0.8, span * 0.0035);
    for (let index = -2; index <= 2; index += 1) {
      const offset = index * span * 0.035;
      context.beginPath();
      context.moveTo(centerX - span * 0.14, centerY + offset);
      context.lineTo(centerX, centerY + offset * 0.45);
      context.lineTo(centerX + span * 0.14, centerY + offset);
      context.stroke();
    }
  }
  context.restore();
}

function drawDimensionalNet(
  context: CanvasRenderingContext2D,
  size: CanvasSize,
  progress: number,
  net: PreparedTopology,
  fold: PreparedTopology,
  event: EventWithAnchors,
): void {
  const life = eventEnvelope(progress);
  const center = resolveAnchor(event.target, size, { x: 0.55, y: 0.49 });
  const span = Math.min(size.width, size.height);
  // Six legible construction phases: POINTS -> NODES -> STRANDS -> WEB ->
  // CURVATURE -> FOLD. The existing bounded net/fold graphs are reused; only
  // their reveal and transform are staged more explicitly.
  const points = segment(progress, 0, 0.14);
  const nodes = segment(progress, 0.12, 0.26);
  const strands = segment(progress, 0.24, 0.46);
  const web = segment(progress, 0.44, 0.64);
  const curvature = easeInCubic(segment(progress, 0.62, 0.84));
  const foldProgress = easeInCubic(segment(progress, 0.8, 0.96));
  const collapse = segment(progress, 0.94, 1);
  const constructionProgress = progress < 0.12
    ? points * 0.2
    : progress < 0.24
      ? 0.2 + nodes * 0.05
      : progress < 0.44
        ? 0.25 + strands * 0.25
        : 0.5 + web * 0.5;
  const foldById = fold.nodeById;

  drawPreparedTopology(context, size, net, constructionProgress, {
    center,
    radius: span * lerp(0.34, 0.19, Math.max(curvature, foldProgress)),
    aspectY: lerp(0.72, 1.05, curvature),
    rotation: curvature * 0.24 + foldProgress * 0.18,
    alpha: life * (1 - collapse * 0.35),
    color: '#8ff7ff',
    accent: '#fff2a8',
    curve: curvature * 0.42 + foldProgress * 0.34,
    layout: (node) => {
      const folded = foldById.get(node.id) ?? node;
      return {
        x: lerp(node.x, folded.x * 0.58, foldProgress),
        y: lerp(node.y, folded.y, foldProgress),
      };
    },
  });

  if (nodes > 0 && strands < 0.2) {
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.globalAlpha = life * nodes * (1 - strands * 3.5) * 0.6;
    context.strokeStyle = '#fff2a8';
    context.lineWidth = Math.max(1, span * 0.004);
    context.beginPath();
    context.ellipse(center.x, center.y, span * (0.05 + nodes * 0.08), span * (0.035 + nodes * 0.05), 0, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  if (curvature > 0.12) {
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.globalAlpha = life * curvature * (1 - collapse);
    context.strokeStyle = '#c4b5fd';
    context.lineWidth = Math.max(1, span * 0.006);
    for (let ring = 0; ring < 3; ring += 1) {
      context.beginPath();
      context.ellipse(
        center.x,
        center.y,
        span * (0.08 + ring * 0.045) * (1 - collapse * 0.7),
        span * (0.2 + ring * 0.038) * (1 - collapse * 0.3),
        curvature * 0.42 + ring * 0.12,
        0,
        Math.PI * 2,
      );
      context.stroke();
    }
    context.restore();
  }
}

function drawPortalStructure(
  context: CanvasRenderingContext2D,
  size: CanvasSize,
  topology: PreparedTopology,
  center: Point,
  build: number,
  contraction: number,
  rotation: number,
  alpha: number,
): void {
  if (build <= 0 || alpha <= 0) return;
  const span = Math.min(size.width, size.height);
  drawPreparedTopology(context, size, topology, Math.max(0.02, build * 0.92), {
    center,
    radius: span * 0.2 * (1 - contraction * 0.72),
    aspectX: 0.56,
    rotation,
    alpha,
    color: '#a5b4fc',
    accent: '#fde68a',
    curve: 0.18 + contraction * 0.58,
  });
  drawAperture(
    context,
    center,
    span * 0.15 * (1 - contraction * 0.66),
    build,
    rotation * 3.2,
    alpha * build,
  );
}

function drawWormholeStep(
  context: CanvasRenderingContext2D,
  size: CanvasSize,
  progress: number,
  portal: PreparedTopology,
  event: EventWithAnchors,
): void {
  const life = eventEnvelope(progress);
  const departure = resolveAnchor(event.origin, size, { x: 0.34, y: 0.52 });
  const arrival = resolveAnchor(event.destination ?? event.target, size, { x: 0.69, y: 0.45 });
  const departureBuild = segment(progress, 0, 0.24);
  const departureContract = segment(progress, 0.28, 0.58);
  const arrivalBuild = segment(progress, 0.38, 0.72);
  const arrivalContract = segment(progress, 0.88, 1);
  drawPortalStructure(context, size, portal, departure, departureBuild, departureContract, progress * 0.9, life * (1 - departureContract * 0.7));
  drawPortalStructure(context, size, portal, arrival, arrivalBuild, arrivalContract, -progress * 0.9, life * (1 - arrivalContract * 0.75));

  const transit = segment(progress, 0.34, 0.7);
  if (transit > 0 && transit < 1) {
    const x = lerp(departure.x, arrival.x, transit);
    const y = lerp(departure.y, arrival.y, transit) - Math.sin(transit * Math.PI) * Math.min(size.width, size.height) * 0.055;
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.globalAlpha = life;
    context.fillStyle = '#f8fdff';
    context.beginPath();
    context.arc(x, y, Math.max(2, Math.min(size.width, size.height) * 0.012), 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#7dd3fc';
    context.lineWidth = 1.2;
    context.beginPath();
    context.moveTo(lerp(departure.x, arrival.x, Math.max(0, transit - 0.08)), lerp(departure.y, arrival.y, Math.max(0, transit - 0.08)));
    context.lineTo(x, y);
    context.stroke();
    context.restore();
  }
}

const CLONE_POSE_POINTS: readonly Point[] = [
  { x: 0, y: -0.34 }, { x: 0, y: -0.17 }, { x: -0.16, y: -0.04 },
  { x: 0.16, y: -0.04 }, { x: 0, y: 0.1 }, { x: -0.12, y: 0.35 }, { x: 0.12, y: 0.35 },
];
const CLONE_POSE_EDGES: readonly (readonly [number, number])[] = [
  [0, 1], [1, 2], [1, 3], [1, 4], [4, 5], [4, 6],
];

function drawPoseTrace(
  context: CanvasRenderingContext2D,
  center: Point,
  span: number,
  pointProgress: number,
  edgeProgress: number,
  mirror: -1 | 1,
  alpha: number,
): void {
  const visiblePoints = Math.ceil(CLONE_POSE_POINTS.length * clamp(pointProgress));
  const visibleEdges = Math.ceil(CLONE_POSE_EDGES.length * clamp(edgeProgress));
  context.save();
  context.globalCompositeOperation = 'lighter';
  context.globalAlpha = alpha;
  context.lineCap = 'round';
  context.strokeStyle = '#8ff7ff';
  context.lineWidth = Math.max(1.1, span * 0.012);
  for (let index = 0; index < visibleEdges; index += 1) {
    const edge = CLONE_POSE_EDGES[index];
    const from = CLONE_POSE_POINTS[edge[0]];
    const to = CLONE_POSE_POINTS[edge[1]];
    context.beginPath();
    context.moveTo(center.x + from.x * span * mirror, center.y + from.y * span);
    context.lineTo(center.x + to.x * span * mirror, center.y + to.y * span);
    context.stroke();
  }
  for (let index = 0; index < visiblePoints; index += 1) {
    const point = CLONE_POSE_POINTS[index];
    context.fillStyle = index === 0 ? '#fff2a8' : '#dffcff';
    context.beginPath();
    context.arc(center.x + point.x * span * mirror, center.y + point.y * span, Math.max(1.2, span * 0.016), 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawSymmetricCloneConstruction(
  context: CanvasRenderingContext2D,
  size: CanvasSize,
  progress: number,
  event: EventWithAnchors,
): void {
  const life = eventEnvelope(progress);
  const origin = resolveAnchor(event.origin, size, { x: 0.5, y: 0.52 });
  const span = Math.min(size.width, size.height);
  const trace = segment(progress, 0, 0.22);
  const separation = easeOutCubic(segment(progress, 0.18, 0.5));
  const synchronization = segment(progress, 0.34, 0.68);
  const construction = segment(progress, 0.55, 0.84);
  const stable = segment(progress, 0.8, 0.94);

  if (trace > 0 && progress < 0.5) {
    drawPoseTrace(context, origin, span * 0.22, trace, segment(progress, 0.1, 0.26), 1, life * (1 - separation * 0.72));
  }
  const cloneOffset = span * lerp(0.035, 0.28, separation);
  const pairCenters = [
    { x: origin.x - cloneOffset, y: origin.y },
    { x: origin.x + cloneOffset, y: origin.y },
  ] as const;
  const pairedNodeProgress = segment(progress, 0.2, 0.52);
  for (let pairIndex = 0; pairIndex < pairCenters.length; pairIndex += 1) {
    drawPoseTrace(
      context,
      pairCenters[pairIndex],
      span * 0.2,
      pairedNodeProgress,
      construction,
      pairIndex === 0 ? -1 : 1,
      life * (0.58 + stable * 0.42),
    );
  }
  if (synchronization > 0 && stable < 1) {
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.globalAlpha = life * Math.sin(synchronization * Math.PI) * 0.74;
    context.lineWidth = Math.max(1, span * 0.006);
    for (let index = 0; index < 3; index += 1) {
      const phaseError = (1 - synchronization) * (index + 1) * 0.7;
      for (const side of [-1, 1]) {
        const center = pairCenters[side === -1 ? 0 : 1];
        context.strokeStyle = index === 1 ? '#fde68a' : '#a5b4fc';
        context.beginPath();
        context.ellipse(center.x, center.y, span * (0.075 + index * 0.03), span * (0.18 + index * 0.025), side * phaseError, -Math.PI * 0.62, Math.PI * 0.7);
        context.stroke();
      }
    }
    context.restore();
  }
  if (stable > 0) {
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.globalAlpha = life * stable * 0.65;
    context.strokeStyle = '#fff7c2';
    context.lineWidth = Math.max(1, span * 0.005);
    context.beginPath();
    context.moveTo(pairCenters[0].x, origin.y - span * 0.25);
    context.lineTo(origin.x, origin.y - span * 0.31);
    context.lineTo(pairCenters[1].x, origin.y - span * 0.25);
    context.stroke();
    context.restore();
  }
}

function getCreatureImage(baseUrl: string): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  const url = lordAlphaAssetUrl(baseUrl, LORD_ALPHA_ASSETS.effects.tharthareon);
  const cached = CREATURE_IMAGES.get(url);
  if (cached) return cached;
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  CREATURE_IMAGES.set(url, image);
  return image;
}

function drawCreatureSilhouette(
  context: CanvasRenderingContext2D,
  size: CanvasSize,
  center: Point,
  scale: number,
  alpha: number,
): void {
  const span = Math.min(size.width, size.height);
  context.save();
  context.translate(center.x, center.y);
  context.scale(scale, scale);
  context.globalCompositeOperation = 'lighter';
  context.globalAlpha = alpha;
  const silhouette = context.createLinearGradient(0, -span * 0.25, 0, span * 0.3);
  silhouette.addColorStop(0, '#e0f2fe');
  silhouette.addColorStop(0.42, '#60a5fa');
  silhouette.addColorStop(1, '#312e81');
  context.fillStyle = silhouette;
  context.beginPath();
  context.moveTo(0, -span * 0.31);
  context.lineTo(-span * 0.09, -span * 0.18);
  context.lineTo(-span * 0.24, -span * 0.25);
  context.lineTo(-span * 0.17, -span * 0.08);
  context.quadraticCurveTo(-span * 0.29, span * 0.08, -span * 0.2, span * 0.28);
  context.lineTo(0, span * 0.18);
  context.lineTo(span * 0.2, span * 0.28);
  context.quadraticCurveTo(span * 0.29, span * 0.08, span * 0.17, -span * 0.08);
  context.lineTo(span * 0.24, -span * 0.25);
  context.lineTo(span * 0.09, -span * 0.18);
  context.closePath();
  context.fill();
  context.restore();
}

function drawTharthareonEmergence(
  context: CanvasRenderingContext2D,
  size: CanvasSize,
  progress: number,
  image: HTMLImageElement | null,
): void {
  const life = eventEnvelope(progress);
  const depth = segment(progress, 0.08, 0.3);
  const silhouetteProgress = segment(progress, 0.18, 0.42);
  const crossing = easeOutCubic(segment(progress, 0.34, 0.9));
  const span = Math.min(size.width, size.height);
  const center = { x: size.width * 0.52, y: size.height * 0.51 };

  if (depth > 0 && crossing < 0.48) {
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.globalAlpha = life * Math.sin(depth * Math.PI) * 0.92;
    context.fillStyle = '#dffcff';
    for (const side of [-1, 1]) {
      context.beginPath();
      context.ellipse(center.x + side * span * 0.055, center.y - span * 0.09, span * 0.015, span * 0.008, 0, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }
  if (silhouetteProgress > 0 && crossing < 0.7) {
    drawCreatureSilhouette(
      context,
      size,
      { x: center.x, y: center.y + (1 - silhouetteProgress) * span * 0.08 },
      0.72 + silhouetteProgress * 0.13,
      life * silhouetteProgress * (1 - crossing * 0.7),
    );
  }
  if (!image?.complete || image.naturalWidth <= 0 || crossing <= 0) return;
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const maxWidth = Math.min(size.width * 0.58, 390);
  const maxHeight = Math.min(size.height * 0.74, 420);
  let drawWidth = maxWidth;
  let drawHeight = drawWidth / imageRatio;
  if (drawHeight > maxHeight) {
    drawHeight = maxHeight;
    drawWidth = drawHeight * imageRatio;
  }
  const scale = 0.72 + crossing * 0.28;
  drawWidth *= scale;
  drawHeight *= scale;
  const drawX = center.x - drawWidth * 0.5 + (1 - crossing) * span * 0.08;
  const drawY = center.y - drawHeight * 0.53 + (1 - crossing) * span * 0.06;
  const clipRadiusX = span * (0.055 + crossing * 0.42);
  const clipRadiusY = span * (0.15 + crossing * 0.3);

  context.save();
  context.globalAlpha = life * Math.min(1, crossing * 1.4);
  context.beginPath();
  context.ellipse(center.x, center.y, clipRadiusX, clipRadiusY, 0, 0, Math.PI * 2);
  context.clip();
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  context.restore();
  if (crossing > 0.72) {
    context.save();
    context.globalAlpha = life * segment(crossing, 0.72, 1);
    context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    context.restore();
  }
}

function drawDragonSilhouette(
  context: CanvasRenderingContext2D,
  size: CanvasSize,
  center: Point,
  scale: number,
  alpha: number,
): void {
  const span = Math.min(size.width, size.height);
  context.save();
  context.translate(center.x, center.y);
  context.scale(scale, scale);
  context.globalCompositeOperation = 'lighter';
  context.globalAlpha = alpha;
  context.strokeStyle = '#fff1a8';
  context.fillStyle = 'rgba(37, 99, 235, .66)';
  context.lineWidth = Math.max(1.4, span * 0.009);
  context.lineJoin = 'round';
  context.beginPath();
  context.moveTo(-span * 0.05, span * 0.06);
  context.quadraticCurveTo(-span * 0.2, -span * 0.08, -span * 0.35, -span * 0.01);
  context.quadraticCurveTo(-span * 0.21, -span * 0.24, -span * 0.03, -span * 0.1);
  context.quadraticCurveTo(span * 0.04, -span * 0.2, span * 0.15, -span * 0.17);
  context.lineTo(span * 0.25, -span * 0.1);
  context.lineTo(span * 0.16, -span * 0.07);
  context.quadraticCurveTo(span * 0.24, span * 0.03, span * 0.34, span * 0.08);
  context.quadraticCurveTo(span * 0.13, span * 0.08, span * 0.02, span * 0.13);
  context.closePath();
  context.fill();
  context.stroke();
  context.fillStyle = '#e0f2fe';
  context.beginPath();
  context.arc(span * 0.16, -span * 0.13, Math.max(1.4, span * 0.012), 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawMillenniumDragon(
  context: CanvasRenderingContext2D,
  size: CanvasSize,
  progress: number,
  net: PreparedTopology,
  fold: PreparedTopology,
  portal: PreparedTopology,
): void {
  const life = eventEnvelope(progress);
  const span = Math.min(size.width, size.height);
  const center = { x: size.width * 0.5, y: size.height * 0.48 };
  const calculus = segment(progress, 0, 0.18);
  const matrix = segment(progress, 0.12, 0.32);
  const foldProgress = segment(progress, 0.26, 0.46);
  const beyond = segment(progress, 0.43, 0.6);
  const arrival = easeInCubic(segment(progress, 0.56, 0.78));
  const impact = segment(progress, 0.76, 0.9);
  const resolution = segment(progress, 0.86, 1);

  if (progress < 0.48) {
    const foldById = fold.nodeById;
    drawPreparedTopology(context, size, net, Math.max(calculus * 0.24, matrix * 0.75), {
      center,
      radius: span * lerp(0.38, 0.21, foldProgress),
      aspectY: lerp(0.7, 1, foldProgress),
      rotation: foldProgress * 0.28,
      alpha: life * 0.78,
      color: '#8ff7ff',
      accent: '#fde68a',
      curve: foldProgress * 0.68,
      layout: (node) => {
        const folded = foldById.get(node.id) ?? node;
        return { x: lerp(node.x, folded.x * 0.52, foldProgress), y: lerp(node.y, folded.y, foldProgress) };
      },
    });
  }
  const portalBuild = segment(progress, 0.3, 0.5);
  const portalCollapse = segment(progress, 0.88, 1);
  drawPortalStructure(context, size, portal, center, portalBuild, portalCollapse, progress * 0.85, life);
  if (beyond > 0 && progress < 0.75) {
    drawDragonSilhouette(context, size, center, 0.68 + beyond * 0.18, life * beyond * (1 - arrival * 0.42));
  }
  if (arrival > 0) {
    const groundY = size.height * 0.7;
    const dragonY = groundY - span * 0.11 - (1 - arrival) * span * 0.72;
    drawDragonSilhouette(context, size, { x: center.x, y: dragonY }, 0.84 + arrival * 0.16, life);
  }
  if (impact > 0) {
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.globalAlpha = life * (1 - impact * 0.65);
    context.strokeStyle = '#fde68a';
    context.lineWidth = Math.max(1.4, span * 0.009);
    const groundY = size.height * 0.7;
    context.beginPath();
    context.ellipse(center.x, groundY, span * (0.08 + impact * 0.43), span * (0.018 + impact * 0.08), 0, 0, Math.PI * 2);
    context.stroke();
    for (let index = 0; index < 8; index += 1) {
      const direction = (index / 8) * Math.PI * 2;
      context.beginPath();
      context.moveTo(center.x + Math.cos(direction) * span * 0.08, groundY + Math.sin(direction) * span * 0.025);
      context.lineTo(center.x + Math.cos(direction) * span * (0.12 + impact * 0.29), groundY + Math.sin(direction) * span * (0.04 + impact * 0.1));
      context.stroke();
    }
    context.restore();
  }
  if (resolution > 0) {
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.globalAlpha = life * (1 - resolution) * 0.7;
    context.strokeStyle = '#67e8f9';
    context.lineWidth = Math.max(1, span * 0.005);
    for (let ring = 0; ring < 3; ring += 1) {
      context.beginPath();
      context.ellipse(center.x, size.height * 0.7, span * (0.18 + resolution * (0.44 + ring * 0.08)), span * (0.035 + resolution * (0.1 + ring * 0.015)), 0, 0, Math.PI * 2);
      context.stroke();
    }
    context.restore();
  }
}

function drawAuxiliaryEffect(
  context: CanvasRenderingContext2D,
  size: CanvasSize,
  progress: number,
  kind: 'move' | 'equip',
  event: EventWithAnchors,
): void {
  const life = eventEnvelope(progress);
  const center = resolveAnchor(event.origin, size, { x: 0.5, y: 0.52 });
  const span = Math.min(size.width, size.height);
  context.save();
  context.globalCompositeOperation = 'lighter';
  context.globalAlpha = life * 0.7;
  context.strokeStyle = kind === 'equip' ? '#fde68a' : '#67e8f9';
  context.lineWidth = 1.4;
  if (kind === 'move') {
    for (let index = 0; index < 6; index += 1) {
      const offset = (index - 2.5) * span * 0.055;
      context.beginPath();
      context.moveTo(center.x - span * (0.32 + progress * 0.16), center.y + offset);
      context.lineTo(center.x + span * (0.04 + progress * 0.22), center.y + offset * 0.35);
      context.stroke();
    }
  } else {
    const aperture = segment(progress, 0, 0.28);
    const propagation = segment(progress, 0.18, 0.84);
    drawAperture(context, { x: center.x - span * 0.08, y: center.y - span * 0.16 }, span * 0.055, aperture, progress * 9, life);
    for (const side of [-1, 1]) {
      for (let member = 0; member < 4; member += 1) {
        const reveal = clamp(propagation * 5 - member);
        const start = { x: center.x + side * span * 0.08, y: center.y - span * 0.16 };
        const end = { x: center.x + side * span * (0.12 + member * 0.035), y: center.y + span * (-0.08 + member * 0.1) };
        context.globalAlpha = life * reveal;
        context.beginPath();
        context.moveTo(start.x, start.y);
        context.lineTo(lerp(start.x, end.x, reveal), lerp(start.y, end.y, reveal));
        context.stroke();
      }
    }
  }
  context.restore();
}

function debugStageFor(kind: string, progress: number): string {
  if (kind === 'dimensional-net') {
    if (progress < 0.14) return 'points';
    if (progress < 0.26) return 'nodes';
    if (progress < 0.46) return 'strands';
    if (progress < 0.64) return 'web';
    if (progress < 0.84) return 'curvature';
    return 'fold';
  }
  if (kind === 'clone') {
    if (progress < 0.22) return 'trace';
    if (progress < 0.52) return 'symmetry';
    if (progress < 0.75) return 'synchronization';
    return 'constructed';
  }
  if (kind === 'tharthareon') {
    if (progress < 0.24) return 'geometry';
    if (progress < 0.42) return 'depth';
    if (progress < 0.62) return 'silhouette';
    return 'emergence';
  }
  if (kind === 'dragon') {
    if (progress < 0.18) return 'calculus';
    if (progress < 0.32) return 'matrix';
    if (progress < 0.46) return 'dimensional-fold';
    if (progress < 0.6) return 'presence-beyond';
    if (progress < 0.76) return 'arrival';
    if (progress < 0.9) return 'landing';
    return 'resolution';
  }
  return topologyStage(progress);
}

export function LordAlphaVfx({
  baseUrl = import.meta.env.BASE_URL,
  event,
  pulse,
  className,
}: LordAlphaVfxProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const eventProgressRef = useRef(event?.progress ?? 0);
  const eventKind = event ? resolveLordAlphaVfxMode(event) : null;
  const authoredSequence = resolveLordAlphaEffectSequence(event);

  useEffect(() => {
    eventProgressRef.current = event?.progress ?? 0;
  }, [event?.progress]);

  useEffect(() => {
    for (const sequence of Object.values(LORD_ALPHA_EFFECT_SEQUENCE_ASSETS)) {
      getEffectSequenceImage(baseUrl, sequence);
    }
  }, [baseUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const preparedCanvas = prepareCanvas(canvas);
    if (!preparedCanvas) return;
    let surface = preparedCanvas;
    surface.context.clearRect(0, 0, surface.size.width, surface.size.height);
    if (!eventKind || !event) {
      delete canvas.dataset.stage;
      delete canvas.dataset.effect;
      delete canvas.dataset.effectSource;
      return;
    }

    const eventData = event as EventWithAnchors;
    canvas.dataset.effect = eventKind;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = LORD_ALPHA_VFX_TIMINGS_MS[eventKind];
    const seed = eventData.seed ?? `${eventKind}:${pulse}`;
    const nodeCount = eventKind === 'dragon' ? 36 : eventKind === 'dimensional-net' ? 30 : 24;
    const net = prepareTopology(generateLordAlphaTopology({ kind: 'net', seed: `${seed}:net`, nodeCount }));
    const fold = prepareTopology(generateLordAlphaTopology({ kind: 'fold', seed: `${seed}:fold`, nodeCount }));
    const portal = prepareTopology(generateLordAlphaTopology({ kind: 'portal', seed: `${seed}:portal`, nodeCount: 28 }));
    const webImpact = prepareTopology(generateLordAlphaTopology({ kind: 'radial', seed: `${seed}:impact`, nodeCount: 17 }));
    const creature = eventKind === 'tharthareon' ? getCreatureImage(baseUrl) : null;
    const effectSequenceImage = authoredSequence
      ? getEffectSequenceImage(baseUrl, authoredSequence)
      : null;

    let animationFrame = 0;
    let stopped = false;
    let lastProgress = 0;
    const initialProgress = clampTopologyProgress(eventProgressRef.current);
    const startedAt = performance.now();

    const drawFrame = (progress: number): void => {
      const bounded = clampTopologyProgress(progress);
      lastProgress = bounded;
      surface = prepareCanvas(canvas) ?? surface;
      const { context, size } = surface;
      context.clearRect(0, 0, size.width, size.height);
      canvas.dataset.stage = debugStageFor(eventKind, bounded);
      if (
        authoredSequence
        && effectSequenceImage
        && drawEffectSequence(
          context,
          size,
          effectSequenceImage,
          authoredSequence,
          bounded,
          eventData,
          reducedMotion ? authoredSequence.reducedMotionFrame : undefined,
        )
      ) {
        canvas.dataset.effectSource = 'imagegen';
        return;
      }
      canvas.dataset.effectSource = 'procedural-fallback';
      switch (eventKind) {
        case 'web':
          drawWebShot(context, size, bounded, webImpact, eventData);
          return;
        case 'web-impact':
          drawWebShot(context, size, bounded, webImpact, eventData, true);
          return;
        case 'grapple':
          drawGrappleTension(context, size, bounded, eventData);
          return;
        case 'roc-stun':
          drawRocStun(context, size, bounded, eventData);
          return;
        case 'dimensional-net':
          drawDimensionalNet(context, size, bounded, net, fold, eventData);
          return;
        case 'wormhole':
          drawWormholeStep(context, size, bounded, portal, eventData);
          return;
        case 'tharthareon': {
          const portalBuild = segment(bounded, 0, 0.36);
          const portalCollapse = segment(bounded, 0.9, 1);
          drawPortalStructure(context, size, portal, { x: size.width * 0.5, y: size.height * 0.5 }, portalBuild, portalCollapse, bounded * 0.8, eventEnvelope(bounded));
          drawTharthareonEmergence(context, size, bounded, creature);
          return;
        }
        case 'tharthareon-fireball': {
          const portalBuild = segment(bounded, 0, 0.16);
          const portalCollapse = segment(bounded, 0.86, 1);
          drawPortalStructure(
            context,
            size,
            portal,
            resolveAnchor(eventData.origin, size, { x: 0.36, y: 0.54 }),
            portalBuild,
            portalCollapse,
            bounded * 0.8,
            eventEnvelope(bounded),
          );
          return;
        }
        case 'dragon':
          drawMillenniumDragon(context, size, bounded, net, fold, portal);
          return;
        case 'clone':
          drawSymmetricCloneConstruction(context, size, bounded, eventData);
          return;
        case 'move':
        case 'equip':
          drawAuxiliaryEffect(context, size, bounded, eventKind, eventData);
          return;
        default:
          drawPreparedTopology(context, size, net, bounded, { alpha: eventEnvelope(bounded) * 0.72, color: '#8ff7ff', accent: '#fff2a8' });
      }
    };

    const redrawLoadedCreature = () => {
      if (!stopped && reducedMotion && eventKind === 'tharthareon') drawFrame(lastProgress);
    };
    const redrawLoadedSequence = () => {
      if (!stopped) drawFrame(lastProgress);
    };
    creature?.addEventListener('load', redrawLoadedCreature);
    effectSequenceImage?.addEventListener('load', redrawLoadedSequence);
    const redrawForResize = () => {
      if (!stopped) drawFrame(lastProgress);
    };
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(redrawForResize);
    resizeObserver?.observe(canvas.parentElement ?? canvas);
    window.addEventListener('resize', redrawForResize);
    window.addEventListener('orientationchange', redrawForResize);
    const stopObservers = () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', redrawForResize);
      window.removeEventListener('orientationchange', redrawForResize);
      creature?.removeEventListener('load', redrawLoadedCreature);
      effectSequenceImage?.removeEventListener('load', redrawLoadedSequence);
    };

    if (reducedMotion) {
      const staticProgress = Math.max(initialProgress, REDUCED_MOTION_PROGRESS[eventKind] ?? 0.76);
      drawFrame(staticProgress);
      return () => {
        stopped = true;
        stopObservers();
      };
    }

    const tick = (now: number) => {
      if (stopped) return;
      const localProgress = clampTopologyProgress(initialProgress + (now - startedAt) / duration);
      const authoredProgress = clampTopologyProgress(eventProgressRef.current);
      const progress = Math.max(localProgress, authoredProgress);
      drawFrame(progress);
      if (progress < 1) animationFrame = window.requestAnimationFrame(tick);
    };
    animationFrame = window.requestAnimationFrame(tick);

    return () => {
      stopped = true;
      stopObservers();
      window.cancelAnimationFrame(animationFrame);
      surface.context.clearRect(0, 0, surface.size.width, surface.size.height);
    };
  }, [authoredSequence, baseUrl, eventKind, pulse]);

  return (
    <canvas
      ref={canvasRef}
      className={['lordAlphaVfx', className].filter(Boolean).join(' ')}
      style={VFX_STYLE}
      aria-hidden="true"
    />
  );
}
