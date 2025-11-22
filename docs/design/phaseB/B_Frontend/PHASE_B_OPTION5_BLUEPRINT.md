# Phase B Frontend: Option 5 Schema-Driven UI Blueprint

**Status**: Long-term vision (Post-Option 3, 4-6 weeks out)  
**Timeline**: 12-16 hours of development  
**Complexity**: Very High  
**Risk**: High  
**ROI**: Highest (maximum flexibility, zero frontend rework on backend changes)

---

## Executive Summary

**Option 5** implements a **schema-driven UI system** where the backend returns JSON describing the UI structure, and the frontend renders it dynamically. This eliminates frontend/backend coupling and enables:

✅ **Backend-driven UI Evolution**: Change UI on server without frontend deploy  
✅ **A/B Testing**: Server returns different schemas for different user segments  
✅ **Versioning**: Support legacy + new UI schemas simultaneously  
✅ **Zero Coupling**: Frontend is "dumb renderer", backend owns all logic  
✅ **Progressive Enhancement**: Graceful degradation if schema is incomplete

### Example: Backend Controls UI

```javascript
// Traditional Option 2/3:
// Frontend defines: "Show theme selector with 4 buttons"
// Frontend code: ThemeSelector.svelte hardcodes ['dark', 'light', 'corporate', 'bold']

// Option 5:
// Backend returns JSON schema:
{
  "type": "selector",
  "label": "Choose Theme",
  "name": "theme",
  "options": [
    { "id": "dark", "label": "Dark", "icon": "moon", "description": "..." },
    { "id": "light", "label": "Light", "icon": "sun", ... },
    { "id": "corporate", "label": "Corporate", "icon": "briefcase", ... },
    { "id": "bold", "label": "Bold", "icon": "lightning", ... }
  ],
  "validation": { "required": true },
  "accessibility": { "ariaLabel": "Select theme" }
}

// Frontend: Renders this schema using generic SchemaRenderer component
// Backend decides: Add new theme? Return schema with 5 options. Done.
```

---

## Architecture

### Option 5 Data Flow

```
User Request
  ↓
POST /api/ebook/generate-schema
  ↓
Backend:
1. Analyze prompt + request context
2. Build UI schema (form, preview, overrides panel)
3. Return JSON
  ↓
Frontend:
1. Receive JSON schema
2. Validate schema against TypeScript types
3. Render using SchemaRenderer component
4. Bind handlers
5. Display to user
  ↓
User Interaction (e.g., select theme)
  ↓
POST /api/ebook/generate (with selected config)
  ↓
Backend processes + returns eBook result
  ↓
User sees result rendered in preview
```

### Schema Architecture

```
UISchema (root)
├─ meta: { version: "1.0", type: "ebook-generator" }
├─ config:
│  ├─ theme: SelectorSchema
│  ├─ pageCount: SliderSchema
│  ├─ colorPalette: DropdownSchema
│  └─ fontSizeScale: SliderSchema
├─ preview: PreviewPanelSchema
├─ result: (generated eBook content)
└─ actions: { generate, override, export }
```

---

## Core Components

### 1. Schema Types (TypeScript Interfaces)

**File**: `client/src/lib/schemas/types.ts` (~200 lines)

