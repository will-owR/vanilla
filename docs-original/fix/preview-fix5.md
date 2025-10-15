# Preview Fix 5: Frontend Simplification

**IMPORTANT**: We have to examine why the E2E test fails as well as a few client tests.

## Analysis: Development Logic in Frontend

Our investigation revealed that development-specific logic (IS_DEV checks, debug logging) is adding unnecessary complexity to our frontend components. This violates our "dumb frontend" principle and makes testing more complex.

### Why "Dumb Frontend" Matters

1. Predictable behavior - components should just render and handle user input
2. Easier testing - no environment-specific code paths
3. Better separation of concerns - debug/development features belong in dev tools
4. Reduced maintenance burden - fewer conditionals and special cases

## Current Issues

1. Frontend has excessive business logic
2. Multiple round-trips between frontend and backend
3. Complex content resolution paths
4. Scattered persistence logic
5. Complex state management in frontend

## Proposed Architecture

### Frontend (Simple)

```javascript
async function handleGenerate(prompt) {
  try {
    setUiLoading("Generating...");
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) throw new Error("Generation failed");
    const { html, id } = await response.json();
    previewStore.set(html);
    setUiSuccess();
    return id; // Optional - for future reference
  } catch (error) {
    setUiError(error.message);
    throw error;
  }
}
```

### Backend (Consolidated)

```javascript
// Single endpoint handling all preview-related operations
app.post("/api/generate", async (req, res) => {
  const { prompt } = req.body;

  try {
    // 1. Generate content
    const content = await genieService.generate(prompt);

    // 2. Generate preview HTML
    const html = await previewService.generateHtml(content);

    // 3. Persist in single transaction
    const id = await db.transaction(async (trx) => {
      const promptId = await trx.savePrompt(prompt);
      const resultId = await trx.saveResult(content);
      const previewId = await trx.savePreview(html);
      return { promptId, resultId, previewId };
    });

    // 4. Return everything needed by frontend
    res.json({ html, id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Implementation Checklist

### Backend Changes

- [ ] Create new `/api/generate` endpoint in `server/index.js`

  - [ ] Implement prompt validation
  - [ ] Add content generation via genieService
  - [ ] Add HTML preview generation
  - [ ] Add atomic persistence
  - [ ] Add proper error handling

- [ ] Create `PreviewService` class in `server/previewService.js`

  - [ ] Move HTML generation logic from frontend
  - [ ] Add caching if needed
  - [ ] Add validation helpers

- [ ] Update DB schema/migrations if needed
  - [ ] Add preview_html column if not exists
  - [ ] Add indices for performance
  - [ ] Add constraints for data integrity

### Frontend Cleanup

- [ ] Simplify `flows.js`

  - [ ] Remove complex content resolution
  - [ ] Remove preview generation logic
  - [ ] Simplify to basic generate-and-display
  - [ ] Move development logging to browser dev tools

- [ ] Update `api.js`

  - [ ] Remove `loadPreview` complexity
  - [ ] Centralize error handling
  - [ ] Use consistent environment detection

- [ ] Simplify PreviewWindow.svelte
  - [ ] Remove IS_DEV checks
  - [ ] Remove debug logging
  - [ ] Keep only essential display logic and test hooks
  - [ ] Use browser dev tools for debugging

### Error Handling Strategy

Move error handling to middleware:

```javascript
// errorHandler.js
module.exports = (err, req, res, next) => {
  const isDev = process.env.NODE_ENV !== "production";
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
    details: isDev ? err.stack : undefined,
  });
};
```

### Development vs Production

Instead of component-level IS_DEV checks:

1. Use environment variables consistently
2. Leverage build-time configuration
3. Use browser dev tools for debugging
4. Keep runtime code clean and focused

### Next Steps

1. Fix E2E test failures (priority)
2. Clean up client tests
3. Remove development-only code
4. Implement centralized error handling
5. Update documentation

- [ ] Remove ID-based preview methods
- [ ] Add simple generate method

- [ ] Clean up stores
  - [ ] Remove unused state
  - [ ] Simplify state transitions
  - [ ] Document store responsibilities

### Testing Updates

- [ ] Update E2E tests for new flow

  - [ ] Add generate endpoint tests
  - [ ] Remove old preview endpoint tests
  - [ ] Update preview display tests

- [ ] Add integration tests

  - [ ] Test preview service
  - [ ] Test persistence flow
  - [ ] Test error cases

- [ ] Update unit tests
  - [ ] Frontend component tests
  - [ ] Backend service tests
  - [ ] Store management tests

### Documentation

- [ ] Update API documentation
- [ ] Update frontend README
- [ ] Update development guide
- [ ] Add migration guide

## Benefits

1. Clear separation of concerns
2. Single source of truth on backend
3. Reduced network traffic
4. Simpler state management
5. Easier testing and maintenance
6. Better error handling
7. Improved performance

## Migration Strategy

1. Build new endpoint alongside existing
2. Update frontend to use new endpoint
3. Add feature flag for gradual rollout
4. Remove old endpoints once stable

## Success Metrics

1. Reduced frontend code complexity
2. Fewer network requests
3. Improved error handling
4. Faster preview generation
5. More reliable state management

## Timeline

- Phase 1: Backend implementation (2 days)
- Phase 2: Frontend simplification (1 day)
- Phase 3: Testing & documentation (1 day)
- Phase 4: Rollout & cleanup (1 day)
