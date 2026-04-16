# Public vs authenticated routes

The template has a **default-deny** auth model. Every route is private unless its prefix is explicitly listed in the `publicPaths` array at `backend/server.js:411`. Missing this array is the #1 self-inflicted bug when adding a new anonymous endpoint — the handler runs fine, but the global middleware redirects browsers to `/auth/login` and returns `401` to AJAX before the handler ever sees the request. See [`../../../AGENTS.md`](../../../AGENTS.md) → **"Public vs authenticated routes"** for the full breakdown.

## Non-negotiables

- **Don't try to figure out what's public by grepping route files.** Grep `publicPaths` in [`backend/server.js`](../../../backend/server.js). That's the single source of truth.
- **Don't expose write endpoints publicly** (POST / PUT / PATCH / DELETE) unless the user has a concrete reason. The template has exactly two intentional public POSTs: `/api/leads` (form capture) and `/api/preview/generate` (anonymous chat). Everything else should require auth.
- **Don't add `ensureAuthenticated` to every route** to "be safe." The global middleware already enforces it. Belt-and-suspenders makes the code harder to reason about.

## How the middleware works

1. Global middleware runs on every request (around `backend/server.js:409`).
2. It checks the request path against the `publicPaths` array (around `backend/server.js:411`).
3. Matching is **prefix-based**: a path matches if it equals a listed entry exactly **or** starts with `<listed>/`. So `/static` covers `/static/js/bundle.js`; `/api` covers `/api/info`.
4. If it matches → `next()`, handler runs.
5. If it doesn't match and the user is unauthenticated:
   - **AJAX / JSON request** (`req.xhr` or `Accept: application/json`) → `401 { error: 'Authentication required' }`.
   - **Regular browser request** → bare `res.redirect('/auth/login')`. The **global** gate does **not** set `req.session.returnTo` — only the route-level `ensureAuthenticated` / `ensureFullAuth` / `ensureMfaVerified` middlewares do. If you want a post-login bounce back to the deep link the user requested, put one of those on the route instead of relying on the global gate.

## The current list

Read it directly from [`backend/server.js`](../../../backend/server.js) around line 411 — do not trust any copy, including this one, because it drifts. Quick peek:

```bash
sed -n '411,435p' backend/server.js
```

The shape to expect: the landing page, the mobile entry HTML files, every `/auth/*` endpoint needed for sign-in / MFA / OAuth, `/mobile/auth`, `/static`, `/favicon.ico`, `/health`, the `/api` **prefix**, `/api/health`, and `/admin-panel`.

**Watch out:** `/api` itself is listed as a prefix, which means **every** `/api/foo` you add is public by default unless you think about it. If you're adding authenticated API endpoints, either nest them under a non-public prefix (e.g. `/api/private/...`) or gate them explicitly with `ensureFullAuth` on the route itself.

## Adding a new anonymous route — both edits

Adding a public `/pricing` page and a `/api/stats/public` JSON endpoint. Both edits are mandatory — either one alone is wrong.

**Edit 1** — `backend/routes/index.js` (or a new router):

```js
router.get('/pricing', (req, res) => {
  res.render('pricing', { user: req.user || null });
});
```

**Edit 2** — `backend/server.js` `publicPaths`:

```js
const publicPaths = [
  '/',
  // ... existing entries ...
  '/pricing',              // ← add this
  '/api/stats/public',     // ← and this
];
```

Then test:

```bash
curl -i http://localhost:8000/pricing
```

- **`200`** → both edits are in place.
- **`302` to `/auth/login`** → the `publicPaths` entry is missing, or its prefix doesn't match. Fix edit 2.

## Route-level auth

`ensureFullAuth` in `backend/middleware/authMiddleware.js` is the thing to layer on top of the global gate when a route needs more than "request matched `publicPaths` or not":

```js
const { ensureFullAuth } = require('../middleware/authMiddleware');

router.get('/sensitive', ensureFullAuth, (req, res) => {
  // Login required; MFA step required only if this user has opted into MFA.
});
```

What it actually does today (read the source before relying on the docstring — this has moved before):

- No session? → redirect to `/auth/login` (AJAX / mobile → `401`). Saves `req.originalUrl` to `req.session.returnTo`.
- OAuth login (Google, etc.)? → pass. MFA is skipped for OAuth.
- `req.user.mfaEnabled === true` but `req.session.mfaVerified !== true`? → redirect to `/auth/mfa-verify` (AJAX / mobile → `401 { mfa_required: true }`), `returnTo` preserved.
- Otherwise → pass.

MFA is **opt-in** template-wide — a freshly seeded `admin@example.com / adminpass` has `mfaEnabled=false`, so "logged in" is enough for them until they enable MFA from their account settings.

If you want a truly MFA-mandatory route, you need to add your own gate that requires `req.user.mfaEnabled && req.session.mfaVerified`. Don't just stack `ensureFullAuth` and assume MFA was checked.

## Verification gate

Before reporting a new public route done:

- [ ] The handler exists and responds as expected when hit locally via `npm run dev`.
- [ ] Its prefix is in the `publicPaths` array at `backend/server.js:411`.
- [ ] `curl -i http://localhost:8000/<your-path>` returns `200` (or whatever the expected code is), **not** `302` to `/auth/login`.
- [ ] For AJAX routes, `curl -i -H 'Accept: application/json' ...` returns `200` with JSON, **not** `401`.
- [ ] No write endpoint (POST / PUT / PATCH / DELETE) was made public without an explicit decision from the user.

If any is false, do not report success.
