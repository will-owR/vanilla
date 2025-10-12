# Overview: Incremental Rewrite

Document Version: dv00
Datetime: 2025-09-30 9:45 UTC
Branch: feature/anew

Keep the old frontend running.

Create a new frontend app in parallel (e.g., **client-v2/**).

Gradually migrate features/pages until the old one can be retired.

**Pros:** Less downtime, smoother transition.

**Cons:** Temporary duplication of effort; requires careful routing and deployment strategy.


## 🔄 Incremental Rewrite Plan

**Phase 1:** Setup the New Frontend

- Create a new folder alongside the old one, e.g. client-v2/.

- Initialize framework (Vite/Svelte).

- Configure build tooling, linting, and package manager (npm).

- Wire up basic API connectivity to your server/.


**Phase 2:** Shared Code Integration

- Decide how to consume **shared/**:

  - Direct import (if monorepo-style with relative paths).

  - Package-style (publish shared/ as a local npm package).

- Ensure typings/interfaces are consistent across old and new clients.


**Phase 3:** Parallel Development

- Keep **client/** running for production.

- Develop **client-v2/** in parallel.

- Start with core routes/pages (login, dashboard, etc.).

- Use feature flags or routing rules to selectively expose new pages.


**Phase 4:** Gradual Migration

- Migrate one feature/page at a time:

  - Build it in client-v2/.

  - Redirect traffic (or specific users) to the new version.

- Validate against backend APIs and shared logic.

- Keep old client/ as fallback until confidence is high.


**Phase 5:** Cutover

- Once all critical features are migrated:

  - Switch default routing to client-v2/.

  - Archive or delete the old client/.

- Update CI/CD pipelines to deploy only the new frontend.


**Phase 6:** Cleanup & Optimization

- Remove legacy dependencies.

- Consolidate shared code usage.

- Optimize build times, bundle size, and caching.


## ⚖️ Trade-offs for `Incremental Rewrite`

**✅ Pros:** No downtime, safer migration, ability to test new stack incrementally.

**⚠️ Cons:** Temporary duplication of effort, slightly more complex deployment until cutover.