# Contributing

Thank you for your interest in contributing to Toggl-Fakturoid Sync. This guide covers the development setup, code standards, and contribution process.

## Development Setup

### Prerequisites

- Node.js >= 18
- pnpm >= 8
- PostgreSQL >= 14
- Git

### Getting Started

1. **Fork and clone** the repository:

    ```bash
    git clone https://github.com/your-username/toggl-facturoid-sync.git
    cd toggl-facturoid-sync
    ```

2. **Install dependencies:**

    ```bash
    pnpm install
    ```

3. **Set up the database:**

    ```bash
    createdb toggl_facturoid
    ```

4. **Configure environment:**

    ```bash
    cp .env.example .env
    # Fill in DATABASE_URL and ENCRYPTION_KEY
    ```

5. **Start the dev server:**

    ```bash
    pnpm run start:dev
    ```

6. **Run tests** to verify everything works:

    ```bash
    pnpm run test
    pnpm run lint
    ```

## Code Style

This project uses strict TypeScript with Prettier and ESLint.

### TypeScript

- Strict mode is enabled (`strict: true` in `tsconfig.json`)
- No implicit `any`
- Use explicit return types on exported functions
- Use `!` assertion only on TypeORM entity fields (standard pattern)

### Formatting

- **Prettier** handles all code formatting
- Single quotes, trailing commas
- Run `pnpm run format` before committing or configure your editor to format on save

### Linting

- **ESLint** with TypeScript support
- Run `pnpm run lint` to check and auto-fix issues

### File Naming

- Entity files: `kebab-case.entity.ts`
- Service files: `kebab-case.service.ts`
- Controller files: `kebab-case.controller.ts`
- DTO files: `kebab-case.dto.ts`
- Test files: `kebab-case.spec.ts` (co-located with source)

## Architecture Guidelines

- **NestJS modules** -- group related controllers, services, and entities into feature modules
- **TypeORM entities** with migrations, never `synchronize: true`
- **Credentials in DB** -- API keys are stored encrypted in `service_config`, not in environment variables
- **Secret masking** -- never return plaintext secrets in API responses
- **Error isolation** -- external API failures for one client should not block others

## Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
type(scope): short description

Optional longer description.
```

### Types

| Type       | When to use                                        |
|------------|----------------------------------------------------|
| `feat`     | New feature or endpoint                            |
| `fix`      | Bug fix                                            |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `docs`     | Documentation changes                              |
| `test`     | Adding or updating tests                           |
| `chore`    | Tooling, CI, dependency updates                    |

### Examples

```
feat(invoicing): add preview endpoint for monthly invoices
fix(toggl): handle null client IDs in API response
docs: update API reference with new endpoints
test(encryption): add tests for AES-256-GCM edge cases
```

## Pull Request Process

1. **Create a feature branch** from `main`:

    ```bash
    git checkout -b feat/your-feature
    ```

2. **Make your changes** with clear, atomic commits.

3. **Ensure quality:**

    ```bash
    pnpm run lint        # No lint errors
    pnpm run test        # All tests pass
    pnpm run build       # Compiles without errors
    ```

4. **Push and open a PR** against `main`.

5. **PR description** should include:
    - Summary of changes
    - Motivation / context
    - How to test the changes

6. **Review:** A maintainer will review your PR. Address feedback with additional commits.

## Adding New Features

### New Entity

1. Create the entity file in `src/invoicing/entities/`
2. Register it in `InvoicingModule` imports (`TypeOrmModule.forFeature([...])`)
3. Generate a migration: `pnpm run migration:generate src/migrations/DescriptiveName`
4. Verify the generated migration SQL

### New Service

1. Create the service file in `src/invoicing/services/`
2. Add it to `providers` (and optionally `exports`) in the appropriate module
3. Add corresponding unit tests

### New Controller Endpoint

1. Add the handler to the appropriate controller
2. Create DTOs with class-validator decorators for request validation
3. Document the endpoint in `docs/api.md`
4. Add unit tests for the controller

## Questions

If you have questions about the codebase or contribution process, open a GitHub issue with the `question` label.
