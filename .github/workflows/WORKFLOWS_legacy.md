# Legacy Workflow Migration Guide

Last updated: November 2, 2025
Last audit: November 2, 2025

## Summary of Impact

- Total affected workflows: 10
- Critical paths affected: Export generation, Preview generation, Smoke testing, Database, Docker builds
- Main branch validation impacted: Yes
- Nightly validation impacted: Yes
- Release process impacted: Yes (Docker builds)

This document tracks GitHub Actions workflows that need updates to support the new canonical envelope format and remove legacy format dependencies.

## Affected Workflows

### 1. ci-playwright-generate-preview.yml

**Current Usage**: Preview generation smoke tests
**Legacy Dependencies**:

- Generate-preview tests using legacy format
- End-to-end tests expecting legacy responses
- Client-side preview rendering of legacy data

**Required Updates**:

```yaml
jobs:
  generate-preview-smoke:
    env:
      PREVIEW_FORMAT: "canonical" # or "legacy" for backwards compatibility

    steps:
      - name: Run Playwright generate->preview smoke
        run: |
          (cd client && node ../scripts/test-generate-preview.js \
            --url http://localhost:5173 \
            --format ${{ env.PREVIEW_FORMAT }})
```

**Migration Steps**:

1. Update preview generation scripts to support canonical format
2. Add format-specific test suites
3. Update client-side preview rendering
4. Add validation for canonical envelope structure

### 2. ci-quick-smoke.yml

**Current Usage**: Fast smoke tests for PRs
**Legacy Dependencies**:

- Quick export tests using legacy format
- Health endpoint expectations
- Server response validation

**Required Updates**:

```yaml
jobs:
  quick-smoke:
    env:
      SMOKE_FORMAT: "canonical"

    steps:
      - name: Optional quick export
        env:
          EXPORT_FORMAT: ${{ env.SMOKE_FORMAT }}
        run: |
          npm run smoke:export:$EXPORT_FORMAT
```

**Migration Steps**:

1. Create format-specific smoke test scripts
2. Update health check validation
3. Add canonical format validation
4. Update artifact collection

### 3. ci-postgres-concurrency.yml

**Current Usage**: Database concurrency testing
**Legacy Dependencies**:

- Test data using legacy format
- Persistence layer assumptions
- Concurrent operation tests

**Required Updates**:

```yaml
jobs:
  postgres-concurrency:
    env:
      DATA_FORMAT: "canonical"

    steps:
      - name: Run concurrency tests
        env:
          TEST_DATA_FORMAT: ${{ env.DATA_FORMAT }}
        run: |
          npm run test:concurrency:$TEST_DATA_FORMAT
```

**Migration Steps**:

1. Update test data generation
2. Add canonical format persistence tests
3. Validate concurrent operations with new format
4. Update database schemas if needed

### 4. server-tests-pr.yml

**Current Usage**: Main PR validation workflow
**Legacy Dependencies**:

- Runs full test suite including legacy format tests
- Uses mock PDF generation that expects legacy format
- E2E worker test may use legacy data format

**Required Updates**:

```yaml
# Add format control
env:
  # Phase 1: Enable both
  ENABLE_LEGACY_FORMAT: "true"
  ENABLE_CANONICAL_FORMAT: "true"
  SKIP_PUPPETEER: "true"

steps:
  # Add validation step for canonical format
  - name: Validate Canonical Format
    run: |
      npm --prefix server run validate:envelope-schema

  # Update test runs to support both formats
  - name: Run server tests (unit)
    run: |
      # Legacy tests (temporary)
      ENABLE_LEGACY_FORMAT=true npm --prefix server test:legacy
      # New format tests
      ENABLE_CANONICAL_FORMAT=true npm --prefix server test:canonical
```

**Migration Steps**:

1. Add format environment variables
2. Split test runs into legacy and canonical
3. Add envelope schema validation
4. Update E2E worker test to use canonical format
5. Remove legacy support after transition

### 2. verify-export.yml

**Current Usage**: Export verification for PRs and main branch
**Legacy Dependencies**:

- `export-binary.test.mjs` uses legacy format
- Verification script expects legacy payload structure

**Required Updates**:

```yaml
jobs:
  verify-export:
    env:
      # Control format during transition
      EXPORT_FORMAT: "canonical" # or "legacy" for backwards compatibility

    steps:
      # Add canonical format validation
      - name: Validate Export Format
        run: |
          if [ "$EXPORT_FORMAT" = "canonical" ]; then
            npm --prefix server run validate:export-envelope
          fi

      # Update export verification
      - name: Run export verification
        run: |
          npm --prefix server run verify-export:$EXPORT_FORMAT
```

**Migration Steps**:

1. Create new canonical format export tests
2. Add format-specific verification scripts
3. Update artifact collection for new format
4. Phase out legacy format verification

### 3. ci-smoke-chrome.yml

**Current Usage**: Chromium-based smoke tests
**Legacy Dependencies**:

- Uses `verify-export:inproc` with legacy format
- Smoke test payloads use legacy structure

**Required Updates**:

```yaml
jobs:
  verify-export:
    env:
      # Add format control
      SMOKE_TEST_FORMAT: "canonical"

    steps:
      # Update smoke test execution
      - name: Run server smoke export verification
        env:
          CHROME_PATH: /usr/bin/chromium-browser
          EXPORT_FORMAT: ${{ env.SMOKE_TEST_FORMAT }}
        run: npm --prefix server run verify-export:smoke:$EXPORT_FORMAT
```

**Migration Steps**:

