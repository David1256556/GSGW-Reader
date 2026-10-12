<script lang="ts">
  import WindowSample from "./WindowSample.svelte";

  let { kind, pad = 0 }: { kind: string; pad?: number } = $props();

  function grid(cols: number) {
    return `display:grid; grid-template-columns:repeat(${cols}, minmax(0,1fr)); gap:0.45rem; width:100%;`;
  }
  const layered = "display:flex; flex-wrap:wrap; justify-content:center; gap:0.45rem; width:100%;";
  const LAYER = "flex:0 0 calc(33.333% - 0.3rem); min-width:0;";
  const CELL = "display:flex; align-items:center; justify-content:center; min-height:3.25rem; padding:0.5rem 0.4rem; border-radius:9px; background:color-mix(in oklch, var(--color-base-content) 7%, transparent); font-size:1.05rem; line-height:1.2; text-align:center; overflow-wrap:anywhere;";

  function cell(inner: string, extra = "") {
    return `<div style="${CELL}${extra}">${inner}</div>`;
  }

  let samples = $derived.by(() => {
    switch (kind) {
      case "colors":
        return [{
          label: "Custom colors",
          html: `<div style="${layered}">
            ${cell('<span class="smoke-text">Smoke</span>', LAYER)}
            ${cell('<span class="aurora-text">Aurora</span>', LAYER)}
            ${cell('<span class="gold-text">Gold</span>', LAYER)}
            ${cell('<span class="silver-text">Silver</span>', LAYER)}
            ${cell('<span class="moon-text">Moon</span>', LAYER)}
            ${cell('<span style="--ha-c1: oklch(0.55 0.18 210); --ha-c2: oklch(0.65 0.18 85); --ha-c3: oklch(0.55 0.25 320);" class="hex-aurora">Hex Aurora</span>', LAYER)}
            ${cell('<span style="--hxo-color: oklch(0.6 0.2 270);" class="hex-outline">Hex Outline</span>', LAYER)}
          </div>`,
        }];
      case "bright-gray":
        return [{
          label: "Bright gray text",
          html: `
            <p>
              Regular text<br />
              <span class="text-faded">brighter dimmed text by default, you can still hover over this if you wish to make it less opaque</span>
            </p>
          `,
        }];
      case "braun":
        return [{
          label: "Braun text",
          html: `<div style="${grid(2)}">
            ${cell('<span class="braun-tv-text" style="padding:0;">braun tv head speaking example</span>')}
            ${cell('<span class="braun-doll-text" style="padding:0;">braun doll speaking example</span>')}
          </div>`,
        }];
      case "animated":
        return [{
          label: "Animated text",
          html: `<div style="${layered}">
            ${cell('<span class="shake">Shake</span>', LAYER)}
            ${cell('<span class="wave-up">Wave</span>', LAYER)}
            ${cell('<span class="glitch-text">Glitch</span>', LAYER)}
            ${cell('<span class="glitch-subtle">Subtle Glitch</span>', LAYER)}
            ${cell('<span class="glitch-d" data-text="Glitch Deep">Glitch Deep</span>', LAYER)}
          </div>`,
        }];
      case "bold":
        return [{
          label: "Bold text enlargement",
          html: `
            <p>
              <strong>bold text is a bit bigger than regular text by default, you can toggle that here</strong>
            </p>
          `,
        }];
      case "margins":
        return [{
          label: "Text side margins",
          html: `
            <div style="position:relative; margin-inline: var(--text-gutter, 0px);">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
                style="position:absolute; left:0; top:50%; transform:translateY(-50%); opacity:0.4;"><path d="M9 6l6 6-6 6"/></svg>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
                style="position:absolute; right:0; top:50%; transform:translateY(-50%); opacity:0.4;"><path d="M15 6l-6 6 6 6"/></svg>
              <p style="margin:0; padding-inline:1.1rem; text-align:center;">drag the slider to preview text margins in this block, margins are the left and right limits</p>
            </div>
          `,
        }];
      case "divider":
        return [{
          label: "Divider type",
          html: `<hr class="visible-hr" style="margin: 0.5rem auto;">`,
        }];
      default:
        return [];
    }
  });
</script>

{#each samples as sample}
  <WindowSample label={sample.label} cls={sample.cls} html={sample.html} pad={pad} />
{/each}
