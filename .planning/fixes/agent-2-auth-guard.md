# Agent 2: API Authentication with Session Key

## <objective>
Implement a simple Basic Auth system with a one-time setup endpoint. When the app is first deployed, the user calls `POST /api/auth/setup` to generate a secret key. All subsequent API requests must include `Authorization: Basic username:secretkey`. The hashed secret is stored in the `service_config` table. This agent handles FIX 1 (S-CRIT-1).
</objective>

## <context>
Read these files before starting:
- `AGENTS.md` — project rules, tech stack, architecture
- `src/app.module.ts` — main app module (you will add AuthModule import here)
- `src/main.ts` — bootstrap file (reference only, do NOT modify)
- `src/invoicing/services/service-config.service.ts` — reference for how service_config is used
- `src/invoicing/entities/service-config.entity.ts` — the entity where the hashed secret will be stored
- `src/invoicing/services/encryption.service.ts` — reference for crypto patterns (you'll use Node.js crypto, not this service)

IMPORTANT: Do NOT modify any files in `src/invoicing/` — other agents work there. Only create new files in `src/auth/` and modify `src/app.module.ts`.
</context>

## <tasks>

### Task 1: Create the AuthGuard and AuthService

<files>
- `src/auth/auth.guard.ts` (create)
- `src/auth/auth.service.ts` (create)
</files>

<action>
1. Create `src/auth/auth.service.ts`:
   - Inject `Repository<ServiceConfig>` using `@InjectRepository(ServiceConfig)` from `@nestjs/typeorm`
   - Define constants: `SYSTEM_SERVICE_NAME = 'system'`, `API_SECRET_CONFIG_KEY = 'api_secret_hash'`
   - Implement `setup()` method:
     - Check if a secret already exists: `findOne({ where: { serviceName: 'system', configKey: 'api_secret_hash' } })`
     - If it exists, throw `ConflictException('API secret has already been configured. Setup can only be run once.')`
     - Generate a random secret: `crypto.randomBytes(32).toString('hex')` (64 chars)
     - Hash it with bcrypt (use Node.js `crypto.createHash('sha256')` or install `bcrypt` — prefer `crypto.createHash('sha256').update(secret).digest('hex')` to avoid native dependencies)
     - Actually, use `crypto.scrypt` or `crypto.pbkdf2` for proper password hashing. Best approach: use `crypto.randomBytes` for salt, `crypto.scryptSync(secret, salt, 64).toString('hex')` for the hash, store `salt:hash` in plainValue.
     - Simpler approach that avoids native deps: use `crypto.createHmac('sha256', salt).update(secret).digest('hex')` with a random salt. Store as `salt$hash` in `plainValue`.
     - Save to service_config: `{ serviceName: 'system', configKey: 'api_secret_hash', isSecret: false, plainValue: 'salt$hash', encryptedValue: null, iv: null, authTag: null }`
     - Note: we store the hash in `plainValue` (not encrypted) because it's already hashed. The `isSecret` is `false` because the value is a hash, not a secret.
     - Return the generated secret to the user (this is the ONLY time it's shown)
   - Implement `validateSecret(providedSecret: string): Promise<boolean>`:
     - Fetch the stored hash from service_config
     - If not found, throw `UnauthorizedException('API not configured. Run POST /api/auth/setup first.')`
     - Parse `salt$hash` from `plainValue`
     - Hash `providedSecret` with the same salt and compare
     - Return `true` if match, `false` otherwise
   - Implement `isSetupComplete(): Promise<boolean>`:
     - Check if the secret config row exists
     - Return `true` if it does

2. Create `src/auth/auth.guard.ts`:
   - Implement `CanActivate` interface
   - Inject `AuthService`
   - In `canActivate(context: ExecutionContext)`:
     - Get the request from context
     - Check for `Authorization` header
     - Parse `Basic <base64>` format: decode base64, split on `:` to get `username:secret`
     - The username can be anything (or fixed to `admin`) — the secret is what matters
     - Call `authService.validateSecret(secret)`
     - If valid, return `true`
     - If invalid or missing, throw `UnauthorizedException`
   - Mark the guard as `@Injectable()`
   - IMPORTANT: The `/api/auth/setup` endpoint must be EXEMPT from this guard. Use a custom decorator `@Public()` and check for it in the guard:
     ```typescript
     import { SetMetadata } from '@nestjs/common';
     export const IS_PUBLIC_KEY = 'isPublic';
     export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
     ```
     In the guard, use `Reflector` to check for the `IS_PUBLIC_KEY` metadata. If found, skip auth.
   - Also exempt requests when setup is not yet complete (no secret configured): call `authService.isSetupComplete()` — if false, allow the request through (the app is in initial setup mode). This ensures the user can call `/api/auth/setup` as the first request.
</action>

<verify>
```bash
test -f src/auth/auth.guard.ts && test -f src/auth/auth.service.ts && echo "PASS: auth files created"
npx tsc --noEmit 2>&1 | grep "src/auth" | head -10
```
</verify>

<done>
- `src/auth/auth.guard.ts` exists with `CanActivate` implementation
- `src/auth/auth.service.ts` exists with `setup()`, `validateSecret()`, and `isSetupComplete()` methods
- `@Public()` decorator exists and is respected by the guard
- Guard skips auth when setup is not complete (initial setup mode)
</done>

### Task 2: Create AuthController and AuthModule

<files>
- `src/auth/auth.controller.ts` (create)
- `src/auth/auth.module.ts` (create)
</files>

<action>
1. Create `src/auth/auth.controller.ts`:
   - Route prefix: `api/auth`
   - `POST /api/auth/setup`:
     - Decorated with `@Public()` (exempt from auth guard)
     - Calls `authService.setup()`
     - Returns `{ secret: '<generated-secret>', message: 'Save this secret — it will not be shown again. Use it in Authorization: Basic base64(username:secret) header.' }`
   - `GET /api/auth/status`:
     - Decorated with `@Public()` (so user can check if setup is needed)
     - Returns `{ configured: boolean }` based on `authService.isSetupComplete()`

2. Create `src/auth/auth.module.ts`:
   - Import `TypeOrmModule.forFeature([ServiceConfig])` (import `ServiceConfig` entity from `../invoicing/entities/service-config.entity`)
   - Provide: `AuthService`, `AuthGuard`
   - Export: `AuthService`, `AuthGuard`
   - Controllers: `AuthController`
   - Register `AuthGuard` as a global guard using `APP_GUARD`:
     ```typescript
     {
       provide: APP_GUARD,
       useClass: AuthGuard,
     }
     ```
     This makes ALL routes protected by default. Only `@Public()` routes bypass it.
</action>

<verify>
```bash
test -f src/auth/auth.controller.ts && test -f src/auth/auth.module.ts && echo "PASS: auth module files created"
npx tsc --noEmit 2>&1 | grep "src/auth" | head -10
```
</verify>

<done>
- `src/auth/auth.controller.ts` exists with `POST /api/auth/setup` and `GET /api/auth/status`
- `src/auth/auth.module.ts` exists, imports TypeOrmModule for ServiceConfig, registers APP_GUARD globally
- Setup endpoint is public; status endpoint is public
- All other endpoints require auth by default
</done>

### Task 3: Wire AuthModule into AppModule

<files>
- `src/app.module.ts` (modify — add AuthModule import)
</files>

<action>
1. In `src/app.module.ts`:
   - Add `import { AuthModule } from './auth/auth.module';`
   - Add `AuthModule` to the `imports` array (BEFORE `InvoicingModule` so the guard is registered first)
   - Do NOT modify anything else in this file

The resulting imports should be:
```typescript
imports: [
  ConfigModule.forRoot({ isGlobal: true }),
  TypeOrmModule.forRootAsync(databaseConfig),
  ScheduleModule.forRoot(),
  AuthModule,
  InvoicingModule,
],
```
</action>

<verify>
```bash
grep -q "AuthModule" src/app.module.ts && echo "PASS: AuthModule imported in app.module.ts"
npx tsc --noEmit 2>&1 | grep "src/app.module" | head -5
```
</verify>

<done>
- `app.module.ts` imports `AuthModule`
- Global auth guard is active for all routes
- `@Public()` routes are exempt from auth
</done>

</tasks>

## <verify>
Final verification:
```bash
# 1. All auth files exist
ls -la src/auth/

# 2. TypeScript compilation passes for auth files
npx tsc --noEmit 2>&1 | grep "src/auth" || echo "PASS: no auth compilation errors"

# 3. AuthModule is imported in app.module
grep "AuthModule" src/app.module.ts

# 4. APP_GUARD is registered
grep "APP_GUARD" src/auth/auth.module.ts

# 5. Public decorator exists
grep "IS_PUBLIC_KEY" src/auth/auth.guard.ts
```
</verify>
