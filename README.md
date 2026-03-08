# Toggl-Fakturoid Sync

Automated invoicing service that pulls time tracking data from Toggl Track and creates draft invoices in Fakturoid.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-11-red?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-blue?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## Features

- **Automated invoicing** -- fetches hours from Toggl, creates draft invoices in Fakturoid
- **Scheduled execution** -- cron job runs on the 1st of every month at 08:00
- **Manual trigger** -- generate invoices for any month via REST API
- **Preview mode** -- review what invoices would be created before generating
- **Duplicate protection** -- prevents double invoicing per client per month
- **Encrypted credentials** -- API keys stored with AES-256-GCM encryption in the database
- **Multi-client support** -- configure multiple Toggl clients with individual hourly rates
- **Error isolation** -- one client's failure does not block others
- **Retry logic** -- exponential backoff for Toggl/Fakturoid API rate limits

## Quick Start

### Prerequisites

- Node.js >= 18
- pnpm >= 8
- PostgreSQL >= 14

### Setup

```bash
# Clone the repository
git clone https://github.com/your-username/toggl-facturoid-sync.git
cd toggl-facturoid-sync

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL and ENCRYPTION_KEY

# Start in development mode
pnpm run start:dev
```

### Initial Configuration

```bash
# 1. Generate API secret (one-time setup)
curl -X POST http://localhost:3000/api/auth/setup
# Save the returned secret!

# 2. Configure Toggl and Fakturoid credentials via the API
# See docs/configuration.md for detailed steps

# 3. Create client mappings
# 4. Generate invoices
curl -X POST http://localhost:3000/api/invoicing/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $(echo -n 'admin:YOUR_SECRET' | base64)" \
  -d '{"year": 2026, "month": 2}'
```

## Tech Stack

| Component     | Technology                        |
|---------------|-----------------------------------|
| Language      | TypeScript (strict mode)          |
| Framework     | NestJS 11                         |
| ORM           | TypeORM                           |
| Database      | PostgreSQL                        |
| Scheduling    | @nestjs/schedule (cron)           |
| HTTP Client   | Axios                             |
| Encryption    | AES-256-GCM (Node.js crypto)     |
| Validation    | class-validator + class-transformer |
| Package Mgr   | pnpm                              |

## API Overview

| Method | Endpoint                             | Description                        |
|--------|--------------------------------------|------------------------------------|
| POST   | `/api/auth/setup`                    | One-time API secret generation     |
| GET    | `/api/auth/status`                   | Check if setup is complete         |
| POST   | `/api/invoicing/config`              | Create service config entry        |
| GET    | `/api/invoicing/config`              | List all config entries            |
| POST   | `/api/invoicing/clients`             | Create client mapping              |
| GET    | `/api/invoicing/clients`             | List client mappings               |
| POST   | `/api/invoicing/generate`            | Generate invoices for a month      |
| GET    | `/api/invoicing/preview/:year/:month`| Preview invoices before generation |
| POST   | `/api/invoicing/reports/fetch`       | Fetch time reports from Toggl      |
| GET    | `/api/invoicing/time-reports`        | List stored time reports           |
| GET    | `/api/invoicing/invoice-logs`        | List invoice generation logs       |
| GET    | `/api/invoicing/toggl/clients`       | Proxy: list Toggl clients          |
| GET    | `/api/invoicing/toggl/projects`      | Proxy: list Toggl projects         |
| GET    | `/api/invoicing/fakturoid/subjects`  | Proxy: list Fakturoid subjects     |

See [docs/api.md](docs/api.md) for the full API reference with request/response examples.

## Project Structure

```
src/
  app.module.ts                     # Root module
  main.ts                           # Application entry point
  auth/
    auth.controller.ts              # Auth endpoints (setup, status)
    auth.service.ts                 # Secret generation and validation
    auth.guard.ts                   # Global HTTP Basic Auth guard
    auth.module.ts
  config/
    database.config.ts              # TypeORM connection config
    datasource.ts                   # CLI migration datasource
  invoicing/
    invoicing.module.ts             # Invoicing feature module
    constants.ts                    # Service names, config keys, defaults
    controllers/
      service-config.controller.ts  # CRUD for service_config
      client-mapping.controller.ts  # CRUD for client_mapping
      invoicing.controller.ts       # Generation, preview, reports, proxy
    services/
      encryption.service.ts         # AES-256-GCM encrypt/decrypt
      service-config.service.ts     # Config CRUD with secret masking
      client-mapping.service.ts     # Client mapping CRUD
      toggl-client.service.ts       # Toggl API client with retry
      fakturoid-client.service.ts   # Fakturoid API client with OAuth
      invoicing.service.ts          # Invoice generation orchestrator
      invoice-cron.service.ts       # Monthly cron job with retry
    entities/
      service-config.entity.ts      # Encrypted credentials storage
      client-mapping.entity.ts      # Toggl <-> Fakturoid mapping
      time-report.entity.ts         # Stored time data
      invoice-log.entity.ts         # Invoice creation records
    dto/                            # Request/response type definitions
```

## Development

```bash
pnpm run start:dev    # Start dev server with hot reload
pnpm run build        # Compile TypeScript to dist/
pnpm run test         # Run unit tests
pnpm run test:e2e     # Run end-to-end tests
pnpm run test:cov     # Run tests with coverage report
pnpm run lint         # Run ESLint with auto-fix
pnpm run format       # Format code with Prettier
```

### Database migrations

```bash
pnpm run migration:generate src/migrations/MigrationName  # Generate from entity changes
pnpm run migration:run                                     # Apply pending migrations
pnpm run migration:revert                                  # Revert last migration
```

## Documentation

| Document                                   | Description                              |
|--------------------------------------------|------------------------------------------|
| [API Reference](docs/api.md)              | Full REST API with examples              |
| [Configuration](docs/configuration.md)    | Environment, credentials, client mappings|
| [Architecture](docs/architecture.md)      | System design, data flow, security model |
| [Deployment](docs/deployment.md)          | Docker, manual setup, migrations         |
| [Contributing](CONTRIBUTING.md)           | Development setup and guidelines         |

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a pull request.

## License

This project is licensed under the [MIT License](LICENSE).
