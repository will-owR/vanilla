const METRICS = require("./GenerationMetrics");

function generateJsonReport(sessionId) {
  try {
    return METRICS.generateReport(sessionId);
  } catch (e) {
    return { error: e.message };
  }
}

function generateCsvReport(daysOrSessionIds) {
  // If an array provided, pass through; otherwise return CSV for all sessions
  return METRICS.generateCsvReport(daysOrSessionIds);
}

function generateSummaryStats(filter) {
  return METRICS.getStats(filter || {});
}

module.exports = {
  generateJsonReport,
  generateCsvReport,
  generateSummaryStats,
};
