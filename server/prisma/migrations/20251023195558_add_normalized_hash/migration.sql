/*
  Warnings:

  - A unique constraint covering the columns `[normalizedHash]` on the table `Prompt` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Prompt" ADD COLUMN     "normalizedHash" TEXT,
ADD COLUMN     "normalizedText" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Prompt_normalizedHash_key" ON "public"."Prompt"("normalizedHash");
