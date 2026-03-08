# API Reference

Toggl-Fakturoid Sync exposes a REST API on `http://localhost:3000` (configurable via `PORT` env var).

All request and response bodies use JSON (`Content-Type: application/json`).

---

## Authentication

The API uses **HTTP Basic Auth**. On first run, call the one-time setup endpoint to generate an API secret. After setup, every request (except the two public endpoints) must include an `Authorization` header.

**Header format:**

```
Authorization: Basic <base64(username:secret)>
```

The `username` can be any string (it is ignored); only the `secret` part is validated.

**Example (curl):**

```bash
# Encode credentials (username is arbitrary)
AUTH=$(echo -n "admin:YOUR_API_SECRET" | base64)

curl -H "Authorization: Basic $AUTH" http://localhost:3000/api/invoicing/clients
```

> **Note:** Before the initial setup is completed, all endpoints are accessible without authentication (setup mode).

---

## Auth Endpoints

### POST /api/auth/setup

**Public** -- no auth required.

One-time setup: generates a random API secret, stores its salted hash in the database, and returns the plaintext secret. This is the **only time** the secret is shown.

**Request:** No body required.

**Response (200):**

```json
{
  "secret": "a1b2c3d4e5f6...64_hex_chars",
  "message": "Save this secret -- it will not be shown again. Use it in Authorization: Basic base64(username:secret) header."
}
```

**Error (409 Conflict):** Setup has already been completed.

```json
{
  "statusCode": 409,
  "message": "API secret has already been configured. Setup can only be run once."
}
```

---

### GET /api/auth/status

**Public** -- no auth required.

Check whether the initial API setup has been completed.

**Response (200):**

```json
{
  "configured": true
}
```

---

## Service Config Endpoints

Manage API credentials and configuration values stored in the `service_config` table. Secret values are encrypted with AES-256-GCM and **never** returned in plaintext.

### POST /api/invoicing/config

Create a new configuration entry.

**Request body:**

| Field         | Type    | Required | Description                                       |
|---------------|---------|----------|---------------------------------------------------|
| `serviceName` | string  | Yes      | Service identifier (`toggl`, `fakturoid`, `system`) |
| `configKey`   | string  | Yes      | Configuration key name                             |
| `value`       | string  | Yes      | The value (encrypted if `isSecret` is true)        |
| `isSecret`    | boolean | Yes      | Whether to encrypt this value                      |

**Example request:**

```json
{
  "serviceName": "toggl",
  "configKey": "api_token",
  "value": "your-toggl-api-token",
  "isSecret": true
}
```

**Response (201):**

```json
{
  "id": "uuid-here",
  "serviceName": "toggl",
  "configKey": "api_token",
  "isSecret": true,
  "value": "******",
  "createdAt": "2026-01-15T10:00:00.000Z",
  "updatedAt": "2026-01-15T10:00:00.000Z"
}
```

---

### GET /api/invoicing/config

List all configuration entries. Secret values are masked as `"******"`.

**Response (200):**

```json
[
  {
    "id": "uuid-1",
    "serviceName": "toggl",
    "configKey": "api_token",
    "isSecret": true,
    "value": "******",
    "createdAt": "2026-01-15T10:00:00.000Z",
    "updatedAt": "2026-01-15T10:00:00.000Z"
  },
  {
    "id": "uuid-2",
    "serviceName": "toggl",
    "configKey": "workspace_id",
    "isSecret": false,
    "value": "1234567",
    "createdAt": "2026-01-15T10:00:00.000Z",
    "updatedAt": "2026-01-15T10:00:00.000Z"
  }
]
```

---

### GET /api/invoicing/config/service/:serviceName

List configuration entries filtered by service name.

**Path parameters:**

| Parameter     | Description                                        |
|---------------|----------------------------------------------------|
| `serviceName` | Service name to filter by (`toggl`, `fakturoid`)   |

**Response (200):** Same format as GET /api/invoicing/config.

---

### GET /api/invoicing/config/:id

Get a single configuration entry by ID.

**Response (200):** Single config object.

**Error (404):** Config not found.

---

### PATCH /api/invoicing/config/:id

Update an existing configuration entry. All fields are optional.

**Request body:**

