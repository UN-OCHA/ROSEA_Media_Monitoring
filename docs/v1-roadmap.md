# ROSEA-Media V1 Roadmap

## Purpose

This roadmap turns the current single-file monitor into a modular V1 system that is:

- operational on first release
- secure enough for shared internal use
- easy to extend without rewriting the core workflow
- still aligned with the exact capabilities already present in `index.html`

Primary reference documents:

- [V1 architecture spec](./v1-architecture-spec.md)
- [Current-state project analysis](./project-analysis.md)
- [Cost and security plan](./cost-security-plan.md)
- [V1 cost addendum](./v1-cost-addendum.md)

## V1 Delivery Goal

V1 must preserve the current analyst experience while removing the most important risks:

- browser-exposed OpenAI secrets
- browser-only authentication
- monolithic implementation

The first production-ready run must cover the full scope of the current index file:

- sign-in and sign-out
- country, region, theme, source, and timeframe controls
- custom keyword and custom site support
- scan modes: quick, standard, and full
- all current source adapters
- dedupe, ranking, filtering, and result grouping
- `.txt`, `.csv`, `.doc`, and AI sitrep export
- optional AI analysis with capped payloads
- responsive analyst UI with loading and error states

## Planning Principles

These rules govern the implementation:

- Keep the frontend modular and static where possible.
- Keep secrets and session checks server-side.
- Drive countries, regions, themes, sources, keywords, and limits from config files.
- Keep the first release operational without waiting for future features.
- Preserve source fetching client-side in V1 unless a later operational need forces a server move.
- Avoid a database in V1.
- Keep every major feature replaceable through a narrow interface so the system can expand over time.

## Proposed Repository Layout

This is the file layout the team should build toward.

```text
/
  index.html
  src/
    app.ts
    bootstrap.ts
    types.ts
    state/
      session.ts
      filters.ts
      scan-state.ts
      results.ts
    config/
      load-config.ts
      schema.ts
    auth/
      client.ts
      ui.ts
    scan/
      controller.ts
      orchestrator.ts
      progress.ts
    pipeline/
      cache.ts
      errors.ts
      retry.ts
      monitoring.ts
      append.ts
    sources/
      registry.ts
      base.ts
      reliefweb.ts
      gdacs.ts
      unnews.ts
      who.ts
      fewsnet.ts
      allafrica.ts
      googlenews.ts
      proxy.ts
    classify/
      country.ts
      theme.ts
      severity.ts
      dedupe.ts
      normalization.ts
    keywords/
      custom-keywords.ts
      custom-sites.ts
      sweep-keywords.ts
    ui/
      shell.ts
      sidebar.ts
      results.ts
      cards.ts
      badges.ts
      status.ts
      mobile.ts
    export/
      txt.ts
      csv.ts
      doc.ts
      ai-doc.ts
    ai/
      client.ts
      prompt.ts
      summary.ts
      payload.ts
  config/
    countries.json
    regions.json
    themes.json
    theme-keywords.json
    country-keywords.json
    country-media.json
    source-definitions.json
    scan-presets.json
    ai-limits.json
    feature-flags.json
  api/
    login.ts
    logout.ts
    session.ts
    ai-summary.ts
  tests/
    config/
    unit/
    integration/
  docs/
    operator-notes.md
    release-checklist.md
    implementation-log.md
```

## Release 1 Functional Scope

The first release must fully implement the current analyst workflow from `index.html`.

### Identity and session

- server-side login
- server-side logout
- session refresh on load
- authenticated UI state
- clear unauthenticated state after logout or session expiry

### Scan controls

- country selection
- region grouping and expand/collapse
- theme selection
- timeframe selection
- source selection
- scan mode selection
- custom keyword entry and removal
- load sweep keywords button
- custom site entry and removal
- optional country media inclusion
- clear results action

### Source coverage

- ReliefWeb
- GDACS
- UN News Africa RSS
- WHO Disease Outbreak News
- FEWS NET
- AllAfrica
- Google News RSS

### Classification and display

- country matching
- theme detection
- severity scoring
- deduplication
- source tabs
- country dropdown filter
- humanitarian alert grouping
- general news grouping
- severity badges
- result sorting by severity and recency

### Exports

- text briefing export
- CSV export
- Word-compatible report export
- AI report Word export

### AI workflow

- optional AI analysis
- explicit user-triggered analysis
- auto-analyze toggle
- capped request size
- server-backed OpenAI call
- rendered sitrep output

### Pipeline reliability

- source-level retries and timeouts
- short-lived cache during a scan
- append-only accumulation of successful batches
- broken-source warnings without stopping the scan
- visible degraded-mode monitoring

