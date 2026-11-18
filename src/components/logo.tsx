import Image from "next/image";

/*
 * Brand: the product is "Signal", powered by Sequence Data.
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
 * Signal mark: a sharp signal pulse off a faint baseline, with a lock marker
 * over the peak. Hard angles, square caps, mitred joins.
 */
export function SignalGlyph({ tone = "black", className = "size-[22px]" }: { tone?: Tone; className?: string }) {
  const fg = tone === "black" ? "#0A0A0A" : "#FFFFFF";
  const lock = tone === "black" ? "#0A0A0A" : "#DDE5DC";
  return (
    <svg viewBox="0 0 24 24" className={`${className} shrink-0`} aria-hidden fill="none" strokeLinecap="square" strokeLinejoin="miter">
      <path d="M1 14h22" stroke={fg} strokeWidth="1.3" opacity="0.3" />
      <path d="M1.5 14h4.5l2.5-6.5 4 13.5 3-10 2 3h5" stroke={fg} strokeWidth="2.4" />
      <rect x="7.4" y="1" width="2.2" height="2.2" fill={lock} />
    </svg>
  );
}

/** "Signal" product wordmark, with an optional "Powered by Sequence Data" line. */
export function Wordmark({ tone = "black", tagline = false }: { tone?: Tone; tagline?: boolean }) {
  const text = tone === "black" ? "text-zinc-950" : "text-white";
  const muted = tone === "black" ? "text-zinc-500" : "text-zinc-400";
  return (
    <span className="flex items-center gap-2.5">
      <SignalGlyph tone={tone} />
      <span className="leading-none">
        <span className={`block whitespace-nowrap font-display text-[19px] font-bold uppercase tracking-[0.2em] ${text}`}>Signal</span>
        {tagline && (
          <span className={`mt-1 flex items-center gap-1.5 whitespace-nowrap text-[8.5px] font-medium uppercase tracking-[0.14em] ${muted}`}>
            Powered by
            <SequenceMonogram tone={tone} className="h-[9px] w-auto" />
            <span className={tone === "black" ? "text-zinc-800" : "text-zinc-200"}>Sequence Data</span>
          </span>
        )}
      </span>
    </span>
  );
}
