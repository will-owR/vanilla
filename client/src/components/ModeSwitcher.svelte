<script>
    import { modeStore } from '../stores/modeStore.js';
    import { promptStore } from '../stores/promptStore.js';

    const modes = [
        { id: 'demo', label: 'Demo Prompt → Book' },
        { id: 'basic', label: 'Basic Prompt → Book' },
        { id: 'ebook', label: 'eBook Prompt → Book' }
    ];

    function switchMode(modeId) {
        modeStore.setMode(modeId, {
            promptType: modeId,
            outputType: 'book',
            validation: modeId === 'demo' ? 'enhanced' : 'standard'
        });
        
        // Update promptStore mode as well
        promptStore.update(state => ({
            ...state,
            mode: modeId
        }));
    }
</script>

<div class="mode-selector">
    {#each modes as mode}
        <button
            class="mode-button {$modeStore.current === mode.id ? 'active' : ''}"
            on:click={() => switchMode(mode.id)}
        >
            {mode.label}
        </button>
    {/each}
</div>

<style>
    .mode-selector {
        display: flex;
        gap: 1rem;
        margin: 1.5rem 0;
        padding: 0.5rem;
        background: var(--bg-light, #f5f5f5);
        border-radius: 8px;
    }

    .mode-button {
        flex: 1;
        padding: 0.75rem 1rem;
        border: 1px solid var(--border, #e0e0e0);
        border-radius: 4px;
        background: white;
        color: var(--text-primary, #333);
        font-size: 0.9rem;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .mode-button:hover:not(:disabled) {
        background: var(--primary-light, #fff3f0);
        border-color: var(--primary, #ff3e00);
    }

    .mode-button.active {
        background: var(--primary, #ff3e00);
        color: white;
        border-color: var(--primary, #ff3e00);
    }

    .mode-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>