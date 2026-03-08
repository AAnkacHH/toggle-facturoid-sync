# Requirements

## v1 — Must Have (MVP)

### Data Sync
- [ ] Pull time entry summaries from Toggl for previous month (grouped by clients -> projects)
- [ ] Store time reports in PostgreSQL (hours per project, amounts)

### Invoice Creation
- [ ] Create draft invoices in Fakturoid per client (lines = projects with hours)
- [ ] Duplicate protection — no 2 invoices for the same client/month
- [ ] Save invoice log with fakturoid_id and status

### Configuration & Security
- [ ] service_config table: encrypted credentials (AES-256-GCM) + plain config values
- [ ] client_mapping table: Toggl client -> Fakturoid subject + hourly rate
- [ ] Only ENCRYPTION_KEY in ENV, everything else in DB
- [ ] Credentials never logged or returned in plaintext via API

### Scheduling
- [ ] Cron job: 1st of month at 8:00
- [ ] Manual trigger via REST API endpoint

### REST API
- [ ] CRUD for service_config (masked secrets in responses)
- [ ] CRUD for client_mapping
- [ ] Trigger sync endpoint
- [ ] View time reports and invoice logs

## v2 — Nice to Have
- [ ] Vue.js admin UI (report preview, client mapping config, service config form)
- [ ] Multi-tenant support (multiple users/accounts)
- [ ] Invoice status tracking from Fakturoid
- [ ] Notifications (email/Slack when invoices are created)
- [ ] Dry-run mode (preview what would be created without calling Fakturoid)

## Out of Scope
- Payment processing
- Full accounting / bookkeeping features
- Toggl time entry editing
- Fakturoid account management beyond invoice creation

## Open Questions
- Should the Vue.js frontend be a separate repo or monorepo?
- Multi-tenant auth strategy (if pursued in v2)?

## External API Reference

### Toggl Track API v3
- Base URL: `https://api.track.toggl.com/reports/api/v3`
- Auth: HTTP Basic Auth (API Token as username, "api_token" as password)
- Key endpoint: `POST /workspace/{id}/summary/time_entries`

### Fakturoid API v3
- Base URL: `https://app.fakturoid.cz/api/v3`
- Auth: OAuth 2.0 Client Credentials Flow
- Key endpoints: `POST /accounts/{slug}/invoices.json`, `GET /accounts/{slug}/subjects.json`
