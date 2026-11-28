import Image from "next/image";

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
export function BaselineLogo({ tone = "black", size = 19, className = "" }: { tone?: Tone; size?: number; className?: string }) {
  const ink = tone === "black" ? "#0A0A0A" : "#FFFFFF";
  const tracking = 0.3; // letter spacing; the last letter's is taken back so the line ends with the E
  const stroke = Math.max(1.5, Math.round((size / 9.5) * 2) / 2);
  const h = Math.round(size * 1.75); // house height, roof tip to the line
  const w = Math.round(size * 1.8); // house width, foot to foot
  const s2 = stroke / 2;
  // In px: starts on the line, up the left wall, over the roof, down the right wall, back to the line.
  const lead = Math.round(size * 0.32);
  const house = `M0 ${h - s2} H${lead} V${Math.round(h * 0.38)} L${lead + w / 2} ${s2 + 0.5} L${lead + w} ${Math.round(h * 0.38)} V${h - s2}`;
  return (
    <span className={`inline-flex items-end leading-none ${className}`} aria-label="Baseline" role="img">
      <svg width={lead + w} height={h} viewBox={`0 0 ${lead + w} ${h}`} fill="none" aria-hidden className="shrink-0 overflow-visible">
        <path d={house} stroke={ink} strokeWidth={stroke} strokeLinejoin="miter" strokeLinecap="butt" />
      </svg>
      <span aria-hidden className="flex flex-col">
        <span
          className="font-[family-name:var(--font-wordmark)] font-semibold uppercase"
          style={{
            fontSize: size,
            letterSpacing: `${tracking}em`,
            marginRight: `-${tracking}em`,
            paddingLeft: Math.round(size * 0.62),
            color: ink,
            lineHeight: 1,
          }}
        >
          Baseline
        </span>
        <span className="block" style={{ height: stroke, marginTop: Math.round(size * 0.5), background: ink }} />
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
