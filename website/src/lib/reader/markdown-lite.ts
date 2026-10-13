export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeUrl(url: string): string | null {
  const trimmed = url.trim();
  if (/^(https?:|mailto:)/i.test(trimmed)) return trimmed;
  return null;
}

export function renderMarkdown(input: string): string {
  let text = escapeHtml(input);

  const codeSlots: string[] = [];
  text = text.replace(/`([^`\n]+)`/g, (_match, code: string) => {
    codeSlots.push(`<code>${code}</code>`);
    return `\u0000${codeSlots.length - 1}\u0000`;
  });

  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label: string, url: string) => {
    const safe = safeUrl(url.replace(/&amp;/g, "&"));
    if (!safe) return match;
    const href = escapeHtml(safe);
    return `<a href="${href}" target="_blank" rel="noopener noreferrer nofollow">${label}</a>`;
  });

  text = text.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (_match, prefix: string, url: string) => {
    const safe = safeUrl(url);
    if (!safe) return _match;
    const href = escapeHtml(safe);
    return `${prefix}<a href="${href}" target="_blank" rel="noopener noreferrer nofollow">${href}</a>`;
  });

  text = text
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_\n]+)__/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/(^|[^_])_([^_\n]+)_/g, "$1<em>$2</em>")
    .replace(/~~([^~\n]+)~~/g, "<del>$1</del>");

  text = text.replace(/\u0000(\d+)\u0000/g, (_match, index: string) => codeSlots[Number(index)] ?? "");

  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
    .join("");
}
