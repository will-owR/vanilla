import { describe, it, expect, beforeEach } from "vitest";
import { flowStore, STATES } from "../src/lib/stores/flowStore.js";

describe("flowStore - StateManager", () => {
  beforeEach(() => {
    flowStore.reset();
  });

  describe("initial state", () => {
    it("should initialize with INITIAL state", () => {
      let state;
      const unsubscribe = flowStore.subscribe((value) => {
        state = value;
      });
      expect(state.state).toBe(STATES.INITIAL);
      unsubscribe();
    });

    it("should have empty selected medium initially", () => {
      let state;
      const unsubscribe = flowStore.subscribe((value) => {
        state = value;
      });
      expect(state.selectedMedium).toBe("");
      unsubscribe();
    });
  });

  describe("setState()", () => {
    it("should transition from INITIAL to MEDIUM_SELECTED", () => {
      let state;
      const unsubscribe = flowStore.subscribe((value) => {
        state = value;
      });

      flowStore.setState(STATES.MEDIUM_SELECTED);
      expect(state.state).toBe(STATES.MEDIUM_SELECTED);
      unsubscribe();
    });

    it("should reject invalid transitions", () => {
      let state;
      const unsubscribe = flowStore.subscribe((value) => {
        state = value;
      });

      // Try invalid: INITIAL → GENERATING (should stay INITIAL)
      flowStore.setState(STATES.GENERATING);
      expect(state.state).toBe(STATES.INITIAL);
      unsubscribe();
    });

    it("should allow MEDIUM_SELECTED → GENERATING", () => {
      let state;
      const unsubscribe = flowStore.subscribe((value) => {
        state = value;
      });

      flowStore.setState(STATES.MEDIUM_SELECTED);
      flowStore.setState(STATES.GENERATING);
      expect(state.state).toBe(STATES.GENERATING);
      unsubscribe();
    });

    it("should allow GENERATING → CLASSIFICATION_READY", () => {
      let state;
      const unsubscribe = flowStore.subscribe((value) => {
        state = value;
      });

      flowStore.setState(STATES.MEDIUM_SELECTED);
      flowStore.setState(STATES.GENERATING);
      flowStore.setState(STATES.CLASSIFICATION_READY);
      expect(state.state).toBe(STATES.CLASSIFICATION_READY);
      unsubscribe();
    });
  });

  describe("setMedium()", () => {
    it("should set selectedMedium", () => {
      let state;
      const unsubscribe = flowStore.subscribe((value) => {
        state = value;
      });

      flowStore.setMedium("ebook");
      expect(state.selectedMedium).toBe("ebook");
      unsubscribe();
    });
  });

  describe("setPrompt()", () => {
    it("should set prompt", () => {
      let state;
      const unsubscribe = flowStore.subscribe((value) => {
        state = value;
      });

      const testPrompt = "Create a beautiful summer poster with vibrant colors";
      flowStore.setPrompt(testPrompt);
      expect(state.prompt).toBe(testPrompt);
      unsubscribe();
    });
  });

  describe("setClassification()", () => {
    it("should set classification object", () => {
      let state;
      const unsubscribe = flowStore.subscribe((value) => {
        state = value;
      });

      const classObj = {
        id: "123",
        medium: "poster",
        confidence: 0.92,
        style: "modern",
        themes: ["summer", "beach"],
      };
      flowStore.setClassification(classObj);
      expect(state.classification).toEqual(classObj);
      unsubscribe();
    });
  });

  describe("setResult()", () => {
    it("should set result object", () => {
      let state;
      const unsubscribe = flowStore.subscribe((value) => {
        state = value;
      });

      const resultObj = {
        id: "gen-456",
        pdfUrl: "/tmp-exports/abc123.pdf",
        pageCount: 12,
      };
      flowStore.setResult(resultObj);
      expect(state.result).toEqual(resultObj);
      unsubscribe();
    });
  });

  describe("setLatency()", () => {
    it("should set latency in milliseconds", () => {
      let state;
      const unsubscribe = flowStore.subscribe((value) => {
        state = value;
      });

      flowStore.setLatency(2500);
      expect(state.latency).toBe(2500);
      unsubscribe();
    });
  });

  describe("setError()", () => {
    it("should set error object", () => {
      let state;
      const unsubscribe = flowStore.subscribe((value) => {
        state = value;
      });

      const errorObj = {
        status: 408,
        message: "Request timeout",
        retryable: true,
      };
      flowStore.setError(errorObj);
      expect(state.error).toEqual(errorObj);
      unsubscribe();
    });
  });

  describe("reset()", () => {
    it("should clear all state and return to INITIAL", () => {
      let state;
      const unsubscribe = flowStore.subscribe((value) => {
        state = value;
      });

      // Set multiple values
      flowStore.setMedium("ebook");
      flowStore.setPrompt("Test prompt");
      flowStore.setState(STATES.MEDIUM_SELECTED);
      flowStore.setClassification({ confidence: 0.9 });

      // Reset
      flowStore.reset();

      expect(state.state).toBe(STATES.INITIAL);
      expect(state.selectedMedium).toBe("");
      expect(state.prompt).toBe("");
      expect(state.classification).toBeNull();
      expect(state.result).toBeNull();
      expect(state.latency).toBe(0);
      expect(state.overrideCost).toBe(0);
      expect(state.error).toBeNull();
      unsubscribe();
    });
  });
});
