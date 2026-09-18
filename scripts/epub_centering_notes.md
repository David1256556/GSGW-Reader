# EPUB scare-page vertical centering — reader compatibility notes

Status: resolved for shipped behavior; Episteme native limitation accepted.

## Problem

Short scare pages should appear vertically centered on a full-viewport page.
The feature is driven by CSS classes emitted by the EPUB builder:

- `scripts/build_new_epub.py:616` `scare_page_body()` wraps each scare page in a
  full-viewport structure.
- Short scares (fewer than 80 visible chars, `is_short_scare()` at
  `scripts/build_new_epub.py:640`) get `class="epub-pagebreak epub-pagebreak-center"`
  (`scripts/build_new_epub.py:631`).
- The class lives on a `<div>` (not `<body>`), so it survives reader-side
  HTML sanitizing/rewrapping.
- Every scare page ships as its own XHTML file whose sole body child is that
  div; each file links `../Styles/stylesheet.css`
  (`scripts/build_new_epub.py:2048` `xhtml_page()`).

## Current implementation

`scripts/epub.css`:

- `:334` `html, body.scrolling-container { height: 100%; }` — percentage chain.
- `:349` `.epub-pagebreak` — forced page breaks, flex column, `min-height:100vh`,
  `overflow:hidden`, `scroll-snap-align:start`.
- `:368` `.epub-pagebreak-center` — `display:table; width:100%; height:100%;
  min-height:100vh; overflow:hidden; scroll-snap-align:start` plus page-break
  rules.
- `:419` `.epub-pagebreak-center .epub-pagebreak-content { display:table-cell;
  vertical-align:middle; }`.

Design choice: table-cell, **not** flexbox. Table-cell only needs a definite
height and, when content overflows that height, it overflows **downward**
(top stays readable) instead of centering overflow above the box. That matters
in readers that size the chapter container to content height.

Note: `scripts/epub (1).css` is an untracked, stale duplicate (contains the old
broken `max-height:100%`) and is **not** used by the build. Do not treat it as
the source of truth.

## Reader behavior matrix

| Reader / mode | Rendering engine | Behavior |
| --- | --- | --- |
| Paginated readers with a real page height (Apple Books, ADE-like, Neat Reader paginated) | Real viewport/page box | Full vertical centering |
| Neat Reader web / epub.js `scrolled-doc` | Content-sized iframes | `vh`/`%` collapse; degrades to clean top-align, no clipping |
| Episteme vertical scroll | Android WebView (Chromium) | Full centering |
| Episteme paginated (default) | Native Compose paginator | Own page, horizontally centered, top-aligned |
| Episteme native-vertical (opt-in) | Native Compose paginator | Own page, horizontally centered, top-aligned |

## Neat Reader / epub.js findings

`https://epub-reader.online/` (Neat Reader web) initializes epub.js:

```
renderTo("viewer", { flow: "scrolled-doc", width: "100%", height: "100%" })
```

In `scrolled-doc`, epub.js creates each spine iframe at `width:0;height:0` and
then `expand()` reframes it to `textHeight()` (the content height). The chapter
iframe therefore ends up content-sized, not viewport-sized, so `100vh`/`height:100%`
collapse and exact centering is impossible with pure CSS.

Reproduced with real epub.js in headless Chrome (viewer 800x604 but scare
iframe resolved to ~120px). Findings:

- Flex centering overflowed **above** the box (content `top:-28px`, clipped at
  the top) — this was the earlier regression.
- Table-cell: content `top:0`, no clipping; top-aligns gracefully.
- Paginated render: text band center 379px == viewport center 379px (centered).

A requestAnimationFrame shim was required to make epub.js's render queue tick in
headless Chrome; artifacts were temporary (a local harness + mini EPUB + epub.js
/ jszip bundles), and can be recreated if needed.

## Episteme findings

Source inspected: `https://github.com/Aryan-Raj3112/episteme` (native Android,
Kotlin/Jetpack Compose). It has three EPUB paths:

1. **Paginated — default**: `PaginatedReaderScreen` -> native Compose paginator
   (package `paginatedreader`; app-local rendering in
   `app/src/main/java/com/aryan/reader/paginatedreader/PaginatedReaderContent.kt`).
2. **Vertical scroll — WebView** (default; `loadNativeVerticalRenderer` defaults
   `false`, `app/src/main/java/com/aryan/reader/epubreader/EpubReaderSettings.kt:349`):
   Chromium WebView, chapter `<head>`/stylesheet preserved -> full CSS support.
3. **Vertical scroll — native** (opt-in): same engine as path 1.

Why native modes cannot center (structurally):

- Every page block is wrapped in a `Box` with `androidEpubNaturalHeight()`
  (`PaginatedReaderContent.kt:901`), which measures with `maxHeight = Infinity`
  and sizes the block to its natural content height
  (`NativeVerticalReaderScreen.kt:2459-2468`). CSS `height`/`min-height` is
  discarded at render time.
- The page content `Column` is top-aligned (`PaginatedReaderContent.kt:653-665`,
  `contentAlignment = Alignment.TopStart`, `wrapContentHeight`).
- Flex centering exists (`FlexContainerBlock` ->
  `Column(verticalArrangement = justifyContent, ...)`,
  `PaginatedReaderContent.kt:1446-1465`) but is a no-op because the container
  never gets a definite height.
- `vh` is unsupported: `CssParser.parseCssDimension` returns `Dp.Unspecified`
  for `vh` (`shared/src/commonMain/kotlin/com/aryan/reader/paginatedreader/CssParser.kt:1647`),
  and `padding-*` funnels through it, coercing to `0.dp`
  (`parseCssSizeToDp`, `CssParser.kt:1735`). `calc()` supports only
  `px|dp|em|rem|pt|%` (`CssParser.kt:1653`).
- `%` height resolves against container **width** (`CssParser.kt:1631-1638`).
- Real `<table>` cells also render at natural height.
- No `epub:type`/cover/titlepage special-casing centers a page.

What native modes still do correctly:

- `break-before:page` is honored (`SharedPaginator.kt:81`,
  `forcesReaderPageBreakBefore()` in
  `shared/src/commonMain/kotlin/com/aryan/reader/paginatedreader/PaginationEnginePolicies.kt:18`),
  so each scare page is isolated on its own page.
- `text-align:center` is supported, so horizontal centering works.

Conclusion: no markup or CSS the native engine supports can vertically center a
block. The only approximative knob is `em`-based `padding-top` (device-safe,
scales with the reader font size), but it would also shift WebView readers off
exact center, so it was not adopted.

## Decision

Accept top-align in Episteme's native modes. Keep the current CSS: it centers in
WebView-capable readers (including Episteme vertical-scroll and Neat Reader
paginated) and degrades gracefully (isolated page, top-aligned, no clipping) in
content-sized / native renderers.

## Build and test

```
python3 scripts/build_new_epub.py --testpage --no-fetch-twitter
```

Output: `scripts/epub/Formatting.Test.Page.epub`.
Test fixtures: `scripts/epub_testpage.md`.
Builder `CSS_PATH = SCRIPT_DIR / "epub.css"` (`scripts/build_new_epub.py:35`).
