# Shared Tests Migration Guide

Last updated: November 2, 2025

## Overview

This document outlines the required changes to shared module tests to align with the new service separation and canonical envelope format defined in `service_sampleService-final.md`.

## Affected Test Files

### PDF Export Tests

1. `pdfExport.test.ts`:

- **Current State**: Tightly coupled with file system operations
- **Required Changes**:
  - Separate PDF generation from file operations
  - Update to use canonical envelope format
  - Move file system operations to plumbing layer
  - Update test fixtures and assertions

## Required Structural Changes

### 1. PDF Generation Layer

```typescript
// Before:
exportCalendarToPDF(options) -> Buffer

// After:
interface PDFGenerationResult {
  buffer: Buffer;
  validation?: {
    ok: boolean;
    errors: string[];
    warnings: string[];
  };
}

generatePDF(envelope: CanonicalEnvelope) -> Promise<PDFGenerationResult>
```

### 2. File System Operations

- Move to separate plumbing module
- Create pure testing utilities
- Add mock implementations for CI

## Migration Steps

1. **Separate Concerns** (2.0-3.0h)

   - Split PDF generation from file operations
   - Create pure PDF generation functions
   - Move file operations to plumbing layer

2. **Update Test Structure** (1.5-2.0h)

   - Create mock PDF generation utilities
   - Add canonical envelope test fixtures
   - Update validation tests

3. **Add New Test Coverage** (1.0-2.0h)
   - Test pure PDF generation
   - Test envelope validation
   - Add error case coverage

## Test Environment Setup

```typescript
// Example: Updated PDF test fixtures
const mockCanonicalEnvelope = {
  id: "test_1",
  version: 1,
  pages: [
    {
      id: "p1",
      title: "Test Page",
      blocks: [
        { type: "text", content: "Test content" },
        { type: "image", content: { src: "test.png" } },
      ],
    },
  ],
};

// Mock PDF generation result
const mockPDFResult = {
  buffer: Buffer.from("test"),
  validation: {
    ok: true,
    errors: [],
    warnings: [],
  },
};
```

## Acceptance Criteria

- [ ] PDF generation tests use canonical envelope format
- [ ] File system operations are properly separated
- [ ] Validation is properly tested
- [ ] CI can run tests without file system access
- [ ] Error cases are properly handled and tested

## Notes

- Keep `PDF_GENERATOR_IMPL=mock` for CI
- Add proper TypeScript types for new interfaces
- Document new test patterns
- Implement comprehensive snapshot testing

## Cross-cutting Concerns

### Memory Management

```typescript
test("PDF generation cleanup", async () => {
  const initialMemory = process.memoryUsage().heapUsed;

  for (let i = 0; i < 10; i++) {
    const result = await generatePDF(mockCanonicalEnvelope);
    expect(result.buffer).toBeTruthy();
  }

  // Force garbage collection if possible in test environment
  if (global.gc) {
    global.gc();
  }

  const finalMemory = process.memoryUsage().heapUsed;
  // Allow for some overhead, but check for significant leaks
  expect(finalMemory - initialMemory).toBeLessThan(50 * 1024 * 1024); // 50MB
});
```

### Validation Testing

```typescript
describe("PDF Validation", () => {
  test("validates required block types", async () => {
    const invalidEnvelope = {
      ...mockCanonicalEnvelope,
      pages: [
        {
          id: "p1",
          blocks: [{ type: "unknown", content: "test" }],
        },
      ],
    };

    const result = await generatePDF(invalidEnvelope);
    expect(result.validation.ok).toBe(false);
    expect(result.validation.errors).toContain("Invalid block type: unknown");
  });
});
```

### Snapshot Testing

- Use snapshot testing for PDF structure verification
- Maintain golden files for key PDF layouts
- Implement pixel-perfect comparison where needed
- Add visual regression testing for critical layouts

## Migration Timeline

1. Phase 1: Separation of Concerns (2.0-3.0h)
2. Phase 2: Update Test Structure (1.5-2.0h)
3. Phase 3: Add New Coverage (1.0-2.0h)
4. Phase 4: Documentation and Clean-up (0.5-1.0h)

Total Estimated Time: 5.0-7.0h
