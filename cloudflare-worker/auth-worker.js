// ROSEA Media Monitor — authenticating Worker
//
// Serves the app only after a correct user ID / password, using a signed
// HTTP-only session cookie. Credentials live in Cloudflare Worker secrets, so
// they are never in this repo and never sent to the browser.
//
// Required secrets (Worker → Settings → Variables and Secrets → Encrypt):
//   AUTH_USERS      {"admin":"...","im1":"...","analyst":"..."}
//   SESSION_SECRET  long random string used to sign session cookies
//
// This Worker also serves the RSS proxy at /__proxy, so the app and its proxy
// share one origin. That removes CORS entirely, keeps the proxy behind the
// login (so it cannot be abused), and means a workers.dev subdomain change can
// never again leave the page pointing at a dead proxy URL.

const SOURCE = "https://raw.githubusercontent.com/UN-OCHA/ROSEA_Media_Monitoring/main/index.html";
const COOKIE = "rosea_session";
const SESSION_HOURS = 12;

const enc = new TextEncoder();

function b64url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s) {
  return atob(s.replace(/-/g, "+").replace(/_/g, "/"));
}

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return b64url(new Uint8Array(sig));
}

// Compares without leaking length/content through timing.
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function makeToken(user, secret) {
  const payload = b64url(enc.encode(JSON.stringify({
    u: user,
    exp: Date.now() + SESSION_HOURS * 3600 * 1000,
  })));
  return `${payload}.${await hmac(secret, payload)}`;
}

async function readToken(token, secret) {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  if (!safeEqual(sig, await hmac(secret, payload))) return null;
  try {
    const data = JSON.parse(b64urlDecode(payload));
    return data.exp && Date.now() < data.exp ? data : null;
  } catch {
    return null;
  }
}

