import Image from "next/image";

/*
 * Sequence Data brand marks, cut from public/brand/sequence-data-logo.jpg.
 *  - sd-head-*.png : solid head silhouette, for small sizes (nav, icons)
 *  - sd-logo-*.png : head with "SD Sequence Data / Aruba Real Estate Intel" knocked out, for large sizes
 * Brand accent: mint #DDE5DC (Tailwind: bg-mint / text-mint), always paired with black.
 */

type Tone = "black" | "white";

/** Head silhouette. Size it with a height class, e.g. "h-7 w-auto". */
export function SequenceMark({ className = "h-7 w-auto", tone = "black" }: { className?: string; tone?: Tone }) {
  return <Image src={`/brand/sd-head-${tone}.png`} alt="" width={192} height={256} className={className} priority />;
}

/** Full logo with the wordmark inside the head. Size with a height class. */
export function SequenceLogo({ className = "h-40 w-auto", tone = "black" }: { className?: string; tone?: Tone }) {
  return <Image src={`/brand/sd-logo-${tone}.png`} alt="Sequence Data, Aruba Real Estate Intel" width={677} height={900} className={className} />;
}

/** Head + "Sequence Data" wordmark, for headers and footers. */
export function Wordmark({ tone = "black", tagline = false }: { tone?: Tone; tagline?: boolean }) {
  const text = tone === "black" ? "text-zinc-950" : "text-white";
  return (
    <span className="flex items-center gap-2.5">
      <SequenceMark tone={tone} className="h-8 w-auto" />
      <span className="leading-none">
        <span className={`block whitespace-nowrap text-[17px] font-medium tracking-tight ${text}`}>Sequence Data</span>
        {tagline && (
          <span className={`mt-1 block whitespace-nowrap text-[9px] font-medium uppercase tracking-[0.12em] ${tone === "black" ? "text-zinc-500" : "text-zinc-400"}`}>
            Aruba Real Estate Intel
          </span>
        )}
      </span>
    </span>
  );
}
