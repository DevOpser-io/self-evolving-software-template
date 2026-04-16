# Verification gate

**The definition of done for `devopser-setup`.** Do not tell the user "setup complete" or "it's running" until every check below has passed for the specific provider they selected. Silence on a failure is worse than a verbose failure — report what was checked, what passed, and what didn't.

Modeled on the four-check gate from the README's **"Opinionated variant (Bedrock)"** prompt.

## Non-negotiables

- Do not report success if any check is skipped, unknown, or pending.
- Do not substitute a weaker check (e.g. "`docker ps` shows the container" is not the same as "`/auth/login` returned 200").
- If a check fails, relay the failing command and its exact output — do not paraphrase.

## The four checks

### (a) `/auth/login` returns 200

```bash
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:8000/auth/login
```

Expect: `200`. Anything else (including `302` to a hosted identity provider) → the server is up but the login template is broken; stop and investigate.

### (b) `/health` returns 200

```bash
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:8000/health
```

Expect: `200`. This confirms the auth middleware is wired up correctly — `/health` is in the `publicPaths` list, so a `302` here means the middleware is *not* reading the list right.

### (c) Server log contains the ready line

Expect a log line containing:

```
Server running on http://localhost:8000
```

If the process is running but this line is missing, the server booted with a fatal error after the HTTP listener started. Check for `Redis` or `Sequelize` stacktraces.

### (d) Bedrock-only: AWS identity log line

If (and only if) the user picked `LLM_PROVIDER=bedrock`, expect a log line of the form:

```
Current AWS Identity: arn:aws:iam::<account>:user/<user>
```

or `arn:aws:sts::<account>:assumed-role/...` for role-based identities.

This check exists because **the process will boot cleanly without valid AWS credentials** — Bedrock is lazy-initialized and only fails on the first chat request. Without this log line you cannot promise the chat UI will actually work.

If the identity line is missing or shows an unexpected account, go back to [`llm-provider.md`](./llm-provider.md) → "MFA-protected IAM identity" and re-export credentials into the shell running the server.

## Reporting

If all four pass, report to the user (keep it under ~150 words):

- The URL (http://localhost:8000).
- Admin creds: `admin@example.com` / `adminpass` — remind the user to change on first login.
- The configured provider and model.
- For Bedrock: the resolved AWS identity ARN.
- The `docker ps` lines for `sest-postgres` and `sest-redis`.
- Anything that was skipped (e.g. email left disabled) and why.

If any of the four fail, report **what failed and what you tried**, not "mostly working."
