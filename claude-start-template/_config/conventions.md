# Code Conventions

> CUSTOMIZE: Replace all sections below with your project's specific conventions.

## TypeScript
- Strict mode always enabled
- No `any` types (use `unknown` + type guards)
- Interfaces for object shapes, types for unions/intersections
- Explicit return types on exported functions

## File Naming
- `kebab-case` for all files
- `.service.ts`, `.controller.ts`, `.module.ts`, `.dto.ts` (backend)
- `.spec.ts` for tests (colocated with source)

## API Design
- RESTful endpoints: `/api/{resource}`
- Consistent pagination: `?page=1&limit=20`
- Response format: `{ data, meta?, error? }`
- HTTP status codes: 200, 201, 400, 401, 403, 404, 409, 500

## Frontend
- Server Components by default, client only when needed
- Data fetching library for server state
- Lightweight store for UI state

## Database
- PascalCase model names, camelCase field names
- Soft delete pattern where appropriate

## Testing
- Unit + integration test framework
- E2E test framework
- Minimum patterns: happy path + error cases
- Mock external services
