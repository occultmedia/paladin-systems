# Paladin Systems

Marketing site for Paladin Systems: AI assistants for Aruban businesses that
answer customers on WhatsApp, check availability, and collect deposits with
secure payment links, 24/7.

Built with Next.js (App Router), TypeScript, Tailwind CSS v4, and Framer
Motion. Fully static output; all fonts, photos, and logos are self-hosted.

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
