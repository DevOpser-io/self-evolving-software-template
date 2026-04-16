# devopser-deploy

Human-facing overview. The agent-facing file is [`SKILL.md`](./SKILL.md).

## What this skill does

Helps an AI coding agent ship the DevOpser template to a real environment and produce signed mobile release artifacts. The deployment layer is **intentionally blank** in the template — this skill guides target selection, wires into `backend/routes/sites.js → triggerDeployment()`, and covers the AWS Secrets Manager + cross-account patterns that keep self-hosted and managed-hosting on the same code path.

No new scripts are introduced. The skill reuses `./build-mobile.sh` and `./configure-android-signing.sh` as-is.

## Example user queries that trigger it

- "Deploy this to Lightsail — I'm already on AWS."
- "Ship the app to Google Cloud Run."
- "Wire up cross-account AssumeRole so each customer deploys into their own AWS account."
- "Build me a signed Android APK for the Play Store."
- "I cut over to production and `MAIL_PASSWORD` stopped resolving."

## Rules

| Rule | Description |
|------|-------------|
| [target-selection](./rules/target-selection.md) | Decision matrix + default recommendation |
| [lightsail](./rules/lightsail.md) | Reference implementation — what DevOpser uses |
| [secrets-manager](./rules/secrets-manager.md) | `NODE_ENV=production` secret resolution |
| [cross-account](./rules/cross-account.md) | `CUSTOMER_CROSS_ACCOUNT_ROLE_ARN` + AssumeRole |
| [mobile-release](./rules/mobile-release.md) | Android keystore signing + iOS Xcode archive |

## See also

- Top-level index: [`../README.md`](../README.md)
- Canonical playbook: [`../../AGENTS.md`](../../AGENTS.md) → "Adding a deployment target"
- Human mobile docs: [`../../README.md`](../../README.md) → "Mobile Apps (Optional)"
