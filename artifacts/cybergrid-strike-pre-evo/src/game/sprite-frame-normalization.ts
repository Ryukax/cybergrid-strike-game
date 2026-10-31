export type SpriteAlphaBounds = Readonly<{
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  pixels: number;
}>;

export type SpriteFrameSize = Readonly<{
  width: number;
  height: number;
}>;

export type SpriteFrameProjection = Readonly<{
  scale: number;
  drawX: number;
  drawY: number;
  drawWidth: number;
  drawHeight: number;
}>;

export type SpriteFrameNormalizationOptions = Readonly<{
  alphaThreshold?: number;
  minScale?: number;
  maxScale?: number;
  lockRoot?: boolean;
  mode?: 'per-frame' | 'sequence';
  alignActor?: boolean;
}>;

const DEFAULT_ALPHA_THRESHOLD = 18;
const DEFAULT_MIN_SCALE = 1;
const DEFAULT_MAX_SCALE = 1.35;

export function measureSpriteIslands(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  alphaThreshold = DEFAULT_ALPHA_THRESHOLD,
): SpriteAlphaBounds[] {
  if (width <= 0 || height <= 0 || rgba.length < width * height * 4) return [];

  const pixelCount = width * height;
  const visited = new Uint8Array(pixelCount);
  const stack = new Int32Array(pixelCount);
  const islands: SpriteAlphaBounds[] = [];

  for (let start = 0; start < pixelCount; start++) {
    if (visited[start] || rgba[start * 4 + 3] < alphaThreshold) continue;

    let stackLength = 1;
    stack[0] = start;
    visited[start] = 1;
    let islandPixels = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    while (stackLength > 0) {
      const pixel = stack[--stackLength];
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      islandPixels++;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      for (let dy = -1; dy <= 1; dy++) {
        const nextY = y + dy;
        if (nextY < 0 || nextY >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nextX = x + dx;
          if (nextX < 0 || nextX >= width) continue;
          const next = nextY * width + nextX;
          if (visited[next] || rgba[next * 4 + 3] < alphaThreshold) continue;
          visited[next] = 1;
          stack[stackLength++] = next;
        }
      }
    }

    islands.push({ minX, minY, maxX, maxY, pixels: islandPixels });
  }

  return islands;
}

/**
 * Locate the largest connected opaque island in a raster frame. Small detached
 * sparks and particles must not define the reference actor's scale.
 */
export function measurePrimarySpriteIsland(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  alphaThreshold = DEFAULT_ALPHA_THRESHOLD,
): SpriteAlphaBounds | null {
  return measureSpriteIslands(rgba, width, height, alphaThreshold)
    .reduce<SpriteAlphaBounds | null>(
      (best, island) => !best || island.pixels > best.pixels ? island : best,
      null,
    );
}

/** Prefer an island near the canonical actor center/root over a larger remote VFX island. */
export function selectSpriteActorIsland(
  islands: readonly SpriteAlphaBounds[],
  frameSize: SpriteFrameSize,
  referenceBounds: SpriteAlphaBounds,
  referenceSize: SpriteFrameSize,
): SpriteAlphaBounds | null {
  if (islands.length === 0) return null;
  const expectedCenterX = (
    (referenceBounds.minX + referenceBounds.maxX + 1) / 2 / referenceSize.width
  ) * frameSize.width;
  const expectedRootY = ((referenceBounds.maxY + 1) / referenceSize.height) * frameSize.height;
  // Authored rival actors occupy the left/center actor stage; shields, beams,
  // webs, and constructs expand into the right-side effect stage. If no island
  // remains inside the actor ROI, leave the frame untouched rather than
  // centering the whole composition around an effect.
  const actorCandidates = islands.filter((island) => (
    (island.minX + island.maxX + 1) / 2 <= frameSize.width * 0.62
    && island.maxY + 1 >= frameSize.height * 0.42
  ));
  if (actorCandidates.length === 0) return null;
  return actorCandidates.reduce((best, island) => {
    const score = (candidate: SpriteAlphaBounds) => {
      const centerX = (candidate.minX + candidate.maxX + 1) / 2;
      const rootY = candidate.maxY + 1;
      const distance = Math.hypot(
        (centerX - expectedCenterX) / Math.max(1, frameSize.width),
        (rootY - expectedRootY) / Math.max(1, frameSize.height) * 1.35,
      );
      return Math.log1p(candidate.pixels) - distance * 4.5;
    };
    return score(island) > score(best) ? island : best;
  });
}

/**
 * Resolve one stable actor projection. The primary-island diagonal is used as
 * the gauge so a crouch can remain shorter while no longer looking like the
 * whole sprite was uniformly shrunk. The actor's root is registered to the
 * reference frame and the correction is bounded to preserve authored VFX.
 */
