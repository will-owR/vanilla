import { writable, derived } from "svelte/store";

/**
 * Flow state enum
 * @type {Object<string, string>}
 */
const STATES = {
  INITIAL: "INITIAL",
  MEDIUM_SELECTED: "MEDIUM_SELECTED",
  GENERATING: "GENERATING",
  CLASSIFICATION_READY: "CLASSIFICATION_READY",
  RESULT_READY: "RESULT_READY",
  OVERRIDE_ACTIVE: "OVERRIDE_ACTIVE",
  COMPLETE: "COMPLETE",
  ERROR: "ERROR",
};

/**
 * Valid state transitions
 * Maps current state to allowed next states
 * @type {Object<string, string[]>}
 */
const VALID_TRANSITIONS = {
  [STATES.INITIAL]: [STATES.MEDIUM_SELECTED],
  [STATES.MEDIUM_SELECTED]: [STATES.GENERATING, STATES.INITIAL],
  [STATES.GENERATING]: [
    STATES.CLASSIFICATION_READY,
    STATES.RESULT_READY,
    STATES.ERROR,
  ],
  [STATES.CLASSIFICATION_READY]: [
    STATES.GENERATING,
    STATES.OVERRIDE_ACTIVE,
    STATES.INITIAL,
    STATES.ERROR,
  ],
  [STATES.RESULT_READY]: [
    STATES.OVERRIDE_ACTIVE,
    STATES.COMPLETE,
    STATES.INITIAL,
    STATES.ERROR,
  ],
  [STATES.OVERRIDE_ACTIVE]: [
    STATES.GENERATING,
    STATES.RESULT_READY,
    STATES.ERROR,
  ],
  [STATES.COMPLETE]: [STATES.INITIAL],
  [STATES.ERROR]: [STATES.INITIAL, STATES.MEDIUM_SELECTED],
};

/**
 * Create the flow store with 8-state machine
 */
function createFlowStore() {
  const { subscribe, set, update } = writable({
    state: STATES.INITIAL,
    selectedMedium: "",
    prompt: "",
    classification: null,
    result: null,
    latency: 0,
    overrideCost: 0,
    error: null,
  });

  return {
    subscribe,

    /**
     * Set the current state with validation
     * @param {string} newState - Target state
     * @throws {Error} If transition is invalid
     */
    setState(newState) {
      update((store) => {
        const currentState = store.state;

        // Validate transition
        if (!VALID_TRANSITIONS[currentState]?.includes(newState)) {
          console.warn(
            `Invalid state transition: ${currentState} → ${newState}. Allowed: ${VALID_TRANSITIONS[
              currentState
            ]?.join(", ")}`
          );
          return store;
        }

        return { ...store, state: newState };
      });
    },

    /**
     * Set the selected medium
     * @param {string} medium - Medium name (ebook, calendar, poster, stickers, card)
     */
    setMedium(medium) {
      update((store) => ({ ...store, selectedMedium: medium }));
    },

    /**
     * Set the user's prompt
     * @param {string} prompt - The prompt text
     */
    setPrompt(prompt) {
      update((store) => ({ ...store, prompt }));
    },

    /**
     * Set the classification result from API
     * @param {Object} classObj - Classification object from /api/classify
     */
    setClassification(classObj) {
      update((store) => ({ ...store, classification: classObj }));
    },

    /**
     * Set the generation/override result from API
     * @param {Object} resultObj - Result object from /api/generate or /api/override
     */
    setResult(resultObj) {
      update((store) => ({ ...store, result: resultObj }));
    },

    /**
     * Set the latency of the last operation
     * @param {number} ms - Latency in milliseconds
     */
    setLatency(ms) {
      update((store) => ({ ...store, latency: ms }));
    },

    /**
     * Set the override cost multiplier
     * @param {number} cost - Cost multiplier value
     */
    setOverrideCost(cost) {
      update((store) => ({ ...store, overrideCost: cost }));
    },

    /**
     * Set an error
     * @param {Object} errorObj - Error object with {status, message, retryable}
     */
    setError(errorObj) {
      update((store) => ({ ...store, error: errorObj }));
    },

    /**
     * Clear all state and return to INITIAL
     */
    reset() {
      set({
        state: STATES.INITIAL,
        selectedMedium: "",
        prompt: "",
        classification: null,
        result: null,
        latency: 0,
        overrideCost: 0,
        error: null,
      });
    },
  };
}

// Export singleton store instance
export const flowStore = createFlowStore();

// Export state constants for components
export { STATES, VALID_TRANSITIONS };
