# Agent 1: Database Entities, Encryption Service & Config Module

**Jira:** MP-37 (Database Schema) + MP-44 (Configuration, Error Handling & Logging)
**Wave:** 1 (no dependencies, runs first)

## <objective>

Set up TypeORM with PostgreSQL, create all 4 database entities (service_config, client_mapping, time_report, invoice_log), build the AES-256-GCM encryption service, create the InvoicingModule, install required dependencies, and generate the initial migration.

</objective>

## <context>

Read these files before starting:
- `AGENTS.md` — architecture rules (credentials in DB, never ENV, never logged)
- `.context/REQUIREMENTS.md` — schema details
- `.context/ROADMAP.md` — Phase 1 deliverables
- `src/app.module.ts` — current root module (you will modify this)
- `package.json` — current dependencies
- `tsconfig.json` — TypeScript config

**Critical architecture rule:** All API credentials are stored encrypted in the `service_config` table using AES-256-GCM. The only ENV variable is `ENCRYPTION_KEY`. Credentials must NEVER be logged or returned in plaintext via API.

</context>

## <tasks>

### Task 1: Install Dependencies & Configure TypeORM

**<files>**
- MODIFY: `package.json` (via pnpm add)
- CREATE: `src/config/database.config.ts`
- MODIFY: `src/app.module.ts`

**<action>**

1. Install production dependencies:
   ```bash
   pnpm add @nestjs/typeorm typeorm pg @nestjs/config @nestjs/schedule axios class-validator class-transformer
   ```

2. Create `src/config/database.config.ts`:
   - Export a `TypeOrmModuleAsyncOptions` factory that reads `DATABASE_URL` from env (or individual `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`)
   - Set `synchronize: false` (we use migrations, per architecture rules)
   - Set `entities: [__dirname + '/../**/*.entity{.ts,.js}']`
   - Set `migrations: [__dirname + '/../migrations/*{.ts,.js}']`
   - Set `migrationsRun: true` so migrations auto-run on startup

3. Update `src/app.module.ts`:
   - Import `ConfigModule.forRoot({ isGlobal: true })`
   - Import `TypeOrmModule.forRootAsync(databaseConfig)` using the config from step 2
   - Import `ScheduleModule.forRoot()`
   - Import `InvoicingModule` (created in Task 2)

**DO NOT:**
- Use `synchronize: true` — this project uses migrations only
- Put database credentials directly in the module — use ConfigService
- Remove the existing AppController or AppService

**<verify>**
```bash
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && npx tsc --noEmit 2>&1 | head -20
```

**<done>**
- TypeORM, pg, @nestjs/config, @nestjs/schedule, axios, class-validator, class-transformer are in package.json
- `database.config.ts` exists with async factory using ConfigService
- `app.module.ts` imports ConfigModule, TypeOrmModule, ScheduleModule, and InvoicingModule

---

### Task 2: Create All 4 TypeORM Entities + InvoicingModule

**<files>**
- CREATE: `src/invoicing/invoicing.module.ts`
- CREATE: `src/invoicing/entities/service-config.entity.ts`
- CREATE: `src/invoicing/entities/client-mapping.entity.ts`
- CREATE: `src/invoicing/entities/time-report.entity.ts`
- CREATE: `src/invoicing/entities/invoice-log.entity.ts`

**<action>**

1. Create `src/invoicing/entities/service-config.entity.ts`:
   - Table name: `service_config`
   - Columns:
     - `id`: UUID, PrimaryGeneratedColumn('uuid')
     - `serviceName`: varchar(100), NOT NULL — e.g. 'toggl', 'fakturoid'
     - `configKey`: varchar(100), NOT NULL — e.g. 'api_token', 'client_id'
     - `encryptedValue`: bytea (Buffer type), NULLABLE — for secrets
     - `plainValue`: varchar(500), NULLABLE — for non-secret config
     - `isSecret`: boolean, default false
     - `iv`: bytea (Buffer type), NULLABLE — AES-256-GCM initialization vector
     - `authTag`: bytea (Buffer type), NULLABLE — AES-256-GCM authentication tag
     - `createdAt`: CreateDateColumn
     - `updatedAt`: UpdateDateColumn
   - Add `@Unique(['serviceName', 'configKey'])` constraint

2. Create `src/invoicing/entities/client-mapping.entity.ts`:
   - Table name: `client_mapping`
   - Columns:
     - `id`: UUID, PrimaryGeneratedColumn('uuid')
     - `name`: varchar(255), NOT NULL — display name
     - `togglClientId`: bigint, UNIQUE, NOT NULL
     - `togglWorkspaceId`: bigint, NOT NULL
     - `fakturoidSubjectId`: bigint, NOT NULL
     - `hourlyRate`: decimal(10,2), NOT NULL
     - `currency`: varchar(3), NOT NULL, default 'CZK'
     - `isActive`: boolean, default true
     - `createdAt`: CreateDateColumn
     - `updatedAt`: UpdateDateColumn
   - Relations: OneToMany to TimeReport, OneToMany to InvoiceLog

3. Create `src/invoicing/entities/time-report.entity.ts`:
   - Table name: `time_report`
   - Columns:
     - `id`: UUID, PrimaryGeneratedColumn('uuid')
     - `clientMappingId`: UUID, NOT NULL (FK)
     - `periodYear`: smallint, NOT NULL
     - `periodMonth`: smallint, NOT NULL (1-12)
     - `togglProjectId`: bigint, NOT NULL
     - `projectName`: varchar(255), NOT NULL
     - `totalSeconds`: integer, NOT NULL
     - `totalHours`: decimal(8,2), NOT NULL
     - `amount`: decimal(12,2), NOT NULL
     - `fetchedAt`: timestamp, NOT NULL
     - `createdAt`: CreateDateColumn
     - `updatedAt`: UpdateDateColumn
   - Add `@Unique(['clientMappingId', 'periodYear', 'periodMonth', 'togglProjectId'])` constraint
   - Relations: ManyToOne to ClientMapping (with onDelete: 'CASCADE')

