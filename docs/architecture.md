# Architecture Overview

## System Overview

Toggl-Fakturoid Sync is a NestJS backend application that bridges two external services:

- **Toggl Track** -- time tracking platform (source of hours data)
- **Fakturoid** -- Czech invoicing platform (destination for draft invoices)

The application fetches time entry summaries from Toggl, calculates amounts based on configured hourly rates, and creates draft invoices in Fakturoid.

---

## Data Flow

```
                    +-------------------+
                    |   Toggl Track     |
                    |   Reports API v3  |
                    +--------+----------+
                             |
                    (1) Fetch monthly summary
                    (HTTP Basic Auth)
                             |
                             v
+----------+       +-------------------+       +-------------------+
|          |       |                   |       |                   |
| REST API +------>+  Invoicing        +------>+   Fakturoid       |
| Clients  |       |  Service          |       |   API v3          |
|          |       |  (Orchestrator)   |       |   (OAuth 2.0)     |
+----------+       +--------+----------+       +-------------------+
                             |
                    (2) Store & calculate
                             |
                             v
                    +-------------------+
                    |   PostgreSQL      |
                    |                   |
                    |  - service_config |
                    |  - client_mapping |
                    |  - time_report    |
                    |  - invoice_log    |
                    +-------------------+
```

### Invoice Generation Flow

1. **Fetch** -- TogglClientService pulls time entry summaries for the target month, grouped by client and project.
2. **Store** -- Time reports are upserted into the `time_report` table with calculated hours and amounts.
3. **Check** -- For each active client mapping, the system checks for existing invoices (duplicate protection).
4. **Create** -- FakturoidClientService creates a draft invoice in Fakturoid via OAuth 2.0 authenticated API calls.
5. **Log** -- Results are recorded in the `invoice_log` table with Fakturoid invoice ID and status.

### Trigger Methods

- **Automatic:** Cron job runs at 08:00 on the 1st of every month (processes previous month).
- **Manual:** `POST /api/invoicing/generate` with `{ year, month }` body.

---

## Module Structure

```
AppModule
  |
  +-- ConfigModule (global)        -- Environment variables
  +-- TypeOrmModule (global)       -- PostgreSQL connection
  +-- ScheduleModule (global)      -- Cron job scheduling
  |
  +-- AuthModule
  |     +-- AuthController         -- POST /api/auth/setup, GET /api/auth/status
  |     +-- AuthService            -- Secret generation, validation
  |     +-- AuthGuard (global)     -- HTTP Basic Auth guard
  |
  +-- InvoicingModule
        +-- Controllers
        |     +-- ServiceConfigController   -- CRUD for service_config
        |     +-- ClientMappingController   -- CRUD for client_mapping
        |     +-- InvoicingController       -- Generation, preview, reports, proxy endpoints
        |
        +-- Services
        |     +-- EncryptionService         -- AES-256-GCM encrypt/decrypt
        |     +-- ServiceConfigService      -- Config CRUD with secret masking
        |     +-- ClientMappingService      -- Client mapping CRUD
        |     +-- TogglClientService        -- Toggl API client with retry
        |     +-- FakturoidClientService    -- Fakturoid API client with OAuth
        |     +-- InvoicingService          -- Orchestration logic
        |     +-- InvoiceCronService        -- Scheduled monthly execution
        |
        +-- Entities
        |     +-- ServiceConfig             -- Encrypted credentials storage
        |     +-- ClientMapping             -- Toggl <-> Fakturoid mapping
        |     +-- TimeReport                -- Stored time data from Toggl
        |     +-- InvoiceLog                -- Invoice creation records
        |
        +-- DTOs
              +-- Create/Update DTOs        -- Validation with class-validator
              +-- Toggl/Fakturoid DTOs      -- API response type definitions
              +-- Invoice result DTOs       -- Generation result types
```

---

## Database Schema

### service_config

Stores all API credentials and configuration values. Secret values are encrypted with AES-256-GCM.

| Column           | Type         | Description                              |
|------------------|--------------|------------------------------------------|
| `id`             | UUID (PK)    | Auto-generated                           |
| `service_name`   | varchar(100) | Service identifier                       |
| `config_key`     | varchar(100) | Configuration key                        |
| `encrypted_value`| bytea        | AES-256-GCM encrypted value (secrets)    |
| `plain_value`    | varchar(500) | Plaintext value (non-secrets)            |
| `is_secret`      | boolean      | Whether value is encrypted               |
| `iv`             | bytea        | Initialization vector for decryption     |
| `auth_tag`       | bytea        | Authentication tag for decryption        |
| `created_at`     | timestamp    | Creation timestamp                       |
| `updated_at`     | timestamp    | Last update timestamp                    |

**Unique constraint:** `(service_name, config_key)`

### client_mapping

Maps Toggl clients to Fakturoid subjects with billing configuration.

| Column                | Type           | Description                          |
|-----------------------|----------------|--------------------------------------|
| `id`                  | UUID (PK)      | Auto-generated                       |
| `name`                | varchar(255)   | Display name                         |
| `toggl_client_id`     | bigint (unique)| Toggl client ID                      |
| `toggl_workspace_id`  | bigint         | Toggl workspace ID                   |
| `fakturoid_subject_id`| bigint         | Fakturoid subject (contact) ID       |
| `hourly_rate`         | decimal(10,2)  | Hourly billing rate                  |
| `currency`            | varchar(3)     | ISO 4217 currency code (default: CZK)|
| `is_active`           | boolean        | Whether this mapping is active       |
| `created_at`          | timestamp      | Creation timestamp                   |
| `updated_at`          | timestamp      | Last update timestamp                |

