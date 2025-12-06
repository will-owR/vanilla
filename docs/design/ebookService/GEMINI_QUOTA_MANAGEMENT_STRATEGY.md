# Gemini API Quota Management Strategy

**Date**: December 6, 2025  
**Branch**: `feat/revert`  
**Audience**: Decision makers, architects, product leads  
**Status**: Proposed (Ready for Implementation Phase)

---

## Executive Summary

AetherPress uses Google's Gemini API to generate educational ebooks dynamically. The free tier quota (20 requests/minute) creates a throughput bottleneck that manifests when multiple users request ebook generation sequentially.

This document outlines a pragmatic rate-limiting strategy that bridges the gap between immediate user needs and the planned batch optimization system (Phase 2-5), ensuring reliable service within current constraints while maintaining a clear upgrade path.

---

## Business Context

### Current Reality

- **Constraint**: Gemini free tier = 20 API calls/minute
- **Ebook cost**: 1 structure call + N chapter calls (9 calls for 20-page ebook)
- **User experience**: Multiple sequential generation requests fail with quota errors
- **Timeline**: Batch optimization (comprehensive solution) = 2-3 weeks away

### Strategic Decision

Implement **interim rate-limiting** that:

1. ✅ Stabilizes service immediately (within 2-3 days)
2. ✅ Provides predictable user experience
3. ✅ Requires minimal code changes
4. ✅ Doesn't block batch optimization implementation
5. ✅ Creates upgrade path for paid tier when needed

---

## Solution: Request Throttling with Smart Pause

### How It Works (User Perspective)

```
User A: Requests 20-page ebook generation
  ↓
Server accepts request (202 Accepted) immediately
  ↓
System tracks API quota: 9/20 calls used (50%)
  ↓
Generation proceeds in background → Completes in ~2 minutes
  ↓
User A: Downloads PDF ✅

User B: Requests 15-page ebook (within 60 seconds)
  ↓
Server accepts request (202 Accepted)
  ↓
System detects quota exhaustion imminent (18/20 calls used)
  ↓
Request queued with 65-second pause message
  ↓
User sees: "Quota cooldown in progress. Your request will start in ~30s"
  ↓
After pause expires, User B's request processes
  ↓
User B: Downloads PDF ✅
```

### Key Principles

| Principle                    | Rationale                                                     |
| ---------------------------- | ------------------------------------------------------------- |
| **Accept fast, queue smart** | Users get immediate feedback; no blocking HTTP requests       |
| **Transparent quotas**       | Frontend shows remaining quota; users understand wait reasons |
| **Exponential backoff**      | Respects Gemini's rate-limiting signals; avoids hammering     |
| **Request fairness**         | FIFO queue during cooldown; no favoritism                     |
| **Observability**            | Server logs quota state; easy to monitor in production        |

---

## Implementation Scope

### What Gets Built

**Core Components**:

1. **Quota tracker** - Real-time call counting, per-minute windows
2. **Job deferral logic** - Queue jobs during cooldown periods
3. **Backoff strategy** - Exponential delays when quota exhausted
4. **Status endpoint** - Frontend can display quota health

**Frontend Experience**:

- Show remaining quota (18/20 calls available)
- Display wait message if job queued (e.g., "Request queued. ~45s wait")
- Progress updates during generation

### What's Out of Scope (Batch Optimization - Phase 2+)

- Parallel chapter generation (currently sequential)
- Intelligent caching of common chapter templates
- Batch processing optimizations
- Cost reduction strategies

---

## Success Criteria

| Metric                    | Target                                  | Success                                 |
| ------------------------- | --------------------------------------- | --------------------------------------- |
| **Sequential generation** | 2+ ebooks in a row without quota errors | ✅ Works consistently                   |
| **User feedback**         | Clear messaging about quota state       | ✅ "Wait 60s" shown, not silent failure |
| **Server stability**      | No 500 errors during quota limit        | ✅ Graceful queue, no crashes           |
| **Implementation time**   | 2-3 days                                | ✅ Doesn't delay Phase 1 completion     |
| **Code complexity**       | <500 LOC added                          | ✅ Maintainable, testable               |

---

## Timeline & Phasing

### Phase 1b (Current)

- ✅ Polling model operational
- ✅ PDF export working
- ⏳ **Quota management** (this document) - Ready for implementation

### Phase 2 (Next Week)

- Batch optimization modules
- Parallel chapter generation
- Rate limit binding strategies

### Upgrade Path

**If free tier quota insufficient after Phase 1b**:

- Switch to Gemini paid tier (1500 req/min)
- No code changes needed; just swap API key
- Quota management becomes non-issue

---

## Risk Mitigation

| Risk                      | Likelihood | Impact              | Mitigation                                        |
| ------------------------- | ---------- | ------------------- | ------------------------------------------------- |
| Quota limit too tight     | High       | Service degradation | Implement deferral queue; monitor real usage      |
| Queue grows unmanaged     | Medium     | Memory exhaustion   | Set max queue size (e.g., 50 jobs); reject beyond |
| Users frustrated by waits | Medium     | Negative feedback   | Show transparent quota status; clear messaging    |
| Quota errors still occur  | Low        | Service interrupted | Implement exponential backoff; retry logic        |

---

## Architectural Fit

This solution aligns with AetherPress's design philosophy:

✅ **Polling model** - Jobs already run async; quota pause just defers job start  
✅ **Graceful degradation** - System remains responsive even under quota limits  
✅ **Observability** - Quota status exposed via API; easy monitoring  
✅ **Future-proof** - Batch optimization will inherit quota-aware infrastructure

---

## Recommendation

**Proceed with Option A (Counter-Based Throttle)** implementation:

**Estimated effort**: 2-3 days (2-3 developer hours/day)  
**Estimated LOC**: 300-500 lines  
**Risk level**: Low (isolated to API layer; doesn't touch core generation)  
**Blocking**: None (parallel with other work)

This bridges the gap to batch optimization while maintaining service quality and user trust.

---

## Questions for Leadership

1. **Budget**: Are we approved for Gemini paid tier if free tier proves insufficient?
2. **Timeline**: Can batch optimization (2-3 weeks) wait, or do we need quota urgently?
3. **Communication**: How should we message queue wait times to users?
4. **Monitoring**: Should we set up alerts for quota exhaustion?
