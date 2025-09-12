#!/usr/bin/env node
// Small local smoke test: start server, POST /prompt?dev=true, GET /preview
const fetch = global.fetch || require("node-fetch");
const path = require("path");

async function run() {
  const serverModule = require(path.resolve(__dirname, "..", "server"));
  console.log("Starting server (programmatic)...");
  const server = await serverModule.startServer({ listen: true, port: 4041 });
  try {
    const base = "http://127.0.0.1:4041";
    const prompt = "Local smoke: a short test prompt";
    console.log("POST /prompt?dev=true ->", prompt);
    const resp = await fetch(`${base}/prompt?dev=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    console.log("POST /prompt status", resp.status);
    const json = await resp.json();
    if (!json || !json.data || !json.data.content)
      throw new Error("Invalid prompt response");
    const content = json.data.content;
    console.log("Received content:", Object.keys(content));

    // Request preview via GET /preview?content=<encoded JSON>
    const encoded = encodeURIComponent(JSON.stringify(content));
    const previewResp = await fetch(`${base}/preview?content=${encoded}`);
    console.log("GET /preview status", previewResp.status);
    const previewText = await previewResp.text();
    if (!previewText || previewText.length < 20)
      throw new Error("Preview too small");
    console.log("Preview length", previewText.length);

    console.log("Smoke test succeeded — server produced preview HTML.");
  } catch (err) {
    console.error("Smoke test failed:", err && err.message ? err.message : err);
    throw err;
  } finally {
    try {
      await serverModule.closeServer(server);
      console.log("Server stopped.");
    } catch (e) {
      console.warn("Error while shutting down server:", e && e.message);
    }
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
