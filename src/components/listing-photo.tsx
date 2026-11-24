"use client";

/*
 * A listing photo at the size it is shown. Agencies publish full-size originals
 * (often 500 KB or more), so known agency sites and our own uploads go through
 * the site's image resizer in one of two widths, which keeps the number of
 * stored copies low. Anything else, or a resize that fails, shows the original.
 */

import Image from "next/image";
import { useState } from "react";
import { PHOTO_HOSTS } from "@/lib/photo-hosts";

/** The two widths we make: list thumbnails and cards. Both are Next's default widths. */
const THUMB = 256;
const CARD = 828;

function resizable(url: URL) {
  if (url.protocol !== "https:") return false;
  if (url.hostname.endsWith(".supabase.co")) return url.pathname.startsWith("/storage/v1/object/public/");
  return PHOTO_HOSTS.some((h) => h.hostname === url.hostname && url.pathname.startsWith(h.pathname.replace("**", "")));
}

/** Address of `src` sized for a w × h box (sharp on high-density screens). */
export function photoSrc(src: string, w: number, h: number): string {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return src;
  }
  if (url.hostname === "images.unsplash.com") return `${src}?auto=format&fit=crop&w=${w * 2}&h=${h * 2}&q=60`;
  // Framer-built agency sites resize their own images
  if (url.hostname === "framerusercontent.com" && url.pathname.startsWith("/images/")) return `${src}?scale-down-to=${w * 2 <= 512 ? 512 : 1024}`;
  if (!resizable(url)) return src; // includes photos still in the browser (data: URLs)
  return `/_next/image?url=${encodeURIComponent(src)}&w=${w * 2 <= THUMB ? THUMB : CARD}&q=75`;
}

export function ListingPhoto({
  src,
  alt,
  w,
  h,
  className,
  style,
}: {
  src: string;
  alt: string;
  /** Size it is shown at, in CSS pixels. */
  w: number;
  h: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [failed, setFailed] = useState<{ src: string; times: number } | null>(null);
  const times = failed?.src === src ? failed.times : 0;
  const sized = photoSrc(src, w, h);
  // the photo is gone from the agency's site: a plain box, not a broken-image icon
  if (times >= (sized === src ? 1 : 2))
    return <span role="img" aria-label={alt} className={`block bg-zinc-200 ${className ?? ""}`} style={{ width: className?.includes("w-") ? undefined : w, height: className?.includes("h-") ? undefined : h, ...style }} />;
  return (
    <Image
      src={times ? src : sized}
      alt={alt}
      width={w}
      height={h}
      unoptimized // already sized by photoSrc
      onError={() => setFailed({ src, times: times + 1 })}
      className={className}
      style={style}
    />
  );
}
