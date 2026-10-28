export interface BrowserStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Safari may expose Web Storage while throwing SecurityError when it is used
 * (private/restricted browsing and some home-screen contexts). Keep the game
 * playable with an in-memory session fallback instead of failing during React
 * render.
 */
export function createSafeStorage(
  resolveStorage: () => BrowserStorage | null | undefined,
): BrowserStorage {
  const fallback = new Map<string, string>();

  return {
    getItem(key) {
      try {
        const value = resolveStorage()?.getItem(key) ?? null;
        return value ?? fallback.get(key) ?? null;
      } catch {
        return fallback.get(key) ?? null;
      }
    },
    setItem(key, value) {
      fallback.set(key, value);
      try {
        resolveStorage()?.setItem(key, value);
      } catch {
        // The in-memory copy remains available for this page session.
      }
    },
    removeItem(key) {
      fallback.delete(key);
      try {
        resolveStorage()?.removeItem(key);
      } catch {
        // Restricted storage is already effectively empty to this page.
      }
    },
  };
}

export const safeLocalStorage = createSafeStorage(() => {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
});

type CompatibleMediaQueryList = Pick<MediaQueryList, 'matches'> & Partial<
  Pick<MediaQueryList, 'addEventListener' | 'removeEventListener' | 'addListener' | 'removeListener'>
>;

/** Supports both current Safari and its legacy MediaQueryList listener API. */
export function subscribeMediaQueryChange(
  query: CompatibleMediaQueryList,
  listener: () => void,
): () => void {
  if (typeof query.addEventListener === 'function') {
    const eventListener = listener as EventListener;
    query.addEventListener('change', eventListener);
    return () => query.removeEventListener?.('change', eventListener);
  }
  if (typeof query.addListener === 'function') {
    const legacyListener = listener as (event: MediaQueryListEvent) => void;
    query.addListener(legacyListener);
    return () => query.removeListener?.(legacyListener);
  }
  return () => undefined;
}

interface PointerCaptureTarget {
  setPointerCapture?: (pointerId: number) => void;
  hasPointerCapture?: (pointerId: number) => boolean;
  releasePointerCapture?: (pointerId: number) => void;
}

export function trySetPointerCapture(target: PointerCaptureTarget, pointerId: number): boolean {
  try {
    if (typeof target.setPointerCapture !== 'function') return false;
    target.setPointerCapture(pointerId);
    return true;
  } catch {
    return false;
  }
}

export function tryReleasePointerCapture(target: PointerCaptureTarget, pointerId: number): void {
  try {
    if (typeof target.releasePointerCapture !== 'function') return;
    if (typeof target.hasPointerCapture === 'function' && !target.hasPointerCapture(pointerId)) return;
    target.releasePointerCapture(pointerId);
  } catch {
    // Pointer capture can be lost implicitly during iOS gesture cancellation.
  }
}

interface BrowserViewportSource {
  innerWidth: number;
  innerHeight: number;
  visualViewport?: { width: number; height: number } | null;
}

export function readBrowserViewport(
  source: BrowserViewportSource = window,
): { width: number; height: number } {
  const visualWidth = source.visualViewport?.width;
  const visualHeight = source.visualViewport?.height;
  const width = Number.isFinite(visualWidth) && Number(visualWidth) > 0
    ? Number(visualWidth)
    : source.innerWidth;
  const height = Number.isFinite(visualHeight) && Number(visualHeight) > 0
    ? Number(visualHeight)
    : source.innerHeight;
  return {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  };
}

export function cloneBrowserValue<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}
