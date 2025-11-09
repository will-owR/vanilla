const request = require("supertest");
const app = require("../index");
const { startServer } = require("../index");

// Wait for health to be ok
async function waitForHealth(req, timeout = 20000, interval = 500) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await req.get("/health");
      if (res.status === 200 && res.body && res.body.status === "ok") return;
    } catch (e) {}
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error("Health did not become ok in time");
}

beforeAll(async () => {
  await startServer({ listen: false });
  const req = request(app);
  await waitForHealth(req, 20000, 500);
}, 30000);

test("POST /export accepts legacy title/body and returns PDF", async () => {
  const req = request(app);

  const parser = (res, cb) => {
    const chunks = [];
    res.on("data", (c) => chunks.push(c));
    res.on("end", () => cb(null, Buffer.concat(chunks)));
  };

  const res = await req
    .post("/export")
    .send({ title: "Test Title", body: "A short body for testing." })
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
