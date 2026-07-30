---
name: apple-app-ui
description: Apple/iOS-level UI for web apps and tools (timers, calculators, utilities)
triggers: timer, stopwatch, clock, calculator, apple, ios, app ui, tool ui, utility, converter, counter
---
Build web APP interfaces (not landing pages) that look like Apple shipped them. Reference: the iOS Clock app.

FOUNDATION:
- Pure black bg (#000) — not dark gray. Apps float on black, no card/container box around everything.
- Font stack: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif. NEVER a Google font for app UI.
- Apple's exact dark-mode tokens: text rgba(255,255,255,0.92); secondary rgba(235,235,245,0.6); tertiary rgba(235,235,245,0.3); fills rgba(120,120,128,0.2). System colors: orange #ff9f0a, green #30d158, red #ff453a, blue #0a84ff.
- ONE accent color per screen. Big numbers: font-weight 200 (ultra-light), 56-72px, font-variant-numeric: tabular-nums so digits don't jiggle.
- Motion curve for everything: cubic-bezier(0.32, 0.72, 0, 1). Press feedback: transform: scale(0.92) on :active.

SIGNATURE COMPONENTS (copy these patterns):
- Progress ring: SVG circle, r=141 in a 300 viewBox, stroke-width 7, stroke-linecap round, rotate(-90deg), track rgba(255,255,255,0.07), animate stroke-dashoffset = CIRC * (1 - remaining/total). Content absolutely centered inside.
- Segmented control: container background rgba(120,120,128,0.2), border-radius 10px, padding 2px, plus an absolutely-positioned sliding "thumb" div (background rgba(99,99,102,0.85), radius 8px, transition transform 0.35s) that translateX's to the active segment.
- iOS Clock action buttons: circles 84px, tinted translucent bg with matching text — Start: rgba(48,209,88,0.18) bg + #30d158 text; Pause: rgba(255,159,10,0.18) + #ff9f0a; Cancel: rgba(255,255,255,0.12) + white. Inner ring via ::after { inset: 2px; border-radius: 50%; border: 1.5px solid #000 }.
- Stepper: circular 34px +/− buttons, fill background, value in tabular-nums between them.
- Status labels: 13px, uppercase, letter-spacing 0.06-0.16em, tertiary color; tint it with the accent when active.

ENGINEERING RULES (apps must be CORRECT, not just pretty):
- Timing: store a wall-clock end timestamp (endAt = Date.now() + remainMs) and recompute remaining every tick — never decrement a counter. Drive ticks with setInterval(200), NOT requestAnimationFrame (rAF freezes in background tabs; setInterval keeps going).
- Update document.title with live state (e.g. "04:32 — Timer").
- Keyboard shortcuts (Space = primary action, R = reset) + show a small hint line.
- Persist user settings in localStorage.
- Sounds: WebAudio oscillator chime (sine, 880/660Hz, exponential gain ramp), never audio files; wrap in try/catch.
- States as a tiny machine: idle | running | paused | done, reflected as a body class so CSS handles all visual changes.

NEVER: card-in-card boxes, purple-on-navy default palettes, Google fonts, decorative gradients on buttons, font-weight 300+ for hero numbers, rAF-driven clocks.
