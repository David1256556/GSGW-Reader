<script lang="ts">
  import type { WindowItem } from "./windows-catalog";

  let { label, html, cls = "", pad = 0, followup = null }: {
    label: string;
    html: string;
    cls?: string;
    pad?: number;
    followup?: WindowItem | null;
  } = $props();
</script>

<div class="rounded-xl border border-base-content/5 bg-base-100/50 p-3">
  <div class="mb-2 text-[9px] font-mono font-medium uppercase tracking-wider text-base-content/30">{label}</div>
  <div class="reader-container win-preview win-stack" style="padding-top: 0; padding-bottom: 0; padding-inline: {pad}px;">
    {#if cls}
      <div class="{cls}">{@html html}</div>
    {:else}
      {@html html}
    {/if}
    {#if followup}
      <div class="flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-wider text-base-content/30">
        <span class="text-base-content/20">↳</span>
        <span>{followup.name}</span>
      </div>
      <div class="{followup.cls}">{@html followup.html}</div>
    {/if}
  </div>
</div>

<style>
  .win-stack :global(.wiki-window),
  .win-stack :global(.record-window),
  .win-stack :global(.plain-window),
  .win-stack :global(.followup-window) {
    margin-top: 0.3rem !important;
    margin-bottom: 0.3rem !important;
  }
</style>