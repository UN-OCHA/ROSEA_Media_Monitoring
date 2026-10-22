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

## Access control

Access control is enforced **in front of** the site by Cloudflare Access (Zero Trust), which
authenticates the visitor before any application code is served. Free for up to 50 users.

There is **no login inside the app**. The previous in-page username/password screen was
removed once Access went live: it was bypassable from the browser console and offered no real
protection. The signed-in identity now comes from Access via `/cdn-cgi/access/get-identity`
and is used to attribute exports; *Sign out* ends the Access session.

Never put a secret or sensitive data in `index.html` — it is served to every visitor.

**Goal**: only people with a UN email address can reach the tool, and they sign in using
that email address. No Azure/Entra app registration is required.

**How it works**: Cloudflare Access sits in front of the site. A visitor enters their email,
Cloudflare emails them a 6-digit code ("one-time PIN"), and an Access *policy* allows only
approved UN email domains. Someone who cannot receive mail at a UN address cannot get in.
Access is free for up to 50 users.

### Current deployment

| Piece | Where | Behind Access? |
|---|---|---|
| App (serves `index.html`) | `rosea-media-monitor.suubow47.workers.dev` | **Yes** |
| CORS proxy (`worker.js`) | `dark-base-93a2.suubow47.workers.dev` | **No — must stay open** |
| Access team domain | `shrill-bird-52d2.cloudflareaccess.com` | — |

The app runs as a **Workers static-assets deployment**: `index.html` was uploaded directly,
and Cloudflare serves it with no Worker script. Cloudflare Pages via Git was not used because
connecting the repo requires installing the Cloudflare GitHub app on the UN-OCHA org, which
needs org-owner approval.

> **Updating the live app**: a `git push` does **not** update it. Re-upload `index.html` to
> the `rosea-media-monitor` Worker after each change (*Workers & Pages* → the Worker →
> upload new assets). If this becomes tedious, `cloudflare-worker/app-worker.js` is an
> alternative script-based Worker that fetches `index.html` from the public repo instead, so
> pushes go live automatically — deploy it as the Worker's code to switch approaches.

> **Do not put the CORS proxy behind Access.** The app calls it with `fetch()` from the
> browser, and those requests carry no Access session — they would receive a login redirect
> instead of RSS, and most sources would silently return nothing. Keep the two Workers on
> separate subdomains and only protect the app one.

### Setup

1. **Deploy the app** — *Workers & Pages* → *Create* → *Upload assets*, name it
   `rosea-media-monitor`, and upload `index.html`. This creates a static-assets Worker
   (it has no code editor — that is expected).
2. **Enable Zero Trust** — dashboard → *Zero Trust*. On first use you pick a **team name**,
   which becomes `https://<team-name>.cloudflareaccess.com`. Choose the **Free** plan.
3. **Add an Access application** — *Zero Trust* → *Access* → *Applications* →
   *Add an application* → *Self-hosted*
   - Destination → **Subdomain** `rosea-media-monitor`, **Domain** `suubow47.workers.dev`
   - Leave **Path** empty — it takes a path such as `/admin`, not a full URL
   - Session duration: 24 hours or 1 week, as preferred
4. **Add the policy** — this is where access is controlled, never in code:
   - Policy name: `Only UN emails` · Action: **Allow**
   - Include → selector **Emails ending in** → value `@un.org`
   - Add a value for every other domain your team uses (e.g. `@unocha.org`) or those
     people will be locked out
   - There is no user list to maintain: any address on an approved domain gets in,
     everyone else is refused
5. **Enable the login method** — add **One-time PIN** as a login method, and ensure the
   application accepts it (application → *Login methods* tab → *Accept all available
   identity providers*). Without this the login page offers only "Cloudflare" and shows
   no email field.
6. **Name the application** `ROSEA Media Monitor` — this text appears on the login page.
   Leaving it as a raw `workers.dev` hostname makes the page look like phishing to staff
   being asked to enter their work email.
7. **Test** in a private window. A UN address should receive a code and reach the app;
   a personal address (e.g. Gmail) should be refused.

> **Every Allow policy widens access.** Policies are OR'd together, so access is only as
> restrictive as the most permissive Allow policy attached to the application. Adding a
> second policy for a personal address silently defeats the `@un.org` restriction — prefer
> adding extra addresses as additional *values* inside the one policy, so the full list of
> who can get in is visible in a single place.

### Known friction points

- **Cloudflare asks for a payment method** to activate Zero Trust, even on the free 50-user
  tier. Nothing is charged at that tier, but a card must be on file.
- **Account ownership**: Zero Trust is currently set up under a personal Cloudflare account,
  so access control for a UN tool depends on one individual's account. Worth migrating to a
  UN-administered Cloudflare account when possible.
- **Verify after changing any Access destination** that the proxy Worker is still reachable:
  `curl -I https://dark-base-93a2.suubow47.workers.dev/` should return `200`, not a `302`
  to a login page.

### After Access is live

Once sign-in is confirmed working, the in-page login in `index.html` becomes redundant and
should be removed — it adds no protection and creates a misleading impression of security.

### Managing users

Day to day, access is managed at *Zero Trust → Access → Applications → (your app) →
Policies*. Changes apply immediately with no code change or redeploy. Sign-in activity is
auditable under *Zero Trust → Logs → Access*.

### Optional, later: Microsoft single sign-on

If UN ICT ever agrees to register an application in the UN Entra ID tenant, Microsoft SSO
can be added as a login method so staff skip the emailed code and use their existing UN
account session. This changes only the sign-in experience — the email-domain restriction
above already provides the access control — so it is a convenience upgrade, not a
prerequisite.

## Deployment

- **Hosting**: GitHub Pages (static, no build step — `index.html` is the entire app).
  Migrating to Cloudflare Pages — see *Access control* above.
- **RSS proxy**: a Cloudflare Worker (`cloudflare-worker/worker.js`) fetches RSS/HTML server-side to get around CORS. Its URL is set in `index.html` as `CF_WORKER_URL`. Public proxies (allorigins.win, corsproxy.io) are used as automatic fallback if the Worker is unreachable.
- Google News queries deliberately skip the Worker — Google blocks requests from cloud/datacenter IP ranges for its RSS endpoint, so those queries go straight to the public proxies.

## Known limitations

- Some outlets block all proxies (Cloudflare-protected sites, paywalls); those will occasionally return nothing.
- Homepage scraping (for outlets with no RSS) only extracts headline + link, not full article text or a real publish date.
- Reuters and AP no longer offer public RSS feeds, so they aren't included as direct sources.
