const request = require("supertest");
const app = require("../index");
const { startServer } = require("../index");

beforeAll(async () => {
  await startServer({ listen: false });
}, 20000);

test("POST /export accepts legacy { title, body } and returns PDF", async () => {
  const req = request(app);

  // simple parser to capture binary buffer
  const parser = (res, cb) => {
    const chunks = [];
    res.on("data", (c) => chunks.push(c));
    res.on("end", () => cb(null, Buffer.concat(chunks)));
  };

  const res = await req
    .post("/export")
    .send({ title: "Test Title", body: "A short body for test." })
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
