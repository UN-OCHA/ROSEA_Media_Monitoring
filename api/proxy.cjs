// Vercel serverless proxy — fetches RSS/XML feeds server-side and relays to the browser.
// Solves the CORS problem: browser can't fetch news sites directly, but this function can.
// Uses CommonJS (module.exports) to avoid ESM conflict from "type":"module" in package.json.
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  const { url } = req.query;
  if (!url) return res.status(400).send('Missing url parameter');

  let decoded;
  try {
    decoded = decodeURIComponent(url);
    const u = new URL(decoded);
    if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Invalid protocol');
  } catch {
    return res.status(400).send('Invalid URL');
  }

  try {
    const upstream = await fetch(decoded, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Referer': new URL(decoded).origin + '/',
      },
      signal: AbortSignal.timeout(9000),
      redirect: 'follow',
    });
    const text = await upstream.text();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, s-maxage=180, max-age=60');
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'text/plain; charset=utf-8');
    res.status(200).send(text);
  } catch (e) {
    res.status(502).send('Upstream error: ' + e.message);
  }
};
