import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  cubicBezier, motionDistances, motionDurations, motionEasings, motionSprings, motionStagger,
  springPosition, springSettleDuration, springToLinearEasing, staggerDelay, type Spring,
} from "./motion";

// Line endings depend on the checkout (Git on Windows may write CRLF).
const stylesheet = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8").replaceAll("\r\n", "\n");

/** Custom property declarations inside the first block that starts with `opening`. */
function declarationsIn(opening: string): Map<string, string> {
  const start = stylesheet.indexOf(opening);
  if (start === -1) throw new Error(`globals.css has no block starting with "${opening}"`);
  const block = stylesheet.slice(start, stylesheet.indexOf("\n}", start));
  const declarations = new Map<string, string>();
  for (const [, name = "", value = ""] of block.matchAll(/(--[\w-]+):\s*([^;]+);/g)) declarations.set(name, value.trim());
  return declarations;
}

const rootTokens = declarationsIn(":root {");
const themeTokens = declarationsIn("@theme {");
const reducedMotionTokens = declarationsIn("@media (prefers-reduced-motion: reduce) {\n  :root {");

describe("CSS motion tokens match the typed module", () => {
  it.each(Object.entries(motionDurations))("--duration-%s is %i ms", (name, milliseconds) => {
    expect(rootTokens.get(`--duration-${name}`)).toBe(`${milliseconds}ms`);
  });

  it.each(Object.entries(motionEasings))("--ease-%s is the same cubic Bézier", (name, points) => {
    expect(themeTokens.get(`--ease-${name}`)).toBe(cubicBezier(points));
  });

  it.each(Object.entries(motionSprings))("the %s spring has the same CSS curve and duration", (name, spring) => {
    expect(themeTokens.get(`--ease-spring-${name}`)).toBe(springToLinearEasing(spring));
    expect(rootTokens.get(`--duration-spring-${name}`)).toBe(`${springSettleDuration(spring)}ms`);
  });

  it("has the same stagger intervals", () => {
    expect(rootTokens.get("--stagger-tight")).toBe(`${motionStagger.tight}ms`);
    expect(rootTokens.get("--stagger-base")).toBe(`${motionStagger.base}ms`);
    expect(rootTokens.get("--stagger-max-total")).toBe(`${motionStagger.maxTotal}ms`);
  });

  it.each(Object.entries(motionDistances))("--motion-distance-%s is %i px and 0 with reduced motion", (name, pixels) => {
    expect(rootTokens.get(`--motion-distance-${name}`)).toBe(`${pixels}px`);
    expect(reducedMotionTokens.get(`--motion-distance-${name}`)).toBe("0px");
  });
});

describe("motion scales", () => {
  it("keeps durations ordered and within the longest allowed time", () => {
    const durations = Object.values(motionDurations);
    expect(durations).toEqual([...durations].sort((a, b) => a - b));
    expect(Math.max(...durations)).toBe(720);
  });

  it("keeps distances on the 4px rhythm", () => {
    for (const pixels of Object.values(motionDistances)) expect(pixels % 4).toBe(0);
  });
});

describe("staggerDelay", () => {
  it("spaces items by the interval", () => {
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(3)).toBe(120);
    expect(staggerDelay(2, motionStagger.base)).toBe(160);
  });

  it("caps the delay so no sequence runs past the maximum total", () => {
    expect(staggerDelay(10)).toBe(400);
    expect(staggerDelay(100, motionStagger.base)).toBe(400);
  });

  it("treats a negative index as the first item", () => {
    expect(staggerDelay(-2)).toBe(0);
  });
});

describe("springs", () => {
  function peak(spring: Spring): number {
    let highest = 0;
    for (let seconds = 0; seconds <= 2; seconds += 0.001) highest = Math.max(highest, springPosition(spring, seconds));
    return highest;
  }

  it.each(Object.entries(motionSprings))("the %s spring starts at rest and settles at 1", (_, spring) => {
    expect(springPosition(spring, 0)).toBeCloseTo(0, 10);
    expect(springPosition(spring, springSettleDuration(spring) / 1000)).toBeCloseTo(1, 2);
  });

  it("the calm spring never overshoots", () => {
    expect(peak(motionSprings.calm)).toBeLessThanOrEqual(1);
  });

  it("the expressive spring overshoots by at most 3%", () => {
    expect(peak(motionSprings.expressive)).toBeGreaterThan(1);
    expect(peak(motionSprings.expressive)).toBeLessThanOrEqual(1.03);
  });

  it("both springs settle within the longest allowed duration", () => {
    for (const spring of Object.values(motionSprings)) {
      expect(springSettleDuration(spring)).toBeLessThanOrEqual(motionDurations.deliberate);
    }
  });

  it("handles an overdamped spring without overshoot", () => {
    const overdamped = { stiffness: 100, damping: 40, mass: 1 };
    expect(springPosition(overdamped, 0)).toBeCloseTo(0, 10);
    expect(peak(overdamped)).toBeLessThanOrEqual(1);
    expect(springToLinearEasing(overdamped)).toMatch(/^linear\(0, .*, 1\)$/);
  });
});
