import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { createRequire } from "module";

describe("genieService.getPersistedContent", () => {
  let genieService;
  beforeEach(() => {
    vi.resetModules();
    genieService = null;
  });

  it("returns content when resultId lookup succeeds (legacy/mock)", async () => {
    const mockDb = {
      getAIResultById: vi.fn(async (id) => ({
        id: Number(id),
        promptId: 10,
        result: JSON.stringify({
          content: { title: "RTitle", body: "RBody" },
          metadata: { m: 1 },
        }),
      })),
    };

    const require = createRequire(import.meta.url);
    genieService = require("../genieService.js");
    genieService._setDbUtils(mockDb);

    const res = await genieService.getPersistedContent({ resultId: "123" });
    expect(res).toBeTruthy();
    expect(res.content.title).toBe("RTitle");
    expect(res.content.body).toBe("RBody");
    expect(res.metadata && res.metadata.m).toBe(1);
    expect(res.promptId).toBe(10);
    expect(res.resultId).toBe(123);

    genieService._resetDbUtils();
  });

  it("returns latest content when promptId lookup uses prisma shim", async () => {
    const mockPrisma = {
      aIResult: {
        findMany: vi.fn(async (opts) => [
          {
            id: 1,
            result: JSON.stringify({ content: { title: "Old", body: "old" } }),
          },
          {
            id: 5,
            result: JSON.stringify({
              content: { title: "Latest", body: "latest" },
              metadata: { ver: 5 },
            }),
          },
        ]),
      },
    };

    const mockDbUtils = {
      _getPrisma: () => mockPrisma,
    };

    const require = createRequire(import.meta.url);
    genieService = require("../genieService.js");
    genieService._setDbUtils(mockDbUtils);

    const res = await genieService.getPersistedContent({ promptId: "42" });
    expect(res).toBeTruthy();
    expect(res.content.title).toBe("Latest");
    expect(res.metadata && res.metadata.ver).toBe(5);
    expect(res.promptId).toBe(42);
    expect(res.resultId).toBe(5);

    genieService._resetDbUtils();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });
});
