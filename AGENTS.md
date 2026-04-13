# Self-Evolving Software Template — Agent Guide

This file is written for **AI coding agents** (Claude Code, Cursor, Aider, Copilot Workspace, etc.) configuring or extending this template on behalf of a human.

The core idea: this repo ships a **running full-stack SaaS starter kit** — Express.js, Postgres, Redis, pluggable AI chat (Bedrock / OpenAI / Anthropic), auth (local + Google + magic link + MFA), an admin panel, an example website builder, and a mobile shell. It's **not a vertical product** — it's a template you configure for whatever SaaS the human is building (CRM, help desk, analytics dashboard, AI chatbot platform, project management tool, e-commerce, etc.). The website builder is one example feature; keep it, extend it, or replace it.

**Three things are deliberately left blank** for you to fill in once the human tells you what they're building and where:

1. **Their actual product.** The website builder UI at `/` is a starting point, not the destination. Ask what they're building and reshape the routes, models, and UI accordingly.
2. **The deployment target.** No bundled CI, no cloud-specific IAC. Pick a target (Lightsail / Cloud Run / Fly / ECS / K8s / VPS / …), generate the IAC, and wire it into `backend/routes/sites.js → triggerDeployment()`.
3. **Billing and metering.** No Stripe / Paddle / usage tracking. Add whichever fits.

Treat this file as your playbook. When asked to "deploy", "publish", "set up hosting", "add Cloud Run / Lightsail / ECS / Fly / K8s / a VPS / …", "turn this into a CRM / help desk / analytics tool / …", or "add Stripe billing", start here.

---

## Repo map

```
/
├── Dockerfile                   # Minimal node:23-slim image, runs on :8000
├── README.md                    # Human onboarding (prereqs, local dev, features)
├── SELF_HOSTING.md              # Human self-hosting guide (DB, Redis, Bedrock, Secrets Manager)
├── AGENTS.md                    # ← you are here
├── .env.example                 # All configurable env vars, grouped by subsystem
│
├── frontend/                    # Vanilla JS + Webpack, built to backend/public/static/dist
│
├── backend/
│   ├── server.js                # Express entry point. Bootstrap hooks live here.
│   ├── config/                  # Env-driven config, NODE_ENV-gated for prod/dev
│   ├── models/                  # Sequelize models (User, Site, Lead, ApiKey, Deployment, …)
│   ├── migrations/              # Sequelize migrations — always forward-only
│   ├── routes/                  # Express routers
│   │   ├── auth.js              #  login, magic-link, MFA, Google OAuth
│   │   ├── chat.js              #  /api/chat/* SSE streaming
│   │   ├── sites.js             #  website builder CRUD + publish stub
│   │   ├── api.js               #  JSON API key-protected endpoints
│   │   └── index.js             #  landing, account, admin
│   ├── controllers/
│   │   └── chatController.js    # Streams LLM output to clients
│   └── services/
│       ├── llm/                 # Pluggable LLM providers (bedrock|openai|anthropic)
│       ├── bedrockService.js    # AWS Bedrock client (singleton, cross-account capable)
│       ├── emailService.js      # SES or Gmail SMTP, gated by NODE_ENV
│       ├── redisService.js      # Session/chat history storage
│       ├── secretsManager.js    # AWS Secrets Manager resolver (production only)
│       ├── s3Service.js         # Site-image uploads
│       ├── templateService.js   # Website template schemas
│       └── websiteAgentService.js  # AI-driven site config editor
│
└── mobile-*.html                # Capacitor webview screens (Android/iOS shell)
```

---

## Core extension points

The template is designed so you can swap subsystems without touching application code. Before writing anything new, check if the problem already has a plug-in point:

### 1. LLM provider — `backend/services/llm/`

Supported: `bedrock`, `openai`, `anthropic`. Selected by `LLM_PROVIDER` env var.

To add a new provider (e.g. Mistral, Cohere, local vLLM, Together.ai):

1. Copy `openaiProvider.js` as a starting point — it's the simplest.
2. Implement `create()` returning an object with two methods:
   - `generateResponse(messages): Promise<string>` — non-streaming, returns the full text.
   - `streamResponse(messages): AsyncIterable<string>` — yields plain text deltas. **Normalize** any provider-specific chunk format into text-only deltas; `chatController.js` consumes the iterable blindly.
3. Register the provider name in `backend/services/llm/index.js` → the `switch` block.
4. Add a new block to `.env.example` and `README.md` documenting the required env vars.

You do **not** need to touch `chatController` or `websiteAgentService` — they call through the facade.

