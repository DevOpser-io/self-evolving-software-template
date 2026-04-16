# Email transport

Email is optional for local dev. Magic-link login, password reset, and MFA codes won't send without it, but the app boots cleanly either way. Default recommendation: **leave it disabled** and accept the one-line boot warning.

## Non-negotiables

- Do **not** put placeholder values like `you@gmail.com` into `MAIL_USERNAME` / `MAIL_PASSWORD`. Nodemailer will try to authenticate on startup and log a stacktrace on every boot. Leave the vars **blank** instead.
- Do not ask the user to configure email unless they've explicitly asked to test magic-link, password reset, or MFA code delivery.

## The three modes

### Mode 1 — Disabled (default for local dev)

In `.env`:

```env
USE_SES=false
MAIL_USERNAME=
MAIL_PASSWORD=
```

The boot log will include a `Missing credentials for PLAIN` or equivalent — this is **expected**. Tell the user it's harmless.

### Mode 2 — Gmail SMTP (easiest real transport)

1. Enable 2-Step Verification on the Google account.
2. Google Account → Security → App passwords → generate one for "Mail" (16 chars).
3. In `.env`:

   ```env
   USE_SES=false
   MAIL_SERVER=smtp.gmail.com
   MAIL_PORT=587
   MAIL_USERNAME=you@gmail.com
   MAIL_PASSWORD=xxxxxxxxxxxxxxxx       # the app password, not the Google login
   MAIL_DEFAULT_SENDER=you@gmail.com
   ```

Works identically with Postmark, Mailgun, Resend, SendGrid, or self-hosted Postfix — just change `MAIL_SERVER` / `MAIL_PORT` / credentials.

### Mode 3 — AWS SES

Only useful if the user is already on AWS (SES reuses Bedrock's credentials):

```env
USE_SES=true
SES_FROM_EMAIL=noreply@yourdomain.com
```

Two caveats:

- The sender address (or entire domain) must be **verified** in the SES console.
- New AWS accounts are in SES sandbox — they can only send to verified recipients. Request production access from AWS if the user needs to send to arbitrary users.

## Portability note

`NODE_ENV=production` resolves `MAIL_PASSWORD_SECRET_NAME` and friends through AWS Secrets Manager. `NODE_ENV=development` (the local-dev default) reads straight from the env. See [`../../devopser-deploy/rules/secrets-manager.md`](../../devopser-deploy/rules/secrets-manager.md) when the user moves to production.

## Verification gate

If the user picked Mode 1 (disabled):

- Confirm `MAIL_USERNAME` and `MAIL_PASSWORD` are **blank** (not placeholder strings).
- Confirm the boot log's `Missing credentials` line is the only email-related warning.

If the user picked Mode 2 or 3:

- Trigger a magic-link login from `/auth/login` and confirm the email arrives (check spam first).
- If the email does not arrive, check the server log for SMTP/SES error lines and relay them to the user verbatim.
