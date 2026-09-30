# UI Design Guidelines

Rules for the on-screen UI (`src/components`, `src/pages`). These do **not** apply to
the PDF documents in `src/pdf/` - those use `@react-pdf/renderer` primitives and their
own `StyleSheet`. A guard test (`src/components/design-system.test.ts`) enforces the
hard rules below; keep it green.

## Styling is CSS modules

**No inline `React.CSSProperties` style objects.** They cannot express `:hover`, `:active`
or `@media`, which is why the app had no hover states at all until this was fixed. The guard
test fails on any style object that comes back.

- Shared primitives (option cards, buttons, inputs, dialog shell, page shell) live in
  `src/styles/ui.module.css`. Reuse them before writing anything new.
- Per-component styling goes in a `Component.module.css` next to the component.
- `style={...}` is for **genuinely dynamic values only**: a progress width, a skeleton's
  measured size. Not for anything a class could express.
- Responsive layout is a `@media (max-width: 600px)` block, never a JS branch. `useIsMobile()`
  is only for picking a different *subtree* (the Header's hamburger, PrintGuide's arrow).

## Tokens are the source of truth

The CSS custom properties in `src/index.css` (`:root` + `[data-theme='dark']`) are the single
source of truth. **Reference them via `var(--token)`; don't hardcode values.**

- **Type size** → `--fs-stat`, `--fs-display`, `--fs-title`, `--fs-heading`, `--fs-body`,
  `--fs-label`, `--fs-caption`, `--fs-micro`.
- **Weight** → `--fw-regular` / `--fw-medium` / `--fw-bold`.
- **Spacing** → `--space-1`…`--space-8`.
- **Radii** → `--radius-sm` / `--radius-md` / `--radius-lg`.
- **Color** → existing surface/text/border/brand/status tokens.

## Typography

- **Font is Montserrat**, set on `body` and inherited. Put `font-family: inherit` on
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
  nothing shifts when data arrives (don't use bare "Loading…" text or emoji). Pass `className`
  when the placeholder's size has to follow a media query.
- Keep a real progress bar when true progress data exists (e.g. PDF building).

## Quality floor

- Visible keyboard focus (global `:focus-visible` ring is already wired) on every
  interactive element.
- **Every interactive element needs a `:hover` state.** A card, button or tile that looks
  identical under the cursor reads as dead.
- Use the native element: `<button>` for actions, `<a>` for navigation. Never
  `<div role="button" tabIndex={0}>` - the browser gives a real button Enter, Space and focus
  for free.
- Respect `prefers-reduced-motion` (skeleton pulse + spinners already do).
- Stay responsive with a `@media (max-width: 600px)` block in the component's CSS module.
- Light **and** dark mode must both look right; never hardcode a color.

## When you change the UI

- Add/extend the guard test if you introduce a new design rule.
- Update the README's **Design system** section and this file if guidelines change.