```typescript
// Base schema types
type SchemaType =
  | "form"
  | "selector"
  | "slider"
  | "dropdown"
  | "textarea"
  | "preview"
  | "panel";

interface BaseSchema {
  type: SchemaType;
  name: string;
  label: string;
  description?: string;
  hidden?: boolean;
  required?: boolean;
  validation?: ValidationRule[];
  accessibility?: {
    ariaLabel?: string;
    ariaDescribedBy?: string;
    role?: string;
  };
}

interface SelectorSchema extends BaseSchema {
  type: "selector";
  options: Array<{
    id: string;
    label: string;
    description?: string;
    icon?: string;
    colors?: { bg: string; text: string; accent: string };
    disabled?: boolean;
  }>;
  defaultValue?: string;
}

interface SliderSchema extends BaseSchema {
  type: "slider";
  min: number;
  max: number;
  step?: number;
  defaultValue: number;
  units?: string;
  labels?: Array<{ value: number; label: string }>;
  hints?: {
    low: string; // "Sparse"
    medium: string; // "Standard"
    high: string; // "Dense"
  };
}

interface DropdownSchema extends BaseSchema {
  type: "dropdown";
  options: Array<{ id: string; label: string; description?: string }>;
  defaultValue?: string;
  searchable?: boolean;
}

interface TextareaSchema extends BaseSchema {
  type: "textarea";
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
  rows?: number;
  defaultValue?: string;
}

interface PreviewSchema extends BaseSchema {
  type: "preview";
  content: {
    title?: string;
    html?: string;
    pages?: Array<{ id: string; content: string }>;
    metadata?: Record<string, any>;
  };
  loading?: boolean;
  error?: string;
}

interface FormSchema extends BaseSchema {
  type: "form";
  sections: Array<{
    title: string;
    fields: BaseSchema[];
    collapsible?: boolean;
  }>;
}

interface UISchema {
  meta: {
    version: string;
    type: string;
    timestamp: string;
  };
  config: {
    [key: string]: BaseSchema;
  };
  preview?: PreviewSchema;
  actions: {
    generate?: { label: string; disabled?: boolean };
    override?: { label: string; disabled?: boolean };
    export?: { label: string; disabled?: boolean };
  };
  layout?: {
    type: "single-column" | "two-column" | "three-column";
    responsiveBreakpoints?: {
      mobile: string; // 'single-column'
      tablet: string; // 'two-column'
      desktop: string; // 'three-column'
    };
  };
}

// Validation rules
interface ValidationRule {
  type: "required" | "minLength" | "maxLength" | "pattern" | "custom";
  value?: any;
  message: string;
}
```

---

### 2. SchemaRenderer Component

**File**: `client/src/components/SchemaRenderer.svelte` (~300 lines)

```svelte
<script>
  import { validateValue } from '../lib/schemas/validator.js';
  import SelectorField from './fields/SelectorField.svelte';
  import SliderField from './fields/SliderField.svelte';
  import DropdownField from './fields/DropdownField.svelte';
  import TextareaField from './fields/TextareaField.svelte';
  import PreviewPanel from './fields/PreviewPanel.svelte';

  export let schema; // UISchema
  export let formData = {}; // { theme: 'dark', pageCount: 8, ... }
  export let onChange = (field, value) => {};
  export let onSubmit = (action, data) => {};

  let errors = {};

  function validateField(fieldName, value, rules) {
    errors[fieldName] = validateValue(value, rules);
  }

  function handleSubmit(action) {
    // Validate all required fields
    let allValid = true;
    Object.entries(schema.config).forEach(([name, fieldSchema]) => {
      if (fieldSchema.required) {
        const error = validateValue(formData[name], fieldSchema.validation);
        if (error) {
          errors[name] = error;
          allValid = false;
        }
      }
    });

    if (allValid) {
      onSubmit(action, formData);
    }
  }
</script>

<div class="schema-renderer" class:layout-two-col={schema.layout?.type === 'two-column'}>
  <!-- Config Panel -->
  <div class="config-panel">
    {#each Object.entries(schema.config) as [fieldName, fieldSchema]}
      {#if !fieldSchema.hidden}
        <div class="field-group">
          {#if fieldSchema.type === 'selector'}
            <SelectorField
              {fieldSchema}
              value={formData[fieldName]}
              error={errors[fieldName]}
              on:change={(e) => {
                formData[fieldName] = e.detail;
                onChange(fieldName, e.detail);
                validateField(fieldName, e.detail, fieldSchema.validation);
              }}
            />
          {:else if fieldSchema.type === 'slider'}
            <SliderField
              {fieldSchema}
              value={formData[fieldName]}
              on:change={(e) => {
                formData[fieldName] = e.detail;
                onChange(fieldName, e.detail);
              }}
            />
          {:else if fieldSchema.type === 'dropdown'}
            <DropdownField
              {fieldSchema}
              value={formData[fieldName]}
              on:change={(e) => {
                formData[fieldName] = e.detail;
                onChange(fieldName, e.detail);
              }}
            />
          {:else if fieldSchema.type === 'textarea'}
            <TextareaField
              {fieldSchema}
              value={formData[fieldName]}
              on:change={(e) => {
                formData[fieldName] = e.detail;
                onChange(fieldName, e.detail);
              }}
            />
          {/if}
        </div>
      {/if}
    {/each}

    <!-- Action Buttons -->
    <div class="actions">
      {#if schema.actions.generate}
        <button
          on:click={() => handleSubmit('generate')}
          disabled={schema.actions.generate.disabled}
        >
          {schema.actions.generate.label}
        </button>
      {/if}
      {#if schema.actions.override}
        <button
          on:click={() => handleSubmit('override')}
          disabled={schema.actions.override.disabled}
        >
          {schema.actions.override.label}
        </button>
      {/if}
    </div>
  </div>

  <!-- Preview Panel -->
  {#if schema.preview}
    <div class="preview-panel">
      <PreviewPanel schema={schema.preview} />
    </div>
  {/if}
</div>

<style>
  .schema-renderer {
    display: flex;
    gap: 2rem;
  }

  .schema-renderer.layout-two-col {
    flex-direction: column;
  }

  .config-panel {
    flex: 1;
  }

  .preview-panel {
    flex: 1;
    min-width: 300px;
  }

  .field-group {
    margin-bottom: 1.5rem;
  }

  .actions {
    display: flex;
    gap: 1rem;
    margin-top: 2rem;
  }

  @media (max-width: 768px) {
    .schema-renderer {
      flex-direction: column;
    }
  }
</style>
```

