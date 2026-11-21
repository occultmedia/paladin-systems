import Image from "next/image";

/*
 * Brand: the product is "Sequence Terminal", powered by Sequence Data.
 *  - sd-lockup-*.png   : "SD | Sequence Data" lockup (from public/brand/sequence-data-logo-2026.webp)
 *  - sd-monogram-*.png : the SD monogram alone
 *  - sd-icon.png       : white SD on black square (favicon / app icon)
 *  - sd-head-*.png / sd-logo-*.png : older head silhouette marks (still used on 404 / error)
 * Brand accent: mint #DDE5DC (Tailwind: bg-mint / text-mint), always paired with black.
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
 * Sequence Terminal mark: a command prompt chevron with a block cursor.
 * Hard angles, square caps, mitred joins. The cursor blinks slowly
 * (motion-safe only).
 */
export function TerminalGlyph({ tone = "black", className = "size-[22px]", blink = true }: { tone?: Tone; className?: string; blink?: boolean }) {
  const fg = tone === "black" ? "#0A0A0A" : "#FFFFFF";
  const cursor = tone === "black" ? "#0A0A0A" : "#DDE5DC";
  return (
    <svg viewBox="0 0 24 24" className={`${className} shrink-0`} aria-hidden fill="none" strokeLinecap="square" strokeLinejoin="miter">
      <path d="M3 5.5l7 6.5-7 6.5" stroke={fg} strokeWidth="2.6" />
      <rect x="12.5" y="16.2" width="9" height="2.8" fill={cursor} className={blink ? "motion-safe:animate-[st-cursor_1.2s_steps(1)_infinite]" : undefined} />
    </svg>
  );
}

/** "Sequence Terminal" wordmark (stacked), with an optional "Powered by Sequence Data" line. */
export function Wordmark({ tone = "black", tagline = false }: { tone?: Tone; tagline?: boolean }) {
  const text = tone === "black" ? "text-zinc-950" : "text-white";
  const muted = tone === "black" ? "text-zinc-500" : "text-zinc-400";
  return (
    <span className="flex items-center gap-2.5">
      <TerminalGlyph tone={tone} />
      <span className="leading-none">
        <span className={`block whitespace-nowrap font-display text-[17px] font-bold uppercase tracking-[0.2em] ${text}`}>Sequence</span>
        <span className={`mt-[3px] block whitespace-nowrap font-display text-[9.5px] font-semibold uppercase tracking-[0.62em] ${muted}`}>Terminal</span>
        {tagline && (
          <span className={`mt-1.5 flex items-center gap-1.5 whitespace-nowrap text-[8.5px] font-medium uppercase tracking-[0.14em] ${muted}`}>
            Powered by
            <SequenceMonogram tone={tone} className="h-[9px] w-auto" />
            <span className={tone === "black" ? "text-zinc-800" : "text-zinc-200"}>Sequence Data</span>
          </span>
        )}
      </span>
    </span>
  );
}
