# Content Quality Issue: Generic Chapter Titles

**Date**: December 3, 2025  
**Status**: 🔴 OPEN - Blocking production release  
**Severity**: HIGH (correctness issue)  
**Component**: Gemini API structure parsing  
**Branch**: `feat/B_Frontend_option2`

---

## Problem Summary

Generated ebooks have proper structure and formatting but with **generic, meaningless chapter titles**:

```
Table of Contents:
1. Chapter 1
2. Chapter 2
3. Chapter 3
...

Chapter 1: Chapter 1
[generic content for chapter 1]

Chapter 2: Chapter 2
[generic content for chapter 2]
```

**Expected**:

```
Table of Contents:
1. The Mysterious Disappearance
2. Whisper Witch Willa's Quest Begins
3. The Magic Broom's Secret
...

Chapter 1: The Mysterious Disappearance
[specific content for this chapter]

Chapter 2: Whisper Witch Willa's Quest Begins
[specific content for this chapter]
```

---

## Root Cause Analysis

### Current Flow

1. **Gemini API called** with structure prompt:

   ```
   Create a detailed structure for a 20-page eBook based on:
   "A children's magical tale about Whisper Witch Willa and her magic broom gone missing..."

   Return JSON with keys: title, chapters (number), outline: [{ chapter, title, estimated_topics: [] }]
   ```

2. **Gemini API response received** (actual content unknown - needs debugging)

3. **`tryParse()` function attempts to extract JSON**:

   - Checks if response starts with `{` or `[`
   - Attempts `JSON.parse()`
   - Falls back to regex `\{[\s\S]*\}/m` to find JSON block
   - Returns `null` if parsing fails

4. **Parsing fails** (response: `NOT FOUND` in logs)

5. **Fallback heuristic activated**:

   ```javascript
   if (!structure || !Array.isArray(structure.outline)) {
     const approxChapters = Math.ceil(pageCount / 2);
     const outline = Array.from({ length: approxChapters }).map((_, i) => ({
       chapter: i + 1,
       title: `Chapter ${i + 1}`, // ← GENERIC TITLES
       estimated_topics: [`Topic ${i + 1}`],
     }));
   }
   ```

6. **Fallback structure used** → Generic titles displayed to user

### Why Parsing Fails

**Hypothesis 1**: Gemini API returning plain text instead of JSON

- Gemini might return narrative structure instead of structured JSON
- Prompt not clear enough to force JSON format
- API not configured to use JSON mode

**Hypothesis 2**: JSON embedded in markdown code block

- Gemini response: `\`\`\`json\n{...}\n\`\`\``
- Regex doesn't account for markdown wrapping
- `tryParse()` fails to extract

**Hypothesis 3**: Response format changed

- API response structure different from expected
- `structureResp.content.body` might not contain text
- Need to check actual response object shape

---

## Debugging Strategy

### Step 1: Add Detailed Response Logging

**File**: `/workspaces/AetherPress/server/ebookService.js` (line ~195)

Add logging before `tryParse()`:

```javascript
console.log("[DEBUG] Gemini structure response type:", typeof structureResp);
console.log("[DEBUG] Gemini structure response keys:", Object.keys(structureResp || {}));
console.log("[DEBUG] structureResp.content:", structureResp?.content);
console.log("[DEBUG] structureResp.content.body:", structureResp?.content?.body);
console.log("[DEBUG] Full response (first 1000 chars):", JSON.stringify(structureResp).substring(0, 1000));

const aiText = (structureResp && ...) || "";
console.log("[DEBUG] aiText before parsing:", aiText.substring(0, 500));
```

### Step 2: Enhance JSON Extraction

**File**: `/workspaces/AetherPress/server/ebookService.js` (line ~168)

Improve `tryParse()` to handle markdown code blocks:

