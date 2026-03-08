# Configuration Guide

Toggl-Fakturoid Sync is designed to store most configuration in the database, keeping environment variables to a minimum. Only the encryption key and database connection are configured via environment.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

### Required Variables

| Variable         | Description                                                  |
|------------------|--------------------------------------------------------------|
| `DATABASE_URL`   | PostgreSQL connection string (alternative to individual `DB_*` vars) |
| `ENCRYPTION_KEY` | 64-character hex string (32 bytes) for AES-256-GCM encryption |

### Optional Variables

| Variable      | Default                | Description                            |
|---------------|------------------------|----------------------------------------|
| `PORT`        | `3000`                 | HTTP server port                       |
| `DB_HOST`     | `localhost`            | Database host (if not using `DATABASE_URL`) |
| `DB_PORT`     | `5432`                 | Database port                          |
| `DB_NAME`     | `toggl_facturoid`      | Database name                          |
| `DB_USER`     | `postgres`             | Database user                          |
| `DB_PASSWORD` | --                     | Database password (required if not using `DATABASE_URL`) |

### Generating an Encryption Key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

This produces a 64-character hex string suitable for `ENCRYPTION_KEY`.

### Database Connection

You can configure the database connection in two ways:

**Option A -- Connection string:**

```env
DATABASE_URL=postgresql://user:password@localhost:5432/toggl_facturoid
```

**Option B -- Individual variables:**

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=toggl_facturoid
DB_USER=postgres
DB_PASSWORD=your_password
```

If `DATABASE_URL` is set, it takes precedence over individual variables.

---

## Service Configuration (Database)

All API credentials and service-specific settings are stored in the `service_config` database table. This design ensures credentials are encrypted at rest and never exposed via environment variables.

Use the [Service Config API](api.md#service-config-endpoints) to manage these entries.

### Required Configuration Entries

#### Toggl Track

| Service Name | Config Key     | Is Secret | Description                      |
|--------------|----------------|-----------|----------------------------------|
| `toggl`      | `api_token`    | `true`    | Toggl API token                  |
| `toggl`      | `workspace_id` | `false`   | Toggl workspace ID               |

**Where to find these values:**

- **API token:** Toggl Track > Profile Settings > API Token (at the bottom of the page)
- **Workspace ID:** Toggl Track > Settings > Workspace. The ID is in the URL: `https://track.toggl.com/{workspace_id}/settings`

**Example setup (curl):**

```bash
# Store Toggl API token (encrypted)
curl -X POST http://localhost:3000/api/invoicing/config \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $AUTH" \
  -d '{
    "serviceName": "toggl",
    "configKey": "api_token",
    "value": "your-toggl-api-token",
    "isSecret": true
  }'

# Store Toggl workspace ID (plain)
curl -X POST http://localhost:3000/api/invoicing/config \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $AUTH" \
  -d '{
    "serviceName": "toggl",
    "configKey": "workspace_id",
    "value": "1234567",
    "isSecret": false
  }'
```

#### Fakturoid

| Service Name | Config Key         | Is Secret | Description                                   |
|--------------|--------------------|-----------|-----------------------------------------------|
| `fakturoid`  | `client_id`        | `true`    | Fakturoid OAuth 2.0 Client ID                 |
| `fakturoid`  | `client_secret`    | `true`    | Fakturoid OAuth 2.0 Client Secret             |
| `fakturoid`  | `slug`             | `false`   | Fakturoid account slug                         |
| `fakturoid`  | `user_agent_email` | `false`   | Contact email (required by Fakturoid API)      |

**Where to find these values:**

- **Client ID / Client Secret:** Fakturoid > Settings > API > OAuth 2.0 applications. Create an app with `client_credentials` grant type.
- **Slug:** Your Fakturoid account slug from the URL: `https://app.fakturoid.cz/your-slug`
- **User-Agent email:** Your contact email. Fakturoid requires a User-Agent header with a valid email.

**Example setup (curl):**

```bash
# Store Fakturoid client_id (encrypted)
curl -X POST http://localhost:3000/api/invoicing/config \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $AUTH" \
  -d '{
    "serviceName": "fakturoid",
    "configKey": "client_id",
    "value": "your-fakturoid-client-id",
    "isSecret": true
  }'

# Store Fakturoid client_secret (encrypted)
curl -X POST http://localhost:3000/api/invoicing/config \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $AUTH" \
  -d '{
    "serviceName": "fakturoid",
    "configKey": "client_secret",
    "value": "your-fakturoid-client-secret",
    "isSecret": true
  }'

# Store Fakturoid slug (plain)
curl -X POST http://localhost:3000/api/invoicing/config \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $AUTH" \
  -d '{
    "serviceName": "fakturoid",
    "configKey": "slug",
    "value": "your-account-slug",
    "isSecret": false
  }'

# Store Fakturoid user_agent_email (plain)
curl -X POST http://localhost:3000/api/invoicing/config \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $AUTH" \
  -d '{
    "serviceName": "fakturoid",
    "configKey": "user_agent_email",
    "value": "you@example.com",
    "isSecret": false
  }'
```

---

## Client Mappings

Client mappings connect Toggl clients to Fakturoid subjects (contacts) and define the hourly rate for invoicing.

Use the [Client Mapping API](api.md#client-mapping-endpoints) or the helper endpoints below to look up IDs.

### Finding Toggl IDs

After configuring Toggl credentials:

```bash
# List Toggl clients
curl -H "Authorization: Basic $AUTH" http://localhost:3000/api/invoicing/toggl/clients

# List Toggl projects
curl -H "Authorization: Basic $AUTH" http://localhost:3000/api/invoicing/toggl/projects
```

### Finding Fakturoid Subject IDs

After configuring Fakturoid credentials:

```bash
# List Fakturoid subjects
curl -H "Authorization: Basic $AUTH" http://localhost:3000/api/invoicing/fakturoid/subjects
```

### Creating a Client Mapping

```bash
curl -X POST http://localhost:3000/api/invoicing/clients \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $AUTH" \
  -d '{
    "name": "Acme Corp",
    "togglClientId": 12345678,
    "togglWorkspaceId": 9876543,
    "fakturoidSubjectId": 456,
    "hourlyRate": 1500,
    "currency": "CZK"
  }'
```

---

## Scheduled Invoice Generation

The application includes a built-in cron job that automatically generates invoices:

- **Schedule:** 1st of every month at 08:00
- **Period:** Previous month (e.g., on March 1st it generates for February)
- **Retry:** On complete failure, retries once after 30 minutes

The cron job uses the same logic as the manual `POST /api/invoicing/generate` endpoint.

No additional configuration is needed -- the schedule is active as long as the application is running.

---

## Setup Checklist

1. Set `DATABASE_URL` and `ENCRYPTION_KEY` in `.env`
2. Start the application and run database migrations
3. Call `POST /api/auth/setup` to get your API secret
4. Configure Toggl credentials via `POST /api/invoicing/config`
5. Configure Fakturoid credentials via `POST /api/invoicing/config`
6. Look up Toggl client IDs and Fakturoid subject IDs using the proxy endpoints
7. Create client mappings via `POST /api/invoicing/clients`
8. Preview a month with `GET /api/invoicing/preview/:year/:month`
9. Generate invoices with `POST /api/invoicing/generate` or wait for the cron job
