/* global beforeAll, afterAll, test, expect */
const request = require("supertest");
const app = require("../index");
const { startServer } = require("../index");
const crud = require("../crud");

// Poll /health until services report ok or timeout
async function waitForHealth(timeout = 20000, interval = 500) {
  const req = request(app);
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await req.get("/health");
      if (res.status === 200 && res.body && res.body.status === "ok") return;
    } catch (e) {
      // ignore and retry
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error("Health check did not become ok in time");
}

let createdPromptId = null;
let createdResultId = null;

beforeAll(async () => {
  // Initialize DB + Puppeteer but don't bind to network
  await startServer({ listen: false });
  await waitForHealth(20000, 500);

  // Create a persisted prompt and AI result via legacy crud
  const p = await crud.createPrompt("Persisted title prompt");
  createdPromptId = p.id;
  const r = await crud.createAIResult(createdPromptId, {
    content: { title: "Persisted Title", body: "Persisted Body" },
    metadata: { source: "test" },
  });
  createdResultId = r.id;
}, 30000);

test("GET /preview with promptId returns persisted content", async () => {
  const req = request(app);
  const res = await req.get(`/preview?promptId=${createdPromptId}`);

  expect(res.status).toBe(200);
  expect(res.text).toMatch(/Persisted Title/);
  expect(res.text).toMatch(/Persisted Body/);
});

test("POST /export with promptId returns a PDF", async () => {
  const req = request(app);
  const payload = { promptId: createdPromptId };

  // Parser to accumulate binary response into a Buffer
  const parser = (res, cb) => {
    const chunks = [];
    res.on("data", (c) => chunks.push(c));
    res.on("end", () => cb(null, Buffer.concat(chunks)));
  };

  const res = await req
    .post("/export")
    .send(payload)
    .set("Accept", "application/pdf")
    .buffer(true)
    .parse(parser)
    .timeout(20000);

  expect(res.status).toBe(200);
  expect(res.headers["content-type"]).toMatch(/application\/pdf/);
  expect(Buffer.isBuffer(res.body)).toBe(true);
  expect(res.body.length).toBeGreaterThan(100);
}, 30000);

afterAll(async () => {
  try {
    if (typeof app.stopServer === "function") await app.stopServer();
  } catch (e) {}
});
