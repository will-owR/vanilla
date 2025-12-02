/**
 * GenerationMetrics
 *
 * Collects and reports metrics for ebook generation sessions.
 * Tracks: latency, API calls, quality indicators, errors
 */

class GenerationMetrics {
  constructor() {
    this.sessions = new Map();
  }

  /**
   * Start a new generation session
   * @returns {string} - Unique session ID
   */
  startSession(ebook) {
    const sessionId = `session-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    this.sessions.set(sessionId, {
      sessionId,
      ebook: {
        title: ebook.title,
        theme: ebook.theme,
        pageCount: ebook.pageCount,
      },
      startTime: Date.now(),
      endTime: null,
      totalLatency: null,
      structure: null,
      pages: [],
      batches: [],
      errors: [],
      fallbacks: [],
      pageCount: 0,
    });

    return sessionId;
  }

  /**
   * Record structure generation
   */
  recordStructure(sessionId, structure, latencyMs) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.structure = {
        contentLength: structure ? structure.length : 0,
        latency: latencyMs,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Record individual page generation
   */
  recordPage(sessionId, pageNumber, latencyMs) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.pages.push({
        pageNumber,
        latency: latencyMs,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Record batch generation
   */
  recordBatch(sessionId, pageNumbers, latencyMs) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.batches.push({
        pages: pageNumbers,
        pageCount: pageNumbers.length,
        latency: latencyMs,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Record page generated via fallback (individual instead of batch)
   */
  recordFallbackPage(sessionId, pageNumber) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.fallbacks.push({
        pageNumber,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Record page that failed to generate
   */
  recordFailedPage(sessionId, pageNumber) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.errors.push({
        type: "page_generation_failed",
        pageNumber,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Record error during session
   */
  recordError(sessionId, error) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.errors.push({
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Finalize session and calculate totals
   */
  finalizeSession(sessionId, pages) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.endTime = Date.now();
      session.totalLatency = session.endTime - session.startTime;
      session.pageCount = pages ? pages.length : 0;
    }
  }

  /**
   * Retrieve session metrics
   * @returns {Object} - Complete session metrics
   */
  getSessionMetrics(sessionId) {
    return this.sessions.get(sessionId);
  }

  /**
   * Calculate total API calls used in session
   */
  calculateApiCalls(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return 0;

    let calls = 0;
    if (session.structure) calls += 1;
    calls += session.pages.length; // Individual pages (Page 1 and N)
    calls += session.batches.length; // Batch calls
    calls += session.fallbacks.length; // Fallback individual pages
    return calls;
  }

  /**
   * Get all sessions
   */
  getAllSessions() {
    return Array.from(this.sessions.values());
  }

  /**
   * Clear old sessions (optional cleanup)
   */
  clearSession(sessionId) {
    this.sessions.delete(sessionId);
  }
}

module.exports = { GenerationMetrics };
