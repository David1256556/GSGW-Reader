let pristineHTML: string | null = null;

export function storePristine(article: HTMLElement) {
  pristineHTML = article.innerHTML;
}

export function resetPristine() {
  pristineHTML = null;
}

export interface AltTextVariant {
  name: string;
  description: string;
  searches: string[];
  options: string[];
}

interface FindReplace {
  regex: RegExp;
  replacer: (match: string) => string;
}

function buildFindReplace(pairs: [string, string][]): FindReplace | null {
  const escaped = pairs.map(([s]) => {
    const e = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const left = /^\w/.test(s) ? "\\b" : "";
    const right = /\w$/.test(s) ? "\\b" : "";
    return `${left}${e}${right}`;
  });
  const combined = escaped.join("|");
  if (!combined) return null;

  const regex = new RegExp(combined, "gi");

  const replaceMap = new Map<string, string>();
  for (const [search, replace] of pairs) {
    replaceMap.set(search.toLowerCase(), replace);
  }

  const replacer = (match: string) => {
    const key = match.toLowerCase();
    const repl = replaceMap.get(key);
    if (!repl) return match;

    if (match === match.toUpperCase() && match.length > 1) {
      return repl.toUpperCase();
    }
    if (match[0] === match[0].toUpperCase()) {
      return repl.charAt(0).toUpperCase() + repl.slice(1).toLowerCase();
    }
    return repl.toLowerCase();
  };

  return { regex, replacer };
}

// Replace text inside per-character animation wrappers (.glitch-text / .glitch-subtle
// split every letter into <span class="char">, so plain text-node matching never sees
// whole words). The new text is written back into .char spans (reusing existing spans
// so their inline animation-delay keeps living), preserving the animation.
function applyToCharContainer(
  container: HTMLElement,
  { regex, replacer }: FindReplace
) {
  const original = container.textContent || "";
  const replaced = original.replace(regex, replacer);
  if (replaced === original) return;

  const oldChars = Array.from(container.querySelectorAll<HTMLSpanElement>("span.char"));

  const frag = document.createDocumentFragment();
  let used = 0;
  for (const c of replaced) {
    if (c === " ") {
      frag.appendChild(document.createTextNode(" "));
      continue;
    }
    let span: HTMLSpanElement;
    if (used < oldChars.length) {
      span = oldChars[used];
      span.textContent = c;
    } else {
      span = document.createElement("span");
      span.className = "char";
      span.textContent = c;
    }
    used++;
    frag.appendChild(span);
  }
  for (let i = oldChars.length - 1; i >= used; i--) {
    oldChars[i].remove();
  }
  container.replaceChildren(frag);
}

// The digital glitch renders duplicate offset layers via content: attr(data-text),
// so whenever its visible text changes the attribute must be kept in sync.
function syncGlitchDataText(article: HTMLElement) {
  article.querySelectorAll<HTMLElement>(".glitch-d").forEach((el) => {
    el.setAttribute("data-text", el.textContent || "");
  });
}

export function applyAltText(article: HTMLElement, pairs: [string, string][]) {
  if (!pristineHTML) {
    storePristine(article);
  }

  if (pristineHTML) {
    article.innerHTML = pristineHTML;
  }

  const findReplace = buildFindReplace(pairs);
  if (!findReplace) return;
  const { regex, replacer } = findReplace;

  const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT, null);
  const textNodes: Text[] = [];
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    textNodes.push(node);
  }

  for (const textNode of textNodes) {
    const original = textNode.nodeValue || "";

    regex.lastIndex = 0;
    if (!regex.test(original)) continue;

    textNode.nodeValue = original.replace(regex, replacer);
  }

  article.querySelectorAll<HTMLElement>(".glitch-text, .glitch-subtle").forEach((container) => {
    applyToCharContainer(container, findReplace);
  });

  syncGlitchDataText(article);
}

export function clearAltText(article: HTMLElement) {
  if (pristineHTML) {
    article.innerHTML = pristineHTML;
  }
}