| Field         | Type    | Required | Description                    |
|---------------|---------|----------|--------------------------------|
| `serviceName` | string  | No       | New service name               |
| `configKey`   | string  | No       | New config key                 |
| `value`       | string  | No       | New value                      |
| `isSecret`    | boolean | No       | Whether to encrypt this value  |

**Response (200):** Updated config object (secrets masked).

---

### DELETE /api/invoicing/config/:id

Delete a configuration entry.

**Response (204):** No content.

**Error (404):** Config not found.

---

## Client Mapping Endpoints

Manage mappings between Toggl clients and Fakturoid subjects, including hourly rates.

### POST /api/invoicing/clients

Create a new client mapping.

**Request body:**

| Field                | Type    | Required | Default | Description                        |
|----------------------|---------|----------|---------|------------------------------------|
| `name`               | string  | Yes      | --      | Display name for this mapping      |
| `togglClientId`      | number  | Yes      | --      | Toggl client ID                    |
| `togglWorkspaceId`   | number  | Yes      | --      | Toggl workspace ID                 |
| `fakturoidSubjectId` | number  | Yes      | --      | Fakturoid subject (contact) ID     |
| `hourlyRate`         | number  | Yes      | --      | Hourly rate for invoicing          |
| `currency`           | string  | No       | `CZK`   | ISO 4217 currency code (3 chars)   |
| `isActive`           | boolean | No       | `true`  | Whether this mapping is active     |

**Example request:**

```json
{
  "name": "Acme Corp",
  "togglClientId": 12345678,
  "togglWorkspaceId": 9876543,
  "fakturoidSubjectId": 456,
  "hourlyRate": 1500,
  "currency": "CZK"
}
```

**Response (201):**

```json
{
  "id": "uuid-here",
  "name": "Acme Corp",
  "togglClientId": "12345678",
  "togglWorkspaceId": "9876543",
  "fakturoidSubjectId": "456",
  "hourlyRate": "1500.00",
  "currency": "CZK",
  "isActive": true,
  "createdAt": "2026-01-15T10:00:00.000Z",
  "updatedAt": "2026-01-15T10:00:00.000Z"
}
```

---

### GET /api/invoicing/clients

List all client mappings.

**Query parameters:**

| Parameter | Type   | Description                                          |
|-----------|--------|------------------------------------------------------|
| `active`  | string | Filter by active status: `"true"` or `"false"`       |

**Response (200):** Array of client mapping objects.

---

### GET /api/invoicing/clients/:id

Get a single client mapping by ID.

**Response (200):** Client mapping object.

**Error (404):** Mapping not found.

---

### PATCH /api/invoicing/clients/:id

Update an existing client mapping. All fields are optional.

**Response (200):** Updated client mapping object.

---

### DELETE /api/invoicing/clients/:id

Delete a client mapping.

**Response (204):** No content.

**Error (404):** Mapping not found.

---

## Invoicing Endpoints

### POST /api/invoicing/generate

Trigger invoice generation for a specific month. This will:

1. Fetch time reports from Toggl for the given period
2. Save/upsert time reports in the database
3. Create draft invoices in Fakturoid for each active client mapping
4. Log results in the `invoice_log` table

Duplicate protection is built in: clients with an existing invoice (status: created/sent/paid) for the same period will be skipped.

**Request body:**

| Field   | Type   | Required | Description                   |
|---------|--------|----------|-------------------------------|
| `year`  | number | Yes      | Year (2020-2100)              |
| `month` | number | Yes      | Month (1-12)                  |

**Example request:**

```json
{
  "year": 2026,
  "month": 2
}
```

**Response (200):**

```json
[
  {
    "clientName": "Acme Corp",
    "clientMappingId": "uuid-1",
    "status": "created",
    "fakturoidInvoiceId": 12345,
    "fakturoidNumber": "2026-0003",
    "totalHours": 120.5,
    "totalAmount": 180750
  },
  {
    "clientName": "Beta Inc",
    "clientMappingId": "uuid-2",
    "status": "skipped_duplicate"
  },
  {
    "clientName": "Gamma Ltd",
    "clientMappingId": "uuid-3",
    "status": "skipped_zero_hours",
    "totalHours": 0
  }
]
```

