# Agent 1: Database Config, Naming Strategy, Migration & Project Config

## <objective>
Configure SnakeNamingStrategy for TypeORM, remove insecure DB defaults, create a standalone datasource for CLI usage, generate the initial migration, tighten tsconfig/eslint, fix jest/ts-jest version mismatch, and create `.env.example`. This agent handles FIX 2, FIX 3, FIX 9, and the DB-default-password part of FIX 7.
</objective>

## <context>
Read these files before starting:
- `AGENTS.md` — project rules, tech stack, architecture
- `src/config/database.config.ts` — current database config (needs SnakeNamingStrategy + remove default password)
- `tsconfig.json` — needs strict mode tightening
- `tsconfig.build.json` — build config (reference only)
- `eslint.config.mjs` — needs `no-explicit-any` set to `warn`
- `package.json` — needs `typeorm-naming-strategies` dependency + jest/ts-jest fix + typeorm CLI scripts
- `src/invoicing/entities/service-config.entity.ts` — entity definitions (reference)
- `src/invoicing/entities/client-mapping.entity.ts` — entity definitions (reference)
- `src/invoicing/entities/time-report.entity.ts` — entity definitions (reference)
- `src/invoicing/entities/invoice-log.entity.ts` — entity definitions (reference)

IMPORTANT: Do NOT modify any files outside the scope listed below. Other agents are working in parallel on other source files.
</context>

## <tasks>

### Task 1: Install dependencies and fix version mismatches

<files>
- `package.json` (modify — add dependency, fix versions, add scripts)
</files>

<action>
1. Run `pnpm add typeorm-naming-strategies`
2. Fix the jest/ts-jest mismatch. Check if `ts-jest@next` or `ts-jest@30` exists. If ts-jest v30 is not available, downgrade jest to v29 (`pnpm add -D jest@^29 @types/jest@^29`). Verify compatibility before committing to a direction.
3. Add TypeORM CLI scripts to `package.json` scripts section:
   ```json
   "typeorm": "ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js",
   "migration:generate": "pnpm typeorm migration:generate -d src/config/datasource.ts",
   "migration:run": "pnpm typeorm migration:run -d src/config/datasource.ts",
   "migration:revert": "pnpm typeorm migration:revert -d src/config/datasource.ts"
   ```
</action>

<verify>
```bash
pnpm list typeorm-naming-strategies && pnpm list jest ts-jest
```
Verify `typeorm-naming-strategies` is installed and jest/ts-jest major versions are compatible.
</verify>

<done>
- `typeorm-naming-strategies` is in `dependencies`
- jest and ts-jest have compatible major versions
- TypeORM CLI scripts are in package.json
</done>

### Task 2: Configure SnakeNamingStrategy, remove DB default password, create datasource file

<files>
- `src/config/database.config.ts` (modify)
- `src/config/datasource.ts` (create — standalone DataSource for TypeORM CLI)
</files>

