# Phase B Frontend: Option 2 Implementation Roadmap

**Target Audience**: Development team  
**Timeline**: 4-5 hours, 1-2 sessions  
**Complexity**: Medium  
**Risk**: Low

---

## Project Breakdown

### Phase 2a: Store & API Layer (1.5 hours)

#### Task 2a.1: Create ebookStore.js (45 min)

**File**: `client/src/stores/ebookStore.js` (~350 lines)

**Deliverables**:

- [x] Writable store with initial state
- [x] Config setters: setTheme, setPageCount, setColorPalette, setFontSizeScale
- [x] Operations: generate, applyOverride, undo, redo, reset
- [x] History tracking (configs array + currentIndex)
- [x] Error handling + loading state
- [x] JSDoc documentation

**Checklist**:

```javascript
1. Import writable from 'svelte/store'
2. Define TypeScript types (comments) for EbookStore interface
3. Initialize writable with default state:
   - config: { theme: 'dark', pageCount: 8, ... }
   - result: null
   - loading: false, error: null
   - history: { configs: [], currentIndex: -1 }
4. Implement setTheme(theme):
   - Validate against ['dark', 'light', 'corporate', 'bold']
   - Update config.theme
   - Add to history
5. Implement setPageCount(count):
   - Validate 3-20 range
   - Update config.pageCount
   - Compute density (light/medium/dense/very-dense)
   - Add to history
6. Implement setColorPalette(palette):
   - Validate against allowed palettes
   - Update config.colorPalette
7. Implement setFontSizeScale(scale):
   - Validate 0.8-1.2 range
   - Update config.fontSizeScale
8. Implement generate(prompt):
   - Validate prompt (non-empty)
   - Set loading=true, error=null
   - Call ebookApi.generateEbook({ prompt, config })
   - On success: update result, add config to history
   - On error: set error message
   - Always: set loading=false
9. Implement applyOverride(overrides, ebookId):
   - Validate overrides (only theme/palette/fontScale)
   - Set loading=true
   - Call ebookApi.applyOverride({ ebookId, overrides })
   - On success: update result.html + result.metadata
   - Always: set loading=false
10. Implement undo():
    - Check history.currentIndex > 0
    - Decrement currentIndex
    - Restore config from history
11. Implement redo():
    - Check history.currentIndex < history.configs.length - 1
    - Increment currentIndex
    - Restore config from history
12. Implement reset():
    - Clear result
    - Reset config to defaults
    - Reset history
13. Implement initialize():
    - Call ebookApi.fetchThemes()
    - Populate themes + colorPalettes in store
14. Add validation helper functions (validateTheme, etc.)
15. Add JSDoc for all exports
```

**Success Criteria**:

- ✅ No TypeScript/ESLint errors
- ✅ All methods callable without errors
- ✅ Store state reactive (subscribers notified)
- ✅ History navigation works bidirectionally

---

#### Task 2a.2: Create ebookApi.js (30 min)

**File**: `client/src/lib/ebookApi.js` (~150 lines)

**Deliverables**:

- [x] POST /api/ebook/generate wrapper
- [x] POST /api/override wrapper
- [x] GET /api/themes wrapper
- [x] Error normalization
- [x] Timeout handling

**Checklist**:

```javascript
1. Define CONFIG object:
   - API_BASE_URL: '/api'
   - TIMEOUTS: { GENERATE: 30000, OVERRIDE: 10000, THEMES: 5000 }
2. Create normalizeError(error, endpoint) helper
3. Create fetchWithTimeout(url, options, timeoutMs) helper
   - AbortController for timeout
   - Error handling for network + API errors
   - JSON response parsing
4. Implement generateEbook(payload):
   - POST to /api/ebook/generate
   - Timeout: 30s
   - Return response
   - Throw on error
5. Implement applyOverride(payload):
   - POST to /api/override
   - Timeout: 10s
   - Return response
   - Throw on error
6. Implement fetchThemes():
   - GET /api/themes
   - Timeout: 5s
   - Return response
   - Throw on error
7. Add JSDoc for all functions
```

**Success Criteria**:

