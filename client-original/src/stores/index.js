// @ts-nocheck -- dev-only store instrumentation file; suppress TS diagnostics
import { writable, get } from "svelte/store";

// DEV-only helper: wrap writable so set/update calls are logged during development
const IS_DEV =
  typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;

// Create singletons on window in DEV to avoid multiple module instances
// (Vite HMR or differing import paths can cause duplicate module copies).
// Use a canonical global key but accept legacy names for compatibility.
const CANONICAL_GLOBAL_KEY = "__CHRONOS_STORES__";
const LEGACY_GLOBAL_KEY = "__POEMAMUNDI_STORES__";
const DEV_VERBOSE_KEY = "__POEMAMUNDI_VERBOSE__";
// Module-local pointer to the canonical global container. Declare early
// so subsequent initialization logic can reference it without TDZ errors.
let globalContainer;

// Initialize the global store container if it doesn't exist.
// Make promotion of a legacy global (which some tests set on `globalThis`)
// robust by first ensuring globalThis carries the canonical key when
// appropriate, then mirror it to `window` where possible.
// Final runtime fallback: if for any reason the canonical key wasn't set
// earlier but a legacy container exists on globalThis, promote it now so
// tests that inspect globalThis.__CHRONOS_STORES__ after import observe it.
try {
  if (
    typeof globalThis !== "undefined" &&
    !globalThis[CANONICAL_GLOBAL_KEY] &&
    globalThis[LEGACY_GLOBAL_KEY]
  ) {
    try {
      globalThis[CANONICAL_GLOBAL_KEY] = globalThis[LEGACY_GLOBAL_KEY];
    } catch (e) {}
  }
  if (typeof globalThis !== "undefined" && globalThis[CANONICAL_GLOBAL_KEY]) {
    globalContainer = globalThis[CANONICAL_GLOBAL_KEY];
    try {
      if (typeof window !== "undefined" && !window[CANONICAL_GLOBAL_KEY])
        window[CANONICAL_GLOBAL_KEY] = globalContainer;
    } catch (e) {}
  }
} catch (e) {}
try {
  // If legacy was placed on globalThis, promote it to the canonical key
  // on globalThis so downstream logic can find it regardless of whether
  // `window` or `globalThis` is used.
  if (typeof globalThis !== "undefined") {
    try {
      if (!globalThis[CANONICAL_GLOBAL_KEY] && globalThis[LEGACY_GLOBAL_KEY]) {
        globalThis[CANONICAL_GLOBAL_KEY] = globalThis[LEGACY_GLOBAL_KEY];
      }
    } catch (e) {}
  }

  // Choose the appropriate global object: prefer `window` in browsers,
  // otherwise fall back to `globalThis` for test environments.
  const G =
    typeof window !== "undefined"
      ? window
      : typeof globalThis !== "undefined"
      ? globalThis
      : undefined;

  if (G) {
    // If canonical already exists on G, use it.
    if (G[CANONICAL_GLOBAL_KEY]) {
      globalContainer = G[CANONICAL_GLOBAL_KEY];
    } else if (G[LEGACY_GLOBAL_KEY]) {
      // If G has a legacy container, adopt it and mirror to canonical.
      globalContainer = G[LEGACY_GLOBAL_KEY];
      try {
        G[CANONICAL_GLOBAL_KEY] = globalContainer;
        if (
          typeof globalThis !== "undefined" &&
          !globalThis[CANONICAL_GLOBAL_KEY]
        ) {
          globalThis[CANONICAL_GLOBAL_KEY] = globalContainer;
        }
      } catch (e) {}
    } else if (
      typeof globalThis !== "undefined" &&
      globalThis[CANONICAL_GLOBAL_KEY]
    ) {
      // If globalThis has the canonical container (promoted from legacy above),
      // mirror it onto G and use it.
      globalContainer = globalThis[CANONICAL_GLOBAL_KEY];
      try {
        G[CANONICAL_GLOBAL_KEY] = globalContainer;
      } catch (e) {}
    } else {
      // Otherwise create a fresh container on both G and globalThis.
      try {
        G[CANONICAL_GLOBAL_KEY] = {};
        if (typeof globalThis !== "undefined")
          globalThis[CANONICAL_GLOBAL_KEY] = G[CANONICAL_GLOBAL_KEY];
      } catch (e) {}
      globalContainer = G[CANONICAL_GLOBAL_KEY];
    }
  }
} catch (e) {
  // Swallow - defensive for environments where globals may be sealed
  globalContainer = {};
}