---

### 3. Schema Validator

**File**: `client/src/lib/schemas/validator.ts` (~150 lines)

```typescript
import type { ValidationRule, UISchema } from "./types";

/**
 * Validate single value against rules
 */
export function validateValue(
  value: any,
  rules?: ValidationRule[]
): string | null {
  if (!rules || rules.length === 0) return null;

  for (const rule of rules) {
    switch (rule.type) {
      case "required":
        if (!value) return rule.message;
        break;

      case "minLength":
        if (typeof value === "string" && value.length < rule.value) {
          return rule.message;
        }
        break;

      case "maxLength":
        if (typeof value === "string" && value.length > rule.value) {
          return rule.message;
        }
        break;

      case "pattern":
        if (value && !new RegExp(rule.value).test(value)) {
          return rule.message;
        }
        break;

      case "custom":
        // Evaluate custom validation function
        if (rule.value && typeof rule.value === "function") {
          if (!rule.value(value)) return rule.message;
        }
        break;
    }
  }

  return null;
}

/**
 * Validate entire form against schema
 */
export function validateFormData(
  formData: Record<string, any>,
  schema: UISchema
): Record<string, string | null> {
  const errors: Record<string, string | null> = {};

  Object.entries(schema.config).forEach(([fieldName, fieldSchema]) => {
    errors[fieldName] = validateValue(
      formData[fieldName],
      fieldSchema.validation
    );
  });

  return errors;
}

/**
 * Check if schema version is compatible
 */
export function isSchemaCompatible(
  schema: UISchema,
  minVersion: string
): boolean {
  const [major] = schema.meta.version.split(".").map(Number);
  const [minMajor] = minVersion.split(".").map(Number);
  return major >= minMajor;
}
```

---

### 4. Backend Schema Builder

**File**: `server/utils/schemaBuilder.js` (~250 lines)

