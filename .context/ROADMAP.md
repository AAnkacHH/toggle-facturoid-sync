# Roadmap

## Phase 1 — Foundation
**Goal:** Project structure, database schema, and configuration management
**Deliverables:**
- NestJS project with TypeORM and PostgreSQL connection
- Database entities: service_config, client_mapping, time_report, invoice_log
- Encryption service (AES-256-GCM) for credentials
- CRUD API for service_config (with secret masking)
- CRUD API for client_mapping
- Environment config (ENCRYPTION_KEY only)

## Phase 2 — Core Sync Engine
**Goal:** Working Toggl -> Fakturoid pipeline
**Deliverables:**
- Toggl API client (fetch summary by clients/projects for a given month)
- Fakturoid API client (OAuth 2.0 auth, create draft invoices, fetch subjects)
- Sync service: orchestrates pull -> store -> create invoice flow
- Duplicate detection (prevent double invoicing per client/month)
- Invoice log persistence with fakturoid_id and status
- Manual trigger REST endpoint

## Phase 3 — Scheduling & Reliability
**Goal:** Automated monthly execution with error handling
**Deliverables:**
- Cron job (1st of month at 8:00)
- Error handling and retry logic for API calls
- Comprehensive logging
- API endpoints for viewing time reports and invoice logs

## Phase 4 — Frontend & Polish (v2)
**Goal:** Admin UI and quality-of-life features
**Deliverables:**
- Vue.js admin panel module
- Report preview before invoice creation
- Service config form (masked secrets)
- Client mapping UI
- Dry-run mode
