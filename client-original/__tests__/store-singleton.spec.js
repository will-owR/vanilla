import { expect, test, beforeEach } from "vitest";

// These tests assert the HMR-proof singleton behavior implemented in
// `client/src/stores/index.js`. Each test runs in a fresh worker so the
// module cache is clean for the file-level import.

beforeEach(() => {
  // Clean any pre-existing globals to keep tests hermetic.
  try {
    delete globalThis.__CHRONOS_STORES__;
    delete globalThis.__POEMAMUNDI_STORES__;
  } catch (e) {}
});

test("reuses pre-seeded canonical global container", async () => {
  // Pre-seed the canonical global container before importing the module.
  globalThis.__CHRONOS_STORES__ = { PRESEEDED: "yes" };

  const stores = await import("$lib/stores?update=" + Date.now());

  // Ensure the preseeded marker was preserved
  expect(globalThis.__CHRONOS_STORES__.PRESEEDED).toBe("yes");

  // The module should have exported a previewStore that is the same
  // reference as the one stored in the global container under "previewStore".
  expect(stores.previewStore).toBe(globalThis.__CHRONOS_STORES__.previewStore);
});

test("adopts legacy global container when canonical absent", async () => {
  // Pre-seed the legacy global container and ensure canonical is absent.
  delete globalThis.__CHRONOS_STORES__;
  globalThis.__POEMAMUNDI_STORES__ = { LEGACY: "ok" };

  const stores = await import("$lib/stores?update=" + Date.now());

  // The implementation should have created/adopted the canonical key
  // and wired it to the legacy container.
  expect(globalThis.__CHRONOS_STORES__).toBeDefined();
  expect(globalThis.__CHRONOS_STORES__.LEGACY).toBe("ok");

  // Exported store must be the same reference as placed into the container.
  expect(stores.contentStore).toBe(globalThis.__CHRONOS_STORES__.contentStore);
});