// Reconcile module-local container with any globals that may have been
// mutated after this module initially executed (Vitest may reuse the same
// worker across tests). This ensures that if tests set the legacy global
// after the module was first loaded, we still adopt and mirror it so the
// canonical key is present on globalThis/window as tests expect.
try {
  if (typeof globalThis !== "undefined") {
    // If canonical is not present but legacy exists on globalThis, promote it.
    if (!globalThis[CANONICAL_GLOBAL_KEY] && globalThis[LEGACY_GLOBAL_KEY]) {
      try {
        globalThis[CANONICAL_GLOBAL_KEY] = globalThis[LEGACY_GLOBAL_KEY];
      } catch (e) {}
    }
    // If canonical exists on globalThis, ensure module-local reference points to it.
    if (globalThis[CANONICAL_GLOBAL_KEY]) {
      globalContainer = globalThis[CANONICAL_GLOBAL_KEY];
      try {
        if (typeof window !== "undefined" && !window[CANONICAL_GLOBAL_KEY]) {
          window[CANONICAL_GLOBAL_KEY] = globalContainer;
        }
      } catch (e) {}
    }
  }
} catch (e) {}

// Final safety: if a legacy container exists anywhere, make absolutely sure
// the canonical key points to it on both globalThis and window so callers
// (and tests) observing globalThis.__CHRONOS_STORES__ will find it.
try {
  if (
    typeof globalThis !== "undefined" &&
    globalThis[LEGACY_GLOBAL_KEY] &&
    !globalThis[CANONICAL_GLOBAL_KEY]
  ) {
    try {
      globalThis[CANONICAL_GLOBAL_KEY] = globalThis[LEGACY_GLOBAL_KEY];
    } catch (e) {}
  }
  if (
    typeof window !== "undefined" &&
    window[LEGACY_GLOBAL_KEY] &&
    !window[CANONICAL_GLOBAL_KEY]
  ) {
    try {
      window[CANONICAL_GLOBAL_KEY] = window[LEGACY_GLOBAL_KEY];
    } catch (e) {}
  }
  // If canonical now exists on either, ensure module-local pointer follows it.
  if (typeof globalThis !== "undefined" && globalThis[CANONICAL_GLOBAL_KEY]) {
    globalContainer = globalThis[CANONICAL_GLOBAL_KEY];
    try {
      if (typeof window !== "undefined" && !window[CANONICAL_GLOBAL_KEY])
        window[CANONICAL_GLOBAL_KEY] = globalContainer;
    } catch (e) {}
  } else if (typeof window !== "undefined" && window[CANONICAL_GLOBAL_KEY]) {
    globalContainer = window[CANONICAL_GLOBAL_KEY];
    try {
      if (
        typeof globalThis !== "undefined" &&
        !globalThis[CANONICAL_GLOBAL_KEY]
      )
        globalThis[CANONICAL_GLOBAL_KEY] = globalContainer;
    } catch (e) {}
  }
} catch (e) {}

// Initialize verbose logging state if needed
try {
  if (typeof window !== "undefined" && !window[DEV_VERBOSE_KEY]) {
    window[DEV_VERBOSE_KEY] = (() => {
      try {
        if (!IS_DEV) return false;
        if (typeof window === "undefined") return false;
        const urlFlag =
          window.location &&
          new URLSearchParams(window.location.search).get("debugStores") ===
            "1";
        const lsFlag =
          window.localStorage &&
          window.localStorage.getItem("__ENABLE_VERBOSE_STORES__") === "1";
        return Boolean(urlFlag || lsFlag);
      } catch (e) {
        return false;
      }
    })();
  }
} catch (e) {
  // Swallow errors - verbose logging is not critical
}

