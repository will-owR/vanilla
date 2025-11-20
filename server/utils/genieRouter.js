/**
 * GenieService Router - Module 7
 * Routes classified prompts to appropriate services (ebook, calendar, poster, etc.)
 * Orchestrates the complete pipeline: classification → routing → service generation
 */

const { RuleEngine } = require("./ruleEngine");
const { ClassificationValidator } = require("./classificationValidator");
const { LLMClassifier } = require("./llmClassifier");

/**
 * Service routing with intelligent classification fallback
 * Handles all 8 mediums with error handling and observability
 */
class GenieRouter {
  constructor(services = {}) {
    // Map of medium → service instance
    this.services = services;

    // Initialize classification pipeline
    this.ruleEngine = new RuleEngine();
    this.validator = new ClassificationValidator();
    this.llmClassifier = new LLMClassifier();

    // Valid mediums (8 types)
    this.validMediums = [
      "ebook",
      "calendar",
      "poster",
      "stickers",
      "greeting-card",
      "journal",
      "app-ui",
      "wall-art",
    ];

    // Metrics collection
    this.metrics = {
      totalRequests: 0,
      successfulRoutes: 0,
      failedRoutes: 0,
      classificationSource: {
        rules: 0,
        ai: 0,
        hybrid: 0,
      },
      latencies: [],
    };
  }

