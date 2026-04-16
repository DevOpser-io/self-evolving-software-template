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
5. If it doesn't match:
   - **AJAX / JSON request** (`req.xhr` or `Accept: application/json`) → `401 { error: 'Authentication required' }`.
   - **Regular browser request** → save `req.originalUrl` to `req.session.returnTo`, redirect to `/auth/login`. After login, user is sent back to `returnTo` (or `/sites` if nothing was saved).

## The current list

As of the initial commit, `publicPaths` contains:

```js
const publicPaths = [
  '/',                    // Landing page (anonymous preview chat)
  '/mobile-builder.html',
  '/mobile-app.html',
  '/auth/login',
  '/auth/signup',
  '/auth/verify-email',
  '/auth/resend-verification',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/magic-link',
  '/auth/mfa-verify',
  '/auth/mfa-setup',
  '/auth/mfa-backup-codes',
  '/auth/send-mfa-code',
  '/auth/google',
  '/auth/google/callback',
  '/mobile/auth',
  '/static',
  '/favicon.ico',
  '/health',
  '/api',                 // API info endpoints
  '/api/health',
  '/admin-panel',
];
```

**Watch out:** `/api` is in the list, which means **every** `/api/foo` you add is public by default unless you think about it. If you're adding authenticated API endpoints, either nest them under a non-public prefix or gate them with `ensureFullAuth` on the route itself.

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

## Requiring MFA on a new route

For routes where being "logged in" isn't enough and you want MFA-verified sessions only (e.g. `/account`, `/chat`, admin-panel things):

```js
const { ensureFullAuth } = require('../middleware/authMiddleware');

router.get('/sensitive', ensureFullAuth, (req, res) => {
  // Only MFA-verified users reach this handler.
});
```

`ensureFullAuth` redirects unauthenticated users to `/auth/login` and MFA-incomplete users to `/auth/mfa-verify`, both with `returnTo` preserved.

## Verification gate

Before reporting a new public route done:

- [ ] The handler exists and responds as expected when hit locally via `npm run dev`.
- [ ] Its prefix is in the `publicPaths` array at `backend/server.js:411`.
- [ ] `curl -i http://localhost:8000/<your-path>` returns `200` (or whatever the expected code is), **not** `302` to `/auth/login`.
- [ ] For AJAX routes, `curl -i -H 'Accept: application/json' ...` returns `200` with JSON, **not** `401`.
- [ ] No write endpoint (POST / PUT / PATCH / DELETE) was made public without an explicit decision from the user.

If any is false, do not report success.
