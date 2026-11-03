# Homepage scene sequence

> Issue #182. Follows the motion rules in [DESIGN.md section 10](../../.claude/DESIGN.md#10-motion) and the tooling decision in [MOTION.md](../MOTION.md). The homepage is a showcase surface.

## Where it lives

| File | Owns |
| --- | --- |
| `src/app/page.tsx` | Composes the sequence and the "Ясна обратна връзка" section. |
| `src/features/home/components/HomeSequence.tsx` | The five scenes as finished, readable markup (a Server Component, no client JavaScript). |
| `src/features/home/components/HomeSceneArt.tsx` | Decorative line art, hidden from assistive technology and without text. |
| `src/features/home/components/home.module.css` | The static layout and, inside one guard, the pinned scroll-driven version. |
| `src/app/layout.tsx` | Imports the stylesheet in the page shell (see "Markup budget"). |

## The scenes

| # | Scene | While it holds (pinned) | Hand-over to the next scene |
| --- | --- | --- | --- |
| 1 | Title, introduction, primary action, links to every scene | A book's cover turns open, its pages are written, a ribbon drops. | The title splits into its two lines and drifts apart; scrolling back reassembles it. |
| 2 | Учи: Литература, then Български език | „ and Ъ settle on the two pages, lines are written, a page turns. | Cards rise in one after another as the scene arrives. |
| 3 | Тестове | The selection hesitates between three options and settles with a check. | — |
| 4 | Пробна матура | A clock hand sweeps once around the face. | — |
| 5 | Започни безплатно, без регистрация. + primary action | The underline is drawn. | Hands over to the ordinary page below. |

All wording is the approved homepage copy from #19; the only new visible text is the scene links, which reuse the navigation labels, and the closing heading, which reuses the introduction's own sentence. There are no numbers apart from "12. клас".

## How it works

- **Static first.** The markup is the finished page. Without JavaScript, with `prefers-reduced-motion: reduce`, without `animation-timeline` support, or on screens shorter than 34rem it is a plain stack of sections.
- **Pinning.** Inside the guard each scene is a tall section (`--scene-length`) whose stage is `position: sticky` and 100svh tall. Scrolling is never intercepted.
- **Progress.** Each section is a view timeline (`--scene`): *entry* while it slides in, *contain* while pinned, *exit* while it slides out. All choreography is keyframed against those ranges, so it follows the scroll one to one and plays backwards exactly.
- **Holding during hand-overs.** During entry and exit a linear translation cancels the scroll, so the outgoing scene dissolves in place (exit 5–50%) and the incoming one rises in place (entry 45–91%): exit before enter. The translation has no fill, so outside those ranges the stage sits at its real position, which is what anchors, focus, and find in page scroll to.
- **No invisible targets.** Stages ignore pointer events; content takes them only once it is at least half visible (a discrete `pointer-events` keyframe).
- **Find in page and anchors.** Readable text has arrived by entry 91% and starts leaving after exit 5%, so the browser's scroll positions for an anchor, a focused link, or a find match (a scene's start or end) always show readable text.
- **First frame.** Only the title scene is rendered when the page opens: later stages use `content-visibility: auto`, and on phones the book is rendered only once the title scene pins.

## Markup budget

The homepage sits inside the root `loading.tsx` Suspense boundary. React streams a boundary *out of line*, to be revealed by a script, once the bytes already sent plus the boundary's HTML pass its 12,800-byte chunk size, and it does the same when a stylesheet is first imported inside the boundary. Out-of-line content stays hidden without JavaScript: the page shows only "Зареждане на съдържанието…".

So the drawings are mostly CSS (gradients, pseudo-elements) instead of elements, repeated utility strings live in the module, and the stylesheet is imported from the root layout. On 2026-11-03 the shell before `<main>` was 4.1 KB and `<main>` 7.3 KB, about 1.3 KB under the limit. The browser test "homepage without JavaScript" fails if the content is ever outlined again. A more robust fix is to move `loading.tsx` from the root to the routes that actually load data (follow-up).

## Verification (2026-11-03)

Production build, Playwright Chromium, at 320×568, 390×844, 768×1024, and 1280×800, each with reduced motion on and off and with JavaScript on and off:

- no horizontal overflow; reduced motion: nothing pinned, no animations, every card fully visible;
- without JavaScript: every scene and the call to action visible, no loading message;
- every scene link lands on a fully visible card; find in page (`window.find`, from the top and from the bottom) lands on visible card text; Page Down scrolls; back returns to the previous position;
- Tab never focused a link below 94% opacity (two links at 390×844 at 0.94 during the last frames of their reveal), all targets at least 44px tall.

Performance, same harness, `main` and this branch served side by side and measured alternately (the machine was under unrelated heavy load, so single runs vary widely):

| Measure | `main` | This branch |
| --- | --- | --- |
| Script transferred | 144.5 KB | 144.5 KB (0 KB added) |
| Cumulative Layout Shift (load and full scroll) | 0 | 0 |
| Frame time, desktop 1280×800, full scroll, 3 runs | — | median 16.7ms, max 18.8ms, no frame over 33ms |
| Frame time, phone 390×844 at 4× CPU, 3 runs | — | median 16.6–18.8ms; frames over 33ms: 3, 4, and 59 (max 258ms) in the three runs |
| Largest Contentful Paint, phone 390×844 at 4× CPU, 12 alternating runs | median 436ms | median 556ms |
| Largest Contentful Paint, desktop, 3 runs | 380–456ms | 308–452ms |

The remaining throttled-phone LCP difference (about +120ms at 4× CPU) also appears with reduced motion on both sides, so it comes from the larger page and its second stylesheet rather than from the motion. Headless Chromium rasterises in software; a real mid-range phone over remote debugging is the better reference (DESIGN.md 10.6) and has not been measured.
