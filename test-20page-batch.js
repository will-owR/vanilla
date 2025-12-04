#!/usr/bin/env node

/**
 * Test: 20-page ebook to test batch optimization routing
 * Should use modern batch optimization for 3-20 pages
 */

const http = require("http");

const testPayload = {
  prompt:
    "Write a comprehensive 20-chapter guide about personal growth. Each chapter explores a different aspect of self-improvement and transformation.",
  pageCount: 20,
  theme: "bold",
};

console.log(`\n📖 20-Page Batch Optimization Test\n`);
console.log(`Prompt: ${testPayload.prompt.substring(0, 60)}...\n`);
console.log(`Testing: Should use modern batch optimization (not legacy)\n`);

const options = {
  hostname: "localhost",
  port: 3000,
  path: "/api/ebook/generate",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
};

function request(opts, payload) {
  return new Promise((resolve, reject) => {
    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        resolve({ status: res.statusCode, data, headers: res.headers });
      });
    });
    req.on("error", reject);
    if (payload) {
      req.write(JSON.stringify(payload));
    }
    req.end();
  });
}

async function getJobStatus(jobId) {
  const statusOpts = {
    hostname: "localhost",
    port: 3000,
    path: `/api/ebook/generate/${jobId}/status`,
    method: "GET",
    headers: { "Content-Type": "application/json" },
  };

  const response = await request(statusOpts);
  try {
    return JSON.parse(response.data);
  } catch (e) {
    return { status: "error", message: response.data };
  }
}

async function runTest() {
  try {
    console.log("[1/2] Generating 20-page ebook...");
    const generateResponse = await request(options, testPayload);

    if (generateResponse.status !== 202) {
      console.error(`❌ Generation request failed: ${generateResponse.status}`);
      console.error(generateResponse.data);
      process.exit(1);
    }

    const responseData = JSON.parse(generateResponse.data);
    const jobId = responseData.jobId || responseData.data?.jobId;

    if (!jobId) {
      console.error("❌ No job ID in response:", responseData);
      process.exit(1);
    }

    console.log(`✅ Job created: ${jobId}\n`);
    console.log("[2/2] Polling for completion...\n");

    // Poll for completion
    let completed = false;
    let pollCount = 0;
    const maxPolls = 120; // 120 * 10s = 20 minutes max

    while (!completed && pollCount < maxPolls) {
      await new Promise((r) => setTimeout(r, 10000)); // Wait 10s between polls
      pollCount++;

      const status = await getJobStatus(jobId);

      if (status.progress !== undefined) {
        console.log(
          `[Poll ${pollCount}] Progress: ${status.progress}% - ${
            status.message || ""
          }`
        );
      }

      if (status.state === "completed" || status.status === "completed") {
        completed = true;
        console.log("\n✅ Generation completed!");
        console.log(`📊 Result:`, JSON.stringify(status, null, 2));
      } else if (
        status.state === "failed" ||
        status.status === "failed" ||
        status.error
      ) {
        console.error("\n❌ Generation failed!");
        console.error(`Error: ${status.error || status.message}`);
        process.exit(1);
      }
    }

    if (!completed) {
      console.error("❌ Timeout waiting for generation");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Test error:", error.message);
    process.exit(1);
  }
}

runTest();