### 2. Email transport — `backend/services/emailService.js`

Two modes, gated by `NODE_ENV`:

- `development` → reads `MAIL_SERVER / MAIL_PORT / MAIL_USERNAME / MAIL_PASSWORD` directly from env. Works with Gmail app passwords or any SMTP provider (Postmark, Mailgun, Resend, SendGrid, Postfix, …).
- `production` → reads the same vars as **secret names**, resolves them through AWS Secrets Manager.

`USE_SES=true` uses AWS SES in both modes instead. If you add a new transport (Postmark API, Resend API, etc.), mirror this NODE_ENV gate so self-hosted and managed-hosting deployments use the same code.

### 3. Authentication method — `backend/routes/auth.js` + Passport strategies

Built-in: local (email/password + bcrypt), Google OAuth, magic link (SMTP), TOTP MFA, API keys.

To add a new provider (GitHub, SAML, Auth0, WorkOS, Clerk, …):

1. Install the matching Passport strategy or SDK.
2. Wire it up in `backend/config/passport.js`.
3. Add routes in `backend/routes/auth.js`.
4. Mirror the `triggerAWSAccountProvisioning()` stub hook after successful login if your deployment target needs per-user bootstrap — this is the right place for tenant provisioning.

### 4. Deployment target — `backend/routes/sites.js → triggerDeployment()`

This is the **main blank-slate extension point** and where you'll spend the most time. See the next section.

---

## Adding a deployment target

The `Publish` button in the website builder currently hits a stub that marks every deployment as `not_configured`. Your job when a human asks for "deploy this to X" is to:

1. **Pick the target** based on what the human has and how they want to bill/tenant it.
2. **Write the IAC** for it (CloudFormation / Terraform / Pulumi / CDK / SAM / plain shell — whatever fits).
3. **Implement `triggerDeployment(site, deployment)`** in `backend/routes/sites.js` so the publish button actually deploys.
4. **Mirror the teardown** in the site-delete handler in the same file.
5. **Update the `Site` model** if you need per-site state (service name, URL, external ID, etc.). There are already optional columns (`lightsailServiceName`, `lightsailUrl`, `deploymentStatus`, `publishedConfig`, `lastDeployedAt`) you can repurpose or replace.

### Target selection

| Target | When to pick it |
|---|---|
| **Amazon Lightsail (container service)** | Small-to-medium sites, predictable monthly pricing, you're already on AWS, want minimal surface area. Good default recommendation for cost-conscious users. |
| **Google Cloud Run** | Serverless containers, scales to zero, pay-per-request, you're already on GCP. Minimal ops. |
| **Fly.io / Railway / Render** | Global edge, push-to-deploy UX, small team, no dedicated DevOps. |
| **AWS ECS + Fargate** | You want AWS-native autoscaling, ALB integration, IAM-gated service-to-service auth, but don't want to run a cluster. |
| **AWS EKS / GKE / self-hosted K8s** | You already run Kubernetes for other workloads, or you need cluster-level features (CRDs, multi-namespace, sidecars). |
| **Vercel / Netlify** | Only works if you split the frontend out as a static SPA — not a great fit for this Express app as shipped. |
| **Bare VPS + systemd/Caddy/Nginx** | Minimum cost, maximum simplicity, one-machine sites. No orchestration, no magic. |

Ask the human about: expected traffic, budget, existing cloud relationships, whether they need multi-tenancy, and how much they want to pay in ongoing ops effort. Don't guess.

### Single-tenant vs multi-tenant

Two very different architectures — pick one up front, don't try to support both:

- **Single-tenant:** One deploy = one customer. Simplest. All published sites go into one container service / one project / one VPS. Site isolation is at the DB row level.
- **Multi-tenant (shared infra):** One deploy = many customers, but they share the hosting. Most SaaS apps. DB-level tenant isolation, row-level security, scoped API keys.
- **Multi-tenant with per-customer account:** Every customer gets their own AWS/GCP account. Maximum isolation, maximum cost per customer, useful for regulated/enterprise workloads. Requires the **bootstrap trust pattern** described below.

### The cross-account bootstrap pattern (abstract)

If the human asks you to build a multi-tenant platform where each customer gets their own cloud account, here's the standard recipe — expressed abstractly so you can re-derive it for any cloud:

