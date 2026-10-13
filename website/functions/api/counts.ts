import type { Env } from "../_lib/db";
import { all } from "../_lib/db";
import { error, json } from "../_lib/http";

export const onRequestGet = async (context: any): Promise<Response> => {
  const env = context.env as Env;
  const url = new URL(context.request.url);
  const raw = (url.searchParams.get("chapters") || "").trim();
  if (!raw) return json({ counts: {} });

  const chapters = raw
    .split(",")
    .map((c) => c.trim())
    .filter((c) => c && c.length <= 200)
    .slice(0, 100);
  if (chapters.length === 0) return error("Invalid chapters");

  const placeholders = chapters.map(() => "?").join(",");
  const rows = await all<{ chapter: string; count: number }>(
    env,
    `SELECT chapter, COUNT(*) AS count FROM comments
     WHERE deleted = 0 AND chapter IN (${placeholders})
     GROUP BY chapter`,
    chapters
  );

  const counts: Record<string, number> = {};
  for (const chapter of chapters) counts[chapter] = 0;
  for (const row of rows) counts[row.chapter] = row.count;
  return json({ counts });
};
