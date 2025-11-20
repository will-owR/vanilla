/**
 * Flow Store - Phase A-B Progressive Disclosure State Machine
 *
 * Manages the state of the entire generation flow with 8 states:
 * INITIAL → MEDIUM_SELECTED → GENERATING → CLASSIFICATION_READY →
 * RESULT_READY → OVERRIDE_ACTIVE → GENERATING → RESULT_READY → COMPLETE
 */

import { writable, derived } from "svelte/store";

/**
 * Core flow state machine
 */
export function createFlowStore() {
  // Configuration thresholds (synchronized with backend)
  const CONFIDENCE_THRESHOLD = 0.85;
  const COST_MULTIPLIER_COLOR = 0.05;
  const COST_MULTIPLIER_STYLE = 0.4;
  const COST_MULTIPLIER_MEDIUM = 1.0;
  const CLASSIFY_TIMEOUT_MS = 30000;
  const GENERATE_TIMEOUT_MS = 30000;
  const OVERRIDE_TIMEOUT_MS = 10000;

  // Initialize store
  const { subscribe, set, update } = writable({
    // State machine
    state: "INITIAL", // 8-state machine: see states below
    previousState: null,

    // User selections
    selectedMedium: null,
    prompt: "",

    // Classification results
    classification: null,
    classificationId: null,

    // Generation results
    result: null,
    resultId: null,
    pdfUrl: null,
    pageCount: null,

    // Metadata
    latency: 0,
    costEstimate: 0,
    overrideCost: 0,

    // UI state
    isLoading: false,
    isClassifying: false,
    isGenerating: false,
    isOverriding: false,
    error: null,
    errorRecoveryAttempts: 0,

    // Analytics
    startTime: null,
    classificationTime: 0,
    generationTime: 0,
  });

  // Configuration (readonly)
  const config = {
    CONFIDENCE_THRESHOLD,
    COST_MULTIPLIER_COLOR,
    COST_MULTIPLIER_STYLE,
    COST_MULTIPLIER_MEDIUM,
    CLASSIFY_TIMEOUT_MS,
    GENERATE_TIMEOUT_MS,
    OVERRIDE_TIMEOUT_MS,
  };

  return {
    subscribe,
    set,
    update,

    // State transitions
    transitionTo(nextState) {
      update((state) => ({
        ...state,
        previousState: state.state,
        state: nextState,
        error: null, // Clear error on successful transition
      }));
    },

    // User selections
    setSelectedMedium(medium) {
      update((state) => ({
        ...state,
        selectedMedium: medium,
        state: state.state === "INITIAL" ? "MEDIUM_SELECTED" : state.state,
      }));
    },

    setPrompt(prompt) {
      update((state) => ({
        ...state,
        prompt: prompt,
      }));
    },

    // Classification results
    setClassification(classification) {
      update((state) => ({
        ...state,
        classification,
        classificationId: classification.id,
        error: null,
      }));
    },

    // Generation results
    setResult(result) {
      update((state) => ({
        ...state,
        result,
        resultId: result.id,
        pdfUrl: result.pdfUrl,
        pageCount: result.pageCount,
        latency: result.latency || 0,
        costEstimate: result.costEstimate || 0,
        error: null,
      }));
    },

    // Override cost tracking
    setOverrideCost(multiplier) {
      update((state) => ({
        ...state,
        overrideCost: multiplier,
      }));
    },

    // Loading states
    startClassifying() {
      update((state) => ({
        ...state,
        isClassifying: true,
        isLoading: true,
        state: "GENERATING",
      }));
    },

    finishClassifying() {
      update((state) => ({
        ...state,
        isClassifying: false,
        isLoading: state.isGenerating, // Stay loading if generating
      }));
    },

    startGenerating() {
      update((state) => ({
        ...state,
        isGenerating: true,
        isLoading: true,
        state: "GENERATING",
      }));
    },

    finishGenerating() {
      update((state) => ({
        ...state,
        isGenerating: false,
        isLoading: state.isClassifying || state.isOverriding, // Stay loading if classifying/overriding
      }));
    },

    startOverriding() {
      update((state) => ({
        ...state,
        isOverriding: true,
        isLoading: true,
        state: "GENERATING",
      }));
    },

    finishOverriding() {
      update((state) => ({
        ...state,
        isOverriding: false,
        isLoading: false,
      }));
    },

    // Error handling
    setError(error, recoveryAttempts = 0) {
      update((state) => ({
        ...state,
        error: error.message || String(error),
        errorRecoveryAttempts: recoveryAttempts,
        isLoading: false,
        isClassifying: false,
        isGenerating: false,
        isOverriding: false,
      }));
    },

    clearError() {
      update((state) => ({
        ...state,
        error: null,
        errorRecoveryAttempts: 0,
      }));
    },

    // Reset entire flow
    reset() {
      set({
        state: "INITIAL",
        previousState: null,
        selectedMedium: null,
        prompt: "",
        classification: null,
        classificationId: null,
        result: null,
        resultId: null,
        pdfUrl: null,
        pageCount: null,
        latency: 0,
        costEstimate: 0,
        overrideCost: 0,
        isLoading: false,
        isClassifying: false,
        isGenerating: false,
        isOverriding: false,
        error: null,
        errorRecoveryAttempts: 0,
        startTime: null,
        classificationTime: 0,
        generationTime: 0,
      });
    },

    // Configuration accessor
    getConfig() {
      return config;
    },
  };
}

// Create the default flow store instance
export const flowStore = createFlowStore();

/**
 * Derived stores for computed state
 */

// Whether we should show the classification feedback (high confidence auto-accept)
export const shouldShowClassificationFeedback = derived(
  flowStore,
  ($flowStore) => {
    const { classification, state } = $flowStore;
    if (!classification) return false;
    // Show feedback if confidence is below threshold (user review needed)
    return state === "CLASSIFICATION_READY" && classification.confidence < 0.85;
  }
);

// Overall flow progress (0-100)
export const flowProgress = derived(flowStore, ($flowStore) => {
  const stateProgress = {
    INITIAL: 0,
    MEDIUM_SELECTED: 10,
    GENERATING: 50,
    CLASSIFICATION_READY: 60,
    RESULT_READY: 90,
    OVERRIDE_ACTIVE: 70,
    COMPLETE: 100,
  };
  return stateProgress[$flowStore.state] || 0;
});

// Whether the flow is idle (not in progress)
export const isFlowIdle = derived(
  flowStore,
  ($flowStore) =>
    !$flowStore.isLoading &&
    !$flowStore.isClassifying &&
    !$flowStore.isGenerating &&
    !$flowStore.isOverriding
);

// Total elapsed time (in ms)
export const elapsedTime = derived(flowStore, ($flowStore) => {
  if (!$flowStore.startTime) return 0;
  return Date.now() - $flowStore.startTime;
});

// Format latency for display
export const formattedLatency = derived(flowStore, ($flowStore) => {
  const ms = $flowStore.latency;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
});
