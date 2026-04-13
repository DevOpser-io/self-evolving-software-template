# Self-Hosting Guide

This guide walks you through deploying Bedrock Express on your own infrastructure.

> **Want to skip all of this?** [app.devopser.io](https://app.devopser.io) provides fully managed hosting -- no AWS configuration, no database setup, no Redis tuning. Just deploy.

---

## Prerequisites

You will need the following services running and accessible:

| Service        | Required | Notes                                                   |
|----------------|----------|---------------------------------------------------------|
| PostgreSQL 14+ | Yes      | Primary data store for users, sites, leads, API keys    |
| Redis 6+       | Yes      | Session storage and caching                             |
| AWS Account    | Yes      | Bedrock access (Claude Sonnet) is the core AI feature   |
| AWS SES        | No       | Email verification, password resets, MFA codes          |
| Domain + SSL   | No       | Required for production; localhost works for development |

---

## Step-by-Step Setup

### 1. Database (PostgreSQL)

Provision a PostgreSQL instance. You can use RDS, a managed provider (Supabase, Neon), or run it locally.

```bash
# Create the database
createdb devdb

# Run migrations
cd backend
npx sequelize-cli db:migrate
```

**Friction point:** In production, database credentials are pulled from **AWS Secrets Manager**, not environment variables. You'll need to create the following secrets in your AWS account:

- `your-prefix/db-username`
- `your-prefix/db-password`
- `your-prefix/db-name`
- `your-prefix/db-host`
- `your-prefix/db-port`

Then set the corresponding `DB_*_SECRET_NAME` environment variables in your container to point to those secret ARNs/names. There is no "just pass a connection string" option in production mode.

### 2. Redis

Redis is **required** for session storage. Without it, the server will refuse to start.

```bash
# Local
redis-server

# Or use AWS ElastiCache, Upstash, etc.
```

Set `REDIS_URL` to your Redis connection string (e.g., `redis://localhost:6379`).

### 3. AWS Bedrock Access

The AI chat feature requires AWS Bedrock with Claude Sonnet model access enabled.

1. Go to the AWS Console > Bedrock > Model access
2. Request access to **Claude Sonnet 3.5** (or the model you want)
3. Wait for approval (usually instant for on-demand)
4. Ensure your IAM credentials have `bedrock:InvokeModel` permissions

**Friction point:** Bedrock is not available in all AWS regions. You must deploy in a region that supports it (e.g., `us-east-1`, `us-west-2`). Your AWS credentials need to be configured either via instance role, environment variables, or the default credential chain.

### 4. AWS Secrets Manager (Production)

In production (`NODE_ENV=production`), the application reads **all** database credentials and sensitive configuration from AWS Secrets Manager. This is not optional.

#### What you'll need first

- An **AWS CLI** configured with credentials that have `secretsmanager:CreateSecret`, `secretsmanager:PutSecretValue`, and `secretsmanager:GetSecretValue` permissions (the default admin policy works, or attach `SecretsManagerReadWrite`).
- A naming prefix — the examples below use `myapp/prod/` but any prefix works. Pick one and stay consistent.

#### Create each secret

Each credential is stored as its **own** secret (not a single JSON blob — the application reads them individually).

```bash
PREFIX="myapp/prod"
REGION="us-east-1"

# Database credentials
aws secretsmanager create-secret --name "${PREFIX}/db-name"     --secret-string "bedrockexpress"     --region "$REGION"
aws secretsmanager create-secret --name "${PREFIX}/db-user"     --secret-string "bedrockexpress"     --region "$REGION"
aws secretsmanager create-secret --name "${PREFIX}/db-password" --secret-string "CHANGE-ME-STRONG"   --region "$REGION"
aws secretsmanager create-secret --name "${PREFIX}/db-host"     --secret-string "your-rds-endpoint.rds.amazonaws.com" --region "$REGION"
aws secretsmanager create-secret --name "${PREFIX}/db-port"     --secret-string "5432"               --region "$REGION"

# Admin users (JSON document — list of emails that get admin role on first login)
aws secretsmanager create-secret \
  --name "${PREFIX}/admin-users" \
  --secret-string '{"admin_users":[{"email":"you@example.com","password":"CHANGE-ME"}]}' \
  --region "$REGION"

# Mail password (only needed if using SMTP instead of SES)
aws secretsmanager create-secret --name "${PREFIX}/mail-password" --secret-string "your-smtp-password" --region "$REGION"
```

If a secret already exists, `create-secret` errors out — use `put-secret-value` to update instead:

```bash
aws secretsmanager put-secret-value --secret-id "${PREFIX}/db-password" --secret-string "new-password" --region "$REGION"
```

#### Wire the secret names into the container

Set these environment variables on whatever runs the container (ECS task definition, Kubernetes deployment, `docker run -e`, etc.) — they point at the names you just created:

```env
REGION=us-east-1
DB_NAME_SECRET_NAME=myapp/prod/db-name
DB_USER_SECRET_NAME=myapp/prod/db-user
DB_PASSWORD_SECRET_NAME=myapp/prod/db-password
DB_HOST_SECRET_NAME=myapp/prod/db-host
DB_PORT_SECRET_NAME=myapp/prod/db-port
ADMIN_USERS_SECRET_NAME=myapp/prod/admin-users
MAIL_PASSWORD_SECRET_NAME=myapp/prod/mail-password
```

#### Grant the container read access

The container's execution role (ECS task role, EKS service account, EC2 instance role, etc.) must be allowed to read the secrets. Minimal policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"],
    "Resource": "arn:aws:secretsmanager:us-east-1:<ACCOUNT_ID>:secret:myapp/prod/*"
  }]
}
```

Replace `us-east-1` and `<ACCOUNT_ID>` as appropriate. The wildcard at the end of the resource ARN matches every secret under your prefix — Secrets Manager appends a random 6-character suffix to each ARN, so you can't pin exact ARNs until after creation.

#### Verify

Before launching the container, confirm the role can actually read a secret:

```bash
aws secretsmanager get-secret-value --secret-id "${PREFIX}/db-password" --region "$REGION" --query SecretString --output text
```

If that returns the value you stored, the application will be able to read it too.

**Friction point:** The application uses both the AWS SDK v3 async API (at runtime) and the AWS CLI (invoked by the admin-user seed script, which regenerates a temp `.env` from Secrets Manager before handing off to Sequelize CLI). Your execution environment must have **both** working credentials — typically this means an IAM role attached to the ECS task / EC2 instance, which both paths pick up automatically.

### 5. Email (AWS SES)

Email is used for:
- Account verification
- Password reset links
- MFA code delivery

Without SES configured, these features silently fail. Set:

```env
MAIL_USERNAME=your-ses-verified-email@example.com
MAIL_DEFAULT_SENDER=noreply@yourdomain.com
MAIL_PASSWORD_SECRET_NAME=myapp/prod/mail-password
REGION=us-east-1
```

**Friction point:** SES starts in sandbox mode -- you can only send to verified email addresses. You need to request production access from AWS, which can take 24-48 hours.

### 6. Google OAuth (Optional)

To enable "Sign in with Google":

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Configure OAuth consent screen
3. Create OAuth 2.0 credentials
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

Or store them in `ADDITIONAL_SECRETS` as a JSON blob in Secrets Manager:

```json
{
  "GOOGLE_CLIENT_ID": "your-id.apps.googleusercontent.com",
  "GOOGLE_CLIENT_SECRET": "your-secret"
}
```

### 7. Deployment Target (Bring Your Own)

This template **does not ship a built-in deployment pipeline**. The chat app, website builder, admin panel, and auth all run standalone; the `Publish` action on a built site is a stub that marks the deployment row `not_configured` and points you at `AGENTS.md` for wiring up your own target.

That's intentional: the idea of a "self-evolving software template" is that you (and your AI coding agent of choice) pick the target that fits your needs — Lightsail, Cloud Run, Fly.io, ECS, Kubernetes, a bare VPS, whatever — and generate the IAC for it on demand. `AGENTS.md` documents the patterns worth reusing, including:

- A generic cross-account AssumeRole recipe for multi-tenant deploys
- A high-level description of the StackSet + AWS Organizations OU pattern for bootstrapping a trust role into many accounts at once
- Starting points for Docker-based targets and hints on which clients to prefer (e.g. Lightsail for predictable pricing)

Deployment is meant to be the place you start customizing. Ask your AI agent to generate IAC for a target, review it, and plug it into `backend/routes/sites.js → triggerDeployment()`.

---

## Docker Deployment

```bash
docker build -t bedrock-express .

