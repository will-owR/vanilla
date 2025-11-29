/**
 * inputRouter - PDF rendering path routing
 *
 * Determines which rendering strategy to use based on input data.
 * Single responsibility: make routing decision.
 *
 * Priority (Complete > Partial):
 * 1. Full HTML (complete document)
 * 2. Stack-based (envelope.pages array)
 * 3. Body wrapper (legacy fallback)
 * 4. Error (no valid path)
 */

/**
 * Route input to appropriate rendering strategy
 *
 * Examines the input data and determines which rendering strategy should be used.
 * Returns the strategy and the input data for that strategy.
 *
 * @param {Object} data - Input data (could contain body, envelope, html, pages)
 * @returns {Object} { strategy: string, renderer: function, input: any }
 * @throws {Error} If no valid rendering path found
 *
 * @example
 * const data = { body: '<html>...</html>', envelope: { pages: [...] } };
 * const route = routeInput(data);
 * // Returns { strategy: 'full-html', renderer: renderFullHTML, input: htmlString }
 */
function routeInput(data) {
  // Priority 1: Full HTML (complete, best quality, preferred)
  if (
    data.body &&
    String(data.body).trim().toLowerCase().startsWith("<!doctype")
  ) {
    console.log(
      "[inputRouter] Routing: Using full HTML (PRIORITY 1 - Complete)"
    );
    return {
      strategy: "full-html",
      name: "Full HTML Rendering",
      input: data.body,
    };
  }

  // Priority 2: Stack-based pages (reconstruct from parts, fallback)
  if (
    data.envelope &&
    Array.isArray(data.envelope.pages) &&
    data.envelope.pages.length > 0
  ) {
    console.log(
      "[inputRouter] Routing: Using stack-based rendering (PRIORITY 2 - Reconstruct)"
    );
    return {
      strategy: "stack-based",
      name: "Stack-based Rendering",
      input: data.envelope,
    };
  }

  // Priority 3: Body wrapper (legacy, minimal processing)
  if (data.body && typeof data.body === "string") {
    console.log(
      "[inputRouter] Routing: Using body wrapper (PRIORITY 3 - Legacy)"
    );
    return {
      strategy: "wrapped",
      name: "Wrapped Body Rendering",
      input: data.body,
    };
  }

  // Priority 4: No valid path
  throw new Error(
    "Invalid PDF input: no valid rendering path. " +
      "Expected one of: (1) data.body with <!doctype>, (2) data.envelope.pages array, or (3) data.body string"
  );
}

/**
 * Get routing information for debugging/logging
 *
 * Returns information about routing priorities and strategies.
 *
 * @returns {Object} Routing information with priorities and descriptions
 */
function getRoutingInfo() {
  return {
    priorities: [
      {
        order: 1,
        strategy: "full-html",
        format: "body string starting with <!doctype",
        description: "Full HTML document (best quality, preferred)",
        reason: "Complete document is preferred over reconstruction",
      },
      {
        order: 2,
        strategy: "stack-based",
        format: "envelope.pages array",
        description: "Stack-based reconstruction from pages",
        reason: "Reconstruct from structured pages when full HTML unavailable",
      },
      {
        order: 3,
        strategy: "wrapped",
        format: "body string (any content)",
        description: "Wrap body content in basic HTML",
        reason: "Legacy fallback for simple content",
      },
    ],
    principle: "Prefer complete over partial, specific over generic",
  };
}

module.exports = {
  routeInput,
  getRoutingInfo,
};
