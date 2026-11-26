"use client";

/*
 * Brand backdrop: a grainy lime-to-black gradient with slow-drifting light
 * particles. The gradient and grain are CSS; the particles are one small
 * canvas that only animates while it is on screen and stays still for
 * prefers-reduced-motion. Place it as the first child of a `relative
 * overflow-hidden` container; it sits behind everything (-z-0, pointer-events
 * off).
 */

import { useEffect, useRef } from "react";

type Variant = "rise" | "corner" | "band" | "ink";

function Particles({ density = 0.00009 }: { density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = 0;
    let h = 0;
    let dots: Array<{ x: number; y: number; r: number; vy: number; vx: number; a: number; tw: number; lime: boolean }> = [];
    const seed = () => {
      const n = Math.max(24, Math.round(w * h * density));
      dots = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() < 0.85 ? 0.6 + Math.random() * 0.9 : 1.6 + Math.random() * 1.2,
        vy: -(0.06 + Math.random() * 0.22),
        vx: (Math.random() - 0.5) * 0.08,
        a: 0.25 + Math.random() * 0.6,
        tw: Math.random() * Math.PI * 2,
        lime: Math.random() < 0.55,
      }));
    };
    const size = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const d of dots) {
        if (!still) {
          d.y += d.vy;
          d.x += d.vx;
          if (d.y < -4) {
            d.y = h + 4;
            d.x = Math.random() * w;
          }
          if (d.x < -4) d.x = w + 4;
          if (d.x > w + 4) d.x = -4;
        }
        const twinkle = still ? 1 : 0.65 + 0.35 * Math.sin(t / 900 + d.tw);
        ctx.globalAlpha = d.a * twinkle;
        ctx.fillStyle = d.lime ? "#C8FF94" : "#FFFFFF";
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
        if (d.r > 1.5) {
          // a soft halo on the few larger particles
          ctx.globalAlpha = d.a * twinkle * 0.18;
          ctx.beginPath();
          ctx.arc(d.x, d.y, d.r * 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    };

    let raf = 0;
    let running = false;
    const loop = (t: number) => {
      draw(t);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (running || still) return;
      running = true;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    size();
    draw(0);
    const ro = new ResizeObserver(() => {
      size();
      draw(performance.now());
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { threshold: 0 });
    io.observe(canvas);
    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
    };
  }, [density]);

  return <canvas ref={ref} aria-hidden className="absolute inset-0 size-full" />;
}

export function GrainField({ variant = "rise", className = "", particles = true }: { variant?: Variant; className?: string; /** false: no floating specks (inside the app) */ particles?: boolean }) {
  const glow = {
    // lime rising from the bottom centre, ink at the top (hero window backdrop)
    rise: "radial-gradient(150% 115% at 50% 100%, #ACFA68 0%, #8ED653 16%, #4C7F24 34%, #1D2C10 56%, #0B0D08 82%)",
    // lime from the bottom-right corner (closing band)
    corner: "radial-gradient(90% 120% at 100% 110%, #ACFA68 0%, #5E9A33 20%, #22380F 42%, #0F140A 66%, #0A0B08 100%)",
    // a wide, low lime light under a dark band; text on top stays white-on-dark (dashboard page headers)
    band: "radial-gradient(70% 140% at 78% 135%, #ACFA68 0%, #6BAE3B 18%, #2A4515 40%, #111709 64%, #0A0B08 88%)",
    // no lime, just ink with grain and particles (top bars, panels, small cards)
    ink: "linear-gradient(#0A0B08, #0A0B08)",
  }[variant];
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <div className="absolute inset-0" style={{ background: glow }} />
      {/* a second, softer light so the gradient never looks flat */}
      {variant !== "ink" && (
        <div className="absolute inset-0 opacity-60 mix-blend-screen" style={{ background: "radial-gradient(60% 50% at 18% 0%, rgb(172 250 104 / 0.16), transparent 70%)" }} />
      )}
      {particles && <Particles density={variant === "ink" ? 0.00006 : 0.00009} />}
      {/* film grain over everything */}
      <div className="hero-grain absolute inset-0 opacity-[0.55] mix-blend-overlay" />
      <div className="hero-grain absolute inset-0 opacity-[0.12]" />
    </div>
  );
}
