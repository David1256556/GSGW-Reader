<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "@iconify/svelte";
  import book_meta from "$lib/meta.json";

  interface Totals {
    comments: number;
    discord: number;
    github: number;
    chapters: number;
    users: number;
    reactions: number;
    chapterReactions: number;
  }

  interface ChapterStat {
    chapter: string;
    total: number;
    discord: number;
    github: number;
    reactions: number;
    chapterReactions: number;
    lastAt: string | null;
  }

  interface Author {
    login: string;
    displayName: string;
    avatarUrl: string | null;
    provider: string;
    isLegacy: boolean;
  }

  interface RecentComment {
    id: number;
    chapter: string;
    parentId: number | null;
    body: string;
    isLegacy: boolean;
    createdAt: string;
    author: Author;
    reactionCount: number;
  }

  interface ThreadComment {
    id: number;
    chapter: string;
    parentId: number | null;
    body: string;
    isLegacy: boolean;
    createdAt: string;
    edited: boolean;
    author: Author;
    reactions: { emoji: string; count: number }[];
  }

  interface Dashboard {
    totals: Totals;
    chapters: ChapterStat[];
    recent: RecentComment[];
  }

  const meta = book_meta as unknown as Record<string, any>;

  const titleMap = new Map<string, string>();
  function indexEntries(book: string, tl: string, entries: any[]) {
    for (const e of entries ?? []) {
      const label = [e.section, e.title].filter(Boolean).join(" · ");
      titleMap.set(`read/${book}/${tl}/${e.slug}`, label || String(e.slug));
    }
  }
  for (const tl of ["mtl", "fantl", "unformattedtl"]) indexEntries("gsgw", tl, meta["gsgw"]?.[tl]);
  for (const tl of Object.keys(meta["manwha"] ?? {})) indexEntries("manwha", tl, meta["manwha"][tl]);
  for (const tl of Object.keys(meta["debut"] ?? {})) indexEntries("debut", tl, meta["debut"][tl]);
  for (const r of meta["uder"]?.records ?? []) titleMap.set(`read/uder/${r.slug}`, r.title);

  function titleOf(chapter: string): string {
    return titleMap.get(chapter) ?? chapter;
  }
  function chapterHref(chapter: string): string {
    return "/" + chapter.split("/").map(encodeURIComponent).join("/");
  }
  function fmtDate(value: string | null): string {
    if (!value) return "";
    const iso = value.includes("T") ? value : value.replace(" ", "T") + "Z";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  let data = $state<Dashboard | null>(null);
  let loading = $state(true);
  let error = $state("");
  let provider = $state<"all" | "discord" | "github">("all");
  let query = $state("");
  let selectedChapter = $state<string | null>(null);
  let thread = $state<ThreadComment[] | null>(null);
  let threadLoading = $state(false);
  let threadError = $state("");

  async function load() {
    loading = true;
    error = "";
    try {
      const res = await fetch("/api/dev/comments?limit=150", { credentials: "same-origin" });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      data = (await res.json()) as Dashboard;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    loading = false;
  }

  async function openChapter(chapter: string) {
    selectedChapter = chapter;
    threadLoading = true;
    threadError = "";
    thread = null;
    try {
      const res = await fetch(`/api/comments?chapter=${encodeURIComponent(chapter)}`, {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const body = await res.json();
      thread = (body.comments ?? []) as ThreadComment[];
    } catch (e) {
      threadError = e instanceof Error ? e.message : String(e);
    }
    threadLoading = false;
  }

  function closeThread() {
    selectedChapter = null;
    thread = null;
    threadError = "";
  }

  const filteredChapters = $derived.by(() => {
    const list = data?.chapters ?? [];
    const q = query.trim().toLowerCase();
    return list.filter((c) => {
      if (provider === "discord" && c.discord === 0) return false;
      if (provider === "github" && c.github === 0) return false;
      if (q && !titleOf(c.chapter).toLowerCase().includes(q) && !c.chapter.toLowerCase().includes(q))
        return false;
      return true;
    });
  });

  const filteredRecent = $derived.by(() => {
    const list = data?.recent ?? [];
    if (provider === "all") return list;
    return list.filter((c) => c.author.provider === provider);
  });

  const stats = $derived.by(() => {
    const t = data?.totals;
    if (!t) return [];
    return [
      { label: "Comments", value: t.comments, icon: "lucide:message-square", cls: "text-base-content/60" },
      { label: "Discord", value: t.discord, icon: "ic:baseline-discord", cls: "text-indigo-400" },
      { label: "GitHub", value: t.github, icon: "mdi:github", cls: "text-base-content/60" },
      { label: "Chapters", value: t.chapters, icon: "lucide:book-open", cls: "text-primary" },
      { label: "Reactions", value: t.reactions + t.chapterReactions, icon: "lucide:smile-plus", cls: "text-amber-400" },
      { label: "Users", value: t.users, icon: "lucide:users", cls: "text-emerald-400" },
    ];
  });

  const threadRoots = $derived.by(() => {
    const list = thread ?? [];
    const repliesByParent = new Map<number, ThreadComment[]>();
    for (const c of list) {
      if (c.parentId === null) continue;
      const arr = repliesByParent.get(c.parentId) ?? [];
      arr.push(c);
      repliesByParent.set(c.parentId, arr);
    }
    return list
      .filter((c) => c.parentId === null)
      .map((root) => ({ root, replies: repliesByParent.get(root.id) ?? [] }));
  });

  onMount(load);
</script>

<svelte:head>
  <title>Comments Dashboard – GSGW-Reader</title>
</svelte:head>

<div class="min-h-dvh bg-base-200/40">
  <nav class="sticky top-0 z-40 flex w-full items-center gap-2 sm:gap-4 border-b border-base-content/10 bg-base-100/90 px-4 py-3 backdrop-blur-md">
    <a href="/" class="btn btn-ghost btn-sm btn-square rounded-btn" aria-label="Home">
      <Icon icon="material-symbols:home-outline-rounded" class="size-5" />
    </a>
    <div class="flex items-center gap-2">
      <Icon icon="lucide:message-square-text" class="size-5 text-primary" />
      <h1 class="text-base font-bold tracking-tight">Comments Dashboard</h1>
    </div>
    <button
      class="btn btn-ghost btn-sm ml-auto gap-1.5 rounded-btn"
      onclick={load}
      disabled={loading}
      title="Refresh"
    >
      <Icon icon="material-symbols:refresh" class="size-4 {loading ? 'animate-spin' : ''}" />
      <span class="hidden sm:inline">Refresh</span>
    </button>
  </nav>

  <main class="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
    {#if error}
      <div class="rounded-2xl border border-error/30 bg-error/10 p-6 text-sm text-error">{error}</div>
    {:else if loading && !data}
      <div class="flex flex-col items-center justify-center gap-3 py-32 text-base-content/50">
        <Icon icon="svg-spinners:180-ring" class="size-8" />
        <span class="text-sm">Loading comments…</span>
      </div>
    {:else if data}
      <!-- Stat cards -->
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {#each stats as s}
          <div class="rounded-2xl border border-base-content/10 bg-base-100 p-4 shadow-sm">
            <div class="flex items-center gap-2 text-base-content/40">
              <Icon icon={s.icon} class="size-4 {s.cls}" />
              <span class="text-[10px] font-bold uppercase tracking-widest">{s.label}</span>
            </div>
            <div class="mt-2 font-mono text-2xl font-bold tabular-nums">{s.value.toLocaleString()}</div>
          </div>
        {/each}
      </div>

      <!-- Controls -->
      <div class="mt-5 flex flex-wrap items-center gap-3">
        <div class="join rounded-btn">
          {#each [["all", "All"], ["discord", "Discord"], ["github", "GitHub"]] as [value, label]}
            <button
              class="join-item btn btn-sm rounded-btn {provider === value ? 'btn-primary' : 'btn-ghost bg-base-100'}"
              onclick={() => (provider = value as "all" | "discord" | "github")}
            >
              {label}
            </button>
          {/each}
        </div>
        <label class="input input-sm rounded-btn bg-base-100 flex items-center gap-2 sm:w-72">
          <Icon icon="lucide:search" class="size-4 opacity-40" />
          <input
            type="search"
            class="grow"
            placeholder="Filter by chapter or title…"
            bind:value={query}
          />
        </label>
        <span class="ml-auto font-mono text-xs text-base-content/40">
          {filteredChapters.length} / {data.chapters.length} chapters
        </span>
      </div>

      <div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <!-- Chapters -->
        <section class="lg:col-span-3">
          <div class="rounded-2xl border border-base-content/10 bg-base-100 shadow-sm">
            <div class="flex items-center gap-2 border-b border-base-content/10 px-4 py-3">
              <Icon icon="lucide:book-open" class="size-4 text-base-content/40" />
              <h2 class="text-xs font-bold uppercase tracking-widest text-base-content/50">Chapters</h2>
            </div>
            <div class="max-h-[70vh] overflow-y-auto">
              {#each filteredChapters as c (c.chapter)}
                <button
                  class="flex w-full items-center gap-3 border-b border-base-content/5 px-4 py-3 text-left transition-colors hover:bg-base-content/5 {selectedChapter === c.chapter ? 'bg-primary/10' : ''}"
                  onclick={() => openChapter(c.chapter)}
                >
                  <div class="min-w-0 flex-1">
                    <div class="truncate text-sm font-semibold leading-tight">{titleOf(c.chapter)}</div>
                    <div class="truncate font-mono text-[11px] text-base-content/40">{c.chapter}</div>
                  </div>
                  <div class="flex shrink-0 items-center gap-1.5 font-mono text-[11px] tabular-nums">
                    {#if c.discord > 0}
                      <span class="flex items-center gap-0.5 rounded-full bg-indigo-500/10 px-2 py-0.5 text-indigo-400" title="Discord">
                        <Icon icon="ic:baseline-discord" class="size-3" />{c.discord}
                      </span>
                    {/if}
                    {#if c.github > 0}
                      <span class="flex items-center gap-0.5 rounded-full bg-base-content/10 px-2 py-0.5 text-base-content/60" title="GitHub (legacy)">
                        <Icon icon="mdi:github" class="size-3" />{c.github}
                      </span>
                    {/if}
                    {#if c.chapterReactions > 0}
                      <span class="flex items-center gap-0.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-500" title="Chapter reactions">
                        <Icon icon="lucide:flame" class="size-3" />{c.chapterReactions}
                      </span>
                    {/if}
                    <span class="w-10 text-right font-bold text-base-content/80">{c.total}</span>
                  </div>
                </button>
              {:else}
                <div class="px-4 py-10 text-center text-sm text-base-content/40">No chapters match.</div>
              {/each}
            </div>
          </div>
        </section>

        <!-- Recent comments -->
        <section class="lg:col-span-2">
          <div class="rounded-2xl border border-base-content/10 bg-base-100 shadow-sm">
            <div class="flex items-center gap-2 border-b border-base-content/10 px-4 py-3">
              <Icon icon="lucide:clock" class="size-4 text-base-content/40" />
              <h2 class="text-xs font-bold uppercase tracking-widest text-base-content/50">Recent Comments</h2>
            </div>
            <div class="max-h-[70vh] divide-y divide-base-content/5 overflow-y-auto">
              {#each filteredRecent as c (c.id)}
                <button
                  class="block w-full px-4 py-3 text-left transition-colors hover:bg-base-content/5"
                  onclick={() => openChapter(c.chapter)}
                >
                  <div class="flex items-center gap-2">
                    {#if c.author.avatarUrl}
                      <img src={c.author.avatarUrl} alt="" class="cmt-avatar" />
                    {:else}
                      <div class="cmt-avatar grid place-items-center bg-base-content/10 text-[10px] font-bold">
                        {(c.author.displayName || "?")[0]}
                      </div>
                    {/if}
                    <span class="truncate text-xs font-semibold">{c.author.displayName}</span>
                    {#if c.author.provider === "discord"}
                      <Icon icon="ic:baseline-discord" class="size-3.5 shrink-0 text-indigo-400" />
                    {:else}
                      <Icon icon="mdi:github" class="size-3.5 shrink-0 text-base-content/50" />
                    {/if}
                    <span class="ml-auto shrink-0 font-mono text-[10px] text-base-content/40">{fmtDate(c.createdAt)}</span>
                  </div>
                  <p class="mt-1.5 line-clamp-3 text-xs leading-relaxed text-base-content/70">{c.body}</p>
                  <div class="mt-1.5 flex items-center gap-2 font-mono text-[10px] text-base-content/40">
                    <span class="truncate">{titleOf(c.chapter)}</span>
                    {#if c.reactionCount > 0}
                      <span class="ml-auto flex shrink-0 items-center gap-0.5">
                        <Icon icon="lucide:smile" class="size-3" />{c.reactionCount}
                      </span>
                    {/if}
                  </div>
                </button>
              {:else}
                <div class="px-4 py-10 text-center text-sm text-base-content/40">No comments match.</div>
              {/each}
            </div>
          </div>
        </section>
      </div>
    {/if}
  </main>
</div>

<!-- Thread viewer -->
{#if selectedChapter}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
    onclick={closeThread}
    role="presentation"
  >
    <div
      class="my-8 w-full max-w-2xl overflow-hidden rounded-2xl border border-base-content/10 bg-base-100 shadow-2xl"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-label="Chapter comments"
      tabindex="-1"
    >
      <div class="flex items-start gap-3 border-b border-base-content/10 px-5 py-4">
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-bold">{titleOf(selectedChapter)}</div>
          <a
            href={chapterHref(selectedChapter)}
            class="truncate font-mono text-[11px] text-primary hover:underline"
          >
            {selectedChapter}
          </a>
        </div>
        <a
          href={chapterHref(selectedChapter)}
          class="btn btn-ghost btn-xs gap-1 rounded-btn"
          title="Open chapter"
        >
          <Icon icon="lucide:external-link" class="size-3.5" />
        </a>
        <button class="btn btn-ghost btn-sm btn-square rounded-btn" onclick={closeThread} aria-label="Close">
          <Icon icon="mdi:close" class="size-4" />
        </button>
      </div>

      <div class="max-h-[70vh] overflow-y-auto p-5">
        {#if threadLoading}
          <div class="flex items-center justify-center gap-2 py-16 text-base-content/40">
            <Icon icon="svg-spinners:180-ring" class="size-6" />
          </div>
        {:else if threadError}
          <div class="py-16 text-center text-sm text-error">{threadError}</div>
        {:else if threadRoots.length > 0}
          <div class="space-y-4">
            {#each threadRoots as { root, replies } (root.id)}
              <div class="rounded-xl border border-base-content/10 bg-base-200/50 p-3">
                <div class="flex items-center gap-2">
                  {#if root.author.avatarUrl}
                    <img src={root.author.avatarUrl} alt="" class="cmt-avatar" />
                  {:else}
                    <div class="cmt-avatar grid place-items-center bg-base-content/10 text-[10px] font-bold">
                      {(root.author.displayName || "?")[0]}
                    </div>
                  {/if}
                  <span class="text-xs font-semibold">{root.author.displayName}</span>
                  {#if root.author.provider === "discord"}
                    <Icon icon="ic:baseline-discord" class="size-3.5 text-indigo-400" />
                  {:else}
                    <Icon icon="mdi:github" class="size-3.5 text-base-content/50" />
                  {/if}
                  {#if root.isLegacy}
                    <span class="rounded-full bg-base-content/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-base-content/40">legacy</span>
                  {/if}
                  <span class="ml-auto font-mono text-[10px] text-base-content/40">{fmtDate(root.createdAt)}</span>
                </div>
                <p class="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-base-content/80">{root.body}</p>
                {#if root.reactions.length > 0}
                  <div class="mt-2 flex flex-wrap gap-1">
                    {#each root.reactions as r}
                      <span class="rounded-full border border-base-content/10 bg-base-100 px-1.5 py-0.5 text-[11px]">{r.emoji} {r.count}</span>
                    {/each}
                  </div>
                {/if}

                {#if replies.length > 0}
                  <div class="mt-3 space-y-3 border-l-2 border-base-content/10 pl-3">
                    {#each replies as reply (reply.id)}
                      <div>
                        <div class="flex items-center gap-2">
                          {#if reply.author.avatarUrl}
                            <img src={reply.author.avatarUrl} alt="" class="cmt-avatar sm" />
                          {:else}
                            <div class="cmt-avatar sm grid place-items-center bg-base-content/10 text-[9px] font-bold">
                              {(reply.author.displayName || "?")[0]}
                            </div>
                          {/if}
                          <span class="text-[11px] font-semibold">{reply.author.displayName}</span>
                          {#if reply.author.provider === "discord"}
                            <Icon icon="ic:baseline-discord" class="size-3 text-indigo-400" />
                          {:else}
                            <Icon icon="mdi:github" class="size-3 text-base-content/50" />
                          {/if}
                          <span class="ml-auto font-mono text-[10px] text-base-content/40">{fmtDate(reply.createdAt)}</span>
                        </div>
                        <p class="mt-1.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-base-content/70">{reply.body}</p>
                        {#if reply.reactions.length > 0}
                          <div class="mt-1.5 flex flex-wrap gap-1">
                            {#each reply.reactions as r}
                              <span class="rounded-full border border-base-content/10 bg-base-100 px-1.5 py-0.5 text-[10px]">{r.emoji} {r.count}</span>
                            {/each}
                          </div>
                        {/if}
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {:else}
          <div class="py-16 text-center text-sm text-base-content/40">No comments on this chapter.</div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .cmt-avatar {
    width: 1.5rem;
    height: 1.5rem;
    flex: none;
    border-radius: 9999px;
    object-fit: cover;
  }
  .cmt-avatar.sm {
    width: 1.125rem;
    height: 1.125rem;
  }
</style>
