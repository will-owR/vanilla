<script>
  import { createEventDispatcher } from "svelte";
  import { tick } from "svelte";

  let prompt = "";
  let loading = false;
  let errorMsg = "";
  const dispatch = createEventDispatcher();

  function extractHtmlFromResponse(json) {
    // Common shapes returned by server: { success:true, data: { content: { body, title } } }
    // legacy shapes: { content: { body } } or { html }
    if (!json) return null;
    if (json.data && json.data.content) {
      const c = json.data.content;
      return c.body || c.html || JSON.stringify(c);
    }
    if (json.content) {
      const c = json.content;
      return c.body || c.html || JSON.stringify(c);
    }
    if (json.html) return json.html;
    if (json.preview) return json.preview;
    return JSON.stringify(json);
  }

  async function submitPrompt() {
    errorMsg = "";
    if (!prompt || prompt.trim().length === 0) {
      errorMsg = "Please enter a prompt";
      return;
    }
    // Emit a submit event and let the application-level store/service
    // handle network calls and preview updates. This keeps the component
    // free of IO and aligned with the 'dumb frontend' guideline.
    const payload = {
      prompt: prompt.trim(),
      // expose other selections in future (contentType, mediaType, pages)
    };
    dispatch("submit", payload);
  }

  function onKeydown(e) {
    // Ctrl+Enter or Cmd+Enter submits
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      submitPrompt();
    }
  }
</script>

<div class="prompt-form">
  <label for="prompt-input">Prompt</label>
  <div style="display:flex;gap:8px;align-items:center">
    <input
      id="prompt-input"
      bind:value={prompt}
      placeholder="Enter a poem prompt"
    />
    <button on:click={submitPrompt} disabled={loading}>Generate</button>
  </div>

  <!-- Minimal markup for Phase A: content-type, media-type, and pages (no wiring) -->
  <div class="prompt-controls" style="margin-top:12px">
    <!-- Content Type: radio group + More dropdown -->
    <fieldset class="radio-group" aria-label="Content type">
      <legend class="visually-hidden">Content type</legend>
      <label
        ><input type="radio" name="contentType" value="Poem" checked /> Poem</label
      >
      <label
        ><input type="radio" name="contentType" value="Story" /> Story</label
      >
      <label
        ><input type="radio" name="contentType" value="Essay" /> Essay</label
      >
      <label
        ><input type="radio" name="contentType" value="Haiku" /> Haiku</label
      >
    </fieldset>

    <div style="margin-top:8px">
      <label
        for="more-content-types"
        style="display:block;font-size:13px;margin-bottom:4px"
        >More content types</label
      >
      <select id="more-content-types" name="moreContentType">
        <option value="">Choose…</option>
        <option value="Poem">Poem</option>
        <option value="Story">Story</option>
        <option value="Essay">Essay</option>
        <option value="Haiku">Haiku</option>
        <option value="Joke">Joke</option>
      </select>
    </div>

    <!-- Media Type: radio group + More dropdown -->
    <fieldset
      class="radio-group"
      aria-label="Media type"
      style="margin-top:12px"
    >
      <legend class="visually-hidden">Media type</legend>
      <label
        ><input type="radio" name="mediaType" value="eBook" checked /> eBook</label
      >
      <label
        ><input type="radio" name="mediaType" value="Wall Art" /> Wall Art</label
      >
      <label
        ><input type="radio" name="mediaType" value="Calendar" /> Calendar</label
      >
      <label
        ><input type="radio" name="mediaType" value="Wallpaper" /> Wallpaper</label
      >
    </fieldset>

    <div style="margin-top:8px">
      <label
        for="more-media-types"
        style="display:block;font-size:13px;margin-bottom:4px"
        >More media types</label
      >
      <select id="more-media-types" name="moreMediaType">
        <option value="">Choose…</option>
        <option value="eBook">eBook</option>
        <option value="Wall Art">Wall Art</option>
        <option value="Calendar">Calendar</option>
        <option value="Wallpaper">Wallpaper</option>
        <option value="Poster">Poster</option>
      </select>
    </div>

    <!-- Pages input + preset buttons -->
    <div style="margin-top:8px;display:flex;gap:8px;align-items:center">
      <label for="pages" style="font-size:13px">Pages</label>
      <input
        id="pages"
        name="pages"
        type="number"
        min="1"
        max="20"
        value="1"
        style="width:72px;padding:6px"
      />
      <div class="presets">
        <button type="button" data-preset="1">1</button>
        <button type="button" data-preset="2">2</button>
        <button type="button" data-preset="5">5</button>
      </div>
      <div style="font-size:12px;color:#666">(min 1, max 20)</div>
    </div>
  </div>
  {#if loading}
    <div class="loading">Generating…</div>
  {/if}

  {#if errorMsg}
    <div role="alert" class="error">{errorMsg}</div>
  {/if}
</div>

<style>
  .prompt-form {
    margin-bottom: 12px;
  }
  input {
    padding: 8px;
    min-width: 320px;
  }
  button {
    padding: 8px 12px;
  }
  .loading {
    color: #666;
    font-size: 13px;
  }
  .visually-hidden {
    position: absolute !important;
    height: 1px;
    width: 1px;
    overflow: hidden;
    clip: rect(1px, 1px, 1px, 1px);
    white-space: nowrap; /* added line */
  }
</style>
