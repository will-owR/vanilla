# Phase 1: Schema & Persistence — Implementation Summary

**Date**: November 12, 2025  
**Branch**: `feature/export-phase-1-schema`  
**Status**: ✅ COMPLETE

---

## **Overview**

Phase 1 implements the foundational database schema for reference-based export:

- Two new Prisma models: `Result` and `ExportJob`
- PostgreSQL migration applied and verified
- Database utilities module for clean CRUD operations

---

## **Changes Made**

### **1. Prisma Schema Update**

**File**: `/workspaces/Aether/server/prisma/schema.prisma`

**New Models**:

#### **Result Model**

```prisma
model Result {
  id          Int       @id @default(autoincrement())
  resultId    String    @unique @db.Uuid // UUID for anonymous access
  outEnvelope Json      @db.JsonB // Canonical { pages, metadata, actions }
  mode        String    @db.VarChar(50) // "basic", "demo", "ebook"
  promptId    Int? // Optional link to original prompt
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  exportJobs  ExportJob[] // Relationship to export jobs

  @@index([resultId])
  @@index([createdAt])
  @@map("results")
}
```

**Purpose**: Store generated content (canonical envelope) keyed by UUID for retrieval.

#### **ExportJob Model**

```prisma
model ExportJob {
  id            Int       @id @default(autoincrement())
  jobId         String    @unique @db.Uuid // UUID for job reference
  result        Result    @relation(fields: [resultId], references: [resultId])
  resultId      String    @db.Uuid // Foreign key to results.resultId
  status        String    @default("queued") @db.VarChar(50)
    // Values: queued, processing, complete, failed
  progress      Int       @default(0)
  pdfPath       String?   @db.VarChar(500) // Path to generated PDF
  errorMessage  String?   // Error details if failed
  createdAt     DateTime  @default(now())
  completedAt   DateTime? // Timestamp when job completed

  @@index([jobId])
  @@index([resultId])
  @@index([status])
  @@index([createdAt])
  @@map("export_jobs")
}
```

**Purpose**: Track async export job lifecycle (queued → processing → complete/failed).

---

### **2. PostgreSQL Migration**

**File**: `/workspaces/Aether/server/prisma/migrations/20251112224351_add_results_and_export_jobs/migration.sql`

**Migration Details**:

```sql
-- Two new tables created with indexes
CREATE TABLE "results" (
  id SERIAL PRIMARY KEY,
  resultId UUID UNIQUE NOT NULL,
  outEnvelope JSONB NOT NULL,
  mode VARCHAR(50) NOT NULL,
  promptId INTEGER,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "export_jobs" (
  id SERIAL PRIMARY KEY,
  jobId UUID UNIQUE NOT NULL,
  resultId UUID NOT NULL REFERENCES results(resultId),
  status VARCHAR(50) DEFAULT 'queued',
  progress INTEGER DEFAULT 0,
  pdfPath VARCHAR(500),
  errorMessage TEXT,
  createdAt TIMESTAMP DEFAULT NOW(),
  completedAt TIMESTAMP
);

-- Indexes for query performance
CREATE INDEX results_resultId_idx ON results(resultId);
CREATE INDEX results_createdAt_idx ON results(createdAt);
CREATE INDEX export_jobs_jobId_idx ON export_jobs(jobId);
CREATE INDEX export_jobs_resultId_idx ON export_jobs(resultId);
CREATE INDEX export_jobs_status_idx ON export_jobs(status);
CREATE INDEX export_jobs_createdAt_idx ON export_jobs(createdAt);
```

**Applied**: ✅ Database synced and verified

---

### **3. Database Utilities Module**

**File**: `/workspaces/Aether/server/utils/resultDb.js`

**Exports** (8 functions):

1. **saveResult(resultId, outEnvelope, mode, promptId?)**

   - Persist generated result to `results` table
   - Returns created Result record

2. **getResultById(resultId)**

   - Retrieve result by UUID
   - Returns Result with outEnvelope

3. **createExportJob(jobId, resultId)**

   - Create new export job for result
   - Validates result exists first
   - Status defaults to "queued"

4. **getExportJobById(jobId)**

   - Retrieve job with related Result
   - Includes job status and PDF path

5. **updateExportJob(jobId, updates)**

   - Update job status, progress, PDF path, error message
   - Used by job processor to track state

6. **getQueuedExportJobs(limit?)**

   - Retrieve all queued jobs (sorted by creation time)
   - Used by job processor to find next work

7. **deleteExpiredExportJobs(maxAgeMs?)**

   - Delete jobs older than threshold (default: 24h)
   - Also cleans associated PDF files (to be implemented in Phase 3)

8. **getExportJobStats()**
   - Returns counts by status: queued, processing, complete, failed
   - Used for monitoring/metrics

**Error Handling**:

