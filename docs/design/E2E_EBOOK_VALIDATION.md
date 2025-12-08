# E2E Ebook Generation and Export Validation

## Purpose

Validate that the complete ebook generation and export pipeline works end-to-end with real Gemini API integration, across multiple page counts (3, 10, 20 pages).

## Workflow

The validation script (`./scripts/validate-ebook-e2e.js`) performs the following for each page count:

1. **POST /api/ebook** - Submit ebook generation request with n-page selection
2. **Poll /api/ebook/status/{id}** - Wait for async generation to complete
3. **GET /api/ebook/{id}** - Retrieve generated ebook (HTML + metadata)
4. **POST /export** - Request PDF export with generated content
5. **Validate Results:**
   - Structure parsed successfully (title + chapters extracted)
   - All chapters generated with real API (not MockAIService)
   - HTML composition > 0 bytes
   - PDF export returns valid binary data
   - Response times reflect real API (10-20s per chapter, not 0ms)

## Test Scenarios

| Scenario | Pages | Structure | Chapters | Expected Time |
| -------- | ----- | --------- | -------- | ------------- |
| Small    | 3     | 1 call    | 3 calls  | ~45s          |
| Medium   | 10    | 1 call    | 10 calls | ~120s         |
| Large    | 20    | 1 call    | 20 calls | ~240s         |

## Quota Tracking

All requests respect the 20 calls/minute Gemini free tier quota:

- Gemini 2.5 Pro: Structure parsing (1 call per ebook)
- Gemini 2.5 Flash: Chapter generation (1 call per chapter)

## Success Criteria

✅ **PASS**: All three scenarios (3, 10, 20 pages) complete generation and export without errors

- Structure parsing succeeds
- All chapters generated with real API responses
- PDF export returns valid binary
- No HTTP errors (400, 500)

❌ **FAIL**: Any scenario fails to complete or returns errors

- Missing structure fields
- API quota exceeded
- PDF export returns empty/invalid data
- HTTP error responses

## Output

Script produces:

- Console log of each step (generation, polling, export)
- Summary report: PASS/FAIL for each page count
- Timing breakdown per scenario
- Error details if any step fails

## Usage

```bash
node ./scripts/validate-ebook-e2e.js
```

Requires:

- Dev server running (`npm run dev` in both client and server)
- USE_REAL_AI=1 environment variable set
- Valid Gemini API credentials configured

## Related Files

- `./scripts/validate-ebook-e2e.js` - Validation script
- `server/index.js` - API endpoints (/api/ebook, /export)
- `server/ebookService.js` - Structure parsing, chapter generation
- `client/src/stores/ebookStore.js` - Frontend state management
