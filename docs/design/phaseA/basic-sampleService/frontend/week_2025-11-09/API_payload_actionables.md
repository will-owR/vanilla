# API Payload Implementation - Backend Actionables

date: 2025-11-10
status: active

## Implementation Branch

All implementation work should be done in a dedicated feature branch:

```bash
git checkout -b feature/enhance-prompt-payload-backend
```

## 1. Validation Layer Implementation

### Create Payload Validator

Location: `server/validators/promptPayload.js`

```javascript
export function validatePayload(body) {
  if (!body?.mode || typeof body.prompt !== "string") {
    return {
      valid: false,
      error: "INVALID_PAYLOAD",
      message: "payload must include mode and prompt",
    };
  }

  // Mode-specific validation
  switch (body.mode) {
    case "demo":
      return validateDemoPayload(body);
    case "ebook":
      return validateEbookPayload(body);
    case "basic":
      return { valid: true };
    default:
      return {
        valid: false,
        error: "INVALID_MODE",
        message: "unsupported mode specified",
      };
  }
}

function validateDemoPayload(body) {
  const md = body.metadata || {};
  if (!md.title || !md.author || !md.pages) {
    return {
      valid: false,
      error: "MISSING_METADATA",
      fields: ["title", "author", "pages"],
    };
  }
  return { valid: true };
}

function validateEbookPayload(body) {
  // Implement when ebook mode requirements are finalized
  return { valid: true };
}
```

## 2. Endpoint Enhancement

### Update Prompt Handler

Location: `server/index.js`

```javascript
import { validatePayload } from "./validators/promptPayload.js";

app.post("/prompt", async (req, res) => {
  const validation = validatePayload(req.body);
  if (!validation.valid) {
    return res.status(400).json({
      error: validation.error,
      message: validation.message,
      fields: validation.fields,
    });
  }

  try {
    const result = await genieService.process(req.body);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      error: "GENERATION_ERROR",
      message: error.message,
    });
  }
});
```

## 3. Service Layer Updates

### Enhance GenieService

Location: `server/genieService.js`

```javascript
export async function process(payload) {
  const { mode, prompt, metadata = {}, options = {} } = payload;

  try {
    let result;
    switch (mode) {
      case "demo":
        result = await demoService.handle(payload);
        break;
      case "ebook":
        result = await ebookService.handle(payload);
        break;
      case "basic":
      default:
        result = await sampleService.handle(payload);
    }

    return {
      out_envelope: {
        pages: result.pages || [],
        metadata: {
          ...metadata,
          generated_at: new Date().toISOString(),
          mode: mode,
        },
        actions: result.actions || {},
      },
    };
  } catch (error) {
    throw new Error(`Generation failed: ${error.message}`);
  }
}
```

### Update Sample Service

Location: `server/sampleService.js`

```javascript
export async function handle(payload) {
  const { prompt, metadata = {}, options = {} } = payload;

  // Core generation logic
  const generated = await generateContent(prompt);

  return {
    pages: generated.pages,
    metadata: {
      ...metadata,
      ...generated.metadata,
    },
    actions: {
      can_export: true,
      can_preview: true,
    },
  };
}
```

## Implementation Order

1. Create Validation Layer:
   - [ ] Create `promptPayload.js` validator
   - [ ] Implement base payload validation
   - [ ] Add mode-specific validation rules
   - [ ] Add validation tests

2. Update Endpoint Handler:
   - [ ] Add validation to `/prompt` endpoint
   - [ ] Implement error handling wrapper
   - [ ] Add error response formatting
   - [ ] Update endpoint tests

3. Enhance Service Layer:
   - [ ] Update `genieService.process`
   - [ ] Add mode-based routing
   - [ ] Implement standard response envelope
   - [ ] Add service layer tests

4. Update Service Handlers:
   - [ ] Enhance `sampleService.handle`
   - [ ] Add metadata handling
   - [ ] Add action flags
   - [ ] Update handler tests

## Response Formats

### Success Response

```json
{
  "out_envelope": {
    "pages": [],
    "metadata": {
      "generated_at": "2025-11-10T...",
      "mode": "basic|demo|ebook",
      ...additional metadata
    },
    "actions": {
      "can_export": true,
      "can_preview": true
    }
  }
}
```

### Error Response

```json
{
  "error": "ERROR_CODE",
  "message": "Human readable message",
  "fields"?: ["field1", "field2"]
}
```

## Error Codes

- `INVALID_PAYLOAD`: Missing required fields
- `INVALID_MODE`: Unsupported mode specified
- `MISSING_METADATA`: Missing mode-specific metadata
- `GENERATION_ERROR`: Content generation failed

## Implementation Guidelines

1. Error Handling:
   - All errors must use standard format
   - Include specific error codes
   - Provide clear error messages
   - Add field details for validation errors

2. Response Format:
   - Use consistent `out_envelope` structure
   - Include complete metadata
   - Set appropriate action flags
   - Maintain payload context

3. Service Contracts:
   - Handle complete payload object
   - Return standardized response shape
   - Preserve and enhance metadata
   - Set correct action flags

## Next Steps

After backend implementation is complete:

1. Review and update API documentation
2. Begin frontend enhancement implementation
3. Add integration tests
4. Plan production deployment

Last updated: 2025-11-10