1. Create canonical format smoke tests
2. Update inproc verification script
3. Add format-specific smoke test runners
4. Update debug info collection

## Migration Strategy

### Phase 1: Dual Support (2-3 weeks)

1. Add format control environment variables
2. Create canonical format test suites
3. Update CI to run both formats
4. Add validation steps for canonical format

### Phase 2: Transition (2-3 weeks)

1. Default to canonical format in new PRs
2. Run legacy tests only on specific triggers
3. Update documentation and migration guides
4. Monitor test coverage and success rates

### Phase 3: Legacy Removal (1-2 weeks)

1. Remove legacy format support from CI
2. Clean up old test files
3. Update workflow files
4. Remove legacy environment variables

## Required Script Updates

### 1. verify-ci-env.sh

```bash
# Add format validation
if [ "$ENABLE_CANONICAL_FORMAT" = "true" ]; then
  # Validate envelope schema availability
  test -f "./server/schemas/envelope.json" || error "Envelope schema not found"
fi
```

### 2. package.json Scripts

```json
{
  "scripts": {
    "test:legacy": "ENABLE_LEGACY_FORMAT=true vitest run",
    "test:canonical": "ENABLE_CANONICAL_FORMAT=true vitest run",
    "verify-export:canonical": "node scripts/verify-export.js --format=canonical",
    "validate:envelope-schema": "node scripts/validate-envelope-schema.js"
  }
}
```

## Test Coverage Requirements

1. All new canonical format tests must pass
2. Legacy tests must continue passing during transition
3. Schema validation must be enforced
4. Smoke tests must cover both formats during transition
5. E2E tests must verify full pipeline

## Notes

- Keep backwards compatibility during transition
- Add clear logging for format usage
- Monitor CI performance impact
- Document all format-specific behaviors
- Create fallback procedures

### 5. ci-smoke-puppeteer.yml

**Current Usage**: Nightly full export validation
**Legacy Dependencies**:

- Full Puppeteer smoke export using legacy format
- PDF generation and validation
- Artifact generation and validation

**Required Updates**:

```yaml
jobs:
  smoke-puppeteer:
    env:
      EXPORT_FORMAT: "canonical"

    steps:
      - name: Run Puppeteer smoke export
        env:
          PDF_FORMAT: ${{ env.EXPORT_FORMAT }}
        run: |
          npm run smoke:export:$PDF_FORMAT
```

**Migration Steps**:

1. Update smoke export scripts for canonical format
2. Add PDF validation for new format
3. Update artifact collection
4. Add format-specific error handling

### 6. prisma-generate.yml

**Current Usage**: Database schema generation and testing
**Legacy Dependencies**:

- Unit tests using legacy format
- Database schema expectations
- Migration testing

**Required Updates**:

```yaml
jobs:
  prisma-generate:
    env:
      DB_FORMAT: "canonical"

    steps:
      - name: Run unit tests
        env:
          TEST_FORMAT: ${{ env.DB_FORMAT }}
          SKIP_PUPPETEER: "true"
        run: npm run test:$TEST_FORMAT
```

**Migration Steps**:

1. Update schema for canonical format support
2. Add format-specific test suites
3. Update migration scripts
4. Add schema validation

### 7. ci-server-tests-pr.yml

**Current Usage**: Comprehensive PR testing
**Legacy Dependencies**:

- Full server test suite with legacy tests
- Smoke export verification
- Database operations

**Required Updates**:

```yaml
jobs:
  server-tests:
    env:
      TEST_FORMAT: "canonical"

    steps:
      - name: Run server tests
        env:
          FORMAT: ${{ env.TEST_FORMAT }}
        run: npm test:$FORMAT --silent
```

**Migration Steps**:

1. Update test suites for new format
2. Add format-specific smoke tests
3. Update database operations
4. Add validation steps

### 8. docker-publish.yml

**Current Usage**: Docker image builds
**Legacy Dependencies**:

- Test suites in Docker builds
- Release artifacts
- Deployment configurations

**Required Updates**:

```yaml
jobs:
  build:
    env:
      BUILD_FORMAT: "canonical"

    steps:
      - name: Build with format
        env:
          FORMAT: ${{ env.BUILD_FORMAT }}
        run: |
          docker build --build-arg FORMAT=$FORMAT .
```

**Migration Steps**:

1. Update Docker build process
2. Add format configuration
3. Update test suites in containers
4. Modify deployment scripts

### 9. playwright-smoke.yml

**Current Usage**: Manual smoke testing
**Legacy Dependencies**:

- Preview generation using legacy format
- Manual testing endpoints
- Artifact generation

**Required Updates**:

```yaml
jobs:
  smoke:
    env:
      PREVIEW_FORMAT: "canonical"

    steps:
      - name: Run smoke script
        env:
          FORMAT: ${{ env.PREVIEW_FORMAT }}
        run: |
          (cd client && node ../scripts/test-generate-preview.js \
            --url "${{ github.event.inputs.url }}" \
            --format $FORMAT)
```

**Migration Steps**:

1. Update preview generation for canonical format
2. Add format selection in manual workflow
3. Update artifact handling
4. Add new format validation

## Timeline

1. **Week 1-2**: Implement dual support
2. **Week 3-4**: Begin transition to canonical format
3. **Week 5**: Remove legacy support
4. **Week 6**: Cleanup and documentation

## Required Actions

1. Create new test scripts
2. Update CI configuration
3. Add format validation
4. Update smoke tests
5. Create migration documentation
6. Monitor CI metrics during transition
