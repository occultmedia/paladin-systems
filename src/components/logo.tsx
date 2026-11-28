import Image from "next/image";

/*
 * Brand: the product is "Baseline" (named Terminal until 28 Nov 2026), powered by Sequence Data.
 * Logo: the name on a rule (BaselineLogo); no icon.
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
 * The Baseline logo ("The rule", since 28 November 2026): the name set in
 * Inter Tight, standing on a straight rule, the baseline itself, with a
 * short lime mark where the line starts. No icon.
 *
 * `size` is the type size in px; the rule and gap scale with it.
 */
export function BaselineLogo({ tone = "black", size = 19, className = "" }: { tone?: Tone; size?: number; className?: string }) {
  const ink = tone === "black" ? "#0A0A0A" : "#FFFFFF";
  const rule = Math.max(2, Math.round(size / 9));
  return (
    <span className={`inline-flex flex-col leading-none ${className}`} aria-label="Baseline">
      <span
        aria-hidden
        className="font-[family-name:var(--font-wordmark)] font-bold"
        style={{ fontSize: size, letterSpacing: "-0.035em", color: ink, lineHeight: 1 }}
      >
        Baseline
      </span>
      <span aria-hidden className="relative block" style={{ height: rule, marginTop: Math.round(size * 0.2), background: ink }}>
        <span className="absolute inset-y-0 left-0 bg-lime" style={{ width: Math.round(size * 0.7) }} />
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
      <BaselineLogo tone={tone} size={21} />
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
