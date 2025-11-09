# Client Tests Migration Guide

Last updated: November 2, 2025

## Overview

This document outlines the required changes to client-side tests to align with the new service separation and canonical envelope format defined in `service_sampleService-final.md`.

## Affected Test Files

### Integration Tests

1. `prompt-to-preview.integration.test.js`:

- **Current State**: Uses legacy response format and direct preview content validation
- **Required Changes**:
  - Update store expectations to handle canonical envelope format
  - Modify preview content assertions to work with normalized data
  - Add tests for client-side normalization handling
  - Update preview ready detection to work with new data structure

2. `persistence-refresh.integration.test.js`:

- **Current State**: Tests direct persistence feedback
- **Required Changes**:
  - Update to use new `id`/`version` persistence model
  - Adapt refresh logic to work with canonical envelopes
  - Add tests for version conflict handling

### API Tests

1. `endpoints.test.js`:

- **Current State**: Tests legacy API shapes and validation
- **Required Changes**:
  - Add validation for canonical envelope structure
  - Update mock responses to match new format
  - Add tests for new error cases and validation
  - Update header and payload expectations

### UI Component Tests

1. `generate-button.test.ts`:

- **Current State**: Tests direct preview generation
- **Required Changes**:
  - Update event handling for new response format
  - Add tests for loading states with new data flow
  - Update error handling tests
  - Add version conflict UI tests
  - Test error boundary scenarios
  - Add backwards compatibility tests for legacy formats

2. `store-driven-preview.test.js`:

- **Current State**: Tests legacy store shapes
- **Required Changes**:
  - Update store shape expectations
  - Add tests for envelope normalization
  - Update preview rendering tests

## Migration Steps

1. **Store Updates** (2.0-3.0h)

   - Modify store interfaces to handle canonical envelopes
   - Add normalization layer for legacy data
   - Update store subscribers

2. **Component Adaptations** (1.5-2.5h)

   - Update preview components to read from normalized data
   - Modify generate button to handle new response format
   - Add version conflict UI handling

3. **Integration Test Updates** (2.0-3.0h)

   - Rewrite integration tests for new data flow
   - Add tests for error cases
   - Update mock implementations

4. **API Layer Changes** (1.0-2.0h)
   - Update endpoint tests for new formats
   - Add validation tests
   - Update error handling tests

## Test Environment Setup

```typescript
// Example: Updated preview test setup
const mockCanonicalResponse = {
  envelope: {
    id: "r_1",
    version: 1,
    pages: [
      {
        id: "p1",
        title: "Test",
        blocks: [{ type: "text", content: "Hello" }],
      },
    ],
  },
  metadata: {
    /* ... */
  },
};

// Updated store mock
const mockStore = {
  envelope: mockCanonicalResponse.envelope,
  status: "ready",
  version: 1,
};
```

## Acceptance Criteria

- [ ] All tests pass with new canonical envelope format
- [ ] Version conflicts are properly detected and handled
- [ ] Preview components render correctly from normalized data
- [ ] API calls use correct formats and handle errors appropriately
- [ ] Integration tests cover full generation -> preview -> export flow

## Notes

- Use `vitest.mock()` for consistent mocking across test suite
- Keep backwards compatibility during migration
- Add deprecation warnings for legacy formats
- Document new test patterns for team reference

## Store Subscription Testing

### Key Areas to Test

- Store update propagation with new envelope format
- Version conflict detection in subscriptions
- Store cleanup on component unmount
- Cross-store synchronization
- Error state propagation

### Example Subscription Test

```typescript
test("store properly handles envelope updates", async () => {
  const mockEnvelope = {
    id: "test_1",
    version: 2,
    pages: [
      /* ... */
    ],
  };

  let storeValue;
  const unsubscribe = contentStore.subscribe((value) => {
    storeValue = value;
  });

  contentStore.set({ envelope: mockEnvelope });
  expect(storeValue.version).toBe(2);
  expect(storeValue.envelope.id).toBe("test_1");

  unsubscribe();
});
```

## Backwards Compatibility Period

- Duration: 3 months
- Support both legacy and canonical formats
- Log deprecation warnings
- Track usage metrics
- Plan for legacy format removal
