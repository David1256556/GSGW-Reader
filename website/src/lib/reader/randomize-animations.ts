// Per-character animation effects rely on randomized (negative) animation-delays
// so neighbouring characters run at different phases. Without this every char
// starts at the same phase and the effect looks like a single mechanical jitter.
export function randomizeAnimationDelays(root: ParentNode = document): void {
  root.querySelectorAll("article.reader-container").forEach((article) => {
    article.querySelectorAll("span.shake").forEach((el) => {
      if (!(el as HTMLElement).style.animationDelay) {
        (el as HTMLElement).style.animationDelay = `-${Math.random() * 0.5}s`;
      }
    });

    article.querySelectorAll("span.wave-up").forEach((el) => {
      if (!(el as HTMLElement).style.animationDelay) {
        (el as HTMLElement).style.animationDelay = `-${Math.random() * 0.6}s`;
      }
    });

    article.querySelectorAll(".glitch-text .char").forEach((el) => {
      if (!(el as HTMLElement).style.animationDelay) {
        (el as HTMLElement).style.animationDelay = `-${Math.random() * 0.25}s`;
      }
    });

    article.querySelectorAll(".glitch-subtle .char").forEach((el) => {
      if (!(el as HTMLElement).style.animationDelay) {
        (el as HTMLElement).style.animationDelay = `-${Math.random() * 2.0}s`;
      }
    });

    article.querySelectorAll(".glitch-d").forEach((el) => {
      if (!(el as HTMLElement).style.animationDelay) {
        (el as HTMLElement).style.animationDelay = `-${Math.random() * 1.6}s`;
      }
    });
  });
}