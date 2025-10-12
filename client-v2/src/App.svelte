<script>
  // Phase A: show wired UI for manual verification
  import PromptForm from "./components/PromptForm.svelte";
  import PreviewWindow from "./components/PreviewWindow.svelte";
  import { promptStore } from "./lib/promptStore.js";

  $: uiState = {
    status: $promptStore.loading ? "loading" : "idle",
    message: $promptStore.error,
  };

  function handleSubmit(e) {
    promptStore.submitPrompt(e.detail.prompt);
  }
</script>

<main class="app-container" style="padding:24px;height:100vh">
  <h1>AetherPress — Preview (client-v2)</h1>
  <div style="margin-top:12px">
    <PromptForm
      prompt={$promptStore.prompt}
      loading={$promptStore.loading}
      errorMsg={$promptStore.error}
      on:submit={handleSubmit}
    />
  </div>
  <div style="height:70%;margin-top:12px">
    <PreviewWindow {uiState} />
  </div>
</main>

<style>
  h1 {
    font-family:
      system-ui,
      -apple-system,
      sans-serif;
  }
</style>
