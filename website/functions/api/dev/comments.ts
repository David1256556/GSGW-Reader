import type { Env } from "../../_lib/db";
import { all, first } from "../../_lib/db";
import { json } from "../../_lib/http";

interface TotalsRow {
  comments: number;
  discord: number;
  github: number;
  chapters: number;
  users: number;
}

interface ChapterRow {
  chapter: string;
  total: number;
  discord: number;
  github: number;
  lastAt: string | null;
}

interface CountRow {
  chapter: string;
  count: number;
}

interface RecentRow {
  id: number;
  chapter: string;
  parent_id: number | null;
  body: string;
  is_legacy: number;
  created_at: string;
  login: string;
  display_name: string | null;
  avatar_url: string | null;
  provider: string;
  user_is_legacy: number;
}

export const onRequestGet = async (context: any): Promise<Response> => {
  const env = context.env as Env;
  const url = new URL(context.request.url);
  const rawLimit = Number(url.searchParams.get("limit") || "100");
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 100, 1), 300);

  const totalsRow = await first<{ comments: number; discord: number; github: number; chapters: number; users: number }>(
    env,
    `SELECT
       COUNT(*) AS comments,
       COALESCE(SUM(CASE WHEN u.provider = 'discord' THEN 1 ELSE 0 END), 0) AS discord,
       COALESCE(SUM(CASE WHEN u.provider = 'github' THEN 1 ELSE 0 END), 0) AS github,
       COUNT(DISTINCT c.chapter) AS chapters,
       COUNT(DISTINCT c.user_id) AS users
     FROM comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.deleted = 0`
  );

  const reactionTotal = await first<{ count: number }>(
    env,
    `SELECT COUNT(*) AS count FROM reactions r JOIN comments c ON c.id = r.comment_id WHERE c.deleted = 0`
  );
  const chapterReactionTotal = await first<{ count: number }>(
    env,
    `SELECT COUNT(*) AS count FROM chapter_reactions`
  );

  const chapterRows = await all<ChapterRow>(
    env,
    `SELECT
       c.chapter AS chapter,
       COUNT(*) AS total,
       COALESCE(SUM(CASE WHEN u.provider = 'discord' THEN 1 ELSE 0 END), 0) AS discord,
       COALESCE(SUM(CASE WHEN u.provider = 'github' THEN 1 ELSE 0 END), 0) AS github,
       MAX(c.created_at) AS lastAt
     FROM comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.deleted = 0
     GROUP BY c.chapter
     ORDER BY total DESC, c.chapter ASC`
  );

  const commentReactionRows = await all<CountRow>(
    env,
    `SELECT c.chapter AS chapter, COUNT(*) AS count
     FROM reactions r
     JOIN comments c ON c.id = r.comment_id
     WHERE c.deleted = 0
     GROUP BY c.chapter`
  );
  const chapterReactionRows = await all<CountRow>(
    env,
    `SELECT chapter, COUNT(*) AS count FROM chapter_reactions GROUP BY chapter`
  );

  const reactionsByChapter = new Map<string, number>();
  for (const row of commentReactionRows) reactionsByChapter.set(row.chapter, row.count);
  const chapterReactionsByChapter = new Map<string, number>();
  for (const row of chapterReactionRows) chapterReactionsByChapter.set(row.chapter, row.count);

  const chapters = chapterRows.map((row) => ({
    chapter: row.chapter,
    total: row.total,
    discord: row.discord,
    github: row.github,
    reactions: reactionsByChapter.get(row.chapter) ?? 0,
    chapterReactions: chapterReactionsByChapter.get(row.chapter) ?? 0,
    lastAt: row.lastAt,
  }));

  const recentRows = await all<RecentRow>(
    env,
    `SELECT c.id, c.chapter, c.parent_id, c.body, c.is_legacy, c.created_at,
            u.login, u.display_name, u.avatar_url, u.provider, u.is_legacy AS user_is_legacy
     FROM comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.deleted = 0
     ORDER BY c.created_at DESC, c.id DESC
     LIMIT ?`,
    [limit]
  );

  const reactionCounts = new Map<number, number>();
  if (recentRows.length > 0) {
    const placeholders = recentRows.map(() => "?").join(",");
    const rows = await all<{ comment_id: number; count: number }>(
      env,
      `SELECT comment_id, COUNT(*) AS count FROM reactions
       WHERE comment_id IN (${placeholders})
       GROUP BY comment_id`,
      recentRows.map((r) => r.id)
    );
    for (const row of rows) reactionCounts.set(row.comment_id, row.count);
  }

  const recent = recentRows.map((row) => ({
    id: row.id,
    chapter: row.chapter,
    parentId: row.parent_id,
    body: row.body,
    isLegacy: row.is_legacy === 1,
    createdAt: row.created_at,
    author: {
      login: row.login,
      displayName: row.display_name || row.login,
      avatarUrl: row.avatar_url,
      provider: row.provider,
      isLegacy: row.user_is_legacy === 1,
    },
    reactionCount: reactionCounts.get(row.id) ?? 0,
  }));

  return json({
    totals: {
      comments: totalsRow?.comments ?? 0,
      discord: totalsRow?.discord ?? 0,
      github: totalsRow?.github ?? 0,
      chapters: totalsRow?.chapters ?? 0,
      users: totalsRow?.users ?? 0,
      reactions: reactionTotal?.count ?? 0,
      chapterReactions: chapterReactionTotal?.count ?? 0,
    },
    chapters,
    recent,
  });
};
