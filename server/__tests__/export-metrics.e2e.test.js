const request = require("supertest");
const Module = require("module").Module;
const path = require("path");

// Create a lightweight mock for exportPipeline so we can exercise the
// /api/export route without invoking heavy AI/Puppeteer dependencies.
let serverModule;
let app;
let resolvedEP;

beforeAll(async () => {
  // Resolve the real exportPipeline path and insert a fake module into
  // require.cache so subsequent requires return our mock.
  resolvedEP = require.resolve("../exportPipeline");
  const fake = new Module(resolvedEP, module.parent);
  fake.filename = resolvedEP;
  const METRICS = require("../metrics/GenerationMetrics");
  fake.exports = {
    _lastSessionId: null,
    exportEbook: async (prompt, opts) => {
      // Simulate creating a session id and returning a PDF-like Buffer
      const sid = `test-session-${Date.now()}`;
      fake.exports._lastSessionId = sid;
      // Ensure the in-memory metrics store has a session so the
      // /metrics/report/:sessionId endpoint can return a 200.
      try {
        METRICS.startSession(sid, { pageCount: 1, title: "test-export" });
      } catch (e) {
        // ignore if session already exists
      }
      return Buffer.from("%PDF-MOCK-EXPORT%\n%EOF\n");
    },
  };
  require.cache[resolvedEP] = fake;

  // Now require server (which will pick up our mocked exportPipeline)
  delete require.cache[require.resolve("../index")];
  serverModule = require("../index");
  app = serverModule;
  // Start server internals without listening on network port
  await serverModule.startServer({ listen: false });
});

test("Export endpoint exposes X-Generation-Session and metrics report is available", async () => {
  const res = await request(app)
    .post("/api/export")
    .send({ prompt: "Test export for metrics" })
    .set("Accept", "application/pdf")
    .timeout({ deadline: 20000 })
    .parse((res, cb) => {
      const data = [];
      res.on("data", (chunk) => data.push(chunk));
      res.on("end", () => cb(null, Buffer.concat(data)));
    });

  expect(res.status).toBe(200);
  expect(res.headers["content-type"]).toMatch(/application\/pdf/);
  const buf = res.body;
  expect(Buffer.isBuffer(buf)).toBe(true);
  expect(buf.length).toBeGreaterThan(10);

  const sessionId = res.headers["x-generation-session"];
  expect(sessionId).toBeDefined();

  // Query metrics report endpoint for the created session
  const rep = await request(app).get(`/metrics/report/${sessionId}`);
  expect(rep.status).toBe(200);
  expect(rep.body).toBeDefined();
  expect(rep.body.sessionId).toBe(sessionId);
  expect(rep.body.ebook).toBeDefined();
  expect(rep.body.timeline).toBeDefined();
});

afterAll(async () => {
  try {
    // Attempt graceful shutdown of Puppeteer instance if present
    const browser = serverModule.browser;
    if (browser && typeof browser.close === "function") {
      await browser.close();
    }
  } catch (e) {}

  // Cleanup mocked module from require cache
  try {
    delete require.cache[resolvedEP];
  } catch (e) {}
  try {
    delete require.cache[require.resolve("../index")];
  } catch (e) {}
});