### time_report

Stores pulled time data from Toggl, broken down by project and period.

| Column              | Type          | Description                           |
|---------------------|---------------|---------------------------------------|
| `id`                | UUID (PK)     | Auto-generated                        |
| `client_mapping_id` | UUID (FK)     | Reference to client_mapping           |
| `period_year`       | smallint      | Year of the billing period            |
| `period_month`      | smallint      | Month of the billing period           |
| `toggl_project_id`  | bigint        | Toggl project ID                      |
| `project_name`      | varchar(255)  | Project name from Toggl               |
| `total_seconds`     | integer       | Total tracked time in seconds         |
| `total_hours`       | decimal(8,2)  | Total tracked time in hours           |
| `amount`            | decimal(12,2) | Calculated amount (hours * rate)      |
| `fetched_at`        | timestamp     | When data was fetched from Toggl      |
| `created_at`        | timestamp     | Creation timestamp                    |
| `updated_at`        | timestamp     | Last update timestamp                 |

**Unique constraint:** `(client_mapping_id, period_year, period_month, toggl_project_id)`

### invoice_log

Records of created invoices with Fakturoid references and status tracking.

| Column                 | Type          | Description                          |
|------------------------|---------------|--------------------------------------|
| `id`                   | UUID (PK)     | Auto-generated                       |
| `client_mapping_id`    | UUID (FK)     | Reference to client_mapping          |
| `period_year`          | smallint      | Year of the billing period           |
| `period_month`         | smallint      | Month of the billing period          |
| `fakturoid_invoice_id` | bigint        | Invoice ID in Fakturoid              |
| `fakturoid_number`     | varchar(50)   | Invoice number from Fakturoid        |
| `total_hours`          | decimal(8,2)  | Total invoiced hours                 |
| `total_amount`         | decimal(12,2) | Total invoiced amount                |
| `status`               | enum          | `pending`, `created`, `sent`, `paid`, `error` |
| `error_message`        | text          | Error details (if status is error)   |
| `created_at`           | timestamp     | Creation timestamp                   |
| `updated_at`           | timestamp     | Last update timestamp                |

**Unique constraint:** `(client_mapping_id, period_year, period_month)` -- ensures one invoice per client per month (duplicate protection).

---

## Security Model

### Credential Storage

- All API credentials (Toggl API token, Fakturoid client ID/secret) are encrypted with **AES-256-GCM** before being stored in the database.
- Only the `ENCRYPTION_KEY` environment variable is required -- all other secrets live in the encrypted `service_config` table.
- The encryption service uses a 12-byte random IV per encryption operation and stores the authentication tag alongside the ciphertext.

### API Authentication

- The application uses **HTTP Basic Auth** with a one-time generated API secret.
- The secret is stored as a salted HMAC-SHA256 hash (never in plaintext).
- Timing-safe comparison is used to prevent timing attacks.
- Before setup is completed, all endpoints are accessible (setup mode).
- Two endpoints are always public: `POST /api/auth/setup` and `GET /api/auth/status`.

### Secret Masking

- The `ServiceConfigService` never returns raw encrypted data or plaintext secrets via the API.
- Secret values are always replaced with `"******"` in API responses.
- Encryption fields (`encryptedValue`, `iv`, `authTag`) are stripped from all responses.

### External API Authentication

- **Toggl Track:** HTTP Basic Auth using the API token as username and literal `"api_token"` as password.
- **Fakturoid:** OAuth 2.0 Client Credentials flow. Tokens are cached in memory and refreshed 5 minutes before expiry.

---

## Error Handling & Retry Logic

### Toggl API

- Rate limiting (HTTP 429) is handled with exponential backoff: 1s, 2s, 4s delays.
- Maximum 3 retries per request.
- Respects `Retry-After` header when present.

### Fakturoid API

- Rate limiting (HTTP 429) retries up to 3 times with configurable delay.
- Authentication failures (HTTP 401) trigger a single token refresh and retry.
- Maximum 3 retries per request.

### Invoice Generation

- Each client is processed independently -- one client's failure does not block others.
- Failed invoice attempts are recorded in `invoice_log` with `error` status and the error message.
- The cron job includes a one-time retry after 30 minutes on complete failure.

---

## Technology Choices

| Component        | Technology            | Rationale                                        |
|------------------|-----------------------|--------------------------------------------------|
| Runtime          | Node.js + TypeScript  | Type safety, modern async patterns               |
| Framework        | NestJS                | Modular architecture, DI, decorators, scheduling |
| ORM              | TypeORM               | PostgreSQL support, migrations, decorators       |
| Database         | PostgreSQL            | Reliable, supports bytea for encrypted data      |
| HTTP Client      | Axios                 | Promise-based, interceptors, well-maintained     |
| Scheduling       | @nestjs/schedule      | Cron expressions, integrated with NestJS DI      |
| Validation       | class-validator       | Decorator-based DTO validation                   |
| Naming Strategy  | typeorm-naming-strategies | Automatic snake_case column names             |
