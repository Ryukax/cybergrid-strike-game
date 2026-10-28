import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import {
  tryReleasePointerCapture,
  trySetPointerCapture,
} from '../game/browser-compat';

export type HudLayoutRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Props = {
  label: string;
  rect: HudLayoutRect;
  editing: boolean;
  children: ReactNode;
  onChange: (rect: HudLayoutRect) => void;
  minWidth?: number;
  minHeight?: number;
  /** Expose the corner grip outside HUD-edit mode. */
  resizable?: boolean;
};

export function HudLayoutItem({
  label,
  rect,
  editing,
  children,
  onChange,
  minWidth = 112,
  minHeight = 38,
  resizable = false,
}: Props) {
  const itemRef = useRef<HTMLDivElement>(null);
  const rectRef = useRef(rect);
  const interactionCleanupRef = useRef<(() => void) | null>(null);
  rectRef.current = rect;

  useEffect(() => () => interactionCleanupRef.current?.(), []);

  const constrainedSize = (
    width: number,
    height: number,
    bounds: DOMRect,
  ): Pick<HudLayoutRect, 'width' | 'height'> => {
    const anchor = rectRef.current;
    const availableWidth = Math.max(1, bounds.width - anchor.x * bounds.width);
    const availableHeight = Math.max(1, bounds.height - anchor.y * bounds.height);
    return {
      width: Math.max(Math.min(minWidth, availableWidth), Math.min(availableWidth, width)),
      height: Math.max(Math.min(minHeight, availableHeight), Math.min(availableHeight, height)),
    };
  };

  const beginInteraction = (
    event: ReactPointerEvent<HTMLElement>,
    mode: 'move' | 'resize',
  ) => {
    if (mode === 'move' ? !editing : !(editing || resizable)) return;
    event.preventDefault();
    event.stopPropagation();
    const item = itemRef.current;
    const game = item?.closest<HTMLElement>('#game');
    if (!item || !game) return;

    const bounds = game.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const start = { ...rectRef.current };
    const pointerId = event.pointerId;
    const captureTarget = event.currentTarget;
    interactionCleanupRef.current?.();
    trySetPointerCapture(captureTarget, pointerId);

    const previewRect = (nextRect: HudLayoutRect) => {
      rectRef.current = nextRect;
      // Keep pointer tracking entirely inside this element. Re-rendering the
      // 17k-line Game tree and synchronously persisting localStorage for every
      // raw pointermove made Action Window resizing stall combat.
      item.style.left = `${nextRect.x * 100}%`;
      item.style.top = `${nextRect.y * 100}%`;
      item.style.width = `${nextRect.width}px`;
      item.style.height = `${nextRect.height}px`;
    };

    const move = (nextEvent: PointerEvent) => {
      if (nextEvent.pointerId !== pointerId) return;
      const dx = nextEvent.clientX - startX;
      const dy = nextEvent.clientY - startY;
      if (mode === 'resize') {
        const nextRect = {
          ...start,
          ...constrainedSize(start.width + dx, start.height + dy, bounds),
        };
        previewRect(nextRect);
        return;
      }

      const maxX = Math.max(0, 1 - start.width / bounds.width);
      const maxY = Math.max(0, 1 - start.height / bounds.height);
      const nextRect = {
        ...start,
        x: Math.max(0, Math.min(maxX, start.x + dx / bounds.width)),
        y: Math.max(0, Math.min(maxY, start.y + dy / bounds.height)),
      };
      previewRect(nextRect);
    };
    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      captureTarget.removeEventListener('lostpointercapture', finish);
      tryReleasePointerCapture(captureTarget, pointerId);
      if (interactionCleanupRef.current === cleanup) {
        interactionCleanupRef.current = null;
      }
    };
    function finish(nextEvent: PointerEvent) {
      if (nextEvent.pointerId !== pointerId) return;
      onChange(rectRef.current);
      cleanup();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    captureTarget.addEventListener('lostpointercapture', finish);
    interactionCleanupRef.current = cleanup;
  };

  const resizeWithKeyboard = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!(editing || resizable)) return;
    const item = itemRef.current;
    const game = item?.closest<HTMLElement>('#game');
    if (!game) return;
    const amount = event.shiftKey ? 32 : 12;
    const delta = {
      ArrowLeft: { width: -amount, height: 0 },
      ArrowRight: { width: amount, height: 0 },
      ArrowUp: { width: 0, height: -amount },
      ArrowDown: { width: 0, height: amount },
    }[event.key];
    if (!delta) return;
    event.preventDefault();
    event.stopPropagation();
    const currentRect = rectRef.current;
    const nextRect = {
      ...currentRect,
      ...constrainedSize(
        currentRect.width + delta.width,
        currentRect.height + delta.height,
        game.getBoundingClientRect(),
      ),
    };
    rectRef.current = nextRect;
    onChange(nextRect);
  };

  return (
    <div
      ref={itemRef}
      className={`hudLayoutItem${editing ? ' editing' : ''}${resizable ? ' resizable' : ''}`}
      style={{
        left: `${rect.x * 100}%`,
        top: `${rect.y * 100}%`,
        width: rect.width,
        height: rect.height,
      }}
      data-layout-label={label}
      data-resizable={resizable || undefined}
      onPointerDown={(event) => beginInteraction(event, 'move')}
    >
      <div className="hudLayoutContent">{children}</div>
      {(editing || resizable) && (
        <>
          {editing && <span className="hudLayoutLabel">{label}</span>}
          <button
            type="button"
            className="hudResizeHandle"
            aria-label={`Resize ${label}`}
            onPointerDown={(event) => beginInteraction(event, 'resize')}
            onKeyDown={resizeWithKeyboard}
            title={`Resize ${label}`}
          />
        </>
      )}
    </div>
  );
}
