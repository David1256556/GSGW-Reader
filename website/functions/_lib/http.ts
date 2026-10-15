export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function error(message: string, status = 400, extra: Record<string, unknown> = {}): Response {
  return json({ error: message, ...extra }, { status });
}

export function redirect(location: string, headers: Record<string, string> = {}): Response {
  const h = new Headers(headers);
  h.set("Location", location);
  h.set("Cache-Control", "no-store");
  return new Response(null, { status: 302, headers: h });
}

export function redirectWithCookies(location: string, cookies: string[]): Response {
  const h = new Headers();
  h.set("Location", location);
  h.set("Cache-Control", "no-store");
  for (const c of cookies) h.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers: h });
}

export function parseCookies(request: Request): Record<string, string> {
  const header = request.headers.get("Cookie") || "";
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}

export function isSecure(request: Request): boolean {
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return true;
  }
}

export function cookie(
  name: string,
  value: string,
  opts: { maxAge?: number; path?: string; secure?: boolean; httpOnly?: boolean; sameSite?: string } = {}
): string {
  const parts = [`${name}=${value}`, `Path=${opts.path ?? "/"}`];
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.httpOnly !== false) parts.push("HttpOnly");
  if (opts.secure) parts.push("Secure");
  parts.push(`SameSite=${opts.sameSite ?? "Lax"}`);
  return parts.join("; ");
}

export async function readJson<T = any>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
