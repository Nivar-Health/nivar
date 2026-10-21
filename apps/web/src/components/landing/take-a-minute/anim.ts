import { animateValue, styleEffect, type MotionValue } from "motion";

/* The choreography's moves (spec §5.8), on motion's low-level API: motion values, animateValue and
   styleEffect. The same spring and tween engine as motion/react's animate(), about 18 kB gzip
   lighter for the lazy chunk (LazyMotion, m and animate() cost 28 kB together).

   Springs take visualDuration and bounce like animate(), converted to stiffness and damping with
   motion's own formula: motion drops the starting velocity of a duration-based spring, and a
   retarget (Esc mid-opening) must keep it, so the orb turns around instead of stopping dead. */

export type Playback = { stop(): void; finished: Promise<unknown> };
export type Ease = readonly [number, number, number, number] | "linear" | "easeIn" | "easeOut" | "easeInOut";

const live = new WeakMap<MotionValue<number>, Playback>();

function start(value: MotionValue<number>, options: Record<string, unknown>): Playback {
  live.get(value)?.stop();
  const playback = animateValue<number>({
    ...options,
    keyframes: options.keyframes as number[],
    onUpdate: (v: number) => value.set(v),
  });
  live.set(value, playback);
  return playback;
}

/** A spring from the value's current position and velocity. Seconds, like animate(). */
export function spring(
  value: MotionValue<number>,
  to: number,
  visualDuration: number,
  bounce = 0,
  o: { delay?: number; velocity?: number } = {},
): Playback {
  const root = (2 * Math.PI) / (visualDuration * 1.2);
  const stiffness = root * root;
  return start(value, {
    keyframes: [value.get(), to],
    type: "spring",
    stiffness,
    damping: 2 * Math.min(1, Math.max(0.05, 1 - bounce)) * Math.sqrt(stiffness),
    mass: 1,
    velocity: o.velocity ?? value.getVelocity(),
    delay: (o.delay ?? 0) * 1000,
  });
}

/** An eased tween from the current value (or through keyframes). Seconds. */
export function tween(
  value: MotionValue<number>,
  to: number | number[],
  duration: number,
  ease: Ease = "easeOut",
  o: { delay?: number; times?: number[] } = {},
): Playback {
  return start(value, {
    keyframes: Array.isArray(to) ? to : [value.get(), to],
    duration: duration * 1000,
    ease,
    times: o.times,
    delay: (o.delay ?? 0) * 1000,
  });
}

/** Stops whatever is animating these values (unmount). */
export function stopAll(values: Iterable<MotionValue<number>>): void {
  for (const value of values) live.get(value)?.stop();
}

/** A ref callback that binds motion values to an element's style, written in motion's frame loop. */
export function bindStyle(
  values: Record<string, MotionValue<number>>,
): (el: HTMLElement | SVGElement | null) => (() => void) | undefined {
  return (el) => (el ? styleEffect(el, values) : undefined);
}
