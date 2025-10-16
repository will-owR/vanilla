import { describe, it, expect } from "vitest";
import { extractPreviewHtml } from "../src/lib/preview-utils";

describe("extractPreviewHtml", () => {
  it("prefers top-level preview", () => {
    const r = { preview: "<h1>top</h1>" };
    expect(extractPreviewHtml(r)).toBe("<h1>top</h1>");
  });

  it("uses data.preview", () => {
    const r = { data: { preview: "<p>data</p>" } };
    expect(extractPreviewHtml(r)).toBe("<p>data</p>");
  });

  it("uses data.content.html/body", () => {
    const r1 = { data: { content: { html: "<div>html</div>" } } };
    expect(extractPreviewHtml(r1)).toBe("<div>html</div>");
    const r2 = { data: { content: { body: "<div>body</div>" } } };
    expect(extractPreviewHtml(r2)).toBe("<div>body</div>");
  });

  it("uses legacy content", () => {
    const r = { content: { body: "<span>legacy</span>" } };
    expect(extractPreviewHtml(r)).toBe("<span>legacy</span>");
  });

  it("returns null when no html", () => {
    const r = { foo: "bar" };
    expect(extractPreviewHtml(r)).toBeNull();
  });
});
