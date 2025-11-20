<script>
  /**
   * ClassificationFeedback Component - Phase A-B Module 10
   *
   * Displays AI classification feedback with:
   * - Suggested medium (ebook, calendar, poster, etc.)
   * - Confidence score (0-100%)
   * - Classification source (rules, ai, hybrid)
   * - Option to accept or override
   */

  export let prompt = "";
  export let classification = null;
  export let confidence = 0;
  export let source = "rules"; // 'rules', 'ai', or 'hybrid'
  export let onAccept = () => {};
  export let onOverride = () => {};
  export let disabled = false;

  const mediumIcons = {
    ebook: "📖",
    calendar: "📅",
    poster: "🖼️",
    stickers: "✨",
    "greeting-card": "💌",
    journal: "📔",
    "app-ui": "📱",
    "wall-art": "🎨",
  };

  const mediumLabels = {
    ebook: "eBook",
    calendar: "Calendar",
    poster: "Wall Art",
    stickers: "Stickers",
    "greeting-card": "Greeting Card",
    journal: "Journal",
    "app-ui": "App UI",
    "wall-art": "Wall Art",
  };

  const sourceLabels = {
    rules: "Rule-based",
    ai: "AI-detected",
    hybrid: "Hybrid classification",
  };

  $: suggestedMedium = classification?.medium || "ebook";
  $: confidencePercent = Math.round(confidence * 100);
  $: sourceLabel = sourceLabels[source] || source;
  $: isHighConfidence = confidence > 0.8;
  $: isMediumConfidence = confidence > 0.5;

  function handleAccept() {
    onAccept(suggestedMedium);
  }

  function handleOverride() {
    onOverride();
  }

  function getConfidenceColor() {
    if (isHighConfidence) return "text-green-600";
    if (isMediumConfidence) return "text-yellow-600";
    return "text-orange-600";
  }

  function getConfidenceBgColor() {
    if (isHighConfidence) return "bg-green-50 border-green-200";
    if (isMediumConfidence) return "bg-yellow-50 border-yellow-200";
    return "bg-orange-50 border-orange-200";
  }
</script>

<div class="classification-feedback border rounded-lg p-4 {getConfidenceBgColor()}">
  <div class="flex items-start justify-between gap-4">
    <div class="flex-1">
      <h3 class="text-sm font-semibold text-gray-900 mb-2">
        Classification Results
      </h3>

      {#if prompt}
        <p class="text-xs text-gray-600 mb-3 truncate">
          <span class="font-mono bg-white px-2 py-1 rounded text-gray-700">
            {prompt.slice(0, 60)}{prompt.length > 60 ? "..." : ""}
          </span>
        </p>
      {/if}

      <div class="flex items-center gap-2 mb-3">
        <span class="text-2xl">
          {mediumIcons[suggestedMedium] || "📄"}
        </span>
        <div>
          <p class="text-lg font-semibold text-gray-900">
            {mediumLabels[suggestedMedium] || suggestedMedium}
          </p>
          <p class="text-xs text-gray-600">{sourceLabel}</p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <div class="flex-1 bg-white rounded-full h-2 border border-gray-200 overflow-hidden">
          <div
            class="h-full {isHighConfidence
              ? 'bg-green-500'
              : isMediumConfidence
                ? 'bg-yellow-500'
                : 'bg-orange-500'} transition-all"
            style="width: {confidencePercent}%"
          />
        </div>
        <span class="text-sm font-semibold {getConfidenceColor()}">
          {confidencePercent}%
        </span>
      </div>

      {#if !isHighConfidence}
        <p class="text-xs text-gray-600 mt-2">
          🔍 Low confidence detected. Consider reviewing or using override.
        </p>
      {/if}
    </div>

    <div class="flex flex-col gap-2">
      <button
        on:click={handleAccept}
        disabled={disabled}
        class="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-medium rounded transition-colors"
        title="Use suggested medium"
      >
        Accept
      </button>
      <button
        on:click={handleOverride}
        disabled={disabled}
        class="px-3 py-2 border border-gray-300 hover:border-gray-400 disabled:opacity-50 text-gray-700 text-sm font-medium rounded transition-colors"
        title="Choose different medium"
      >
        Override
      </button>
    </div>
  </div>

  {#if classification}
    <div class="mt-3 text-xs text-gray-600 space-y-1">
      <p>
        <strong>Style:</strong>
        {classification.style || "Not detected"}
      </p>
      {#if classification.theme && classification.theme.length > 0}
        <p>
          <strong>Themes:</strong>
          {classification.theme.join(", ")}
        </p>
      {/if}
      {#if classification.audience}
        <p>
          <strong>Audience:</strong>
          {classification.audience}
        </p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .classification-feedback {
    transition: all 0.3s ease;
  }

  .classification-feedback:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
</style>
