"use client";

import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { useState, type PointerEvent, type ReactNode } from "react";
import { useMediaQuery } from "@/lib/use-media-query";

/**
 * Pointer-tracked 3D tilt slab with a cursor-following specular highlight.
 * Children live in a preserve-3d space, so they can float on raised planes
 * via `[transform:translateZ(24px)]`-style classes. Tilt and glare activate
 * only on fine pointers and never under reduced motion; touch devices get
 * the static slab.
 */
export function TiltCard({
  children,
  className = "",
  maxTilt = 6,
}: {
  children: ReactNode;
  className?: string;
  maxTilt?: number;
}) {
  const reduce = useReducedMotion();
  const hoverable = useMediaQuery("(hover: hover) and (pointer: fine)");
  const [hovered, setHovered] = useState(false);

  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(py, [0, 1], [maxTilt, -maxTilt]), {
    stiffness: 160,
    damping: 20,
  });
  const rotateY = useSpring(useTransform(px, [0, 1], [-maxTilt, maxTilt]), {
    stiffness: 160,
    damping: 20,
  });
  const glareX = useTransform(px, (v) => `${v * 100}%`);
  const glareY = useTransform(py, (v) => `${v * 100}%`);
  const glare = useMotionTemplate`radial-gradient(340px circle at ${glareX} ${glareY}, rgb(255 255 255 / 0.16), transparent 62%)`;
  const edgeGlow = useMotionTemplate`radial-gradient(240px circle at ${glareX} ${glareY}, rgb(233 235 240 / 0.4), transparent 70%)`;

  const active = hoverable && !reduce;

  const handleMove = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - rect.left) / rect.width);
    py.set((e.clientY - rect.top) / rect.height);
  };

  const handleLeave = () => {
    setHovered(false);
    px.set(0.5);
    py.set(0.5);
  };

  return (
    <motion.div
      className={`relative ${className}`}
      style={
        active
          ? {
              rotateX,
              rotateY,
              transformStyle: "preserve-3d",
              transformPerspective: 1100,
            }
          : undefined
      }
      onPointerMove={active ? handleMove : undefined}
      onPointerEnter={active ? () => setHovered(true) : undefined}
      onPointerLeave={active ? handleLeave : undefined}
    >
      {children}
      {active && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] transition-opacity duration-300"
          style={{ opacity: hovered ? 1 : 0 }}
        >
          <motion.div
            className="absolute inset-0"
            style={{ background: glare, mixBlendMode: "soft-light" }}
          />
          {/* specular refraction along the slab border */}
          <motion.div
            className="absolute inset-0 rounded-[inherit] border border-transparent"
            style={{
              background: edgeGlow,
              maskImage:
                "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              maskComposite: "exclude",
              padding: "1px",
            }}
          />
        </motion.div>
      )}
    </motion.div>
  );
}
