import { test, expect } from "vitest";
import { render } from "@testing-library/svelte/svelte5";
import App from "../src/App.svelte";

const RUN_FULL_FLOW =
  process.env.RUN_FULL_FLOW === "1" || process.env.RUN_FULL_FLOW === "true";
const maybeTest = RUN_FULL_FLOW ? test : test.skip;

maybeTest("App renders preview content", () => {
  const { getByText } = render(App, {});
  // Match the heading text present in App.svelte
  expect(getByText("client-v2 — Preview")).toBeTruthy();
});
