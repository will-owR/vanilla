import Logger from "./logger";

// Phase-A branch convenience: prefer the mock adapter if it exists locally.
// This allows us to swap in the mock without changing component imports.
let mock;
try {
  // eslint-disable-next-line import/no-unresolved
  // This dynamic require will only succeed on branches that include the mock file.
  // Use require so bundlers that do static analysis won't break on non-branch builds.
  // @ts-ignore
  mock = require("../mocks/mockApi");
} catch (e) {
  mock = null;
}

// API utilities with retry logic
const DEFAULT_CONFIG = {
  maxRetries: 3,
  initialBackoffMs: 1000,
  maxBackoffMs: 10000,
  // Do NOT retry on 401 by default — auth failures should surface immediately.
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

// Enhanced fetch that supports AbortController and per-call retryConfig.
// Returns a Promise that resolves with the Response (or rejects on error/abort).
async function fetchWithRetry(url, options = {}) {
  const config = {
    ...DEFAULT_CONFIG,
    ...(options.retryConfig || {}),
  };
  // allow callers to pass an AbortSignal via options.signal
  const signal = options.signal;
  delete options.retryConfig;

  const endpoint = new URL(url, window.location.origin).pathname;
  const method = options.method || "GET";

  Logger.apiRequest(endpoint, method, {
    config,
    headers: options.headers,
  });

  let lastError;

  for (let attempt = 1; attempt <= Math.max(1, config.maxRetries); attempt++) {
    try {
      const response = await fetch(url, { ...options, signal });

      Logger.apiResponse(endpoint, response.status, {
        attempt,
        ok: response.ok,
      });

      if (response.ok) return response;

      if (
        config.retryableStatuses.includes(response.status) &&
        attempt < config.maxRetries
      ) {
        const backoff = Math.min(
          config.maxBackoffMs,
          config.initialBackoffMs * Math.pow(2, attempt - 1)
        );
        const jitter = Math.random() * 100;
        Logger.apiRetry(endpoint, attempt, config.maxRetries, {
          status: response.status,
          nextAttemptIn: Math.round((backoff + jitter) / 1000),
        });
        await new Promise((resolve) => setTimeout(resolve, backoff + jitter));
        continue;
      }

      return response;
    } catch (error) {
      // Abort errors should propagate immediately
      if (error && error.name === "AbortError") {
        Logger.apiError(endpoint, error, { attempt: "abort" });
        throw error;
      }

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

// Helper: returns { promise, abort } where abort() cancels the request.
export function abortableFetch(url, options = {}) {
  // If a branch-local mock provides an abortableFetch implementation, prefer it.
  if (mock && mock.abortableFetch) {
    try {
      return mock.abortableFetch(url, options);
    } catch (e) {
      // fall through to real implementation on error
    }
  }

  const controller = new AbortController();
  const signal = controller.signal;
  const promise = fetchWithRetry(url, { ...options, signal });
  return { promise, abort: () => controller.abort() };
}

// API endpoints
export async function submitPrompt(prompt) {
  if (mock && mock.submitPrompt) return mock.submitPrompt(prompt);
  Logger.debug("Submitting prompt", { prompt });

  try {
    const response = await fetchWithRetry("/prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
      // Use default retry behaviour; do not retry on 401 so auth errors
      // are surfaced to the UI immediately.
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
  if (mock && mock.loadPreview) {
    const res = mock.loadPreview(content);
    // mock.loadPreview might return an abortable { promise, abort } or a direct promise/string
    if (res && typeof res.then !== "function" && res.promise) {
      return await res.promise;
    }
    return await res;
  }
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
  if (mock && mock.saveOverride) return mock.saveOverride(content, changes);
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
  if (mock && mock.exportToPdf) return mock.exportToPdf(content);
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

// Background export job API helpers
export async function startExportJob(content) {
  if (mock && mock.startExportJob) return mock.startExportJob(content);
  if (!content || !content.title || !content.body) {
    throw new Error("Export content must include title and body");
  }

  const response = await fetchWithRetry("/api/export/job", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(content),
  });
  if (!response.ok)
    throw new Error(`Failed to start export job: ${response.status}`);
  return response.json(); // { jobId }
}

export async function getExportJobStatus(jobId) {
  if (mock && mock.getExportJobStatus) return mock.getExportJobStatus(jobId);
  if (!jobId) throw new Error("jobId required");
  const response = await fetchWithRetry(
    `/api/export/job/${encodeURIComponent(jobId)}`,
    {}
  );
  if (!response.ok)
    throw new Error(`Failed to fetch job status: ${response.status}`);
  return response.json();
}
