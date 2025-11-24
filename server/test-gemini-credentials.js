#!/usr/bin/env node
/**
 * Test script to verify Gemini API credentials and connectivity
 */

const apiUrl = process.env.GEMINI_API_URL;
const apiKey = process.env.GEMINI_API_KEY;

console.log("=== Gemini API Credential Debug ===\n");

console.log("Environment Variables:");
console.log(
  "  GEMINI_API_URL:",
  apiUrl ? apiUrl.substring(0, 50) + "..." : "NOT SET"
);
console.log(
  "  GEMINI_API_KEY:",
  apiKey ? "SET (length=" + apiKey.length + ")" : "NOT SET"
);
console.log("  USE_REAL_AI:", process.env.USE_REAL_AI);
console.log("  FORCE_MOCK_AI:", process.env.FORCE_MOCK_AI);

console.log("\nRequired for real AI:");
if (!apiUrl) console.log("  ❌ GEMINI_API_URL is missing");
if (!apiKey) console.log("  ❌ GEMINI_API_KEY is missing");

if (apiUrl && apiKey) {
  console.log("  ✅ Both credentials present");

  console.log("\nAttempting test API call...");

  const testPayload = {
    contents: [
      {
        parts: [{ text: "Hello, respond with: 'API is working'" }],
      },
    ],
    generationConfig: { maxOutputTokens: 50 },
  };

  const headers = { "Content-Type": "application/json" };
  if (/^AIza[0-9A-Za-z-_]+$/.test(apiKey)) {
    headers["X-goog-api-key"] = apiKey;
  } else if (/^ya29\./.test(apiKey)) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  } else {
    headers["X-goog-api-key"] = apiKey;
  }

  (async () => {
    try {
      let fetchImpl = globalThis.fetch;
      if (!fetchImpl) {
        try {
          ({ fetch: fetchImpl } = require("undici"));
        } catch (e) {
          console.error("No fetch available");
          process.exit(1);
        }
      }

      const resp = await fetchImpl(apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(testPayload),
      });

      console.log("  HTTP Status:", resp.status);
      const raw = await resp.text();

      let json = null;
      try {
        json = JSON.parse(raw);
      } catch (e) {
        console.log("  Response is not JSON:", raw.substring(0, 200));
      }

      if (json?.error) {
        console.log(
          "  ❌ API Error:",
          json.error.message || JSON.stringify(json.error)
        );
      } else if (json?.candidates?.[0]?.content?.parts?.[0]?.text) {
        console.log(
          "  ✅ API Success! Response:",
          json.candidates[0].content.parts[0].text
        );
      } else if (resp.ok) {
        console.log("  ⚠️  HTTP 200 but unexpected response structure:");
        console.log("     ", JSON.stringify(json).substring(0, 200));
      } else {
        console.log("  ❌ HTTP Error:", resp.status);
        console.log("     ", raw.substring(0, 200));
      }
    } catch (err) {
      console.error("  ❌ Network Error:", err.message);
    }
  })();
} else {
  console.log("\n❌ Cannot test API without credentials");
  console.log("\nTo enable real AI testing:");
  console.log(
    "  1. Set GEMINI_API_KEY in your local environment or .env.local"
  );
  console.log(
    "  2. Set GEMINI_API_URL in your local environment or .env.local"
  );
  console.log("  3. Restart the dev container");
  process.exit(1);
}
