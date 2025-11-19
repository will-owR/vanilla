/**
 * MediaSelector Component
 * Allows user to select a medium (ebook, calendar, poster, stickers, card)
 */

<script>
  import { flowStore, STATES } from '../lib/stores/flowStore.js';
  import { CONFIG } from '../lib/api-v2.js';

  export let isLoading = false;

  const MEDIA_INFO = {
    ebook: { emoji: '📖', label: 'eBook', desc: 'Digital book' },
    calendar: { emoji: '📅', label: 'Calendar', desc: 'Yearly calendar' },
    poster: { emoji: '📰', label: 'Poster', desc: 'Wall poster' },
    stickers: { emoji: '🎫', label: 'Stickers', desc: 'Sticker sheet' },
    card: { emoji: '💳', label: 'Card', desc: 'Greeting card' }
  };

  function handleMediaSelect(medium) {
    flowStore.setMedium(medium);
    flowStore.setState(STATES.MEDIUM_SELECTED);
  }
</script>

<div class="media-selector">
  <h2>Select a Medium</h2>
  <div class="media-grid">
    {#each CONFIG.SUPPORTED_MEDIA as medium (medium)}
      <button
        class="media-button"
        class:active={$flowStore.selectedMedium === medium}
        disabled={isLoading}
        on:click={() => handleMediaSelect(medium)}
        aria-label={`Select ${MEDIA_INFO[medium].label}`}
      >
        <div class="emoji">{MEDIA_INFO[medium].emoji}</div>
        <div class="label">{MEDIA_INFO[medium].label}</div>
        <div class="desc">{MEDIA_INFO[medium].desc}</div>
      </button>
    {/each}
  </div>
</div>

<style>
  .media-selector {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    margin: 2rem 0;
  }

  h2 {
    margin: 0;
    font-size: 1.5rem;
    color: #333;
  }

  .media-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 1rem;
  }

  .media-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1.5rem 1rem;
    background: white;
    border: 2px solid #ddd;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.9rem;
  }

  .media-button:hover:not(:disabled) {
    border-color: #3498db;
    background-color: #f0f7ff;
  }

  .media-button.active {
    border-color: #3498db;
    background-color: #e3f2fd;
    box-shadow: 0 0 10px rgba(52, 152, 219, 0.3);
  }

  .media-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .emoji {
    font-size: 2rem;
  }

  .label {
    font-weight: 600;
    color: #333;
  }

  .desc {
    font-size: 0.75rem;
    color: #666;
    text-align: center;
  }
</style>
