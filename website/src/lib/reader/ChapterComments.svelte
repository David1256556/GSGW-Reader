<script lang="ts">
  import { onMount, tick } from "svelte";
  import Icon from "@iconify/svelte";
  import { page } from "$app/state";
  import { renderMarkdown } from "./markdown-lite";
  import CommentComposer from "./CommentComposer.svelte";
  import * as api from "./comments-api";
  import type { Comment } from "./comments-api";

  let { chapter }: { chapter: string } = $props();

  const EMOJIS = ["👍", "❤️", "😂", "🎉", "😮", "😢", "🔥", "👀"];

  let me = $state<api.Me | null>(null);
  let comments = $state<Comment[]>([]);
  let loading = $state(true);
  let error = $state("");
  let replyTo = $state<number | null>(null);
  let editingId = $state<number | null>(null);
  let editDraft = $state("");
  let pickerFor = $state<number | null>(null);
  let authError = $state<string | null>(null);
  let highlightId = $state<number | null>(null);

  const returnTo = $derived(page.url.pathname);

  function repliesFor(id: number): Comment[] {
    return comments.filter((c) => c.parentId === id);
  }

  function relTime(iso: string): string {
    const normalized = iso.includes("T") ? iso : iso.replace(" ", "T") + "Z";
    const then = new Date(normalized).getTime();
    if (Number.isNaN(then)) return "";
    const diff = Math.max(0, Date.now() - then);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(normalized).toLocaleDateString();
  }

  async function load() {
    loading = true;
    error = "";
    try {
      const [meRes, commentsRes] = await Promise.all([api.getMe(), api.getComments(chapter)]);
      me = meRes.user;
      comments = commentsRes.comments;
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load comments";
    } finally {
      loading = false;
    }
  }

  async function refresh() {
    try {
      const res = await api.getComments(chapter);
      comments = res.comments;
    } catch {
      /* keep existing list */
    }
  }

  $effect(() => {
    chapter;
    load();
  });

  onMount(() => {
    authError = new URLSearchParams(window.location.search).get("auth_error");
    const id = setInterval(() => {
      if (document.hidden || editingId !== null) return;
      api
        .getComments(chapter)
        .then((res) => (comments = res.comments))
        .catch(() => {});
    }, 10000);
    return () => clearInterval(id);
  });

  async function postNew(body: string) {
    await api.postComment(chapter, body, null);
    await refresh();
  }

  async function postReply(parentId: number, body: string) {
    const { comment } = await api.postComment(chapter, body, parentId);
    replyTo = null;
    await refresh();
    const id = comment?.id;
    if (id) {
      await tick();
      document
        .querySelector(`[data-cmt-id="${id}"]`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
      highlightId = id;
      setTimeout(() => {
        if (highlightId === id) highlightId = null;
      }, 1800);
    }
  }

  async function react(id: number, emoji: string) {
    if (!me) {
      error = "Sign in with Discord to react.";
      return;
    }
    try {
      const { reactions } = await api.toggleReaction(id, emoji);
      comments = comments.map((c) => (c.id === id ? { ...c, reactions } : c));
      pickerFor = null;
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to react";
    }
  }

  function startEdit(comment: Comment) {
    editingId = comment.id;
    editDraft = comment.body;
  }

  async function saveEdit() {
    if (editingId === null) return;
    const body = editDraft.trim();
    if (!body) return;
    try {
      await api.editComment(editingId, body);
      editingId = null;
      await refresh();
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to edit";
    }
  }

  async function removeComment(id: number) {
    if (!confirm("Delete this comment?")) return;
    try {
      await api.deleteComment(id);
      await refresh();
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to delete";
    }
  }
</script>

{#if authError}
  <div class="mb-4 flex items-start gap-2.5 rounded-xl border border-error/25 bg-error/10 px-4 py-3 text-sm text-error">
    <Icon icon="lucide:alert-circle" class="mt-0.5 size-4 shrink-0" />
    <span>{authError === "state" ? "Sign-in session expired. Please try again." : "Sign-in failed. Please try again."}</span>
  </div>
{/if}

{#if error}
  <div class="mb-4 flex items-start gap-2.5 rounded-xl border border-error/25 bg-error/10 px-4 py-2.5 text-sm text-error">
    <Icon icon="lucide:alert-circle" class="mt-0.5 size-4 shrink-0" />
    <span>{error}</span>
  </div>
{/if}

{#if me}
  <div class="mb-5 flex items-center gap-3 rounded-2xl border border-base-content/10 bg-base-100 px-3 py-2.5">
    {#if me.avatarUrl}
      <img src={me.avatarUrl} alt="" class="cmt-avatar ring-2 ring-base-content/10" />
    {:else}
      <div class="size-9 rounded-full bg-base-content/10"></div>
    {/if}
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-1.5">
        <span class="truncate text-sm font-semibold text-base-content">{me.displayName}</span>
        <span class="inline-flex shrink-0 items-center gap-1 rounded-md bg-[#5865F2]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#5865F2]">
          <Icon icon="mdi:discord" class="size-3" /> Discord
        </span>
      </div>
      <span class="block truncate text-xs text-base-content/45">Posting as {me.login}</span>
    </div>
    <button
      type="button"
      class="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-base-content/50 transition-colors hover:bg-base-content/5 hover:text-base-content"
      onclick={() => (window.location.href = api.logoutUrl(returnTo))}
      aria-label="Sign out"
    >
      <Icon icon="lucide:log-out" class="size-4" />
      <span class="hidden sm:inline">Sign out</span>
    </button>
  </div>
{:else}
  <div class="mb-5 flex flex-col items-center gap-3 rounded-2xl border border-base-content/10 bg-base-100 px-4 py-6 text-center">
    <div class="flex size-11 items-center justify-center rounded-full bg-[#5865F2]/15">
      <Icon icon="mdi:discord" class="size-6 text-[#5865F2]" />
    </div>
    <div>
      <p class="text-sm font-semibold text-base-content">Join the discussion</p>
      <p class="mt-0.5 text-xs text-base-content/50">Sign in with Discord to comment and react.</p>
    </div>
    <button
      type="button"
      class="inline-flex items-center gap-2 rounded-xl bg-[#5865F2] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#4752C4]"
      onclick={() => (window.location.href = api.loginUrl(returnTo))}
    >
      <Icon icon="mdi:discord" class="size-4" />
      Sign in with Discord
    </button>
  </div>
{/if}

{#if me}
  <div class="mb-5 flex gap-2.5 sm:gap-3">
    {#if me.avatarUrl}
      <img src={me.avatarUrl} alt="" class="cmt-avatar hidden ring-2 ring-base-content/10 sm:block" />
    {:else}
      <div class="hidden size-9 shrink-0 rounded-full bg-base-content/10 sm:block"></div>
    {/if}
    <div class="min-w-0 flex-1">
      <CommentComposer placeholder="Write a comment…" submitLabel="Comment" onSubmit={postNew} />
    </div>
  </div>
{/if}

{#if loading}
  <div class="py-8 text-center text-sm text-base-content/40">Loading comments…</div>
{:else if comments.length === 0}
  <div class="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-base-content/15 py-10 text-center">
    <Icon icon="lucide:message-square-dashed" class="size-6 text-base-content/25" />
    <p class="text-sm text-base-content/45">No comments yet. Be the first!</p>
  </div>
{:else}
  <ul class="cmt-list space-y-3">
    {#each comments.filter((c) => !c.parentId) as comment (comment.id)}
      <li
        data-cmt-id={comment.id}
        class="rounded-2xl border border-base-content/10 bg-base-100 p-3.5 transition-colors hover:border-base-content/20 sm:p-4 {highlightId === comment.id ? 'cmt-flash' : ''}"
      >
        {@render commentItem(comment)}
        {#if repliesFor(comment.id).length > 0}
          <ul class="cmt-list mt-3.5 space-y-3.5 border-l-2 border-base-content/10 pl-3.5 sm:pl-4">
            {#each repliesFor(comment.id) as reply (reply.id)}
              <li data-cmt-id={reply.id} class="rounded-xl {highlightId === reply.id ? 'cmt-flash' : ''}">{@render commentItem(reply)}</li>
            {/each}
          </ul>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

{#snippet commentItem(comment: Comment)}
  <div class="flex gap-3">
    {#if comment.author.avatarUrl}
      <img src={comment.author.avatarUrl} alt="" class="cmt-avatar ring-1 ring-base-content/10" loading="lazy" />
    {:else}
      <div class="size-9 shrink-0 rounded-full bg-base-content/10"></div>
    {/if}
    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span class="text-sm font-semibold text-base-content">{comment.author.displayName}</span>
        {#if comment.author.provider === "discord"}
          <span class="inline-flex items-center gap-1 rounded-md bg-[#5865F2]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#5865F2]">
            <Icon icon="mdi:discord" class="size-3" /> Discord
          </span>
        {:else}
          <span class="inline-flex items-center gap-1 rounded-md bg-base-content/10 px-1.5 py-0.5 text-[10px] font-semibold text-base-content/60">
            <Icon icon="mdi:github" class="size-3" /> GitHub
          </span>
        {/if}
        {#if comment.author.isLegacy}
          <span class="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600" title="Migrated from the original GitHub comments">
            <Icon icon="lucide:history" class="size-3" /> legacy
          </span>
        {/if}
        <span class="text-xs text-base-content/40" title={comment.createdAt}>{relTime(comment.createdAt)}</span>
        {#if comment.edited}<span class="text-xs text-base-content/30">· edited</span>{/if}
      </div>

      {#if editingId === comment.id}
        <div class="mt-2">
          <textarea bind:value={editDraft} rows="3" maxlength="4000" class="block w-full resize-none rounded-xl border border-base-content/15 bg-base-200/50 px-3 py-2 text-sm leading-relaxed text-base-content outline-none focus:border-primary/50"></textarea>
          <div class="mt-1.5 flex gap-2">
            <button type="button" class="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-content transition-colors hover:bg-primary/90" onclick={saveEdit}>Save</button>
            <button type="button" class="rounded-lg px-3 py-1 text-xs font-medium text-base-content/60 transition-colors hover:bg-base-content/5" onclick={() => (editingId = null)}>Cancel</button>
          </div>
        </div>
      {:else}
        <div class="md mt-1.5 text-sm leading-relaxed text-base-content/90 break-words">
          {@html renderMarkdown(comment.body)}
        </div>
      {/if}

      <div class="mt-2.5 flex flex-wrap items-center gap-1.5">
        {#each comment.reactions.filter((r) => r.count > 0) as reaction (reaction.emoji)}
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors {reaction.mine ? 'border-primary/50 bg-primary/10 text-primary' : 'border-base-content/10 bg-base-200/50 text-base-content/70 hover:border-primary/30 hover:bg-base-200'}"
            title={reaction.users.join(", ")}
            onclick={() => react(comment.id, reaction.emoji)}
          >
            <span class="text-sm leading-none">{reaction.emoji}</span>
            <span class="tabular-nums">{reaction.count}</span>
          </button>
        {/each}

        <button
          type="button"
          class="inline-flex items-center rounded-full border p-2 transition-colors {pickerFor === comment.id ? 'border-primary/40 text-primary' : 'border-base-content/10 bg-base-200/50 text-base-content/45 hover:border-primary/30 hover:text-primary'}"
          onclick={() => (pickerFor = pickerFor === comment.id ? null : comment.id)}
          aria-label="Add reaction"
        >
          <Icon icon="lucide:smile-plus" class="size-4" />
        </button>

        {#if me}
          <button type="button" class="ml-0.5 rounded-lg px-2 py-1 text-xs font-medium transition-colors hover:bg-base-content/5 hover:text-primary {replyTo === comment.id ? 'text-primary' : 'text-base-content/50'}" onclick={() => (replyTo = replyTo === comment.id ? null : comment.id)}>Reply</button>
        {/if}
        {#if me && me.login === comment.author.login && comment.author.provider === "discord"}
          <button type="button" class="rounded-lg px-2 py-1 text-xs font-medium text-base-content/50 transition-colors hover:bg-base-content/5 hover:text-primary" onclick={() => startEdit(comment)}>Edit</button>
          <button type="button" class="rounded-lg px-2 py-1 text-xs font-medium text-base-content/50 transition-colors hover:bg-error/10 hover:text-error" onclick={() => removeComment(comment.id)}>Delete</button>
        {/if}
      </div>

      {#if pickerFor === comment.id}
        <div class="mt-2 flex flex-wrap gap-0.5 rounded-xl border border-base-content/10 bg-base-200/40 p-1.5">
          {#each EMOJIS as emoji (emoji)}
            <button type="button" class="rounded-lg px-2 py-1.5 text-base leading-none transition-colors hover:bg-base-200" onclick={() => react(comment.id, emoji)}>{emoji}</button>
          {/each}
        </div>
      {/if}

      {#if me && replyTo === comment.id}
        <div class="mt-3">
          <CommentComposer
            autofocus
            placeholder={`Reply to ${comment.author.displayName}…`}
            submitLabel="Reply"
            onSubmit={(body) => postReply(comment.id, body)}
            onCancel={() => (replyTo = null)}
          />
        </div>
      {/if}
    </div>
  </div>
{/snippet}

<style>
  .cmt-list {
    list-style: none;
  }
  .cmt-flash {
    animation: cmt-flash 1.8s ease-out;
  }
  @keyframes cmt-flash {
    0%,
    20% {
      background-color: color-mix(in oklab, var(--color-primary) 22%, transparent);
    }
    100% {
      background-color: transparent;
    }
  }
  .cmt-avatar {
    width: 2.25rem;
    height: 2.25rem;
    min-width: 2.25rem;
    margin: 0;
    object-fit: cover;
    border-radius: 9999px;
    flex-shrink: 0;
  }
  .md :global(p) {
    margin: 0 0 0.5rem;
  }
  .md :global(p:last-child) {
    margin-bottom: 0;
  }
  .md :global(a) {
    color: var(--color-primary);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .md :global(a:hover) {
    text-decoration: none;
  }
  .md :global(code) {
    background: color-mix(in oklab, currentColor 10%, transparent);
    padding: 0.1rem 0.3rem;
    border-radius: 0.25rem;
    font-size: 0.85em;
  }
  .md :global(del) {
    opacity: 0.6;
  }
  .md :global(strong) {
    font-weight: 600;
  }
</style>
