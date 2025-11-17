# service_sampleService — Final Design (v02)

Last updated: November 3, 2025  
Previous version: November 1, 2025

## Table of Contents

1. [Overview](#1-overview)
2. [Core Specifications](#2-core-specifications)
3. [Implementation Guide](#3-implementation-guide)
4. [Migration & Deployment](#4-migration--deployment)
5. [Reference](#5-reference)

- [Appendix](#appendix)

## 1. Overview

### 1.1 Purpose

Provide a concise, implementable design that enforces separation of responsibilities and specifies the contracts for generation, user edits, and export.

### 1.2 Key Principles

- **Orchestrator-only**: `genieService` coordinates selection, normalization, validation, persistence orchestration and export orchestration
- **Services-only business logic**: `sampleService`, `demoService`, `ebookService` are responsible for generating content
- **Plumbing-only I/O**: `pdfGenerator`, DB/file utils perform side-effects

### 1.3 System Architecture

#### 1.3.1 Overall System Flow

```ascii
┌─────────────┐         ┌───────────────────────────────────────┐
│   Client    │         │              Controller               │
│  Frontend   │◄─────►  │         (server/index.js)             │
└─────────────┘         └───────────────┬───────────────────────┘
                                        │
                                        ▼
┌──────────────────────────────────────────────────────────────┐
│                       genieService                           │
│                                                              │
│  ┌─────────────┐      ┌─────────────┐    ┌─────────────┐     │
│  │ Normalizer  │      │ Validator   │    │ Orchestrator│     │
│  └─────┬───────┘      └──────┬──────┘    └─────┬───────┘     │
└────────┼─────────────────────┼─────────────────┼─────────────┘
         │                     │                 │
         ▼                     ▼                 ▼
┌────────────────┐   ┌────────────────┐   ┌────────────────┐
│    Services    │   │    Plumbing    │   │   Persistence  │
│                │   │                │   │                │
│ ┌──────────┐   │   │ │PDF Gen   │   │   │ │DB Utils  │   │
│ │sample    │   │   │ │PDF Gen   │   │   │ │DB Utils  │   │
│ └──────────┘   │   │ └──────────┘   │   │ └──────────┘   │
│ ┌──────────┐   │   │ ┌──────────┐   │   │ ┌──────────┐   │
│ │demo      │   │   │ │File Utils│   │   │ │Envelope  │   │
│ └──────────┘   │   │ └──────────┘   │   │ │Store     │   │
│ ┌──────────┐   │   │                │   │ └──────────┘   │
│ │ebook     │   │   │                │   │                │
│ └──────────┘   │   │                │   │                │
└───────┬────────┘   └───────┬────────┘   └────────┬───────┘
        │                    │                     │
        └────────────────────┼─────────────────────┘
                             │
                             ▼
                    Pure Data Flow Only
                   (Canonical Envelopes)
```

#### 1.3.2 sampleService Flow

```ascii
                      ┌─────────────────────┐
                      │    sampleService    │
                      └──────────┬──────────┘
                                 │
                                 ▼
              ┌────────────────────────────────────┐
              │         Content Creation           │
              │   (Processes prompt into pages)    │
              └─────────────────┬──────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────┐
│                    Return Package                         │
│                                                           │
│   ┌─────────────┐            ┌────────────────────┐       │
│   │  Envelope   │            │     Actions        │       │
│   │ (Content)   │            │    Declaration     │       │
│   │             │            │                    │       │
│   │  page 1     │            │ 1. print to file   │       │
│   │  page 2     │            │ 2. forward to user │       │
│   │  page 3     │            │                    │       │
│   └─────────────┘            └────────────────────┘       │
└───────────────────────────────────────────────────────────┘
                             │
                             ▼
                      ┌──────────────┐
                      │ genieService │
                      │(Orchestrator)│
                      └──────────────┘
```

### 1.4 Core Responsibilities

- **genieService**: Orchestrate and normalize. Input routing, calling services, persistence, PDF generation
- **Services**: Produce canonical envelopes; pure functions that return content
- **Plumbing**: Handle side-effects (persist envelopes, write files, produce PDFs)

## 2. Core Specifications

### 2.1 Canonical Envelope

All generated and edited content MUST use this canonical envelope format:

```typescript
interface Envelope {
  id?: string; // assigned when persisted
  version?: number; // incremented on each accepted edit
  metadata?: object; // model, author, timestamps, locale, etc.
  pages: Array<Page>;
}

interface Page {
  id?: string;
  title?: string;
  blocks: Array<Block>;
  layout?: object;
}

interface Block {
  type: "text" | "html" | "image" | "embed" | "raw";
  content: string | object;
  metadata?: object;
}
```

### 2.2 Service Contracts

#### 2.2.1 Generation Contract

```typescript
async generate(prompt: string | object): Promise<{
  envelope: Envelope;
  metadata?: object;
  actions?: Array<{ type: 'print'|'persist'|'forward', opts?: object }>;
}>
```

#### 2.2.2 Edit Contract

```typescript
async applyEdit({
  resultId: string;
  edit: object;
  baseVersion?: number;
}): Promise<{
  envelope: Envelope;
  persisted: { id: string; version: number; }
}>
```

#### 2.2.3 Export Contract

```typescript
async export({
  resultId?: string;
  content?: object;
  prompt?: string;
  validate?: boolean;
}): Promise<{
  buffer: Buffer;
  validation?: { ok: boolean; errors: any[]; warnings: any[]; };
  metadata?: object;
}>
```

### 2.3 Error Handling & Validation

- Validation returns: `{ ok, errors[], warnings[] }`
- Error structure: `{ status, code?, message, details? }`
- Invalid payloads: 4xx with details
- Server failures: 5xx

## 3. Implementation Guide

### 3.1 Enforcement Points

1. **Controller Boundaries** (`server/index.js`)

   - Accept legacy shapes
   - Call normalizer helper
   - Forward explicit parameters

2. **Service Generation** (`genieService.generate()`)

   - Call service
   - Assert canonical envelope returned
   - Process any actions requested by service

3. **Export Processing** (`genieService.export()`)

   - Canonicalize input
   - Call persistence helper if needed
   - Call pdfGenerator
   - Return buffer + validation

4. **Service Implementation**
   - Return envelopes only
   - Request actions instead of performing I/O
   - Pure business logic only

### 3.2 Normalization Requirements

- Single `server/utils/normalizeToPages.js` implementation
- Consistent normalization at all entry points
- Support for legacy shape conversion
- Validation of normalized output

## 4. Migration & Deployment

### 4.1 Migration Steps

1. Add normalizer (1.5–2.5h)

   - Implement `server/utils/normalizeToPages.js`
   - Add unit tests
   - Wire into controllers

2. Remove service side-effects (0.5–1.0h)

   - Make services pure
   - Add actions protocol
   - Update tests

3. Centralize persistence (1.0–2.0h)

   - Create persistence helper
   - Refactor genieService
   - Add sync/async modes

4. Update export path (1.0–2.0h)
   - Require canonical envelope
   - Wire normalizer
   - Add validation

### 4.2 Acceptance Criteria

1. Service purity:

   - No direct I/O in services
   - All content returned as canonical envelopes
   - Actions protocol for requesting operations

2. Normalization:

   - Single normalizer implementation
   - All inputs canonicalized consistently
   - Legacy support maintained temporarily

3. Testing:
   - Unit tests for normalizer
   - Integration tests with mock PDF generator
   - Validation coverage

### 4.3 CI/CD Considerations

- Use `PDF_GENERATOR_IMPL=mock` in CI
- Enable `SKIP_PUPPETEER=true` for faster tests
- Add validation in development mode

## 5. Reference

### 5.1 Example Implementations

1. Generated Envelope

```json
{
  "id": "r_1",
  "version": 1,
  "metadata": { "model": "sample-v1" },
  "pages": [
    {
      "id": "p1",
      "title": "Hi",
      "blocks": [{ "type": "text", "content": "Hello" }]
    }
  ]
}
```

2. Export Request

```json
{ "resultId": "r_1", "validate": true }
```

### 5.2 Priority Files

1. Core Services:

   - `server/index.js`
   - `server/genieService.js`
   - `server/sampleService.js`
   - `server/worker.js`

2. Test Files:

   - `server/__tests__/*`
   - `server/test-utils/pdfMock.js`
   - `client/__tests__/*`

3. New Files:
   - `server/utils/normalizeToPages.js`
   - `server/utils/persistence.js`

### 5.3 Supporting Artifacts

- Test migration notes in `*/__tests__/TESTS_legacy.md`
- Workflow documentation in `.github/workflows/`
- Schema definitions in `server/schemas/`

## Appendix

### A1. Implementation Gaps

Current gaps:

1. No explicit service intent/actions protocol
2. Proactive orchestration instead of service-driven
3. Inline normalization and persistence

Solution approach:

1. Add lightweight actions protocol
2. Centralize normalization
3. Extract persistence helper
4. Maintain backwards compatibility

### A2. Historical Context

**Note:** Legacy input shapes are no longer supported. The legacy migration documents are retained for historical reference only.

### A3. Version History

- v02 (Nov 3, 2025): Restructured for clarity and accessibility
- v01 (Nov 1, 2025): Initial comprehensive design document
