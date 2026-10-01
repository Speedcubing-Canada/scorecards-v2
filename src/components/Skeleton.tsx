/**
 * Skeleton loading placeholder. Renders a pulsing block sized to mirror the
 * content that will replace it, so the layout doesn't jump when data arrives.
 * Pulse, theming and the default size come from the global `.skeleton` rule in
 * index.css (which also disables the animation under prefers-reduced-motion).
 *
 * Pass `className` instead of width/height when the size has to follow a media query.
 */
export default function Skeleton({
  width,
  height,
  radius,
  className,
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={className ? `skeleton ${className}` : 'skeleton'}
      aria-hidden="true"
      style={{ width, height, borderRadius: radius, ...style }}
    />
  );
}
