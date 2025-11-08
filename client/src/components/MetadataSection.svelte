<script>
    import { promptStore } from '../stores/promptStore';
    
    // Local state for form validation and loading
    let errors = {
        title: '',
        author: '',
        pages: ''
    };
    
    // Subscribe to loading state
    $: isLoading = $promptStore.generating;
    
    // Local state that syncs with the store
    let metadata = {
        title: '',
        author: '',
        pages: ''
    };
    
    // Subscribe to store changes
    $: {
        if ($promptStore.metadata) {
            metadata = { ...$promptStore.metadata };
        }
    }
    
    // Validation functions
    function validateTitle(value) {
        if (!value.trim()) {
            errors.title = 'Title is required';
            return false;
        }
        errors.title = '';
        return true;
    }
    
    function validateAuthor(value) {
        if (!value.trim()) {
            errors.author = 'Author is required';
            return false;
        }
        errors.author = '';
        return true;
    }
    
    function validatePages(value) {
        const pages = parseInt(value);
        if (isNaN(pages) || pages < 1) {
            errors.pages = 'Pages must be a positive number';
            return false;
        }
        errors.pages = '';
        return true;
    }
    
    // Update store when input changes
    function updateStore() {
        promptStore.update(store => ({
            ...store,
            metadata: {
                ...metadata,
                pages: parseInt(metadata.pages) || undefined
            }
        }));
    }
</script>

<div class="metadata-section" class:loading={isLoading}>
    <h3>Book Details {#if isLoading}<span class="loading-text">(Generating...)</span>{/if}</h3>
    <div class="metadata-grid">
        <div class="field">
            <label for="title">Title</label>
            <div class="input-wrapper">
                <input
                    type="text"
                    id="title"
                    bind:value={metadata.title}
                    on:blur={() => {
                        validateTitle(metadata.title);
                        updateStore();
                    }}
                    placeholder="Enter book title"
                    disabled={isLoading}
                    class:loading={isLoading}
                />
                {#if isLoading}
                    <div class="loading-spinner"></div>
                {/if}
            </div>
            {#if errors.title}
                <span class="error">{errors.title}</span>
            {/if}
        </div>

        <div class="field">
            <label for="author">Author</label>
            <div class="input-wrapper">
                <input
                    type="text"
                    id="author"
                    bind:value={metadata.author}
                    on:blur={() => {
                        validateAuthor(metadata.author);
                        updateStore();
                    }}
                    placeholder="Enter author name"
                    disabled={isLoading}
                    class:loading={isLoading}
                />
                {#if isLoading}
                    <div class="loading-spinner"></div>
                {/if}
            </div>
            {#if errors.author}
                <span class="error">{errors.author}</span>
            {/if}
        </div>

        <div class="field">
            <label for="pages">Pages</label>
            <div class="input-wrapper">
                <input
                    type="number"
                    id="pages"
                    bind:value={metadata.pages}
                    on:blur={() => {
                        validatePages(metadata.pages);
                        updateStore();
                    }}
                    min="1"
                    placeholder="Enter page count"
                    disabled={isLoading}
                    class:loading={isLoading}
                />
                {#if isLoading}
                    <div class="loading-spinner"></div>
                {/if}
            </div>
            {#if errors.pages}
                <span class="error">{errors.pages}</span>
            {/if}
        </div>
    </div>
</div>

<style>
    .metadata-section {
        background: var(--bg-light);
        padding: 1.5rem;
        border-radius: 8px;
        margin-bottom: 1.5rem;
        transition: opacity 0.2s ease;
    }

    .metadata-section.loading {
        opacity: 0.7;
    }

    h3 {
        margin: 0 0 1rem 0;
        color: var(--text-primary);
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .loading-text {
        color: var(--text-secondary);
        font-size: 0.875rem;
        font-weight: normal;
        font-style: italic;
    }

    .metadata-grid {
        display: grid;
        gap: 1rem;
    }

    .field {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    label {
        font-weight: 500;
        color: var(--text-secondary);
    }

    input {
        padding: 0.75rem;
        border: 1px solid var(--border);
        border-radius: 4px;
        font-size: 1rem;
        transition: border-color 0.2s;
    }

    input:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 0 2px var(--primary-light);
    }

    input:disabled {
        background-color: var(--bg-disabled, #f5f5f5);
        cursor: not-allowed;
        opacity: 0.7;
    }

    input.loading {
        padding-right: 2.5rem;
    }

    .input-wrapper {
        position: relative;
        display: flex;
        align-items: center;
    }

    .loading-spinner {
        position: absolute;
        right: 0.75rem;
        width: 1rem;
        height: 1rem;
        border: 2px solid var(--primary-light);
        border-top-color: var(--primary);
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    .error {
        color: var(--error);
        font-size: 0.875rem;
    }

    /* Responsive grid */
    @media (min-width: 768px) {
        .metadata-grid {
            grid-template-columns: repeat(3, 1fr);
        }
    }
</style>