# BG Matura — Design Direction

> Purpose: Visual and UX rules for BG Matura. `.claude/PROJECT_DIRECTION.md` decides **what** is built; this file decides **how it looks and feels**.
>
> Origin: An earlier version of this file was a description of the Claude.com marketing site. Issue #2 adapted it into BG Matura's own identity. The warm cream, muted coral, and editorial serif direction is kept. Everything that belongs to Claude or Anthropic (logos, wordmarks, licensed fonts, product mockups, marketing components) is removed and must not be used.

## 1. Identity

BG Matura should feel like a calm, well-made study book: warm paper, clear type, and a single quiet accent. It is not a school portal, not a gamified app, and not an AI product.

- **Name and wordmark:** "BG Matura" set in the display serif (section 4) in `ink`. No logo glyph is required for the MVP; if one is created later, it must be original.
- **Voice:** plain, encouraging Bulgarian. Short sentences. Address the student directly („Започни теста“, not „Тестът може да бъде започнат“).
- **Mood:** literary and calm. Colour is used to guide attention, never to decorate. Motion guides attention everywhere; on public showcase pages it may also be expressive, like turning the pages of a well-made book, under the rules of section 10. Where a student reads, practises, or takes an exam, motion stays calm and only explains what changed.

### Not allowed

These belong to Anthropic and must never appear in BG Matura code, assets, or copy:

- The Anthropic radial "spike" mark, the Claude or Anthropic wordmarks, or anything imitating them.
- Copernicus, StyreneB, Tiempos, or Söhne fonts (licensed typefaces).
- Claude marketing components: product/code mockup cards, model-comparison cards, pricing tiers, connector tiles, "Try Claude" bands, cookie card styling copied from claude.com.
- Text or metadata that suggests BG Matura is affiliated with Anthropic or Claude.

## 2. Navigation wording (Bulgarian)

Main navigation, in this order. These labels follow `.claude/PROJECT_DIRECTION.md` §8 and §10.

| Label | Destination | Notes |
| --- | --- | --- |
| **Учи** | Learning hub | Leads to **Литература** (authors and works) and **Български език** (lessons). |
| **Тестове** | Topic-based practice | Interactive questions with explanations. |
| **Пробна матура** | Timed exam simulation | Visually emphasised as the primary action in the header (primary button style). |

Other fixed wording:

| Context | Text |
| --- | --- |
| Admin area link (admins only) | Администрация |
| Exam timer label | Оставащо време |
| Submit exam | Предай матурата |
| Result states | Вярно · Грешно · Частично вярно · За самооценка |
| Empty search | Няма намерени резултати |
| Generic error | Нещо се обърка. Опитай отново. |

Navigation wording can change only through an explicit decision recorded here.

## 3. Colours

All text/background pairs below were checked against WCAG 2.2 AA. Ratios are listed so a future change can be re-checked. Never inline hex values in components; use the tokens.

### Surfaces

| Token | Hex | Use |
| --- | --- | --- |
| `canvas` | #faf9f5 | Default page background. |
| `surface-soft` | #f5f0e8 | Soft section bands, sidebars. |
| `surface-card` | #efe9de | Cards, question panels. |
| `surface-strong` | #e8e0d2 | Selected tab, selected answer option. |
| `hairline` | #e6dfd8 | Decorative dividers between blocks. Not enough contrast to mark an interactive boundary on its own. |
| `border-control` | #8f897f | Borders of inputs, checkboxes, radio buttons, answer options (3.29:1 on `canvas`, meets the 3:1 rule for controls). |

### Text

| Token | Hex | Contrast on `canvas` / `surface-card` | Use |
| --- | --- | --- | --- |
| `ink` | #141413 | 17.5 / 15.3 | Headings, primary text. |
| `body` | #3d3d3a | 10.3 / 9.0 | Running text, lesson content. |
| `muted` | #5f5d57 | 6.3 / 5.5 | Secondary text, captions, breadcrumbs, metadata. |
| `on-primary` | #ffffff | 5.9 on `primary` | Text on primary buttons. |

