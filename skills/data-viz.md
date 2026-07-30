---
name: data-viz
description: Charts and dashboards that read clearly
triggers: chart, graph, dashboard, visualization, visualisation, plot, analytics, stats page
---
Draw charts with SVG or canvas — no chart libraries unless asked. Clarity beats decoration.

CHOOSING THE FORM: trend over time → line; compare categories → horizontal bars (labels stay readable); part-of-whole → stacked bar (avoid pie beyond 3 slices); distribution → histogram; two variables → scatter. Big single numbers → stat tiles with the number huge and the label small.

RULES THAT MAKE CHARTS READ WELL:
- Bars start at zero, always. Line charts may zoom but must label the axis clearly.
- Max 6 colors; one hue for the data, gray for context/comparison, one accent for the highlighted series. On dark UIs: desaturated brights (#6ea8fe, #7bd88f, #ffb86c style), gridlines rgba(255,255,255,0.06).
- Label directly on/next to the data when possible instead of a legend the eye must round-trip to.
- Numbers: tabular-nums, thousands separators, and units ONCE in the axis/title, not on every tick.
- 4-6 gridlines max, no vertical gridlines unless scatter, axis lines thinner than data lines.
- Tooltips on hover for exact values (a single positioned div, pointer-events none).
- Animate on first paint only (bars grow, lines draw via stroke-dashoffset, numbers count up ≤1s) — never loop animations on data.
- Empty/loading states: show the chart skeleton, never a blank box.

DASHBOARD LAYOUT: stat tile row on top (the "so what" numbers), main trend chart below at 2/3 width, breakdown chart beside it, table last. Consistent paddings, every card same radius/border as the app's tokens.