```javascript
/**
 * Build UISchema for eBook generator frontend
 * Called on every request - backend controls UI
 */

class SchemaBuilder {
  constructor() {
    this.version = '1.0';
  }

  /**
   * Build initial configuration schema
   * @param {object} context - { userProfile, prompt, ... }
   * @returns {UISchema}
   */
  buildConfigSchema(context = {}) {
    const themes = this.getAvailableThemes(context);
    const palettes = this.getAvailablePalettes(context);

    return {
      meta: {
        version: this.version,
        type: 'ebook-generator-config',
        timestamp: new Date().toISOString()
      },

      config: {
        prompt: {
          type: 'textarea',
          name: 'prompt',
          label: 'What would you like to generate?',
          description: 'Describe your eBook concept in detail',
          placeholder: 'Enter your prompt here...',
          minLength: 10,
          maxLength: 5000,
          rows: 4,
          validation: [
            { type: 'required', message: 'Prompt is required' },
            { type: 'minLength', value: 10, message: 'Prompt must be at least 10 characters' }
          ],
          accessibility: {
            ariaLabel: 'eBook prompt input',
            ariaDescribedBy: 'prompt-help'
          }
        },

        theme: {
          type: 'selector',
          name: 'theme',
          label: 'Select Theme',
          description: 'Choose the visual style for your eBook',
          options: themes.map(theme => ({
            id: theme.id,
            label: theme.label,
            description: theme.description,
            icon: theme.icon,
            colors: {
              bg: theme.bgColor,
              text: theme.textColor,
              accent: theme.accentColor
            }
          })),
          defaultValue: 'dark',
          validation: [{ type: 'required', message: 'Theme is required' }],
          accessibility: { ariaLabel: 'Select theme' }
        },

        pageCount: {
          type: 'slider',
          name: 'pageCount',
          label: 'Number of Pages',
          min: 3,
          max: 20,
          step: 1,
          defaultValue: 8,
          units: 'pages',
          hints: {
            low: 'Sparse',
            medium: 'Standard',
            high: 'Dense'
          },
          accessibility: { ariaLabel: 'Select page count' }
        },

        colorPalette: {
          type: 'dropdown',
          name: 'colorPalette',
          label: 'Color Palette',
          description: 'Fine-tune the color scheme',
          options: palettes.map(p => ({
            id: p.id,
            label: p.label,
            description: p.description
          })),
          defaultValue: 'standard',
          searchable: false,
          accessibility: { ariaLabel: 'Select color palette' }
        },

        fontSizeScale: {
          type: 'slider',
          name: 'fontSizeScale',
          label: 'Font Size Scale',
          min: 0.8,
          max: 1.2,
          step: 0.1,
          defaultValue: 1.0,
          labels: [
            { value: 0.8, label: 'Small' },
            { value: 1.0, label: 'Normal' },
            { value: 1.2, label: 'Large' }
          ],
          accessibility: { ariaLabel: 'Select font size' }
        }
      },

      preview: {
        type: 'preview',
        name: 'preview',
        label: 'Preview',
        content: {
          title: 'Theme Preview',
          html: '<div>Select a theme to see preview</div>',
          loading: false
        }
      },

      actions: {
        generate: { label: 'Generate eBook', disabled: false },
        export: { label: 'Export Config', disabled: true },
        override: { label: 'Apply Overrides', disabled: true }
      },

      layout: {
        type: 'two-column',
        responsiveBreakpoints: {
          mobile: 'single-column',
          tablet: 'two-column',
          desktop: 'two-column'
        }
      }
    };
  }

  /**
   * Build result schema (after generation)
   * @param {object} ebookResult - { id, content, html, metadata, pages }
   * @returns {UISchema}
   */
  buildResultSchema(ebookResult) {
    return {
      meta: {
        version: this.version,
        type: 'ebook-generator-result',
        timestamp: new Date().toISOString()
      },

      preview: {
        type: 'preview',
        name: 'preview',
        label: 'Generated eBook',
        content: {
          title: ebookResult.content.title,
          html: ebookResult.html,
          pages: ebookResult.pages,
          metadata: {
            pageCount: ebookResult.metadata.pages_count,
            theme: ebookResult.metadata.theme,
            density: ebookResult.metadata.density,
            generatedAt: ebookResult.metadata.generated_at,
            contrastRatios: ebookResult.metadata.contrast_ratios
          }
        },
        loading: false
      },

      config: {
        // Allow overrides
        theme: this.buildOverrideThemeSchema(),
        colorPalette: this.buildOverridePaletteSchema(),
        fontSizeScale: this.buildOverrideFontSchema()
      },

      actions: {
        export: { label: 'Download PDF', disabled: false },
        override: { label: 'Apply Overrides', disabled: false }
      }
    };
  }

  // Helper methods
  getAvailableThemes(context) {
    // Could return different themes based on user context, A/B tests, etc.
    return [
      { id: 'dark', label: 'Dark', icon: 'moon', description: '...', ... },
      { id: 'light', label: 'Light', icon: 'sun', description: '...', ... },
      // ...
    ];
  }

  getAvailablePalettes(context) {
    return [
      { id: 'standard', label: 'Standard', description: '...' },
      { id: 'vibrant', label: 'Vibrant', description: '...' },
      // ...
    ];
  }
}

module.exports = { SchemaBuilder };
```

