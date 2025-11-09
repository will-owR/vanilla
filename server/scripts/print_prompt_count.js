#!/usr/bin/env node
// Simple utility to print the total Prompt row count.
// Usage: DATABASE_URL=... node server/scripts/print_prompt_count.js

async function main() {
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();

  try {
    const total = await prisma.prompt.count();
    const now = new Date().toISOString();
    console.log(
      JSON.stringify({ timestamp: now, promptCount: total }, null, 2)
    );
  } catch (e) {
    console.error("Failed to get prompt count:", e && e.message);
    process.exitCode = 2;
  } finally {
    try {
      await prisma.$disconnect();
    } catch (e) {}
  }
}

if (require.main === module) main();
