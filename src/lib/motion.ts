/**
 * The BG Matura motion vocabulary for scripted motion. The same values exist as CSS custom
 * properties in `src/app/globals.css`, and `motion.test.ts` fails if the two drift apart.
 * The rules for using them (who may move, in which order, where expressive motion is allowed,
 * and the reduced-motion policy) are in `.claude/DESIGN.md`, section 10.
 */

/** Durations in milliseconds. Prefer the shortest one that still reads as motion. */
export const motionDurations = {
  /** Hover, press, and focus feedback on controls. */
  fast: 120,
  /** Small state changes: a menu opening, an answer becoming selected. */
  base: 200,
  /** Panels and content that enters the page. */
  moderate: 320,
  /** Showcase entrances on public pages. Never on practice or exam screens. */
  slow: 480,
  /** The longest allowed time-based animation. Showcase only. */
  deliberate: 720,
} as const;

/** Cubic Bézier easings as `[x1, y1, x2, y2]`, ready for the Web Animations API or Motion. */
export const motionEasings = {
  /** Something changes state in place. */
  standard: [0.2, 0, 0, 1],
  /** Something arrives: quick start, long soft landing. */
  enter: [0.16, 1, 0.3, 1],
  /** Something leaves: gathers speed, then gets out of the way. */
  exit: [0.7, 0, 0.84, 0],
} as const satisfies Record<string, readonly [number, number, number, number]>;

/** Delay between items that enter one after another, in milliseconds. */
export const motionStagger = {
  /** Items in a list or grid. */
  tight: 40,
  /** A handful of large blocks, such as showcase cards. */
  base: 80,
  /** No sequence may take longer than this from the first item to the last. */
  maxTotal: 400,
} as const;

/** Travel distances in pixels, on the 4px spacing rhythm. They collapse to 0 with reduced motion. */
export const motionDistances = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 32,
  /** Showcase only. */
  xl: 64,
} as const;

export type Spring = { stiffness: number; damping: number; mass: number };

export const motionSprings = {
  /** Critically damped: settles without overshoot. The default for anything a student touches. */
  calm: { stiffness: 169, damping: 26, mass: 1 },
  /** About 3% overshoot. Showcase surfaces only. */
  expressive: { stiffness: 196, damping: 21, mass: 1 },
} as const satisfies Record<string, Spring>;

/** Delay for the item at `index` in a sequence, capped so the whole sequence stays within `maxTotal`. */
export function staggerDelay(index: number, interval: number = motionStagger.tight): number {
  return Math.min(Math.max(0, index) * interval, motionStagger.maxTotal);
}

export function cubicBezier([x1, y1, x2, y2]: readonly [number, number, number, number]): string {
  return `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;
}

const settleTolerance = 0.001;
const springSampleCount = 24;

/** Position of a spring released from 0 towards 1 at rest, after `seconds`. */
export function springPosition({ stiffness, damping, mass }: Spring, seconds: number): number {
  const undampedFrequency = Math.sqrt(stiffness / mass);
  const dampingRatio = damping / (2 * Math.sqrt(stiffness * mass));
  const decay = Math.exp(-dampingRatio * undampedFrequency * seconds);
  if (dampingRatio < 1) {
    const dampedFrequency = undampedFrequency * Math.sqrt(1 - dampingRatio * dampingRatio);
    return 1 - decay * (Math.cos(dampedFrequency * seconds)
      + (dampingRatio * undampedFrequency / dampedFrequency) * Math.sin(dampedFrequency * seconds));
  }
  if (dampingRatio === 1) {
    return 1 - decay * (1 + undampedFrequency * seconds);
  }
  const root = undampedFrequency * Math.sqrt(dampingRatio * dampingRatio - 1);
  const slow = -dampingRatio * undampedFrequency + root;
  const fast = -dampingRatio * undampedFrequency - root;
  return 1 - (fast * Math.exp(slow * seconds) - slow * Math.exp(fast * seconds)) / (fast - slow);
}

/** Time in milliseconds, rounded up to 10ms, after which the spring stays within 0.1% of rest. */
export function springSettleDuration(spring: Spring): number {
  const stepSeconds = 0.001;
  let lastUnsettled = 0;
  for (let seconds = 0; seconds <= 5; seconds += stepSeconds) {
    if (Math.abs(1 - springPosition(spring, seconds)) > settleTolerance) lastUnsettled = seconds;
  }
  return Math.ceil((lastUnsettled * 1000) / 10) * 10;
}

/**
 * The spring as a CSS `linear()` easing to use with `springSettleDuration`, so pure CSS can
 * follow the same curve that scripted motion uses.
 */
export function springToLinearEasing(spring: Spring): string {
  const durationSeconds = springSettleDuration(spring) / 1000;
  const points: string[] = [];
  for (let sample = 0; sample <= springSampleCount; sample += 1) {
    const position = sample === springSampleCount ? 1 : springPosition(spring, (durationSeconds * sample) / springSampleCount);
    points.push(String(Math.round(position * 1000) / 1000));
  }
  return `linear(${points.join(", ")})`;
}
