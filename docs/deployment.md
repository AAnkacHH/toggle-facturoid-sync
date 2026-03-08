# Deployment Guide

## Prerequisites

- **Node.js** >= 18.x
- **pnpm** >= 8.x (or npm/yarn)
- **PostgreSQL** >= 14.x

---

## Quick Start (Local Development)

### 1. Clone and install

```bash
git clone https://github.com/your-username/toggl-facturoid-sync.git
cd toggl-facturoid-sync
pnpm install
```

### 2. Set up PostgreSQL

Create a database:

```bash
createdb toggl_facturoid
```

Or via psql:

```sql
CREATE DATABASE toggl_facturoid;
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/toggl_facturoid
ENCRYPTION_KEY=<generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
```

### 4. Run database migrations

Migrations run automatically on application startup (`migrationsRun: true` in the TypeORM config). Simply start the application and the database schema will be created.

To run migrations manually (without starting the app):

```bash
pnpm run migration:run
```

### 5. Start the application

```bash
# Development mode (with hot reload)
pnpm run start:dev

# Production mode
pnpm run build
pnpm run start:prod
```

### 6. Initial setup

Once the application is running, generate your API secret:

```bash
curl -X POST http://localhost:3000/api/auth/setup
```

Save the returned secret securely -- it will not be shown again.

Then follow the [Configuration Guide](configuration.md) to set up Toggl and Fakturoid credentials.

---

## Production Deployment

### Build

```bash
pnpm install --frozen-lockfile
pnpm run build
```

The compiled output is in the `dist/` directory.

### Run

```bash
node dist/main.js
```

Required environment variables:

```env
DATABASE_URL=postgresql://user:password@db-host:5432/toggl_facturoid
ENCRYPTION_KEY=your-64-char-hex-key
PORT=3000
```

### Health Check

```bash
curl http://localhost:3000/api/auth/status
# Returns: { "configured": true|false }
```

---

## Docker Deployment

### Dockerfile

Create a `Dockerfile` in the project root:

```dockerfile
FROM node:22-alpine AS builder

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

FROM node:22-alpine

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main.js"]
```

### Docker Compose

Create a `docker-compose.yml`:

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/toggl_facturoid
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      PORT: 3000
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: toggl_facturoid
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

### Running with Docker Compose

```bash
# Generate an encryption key
export ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Start services
docker compose up -d

# Check logs
docker compose logs -f app

# Run the initial setup
curl -X POST http://localhost:3000/api/auth/setup
```

---

## Database Migrations

TypeORM migrations are used to manage the database schema. Migrations run automatically on application startup.

### Generating a new migration

After modifying an entity, generate a migration:

```bash
pnpm run migration:generate src/migrations/MigrationName
```

### Running migrations manually

```bash
pnpm run migration:run
```

### Reverting the last migration

```bash
pnpm run migration:revert
```

---

## Environment Considerations

### Encryption Key Management

The `ENCRYPTION_KEY` is the most sensitive value in the system. Recommendations:

- Use a secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.) in production.
- Rotate the key only with a migration plan -- existing encrypted data will become unreadable with a new key.
- Never commit the key to version control.

### Database Backups

The `service_config` table contains encrypted credentials. Ensure database backups are:

- Encrypted at rest
- Stored securely with restricted access
- Tested regularly for restore capability

### Logging

The application uses NestJS's built-in Logger. In production:

- Sensitive data (API tokens, secrets) is never logged.
- Error messages from external API calls are logged for debugging.
- Invoice generation results are summarized in log output.

### Monitoring

Key metrics to monitor:

- Application uptime and health (`GET /api/auth/status`)
- Cron job execution on the 1st of each month
- Invoice generation results (check `invoice_log` for `error` status entries)
- External API availability (Toggl and Fakturoid)

---

## Troubleshooting

### "ENCRYPTION_KEY environment variable is required"

The application requires a valid 64-character hex string. Generate one:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### "Toggl credentials not found in service_config"

You need to configure Toggl credentials via the API. See the [Configuration Guide](configuration.md#toggl-track).

### "Fakturoid authentication failed"

Verify your Fakturoid OAuth credentials:

1. Check that `client_id` and `client_secret` are correctly stored.
2. Ensure the OAuth app in Fakturoid is configured with `client_credentials` grant type.
3. Verify the `user_agent_email` is set (Fakturoid requires a User-Agent header).

### Database connection errors

- Verify PostgreSQL is running and accessible.
- Check that `DATABASE_URL` (or `DB_*` variables) are correct.
- Ensure the database exists: `createdb toggl_facturoid`.