  /**
   * Main routing function: prompt → classification → service → output
   * @param {string} prompt - User's creative prompt
   * @param {Object} options - { medium?, style?, skipClassification? }
   * @returns {Promise<Object>} { output, medium, style, confidence, latency }
   */
  async route(prompt, options = {}) {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // Validate input - check type first before any operations
      if (
        prompt === null ||
        prompt === undefined ||
        typeof prompt !== "string"
      ) {
        throw new Error("Invalid prompt: must be a non-empty string");
      }

      if (prompt.trim() === "") {
        throw new Error("Invalid prompt: must be a non-empty string");
      }

      // Step 1: Determine classification
      let classification;

      if (options.skipClassification) {
        // Direct classification provided
        classification = {
          medium: options.medium || "ebook",
          style: options.style || "minimalist",
          theme: options.theme || [],
          colorPalette: options.colorPalette || "vibrant",
          confidence: 1.0,
          source: "provided",
        };
      } else {
        // Perform intelligent classification
        classification = await this.classifyPrompt(prompt, options);
      }

      // Step 2: Validate medium BEFORE sanitizing (fail fast on invalid medium)
      if (!this.validMediums.includes(classification.medium)) {
        throw new Error(
          `Invalid medium: ${
            classification.medium
          }. Valid: ${this.validMediums.join(", ")}`
        );
      }

      // Step 3: Validate classification
      if (!this.validator.validate(classification)) {
        classification = this.validator.sanitize(classification);
      }

      // Step 4: Route to appropriate service
      const output = await this.routeToService(prompt, classification);

      // Step 5: Collect metrics
      const latency = Date.now() - startTime;
      this.metrics.successfulRoutes++;
      this.metrics.latencies.push(latency);
      this.metrics.classificationSource[classification.source]++;

      return {
        output,
        medium: classification.medium,
        style: classification.style,
        theme: classification.theme,
        colorPalette: classification.colorPalette,
        confidence: classification.confidence,
        source: classification.source,
        latency,
      };
    } catch (error) {
      this.metrics.failedRoutes++;
      throw new RouterError(error.message, {
        prompt:
          typeof prompt === "string"
            ? prompt.substring(0, 100)
            : String(prompt),
        originalError: error,
      });
    }
  }

  /**
   * Classify prompt using rule engine + LLM fallback
   * @private
   * @param {string} prompt
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async classifyPrompt(prompt, options) {
    // Try rule engine first (fast path, <10ms)
    const ruleResult = this.ruleEngine.extract(prompt);

    // If high confidence, use rule result
    if (ruleResult.confidence > 0.8) {
      return {
        ...ruleResult,
        source: "rules",
      };
    }

    // Low confidence: try LLM for better accuracy
    try {
      const aiResult = await this.llmClassifier.classify(prompt);

      if (this.validator.validate(aiResult)) {
        // Merge intelligently
        const merged = this.validator.merge(ruleResult, {
          ...aiResult,
          source: "ai",
        });
        return merged;
      }
    } catch (error) {
      // LLM failed, fall back to rule result
      console.warn(
        "LLM classification failed, using rule engine:",
        error.message
      );
    }

    // Fallback: return rule result
    return {
      ...ruleResult,
      source: "rules",
    };
  }

  /**
   * Route to appropriate service based on medium
   * @private
   * @param {string} prompt
   * @param {Object} classification
   * @returns {Promise<Object>}
   */
  async routeToService(prompt, classification) {
    const { medium } = classification;

    // Get service for medium
    const service = this.services[medium];

    if (!service) {
      throw new Error(`No service registered for medium: ${medium}`);
    }

    if (typeof service.generate !== "function") {
      throw new Error(`Service for ${medium} does not have generate() method`);
    }

    // Build context for service
    const context = {
      prompt,
      classification,
      metadata: {
        timestamp: new Date().toISOString(),
        router: "genieRouter-v1",
      },
    };

    // Call service with context
    try {
      const output = await service.generate(context);
      return output;
    } catch (error) {
      throw new Error(
        `Service generation failed for ${medium}: ${error.message}`
      );
    }
  }

  /**
   * Get available services
   * @returns {string[]}
   */
  getAvailableServices() {
    return Object.keys(this.services);
  }

  /**
   * Register a service
   * @param {string} medium - Medium type (ebook, calendar, etc.)
   * @param {Object} service - Service with generate(context) method
   */
  registerService(medium, service) {
    if (!this.validMediums.includes(medium)) {
      throw new Error(`Invalid medium: ${medium}`);
    }
    if (typeof service.generate !== "function") {
      throw new Error("Service must have generate(context) method");
    }
    this.services[medium] = service;
  }

  /**
   * Get service capabilities
   * @param {string} medium
   * @returns {Object}
   */
  getServiceCapabilities(medium) {
    const service = this.services[medium];
    if (!service) {
      return null;
    }

    return {
      medium,
      available: true,
      supports: {
        styles: this.validator.getValidOptions("styles"),
        themes: ["playful-colors", "magical-realism", "minimalist"],
        colorPalettes: this.validator.getValidOptions("colorPalettes"),
      },
      limits: {
        maxPromptLength: 2000,
        maxThemes: 5,
      },
    };
  }

  /**
   * Get routing metrics
   * @returns {Object}
   */
  getMetrics() {
    const latencies = this.metrics.latencies;
    const sorted = [...latencies].sort((a, b) => a - b);

    return {
      totalRequests: this.metrics.totalRequests,
      successfulRoutes: this.metrics.successfulRoutes,
      failedRoutes: this.metrics.failedRoutes,
      successRate:
        this.metrics.totalRequests > 0
          ? (this.metrics.successfulRoutes / this.metrics.totalRequests) * 100
          : 0,
      classificationSource: this.metrics.classificationSource,
      latency: {
        min: sorted.length > 0 ? sorted[0] : 0,
        max: sorted.length > 0 ? sorted[sorted.length - 1] : 0,
        mean:
          sorted.length > 0
            ? sorted.reduce((a, b) => a + b, 0) / sorted.length
            : 0,
        p95:
          sorted.length > 0 ? sorted[Math.ceil(sorted.length * 0.95) - 1] : 0,
      },
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalRequests: 0,
      successfulRoutes: 0,
      failedRoutes: 0,
      classificationSource: {
        rules: 0,
        ai: 0,
        hybrid: 0,
      },
      latencies: [],
    };
  }

  /**
   * Validate medium is supported
   * @param {string} medium
   * @returns {boolean}
   */
  isValidMedium(medium) {
    return this.validMediums.includes(medium);
  }

  /**
   * Get all valid mediums
   * @returns {string[]}
   */
  getValidMediums() {
    return this.validMediums;
  }
}

/**
 * Custom error for routing failures
 */
class RouterError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = "RouterError";
    this.context = context;
    this.statusCode = 500;

    // Set status code based on error type
    if (message.includes("Invalid")) {
      this.statusCode = 400;
    } else if (message.includes("No service")) {
      this.statusCode = 503;
    } else if (message.includes("Service generation")) {
      this.statusCode = 500;
    }
  }
}

module.exports = GenieRouter;
