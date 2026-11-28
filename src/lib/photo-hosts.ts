/*
 * Sites whose listing photos the image resizer may fetch (next.config.ts) and
 * ListingPhoto sends through it. Add one line per agency when its spider is
 * added; photos from any other site still show, just at their original size.
 */
export const PHOTO_HOSTS = [
  { hostname: "kw-aruba.com", pathname: "/storage/app/uploads/public/**" },
  { hostname: "remaxaruba.com", pathname: "/storage/app/uploads/public/**" },
  { hostname: "www.coldwellbanker.aw", pathname: "/images/listing_photos/**" },
  { hostname: "mpgaruba.com", pathname: "/storage/app/uploads/public/**" },
  { hostname: "www.bhhsaruba.com", pathname: "/storage/app/uploads/public/**" },
  // Not weichertaruba.com: its Cloudflare refuses Vercel's resizer (HTTP 502), so its
  // photos load directly; the spider picks WordPress's own resized copy instead.
] as const;
