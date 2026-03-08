# Toggl-Facturoid Sync

## Overview
Automated invoicing service that pulls time tracking data from Toggl Track, stores it in PostgreSQL, and creates draft invoices in Fakturoid. Open source, self-hostable, and usable as a service. Goal: open Fakturoid on the 1st of the month, see a ready invoice, and just hit "Send".

## Goals
- Eliminate manual copying of hours from Toggl to Fakturoid
- Automate monthly invoice creation with correct hours and amounts per client/project
- Provide a secure, configurable system for managing API credentials and client mappings
- Be usable both as a self-hosted tool and as a service

## Target Audience
Freelancers and businesses who track time in Toggl and invoice via Fakturoid. Open source community.

## Tech Stack (Planned)
- Language: TypeScript
- Backend: NestJS + TypeORM
- Frontend: Vue.js (v2 — admin UI module)
- Database: PostgreSQL
- External APIs: Toggl Track Reports API v3, Fakturoid API v3
- Auth: OAuth 2.0 (Fakturoid), HTTP Basic Auth (Toggl)
- Security: AES-256-GCM encryption for credentials in DB

## Non-Goals
- Payment processing
- Full accounting features
- Toggl time entry editing/management
- Fakturoid account management beyond invoicing
