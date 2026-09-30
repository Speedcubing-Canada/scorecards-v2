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
  `--fs-label`, `--fs-caption`, `--fs-micro`. Never a raw `px`; the guard test fails on one.
  The four ranks that matter: page title (`--fs-display`) → section heading (`--fs-heading`)
  → group label (`--fs-caption`, uppercase via `ui.groupLabel`) → option title (`--fs-body`).
- **Weight** → `--fw-regular` / `--fw-medium` / `--fw-bold`.
- **Spacing** → `--space-1`…`--space-8`.
- **Radii** → `--radius-sm` / `--radius-md` / `--radius-lg`.
- **Color** → existing surface/text/border/brand/status tokens. Two rules that are easy to
  get wrong, and that `src/styles/contrast.test.ts` enforces:
  - `--primary` is a **fill** and always pairs with `--primary-contrast`. The brand as
    **text** or an icon is `--primary-soft-text`; the fill colour does not clear 4.5:1 on a
    surface in either theme.
  - `--border` is decorative (section rules, card edges). The visible boundary of a
    **control** is `--border-strong`, which clears 3:1 on every surface (WCAG 1.4.11).
  Adding a colour pairing means adding it to that test.

## Typography

- **Font is Montserrat**, set on `body` and inherited. Put `font-family: inherit` on
  buttons / inputs / selects (they don't inherit it by default).
- **Only three font weights - `400`, `500`, `700`. Never use 600 or 800.**
  - `400` - body text, descriptions, hints.
  - `500` - controls, nav, secondary buttons, small tile labels.
  - `700` - headings, primary buttons, stat values, option/card titles, badges.
- Montserrat is loaded in `index.html` with exactly `@400;500;700` - keep it in sync.

## Control shapes

Three variants in `ui.module.css`, so the shape says what a control does before it is read:

- `.optionCard` - one member of a radio or checkbox **set** ("pick from these"). Wrap the set
  in a `<fieldset className={ui.optionGroup}>` with a `<legend>`, so the heading is tied to
  the controls it names.
- `.toggleCard` - a **standalone** boolean ("turn this one thing on"). Recessed, no left rule.
- `.dropzone` - a file input.

Selection is a primary border plus an inset left rule, **never a background fill**. Three
filled red blocks on a page leave no room for the primary button to be the loudest thing.

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
- Light **and** dark mode must both look right; never hardcode a color. Dark mode cannot
  separate a card from the page by fill alone - the contrast formula caps near-black pairs
  around 1.26:1 - so the card **edge** carries it there.
- A form that scrolls a long way keeps its primary action reachable (`ui.stickyFooter`).
- A wizard's forward button is `ui.btnCta`, not `ui.btnPrimary`: capped and right-aligned on
  a desktop, full width on a phone. A 1000px-wide button reads as a banner.

## When you change the UI

- Add/extend the guard test if you introduce a new design rule.
- Update the README's **Design system** section and this file if guidelines change.
