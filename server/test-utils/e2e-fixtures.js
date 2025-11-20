/**
 * E2E Test Fixtures and Utilities
 * Provides realistic test data for end-to-end testing
 */

/**
 * Sample prompts for different media types
 */
export const SAMPLE_PROMPTS = {
  ebook: [
    "Create a poetry collection about summer memories and childhood wonder",
    "Generate an ebook guide to meditation and mindfulness for beginners",
    "Write a short story collection with gothic themes and mysterious atmosphere",
  ],
  calendar: [
    "Design a 2025 calendar with nature photography and inspirational quotes",
    "Create a family calendar with holidays and vacation planning dates",
  ],
  poster: [
    "Design a minimalist poster for a technology conference",
    "Create a vibrant poster promoting environmental sustainability",
  ],
  stickers: ["Create cute sticker pack for journaling and decoration"],
  card: ["Design a greeting card for a wedding invitation"],
};

/**
 * Sample classifications matching Phase A-B model
 */
export const SAMPLE_CLASSIFICATIONS = {
  ebook_poetry: {
    id: "class-ebook-poetry-001",
    medium: "ebook",
    confidence: 0.95,
    style: "minimalist",
    themes: ["nature", "reflection"],
    audience: "adults",
    genre: "poetry",
    tone: "reflective",
    source: "rules",
    metadata: {
      model: "gemini-pro",
      timestamp: new Date().toISOString(),
    },
  },
  ebook_guide: {
    id: "class-ebook-guide-001",
    medium: "ebook",
    confidence: 0.88,
    style: "modern",
    themes: ["wellness", "education"],
    audience: "general",
    genre: "technical",
    tone: "professional",
    source: "ai",
    metadata: {
      model: "gemini-pro",
      timestamp: new Date().toISOString(),
    },
  },
  poster_tech: {
    id: "class-poster-tech-001",
    medium: "poster",
    confidence: 0.92,
    style: "abstract",
    themes: ["technology", "innovation"],
    audience: "professionals",
    genre: "promotional",
    tone: "professional",
    source: "hybrid",
    metadata: {
      model: "gemini-pro",
      timestamp: new Date().toISOString(),
    },
  },
};

/**
 * Sample override configurations
 */
export const SAMPLE_OVERRIDES = {
  style_only: {
    style: "gothic",
    // tone and themes unchanged
  },
  tone_only: {
    tone: "dramatic",
    // style unchanged
  },
  themes_only: {
    themes: ["darkness", "mystery"],
    // style and tone unchanged
  },
  combined: {
    style: "retro",
    tone: "humorous",
    themes: ["vintage", "fun"],
  },
};

/**
 * Create a test scenario: classify -> generate -> override
 * @param {Object} options - Configuration
 * @returns {Object} Test scenario with classification, generation, and override data
 */
export function createTestScenario(options = {}) {
  const {
    medium = "ebook",
    classification = SAMPLE_CLASSIFICATIONS.ebook_poetry,
    prompt = SAMPLE_PROMPTS.ebook[0],
    overrides = SAMPLE_OVERRIDES.style_only,
  } = options;

  return {
    classification,
    generation: {
      prompt,
      medium,
      classification,
    },
    override: {
      generationId: `gen-${Date.now()}`,
      classification,
      overrides,
    },
  };
}

/**
 * Generate synthetic classification object
 */
export function generateClassification(overrides = {}) {
  const defaultClassification = SAMPLE_CLASSIFICATIONS.ebook_poetry;
  return {
    ...defaultClassification,
    id: `class-${Date.now()}`,
    ...overrides,
  };
}

/**
 * Validate response schema
 */
export function validateGenerateResponse(response) {
  const requiredFields = [
    "id",
    "pdfUrl",
    "pageCount",
    "medium",
    "style",
    "classification",
    "latency",
    "costEstimate",
    "metadata",
  ];

  const missingFields = requiredFields.filter((field) => !(field in response));

  if (missingFields.length > 0) {
    throw new Error(
      `Missing fields in generate response: ${missingFields.join(", ")}`
    );
  }

  if (typeof response.latency !== "number" || response.latency < 0) {
    throw new Error("Invalid latency in response");
  }

  if (
    typeof response.costEstimate !== "number" ||
    response.costEstimate < 1.0
  ) {
    throw new Error("Invalid costEstimate in response");
  }

  return true;
}

/**
 * Validate override response schema
 */
export function validateOverrideResponse(response) {
  const requiredFields = [
    "id",
    "pdfUrl",
    "costMultiplier",
    "costBreakdown",
    "regenerationStrategy",
    "metadata",
  ];

  const missingFields = requiredFields.filter((field) => !(field in response));

  if (missingFields.length > 0) {
    throw new Error(
      `Missing fields in override response: ${missingFields.join(", ")}`
    );
  }

  if (
    typeof response.costMultiplier !== "number" ||
    response.costMultiplier < 1.0
  ) {
    throw new Error("Invalid costMultiplier in response");
  }

  const validStrategies = ["css-only", "incremental", "full"];
  if (!validStrategies.includes(response.regenerationStrategy)) {
    throw new Error(
      `Invalid regenerationStrategy: ${response.regenerationStrategy}`
    );
  }

  return true;
}

/**
 * Simulate network delay for testing timeout behavior
 */
export async function simulateNetworkDelay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Test data error scenarios
 */
export const ERROR_SCENARIOS = {
  timeout: {
    status: 408,
    message: "Request timeout",
    retryable: true,
  },
  validationError: {
    status: 422,
    message: "Invalid classification data",
    retryable: false,
  },
  notFound: {
    status: 404,
    message: "Generation not found",
    retryable: false,
  },
  serverError: {
    status: 500,
    message: "Internal server error",
    retryable: true,
  },
  badRequest: {
    status: 400,
    message: "Invalid request",
    retryable: false,
  },
};

export default {
  SAMPLE_PROMPTS,
  SAMPLE_CLASSIFICATIONS,
  SAMPLE_OVERRIDES,
  createTestScenario,
  generateClassification,
  validateGenerateResponse,
  validateOverrideResponse,
  simulateNetworkDelay,
  ERROR_SCENARIOS,
};