- ✅ All endpoints callable
- ✅ Timeouts work (abort on 30s+ idle)
- ✅ Error messages human-readable
- ✅ No unhandled promise rejections

---

#### Task 2a.3: Add Backend Endpoints (30 min)

**Files Modified**: `server/index.js` (or new `server/routes/ebook.js`)

**Deliverables**:

- [x] POST /api/ebook/generate handler
- [x] POST /api/override handler
- [x] GET /api/themes handler
- [x] Input validation
- [x] Phase B module orchestration

**Checklist**:

```javascript
1. POST /api/ebook/generate:
   - Validate: prompt (non-empty), theme (valid), pageCount (3-20)
   - Call ContentChunker.analyze(prompt)
   - Call ThemeEngine.getTheme(theme)
   - Call PageLayout.calculateLayout(chunks, pageCount)
   - Call TOCGenerator.build(chunks)
   - Call ImageService.generate(chunks)
   - Build HTML response
   - Get contrastRatios from ThemeEngine
   - Save to database (optional for now)
   - Return { id, content, html, metadata, pages, can_export, can_override }

2. POST /api/override:
   - Validate: ebookId (required), overrides object
   - Validate override fields (only theme/colorPalette/fontSizeScale)
   - Fetch existing ebook from DB (or create mock)
   - Call OverrideService.apply(ebook, overrides)
   - Return { id, html, metadata }

3. GET /api/themes:
   - Return hardcoded theme metadata
   - Include: id, label, wcag, colors, contrastRatio
   - Include: colorPalettes array
```

**Success Criteria**:

- ✅ All endpoints respond with correct status codes
- ✅ Error responses include helpful messages
- ✅ Phase B modules called in correct order
- ✅ <10s latency for generate
- ✅ <2s latency for override

---

### Phase 2b: Component Wiring (1.5 hours)

#### Task 2b.1: Update App.svelte (45 min)

**File**: `client/src/App.svelte` (+80 lines)

**Deliverables**:

- [x] Import ebookStore
- [x] Import all 4 Phase B components
- [x] Add Phase B UI section (conditional on mode)
- [x] Wire component props to store
- [x] Wire component callbacks to store methods
- [x] Add error display
- [x] Add loading indicators

**Checklist**:

```svelte
<script>
  // Add imports
  import { ebookStore } from './stores/ebookStore.js';
  import ThemeSelector from './components/ThemeSelector.svelte';
  import PageCountSlider from './components/PageCountSlider.svelte';
  import OverrideForm from './components/OverrideForm.svelte';
  import ThemePreview from './components/ThemePreview.svelte';

  // On mount: initialize ebookStore (fetch themes)
  onMount(async () => {
    try {
      await ebookStore.initialize();
    } catch (err) {
      console.error('Failed to initialize ebookStore', err);
    }
  });
</script>

<!-- Add conditional Phase B section -->
{#if $modeStore.current === 'ebook'}
  <section class="phase-b-ebook">
    <h2>Phase B: Intelligent eBook Generator</h2>

    <!-- Config Controls -->
    <div class="controls-row">
      <ThemeSelector
        selectedTheme={$ebookStore.config.theme}
        onChange={(theme) => ebookStore.setTheme(theme)}
      />
      <PageCountSlider
        pageCount={$ebookStore.config.pageCount}
        onChange={(count) => ebookStore.setPageCount(count)}
      />
    </div>

    <!-- Preview -->
    <div class="preview-section">
      <ThemePreview
        theme={$ebookStore.config.theme}
        result={$ebookStore.result}
        loading={$ebookStore.loading}
      />
    </div>

    <!-- Generate Button + Prompt -->
    <div class="generate-section">
      <input
        type="text"
        placeholder="Enter prompt..."
        bind:value={userPrompt}
        disabled={$ebookStore.loading}
      />
      <button
        on:click={() => ebookStore.generate(userPrompt)}
        disabled={$ebookStore.loading || !userPrompt}
      >
        {#if $ebookStore.loading}
          Generating...
        {:else}
          Generate eBook
        {/if}
      </button>
    </div>

    <!-- Overrides (if result exists) -->
    {#if $ebookStore.result}
      <div class="overrides-section">
        <OverrideForm
          isLoading={$ebookStore.loading}
          onApply={(overrides) =>
            ebookStore.applyOverride(overrides, $ebookStore.result?.id)
          }
        />
      </div>
    {/if}

    <!-- Error Display -->
    {#if $ebookStore.error}
      <div class="error-box" role="alert">
        <strong>Error:</strong> {$ebookStore.error}
      </div>
    {/if}
  </section>
{/if}
```

