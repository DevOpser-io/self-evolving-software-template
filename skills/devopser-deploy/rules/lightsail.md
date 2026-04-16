# Amazon Lightsail (reference implementation)

Lightsail container services are DevOpser's own default — predictable flat monthly pricing, no ALB / VPC / target-group work, and a clean fit with Bedrock + SES since they all run out of the same AWS account. If the user has no strong opinion about a target and is already on AWS, this is the recommendation.

## Non-negotiables

- No hardcoded AWS account IDs, ARNs, or region strings in committed code. Env vars + the `Site` model columns only.
- Credentials resolve through [`secrets-manager.md`](./secrets-manager.md) in `NODE_ENV=production`, env vars in development.
- If the user is building multi-tenant managed hosting where each customer has their own AWS account, Lightsail still fits — see [`cross-account.md`](./cross-account.md) for the AssumeRole wrapper.

## Shape

| | |
|---|---|
| AWS service | Lightsail container service |
| Pricing | Per-container-service tier (Nano / Micro / Small / Medium / Large / XL) — flat monthly |
| Scaling | Fixed node count per service; scale by bumping the tier |
| TLS | Free managed cert for the service's default `*.lightsail.aws` domain; custom domains via `--certificates` |
| Deploy API | `CreateContainerService`, `CreateContainerServiceDeployment`, `GetContainerServiceDeployments` |
| Teardown | `DeleteContainerService` |

## Integration into `triggerDeployment()`

Per-site fields already exist on the `Site` model and are safe to repurpose:

- `lightsailServiceName` — the AWS resource name for this site's service.
- `lightsailUrl` — the final URL shown on the `Published` badge.
- `deploymentStatus` — mirror of the current `Deployment` row.
- `publishedConfig` — JSON snapshot of the site config at publish time.
- `lastDeployedAt` — timestamp written on `markAsSuccess`.

Recommended order inside `triggerDeployment(site, deployment)`:

1. `deployment.markAsBuilding()`.
2. Resolve AWS credentials (in-account by default; AssumeRole if `CUSTOMER_CROSS_ACCOUNT_ROLE_ARN` is set — see [`cross-account.md`](./cross-account.md)).
3. Build the site bundle (the template's `backend/docker/site-renderer/` is a starting point — check whether the user wants to keep it or replace it).
4. Push the image to ECR.
5. `CreateContainerService` (idempotent: if `site.lightsailServiceName` is set, go straight to step 6).
6. `CreateContainerServiceDeployment` pointing at the pushed image.
7. Poll `GetContainerServiceDeployments` until `state` is `ACTIVE` or a sensible timeout fires.
8. Write `lightsailUrl`, `lightsailServiceName`, `lastDeployedAt` back to the `Site` row.
9. `deployment.markAsSuccess(lightsailServiceName)`.

Mirror step 5's creation with a `DeleteContainerService` call in the site-delete handler.

## Common pitfalls

- **Region mismatch.** Lightsail container services are regional and do not cross regions. Keep `REGION` consistent with wherever Bedrock / SES / Secrets Manager live.
- **Tier too small.** The Nano tier (512 MB RAM) will OOM on anything that does image rendering or large LLM streaming. Default to Micro or Small for real workloads.
- **TLS on custom domains.** Requires separate `CreateCertificate` / `AttachCertificate` calls before the URL serves HTTPS on the custom host.
- **Deployment quota.** Each service has a rolling deployment history cap — old deployments don't auto-prune forever.

## Verification gate

Before reporting a Lightsail deploy wired up:

- [ ] `triggerDeployment()` pushes an image, creates/updates the service, and polls to `ACTIVE`.
- [ ] `Site.lightsailServiceName` and `Site.lightsailUrl` are written back.
- [ ] Site-delete calls `DeleteContainerService`.
- [ ] A publish from the builder UI flips the `Deployment` row `building → success` and the returned URL serves `200` on `/health`.

If any is false, do not report success.
