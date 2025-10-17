/**
 * Simple envelope helper for server plumbing
 */
function composeEnvelope({
  sessionId,
  correlationId,
  origin,
  recipientService,
  payload,
  meta,
} = {}) {
  return {
    sessionId: sessionId || "demo",
    correlationId: correlationId || String(Date.now()),
    origin: origin || "frontend",
    recipientService: recipientService || null,
    payload: payload || {},
    meta: Object.assign(
      { timestamp: new Date().toISOString(), trace: [] },
      meta || {}
    ),
  };
}

function appendTrace(envelope, traceItem) {
  envelope.meta = envelope.meta || {};
  envelope.meta.trace = envelope.meta.trace || [];
  envelope.meta.trace.push(traceItem);
}

module.exports = { composeEnvelope, appendTrace };
