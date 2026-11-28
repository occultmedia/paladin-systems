import Image from "next/image";

/*
 * Brand: the product is "Baseline" (named Terminal until 28 Nov 2026), powered by Sequence Data.
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
 * The Baseline mark: a house whose wall rises into a price line, over a
 * baseline. Drawn in currentColor; the small accent is lime on dark only.
 */
export function BaselineMark({ className = "h-5 w-auto", accent = false }: { className?: string; accent?: boolean }) {
  return (
    <svg viewBox="0 0 100 60" className={className} fill="none" stroke="currentColor" strokeWidth={5.5} strokeLinecap="butt" strokeLinejoin="miter" aria-hidden>
      <path d="M18 47V25.5L43.5 8l16.5 12" />
      <path d="M15.5 54.5L41.5 29l8 8L86 2" />
      <path d="M0 55.5h100" />
      {accent && <path d="M45.6 27.4a5 5 0 0 1 7.6 0L49.4 31z" fill="#ACFA68" stroke="none" />}
    </svg>
  );
}

/**
 * "Baseline" wordmark: the mark and the name in bold caps, plus an
 * optional "Powered by Sequence Data" line.
 */
export function Wordmark({ tone = "black", tagline = false }: { tone?: Tone; tagline?: boolean }) {
  const text = tone === "black" ? "text-zinc-950" : "text-white";
  const muted = tone === "black" ? "text-zinc-500" : "text-zinc-400";
  return (
    <span className="inline-block leading-none">
      <span className={`flex items-end gap-2 whitespace-nowrap font-display text-[19px] font-bold uppercase tracking-[0.2em] ${text}`}>
        <BaselineMark className="mb-[1px] h-[19px] w-auto" accent={tone === "white"} />
        Baseline
      </span>
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