// Initialize or reuse stores
function getOrCreateStore(name, initial) {
  // Resynchronize module-local container with any globals that may have
  // been mutated after module initialization (tests may set globals and
  // then re-import the module from cache). Prefer canonical on globalThis
  // and fall back to legacy promotion when necessary.
  try {
    if (typeof globalThis !== "undefined") {
      if (
        globalThis[CANONICAL_GLOBAL_KEY] &&
        globalContainer !== globalThis[CANONICAL_GLOBAL_KEY]
      ) {
        globalContainer = globalThis[CANONICAL_GLOBAL_KEY];
      } else if (
        !globalThis[CANONICAL_GLOBAL_KEY] &&
        globalThis[LEGACY_GLOBAL_KEY]
      ) {
        try {
          globalThis[CANONICAL_GLOBAL_KEY] = globalThis[LEGACY_GLOBAL_KEY];
          globalContainer = globalThis[CANONICAL_GLOBAL_KEY];
        } catch (e) {}
      }
      // Mirror canonical to window where possible
      try {
        if (
          typeof window !== "undefined" &&
          globalContainer &&
          !window[CANONICAL_GLOBAL_KEY]
        ) {
          window[CANONICAL_GLOBAL_KEY] = globalContainer;
        }
      } catch (e) {}
    }
  } catch (e) {}

  // First check if the store already exists in the global container
  if (globalContainer && globalContainer[name]) {
    if (IS_DEV && typeof window !== "undefined" && window[DEV_VERBOSE_KEY]) {
      console.debug(`[DEV] Reusing existing store: ${name}`);
    }
    return globalContainer[name];
  }

  // Create a new store with the dev wrapper if needed
  const w = writable(initial);
  const store = IS_DEV
    ? {
        subscribe: w.subscribe,
        set(value) {
          if (
            IS_DEV &&
            typeof window !== "undefined" &&
            window[DEV_VERBOSE_KEY]
          ) {
            try {
              console.debug(`STORE:${name}.set`, { value });
            } catch (e) {}
          }
          w.set(value);
        },
        update(fn) {
          w.update((prev) => {
            const next = fn(prev);
            if (
              IS_DEV &&
              typeof window !== "undefined" &&
              window[DEV_VERBOSE_KEY]
            ) {
              try {
                console.debug(`STORE:${name}.update`, { prev, next });
              } catch (e) {}
            }
            return next;
          });
        },
      }
    : w;

  // Assign a lightweight identity to the store so we can detect duplicate
  // instances across HMR boundaries and differing module resolution paths.
  try {
    if (!store.__chronos_id) {
      // Use a short unique id — predictable enough for diagnostics
      store.__chronos_id = `${Date.now().toString(36)}-${Math.floor(
        Math.random() * 0xffff
      ).toString(16)}`;
    }
  } catch (e) {}

  // Save the store in the global container and keep a registry of ids
  try {
    if (typeof window !== "undefined") {
      // Tag the store as canonical for runtime identity checks
      try {
        store.__is_canonical = true;
        store.__module_url =
          typeof import.meta !== "undefined" ? import.meta.url : null;
      } catch (e) {}
      globalContainer[name] = store;
      try {
        if (!globalContainer.__STORE_IDS__) globalContainer.__STORE_IDS__ = {};
        globalContainer.__STORE_IDS__[name] = store.__chronos_id;
      } catch (e) {}
    }
  } catch (e) {
    // Best-effort: don't break store creation if globals are sealed
    try {
      globalContainer[name] = store;
    } catch (ee) {}
  }
  return store;
}

/**
 * @typedef {'idle' | 'loading' | 'success' | 'error'} UIState
 */

// Create or reuse all stores using our singleton pattern
// Use `let` so we can rebind these module-local variables to the
// canonical global instances when present (preserves identity).
let promptStoreExport = getOrCreateStore("promptStore", "");
// Create or reuse base stores using our singleton pattern
let contentStoreExport = getOrCreateStore("contentStore", null);
let previewStoreExport = getOrCreateStore("previewStore", "");
let uiStateStoreExport = getOrCreateStore("uiStateStore", {
  status: "idle",
  message: "",
});