## Detailed Workstreams

The implementation should be split into workstreams so developers can build in parallel.

### Workstream 1: Application Shell and Runtime State

Goal:

- split the single-file UI into a bootstrap entry, shared state modules, and reusable UI components

Sub-workstreams:

- bootstrap and startup sequencing
- session state and login state
- filter state and scan state
- results state and active-tab state
- responsive shell and layout behavior

Files to build:

- `src/bootstrap.ts`
- `src/app.ts`
- `src/types.ts`
- `src/state/session.ts`
- `src/state/filters.ts`
- `src/state/scan-state.ts`
- `src/state/results.ts`
- `src/ui/shell.ts`
- `src/ui/mobile.ts`
- `src/ui/status.ts`

Implementation notes:

- keep DOM wiring isolated from business logic
- keep all app state in one explicit store surface
- preserve the existing workflow order: authenticate, configure, scan, filter, export, analyze

### Workstream 2: Configuration and Reference Data

Goal:

- move stable data out of code and make the system configuration-driven

Sub-workstreams:

- countries and regions
- themes and theme icon labels
- country keyword sweeps
- country media domain lists
- source definitions and source labels
- scan presets and AI limits
- feature flags for future modules

Files to build:

- `src/config/load-config.ts`
- `src/config/schema.ts`
- `config/countries.json`
- `config/regions.json`
- `config/themes.json`
- `config/theme-keywords.json`
- `config/country-keywords.json`
- `config/country-media.json`
- `config/source-definitions.json`
- `config/scan-presets.json`
- `config/ai-limits.json`
- `config/feature-flags.json`

Implementation notes:

- validate config at startup and fail early on malformed files
- keep config shape stable so future expansion does not require code rewrites
- make it easy to add countries, themes, or source labels without touching scan logic

### Workstream 3: Authentication and Session Handling

Goal:

- replace browser-side auth truth with a real server boundary

Sub-workstreams:

- login form submission
- password verification
- session cookie issuance
- session lookup on page load
- logout and cookie clearing
- auth error handling in the UI

Files to build:

- `api/login.ts`
- `api/logout.ts`
- `api/session.ts`
- `src/auth/client.ts`
- `src/auth/ui.ts`
- `src/state/session.ts`

Implementation notes:

- use one server-side username and one password hash
- use an HTTP-only signed cookie
- never place an OpenAI key or password in browser code
- keep the session model simple so it can be replaced later if stronger auth is needed

### Workstream 4: Scan Orchestration and Source Adapters

Goal:

- preserve the current scan workflow while separating each data source into its own module

Sub-workstreams:

- scan controller and progress reporting
- proxy fetch strategy
- source-specific adapters
- query construction for Google News
- normalization of source results into one alert shape

Files to build:

- `src/scan/controller.ts`
- `src/scan/orchestrator.ts`
- `src/scan/progress.ts`
- `src/sources/base.ts`
- `src/sources/registry.ts`
- `src/sources/proxy.ts`
- `src/sources/reliefweb.ts`
- `src/sources/gdacs.ts`
- `src/sources/unnews.ts`
- `src/sources/who.ts`
- `src/sources/fewsnet.ts`
- `src/sources/allafrica.ts`
- `src/sources/googlenews.ts`

Implementation notes:

- keep source adapters independent so one failure does not break the whole scan
- keep the proxy strategy replaceable
- preserve the current scan modes and their coverage differences
- keep browser-side fetching for V1 unless operations require a backend source layer later
- make retry, cache, and append behavior explicit so the pipeline remains usable during partial outages

### Workstream 5: Pipeline Reliability, Caching, and Monitoring

Goal:

- add the operational behavior that keeps scans usable when sources fail, slow down, or return partial data

Sub-workstreams:

- request timeout handling
- retry and backoff rules
- short-lived cache for repeat requests during a scan
- append-only accumulation of result batches
- source failure tracking and degraded-mode reporting
- scan monitoring and break visibility

Files to build:

- `src/pipeline/cache.ts`
- `src/pipeline/errors.ts`
- `src/pipeline/retry.ts`
- `src/pipeline/monitoring.ts`
- `src/pipeline/append.ts`

Implementation notes:

- cache only what is safe to reuse during the active scan window
- append new batches instead of replacing already collected data unless a user explicitly clears results
- surface per-source failures without killing the full scan
- keep a visible status trail for retry attempts, timeouts, and broken providers
- make broken-source reporting part of the normal UI so operators can see when coverage has degraded
- keep the monitoring surface lightweight but obvious enough for operators to notice broken inputs quickly

