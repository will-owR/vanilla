# feat/ebook-legacy — Branch README

## Purpose

Isolate the **legacy sequential** ebook generation flow so we can iterate safely and independently. This branch preserves the legacy approach (sequential structure + chapter generation) and is intended for small, focused changes and experiments that do not affect other work.

Base branch: `fix/nat-cont-model-routing`
Status: Experimental / In progress
Owner: TBD

DO NOT MERGE TO `main` — This branch is intentionally isolated for exploration.

## Quick commands

# Run the legacy unit test locally (server package):

cd server
FORCE_MOCK_AI=1 npm test -- **tests**/ebookService.legacy.test.js

## Notes

- Keep commits small and focused (one logical change per PR/commit).
- Add tests for any behavior you change.
- Add instrumentation logs if you need timing insights (see `PIPELINE_SEPARATION_IMPLEMENTATION.md`).
- When a solution is ready for production consideration, create a separate review story (not a direct PR to `main`).

## Related docs

- `docs/current_design/PIPELINE_SEPARATION_IMPLEMENTATION.md` — Implementation plan and guidance for these feature branches.
