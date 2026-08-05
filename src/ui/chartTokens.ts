// Canvas 2D cannot read CSS custom properties, so anything painted into a canvas
// needs its palette as plain strings. These colours and the font are
// hand-mirrored from src/styles/tokens/colors.css and typography.css — change
// one, change the other. The pair is maintained together on purpose:
//
//   fill           #0A1330                --color-surface-sunken
//   gridline       #1B2E5C                --color-border-subtle
//   axisLabel      #3A4E7E                --color-slate-500
//   line/dot       #FFC81E                --color-accent
//   gradient       rgba(255,200,30,.30)   --color-accent-fade-top
//                  rgba(255,200,30,0)     --color-accent-fade-bottom
//   bgApp          #05091A                --color-bg-app
//   groundGridLine #26406F                --color-border-control
//   groundGridAxis #FFC81E                --color-accent
//
// Decision: a hand-mirrored constant rather than reading
// getComputedStyle(document.documentElement) — it avoids a layout read on every
// frame, and it works before the stylesheet has resolved.
//
// The file is named for the framerate chart, which was its only consumer. bgApp
// arrived with COS-231's sky toggle: with the sky off the background renderer
// has to fill the frame flat, and it needs the app background as a string for
// exactly the reason above. groundGridLine and groundGridAxis arrived with
// COS-246's world grid — plain hex rather than a pre-mixed rgba, because
// GroundGrid fades both by alpha at draw time and needs the bare channels to do
// it. One sanctioned mirror of colors.css is the point — a second one beside
// the rasteriser is what this file exists to prevent.

export const chartTokens = Object.freeze({
  fill: "#0A1330",
  gridline: "#1B2E5C",
  axisLabel: "#3A4E7E",
  line: "#FFC81E",
  dot: "#FFC81E",
  gradientTop: "rgba(255,200,30,.30)",
  gradientBottom: "rgba(255,200,30,0)",
  bgApp: "#05091A",
  groundGridLine: "#26406F",
  groundGridAxis: "#FFC81E",
  font: "500 8px 'JetBrains Mono', monospace",
});
