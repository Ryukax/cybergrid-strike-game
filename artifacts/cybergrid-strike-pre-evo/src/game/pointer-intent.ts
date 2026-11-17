export const POINTER_INTENT_TRAVEL_LIMIT_PX = 10;
export const POINTER_INTENT_MOUSE_HOLD_DELAY_MS = 260;

export type PointerIntentSample = Readonly<{
  pointerId: number;
  pointerType: string;
  clientX: number;
  clientY: number;
  atMs: number;
}>;

export type PointerIntent = Readonly<{
  pointerId: number;
  pointerType: string;
  originX: number;
  originY: number;
  armedAtMs: number;
  maxTravelPx: number;
  cancelled: boolean;
  committed: boolean;
  immediateContact: boolean;
}>;

function normalizedPointerType(pointerType: string): string {
  return pointerType.trim().toLowerCase();
}

function pointerTravelPx(intent: PointerIntent, sample: PointerIntentSample): number {
  return Math.hypot(
    sample.clientX - intent.originX,
    sample.clientY - intent.originY,
  );
}

function matchingPointer(intent: PointerIntent, sample: PointerIntentSample): boolean {
  return intent.pointerId === sample.pointerId;
}

/**
 * Touch and pen controls preserve their direct-contact response. Mouse-shaped
 * input waits for release because Steam Input reports a Deck trackpad Touch
 * Binding as an ordinary trusted mouse press; the browser cannot distinguish
 * that synthetic contact from a physical mouse button.
 */
export function beginPointerIntent(sample: PointerIntentSample): PointerIntent {
  const pointerType = normalizedPointerType(sample.pointerType);
  return {
    pointerId: sample.pointerId,
    pointerType,
    originX: sample.clientX,
    originY: sample.clientY,
    armedAtMs: sample.atMs,
    maxTravelPx: 0,
    cancelled: false,
    committed: false,
    immediateContact: pointerType === 'touch' || pointerType === 'pen',
  };
}

export function updatePointerIntent(
  intent: PointerIntent,
  sample: PointerIntentSample,
  travelLimitPx = POINTER_INTENT_TRAVEL_LIMIT_PX,
): PointerIntent {
  if (!matchingPointer(intent, sample) || intent.cancelled || intent.committed) {
    return intent;
  }
  const maxTravelPx = Math.max(intent.maxTravelPx, pointerTravelPx(intent, sample));
  return {
    ...intent,
    maxTravelPx,
    cancelled: maxTravelPx > travelLimitPx,
  };
}

export function cancelPointerIntent(intent: PointerIntent): PointerIntent {
  if (intent.cancelled) return intent;
  return { ...intent, cancelled: true };
}

export function commitPointerIntent(intent: PointerIntent): PointerIntent {
  if (intent.committed) return intent;
  return { ...intent, committed: true };
}

export function shouldCommitPointerOnRelease(
  intent: PointerIntent,
  sample: PointerIntentSample,
  travelLimitPx = POINTER_INTENT_TRAVEL_LIMIT_PX,
): boolean {
  if (!matchingPointer(intent, sample)
    || intent.immediateContact
    || intent.cancelled
    || intent.committed) {
    return false;
  }
  return Math.max(intent.maxTravelPx, pointerTravelPx(intent, sample)) <= travelLimitPx;
}

/**
 * Hold-capable mouse controls may start only after a stationary dwell. A move,
 * cancel, lost capture, prior immediate touch/pen activation, or completed tap
 * prevents the hold from starting. Consumers mark the intent committed once
 * the hold begins so pointerup cannot emit a second tap.
 */
export function shouldBeginPointerHold(
  intent: PointerIntent,
  nowMs: number,
  delayMs = POINTER_INTENT_MOUSE_HOLD_DELAY_MS,
  travelLimitPx = POINTER_INTENT_TRAVEL_LIMIT_PX,
): boolean {
  if (intent.immediateContact
    || intent.cancelled
    || intent.committed
    || intent.maxTravelPx > travelLimitPx) {
    return false;
  }
  return Number.isFinite(nowMs)
    && nowMs - intent.armedAtMs >= Math.max(0, delayMs);
}
