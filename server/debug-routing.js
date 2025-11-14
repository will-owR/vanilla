const pdfStructureBuilder = require("./utils/pdfStructureBuilder");
const themeEngine = require("./utils/themeEngine");
const pdfGenerator = require("./pdfGenerator");

(async () => {
  const pages = Array.from({ length: 5 }).map((_, i) => ({
    id: `p${i + 1}`,
    title: `Section ${i + 1}`,
    blocks: [
      { type: "text", content: `Content for page ${i + 1}` },
      { type: "image", caption: `Figure ${i + 1}` },
      { type: "callout", content: `Key: ${i + 1}` },
    ],
  }));

  const envelope = {
    pages,
    metadata: { mode: "demo", title: "Test", author: "Author" },
    epilogue: {
      sections: {
        closing: { title: "Closing", content: "Thank you" },
        bio: { title: "Bio", content: "Bio text", email: "test@test.com" },
        resources: {
          title: "Resources",
          items: [{ title: "Link", url: "http://test.com" }],
        },
      },
    },
  };

  const theme = themeEngine.getTheme("dark");
  const html = pdfStructureBuilder.buildPDFHTML({
    pages,
    metadata: envelope.metadata,
    epilogue: envelope.epilogue,
    theme,
  });

  console.log("HTML length:", html.length);
  console.log("HTML starts with:", html.substring(0, 50));
  console.log(
    "Has /page divs:",
    (html.match(/<div class="page/g) || []).length
  );

  // Now test what pdfGenerator does with this HTML
  console.log("\n--- Testing pdfGenerator routing logic ---");
  console.log(
    "HTML starts with <!doctype:",
    html.trim().toLowerCase().startsWith("<!doctype")
  );

  // Simulate the logic in pdfGenerator
  let contentHtml;
  const envelope_param = undefined; // This is what we're NOT passing
  const body = html;
  const title = "Demo Presentation";

  if (envelope_param && Array.isArray(envelope_param.pages)) {
    console.log("Would use envelope routing");
    contentHtml = "envelope path";
  } else if (
    body &&
    String(body).trim().toLowerCase().startsWith("<!doctype")
  ) {
    console.log("Would use body-as-is routing (NEW FIX)");
    contentHtml = "body-as-is path";
  } else {
    console.log("Would use wrapping routing");
    contentHtml = "wrapping path";
  }

  console.log("Result:", contentHtml);
})();
