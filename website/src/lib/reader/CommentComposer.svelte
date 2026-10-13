<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "@iconify/svelte";

  let {
    placeholder = "Write a comment…",
    submitLabel = "Comment",
    autofocus = false,
    onSubmit,
    onCancel = null,
  }: {
    placeholder?: string;
    submitLabel?: string;
    autofocus?: boolean;
    onSubmit: (body: string) => Promise<void>;
    onCancel?: (() => void) | null;
  } = $props();

  let draft = $state("");
  let posting = $state(false);
  let err = $state("");
  let ta = $state<HTMLTextAreaElement | null>(null);

  $effect(() => {
    draft;
    const el = ta;
    if (!el) return;
    el.style.height = "auto";
    const max = Math.round(window.innerHeight * 0.4);
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  });

  onMount(() => {
    if (!autofocus) return;
    ta?.focus();
    ta?.scrollIntoView({ block: "center", behavior: "smooth" });
  });

  async function submit() {
    const body = draft.trim();
    if (!body || posting) return;
    posting = true;
    err = "";
    try {
      await onSubmit(body);
      draft = "";
    } catch (e) {
      err = e instanceof Error ? e.message : "Failed to post comment";
    } finally {
      posting = false;
    }
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      submit();
    }
  }
</script>

<div>
  <div class="rounded-2xl border border-base-content/10 bg-base-100 transition-all focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15">
    <textarea
      bind:this={ta}
      bind:value={draft}
      onkeydown={onKeydown}
      rows="2"
      maxlength="4000"
      {placeholder}
      class="block w-full resize-none border-0 bg-transparent px-3.5 py-2.5 text-sm leading-relaxed text-base-content outline-none placeholder:text-base-content/35"
    ></textarea>
    <div class="flex items-center justify-between gap-2 border-t border-base-content/5 px-3 py-1.5">
      <span class="text-[11px] tabular-nums text-base-content/40">{draft.length}/4000</span>
      <div class="flex items-center gap-1.5">
        {#if onCancel}
          <button
            type="button"
            class="rounded-lg px-3 py-1.5 text-xs font-medium text-base-content/60 transition-colors hover:bg-base-content/5"
            onclick={onCancel}
          >
            Cancel
          </button>
        {/if}
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-content transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={posting || !draft.trim()}
          onclick={submit}
        >
          <Icon icon="lucide:send" class="size-3.5" />
          {posting ? "Posting…" : submitLabel}
        </button>
      </div>
    </div>
  </div>
  {#if err}
    <div class="mt-1.5 text-xs text-error">{err}</div>
  {/if}
</div>
