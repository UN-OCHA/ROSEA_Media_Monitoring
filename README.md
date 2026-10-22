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

**The login screen inside `index.html` is a convenience gate, not security.** Everything in a
static site is readable and bypassable by anyone who opens the page — passwords are stored as
SHA-256 hashes so the source contains no reusable password, but the gate itself can be skipped
from the browser console. Never put a secret or sensitive data in `index.html`.

Real access control is enforced **in front of** the site by Cloudflare Access (Zero Trust),
which authenticates visitors before any application code is served. Free for up to 50 users.

**Goal**: only UN staff can reach the tool, signing in with their existing Microsoft UN
account. This is done in two stages, because stage 2 needs UN ICT involvement while stage 1
does not — stage 1 already enforces "UN emails only" and can be live the same day.

### Stage 1 — restrict to UN emails (no ICT needed)

1. **Deploy to Cloudflare Pages** (Access can only protect sites served through Cloudflare):
   - Cloudflare dashboard → *Workers & Pages* → *Create* → *Pages* → *Connect to Git*
   - Select the `ROSEA_Media_Monitoring` repo
   - **Framework preset: `None`** · **Build command: leave empty** · **Output directory: `/`**
     (an earlier attempt failed because Cloudflare tried to run a build — this app has none)
   - Deploy. You get a `*.pages.dev` URL.
2. **Enable Zero Trust**: dashboard → *Zero Trust* → complete the free-plan signup if prompted.
   You will be asked to choose a **team domain**, giving you
   `https://<team-name>.cloudflareaccess.com` — note this, stage 2 needs it.
3. **Add an Access application**: *Zero Trust* → *Access* → *Applications* →
   *Add an application* → *Self-hosted*
   - Name it, and set the application domain to the `*.pages.dev` hostname from step 1
4. **Add a policy** — this is where access is managed, never in code:
   - Action: **Allow**
   - Rule: *Emails ending in* → `@un.org`
   - Add further rules for any other domains your team uses (e.g. `@unocha.org`).
   - With this rule there is no user list to maintain: any address on an approved UN
     domain gets in, everyone else is blocked.
5. **Login method**: *Zero Trust* → *Settings* → *Authentication* → *Login methods*
   - **One-time PIN** is enabled by default and needs no setup — Cloudflare emails a
     6-digit code to the address being used. Combined with the policy in step 4, only
     someone who can receive mail at a UN address can get in.
6. Test in a private window. A UN address should receive a code and reach the app;
   any other address should be refused.

At this point the tool is genuinely restricted to UN staff.

### Stage 2 — Microsoft UN account sign-in (needs UN ICT)

This replaces the emailed code with proper single sign-on, so staff who are already signed
in to their UN Microsoft account go straight through. It requires an app registration in
the UN's Entra ID (Azure AD) tenant, which normally only ICT/OICT administrators can create.

**What to request from UN ICT** — forward this list:

> Please register an application in the UN Entra ID tenant for Cloudflare Access SSO:
>
> - **Name**: `Cloudflare Access — OCHA ROSEA Media Monitor`
> - **Platform**: Web
> - **Redirect URI**: `https://<team-name>.cloudflareaccess.com/cdn-cgi/access/callback`
> - **Delegated Microsoft Graph permissions**: `openid`, `profile`, `email`, `offline_access`,
>   `User.Read` — all standard sign-in scopes; no mailbox, file or directory-wide read access
>   is required
> - **Please provide back**: Application (client) ID, Directory (tenant) ID, and a client
>   secret value
>
> Group-based permissions are *not* required — access is scoped by email domain — so no
> `Directory.Read.All` consent is needed.

Keeping the permission request to sign-in scopes only (no directory read) usually makes
approval much quicker, since nothing sensitive is being granted.

**Once ICT returns the three values:**

1. *Zero Trust* → *Settings* → *Authentication* → *Login methods* → *Add new* →
   **Azure AD / Microsoft Entra ID**
2. Paste the Application (client) ID, Client secret, and Directory (tenant) ID. Leave
   *Support groups* off unless you later want group-based rules.
3. Save, then use **Test** to confirm a UN account authenticates.
4. Update the Access policy from step 4 above to also require
   *Login method* → *Azure AD*, so Microsoft sign-in becomes the route in.
5. Optionally disable **One-time PIN** so SSO is the only method.

### After Access is live

Once sign-in is confirmed working, the in-page login in `index.html` becomes redundant and
should be removed — it adds no protection and creates a misleading impression of security.

### Managing users

Day to day, access is managed at *Zero Trust → Access → Applications → (your app) →
Policies*. Changes apply immediately with no code change or redeploy. Sign-in activity is
auditable under *Zero Trust → Logs → Access*.

## Deployment

- **Hosting**: GitHub Pages (static, no build step — `index.html` is the entire app).
  Migrating to Cloudflare Pages — see *Access control* above.
- **RSS proxy**: a Cloudflare Worker (`cloudflare-worker/worker.js`) fetches RSS/HTML server-side to get around CORS. Its URL is set in `index.html` as `CF_WORKER_URL`. Public proxies (allorigins.win, corsproxy.io) are used as automatic fallback if the Worker is unreachable.
- Google News queries deliberately skip the Worker — Google blocks requests from cloud/datacenter IP ranges for its RSS endpoint, so those queries go straight to the public proxies.

## Known limitations

- Some outlets block all proxies (Cloudflare-protected sites, paywalls); those will occasionally return nothing.
- Homepage scraping (for outlets with no RSS) only extracts headline + link, not full article text or a real publish date.
- Reuters and AP no longer offer public RSS feeds, so they aren't included as direct sources.
