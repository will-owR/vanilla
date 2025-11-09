const os = require("os");
const path = require("path");
const fs = require("fs");
const { openJobsDb, enqueueJob } = require("../jobs");
const { startWorker } = require("../worker-sqlite.mjs");

(async () => {
  const dbPath = path.join(os.tmpdir(), `worker-test-${Date.now()}.db`);
  console.log("DB path:", dbPath);
  const db = await openJobsDb(dbPath);
  const payload = { type: "export", bookId: 42 };
  const id = await enqueueJob(db, payload);
  console.log("Enqueued job id:", id);
  await db.close();

  // Start worker to process one job
  await startWorker({ dbPath, runOnce: true, workerId: "debug-worker" });

  // Re-open DB and inspect
  const db2 = await openJobsDb(dbPath);
  const row = await db2.get("SELECT * FROM jobs WHERE id = ?", id);
  console.log("Job row after worker:", row);
  if (row && row.state === "done") {
    console.log("file_path:", row.file_path);
    console.log("exists:", fs.existsSync(row.file_path));
  }
  await db2.close();
})();
