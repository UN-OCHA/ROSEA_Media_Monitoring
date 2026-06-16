// ROSEA Media Monitor — Cloudflare Worker proxy
// Deploy this at workers.cloudflare.com (free account, no credit card needed).
// Fetches RSS/XML/HTML server-side and relays to the browser, solving CORS.
// Free tier: 100,000 requests/day — far more than any scan will use.

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }

    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) {
      return new Response('Missing url parameter', { status: 400 });
    }

    let decoded;
    try {
      decoded = decodeURIComponent(targetUrl);
      const u = new URL(decoded);
      if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Invalid protocol');
    } catch {
      return new Response('Invalid URL', { status: 400 });
    }

    try {
      const upstream = await fetch(decoded, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Referer': new URL(decoded).origin + '/',
        },
        redirect: 'follow',
      });

      const text = await upstream.text();

      return new Response(text, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': upstream.headers.get('content-type') || 'text/plain; charset=utf-8',
          'Cache-Control': 'public, s-maxage=300, max-age=120',
        },
      });
    } catch (e) {
      return new Response('Upstream error: ' + e.message, { status: 502 });
    }
  },
};
