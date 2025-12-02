/**
 * Batch Optimization Module
 *
 * Exports:
 * - BatchOptimizationService: Main orchestrator for batch-optimized generation
 * - RateLimiter: Queue-based rate limit enforcement (respects 6s timing, handles 429 backoff)
 * - GenerationMetrics: Session tracking and telemetry collection
 * - ContentExtractors: Extract voice, tone, themes, characters from content
 * - PromptTemplates: Generate optimized prompts for each generation stage
 */

const { BatchOptimizationService } = require("./BatchOptimizationService");
const { RateLimiter } = require("./RateLimiter");
const { GenerationMetrics } = require("./GenerationMetrics");
const { ContentExtractors } = require("./ContentExtractors");
const { PromptTemplates } = require("./PromptTemplates");

module.exports = {
  BatchOptimizationService,
  RateLimiter,
  GenerationMetrics,
  ContentExtractors,
  PromptTemplates,
};