4. Create `src/invoicing/entities/invoice-log.entity.ts`:
   - Table name: `invoice_log`
   - Columns:
     - `id`: UUID, PrimaryGeneratedColumn('uuid')
     - `clientMappingId`: UUID, NOT NULL (FK)
     - `periodYear`: smallint, NOT NULL
     - `periodMonth`: smallint, NOT NULL (1-12)
     - `fakturoidInvoiceId`: bigint, NULLABLE
     - `fakturoidNumber`: varchar(50), NULLABLE
     - `totalHours`: decimal(8,2), NOT NULL
     - `totalAmount`: decimal(12,2), NOT NULL
     - `status`: enum('pending', 'created', 'sent', 'paid', 'error'), NOT NULL, default 'pending'
     - `errorMessage`: text, NULLABLE
     - `createdAt`: CreateDateColumn
     - `updatedAt`: UpdateDateColumn
   - Add `@Unique(['clientMappingId', 'periodYear', 'periodMonth'])` constraint — this enforces duplicate invoice protection
   - Relations: ManyToOne to ClientMapping (with onDelete: 'CASCADE')

5. Create `src/invoicing/invoicing.module.ts`:
   - Import `TypeOrmModule.forFeature([ServiceConfig, ClientMapping, TimeReport, InvoiceLog])`
   - Export the TypeOrmModule so other modules can use the repositories
   - Register EncryptionService (from Task 3) as a provider and export it
   - This module will be imported by AppModule

**TypeORM column type notes for PostgreSQL:**
- Use `{ type: 'bigint' }` for Toggl/Fakturoid IDs (they return large integers). The TypeScript type will be `string` because TypeORM returns bigint as string.
- Use `{ type: 'decimal', precision: X, scale: Y }` for money columns. TypeScript type will be `string`.
- Use `{ type: 'bytea' }` for encrypted data columns. TypeScript type will be `Buffer`.
- Use `{ type: 'smallint' }` for year/month.
- Use `{ type: 'enum', enum: InvoiceStatus }` for the status column. Define a separate `InvoiceStatus` enum.

**DO NOT:**
- Use `@nestjs/typeorm`'s `autoLoadEntities` — explicitly list entities
- Create any services other than EncryptionService in this module (Toggl/Fakturoid services will be created by other agents)
- Use JavaScript floats for any decimal columns

**<verify>**
```bash
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && npx tsc --noEmit 2>&1 | head -30
```

**<done>**
- All 4 entity files exist under `src/invoicing/entities/`
- Each entity has correct column types, constraints, and relations
- InvoicingModule created and registers all entities
- `InvoiceStatus` enum defined (can be in `invoice-log.entity.ts` or a separate file)
- TypeScript compiles without errors

---

### Task 3: Create Encryption Service + Unit Tests

**<files>**
- CREATE: `src/invoicing/services/encryption.service.ts`
- CREATE: `src/invoicing/services/encryption.service.spec.ts`

**<action>**

1. Create `src/invoicing/services/encryption.service.ts`:
   - Injectable NestJS service
   - Constructor injects `ConfigService` to read `ENCRYPTION_KEY` from env
   - On initialization, validate that `ENCRYPTION_KEY` exists and is exactly 64 hex characters (32 bytes)
   - Methods:
     - `encrypt(plaintext: string): { encryptedValue: Buffer; iv: Buffer; authTag: Buffer }` — uses Node.js `crypto.createCipheriv('aes-256-gcm', key, iv)` with a random 12-byte IV
     - `decrypt(encryptedValue: Buffer, iv: Buffer, authTag: Buffer): string` — uses `crypto.createDecipheriv` with the same algorithm
   - Both methods must handle errors gracefully (throw meaningful NestJS exceptions)
   - The key must be converted from hex string to Buffer: `Buffer.from(key, 'hex')`
   - NEVER log the encryption key or plaintext values

2. Create `src/invoicing/services/encryption.service.spec.ts`:
   - Test encrypt/decrypt round-trip with a known test key (64 hex chars)
   - Test that different plaintexts produce different ciphertexts
   - Test that encrypting the same plaintext twice produces different ciphertexts (due to random IV)
   - Test that decryption with wrong key fails
   - Test that missing ENCRYPTION_KEY throws an error
   - Mock ConfigService to provide the test key

3. Register `EncryptionService` as a provider in `invoicing.module.ts` and add it to exports.

**DO NOT:**
- Use any third-party encryption library — use Node.js built-in `crypto` module
- Log or expose the encryption key or decrypted values
- Use a fixed IV — always generate random IV per encryption

**<verify>**
```bash
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && npx jest --testPathPattern='encryption.service.spec' --no-cache 2>&1 | tail -20
```

**<done>**
- EncryptionService exists with encrypt/decrypt methods using AES-256-GCM
- All unit tests pass (minimum 5 test cases)
- Service is registered and exported from InvoicingModule
- TypeScript compiles without errors

</tasks>

## <verify>

Run these commands to verify all work is complete:

```bash
# 1. TypeScript compilation
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && npx tsc --noEmit

# 2. Unit tests
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && npx jest --no-cache 2>&1 | tail -20

# 3. Linting
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && pnpm run lint 2>&1 | tail -10

# 4. Verify all expected files exist
ls -la src/invoicing/entities/
ls -la src/invoicing/services/
ls -la src/config/
```

</verify>
