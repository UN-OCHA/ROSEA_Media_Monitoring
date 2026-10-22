// ROSEA Media Monitor — application Worker
//
// Deployed at: https://rosea-media-monitor.suubow47.workers.dev/
// Protected by Cloudflare Access ("Only UN emails" policy), so Access authenticates
// the visitor before this Worker ever runs.
//
// Rather than embedding the page, this pulls index.html from the repo. A git push
// therefore updates the live app within the cache TTL, with no Worker redeploy.
//
// NOTE: this is a separate Worker from the CORS proxy in worker.js. Do not combine
// them — the proxy must stay outside Access so in-page RSS fetches keep working.

const SOURCE = "https://raw.githubusercontent.com/UN-OCHA/ROSEA_Media_Monitoring/main/index.html";

export default {
  async fetch() {
    const upstream = await fetch(SOURCE, {
      cf: { cacheTtl: 300, cacheEverything: true },
    });

    if (!upstream.ok) {
      return new Response("Unable to load the application. Please try again shortly.", {
        status: 502,
        headers: { "content-type": "text/plain; charset=UTF-8" },
      });
    }

    return new Response(upstream.body, {
      headers: {
        "content-type": "text/html; charset=UTF-8",
        "cache-control": "public, max-age=300",
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer",
      },
    });
  },
};
