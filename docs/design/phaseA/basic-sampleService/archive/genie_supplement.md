# Genie Service Architecture Supplement: Persistence Layer Optimization
(THU 03th Oct 2025 9:00AM)

## Current vs Target Architecture

### Current Implementation

```ascii
Client Request
     ↓
GenieService ──────┐
     ↓            │
Prisma DB         │
     ↓            │
Legacy SQLite     │
     ↓            │
sampleService ────┘
```

### Target Implementation

```ascii
                                    ┌──────────────────┐
                                    │  Client Request  │
                                    └────────┬─────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        GenieService                             │
│                                                                 │
│    ┌─────────────┐      ┌──────────────┐     ┌──────────────┐   │
│    │  In-Memory  │────▶│  Prisma DB   │────▶│ sampleService│   │
│    │    Cache    │      │              │     │              │   │
│    └─────┬───────┘      └──────┬───────┘     └──────┬───────┘   │
│          │                     │                    │           │
│          └─────────────────────┴────────────────────┘           │
│                          ▲                                      │
│                          │                                      │
│                    Cache Update                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Optimization Strategy

### 1. Cache-First Architecture

- **In-Memory Cache Layer**

  - First point of lookup for all requests
  - Cache key: Normalized prompt hash
  - Cache value: Complete response object
  - TTL-based invalidation strategy

- **Cache Implementation**

  ```typescript
  interface CacheEntry {
    content: ContentObject;
    metadata: MetadataObject;
    timestamp: number;
    ttl: number;
  }

  interface CacheStrategy {
    get(key: string): CacheEntry | null;
    set(key: string, value: CacheEntry): void;
    invalidate(key: string): void;
  }
  ```

### 2. Persistence Layer

- **Prisma DB**
  - Secondary lookup point
  - Stores historical responses
  - Handles deduplication
  - Maintains data consistency

### 3. Service Layer

- **Sample Service**
  - Final fallback for cache/DB misses
  - Generates new content
  - Results cached and persisted

## Request Flow

1. **Initial Request**

   ```ascii
   1. Check Cache ──▶ Cache Miss
        │
        ▼
   2. Check DB ────▶ DB Miss
        │
        ▼
   3. Call Service
        │
        ▼
   4. Cache & Persist
   ```

2. **Subsequent Requests**
   ```ascii
   1. Check Cache ──▶ Cache Hit
        │
        ▼
   2. Return Response
   ```

## Implementation Guidelines

### Cache Management

```javascript
class GenieCache {
  constructor(ttlMs = 3600000) {
    // 1 hour default TTL
    this.cache = new Map();
    this.ttl = ttlMs;
  }

  get(normalizedPrompt) {
    const entry = this.cache.get(normalizedPrompt);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(normalizedPrompt);
      return null;
    }

    return entry.content;
  }

  set(normalizedPrompt, content) {
    this.cache.set(normalizedPrompt, {
      content,
      timestamp: Date.now(),
    });
  }
}
```

### GenieService Flow

```javascript
async function generate(prompt) {
  const normalized = normalizePrompt(prompt);

  // 1. Check Cache
  const cached = cache.get(normalized);
  if (cached) return cached;

  // 2. Check DB
  const persisted = await prisma.findByNormalizedPrompt(normalized);
  if (persisted) {
    cache.set(normalized, persisted);
    return persisted;
  }

  // 3. Generate New Content
  const result = await sampleService.generateFromPrompt(prompt);

  // 4. Cache & Persist
  cache.set(normalized, result);
  await prisma.persist(normalized, result);

  return result;
}
```

## Benefits

1. **Performance**

   - Reduced latency for repeated requests
   - Minimized database queries
   - Efficient resource utilization

2. **Reliability**

   - Graceful degradation
   - Reduced service load
   - Consistent response times

3. **Scalability**
   - Horizontal cache scaling possible
   - Reduced backend service pressure
   - Better resource management

## Next Steps

1. **Implementation Priority**

   - [ ] Add in-memory cache layer
   - [ ] Update service flow
   - [ ] Remove legacy SQLite dependency
   - [ ] Add cache metrics/monitoring

2. **Testing Requirements**

   - Cache hit/miss scenarios
   - TTL expiration behavior
   - Concurrent request handling
   - Cache invalidation cases

3. **Monitoring Additions**
   - Cache hit ratio
   - Response time per layer
   - Cache memory usage
   - Cache eviction rates

---

_Last updated: October 30, 2025_
