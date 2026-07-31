// Canvas 2D cannot read CSS custom properties, so the framerate chart needs its
// palette as plain strings. These five colours and the font are hand-mirrored
// from src/styles/tokens/colors.css and typography.css — change one, change the
// other. The pair is maintained together on purpose:
//
//   fill      #0A1330                --color-surface-sunken
//   gridline  #1B2E5C                --color-border-subtle
//   axisLabel #3A4E7E                --color-slate-500
//   line/dot  #FFC81E                --color-accent
//   gradient  rgba(255,200,30,.30)   --color-accent-fade-top
//             rgba(255,200,30,0)     --color-accent-fade-bottom
//
// Decision: a hand-mirrored constant rather than reading
// getComputedStyle(document.documentElement) — it avoids a layout read on every
// frame, and it works before the stylesheet has resolved.

export const chartTokens = Object.freeze({
  fill: "#0A1330",
  gridline: "#1B2E5C",
  axisLabel: "#3A4E7E",
  line: "#FFC81E",
  dot: "#FFC81E",
  gradientTop: "rgba(255,200,30,.30)",
  gradientBottom: "rgba(255,200,30,0)",
  font: "500 8px 'JetBrains Mono', monospace",
});

export default chartTokens;
