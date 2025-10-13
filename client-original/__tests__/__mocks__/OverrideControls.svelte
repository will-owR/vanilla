<script>
  // No-op mock for OverrideControls to avoid SSR lifecycle errors in tests
  export let visible = false;
</script>

{#if visible}
  <div data-testid="override-controls-mock">
    Mock Override Controls
  </div>
{/if}