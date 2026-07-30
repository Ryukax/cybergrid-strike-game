import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

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
};

export function HudLayoutItem({ label, rect, editing, children, onChange }: Props) {
  const itemRef = useRef<HTMLDivElement>(null);

  const beginInteraction = (
    event: ReactPointerEvent<HTMLDivElement>,
    mode: 'move' | 'resize',
  ) => {
    if (!editing) return;
    event.preventDefault();
    event.stopPropagation();
    const item = itemRef.current;
    const game = item?.closest<HTMLElement>('#game');
    if (!item || !game) return;

    const bounds = game.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const start = { ...rect };
    const pointerId = event.pointerId;
    event.currentTarget.setPointerCapture(pointerId);

    const move = (nextEvent: PointerEvent) => {
      if (nextEvent.pointerId !== pointerId) return;
      const dx = nextEvent.clientX - startX;
      const dy = nextEvent.clientY - startY;
      if (mode === 'resize') {
        onChange({
          ...start,
          width: Math.max(112, Math.min(bounds.width - start.x * bounds.width, start.width + dx)),
          height: Math.max(38, Math.min(bounds.height - start.y * bounds.height, start.height + dy)),
        });
        return;
      }

      const maxX = Math.max(0, 1 - start.width / bounds.width);
      const maxY = Math.max(0, 1 - start.height / bounds.height);
      onChange({
        ...start,
        x: Math.max(0, Math.min(maxX, start.x + dx / bounds.width)),
        y: Math.max(0, Math.min(maxY, start.y + dy / bounds.height)),
      });
    };
    const finish = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  };

  return (
    <div
      ref={itemRef}
      className={`hudLayoutItem${editing ? ' editing' : ''}`}
      style={{
        left: `${rect.x * 100}%`,
        top: `${rect.y * 100}%`,
        width: rect.width,
        height: rect.height,
      }}
      data-layout-label={label}
      onPointerDown={(event) => beginInteraction(event, 'move')}
    >
      <div className="hudLayoutContent">{children}</div>
      {editing && (
        <>
          <span className="hudLayoutLabel">{label}</span>
          <div
            className="hudResizeHandle"
            aria-label={`Resize ${label}`}
            onPointerDown={(event) => beginInteraction(event, 'resize')}
          />
        </>
      )}
    </div>
  );
}
