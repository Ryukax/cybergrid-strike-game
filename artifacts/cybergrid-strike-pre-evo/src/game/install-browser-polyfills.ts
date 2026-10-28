/* Keep these runtime fallbacks in a dependency that evaluates before the
 * dynamically imported game. Vite's Safari target lowers JavaScript syntax,
 * but it intentionally does not install missing browser APIs. */
if (typeof globalThis === 'undefined' && typeof window !== 'undefined') {
  Object.defineProperty(window, 'globalThis', {
    configurable: true,
    value: window,
    writable: true,
  });
}

if (typeof Object.fromEntries !== 'function') {
  Object.defineProperty(Object, 'fromEntries', {
    configurable: true,
    value(entries: Iterable<readonly [PropertyKey, unknown]>) {
      const result: Record<PropertyKey, unknown> = {};
      for (const [key, value] of entries) result[key] = value;
      return result;
    },
    writable: true,
  });
}

if (typeof Array.prototype.flat !== 'function') {
  Object.defineProperty(Array.prototype, 'flat', {
    configurable: true,
    value(this: unknown[], depth = 1) {
      const flatten = (items: unknown[], remaining: number): unknown[] => items.reduce<unknown[]>(
        (result, item) => result.concat(Array.isArray(item) && remaining > 0
          ? flatten(item, remaining - 1)
          : item),
        [],
      );
      return flatten(this, Math.max(0, Number(depth) || 0));
    },
    writable: true,
  });
}

if (typeof Array.prototype.flatMap !== 'function') {
  Object.defineProperty(Array.prototype, 'flatMap', {
    configurable: true,
    value<T, U>(
      this: T[],
      callback: (value: T, index: number, array: T[]) => U | readonly U[],
      thisArg?: unknown,
    ) {
      return this.map(callback, thisArg).reduce<U[]>(
        (result, item) => result.concat(item as U | readonly U[]),
        [],
      );
    },
    writable: true,
  });
}

type CompatibleCreateImageBitmap = ((...args: unknown[]) => Promise<ImageBitmap>) & {
  __cybergridCompatible?: boolean;
};

function imageSourceDimensions(source: CanvasImageSource): { width: number; height: number } {
  if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) {
    return { width: source.naturalWidth || source.width, height: source.naturalHeight || source.height };
  }
  if (typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement) {
    return { width: source.videoWidth || source.width, height: source.videoHeight || source.height };
  }
  const sized = source as CanvasImageSource & { width?: number; height?: number };
  return {
    width: Math.max(1, Number(sized.width) || 1),
    height: Math.max(1, Number(sized.height) || 1),
  };
}

async function canvasBackedImageBitmap(...args: unknown[]): Promise<ImageBitmap> {
  const source = args[0] as CanvasImageSource;
  const dimensions = imageSourceDimensions(source);
  const cropped = args.length >= 5;
  const sourceX = cropped ? Number(args[1]) || 0 : 0;
  const sourceY = cropped ? Number(args[2]) || 0 : 0;
  const sourceWidth = cropped ? Math.max(1, Number(args[3]) || 1) : dimensions.width;
  const sourceHeight = cropped ? Math.max(1, Number(args[4]) || 1) : dimensions.height;
  const canvas = document.createElement('canvas');
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Safari could not create an image canvas.');
  context.drawImage(
    source,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    sourceWidth,
    sourceHeight,
  );
  Object.defineProperty(canvas, 'close', {
    configurable: true,
    value() {
      canvas.width = 1;
      canvas.height = 1;
    },
  });
  return canvas as unknown as ImageBitmap;
}

if (typeof window !== 'undefined') {
  const current = window.createImageBitmap as CompatibleCreateImageBitmap | undefined;
  if (!current?.__cybergridCompatible) {
    const native = typeof current === 'function'
      ? current.bind(window) as CompatibleCreateImageBitmap
      : null;
    const compatible: CompatibleCreateImageBitmap = async (...args: unknown[]) => {
      if (native) {
        try {
          return await native(...args);
        } catch {
          // Some iOS Safari releases expose createImageBitmap but reject image
          // and canvas inputs. Fall through to a canvas-backed bitmap.
        }
      }
      return canvasBackedImageBitmap(...args);
    };
    compatible.__cybergridCompatible = true;
    try {
      window.createImageBitmap = compatible as typeof window.createImageBitmap;
    } catch {
      Object.defineProperty(window, 'createImageBitmap', {
        configurable: true,
        value: compatible,
        writable: true,
      });
    }
  }
}

/* CanvasRenderingContext2D.roundRect arrived part-way through the iOS 15
 * lifecycle. CyberGrid uses only a single numeric radius, so this compact
 * path-compatible fallback keeps its procedural actors visible on earlier
 * iOS 15 Safari builds. */
if (typeof CanvasRenderingContext2D !== 'undefined'
  && typeof CanvasRenderingContext2D.prototype.roundRect !== 'function') {
  CanvasRenderingContext2D.prototype.roundRect = function roundRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radii: number | DOMPointInit | Iterable<number | DOMPointInit> = 0,
  ): CanvasRenderingContext2D {
    const requested = typeof radii === 'number'
      ? radii
      : (Symbol.iterator in Object(radii)
        ? Number(Array.from(radii as Iterable<number | DOMPointInit>)[0] ?? 0)
        : Number((radii as DOMPointInit).x ?? 0));
    const radius = Math.max(0, Math.min(Math.abs(width) / 2, Math.abs(height) / 2, requested));
    const right = x + width;
    const bottom = y + height;
    const left = Math.min(x, right);
    const top = Math.min(y, bottom);
    const normalizedRight = Math.max(x, right);
    const normalizedBottom = Math.max(y, bottom);

    this.moveTo(left + radius, top);
    this.lineTo(normalizedRight - radius, top);
    this.quadraticCurveTo(normalizedRight, top, normalizedRight, top + radius);
    this.lineTo(normalizedRight, normalizedBottom - radius);
    this.quadraticCurveTo(
      normalizedRight,
      normalizedBottom,
      normalizedRight - radius,
      normalizedBottom,
    );
    this.lineTo(left + radius, normalizedBottom);
    this.quadraticCurveTo(left, normalizedBottom, left, normalizedBottom - radius);
    this.lineTo(left, top + radius);
    this.quadraticCurveTo(left, top, left + radius, top);
    this.closePath();
    return this;
  };
}
