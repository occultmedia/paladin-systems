# Terminal spider fleet (Level 1 ingestion)

Reads agency websites and upserts what it finds into Supabase `raw_listings`
(one row per listing URL). The normaliser (`normalise.py`) then turns `raw_listings` into
`property_master`, which the dashboard reads.

```
scraper/
  requirements.txt
  env.example                 copy to .env and fill in (gitignored)
  terminal_spider/
    base.py                   BaseSpider: politeness, robots.txt, what to open tonight, records, Supabase upserts
    fetch.py                  HttpEngine (fast, default) and BrowserEngine (Playwright, for sites that need scripts)
    doc.py                    Doc: a parsed page; a missing element is None, never an error
    kw_aruba.py               KWArubaSpider: selectors for kw-aruba.com only
    all_property_aruba.py     AllPropertyArubaSpider: selectors for allpropertyaruba.com only
    remax_aruba.py            RemaxArubaSpider: selectors for remaxaruba.com only (crawled with RE/MAX's consent, see its header)
    bold_aruba.py             BoldArubaSpider: bold.realestate, Aruba sales only (reads the property sitemap)
    normalise.py              raw_listings -> property_master (runs at the end of every crawl)
    signals.py                Below market / At market / Above market (run by normalise.py)
    parsing.py                "USD 3.900.000" -> 3900000, "10 bedroom(s)" -> 10, currency, Cloudflare e-mails
    __init__.py               SPIDERS registry
    __main__.py               command line + the scrape_runs row
```

## Setup (macOS, once)

```bash
cd ~/paladin-systems/scraper
```

```bash
python3 -m venv .venv
```

```bash
source .venv/bin/activate
```

```bash
pip install -r requirements.txt
```

```bash
python -m playwright install chromium
```

The last step is only needed for spiders with `engine = "browser"`. Then:

```bash
cp env.example .env
```

and paste the **service_role / secret** key from Supabase → Project Settings →
API Keys into `SUPABASE_SERVICE_KEY` in `.env`. That key bypasses row-level
security: keep it in `.env` or the job runner's secrets only, never in Vercel,
the frontend, git or a chat.

## Run

Test without writing anything (reads 3 listings, about 2 minutes):

```bash
python -m terminal_spider kw-aruba --dry-run --limit 3 --out out/dry-run.json
```

Real run, every spider, writing to Supabase:

```bash
python -m terminal_spider
```

Options: `--limit N`, `--start-url URL` (only that index page),
`--refresh-days N` (re-read unchanged listings every N days, default 7),
`--jobs N` (agencies at the same time, default 6), `--no-normalise`,
`--headed` (watch the browser), `-v` (debug log).

## What one run does

1. Inserts a `scrape_runs` row (status `running`).
2. Per spider: upserts its `agencies` row (keeps an existing logo), reads
   robots.txt, then opens the index pages and collects every listing card.
3. For each card it decides:
   - **new listing, card changed, or full read older than `refresh_days`** →
     opens the listing page and upserts the full row;
   - **otherwise** → upserts only `last_scraped_at` / `last_run_id`
     ("still listed"), which is what keeps its Confidence Score up.
4. Upserts match on `source_url`, so nightly runs never duplicate a listing.
   The `raw_listings_delta` trigger re-queues a row for normalising only when
   its `content_hash` changed.
5. Closes the `scrape_runs` row with the counts (new / changed / unchanged).

Listings that disappear from the site are not deleted: their
`last_scraped_at` stops moving and the Confidence Score drops them.

## Value signal

`signals.py`, run at the end of every crawl. Two separate checks (nearest
similar homes, price model); a home is Below market or Above market only when
both put its asking price 20% or more away. Land, commercial, homes not for
sale, fixer-uppers, several homes in one, homes without a size and homes with
too few similar ones nearby get no signal (`comps_count` 0).

## Speed

A run takes as long as its slowest site, because agencies are crawled side by
side (`--jobs`, default 6). Each site is still read one page at a time. What
makes it quick:

- **HTTP engine.** One small request per page instead of a whole browser.
- **Few pages.** New and changed listings are opened; unchanged ones are only
  marked "still listed". Re-reads rotate: 1/`refresh_days` of a site per
  night, oldest first. Sold listings are not re-read while they stay sold.
- **No extra waiting.** robots.txt `Crawl-delay` is kept exactly, plus up to
  one random second; sites without one get 2-4 seconds.

Measured 24 Nov 2026: KW Aruba (186 listings) and All Property Aruba (11) took
2.1 minutes together. KW's 20-second Crawl-delay sets that time: 5 index pages
plus the pages opened. On the nights re-reads are due, add about 7 minutes.

