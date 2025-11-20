const pdfStructureBuilder = require("./utils/pdfStructureBuilder");
const themeEngine = require("./utils/themeEngine");

(async () => {
  const pages = Array.from({ length: 5 }).map((_, i) => ({
    id: `p${i + 1}`,
    title: `Section ${i + 1}`,
    blocks: [
      { type: "text", content: `Content for page ${i + 1}` },
      { type: "image", caption: `Figure ${i + 1}` },
      { type: "callout", content: `Key takeaway: ${i + 1}` },
    ],
  }));

  const metadata = {
    mode: "demo",
    theme: "dark",
    title: "Test",
    author: "Author",
  };
  const epilogue = {
    type: "epilogue",
    enabled: true,
    sections: {
      closing: { title: "Closing", content: "Thank you" },
      bio: { title: "Bio", content: "Author bio", email: "test@test.com" },
      resources: {
        title: "Resources",
        items: [{ title: "Link", url: "http://test.com" }],
      },
    },
  };

  const theme = themeEngine.getTheme("dark");
  const html = pdfStructureBuilder.buildPDFHTML({
    pages,
    metadata,
    epilogue,
    theme,
  });

  // Count sections in HTML
  console.log(
    "Cover page divs:",
    (html.match(/class="cover-page"/g) || []).length
  );
  console.log(
    "Copyright page divs:",
    (html.match(/class="copyright-page"/g) || []).length
  );
  console.log("TOC page divs:", (html.match(/class="toc-page"/g) || []).length);
  console.log(
    "Content page divs:",
    (html.match(/class="content-page"/g) || []).length
  );
  console.log(
    "Epilogue page divs:",
    (html.match(/class="epilogue-page"/g) || []).length
  );

  console.log(
    "\nTotal page divs:",
    (html.match(/<div class="page/g) || []).length
  );
  console.log(
    "Page breaks:",
    (html.match(/page-break-after: always/g) || []).length
  );
})();
