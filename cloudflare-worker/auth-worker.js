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
// NOTE: the CORS proxy (worker.js) is a SEPARATE Worker and must stay
// unauthenticated — the page calls it with fetch() and those requests carry no
// session cookie.

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
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ROSEA Humanitarian Monitor</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#f7f7f5;color:#1a1a18;
min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.card{background:#fff;border:1px solid #e2e0d8;border-radius:18px;padding:42px 38px;
width:100%;max-width:360px;box-shadow:0 8px 40px rgba(0,0,0,.09)}
.logo{width:48px;height:48px;background:#185FA5;border-radius:12px;display:flex;
align-items:center;justify-content:center;margin:0 auto 20px}
.logo svg{width:24px;height:24px;color:#fff}
h1{font-size:19px;font-weight:600;text-align:center;margin-bottom:4px}
.sub{font-size:12px;color:#9a9a90;text-align:center;margin-bottom:28px;line-height:1.5}
label{font-size:11px;font-weight:500;color:#5a5a54;display:block;margin-bottom:5px}
input{width:100%;padding:10px 12px;border:1px solid #e2e0d8;border-radius:8px;
font-size:14px;font-family:inherit;margin-bottom:14px;color:#1a1a18}
input:focus{outline:none;border-color:#185FA5}
button{width:100%;padding:11px;background:#185FA5;color:#fff;border:none;border-radius:8px;
font-size:14px;font-weight:500;cursor:pointer;font-family:inherit;margin-top:6px}
button:hover{background:#0C447C}
.err{font-size:12px;color:#E24B4A;text-align:center;margin-top:12px;min-height:16px}
.note{font-size:11px;color:#9a9a90;text-align:center;margin-top:18px;line-height:1.55}
</style></head><body>
<form class="card" method="POST" action="/__login">
<div class="logo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49M7.76 16.24a6 6 0 0 1 0-8.49M20.07 4.93a10 10 0 0 1 0 14.14M3.93 19.07a10 10 0 0 1 0-14.14"/></svg></div>
<h1>ROSEA Humanitarian Monitor</h1>
<div class="sub">OCHA Regional Office &mdash; Southern &amp; Eastern Africa<br>Sign in to continue</div>
<label for="u">User ID</label>
<input id="u" name="u" type="text" autocomplete="username" autofocus>
<label for="p">Password</label>
<input id="p" name="p" type="password" autocomplete="current-password">
<button type="submit">Sign in</button>
<div class="err">${error}</div>
<div class="note">Authorised OCHA ROSEA staff only.<br>Contact the IM Unit to request access.</div>
</form></body></html>`, {
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
