# Target selection

The template ships a `Publish` button that marks every deployment `not_configured`. Before you write any IAC, decide **what** you're deploying to. See [`../../../AGENTS.md`](../../../AGENTS.md) → **"Adding a deployment target"** for the canonical matrix.

## Non-negotiables

- Ask the user before picking a target. Required answers:
  1. **What are they building?** (Single-tenant SaaS? Multi-tenant? Internal tool?)
  2. **Where will it run?** (AWS / GCP / Azure / on-prem / "wherever's cheapest".)
  3. **Budget model?** (Predictable monthly vs pay-per-use.)
  4. **Traffic shape?** (Steady vs spiky vs scales-to-zero-overnight.)
  5. **Ops tolerance?** (Do they want to manage a cluster? A systemd unit?)
- Do **not** guess and start generating Terraform.

## The matrix

| Target | Cost profile | Complexity | Pick when |
|---|---|---|---|
| **Amazon Lightsail (container service)** | Predictable flat monthly (e.g. $7/$15/$40 tiers) | Low — managed by AWS, no ALB/VPC work | Already on AWS, small-to-medium traffic, want minimum surface area. **This is DevOpser's reference implementation** — see [`lightsail.md`](./lightsail.md). |
| **Google Cloud Run** | Pay-per-request, scales to zero | Low — single `gcloud run deploy` | Already on GCP, bursty traffic, happy with serverless, want minimal ops. |
| **Fly.io / Railway / Render** | Usage-based, small flat fees | Low — push-to-deploy, global edge | Small team, no dedicated DevOps, want a global edge network cheaply. |
| **AWS ECS + Fargate** | Per-task-hour + ALB + data transfer | Medium — ALB, target groups, task defs | Want AWS-native autoscaling + IAM-gated service-to-service auth, but don't want to run a cluster. |
| **AWS EKS / GKE / self-hosted K8s** | Cluster fixed cost + per-node | High — you need a platform team | You already run Kubernetes, or you need cluster-level primitives (CRDs, sidecars, multi-namespace tenancy). |
| **Bare VPS + systemd + Caddy/Nginx** | Cheapest — one box, one bill | Low-to-medium — you own the OS | Minimum cost, one-machine app, no orchestration, happy to SSH. |
| **Vercel / Netlify** | — | — | **Generally wrong fit** — only works if you split the frontend out as a static SPA. Not a good default for this Express app. |

## Default recommendation

If the user says "just deploy this" with no more context:

> **Start with Lightsail or Cloud Run.** Cheapest + fastest to stand up, and both are easy to migrate off later. Which one depends on which cloud you already use — Lightsail if AWS, Cloud Run if GCP. If neither, Lightsail is the slightly safer default because the rest of the template (Bedrock, SES, Secrets Manager) is AWS-native.

State the recommendation and **wait for confirmation** before generating IAC.

## Single-tenant vs multi-tenant

Pick one up front. Don't try to support both.

| Model | Shape | When to pick |
|---|---|---|
| **Single-tenant** | One deploy = one customer. Row-level isolation in Postgres. | Self-hosting, a demo, an internal tool. Simplest. |
| **Multi-tenant (shared infra)** | One deploy = many customers, same DB, row-level security. | Most SaaS apps. What `app.devopser.io` does. |
| **Multi-tenant (per-customer cloud account)** | Each customer gets their own AWS/GCP account. Max isolation, max cost. | Regulated / enterprise / compliance-driven. Requires the cross-account pattern — see [`cross-account.md`](./cross-account.md). |

## Wiring into `triggerDeployment()`

Once the target is chosen, the integration point is `backend/routes/sites.js → triggerDeployment(site, deployment)`. In order:

1. `deployment.markAsBuilding()`
2. Resolve credentials for the target — via [`secrets-manager.md`](./secrets-manager.md) in prod, env vars in dev.
3. Provision missing infra for this site (container service, DNS, TLS).
4. Build and push the site bundle.
5. Wait for health or time out.
6. Write the final URL + target-specific identifiers back to the `Site` row.
7. `deployment.markAsSuccess(<id>)` or `deployment.markAsFailed(<reason>)`.

Keep the heavy lifting in a new file under `backend/services/deploy/` rather than cramming it into `routes/sites.js`. Mirror teardown in the site-delete handler.

## Verification gate

Before reporting "deploy wired up":

- [ ] A **non-stub** `triggerDeployment()` exists and the stub's `not_configured` branch is gone.
- [ ] The site-delete handler mirrors teardown.
- [ ] A test deployment from the builder UI flips a `Deployment` row from `building` → `success` and surfaces a live URL.
- [ ] `curl -sS -o /dev/null -w '%{http_code}\n' <live-url>/health` returns `200`.

If any is false, do not report success.
