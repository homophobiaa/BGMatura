# Shared visual foundation

The approved values come from [.claude/DESIGN.md](../.claude/DESIGN.md).
`src/app/globals.css` owns the CSS custom properties and Tailwind 4 theme;
components use semantic utilities such as `bg-surface-card`, `text-body`,
`border-border-control`, and `rounded-md` instead of inline colour values.

## Colour, spacing, and shape

Use `canvas` for the page, `surface-soft` for quiet sections, `surface-card` for
panels, and `surface-strong` for selected surfaces. Headings use `ink`, running
text uses `body`, and secondary text uses `muted`. `pending` aliases `muted`.
Feedback tokens still require a text label and suitable icon; colour alone is
insufficient. Feedback controls belong to issue #16.

`primary` is the accessible action/focus colour; `primary-active` is its pressed
or hover state. Use `on-primary` for text on those backgrounds. Never use
`coral-decorative` for meaningful text or controls, `hairline` as the sole control
boundary, or `primary` text on `surface-strong`.

The spacing base is 4px: Tailwind steps 1, 2, 3, 4, 6, 8, 12, and 16 provide the
approved 4, 8, 12, 16, 24, 32, 48, and 64px rhythm. Radius utilities `rounded-sm`,
`rounded-md`, `rounded-lg`, and `rounded-pill` provide 6, 8, 12, and 9999px.
All keyboard-focusable elements inherit a 2px primary outline with 2px offset.

The introduction uses these shared colours and spacing. Full controls and
navigation remain separate features.

Verification for #14: `npm run check` passed (lint, strict types, 53 unit tests,
production build). Chromium checks against the production server at 320, 390,
768, and 1280px found no horizontal overflow and confirmed the canvas/body
colours, 16px mobile gutter, and keyboard outline. A temporary button probe
verified the 2px/2px focus ring and 8px radius without adding a demo route.
WCAG relative-luminance calculations confirmed all approved text colours on
canvas/soft/card at 4.5:1 or higher (the lowest was primary/card at 4.85:1), white
text on both primary states at 4.5:1 or higher, and the control border on canvas
at 3:1 or higher. These checks do not certify future colour combinations.

## Bulgarian typography

`src/app/layout.tsx` loads the approved variable Inter and Literata families
through `next/font/google` with Latin and Cyrillic subsets and `display: swap`.
Next.js fetches them at build time and serves the generated font assets from the
application; student browsers make no Google Fonts requests. Builds therefore
need access to Google's font endpoints. The root keeps `lang="bg"` for Bulgarian
language shaping and punctuation.

Inter is the body/UI default (`font-sans`); Literata is the h1–h3 default and
`font-serif`. Both have system fallbacks while loading. Sources and licenses:

- [Inter, Google Fonts](https://github.com/google/fonts/tree/main/ofl/inter),
  copyright the Inter Project authors; SIL Open Font License 1.1.
- [Literata, Google Fonts](https://github.com/google/fonts/tree/main/ofl/literata),
  copyright the Literata Project authors; SIL Open Font License 1.1.

Full upstream license notices are retained in `public/fonts/licenses/`.

Use the named type utilities, which follow the approved scale. Display sizes
switch at 768px: `text-display-xl` is 32/48px, `text-display-lg` is 28/36px,
`text-display-md` is 24/28px, and `text-title` is 18/20px (mobile/desktop).
Display headings use normal weight, slight negative tracking, and line heights
of 1.1/1.15/1.2. `text-title` uses weight 600 and line height 1.35.
`text-body-lg` is 18px/1.65, `text-body` is 16px/1.55, `text-label` is 14px/1.4
at weight 500, and `text-caption` is 14px/1.4. Keep reading blocks within
`max-w-reading` (70ch); avoid uppercase Cyrillic labels and smaller body text.
The homepage composes these utilities instead of local font sizes.

Verification for #15: `npm run check` passed using Node.js 24.22.1 and npm
11.21.1 (lint, strict types, 53 unit tests, production build). Chromium checks
against the production server at 320, 390, 768, and 1280px confirmed the loaded
Inter/Literata faces for Bulgarian text, the 32/48px homepage heading, and no
horizontal overflow. Temporary Bulgarian heading/paragraph probes included
Bulgarian quotation marks, punctuation, й, ѝ, щ, and ъ; mobile and desktop
screenshots were visually inspected. The probes and screenshots are local QA
artifacts, not public content or application routes.