**Success Criteria**:

- ✅ Phase B section renders without errors
- ✅ All components visible and interactive
- ✅ Store subscriptions working (values reactive)
- ✅ Loading state works (button disabled, spinner shown)
- ✅ Error display works

---

#### Task 2b.2: Component Prop Binding Review (30 min)

**Files**: ThemeSelector, PageCountSlider, OverrideForm, ThemePreview (no changes)

**Review Checklist**:

```javascript
1. ThemeSelector.svelte:
   - ✅ Accepts selectedTheme prop
   - ✅ Exports onChange callback
   - ✅ No internal state dependencies (stateless)
   - ✅ Accessibility attributes present

2. PageCountSlider.svelte:
   - ✅ Accepts pageCount prop
   - ✅ Exports onChange callback
   - ✅ No internal state dependencies (stateless)
   - ✅ Accessibility attributes present

3. OverrideForm.svelte:
   - ✅ Accepts isLoading prop
   - ✅ Exports onApply callback
   - ✅ No internal state dependencies (stateless)
   - ✅ Accessibility attributes present

4. ThemePreview.svelte:
   - ✅ Accepts theme, result, loading props
   - ✅ No callbacks (display-only)
   - ✅ Handles null result gracefully
   - ✅ Shows loading skeleton if needed
```

**Success Criteria**:

- ✅ All components stateless + reusable
- ✅ Props match store state shape
- ✅ Callbacks match store method signatures

---

#### Task 2b.3: Integration Testing (45 min)

**Files Created**: `client/src/__tests__/integration/phase-b-flow.test.js` (~200 lines)

**Test Cases**:

```javascript
1. Store + Components Integration:
   - User selects theme → store updates → ThemeSelector shows selected
   - User moves slider → store updates → PageCountSlider reflects value
   - User enters prompt → clicks generate → loading=true → results shown
   - User clicks override → loading=true → metadata updated

2. Store API Mocking:
   - Mock ebookApi.generateEbook() to return sample eBook
   - Mock ebookApi.applyOverride() to return updated metadata
   - Mock ebookApi.fetchThemes() to return theme list

3. Error Handling:
   - API error → error message displayed → retry possible
   - Invalid prompt → validation error shown
   - Network timeout → handled gracefully

4. Accessibility:
   - Tab navigation works through all controls
   - Screen readers announce state changes
   - Error messages announced

5. Performance:
   - Store updates <100ms
   - Component re-renders <50ms
```

**Success Criteria**:

- ✅ 15+ tests passing
- ✅ All happy paths + error paths covered
- ✅ >90% code coverage for store + api

---

### Phase 2c: Polish & Optimization (1.5 hours)

#### Task 2c.1: Styling & Layout (30 min)

**File**: `client/src/App.svelte` (add CSS section)

**Deliverables**:

- [x] Responsive grid layout for controls
- [x] Dark/light mode support (already in app)
- [x] Loading spinner animation
- [x] Error styling
- [x] Mobile-friendly (tab stacking)

**Checklist**:

```css
.phase-b-ebook {
  max-width: 1200px;
  margin: 2rem auto;
}

.controls-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin: 1rem 0;
}

.preview-section {
  margin: 2rem 0;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 1rem;
}

.generate-section {
  display: flex;
  gap: 1rem;
  margin: 1rem 0;
}

.generate-section input {
  flex: 1;
  padding: 0.75rem;
}

.generate-section button {
  padding: 0.75rem 1.5rem;
}

.overrides-section {
  margin: 2rem 0;
  border-top: 2px solid var(--color-border);
  padding-top: 1rem;
}

.error-box {
  background-color: var(--color-error-bg);
  color: var(--color-error-text);
  padding: 1rem;
  border-radius: 4px;
  margin: 1rem 0;
}

@media (max-width: 768px) {
  .controls-row {
    grid-template-columns: 1fr;
  }
}
```

