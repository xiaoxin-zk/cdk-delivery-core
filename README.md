# CDK Delivery Core

CDK Delivery Core is a Next.js + Prisma + PostgreSQL web application for lawful CDK, license key, gift code, and redemption code distribution.

> Use this platform only for authorized and legal distribution scenarios. Do not use it for phishing, malware, piracy, illegal trading, or other abusive activity.

## Stack

- Next.js App Router + React + TypeScript
- Prisma ORM + PostgreSQL
- Redis-backed rate limiting with in-memory fallback
- JWT HttpOnly cookie authentication
- SMTP email and Cloudflare Turnstile configuration
- Docker Compose deployment

## Quick start with Docker Compose

1. Prepare environment variables:

```bash
cp .env.example .env
```

2. Edit `.env` before the first production start:

- Replace `POSTGRES_PASSWORD` with a strong random value and keep `DATABASE_URL` in sync.
- Replace `JWT_SECRET` and `APP_SECRET` with different random values of at least 32 characters.
- Replace `ADMIN_PASSWORD` with a strong password, or remove `ADMIN_EMAIL`/`ADMIN_PASSWORD` if you do not want automatic admin bootstrap.
- Set `APP_URL` to the public URL used by users and email links.

3. Start the full stack:

```bash
docker compose up -d --build
```

4. Open the app:

```text
http://localhost:3000
```

Inside Docker, database and Redis hosts must use Compose service names:

```env
DATABASE_URL=postgresql://cdk:<POSTGRES_PASSWORD>@postgres:5432/cdk_delivery_core?schema=public
REDIS_URL=redis://redis:6379
```

Do not use `localhost:5432` inside the app container; `localhost` would point to the app container itself.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `APP_PORT` | No | Host port mapped to container port 3000. Default: `3000`. |
| `APP_URL` | Yes | Public site URL used for email links and redirects. |
| `DATABASE_URL` | Yes | PostgreSQL connection string used by Prisma. |
| `REDIS_URL` | No | Redis connection string. If empty/unavailable, rate limiting falls back to memory. |
| `JWT_SECRET` | Yes | JWT signing secret. Use a random value with at least 32 characters. |
| `APP_SECRET` | Yes | Encryption secret for sensitive settings such as SMTP password and Turnstile secret. Do not rotate without planning because encrypted settings may become unreadable. |
| `ADMIN_EMAIL` | No | First admin email for bootstrap. |
| `ADMIN_PASSWORD` | No | First admin password. Required only when `ADMIN_EMAIL` is set. |
| `POSTGRES_DB` | Yes for Compose | PostgreSQL database name. |
| `POSTGRES_USER` | Yes for Compose | PostgreSQL username. |
| `POSTGRES_PASSWORD` | Yes for Compose | PostgreSQL password. Must be changed from the example value. |
| `SMTP_HOST` | No | SMTP server host. Can also be configured in the admin UI. |
| `SMTP_PORT` | No | SMTP server port. Default: `587`. |
| `SMTP_USERNAME` | No | SMTP username. |
| `SMTP_PASSWORD` | No | SMTP password. Stored encrypted when saved to system settings. |
| `SMTP_FROM_NAME` | No | Sender display name. |
| `SMTP_FROM_EMAIL` | No | Sender email address. |
| `SMTP_SECURE` | No | `true` for implicit TLS, otherwise `false`. |
| `TURNSTILE_SITE_KEY` | No | Cloudflare Turnstile site key. |
| `TURNSTILE_SECRET_KEY` | No | Cloudflare Turnstile secret key. Stored encrypted when saved to system settings. |

## Database migrations

Docker production startup runs:

```bash
npm run bootstrap:prod
```

That script performs:

1. required environment validation,
2. `prisma migrate deploy`,
3. system setting initialization,
4. optional admin account bootstrap.

It does **not** create demo users, demo projects, sample CDKs, test claims, or fake records.

Manual migration command for an already running deployment:

```bash
docker compose exec app npx prisma migrate deploy
```

Local development migration command:

```bash
npm run db:migrate
```

## Admin initialization

Set these variables before first startup:

```env
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=<strong password>
```

The production bootstrap will create the admin if it does not exist. If the user already exists, it only ensures the account is active, verified, and has the `ADMIN` role; it does not overwrite the existing password.

After the first login, rotate the password in the UI if needed. You may remove `ADMIN_PASSWORD` from `.env` after bootstrap to reduce secret exposure.

## Logs and health checks

View service status:

```bash
docker compose ps
```

Follow app logs:

```bash
docker compose logs -f app
```

Follow database logs:

```bash
docker compose logs -f postgres
```

Health endpoint:

```text
GET /api/health -> 200 {"status":"ok"}
```

Static favicon should be available at:

```text
GET /favicon.ico -> 200
```

## Backup and restore

Create a PostgreSQL backup:

```bash
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > backup.dump
```

Restore into an empty database:

```bash
docker compose exec -T postgres pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists < backup.dump
```

Notes:

- Stop the app or enable maintenance mode before restoring production data.
- Do not delete the `postgres_data` volume unless you intentionally want to remove all database data.
- Back up `.env` securely because `APP_SECRET` is required to decrypt sensitive settings saved in the database.

## Upgrade procedure

1. Back up PostgreSQL and `.env`.
2. Pull or copy the new application version.
3. Review `.env.example` for new variables and update `.env`.
4. Rebuild and start:

```bash
docker compose up -d --build
```

5. Watch logs until migrations and bootstrap complete:

```bash
docker compose logs -f app
```

Prisma migrations are applied by `npm run bootstrap:prod` during app startup.

## Common deployment troubleshooting

### `POSTGRES_PASSWORD is required`

Create `.env` from `.env.example` and set a strong `POSTGRES_PASSWORD`. Also update `DATABASE_URL` to use the same password.

### App container exits during bootstrap

Check logs:

```bash
docker compose logs app
```

Common causes are weak example secrets, missing `DATABASE_URL`, database not yet healthy, or an invalid migration.

### Database connection fails

In Docker Compose, use `postgres` as the host in `DATABASE_URL`, not `localhost`.

### Emails are not sent

Configure SMTP variables in `.env` or in `/admin/email`. Confirm host, port, username, password, from address, and `SMTP_SECURE` match your provider.

### Turnstile reports not configured

If Turnstile is enabled in settings, both site key and secret key must be configured. You can disable it temporarily in admin settings if needed.

### `/favicon.ico` returns 404

The repository includes `public/favicon.ico`. Rebuild the image and confirm the app is serving the latest container.

## Local development

```bash
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Useful checks:

```bash
npm run typecheck
npm run test
npm run build
```
