# Assessment: actionables-BB-11

This assessment reviews `actionables-BB-11` (the fix for the preview update bug) and records what it does well, gaps and risks to watch, prioritized recommendations, and acceptance criteria. The aim is to give reviewers and implementers a concise checklist and clear success criteria.

## Summary judgment

`actionables-BB-11` gets the core issue right and provides a small, focused set of changes that, if implemented carefully, will make the preview update immediate and reliable. The primary fix (merge persisted fields into the existing `contentStore` instead of overwriting it) is correct and necessary. The document could be improved by being more explicit about merge semantics, concurrent updates, and testing strategy in CI.

## What it does well

- Correctly identifies the root cause (persist step overwrites generated content).
- Focuses on separation of concerns: preview flow vs persistence flow.
- Calls out clear, testable actions (unit test for `persistContent`, manual verification, component simplification).
- Keeps the scope small and low-risk: change persistence update behavior rather than large refactors.

## Gaps and risks to watch

1. Merge semantics (shallow vs deep)

   - The document assumes a shallow merge is sufficient. If `content` contains nested objects (media, metadata, layout objects), a shallow merge could still overwrite nested structures. Clarify whether a shallow merge is acceptable or whether a deep-merge is required.

2. Atomic updates and concurrency

   - Performing a `get` + `set` across async operations can create races. Prefer `contentStore.update(fn)` or other atomic update APIs to avoid lost updates when multiple saves or HMR reloads occur.

3. Server response shape and normalization

   - Servers sometimes return `{ id }`, `{ promptId }`, or wrap payloads as `{ data: { ... } }`. Persist logic must robustly normalize these shapes before merging.

4. Duplicate preview requests / rate limiting

   - If preview logic remains duplicated across flows/components, the system can still produce repeated calls to `/preview`, leading to 429s in CI or production. The plan should explicitly require de-duplication of preview calls.

5. UX for persistence failures

   - Persist failures (rate limit, network error) should not surface as preview errors. The document should stress that `persistContent` errors are logged and optionally surfaced in a non-blocking way.

6. Test flakiness in integration/E2E
   - The E2E tests that exercise preview/persist endpoints can be flaky due to timing and shared services. Add guidance to stub or mock preview endpoints in CI for focused regression tests.

## Prioritized recommendations (concrete)

1. Safe, atomic merge inside `persistContent` (highest priority)

   - Use `contentStore.update((current) => ({ ...current, ...normalizedPersisted }))` to atomically merge persisted fields.
   - Normalize the persisted payload (`id` → `promptId`, unwrap `data` envelope) before merging.

2. Fire-and-forget persistence

   - Ensure `generateAndPreview` updates the `contentStore` and triggers preview rendering immediately. Do not await `persistContent()` in the critical path. Run persistence in the background (async fire-and-forget) and merge results on completion.

3. Make `PreviewWindow` a consumer-only component

   - Remove preview-fetching logic from the component and rely only on `$previewStore` and `$uiStateStore` for rendering and indicators. One canonical preview writer (the flows module) should be responsible for fetching preview HTML.

4. Defensive merging rules

   - Only merge server-returned keys that are expected (for example, `promptId`, `savedAt`). Avoid blindly spreading unknown fields that may clobber local-only properties.

5. Tests: unit-first, then focused integration

   - Unit tests for `persistContent` create (no promptId) and update (has promptId) paths, and for server shape variants.
   - Add a focused integration test that stubs `/preview` to avoid rate-limiting and validate generate→preview→persist behavior.

6. Logging and observability

   - Add lightweight debug logs when merging and when preview HTML is set. Optionally capture metrics for preview latency and persist success rates to help diagnose future regressions.

7. Concurrency controls
   - Debounce or dedupe persist requests for identical content. Use an in-flight map keyed by a content hash or promptId to prevent simultaneous duplicate saves.

## Acceptance criteria (how to verify the fix)

- Manual acceptance

  - Click "Generate" in the UI: preview updates immediately and no transient "No valid content provided for preview" appears after the save completes.
  - Network tab: verify preview GET/POST happens right after content generation; `/api/prompts` save happens separately.
  - Database or API: persisted record contains `promptId`, `title`, and `body` after flow completes.

- Automated acceptance
  - Unit tests: `persistContent` tests pass for create, update, and payload-envelope variations.
  - Integration: focused integration test (with preview stub) verifies generate→preview→persist pipeline deterministically in CI.
  - No increased rate of 429 or double-preview calls observed in CI logs after fix.

## Small implementation checklist

- [ ] Implement atomic merge in `persistContent` and normalize server response.
- [ ] Update `generateAndPreview` to not await persistence in the UI path.
- [ ] Make `PreviewWindow` render-only and remove any preview-fetching logic.
- [ ] Add unit tests for `persistContent` (create/update/envelope cases).
- [ ] Add focused integration test that stubs the preview endpoint.
- [ ] Add basic logging/telemetry for preview/persist events.
- [ ] Run full test suite and validate no new regressions.

---

End of assessment.