There is no lighter "fine print" grey: every piece of text must meet 4.5:1.

### Accent

| Token | Hex | Contrast | Use |
| --- | --- | --- | --- |
| `primary` | #9c4f36 | 5.6 on `canvas`, 4.9 on `surface-card` | Primary buttons, links, focus ring, active navigation item. |
| `primary-active` | #7f3f2a | 7.9 with white text | Pressed/hover state of primary buttons and links. |
| `coral-decorative` | #cc785c | 3.1 on `canvas` | Large decorative shapes and illustrations only. **Never for text, icons that carry meaning, or control borders.** |

`primary` is a darker version of the original coral (#cc785c). The original coral fails contrast with white text (3.3:1) and as text on cream (3.1:1), so it is kept only as a decorative tone.

Do not place `primary` text on `surface-strong` (4.47:1, just under AA).

### Feedback

| Token | Hex | Contrast on `canvas` / `surface-card` | Use |
| --- | --- | --- | --- |
| `success` | #2b6e3e | 5.9 / 5.1 | Correct answer. |
| `error` | #a83434 | 6.2 / 5.4 | Wrong answer, validation error. |
| `warning` | #7a5600 | 6.3 / 5.5 | Last minutes of the exam timer, unsaved changes. |
| `pending` | uses `muted` | 6.3 / 5.5 | Ungraded / self-review responses. |

Colour is never the only signal. Each feedback state also has an icon (Lucide `CircleCheck`, `CircleX`, `TriangleAlert`, `Clock`) and a text label from section 2.

## 4. Typography

Both fonts are free (SIL Open Font License), available through `next/font/google`, and have full **Cyrillic** support, which BG Matura requires.

| Role | Font | Fallback |
| --- | --- | --- |
| Display (h1–h3, wordmark) | **Literata** | Georgia, "Times New Roman", serif |
| Body, UI, navigation | **Inter** | system-ui, -apple-system, "Segoe UI", Roboto, sans-serif |

Literata was designed for long-form reading, which suits literature content. Lesson and study text may also be set in Literata at body size when it is long-form reading; UI controls stay in Inter.

### Scale

| Token | Size (desktop / mobile) | Weight | Line height | Use |
| --- | --- | --- | --- | --- |
| `display-xl` | 48 / 32px | 400 | 1.1 | Home page heading. |
| `display-lg` | 36 / 28px | 400 | 1.15 | Page headings. |
| `display-md` | 28 / 24px | 400 | 1.2 | Section headings. |
| `title` | 20 / 18px | 600 | 1.35 | Card titles, question numbers. |
| `body-lg` | 18px | 400 | 1.65 | Long-form lesson and literature text. |
| `body` | 16px | 400 | 1.55 | Default text. Never smaller for running text. |
| `label` | 14px | 500 | 1.4 | Buttons, navigation, form labels, badges. |
| `caption` | 14px | 400 | 1.4 | Metadata. No text smaller than 14px. |

Display headings use weight 400 with slight negative tracking (-0.01em). Use a larger size before a heavier weight for emphasis. Do not use all-caps for Cyrillic labels; it hurts readability.

## 5. Layout and spacing

- Base unit 4px. Tokens: 4, 8, 12, 16, 24, 32, 48, 64px.
- Space between major page sections: 64px desktop, 48px mobile.
- Card padding: 24px desktop, 16px mobile.
- Reading width for lesson and literature text: at most ~70 characters (`max-w-prose`).
- Page container: max 1200px, centred, 16px side gutter on mobile.

| Breakpoint | Width | Behaviour |
| --- | --- | --- |
| Mobile | < 768px | Navigation collapses into a menu button; cards in one column. |
| Tablet | 768–1024px | Two-column card grids. |
| Desktop | ≥ 1024px | Full horizontal navigation; exam layout shows the question navigator beside the question. |

## 6. Shapes and depth

| Token | Value | Use |
| --- | --- | --- |
| `rounded-sm` | 6px | Small controls, checkboxes. |
| `rounded-md` | 8px | Buttons, inputs, answer options. |
| `rounded-lg` | 12px | Cards, panels. |
| `rounded-pill` | 9999px | Badges. |

Depth comes from surface colour, not shadows. A single faint shadow (`0 1px 3px rgba(20,20,19,0.08)`) is allowed for menus and dialogs that float above content.

Illustrations, when used, are simple line art in `ink` and `coral-decorative` on cream. No stock photos of exam halls.

## 7. Components

Built on shadcn/ui and themed with the tokens above.

- **Primary button:** `primary` background, white text, `label` type, height 44px, padding 12×20px, `rounded-md`. Pressed: `primary-active`.
- **Secondary button:** `canvas` background, `ink` text, 1px `border-control` border, same size.
- **Text link:** `primary`, always underlined in running text (not only on hover), so links are not identified by colour alone.
- **Card:** `surface-card` background, `rounded-lg`, no shadow.
- **Input:** `canvas` background, 1px `border-control` border, height 44px, `rounded-md`. Error: `error` border plus an error message below in `error` with an icon.
- **Answer option:** full-width tappable row, min height 48px, `border-control` border. Selected: `surface-strong` background and 2px `primary` border. After grading: `success` / `error` border, icon, and text label.
- **Badge:** `surface-card` background, `ink` text, `label` type, `rounded-pill`.
- **Exam timer:** always visible (sticky on mobile), `ink` text; switches to `warning` with an icon in the last 5 minutes. Announced to screen readers at fixed intervals, not every second.

## 8. Accessibility

These rules resolve the accessibility gaps of the original reference and follow `.claude/CLAUDE.md` §8.

- **Contrast:** all text at least 4.5:1; large text (≥ 24px, or ≥ 19px bold) and control boundaries at least 3:1. Ratios in section 3.
- **Touch targets:** every interactive element at least **44×44px**, including icon buttons (the original reference used 36px). Adjacent targets have at least 8px between them.
- **Focus:** every focusable element shows a visible focus ring: 2px `primary` outline with 2px offset. Never remove outlines without a replacement.
- **Keyboard:** the full exam flow (choose answer, move between questions, submit) works with the keyboard alone.
- **Motion:** no essential information in animation; respect `prefers-reduced-motion`; never take over scrolling; nothing flashes more than three times per second. The full rules are in section 10.
- **Language:** pages declare `lang="bg"`.
- **Status:** correct/wrong/ungraded states use colour, icon, and text together.

## 9. Do and don't

**Do**

- Keep the cream canvas and one quiet accent.
- Let content lead: readable text, generous spacing, short paths to „Учи“, „Тестове“, „Пробна матура“.
- Show exam time and answer state clearly.

**Don't**

- Don't use anything from the "Not allowed" list in section 1.
- Don't use `coral-decorative` for text or controls.
- Don't add gamification (streaks, confetti, leaderboards) or dashboard clutter.
- Don't use pure white or cool grey as the page background.
- Don't animate anything on practice or exam answering screens beyond the essential feedback allowed in section 10.
- Don't use smooth-scroll libraries, scroll snapping that traps the reader, or anything else that takes scrolling away from the browser.

## 10. Motion

Motion in BG Matura has one vocabulary. The values below are design tokens in `src/app/globals.css` and, for scripted motion, typed constants in `src/lib/motion.ts`; a unit test keeps them identical. Tooling decisions, measured bundle costs, and the measuring method are recorded in [documentation/MOTION.md](../documentation/MOTION.md).

### 10.1 Where motion is allowed

Every surface belongs to one tier. A page that is not listed belongs to the **content** tier until it is added here.

| Tier | Surfaces | Allowed |
| --- | --- | --- |
| **Showcase** | Home page `/`, learning hub `/uchi`, about page `/za-proekta` | Expressive and scroll-driven motion, scene sequences, the `slow` and `deliberate` durations, the `xl` distance, the expressive spring. Never on the first paint of the main heading (see 10.6). |
| **Content** | Catalogues and reading pages: `/literatura`, `/avtori/*`, `/balgarski-ezik`, `/testove` and `/matura` topic and simulation lists, page transitions | A short reveal when a block first enters (at most `moderate`, at most `md` distance), state transitions, page transitions. Text that a student is reading never moves. No scroll-scrubbed animation of reading text. |
| **Focus** | Practice and exam answering screens (`/testove/[id]`, `/matura/[id]`), result review, the exam timer, every admin page | Only essential feedback: an answer becoming selected, a validation message appearing, the navigator updating, a dialog opening. At most `base` duration, at most `sm` distance, the calm spring only. No scroll-linked, ambient, looping, or staggered motion, and nothing that moves while the student reads or answers a question. |

### 10.2 Tokens

| Token | CSS | Value | Use |
| --- | --- | --- | --- |
| Duration `fast` | `--duration-fast` | 120ms | Hover, press, and focus feedback. |
| Duration `base` | `--duration-base` | 200ms | Small state changes; the limit in the focus tier. |
| Duration `moderate` | `--duration-moderate` | 320ms | Panels, content entering the page; the limit in the content tier. |
| Duration `slow` | `--duration-slow` | 480ms | Showcase entrances. |
| Duration `deliberate` | `--duration-deliberate` | 720ms | The longest time-based animation allowed anywhere. Showcase only. |
| Easing `standard` | `ease-standard` | cubic-bezier(0.2, 0, 0, 1) | A change of state in place. |
| Easing `enter` | `ease-enter` | cubic-bezier(0.16, 1, 0.3, 1) | Something arriving. |
| Easing `exit` | `ease-exit` | cubic-bezier(0.7, 0, 0.84, 0) | Something leaving. |
| Spring `calm` | `ease-spring-calm` + `--duration-spring-calm` | stiffness 169, damping 26, mass 1 (critically damped, settles in 720ms) | Anything a student touches. No overshoot. |
| Spring `expressive` | `ease-spring-expressive` + `--duration-spring-expressive` | stiffness 196, damping 21, mass 1 (about 3% overshoot, settles in 580ms) | Showcase only. |
| Stagger `tight` | `--stagger-tight` | 40ms | Items of a list or grid. |
| Stagger `base` | `--stagger-base` | 80ms | A few large blocks. |
| Stagger maximum | `--stagger-max-total` | 400ms | No sequence takes longer from first item to last; later items share the last delay. |
| Distance `xs` … `xl` | `--motion-distance-xs` … `-xl` | 4, 8, 16, 32, 64px | How far something travels. `xl` is showcase only. All are 0 with reduced motion. |

The springs are also available in pure CSS: `linear()` curves sampled from the same physics, used with their matching duration.

### 10.3 Choreography

1. **One thing leads.** In every composition the content leads (the heading, the question, the card that was chosen), supporting text follows, controls come next, and decoration comes last. Decoration never moves before or more than the content it accompanies.
2. **Exit before enter.** What leaves goes first and faster (about two thirds of the entering duration, `ease-exit`); what arrives follows with `ease-enter`. Never cross two pieces of readable text at full opacity.
3. **Move together, move alike.** Elements that move at the same time share a direction and an easing. At most three groups move at once.
4. **Direction has meaning.** Vertical travel reveals (content rises into place by a distance token). Horizontal travel means sequence: next goes left, previous goes right. One axis per element; text is never rotated or skewed.
5. **Keep it near.** Scale changes stay between 0.96 and 1 everywhere except showcase illustrations. Nothing travels further than its distance token.
6. **Arrived text stays still.** Once text is readable, it does not drift, bob, or loop. Hover never moves layout; it may only change colour or a decorative underline.
7. **Scroll-driven motion is a scrub, not a trigger.** Progress follows the scroll position one to one, the timeline itself is linear (shape it with easings inside the keyframes), and scrolling back plays it backwards exactly. A scroll position never starts a time-based animation that cannot be reversed.

### 10.4 Reduced motion

`prefers-reduced-motion: reduce` gets an equivalent for every animation, never a missing piece.

- **The final state is the markup.** Build every element in its finished, readable position and animate *from* an offset. Without JavaScript, without support for a CSS feature, and with reduced motion, the student sees that finished state.
- **No travel.** With reduced motion the distance tokens become 0, so token-based transforms stay put. Do not add scale, parallax, rotation, or scroll-linked animation; scroll-driven sequences become ordinary stacked sections with the same content and controls.
- **Fades stay.** Opacity and colour transitions of at most `base` duration remain, because they explain a change without movement. View Transitions become an instant swap or a crossfade of at most `base`.
- **One check.** CSS uses the `motion-safe:` / `motion-reduce:` variants or the media query. Scripts use `usePrefersReducedMotion()` or `prefersReducedMotion()` from `src/lib/reduced-motion.ts`, which answer "reduce" whenever the preference is unknown (on the server, before hydration). Never re-implement the check.

### 10.5 Pause, stop, and flashing

- Scroll-driven motion moves only while the reader scrolls, so it needs no pause control, but it must stop the moment scrolling stops.
- Anything time-based that moves, blinks, or loops for longer than five seconds has a visible pause or stop control, and does not run at all with reduced motion. Loading spinners are essential and exempt from the control, but they still stop with reduced motion (`motion-reduce:animate-none`, as `Button` already does).
- Nothing flashes more than three times in any one second. Large areas never alternate between light and dark; a change of brightness over more than a quarter of the viewport takes at least `base`.

### 10.6 Performance budget

| Budget | Limit | How it is measured |
| --- | --- | --- |
| Frame rate | Steady 60 fps on a mid-range phone; no frame over 16.7ms caused by our motion. | Chrome DevTools Performance panel with 4× CPU throttling as the mid-range-phone proxy, recording a scroll through the motion; plus the in-page frame-time script in `documentation/MOTION.md`. |
| Properties | Only `transform`, `opacity`, `clip-path`, and small cheap `filter` values are animated. Never `width`, `height`, `top`, `left`, `margin`, `padding`, `box-shadow`, or font properties. | Code review; the Performance panel shows no Layout or Paint work during the animation. |
| Layout shift | 0 added Cumulative Layout Shift. Motion uses transforms, so the layout box never moves. | `PerformanceObserver` for `layout-shift` entries while loading and scrolling (script in `documentation/MOTION.md`), or Lighthouse. |
| Largest Contentful Paint | No regression. The main heading (the usual LCP element) is fully visible in its final place at first paint, without JavaScript, and is never faded in. | Lighthouse mobile preset, median of three runs before and after the change, and the `largest-contentful-paint` observer. |
| Added JavaScript | Focus tier: 0 KB. Content tier: at most 5 KB gzip per route. Showcase: at most 10 KB gzip per route in the initial load, and at most 30 KB gzip in total including lazy-loaded chunks. Motion code loads only on the routes that use it. | Sum of `transferSize` of script resources for the route before and after (script in `documentation/MOTION.md`); every motion pull request states the result. |

### 10.7 Tooling

In order of preference (details, versions, measured costs, and fallbacks in `documentation/MOTION.md`):

1. **CSS**: transitions, keyframes, `@starting-style`, and **scroll-driven animations** (`animation-timeline: view()` / `scroll()`) for anything tied to scrolling. They run without JavaScript and off the main thread.
2. **View Transitions API** for page and state transitions.
3. **Motion `animate()` from `motion/mini`** (3.2 KB gzip, measured) when a script really has to drive an animation, lazy-loaded.

Not adopted: `motion/react` components, GSAP with ScrollTrigger, and every smooth-scroll library (Lenis and similar). Adding any of them is a design decision recorded here first.

### 10.8 Interaction and focus

- Keyboard, touch, and screen reader users reach everything that motion reveals. Content that is hidden at some point of an animation is still in the DOM in reading order and is never `display: none` or `visibility: hidden` only because of an animation stage.
- A transition never moves or traps focus. Targets stay at least 44×44px through the whole animation.
- Native scrolling, keyboard scrolling (Space, Page Down, arrow keys), anchor links, find in page, and back/forward always keep working.

## 11. Open items

- An original BG Matura logo is not designed yet; the serif wordmark is used until then.
- Dark mode is not part of the MVP.
- Final wording for secondary pages is decided per feature and added to section 2.
