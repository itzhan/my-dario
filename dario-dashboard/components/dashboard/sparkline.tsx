/**
 * Tiny inline SVG sparkline — no chart library. Renders a normalized polyline
 * for a numeric series (used for the utilization trend).
 */
export function Sparkline({
  values,
  width = 260,
  height = 48,
  stroke = "var(--color-accent)",
  className,
}: {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
  className?: string;
}) {
  if (values.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-xs text-[var(--color-ink-faint)]"
        style={{ width, height }}
      >
        数据不足
      </div>
    );
  }

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const stepX = width / (values.length - 1);

  const pts = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / span) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const area = `0,${height} ${pts.join(" ")} ${width},${height}`;

  return (
    <svg width={width} height={height} className={className} preserveAspectRatio="none">
      <polygon points={area} fill={stroke} opacity={0.1} />
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
