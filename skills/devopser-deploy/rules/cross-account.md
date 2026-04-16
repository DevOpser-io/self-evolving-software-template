# Cross-account AssumeRole (multi-tenant managed hosting)

The template is wired to support a **platform account** that calls into **per-customer AWS accounts** for deploys or Bedrock invocation. This is the pattern `app.devopser.io` uses — and it's what the `CUSTOMER_CROSS_ACCOUNT_ROLE_ARN` env var unlocks. Canonical playbook: [`../../../AGENTS.md`](../../../AGENTS.md) → **"The cross-account bootstrap pattern (abstract)"**.

Only invoke this rule if the user is explicitly building multi-tenant managed hosting where each customer gets their own cloud account. Otherwise they should leave `CUSTOMER_CROSS_ACCOUNT_ROLE_ARN` unset and skip this entire rule — the default credential chain already points at their own account.

## Non-negotiables

- **No hardcoded account IDs, role names, or external IDs** anywhere in committed code or docs. They live in env vars and a `customers` table.
- **External IDs must be generated per-customer** and stored with the customer row. Never derive them from anything guessable (email, subdomain, sequential integer).
- **Least privilege on the trust role.** If the platform only manages Lightsail + Route53 in the customer account, do not grant `*`.
- **No long-lived customer credentials.** Always AssumeRole at request time; let the short-lived creds expire.
- **Redact AssumeRole responses in logs.** Even accidentally.
- **Don't invent trust-policy JSON from memory.** Point the user at the cloud vendor's official docs for the exact mechanics.

## The pattern (abstract)

1. **Platform account** holds the app code and the identity that runs it (EC2 instance role, ECS task role, etc.).
2. **Each customer account** holds a **trust role** with a scoped policy — only the actions platform deploys need.
3. The trust role's trust policy:
   - Principal = a specific IAM role in the platform account (not a user, not `*`).
   - Condition = `sts:ExternalId` equals a per-customer value (defense against confused-deputy).
4. Platform code calls `AssumeRole` at request time, does the work with the returned short-lived creds, lets them expire.
5. Customer accounts are bootstrapped by a per-cloud org-wide mechanism:
   - **AWS:** CloudFormation StackSets targeted at an AWS Organizations OU. One template, many accounts, automatic rollout on new-account join.
   - **GCP:** org-level IAM + Deployment Manager.
   - **Azure:** Management Groups + Azure Policy assignments or Blueprints.

## Wiring into the template

The integration point is `backend/services/bedrockService.js` (for Bedrock calls) and [`./target-selection.md`](./target-selection.md) step 2 (for deploys). Both check `CUSTOMER_CROSS_ACCOUNT_ROLE_ARN` from the **customer row**, not from a global env var, when operating on behalf of a customer. Use an env var only when there's exactly one cross-account target (e.g. you run a single shared services account).

Lookup order inside the request handler:

1. Load the customer row.
2. Read `customers.cross_account_role_arn` and `customers.external_id`.
3. AssumeRole with those + a per-request session name (include the user's ID and a short purpose string; it shows up in CloudTrail).
4. Build the AWS SDK client with the returned temporary credentials.
5. Use the client. Let the credentials expire — do not cache across customers.

## Things the platform code must NOT do

- **Log raw `AssumeRole` responses.** They contain session tokens.
- **Re-use a client across customers.** The client holds credentials scoped to one customer; mixing them is a data-isolation bug and a confused-deputy foot-gun.
- **Fall back to the default credential chain on AssumeRole failure.** That would silently call Bedrock / Lightsail in the *platform* account using the *platform* identity — a cross-tenant data-leak. Fail loudly instead.
- **Write the external ID into a log message or error response.** Treat it like a secret.

## Verification gate

Before enabling cross-account in production:

- [ ] The customer row has `cross_account_role_arn` and `external_id` populated.
- [ ] The trust role exists in the customer account with the scoped policy the platform actually needs.
- [ ] The trust policy has an `sts:ExternalId` condition matching the stored external ID.
- [ ] `AssumeRole` from the platform principal succeeds and returns creds.
- [ ] On a forced AssumeRole failure, the request returns an error — it does **not** silently run as the platform identity.
- [ ] No log line contains the raw session token or the external ID.

If any is false, do not enable the flow for real customer traffic.
