<script>
    import { promptStore } from '../stores/promptStore';
    
    // Local state for form validation
    let errors = {
        title: '',
        author: '',
        pages: ''
    };
    
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

<div class="metadata-section">
    <h3>Book Details</h3>
    <div class="metadata-grid">
        <div class="field">
            <label for="title">Title</label>
            <input
                type="text"
                id="title"
                bind:value={metadata.title}
                on:blur={() => {
                    validateTitle(metadata.title);
                    updateStore();
                }}
                placeholder="Enter book title"
            />
            {#if errors.title}
                <span class="error">{errors.title}</span>
            {/if}
        </div>

        <div class="field">
            <label for="author">Author</label>
            <input
                type="text"
                id="author"
                bind:value={metadata.author}
                on:blur={() => {
                    validateAuthor(metadata.author);
                    updateStore();
                }}
                placeholder="Enter author name"
            />
            {#if errors.author}
                <span class="error">{errors.author}</span>
            {/if}
        </div>

        <div class="field">
            <label for="pages">Pages</label>
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
            />
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
    }

    h3 {
        margin: 0 0 1rem 0;
        color: var(--text-primary);
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