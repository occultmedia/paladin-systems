# Sequence Data

Aruba Real Estate Market Intelligence. Sequence Data scrapes every
high-value property and land listing in Aruba daily, plus vacation-rental
data, and shows what is for sale, what it would earn, and whether the
price is right. For real estate agents and investors ($150/month).

- `/` landing page
- `/dashboard` Active Listings (list + map), Districts, Revenue Estimator, Rental Market
- Data layer and mock data: `src/lib/aruba-data.ts` (swap `repository` for Supabase)

Built with Next.js (App Router), TypeScript, Tailwind CSS v4, Recharts and
Leaflet. Listing photos are Unsplash placeholders until the scraper stores real ones.

## Commands

```bash
npm run dev     # dev server
npm run build   # production build
npm run start   # serve the production build
npm run lint    # eslint
```

## Before launch

- [ ] Set the real domain in `src/lib/site.ts` (SITE_URL) for canonical URLs,
      sitemap, and Open Graph.
- [ ] Replace the placeholder contact email (`CONTACT_EMAIL` in
      `src/lib/site.ts` and the mailto link in
      `src/components/audit-cta.tsx`), or swap in a WhatsApp contact link.
- [ ] Replace placeholder case-study metrics in
      `src/components/case-studies.tsx` with client-verified numbers.
- [ ] Replace the placeholder photo in `src/assets/` with real brand
      photography (same filename keeps everything wired).
