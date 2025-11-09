// Lazy-init Prisma client so importing this file in test/dev does not
// immediately open a connection unless used. We require `@prisma/client`
// inside the getter so test frameworks (Vitest) can mock the module before
// this file attempts to instantiate the client.
let prisma = null;
const crypto = require("crypto");
const normalizePrompt = require("../utils/normalizePrompt");
function getPrisma() {
  if (prisma) return prisma;

  let PrismaClient;
  try {
    // This will be intercepted by Vitest's module mocking when tests run.
    // In normal runtime it returns the generated PrismaClient class.
    PrismaClient = require("@prisma/client").PrismaClient;
  } catch (e) {
    // Provide a clearer error if the client isn't available (devs must run
    // `prisma generate` when using real DB in local/dev).
    throw new Error(
      '@prisma/client did not initialize yet. Please run "prisma generate" and try to import it again.'
    );
  }

  prisma = new PrismaClient();
  return prisma;
}

/**
 * Create a prompt record.
 * @param {string} promptText
 * @returns {Promise<{id:number}>}
 */
async function createPrompt(promptText) {
  const p = getPrisma();
  // Compute a normalized form and a stable hash to use as a unique key.
  const norm = normalizePrompt(promptText || "");
  const hash = crypto.createHash("sha256").update(norm).digest("hex");

  // Use upsert to atomically create or return existing record for this prompt.
  let rec;
  if (p && p.prompt && typeof p.prompt.upsert === "function") {
    rec = await p.prompt.upsert({
      where: { normalizedHash: hash },
      update: {},
      create: {
        prompt: promptText,
        normalizedText: norm,
        normalizedHash: hash,
      },
    });
  } else {
    // Fallback for mocked Prisma clients used in unit tests.
    // Use create and return the inserted id. If create fails due to a
    // uniqueness conflict in a real DB, callers should observe the error
    // and handle retries or dedupe at a higher layer. In tests, mocks
    // typically implement `create` and return the created record shape.
    const created = await p.prompt.create({
      data: { prompt: promptText, normalizedText: norm, normalizedHash: hash },
    });
    rec = created;
  }

  return { id: rec.id };
}

/**
 * Create an AI result linked to a prompt
 * @param {number} promptId
 * @param {any} resultObj
 * @returns {Promise<{id:number}>}
 */
async function createAIResult(promptId, resultObj) {
  const p = getPrisma();
  const rec = await p.aIResult.create({
    data: { promptId, result: resultObj },
  });
  return { id: rec.id };
}

/**
 * Get AI result by id
 * @param {number} id
 */
async function getAIResultById(id) {
  const p = getPrisma();
  const row = await p.aIResult.findUnique({ where: { id } });
  return row || null;
}

/**
 * Get recent prompts
 */
async function getPrompts(limit = 50) {
  const p = getPrisma();
  const rows = await p.prompt.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
  });
  return rows;
}

module.exports = {
  createPrompt,
  createAIResult,
  getAIResultById,
  getPrompts,
  // Expose Prisma for tests/advanced usage
  _getPrisma: getPrisma,
  // Test helpers: allow injecting a mock Prisma instance and clearing it
  _setPrisma(prismaInstance) {
    prisma = prismaInstance;
  },
  _resetPrisma() {
    if (prisma && typeof prisma.$disconnect === "function") {
      try {
        prisma.$disconnect();
      } catch (e) {
        // ignore
      }
    }
    prisma = null;
  },
};
