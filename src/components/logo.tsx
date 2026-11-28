"use client";

import Image from "next/image";
import { useLayoutEffect, useRef, useState } from "react";

/*
 * Brand: the product is "Baseline" (named Terminal until 28 Nov 2026), powered by Sequence Data.
 * Logo: one line that rises into a house outline and runs on under BASELINE (BaselineLogo).
 *  - sd-lockup-*.png   : "SD | Sequence Data" lockup (from public/brand/sequence-data-logo-2026.webp)
 *  - sd-monogram-*.png : the SD monogram alone
 *  - sd-icon.png       : white SD on black square (favicon / app icon)
 *  - sd-head-*.png / sd-logo-*.png : older head silhouette marks (still used on 404 / error)
 * Brand: white, clinical surfaces; black and lime #ACFA68 (bg-lime / text-lime) are the only accents.
 */

type Tone = "black" | "white";

/** Old head silhouette. Size it with a height class, e.g. "h-7 w-auto". */
export function SequenceMark({ className = "h-7 w-auto", tone = "black" }: { className?: string; tone?: Tone }) {
  return <Image src={`/brand/sd-head-${tone}.png`} alt="" width={192} height={256} className={className} priority />;
}

/** Old full logo with the wordmark inside the head. Size with a height class. */
export function SequenceLogo({ className = "h-40 w-auto", tone = "black" }: { className?: string; tone?: Tone }) {
  return <Image src={`/brand/sd-logo-${tone}.png`} alt="Sequence Data, Aruba Real Estate Intel" width={677} height={900} className={className} />;
}

/** "SD | Sequence Data" lockup. Size with a height class. */
export function SequenceLockup({ className = "h-5 w-auto", tone = "black" }: { className?: string; tone?: Tone }) {
  return <Image src={`/brand/sd-lockup-${tone}.png`} alt="Sequence Data" width={1000} height={224} className={className} />;
}

/** The SD monogram on its own. */
export function SequenceMonogram({ className = "h-6 w-auto", tone = "black" }: { className?: string; tone?: Tone }) {
  return <Image src={`/brand/sd-monogram-${tone}.png`} alt="" width={777} height={387} className={className} priority />;
}

/**
 * The Baseline logo (28 November 2026): one unbroken line that rises into a
 * house outline and runs on as the rule under BASELINE, set in letter-spaced
 * Inter Tight capitals. All in one ink: black on light, white on dark.
 *
 * `size` is the type size in px; the house, the line and the gaps scale with it.
 */
export function BaselineLogo({ tone = "black", size = 19, run = true, className = "" }: { tone?: Tone; size?: number; run?: boolean; className?: string }) {
  // light grey line and name (28 November 2026): quiet, still readable on white (#8E9299) and on dark (#D4D4D8)
  const ink = tone === "black" ? "#8E9299" : "#D4D4D8";
  const tracking = 0.3; // letter spacing; the last letter's is taken back so the line ends with the E
  const stroke = Math.max(1.5, Math.round((size / 9.5) * 2) / 2);
  const h = Math.round(size * 1.75); // house height, roof tip to the line
  const w = Math.round(size * 1.8); // house width, foot to foot
  const lead = Math.round(size * 0.32);
  const gap = Math.round(size * 0.62);
  const s2 = stroke / 2;
  const base = h - s2;

  // The line runs under the whole name: measure it (a first guess before the font is laid out).
  const textRef = useRef<HTMLSpanElement>(null);
  const [textW, setTextW] = useState(() => Math.round(size * 8 * 0.95));
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const measure = () => setTextW(Math.round(el.getBoundingClientRect().width));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => ro.disconnect();
  }, [size]);
  const total = lead + w + gap + textW;

  // One path: along the line, up the left wall, over the roof, down the right wall, on under the name.
  const d = `M0 ${base} H${lead} V${Math.round(h * 0.38)} L${lead + w / 2} ${s2 + 0.5} L${lead + w} ${Math.round(h * 0.38)} V${base} H${total}`;
  return (
    <span className={`relative inline-flex items-end leading-none ${className}`} style={{ height: h }} aria-label="Baseline" role="img">
      <svg
        width={total}
        height={h}
        viewBox={`0 0 ${total} ${h}`}
        fill="none"
        aria-hidden
        className="baseline-logo-line absolute bottom-0 left-0 overflow-visible"
      >
        <path d={d} stroke={ink} strokeWidth={stroke} strokeLinejoin="miter" pathLength={1000} />
        {run && (
          // the brand's running light: a lime comet along the line (still when motion is reduced)
          <g className="baseline-logo-run" strokeLinejoin="miter" strokeLinecap="round" fill="none">
            <path d={d} pathLength={1000} stroke="#ACFA68" strokeWidth={stroke * 3} className="blur l140" />
            <path d={d} pathLength={1000} stroke="rgb(150 232 84 / 0.55)" strokeWidth={stroke} className="l220" />
            <path d={d} pathLength={1000} stroke="#ACFA68" strokeWidth={stroke} className="l110" />
            <path d={d} pathLength={1000} stroke="#E9FFD2" strokeWidth={stroke * 1.15} className="l22" />
          </g>
        )}
      </svg>
      <span
        ref={textRef}
        aria-hidden
        className="relative font-[family-name:var(--font-wordmark)] font-semibold uppercase"
        style={{
          fontSize: size,
          letterSpacing: `${tracking}em`,
          marginRight: `-${tracking}em`,
          marginLeft: lead + w + gap,
          marginBottom: Math.round(size * 0.5) + stroke,
          color: ink,
          lineHeight: 1,
        }}
      >
        Baseline
      </span>
    </span>
  );
}

/**
 * The header wordmark, plus an optional "Powered by Sequence Data" line.
 */
export function Wordmark({ tone = "black", tagline = false }: { tone?: Tone; tagline?: boolean }) {
  const muted = tone === "black" ? "text-zinc-500" : "text-zinc-400";
  return (
    <span className="inline-block leading-none">
      <BaselineLogo tone={tone} size={14} />
      {tagline && (
        <span className={`mt-2 flex items-center gap-1.5 whitespace-nowrap text-[8.5px] font-medium uppercase tracking-[0.14em] ${muted}`}>
          Powered by
          <SequenceMonogram tone={tone} className="h-[9px] w-auto" />
          <span className={tone === "black" ? "text-zinc-800" : "text-zinc-200"}>Sequence Data</span>
        </span>
      )}
    </span>
  );
}
