<script>
  /**
   * MediaSelector Component - Phase A-B Module 6
   *
   * User interface for selecting output medium
   * - Ebook
   * - Calendar
   * - Wall Art / Poster
   * - Stickers
   * - Greeting Card
   * - Journal
   *
   * Component exports:
   * - selectedMedium: reactive binding for parent
   * - onMediaSelected: callback for parent event handling
   */

  import { onMount } from "svelte";

  export let selectedMedium = "ebook";
  export let onMediaSelected = (medium) => {};
  export let disabled = false;

  const mediaOptions = [
    {
      id: "ebook",
      icon: "📖",
      label: "eBook",
      description: "Digital book with chapters",
      color: "from-blue-500",
    },
    {
      id: "calendar",
      icon: "📅",
      label: "Calendar",
      description: "12-month printable calendar",
      color: "from-purple-500",
    },
    {
      id: "poster",
      icon: "🖼️",
      label: "Wall Art",
      description: "Printable poster designs",
      color: "from-pink-500",
    },
    {
      id: "stickers",
      icon: "✨",
      label: "Stickers",
      description: "Sticker pack designs",
      color: "from-yellow-500",
    },
    {
      id: "card",
      icon: "💌",
      label: "Greeting Card",
      description: "Card & envelope",
      color: "from-red-500",
    },
    {
      id: "journal",
      icon: "📔",
      label: "Journal",
      description: "Structured journal pages",
      color: "from-green-500",
    },
  ];

  function handleSelect(id) {
    if (!disabled) {
      selectedMedium = id;
      onMediaSelected(id);
    }
  }

  function handleKeyDown(event, id) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleSelect(id);
    }
  }
</script>

<div class="media-selector">
  <div class="selector-header">
    <h2>What would you like to create?</h2>
    <p class="subtitle">Select a format and we'll generate it for you</p>
  </div>

  <div class="media-grid">
    {#each mediaOptions as option (option.id)}
      <button
        type="button"
        class="media-option"
        class:active={selectedMedium === option.id}
        class:disabled={disabled}
        on:click={() => handleSelect(option.id)}
        on:keydown={(e) => handleKeyDown(e, option.id)}
        aria-pressed={selectedMedium === option.id}
        aria-label="Create {option.label}: {option.description}"
        {disabled}
      >
        <div class="option-content">
          <div class="icon">{option.icon}</div>
          <div class="label">{option.label}</div>
          <div class="description">{option.description}</div>
        </div>

        {#if selectedMedium === option.id}
          <div class="checkmark">✓</div>
        {/if}
      </button>
    {/each}
  </div>
</div>

<style>
  .media-selector {
    width: 100%;
    padding: 2rem;
    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
    border-radius: 8px;
  }

  .selector-header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .selector-header h2 {
    font-size: 1.75rem;
    font-weight: 600;
    color: #2d3748;
    margin: 0 0 0.5rem 0;
    letter-spacing: -0.5px;
  }

  .subtitle {
    color: #718096;
    font-size: 0.95rem;
    margin: 0;
  }

  .media-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 1.25rem;
    width: 100%;
  }

  .media-option {
    position: relative;
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    padding: 1.75rem 1.25rem;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    background: white;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    font-family: inherit;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .media-option:hover:not(.disabled) {
    border-color: #cbd5e0;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transform: translateY(-2px);
  }

  .media-option:focus-visible {
    outline: 3px solid #4299e1;
    outline-offset: 2px;
  }

  .media-option.active {
    border-color: #4299e1;
    background: linear-gradient(135deg, #edf2f7 0%, #e6fffa 100%);
    box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1), 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .media-option.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .media-option.disabled:hover {
    transform: none;
  }

  .option-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.625rem;
  }

  .icon {
    font-size: 2.5rem;
    line-height: 1;
    margin-bottom: 0.25rem;
  }

  .label {
    font-weight: 600;
    font-size: 1.05rem;
    color: #2d3748;
    margin: 0;
  }

  .description {
    font-size: 0.8rem;
    color: #718096;
    margin: 0;
    line-height: 1.4;
  }

  .checkmark {
    position: absolute;
    top: -8px;
    right: -8px;
    width: 28px;
    height: 28px;
    background: #4299e1;
    border: 2px solid white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
    font-size: 1.1rem;
    box-shadow: 0 2px 8px rgba(66, 153, 225, 0.3);
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .media-selector {
      padding: 1.5rem;
    }

    .selector-header h2 {
      font-size: 1.5rem;
    }

    .media-grid {
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 1rem;
    }

    .media-option {
      padding: 1.25rem 1rem;
    }

    .icon {
      font-size: 2rem;
    }

    .label {
      font-size: 0.95rem;
    }

    .description {
      font-size: 0.75rem;
    }
  }

  @media (max-width: 480px) {
    .media-selector {
      padding: 1rem;
    }

    .selector-header h2 {
      font-size: 1.25rem;
    }

    .media-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 0.75rem;
    }

    .media-option {
      padding: 1rem 0.75rem;
    }

    .icon {
      font-size: 1.75rem;
    }

    .label {
      font-size: 0.9rem;
    }

    .description {
      font-size: 0.7rem;
    }
  }
</style>
