/**
 * PromptInput Component
 * Textarea for user to enter their creative prompt
 * Validates minimum length and triggers generation
 */

<script>
  import { flowStore, STATES } from '../lib/stores/flowStore.js';

  export let isLoading = false;

  let promptText = '';
  let charCount = 0;
  const MIN_CHARS = 10;

  function handlePromptChange(e) {
    promptText = e.target.value;
    charCount = promptText.length;
    flowStore.setPrompt(promptText);
  }

  function handleGenerate() {
    if (promptText.trim().length < MIN_CHARS) {
      return; // Button is disabled, but just in case
    }

    flowStore.setPrompt(promptText.trim());
    // Dispatch event for parent component to handle
    const event = new CustomEvent('generate', {
      detail: { prompt: promptText.trim() },
      bubbles: true
    });
    this.dispatchEvent(event);
  }

  function handleKeyDown(e) {
    // Allow Ctrl+Enter or Cmd+Enter to submit
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      if (promptText.trim().length >= MIN_CHARS) {
        handleGenerate();
      }
    }
  }
</script>

<div class="prompt-input">
  <label for="prompt-textarea">
    Describe what you want to create
  </label>

  <div class="textarea-wrapper">
    <textarea
      id="prompt-textarea"
      bind:value={promptText}
      on:change={handlePromptChange}
      on:input={handlePromptChange}
      on:keydown={handleKeyDown}
      placeholder="Enter your creative prompt (minimum 10 characters)&#10;Tip: Be descriptive and specific for better results"
      disabled={isLoading}
      rows="4"
    />
    <div class="char-count" class:warning={charCount < MIN_CHARS && charCount > 0}>
      {charCount} / {MIN_CHARS} min
    </div>
  </div>

  {#if charCount < MIN_CHARS && charCount > 0}
    <p class="error-message">
      Prompt must be at least {MIN_CHARS} characters ({MIN_CHARS - charCount} more needed)
    </p>
  {/if}

  <button
    class="generate-button"
    disabled={charCount < MIN_CHARS || isLoading}
    on:click={handleGenerate}
    type="button"
  >
    {#if isLoading}
      <span class="spinner-icon">⏳</span> Generating...
    {:else}
      <span>→</span> Generate
    {/if}
  </button>

  <p class="hint">
    💡 Tip: Press Ctrl+Enter (or Cmd+Enter on Mac) to submit quickly
  </p>
</div>

<style>
  .prompt-input {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin: 1.5rem 0;
  }

  label {
    font-weight: 600;
    font-size: 1rem;
    color: #333;
  }

  .textarea-wrapper {
    position: relative;
  }

  textarea {
    width: 100%;
    padding: 1rem;
    border: 2px solid #ddd;
    border-radius: 8px;
    font-family: inherit;
    font-size: 1rem;
    resize: vertical;
    transition: border-color 0.2s ease;
  }

  textarea:focus {
    outline: none;
    border-color: #3498db;
    box-shadow: 0 0 8px rgba(52, 152, 219, 0.2);
  }

  textarea:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
    opacity: 0.7;
  }

  .char-count {
    position: absolute;
    bottom: 0.5rem;
    right: 1rem;
    font-size: 0.85rem;
    color: #666;
    background: white;
    padding: 0 0.25rem;
  }

  .char-count.warning {
    color: #e74c3c;
    font-weight: 600;
  }

  .error-message {
    margin: 0;
    padding: 0.75rem;
    background-color: #fee;
    border-left: 3px solid #e74c3c;
    border-radius: 4px;
    color: #c00;
    font-size: 0.9rem;
  }

  .generate-button {
    padding: 0.75rem 1.5rem;
    background-color: #3498db;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .generate-button:hover:not(:disabled) {
    background-color: #2980b9;
  }

  .generate-button:disabled {
    background-color: #bdc3c7;
    cursor: not-allowed;
  }

  .spinner-icon {
    display: inline-block;
    animation: pulse 1s infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .hint {
    margin: 0;
    font-size: 0.85rem;
    color: #666;
    font-style: italic;
  }
</style>
