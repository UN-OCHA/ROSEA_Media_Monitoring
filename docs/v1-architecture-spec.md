# ROSEA-Media V1 Architecture Spec

## Purpose

This document defines the chosen V1 design.

The baseline current-state documents are:

- [project-analysis.md](</c:/Users/Hussain/Fawad-Software-Projects/ROSEA-Media/docs/project-analysis.md>)
- [cost-security-plan.md](</c:/Users/Hussain/Fawad-Software-Projects/ROSEA-Media/docs/cost-security-plan.md>)

## Fixed V1 decisions

- frontend stack: `TypeScript` without `React`
- initial hosting for build and test: `Vercel Hobby`
- final shared hosting target: organization-approved hosting
- auth: one simple server-side username/password login
- secrets: only server-side, never in the browser
- config: move stable reference data into external config files

## V1 goals

- keep the product simple
- remove browser-exposed secrets
- remove hardcoded client auth
- preserve the current analyst workflow
- avoid adding a database in V1
- make the codebase easier to expand without rewriting config into code

## Chosen architecture

Frontend:

- static site on `Vercel`
- TypeScript modules
- local rendering, filtering, and exports
- browser-side source fetching remains in V1
- scan execution is treated as a pipeline with retries, caching, append-only accumulation, and degraded-source reporting

Backend:

- Vercel serverless functions
- `POST /api/login`
- `POST /api/logout`
- `GET /api/session`
- `POST /api/ai-summary`

## Why this path

- small refactor instead of full rewrite
- secure secret storage
- easy to test on Vercel before handoff
- clear path to organization-approved hosting
- low operational overhead for the initial build

## Setup and hosting

Setup flow:

1. Split the app into static frontend files and backend function files.
2. Connect the repository to Vercel for preview and test deployments.
3. Publish the static frontend and serverless functions together.
4. Store secrets in Vercel environment variables, not in the repo or browser.
5. Deploy from Git pushes.
6. After validation, move the same codebase to organization-approved hosting.

Required server-side secrets:

- `OPENAI_API_KEY`
- `AUTH_USERNAME`
- `AUTH_PASSWORD_HASH`
- `SESSION_SECRET`

Environment note:

- deployment settings can live in the hosting platform
- runtime secrets for login and OpenAI must live server-side
- the browser must never contain private credentials

## Proposed structure

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
```

## Operational pipeline

The scan workflow must behave like a real data pipeline, not a single fetch-and-render pass.

Rules:

- each source adapter runs independently
- source failures are isolated and reported
- requests use timeouts and bounded retries
- short-lived cached responses may be reused within the active scan window when safe
- new results are appended in batches instead of replacing successful batches
- partial scans remain visible to the analyst
- broken or degraded providers must show up in the status and monitoring surface

Pipeline behavior:

1. The user starts a scan.
2. The controller creates a scan context with selected filters and source settings.
3. Each source adapter fetches data with retry and timeout rules.
4. Any reusable response is taken from the active cache only if it is still valid for the scan window.
5. Each batch is normalized and appended to the working result set.
6. Classification and dedupe run on the accumulated data.
7. The UI shows both the results and any degraded-source warnings.
8. If a source breaks, the remaining sources continue and the failure is recorded.

Monitoring rules:

- show source-level status while the scan is running
- record timeout, retry, parse, and empty-result failures separately
- expose a clear degraded-mode state when one or more providers fail
- keep operator-facing logs or reports outside the browser when the backend is available

## Auth design

Rules:

- no hardcoded users in the frontend
- no plaintext password in the repo
- use one server-side username
- use one server-side password hash
- use a signed HTTP-only session cookie

Login flow:

1. User posts username/password to `POST /api/login`.
2. Backend checks `AUTH_USERNAME`.
3. Backend verifies `AUTH_PASSWORD_HASH`.
4. Backend sets the session cookie.
5. Protected endpoints require that cookie.
6. `POST /api/logout` clears it.

## AI design

`POST /api/ai-summary` should:

- require a valid session
- accept normalized article payloads
- cap article count
- cap summary length
- call OpenAI using `OPENAI_API_KEY`
- return only the generated report

V1 policy:

- max `50` articles
- max `220` summary characters per article
- no auto-analysis by default

## Data pipeline behavior

The scan engine must preserve the current user experience while behaving safely under partial failure.

Required behavior:

- retries should be bounded and visible
- cache should be short-lived and tied to a scan run or session window
- append-only result accumulation should keep prior successful batches intact
- a broken source should not block exports for the results already collected
- empty or malformed source responses should be tracked and surfaced, not silently ignored
- the UI should make degraded coverage obvious without stopping the analyst workflow

This keeps the first release operational even when one or more providers are unstable.

## Config files

Move these out of inline JavaScript:

- `countries.json`
- `regions.json`
- `themes.json`
- `theme-keywords.json`
- `country-keywords.json`
- `country-media.json`
- `source-definitions.json`
- `scan-presets.json`
- `ai-limits.json`
- `feature-flags.json`

If a config format is better expressed as YAML in the future, keep it in a file, not inline code. The rule is external configuration, not hardcoding.

## What stays the same in V1

- country and theme filters
- scan modes
- source tabs
- exports
- AI analysis panel
- visible progress and status reporting
- degraded-source handling

## What changes in V1

- remove browser API key input
- replace hardcoded `USERS`
- route AI through the backend
- move stable config into external files
- split the single-file app into TypeScript modules
- add explicit pipeline retry, cache, append, and monitoring modules

## Acceptance criteria

V1 is complete when:

1. The browser never sends an OpenAI key.
2. Hardcoded `USERS` are removed.
3. Login uses one server-side username and password hash.
4. AI works through a backend endpoint.
5. Static config is loaded from external files.
6. The current scan and export workflow still works.
7. The same codebase can be previewed on Vercel and handed off to organization-approved hosting.
8. Scans remain usable when a source breaks, slows down, or returns malformed data.

## Phases

Phase 1:

- convert JS to TypeScript modules
- move config into external files
- add login, logout, session, and AI endpoints
- move secrets to the hosting platform

Phase 2:

- enforce session checks
- remove client-side login truth
- add frontend session handling

Phase 3:

- validate on Vercel
- prepare the deployment handoff to organization-approved hosting
- keep source fetching client-side in V1 unless a later operational need justifies a change

## Final recommendation

Build V1 as a small static-plus-serverless app on Vercel for build and test, then move the same codebase to organization-approved hosting after validation. Keep the frontend simple, keep auth simple, keep secrets server-side, and avoid a database until it is clearly needed.
