/**
 * GenerateFlow Orchestrator Component - Phase 1+2 Implementation
 * Main component handling all state transitions, API calls, and flow coordination
 * 
 * Manages the complete flow:
 * INITIAL → MEDIUM_SELECTED → GENERATING → CLASSIFICATION_READY → 
 * RESULT_READY → OVERRIDE_ACTIVE → COMPLETE
 */

<script>
  import { onMount } from 'svelte';
  import { flowStore, STATES } from '../lib/stores/flowStore.js';
  import { classify, generate, applyOverride, CONFIG } from '../lib/api-v2.js';
  import MediaSelector from './MediaSelector-v2.svelte';
  import PromptInput from './PromptInput-v2.svelte';
  import ClassificationFeedback from './ClassificationFeedback-v2.svelte';
  import ResultsDisplay from './ResultsDisplay-v2.svelte';
  import StatsPanel from './StatsPanel-v2.svelte';
  import OverrideControls from './OverrideControls-v2.svelte';
  import CostVisualization from './CostVisualization-v2.svelte';

  // Track which handler is currently executing
  let isProcessing = false;

  /**
   * Handle generate click:
   * 1. Validate inputs
   * 2. Transition to GENERATING
   * 3. Call classify() API
   * 4. If confidence > 0.85: auto-advance to generation
   * 5. Else: show classification feedback for user review
   */
  async function handleGenerateClick() {
    if (isProcessing) return;
    isProcessing = true;

    let state;
    const unsubscribe = flowStore.subscribe(value => {
      state = value;
    });

    try {
      // Validate inputs
      if (!state.selectedMedium) {
        flowStore.setError({
          status: 400,
          message: 'Please select a medium first',
          retryable: false
        });
        isProcessing = false;
        unsubscribe();
        return;
      }

      if (!state.prompt || state.prompt.trim().length < 10) {
        flowStore.setError({
          status: 400,
          message: 'Prompt must be at least 10 characters',
          retryable: false
        });
        isProcessing = false;
        unsubscribe();
        return;
      }

      // Transition to GENERATING
      flowStore.setState(STATES.GENERATING);

      // Call classify API
      const startTime = performance.now();
      const classification = await classify(state.prompt, state.selectedMedium);
      const latency = performance.now() - startTime;

      flowStore.setClassification(classification);
      flowStore.setLatency(latency);

      // Check confidence threshold
      if (classification.confidence > CONFIG.CONFIDENCE_THRESHOLD) {
        // Auto-advance to generation
        await handleAcceptClassification();
      } else {
        // Show classification feedback for user review
        flowStore.setState(STATES.CLASSIFICATION_READY);
      }
    } catch (error) {
      flowStore.setError({
        status: error.status || 500,
        message: error.message || 'Classification failed',
        retryable: error.retryable !== false
      });
      flowStore.setState(STATES.ERROR);
    } finally {
      isProcessing = false;
      unsubscribe();
    }
  }

  /**
   * Handle accept classification:
   * 1. Transition to GENERATING
   * 2. Call generate() API
   * 3. Store result and transition to RESULT_READY
   */
  async function handleAcceptClassification() {
    if (isProcessing) return;
    isProcessing = true;

    let state;
    const unsubscribe = flowStore.subscribe(value => {
      state = value;
    });

    try {
      // Transition to GENERATING
      flowStore.setState(STATES.GENERATING);

      // Call generate API
      const startTime = performance.now();
      const result = await generate(
        state.prompt,
        state.selectedMedium,
        state.classification
      );
      const latency = performance.now() - startTime;

      flowStore.setResult(result);
      flowStore.setLatency(latency);
      flowStore.setState(STATES.RESULT_READY);
    } catch (error) {
      flowStore.setError({
        status: error.status || 500,
        message: error.message || 'Generation failed',
        retryable: error.retryable !== false
      });

      // On error, go back to CLASSIFICATION_READY so user can try again
      flowStore.setState(STATES.CLASSIFICATION_READY);
    } finally {
      isProcessing = false;
      unsubscribe();
    }
  }

  /**
   * Handle apply override:
   * 1. Transition to GENERATING
   * 2. Call applyOverride() API
   * 3. Store result and transition to RESULT_READY
   */
  async function handleApplyOverride(overrides) {
    if (isProcessing) return;
    isProcessing = true;

    let state;
    const unsubscribe = flowStore.subscribe(value => {
      state = value;
    });

    try {
      // Transition to GENERATING
      flowStore.setState(STATES.GENERATING);

      // Call override API
      const startTime = performance.now();
      const result = await applyOverride(
        state.result.id,
        state.classification,
        overrides
      );
      const latency = performance.now() - startTime;

      flowStore.setResult(result);
      flowStore.setLatency(latency);
      flowStore.setOverrideCost(result.costMultiplier);
      flowStore.setState(STATES.RESULT_READY);
    } catch (error) {
      flowStore.setError({
        status: error.status || 500,
        message: error.message || 'Override failed',
        retryable: error.retryable !== false
      });

      // On 422 validation error, stay in OVERRIDE_ACTIVE so user can adjust
      if (error.status === 422) {
        flowStore.setState(STATES.OVERRIDE_ACTIVE);
      } else {
        // Other errors: go back to RESULT_READY
        flowStore.setState(STATES.RESULT_READY);
      }
    } finally {
      isProcessing = false;
      unsubscribe();
    }
  }

  /**
   * Reset flow to initial state
   */
  function handleReset() {
    flowStore.reset();
  }

  /**
   * Transition to override mode
   */
  function handleRequestOverride() {
    flowStore.setState(STATES.OVERRIDE_ACTIVE);
  }

  /**
   * Transition to new prompt (back to initial)
   */
  function handleNewPrompt() {
    flowStore.reset();
  }

  /**
   * Trigger PDF export (browser download)
   */
  function handleExportPDF() {
    let state;
    const unsubscribe = flowStore.subscribe(value => {
      state = value;
    });

    if (state.result && state.result.pdfUrl) {
      const link = document.createElement('a');
      link.href = state.result.pdfUrl;
      link.download = `generated-${state.selectedMedium}-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    unsubscribe();
  }
</script>

<div class="generate-flow">
  {#if $flowStore.state === STATES.INITIAL}
    <div class="state-initial">
      <h1>Welcome to Genie Generator</h1>
      <p>Select a medium to get started</p>
      <MediaSelector />
    </div>

  {:else if $flowStore.state === STATES.MEDIUM_SELECTED}
    <div class="state-medium-selected">
      <h2>Create your {$flowStore.selectedMedium}</h2>
      <PromptInput on:generate={handleGenerateClick} />
    </div>

  {:else if $flowStore.state === STATES.GENERATING}
    <div class="state-generating">
      <div class="loading-spinner">
        <div class="spinner"></div>
        <p>Generating your {$flowStore.selectedMedium}...</p>
      </div>
    </div>

  {:else if $flowStore.state === STATES.CLASSIFICATION_READY}
    <div class="state-classification-ready">
      <h2>Review Classification</h2>
      <ClassificationFeedback
        classification={$flowStore.classification}
        onAccept={handleAcceptClassification}
        onRequestOverride={handleRequestOverride}
      />
    </div>

  {:else if $flowStore.state === STATES.RESULT_READY}
    <div class="state-result-ready">
      <h2>Your Generated {$flowStore.selectedMedium}</h2>
      <ResultsDisplay
        result={$flowStore.result}
        classification={$flowStore.classification}
        onCustomizeStyle={handleRequestOverride}
        onDownloadPDF={handleExportPDF}
        onNewPrompt={handleNewPrompt}
      />
      <StatsPanel
        result={$flowStore.result}
        classification={$flowStore.classification}
      />
    </div>

  {:else if $flowStore.state === STATES.OVERRIDE_ACTIVE}
    <div class="state-override-active">
      <h2>Customize Your Generation</h2>
      <OverrideControls
        classification={$flowStore.classification}
        onApplyOverride={handleApplyOverride}
      />
      <CostVisualization
        result={$flowStore.result}
        costMultiplier={$flowStore.overrideCost || 1.0}
      />
    </div>

  {:else if $flowStore.state === STATES.ERROR}
    <div class="state-error">
      <div class="error-panel">
        <h2>Error</h2>
        <p>{$flowStore.error?.message || 'An unknown error occurred'}</p>
        {#if $flowStore.error?.retryable}
          <button on:click={handleGenerateClick}>
            🔄 Retry
          </button>
        {/if}
        <button on:click={handleReset}>
          ↺ Start Over
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .generate-flow {
    min-height: 100vh;
    padding: 2rem;
  }

  .state-initial,
  .state-medium-selected,
  .state-classification-ready,
  .state-result-ready,
  .state-override-active,
  .state-error {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .state-generating {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 50vh;
  }

  .loading-spinner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .spinner {
    width: 50px;
    height: 50px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #3498db;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .error-panel {
    background-color: #fee;
    border: 1px solid #f99;
    border-radius: 8px;
    padding: 1.5rem;
    max-width: 500px;
  }

  .error-panel h2 {
    color: #c00;
    margin: 0 0 0.5rem 0;
  }

  .error-panel p {
    color: #666;
    margin: 0 0 1rem 0;
  }

  .error-panel button {
    margin-right: 0.5rem;
    padding: 0.5rem 1rem;
    background-color: #3498db;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .error-panel button:hover {
    background-color: #2980b9;
  }

  h1 {
    margin: 0 0 0.5rem 0;
  }

  p {
    margin: 0;
  }

  button {
    padding: 0.75rem 1.5rem;
    background-color: #3498db;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
  }

  button:hover {
    background-color: #2980b9;
  }

  button:disabled {
    background-color: #bdc3c7;
    cursor: not-allowed;
  }
</style>