export function resolveStableSpriteFrameProjection(
  referenceBounds: SpriteAlphaBounds,
  referenceSize: SpriteFrameSize,
  frameBounds: SpriteAlphaBounds,
  frameSize: SpriteFrameSize,
  options: SpriteFrameNormalizationOptions = {},
): SpriteFrameProjection {
  const minScale = options.minScale ?? DEFAULT_MIN_SCALE;
  const maxScale = options.maxScale ?? DEFAULT_MAX_SCALE;
  const referenceWidth = referenceBounds.maxX - referenceBounds.minX + 1;
  const referenceHeight = referenceBounds.maxY - referenceBounds.minY + 1;
  const frameWidth = frameBounds.maxX - frameBounds.minX + 1;
  const frameHeight = frameBounds.maxY - frameBounds.minY + 1;
  const referenceCanvasGauge = Math.max(1, Math.hypot(referenceSize.width, referenceSize.height));
  const frameCanvasGauge = Math.max(1, Math.hypot(frameSize.width, frameSize.height));
  const referenceGaugeRatio = Math.hypot(referenceWidth, referenceHeight) / referenceCanvasGauge;
  const targetGauge = referenceGaugeRatio * frameCanvasGauge;
  const currentGauge = Math.max(1, Math.hypot(frameWidth, frameHeight));
  const scale = Math.min(maxScale, Math.max(minScale, targetGauge / currentGauge));

  const referenceRootRatio = (referenceBounds.maxY + 1) / Math.max(1, referenceSize.height);
  const targetRoot = referenceRootRatio * frameSize.height;
  const drawWidth = frameSize.width * scale;
  const drawHeight = frameSize.height * scale;
  const referenceCenterRatio = (
    (referenceBounds.minX + referenceBounds.maxX + 1) / 2
  ) / Math.max(1, referenceSize.width);
  const targetCenterX = referenceCenterRatio * frameSize.width;
  const frameCenterX = (frameBounds.minX + frameBounds.maxX + 1) / 2;
  let drawX = options.alignActor === false
    ? (frameSize.width - drawWidth) / 2
    : targetCenterX - frameCenterX * scale;
  let drawY = options.lockRoot
    ? targetRoot - (frameBounds.maxY + 1) * scale
    : (frameSize.height - drawHeight) / 2;
  const projectedActorWidth = frameWidth * scale;
  const projectedActorHeight = frameHeight * scale;
  if (projectedActorWidth <= frameSize.width) {
    drawX = Math.min(
      -frameBounds.minX * scale + frameSize.width - projectedActorWidth,
      Math.max(-frameBounds.minX * scale, drawX),
    );
  }
  if (projectedActorHeight <= frameSize.height) {
    drawY = Math.min(
      -frameBounds.minY * scale + frameSize.height - projectedActorHeight,
      Math.max(-frameBounds.minY * scale, drawY),
    );
  }

  return {
    scale,
    drawX,
    drawY,
    drawWidth,
    drawHeight,
  };
}

function inspectBitmapIslands(
  bitmap: ImageBitmap,
  alphaThreshold: number,
): SpriteAlphaBounds[] {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return [];
  context.drawImage(bitmap, 0, 0);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  return measureSpriteIslands(
    image.data,
    canvas.width,
    canvas.height,
    alphaThreshold,
  );
}

function inspectBitmap(
  bitmap: ImageBitmap,
  alphaThreshold: number,
): SpriteAlphaBounds | null {
  return inspectBitmapIslands(bitmap, alphaThreshold)
    .reduce<SpriteAlphaBounds | null>(
      (best, island) => !best || island.pixels > best.pixels ? island : best,
      null,
    );
}

/**
 * Normalize a decoded animation bank once, before gameplay. This keeps the hot
 * render loop to a single opaque draw per frame and preserves each source
 * frame's aspect ratio (notably the 256x160 concept actors).
 *
 * The caller owns both the input and returned bitmaps. Inputs are deliberately
 * not closed here so cancellation and shared-reference cleanup remain explicit.
 */
export async function normalizeSpriteFrameBank(
  reference: ImageBitmap,
  frames: readonly ImageBitmap[],
  options: SpriteFrameNormalizationOptions = {},
): Promise<ImageBitmap[]> {
  if (frames.length === 0) return [];
  const alphaThreshold = options.alphaThreshold ?? DEFAULT_ALPHA_THRESHOLD;
  const referenceBounds = inspectBitmap(reference, alphaThreshold);
  if (!referenceBounds) {
    return Promise.all(frames.map((frame) => createImageBitmap(frame)));
  }

  const normalized: ImageBitmap[] = [];
  try {
    const sequenceBounds = options.mode === 'sequence'
      ? selectSpriteActorIsland(
          inspectBitmapIslands(frames[0], alphaThreshold),
          { width: frames[0].width, height: frames[0].height },
          referenceBounds,
          { width: reference.width, height: reference.height },
        )
      : null;
    const sequenceProjection = sequenceBounds
      ? resolveStableSpriteFrameProjection(
          referenceBounds,
          { width: reference.width, height: reference.height },
          sequenceBounds,
          { width: frames[0].width, height: frames[0].height },
          options,
        )
      : null;
    for (const frame of frames) {
      const frameBounds = sequenceProjection
        ? sequenceBounds
        : selectSpriteActorIsland(
            inspectBitmapIslands(frame, alphaThreshold),
            { width: frame.width, height: frame.height },
            referenceBounds,
            { width: reference.width, height: reference.height },
          );
      const canvas = document.createElement('canvas');
      canvas.width = frame.width;
      canvas.height = frame.height;
      const context = canvas.getContext('2d');
      if (!context) {
        normalized.push(await createImageBitmap(frame));
        continue;
      }
      context.imageSmoothingEnabled = false;
      if (!frameBounds) {
        context.drawImage(frame, 0, 0);
      } else {
        const projection = sequenceProjection ?? resolveStableSpriteFrameProjection(
            referenceBounds,
            { width: reference.width, height: reference.height },
            frameBounds,
            { width: frame.width, height: frame.height },
            options,
          );
        context.drawImage(
          frame,
          projection.drawX,
          projection.drawY,
          projection.drawWidth,
          projection.drawHeight,
        );
      }
      normalized.push(await createImageBitmap(canvas));
    }
    return normalized;
  } catch (error) {
    normalized.forEach((frame) => frame.close());
    throw error;
  }
}
