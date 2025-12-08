# V2 Components Purge Plan

**Date:** December 8, 2025  
**Status:** Planned  
**Priority:** High - Unblocks MIME type resolution issues

## Overview

The v2 component ecosystem (GenerateFlow-v2, MediaSelector-v2, api-v2, etc.) is orphaned dead code with zero integration into the active application. This plan documents the safe removal of all v2 artifacts.

## Problem Statement

1. **Orphaned Code:** V2 components form a closed, unreachable system

   - `GenerateFlow-v2.svelte` imports v2 sub-components and `api-v2.js`
   - No other code imports `GenerateFlow-v2.svelte`
   - Main `App.svelte` uses only non-v2 components
   - v2 test suite validates dead code only

2. **Code Quality Issues:**

   - Duplicate stores create confusion:
     - `/client/src/stores/flowStore.js` (298 lines - active)
     - `/client/src/lib/stores/flowStore.js` (171 lines - orphaned)
   - Clutters codebase and increases cognitive load
   - Makes it harder to identify which code actually runs

3. **MIME Type Bug Connection:**
   - `GenerateFlow.svelte` (non-v2) has missing `.js` extension: `import { flowStore } from "../stores/flowStore"`
   - This broken import may contribute to the MIME type error
   - v2 presence masks the real issue

## V2 Artifacts to Remove

### Components (8 files)

```
client/src/components/ClassificationFeedback-v2.svelte
client/src/components/CostVisualization-v2.svelte
client/src/components/GenerateFlow-v2.svelte
client/src/components/MediaSelector-v2.svelte
client/src/components/OverrideControls-v2.svelte
client/src/components/PromptInput-v2.svelte
client/src/components/ResultsDisplay-v2.svelte
client/src/components/StatsPanel-v2.svelte
```

### Library/API (1 file)

```
client/src/lib/api-v2.js
```

### Stores (1 file - orphaned duplicate)

```
client/src/lib/stores/flowStore.js
```

### Tests (8 files)

```
client/__tests__/StatsPanel-v2.test.js
client/__tests__/CostVisualization-v2.test.js
client/__tests__/ClassificationFeedback-v2.test.js
client/__tests__/OverrideControls-v2.test.js
client/__tests__/ResultsDisplay-v2.test.js
client/__tests__/api-v2.test.js
client/__tests__/UIComponents-v2.test.js
(plus any others matching *v2* pattern)
```

### Unused Modules (1 file)

```
client/src/lib/mockApi.js  (only references api-v2, no imports anywhere)
```

## Total Artifacts: ~20 files

## Safety Assessment

**Risk Level: MINIMAL**

- ✅ Zero active imports of any v2 component
- ✅ Zero active imports of api-v2.js
- ✅ Zero active imports of mockApi.js
- ✅ No UI code path reaches v2 components
- ✅ Orphaned stores don't affect main stores
- ✅ Tests only validate unreachable code

**What breaks if deleted: NOTHING**

## Purge Process

See detailed steps in the walkthrough section below.

## Post-Purge Tasks

1. Fix missing `.js` extensions in active imports (already identified)
2. Fix invalid Vite config `headers` (glob pattern syntax)
3. Run tests to verify non-v2 code still works
4. Verify UI renders without MIME type errors

## Related Issues to Address After Purge

1. **Import Extensions:** Several files missing `.js` on relative imports
2. **Vite Config:** `headers` object uses invalid glob pattern syntax
3. **GenerateFlow.svelte:** Missing extension on flowStore import
