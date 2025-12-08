// Lightweight frontend genie service wrapper.
// Provides a stable generate() contract that can return a dev/demo payload
// or delegate to the server via existing api.submitPrompt().
import { submitPrompt, loadPreview } from "./api.js";

function buildContentFromPrompt(prompt) {
  const title = `Dev: ${String(prompt).split(/\s+/).slice(0, 6).join(" ")}`;
  const body = `Deterministic dev preview for prompt: ${prompt}`;
  return { title, body, layout: "dev" };
}

export async function generate(prompt, opts = {}) {
  const dev = opts && opts.dev;
  if (dev) {
    const content = buildContentFromPrompt(prompt);
    const copies = [content, content, content];
    return { content, copies, meta: { source: "dev" } };
  }

  // Default: delegate to server via submitPrompt and normalize the shape.
  const envelope = await submitPrompt(prompt);
  // envelope is canonical: { pages, metadata, actions }
  const pages = envelope?.pages || [];
  const toContent = (page) => {
    const body = (page.blocks || [])
      .map((b) => (b && b.content ? b.content : ""))
      .join("\n\n");
    return { title: page.title, body: body, layout: page.layout || null };
  };
  const content = pages.length ? toContent(pages[0]) : null;
  const copies = pages.map((p) => toContent(p));
  return {
    content,
    copies,
    meta: { source: "server", metadata: envelope.metadata },
  };
}

export async function preview(content, opts = {}) {
  return await loadPreview(content, opts);
}

export default { generate, preview };
