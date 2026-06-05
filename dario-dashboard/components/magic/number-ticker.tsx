"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useMotionValue, useSpring } from "motion/react";
import { cn } from "@/lib/cn";

/**
 * Animated count-up number (magic-ui style). Springs from the previous value
 * to the new one whenever `value` changes, so live metric updates visibly
 * tick rather than snapping.
 */
export function NumberTicker({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: false, margin: "0px" });
  const motion = useMotionValue(0);
  const spring = useSpring(motion, { damping: 26, stiffness: 110 });
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (inView) motion.set(value);
  }, [motion, value, inView]);

  useEffect(() => {
    return spring.on("change", (latest) => {
      setDisplay(
        prefix +
          latest.toLocaleString("en-US", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          }) +
          suffix,
      );
    });
  }, [spring, decimals, prefix, suffix]);

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {display}
    </span>
  );
}