docker run -p 8000:8000 \
  -e NODE_ENV=production \
  -e REDIS_URL=redis://your-redis:6379 \
  -e REGION=us-east-1 \
  -e DB_NAME_SECRET_NAME=myapp/prod/db-name \
  -e DB_USER_SECRET_NAME=myapp/prod/db-user \
  -e DB_PASSWORD_SECRET_NAME=myapp/prod/db-password \
  -e DB_HOST_SECRET_NAME=myapp/prod/db-host \
  -e DB_PORT_SECRET_NAME=myapp/prod/db-port \
  bedrock-express
```

The container runs as non-root user (UID 3000) on port 8000.

---

## Development Mode (Easier)

For local development, credentials are read from environment variables or a `.env` file -- no Secrets Manager needed:

```bash
cp .env.example .env
# Edit .env with your local PostgreSQL and Redis details
npm run install:all
npm run dev
```

---

## Summary of Friction Points

| Area                  | What You Need                                    | Difficulty |
|-----------------------|--------------------------------------------------|------------|
| PostgreSQL            | Provision and run migrations                     | Low        |
| Redis                 | Running instance, set REDIS_URL                  | Low        |
| AWS Bedrock           | Account + model access in supported region       | Medium     |
| AWS Secrets Manager   | 5-7 individual secrets for production            | Medium     |
| AWS SES               | Verified domain, production access approval      | Medium     |
| Google OAuth          | GCP project, consent screen, credentials         | Medium     |
| Cross-Account Deploy  | AWS Organizations, Terraform, IAM roles          | High       |
| SSL/Domain            | Certificate, DNS, load balancer                  | Medium     |
| Mobile Builds         | Signing keys, app store accounts, CI secrets     | High       |

> **All of this is handled automatically on [app.devopser.io](https://app.devopser.io).**
