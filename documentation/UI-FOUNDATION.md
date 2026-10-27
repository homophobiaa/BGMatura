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

The introduction uses these shared colours and spacing. Typography is tracked
separately in issue #15; full controls and navigation remain separate features.

Verification for #14: `npm run check` passed (lint, strict types, 53 unit tests,
production build). Chromium checks against the production server at 320, 390,
768, and 1280px found no horizontal overflow and confirmed the canvas/body
colours, 16px mobile gutter, and keyboard outline. A temporary button probe
verified the 2px/2px focus ring and 8px radius without adding a demo route.
WCAG relative-luminance calculations confirmed all approved text colours on
canvas/soft/card at 4.5:1 or higher (the lowest was primary/card at 4.85:1), white
text on both primary states at 4.5:1 or higher, and the control border on canvas
at 3:1 or higher. These checks do not certify future colour combinations.