---

### 5. Backend API Changes

**Endpoint**: `POST /api/ebook/generate-schema` (NEW)

**Purpose**: Return UI schema (instead of generating directly)

**Request**:

```json
{
  "action": "init" | "generate" | "override",
  "formData": { "prompt": "...", "theme": "dark", ... },
  "context": { "userProfile": {...}, "previousResults": [...] }
}
```

**Response**:

```json
{
  "schema": {
    /* UISchema object */
  },
  "result": {
    /* eBook result if generation was triggered */
  }
}
```

**Implementation**:

```javascript
app.post("/api/ebook/generate-schema", async (req, res) => {
  const { action, formData, context } = req.body;

  try {
    const schemaBuilder = new SchemaBuilder();

    if (action === "init") {
      // Return initial config schema
      const schema = schemaBuilder.buildConfigSchema(context);
      return res.json({ schema });
    }

    if (action === "generate") {
      // Generate eBook + return result schema
      const result = await generateEbook(formData);
      const schema = schemaBuilder.buildResultSchema(result);
      return res.json({ schema, result });
    }

    if (action === "override") {
      // Apply override + return updated schema
      const result = await applyOverride(formData);
      const schema = schemaBuilder.buildResultSchema(result);
      return res.json({ schema, result });
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
```

---

## Implementation Phases

### Phase 5a: Infrastructure (3 hours)

- [ ] Define TypeScript schema types
- [ ] Implement schema validator
- [ ] Create SchemaRenderer component
- [ ] Implement field components (Selector, Slider, etc.)
- [ ] Add error boundary + fallback UI

### Phase 5b: Backend Schema Builder (3 hours)

- [ ] Implement SchemaBuilder class
- [ ] Add `/api/ebook/generate-schema` endpoint
- [ ] Integrate with Phase B modules
- [ ] Add schema versioning/compatibility checks
- [ ] Add A/B testing hooks

### Phase 5c: Frontend Integration (2 hours)

- [ ] Update App.svelte to use SchemaRenderer
- [ ] Wire form data to schema events
- [ ] Handle loading/error states from schema
- [ ] Add local schema caching

### Phase 5d: Advanced Features (2 hours)

- [ ] Server-driven A/B testing (different schemas per user)
- [ ] Progressive enhancement (graceful fallback if schema incomplete)
- [ ] Dynamic field dependencies (e.g., show override panel only if result exists)
- [ ] Schema versioning migration

### Phase 5e: Testing & Validation (2 hours)

- [ ] Schema validation tests
- [ ] Renderer component tests
- [ ] E2E schema evolution tests
- [ ] Performance profiling (schema parsing latency)

---

## Key Advantages of Option 5

| Advantage                | How It Works                                                         |
| ------------------------ | -------------------------------------------------------------------- |
| **Backend-Driven UI**    | Change UI by returning different schema; zero frontend deploy needed |
| **A/B Testing**          | Server returns schema-A or schema-B based on user segment            |
| **Feature Flags**        | Schema includes `hidden: true` for gradual rollouts                  |
| **Versioning**           | Multiple schema versions coexist; frontend validates compatibility   |
| **Zero Coupling**        | Frontend is "dumb renderer"; backend owns all logic                  |
| **Easy Experimentation** | Try new UI layout without code changes; measure impact               |
| **Graceful Degradation** | If schema is incomplete, fall back to default UI                     |

