# Backend Unit Tests - Quick Start Guide

## Running Tests

```bash
cd backend

# Run all tests
npm test

# Run tests in watch mode (re-run on file changes)
npm test -- --watch

# Run specific test file
npm test -- ClinicalTrialSearchValidator

# Run tests matching a pattern
npm test -- --grep "should filter"
```

## Test Files

| File | Tests | Purpose |
|------|-------|---------|
| `src/validators/ClinicalTrialSearchValidator.spec.ts` | 49 | Request validation logic |
| `src/auth/AuthService.spec.ts` | 16 | User registration & login |
| `src/auth/authMiddleware.spec.ts` | 32 | JWT & role-based auth |
| `src/services/ClinicalTrialsService.spec.ts` | 17 | Trial search & pagination |
| `src/services/CandidatePoolBuilder.spec.ts` | 37 | Trial filtering & ranking |
| `src/services/AdminService.spec.ts` | 30 | Admin user/role management |

## Current Status

✅ **181 tests passing**
✅ All test files created and passing
✅ 100% pass rate

## What's Tested

### Validation (`ClinicalTrialSearchValidator`)
- Search query requirements
- Numeric ranges (page size, age, enrollment)
- Date formats and ranges
- Array field validation

### Authentication (`AuthService`)
- User registration with password hashing
- User login with verification
- JWT token generation with 1h expiration

### Authorization (`authMiddleware`)
- Bearer token extraction & verification
- User action permission checking
- Role-based access control

### Clinical Trials (`ClinicalTrialsService`, `CandidatePoolBuilder`)
- Multi-page API pagination
- Trial filtering by metadata
- Trial ranking and capping
- Required/ineligible condition matching

### Admin (`AdminService`)
- User/role/action snapshots
- Role and action creation
- Role-action assignment

## Example: Adding a New Test

```typescript
import { describe, it, expect } from "vitest";

describe("MyFeature", () => {
  it("should do something", () => {
    const result = myFunction();
    expect(result).toBe(expectedValue);
  });
});
```

## Troubleshooting

**Tests fail with "Cannot find module"**
- Ensure dependencies are installed: `npm install`
- Check import paths are correct

**Database-related failures**
- Tests use mocks, no DB needed
- Check mock setup in `beforeEach` blocks

**Timeout errors**
- Increase timeout in test config if needed
- Check for missing `viii.clearAllMocks()` in cleanup

## See Also

- [Detailed Coverage Report](./TEST_COVERAGE.md)
- [Main README](../README.md)
- [Vitest Documentation](https://vitest.dev/)