- All functions validate required parameters
- Return 400 for missing params, 404 for not found, 500 for DB errors
- Errors logged to console for debugging

---

## **Database Schema Diagram**

```
┌─────────────────┐
│    results      │
├─────────────────┤
│ id (PK)         │
│ resultId (UUID) │ ←────┐
│ outEnvelope     │      │
│ mode            │      │ (1:N relationship)
│ promptId (FK?)  │      │
│ createdAt       │      │
│ updatedAt       │      │
└─────────────────┘      │
                         │
┌─────────────────┐      │
│  export_jobs    │      │
├─────────────────┤      │
│ id (PK)         │      │
│ jobId (UUID)    │      │
│ resultId (FK)   │──────┘
│ status          │
│ progress        │
│ pdfPath         │
│ errorMessage    │
│ createdAt       │
│ completedAt     │
└─────────────────┘
```

---

## **Data Contracts**

### **Result Record**

```javascript
{
  id: 1,                                    // Serial PK
  resultId: "550e8400-e29b-41d4-a716-...", // UUID
  outEnvelope: {                            // JSONB
    pages: [ ... ],
    metadata: {
      generated_at: "2025-11-12T...",
      mode: "basic",
      model: "sample-v1",
      pages_count: 3
    },
    actions: {
      persist_prompt: true,
      generate_pdf: true,
      can_export: true
    }
  },
  mode: "basic",                            // varchar(50)
  promptId: null,                           // nullable FK
  createdAt: "2025-11-12T12:30:45.000Z",   // timestamp
  updatedAt: "2025-11-12T12:30:45.000Z"    // timestamp
}
```

### **ExportJob Record**

```javascript
{
  id: 1,                                    // Serial PK
  jobId: "660e8400-e29b-41d4-a716-...",    // UUID
  resultId: "550e8400-e29b-41d4-a716-...", // UUID FK
  status: "queued",                         // varchar(50)
  progress: 0,                              // 0-100
  pdfPath: null,                            // nullable path
  errorMessage: null,                       // nullable
  createdAt: "2025-11-12T12:31:00.000Z",   // timestamp
  completedAt: null                         // nullable timestamp
}
```

---

## **Testing Phase 1**

### **Verify Schema**

```bash
cd /workspaces/Aether/server
./scripts/db-health.sh --check=all
# Expected: DB: UP, Prisma: OK, Schema: VALID
```

### **Test resultDb Functions**

```javascript
const resultDb = require('./utils/resultDb');

// Save a result
const result = await resultDb.saveResult(
  'uuid-1',
  { pages: [...], metadata: {...}, actions: {...} },
  'basic'
);

// Retrieve it
const retrieved = await resultDb.getResultById('uuid-1');

// Create export job
const job = await resultDb.createExportJob('job-uuid-1', 'uuid-1');

// Update job status
await resultDb.updateExportJob('job-uuid-1', {
  status: 'processing',
  progress: 50
});

// Get statistics
const stats = await resultDb.getExportJobStats();
// { queued: 0, processing: 1, complete: 0, failed: 0 }
```

---

## **Files Changed**

| File                                                                   | Change                            | Status |
| ---------------------------------------------------------------------- | --------------------------------- | ------ |
| `server/prisma/schema.prisma`                                          | Added Result and ExportJob models | ✅     |
| `server/prisma/migrations/20251112224351_add_results_and_export_jobs/` | Migration SQL                     | ✅     |
| `server/utils/resultDb.js`                                             | New file (8 DB utility functions) | ✅     |

---

## **Git Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations/ server/utils/resultDb.js
git commit -m "feat: Phase 1 - Add Result and ExportJob schema with database utilities

- Add Result model: persistent storage of out_envelope by UUID
- Add ExportJob model: async job tracking with status lifecycle
- Create PostgreSQL migration with indexes for performance
- Implement resultDb.js utilities: saveResult, getResultById, createExportJob, etc.
- All functions include validation and error handling
- Database verified: UP, Prisma OK, Schema VALID"
```

---

## **Next Steps (Phase 2)**

Phase 2 will integrate `resultDb` with `genieService` to:

1. Modify `genieService.process()` to persist result automatically
2. Return `{ resultId, out_envelope }` in response
3. Test: `POST /prompt` persists to results table

---

## **Success Criteria Met**

- [x] Result table created with UUID and JSONB envelope
- [x] ExportJob table created with status tracking
- [x] Foreign key relationship established (ExportJob → Result)
- [x] Indexes created for query performance
- [x] PostgreSQL migration applied successfully
- [x] Prisma Client generated (v6.18.0)
- [x] Database utility functions implemented
- [x] Error handling and validation in place
- [x] Schema verified via `db-health.sh`

---

**Status**: ✅ Phase 1 Complete  
**Next**: Proceed to Phase 2 (Result Persistence in genieService)