---

## Example: Add New Theme Without Frontend Deploy

### Traditional (Option 2/3):

```javascript
// 1. Backend adds new theme
// 2. Frontend dev updates ThemeSelector.svelte:
//    options: ['dark', 'light', 'corporate', 'bold', 'neon']  ← add 'neon'
// 3. Frontend dev deploys
// 4. Users see new theme
// Total: 30min dev + deploy + CDN cache time
```

### Option 5:

```javascript
// 1. Backend dev adds to SchemaBuilder.getAvailableThemes():
//    { id: 'neon', label: 'Neon', icon: '⚡', colors: {...} }
// 2. Backend deployed (no frontend change needed)
// 3. Next user request returns schema with 5 themes
// 4. Users see new theme immediately
// Total: 5min backend change
```

---

## Migration Strategy from Option 2/3 → Option 5

**Phase 1** (4 weeks):

1. Implement SchemaRenderer + schema types
2. Add `/api/ebook/generate-schema` endpoint (runs in parallel with old endpoint)
3. Update frontend to use SchemaRenderer with schema from new endpoint
4. Keep old endpoint as fallback

**Phase 2** (2 weeks):

1. Migrate all eBook config to schema-driven
2. Deprecate old endpoint
3. A/B test new UI vs old (if desired)

**Phase 3** (1 week):

1. Remove old endpoint
2. Optimize schema caching
3. Document schema system for team

---

## Success Criteria

✅ SchemaRenderer accepts any valid UISchema and renders it  
✅ Backend SchemaBuilder produces correct schemas  
✅ `/api/ebook/generate-schema` endpoint responds <200ms  
✅ Schema validator catches all invalid inputs  
✅ Backward compatibility maintained (fallback UI works)  
✅ Schema versioning prevents breaking changes  
✅ A/B testing experiments work (different schemas per segment)  
✅ Frontend deployments not needed for UI changes  
✅ >95% type safety (TypeScript schemas)

---

## Next Steps

**Long-term Roadmap**:

1. ✅ Complete Option 2 (Store-Based) — **Current**
2. ✅ Complete Option 3 (Dedicated Page) — **Next**
3. ✅ Option 5 (Schema-Driven) — **Long-term**
4. **Phase C Features** (AI-assisted design, Collaboration, etc.)

---

## Appendix: Complete Schema Example

```json
{
  "meta": {
    "version": "1.0",
    "type": "ebook-generator-config",
    "timestamp": "2025-11-22T10:30:00Z"
  },
  "config": {
    "prompt": {
      "type": "textarea",
      "name": "prompt",
      "label": "What would you like to generate?",
      "description": "Describe your eBook concept",
      "placeholder": "Enter your prompt...",
      "minLength": 10,
      "maxLength": 5000,
      "rows": 4,
      "validation": [
        { "type": "required", "message": "Prompt is required" },
        { "type": "minLength", "value": 10, "message": "Minimum 10 characters" }
      ]
    },
    "theme": {
      "type": "selector",
      "name": "theme",
      "label": "Select Theme",
      "options": [
        {
          "id": "dark",
          "label": "Dark",
          "icon": "🌙",
          "colors": { "bg": "#1a1a1a", "text": "#e0e0e0", "accent": "#00d4ff" }
        }
      ],
      "defaultValue": "dark"
    },
    "pageCount": {
      "type": "slider",
      "name": "pageCount",
      "label": "Pages",
      "min": 3,
      "max": 20,
      "defaultValue": 8
    }
  },
  "preview": {
    "type": "preview",
    "name": "preview",
    "label": "Preview",
    "content": { "title": "Theme Preview", "html": "<div>...</div>" }
  },
  "actions": {
    "generate": { "label": "Generate", "disabled": false }
  }
}
```
