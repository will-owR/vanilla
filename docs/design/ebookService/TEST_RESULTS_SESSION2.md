# Session 2: Manual API Testing Results

**Date**: November 24, 2025  
**Tester**: [Your name]  
**Status**: 🟢 Ready to Execute

---

## Test Environment

- ✅ Server running: PID 66486 (/usr/local/bin/node index.js)
- ✅ USE_REAL_AI=1 enabled (from devcontainer)
- ✅ Tests use FORCE_MOCK_AI=1 (678/684 passing, ~37s)
- ✅ Endpoint fixed: /api/ebook/generate returns chapters array

---

## Test 1: Bedtime Story (Light Theme, 3 Pages)

**Command**:

```bash
curl -s -X POST http://localhost:3000/api/ebook/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A quick bedtime story for children",
    "theme": "light",
    "pageCount": 3,
    "colorPalette": "vibrant",
    "fontSizeScale": 1.0
  }' | jq '.chapters[0] | {title, content: (.content | .[0:100]), image}'
```

**Response Time**: [Record time in seconds]

**Sample Output**:

```json
{
  "title": "[RECORD_HERE]",
  "content": "[RECORD_FIRST_100_CHARS]",
  "image": {
    "concept": "[RECORD_CONCEPT]",
    "style": "[RECORD_STYLE]",
    "tone": "[RECORD_TONE]"
  }
}
```

**Validation Checks**:

- [ ] Response time: 5-15 seconds (✅ = real API, ❌ = too fast = mock)
- [ ] Title: Meaningful (NOT "Mock: ...")
- [ ] Content: Story text (NOT "Mock: ...")
- [ ] Concept: Semantic description (NOT "Concept 1")
- [ ] Chapters: 3 (or close)

**Status**: [ ] ✅ Pass [ ] ❌ Fail  
**Notes**: [Record any errors or observations]

---

## Test 2: Detective Story (Dark Theme, 5 Pages)

**Command**:

```bash
curl -s -X POST http://localhost:3000/api/ebook/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A mysterious detective story set in Victorian London",
    "theme": "dark",
    "pageCount": 5,
    "colorPalette": "standard",
    "fontSizeScale": 1.0
  }' | jq '.chapters | length, .[0:2] | map(.image.concept)'
```

**Response Time**: [Record time in seconds]

**Sample Output**:

```
5
[
  "[CONCEPT_1]",
  "[CONCEPT_2]"
]
```

**Validation Checks**:

- [ ] Response time: 5-15 seconds
- [ ] Chapter count: 5 (or close to requested)
- [ ] Concept 1: Semantic (detective/mystery themed)
- [ ] Concept 2: Semantic (detective/mystery themed)
- [ ] Style: "gothic" or related to dark theme

**Status**: [ ] ✅ Pass [ ] ❌ Fail  
**Notes**: [Record any errors or observations]

---

## Test 3: Corporate Theme (Business, 5 Pages)

**Command**:

```bash
curl -s -X POST http://localhost:3000/api/ebook/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Professional business strategy guide",
    "theme": "corporate",
    "pageCount": 5,
    "colorPalette": "standard",
    "fontSizeScale": 1.0
  }' | jq '.chapters[0].image | {concept, style}'
```

**Response Time**: [Record time in seconds]

**Sample Output**:

```json
{
  "concept": "[RECORD_CONCEPT]",
  "style": "[RECORD_STYLE]"
}
```

**Validation Checks**:

- [ ] Response time: 5-15 seconds
- [ ] Concept: Business-related (NOT "Concept 1")
- [ ] Style: "professional" or "minimalist"
- [ ] No errors in response

**Status**: [ ] ✅ Pass [ ] ❌ Fail  
**Notes**: [Record any errors or observations]

---

## Summary

**Overall Result**: [ ] ✅ All tests pass [ ] ⚠️ Partial [ ] ❌ Failed

**Key Metrics**:

- Average response time: [Record]
- Semantic content: [ ] ✅ Yes [ ] ❌ No
- Image concepts descriptive: [ ] ✅ Yes [ ] ❌ No
- No mock placeholders: [ ] ✅ Confirmed [ ] ❌ Found mocks

**Total API Calls Made**: [Record]
**Estimated Cost**: [Estimate ~$0.002-0.003 per call]

---

## Next Steps

**If All Tests Pass** ✅:

1. Proceed to Session 2.2: Browser validation
2. Test PDF preview/download
3. Test theme override (<2 seconds)
4. Document findings

**If Tests Fail** ❌:

1. Check server logs: `tail -100 /tmp/server.log`
2. Verify Gemini credentials: `env | grep GEMINI`
3. Check for API errors in response
4. Refer to AI_SERVICE_IMPLEMENTATION_GUIDE.md debugging section

---

## Session 2 Completion Timeline

- [ ] Test 1 complete (Bedtime story) - ~5 min
- [ ] Test 2 complete (Detective story) - ~10 min
- [ ] Test 3 complete (Corporate theme) - ~10 min
- [ ] Results documented - ~2 min
- **Total**: ~27 minutes for Phase 1 validation

**Then**: Browser testing + documentation (~90 min)
