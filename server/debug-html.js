const pdfStructureBuilder = require("./utils/pdfStructureBuilder");
const themeEngine = require("./utils/themeEngine");

(async () => {
  const pages = [
    {
      id: "p1",
      title: "Section 1: First part",
      blocks: [
        { type: "text", content: "Content for page 1" },
        { type: "image", caption: "Figure 1: Key insight" },
        { type: "callout", content: "Key takeaway: First part" },
      ],
    },
    {
      id: "p2",
      title: "Section 2: Second part",
      blocks: [
        { type: "text", content: "Content for page 2" },
        { type: "image", caption: "Figure 2: Key insight" },
        { type: "callout", content: "Key takeaway: Second part" },
      ],
    },
  ];

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

  console.log("Building HTML...");
  const html = pdfStructureBuilder.buildPDFHTML({
    pages,
    metadata,
    epilogue,
    theme,
  });

  // Count page divs in HTML
  const pageCount = (html.match(/<div class="page/g) || []).length;
  console.log("Page divs in HTML:", pageCount);

  // Check for cover, copyright, toc
  console.log("Has cover:", html.includes("cover-page"));
  console.log("Has copyright:", html.includes("copyright-page"));
  console.log("Has toc:", html.includes("toc-page"));
  console.log("Has epilogue:", html.includes("epilogue-page"));

  // Show first 2000 chars
  console.log("\nHTML Preview (first 1500 chars):");
  console.log(html.substring(0, 1500));
})();
