/* eslint-disable no-undef */
const http = require("http");
const request = require("supertest");

// Start a tiny mock server to simulate client-v2 dev server
let mockServer;
let mockPort;

beforeAll(async () => {
  mockServer = http.createServer((req, res) => {
    if (req.url && req.url.startsWith("/preview")) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<div id=client-v2>Client V2 Preview</div>");
      return;
    }
    res.writeHead(404);
    res.end("not found");
  });
  await new Promise((resolve, reject) => {
    mockServer.listen(0, "127.0.0.1", () => {
      try {
        mockPort = mockServer.address().port;
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  });
});

afterAll(async () => {
  if (!mockServer) return;
  await new Promise((resolve) => mockServer.close(() => resolve()));
});

test("GET /preview proxies to client-v2 when enabled", async () => {
  // Ensure env is set for proxy behavior
  process.env.PREVIEW_CLIENT_V2_ENABLED = "1";
  process.env.CLIENT_V2_PROXY_URL = `http://127.0.0.1:${mockPort}`;

  // Load server and start without binding to network
  const appModule = require("../index");
  await appModule.startServer({ listen: false });

  const res = await request(appModule).get(
    "/preview?content=%7B%22title%22%3A%22x%22%2C%22body%22%3A%22y%22%7D"
  );
  expect(res.statusCode).toBe(200);
  expect(res.text).toMatch(/Client V2 Preview/);
});
