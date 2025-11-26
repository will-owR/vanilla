# Phase 1 Test Execution Guide

Quick reference for running Phase 1 tests locally

---

## Quick Start

```bash
# Navigate to server directory
cd /workspaces/vanilla/server

# Run all tests (Phase 1 + existing)
npm test

# Expected: ~528+ tests PASSING (0 failures)
# Time: ~30-60 seconds
```

---

## Run Specific Test Files

### Unit Tests Only

```bash
npm test -- genieService.classifyPrompt.test.js
# Expected: 35 tests PASSING
# Time: ~5 seconds
```

### Integration Tests Only

```bash
npm test -- api.phase-ab.integration.test.js
# Expected: 80+ tests PASSING
# Time: ~20-30 seconds
```

### Watch Mode (Auto-re-run on file change)

```bash
npm run test:watch

# Then edit files and see tests re-run automatically
# Press 'q' to quit
```

### Coverage Report

```bash
npm run test:ci
# Generates coverage report
# Check: ./coverage/ directory
```

---

## Test File Locations

```
/workspaces/vanilla/
├── server/
│   ├── __tests__/
│   │   ├── genieService.classifyPrompt.test.js     (35 tests)
│   │   └── api.phase-ab.integration.test.js        (80+ tests)
│   ├── genieService.js                             (modified)
│   ├── index.js                                    (modified)
│   └── package.json                                (npm test)
├── client/
│   ├── src/
│   │   ├── stores/
│   │   │   └── flowStore.js                        (new)
│   │   └── components/
│   │       └── GenerateFlow.svelte                 (new)
│   └── package.json
```

---

## Expected Test Results

### Passing Tests

- ✅ 35 classifyPrompt unit tests
- ✅ 80+ API integration tests
- ✅ 413 existing tests (backward compatible)
- ✅ **Total: 528+ tests**

### Failure Indicators

If tests fail, check:

1. **Database Issues**

   ```bash
   # Check if database is initialized
   cd /workspaces/vanilla/server
   npm run migrate  # if available
   ```

2. **Server Issues**

   ```bash
   # Verify server starts successfully
   node index.js
   # Should start without errors
   # Press Ctrl+C to stop
   ```

3. **Dependencies**

   ```bash
   # Reinstall dependencies
   npm install
   ```

4. **Port Conflicts**
   ```bash
   # Check if port 3000 is in use
   lsof -i :3000
   # Kill if needed: kill -9 <PID>
   ```

---

## Test Output Examples

### Successful Run

```
 ✓ __tests__/genieService.classifyPrompt.test.js (35)
 ✓ __tests__/api.phase-ab.integration.test.js (80+)
 ✓ __tests__/existing.test.js (413)

 Test Files  3 passed (3)
 Tests  528+ passed (528+)

 PASS  All tests passed! ✓
```

### Failed Run (Example)

```
 ✗ __tests__/genieService.classifyPrompt.test.js (2 failed, 33 passed)
   ✗ should handle empty string
     TypeError: genieService.classifyPrompt is not a function
   ✗ should handle unicode characters
     Timeout: test took longer than 10000ms
```

If you see failures:

1. Read the error message carefully
2. Check the test file for what it's testing
3. Check the implementation file for the bug
4. Fix the implementation
5. Re-run tests

---

## Debugging Tests

### Debug Single Test

```bash
npm test -- genieService.classifyPrompt.test.js -t "should classify ebook"
# Runs only matching test
```

### Debug with Output

```bash
npm test -- genieService.classifyPrompt.test.js --reporter=verbose
# Shows detailed test output
```

### Use Console Output

Edit test file:

```javascript
it("should do something", async () => {
  const result = await genieService.classifyPrompt("test");
  console.log("Result:", result); // Add debug output
  expect(result).toBeDefined();
});
```

Then run test and check console output.

---

## Common Issues

### Issue 1: "Cannot find module 'genieService'"

**Solution**:

- Check import statement: `import genieService from "../genieService.js"`
- Ensure file path is correct
- Verify file exists in server/ directory

### Issue 2: "genieService.classifyPrompt is not a function"

**Solution**:

- Check if method exists in genieService.js
- Verify genieService is exported as CommonJS: `module.exports = genieService`
- Ensure classifyPrompt is defined on the object

### Issue 3: "Cannot connect to database"

**Solution**:

```bash
# Check if database exists
ls /workspaces/vanilla/server/data/

# If missing, may need to run migration
cd /workspaces/vanilla/server
npm run migrate:dev
```

### Issue 4: "Timeout: test took longer than 10000ms"

**Solution**:

- Test is hanging (likely waiting for I/O)
- Check if server is running
- Check if LLM API is responsive
- Increase timeout in vitest config if needed

### Issue 5: "Port 3000 already in use"

**Solution**:

```bash
# Find what's using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or change PORT in environment
PORT=3001 npm test
```

---

## Environment Variables

```bash
# Run tests with debug output
DEBUG=* npm test

# Disable persistence in tests
GENIE_PERSISTENCE_ENABLED=false npm test

# Use specific database
DATABASE_URL="file:./test.db" npm test

# Override timeout
NODE_OPTIONS="--max-old-space-size=4096" npm test
```

---

## Performance Tuning

### Run Tests Faster

```bash
# Skip slow tests
npm test -- -t "^((?!performance).)*$"

# Run in parallel (default)
npm test

# Sequential (slower, more reliable)
npm test -- --reporter=verbose --workers=1
```

### Run in Watch Mode

```bash
npm run test:watch
# Good for development
# Only re-runs affected tests
```

---

## Continuous Integration

### Run All Tests (CI Mode)

```bash
npm run test:ci
# Generates coverage report
# Runs all tests
# Produces summary
```

### GitHub Actions (if configured)

```yaml
- name: Run tests
  run: cd server && npm run test:ci
```

---

## After Tests Pass

Once all tests pass:

1. **Commit changes**

   ```bash
   git add .
   git commit -m "Phase 1 Testing: 115+ tests passing"
   ```

2. **Push to origin**

   ```bash
   git push origin aetherV0/anew-default-demo
   ```

3. **Create PR (if needed)**

   ```bash
   gh pr create --title "Phase 1: Classification & Orchestration" \
               --body "Phase 1 implementation + 115 tests"
   ```

4. **Move to Phase 2**
   - [ ] Plan Phase 2 features
   - [ ] Start Phase 2 implementation

---

## Test Documentation

For more details, see:

- `PHASE_1_TESTING_SUMMARY.md` - Comprehensive test guide
- `DAY_1_COMPLETION_SUMMARY.md` - Full Day 1 summary
- `genieService.classifyPrompt.test.js` - Unit test code
- `api.phase-ab.integration.test.js` - Integration test code

---

## Quick Command Reference

```bash
# Most common commands
npm test                                    # Run all tests
npm test -- file.test.js                   # Run specific file
npm run test:watch                          # Watch mode
npm run test:ci                             # Coverage report
npm test -- -t "test name"                 # Run specific test
npm test -- --reporter=verbose             # Verbose output

# Directory navigation
cd /workspaces/vanilla/server               # Go to server
cd /workspaces/vanilla/client               # Go to client
cd /workspaces/vanilla                      # Go to root

# Git commands
git status                                  # Check status
git add .                                   # Stage all changes
git commit -m "message"                     # Commit changes
git push origin branch-name                 # Push to origin
```

---

**Last Updated**: Day 1  
**Test Status**: Ready to run  
**Expected Result**: 528+ tests PASSING  
**Ready for**: Phase 2