## Politeness and blocking

- Before adding an agency, read its terms and privacy pages as well as
  robots.txt. If they ask for written permission, get it first and note it at
  the top of the spider.
- robots.txt is read every run; Disallow rules and `Crawl-delay` are honoured.
  Do not lower a site's delay to go faster.
- HTTP 403/429/503 → backs off (60 s, 120 s, 180 s). A Cloudflare/CAPTCHA
  challenge page stops that agency's run and is recorded in
  `scrape_runs.error`. The spider does **not** try to get around blocks or
  solve challenges: if a site blocks us, look at it by hand (or ask the
  agency for a feed).
- A listing page that fails to load keeps what was read before and is tried
  again the next night.

## KW Aruba selectors (kw-aruba.com, checked 23 Nov 2026)

Index pages (each shows a whole category on one page; no pagination today):
`/listings/for-sale/residential`, `/condominium-townhouse`, `/land`,
`/commercial`, `/new-development`. Only the buy section is crawled; rental pages (`/listings/for-rent/`) are never opened.

| Field | Selector | Example |
|---|---|---|
| card | `div.card:has(> a.card__overlay[href^="/listings/"])` | |
| source_url | `a.card__overlay` `@href` | `/listings/malmokweg-29` |
| title | `.card__heading` | Malmokweg 29 |
| district | `.card__location` | Malmok |
| price | `.card__price` | USD 3.900.000 (AWG 6.942.000) |
| label | `.card__label` (optional) | New Listing, Reduced in price, Under contract, Sale in Progress, On Hold, Sold |
| size / beds | `.card__options .option__value` | 1078 m², 10 bedroom(s) |
| next page | `a[rel="next"], .pagination a.next, .pagination__next a` | (none today) |

Listing page:

| Field | Selector |
|---|---|
| raw_address / raw_title | `h1.page-property-details__heading` |
| raw_district | `.page-property-details__location` |
| raw_property_type | `.page-property-details__type` ("For Sale - Residential" → "Residential") |
| raw_price, raw_currency | `.page-property-details__price` (first amount and currency) |
| raw_status | `.page-property-details__status` (Under contract / Sale in Progress / On Hold / Sold; anything else = For sale) |
| raw_beds | `#features table` row "Bedrooms", else `.page-property-details__options .option__value` "N bedroom(s)" |
| raw_baths | `#features table` "Full bathrooms" + 0.5 × "Half bathrooms", else "N bathroom(s)" |
| raw_lot_area / raw_built_area | `#features table` "Land size" / "Build up size" (empty values → null) |
| raw_description | `#description .wysiwyg` |
| raw_photos | main photo only: first `a[data-fancybox="gallery"]` `@href` (full size), else the card photo |
| raw_agent | `.card-agent__name-link`, `.card-agent__position`, `a.card-agent__phone`, `a.card-agent__email` |
| raw_lat / raw_lng | inline map script `latLng: { lat: …, lng: … }` |

On land, a "Bedrooms 0" in the table is stored as null (not applicable).

## How the standard record maps to `raw_listings`

| Brief field | Column | Stored as |
|---|---|---|
| source_url | `source_url` (unique, upsert key) | full URL |
| source_website | `agency_id` = `kw-aruba`, plus `raw_payload.source_website` | `kw-aruba.com` |
| raw_price | `raw_price` | digits only, e.g. `3900000` (column is text); the printed price is kept in `raw_payload.price_text`, currency in `raw_currency` |
| raw_beds | `raw_beds` | `10` |
| raw_baths | `raw_baths` | `7.5` |
| raw_address | `raw_address` | title or street |
| last_scraped_at | `last_scraped_at` | ISO timestamp of the run |

## Adding an agency

1. Copy `kw_aruba.py` to `<agency>.py`; set `agency_id` (slug, lowercase),
   `agency_name`, `website`, `start_urls`.
2. Rewrite `parse_index` and `parse_detail` with that site's selectors. They
   get a `Doc`; its `text / texts / attr / attrs / block_text / table` return
   None or an empty list when an element is missing.
   If the listings are not in the page's HTML, set `engine = "browser"`.
3. Register the class in `terminal_spider/__init__.py` (`SPIDERS`).
4. Add its photo host to `src/lib/photo-hosts.ts`, so its photos are resized
   (not needed for Framer or Luxury Presence sites, whose image hosts resize by themselves).
5. Check its robots.txt and terms first, then
   `python -m terminal_spider <agency> --dry-run --limit 3`.