**Success Criteria**:

- ✅ Layout responsive on mobile/tablet/desktop
- ✅ Accessible color contrast
- ✅ Loading state visually clear

---

#### Task 2c.2: Performance Profiling (30 min)

**Tools**: Chrome DevTools, Lighthouse

**Checklist**:

```
1. Store update latency:
   - setTheme() → measure time to subscriber notification
   - setPageCount() → measure time to density computation + notification
   - Target: <100ms

2. Component render time:
   - ThemePreview re-render on theme change
   - Target: <50ms

3. API response time:
   - generateEbook() → measure end-to-end (client + server + network)
   - Target: <10s
   - applyOverride() → measure end-to-end
   - Target: <2s

4. Bundle size:
   - ebookStore.js + ebookApi.js + components
   - Target: <50KB gzipped

5. Memory usage:
   - Monitor store subscriptions (no leaks)
   - Ensure history cleanup on reset()
```

**Success Criteria**:

- ✅ All latency targets met
- ✅ Bundle size <50KB
- ✅ No memory leaks in DevTools

---

#### Task 2c.3: Accessibility Audit (30 min)

**Tools**: Axe DevTools, WAVE, Keyboard navigation

**Checklist**:

```
1. Keyboard Navigation:
   - Tab through all controls in logical order
   - Enter/Space triggers actions
   - Escape cancels dialogs (if any)

2. Screen Reader:
   - All buttons labeled with aria-label or text
   - Form inputs have labels
   - Error messages announced
   - Loading state announced

3. Color & Contrast:
   - All text meets 4.5:1 contrast ratio (WCAG AA)
   - Color not only cue (error messages have icon + text)
   - Focus indicators visible

4. Responsive Text:
   - 200% zoom doesn't break layout
   - Text wraps properly
```

**Success Criteria**:

- ✅ Axe audit: 0 critical errors
- ✅ Keyboard navigation: 100% of controls accessible
- ✅ Screen reader: All content announced
- ✅ Zoom: Layout functional at 200%

---

### Phase 2d: Testing & QA (1 hour)

#### Task 2d.1: Unit Test Coverage (20 min)

**Files**: `client/src/stores/__tests__/ebookStore.test.js`, `client/src/lib/__tests__/ebookApi.test.js`

**Target**: >85% code coverage

**Test Matrix**:
| Module | Tests | Coverage |
|--------|-------|----------|
| ebookStore.setTheme | 3 | 100% |
| ebookStore.setPageCount | 3 | 100% |
| ebookStore.generate | 4 | 100% |
| ebookStore.applyOverride | 4 | 100% |
| ebookStore.undo/redo | 3 | 100% |
| ebookApi | 3 | 100% |
| **Total** | **20** | **100%** |

---

#### Task 2d.2: E2E User Flow Test (20 min)

**Scenario**: User generates eBook with custom theme + applies override

```javascript
it("should generate and override eBook", async () => {
  // 1. User selects theme
  fireEvent.click(screen.getByText("Light"));
  expect(store.config.theme).toBe("light");

  // 2. User adjusts page count
  fireEvent.change(screen.getByRole("slider"), { target: { value: 12 } });
  expect(store.config.pageCount).toBe(12);

  // 3. User enters prompt
  fireEvent.change(screen.getByPlaceholderText("Enter prompt..."), {
    target: { value: "A guide to Node.js" },
  });

  // 4. User clicks generate
  fireEvent.click(screen.getByText("Generate eBook"));
  expect(store.loading).toBe(true);

  // 5. Wait for result
  await waitFor(() => expect(store.result).toBeDefined());
  expect(store.result.metadata.theme).toBe("light");
  expect(store.result.metadata.pages_count).toBe(12);

  // 6. User applies override
  fireEvent.click(screen.getByText("Override Styles"));
  fireEvent.change(screen.getByDisplayValue("dark"), {
    target: { value: "corporate" },
  });
  fireEvent.click(screen.getByText("Apply"));

  // 7. Wait for override result
  await waitFor(() => expect(store.loading).toBe(false));
  expect(store.result.metadata.theme).toBe("corporate");
});
```

