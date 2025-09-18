import Logger from "./logger";

// API utilities with retry logic
const DEFAULT_CONFIG = {
  maxRetries: 3,
  initialBackoffMs: 1000,
  maxBackoffMs: 10000,
  retryableStatuses: [401, 408, 429, 500, 502, 503, 504],
};

async function fetchWithRetry(url, options = {}) {
  const config = {
    ...DEFAULT_CONFIG,
    ...options.retryConfig,
  };
  delete options.retryConfig;

  const endpoint = new URL(url, window.location.origin).pathname;
  const method = options.method || "GET";

  Logger.apiRequest(endpoint, method, {
    config,
    headers: options.headers,
  });

  let lastError;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Log the response
      Logger.apiResponse(endpoint, response.status, {
        attempt,
        ok: response.ok,
      });

      // Successful response
      if (response.ok) return response;

      // Check if we should retry based on status
      if (config.retryableStatuses.includes(response.status)) {
        if (attempt < config.maxRetries) {
          // Calculate backoff with jitter
          const backoff = Math.min(
            config.maxBackoffMs,
            config.initialBackoffMs * Math.pow(2, attempt - 1)
          );
          const jitter = Math.random() * 100;
          const nextAttemptIn = Math.round((backoff + jitter) / 1000);

          Logger.apiRetry(endpoint, attempt, config.maxRetries, {
            status: response.status,
            nextAttemptIn,
          });

          await new Promise((resolve) => setTimeout(resolve, backoff + jitter));
          continue;
        }
      }

      return response;
    } catch (error) {
      lastError = error;

      Logger.apiError(endpoint, error, {
        attempt,
        maxRetries: config.maxRetries,
      });

      if (attempt === config.maxRetries) throw error;

      const backoff = Math.min(
        config.maxBackoffMs,
        config.initialBackoffMs * Math.pow(2, attempt - 1)
      );

      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }

  throw lastError;
}

// API endpoints
export async function submitPrompt(prompt) {
  Logger.debug("Submitting prompt", { prompt });

  try {
    const response = await fetchWithRetry("/prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
      retryConfig: {
        maxRetries: 3,
        retryableStatuses: [401], // Focus on auth errors
      },
    });

    if (!response.ok) {
      const error = new Error(`Error: ${response.status}`);
      Logger.error("Prompt submission failed", {
        error,
        status: response.status,
      });
      throw error;
    }

    const data = await response.json();
    Logger.info("Prompt submitted successfully", {
      promptLength: prompt.length,
    });
    return data;
  } catch (error) {
    Logger.error("Prompt submission error", { error });
    throw error;
  }
}

export async function loadPreview(content) {
  Logger.debug("Loading preview", {
    contentKeys: content ? Object.keys(content) : "no content",
  });

  // Ensure content has required structure
  if (!content || !content.title || !content.body) {
    const error = new Error("Preview content must include title and body");
    Logger.error("Preview validation failed", {
      error,
      providedFields: content ? Object.keys(content) : [],
      required: ["title", "body"],
    });
    throw error;
  }

  try {
    const formattedContent = {
      title: content.title,
      body: content.body,
      layout: content.layout || "default",
    };

    Logger.debug("Requesting preview", { formattedContent });

    const payloadStr = JSON.stringify(formattedContent);
    let response;

    // For large payloads, prefer POST /api/preview which returns JSON { preview }
    if (payloadStr.length > 2000) {
      response = await fetchWithRetry("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payloadStr,
        retryConfig: { maxRetries: 3, retryableStatuses: [500, 503] },
      });
      if (!response.ok) {
        const error = new Error(`Preview failed: ${response.status}`);
        Logger.error("Preview request failed", {
          error,
          status: response.status,
        });
        throw error;
      }
      const json = await response.json();
      const previewHtml = json.preview || "";
      Logger.info("Preview loaded successfully", {
        contentLength: previewHtml.length,
        layout: formattedContent.layout,
      });
      return previewHtml;
    }

    // Small payloads: use GET /preview query param for quickness
    response = await fetchWithRetry(
      `/preview?content=${encodeURIComponent(payloadStr)}`,
      {
        retryConfig: {
          maxRetries: 3,
          retryableStatuses: [500, 503],
        },
      }
    );

    if (!response.ok) {
      const error = new Error(`Preview failed: ${response.status}`);
      Logger.error("Preview request failed", {
        error,
        status: response.status,
      });
      throw error;
    }

    const previewHtml = await response.text();
    Logger.info("Preview loaded successfully", {
      contentLength: previewHtml.length,
      layout: formattedContent.layout,
    });
    return previewHtml;
  } catch (error) {
    Logger.error("Preview loading error", { error });
    throw error;
  }
}

export async function saveOverride(content, changes) {
  Logger.debug("Saving override", {
    originalContent: content ? Object.keys(content) : "no content",
    changeKeys: changes ? Object.keys(changes) : "no changes",
  });

  try {
    const response = await fetchWithRetry("/override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, changes }),
      retryConfig: {
        maxRetries: 3,
        retryableStatuses: [500, 503], // Server errors most likely for override
      },
    });

    if (!response.ok) {
      const error = new Error(`Override failed: ${response.status}`);
      Logger.error("Override request failed", {
        error,
        status: response.status,
      });
      throw error;
    }

    const result = await response.json();
    Logger.info("Override saved successfully", {
      changedFields: changes ? Object.keys(changes) : [],
    });
    return result;
  } catch (error) {
    Logger.error("Override save error", { error });
    throw error;
  }
}

export async function exportToPdf(content) {
  Logger.debug("Exporting to PDF", {
    contentKeys: content ? Object.keys(content) : "no content",
  });

  if (!content || !content.title || !content.body) {
    const error = new Error("Export content must include title and body");
    Logger.error("Export validation failed", { error });
    throw error;
  }

  try {
    const response = await fetchWithRetry("/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(content),
    });

    if (!response.ok) {
      const error = new Error(`Export failed: ${response.status}`);
      Logger.error("Export request failed", { error, status: response.status });
      throw error;
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AetherPress-Export-${Date.now()}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();

    Logger.info("PDF exported successfully");
  } catch (error) {
    Logger.error("PDF export error", { error });
    throw error;
  }
}