function getCookie(request, name) {
  for (const part of (request.headers.get("Cookie") || "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

// Accepts JSON, or a simpler "user:pass,user:pass" form.
function parseUsers(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch { /* fall through */ }
  const out = {};
  for (const pair of raw.split(",")) {
    const i = pair.indexOf(":");
    if (i > 0) out[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
  }
  return out;
}

function sessionCookie(value, maxAge) {
  return `${COOKIE}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

function loginPage(error = "", status = 200) {
  return new Response(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>Sign in &middot; ROSEA Humanitarian Monitor</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --blue:#185FA5; --blue-dark:#0C447C; --blue-light:#4A90D9;
  --ink:#10243A; --muted:#6B7A8C; --line:#E3E8EF;
  --red:#C0392B; --red-bg:#FDECEA; --red-line:#F5C2BC;
}
html,body{height:100%}
body{
  font-family:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif;
  color:var(--ink);
  background:
    radial-gradient(1100px 600px at 12% -5%, #E8F1FA 0%, rgba(232,241,250,0) 60%),
    radial-gradient(900px 500px at 105% 105%, #E4EEF8 0%, rgba(228,238,248,0) 55%),
    #F6F8FB;
  min-height:100vh;display:flex;align-items:center;justify-content:center;
  padding:calc(24px + env(safe-area-inset-top,0px)) 20px calc(24px + env(safe-area-inset-bottom,0px));
  -webkit-font-smoothing:antialiased;
}
.wrap{width:100%;max-width:400px}
.brand{display:flex;flex-direction:column;align-items:center;margin-bottom:26px}
.mark{
  width:56px;height:56px;border-radius:16px;display:grid;place-items:center;margin-bottom:16px;
  background:linear-gradient(145deg,var(--blue-light),var(--blue) 55%,var(--blue-dark));
  box-shadow:0 10px 24px -8px rgba(24,95,165,.55);
}
.mark svg{width:28px;height:28px;color:#fff}
.brand h1{font-size:20px;font-weight:600;letter-spacing:-.015em;text-align:center}
.brand p{font-size:12.5px;color:var(--muted);text-align:center;margin-top:5px;line-height:1.55}
.card{
  background:#fff;border:1px solid var(--line);border-radius:16px;padding:30px 28px;
  box-shadow:0 1px 2px rgba(16,36,58,.04),0 12px 32px -12px rgba(16,36,58,.14);
}
.field{margin-bottom:16px}
label{font-size:12px;font-weight:500;color:var(--ink);display:block;margin-bottom:6px}
input{
  width:100%;padding:11px 13px;border:1px solid var(--line);border-radius:9px;
  font-size:14.5px;font-family:inherit;color:var(--ink);background:#fff;
  transition:border-color .15s,box-shadow .15s;
}
input::placeholder{color:#AEB8C4}
input:focus{outline:none;border-color:var(--blue);box-shadow:0 0 0 3px rgba(24,95,165,.13)}
button{
  width:100%;padding:12px;background:var(--blue);color:#fff;border:none;border-radius:9px;
  font-size:14.5px;font-weight:500;font-family:inherit;cursor:pointer;margin-top:4px;
  transition:background .15s,transform .05s;
}
button:hover{background:var(--blue-dark)}
button:active{transform:translateY(1px)}
button:focus-visible{outline:2px solid var(--blue);outline-offset:2px}
.err{
  display:flex;gap:8px;align-items:flex-start;
  background:var(--red-bg);border:1px solid var(--red-line);color:var(--red);
  font-size:12.5px;line-height:1.5;border-radius:9px;padding:10px 12px;margin-bottom:18px;
}
.err svg{width:15px;height:15px;flex-shrink:0;margin-top:1px}
.foot{
  margin-top:22px;padding-top:16px;border-top:1px solid var(--line);
  font-size:11.5px;color:var(--muted);text-align:center;line-height:1.65;
}
@media (max-width:420px){.card{padding:24px 20px}.brand h1{font-size:18px}}
</style></head><body>
<div class="wrap">
  <div class="brand">
    <div class="mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49M7.76 16.24a6 6 0 0 1 0-8.49M20.07 4.93a10 10 0 0 1 0 14.14M3.93 19.07a10 10 0 0 1 0-14.14"/></svg></div>
    <h1>ROSEA Humanitarian Monitor</h1>
    <p>OCHA Regional Office for Southern<br>and Eastern Africa</p>
  </div>
  <form class="card" method="POST" action="/__login">
    ${error ? `<div class="err" role="alert"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>${error}</span></div>` : ""}
    <div class="field">
      <label for="u">User ID</label>
      <input id="u" name="u" type="text" placeholder="e.g. analyst" autocomplete="username" autofocus required>
    </div>
    <div class="field">
      <label for="p">Password</label>
      <input id="p" name="p" type="password" placeholder="Enter your password" autocomplete="current-password" required>
    </div>
    <button type="submit">Sign in</button>
    <div class="foot">Authorised OCHA ROSEA staff only.<br>Contact the IM Unit to request access.</div>
  </form>
</div>
</body></html>`, {
    status,
    headers: { "content-type": "text/html; charset=UTF-8", "cache-control": "no-store" },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const secret = env.SESSION_SECRET;
    const users = parseUsers(env.AUTH_USERS);

    if (!secret || Object.keys(users).length === 0) {
      return new Response(
        "Not configured. Set the AUTH_USERS and SESSION_SECRET secrets on this Worker.",
        { status: 500, headers: { "content-type": "text/plain; charset=UTF-8" } }
      );
    }

    if (url.pathname === "/__logout") {
      return new Response(null, {
        status: 302,
        headers: { Location: "/", "Set-Cookie": sessionCookie("", 0) },
      });
    }

    if (url.pathname === "/__login") {
      if (request.method !== "POST") {
        return new Response(null, { status: 302, headers: { Location: "/" } });
      }
      const form = await request.formData();
      const u = String(form.get("u") || "").trim().toLowerCase();
      const p = String(form.get("p") || "");
      const expected = users[u];

      if (!expected || !safeEqual(p, expected)) {
        // Slow down password guessing. This is wall-clock wait, not CPU.
        await new Promise((r) => setTimeout(r, 500));
        return loginPage("Incorrect user ID or password.", 401);
      }

      return new Response(null, {
        status: 302,
        headers: {
          Location: "/",
          "Set-Cookie": sessionCookie(await makeToken(u, secret), SESSION_HOURS * 3600),
        },
      });
    }

    const session = await readToken(getCookie(request, COOKIE), secret);
    if (!session) return loginPage();

    // Lets the page show who is signed in and attribute exports.
    if (url.pathname === "/__me") {
      return new Response(JSON.stringify({ name: session.u }), {
        headers: { "content-type": "application/json", "cache-control": "no-store" },
      });
    }

    // RSS/HTML proxy. Same origin as the page, and only reachable with a valid
    // session, so it cannot be used as an open proxy by anyone else.
    if (url.pathname === "/__proxy") {
      const target = url.searchParams.get("url");
      if (!target) return new Response("Missing url parameter", { status: 400 });

      let dest;
      try {
        dest = new URL(target);
      } catch {
        return new Response("Invalid URL", { status: 400 });
      }
      if (dest.protocol !== "http:" && dest.protocol !== "https:") {
        return new Response("Only http and https are allowed", { status: 400 });
      }
      // Block internal/loopback targets so a signed-in user cannot probe private hosts.
      if (/^(localhost$|127\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|0\.)/i
            .test(dest.hostname)) {
        return new Response("Blocked host", { status: 403 });
      }

      try {
        const upstream = await fetch(dest.toString(), {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                          "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            Accept: "application/rss+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            Referer: dest.origin + "/",
          },
          redirect: "follow",
          cf: { cacheTtl: 180, cacheEverything: true },
        });

        return new Response(upstream.body, {
          status: upstream.status,
          headers: {
            "content-type": upstream.headers.get("content-type") || "text/plain; charset=utf-8",
            "cache-control": "private, max-age=120",
          },
        });
      } catch (e) {
        return new Response("Upstream error: " + e.message, { status: 502 });
      }
    }

    const upstream = await fetch(SOURCE, { cf: { cacheTtl: 300, cacheEverything: true } });
    if (!upstream.ok) {
      return new Response("Unable to load the application. Please try again shortly.", {
        status: 502,
        headers: { "content-type": "text/plain; charset=UTF-8" },
      });
    }

    return new Response(upstream.body, {
      headers: {
        "content-type": "text/html; charset=UTF-8",
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer",
      },
    });
  },
};
