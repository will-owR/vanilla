import { describe, it, expect, beforeEach } from "vitest";
import { flowStore, STATES } from "../src/lib/stores/flowStore.js";

describe("GenerateFlow Orchestrator Logic", () => {
  beforeEach(() => {
    flowStore.reset();
  });

  describe("State transitions", () => {
    it("should validate medium selection", () => {
      let state;
      const unsubscribe = flowStore.subscribe((value) => {
        state = value;
      });

      flowStore.setMedium("ebook");
      expect(state.selectedMedium).toBe("ebook");
      unsubscribe();
    });

    it("should store prompt correctly", () => {
      let state;
      const unsubscribe = flowStore.subscribe((value) => {
        state = value;
      });

      const prompt = "Create a beautiful summer poster with vibrant colors";
      flowStore.setPrompt(prompt);
      expect(state.prompt).toBe(prompt);
      unsubscribe();
    });

    it("should transition through generate flow states", () => {
      let state;
      const unsubscribe = flowStore.subscribe((value) => {
        state = value;
      });

      expect(state.state).toBe(STATES.INITIAL);

      flowStore.setState(STATES.MEDIUM_SELECTED);
      expect(state.state).toBe(STATES.MEDIUM_SELECTED);

      flowStore.setState(STATES.GENERATING);
      expect(state.state).toBe(STATES.GENERATING);

      flowStore.setState(STATES.CLASSIFICATION_READY);
      expect(state.state).toBe(STATES.CLASSIFICATION_READY);

      // From CLASSIFICATION_READY, go to GENERATING then RESULT_READY
      flowStore.setState(STATES.GENERATING);
      expect(state.state).toBe(STATES.GENERATING);

      flowStore.setState(STATES.RESULT_READY);
      expect(state.state).toBe(STATES.RESULT_READY);

      unsubscribe();
    });
  });

  describe("Classification flow", () => {
    it("should store classification result", () => {
      const mockClassification = {
        id: "class-123",
        medium: "ebook",
        confidence: 0.92,
        style: "modern",
        themes: ["summer"],
        audience: "adults",
        genre: "fiction",
        tone: "uplifting",
        source: "ai",
        metadata: {},
      };

      let state;
      const unsubscribe = flowStore.subscribe((value) => {
        state = value;
      });

      flowStore.setClassification(mockClassification);
      expect(state.classification?.id).toBe("class-123");
      expect(state.classification?.confidence).toBe(0.92);
      unsubscribe();
    });

    it("should recognize high confidence (> 0.85)", () => {
      const mockClassification = {
        confidence: 0.92,
      };

      let state;
      const unsubscribe = flowStore.subscribe((value) => {
        state = value;
      });

      flowStore.setClassification(mockClassification);
      const isHighConfidence = state.classification.confidence > 0.85;
      expect(isHighConfidence).toBe(true);
      unsubscribe();
    });

    it("should recognize low confidence (<= 0.85)", () => {
      const mockClassification = {
        confidence: 0.75,
      };

      let state;
      const unsubscribe = flowStore.subscribe((value) => {
        state = value;
      });

      flowStore.setClassification(mockClassification);
      const isLowConfidence = state.classification.confidence <= 0.85;
      expect(isLowConfidence).toBe(true);
      unsubscribe();
    });
  });

  describe("Generation flow", () => {
    it("should store generation result", () => {
      const mockResult = {
        id: "gen-456",
        pdfUrl: "/tmp-exports/abc123.pdf",
        pageCount: 12,
        medium: "ebook",
        style: "modern",
        classification: { id: "class-123" },
        metadata: {},
        latency: 8500,
        costEstimate: 0.5,
      };

      let state;
      const unsubscribe = flowStore.subscribe((value) => {
        state = value;
      });

      flowStore.setResult(mockResult);
      expect(state.result?.id).toBe("gen-456");
      expect(state.result?.pageCount).toBe(12);
      unsubscribe();
    });

    it("should store latency", () => {
      let state;
      const unsubscribe = flowStore.subscribe((value) => {
        state = value;
      });

      flowStore.setLatency(8500);
      expect(state.latency).toBe(8500);
      unsubscribe();
    });
  });

  describe("Override flow", () => {
    it("should update cost multiplier on override", () => {
      let state;
      const unsubscribe = flowStore.subscribe((value) => {
        state = value;
      });

      flowStore.setOverrideCost(1.2);
      expect(state.overrideCost).toBe(1.2);
      unsubscribe();
    });

    it("should store override result", () => {
      const mockResult = {
        id: "override-789",
        pdfUrl: "/tmp-exports/def456.pdf",
        costMultiplier: 1.2,
        costBreakdown: { style: 0.4, tone: 0.3 },
        regenerationStrategy: "full",
        metadata: {},
      };

      let state;
      const unsubscribe = flowStore.subscribe((value) => {
        state = value;
      });

      flowStore.setResult(mockResult);
      flowStore.setOverrideCost(mockResult.costMultiplier);

      expect(state.result?.id).toBe("override-789");
      expect(state.overrideCost).toBe(1.2);
      unsubscribe();
    });
  });

  describe("Error handling", () => {
    it("should store error state", () => {
      const mockError = {
        status: 500,
        message: "Server error",
        retryable: true,
      };

      let state;
      const unsubscribe = flowStore.subscribe((value) => {
        state = value;
      });

      flowStore.setError(mockError);
      expect(state.error?.status).toBe(500);
      expect(state.error?.retryable).toBe(true);
      unsubscribe();
    });

    it("should identify retryable errors", () => {
      const retryableErrors = [
        { status: 408, retryable: true },
        { status: 429, retryable: true },
        { status: 500, retryable: true },
      ];

      let state;
      const unsubscribe = flowStore.subscribe((value) => {
        state = value;
      });

      retryableErrors.forEach((error) => {
        flowStore.setError(error);
        expect(state.error?.retryable).toBe(true);
      });
      unsubscribe();
    });
  });

  describe("Reset functionality", () => {
    it("should reset all state to initial", () => {
      let state;
      const unsubscribe = flowStore.subscribe((value) => {
        state = value;
      });

      // Set multiple values
      flowStore.setMedium("ebook");
      flowStore.setPrompt("Test prompt for reset");
      flowStore.setState(STATES.RESULT_READY);
      flowStore.setResult({ id: "gen-123" });
      flowStore.setError({ status: 500 });

      // Reset
      flowStore.reset();

      expect(state.state).toBe(STATES.INITIAL);
      expect(state.selectedMedium).toBe("");
      expect(state.prompt).toBe("");
      expect(state.result).toBeNull();
      expect(state.error).toBeNull();
      unsubscribe();
    });
  });
});
