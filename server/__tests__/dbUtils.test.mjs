import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Dynamic import and injectable Prisma mock so tests don't require prisma generate
function createMockPrisma() {
  return {
    prompt: {
      create: vi.fn(async ({ data }) => ({ id: 123, ...data })),
      findMany: vi.fn(async () => [
        { id: 1, prompt: "hi", createdAt: new Date() },
      ]),
    },
    aIResult: {
      create: vi.fn(async ({ data }) => ({ id: 456, ...data })),
      findUnique: vi.fn(async ({ where }) =>
        where.id === 456 ? { id: 456, promptId: 123, result: {} } : null
      ),
    },
    $disconnect: vi.fn(async () => {}),
  };
}

describe("dbUtils (Prisma wrappers)", () => {
  let dbUtils;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../utils/dbUtils.js");
    dbUtils = mod.default ?? mod;
    const mockPrisma = createMockPrisma();
    if (typeof dbUtils._setPrisma === "function")
      dbUtils._setPrisma(mockPrisma);
  });

  afterEach(() => {
    if (typeof dbUtils._resetPrisma === "function") dbUtils._resetPrisma();
  });

  it("createPrompt returns id", async () => {
    const res = await dbUtils.createPrompt("hello world");
    expect(res).toHaveProperty("id");
    expect(res.id).toBe(123);
  });

  it("createAIResult returns id", async () => {
    const res = await dbUtils.createAIResult(123, { foo: "bar" });
    expect(res).toHaveProperty("id");
    expect(res.id).toBe(456);
  });

  it("getAIResultById returns row or null", async () => {
    const row = await dbUtils.getAIResultById(456);
    expect(row).not.toBeNull();
    expect(row.id).toBe(456);
    const nullRow = await dbUtils.getAIResultById(9999);
    expect(nullRow).toBeNull();
  });

  it("getPrompts returns array", async () => {
    const rows = await dbUtils.getPrompts(10);
    expect(Array.isArray(rows)).toBe(true);
    expect(rows[0]).toHaveProperty("prompt");
  });
});