1. The **platform account** holds the application code and the identity that runs it.
2. Each **customer account** holds a **trust role** with a tightly-scoped policy (only the actions your deploys need — e.g. create a container service, write a DNS record, read an image).
3. The trust role's trust policy allows assumption **only** from a specific principal in the platform account, gated by an **external ID** unique to that customer (protects against confused-deputy attacks).
4. The platform code calls `AssumeRole` at request time to get short-lived credentials for the customer account, does the deploy, lets the credentials expire.
5. Customer accounts are bootstrapped by deploying the trust role via a **per-cloud org-wide mechanism**:
   - **AWS:** CloudFormation StackSets targeted at an AWS Organizations Organizational Unit. One template, many accounts, automatic rollout on new-account join.
   - **GCP:** Organization-level IAM policies and Deployment Manager.
   - **Azure:** Management Groups + Azure Policy assignments or Blueprints.

**Rules when implementing this pattern:**

- Never hardcode account IDs, role names, or ARNs in code or docs you commit. Use env vars or a `customers` table.
- The trust role's policy must be **least privilege** — if you only need to manage Lightsail + Route53, don't grant `*`.
- The external ID must be generated per-customer and stored alongside the customer row, not derived from anything guessable.
- If the deploy target's credentials are ever logged, redact them.
- **Do not** store long-lived customer credentials — only fetch short-lived ones via AssumeRole at request time.
- Point the human at the official cloud vendor docs for the specific mechanics — don't invent trust policy JSON from memory.

### Wiring it into `triggerDeployment()`

The stub in `backend/routes/sites.js` is the single integration point. Your implementation should, in order:

1. Mark the `Deployment` row as `building` via `deployment.markAsBuilding()`.
2. Resolve credentials for the target (AssumeRole, service account key, kubeconfig, API token — whatever your target needs). Pull secrets via `secretsManager.js` in production mode, env vars in development mode (mirror the `NODE_ENV` gate used elsewhere).
3. Provision any missing infrastructure for this site (container service, DNS record, TLS cert, …).
4. Build and push the site bundle. For static sites, the existing `backend/docker/site-renderer/` is a starting point.
5. Wait for the deploy to become healthy (or set a sensible timeout).
6. Write the final URL and target-specific identifiers back to the `Site` row.
7. Call `deployment.markAsSuccess(<identifier>)` on success or `deployment.markAsFailed(<reason>)` on failure.

Keep the heavy lifting in a new file under `backend/services/deploy/` rather than cramming it into `routes/sites.js`.

---

## Rules for any code you add

1. **Portability is non-negotiable.** Self-hosted and managed-hosting deploys run the same code. Gate production-only behavior on `NODE_ENV === 'production'`, not on feature flags or separate files.
2. **No hardcoded account IDs, role names, or URLs** — even placeholder ones that look real. Use env vars, and document them in `.env.example` and `README.md`.
3. **Secrets from Secrets Manager in production, env vars in development** — match the pattern in `backend/config/database.js` and `backend/services/emailService.js`.
4. **Never commit `.env`, keystores, or credentials.** The `.gitignore` already excludes `.env*` except for `.env.example`; don't add exceptions.
5. **CSP compliance.** `backend/server.js` sets strict CSP with no `unsafe-inline`. Use nonces for any new inline scripts/styles and prefer class toggles over `element.style.foo` in frontend JS.
6. **i18n.** English and Hebrew are both supported. Any user-facing string goes in `backend/i18n/en.json` *and* `he.json`; templates use `<%= t('key') %>`, client JS uses `_t('key')`.
7. **Migrations are forward-only.** If you need to change the schema, add a new migration file; never edit an existing one.
8. **Run the dev loop locally before shipping.** At minimum: `npm run install:all`, `npx sequelize-cli db:migrate`, `npm run dev`, `curl localhost:8000/health`.
9. **Document as you go.** Every new env var goes in `.env.example`. Every new extension point gets a short section in this file or in `README.md`.

---

## Working with a human

When the human asks you to extend the template, ask the following before writing code:

1. **What are they building?** A SaaS, an internal tool, a demo, a multi-tenant platform? This changes the architecture decisions.
2. **Where will it run?** Single region, global, on-prem, air-gapped? Which cloud (if any)?
3. **What's the budget?** Predictable monthly pricing vs. pay-per-use changes the target recommendation.
4. **How will users sign up and pay?** Affects auth, tenant model, admin UI needs.
5. **What does "publish" mean for their use case?** For some it's "one static site per user". For others it's "spin up a whole customer environment". Very different implementations.

If the human has a vague request like "deploy this", default to **single-tenant on Lightsail or Cloud Run** and confirm with them before building anything else — those are the cheapest and fastest to stand up.

Once you have answers, write a short plan in the conversation (not in a new file), get approval, then implement. Keep commits focused: "Add Cloud Run deployment target" is one commit, not five.
