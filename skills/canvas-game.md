---
name: canvas-game
description: Polished HTML5 canvas games in one file
triggers: game, snake, tetris, platformer, shooter, arcade, flappy
---
Build browser games as one index.html: canvas + embedded JS, 60fps, juicy.

CORE LOOP:
- requestAnimationFrame with delta time: const dt = Math.min((now-last)/1000, 0.05) — clamp dt so tab-switches don't teleport things.
- States: MENU → PLAYING → GAMEOVER (and PAUSED). Draw a proper title screen and game-over screen with score — never dump the player straight into gameplay.
- Input: keydown/keyup into a held-keys Set; also add touch/click controls so it works on phone.

FEEL (this is what separates good from cheap — always include):
- Screen shake on hits: offset ctx.translate by random ±intensity, decay intensity *= 0.9 per frame.
- Particles: tiny pool of {x,y,vx,vy,life} squares on every kill/score/death.
- Squash & stretch or scale-pop on the player when jumping/scoring.
- Score pops: floating "+10" text that rises and fades.
- Slight easing on everything (lerp cameras, lerp UI) — nothing snaps.

RENDERING:
- Fixed internal resolution (e.g. 480x720 portrait or 960x540 landscape), scale canvas with CSS to fit window, image-rendering pixelated if pixel-art style.
- Dark bg + 2-3 neon accent colors, or clean flat pastel. Draw shapes with glow (ctx.shadowBlur + shadowColor) instead of sprites — looks premium with zero assets.

PERSISTENCE: localStorage high score, shown on menu and game-over.
AUDIO: tiny WebAudio beeps via an oscillator helper (playTone(freq, dur, type)) — no audio files. Resume AudioContext on first user gesture.
NEVER: setInterval game loops, physics tied to framerate, silent games, unexplained controls (always show "ARROWS / WASD — SPACE" on the menu).
