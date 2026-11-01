import { useEffect, useRef } from 'react';

/** Image-local pinch zoom and drag; never changes browser page scale. */
export function bindPlanTouchGestures(
  viewport: HTMLElement,
  getZoom: () => number,
  setZoom: (zoom: number) => void,
) {
  const points = new Map<number, {x: number; y: number}>();
  let startDistance = 0;
  let startZoom = 1;
  let moved = false;
  const distance = () => {
    const [a, b] = [...points.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  const down = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') return;
    if (!points.size) moved = false;
    points.set(event.pointerId, {x: event.clientX, y: event.clientY});
    if (points.size === 2) {startDistance = distance(); startZoom = getZoom(); moved = true;}
  };
  const move = (event: PointerEvent) => {
    const previous = points.get(event.pointerId);
    if (!previous) return;
    const dx = previous.x - event.clientX;
    const dy = previous.y - event.clientY;
    points.set(event.pointerId, {x: event.clientX, y: event.clientY});
    if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
    if (points.size >= 2 && startDistance > 0) {
      event.preventDefault();
      setZoom(Math.max(1, Math.min(2.5, startZoom * distance() / startDistance)));
    } else if (getZoom() > 1) {
      event.preventDefault();
      viewport.scrollLeft += dx;
      viewport.scrollTop += dy;
    } else {
      // At fit size, a one-finger swipe continues to scroll the page.
      viewport.ownerDocument.defaultView?.scrollBy(0, dy);
    }
  };
  const up = (event: PointerEvent) => {points.delete(event.pointerId); if (points.size < 2) startDistance = 0;};
  const click = (event: MouseEvent) => {
    if (moved) {event.preventDefault(); event.stopPropagation(); moved = false;}
  };
  viewport.addEventListener('pointerdown', down);
  viewport.addEventListener('pointermove', move, {passive: false});
  viewport.addEventListener('pointerup', up);
  viewport.addEventListener('pointercancel', up);
  viewport.addEventListener('click', click, true);
  return () => {
    viewport.removeEventListener('pointerdown', down);
    viewport.removeEventListener('pointermove', move);
    viewport.removeEventListener('pointerup', up);
    viewport.removeEventListener('pointercancel', up);
    viewport.removeEventListener('click', click, true);
    points.clear();
  };
}

export function usePlanTouchGestures(
  ref: {current: HTMLElement | null}, zoom: number,
  onZoom: ((zoom: number) => void) | undefined, attachmentKey: string,
) {
  const current = useRef({zoom, onZoom});
  current.current = {zoom, onZoom};
  useEffect(() => {
    if (!ref.current || !current.current.onZoom) return;
    return bindPlanTouchGestures(ref.current, () => current.current.zoom,
      value => {current.current.zoom = value; current.current.onZoom?.(value);});
  }, [ref, attachmentKey, !!onZoom]);
}
