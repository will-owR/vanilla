/**
 * Mock API for Phase 1+2 Development
 * Provides mock responses for all 3 endpoints
 * Can be toggled on/off for testing
 */

import { CONFIG } from "./api-v2.js";

/**
 * Global toggle for mock API
 * Set to false to use real API
 */
let ENABLE_MOCK_API = true;

/**
 * Configurable delay (ms) to simulate network latency
 */
let MOCK_DELAY_MS = 500;

/**
 * Error injection config - can inject errors based on prompt content
 */
let ERROR_INJECTION_CONFIG = {};

/**
 * Generate a UUID v4
 */
function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Check if error injection should occur
 */
function shouldInjectError(prompt) {
  // Example: if prompt contains "error", inject server error
  if (prompt.toLowerCase().includes("[error]")) {
    return { status: 500, message: "Mock server error", retryable: true };
  }
  if (prompt.toLowerCase().includes("[timeout]")) {
    return { status: 408, message: "Mock request timeout", retryable: true };
  }
  if (prompt.toLowerCase().includes("[validation]")) {
    return { status: 422, message: "Mock validation error", retryable: false };
  }
  return null;
}

/**
 * Simulate delay
 */
async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mock classify endpoint
 */
export async function mockClassify(prompt, selectedMedium) {
  // Check for error injection
  const injectedError = shouldInjectError(prompt);
  if (injectedError) {
    throw injectedError;
  }

  // Simulate network delay
  await delay(MOCK_DELAY_MS);

  // Generate realistic response
  const confidence =
    Math.random() > 0.3 ? 0.8 + Math.random() * 0.2 : 0.5 + Math.random() * 0.3;
  const sources = ["rules", "ai", "hybrid"];
  const styles = CONFIG.SUPPORTED_STYLES;
  const themes = [
    "summer",
    "winter",
    "spring",
    "autumn",
    "nature",
    "technology",
    "abstract",
  ];
  const audiences = ["children", "teens", "adults", "seniors"];
  const genres = [
    "fiction",
    "non-fiction",
    "poetry",
    "technical",
    "educational",
  ];
  const tones = [
    "professional",
    "casual",
    "uplifting",
    "dramatic",
    "humorous",
    "serious",
  ];

  return {
    id: `class-${generateUUID()}`,
    medium: selectedMedium,
    confidence: Math.round(confidence * 100) / 100,
    style: styles[Math.floor(Math.random() * styles.length)],
    themes: [
      themes[Math.floor(Math.random() * themes.length)],
      themes[Math.floor(Math.random() * themes.length)],
    ],
    audience: audiences[Math.floor(Math.random() * audiences.length)],
    genre: genres[Math.floor(Math.random() * genres.length)],
    tone: tones[Math.floor(Math.random() * tones.length)],
    source: sources[Math.floor(Math.random() * sources.length)],
    metadata: {
      model: "mock-gemini-1.5",
      timestamp: new Date().toISOString(),
      mockData: true,
    },
  };
}

/**
 * Mock generate endpoint
 */
export async function mockGenerate(prompt, medium, classification) {
  // Check for error injection
  const injectedError = shouldInjectError(prompt);
  if (injectedError) {
    throw injectedError;
  }

  // Simulate longer network delay for generation
  await delay(MOCK_DELAY_MS * 3);

  return {
    id: `gen-${generateUUID()}`,
    pdfUrl: `/tmp-exports/generated-${generateUUID()}.pdf`,
    pageCount: Math.floor(Math.random() * 40) + 10,
    medium,
    style: classification.style,
    classification,
    metadata: {
      imageCount: Math.floor(Math.random() * 20) + 5,
      textLength: Math.floor(Math.random() * 5000) + 1000,
      generatedAt: new Date().toISOString(),
      mockData: true,
    },
    latency: Math.floor(Math.random() * 10000) + 5000,
    costEstimate: Math.round(Math.random() * 200 + 50) / 100,
  };
}

/**
 * Mock applyOverride endpoint
 */
export async function mockApplyOverride(
  generationId,
  classification,
  overrides
) {
  // Check for error injection
  if (overrides.style && overrides.style.toLowerCase().includes("invalid")) {
    throw {
      status: 422,
      message: "Invalid style selection",
      retryable: false,
    };
  }

  // Simulate network delay (shorter than generate)
  await delay(MOCK_DELAY_MS * 2);

  // Calculate cost multiplier based on overrides
  let costMultiplier = 1.0;
  if (overrides.style && overrides.style !== classification.style) {
    costMultiplier += 0.4;
  }
  if (overrides.tone && overrides.tone !== classification.tone) {
    costMultiplier += 0.3;
  }
  if (overrides.themes) {
    costMultiplier += 0.2;
  }

  return {
    id: `override-${generateUUID()}`,
    pdfUrl: `/tmp-exports/override-${generateUUID()}.pdf`,
    costMultiplier: Math.round(costMultiplier * 100) / 100,
    costBreakdown: {
      base: 1.0,
      style: overrides.style ? 0.4 : 0,
      tone: overrides.tone ? 0.3 : 0,
      themes: overrides.themes ? 0.2 : 0,
    },
    regenerationStrategy: "incremental",
    metadata: {
      originalId: generationId,
      appliedOverrides: Object.keys(overrides),
      regeneratedAt: new Date().toISOString(),
      mockData: true,
    },
  };
}

/**
 * Wrapper to use mock API or real API based on toggle
 */
export async function classifyWithFallback(prompt, selectedMedium) {
  if (ENABLE_MOCK_API) {
    return await mockClassify(prompt, selectedMedium);
  }
  const { classify } = await import("./api-v2.js");
  return await classify(prompt, selectedMedium);
}

/**
 * Wrapper to use mock API or real API based on toggle
 */
export async function generateWithFallback(prompt, medium, classification) {
  if (ENABLE_MOCK_API) {
    return await mockGenerate(prompt, medium, classification);
  }
  const { generate } = await import("./api-v2.js");
  return await generate(prompt, medium, classification);
}

/**
 * Wrapper to use mock API or real API based on toggle
 */
export async function applyOverrideWithFallback(
  generationId,
  classification,
  overrides
) {
  if (ENABLE_MOCK_API) {
    return await mockApplyOverride(generationId, classification, overrides);
  }
  const { applyOverride } = await import("./api-v2.js");
  return await applyOverride(generationId, classification, overrides);
}

/**
 * Enable or disable mock API
 */
export function setMockAPIEnabled(enabled) {
  ENABLE_MOCK_API = enabled;
}

/**
 * Set mock delay
 */
export function setMockDelay(ms) {
  MOCK_DELAY_MS = ms;
}

/**
 * Set error injection config
 */
export function setErrorInjection(config) {
  ERROR_INJECTION_CONFIG = config;
}

/**
 * Get current mock API status
 */
export function getMockAPIStatus() {
  return {
    enabled: ENABLE_MOCK_API,
    delayMs: MOCK_DELAY_MS,
    errorInjection: ERROR_INJECTION_CONFIG,
  };
}

export default {
  mockClassify,
  mockGenerate,
  mockApplyOverride,
  classifyWithFallback,
  generateWithFallback,
  applyOverrideWithFallback,
  setMockAPIEnabled,
  setMockDelay,
  setErrorInjection,
  getMockAPIStatus,
};
