# Architecture Documentation Proposal

**Date**: December 13, 2025 @ ~1:45 PM  
**Branch**: `feat/ebook-revert`  
**Directory**: `docs/current_design/`

---

## Objective

Establish comprehensive documentation of AetherPress media (ebook, art et al.) system at two levels of detail before proposing architectural modifications to resolve the 60-second infrastructure timeout issue.

---

## Proposed Documentation Structure

### **Level 1: General Overview**

**File**: `ARCHITECTURE_OVERVIEW.md`

**Contents**:

- 🎯 System Goals - What the app does
- 🏗️ High-Level Architecture Diagram - Client ↔ Server data flow (ASCII/text)
- 📦 Core Components - Major pieces (frontend, backend, database, AI service)
- 🔄 Request/Response Flow - One complete ebook generation request lifecycle
- ⚙️ Technology Stack - Languages, frameworks, libraries
- 📊 Data Models - What gets passed between components
- ⏱️ Timing Constraints - Known limits (timeouts, rate limits, quotas)

**Target**: 2-3 pages, 10-minute read

**Purpose**: Quick understanding of the entire system and how pieces fit together

---

### **Level 2: Detailed Technical Documentation**

#### **Document A: Backend Architecture**

**File**: `BACKEND_ARCHITECTURE.md`

**Contents**:

- Entry point: `/api/ebook/generate` endpoint
- Request validation & preprocessing
- Core service layers:
  - `genieService.process()` - Orchestration
  - `ebookService.handle()` - Ebook-specific logic
  - `aiService` (Gemini integration)
  - `exportService` - PDF generation
  - Quota management
  - Rate limiting
- Response building & serialization
- Error handling paths
- State persistence

**Scope**: Complete traceability from HTTP request to response

---

#### **Document B: Frontend Architecture**

**File**: `FRONTEND_ARCHITECTURE.md`

**Contents**:

- Entry point: `GenerateFlow.svelte` component
- Store layer (`ebookStore.js`) - State management
- API client layer (`ebookApi.js`) - Network calls
- UI components - How they interact
- Error handling & user feedback
- Timeout configuration
- localStorage usage
- State transitions & flow logic

**Scope**: Complete traceability from user action to server request and response handling

---

#### **Document C: Integration Points**

**File**: `CLIENT_SERVER_INTEGRATION.md`

**Contents**:

- Request/response contract
  - What frontend sends to `/api/ebook/generate`
  - What backend returns (canonical envelope shape)
- Error contract
  - How errors flow from server → client
  - Error message propagation
- Timing & sequencing
  - Request lifecycle with timestamps
  - Expected durations at each stage
- Current failure modes
  - 60-second timeout issue
  - Where it breaks in the flow

**Scope**: The boundary between frontend and backend systems

---

## Implementation Plan

| Scope     | Document                     | Effort         | Status                |
| --------- | ---------------------------- | -------------- | --------------------- |
| 1         | ARCHITECTURE_OVERVIEW.md     | 1-2 hrs        | Awaiting approval     |
| 2         | BACKEND_ARCHITECTURE.md      | 3-4 hrs        | Awaiting approval     |
| 3         | FRONTEND_ARCHITECTURE.md     | 2-3 hrs        | Awaiting approval     |
| 4         | CLIENT_SERVER_INTEGRATION.md | 1-2 hrs        | Awaiting approval     |
| **Total** | **All Documents**            | **~10-12 hrs** | **Awaiting approval** |

---

## Quality Standards

Each document will include:

- ✅ Code references (file paths, line numbers)
- ✅ Actual code snippets where relevant
- ✅ Flow diagrams (ASCII or simple text)
- ✅ Current constraints & limitations
- ✅ Known issues and failure points
- ✅ Links to related investigation documents

---

## Recommended Sequencing

**Start with Scope 1 (Overview)** because:

1. Forces clarity on the big picture first
2. Quick to produce (1-2 hours)
3. Validates assumptions before deep-diving into detail
4. Can iterate with feedback before scopes 2-4

---

## Expected Outcome

After completion, we will have:

- ✅ Crystal clear understanding of current system
- ✅ Foundation for proposing architectural improvements
- ✅ Documentation clarifying feasibility of:
  - Async polling pattern
  - Response streaming approach
  - Infrastructure timeout increase
- ✅ Reference material for future development
- ✅ Basis for decision-making on which solution to implement

---

## Next Steps

**AWAITING YOUR APPROVAL TO PROCEED**

Once approved, will begin with Scope 1 (ARCHITECTURE_OVERVIEW.md) and iterate based on your feedback before moving to subsequent scopes.
