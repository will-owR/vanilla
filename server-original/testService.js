/**
 * @file A simple, predictable service for testing purposes.
 *
 * This service returns a hardcoded, predictable response to any prompt,
 * allowing for reliable end-to-end testing of the service architecture
 * and frontend rendering pipeline.
 */

/**
 * Generates a hardcoded response for a given prompt.
 *
 * @param {object} payload - The prompt payload.
 * @param {string} payload.prompt - The user's prompt text (ignored).
 * @param {string} [payload.requestId] - An optional request ID for tracing.
 * @returns {Promise<object>} A promise that resolves to a standard service response object.
 */
async function generateFromPrompt(payload) {
  const { requestId } = payload;

  const htmlContent = `<h2>Test Service Active</h2><p>Preview is working.</p><p>Request ID: ${requestId}</p>`;

  return {
    content: {
      title: "Test Service Response",
      body: htmlContent,
      html: htmlContent, // Including raw HTML for preview
    },
    metadata: {
      service: "testService",
      timestamp: new Date().toISOString(),
      requestId,
    },
    persistIntents: [], // No persistence for this service
  };
}

export { generateFromPrompt };
