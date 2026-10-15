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

function renderInline(escaped: string): string {
  const slots: string[] = [];
  const stash = (html: string) => {
    slots.push(html);
    return `\u0000${slots.length - 1}\u0000`;
  };

  let text = escaped;

  text = text.replace(/`([^`\n]+)`/g, (_match, code: string) => stash(`<code>${code}</code>`));

  text = text.replace(/!\[([^\]]*)\]\(\s*([^)\s]+)\s*\)/g, (match, alt: string, url: string) => {
    const safe = safeUrl(url.replace(/&amp;/g, "&"));
    if (!safe) return match;
    return stash(`<img src="${escapeHtml(safe)}" alt="${alt}" loading="lazy" />`);
  });

  text = text.replace(/\[([^\]]+)\]\(\s*([^)\s]+)\s*\)/g, (match, label: string, url: string) => {
    const safe = safeUrl(url.replace(/&amp;/g, "&"));
    if (!safe) return match;
    return stash(
      `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer nofollow">${label}</a>`,
    );
  });

  text = text.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (_match, prefix: string, url: string) => {
    const safe = safeUrl(url);
    if (!safe) return _match;
    const href = escapeHtml(safe);
    return `${prefix}${stash(`<a href="${href}" target="_blank" rel="noopener noreferrer nofollow">${href}</a>`)}`;
  });

  text = text.replace(
    /(^|[\s(])@([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))/g,
    (_match, prefix: string, user: string) =>
      `${prefix}${stash(`<a href="https://github.com/${user}" target="_blank" rel="noopener noreferrer nofollow">@${user}</a>`)}`,
  );

  text = text
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_\n]+)__/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/(^|[^_])_([^_\n]+)_/g, "$1<em>$2</em>")
    .replace(/~~([^~\n]+)~~/g, "<del>$1</del>");

  text = text.replace(/\u0000(\d+)\u0000/g, (_match, index: string) => slots[Number(index)] ?? "");

  return text;
}

const isBlank = (line: string) => /^\s*$/.test(line);
const isFence = (line: string) => /^\s*```/.test(line);
const isHr = (line: string) => /^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line);
const isHeading = (line: string) => /^\s{0,3}#{1,6}\s+\S/.test(line);
const isBlockquote = (line: string) => /^\s{0,3}>/.test(line);
const isListItem = (line: string) => /^\s*(?:[-*+]|\d+\.)\s+/.test(line);
const isBlockStart = (line: string) =>
  isFence(line) || isHr(line) || isHeading(line) || isBlockquote(line) || isListItem(line);

function renderBlocks(input: string): string {
  const lines = input.split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (isBlank(line)) {
      i++;
      continue;
    }

    if (isFence(line)) {
      const lang = (line.match(/^\s*```\s*([^\s`]*)/) || [])[1] || "";
      i++;
      const buf: string[] = [];
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      const cls = lang ? ` class="language-${escapeHtml(lang)}"` : "";
      out.push(`<pre><code${cls}>${escapeHtml(buf.join("\n"))}</code></pre>`);
      continue;
    }

    if (isHr(line)) {
      out.push("<hr>");
      i++;
      continue;
    }

    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${renderInline(escapeHtml(heading[2].trim()))}</h${level}>`);
      i++;
      continue;
    }

    if (isBlockquote(line)) {
      const buf: string[] = [];
      while (i < lines.length) {
        if (isBlockquote(lines[i])) {
          buf.push(lines[i].replace(/^\s{0,3}>\s?/, ""));
          i++;
        } else if (!isBlank(lines[i]) && !isBlockStart(lines[i])) {
          buf.push(lines[i]);
          i++;
        } else {
          break;
        }
      }
      out.push(`<blockquote>${renderBlocks(buf.join("\n"))}</blockquote>`);
      continue;
    }

    if (isListItem(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && isListItem(lines[i])) {
        let item = lines[i].replace(/^\s*(?:[-*+]|\d+\.)\s+/, "");
        i++;
        while (i < lines.length && !isBlank(lines[i]) && !isListItem(lines[i]) && !isBlockStart(lines[i])) {
          item += "\n" + lines[i].replace(/^\s+/, "");
          i++;
        }
        items.push(item);
      }
      const rendered = items.map((item) => {
        const task = item.match(/^\[([ xX])\]\s*([\s\S]*)$/);
        if (task) {
          const checked = task[1].toLowerCase() === "x";
          return `<li class="cmt-task"><input type="checkbox" disabled${checked ? " checked" : ""} /> ${renderInline(escapeHtml(task[2]))}</li>`;
        }
        return `<li>${renderInline(escapeHtml(item)).replace(/\n/g, "<br>")}</li>`;
      });
      out.push(ordered ? `<ol>${rendered.join("")}</ol>` : `<ul>${rendered.join("")}</ul>`);
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && !isBlank(lines[i]) && !isBlockStart(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    out.push(`<p>${renderInline(escapeHtml(para.join("\n"))).replace(/\n/g, "<br>")}</p>`);
  }

  return out.join("");
}

export function renderMarkdown(input: string): string {
  return renderBlocks(String(input ?? "").replace(/\r\n?/g, "\n"));
}
