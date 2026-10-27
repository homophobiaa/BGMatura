# BG Matura — Design Direction

> Purpose: Visual and UX rules for BG Matura. `.claude/PROJECT_DIRECTION.md` decides **what** is built; this file decides **how it looks and feels**.
>
> Origin: An earlier version of this file was a description of the Claude.com marketing site. Issue #2 adapted it into BG Matura's own identity. The warm cream, muted coral, and editorial serif direction is kept. Everything that belongs to Claude or Anthropic (logos, wordmarks, licensed fonts, product mockups, marketing components) is removed and must not be used.

## 1. Identity

BG Matura should feel like a calm, well-made study book: warm paper, clear type, and a single quiet accent. It is not a school portal, not a gamified app, and not an AI product.

- **Name and wordmark:** "BG Matura" set in the display serif (section 4) in `ink`. No logo glyph is required for the MVP; if one is created later, it must be original.
- **Voice:** plain, encouraging Bulgarian. Short sentences. Address the student directly („Започни теста“, not „Тестът може да бъде започнат“).
- **Mood:** literary and calm. Colour and motion are used to guide attention, never to decorate.

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
- **Motion:** no essential information in animation; respect `prefers-reduced-motion`.
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

## 10. Open items

- An original BG Matura logo is not designed yet; the serif wordmark is used until then.
- Dark mode is not part of the MVP.
- Final wording for secondary pages is decided per feature and added to section 2.
