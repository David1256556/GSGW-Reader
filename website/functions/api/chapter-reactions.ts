import { currentUser } from "../_lib/auth";
import type { Env } from "../_lib/db";
import { all, first, run } from "../_lib/db";
import { error, json, readJson } from "../_lib/http";
import {
  aggregateReactions,
  ALLOWED_REACTION_SET,
  type ReactionAgg,
  type ReactionJoinRow,
} from "../_lib/reactions";

const MAX_CHAPTER = 200;

async function loadReactions(
  env: Env,
  chapter: string,
  currentUserId: number | null
): Promise<ReactionAgg[]> {
  const rows = await all<ReactionJoinRow>(
    env,
    `SELECT cr.emoji, cr.user_id, u.display_name, u.login
     FROM chapter_reactions cr
     JOIN users u ON u.id = cr.user_id
     WHERE cr.chapter = ?`,
    [chapter]
  );
  return aggregateReactions(rows, currentUserId);
}

export const onRequestGet = async (context: any): Promise<Response> => {
  const env = context.env as Env;
  const url = new URL(context.request.url);
  const chapter = (url.searchParams.get("chapter") || "").trim();
  if (!chapter || chapter.length > MAX_CHAPTER) return error("Invalid chapter");
  const user = await currentUser(context);
  return json({ reactions: await loadReactions(env, chapter, user?.id ?? null) });
};

export const onRequestPost = async (context: any): Promise<Response> => {
  const env = context.env as Env;
  const user = await currentUser(context);
  if (!user) return error("Sign in required", 401);

  const payload = await readJson<{ chapter?: string; emoji?: string }>(context.request);
  if (!payload) return error("Invalid JSON");

  const chapter = (payload.chapter || "").trim();
  const emoji = (payload.emoji || "").trim();
  if (!chapter || chapter.length > MAX_CHAPTER) return error("Invalid chapter");
  if (!ALLOWED_REACTION_SET.has(emoji)) return error("Unsupported reaction");

  const existing = await first<{ id: number }>(
    env,
    "SELECT id FROM chapter_reactions WHERE chapter = ? AND user_id = ? AND emoji = ?",
    [chapter, user.id, emoji]
  );

  if (existing) {
    await run(env, "DELETE FROM chapter_reactions WHERE id = ?", [existing.id]);
  } else {
    await run(
      env,
      "INSERT INTO chapter_reactions (chapter, user_id, emoji) VALUES (?, ?, ?) ON CONFLICT (chapter, user_id, emoji) DO NOTHING",
      [chapter, user.id, emoji]
    );
  }

  return json({ reactions: await loadReactions(env, chapter, user.id) });
};
