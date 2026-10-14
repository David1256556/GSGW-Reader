#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MAP_PATH = resolve(__dirname, "discussion_map.json");
const OUT_PATH = resolve(__dirname, "out", "migrate_giscus.sql");
const CACHE_DIR = resolve(__dirname, "out", "discussions");
const TOKEN_FILE = resolve(__dirname, ".discussions_token");

const OWNER = "EnderOksam";
const NAME = "GSGW-Reader";
const GH_GRAPHQL = "https://api.github.com/graphql";
const D1_NAME = "ireum-comments";

let TOKEN = process.env.GITHUB_TOKEN || process.env.DISCUSSIONS_TOKEN;
if (!TOKEN && existsSync(TOKEN_FILE)) {
  TOKEN = readFileSync(TOKEN_FILE, "utf8").trim();
}

const apply = process.argv.includes("--apply");
const wait = process.argv.includes("--wait");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Number(limitArg.split("=")[1]) : Infinity;
const importArg = process.argv.find((a) => a.startsWith("--import="));
const IMPORT = importArg ? importArg.split("=")[1] : null;

const REACTION_EMOJI = {
  THUMBS_UP: "\u{1F44D}",
  THUMBS_DOWN: "\u{1F44E}",
  LAUGH: "\u{1F602}",
  HOORAY: "\u{1F389}",
  CONFUSED: "\u{1F62E}",
  HEART: "\u{2764}\u{FE0F}",
  ROCKET: "\u{1F680}",
  EYES: "\u{1F440}",
};

class RateLimitError extends Error {
  constructor(resetAt) {
    super("GitHub API rate limit exceeded");
    this.name = "RateLimitError";
    this.resetAt = resetAt;
  }
}

function sqlStr(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function threadKey(path) {
  let key;
  try {
    key = decodeURIComponent(path);
  } catch {
    key = path;
  }
  const gsgw = key.match(/^read\/gsgw\/[^/]+\/(.+)$/);
  return gsgw ? `read/gsgw/${gsgw[1]}` : key;
}

const discussionQuery = `
query($owner: String!, $name: String!, $number: Int!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    discussion(number: $number) {
      number
      comments(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          databaseId
          author { login avatarUrl ... on User { databaseId } }
          body
          createdAt
          reactionGroups { content reactors(first: 100) { nodes { ... on User { databaseId login avatarUrl } } } }
          replies(first: 100) { nodes { databaseId author { login avatarUrl ... on User { databaseId } } body createdAt } }
        }
      }
    }
  }
}`;

async function gh(query, variables) {
  const res = await fetch(GH_GRAPHQL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "GSGW-Reader migration",
    },
    body: JSON.stringify({ query, variables }),
  });
  const resetHeader = res.headers.get("x-ratelimit-reset");
  const resetAt = resetHeader ? Number(resetHeader) * 1000 : null;
  if (res.status === 403 || res.status === 429) {
    throw new RateLimitError(resetAt);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`GitHub GraphQL HTTP ${res.status}: ${detail}`);
  }
  const payload = await res.json();
  if (payload.errors) {
    if (payload.errors.some((e) => typeof e.type === "string" && e.type.includes("RATE_LIMIT"))) {
      throw new RateLimitError(resetAt);
    }
    throw new Error(`GitHub GraphQL errors: ${JSON.stringify(payload.errors)}`);
  }
  return payload.data;
}

function cachePath(number) {
  return resolve(CACHE_DIR, `${number}.json`);
}

function readCache(number) {
  const p = cachePath(number);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function writeCache(number, data) {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cachePath(number), JSON.stringify(data), "utf8");
}