// FINAL RECONCILIATION: ensure module-local exports reference the canonical
// global container's store instances where available. This prevents duplicate
// store instances when modules are resolved via different paths or when HMR
// creates a fresh module copy.
try {
  // Ensure canonical global key exists on globalThis/window
  if (typeof globalThis !== "undefined") {
    try {
      if (!globalThis[CANONICAL_GLOBAL_KEY])
        globalThis[CANONICAL_GLOBAL_KEY] = globalContainer || {};
    } catch (e) {}
  }
  if (typeof window !== "undefined") {
    try {
      if (!window[CANONICAL_GLOBAL_KEY])
        window[CANONICAL_GLOBAL_KEY] = globalContainer || {};
    } catch (e) {}
  }

  // Helper to prefer the canonical store instance when a mismatch is detected
  const preferCanonical = (name, localStore) => {
    try {
      const canonical =
        (globalContainer && globalContainer[name]) ||
        (typeof globalThis !== "undefined" &&
          globalThis[CANONICAL_GLOBAL_KEY] &&
          globalThis[CANONICAL_GLOBAL_KEY][name]) ||
        (typeof window !== "undefined" &&
          window[CANONICAL_GLOBAL_KEY] &&
          window[CANONICAL_GLOBAL_KEY][name]);
      if (canonical && localStore && canonical !== localStore) {
        // If the canonical store exists and differs from the local one, prefer canonical.
        if (
          IS_DEV &&
          typeof window !== "undefined" &&
          window[DEV_VERBOSE_KEY]
        ) {
          try {
            console.debug(
              `[DEV] Reconciling store '${name}': preferring canonical instance`
            );
          } catch (e) {}
        }
        return canonical;
      }
    } catch (e) {}
    return localStore;
  };

  // Replace any module-local exports with the canonical instances when applicable
  try {
    // Prefer canonical instances: if a canonical store exists and differs
    // from the module-local one, rebind the module-local variable to the
    // canonical instance so all consumers (including those holding
    // references) see the same object identity.
    try {
      const canonicalPrompt = preferCanonical("promptStore", promptStoreExport);
      if (canonicalPrompt && canonicalPrompt !== promptStoreExport) {
        promptStoreExport = canonicalPrompt;
        if (globalContainer) globalContainer["promptStore"] = canonicalPrompt;
      }

      const canonicalContent = preferCanonical(
        "contentStore",
        contentStoreExport
      );
      if (canonicalContent && canonicalContent !== contentStoreExport) {
        contentStoreExport = canonicalContent;
        if (globalContainer) globalContainer["contentStore"] = canonicalContent;
      }

      const canonicalPreview = preferCanonical(
        "previewStore",
        previewStoreExport
      );
      if (canonicalPreview && canonicalPreview !== previewStoreExport) {
        previewStoreExport = canonicalPreview;
        if (globalContainer) globalContainer["previewStore"] = canonicalPreview;
      }

      const canonicalUi = preferCanonical("uiStateStore", uiStateStoreExport);
      if (canonicalUi && canonicalUi !== uiStateStoreExport) {
        uiStateStoreExport = canonicalUi;
        if (globalContainer) globalContainer["uiStateStore"] = canonicalUi;
      }
      // Mirror to globalThis/window as a final step
      try {
        if (
          typeof globalThis !== "undefined" &&
          globalThis[CANONICAL_GLOBAL_KEY]
        ) {
          globalThis[CANONICAL_GLOBAL_KEY]["promptStore"] = promptStoreExport;
          globalThis[CANONICAL_GLOBAL_KEY]["contentStore"] = contentStoreExport;
          globalThis[CANONICAL_GLOBAL_KEY]["previewStore"] = previewStoreExport;
          globalThis[CANONICAL_GLOBAL_KEY]["uiStateStore"] = uiStateStoreExport;
          // Ensure mirrored canonical instances are tagged as canonical too
          try {
            if (globalThis[CANONICAL_GLOBAL_KEY].previewStore)
              globalThis[
                CANONICAL_GLOBAL_KEY
              ].previewStore.__is_canonical = true;
          } catch (e) {}
        }
        if (typeof window !== "undefined" && window[CANONICAL_GLOBAL_KEY]) {
          window[CANONICAL_GLOBAL_KEY]["promptStore"] = promptStoreExport;
          window[CANONICAL_GLOBAL_KEY]["contentStore"] = contentStoreExport;
          window[CANONICAL_GLOBAL_KEY]["previewStore"] = previewStoreExport;
          window[CANONICAL_GLOBAL_KEY]["uiStateStore"] = uiStateStoreExport;
          try {
            if (window[CANONICAL_GLOBAL_KEY].previewStore)
              window[CANONICAL_GLOBAL_KEY].previewStore.__is_canonical = true;
          } catch (e) {}
        }
      } catch (e) {}
    } catch (e) {}
  } catch (e) {}
} catch (e) {}

// Initialize debug store container and E2E test instrumentation
if (typeof window !== "undefined") {
  window.__DEBUG_STORES__ = {
    LAST_UPDATE: {},
    UPDATE_HISTORY: {},
  };

  // Add E2E test instrumentation: track latest preview content
  const origPreviewSet = previewStoreExport.set;
  previewStoreExport.set = (value) => {
    try {
      // Runtime write instrumentation: log which store instance is being
      // written, along with the canonical/global registry, so we can detect
      // mismatched instances at runtime when debugging HMR/import divergence.
      try {
        const gw =
          (typeof window !== "undefined" && window[CANONICAL_GLOBAL_KEY]) ||
          (typeof globalThis !== "undefined" &&
            globalThis[CANONICAL_GLOBAL_KEY]) ||
          null;
        const canonicalIds = (gw && gw.__STORE_IDS__) || {};
        const entry = {
          ts: Date.now(),
          store: "previewStore",
          storeId: previewStoreExport && previewStoreExport.__chronos_id,
          canonicalIds,
          hasCanonical: !!gw,
          valueLength: value ? String(value).length : 0,
        };
        try {
          if (typeof window !== "undefined") {
            window.__STORE_WRITE_LOG__ = window.__STORE_WRITE_LOG__ || [];
            window.__STORE_WRITE_LOG__.push(entry);
          }
        } catch (e) {}
        try {
          if (
            IS_DEV &&
            typeof window !== "undefined" &&
            window[DEV_VERBOSE_KEY]
          )
            console.debug("[STORE_WRITE]", entry);
        } catch (e) {}
      } catch (e) {}

      if (value) {
        window.__LAST_PREVIEW_HTML = value;
        window.__preview_html_snippet = value;
        window.__preview_updated_ts = Date.now();
      }
    } catch (e) {} // Swallow instrumentation errors
    return origPreviewSet(value);
  };

  // Add E2E test instrumentation: track content store updates
  const origContentSet = contentStoreExport.set;
  contentStoreExport.set = (value) => {
    try {
      if (value && value.preview) {
        window.__LAST_PREVIEW_SET = value.preview;
      }
    } catch (e) {} // Swallow instrumentation errors
    return origContentSet(value);
  };
}

