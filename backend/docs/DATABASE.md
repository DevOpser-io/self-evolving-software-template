# DevOpser Lite Database Documentation

## Overview

DevOpser Lite uses PostgreSQL as its primary database. The application uses Sequelize ORM for database operations and migrations.

## Development Database Configuration

### Connection Details

| Setting | Value |
|---------|-------|
| Database Name | `devopser_lite` |
| Host | `localhost` |
| Port | `5432` |
| User | Set via `POSTGRES_USER` in `.env` |
| Password | Set via `POSTGRES_PASSWORD` in `.env` |

### Environment Variables

Located in `/home/ec2-user/lite-bedrockexpress/.env`:

```bash
POSTGRES_DB=devopser_lite
POSTGRES_USER=<your_username>
POSTGRES_PASSWORD=<your_password>
```

## Database Schema

### Tables Overview

| Table | Description |
|-------|-------------|
| `Users` | User accounts and authentication |
| `conversations` | Chat conversation history |
| `sites` | Customer websites with draft/published configs |
| `deployments` | Deployment history and status |
| `site_images` | Uploaded images with S3 keys |
| `aws_account_provisions` | AWS account provisioning records |
| `Leads` | Lead capture from customer website forms |
| `SequelizeMeta` | Migration tracking |

### Entity Relationship Diagram

```
┌─────────────────┐
│     Users       │
│─────────────────│
│ id (PK)         │
│ email           │
│ password_hash   │
│ name            │
│ isAdmin         │
│ mfaEnabled      │
│ ...             │
└────────┬────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐      1:N      ┌─────────────────┐
│     sites       │──────────────▶│   deployments   │
│─────────────────│               │─────────────────│
│ id (PK)         │               │ id (PK)         │
│ user_id (FK)    │               │ site_id (FK)    │
│ name            │               │ status          │
│ slug (unique)   │               │ config_snapshot │
│ status          │               │ started_at      │
│ draft_config    │               │ completed_at    │
│ published_config│               └─────────────────┘
│ deployment_status│
│ ...             │
└────────┬────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐      1:N      ┌─────────────────┐
│   site_images   │               │     Leads       │
│─────────────────│               │─────────────────│
│ id (PK)         │               │ id (PK)         │
│ site_id (FK)    │◀──────────────│ site_id (FK)    │
│ prompt          │               │ form_data       │
│ s3_key          │               │ source          │
│ cloudfront_url  │               │ status          │
│ created_at      │               │ submitted_at    │
└─────────────────┘               └─────────────────┘
```

### Table Details

#### Users
Core user authentication table.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key, auto-increment |
| email | VARCHAR(255) | Unique email address |
| password_hash | VARCHAR(255) | Bcrypt hashed password |
| name | VARCHAR(255) | Display name |
| isAdmin | BOOLEAN | Admin flag |
| emailVerified | BOOLEAN | Email verification status |
| mfaEnabled | BOOLEAN | MFA enabled flag |
| mfaSecret | VARCHAR(255) | TOTP secret (encrypted) |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

#### sites
Customer websites managed by the builder.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key, auto-increment |
| user_id | INTEGER | FK to Users |
| name | VARCHAR(255) | Site name |
| slug | VARCHAR(100) | Unique URL slug |
| status | ENUM | draft, deploying, published, failed |
| draft_config | JSONB | Builder configuration (working copy) |
| published_config | JSONB | Last deployed configuration |
| deployment_status | ENUM | none, pending, deploying, success, failed |
| lightsail_url | VARCHAR(255) | Deployed site URL |
| last_deployed_at | TIMESTAMP | Last deployment time |
| custom_domain | VARCHAR(255) | Custom domain (optional) |

#### deployments
Deployment history for each site.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key, auto-increment |
| site_id | INTEGER | FK to sites |
| status | ENUM | pending, building, deploying, success, failed |
| config_snapshot | JSONB | Configuration at deployment time |
| error_message | TEXT | Error details if failed |
| started_at | TIMESTAMP | Deployment start time |
| completed_at | TIMESTAMP | Deployment completion time |

