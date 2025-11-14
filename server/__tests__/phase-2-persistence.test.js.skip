/**
 * Phase 2 Integration Tests: Result Persistence
 *
 * Tests verify that:
 * 1. genieService.process() generates a unique resultId for each call
 * 2. Results are persisted to PostgreSQL via resultDb.saveResult()
 * 3. HTTP response includes resultId in the envelope
 * 4. Persistence failures do not block generation
 */

const { describe, it, expect, beforeAll, afterAll } = require("@jest/globals");
const genieService = require("../genieService");
const resultDb = require("../utils/resultDb");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

describe("Phase 2: Result Persistence Integration", () => {
  let testResultId;

  beforeAll(async () => {
    // Ensure database is ready
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log("Database connected for Phase 2 tests");
    } catch (error) {
      console.error("Database connection failed:", error.message);
      throw error;
    }
  });

  afterAll(async () => {
    // Cleanup: Remove test results
    if (testResultId) {
      try {
        await prisma.result.deleteMany({
          where: { resultId: testResultId },
        });
        console.log(`Cleaned up test result: ${testResultId}`);
      } catch (error) {
        console.warn("Cleanup warning:", error.message);
      }
    }
    await prisma.$disconnect();
  });

  describe("genieService.process()", () => {
    it("should generate a valid UUID resultId", async () => {
      const payload = {
        mode: "basic",
        prompt: "Test prompt for Phase 2 - UUID generation",
      };

      const response = await genieService.process(payload);

      // Verify resultId exists and is UUID format
      expect(response).toHaveProperty("resultId");
      expect(typeof response.resultId).toBe("string");
      // UUID v4 format: 550e8400-e29b-41d4-a716-446655440000
      expect(response.resultId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );

      testResultId = response.resultId;
    });

    it("should return envelope with out_envelope structure", async () => {
      const payload = {
        mode: "basic",
        prompt: "Test prompt for Phase 2 - envelope structure",
      };

      const response = await genieService.process(payload);

      expect(response).toHaveProperty("out_envelope");
      expect(response.out_envelope).toHaveProperty("pages");
      expect(response.out_envelope).toHaveProperty("metadata");
      expect(response.out_envelope).toHaveProperty("actions");
    });

    it("should include metadata with generation timestamp", async () => {
      const payload = {
        mode: "basic",
        prompt: "Test prompt for Phase 2 - metadata",
      };

      const response = await genieService.process(payload);

      expect(response.out_envelope.metadata).toHaveProperty("generated_at");
      expect(response.out_envelope.metadata).toHaveProperty("mode");
      expect(response.out_envelope.metadata.mode).toBe("basic");

      // Verify timestamp is ISO 8601
      const timestamp = new Date(response.out_envelope.metadata.generated_at);
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).not.toBeNaN();
    });
  });

  describe("resultDb.saveResult()", () => {
    it("should persist result to PostgreSQL", async () => {
      const payload = {
        mode: "basic",
        prompt: "Test prompt for Phase 2 - persistence",
      };

      const response = await genieService.process(payload);
      const resultId = response.resultId;

      // Verify result can be retrieved from database
      const persisted = await resultDb.getResultById(resultId);

      expect(persisted).toBeDefined();
      expect(persisted.resultId).toBe(resultId);
      expect(persisted.mode).toBe("basic");
      expect(persisted.outEnvelope).toBeDefined();
    });

    it("should store canonical out_envelope", async () => {
      const payload = {
        mode: "basic",
        prompt: "Test prompt for Phase 2 - canonical envelope",
      };

      const response = await genieService.process(payload);
      const resultId = response.resultId;

      const persisted = await resultDb.getResultById(resultId);

      // Verify stored envelope matches response envelope
      expect(persisted.outEnvelope).toEqual(response.out_envelope);
      expect(persisted.outEnvelope.pages).toBeDefined();
      expect(persisted.outEnvelope.metadata).toBeDefined();
    });

    it("should handle different generation modes", async () => {
      const modes = ["basic", "demo"];

      for (const mode of modes) {
        const payload = {
          mode,
          prompt: `Test prompt for Phase 2 - mode ${mode}`,
        };

        const response = await genieService.process(payload);
        const persisted = await resultDb.getResultById(response.resultId);

        expect(persisted.mode).toBe(mode);

        // Cleanup
        try {
          await prisma.result.delete({
            where: { resultId: response.resultId },
          });
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    });
  });

  describe("Persistence Resilience", () => {
    it("should still return resultId even if database write fails", async () => {
      // This test mocks resultDb.saveResult to throw an error
      const originalSave = resultDb.saveResult;
      let callCount = 0;

      resultDb.saveResult = jest
        .fn()
        .mockRejectedValueOnce(new Error("Database temporarily unavailable"));

      try {
        const payload = {
          mode: "basic",
          prompt: "Test prompt for Phase 2 - persistence failure",
        };

        // Generation should still succeed
        const response = await genieService.process(payload);

        // Response should include resultId (best-effort)
        expect(response).toHaveProperty("resultId");
        expect(response.resultId).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        );

        // Verify saveResult was called
        expect(resultDb.saveResult).toHaveBeenCalled();
      } finally {
        // Restore original function
        resultDb.saveResult = originalSave;
      }
    });

    it("should generate unique resultIds for sequential calls", async () => {
      const resultIds = new Set();

      for (let i = 0; i < 5; i++) {
        const payload = {
          mode: "basic",
          prompt: `Test prompt ${i} for Phase 2 - uniqueness`,
        };

        const response = await genieService.process(payload);
        resultIds.add(response.resultId);

        // Cleanup
        try {
          await prisma.result.delete({
            where: { resultId: response.resultId },
          });
        } catch (e) {
          // Ignore cleanup errors
        }
      }

      // All UUIDs should be unique
      expect(resultIds.size).toBe(5);
    });
  });

  describe("Database Schema Validation", () => {
    it("should have required columns in results table", async () => {
      const schema = await prisma.$queryRaw`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'results'
        ORDER BY column_name;
      `;

      const columnNames = schema.map((row) => row.column_name);

      expect(columnNames).toContain("resultId");
      expect(columnNames).toContain("out_envelope");
      expect(columnNames).toContain("mode");
      expect(columnNames).toContain("createdAt");
    });

    it("should enforce unique constraint on resultId", async () => {
      // Create a test result
      const payload = {
        mode: "basic",
        prompt: "Test prompt for Phase 2 - uniqueness constraint",
      };

      const response = await genieService.process(payload);
      const resultId = response.resultId;

      // Attempt to create a duplicate (should fail)
      const duplicatePayload = {
        mode: "basic",
        prompt: "Different prompt but same resultId",
      };

      // Mock saveResult to use the same resultId
      const originalSave = resultDb.saveResult;
      resultDb.saveResult = jest.fn(async (rid, envelope, mode) => {
        // Force using the same resultId from first result
        return await prisma.result.create({
          data: {
            resultId: resultId, // Intentional duplicate
            outEnvelope: envelope,
            mode,
          },
        });
      });

      try {
        // This should throw a unique constraint error
        await expect(genieService.process(duplicatePayload)).rejects.toThrow();
      } finally {
        resultDb.saveResult = originalSave;

        // Cleanup
        try {
          await prisma.result.delete({
            where: { resultId },
          });
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    });
  });

  describe("End-to-End Phase 2 Workflow", () => {
    it("should complete full flow: generate → persist → retrieve", async () => {
      // Step 1: Generate result
      const payload = {
        mode: "basic",
        prompt: "Test prompt for Phase 2 - E2E workflow",
      };

      const generateResponse = await genieService.process(payload);
      const resultId = generateResponse.resultId;

      expect(generateResponse).toHaveProperty("resultId");
      expect(generateResponse).toHaveProperty("out_envelope");

      // Step 2: Verify persistence
      const persisted = await resultDb.getResultById(resultId);

      expect(persisted).toBeDefined();
      expect(persisted.resultId).toBe(resultId);

      // Step 3: Verify envelope matches
      expect(persisted.outEnvelope).toEqual(generateResponse.out_envelope);

      // Cleanup
      try {
        await prisma.result.delete({
          where: { resultId },
        });
      } catch (e) {
        // Ignore cleanup errors
      }
    });
  });
});
