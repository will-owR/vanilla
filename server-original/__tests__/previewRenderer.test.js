const { renderPreview } = require("../previewRenderer");

describe("previewRenderer", () => {
  it("sanitizes script tags and dangerous attributes", () => {
    const content = {
      title: "Hello <script>alert('x')</script>",
      body: '<p>Good</p><img src="x" onerror="alert(1)" /><script>evil()</script>',
    };

    const html = renderPreview(content);
    expect(typeof html).toBe("string");
    // Should not contain script tags or event handler attributes
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("onerror");
    // Basic allowed markup should remain (paragraph)
    expect(html).toContain("<p>Good</p>");
  });
});
