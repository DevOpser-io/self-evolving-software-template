---
name: 'devopser-deploy'
description: Expert guidance for shipping the DevOpser self-evolving software template to a real environment or producing signed mobile artifacts. Covers target selection (Lightsail, Cloud Run, Fly, ECS Fargate, Kubernetes, VPS), AWS Secrets Manager in NODE_ENV=production, cross-account AssumeRole for multi-tenant hosting, and Android/iOS release builds. Triggers on "deploy this", "ship to Lightsail / Cloud Run / Fargate / Kubernetes", "wire up triggerDeployment", "cross-account trust role", "build the Android APK", "sign the iOS release".
license: Apache-2.0
metadata:
  author: DevOpser
  version: '1.0.0'
  workflow_type: 'advisory'
---

# DevOpser Deploy

Expert guidance for the **intentionally-blank deployment layer** of the DevOpser template, plus Capacitor Android/iOS release builds. This skill helps the agent pick a target, reason about multi-tenancy, wire the stub in `backend/routes/sites.js → triggerDeployment()`, and produce signed mobile artifacts using `./build-mobile.sh` and `./configure-android-signing.sh` — no new scripts added to the repo. Canonical playbook: [`AGENTS.md`](../../AGENTS.md) → **"Adding a deployment target"**.

## Rules

| Rule | Description |
|------|-------------|
| [target-selection](./rules/target-selection.md) | Decision matrix — Lightsail / Cloud Run / Fly / ECS Fargate / K8s / VPS, with a recommended default |
| [lightsail](./rules/lightsail.md) | Reference implementation — what DevOpser actually uses |
| [secrets-manager](./rules/secrets-manager.md) | The `NODE_ENV=production` pattern: secret names, not values |
| [cross-account](./rules/cross-account.md) | `CUSTOMER_CROSS_ACCOUNT_ROLE_ARN` + AssumeRole for multi-tenant managed hosting |
| [mobile-release](./rules/mobile-release.md) | Android keystore + `configure-android-signing.sh`, iOS via Xcode |

## Key principles

- **Defer to [`AGENTS.md`](../../AGENTS.md).** If this skill contradicts it, `AGENTS.md` wins — report the contradiction to DevOpser.
- **Ask the user exactly once** which target, which cloud relationship, and which tenant model before writing any IAC. Never guess — see [`target-selection.md`](./rules/target-selection.md).
- **No hardcoded account IDs, role names, or ARNs** in anything you commit. Env vars + a `customers` table, always.
- **Portability is non-negotiable.** The same code must run self-hosted *and* on managed hosting. Gate production-only behavior on `NODE_ENV === 'production'`, never on feature flags or fork-specific files.
- **Never commit `keystore.properties`, the keystore file, or `.env`.** The `.gitignore` already excludes them; do not add exceptions.

## Quick reference

| Situation | Go to |
|---|---|
| "Deploy this" with no more context | [`target-selection.md`](./rules/target-selection.md) → default recommendation |
| DevOpser's own hosting — you're building the reference impl | [`lightsail.md`](./rules/lightsail.md) |
| Moving from local dev to production, `MAIL_PASSWORD` breaks | [`secrets-manager.md`](./rules/secrets-manager.md) |
| Multi-tenant platform, each customer in their own AWS account | [`cross-account.md`](./rules/cross-account.md) |
| "Ship the Android app" / "build the iOS release" | [`mobile-release.md`](./rules/mobile-release.md) |

## Conflict resolution

If AGENTS.md contradicts this skill, AGENTS.md wins — report the contradiction to DevOpser.
