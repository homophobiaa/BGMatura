# Motion foundation

The rules for motion (tiers, tokens, choreography, reduced motion, budget) are in
[.claude/DESIGN.md, section 10](../.claude/DESIGN.md#10-motion). This document records
**why the tooling was chosen**, what it costs, and **how to measure** the budget.

## Where it lives

| File | Owns |
| --- | --- |
| `src/app/globals.css` | Motion tokens as CSS custom properties: `--duration-*`, `--stagger-*`, `--motion-distance-*` (all 0 with reduced motion), and the Tailwind easing utilities `ease-standard`, `ease-enter`, `ease-exit`, `ease-spring-calm`, `ease-spring-expressive`. |
| `src/lib/motion.ts` | The same values typed for scripts, `staggerDelay()`, and the spring physics that generate the CSS `linear()` spring curves. |
| `src/lib/motion.test.ts` | Fails when the CSS tokens and the typed module drift apart, and checks the scales and springs. |
| `src/lib/reduced-motion.ts` | `usePrefersReducedMotion()`, `prefersReducedMotion()`, `subscribeToReducedMotion()`: the single reduced-motion check for scripts. |
| `src/test-support/match-media.ts` | A controllable `window.matchMedia` for jsdom component tests. |

Use the tokens in Tailwind classes with arbitrary values, for example
`transition-opacity duration-(--duration-base) ease-standard motion-reduce:transition-none`,
and in CSS with `var(--duration-moderate)` or `translate: 0 var(--motion-distance-md)`.

## Tooling decision (2026-11-03)

Measured with esbuild 0.28.2, minified, ESM, browser platform, React external, gzip level 6
(`zlib` default). Browser support is the first stable version that enables the feature by default
(caniuse and MDN release notes, checked 2026-11-03).

| Option | Version | Cost (min / gzip) | Support | Decision | Fallback |
| --- | --- | --- | --- | --- | --- |
| **CSS scroll-driven animations** (`animation-timeline: view()` / `scroll()`) | platform | 0 KB | Chrome and Edge 115, Safari 26 (macOS and iOS), Firefox 159 (released 2026-10-27), Samsung Internet 23; about 88% of global usage | **Adopted** for everything tied to scrolling. Runs without JavaScript and off the main thread for `transform` and `opacity`. | Guard with `@supports (animation-timeline: view())` and `@media (prefers-reduced-motion: no-preference)`; outside the guard the content is ordinary stacked, finished markup. |
| **CSS transitions, keyframes, `@starting-style`, `linear()` easing** | platform | 0 KB | `linear()`: Chrome 113, Safari 17.2, Firefox 112 | **Adopted** for state changes and entrances. | Unsupported easing or `@starting-style` falls back to the plain transition or to no entrance; content is unaffected. |
| **View Transitions API** (same document) | platform | 0 KB | Chrome and Edge 111, Safari 18, Firefox 144; about 93% | **Adopted** for page and state transitions (issue #183 and later). | Feature-detect `document.startViewTransition`; without it, or with reduced motion, the change happens instantly. |
| **Motion `animate()` from `motion/mini`** | motion 14.9.0 | 8.1 / **3.2 KB** | Uses the Web Animations API (all current browsers) | **Approved** for the rare case a script must drive an animation (interruptible sequences, values computed at runtime). Lazy-load it with `import()` on the route that needs it. | Without it or with reduced motion: the final state is shown. |
| Motion `animate()` + `scroll()` | motion 14.9.0 | 74.2 / 27.5 KB | — | Not adopted: CSS scroll-driven animations do the same job for 0 KB. | — |
| Motion for React (`motion.div`) | motion 14.9.0 | 130.2 / 44.2 KB | — | Not adopted: over the showcase budget, and React-rendered animation competes with the main thread. | — |
| Motion for React, `LazyMotion` + `m` + `domAnimation` | motion 14.9.0 | 82.1 / 29.9 KB | — | Not adopted: nearly the whole lazy budget for features CSS already has. | — |
| GSAP core | gsap 3.15.0 | 69.0 / 27.1 KB | — | Not adopted. | — |
| GSAP with ScrollTrigger | gsap 3.15.0 | 112.5 / 44.4 KB | — | Not adopted: over the 30 KB lazy cap, and its JavaScript pinning duplicates `position: sticky` plus scroll timelines. | — |
| Lenis (smooth scroll) | lenis 1.3.27 | 18.3 / 5.3 KB | — | **Rejected on principle.** It takes over wheel and touch scrolling, which breaks the rule that scrolling always belongs to the browser. The same applies to every smooth-scroll library. | — |

The measuring script is in this document's appendix so the numbers can be repeated for a
newer version before any of these choices is revisited.

### Consequences

- Scroll-driven scenes are built from `position: sticky` (pinning) and CSS scroll timelines
  (progress). No library computes scroll positions, so keyboard scrolling, anchors, find in page,
  and back/forward keep their native behaviour.
- About 12% of browsers (older Safari and Firefox, older Android WebViews) get the finished,
  stacked layout. That is the intended fallback, not a degraded experience.
- Pages stay Server Components unless they need interaction for other reasons; motion alone is not
  a reason to add `"use client"`.

## Measuring the budget

All measurements go into the pull request with the browser, viewport, and throttling used.
Report only what was measured. A screenshot cannot show smoothness: watch the motion itself.

### Frame rate

1. Chrome DevTools, Performance panel, CPU throttling **4× slowdown** (the mid-range-phone proxy;
   a real mid-range Android phone over remote debugging is better when available).
2. Record while scrolling through the motion with the wheel and with Page Down.
3. In the Frames track, dropped or partially presented frames are failures. The Main track should
   show no Layout or Paint work caused by the animation.

For a repeatable number without DevTools, paste this into the console; it scrolls the page by a fixed
step every frame and reports frame times:

```js
await (async () => {
  const gaps = []; let last = performance.now();
  const end = document.documentElement.scrollHeight - innerHeight;
  scrollTo(0, 0);
  while (scrollY < end - 1) {
    await new Promise(requestAnimationFrame);
    const now = performance.now(); gaps.push(now - last); last = now;
    scrollBy(0, 12);
  }
  gaps.sort((a, b) => a - b);
  const pick = (q) => gaps[Math.floor(q * (gaps.length - 1))].toFixed(1);
  return { frames: gaps.length, median: pick(0.5), p95: pick(0.95), max: pick(1), over16_7: gaps.filter((g) => g > 16.7).length };
})();
```

### Layout shift and Largest Contentful Paint

The console only opens after the page has loaded, so the observers use `buffered: true` to receive
the entries recorded before they existed. Paste this, then scroll through the page:

```js
window.__motionAudit = { cls: 0, lcp: null };
new PerformanceObserver((list) => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__motionAudit.cls += e.value; })
  .observe({ type: "layout-shift", buffered: true });
new PerformanceObserver((list) => { const e = list.getEntries().at(-1); window.__motionAudit.lcp = { time: e.startTime, element: e.element?.tagName }; })
  .observe({ type: "largest-contentful-paint", buffered: true });
// ...scroll through the page, then read window.__motionAudit
```

Lighthouse (mobile preset, median of three runs) before and after the change is the reference
for Largest Contentful Paint.

### Added JavaScript per route

Against a production build (`npm run build && npm run start`), load the route in a fresh tab and run:

```js
performance.getEntriesByType("resource").filter((r) => r.initiatorType === "script")
  .reduce((sum, r) => sum + r.transferSize, 0) / 1024;
```

`transferSize` is the compressed size over the network. Compare it with the same route on `main`.
For lazy chunks, repeat after the interaction that loads them.

## Appendix: bundle-cost script

Run in an empty folder outside the repository after
`npm i esbuild motion gsap lenis react react-dom`:

```js
// measure.mjs — node measure.mjs
import { build } from "esbuild";
import { gzipSync } from "node:zlib";

const cases = {
  "motion: animate() (mini)": `import { animate } from "motion/mini"; window.x = animate;`,
  "motion: animate() + scroll()": `import { animate, scroll } from "motion"; window.x = [animate, scroll];`,
  "motion/react: <motion.div>": `import { motion } from "motion/react"; window.x = motion.div;`,
  "motion/react: LazyMotion + m + domAnimation": `import { LazyMotion, m, domAnimation } from "motion/react"; window.x = [LazyMotion, m.div, domAnimation];`,
  "gsap core": `import { gsap } from "gsap"; window.x = gsap;`,
  "gsap + ScrollTrigger": `import { gsap } from "gsap"; import { ScrollTrigger } from "gsap/ScrollTrigger"; gsap.registerPlugin(ScrollTrigger); window.x = gsap;`,
  "lenis": `import Lenis from "lenis"; window.x = Lenis;`,
};

for (const [name, contents] of Object.entries(cases)) {
  const result = await build({
    stdin: { contents, resolveDir: process.cwd(), loader: "js" },
    bundle: true, minify: true, write: false, format: "esm", platform: "browser",
    external: ["react", "react-dom", "react/jsx-runtime"],
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const code = result.outputFiles[0].contents;
  console.log(name, (code.length / 1024).toFixed(1), "KB min", (gzipSync(code).length / 1024).toFixed(1), "KB gzip");
}
```
