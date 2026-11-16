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

/** Signal signal-bars glyph: three rising bars, the last one live. */
function SignalGlyph({ tone }: { tone: Tone }) {
  const fg = tone === "black" ? "#0A0A0A" : "#FFFFFF";
  return (
    <svg viewBox="0 0 24 24" className="size-[22px] shrink-0" aria-hidden>
      <rect x="2" y="13" width="5" height="9" rx="1" fill={fg} opacity="0.35" />
      <rect x="9.5" y="7.5" width="5" height="14.5" rx="1" fill={fg} opacity="0.65" />
      <rect x="17" y="2" width="5" height="20" rx="1" fill={fg} />
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
        <span className={`block whitespace-nowrap font-display text-[20px] font-bold tracking-tight ${text}`}>Signal</span>
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
