/*
 * Sites whose listing photos the image resizer may fetch (next.config.ts) and
 * ListingPhoto sends through it. Add one line per agency when its spider is
 * added; photos from any other site still show, just at their original size.
 */
export const PHOTO_HOSTS = [
  { hostname: "kw-aruba.com", pathname: "/storage/app/uploads/public/**" },
  { hostname: "remaxaruba.com", pathname: "/storage/app/uploads/public/**" },
] as const;