#### site_images
Images uploaded or generated for sites.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key, auto-increment |
| site_id | INTEGER | FK to sites |
| prompt | TEXT | AI prompt used to generate (if applicable) |
| s3_key | VARCHAR(500) | S3 object key |
| cloudfront_url | VARCHAR(500) | CDN URL for the image |
| created_at | TIMESTAMP | Upload timestamp |

#### Leads
Lead capture from customer website contact forms.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key, auto-increment |
| site_id | INTEGER | FK to sites |
| form_data | JSONB | Form submission data (name, email, message, etc.) |
| source | VARCHAR(100) | Section ID where form was submitted |
| ip_address | VARCHAR(45) | Visitor IP address |
| user_agent | TEXT | Browser user agent |
| referrer | TEXT | Referrer URL |
| status | ENUM | new, contacted, qualified, converted, archived |
| notes | TEXT | Internal notes |
| submitted_at | TIMESTAMP | Form submission time |
| created_at | TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | Last update time |

#### aws_account_provisions
AWS account provisioning tracking.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| user_id | INTEGER | FK to Users |
| aws_account_id | VARCHAR(12) | Customer AWS account ID |
| external_id | UUID | External ID for cross-account access |
| status | ENUM | Provisioning status |
| created_at | TIMESTAMP | Creation timestamp |

## Migrations

### Running Migrations

```bash
# Run all pending migrations
npx sequelize-cli db:migrate

# Rollback last migration
npx sequelize-cli db:migrate:undo

# Rollback all migrations
npx sequelize-cli db:migrate:undo:all
```

### Migration Files

Located in `backend/migrations/`:

| Migration | Description |
|-----------|-------------|
| 20251222115645-initial-schema.js | Initial user/conversation tables |
| 20260108120000-add-sites-tables.js | Sites, deployments, site_images |
| 20250112000001-add-aws-account-fields.js | AWS account provisioning |
| 20260112000001-add-leads-table.js | Lead capture table |

### Idempotency

All migrations are idempotent and follow the strategy in `MIGRATION_STRATEGY.md`:
- Check table existence before creating
- Wrap index creation in try-catch
- Check existence before dropping in rollback

## Connecting to the Database

### Using psql

```bash
# Load credentials from .env
source /home/ec2-user/lite-bedrockexpress/.env

# Connect
psql -h localhost -U $POSTGRES_USER -d devopser_lite
```

### Common Commands

```sql
-- List all tables
\dt

-- Describe a table
\d sites

-- Show indexes
\di

-- Check migration status
SELECT * FROM "SequelizeMeta";

-- Count records
SELECT
  'Users' as table_name, COUNT(*) FROM "Users"
UNION ALL
  SELECT 'sites', COUNT(*) FROM sites
UNION ALL
  SELECT 'Leads', COUNT(*) FROM "Leads";
```

## Backups

### Development Environment

Development database is local and ephemeral. For important data:

```bash
# Export database
pg_dump -h localhost -U $POSTGRES_USER devopser_lite > backup.sql

# Restore database
psql -h localhost -U $POSTGRES_USER devopser_lite < backup.sql
```

### Production Environment

Production uses AWS RDS PostgreSQL with:
- Automated daily backups (7 day retention)
- Point-in-time recovery
- Multi-AZ deployment for high availability

## Security Considerations

### Development
- Database runs locally, no external access
- Credentials stored in `.env` file (not committed to git)

### Production
- Credentials stored in AWS Secrets Manager
- SSL/TLS encryption in transit
- Encryption at rest using AWS KMS
- VPC security groups limit access
- IAM database authentication available

## Troubleshooting

### Connection Issues

```bash
# Check PostgreSQL is running
pg_isready -h localhost

# Check port
netstat -tlnp | grep 5432

# Verify credentials
psql -h localhost -U $POSTGRES_USER -d devopser_lite -c "SELECT 1"
```

### Migration Issues

```bash
# Check migration status
npx sequelize-cli db:migrate:status

# Force specific migration
npx sequelize-cli db:migrate --to 20260112000001-add-leads-table.js
```

### Performance

```sql
-- Check table sizes
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index usage
SELECT
  indexrelname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```
