// Simple mock API adapter for Phase A visual prototype
// Intentionally lightweight and temporary. Exports the same functions the UI imports.

const DEFAULT_LATENCY_MS = (window && window.__MOCK_API_LATENCY_MS) || 300;

function latency(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function makeAbortable(promiseFactory) {
  let aborted = false;
  const controller = {
    abort() {
      aborted = true;
    },
    get signal() {
      return { aborted };
    },
  };

  const promise = new Promise(async (resolve, reject) => {
    try {
      const result = await promiseFactory(() => aborted);
      if (aborted) {
        const err = new Error("AbortError");
        err.name = "AbortError";
        return reject(err);
      }
      resolve(result);
    } catch (err) {
      reject(err);
    }
  });

  return { promise, abort: () => controller.abort() };
}

export async function submitPrompt(prompt) {
  await latency(DEFAULT_LATENCY_MS);
  const title = (prompt || "Mock Title").slice(0, 60);
  return {
    content: {
      title,
      body: `This is mock generated content for prompt: "${title}".\n\nUse this in the preview.`,
      layout: "default",
    },
  };
}

export function loadPreview(content) {
  // Support abortable pattern via returning an object with promise & abort()
  return makeAbortable(async (isAborted) => {
    // simulate work
    await latency(DEFAULT_LATENCY_MS + 100);
    if (isAborted()) {
      const err = new Error("AbortError");
      err.name = "AbortError";
      throw err;
    }

    const safeTitle =
      content && content.title ? escapeHtml(content.title) : "Mock Preview";
    const safeBody =
      content && content.body ? escapeHtml(content.body) : "<p>No body</p>";

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title></head><body><div class="aether-preview"><h1>${safeTitle}</h1><div>${safeBody}</div></div></body></html>`;

    // The UI expects a string of HTML
    return html;
  });
}

export async function exportToPdf(content) {
  // simulate small delay then create a small blob and trigger download
  await latency(DEFAULT_LATENCY_MS + 50);
  const text = `AetherPress mock PDF for: ${
    content && content.title ? content.title : "Untitled"
  }`;
  const blob = new Blob([text], { type: "application/pdf" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `AetherPress-mock-${Date.now()}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
  return { success: true };
}

export async function saveOverride(content, changes) {
  await latency(100);
  return { success: true, applied: changes || {} };
}

export async function startExportJob(content) {
  await latency(100);
  return { jobId: `mock-job-${Date.now()}` };
}

export async function getExportJobStatus(jobId) {
  await latency(100);
  return { jobId, status: "completed", url: null };
}

export function abortableFetch(url, options = {}) {
  // Return an object similar to the real abortableFetch: { promise, abort }
  const { promise, abort } = makeAbortable(async (isAborted) => {
    await latency(DEFAULT_LATENCY_MS);
    if (isAborted()) {
      const err = new Error("AbortError");
      err.name = "AbortError";
      throw err;
    }

    // For preview endpoints return a simple text/html response like object
    return {
      ok: true,
      status: 200,
      text: async () => '<div class="mock">Mock fetch response</div>',
      json: async () => ({
        preview: '<div class="mock">Mock JSON preview</div>',
      }),
      blob: async () => new Blob(["mock"], { type: "application/pdf" }),
    };
  });

  return { promise, abort };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// default export for convenience
export default {
  submitPrompt,
  loadPreview,
  exportToPdf,
  saveOverride,
  startExportJob,
  getExportJobStatus,
  abortableFetch,
};
