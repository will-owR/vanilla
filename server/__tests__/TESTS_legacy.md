# Legacy Tests Migration Guide

Last updated: November 2, 2025

This document tracks tests that use legacy input formats and need migration to the canonical envelope format.

## Export Tests

### export.legacy-title-body.test.js

- **Current Format**: `{ title, body }`
- **Usage**: Direct title/body export tests
- **Migration**:
  - Convert to use canonical envelope format
  - Add normalizer test for this legacy shape
  - Keep as regression test with deprecation warning

### export.title-body.test.js

- **Current Format**: Direct title/body parameters
- **Usage**: Tests basic export functionality
- **Migration**:
  - Update to use `{ pages: [{ blocks: [{ type: 'text', content }] }] }`
  - Add validation for canonical envelope structure

### export.persisted.integration.test.js

- **Current Format**: `{ content: { title, body } }`
- **Usage**: Tests persisted content retrieval and export
- **Migration**:
  - Update test data to use canonical envelope format
  - Add persistence layer validation

## Preview Tests

### preview.test.mjs

- **Current Format**: `{ title, body }` payload
- **Usage**: Preview generation unit tests
- **Migration**:
  - Update test payloads to canonical format
  - Add validation for block structure
  - Test preview rendering with multiple block types

### preview.integration.test.js

- **Current Format**: Title/body in HTML validation
- **Usage**: End-to-end preview testing
- **Migration**:
  - Update to use blocks array for content
  - Add tests for different block type rendering
  - Validate HTML output against canonical structure

### test-previewTemplate.js

- **Current Format**: Multiple `{ title, body }` test cases
- **Usage**: Template rendering test suite
- **Migration**:
  - Convert all test cases to use blocks array
  - Add tests for new block types
  - Maintain HTML escaping tests with new structure

## Core Flow Tests

### coreFlow.integration.test.js

- **Current Format**: Legacy content format in flow
- **Usage**: End-to-end user flow testing
- **Migration**:
  - Update all steps to use canonical envelope
  - Add validation at each step
  - Test data normalization in flow

## Service Tests

### genieService.persistence.await.test.mjs

- **Current Format**: `{ content: { title, body }, copies: [] }`
- **Usage**: Tests async persistence
- **Migration**:
  - Update to canonical envelope format
  - Add tests for metadata persistence
  - Test version handling

### genieService.phase3.test.mjs

- **Current Format**: Legacy content structure
- **Usage**: Phase 3 service tests
- **Migration**:
  - Convert to use canonical envelope
  - Add multi-page tests
  - Test block type variations

### genieService.getPersistedContent.test.mjs

- **Current Format**: Legacy content retrieval
- **Usage**: Content persistence tests
- **Migration**:
  - Update to use canonical envelope storage
  - Add version conflict tests
  - Test metadata retrieval

## Controller Tests

### prompt.controller.test.mjs

- **Current Format**: Legacy content in requests
- **Usage**: Controller layer tests
- **Migration**:
  - Update request payloads to canonical format
  - Add validation middleware tests
  - Test error responses for invalid formats

## Binary Export Tests

### export-binary.test.mjs

- **Current Format**: Legacy payload format
- **Usage**: Binary export validation
- **Migration**:
  - Update to use canonical envelope
  - Add tests for different block types
  - Validate binary output against envelope structure

## Migration Strategy

1. Create normalizer tests first (1.5-2.5h)

   - Test all legacy format conversions
   - Validate output against schema
   - Add error cases

2. Update core components (2-3h)

   - Start with genieService tests
   - Update controller tests
   - Implement validation middleware

3. Update integration tests (2-3h)

   - Modify preview tests
   - Update export tests
   - Fix core flow tests

4. Add deprecation handling (1-2h)
   - Add warnings for legacy formats
   - Create migration guide for frontend
   - Document new validation errors

## General Notes

- Keep legacy format support during transition
- Add deprecation warnings in development
- Use schema validation in tests
- Document all format changes
- Update API documentation

## Test Coverage Requirements

- All legacy format conversions must be tested
- Validation must be tested for all formats
- Integration tests must cover full flow
- Error cases must be validated
- Deprecation warnings must be tested
