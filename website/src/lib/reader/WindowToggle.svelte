<script lang="ts">
  import Icon from "@iconify/svelte";

  let { label, value, onChange, labels = ["On", "Off"], previewShown, onEyeClick }: {
    label: string;
    value: boolean;
    onChange: (value: boolean) => void;
    labels?: [string, string];
    previewShown?: boolean;
    onEyeClick?: () => void;
  } = $props();
</script>

<div class="flex items-center justify-between gap-3 rounded-xl border border-base-content/10 bg-base-200/40 px-4 py-3">
  <span class="min-w-0 truncate text-sm font-medium">{label}</span>
  <div class="flex items-center gap-2">
    <div class="flex shrink-0 rounded-full bg-base-100 p-0.5 ring-1 ring-base-content/10">
      <button
        class="rounded-full px-4 py-1 text-xs font-semibold transition-colors {value ? 'bg-primary text-primary-content shadow-sm' : 'text-base-content/50 hover:text-base-content'}"
        onclick={() => onChange(true)}
      >
        {labels[0]}
      </button>
      <button
        class="rounded-full px-4 py-1 text-xs font-semibold transition-colors {!value ? 'bg-primary text-primary-content shadow-sm' : 'text-base-content/50 hover:text-base-content'}"
        onclick={() => onChange(false)}
      >
        {labels[1]}
      </button>
    </div>
    {#if onEyeClick}
      <button
        onclick={onEyeClick}
        class="shrink-0 rounded-md p-1.5 transition-colors {previewShown ? 'text-primary' : 'text-base-content/30 hover:text-base-content/70'}"
        title={previewShown ? "Hide previews" : "Show previews"}
        aria-label={previewShown ? "Hide previews" : "Show previews"}
      >
        <Icon icon={previewShown ? "mdi:eye" : "mdi:eye-outline"} class="size-4" />
      </button>
    {/if}
  </div>
</div>