### Workstream 6: Classification, Deduplication, and Ranking

Goal:

- preserve the current intelligence rules but move them into reusable modules

Sub-workstreams:

- country matching
- theme detection
- severity scoring
- duplicate detection
- final sort order
- humanitarian vs general result grouping

Files to build:

- `src/classify/country.ts`
- `src/classify/theme.ts`
- `src/classify/severity.ts`
- `src/classify/dedupe.ts`
- `src/classify/normalization.ts`

Implementation notes:

- keep classification rules deterministic
- keep theme taxonomies configurable
- make dedupe criteria explicit so later source expansion does not produce duplicate-heavy output

### Workstream 7: Results Rendering and Analyst UX

Goal:

- rebuild the current UI controls as reusable view modules without changing the analyst flow

Sub-workstreams:

- source tabs
- country dropdown filter
- result cards
- severity badges
- humanitarian and general sections
- empty states
- status and progress messages
- result counts and source counts

Files to build:

- `src/ui/results.ts`
- `src/ui/cards.ts`
- `src/ui/badges.ts`
- `src/ui/sidebar.ts`
- `src/ui/status.ts`
- `src/ui/mobile.ts`

Implementation notes:

- preserve the current visual logic
- keep rendering pure where possible
- ensure the mobile layout still supports scanning and reviewing results

### Workstream 8: Exports and Reporting

Goal:

- keep the existing export formats but move them into dedicated modules

Sub-workstreams:

- plain text briefing export
- CSV export
- Word-compatible document export
- AI sitrep export

Files to build:

- `src/export/txt.ts`
- `src/export/csv.ts`
- `src/export/doc.ts`
- `src/export/ai-doc.ts`

Implementation notes:

- preserve current filenames and general layout expectations
- keep exports operating on the currently filtered result set
- keep report formatting stable so analysts are not forced to relearn output handling

### Workstream 9: AI Summary Service

Goal:

- move the OpenAI call behind a server endpoint and keep the analyst workflow intact

Sub-workstreams:

- request payload shaping
- article caps and summary caps
- prompt construction
- response rendering
- AI report export
- auto-analyze toggle handling

Files to build:

- `api/ai-summary.ts`
- `src/ai/client.ts`
- `src/ai/prompt.ts`
- `src/ai/summary.ts`
- `src/ai/payload.ts`

Implementation notes:

- require a valid session
- accept only normalized article data
- cap the number of articles and summary length
- keep the AI request explicit rather than automatic by default

### Workstream 10: Validation, Docs, and Hand-off

Goal:

- make the release shippable and easy to operate

Sub-workstreams:

- config validation
- scan workflow verification
- auth/session verification
- export verification
- AI limit verification
- host hand-off notes

Files to build:

- `tests/unit/*`
- `tests/integration/*`
- `docs/operator-notes.md`
- `docs/release-checklist.md`
- `docs/implementation-log.md`

Implementation notes:

- keep the verification checklist aligned with the acceptance criteria
- document any host-specific settings outside application code

## Suggested Implementation Order

Use this sequence for the first build.

1. Split `index.html` responsibilities into modules and confirm the app still boots.
2. Move all stable reference data into `config/`.
3. Build the config loader and runtime schema validation.
4. Add server-side auth endpoints and session handling.
5. Move the OpenAI call behind `api/ai-summary.ts`.
6. Extract source adapters and scan orchestration into modules.
7. Add pipeline reliability, caching, append handling, and broken-source monitoring.
8. Extract classification, dedupe, and ranking logic.
9. Extract export modules and AI report export.
10. Run the full workflow against the acceptance checklist.
11. Prepare the handoff notes and release documentation.

## First-Run Exit Criteria

The first release is complete only when all of the following are true:

1. The app loads and authenticates through a server-backed session.
2. The scan UI supports the same controls currently present in `index.html`.
3. All current sources still produce usable results.
4. Source tabs, country filters, theme logic, and severity sorting still work.
5. Text, CSV, and Word-compatible exports still work.
6. AI analysis works through the backend without exposing a browser key.
7. The codebase is modular enough that new sources, countries, and themes can be added by extending config or adding a source module.
8. A broken source degrades coverage without preventing the scan, export, or review of successful results.

## Expansion Path After V1

The architecture should stay open for future growth without a rewrite.

- Add new sources by adding a source adapter and registering it.
- Add new countries or regions by editing config only.
- Add new themes by editing config and classification mappings.
- Add a database later only if the operating model requires persistence.
- Add stronger auth later without rewriting the scan or export logic.
- Move source fetching server-side later only if reliability or policy requires it.