````javascript
const tryParse = (text) => {
  if (!text) return null;
  if (typeof text === "object") return text;
  if (typeof text !== "string") return null;

  // Log raw input for debugging
  console.log(
    "[DEBUG] tryParse input (first 300 chars):",
    text.substring(0, 300)
  );

  // Quick attempt: full-text JSON.parse
  try {
    if (/^[\s]*[\[{]/.test(text)) {
      const result = JSON.parse(text);
      console.log("[DEBUG] JSON parsed successfully from raw text");
      return result;
    }
  } catch (e) {
    console.log("[DEBUG] JSON.parse failed on raw text:", e.message);
  }

  // Strip markdown code blocks
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    console.log("[DEBUG] Found markdown code block, extracting JSON");
    try {
      const result = JSON.parse(codeBlockMatch[1]);
      console.log("[DEBUG] JSON parsed successfully from code block");
      return result;
    } catch (e) {
      console.log("[DEBUG] JSON.parse failed on code block:", e.message);
    }
  }

  // Attempt to find a JSON block inside text
  const jsonMatch = text.match(/\{[\s\S]*\}/m);
  if (jsonMatch) {
    console.log("[DEBUG] Found JSON block via regex");
    try {
      const result = JSON.parse(jsonMatch[0]);
      console.log("[DEBUG] JSON parsed successfully from regex");
      return result;
    } catch (e) {
      console.log("[DEBUG] JSON.parse failed on regex match:", e.message);
    }
  }

  console.log("[DEBUG] No JSON found in text");
  return null;
};
````

### Step 3: Run Test with Debugging

Once enhanced logging is in place:

```bash
# Restart server with enhanced logging
node server/index.js

# Trigger ebook generation from browser
# Watch server logs for [DEBUG] messages

# Copy logs and analyze:
# 1. What does structureResp contain?
# 2. What is aiText value?
# 3. Why does tryParse fail?
```

### Step 4: Analyze Results

Look for output like:

````
[DEBUG] Gemini structure response type: object
[DEBUG] Gemini structure response keys: content, rawText, model
[DEBUG] structureResp.content.body: "```json\n{...}\n```"
[DEBUG] aiText before parsing: "```json\n{...}\n```"
[DEBUG] tryParse input (first 300 chars): "```json\n..."
[DEBUG] Found markdown code block, extracting JSON
[DEBUG] JSON parsed successfully from code block
````

---

## Potential Fixes

### Fix Option 1: Improve JSON Extraction (Quick)

**Effort**: 30 minutes  
**Risk**: Low  
**Impact**: Likely solves markdown code block issue

Add support for markdown-wrapped JSON in `tryParse()` (see Step 2 above).

### Fix Option 2: Force JSON Output Format

**Effort**: 1 hour  
**Risk**: Low  
**Impact**: Gemini API respects output format requirement

Update structure prompt to explicitly require JSON:

```javascript
const structurePrompt = `
Create a detailed structure for a ${pageCount}-page eBook based on:
"${String(prompt)}"

IMPORTANT: Return ONLY valid JSON (no markdown, no explanation, just JSON):
{
  "title": "...",
  "chapters": <number>,
  "outline": [
    {"chapter": 1, "title": "...", "estimated_topics": [...]},
    ...
  ]
}
`;
```

### Fix Option 3: Use Gemini JSON Mode

**Effort**: 2 hours  
**Risk**: Medium (API changes)  
**Impact**: Guaranteed structured response

Configure Gemini client to use `response_mime_type: "application/json"`:

```javascript
const response = await client.generateContent({
  contents: [{ role: "user", parts: [{ text: structurePrompt }] }],
  generationConfig: {
    responseMimeType: "application/json",
  },
});
```

### Fix Option 4: Parse Narrative Structure

**Effort**: 3 hours  
**Risk**: High (complex NLP)  
**Impact**: Handles any response format

Fallback to parsing plain text response and extracting chapter names via sentence detection:

```javascript
const parseNarrativeStructure = (text) => {
  // Split into sentences/paragraphs
  // Use regex or NLP to identify chapter-like phrases
  // Extract titles from patterns like "Chapter X: ...", "Part X: ...", etc.
};
```

---

## Recommended Fix Path

1. **Immediate** (Fix 1): Add markdown code block support to `tryParse()`

   - Fastest to implement
   - Likely solves the problem
   - Low risk

2. **If Fix 1 insufficient** (Fix 2): Update prompt to be more explicit

   - Still quick
   - More robust
   - Better prompt engineering

3. **If both insufficient** (Fix 3): Implement Gemini JSON mode
   - More complex
   - Most reliable long-term
   - Should be permanent solution

---

## Testing After Fix

### Scenario 1: Simple Story

**Input**: "A children's magical tale about Whisper Witch Willa and her magic broom gone missing."

**Expected Output**:

```json
{
  "title": "Whisper Witch Willa's Adventure",
  "chapters": 10,
  "outline": [
    {"chapter": 1, "title": "The Mysterious Disappearance", ...},
    {"chapter": 2, "title": "Willa's Quest Begins", ...},
    ...
  ]
}
```

### Scenario 2: Technical Topic

**Input**: "A guide to machine learning fundamentals for beginners"

**Expected Output**:

```json
{
  "title": "Machine Learning Fundamentals",
  "chapters": 8,
  "outline": [
    {"chapter": 1, "title": "What is Machine Learning?", ...},
    {"chapter": 2, "title": "Supervised vs Unsupervised Learning", ...},
    ...
  ]
}
```

### Validation Checklist

- [ ] Structure parsing succeeds (not "NOT FOUND")
- [ ] Chapter titles are semantic and unique
- [ ] Title matches prompt topic
- [ ] Outline has correct number of chapters
- [ ] Table of Contents displays real titles
- [ ] Chapter headers not redundant ("Chapter 1: Chapter 1" → "Chapter 1: Real Title")
- [ ] Content quality acceptable for production

---

## Prevention

### For Future API Integrations

1. **Always test API response format** before integrating
2. **Add detailed logging** to all JSON parsing
3. **Handle markdown code blocks** in responses
4. **Use structured response formats** when available
5. **Document expected response shape** with examples
6. **Add metrics** for parsing success/failure rates

---

## Files to Modify

| File                      | Changes                                 | Priority |
| ------------------------- | --------------------------------------- | -------- |
| `/server/ebookService.js` | Add debug logging, improve `tryParse()` | HIGH     |
| `/server/geminiClient.js` | Consider JSON mode config               | MEDIUM   |
| Structure prompt          | Make more explicit                      | MEDIUM   |

---

## Related Documents

- `OPTION_B_TEST_LOG_ANALYSIS.md` - Test results showing generic titles
- `IMPLEMENTATION_OPTION_B_COMPLETE.md` - Polling infrastructure
- `BUG_TIMEOUT_504_GATEWAY_ERROR.md` - Original timeout issue

---

## Summary

**The polling infrastructure (Option B) works perfectly.** The issue is upstream in content generation—the Gemini API structure response is not being parsed correctly, triggering a fallback that creates generic chapter titles.

**Fix needed**: Debug and enhance JSON parsing in `ebookService.js` to handle actual Gemini API response format (likely markdown-wrapped JSON).

**Status**: 🔴 BLOCKING  
**Impact**: High (affects content quality)  
**Effort**: Low (30min - 2hrs depending on root cause)  
**Timeline**: Should fix before production release
