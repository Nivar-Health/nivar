/* Swipe down to close (spec §5.11, mobile addendum M6). Touch and pen only, on the drag handle and
   the header, which carry touch-action: none so every pointermove reaches us and Android's
   pull-to-refresh never starts. The sheet follows the finger 1:1 downward and with a ×0.3 rubber
   band upward; the caller decides on release (past 120px or 800 px/s closes). */

export type SwipeHandlers = {
  /** Read on every press: off while a session is active or the pulse pad is armed. */
  enabled(): boolean;
  move(offset: number): void;
  /** Released, or cancelled by the browser (speed 0 then). Speed is downward, in px/s. */
  end(offset: number, speed: number): void;
};

/** Movement before a press becomes a drag, so taps on Close and Sound still work. */
const SLOP = 6;
/** Speed is measured over the last 100ms of movement. */
const WINDOW_MS = 100;

export function attachSwipe(zone: HTMLElement, handlers: SwipeHandlers): () => void {
  let pointer = -1;
  let startX = 0;
  let startY = 0;
  let offset = 0;
  let dragging = false;
  let swallowClick = false;
  let samples: { t: number; y: number }[] = [];

  const reset = () => {
    pointer = -1;
    dragging = false;
  };

  const onDown = (e: PointerEvent) => {
    // Any new press ends the swallow, even one the swipe ignores (during a session): only the click
    // that trails a drag, which has no press of its own, is eaten.
    swallowClick = false;
    if (pointer !== -1 || !e.isPrimary || e.pointerType === "mouse" || !handlers.enabled()) return;
    pointer = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    offset = 0;
    dragging = false;
    samples = [{ t: e.timeStamp, y: e.clientY }];
  };

  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== pointer) return;
    const dy = e.clientY - startY;
    if (!dragging) {
      if (Math.abs(dy) < SLOP || Math.abs(dy) < Math.abs(e.clientX - startX)) return;
      dragging = true;
      try {
        zone.setPointerCapture(pointer);
      } catch {
        // The pointer already ended.
      }
    }
    samples.push({ t: e.timeStamp, y: e.clientY });
    while (samples.length > 2 && e.timeStamp - samples[0].t > WINDOW_MS) samples.shift();
    offset = dy > 0 ? dy : dy * 0.3;
    handlers.move(offset);
  };

  const finish = (e: PointerEvent, cancelled: boolean) => {
    if (e.pointerId !== pointer) return;
    const wasDragging = dragging;
    reset();
    if (!wasDragging) return;
    swallowClick = true;
    const first = samples[0];
    const last = samples[samples.length - 1];
    const dt = last.t - first.t;
    const speed = cancelled || dt <= 0 ? 0 : ((last.y - first.y) / dt) * 1000;
    handlers.end(offset, speed);
  };
  const onUp = (e: PointerEvent) => finish(e, false);
  const onCancel = (e: PointerEvent) => finish(e, true);

  // A drag that started on Close or Sound must not also press it.
  const onClick = (e: MouseEvent) => {
    if (!swallowClick) return;
    swallowClick = false;
    e.preventDefault();
    e.stopPropagation();
  };

  zone.addEventListener("pointerdown", onDown);
  zone.addEventListener("pointermove", onMove);
  zone.addEventListener("pointerup", onUp);
  zone.addEventListener("pointercancel", onCancel);
  zone.addEventListener("click", onClick, true);
  return () => {
    zone.removeEventListener("pointerdown", onDown);
    zone.removeEventListener("pointermove", onMove);
    zone.removeEventListener("pointerup", onUp);
    zone.removeEventListener("pointercancel", onCancel);
    zone.removeEventListener("click", onClick, true);
  };
}
