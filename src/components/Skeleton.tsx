/**
 * Skeleton loading placeholder. Renders a pulsing block sized to mirror the
 * content that will replace it, so the layout doesn't jump when data arrives.
 * Pulse + theming come from the global `.skeleton` rule in index.css (which also
 * disables the animation under prefers-reduced-motion).
 */
export default function Skeleton({
  width = '100%',
  height = 16,
  radius = 'var(--radius-sm)',
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="skeleton"
      aria-hidden="true"
      style={{ width, height, borderRadius: radius, ...style }}
    />
  );
}
