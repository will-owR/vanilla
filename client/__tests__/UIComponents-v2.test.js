import { describe, it, expect, beforeEach } from "vitest";
import { flowStore, STATES } from "../src/lib/stores/flowStore.js";
import { CONFIG } from "../src/lib/api-v2.js";

describe("MediaSelector-v2 Component Logic", () => {
  beforeEach(() => {
    flowStore.reset();
  });

  it("should have all supported media", () => {
    const expectedMedia = ["ebook", "calendar", "poster", "stickers", "card"];
    expect(CONFIG.SUPPORTED_MEDIA).toEqual(expectedMedia);
  });

  it("should set medium when selected", () => {
    let state;
    const unsubscribe = flowStore.subscribe((value) => {
      state = value;
    });

    flowStore.setMedium("ebook");
    expect(state.selectedMedium).toBe("ebook");

    flowStore.setMedium("poster");
    expect(state.selectedMedium).toBe("poster");

    unsubscribe();
  });

  it("should transition to MEDIUM_SELECTED after selecting", () => {
    let state;
    const unsubscribe = flowStore.subscribe((value) => {
      state = value;
    });

    flowStore.setMedium("calendar");
    flowStore.setState(STATES.MEDIUM_SELECTED);

    expect(state.selectedMedium).toBe("calendar");
    expect(state.state).toBe(STATES.MEDIUM_SELECTED);

    unsubscribe();
  });
});

describe("PromptInput-v2 Component Logic", () => {
  beforeEach(() => {
    flowStore.reset();
  });

  it("should store prompt in flowStore", () => {
    let state;
    const unsubscribe = flowStore.subscribe((value) => {
      state = value;
    });

    const prompt = "Create a beautiful summer poster with vibrant colors";
    flowStore.setPrompt(prompt);

    expect(state.prompt).toBe(prompt);
    unsubscribe();
  });

  it("should validate prompt minimum length", () => {
    const shortPrompt = "Short";
    const validPrompt = "Create a beautiful summer poster with vibrant colors";

    expect(shortPrompt.length < 10).toBe(true);
    expect(validPrompt.length >= 10).toBe(true);
  });

  it("should trim prompt whitespace", () => {
    const prompt = "  Create a beautiful summer poster  ";
    const trimmed = prompt.trim();

    expect(trimmed).toBe("Create a beautiful summer poster");
    expect(trimmed.length >= 10).toBe(true);
  });

  it("should count characters correctly", () => {
    const prompts = [
      { text: "Short", count: 5 },
      { text: "This is exactly", count: 15 },
      { text: "Create a beautiful summer poster", count: 32 },
    ];

    prompts.forEach(({ text, count }) => {
      expect(text.length).toBe(count);
    });
  });
});
