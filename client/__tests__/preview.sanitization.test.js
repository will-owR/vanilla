import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "../src/lib/sanitize";

describe("sanitizeHtml", () => {
  it("removes script tags and event handlers", () => {
    const malicious = `<div onclick="alert('x')">Click me</div><script>window.evil=1</script><a href="javascript:doEvil()">link</a>`;
    const clean = sanitizeHtml(malicious);
    expect(clean).not.toContain("<script>");
    expect(clean).not.toContain("onclick=");
    expect(clean).not.toContain("javascript:doEvil");
    // Basic content should remain
    expect(clean).toContain("Click me");
    expect(clean).toContain("link");
  });
});
