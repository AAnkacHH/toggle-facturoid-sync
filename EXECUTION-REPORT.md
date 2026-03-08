## PLAN COMPLETED: Add Swagger/OpenAPI documentation

**Tasks:** 6/6

### Summary of work:
1. Installed `@nestjs/swagger` via pnpm
2. Configured SwaggerModule in `main.ts` with HTTP Basic Auth security scheme, UI at `/api/docs`
3. Added `@ApiTags`, `@ApiBasicAuth`, `@ApiOperation`, `@ApiResponse`, `@ApiParam`, `@ApiQuery` to all 4 controllers
4. Added `@ApiProperty` / `@ApiPropertyOptional` to all 5 existing DTOs
5. Created 6 new response DTO classes for interfaces that Swagger cannot introspect
6. Added `@ApiProperty` decorators to all 3 entity classes used as response types
7. Auth controller public endpoints have no auth lock icon (no `@ApiBasicAuth` on the controller)

### Changed/created files:
- `package.json` (updated -- added `@nestjs/swagger` dependency)
- `pnpm-lock.yaml` (updated)
- `src/main.ts` (updated -- SwaggerModule setup)
- `src/auth/auth.controller.ts` (updated -- Swagger decorators)
- `src/auth/dto/auth-response.dto.ts` (created -- AuthSetupResponseDto, AuthStatusResponseDto)
- `src/invoicing/controllers/service-config.controller.ts` (updated -- Swagger decorators)
- `src/invoicing/controllers/client-mapping.controller.ts` (updated -- Swagger decorators)
- `src/invoicing/controllers/invoicing.controller.ts` (updated -- Swagger decorators)
- `src/invoicing/dto/create-service-config.dto.ts` (updated -- @ApiProperty)
- `src/invoicing/dto/update-service-config.dto.ts` (updated -- @ApiPropertyOptional)
- `src/invoicing/dto/create-client-mapping.dto.ts` (updated -- @ApiProperty/@ApiPropertyOptional)
- `src/invoicing/dto/update-client-mapping.dto.ts` (updated -- @ApiPropertyOptional)
- `src/invoicing/dto/generate-invoices.dto.ts` (updated -- @ApiProperty)
- `src/invoicing/dto/masked-service-config-response.dto.ts` (created)
- `src/invoicing/dto/invoice-generation-result-response.dto.ts` (created)
- `src/invoicing/dto/month-preview-response.dto.ts` (created -- MonthPreviewResponseDto, ClientPreviewDto, ProjectPreviewDto, GrandTotalDto)
- `src/invoicing/dto/toggl-client-response.dto.ts` (created -- TogglClientResponseDto, TogglProjectResponseDto)
- `src/invoicing/dto/fakturoid-subject-response.dto.ts` (created -- FakturoidSubjectResponseDto)
- `src/invoicing/entities/client-mapping.entity.ts` (updated -- @ApiProperty)
- `src/invoicing/entities/time-report.entity.ts` (updated -- @ApiProperty)
- `src/invoicing/entities/invoice-log.entity.ts` (updated -- @ApiProperty)

### Verification:
- Build: PASS
- Tests: 11 suites, 132 tests PASS
- Lint: All files I modified are clean (pre-existing errors in auth.guard.ts and auth.service.spec.ts remain unchanged)

### Swagger access:
- Swagger UI: `http://localhost:3000/api/docs`
- JSON spec: `http://localhost:3000/api/docs-json`

### Problems:
- None
