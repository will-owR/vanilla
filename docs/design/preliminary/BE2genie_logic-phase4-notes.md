BE2genie Phase 4 Notes

This file captures quick notes for the Phase 4 implementation (DB dedupe + upsert).

Steps to follow:

1. Edit `server/prisma/schema.prisma` to add:

```prisma
  normalizedText String?
  normalizedHash String? @unique
```

2. Run `npx prisma generate` and `npx prisma migrate dev --name add-normalized-hash`.

3. Implement upsert in `server/utils/dbUtils.js`:

```js
// compute normalizedHash via normalizePrompt + SHA256
await prisma.prompt.upsert({
  where: { normalizedHash },
  create: { prompt: original, normalizedText: norm, normalizedHash },
  update: {},
});
```

4. Add tests that mock Prisma using `dbUtils._setPrisma()`.

5. Run migration in staging and validate no records exist (DB starts empty).

Notes:

- Since the database is empty, dedupe is not required prior to migration, but keep `server/scripts/dedupe_prompts.js` in case needed later.
- Keep `GENIE_PERSISTENCE_ENABLED` OFF until fully validated in staging.
