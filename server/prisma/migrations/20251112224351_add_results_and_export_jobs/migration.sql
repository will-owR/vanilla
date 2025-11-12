-- CreateTable
CREATE TABLE "results" (
    "id" SERIAL NOT NULL,
    "resultId" UUID NOT NULL,
    "outEnvelope" JSONB NOT NULL,
    "mode" VARCHAR(50) NOT NULL,
    "promptId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_jobs" (
    "id" SERIAL NOT NULL,
    "jobId" UUID NOT NULL,
    "resultId" UUID NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'queued',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "pdfPath" VARCHAR(500),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "export_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "results_resultId_key" ON "results"("resultId");

-- CreateIndex
CREATE INDEX "results_resultId_idx" ON "results"("resultId");

-- CreateIndex
CREATE INDEX "results_createdAt_idx" ON "results"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "export_jobs_jobId_key" ON "export_jobs"("jobId");

-- CreateIndex
CREATE INDEX "export_jobs_jobId_idx" ON "export_jobs"("jobId");

-- CreateIndex
CREATE INDEX "export_jobs_resultId_idx" ON "export_jobs"("resultId");

-- CreateIndex
CREATE INDEX "export_jobs_status_idx" ON "export_jobs"("status");

-- CreateIndex
CREATE INDEX "export_jobs_createdAt_idx" ON "export_jobs"("createdAt");

-- AddForeignKey
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "results"("resultId") ON DELETE RESTRICT ON UPDATE CASCADE;