async function fetchDiscussion(number) {
  let cursor = null;
  const nodes = [];
  let found = false;
  do {
    const data = await gh(discussionQuery, { owner: OWNER, name: NAME, number, cursor });
    const discussion = data.repository?.discussion;
    if (!discussion) break;
    found = true;
    nodes.push(...discussion.comments.nodes);
    cursor = discussion.comments.pageInfo.hasNextPage ? discussion.comments.pageInfo.endCursor : null;
  } while (cursor);
  return { found, nodes };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sleepUntil(resetAt) {
  const target = resetAt ?? Date.now() + 5 * 60 * 1000;
  const ms = Math.max(0, target - Date.now()) + 15000;
  console.error(`\nRate limited. Sleeping ${Math.ceil(ms / 1000)}s until ${new Date(target).toISOString()}...`);
  await sleep(ms);
}

function collect(users, comments, reactions, chapter, node, parentDatabaseId) {
  const author = node.author;
  const authorId = author && author.databaseId != null ? Number(author.databaseId) : -1;
  if (authorId >= 0) {
    users.set(authorId, {
      id: authorId,
      login: author.login,
      displayName: author.login,
      avatarUrl: author.avatarUrl,
    });
  } else {
    users.set(-1, { id: -1, login: "ghost", displayName: "deleted user", avatarUrl: null });
  }

  const legacyId = `gh:${chapter}:${node.databaseId}`;
  comments.push({
    id: Number(node.databaseId),
    chapter,
    userId: authorId,
    parentId: parentDatabaseId ?? null,
    body: node.body ?? "",
    legacyId,
    createdAt: node.createdAt,
  });

  for (const group of node.reactionGroups ?? []) {
    const emoji = REACTION_EMOJI[group.content];
    if (!emoji) continue;
    for (const reactor of group.reactors?.nodes ?? []) {
      const rid = reactor && reactor.databaseId != null ? Number(reactor.databaseId) : -1;
      if (rid >= 0) {
        users.set(rid, {
          id: rid,
          login: reactor.login,
          displayName: reactor.login,
          avatarUrl: reactor.avatarUrl,
        });
      } else {
        users.set(-1, { id: -1, login: "ghost", displayName: "deleted user", avatarUrl: null });
      }
      reactions.push({
        commentId: Number(node.databaseId),
        userId: rid,
        emoji,
        legacyId: `ghr:${chapter}:${node.databaseId}:${rid}:${emoji}`,
      });
    }
  }
}

function buildSql(users, comments, reactions) {
  const lines = [];
  lines.push("-- Auto-generated by scripts/migrate_giscus.mjs. Idempotent.");
  lines.push("");
  for (const user of users.values()) {
    lines.push(
      `INSERT OR IGNORE INTO users (id, provider, provider_user_id, login, display_name, avatar_url, is_legacy) VALUES (${user.id}, 'github', ${sqlStr(
        String(user.id)
      )}, ${sqlStr(user.login)}, ${sqlStr(user.displayName)}, ${sqlStr(user.avatarUrl)}, 1);`
    );
  }
  lines.push("");
  const tops = comments.filter((c) => c.parentId === null).sort((a, b) => a.id - b.id);
  const replies = comments.filter((c) => c.parentId !== null).sort((a, b) => a.id - b.id);
  for (const c of [...tops, ...replies]) {
    lines.push(
      `INSERT OR IGNORE INTO comments (id, chapter, user_id, parent_id, body, legacy_id, is_legacy, created_at) VALUES (${c.id}, ${sqlStr(
        c.chapter
      )}, ${c.userId}, ${c.parentId === null ? "NULL" : c.parentId}, ${sqlStr(c.body)}, ${sqlStr(c.legacyId)}, 1, ${sqlStr(
        toSqlDate(c.createdAt)
      )});`
    );
  }
  lines.push("");
  const seen = new Set();
  for (const r of reactions) {
    if (seen.has(r.legacyId)) continue;
    seen.add(r.legacyId);
    lines.push(
      `INSERT OR IGNORE INTO reactions (comment_id, user_id, emoji, legacy_id) VALUES (${r.commentId}, ${r.userId}, ${sqlStr(
        r.emoji
      )}, ${sqlStr(r.legacyId)});`
    );
  }
  lines.push("");
  return lines.join("\n");
}

function toSqlDate(iso) {
  if (!iso) return null;
  return iso.replace("T", " ").replace("Z", "").slice(0, 19);
}

function importSql(target) {
  const flag = target === "remote" ? "--remote" : "--local";
  const wranglerCwd = resolve(__dirname, "..", "website");
  console.log(`\nImporting into ${target} D1 (${D1_NAME})...`);
  const res = spawnSync(
    "npx",
    ["--yes", "wrangler@latest", "d1", "execute", D1_NAME, flag, "--file=../scripts/out/migrate_giscus.sql"],
    { cwd: wranglerCwd, stdio: "inherit", shell: true }
  );
  if (res.status === 0) {
    console.log(`Import into ${target} complete.`);
  } else {
    console.error(`Import into ${target} failed (exit ${res.status}).`);
  }
  return res.status === 0;
}

async function main() {
  if (!TOKEN) {
    console.error("Error: set GITHUB_TOKEN (fine-grained PAT with Discussions: Read).");
    process.exit(1);
  }
  mkdirSync(resolve(__dirname, "out"), { recursive: true });
  writeFileSync(resolve(__dirname, "out", "migrate.pid"), String(process.pid));
  const map = JSON.parse(readFileSync(MAP_PATH, "utf8"));
  const entries = Object.entries(map).slice(0, Number.isFinite(LIMIT) ? LIMIT : undefined);
  const users = new Map();
  const comments = [];
  const reactions = [];
  let found = 0;
  let missing = 0;
  let errors = 0;
  let fetched = 0;
  let fromCache = 0;
  let rateLimited = false;

  for (let i = 0; i < entries.length; i++) {
    const [path, number] = entries[i];
    const chapter = threadKey(path);

    let data = readCache(number);
    let fetchFailed = false;
    if (data) {
      fromCache += 1;
    } else {
      let retry = true;
      while (retry) {
        retry = false;
        try {
          data = await fetchDiscussion(number);
          writeCache(number, data);
          fetched += 1;
          await sleep(120);
        } catch (err) {
          if (err instanceof RateLimitError) {
            if (wait) {
              await sleepUntil(err.resetAt);
              retry = true;
            } else {
              rateLimited = true;
              break;
            }
          } else {
            console.error(`  ${chapter} <- discussion #${number}: ${err.message}`);
            fetchFailed = true;
            break;
          }
        }
      }
      if (rateLimited) break;
    }

    if (fetchFailed) {
      errors += 1;
      continue;
    }

    if (data.found && data.nodes.length) {
      found += 1;
      for (const node of data.nodes) {
        collect(users, comments, reactions, chapter, node, null);
        for (const reply of node.replies?.nodes ?? []) {
          collect(users, comments, reactions, chapter, reply, Number(node.databaseId));
        }
      }
    } else {
      missing += 1;
    }

    if ((i + 1) % 25 === 0) {
      console.error(`  ...${i + 1}/${entries.length} (cached ${fromCache}, fetched ${fetched})`);
    }
  }

  console.log(
    `\nDiscussions: ${found} found, ${missing} missing, ${errors} errors. Users: ${users.size}, comments: ${comments.length}, reactions: ${reactions.length}.`
  );
  console.log(`Cached: ${fromCache}, fetched this run: ${fetched}.`);

  if (rateLimited) {
    console.log("Hit the GitHub rate limit; no work done this run. Re-run after the reset (cached discussions are skipped).");
  }

  if (!apply) {
    console.log("Dry run complete. Re-run with --apply to write SQL.");
    return;
  }

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, buildSql(users, comments, reactions), "utf8");
  console.log(`Wrote ${OUT_PATH}`);

  if (rateLimited) {
    console.log("Rate limited before finishing. Re-run to resume (cached discussions are skipped).");
  }

  if (IMPORT === "local" || IMPORT === "remote") {
    importSql(IMPORT);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
