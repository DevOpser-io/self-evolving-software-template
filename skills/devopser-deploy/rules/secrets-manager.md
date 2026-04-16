# AWS Secrets Manager (production secret resolution)

The template uses a **NODE_ENV gate** so self-hosted and managed-hosting deploys run the exact same code. `NODE_ENV=development` reads env vars directly; `NODE_ENV=production` treats the same vars as **secret names** and resolves the actual value through AWS Secrets Manager. See [`../../../AGENTS.md`](../../../AGENTS.md) → **"Email transport"** and the rules-for-code section for the canonical pattern.

## Non-negotiables

- **Do not** introduce a "production" secrets-resolution path that diverges from the dev path. Gate on `NODE_ENV === 'production'`, not on hostname, not on a feature flag.
- **Do not** hardcode secret names in code. They go in env vars (`MAIL_PASSWORD_SECRET_NAME`, etc.) and the code calls the `secretsManager.js` resolver.
- **Do not** log resolved secret values, ever. If you add logging around the resolver, redact.
- **Do not** store long-lived customer AWS credentials. Use AssumeRole — see [`cross-account.md`](./cross-account.md).

## The naming convention

Every secret consumed by the app follows the same three-step pattern:

1. Code references an env var with a `_SECRET_NAME` suffix (or the bare name, depending on the subsystem — match what's already there; don't invent a third convention).
2. In `NODE_ENV=production` the resolver treats the value as a Secrets Manager secret name and fetches the plaintext.
3. In `NODE_ENV=development` the resolver short-circuits and reads the value straight from the env.

Examples already wired into the template:

| Env var (production) | What it points at | Resolver |
|---|---|---|
| `MAIL_PASSWORD_SECRET_NAME` | Secret name holding the Gmail app password | `secretsManager.js` → `emailService.js` |
| `POSTGRES_PASSWORD_SECRET_NAME` | Secret name holding the DB password | `secretsManager.js` → `config/database.js` |

Mirror the same pattern when you add a new subsystem. Do not hand-roll your own `AWS.SecretsManager` client.

## IAM permissions the app role needs

```json
{
  "Effect": "Allow",
  "Action": [
    "secretsmanager:GetSecretValue",
    "secretsmanager:DescribeSecret"
  ],
  "Resource": "arn:aws:secretsmanager:<region>:<account>:secret:<prefix>/*"
}
```

Scope `Resource` down to a per-app prefix (e.g. `mytemplate/*`) rather than `"*"`. The app should not have carte blanche over every secret in the account.

## Where to wire the resolver in a new subsystem

Mirror [`backend/services/emailService.js`](../../../backend/services/emailService.js) — it's the reference. The shape is:

1. Read the env var's *value* (which is either the plaintext in dev or a secret name in prod).
2. In production, pass it through the `secretsManager.js` resolver.
3. Use the resolved value. Do not retain it on a long-lived object — resolve on demand or cache with a TTL.

## Verification gate

Before reporting a production cutover complete:

- [ ] Every production secret is written to Secrets Manager with a consistent name prefix.
- [ ] Every `*_SECRET_NAME` env var in the production config points at an existing secret.
- [ ] The app's IAM role has `secretsmanager:GetSecretValue` scoped to that prefix.
- [ ] A boot of the production container emits no "failed to resolve secret" log lines.
- [ ] `NODE_ENV=development` still boots locally with the same code path (no divergent prod-only file).

If any is false, do not report success.