**Possible statuses:** `created`, `skipped_duplicate`, `skipped_zero_hours`, `error`

---

### GET /api/invoicing/preview/:year/:month

Preview what invoices would be generated for a given month, without creating anything. Useful for reviewing data before triggering generation.

**Path parameters:**

| Parameter | Type   | Description |
|-----------|--------|-------------|
| `year`    | number | Year        |
| `month`   | number | Month       |

**Response (200):**

```json
{
  "year": 2026,
  "month": 2,
  "clients": [
    {
      "clientName": "Acme Corp",
      "togglClientId": 12345678,
      "projects": [
        { "projectName": "Website Redesign", "hours": 80.5, "amount": 120750 },
        { "projectName": "API Integration", "hours": 40.0, "amount": 60000 }
      ],
      "totalHours": 120.5,
      "totalAmount": 180750,
      "hasExistingInvoice": false
    }
  ],
  "grandTotal": {
    "hours": 120.5,
    "amount": 180750
  }
}
```

---

### POST /api/invoicing/reports/fetch

Fetch time reports from Toggl and save them to the database without creating invoices.

**Request body:** Same as POST /api/invoicing/generate.

**Response (200):** Array of saved `TimeReport` objects.

---

## Toggl Proxy Endpoints

Convenience endpoints for fetching data from Toggl (useful for setting up client mappings).

### GET /api/invoicing/toggl/clients

Fetch all clients from the configured Toggl workspace.

**Response (200):**

```json
[
  { "id": 12345678, "name": "Acme Corp", "wid": 9876543, "archived": false },
  { "id": 12345679, "name": "Beta Inc", "wid": 9876543, "archived": false }
]
```

---

### GET /api/invoicing/toggl/projects

Fetch all projects from the configured Toggl workspace.

**Response (200):**

```json
[
  {
    "id": 111,
    "name": "Website Redesign",
    "wid": 9876543,
    "cid": 12345678,
    "client_id": 12345678,
    "active": true,
    "color": "#06aaf5"
  }
]
```

---

## Fakturoid Proxy Endpoints

### GET /api/invoicing/fakturoid/subjects

Fetch all subjects (contacts) from the configured Fakturoid account.

**Response (200):**

```json
[
  {
    "id": 456,
    "name": "Acme Corp s.r.o.",
    "email": "billing@acme.cz",
    "street": "Vodickova 123",
    "city": "Praha",
    "country": "CZ",
    "registration_no": "12345678"
  }
]
```

---

## Time Reports & Invoice Logs

### GET /api/invoicing/time-reports

List time reports stored in the database.

**Query parameters:**

| Parameter         | Type   | Description                       |
|-------------------|--------|-----------------------------------|
| `year`            | string | Filter by period year             |
| `month`           | string | Filter by period month            |
| `clientMappingId` | string | Filter by client mapping UUID     |

**Response (200):** Array of `TimeReport` objects.

---

### GET /api/invoicing/invoice-logs

List invoice log entries.

**Query parameters:**

| Parameter         | Type   | Description                                                    |
|-------------------|--------|----------------------------------------------------------------|
| `year`            | string | Filter by period year                                          |
| `month`           | string | Filter by period month                                         |
| `status`          | string | Filter by status: `pending`, `created`, `sent`, `paid`, `error`|
| `clientMappingId` | string | Filter by client mapping UUID                                  |

**Response (200):** Array of `InvoiceLog` objects.

---

### GET /api/invoicing/invoice-logs/:id

Get a single invoice log entry by ID.

**Response (200):** Single `InvoiceLog` object.

**Error (404):** Invoice log not found.

---

## Error Responses

All error responses follow the NestJS standard format:

```json
{
  "statusCode": 400,
  "message": "Description of the error",
  "error": "Bad Request"
}
```

**Common HTTP status codes:**

| Code | Meaning                                                |
|------|--------------------------------------------------------|
| 400  | Bad request / validation error                         |
| 401  | Missing or invalid authentication                      |
| 404  | Resource not found                                     |
| 409  | Conflict (duplicate resource)                          |
| 429  | Rate limit exceeded (Toggl or Fakturoid API)           |
| 500  | Internal server error                                  |
| 502  | Bad gateway (external API communication failure)       |
