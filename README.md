# Self-Evolving Software Template

[![Managed Hosting](https://img.shields.io/badge/Managed%20Hosting-app.devopser.io-blue?style=for-the-badge)](https://app.devopser.io)
[![License](https://img.shields.io/badge/License-Apache%202.0-green?style=for-the-badge)](LICENSE)

A full-stack **SaaS starter template** — Express.js + Postgres + Redis with AI chat (Claude / OpenAI / Anthropic, pluggable), user authentication (local + Google OAuth + magic link + MFA), an admin panel, an example website builder, and an optional mobile shell (Capacitor Android/iOS). **Configurable for any SaaS use case** — CRM, project management, support desk, e-commerce, analytics dashboard, AI chatbot platform, anything. Ship fast, swap subsystems as you go, and let your AI coding agent of choice wire up the parts that are intentionally left blank (deployment target, billing, custom features).

> **Prefer managed hosting?** [app.devopser.io](https://app.devopser.io) runs this template for you — no PostgreSQL, Redis, AWS, or secrets wiring. We're also building an **import-your-code** feature so you can bring a fork of this repo and have it just work on the managed platform.

---

## Fast path — one command

If you have **Node 20+** and **Docker** installed, the fastest way to stand up a working local copy is:

```bash
git clone https://github.com/DevOpser-io/self-evolving-software-template.git
cd self-evolving-software-template
./scripts/setup.sh
```

This script checks prerequisites, creates `.env` from `.env.example`, starts PostgreSQL + Redis in Docker, installs all dependencies, runs migrations, and seeds the default admin user. When it finishes, set your LLM credentials in `.env` (OpenAI, Anthropic, or Bedrock — see [step 4 below](#4-configure-environment-variables)) and run either:

```bash
npm run dev                                 # hot-reload dev server
docker compose --profile app up -d --build  # fully containerized
```

Then open **http://localhost:8000** and sign in with `admin@example.com` / `adminpass`.

### Have an AI coding agent do it for you

After cloning the repo, open it in Claude Code / Cursor / Aider / Copilot Workspace / your favorite agent and paste this prompt:

> **Set this repo up for me locally.**
>
> 1. Read `AGENTS.md`, especially the **"Quick setup for AI agents"** section at the top — it's the authoritative playbook for this task.
> 2. Run `./scripts/setup.sh` and relay any prerequisite errors verbatim (Node version, Docker, port conflicts, etc.).
> 3. Ask me **once** which LLM provider to configure — OpenAI, Anthropic, or AWS Bedrock — and for the matching credentials. Don't guess, don't pick a default. If I pick Bedrock and I'm on an MFA-protected IAM identity, follow the `aws configure export-credentials` pattern documented in `AGENTS.md`.
> 4. Write the credentials into `.env` (never commit `.env` — it's gitignored).
> 5. Start the app. Ask me whether I want `npm run dev` (hot-reload) or `docker compose --profile app up -d --build` (fully containerized).
> 6. Verify with `curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:8000/auth/login` that it returns `200`, and check the server logs for `Server running on http://localhost:8000`. Do not report success until both are true.
> 7. Tell me the URL, the admin credentials (`admin@example.com` / `adminpass`), and anything that failed or was skipped.

The agent should be able to take you from a fresh clone to a running UI at http://localhost:8000 in 3–5 minutes of mostly unattended work, pausing only to ask for credentials.

#### Opinionated variant (Bedrock, nothing to decide)

If you already know you want AWS Bedrock and you don't want the agent to ask you anything, paste this instead. It pre-commits every decision, spells out the pre-flight checks, and defines "done" as four verifiable checks — not "the process booted."

> Clone https://github.com/DevOpser-io/self-evolving-software-template into
> ~/workspace-breakdown/ and get it serving at http://localhost:8000. I want to
> be able to open a browser to http://localhost:8000/auth/login, sign in as
> admin@example.com / adminpass, and hit the chat UI with Bedrock responding.
> That is the definition of done — do not report success until I can do that.
>
> Follow AGENTS.md (especially "Quick setup for AI agents") as the playbook.
>
> Non-negotiables — do not ask me, these are already decided:
>
> - LLM provider: AWS Bedrock
> - Region: us-east-1
> - Model: us.anthropic.claude-sonnet-4-5-20250929-v1:0
> - AWS credentials: use whatever I already have set up in my local AWS CLI.
>   Run `aws sts get-caller-identity` first to confirm a working identity —
>   if that succeeds, resolve credentials via
>   `aws configure export-credentials --format env` and export them into the
>   shell that runs the server. If my default profile needs MFA or a specific
>   named profile, detect that and use `AWS_PROFILE=<name>` with the same
>   export-credentials call — do not invent a profile name, read it from
>   `~/.aws/config` or ask me which one to use. Never write AWS keys to .env.
> - Run mode: `npm run dev` (host-side, hot-reload, against dockerized pg+redis).
>   Start it in the background so you can keep working.
> - Port: 8000. If anything else is already bound to 8000, tell me which process
>   and stop — do not silently pick a different port.
> - Email: leave disabled. The Gmail SMTP init-failure log line on boot is
>   expected. Do NOT ask me to configure email.
> - Admin: use the seeded admin@example.com / adminpass as-is.
>
> Pre-flight before running setup.sh:
>
> - Check ownership of ~/.npm/_cacache. If any subdir is root-owned (from an
>   old `sudo npm install`), redirect this session's cache:
>     `npm config set cache ~/.npm-user-cache`
>   Do not sudo-chown ~/.npm without asking me first.
> - Check `lsof -iTCP:8000 -sTCP:LISTEN` and `lsof -iTCP:5432 -sTCP:LISTEN`
>   and `lsof -iTCP:6379 -sTCP:LISTEN`. If any are occupied by something
>   that isn't a prior sest-* container, stop and tell me — don't clobber.
> - Run `aws sts get-caller-identity` to confirm my local AWS CLI is working
>   before you touch anything else. If it fails, stop and show me the error —
>   don't guess at credentials or edit my `~/.aws/` files.
>
> Steps:
>
> 1. ./scripts/setup.sh  (relay any prerequisite errors verbatim)
> 2. Edit .env to set LLM_PROVIDER=bedrock, REGION=us-east-1,
>    BEDROCK_MODEL_ID=us.anthropic.claude-sonnet-4-5-20250929-v1:0
> 3. `eval "$(aws configure export-credentials --format env)"` (prepend
>    `AWS_PROFILE=<name>` if my setup requires a named profile), then
>    `npm run dev` in the same shell, backgrounded.
>
> Verify ALL FOUR before reporting success:
>
>   a. `curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:8000/auth/login`
>      returns 200
>   b. `curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:8000/health`
>      returns 200
>   c. Server logs contain `Server running on http://localhost:8000`
>   d. Server logs contain `Current AWS Identity: arn:aws:iam::...:user/...`
>      (this proves Bedrock will actually work — not just that the process booted)
>
> Report (under 200 words): the URL, admin creds, the resolved AWS identity ARN,
> the background task ID for the dev server, the `docker ps` line for
> sest-postgres and sest-redis, and anything that was skipped or failed.
>
> If ANY of (a)(b)(c)(d) is false, do not say "done" — say what's wrong and what
> you tried. Silence on a failure is worse than a verbose failure.

> **MFA-protected Bedrock credentials expire.** If you come back the next day and the chat starts failing with `security token invalid`, the fix is to re-export your MFA session and restart the app — see the [AGENTS.md](AGENTS.md#quick-setup-for-ai-agents) section for the one-liner.

If you'd rather install PostgreSQL/Redis on the host (no Docker), or you hit an issue with the script, follow the manual [Quick Start](#quick-start-local-development) below.

---

## Prerequisites

Before you start, make sure you have:

| Tool | Version | Why |
|------|---------|-----|
| Node.js | 20 or 23 (LTS) | Runs the Express backend and builds the frontend |
| npm | Comes with Node | Package manager |
| PostgreSQL | 14+ | Primary data store |
| Redis | 6+ | Session storage (the server refuses to start without it) |
| AWS account | — | Required for Claude Sonnet via AWS Bedrock |
| Git | any | To clone or fork the repo |

### Installing PostgreSQL and Redis locally

Pick whichever matches your OS. You only need to do this once.

**macOS (Homebrew):**

```bash
brew install node@20 postgresql@14 redis
brew services start postgresql@14
brew services start redis
```

**Ubuntu / Debian:**

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib redis-server
sudo systemctl enable --now postgresql redis-server
# Install Node 20 LTS from NodeSource (Ubuntu's apt node is too old)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

**Amazon Linux 2023 / RHEL / Fedora:**

```bash
sudo dnf install -y postgresql15-server postgresql15 redis6
sudo postgresql-setup --initdb
sudo systemctl enable --now postgresql redis6
# Node 20 via NodeSource
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
```

**Windows:** Use [PostgreSQL installer](https://www.postgresql.org/download/windows/), [Memurai](https://www.memurai.com/) (Redis for Windows), and the [Node.js installer](https://nodejs.org/). Or run everything inside WSL2 using the Ubuntu commands above.

After installing, verify everything is reachable:

```bash
pg_isready                         # should print: accepting connections
redis-cli ping                     # should print: PONG
node -v                            # should print v20.x or v23.x
```

---

## Quick Start (Local Development)

These steps assume you're **forking or cloning this repo** to your own machine.

### 1. Fork and clone

Click **Fork** on GitHub to get your own copy (optional but recommended if you plan to contribute), then clone:

```bash
git clone https://github.com/<your-username>/self-evolving-software-template.git
cd self-evolving-software-template
```

### 2. Create the local database

Bedrock Express defaults to a database named `devdb` owned by `devuser`. On a fresh Postgres install, only the `postgres` OS user can create new roles and databases, so the commands below are prefixed with `sudo -u postgres`:

```bash
sudo -u postgres createuser -s devuser
sudo -u postgres psql -c "ALTER USER devuser WITH PASSWORD 'password';"
sudo -u postgres createdb -O devuser devdb
```

Verify password auth works:

```bash
PGPASSWORD=password psql -U devuser -d devdb -h localhost -c '\conninfo'
```

> **Already using `devdb` on this machine?** Pick a unique name — e.g. `mytemplate_devdb` / `mytemplate_devuser` — and update `POSTGRES_DB` / `POSTGRES_USER` in `.env` (step 4) to match. Postgres's default `peer` auth usually lets `devuser` connect over `localhost` with a password once the role is created; if your `pg_hba.conf` rejects password auth, change the relevant line to `md5` and run `sudo systemctl reload postgresql`.

### 3. Start Redis

Make sure Redis is running on `localhost:6379`. You can verify with:

```bash
redis-cli ping   # should return PONG
```

### 4. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and pick an LLM provider. The chat and website-agent features go through a provider facade (`backend/services/llm/`) that supports three backends out of the box — pick whichever matches what you already have credentials for.

**Option A — AWS Bedrock (default, uses Claude via Amazon):**

```env
LLM_PROVIDER=bedrock
REGION=us-east-1
# BEDROCK_MODEL_ID=us.anthropic.claude-sonnet-4-5-20250929-v1:0
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

> In the AWS Console, go to **Bedrock → Model access** and request access to Claude Sonnet. Approval is usually instant. Your IAM principal needs `bedrock:InvokeModel` *and* `bedrock:InvokeModelWithResponseStream`. Bedrock is only available in certain regions (`us-east-1`, `us-west-2`, etc.) — `REGION` must be one of them.
>
> **You're hitting your own AWS account.** The backend uses the default AWS credential chain (env vars, `~/.aws/credentials`, EC2 instance role, ECS task role), so whichever identity you've already configured locally is the one that makes the Bedrock calls. No cross-account assume, no platform-account middleman — just your credentials, directly to Bedrock in your own account. If you later port this to a multi-tenant platform (e.g. [app.devopser.io](https://app.devopser.io)) where a platform account needs to call Bedrock in a customer account, set `CUSTOMER_CROSS_ACCOUNT_ROLE_ARN` in the environment and the same code path will AssumeRole into that account automatically. See `.env.example` for the var.

**Option B — OpenAI (GPT-4o, GPT-4o-mini, etc.):**

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
# OPENAI_BASE_URL=                  # override for Azure OpenAI, local vLLM, etc.
```

**Option C — Anthropic API (Claude, without AWS):**

```env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-5-20250929
```

No code changes are needed to switch providers — just set `LLM_PROVIDER` and the matching API key, then restart. Shared tuning (`MAX_TOKENS`, `TEMPERATURE`) applies to all three.

> **Adding a fourth provider?** Copy `backend/services/llm/openaiProvider.js` as a template, implement `generateResponse` and `streamResponse` (yielding plain text deltas), and register the new name in `backend/services/llm/index.js`. You do not need to touch `chatController` or `websiteAgentService` — they consume the normalized facade. Note that the experimental tool-calling website builder (`websiteAgentServiceV2.js`) uses Bedrock's Converse API directly and only works with `LLM_PROVIDER=bedrock`.

#### Email (magic-link, password reset, MFA codes)

The template ships with two email transports. Pick one and set the matching env vars in `.env`.

**Option 1 — Gmail SMTP with an app password (easiest for self-hosting, no AWS needed):**

1. In your Google account, turn on **2-Step Verification** if it isn't already.
2. Go to **Google Account → Security → App passwords**, generate a new app password for "Mail", and copy the 16-character value.
3. Set in `.env`:

   ```env
   USE_SES=false
   MAIL_SERVER=smtp.gmail.com
   MAIL_PORT=587
   MAIL_USERNAME=you@gmail.com
   MAIL_PASSWORD=xxxxxxxxxxxxxxxx     # the app password, not your Google login password
   MAIL_DEFAULT_SENDER=you@gmail.com
   ```

This works identically with any SMTP provider (Postmark, Mailgun, Resend, SendGrid, your own Postfix) — just change `MAIL_SERVER`, `MAIL_PORT`, `MAIL_USERNAME`, and `MAIL_PASSWORD`.

**Option 2 — AWS SES:**

```env
USE_SES=true
SES_FROM_EMAIL=noreply@yourdomain.com
```

The SES path uses the same AWS credentials as Bedrock. You must verify the sender address in the SES console (or your whole domain). New AWS accounts are in SES sandbox mode and can only send to verified recipients — request production access from AWS if you want to send to arbitrary users.

> **Portability note:** in `NODE_ENV=production` the Gmail SMTP path resolves `MAIL_SERVER` / `MAIL_USERNAME` / `MAIL_PASSWORD_SECRET_NAME` through AWS Secrets Manager (matching how the managed platform runs). In `NODE_ENV=development` (the default for self-hosting) it reads the values straight from the env. Same code, two modes — so the template stays portable to managed hosting.

### 5. Install dependencies

```bash
npm run install:all
```

This installs packages for both `frontend/` and `backend/`.

### 6. Run database migrations

```bash
cd backend
npx sequelize-cli db:migrate
cd ..
```

### 7. Create the default admin user

```bash
npm run init-admin-users
```

In development mode this seeds a single admin:

- **Email:** `admin@example.com`
- **Password:** `adminpass`

Change this immediately after first login.

### 8. Start the dev server

```bash
npm run dev
```

The app will be available at **http://localhost:8000**. Sign in with the admin credentials above.

---

## Quick Start (Docker)

The included `Dockerfile` is a minimal build that runs the app on port 8000. You still need PostgreSQL and Redis reachable from the container — the simplest path is to run them on your host and point at them via `host.docker.internal`.

**Build:**

```bash
docker build -t bedrock-express .
```

**Run:**

```bash
docker run -p 8000:8000 \
  -e POSTGRES_HOST=host.docker.internal \
  -e POSTGRES_DB=devdb \
  -e POSTGRES_USER=devuser \
  -e POSTGRES_PASSWORD=password \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  -e REGION=us-east-1 \
  -e AWS_ACCESS_KEY_ID=your-access-key \
  -e AWS_SECRET_ACCESS_KEY=your-secret-key \
  bedrock-express
```

Migrations and the initial admin user still need to be created against your database — run steps 6 and 7 from the Local Development Quick Start above (from the host, not inside the container).

---

## Troubleshooting

- **`ECONNREFUSED` on port 5432** — PostgreSQL isn't running, or credentials in `.env` don't match. Re-check step 2.
- **`FATAL: role "<your-os-user>" does not exist`** on `createuser`/`createdb` — Postgres's default auth requires running DDL commands as the `postgres` OS user. Prefix with `sudo -u postgres` as shown in step 2.
- **Server exits with a Redis error** — Redis isn't running or `REDIS_URL` is wrong. See step 3.
- **`AccessDeniedException` from Bedrock** — Your IAM user lacks `bedrock:InvokeModel`, or you haven't requested Claude model access in that region. See step 4.
- **Port 8000 already in use** — Stop whatever is bound to it, or set `PORT=8001` in `.env`.
- **`[S3] ERROR: S3_BUCKET_NAME environment variable is required`** at boot — harmless for local dev. S3 is only used by the site-image upload feature; the rest of the app works without it. Set `S3_BUCKET_NAME=` to any value in `.env` to silence the log line, or ignore it.
- **`[StackSet] Error ensuring StackSet`** / **`[OAuth] Google OAuth not configured`** — both are startup checks for optional managed-hosting features (cross-account deploys and Google sign-in). They're logged as warnings, not errors, and don't prevent the server from running.

> Hitting too many of these? [app.devopser.io](https://app.devopser.io) handles all of the infrastructure so you can focus on your app.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Clients                             │
│  Browser ─── Mobile (Capacitor) ─── API (X-API-Key)    │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                  Express.js Server                       │
│                                                         │
│  ┌─────────┐  ┌──────────┐  ┌────────┐  ┌───────────┐  │
│  │  Auth   │  │   Chat   │  │ Sites  │  │  Admin    │  │
│  │ Routes  │  │  Routes  │  │ Routes │  │  Panel    │  │
│  └────┬────┘  └────┬─────┘  └───┬────┘  └─────┬─────┘  │
│       │            │            │              │         │
│  ┌────▼────────────▼────────────▼──────────────▼─────┐  │
│  │              Middleware Layer                      │  │
│  │  Passport.js · Helmet · CORS · CSRF · Sessions    │  │
│  └───────────────────────┬───────────────────────────┘  │
└──────────────────────────┼──────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
  ┌───────▼──────┐ ┌──────▼──────┐ ┌───────▼───────┐
  │  PostgreSQL  │ │    Redis    │ │  AWS Bedrock  │
  │  (Sequelize) │ │  (Sessions) │ │   (Claude)    │
  └──────────────┘ └─────────────┘ └───────────────┘
```

---

## What's in the box

Out of the box, the template ships with a working stack that most SaaS apps need on day one. Every piece has a documented extension point in [`AGENTS.md`](AGENTS.md) so you (or your AI agent) can swap, extend, or delete it for your use case.

**Core infrastructure (ready to use):**

- **Pluggable LLM** — AI chat with streaming, backed by AWS Bedrock *or* OpenAI *or* the Anthropic API (pick one via `LLM_PROVIDER`; add a fourth by copying a provider file)
- **Authentication** — local accounts with bcrypt, Google OAuth, magic links, TOTP MFA, plus API keys for programmatic access
- **Admin panel** — user management, audit views, system health
- **Email** — Gmail SMTP *or* AWS SES, gated by `NODE_ENV` so self-hosted and managed deploys run the same code
- **Mobile shell** — Capacitor 5 setup for shipping the web app as Android APK/AAB and iOS IPA
- **Security** — strict CSP (no `unsafe-inline`), CSRF, helmet, rate limiting, secure sessions in Redis

**Example features (replace/extend for your SaaS):**

- **Website builder** — a chat-driven, template-backed site editor with preview and a `Publish` button that hooks into a deploy-target stub. Keep it if you're building a website-builder SaaS, or repurpose the builder UI for whatever your product actually does.
- **Lead capture** — a simple form-to-DB flow attached to published sites.

**Two chat surfaces (important — they're different code paths):**

- **`/` — stateless preview chat.** Anonymous, public, single-turn. Visitors type a prompt, the backend calls the LLM once, no history, no `conversationId`, no Redis writes. Designed as a "try before you sign up" hook that converts into a real account on the first authenticated action. Lives in `backend/templates/landing-builder.ejs` + `backend/public/static/js/landing-builder.js`.
- **`/chat` — stateful conversational app.** Authenticated (login + MFA), persistent, multi-turn. Every message pulls the full thread for the active `conversationId` from Redis, appends, sends the whole history to the LLM, streams the response, writes back. Supports listing past conversations, loading a specific one, and resetting. Lives in `backend/templates/chat.ejs` + `backend/controllers/chatController.js`.

If you're extending the "real product chat," edit `/chat`. If you're extending the landing/signup funnel, edit `/`. They don't share code. [`AGENTS.md`](AGENTS.md) has the full breakdown with file paths and a decision flowchart.

**Route visibility defaults to private.** There's a global auth middleware in `backend/server.js` around line 409 that redirects unauthenticated browser requests to `/auth/login` and returns `401` to unauthenticated AJAX requests. Any new route you want anonymous users to reach must be added to the `publicPaths` array in that same file — the list is the single source of truth for "what's public." Details in [`AGENTS.md`](AGENTS.md) → "Public vs authenticated routes."

**Intentionally left blank (the self-evolving part):**

- **Deployment target** — no bundled CI, no cloud-specific IAC. You (and your AI agent) pick the target (Lightsail / Cloud Run / Fly / ECS / K8s / VPS / …), generate the IAC, and wire it into `backend/routes/sites.js → triggerDeployment()`. See [`AGENTS.md`](AGENTS.md).
- **Billing / metering** — no Stripe, Paddle, or usage-metering built in. Add whichever fits your model.
- **Your actual product** — this is a starter kit, not a vertical product. The website builder is one example; swap it out.

## Tech Stack

| Layer          | Technology                                              |
|----------------|---------------------------------------------------------|
| Backend        | Express.js, Node.js 23                                  |
| Database       | PostgreSQL (Sequelize ORM)                              |
| Cache/Sessions | Redis                                                   |
| AI             | AWS Bedrock · OpenAI · Anthropic API (pluggable)        |
| Frontend       | Vanilla JS, Webpack, Marked, DOMPurify                  |
| Auth           | Passport.js (local + Google OAuth), Speakeasy, bcrypt   |
| Email          | Nodemailer (SMTP) · AWS SES                             |
| Mobile         | Capacitor 5 (Android + iOS)                             |
| Infra          | Docker (minimal base image on port 8000)                |

---

## Self-Hosting

See **[SELF_HOSTING.md](SELF_HOSTING.md)** for detailed self-hosting instructions, including all infrastructure prerequisites and known friction points.

**TL;DR:** You need PostgreSQL, Redis, an AWS account with Bedrock access, and (optionally) SES for email. Production deploys use AWS Secrets Manager for credentials.

> Self-hosting too much work? [app.devopser.io](https://app.devopser.io) handles all of this for you.

---

## Useful Scripts

Once you're up and running, these are the commands you'll use day-to-day:

```bash
npm run dev                # rebuild frontend + start backend with hot reload
npm run frontend:build     # rebuild just the frontend bundle
npm run frontend:watch     # rebuild frontend on change
cd backend && npx sequelize-cli db:migrate    # apply new migrations
npm run init-admin-users   # re-seed admin user(s)
```

---

## Mobile Apps (Optional)

Bedrock Express ships with a Capacitor 5 setup so you can wrap the chat experience as native Android and iOS apps. The mobile UI lives in `mobile-chat-app.html` at the repo root and is packaged by `build-mobile.sh` into `frontend/public/static/dist/` for Capacitor to pick up.

### Prerequisites

| Platform | You'll need |
|----------|-------------|
| Android  | [Android Studio](https://developer.android.com/studio) (JDK 21 bundled), an Android SDK, and an emulator or physical device |
| iOS      | macOS, [Xcode](https://developer.apple.com/xcode/), CocoaPods (`sudo gem install cocoapods`), and an Apple Developer account for signing |

### First-time setup

From the repo root, generate the native projects:

```bash
npx cap add android     # creates the android/ directory
npx cap add ios         # creates the ios/ directory (macOS only)
```

These native project directories are **not committed** — each developer generates them locally.

### Build and run

Point the build at whichever backend you want the app to talk to by setting `MOBILE_ENV` and the matching URL:

```bash
# Build against your local dev backend (http://localhost:8000)
npm run mobile:build

# Or against a deployed backend
PRODUCTION_URL=https://your-domain.com npm run mobile:build:prod
STAGING_URL=https://staging.your-domain.com npm run mobile:build:staging
```

`MOBILE_ENV` controls which URL, app name, and config values get baked into the mobile bundle. See `build-mobile.sh` for the full list of substitutions.

After the build, sync to the native projects and open them in an IDE:

```bash
npm run mobile:sync           # copies dist/ into android/ and ios/

npm run mobile:android        # open android/ in Android Studio
npm run mobile:ios            # open ios/ in Xcode (macOS only)

# Or build + run on a connected device
npm run mobile:run:android
npm run mobile:run:ios
```

### Customizing the app

- **App identity** — edit `capacitor.config.json` to change `appId` (e.g., `com.yourcompany.yourapp`), `appName`, and the splash screen colors. Re-run `npm run mobile:sync` afterwards.
- **Mobile UI** — edit `mobile-chat-app.html`. It's a single-file HTML app with inline CSS/JS; rebuild with `npm run mobile:build` to pick up changes.
- **API endpoints** — edit the `endpoints` block in `build-mobile.sh` to add or rename routes. They get baked into `mobile-config.js` at build time.
- **Android icons/splash** — drop your assets into `android/app/src/main/res/` after `npx cap add android`, then re-sync.
- **iOS icons/splash** — use Xcode's asset catalog (`ios/App/App/Assets.xcassets/`) after `npx cap add ios`.

### Signing release builds (Android)

1. Generate a keystore with `keytool -genkey -v -keystore release.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000`.
2. Create `android/keystore.properties` with:
   ```
   storeFile=../../release.keystore
   storePassword=your-store-password
   keyAlias=my-key-alias
   keyPassword=your-key-password
   ```
3. Run `./configure-android-signing.sh` — it patches `android/app/build.gradle` to read from `keystore.properties` for release builds.
4. Build: `cd android && ./gradlew assembleRelease`. The signed APK lands in `android/app/build/outputs/apk/release/`.

> **Never commit `keystore.properties` or the keystore file itself.** Add both to `.gitignore`.

### Signing release builds (iOS)

iOS signing is handled entirely through Xcode. Open the project with `npm run mobile:ios`, select your Apple Developer team under **Signing & Capabilities**, and archive via **Product → Archive**. See [Capacitor's iOS docs](https://capacitorjs.com/docs/ios/deploying-to-app-store) for the full walkthrough.

---

## Deployment — Bring Your Own

This template ships a **running app** but **no deployment pipeline**. The `Publish` button on a built site is a stub that marks the deployment `not_configured` and points at [`AGENTS.md`](AGENTS.md) for wiring up the target you want.

That's intentional. The premise of a "self-evolving software template" is that you pick the target that fits your needs — Amazon Lightsail, Google Cloud Run, Fly.io, ECS/Fargate, Kubernetes, a bare VPS, whatever — and have your AI coding agent of choice (Claude Code, Cursor, Aider, Copilot Workspace, …) generate the IAC and wire it into `backend/routes/sites.js → triggerDeployment()`. `AGENTS.md` is written for those agents and documents the extension points, the rules, and reusable patterns (including a generic cross-account trust-role bootstrap recipe for multi-tenant platforms).

Start with something cheap and predictable — Lightsail or Cloud Run are good defaults — and iterate from there. [app.devopser.io](https://app.devopser.io) also runs this template for you if you'd rather skip the deployment work entirely.

---

## Contributing

Contributions are welcome. Please open an issue first to discuss what you'd like to change.

## License

This project is licensed under the Apache License 2.0 -- see [LICENSE](LICENSE) for details.
