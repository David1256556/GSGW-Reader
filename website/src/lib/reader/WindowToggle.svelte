<script lang="ts">
  let { label, value, onChange, labels = ["On", "Off"] }: {
    label: string;
    value: boolean;
    onChange: (value: boolean) => void;
    labels?: [string, string];
  } = $props();
</script>

<div class="flex items-center justify-between gap-3 rounded-xl border border-base-content/10 bg-base-200/40 px-4 py-3">
  <span class="text-sm font-medium">{label}</span>
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
</div>