import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Tests focused on upsert behavior in dbUtils.createPrompt
describe("dbUtils upsert behavior", () => {
  let dbUtils;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../utils/dbUtils.js");
    dbUtils = mod.default ?? mod;
  });

  afterEach(() => {
    if (typeof dbUtils._resetPrisma === "function") dbUtils._resetPrisma();
  });

  it("uses prisma.upsert when available and returns id", async () => {
    const mockPrisma = {
      prompt: {
        upsert: vi.fn(async ({ where, update, create }) => {
          // return a record that includes the created values
          return {
            id: 999,
            prompt: create.prompt,
            normalizedHash: where.normalizedHash,
          };
        }),
      },
      $disconnect: vi.fn(async () => {}),
    };

    if (typeof dbUtils._setPrisma === "function")
      dbUtils._setPrisma(mockPrisma);

    const res = await dbUtils.createPrompt("  Test Prompt  ");
    expect(res).toHaveProperty("id");
    expect(res.id).toBe(999);
    expect(mockPrisma.prompt.upsert).toHaveBeenCalled();
  });

  it("generates identical normalizedHash for variations and passes same hash to upsert", async () => {
    const recorded = [];
    const mockPrisma = {
      prompt: {
        upsert: vi.fn(async ({ where, update, create }) => {
          recorded.push(where.normalizedHash);
          return {
            id: 1001,
            prompt: create.prompt,
            normalizedHash: where.normalizedHash,
          };
        }),
      },
      $disconnect: vi.fn(async () => {}),
    };

    if (typeof dbUtils._setPrisma === "function")
      dbUtils._setPrisma(mockPrisma);

    const a = await dbUtils.createPrompt("Hello   World\n\n");
    const b = await dbUtils.createPrompt(" Hello World ");

    expect(a.id).toBe(1001);
    expect(b.id).toBe(1001);
    expect(recorded.length).toBe(2);
    expect(recorded[0]).toBe(recorded[1]);
  });
});
