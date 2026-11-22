/*
 * Brand "running outline": a lime light that travels around the edge of its
 * parent. Drop it as the last child of a `relative` element with a border
 * radius; it inherits the radius and never takes pointer events.
 * Styles live in globals.css (.run-line).
 */

export function RunLine({
  speed = 7,
  delay = 0,
  width = 1.75,
  glow = 6,
  className = "",
}: {
  /** seconds per lap */
  speed?: number;
  /** seconds; negative values start the light part-way round */
  delay?: number;
  /** line thickness in px */
  width?: number;
  /** glow blur in px */
  glow?: number;
  className?: string;
}) {
  const style = {
    "--run-s": `${speed}s`,
    "--run-d": `${delay}s`,
    "--run-w": `${width}px`,
    "--run-glow": `${glow}px`,
  } as React.CSSProperties;
  return (
    <span aria-hidden className={`run-line ${className}`} style={style}>
      <b>
        <i />
      </b>
      <i />
    </span>
  );
}
