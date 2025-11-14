const pdfStructureBuilder = require("./utils/pdfStructureBuilder");
const themeEngine = require("./utils/themeEngine");
const fs = require("fs");

(async () => {
  const pages = [
    {
      id: "p1",
      title: "Section 1",
      blocks: [
        { type: "text", content: "Content 1" },
        { type: "image", caption: "Figure 1" },
        { type: "callout", content: "Key 1" },
      ],
    },
  ];

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
  const result = await pdfStructureBuilder.generatePDF(envelope, theme);

  let buf = result.buffer || result;
  if (!Buffer.isBuffer(buf)) {
    buf = Buffer.from(buf);
  }

  fs.writeFileSync("/tmp/demo-output.pdf", buf);
  console.log("PDF saved, size:", buf.length);
})();