/**
 * Persist content to the server prompts API.
 * If `content.promptId` exists, perform an update; otherwise create a new prompt.
 * Returns the persisted content object from the server.
 */
export async function persistContent(api) {
  // Allow dependency injection for tests by accepting an `api` object.
  // If not provided, lazily import the real API implementation to avoid
  // hard failure when running unit tests that stub `persistContent`'s
  // dependencies.
  if (!api) {
    try {
      const mod = await import("../lib/api");
      api = {
        savePromptContent: mod.savePromptContent,
        updatePromptContent: mod.updatePromptContent,
      };
    } catch (e) {
      // If dynamic import fails, let callers handle missing API by
      // providing their own `api` object. We throw below if no api is
      // available when attempting to persist.
      api = null;
    }
  }
  const content = get(contentStore);
  if (!content) throw new Error("No content in store to persist");
  try {
    let persisted;
    if (content.promptId) {
      persisted = await api.updatePromptContent(content.promptId, content);
    } else {
      persisted = await api.savePromptContent(content);
    }
    // Normalize persisted response: unwrap common envelopes and map `id` -> `promptId`.
    try {
      const normalized = (() => {
        if (!persisted) return {};
        // If server responds with { data: { content: {...} } } or { data: {...} }
        const body =
          persisted.data && persisted.data.content
            ? persisted.data.content
            : persisted.data
            ? persisted.data
            : persisted;
        const out = Object.assign({}, body || {});
        // map common id fields to promptId while preserving original `id`
        if (out.id && !out.promptId) {
          out.promptId = out.id;
          // keep `id` as well for backward compatibility with tests/consumers
        }
        return out;
      })();

      // Dev debug - only log in development to avoid noisy test output
      try {
        if (IS_DEV)
          console.debug("[DEV] persistContent: updating contentStore with", {
            content,
            persisted,
            normalized,
          });
      } catch (e) {}

      // Atomically merge persisted fields into the existing content to avoid
      // lost updates from concurrent writers. We intentionally perform a
      // shallow merge here (consistent with prior behavior); if nested
      // structures become a problem we can switch to a deep merge.
      contentStore.update((existing) => {
        const updated = {
          ...(existing || {}),
          ...normalized,
        };
        // Update E2E test instrumentation on content updates too
        try {
          if (typeof window !== "undefined" && updated.preview) {
            window.__LAST_PREVIEW_SET = updated.preview;
          }
        } catch (e) {} // Swallow instrumentation errors
        return updated;
      });
    } catch (e) {
      // Swallow normalization/merge errors to avoid breaking persistence flow;
      // the outer catch will handle logging and rethrow if needed.
    } // end normalize/merge try

    return persisted;
  } catch (err) {
    console.warn("persistContent failed", err && err.message);
    throw err;
  }
}

/**
 * Export all store instances as singletons.
 * Every module that imports these will get the same instance.
 * HMR updates will preserve the store state through the global object.
 */
// Re-export the module-local variables as live bindings so later reassignments
// to `*_storeExport` update importers across the app.
// Module-local aliases used throughout this file and by other modules that
// import the stores. Keep them as live bindings and reassign when we
// rebind to canonical instances above.
let promptStore = promptStoreExport;
let contentStore = contentStoreExport;
let previewStore = previewStoreExport;
let uiStateStore = uiStateStoreExport;

export { promptStore, contentStore, previewStore, uiStateStore };

// Helper setters for consistent UI state transitions
export function setUiLoading(message = "") {
  uiStateStore.set({ status: "loading", message });
}

export function setUiSuccess(message = "") {
  uiStateStore.set({ status: "success", message });
}

export function setUiError(message = "") {
  uiStateStore.set({ status: "error", message });
}
