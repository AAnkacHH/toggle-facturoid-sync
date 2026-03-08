# AGENTS.md — Toggl-Facturoid Sync

## Project Overview
Automated invoicing service: pulls time tracking data from Toggl Track, stores in PostgreSQL, creates draft invoices in Fakturoid. Open source, self-hostable. Jira epic: MP-36.

## Tech Stack
- TypeScript, NestJS, TypeORM, PostgreSQL
- External APIs: Toggl Track Reports API v3, Fakturoid API v3
- Security: AES-256-GCM encryption for credentials in DB
- Package manager: pnpm

## Current Phase
Phase 1 — Foundation (see `.context/STATE.md` for progress)

## Architecture Rules
- All API credentials stored encrypted in DB (service_config table), never in ENV (except ENCRYPTION_KEY)
- Credentials must never be logged or returned in plaintext via API
- Each external API has its own client service (TogglClient, FakturoidClient)
- Duplicate invoice protection: one invoice per client per month
- TypeORM entities with migrations, not synchronize

## Database Schema
- `service_config` — encrypted API credentials + plain config values
- `client_mapping` — Toggl client -> Fakturoid subject + hourly rate
- `time_report` — pulled Toggl data (hours per project/month)
- `invoice_log` — created invoice records with fakturoid_id

## Development Commands
```bash
pnpm install          # install dependencies
pnpm run start:dev    # dev server with watch
pnpm run build        # production build
pnpm run test         # unit tests
pnpm run test:e2e     # e2e tests
pnpm run lint         # eslint
pnpm run format       # prettier
```

## Detailed Context
- `.context/PROJECT.md` — project overview & goals
- `.context/REQUIREMENTS.md` — v1/v2/out-of-scope + external API reference
- `.context/ROADMAP.md` — phases & deliverables
- `.context/STATE.md` — current progress
