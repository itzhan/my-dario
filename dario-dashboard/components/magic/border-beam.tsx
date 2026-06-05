import { cn } from "@/lib/cn";

/**
 * A light traveling around the element's border (magic-ui style). Pure CSS
 * via offset-path on the parent's rounded rect. Used on the live status bar
 * to signal "connected and streaming".
 */
export function BorderBeam({
  className,
  duration = 6,
  size = 60,
}: {
  className?: string;
  duration?: number;
  size?: number;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 rounded-[inherit] [border:1px_solid_transparent]",
        "![mask-clip:padding-box,border-box] ![mask-composite:intersect] [mask:linear-gradient(transparent,transparent),linear-gradient(white,white)]",
        className,
      )}
      style={
        {
          ["--size" as string]: size,
          ["--duration" as string]: `${duration}s`,
        } as React.CSSProperties
      }
    >
      <div
        className="absolute aspect-square bg-gradient-to-l from-indigo-400 via-indigo-400/40 to-transparent"
        style={{
          width: size,
          offsetPath: `rect(0 auto auto 0 round ${size}px)`,
          animation: `border-beam var(--duration) linear infinite`,
        }}
      />
    </div>
  );
}
