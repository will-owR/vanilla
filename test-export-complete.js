#!/usr/bin/env node

/**
 * Complete test: Generate ebook AND export to PDF
 * This tests the full pipeline including the export endpoint
 */

const http = require("http");
const https = require("https");

const testPayload = {
  prompt:
    "Write a 3-page mystery story about a detective solving a case. Make it engaging and accessible.",
  pageCount: 3,
  theme: "light",
};

console.log(`\n📖 Complete Pipeline Test (Generate + Export)\n`);
console.log(`Prompt: ${testPayload.prompt.substring(0, 60)}...\n`);

const options = {
  hostname: "localhost",
  port: 3000,
  path: "/api/ebook/generate",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
};

function request(opts) {
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
    return req;
  });
}

async function runTest() {
  try {
    // Step 1: Generate ebook
    console.log("Step 1: Generating ebook...");
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", async () => {
        try {
          const result = JSON.parse(data);

          if (res.statusCode === 202) {
            console.log(`✅ Request accepted (202)`);
            console.log(`   Job ID: ${result.jobId}\n`);

            // Step 2: Poll for completion
            console.log("Step 2: Polling for ebook generation...");
            await pollForCompletion(result.jobId);
          } else {
            console.error(
              `❌ Unexpected status: ${res.statusCode}`,
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

    req.on("error", (e) => {
      console.error(`❌ Request failed: ${e.message}`);
      process.exit(1);
    });

    req.write(JSON.stringify(testPayload));
    req.end();
  } catch (error) {
    console.error(`❌ Test error: ${error.message}`);
    process.exit(1);
  }
}

async function pollForCompletion(jobId) {
  return new Promise((resolve, reject) => {
    let pollCount = 0;
    const pollInterval = setInterval(() => {
      pollCount++;
      const statusOptions = {
        hostname: "localhost",
        port: 3000,
        path: `/api/ebook/status/${jobId}`,
        method: "GET",
      };

      http
        .request(statusOptions, (statusRes) => {
          let statusData = "";
          statusRes.on("data", (chunk) => {
            statusData += chunk;
          });
          statusRes.on("end", async () => {
            try {
              const statusResult = JSON.parse(statusData);
              process.stdout.write(
                `   Poll ${pollCount}: ${statusResult.status}...`
              );

              if (statusResult.status === "completed") {
                clearInterval(pollInterval);
                console.log(" ✅\n");

                // Step 3: Get result
                console.log("Step 3: Fetching ebook result...");
                await getResultAndExport(jobId);
                resolve();
              } else if (
                statusResult.status === "failed" ||
                statusResult.status === "error"
              ) {
                clearInterval(pollInterval);
                console.log(" ❌\n");
                console.error(
                  `Error: ${statusResult.error || statusResult.status}`
                );
                reject(new Error(statusResult.error || "Job failed"));
              } else {
                process.stdout.write("\r");
              }
            } catch (error) {
              clearInterval(pollInterval);
              reject(error);
            }
          });
        })
        .end();
    }, 2000);

    // Timeout after 2 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      reject(new Error("Poll timeout after 2 minutes"));
    }, 120000);
  });
}

async function getResultAndExport(jobId) {
  return new Promise((resolve, reject) => {
    const resultOptions = {
      hostname: "localhost",
      port: 3000,
      path: `/api/ebook/result/${jobId}`,
      method: "GET",
    };

    http
      .request(resultOptions, (resultRes) => {
        let resultData = "";
        resultRes.on("data", (chunk) => {
          resultData += chunk;
        });
        resultRes.on("end", async () => {
          try {
            const finalResult = JSON.parse(resultData);

            if (!finalResult.chapters || finalResult.chapters.length === 0) {
              throw new Error("No chapters in result");
            }

            console.log(`✅ Retrieved ${finalResult.chapters.length} chapters`);
            console.log(
              `   Chapter order: [${finalResult.chapters
                .map((c) => c.chapter)
                .join(", ")}]\n`
            );

            // Step 4: Export to PDF
            console.log("Step 4: Exporting to PDF...");
            exportToPDF(finalResult, resolve, reject);
          } catch (error) {
            reject(error);
          }
        });
      })
      .on("error", reject)
      .end();
  });
}

function exportToPDF(ebookResult, resolve, reject) {
  const exportPayload = {
    pages: ebookResult.chapters.map((ch) => ({
      title: ch.title,
      content: ch.content,
    })),
    metadata: {
      title: ebookResult.title || "Export",
      theme: ebookResult.theme || "light",
    },
  };

  const exportOptions = {
    hostname: "localhost",
    port: 3000,
    path: "/export",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  };

  const req = http.request(exportOptions, (res) => {
    let data = Buffer.alloc(0);
    res.on("data", (chunk) => {
      data = Buffer.concat([data, chunk]);
    });
    res.on("end", () => {
      try {
        if (res.statusCode === 200) {
          const contentType = res.headers["content-type"];
          if (contentType && contentType.includes("application/pdf")) {
            console.log(`✅ Export successful (200 OK)`);
            console.log(`   PDF Size: ${data.length} bytes`);
            console.log(`   Content-Type: ${contentType}\n`);
            console.log(`🎉 Full pipeline test PASSED!\n`);
            resolve();
          } else {
            console.error(
              `❌ Export failed: Wrong content-type: ${contentType}`
            );
            console.error(`Response: ${data.toString().substring(0, 200)}`);
            reject(new Error(`Invalid content-type: ${contentType}`));
          }
        } else {
          console.error(`❌ Export failed with status: ${res.statusCode}`);
          console.error(`Response: ${data.toString().substring(0, 500)}`);
          reject(new Error(`Export failed: ${res.statusCode}`));
        }
      } catch (error) {
        reject(error);
      }
    });
  });

  req.on("error", (error) => {
    console.error(`❌ Export request failed: ${error.message}`);
    reject(error);
  });

  console.log("   Sending export request...");
  req.write(JSON.stringify(exportPayload));
  req.end();
}

runTest().catch((error) => {
  console.error(`❌ Test failed: ${error.message}`);
  process.exit(1);
});