<action>
1. In `src/config/database.config.ts`:
   - Add `import { SnakeNamingStrategy } from 'typeorm-naming-strategies';`
   - Add `namingStrategy: new SnakeNamingStrategy()` to BOTH return branches (the `databaseUrl` branch and the individual-params branch)
   - Remove the default value `'postgres'` from `DB_PASSWORD`. Instead, if `DATABASE_URL` is not set, require `DB_PASSWORD` to be present. Throw a clear error if it's missing:
     ```typescript
     const password = configService.get<string>('DB_PASSWORD');
     if (!password) {
       throw new Error('DB_PASSWORD environment variable is required when DATABASE_URL is not set');
     }
     ```
   - Also remove default for `DB_USER` (require it or keep default `'postgres'` since that's a common convention for dev — use your judgment, but at minimum remove the password default)

2. Create `src/config/datasource.ts` — a standalone TypeORM DataSource for CLI migration commands:
   ```typescript
   import { DataSource } from 'typeorm';
   import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
   import * as dotenv from 'dotenv';

   dotenv.config();

   const databaseUrl = process.env.DATABASE_URL;

   export default new DataSource({
     type: 'postgres',
     ...(databaseUrl
       ? { url: databaseUrl }
       : {
           host: process.env.DB_HOST ?? 'localhost',
           port: parseInt(process.env.DB_PORT ?? '5432', 10),
           database: process.env.DB_NAME ?? 'toggl_facturoid',
           username: process.env.DB_USER ?? 'postgres',
           password: process.env.DB_PASSWORD,
         }),
     entities: [__dirname + '/../**/*.entity{.ts,.js}'],
     migrations: [__dirname + '/../migrations/*{.ts,.js}'],
     namingStrategy: new SnakeNamingStrategy(),
     synchronize: false,
   });
   ```
   Note: The datasource file needs `dotenv` — run `pnpm add dotenv` if not already present.
</action>

<verify>
```bash
npx tsc --noEmit --project tsconfig.json 2>&1 | head -20
```
TypeScript compilation should pass without errors in the modified files.
</verify>

<done>
- `database.config.ts` includes `SnakeNamingStrategy` in both branches
- Default password removed from `database.config.ts`
- `src/config/datasource.ts` exists and exports a `DataSource` with `SnakeNamingStrategy`
</done>

### Task 3: Tighten tsconfig, eslint, and create .env.example

<files>
- `tsconfig.json` (modify)
- `eslint.config.mjs` (modify)
- `.env.example` (create)
</files>

<action>
1. In `tsconfig.json`, change the compiler options to enable strict mode:
   ```json
   "strict": true,
   "noImplicitAny": true,
   "strictBindCallApply": true,
   "noFallthroughCasesInSwitch": true
   ```
   Remove the existing `"strictNullChecks": true` line since `"strict": true` implies it.
   NOTE: Enabling `strict: true` may cause new TypeScript errors across the codebase. This is intentional — the other agents working in parallel should also be aware. If the build breaks due to strict mode on files OTHER agents own, do NOT fix those files. Only fix errors in files YOU own (database.config.ts, datasource.ts).

2. In `eslint.config.mjs`, change `'@typescript-eslint/no-explicit-any': 'off'` to `'@typescript-eslint/no-explicit-any': 'warn'`.

3. Create `.env.example` at project root:
   ```env
   # Database connection (use DATABASE_URL OR individual DB_* vars)
   DATABASE_URL=postgresql://user:password@localhost:5432/toggl_facturoid
   # DB_HOST=localhost
   # DB_PORT=5432
   # DB_NAME=toggl_facturoid
   # DB_USER=postgres
   # DB_PASSWORD=

   # Required: 64-character hex string (32 bytes) for AES-256-GCM encryption
   # Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ENCRYPTION_KEY=

   # Optional: server port (default: 3000)
   # PORT=3000
   ```
</action>

<verify>
```bash
test -f .env.example && echo ".env.example exists" && cat .env.example
```
</verify>

<done>
- `tsconfig.json` has `strict: true`, `noImplicitAny: true`, `strictBindCallApply: true`, `noFallthroughCasesInSwitch: true`
- `eslint.config.mjs` has `no-explicit-any` set to `warn`
- `.env.example` exists with all required environment variables documented
</done>

</tasks>

## <verify>
Final verification — run these commands and confirm they pass:
```bash
# 1. Check TypeScript compilation (may have warnings from other agents' files — ignore those)
npx tsc --noEmit 2>&1 | grep -c "error" || echo "No errors"

# 2. Verify SnakeNamingStrategy is configured
grep -q "SnakeNamingStrategy" src/config/database.config.ts && echo "PASS: SnakeNamingStrategy in database.config.ts"
grep -q "SnakeNamingStrategy" src/config/datasource.ts && echo "PASS: SnakeNamingStrategy in datasource.ts"

# 3. Verify no default password
grep -q "'postgres'" src/config/database.config.ts && echo "FAIL: default password still exists" || echo "PASS: no default password"

# 4. Verify .env.example
test -f .env.example && echo "PASS: .env.example exists"

# 5. Verify strict tsconfig
grep -q '"strict": true' tsconfig.json && echo "PASS: strict mode enabled"
```
</verify>
