#!/usr/bin/env node

/**
 * Test script to verify chapter misalignment fix
 * Tests 10-page ebook generation with DEBUG_BATCH enabled
 * Checks:
 * 1. All chapters present (1-10)
 * 2. No "undefined" text in output
 * 3. Chapters in correct order
 * 4. Metadata fields sanitized
 */

const http = require("http");

const testPayload = {
  prompt:
    "Write a 10-page comprehensive guide on Artificial Intelligence and its impact on society, covering history, techniques, applications, ethics, and future implications. Make it informative and accessible for general readers.",
  pageCount: 10,
  theme: "light",
};

console.log(`\n📖 Testing Chapter Misalignment Fix (10-page ebook)\n`);
console.log(`Prompt: ${testPayload.prompt.substring(0, 80)}...\n`);

const options = {
  hostname: "localhost",
  port: 3000,
  path: "/api/ebook/generate",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
};

const req = http.request(options, (res) => {
  let data = "";

  res.on("data", (chunk) => {
    data += chunk;
  });

  res.on("end", () => {
    try {
      const result = JSON.parse(data);

      if (res.statusCode === 202) {
        console.log(`✅ Request accepted (202 Accepted)`);
        console.log(`   Job ID: ${result.jobId}\n`);
        console.log(
          `   Polling for result... (check server logs for [BatchOptimization] output)\n`
        );

        // Poll for job completion
        let pollCount = 0;
        const pollInterval = setInterval(() => {
          pollCount++;
          const statusOptions = {
            hostname: "localhost",
            port: 3000,
            path: `/api/ebook/status/${result.jobId}`,
            method: "GET",
          };

          http
            .request(statusOptions, (statusRes) => {
              let statusData = "";
              statusRes.on("data", (chunk) => {
                statusData += chunk;
              });
              statusRes.on("end", () => {
                const statusResult = JSON.parse(statusData);
                process.stdout.write(
                  `   Poll ${pollCount}: ${statusResult.status}`
                );

                if (statusResult.status === "completed") {
                  clearInterval(pollInterval);
                  console.log(" ✅\n");

                  // Get final result
                  const resultOptions = {
                    hostname: "localhost",
                    port: 3000,
                    path: `/api/ebook/result/${result.jobId}`,
                    method: "GET",
                  };

                  http
                    .request(resultOptions, (resultRes) => {
                      let resultData = "";
                      resultRes.on("data", (chunk) => {
                        resultData += chunk;
                      });
                      resultRes.on("end", () => {
                        const finalResult = JSON.parse(resultData);
                        verifyResult(finalResult);
                      });
                    })
                    .end();
                } else if (
                  statusResult.status === "failed" ||
                  statusResult.status === "error"
                ) {
                  clearInterval(pollInterval);
                  console.log(" ❌\n");
                  console.error(
                    `Error: ${statusResult.error || statusResult.status}`
                  );
                  process.exit(1);
                } else {
                  process.stdout.write("...\r");
                }
              });
            })
            .end();
        }, 2000);

        // Timeout after 2 minutes
        setTimeout(() => {
          if (pollInterval) {
            clearInterval(pollInterval);
            console.error("❌ Test timeout after 2 minutes");
            process.exit(1);
          }
        }, 120000);
      } else if (res.statusCode === 200) {
        console.log(`✅ Ebook generated (200 OK)\n`);
        verifyResult(result);
      } else {
        console.error(
          `❌ Unexpected status: ${res.statusCode}\n`,
          JSON.stringify(result, null, 2)
        );
        process.exit(1);
      }
    } catch (error) {
      console.error(`❌ Parse error: ${error.message}`);
      console.error(`Response: ${data}`);
      process.exit(1);
    }
  });
});

function verifyResult(result) {
  console.log(`\n📋 Verification Results:\n`);

  // Check if chapters exist
  if (!result.chapters || result.chapters.length === 0) {
    console.error(`❌ No chapters in result`);
    process.exit(1);
  }

  console.log(`✅ Chapters present: ${result.chapters.length}`);

  // Check chapter count
  const expectedChapters = 10;
  if (result.chapters.length !== expectedChapters) {
    console.error(
      `❌ Expected ${expectedChapters} chapters, got ${result.chapters.length}`
    );
    process.exit(1);
  }

  console.log(`✅ Correct chapter count: ${expectedChapters}`);

  // Check chapter order
  const chapterNumbers = result.chapters.map((ch) => ch.chapter);
  console.log(`   Order: [${chapterNumbers.join(", ")}]`);

  let orderCorrect = true;
  for (let i = 0; i < chapterNumbers.length; i++) {
    if (chapterNumbers[i] !== i + 1) {
      orderCorrect = false;
      break;
    }
  }

  if (!orderCorrect) {
    console.error(`❌ Chapters not in correct order`);
    process.exit(1);
  }

  console.log(`✅ Chapters in correct order (1-10)`);

  // Check for undefined text
  let hasUndefined = false;
  let undefinedCount = 0;

  result.chapters.forEach((ch, idx) => {
    const chapterText = JSON.stringify(ch);
    if (chapterText.includes("undefined")) {
      hasUndefined = true;
      undefinedCount++;
      console.error(`   ⚠️  Chapter ${idx + 1}: Contains "undefined"`);
    }
  });

  if (hasUndefined) {
    console.error(`❌ Found "undefined" text in ${undefinedCount} chapters`);
    process.exit(1);
  }

  console.log(`✅ No "undefined" text found in chapters`);

  // Check metadata sanitization
  let metadataIssues = [];
  result.chapters.forEach((ch, idx) => {
    if (ch.metadata) {
      if (
        ch.metadata.voice === "undefined" ||
        ch.metadata.voice === undefined
      ) {
        metadataIssues.push(`Chapter ${idx + 1}: voice field`);
      }
      if (ch.metadata.tone === "undefined" || ch.metadata.tone === undefined) {
        metadataIssues.push(`Chapter ${idx + 1}: tone field`);
      }
      if (!Array.isArray(ch.metadata.themes)) {
        metadataIssues.push(`Chapter ${idx + 1}: themes not an array`);
      }
    }
  });

  if (metadataIssues.length > 0) {
    console.error(`❌ Metadata sanitization issues:`);
    metadataIssues.forEach((issue) => console.error(`   ${issue}`));
    process.exit(1);
  }

  console.log(`✅ Metadata properly sanitized`);

  // Success!
  console.log(`\n🎉 All tests passed!\n`);
  process.exit(0);
}

req.on("error", (e) => {
  console.error(`❌ Request failed: ${e.message}`);
  process.exit(1);
});

req.write(JSON.stringify(testPayload));
req.end();
