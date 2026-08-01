# UI Design Guidelines

Rules for the on-screen UI (`src/components`, `src/pages`). These do **not** apply to
the PDF documents in `src/pdf/` - those use `@react-pdf/renderer` primitives and their
own `StyleSheet`. A guard test (`src/components/design-system.test.ts`) enforces the
hard rules below; keep it green.

## Tokens are the source of truth

All UI styles use per-component inline `React.CSSProperties` objects, so the shared CSS
custom properties in `src/index.css` (`:root` + `[data-theme='dark']`) keep them
consistent. **Reference tokens via `var(--token)`; don't hardcode values.**

- **Type size** → `--fs-stat`, `--fs-display`, `--fs-title`, `--fs-heading`, `--fs-body`,
  `--fs-label`, `--fs-caption`.
- **Spacing** → `--space-1`…`--space-8`.
- **Radii** → `--radius-sm` / `--radius-md` / `--radius-lg`.
- **Color** → existing surface/text/border/brand/status tokens.

## Typography

- **Font is Montserrat**, set on `body` and inherited. Put `fontFamily: 'inherit'` on
  buttons / inputs / selects (they don't inherit it by default).
- **Only three font weights - `400`, `500`, `700`. Never use 600 or 800.**
  - `400` - body text, descriptions, hints.
  - `500` - controls, nav, secondary buttons, small tile labels.
  - `700` - headings, primary buttons, stat values, option/card titles, badges.
- Montserrat is loaded in `index.html` with exactly `@400;500;700` - keep it in sync.

## Icons

- **Use `lucide-react` only.** No hand-rolled inline `<svg>` and no emoji as icons.
- Keep a consistent size (16–18 for inline/controls) and `strokeWidth` (~2).
- Decorative icons get `aria-hidden`; icon-only buttons get an `aria-label`.
- WCA event icons (`src/assets/events.ts`) stay PNGs - they're artwork, not UI chrome.

## Tooltips

- Use `src/components/Tooltip.tsx` (no dependency, hover + keyboard focus, themed).
- Wrap **icon-only or jargon** controls to explain them. Don't add a tooltip that just
  repeats visible description text - many option cards already have inline `optionDesc`.

## Loading states

- Use `src/components/Skeleton.tsx` for async loads; **mirror the eventual layout** so
  nothing shifts when data arrives (don't use bare "Loading…" text or emoji).
- Keep a real progress bar when true progress data exists (e.g. PDF building).

## Quality floor

- Visible keyboard focus (global `:focus-visible` ring is already wired) on every
  interactive element.
- Respect `prefers-reduced-motion` (skeleton pulse + spinners already do).
- Stay responsive via `useIsMobile()` - spread a mobile override into the style object.
- Light **and** dark mode must both look right; never hardcode a color.

## When you change the UI

- Add/extend the guard test if you introduce a new design rule.
- Update the README's **Design system** section and this file if guidelines change.
