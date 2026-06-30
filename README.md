# ROSEA Humanitarian Media Monitor

A single-page web app that scans humanitarian news and reports across 26 OCHA ROSEA (Eastern and Southern Africa) countries, then exports the results as a Word report, the official Media Sweep format, CSV, or plain text.

Everything runs in the browser — no backend database, no server-side processing except a small proxy used to fetch RSS feeds (CORS workaround).

---

## Quick start

1. Open the live app (GitHub Pages URL) or open `index.html` locally in a browser.
2. Log in with your assigned credentials.
3. In the sidebar: pick countries (or use a region's `all`/`none` shortcut), pick themes, pick a time window.
4. Click **Run scan**.
5. When results appear, use the export row at the top of the results to download:
   - **Export .doc** — full report grouped by theme, with severity tags
   - **Download Media Sweep format** — matches the official OCHA Media Sweep layout (Highlights → Regional → Eastern Africa/Horn/Great Lakes → Southern Africa)
   - **Export .txt** / **Export .csv**

That's the whole workflow. Everything below is reference detail for anyone maintaining or extending the app.

---

## How it works

**Sources searched per scan** (toggle any on/off in the sidebar, grouped by Media outlets vs Humanitarian feeds):

| Source | What it covers |
|---|---|
| Country media RSS | 200+ outlets across all 26 countries, fetched directly by RSS (falls back to homepage scraping if a site has no feed) |
| Google News | Per-country and regional search queries |
| AllAfrica RSS | Pan-African headlines |
| ReliefWeb API | OCHA situation reports |
| GDACS | Disaster alerts |
| UN News | Africa region feed |
| WHO | Disease outbreak news |
| FEWS NET | Food security alerts |

BBC Africa and Al Jazeera are always included as standing international wires (`REGIONAL_MEDIA` in the code), regardless of which countries are selected.

**Filtering** — every article is matched to a country or region before it's kept:
- Generic continent-wide sources (BBC, Al Jazeera, AllAfrica, UN/WHO/FEWS NET, broad Google News queries) only keep articles that explicitly name a selected country, or a selected region by name ("Horn of Africa", "East Africa", "Great Lakes", "Southern Africa") — otherwise they're dropped, so a scan never leaks in news about countries you didn't select.
- Per-country outlets and per-country Google News queries keep their fallback tagging, since the source/query itself already guarantees relevance.
- All keyword matching (humanitarian classification, theme detection, severity scoring, exclude keywords) uses word-boundary matching, so short keywords like "war" or "aid" don't false-positive inside words like "award" or "raid".

**Exclude keywords** (sidebar, below sweep keywords) — applied two ways: appended as `-term` to every Google News query (so excluded topics never come back from the source), and as a post-fetch filter across all sources before deduplication.

**Categories** — every article is tagged `Humanitarian` or `Non-Humanitarian` based on keyword matching (`requiresKeyword`). Humanitarian articles are shown by default; both categories are included in exports.

---

## Adding or changing a country / outlet

All of this lives in `index.html` as plain JS data structures — no build step required:

- `COUNTRIES` — id/display-name pairs. Adding a country here makes it selectable everywhere.
- `REGIONS` — which country ids belong to Horn of Africa / Great Lakes / Southern Africa.
- `COUNTRY_MEDIA` — outlet domains per country, used for direct RSS fetching.
- `COUNTRY_KW` — official OCHA sweep keywords per country (loaded via the "Load sweep keywords" button).
- `CUSTOM_RSS_URL` — explicit RSS feed URL for outlets whose feed isn't at the default `/feed/` path.
- `NO_RSS_SITES` — outlets with no RSS at all; these are homepage-scraped instead.
- `BLOCKED_DOMAINS` — known aggregators/scrapers filtered out of results.

## Deployment

- **Hosting**: GitHub Pages (static, no build step — `index.html` is the entire app).
- **RSS proxy**: a Cloudflare Worker (`cloudflare-worker/worker.js`) fetches RSS/HTML server-side to get around CORS. Its URL is set in `index.html` as `CF_WORKER_URL`. Public proxies (allorigins.win, corsproxy.io) are used as automatic fallback if the Worker is unreachable.
- Google News queries deliberately skip the Worker — Google blocks requests from cloud/datacenter IP ranges for its RSS endpoint, so those queries go straight to the public proxies.

## Known limitations

- Some outlets block all proxies (Cloudflare-protected sites, paywalls); those will occasionally return nothing.
- Homepage scraping (for outlets with no RSS) only extracts headline + link, not full article text or a real publish date.
- Reuters and AP no longer offer public RSS feeds, so they aren't included as direct sources.
