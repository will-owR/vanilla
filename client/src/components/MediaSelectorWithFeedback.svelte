<script>
  /**
   * MediaSelectorWithFeedback Component - Phase A-B Module 10
   * 
   * Integrated workflow combining:
   * 1. ClassificationFeedback - AI suggestion with confidence
   * 2. MediaSelector - User selection of medium
   * 3. Generate action - Trigger content generation
   */

  import MediaSelector from './MediaSelector.svelte';
  import ClassificationFeedback from './ClassificationFeedback.svelte';
  import { classify, generate } from '../lib/api';
  import { contentStore, uiStateStore } from '../stores';

  export let prompt = '';
  export let disabled = false;

  let classification = null;
  let confidence = 0;
  let source = 'rules';
  let selectedMedium = 'ebook';
  let isClassifying = false;
  let showFeedback = false;
  let generatingIndex = -1;

  // Auto-classify when prompt changes
  $: if (prompt && prompt.trim().length > 0) {
    debounceClassify(prompt);
  }

  let classifyTimer;
  function debounceClassify(text) {
    clearTimeout(classifyTimer);
    classifyTimer = setTimeout(() => {
      performClassification(text);
    }, 800);
  }

  async function performClassification(text) {
    if (!text || text.trim().length === 0) return;
    
    isClassifying = true;
    try {
      const result = await classify(text);
      if (result) {
        classification = result;
        confidence = result.confidence || 0;
        source = result.source || 'rules';
        selectedMedium = result.medium || 'ebook';
        showFeedback = true;
      }
    } catch (error) {
      console.error('Classification error:', error);
    } finally {
      isClassifying = false;
    }
  }

  async function handleAcceptClassification() {
    // User clicked Accept on ClassificationFeedback
    showFeedback = false;
    await handleGenerate();
  }

  async function handleOverrideClassification() {
    // User clicked Override - show MediaSelector for selection
    showFeedback = false;
  }

  async function handleMediaSelected(medium) {
    selectedMedium = medium;
  }

  async function handleGenerate() {
    if (!prompt || !selectedMedium) {
      uiStateStore.set({ status: 'error', message: 'Please enter a prompt and select a medium' });
      return;
    }

    generatingIndex = 0;
    uiStateStore.set({ status: 'loading', message: 'Generating content...' });

    try {
      const result = await generate(prompt, selectedMedium, {
        style: classification?.style,
        theme: classification?.theme,
        confidence: confidence,
      });

      if (result) {
        contentStore.set({
          ...result,
          classification,
          prompt,
          medium: selectedMedium,
        });

        uiStateStore.set({
          status: 'success',
          message: `Generated ${selectedMedium} successfully! (${result.latency || 0}ms)`,
        });
      }
    } catch (error) {
      const err = error as Error;
      uiStateStore.set({
        status: 'error',
        message: `Generation failed: ${err.message}`,
      });
    } finally {
      generatingIndex = -1;
    }
  }
</script>

<div class="media-selector-workflow">
  <!-- Classification Feedback Section -->
  {#if showFeedback && classification}
    <div class="feedback-section">
      <ClassificationFeedback
        {prompt}
        {classification}
        {confidence}
        {source}
        onAccept={handleAcceptClassification}
        onOverride={handleOverrideClassification}
        disabled={disabled || isClassifying}
      />
      <p class="feedback-hint">
        💡 AI suggests <strong>{selectedMedium}</strong> with <strong>{(confidence * 100).toFixed(0)}%</strong> confidence
      </p>
    </div>
  {/if}

  <!-- Media Selector -->
  <div class="selector-section">
    <MediaSelector
      bind:selectedMedium
      onMediaSelected={handleMediaSelected}
      disabled={disabled || generatingIndex >= 0}
    />
  </div>

  <!-- Generate Button -->
  <div class="action-section">
    <button
      on:click={handleGenerate}
      disabled={!prompt || !selectedMedium || disabled || generatingIndex >= 0}
      class="generate-button"
    >
      {#if generatingIndex >= 0}
        <span class="spinner"></span> Generating...
      {:else if isClassifying}
        <span class="spinner"></span> Analyzing...
      {:else}
        🚀 Generate {selectedMedium.charAt(0).toUpperCase() + selectedMedium.slice(1)}
      {/if}
    </button>
  </div>
</div>

<style>
  .media-selector-workflow {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    width: 100%;
  }

  .feedback-section {
    animation: slideIn 0.3s ease-out;
  }

  .feedback-hint {
    text-align: center;
    font-size: 0.9rem;
    color: #666;
    margin: 1rem 0 0 0;
    padding: 0.75rem;
    background: #f0f7ff;
    border-radius: 4px;
    border-left: 4px solid #0066cc;
  }

  .selector-section {
    animation: slideIn 0.4s ease-out 0.1s both;
  }

  .action-section {
    display: flex;
    justify-content: center;
    gap: 1rem;
    animation: slideIn 0.4s ease-out 0.2s both;
  }

  .generate-button {
    padding: 1rem 2rem;
    font-size: 1.1rem;
    font-weight: 600;
    background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
    min-width: 250px;
    justify-content: center;
  }

  .generate-button:hover:not(:disabled) {
    background: linear-gradient(135deg, #0056b3 0%, #003d82 100%);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 123, 255, 0.4);
  }

  .generate-button:active:not(:disabled) {
    transform: translateY(0);
  }

  .generate-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: #ccc;
  }

  .spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 768px) {
    .media-selector-workflow {
      gap: 1.5rem;
    }

    .generate-button {
      min-width: 200px;
      padding: 0.875rem 1.5rem;
      font-size: 1rem;
    }
  }
</style>
