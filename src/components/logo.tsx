import Image from "next/image";

/*
 * Brand: the product is "Tide", powered by Sequence Data.
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
 * Tide mark: a targeting reticle (four corner brackets) locked onto two
 * tide lines, with a lock marker on the leading crest. Hard angles, square
 * caps, mitred joins: built to read like an instrument, not a toy.
 */
export function TideGlyph({ tone = "black", className = "size-[22px]" }: { tone?: Tone; className?: string }) {
  const fg = tone === "black" ? "#0A0A0A" : "#FFFFFF";
  const lock = tone === "black" ? "#0A0A0A" : "#DDE5DC";
  return (
    <svg viewBox="0 0 24 24" className={`${className} shrink-0`} aria-hidden fill="none" strokeLinecap="square" strokeLinejoin="miter">
      {/* reticle */}
      <path d="M1.5 6.5v-5h5M17.5 1.5h5v5M22.5 17.5v5h-5M6.5 22.5h-5v-5" stroke={fg} strokeWidth="1.6" />
      {/* tide lines */}
      <path d="M5 12.5l3.5-3.5 3.5 3.5 3.5-3.5 3.5 3.5" stroke={fg} strokeWidth="2" />
      <path d="M5 17l3.5-3.5L12 17l3.5-3.5L19 17" stroke={fg} strokeWidth="2" opacity="0.4" />
      {/* target lock */}
      <rect x="14.6" y="4.4" width="1.8" height="1.8" fill={lock} />
    </svg>
  );
}

/** "Tide" product wordmark, with an optional "Powered by Sequence Data" line. */
export function Wordmark({ tone = "black", tagline = false, compactOnMobile = false }: { tone?: Tone; tagline?: boolean; compactOnMobile?: boolean }) {
  const text = tone === "black" ? "text-zinc-950" : "text-white";
  const muted = tone === "black" ? "text-zinc-500" : "text-zinc-400";
  return (
    <span className="flex items-center gap-2.5">
      <TideGlyph tone={tone} />
      <span className="leading-none">
        <span className={`block whitespace-nowrap font-display text-[19px] font-bold uppercase tracking-[0.2em] ${text}`}>Tide</span>
        {tagline && (
          <span className={`mt-1 ${compactOnMobile ? "hidden sm:flex" : "flex"} items-center gap-1.5 whitespace-nowrap text-[8.5px] font-medium uppercase tracking-[0.14em] ${muted}`}>
            Powered by
            <SequenceMonogram tone={tone} className="h-[9px] w-auto" />
            <span className={tone === "black" ? "text-zinc-800" : "text-zinc-200"}>Sequence Data</span>
          </span>
        )}
      </span>
    </span>
  );
}