---

#### Task 2d.3: Regression Testing (20 min)

**Checklist**:

```
1. Phase A (demo mode) still works:
   - Mode switcher selects demo mode
   - Prompt + metadata inputs visible
   - Export button works
   - No errors in console

2. No new console errors or warnings

3. Existing tests still pass:
   - Run full test suite: npm test
   - No Phase A regression
```

**Success Criteria**:

- ✅ All Phase A tests pass
- ✅ No new console errors
- ✅ No UI layout regressions

---

### Phase 2e: Documentation & Handoff (30 min)

#### Task 2e.1: Code Documentation (15 min)

**Deliverables**:

- [x] JSDoc comments on all public functions
- [x] Inline comments for complex logic
- [x] README in store/ directory
- [x] API client documentation

#### Task 2e.2: Developer Guide (15 min)

**Files Created**: `PHASE_B_FRONTEND_USAGE.md` (dev guide)

**Content**:

- How to use ebookStore in components
- How to extend with new themes/palettes
- How to test store changes
- Debugging tips (DevTools, Svelte extensions)

---

## Timeline & Milestones

| Phase     | Task                   | Duration     | Owner       | Dependencies         |
| --------- | ---------------------- | ------------ | ----------- | -------------------- |
| 2a.1      | Create ebookStore.js   | 45m          | Frontend    | None                 |
| 2a.2      | Create ebookApi.js     | 30m          | Frontend    | None                 |
| 2a.3      | Add backend endpoints  | 30m          | Backend     | 2a.1, 2a.2           |
| 2b.1      | Update App.svelte      | 45m          | Frontend    | 2a.1, 2a.2           |
| 2b.2      | Review component props | 30m          | Frontend    | All components ready |
| 2b.3      | Integration tests      | 45m          | QA/Frontend | 2b.1, 2b.2           |
| 2c.1      | Styling & layout       | 30m          | Frontend    | 2b.1                 |
| 2c.2      | Performance profiling  | 30m          | QA          | 2c.1                 |
| 2c.3      | Accessibility audit    | 30m          | QA          | 2c.1                 |
| 2d.1      | Unit test coverage     | 20m          | QA          | 2a.1, 2a.2           |
| 2d.2      | E2E user flow test     | 20m          | QA          | 2b.3                 |
| 2d.3      | Regression testing     | 20m          | QA          | All                  |
| 2e.1      | Code documentation     | 15m          | Frontend    | All complete         |
| 2e.2      | Developer guide        | 15m          | Frontend    | All complete         |
| **TOTAL** |                        | **~5 hours** |             |                      |

---

## Parallel Work Opportunities

**Session 1** (Frontend + Backend pair):

- 2a.1 + 2a.2 (Frontend): Create stores in parallel
- 2a.3 (Backend): Add endpoints in parallel
- 2d.1 (QA): Write unit tests while devs code

**Session 2** (Frontend focus):

- 2b.1 + 2c.1 (Frontend): Update App + styling
- 2d.2 (QA): E2E tests while frontend integrates
- 2c.2 + 2c.3 (QA): Performance + accessibility

**Session 3** (Polish):

- 2d.3 (QA): Regression testing
- 2e.1 + 2e.2 (Frontend): Documentation

---

## Success Criteria (Final)

✅ All 4 Phase B components wired to ebookStore  
✅ Store handles all user interactions correctly  
✅ Backend endpoints respond in <10s (generate) / <2s (override)  
✅ >85% code coverage for store + API  
✅ All tests passing (unit + integration + E2E)  
✅ Accessibility audit: 0 critical issues  
✅ Performance targets met  
✅ No Phase A regressions  
✅ Components pass code review  
✅ Documentation complete + clear

---

## Next Steps

**On Completion of Option 2**:

1. Commit all changes with message: `feat(phase-b-frontend): Option 2 store-based integration complete`
2. Create PR with summary + screenshots
3. **Proceed to Option 3 Migration** (see `PHASE_B_OPTION3_MIGRATION_ROADMAP.md`)
4. Or **Start Option 5 Blueprint** (see `PHASE_B_OPTION5_BLUEPRINT.md`)
