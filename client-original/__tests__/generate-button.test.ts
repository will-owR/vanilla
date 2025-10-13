import { render, fireEvent, waitFor } from "@testing-library/svelte/svelte5";
import { afterEach, test, expect, vi } from "vitest";
import App from "../src/App.svelte";

vi.mock("$lib/components/OverrideControls.svelte", () => {
  return {
    default: vi.fn(),
  };
});

// Polyfill element.animate used by some components in the test environment
if (
  typeof global.window !== "undefined" &&
  !global.window.Element.prototype.animate
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global.window.Element.prototype as any).animate = function () {
    // return a minimal Animation-like object with a finished promise
    return {
      play: () => {},
      cancel: () => {},
      finished: Promise.resolve(),
    };
  };
}

// Ensure global fetch is mocked
const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

test("Generate button flow - happy path (dev stub)", async () => {
  // Mock POST /prompt?dev=true via fetch
  global.fetch = vi.fn((input, init) => {
    // Normalize input to a string URL for tests (handles absolute URLs)
    const url = typeof input === "string" ? input : input?.url || "";
    // Simulate dev endpoint behavior
    if (url.startsWith("/prompt") || url.includes("/prompt")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              content: {
                title: "Dev: Test",
                body: "Deterministic preview",
                layout: "dev",
              },
            },
          }),
          { status: 201 }
        )
      );
    }
    // Mock /preview GET if called
    if (url.startsWith("/preview") || url.includes("/preview")) {
      return Promise.resolve(
        new Response("<div>preview</div>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        })
      );
    }
    return Promise.reject(new Error("unhandled fetch " + url));
  });

  const { getByTestId, queryByText } = render(App);

  const textarea = getByTestId("prompt-textarea");
  await fireEvent.input(textarea, { target: { value: "A short poem" } });

  const button = getByTestId("generate-button");
  expect(button).toBeTruthy();

  // Click generate: should call POST /prompt
  await fireEvent.click(button);

  // Button should show 'Generating...' while in progress
  await waitFor(() => expect(queryByText("Generating...")).toBeTruthy());

  // Eventually previewStore should be updated and preview loaded (preview text present)
  await waitFor(() => expect(queryByText("preview")).toBeTruthy());
});
